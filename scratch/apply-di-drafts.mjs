import fs from "node:fs";
import { withLocalPg } from "../lib/db/local-postgres.ts";
const sqlText = fs.readFileSync("supabase/migrations/20260926_document_intake_drafts.sql", "utf8");
await withLocalPg(async (sql) => {
  await sql.unsafe(sqlText);
  const t = await sql`SELECT to_regclass('public.document_intake_drafts') AS tbl, to_regclass('public.document_intake_drafts_v') AS view`;
  console.log("applied:", JSON.stringify(t[0]));
});
process.exit(0);
