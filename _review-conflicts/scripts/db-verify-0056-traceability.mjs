import fs from "node:fs";
import postgres from "postgres";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((line) => line.includes("=") && !line.trim().startsWith("#"))
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index), line.slice(index + 1)];
    })
);

const sql = postgres(env.DATABASE_URL, { max: 1, prepare: false, connect_timeout: 20 });
const required = {
  sales_orders: ["super_admin_serial_number", "country_transaction_serial_number", "branch_transaction_serial_number", "original_currency_code", "currency_name", "base_currency_amount"],
  roznamcha_entries: ["source_module", "source_transaction_type", "source_transaction_id", "source_reference_no", "original_currency_code", "currency_name", "base_currency_amount"],
  purchase_order_payments: ["source_module", "source_transaction_type", "source_reference_no", "original_currency_code", "currency_name", "base_currency_amount"]
};
try {
  const rows = await sql`
    select table_name, column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name in ('sales_orders', 'roznamcha_entries', 'purchase_order_payments')
  `;
  const actual = new Map();
  for (const row of rows) {
    if (!actual.has(row.table_name)) actual.set(row.table_name, new Set());
    actual.get(row.table_name).add(row.column_name);
  }
  const missing = [];
  for (const [table, cols] of Object.entries(required)) {
    for (const col of cols) {
      if (!actual.get(table)?.has(col)) missing.push(`${table}.${col}`);
    }
  }
  const marker = await sql`select name, status from erp_schema_migrations where name = '0056_multi_country_transaction_traceability'`;
  console.log(JSON.stringify({ marker: marker[0] ?? null, missingColumns: missing }, null, 2));
  if (missing.length) process.exit(1);
} finally {
  await sql.end();
}
