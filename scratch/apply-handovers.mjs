import fs from "node:fs";
import { withLocalPg } from "../lib/db/local-postgres.ts";
const t = fs.readFileSync("supabase/migrations/20260928_business_shipping_handovers.sql","utf8");
await withLocalPg(async (sql) => {
  await sql.unsafe(t);
  const r = await sql`SELECT to_regclass('public.business_shipping_handovers') tbl, to_regclass('public.business_shipping_handover_shared_v') vw`;
  console.log(JSON.stringify(r[0]));
});
process.exit(0);
