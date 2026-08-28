import { withLocalPg } from "../lib/db/local-postgres.ts";
await withLocalPg(async (sql) => {
  for (const [t,c] of [["purchase_orders","purchase_order_no"],["sales_orders","sales_order_no"],["purchase_orders","purchase_order_number"],["sales_orders","sales_order_number"]]) {
    const r = await sql`SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=${t} AND column_name=${c}`;
    console.log(t, c, r.length ? "YES" : "no");
  }
});
process.exit(0);
