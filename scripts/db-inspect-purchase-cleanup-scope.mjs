import fs from "node:fs";
import postgres from "postgres";

function loadEnv(path) {
  if (!fs.existsSync(path)) return;
  for (const line of fs.readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnv(".env.local");
loadEnv(".env");

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL missing");

const sql = postgres(process.env.DATABASE_URL, { ssl: "require", max: 1, idle_timeout: 5 });

const tables = [
  "purchase_orders",
  "purchase_order_items",
  "purchase_order_expenses",
  "purchase_order_reports",
  "purchase_order_payments",
  "purchase_loading_records",
  "roznamcha_entries",
  "roznamcha_lines",
  "journal_entries",
  "journal_lines",
  "ledger_posting_lines",
  "ledger_balances",
  "enterprise_account_history",
  "audit_logs"
];

try {
  const output = {};
  for (const table of tables) {
    const [exists] = await sql`select to_regclass(${`public.${table}`}) as table_name`;
    if (!exists?.table_name) {
      output[table] = { exists: false };
      continue;
    }
    const [count] = await sql.unsafe(`select count(*)::int as count from public."${table.replaceAll('"', '""')}"`);
    const columns = await sql`
      select column_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name = ${table}
      order by ordinal_position
    `;
    output[table] = { exists: true, count: count.count, columns: columns.map((c) => c.column_name) };
  }
  console.log(JSON.stringify(output, null, 2));
} finally {
  await sql.end();
}
