import { withLocalPg } from "../lib/db/local-postgres.ts";
await withLocalPg(async (sql) => {
  for (const t of ["purchase_loading_records", "purchase_loading_batches", "purchase_containers", "purchase_order_containers"]) {
    const cols = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name=${t} ORDER BY ordinal_position`;
    console.log(`\n=== ${t} (${cols.length}) ===`);
    console.log(cols.map(c => `${c.column_name}:${c.data_type}`).join(", "));
  }
});
process.exit(0);
