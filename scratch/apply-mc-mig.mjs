import { withLocalPg } from "@/lib/db/local-postgres";
import fs from "node:fs";
const sqlText = fs.readFileSync("supabase/migrations/20261001_multicurrency_purchase_payment_fix.sql","utf8");
await withLocalPg(async (sql) => {
  await sql.unsafe(sqlText);
  console.log("applied 1");
  await sql.unsafe(sqlText);   // idempotency
  console.log("applied 2 (idempotent)");
  const r = await sql`SELECT name,status FROM public.erp_schema_migrations WHERE name='20261001_multicurrency_purchase_payment_fix'`;
  console.log(JSON.stringify(r[0]));
});
