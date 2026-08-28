import { withLocalPg } from "../lib/db/local-postgres.ts";
await withLocalPg(async (sql) => { const r = await sql`DELETE FROM public.business_shipping_handovers`; console.log("deleted", r.count); });
process.exit(0);
