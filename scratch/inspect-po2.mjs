import { withLocalPg } from "../lib/db/local-postgres.ts";
await withLocalPg(async (sql) => {
  const r = await sql`SELECT form_data FROM purchase_orders WHERE form_data IS NOT NULL AND form_data::text ILIKE '%container%' LIMIT 2`;
  for (const row of r) {
    const fd = row.form_data;
    console.log("keys:", Object.keys(fd).join(", ").slice(0,600));
    console.log("containerCount:", fd.containerCount, "| containerNumbers:", fd.containerNumbers, "| containers:", JSON.stringify(fd.containers)?.slice(0,200));
    console.log("---");
  }
  const cnt = await sql`SELECT count(*)::int n FROM purchase_orders`;
  console.log("total POs:", cnt[0].n);
});
process.exit(0);
