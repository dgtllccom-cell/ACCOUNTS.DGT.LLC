import { withLocalPg } from "../lib/db/local-postgres.ts";
await withLocalPg(async (sql) => {
  const c = await sql`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='customers' AND column_name IN ('customer_name','first_name','last_name','contact_person','person_code')`;
  console.log("customers name cols:", c.map(x=>x.column_name).join(", "));
  // match candidates
  const m = await sql`
    SELECT count(*)::int matched FROM public.employees e
    JOIN public.customers cu ON cu.id = e.person_master_id
    JOIN public.profiles p ON lower(trim(p.full_name)) = lower(trim(coalesce(nullif(trim(concat_ws(' ', cu.first_name, cu.last_name)),''), cu.customer_name, cu.contact_person)))
    WHERE e.deleted_at IS NULL`;
  console.log("name-match employee↔profile:", JSON.stringify(m[0]));
  const shiftcodes = await sql`SELECT DISTINCT working_shift FROM public.employees WHERE working_shift IS NOT NULL AND deleted_at IS NULL LIMIT 10`;
  console.log("working_shift values:", JSON.stringify(shiftcodes.map(x=>x.working_shift)));
});
process.exit(0);
