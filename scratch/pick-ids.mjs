import { withLocalPg } from "../lib/db/local-postgres.ts";
await withLocalPg(async (sql) => {
  const po = await sql`SELECT id, purchase_order_no, country_id FROM public.purchase_orders WHERE deleted_at IS NULL AND country_id IS NOT NULL ORDER BY created_at DESC LIMIT 1`;
  const ag = await sql`SELECT id, name FROM public.clearing_agents WHERE deleted_at IS NULL LIMIT 3`;
  console.log("PO:", JSON.stringify(po[0]));
  console.log("agents:", JSON.stringify(ag));
});
process.exit(0);
