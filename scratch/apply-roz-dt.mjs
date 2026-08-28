import fs from "node:fs";
import { withLocalPg } from "../lib/db/local-postgres.ts";
const t = fs.readFileSync("supabase/migrations/20260929_document_intake_roznamcha.sql","utf8");
await withLocalPg(async (sql) => {
  await sql.unsafe(t);
  const r = await sql`SELECT code, target_module FROM public.document_type_registry WHERE category='finance' ORDER BY rank_order`;
  console.log(JSON.stringify(r));
});
process.exit(0);
