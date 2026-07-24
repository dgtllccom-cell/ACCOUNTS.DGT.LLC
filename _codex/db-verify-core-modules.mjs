import fs from "node:fs";
import postgres from "postgres";

function loadEnvLocal() {
  if (!fs.existsSync(".env.local")) return;
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (!match) continue;
    const key = match[1].trim();
    const value = match[2].trim().replace(/^['"]|['"]$/g, "");
    if (key && !process.env[key]) process.env[key] = value;
  }
}

loadEnvLocal();

const tables = [
  "sales_orders",
  "sales_order_payments",
  "shipping_line_records",
  "shipment_documents",
  "erp_page_database_bindings",
  "enterprise_accounts",
  "ledgers",
  "roznamcha_entries"
];

const sql = postgres(process.env.DATABASE_URL, { ssl: "require", max: 1 });

try {
  const quoted = tables.map((name) => `'${name}'`).join(",");
  const existing = await sql.unsafe(
    `select table_name from information_schema.tables where table_schema='public' and table_name in (${quoted}) order by table_name`
  );
  const migrations = await sql.unsafe(
    "select name,status,applied_at from erp_schema_migrations where name in ('0026_account_master_references','0027_transaction_identity_traceability','0028_core_module_database_completion') order by name"
  );

  const counts = {};
  for (const table of tables) {
    try {
      const row = await sql.unsafe(`select count(*)::int as count from ${table}`);
      counts[table] = row[0]?.count ?? 0;
    } catch {
      counts[table] = "missing";
    }
  }

  console.log(JSON.stringify({ tables: existing.map((row) => row.table_name), migrations, counts }, null, 2));
} finally {
  await sql.end();
}
