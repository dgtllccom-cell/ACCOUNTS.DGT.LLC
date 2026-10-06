import fs from "node:fs";
import postgres from "postgres";

const env = Object.fromEntries(
  fs.readFileSync(".env", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1)]; })
);
const sql = postgres(env.DATABASE_URL, { max: 1, prepare: false, connect_timeout: 15 });

try {
  const cols = await sql`
    select table_name, column_name
    from information_schema.columns
    where table_schema = 'public'
      and (
        (table_name = 'money_exchange_entries' and column_name in ('receipt_person_id','receipt_bank_id','purchased_from_person_id'))
        or (table_name = 'purchase_loading_records' and column_name in ('transport_company_id','shipping_line_id'))
        or (table_name = 'import_truck_loadings' and column_name in ('importer_person_id','supplier_person_id','clearing_agent_id'))
        or (table_name = 'transit_truck_loadings' and column_name = 'transit_company_id')
        or (table_name = 'trucks' and column_name = 'transport_company_id')
      )
    order by table_name, column_name
  `;
  console.log("-- New FK columns --");
  console.table(cols);

  const tables = await sql`
    select table_name from information_schema.tables
    where table_schema='public' and table_name in ('clearing_agent_custom_entries','clearing_payment_bills')
  `;
  console.log("-- New tables --");
  console.table(tables);

  const newTableCols = await sql`
    select table_name, column_name from information_schema.columns
    where table_schema='public' and table_name in ('clearing_agent_custom_entries','clearing_payment_bills')
    order by table_name, ordinal_position
  `;
  console.log("-- New table columns --");
  console.table(newTableCols);
} finally {
  await sql.end();
}
