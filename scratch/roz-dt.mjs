import { withLocalPg } from "../lib/db/local-postgres.ts";
await withLocalPg(async (sql) => {
  const r = await sql`SELECT code, target_module, category, requires_qvc FROM public.document_type_registry WHERE category='finance' ORDER BY rank_order`;
  console.log(JSON.stringify(r, null, 1));
  const lines = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name ILIKE 'roznamcha%'`;
  console.log("roz tables:", lines.map(x=>x.table_name).join(", "));
});
process.exit(0);
