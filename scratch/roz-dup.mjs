import { withLocalPg } from "../lib/db/local-postgres.ts";
await withLocalPg(async (sql) => {
  const src = await sql`SELECT pg_get_functiondef(oid) d FROM pg_proc WHERE proname='post_roznamcha_entry'`;
  const d = src[0].d;
  // find the duplicate-check part
  const idx = d.search(/duplicate|already exists|پہلے سے موجود|unique|idempot/i);
  console.log(d.slice(Math.max(0,idx-600), idx+400));
});
process.exit(0);
