import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

const PROD_REF = "inmayhrxucimxqhgseqi";
const KEEP_COUNTRY_CODES = ["AE", "PK", "IN", "AF"];

const REQUIRED_BACKUP = process.argv.find((argument) =>
  argument.startsWith("--backup="),
);
const BACKUP_PATH = REQUIRED_BACKUP?.slice("--backup=".length);
const BACKUP_VERIFIED = process.argv.includes("--backup-verified");
const APPLY = process.argv.includes("--apply");
const ALLOW_PRODUCTION = process.argv.includes("--allow-production");

function readEnvFile(fileName) {
  if (!fs.existsSync(fileName)) return {};
  return Object.fromEntries(
    fs
      .readFileSync(fileName, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const separator = line.indexOf("=");
        return [
          line.slice(0, separator).trim(),
          line
            .slice(separator + 1)
            .trim()
            .replace(/^['"]|['"]$/g, ""),
        ];
      }),
  );
}

const env = {
  ...readEnvFile(".env.production"),
  ...readEnvFile(".env.local"),
  ...readEnvFile(".env"),
  ...process.env,
};

if (!env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not configured.");
}
if (APPLY && !ALLOW_PRODUCTION) {
  throw new Error("--apply requires --allow-production.");
}
if (APPLY && !BACKUP_PATH) {
  throw new Error("--apply requires --backup=<verified-backup-archive-or-directory>.");
}
if (BACKUP_PATH && !BACKUP_VERIFIED && !fs.existsSync(BACKUP_PATH)) {
  throw new Error(`Backup path does not exist: ${BACKUP_PATH}`);
}

function databaseIdentity() {
  const databaseUrl = new URL(env.DATABASE_URL);
  const supabaseUrl = env.PROD_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
  const refFromUrl = supabaseUrl ? new URL(supabaseUrl).hostname.split(".")[0]?.toLowerCase() : null;
  const refFromDb =
    databaseUrl.hostname.match(/postgres\.([a-z0-9]+)$/i)?.[1]?.toLowerCase() ||
    databaseUrl.hostname.match(/db\.([a-z0-9]+)\.supabase/i)?.[1]?.toLowerCase() ||
    databaseUrl.pathname.replace(/^\//, "");
  const ref = (
    env.PROD_SUPABASE_REF ||
    env.PROD_PROJECT_REF ||
    env.SUPABASE_PROJECT_REF ||
    refFromUrl ||
    refFromDb ||
    ""
  ).toLowerCase();
  return {
    host: databaseUrl.hostname,
    database: databaseUrl.pathname.replace(/^\//, ""),
    ref,
    fingerprint: crypto
      .createHash("sha256")
      .update(`${ref || refFromDb}/${databaseUrl.hostname}/${databaseUrl.pathname}`)
      .digest("hex")
      .slice(0, 12),
  };
}

const identity = databaseIdentity();
if (identity.ref !== PROD_REF) {
  throw new Error(
    `Refusing to run cleanup on non-production database ref "${identity.ref}". Expected "${PROD_REF}".`,
  );
}

const sql = postgres(env.DATABASE_URL, {
  max: 1,
  prepare: false,
  connect_timeout: 30,
  idle_timeout: 30,
});

function quoteIdent(name) {
  return `"${String(name).replaceAll('"', '""')}"`;
}

async function tableExists(db, table) {
  const [row] = await db`select to_regclass(${`public.${table}`}) as table_name`;
  return Boolean(row?.table_name);
}

async function tableKind(db, table) {
  const rows = await db`
    select c.relkind
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = ${table}
    limit 1
  `;
  return rows[0]?.relkind || null;
}

async function countRows(db, table, whereSql = "true") {
  if (!(await tableExists(db, table))) return null;
  const [row] = await db.unsafe(
    `select count(*)::bigint as count from public.${quoteIdent(table)} where ${whereSql}`,
  );
  return Number(row?.count || 0);
}

async function countTables(db, tables) {
  const counts = {};
  for (const table of tables) {
    counts[table] = await countRows(db, table);
  }
  return counts;
}

async function getForeignKeysTo(db, targetTable) {
  return db`
    select
      tc.table_name,
      kcu.column_name,
      rc.delete_rule,
      cols.is_nullable
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on tc.constraint_name = kcu.constraint_name
      and tc.constraint_schema = kcu.constraint_schema
    join information_schema.constraint_column_usage ccu
      on tc.constraint_name = ccu.constraint_name
      and tc.constraint_schema = ccu.constraint_schema
    join information_schema.referential_constraints rc
      on tc.constraint_name = rc.constraint_name
      and tc.constraint_schema = rc.constraint_schema
    join information_schema.columns cols
      on cols.table_schema = tc.table_schema
      and cols.table_name = tc.table_name
      and cols.column_name = kcu.column_name
    where tc.constraint_type = 'FOREIGN KEY'
      and tc.table_schema = 'public'
      and ccu.table_schema = 'public'
      and ccu.table_name = ${targetTable}
  `;
}

async function detachReferences(db, targetTable, ids, { skipTables = [] } = {}) {
  if (!ids.length) return [];
  const impacts = [];
  const foreignKeys = await getForeignKeysTo(db, targetTable);
  for (const fk of foreignKeys) {
    if (skipTables.includes(fk.table_name)) {
      continue;
    }
    const table = `"${fk.table_name.replaceAll('"', '""')}"`;
    const column = `"${fk.column_name.replaceAll('"', '""')}"`;
    const [row] = await db.unsafe(
      `select count(*)::bigint as count from public.${table} where ${column} = any($1::uuid[])`,
      [ids],
    );
    const references = Number(row?.count || 0);
    if (!references) continue;
    impacts.push({
      table: fk.table_name,
      column: fk.column_name,
      references,
      deleteRule: fk.delete_rule,
      nullable: fk.is_nullable === "YES",
    });
    if (fk.delete_rule === "CASCADE") continue;
    if (fk.is_nullable !== "YES") {
      throw new Error(
        `Cannot safely remove ${targetTable}: ${fk.table_name}.${fk.column_name} has ${references} non-nullable references.`,
      );
    }
    if (APPLY) {
      await db.unsafe(
        `update public.${table} set ${column} = null where ${column} = any($1::uuid[])`,
        [ids],
      );
    }
  }
  return impacts;
}

async function deleteRows(db, table, whereClause = "true") {
  if (!(await tableExists(db, table))) {
    return { table, status: "skipped_missing", before: null, after: null };
  }
  const before = await countRows(db, table, whereClause);
  if (APPLY && before) {
    await db.unsafe(`delete from public.${quoteIdent(table)} where ${whereClause}`);
  }
  const after = await countRows(db, table, whereClause);
  return { table, status: APPLY ? "deleted" : "dry_run", before, after };
}

const MASTER_DELETE_TABLES = [
  "ledgers",
  "accounts",
  "branches",
  "account_companies",
  "account_banks",
  "account_warehouses",
  "account_customer_owners",
  "company_banks",
  "bank_accounts",
  "companies",
  "company_parameters",
  "company_settings",
  "customer_contacts",
  "customer_registrations",
  "customers",
  "employees",
  "suppliers",
  "supplier_contacts",
  "warehouses",
  "banks",
  "enterprise_accounts",
];

const TRANSACTION_DELETE_TABLES = [
  "ledger_transaction_audit_trail",
  "stock_movements",
  "inter_branch_ledger_transfers",
  "bank_cheque_transactions",
  "purchase_loading_records",
  "shipping_bl_records",
  "purchase_order_expenses",
  "purchase_order_items",
  "purchase_order_reports",
  "purchase_order_payments",
  "purchase_orders",
  "local_purchases",
  "sales_order_payments",
  "sales_orders",
  "shipping_line_records",
  "shipment_documents",
  "roznamcha_reversals",
  "ledger_entries",
  "journal_lines",
  "journal_entries",
  "ledger_balances",
  "ledger_posting_lines",
  "ledger_posting_batches",
  "ledger_opening_balances",
  "enterprise_ledger_reversals",
  "enterprise_account_history",
  "cash_transactions",
  "roznamcha_entries",
  "roznamcha_lines",
  "transactions",
  "daily_usd_rates",
  "usd_purchase_sales",
  "exchange_rate_history",
  "approval_status_history",
  "approval_request_items",
  "approval_requests",
  "record_locks",
  "record_change_history",
  "soft_delete_logs",
  "attachments",
  "audit_logs",
  "erp_activity_events",
  "erp_record_transfers",
  "erp_pdf_email_jobs",
  "erp_assignments",
  "product_inventory_balances",
  "voucher_sequences",
  "transaction_serial_sequences",
  "module_number_sequences",
];

const TRANSLATION_TARGET_TABLES = [
  ...MASTER_DELETE_TABLES,
  ...TRANSACTION_DELETE_TABLES,
];

const PRESERVE_CORE_TABLES = [
  "countries",
  "states_provinces",
  "cities",
  "areas_locations",
  "postal_codes",
  "profiles",
  "user_role_assignments",
  "roles",
  "permissions",
  "role_permissions",
  "erp_modules",
  "languages",
  "translation_keys",
  "translation_values",
  "settings",
  "app_settings",
  "system_settings",
];

async function pickPrimaryBranches(db, countries) {
  const branches = [];
  for (const country of countries) {
    const rows = await db`
      select id, country_id, name, code, status, created_at
      from country_branches
      where country_id = ${country.id}
        and deleted_at is null
      order by
        case
          when upper(coalesce(code, '')) like '%MAIN%' then 0
          when upper(coalesce(name, '')) like '%MAIN%' then 0
          else 1
        end,
        created_at asc,
        id asc
      limit 1
    `;
    if (!rows.length) {
      throw new Error(`Missing a main branch for ${country.name} (${country.code}).`);
    }
    branches.push(rows[0]);
  }
  return branches;
}

async function pickPreservedUsers(db, countries, mainBranches) {
  const assignments = await db`
    select
      ura.id,
      ura.user_id,
      ura.role::text as role,
      ura.country_id,
      ura.country_branch_id,
      ura.city_branch_id,
      ura.is_active,
      ura.created_at,
      p.full_name
    from user_role_assignments ura
    join profiles p on p.id = ura.user_id
    where ura.is_active = true
    order by ura.created_at asc, ura.id asc
  `;

  const selectedAssignments = [];
  const selectedUsers = new Set();
  const selectionReasons = [];

  const superAdmins = assignments.filter((row) => row.role === "super_admin");
  for (const superAdmin of superAdmins) {
    selectedAssignments.push(superAdmin.id);
    selectedUsers.add(superAdmin.user_id);
    selectionReasons.push({
      user_id: superAdmin.user_id,
      full_name: superAdmin.full_name,
      role: superAdmin.role,
      reason: "super_admin",
    });
  }

  for (const country of countries) {
    const branch = mainBranches.find((row) => row.country_id === country.id);
    const candidates = assignments.filter(
      (row) =>
        row.country_id === country.id ||
        row.country_branch_id === branch.id ||
        row.city_branch_id === branch.id,
    );
    const prioritized =
      candidates.find((row) => row.role === "country_admin") ||
      candidates.find((row) => row.role === "main_branch_admin") ||
      candidates[0] ||
      null;
    if (!prioritized) {
      selectionReasons.push({
        country: country.code,
        reason: "missing-main-user",
      });
      continue;
    }
    selectedAssignments.push(prioritized.id);
    selectedUsers.add(prioritized.user_id);
    selectionReasons.push({
      country: country.code,
      user_id: prioritized.user_id,
      full_name: prioritized.full_name,
      role: prioritized.role,
      reason: "country-main-user",
    });
  }

  return { selectedAssignments, selectedUsers: [...selectedUsers], selectionReasons };
}

async function cleanup(db) {
  const countries = await db`
    select id, name, iso2 as code, currency_code
    from countries
    where upper(iso2) = any(${KEEP_COUNTRY_CODES})
    order by iso2
  `;
  if (countries.length !== KEEP_COUNTRY_CODES.length) {
    throw new Error(
      `Expected ${KEEP_COUNTRY_CODES.length} keep countries, found ${countries.length}.`,
    );
  }
  const mainBranches = await pickPrimaryBranches(db, countries);
  const preservedUsers = await pickPreservedUsers(db, countries, mainBranches);

  const keepCountryIds = countries.map((row) => row.id);
  const keepBranchIds = mainBranches.map((row) => row.id);
  const extraBranches = await db`
    select id, country_id, code, name
    from country_branches
    where not (id = any(${keepBranchIds}::uuid[]))
  `;
  const cityBranches = await db`
    select id, country_id, country_branch_id, code, name
    from city_branches
  `;

  const branchReferenceImpact = {
    extraMainBranches: await detachReferences(
      db,
      "country_branches",
      extraBranches.map((row) => row.id),
      { skipTables: [...MASTER_DELETE_TABLES, ...TRANSACTION_DELETE_TABLES] },
    ),
    cityBranches: await detachReferences(
      db,
      "city_branches",
      cityBranches.map((row) => row.id),
      { skipTables: [...MASTER_DELETE_TABLES, ...TRANSACTION_DELETE_TABLES] },
    ),
  };

  const before = {
    countries: await countRows(db, "countries"),
    country_branches: await countRows(db, "country_branches"),
    city_branches: await countRows(db, "city_branches"),
    profiles: await countRows(db, "profiles"),
    user_role_assignments: await countRows(db, "user_role_assignments"),
    branches: await countRows(db, "branches"),
    companies: await countRows(db, "companies"),
    banks: await countRows(db, "banks"),
    customers: await countRows(db, "customers"),
    employees: await countRows(db, "employees"),
    warehouses: await countRows(db, "warehouses"),
    account_companies: await countRows(db, "account_companies"),
    account_banks: await countRows(db, "account_banks"),
    account_warehouses: await countRows(db, "account_warehouses"),
    account_customer_owners: await countRows(db, "account_customer_owners"),
  };
  for (const table of TRANSACTION_DELETE_TABLES) {
    before[table] = await countRows(db, table);
  }

  const preserveTablesBefore = await countTables(db, PRESERVE_CORE_TABLES);

  const translationCountBefore = {
    record_translations: await countRows(db, "record_translations"),
    record_translation_events: await countRows(db, "record_translation_events"),
    enterprise_record_translations: await countRows(db, "enterprise_record_translations"),
  };

  const report = {
    mode: APPLY ? "apply" : "dry-run",
    database: identity,
    backup: BACKUP_PATH ? path.resolve(BACKUP_PATH) : null,
    preserved: {
      countries: countries,
      mainBranches,
      selectedUsers: preservedUsers.selectionReasons,
      keepCountryIds,
      keepBranchIds,
    },
    cleanupTargets: {
      masterDeleteTables: MASTER_DELETE_TABLES,
      transactionalDeleteTables: TRANSACTION_DELETE_TABLES,
      translationTargets: TRANSLATION_TARGET_TABLES,
      extraMainBranches: extraBranches,
      cityBranches,
      branchReferenceImpact,
    },
    before,
    preserveTablesBefore,
    translationCountBefore,
  };

  if (!APPLY) {
    return report;
  }

  await db.begin(async (tx) => {
    await tx`set statement_timeout = 0`.catch(() => []);

    // 1) Remove translation / audit rows for deleted business records.
    if (await tableExists(tx, "record_translation_events")) {
      await tx`
        delete from public.record_translation_events
        where record_translation_id in (
          select id
          from public.record_translations
          where record_table = any(${TRANSLATION_TARGET_TABLES})
        )
      `.catch(() => []);
    }
    const recordTranslationsKind = await tableKind(tx, "record_translations");
    if (recordTranslationsKind === "r") {
      await tx`
        delete from public.record_translations
        where record_table = any(${TRANSLATION_TARGET_TABLES})
      `.catch(() => []);
    }
    if (await tableExists(tx, "enterprise_record_translations")) {
      await tx`
        delete from public.enterprise_record_translations
        where record_table = any(${TRANSLATION_TARGET_TABLES})
      `.catch(() => []);
    }
    if (await tableExists(tx, "audit_logs")) {
      await tx`
        delete from public.audit_logs
        where entity_table = any(${TRANSLATION_TARGET_TABLES})
           or entity_table = any(${MASTER_DELETE_TABLES})
      `.catch(() => []);
    }

    // 1b) Clear preserved branch/user references that point at records we are about to remove.
    if (await tableExists(tx, "user_role_assignments") && preservedUsers.selectedAssignments.length) {
      await tx`
        update public.user_role_assignments
        set city_branch_id = null
        where id = any(${preservedUsers.selectedAssignments}::uuid[])
          and city_branch_id is not null
      `.catch(() => []);
    }
    if (await tableExists(tx, "country_branches") && keepBranchIds.length) {
      await tx`
        update public.country_branches
        set company_id = null
        where id = any(${keepBranchIds}::uuid[])
          and company_id is not null
      `.catch(() => []);
    }

    // 2) Delete operating transactions and postings.
    for (const table of TRANSACTION_DELETE_TABLES) {
      if (!(await tableExists(tx, table))) continue;
      await tx.unsafe(`delete from public.${quoteIdent(table)}`);
    }

    // 3) Remove account-link tables and master business data.
    for (const table of MASTER_DELETE_TABLES) {
      if (!(await tableExists(tx, table))) continue;
      await tx.unsafe(`delete from public.${quoteIdent(table)}`);
    }

    // 4) Remove branch records, keeping only one main branch per country.
    if (await tableExists(tx, "city_branches") && cityBranches.length) {
      await tx.unsafe(
        `delete from public.city_branches where id = any($1::uuid[])`,
        [cityBranches.map((row) => row.id)],
      );
    }
    if (await tableExists(tx, "country_branches") && extraBranches.length) {
      await tx.unsafe(
        `delete from public.country_branches where id = any($1::uuid[])`,
        [extraBranches.map((row) => row.id)],
      );
    }

    // 5) Remove extra user-role assignments and non-preserved profiles.
    if (await tableExists(tx, "user_role_assignments")) {
      await tx`
        delete from public.user_role_assignments
        where id <> all(${preservedUsers.selectedAssignments}::uuid[])
      `.catch(() => []);
    }

    if (await tableExists(tx, "profiles")) {
      await tx`
        delete from public.profiles
        where id <> all(${preservedUsers.selectedUsers}::uuid[])
      `.catch(() => []);
    }

    // 6) Attempt to prune auth users as well, if the schema is available.
    const authUsersExists = await tableExists(tx, "users".startsWith("users") ? "users" : "users");
    if (authUsersExists) {
      // no-op placeholder; the auth schema is handled separately below if accessible
    }
    if (APPLY) {
      try {
        await tx.unsafe(
          `delete from auth.users where id <> all($1::uuid[])`,
          [preservedUsers.selectedUsers],
        );
      } catch (error) {
        report.authCleanup = {
          attempted: true,
          status: "skipped_or_blocked",
          message: error?.message || String(error),
        };
      }
    }
  });

  const after = {
    countries: await countRows(db, "countries"),
    country_branches: await countRows(db, "country_branches"),
    city_branches: await countRows(db, "city_branches"),
    profiles: await countRows(db, "profiles"),
    user_role_assignments: await countRows(db, "user_role_assignments"),
    branches: await countRows(db, "branches"),
    companies: await countRows(db, "companies"),
    banks: await countRows(db, "banks"),
    customers: await countRows(db, "customers"),
    employees: await countRows(db, "employees"),
    warehouses: await countRows(db, "warehouses"),
    account_companies: await countRows(db, "account_companies"),
    account_banks: await countRows(db, "account_banks"),
    account_warehouses: await countRows(db, "account_warehouses"),
    account_customer_owners: await countRows(db, "account_customer_owners"),
  };
  for (const table of TRANSACTION_DELETE_TABLES) {
    after[table] = await countRows(db, table);
  }

  const preserveTablesAfter = await countTables(db, PRESERVE_CORE_TABLES);
  const translationCountAfter = {
    record_translations: await countRows(db, "record_translations"),
    record_translation_events: await countRows(db, "record_translation_events"),
    enterprise_record_translations: await countRows(db, "enterprise_record_translations"),
  };

  return {
    ...report,
    applied: true,
    after,
    preserveTablesAfter,
    translationCountAfter,
  };
}

try {
  const result = await cleanup(sql);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} finally {
  await sql.end({ timeout: 10 });
}
