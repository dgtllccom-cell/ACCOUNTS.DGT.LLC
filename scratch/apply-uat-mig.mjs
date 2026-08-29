import { withLocalPg } from "@/lib/db/local-postgres";
import fs from "node:fs";
const sqlText = fs.readFileSync("supabase/migrations/20260831_fix_purchase_payment_exchange_rate_column.sql","utf8");
await withLocalPg(async (sql) => {
  await sql.unsafe(sqlText);
  console.log("applied");
  const r = await sql`SELECT name,status,applied_at FROM public.erp_schema_migrations WHERE name='20260831_fix_purchase_payment_exchange_rate_column'`;
  console.log(JSON.stringify(r[0]));
});
