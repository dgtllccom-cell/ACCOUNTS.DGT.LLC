import { withLocalPg } from "../lib/db/local-postgres.ts";
await withLocalPg(async (sql) => {
  const cols = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='purchase_orders' AND (column_name ILIKE '%container%' OR column_name ILIKE '%quantity%' OR column_name ILIKE '%qty%' OR column_name ILIKE '%count%' OR column_name ILIKE '%advance%' OR column_name ILIKE '%status%' OR column_name ILIKE '%total%') ORDER BY ordinal_position`;
  console.log(cols.map(c => `${c.column_name}:${c.data_type}`).join("\n"));
  console.log("--- sample form_data keys ---");
  const r = await sql`SELECT form_data FROM purchase_orders WHERE form_data IS NOT NULL LIMIT 1`;
  if (r[0]) console.log(Object.keys(r[0].form_data).filter(k=>/contain|qty|quant|advance|count/i.test(k)).join(", "));
});
process.exit(0);
