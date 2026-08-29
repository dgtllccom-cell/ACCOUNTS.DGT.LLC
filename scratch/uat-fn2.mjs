import { withLocalPg } from "@/lib/db/local-postgres";
await withLocalPg(async (sql) => {
  const b = await sql`SELECT pg_get_functiondef(oid) d FROM pg_proc WHERE proname='post_purchase_order_payment'`;
  console.log(b.map(x=>x.d).join("\n\n---\n\n"));
});
