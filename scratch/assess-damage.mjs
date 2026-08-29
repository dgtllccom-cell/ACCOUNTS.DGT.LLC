import { withLocalPg } from "../lib/db/local-postgres.ts";
await withLocalPg(async (sql) => {
  // employees in the payroll run whose scope got nulled
  const bad = await sql`SELECT e.id, e.employee_code, e.country_id, e.city_branch_id, e.salary_expense_account_id IS NOT NULL mapped
    FROM public.hr_payroll_run_lines prl JOIN public.employees e ON e.id = prl.employee_id
    WHERE prl.run_id = '9c960afa-7e80-481c-8989-dd04fd0db31a' AND (e.country_id IS NULL OR e.city_branch_id IS NULL)`;
  console.log("damaged (scope nulled):", bad.length);
  for (const b of bad) console.log("  " + b.employee_code.slice(-6) + " mapped=" + b.mapped);
  // any OTHER employees with null scope that shouldn't be?
  const allBad = await sql`SELECT count(*)::int n FROM public.employees WHERE deleted_at IS NULL AND status='Active' AND country_id IS NULL`;
  console.log("total active employees with NULL country_id:", allBad[0].n);
  // What did they look like before? check hr_employee_position_events or audit
  const audit = await sql`SELECT count(*)::int n FROM public.employees WHERE deleted_at IS NULL`;
  console.log("total employees:", audit[0].n);
});
process.exit(0);
