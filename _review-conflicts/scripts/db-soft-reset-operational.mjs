import fs from "node:fs";
import postgres from "postgres";

const confirmFlag = "--confirm-soft-reset";
if (!process.argv.includes(confirmFlag)) {
  console.error(`Refusing to reset data without ${confirmFlag}`);
  process.exit(1);
}

const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((line) => line.includes("=") && !line.trim().startsWith("#"))
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index), line.slice(index + 1)];
    })
);

const sql = postgres(env.DATABASE_URL, { max: 1, prepare: false });

function quoteIdent(name) {
  return `"${String(name).replaceAll('"', '""')}"`;
}

async function tableExists(table) {
  const [row] = await sql`
    select to_regclass(${`public.${table}`}) as table_name
  `;
  return Boolean(row?.table_name);
}

async function countRows(table) {
  if (!(await tableExists(table))) return null;
  const [row] = await sql.unsafe(`select count(*)::int as count from public.${quoteIdent(table)}`);
  return row.count;
}

async function deleteTable(table) {
  if (!(await tableExists(table))) {
    return { table, status: "skipped", before: null, after: null };
  }
  const before = await countRows(table);
  await sql.unsafe(`delete from public.${quoteIdent(table)}`);
  const after = await countRows(table);
  return { table, status: "deleted", before, after };
}

const preserveTables = [
  "companies",
  "branches",
  "countries",
  "states_provinces",
  "cities",
  "areas_locations",
  "country_branches",
  "city_branches",
  "profiles",
  "user_role_assignments",
  "roles",
  "permissions",
  "role_permissions",
  "memberships",
  "languages",
  "translation_keys",
  "translation_values",
  "erp_role_templates",
  "erp_role_template_permissions"
];

const deleteOrder = [
  "ledger_transaction_audit_trail",
  "inter_branch_ledger_transfers",
  "purchase_loading_records",
  "shipping_bl_records",
  "purchase_order_payments",
  "purchase_orders",
  "report_exports",
  "report_snapshots",
  "report_runs",
  "reports",
  "ledger_entries",
  "journal_lines",
  "journal_entries",
  "ledger_balances",
  "ledger_posting_lines",
  "roznamcha_lines",
  "roznamcha_entries",
  "enterprise_ledger_reversals",
  "ledger_opening_balances",
  "ledger_posting_batches",
  "ledgers",
  "accounts",
  "enterprise_accounts",
  "financial_periods",
  "voucher_sequences",
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
  "product_warehouse_mapping",
  "product_branch_mapping",
  "product_city_mapping",
  "product_country_mapping",
  "product_translations",
  "products",
  "product_categories",
  "product_brands",
  "product_units",
  "goods",
  "customer_contacts",
  "customer_registrations",
  "customers"
];

const preservedCountsBefore = {};
for (const table of preserveTables) {
  preservedCountsBefore[table] = await countRows(table);
}

const results = [];
try {
  await sql.begin(async () => {
    for (const table of deleteOrder) {
      results.push(await deleteTable(table));
    }
  });

  const preservedCountsAfter = {};
  for (const table of preserveTables) {
    preservedCountsAfter[table] = await countRows(table);
  }

  console.log(
    JSON.stringify(
      {
        status: "success",
        preservedTables,
        preservedCountsBefore,
        preservedCountsAfter,
        resetTables: results
      },
      null,
      2
    )
  );
} finally {
  await sql.end();
}
