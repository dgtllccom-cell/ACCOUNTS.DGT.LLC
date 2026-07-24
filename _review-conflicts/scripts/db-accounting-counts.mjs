import fs from "node:fs";
import postgres from "postgres";

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

const sql = postgres(env.DATABASE_URL, { max: 1, prepare: false, connect_timeout: 15 });

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

const tables = [
  "enterprise_accounts",
  "enterprise_account_history",
  "accounts",
  "ledgers",
  "ledger_balances",
  "ledger_posting_lines",
  "ledger_posting_batches",
  "ledger_entries",
  "journal_entries",
  "journal_lines",
  "roznamcha_entries",
  "roznamcha_lines",
  "transactions",
  "purchase_order_payments",
  "sales_order_payments",
  "sales_orders",
  "shipping_line_records",
  "shipping_bl_records",
  "roznamcha_reversals",
  "voucher_sequences",
  "profiles",
  "countries",
  "country_branches",
  "city_branches"
];

try {
  const counts = {};
  for (const table of tables) {
    counts[table] = await countRows(table);
  }
  console.log(JSON.stringify({ status: "success", counts }, null, 2));
} finally {
  await sql.end();
}
