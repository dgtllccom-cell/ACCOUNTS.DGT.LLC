import { withLocalPg } from "../lib/db/local-postgres.ts";
await withLocalPg(async (sql) => {
  const c = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' ORDER BY ordinal_position`;
  console.log("profiles:", c.map(x=>`${x.column_name}:${x.data_type}`).join(", "));
  const n = await sql`SELECT count(*)::int n FROM public.profiles`;
  console.log("profiles rows:", n[0].n);
  const s = await sql`SELECT id, full_name, person_master_id FROM public.profiles LIMIT 3`.catch(e=>e.message);
  console.log("sample:", JSON.stringify(s));
  // employees with person_master
  const em = await sql`SELECT count(*)::int total, count(person_master_id)::int with_person FROM public.employees WHERE deleted_at IS NULL`;
  console.log("employees:", JSON.stringify(em[0]));
});
process.exit(0);
