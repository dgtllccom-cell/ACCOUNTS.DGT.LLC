import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

const KEEP_COUNTRY_CODES = ["AE", "PK", "AF"];
const SUPER_ADMIN_ID = "7719341b-bfcb-4a31-b852-0f67e8062e95";
const COUNTRY_ADMINS = {
  AE: "3b7f6a85-6201-43fb-a3ce-f1312a5f3e82",
  PK: "9667b381-dba3-43d1-8911-d7f519427a56",
};
const MAIN_BRANCH_ADMINS = {
  AE: "3f970255-af4a-4300-9d3b-871259f34e1c",
  PK: "ae8b517e-d822-465f-88e9-5c6afa74b65e",
};
const EXPECTED_FINGERPRINT = "7f70f5fbb71c";
const MODULES = [
  ["dashboard", "Dashboard", false],
  ["user_management", "User Management", false],
  ["countries", "Countries", false],
  ["branches", "Branches", false],
  ["accounts", "Accounts", true],
  ["purchase", "Purchase", true],
  ["sales", "Sales", true],
  ["inventory", "Inventory", true],
  ["warehouse", "Warehouse", false],
  ["hrm", "HRM", false],
  ["crm", "CRM", false],
  ["loading", "Loading", false],
  ["reports", "Reports", true],
  ["journal", "Journal", true],
  ["roznamcha", "Roznamcha", true],
  ["ledger", "Ledger", true],
  ["cash_management", "Cash Management", true],
  ["ai_modules", "AI Modules", false],
  ["print_reports", "Print Reports", false],
  ["notifications", "Notification System", false],
];

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
  ...readEnvFile(".env"),
  ...readEnvFile(".env.local"),
  ...readEnvFile(".env.production"),
  ...process.env,
};
const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const backupArg = process.argv
  .slice(2)
  .find((argument) => argument.startsWith("--backup="));
const backupDir = backupArg?.slice("--backup=".length);

if (!env.DATABASE_URL) throw new Error("DATABASE_URL is not configured.");
if (apply && !backupDir) {
  throw new Error("--apply requires --backup=<completed backup directory>.");
}

