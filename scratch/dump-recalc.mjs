import { withLocalPg } from "@/lib/db/local-postgres";
await withLocalPg(async (sql) => {
  const d = await sql`SELECT pg_get_functiondef(oid) d FROM pg_proc WHERE proname='recalc_purchase_order_payment_totals'`;
  console.log(d.map(x=>x.d).join("\n---\n"));
});
