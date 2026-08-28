import { withLocalPg } from "../lib/db/local-postgres.ts";
await withLocalPg(async (sql) => {
  for (const t of ["clearing_customer_orders","shipping_bl_records","clearing_agents"]) {
    const c = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name=${t} ORDER BY ordinal_position`;
    console.log(`\n=== ${t} ===\n` + c.map(x=>`${x.column_name}:${x.data_type}`).join(", "));
  }
});
process.exit(0);
