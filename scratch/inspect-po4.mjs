import { withLocalPg } from "../lib/db/local-postgres.ts";
await withLocalPg(async (sql) => {
  const r = await sql`SELECT form_data FROM purchase_orders WHERE form_data::text ILIKE '%containerCount%' LIMIT 1`;
  if (r[0]) {
    const fd = r[0].form_data;
    const f = fd.form || fd;
    console.log("form.containerCount:", f.containerCount, "form.containerNumbers:", f.containerNumbers, "form.containerSize:", f.containerSize);
    console.log("form keys sample:", Object.keys(f).filter(k=>/contain|load|ship/i.test(k)).join(", "));
  } else console.log("no PO with containerCount in form_data");
  const lr = await sql`SELECT loading_record_no, container_number, loaded_quantity, total_quantity, loading_percentage, loading_status FROM purchase_loading_records WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 3`;
  console.log(JSON.stringify(lr, null, 1));
});
process.exit(0);
