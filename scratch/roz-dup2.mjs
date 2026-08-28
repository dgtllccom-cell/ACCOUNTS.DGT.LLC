import { withLocalPg } from "../lib/db/local-postgres.ts";
await withLocalPg(async (sql) => {
  const src = await sql`SELECT pg_get_functiondef(oid) d FROM pg_proc WHERE proname='post_roznamcha_entry'`;
  const d = src[0].d;
  console.log(d.slice(0, 2600));
});
process.exit(0);
