import { withLocalPg } from "../lib/db/local-postgres.ts";
await withLocalPg(async (sql) => {
  const pf = (await sql`SELECT id, full_name FROM public.profiles WHERE deleted_at IS NULL ORDER BY created_at LIMIT 1`)[0];
  await sql`SELECT public.hr_link_employee_user('e19368fb-c6a8-4158-b19c-b4020d5e1bdb'::uuid, ${pf.id}::uuid)`;
  const e = await sql`SELECT employee_code, user_id FROM public.employees WHERE id='e19368fb-c6a8-4158-b19c-b4020d5e1bdb'`;
  console.log("linked ESS employee:", JSON.stringify(e[0]), "profile", pf.id);
})
process.exit(0);
