import { withLocalPg } from "../lib/db/local-postgres.ts";
await withLocalPg(async (sql) => {
  const tbls = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND (table_name ILIKE 'shipping%' OR table_name ILIKE 'clearing%' OR table_name ILIKE '%handover%' OR table_name ILIKE '%shipping_request%') ORDER BY table_name`;
  console.log(tbls.map(t=>t.table_name).join("\n"));
});
process.exit(0);
