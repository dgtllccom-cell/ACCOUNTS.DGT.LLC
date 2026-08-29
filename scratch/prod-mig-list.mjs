import fs from "node:fs"; import postgres from "postgres";
const PROD = fs.readFileSync("scripts/backup-vps-db.mjs","utf8").match(/postgresql:\/\/[^\s'"]+/)[0];
const sql = postgres(PROD,{max:1,prepare:false,ssl:{rejectUnauthorized:false}});
const rows = await sql`SELECT name, applied_at::date d FROM erp_schema_migrations WHERE status='applied' ORDER BY name`;
console.log("PROD applied migrations (" + rows.length + "):");
for (const r of rows) console.log(`  ${r.d}  ${r.name}`);
// key tables present on prod?
for (const t of ["employees","office_documents","document_type_registry","hr_payroll_runs","uae_tax_lines","clearing_payment_bills","clearing_agent_custom_entries","translations_english","purchase_order_items","sales_orders"]) {
  console.log(`  ${t.padEnd(30)} ${(await sql`SELECT to_regclass(${'public.'+t}) r`)[0].r ? "EXISTS" : "—"}`);
}
await sql.end();
