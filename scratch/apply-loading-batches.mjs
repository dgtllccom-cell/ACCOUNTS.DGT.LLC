import fs from "node:fs";
import { withLocalPg } from "../lib/db/local-postgres.ts";
const sqlText = fs.readFileSync("supabase/migrations/20260927_purchase_loading_batches.sql", "utf8");
await withLocalPg(async (sql) => {
  await sql.unsafe(sqlText);
  const t = await sql`SELECT to_regclass('public.purchase_loading_batches') tbl, to_regclass('public.purchase_loading_progress_v') vw`;
  const c = await sql`SELECT column_name FROM information_schema.columns WHERE table_name='purchase_loading_records' AND column_name IN ('loading_batch_id','loading_batch_no')`;
  console.log("applied:", JSON.stringify(t[0]), "cols:", JSON.stringify(c.map(x=>x.column_name)));
  const pv = await sql`SELECT * FROM public.purchase_loading_progress_v WHERE loaded_containers > 0 LIMIT 3`;
  console.log("progress sample:", JSON.stringify(pv));
});
process.exit(0);
