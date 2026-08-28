import { withLocalPg } from "../lib/db/local-postgres.ts";
await withLocalPg(async (sql) => {
  const ix = await sql`SELECT indexname, indexdef FROM pg_indexes WHERE tablename='roznamcha_entries' AND indexdef ILIKE '%unique%'`;
  console.log("unique indexes:", JSON.stringify(ix, null, 1));
  const tg = await sql`SELECT tgname, pg_get_triggerdef(oid) d FROM pg_trigger WHERE tgrelid='public.roznamcha_entries'::regclass AND NOT tgisinternal`;
  console.log("triggers:", tg.map(t=>t.tgname).join(", "));
  const msg = await sql`SELECT pg_get_functiondef(oid) d FROM pg_proc WHERE prosrc ILIKE '%پہلے سے موجود%' OR prosrc ILIKE '%duplicate entry%'`;
  console.log("funcs with that msg:", msg.length);
  if (msg.length) console.log(msg[0].d.slice(0, 1500));
});
process.exit(0);
