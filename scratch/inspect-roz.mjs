import { withLocalPg } from "../lib/db/local-postgres.ts";
await withLocalPg(async (sql) => {
  const c = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='roznamcha_entries' ORDER BY ordinal_position`;
  console.log("roznamcha_entries:\n" + c.map(x=>`${x.column_name}:${x.data_type}`).join(", "));
  const l = await sql`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='roznamcha_entry_lines' ORDER BY ordinal_position`;
  console.log("\nlines:", l.map(x=>x.column_name).join(", "));
  const fns = await sql`SELECT routine_name FROM information_schema.routines WHERE routine_schema='public' AND (routine_name ILIKE '%serial%' OR routine_name ILIKE '%roznamcha%')`;
  console.log("\nfns:", fns.map(f=>f.routine_name).join(", "));
});
process.exit(0);
