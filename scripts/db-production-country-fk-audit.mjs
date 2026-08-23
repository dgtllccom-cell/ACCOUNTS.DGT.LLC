import fs from "node:fs";
import postgres from "postgres";

const PROD_REF = "inmayhrxucimxqhgseqi";

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
          line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, ""),
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

const databaseUrl = new URL(env.DATABASE_URL);
const supabaseUrl = env.PROD_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const refFromUrl = supabaseUrl ? new URL(supabaseUrl).hostname.split(".")[0]?.toLowerCase() : null;
const refFromDb =
  databaseUrl.hostname.match(/postgres\.([a-z0-9]+)$/i)?.[1]?.toLowerCase() ||
  databaseUrl.hostname.match(/db\.([a-z0-9]+)\.supabase/i)?.[1]?.toLowerCase() ||
  databaseUrl.pathname.replace(/^\//, "");
const ref = (env.PROD_SUPABASE_REF || env.PROD_PROJECT_REF || env.SUPABASE_PROJECT_REF || refFromUrl || refFromDb || "").toLowerCase();

if (ref !== PROD_REF) {
  throw new Error(`Refusing audit on non-production ref "${ref}"`);
}

const sql = postgres(env.DATABASE_URL, {
  max: 1,
  prepare: false,
  connect_timeout: 30,
  idle_timeout: 30,
});

const KEEP_COUNTRY_CODES = ["AE", "PK", "IN", "AF"];
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
  "inter_branch_ledger_transfers",
  "bank_cheque_transactions",
  "stock_movements",
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
const CANDIDATE_TABLES = [...new Set([...MASTER_DELETE_TABLES, ...TRANSACTION_DELETE_TABLES, "city_branches"])];
const KEEP_TABLES = [...new Set([...PRESERVE_CORE_TABLES, "country_branches"])];

async function tableExists(table) {
  const [row] = await sql`select to_regclass(${`public.${table}`}) as table_name`;
  return Boolean(row?.table_name);
}

async function countRows(table) {
  if (!(await tableExists(table))) return null;
  const [row] = await sql.unsafe(`select count(*)::bigint as count from public."${table.replaceAll('"', '""')}"`);
  return Number(row?.count || 0);
}

async function countNonNullReferences(table, column) {
  if (!(await tableExists(table))) return null;
  const [row] = await sql.unsafe(
    `select count(*)::bigint as count from public."${table.replaceAll('"', '""')}" where "${column.replaceAll('"', '""')}" is not null`,
  );
  return Number(row?.count || 0);
}

async function fetchCountries() {
  return sql`
    select id, name, iso2 as code
    from countries
    where upper(iso2) = any(${KEEP_COUNTRY_CODES})
    order by iso2
  `;
}

async function fetchMainBranches(countryIds) {
  const rows = await sql`
    select id, country_id, name, code, created_at
    from country_branches
    where country_id = any(${countryIds}::uuid[])
      and deleted_at is null
    order by
      country_id,
      case
        when upper(coalesce(code, '')) like '%MAIN%' then 0
        when upper(coalesce(name, '')) like '%MAIN%' then 0
        else 1
      end,
      created_at asc,
      id asc
  `;
  const byCountry = new Map();
  for (const row of rows) {
    if (!byCountry.has(row.country_id)) byCountry.set(row.country_id, row);
  }
  return byCountry;
}

async function fetchForeignKeys() {
  const rows = await sql`
    select
      tc.table_name as referencing_table,
      kcu.column_name as referencing_column,
      ccu.table_name as referenced_table,
      rc.delete_rule as delete_rule,
      cols.is_nullable as is_nullable
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
      and (
        tc.table_name = any(${CANDIDATE_TABLES}::text[])
        or ccu.table_name = any(${CANDIDATE_TABLES}::text[])
        or tc.table_name = any(${KEEP_TABLES}::text[])
        or ccu.table_name = any(${KEEP_TABLES}::text[])
      )
    order by ccu.table_name, tc.table_name, kcu.column_name
  `;
  return rows.map((row) => ({
    referencing_table: row.referencing_table,
    referencing_column: row.referencing_column,
    referenced_table: row.referenced_table,
    delete_rule: row.delete_rule,
    is_nullable: row.is_nullable === "YES",
  }));
}

function buildDeleteOrder(edges) {
  const deleteSet = new Set(CANDIDATE_TABLES);
  const graph = new Map();
  const indegree = new Map();
  for (const table of CANDIDATE_TABLES) {
    graph.set(table, new Set());
    indegree.set(table, 0);
  }
  for (const edge of edges) {
    if (!deleteSet.has(edge.referencing_table) || !deleteSet.has(edge.referenced_table)) continue;
    if (edge.referencing_table === edge.referenced_table) continue;
    const children = graph.get(edge.referencing_table);
    if (!children.has(edge.referenced_table)) {
      children.add(edge.referenced_table);
      indegree.set(edge.referenced_table, (indegree.get(edge.referenced_table) || 0) + 1);
    }
  }
  const queue = [...CANDIDATE_TABLES.filter((table) => (indegree.get(table) || 0) === 0)];
  const order = [];
  while (queue.length) {
    const table = queue.shift();
    order.push(table);
    for (const child of graph.get(table) || []) {
      indegree.set(child, indegree.get(child) - 1);
      if (indegree.get(child) === 0) queue.push(child);
    }
  }
  const remaining = CANDIDATE_TABLES.filter((table) => !order.includes(table));
  return { order, remaining, graph };
}

const countries = await fetchCountries();
const mainBranches = await fetchMainBranches(countries.map((country) => country.id));
const rowCounts = {};
for (const table of [...KEEP_COUNTRY_CODES.map(() => null), ...KEEP_TABLES, ...CANDIDATE_TABLES]) {
  void table;
}
for (const table of [...KEEP_TABLES, ...CANDIDATE_TABLES]) {
  rowCounts[table] = await countRows(table);
}

const foreignKeys = await fetchForeignKeys();
const targetEdges = foreignKeys.filter(
  (edge) => CANDIDATE_TABLES.includes(edge.referenced_table) || CANDIDATE_TABLES.includes(edge.referencing_table),
);

const blockers = targetEdges.filter((edge) => {
  if (!CANDIDATE_TABLES.includes(edge.referenced_table)) return false;
  if (CANDIDATE_TABLES.includes(edge.referencing_table)) return false;
  if (edge.delete_rule === "CASCADE") return false;
  if (edge.delete_rule === "SET NULL" && edge.is_nullable) return false;
  return true;
});

const softBlockers = targetEdges.filter((edge) => {
  if (!CANDIDATE_TABLES.includes(edge.referenced_table)) return false;
  if (CANDIDATE_TABLES.includes(edge.referencing_table)) return false;
  return edge.delete_rule === "SET NULL" && edge.is_nullable;
});

const blockerCounts = [];
for (const edge of [...blockers, ...softBlockers]) {
  const count = await countNonNullReferences(edge.referencing_table, edge.referencing_column);
  blockerCounts.push({ ...edge, count });
}
const activeBlockers = blockerCounts.filter((edge) => edge.count > 0);
const inactiveBlockers = blockerCounts.filter((edge) => edge.count === 0);

const deleteGraph = buildDeleteOrder(targetEdges);

const result = {
  database: {
    host: databaseUrl.hostname,
    database: databaseUrl.pathname.replace(/^\//, ""),
    ref,
  },
  keep: {
    countries,
    mainBranches: countries.map((country) => mainBranches.get(country.id) || null),
    preserveTables: KEEP_TABLES,
  },
  rowCounts,
  foreignKeys: targetEdges,
  blockers,
  softBlockers,
  blockerCounts,
  activeBlockers,
  inactiveBlockers,
  orderedDeletePlan: deleteGraph.order,
  cycleTables: deleteGraph.remaining,
};

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
await sql.end({ timeout: 10 });
