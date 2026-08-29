import { withLocalPg } from "@/lib/db/local-postgres";
await withLocalPg(async (sql) => {
  const b = await sql`SELECT pg_get_functiondef(oid) d FROM pg_proc WHERE proname='post_purchase_booking_transfer'`;
  console.log(b[0].d);
});
