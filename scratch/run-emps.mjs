import { withLocalPg } from "../lib/db/local-postgres.ts";
await withLocalPg(async (sql) => {
  const l = await sql`SELECT prl.employee_id, e.employee_code, e.city_branch_id, e.country_branch_id, e.salary_expense_account_id IS NOT NULL has_exp, e.employee_payable_account_id IS NOT NULL has_pay
    FROM public.hr_payroll_run_lines prl JOIN public.employees e ON e.id = prl.employee_id
    WHERE prl.run_id = '9c960afa-7e80-481c-8989-dd04fd0db31a'`;
  for (const r of l) console.log(`${r.employee_code.slice(-6)} city=${r.city_branch_id?.slice(0,8)} exp=${r.has_exp} pay=${r.has_pay}`);
  // now map ALL of them via SQL (config)
  const EXP='23131524-7be1-428f-a362-0a7a6e87755e', PAY='61ab54d8-9e6a-4e2f-9604-9922a9598d53';
  const upd = await sql`UPDATE public.employees SET salary_expense_account_id = ${EXP}::uuid, employee_payable_account_id = ${PAY}::uuid, updated_at = now()
    WHERE id IN (SELECT employee_id FROM public.hr_payroll_run_lines WHERE run_id = '9c960afa-7e80-481c-8989-dd04fd0db31a')`;
  console.log("mapped", upd.count, "employees");
});
process.exit(0);
