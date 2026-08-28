import { withLocalPg } from "../lib/db/local-postgres.ts";
await withLocalPg(async (sql) => {
  const c = await sql`SELECT id, name FROM public.countries WHERE id = '935dd0b9-8228-43b3-b53d-c06e9ae2882f'`;
  const b = await sql`SELECT id, name, country_branch_id FROM public.city_branches WHERE id = '6867d9b1-d6c0-4aed-aff9-e924d04ef202'`;
  const emps = await sql`SELECT id, employee_code, basic_salary, country_id, country_branch_id, city_branch_id FROM public.employees WHERE deleted_at IS NULL AND status='Active' AND city_branch_id = '6867d9b1-d6c0-4aed-aff9-e924d04ef202' AND COALESCE(basic_salary,monthly_salary,0)>0 ORDER BY employee_code LIMIT 4`;
  console.log("country:", JSON.stringify(c[0]));
  console.log("branch:", JSON.stringify(b[0]));
  console.log("employees:", JSON.stringify(emps.map(e=>({id:e.id, code:e.employee_code.slice(-6), sal:e.basic_salary, cb:e.country_branch_id}))));
  // existing payroll runs for this scope+period?
  const pr = await sql`SELECT run_no, period_month, status FROM public.hr_payroll_runs WHERE deleted_at IS NULL`;
  console.log("existing runs:", JSON.stringify(pr));
});
process.exit(0);