function databaseIdentity() {
  const databaseUrl = new URL(env.DATABASE_URL);
  return {
    host: databaseUrl.hostname,
    name: databaseUrl.pathname.replace(/^\//, ""),
    fingerprint: crypto
      .createHash("sha256")
      .update(`${databaseUrl.hostname}/${databaseUrl.pathname}`)
      .digest("hex")
      .slice(0, 12),
  };
}

function validateBackup(directory) {
  const manifestPath = path.join(directory, "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Backup manifest is missing: ${manifestPath}`);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (manifest.status !== "complete" || !manifest.completedAt) {
    throw new Error("Backup manifest is not complete.");
  }
  if (Number(manifest.tableCount || 0) < 100) {
    throw new Error("Backup manifest has an unexpectedly low table count.");
  }
  for (const entry of Object.values(manifest.tables || {})) {
    const fileName = entry.file || entry.fileName || entry.path;
    if (!fileName) continue;
    const filePath = path.resolve(directory, fileName);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Backup file is missing: ${fileName}`);
    }
    if (entry.bytes != null && fs.statSync(filePath).size !== Number(entry.bytes)) {
      throw new Error(`Backup file size mismatch: ${fileName}`);
    }
  }
  return {
    path: path.resolve(directory),
    completedAt: manifest.completedAt,
    tableCount: manifest.tableCount,
  };
}

const identity = databaseIdentity();
if (identity.fingerprint !== EXPECTED_FINGERPRINT) {
  throw new Error(
    `Database fingerprint mismatch (${identity.fingerprint}); expected ${EXPECTED_FINGERPRINT}.`,
  );
}
const backup = apply ? validateBackup(backupDir) : null;
const sql = postgres(env.DATABASE_URL, {
  max: 1,
  prepare: false,
  connect_timeout: 20,
  idle_timeout: 20,
});

async function count(client, query) {
  const [row] = await client.unsafe(query);
  return Number(row?.count || 0);
}

async function getTargets(client) {
  const countries = await client`
    select id, iso2 as code, name, currency_code
    from countries
    where iso2 = any(${KEEP_COUNTRY_CODES})
    order by iso2
  `;
  if (countries.length !== 3) {
    throw new Error("The required AE, PK and AF operating countries were not found.");
  }
  const branches = await client`
    select cb.id, cb.country_id, cb.code, cb.name, c.iso2 as country_code
    from country_branches cb
    join countries c on c.id = cb.country_id
    where c.iso2 = any(${KEEP_COUNTRY_CODES})
      and cb.status = 'active'
    order by c.iso2, cb.created_at
  `;
  const firstByCountry = new Map();
  for (const branch of branches) {
    if (!firstByCountry.has(branch.country_code)) {
      firstByCountry.set(branch.country_code, branch);
    }
  }
  if (firstByCountry.size !== 3) {
    throw new Error("A required active main branch is missing.");
  }
  return {
    countries,
    branches: [...firstByCountry.values()],
    countryByCode: new Map(countries.map((row) => [row.code, row])),
    branchByCode: firstByCountry,
  };
}

async function getForeignKeysTo(client, targetTable) {
  return client`
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

async function detachReferences(client, targetTable, ids) {
  if (!ids.length) return [];
  const impacts = [];
  const foreignKeys = await getForeignKeysTo(client, targetTable);
  for (const fk of foreignKeys) {
    const table = `"${fk.table_name.replaceAll('"', '""')}"`;
    const column = `"${fk.column_name.replaceAll('"', '""')}"`;
    const [row] = await client.unsafe(
      `select count(*)::bigint as count from ${table} where ${column} = any($1::uuid[])`,
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
    if (apply) {
      await client.unsafe(
        `update ${table} set ${column} = null where ${column} = any($1::uuid[])`,
        [ids],
      );
    }
  }
  return impacts;
}

async function cleanup(client) {
  const targets = await getTargets(client);
  const keepCountryIds = targets.countries.map((row) => row.id);
  const keepBranchIds = targets.branches.map((row) => row.id);
  const extraBranches = await client`
    select id, code, name
    from country_branches
    where not (id = any(${keepBranchIds}))
  `;
  const cityBranches = await client`select id, code, name from city_branches`;
  const extraBranchIds = extraBranches.map((row) => row.id);
  const cityBranchIds = cityBranches.map((row) => row.id);

  const report = {
    mode: apply ? "apply" : "dry-run",
    database: identity,
    backup,
    preserved: {
      countryCodes: KEEP_COUNTRY_CODES,
      countryIds: keepCountryIds,
      mainBranchIds: keepBranchIds,
      globalLocationMaster: true,
      settingsAndConfiguration: true,
    },
    candidates: {
      extraMainBranches: extraBranches,
      cityBranches,
      unscopedPurchaseOrders: await count(
        client,
        "select count(*) from purchase_orders where country_id is null and country_branch_id is null and city_branch_id is null and created_by is null",
      ),
      unscopedRoznamchaEntries: await count(
        client,
        "select count(*) from roznamcha_entries where country_id is null and country_branch_id is null and city_branch_id is null and created_by is null",
      ),
    },
    detachedReferences: {},
    users: {},
    modules: {},
  };

  if (apply) {
    await client`select pg_advisory_xact_lock(72420260730)`;
  }

  report.detachedReferences.cityBranches = await detachReferences(
    client,
    "city_branches",
    cityBranchIds,
  );
  report.detachedReferences.extraMainBranches = await detachReferences(
    client,
    "country_branches",
    extraBranchIds,
  );

  if (!apply) return report;

  await client`update profiles set raw_password = null where raw_password is not null`;

  await client`
    delete from user_role_assignments
    where role = 'super_admin'
      and user_id <> ${SUPER_ADMIN_ID}
  `;
  await client`
    delete from user_role_assignments
    where role = 'super_admin'
      and user_id = ${SUPER_ADMIN_ID}
      and id not in (
        select id from user_role_assignments
        where role = 'super_admin' and user_id = ${SUPER_ADMIN_ID}
        order by created_at, id
        limit 1
      )
  `;
  await client`
    delete from user_role_assignments
    where role = 'country_admin'
      and country_id = ${targets.countryByCode.get("AE").id}
      and user_id <> ${COUNTRY_ADMINS.AE}
  `;

  for (const [code, userId] of Object.entries(MAIN_BRANCH_ADMINS)) {
    const country = targets.countryByCode.get(code);
    const branch = targets.branchByCode.get(code);
    await client`
      update user_role_assignments
      set role = 'main_branch_admin',
          country_id = ${country.id},
          country_branch_id = ${branch.id},
          city_branch_id = null,
          is_active = true
      where user_id = ${userId}
        and role = 'city_branch_admin'
    `;
  }

  await client`
    delete from user_role_assignments a
    using user_role_assignments b
    where a.id > b.id
      and a.user_id = b.user_id
      and a.role = b.role
      and a.country_id is not distinct from b.country_id
      and a.country_branch_id is not distinct from b.country_branch_id
      and a.city_branch_id is not distinct from b.city_branch_id
  `;

  if (cityBranchIds.length) {
    await client`delete from city_branches where id = any(${cityBranchIds})`;
  }
  if (extraBranchIds.length) {
    await client`delete from country_branches where id = any(${extraBranchIds})`;
  }

  const unscopedPurchaseIds = (
    await client`
      select id from purchase_orders
      where country_id is null
        and country_branch_id is null
        and city_branch_id is null
        and created_by is null
    `
  ).map((row) => row.id);
  await detachReferences(client, "purchase_orders", unscopedPurchaseIds);
  if (unscopedPurchaseIds.length) {
    await client`delete from purchase_orders where id = any(${unscopedPurchaseIds})`;
  }

  const unscopedRoznamchaIds = (
    await client`
      select id from roznamcha_entries
      where country_id is null
        and country_branch_id is null
        and city_branch_id is null
        and created_by is null
    `
  ).map((row) => row.id);
  await detachReferences(client, "roznamcha_entries", unscopedRoznamchaIds);
  if (unscopedRoznamchaIds.length) {
    await client`delete from roznamcha_entries where id = any(${unscopedRoznamchaIds})`;
  }

  for (const [sortOrder, [code, name, isFinancial]] of MODULES.entries()) {
    await client`
      insert into erp_modules (code, name, status, is_financial, sort_order, deleted_at)
      values (${code}, ${name}, 'active', ${isFinancial}, ${sortOrder + 1}, null)
      on conflict (code) where deleted_at is null
      do update set
        name = excluded.name,
        status = 'active',
        is_financial = excluded.is_financial,
        sort_order = excluded.sort_order,
        updated_at = now()
    `;
  }

  report.users = {
    profiles: await count(client, "select count(*) from profiles"),
    rawPasswords: await count(
      client,
      "select count(*) from profiles where raw_password is not null",
    ),
    superAdmins: await count(
      client,
      "select count(distinct user_id) from user_role_assignments where role = 'super_admin' and is_active",
    ),
    countryAdmins: await count(
      client,
      "select count(*) from user_role_assignments where role = 'country_admin' and is_active",
    ),
    mainBranchAdmins: await count(
      client,
      "select count(*) from user_role_assignments where role = 'main_branch_admin' and is_active",
    ),
  };
  report.modules = {
    required: MODULES.length,
    active: await count(
      client,
      `select count(*) from erp_modules where status = 'active' and deleted_at is null and code = any(array[${MODULES.map(([code]) => `'${code}'`).join(",")}])`,
    ),
  };
  report.verification = {
    operatingMainBranches: await count(
      client,
      `select count(*) from country_branches where id = any(array[${keepBranchIds.map((id) => `'${id}'::uuid`).join(",")}])`,
    ),
    extraMainBranches: await count(
      client,
      `select count(*) from country_branches where not (id = any(array[${keepBranchIds.map((id) => `'${id}'::uuid`).join(",")}]))`,
    ),
    cityBranches: await count(client, "select count(*) from city_branches"),
    duplicateRoleAssignments: await count(
      client,
      `select count(*) from (
        select user_id, role, country_id, country_branch_id, city_branch_id
        from user_role_assignments
        group by user_id, role, country_id, country_branch_id, city_branch_id
        having count(*) > 1
      ) duplicates`,
    ),
  };
  return report;
}

try {
  const result = apply
    ? await sql.begin(async (transaction) => cleanup(transaction))
    : await cleanup(sql);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} finally {
  await sql.end({ timeout: 5 });
}

