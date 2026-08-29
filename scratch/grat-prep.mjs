import { withLocalPg } from "../lib/db/local-postgres.ts";
await withLocalPg(async (sql) => {
  const e = await sql`SELECT id, employee_code, joining_date, basic_salary, country_id, working_shift FROM public.employees WHERE id='11fba42f-1404-459b-ba39-9baeaddac7e7'`;
  console.log("emp:", JSON.stringify(e[0]));
  // separation tables/columns
  const sc = await sql`SELECT column_name FROM information_schema.columns WHERE table_name='hr_employee_separations' ORDER BY ordinal_position`;
  console.log("hr_employee_separations cols:", sc.map(c=>c.column_name).join(", "));
  const gp = await sql`SELECT * FROM public.hr_gratuity_policy WHERE deleted_at IS NULL LIMIT 3`;
  console.log("gratuity policies:", JSON.stringify(gp).slice(0,400));
});
process.exit(0);
