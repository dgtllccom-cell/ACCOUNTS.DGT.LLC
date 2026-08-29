import { withLocalPg } from "../lib/db/local-postgres.ts";
await withLocalPg(async (sql) => {
  const e = await sql`SELECT employee_code, country_id, country_branch_id, city_branch_id, designation, department, joining_date, working_shift, overtime_rate, basic_salary, salary_expense_account_id IS NOT NULL has_exp FROM public.employees WHERE id='11fba42f-1404-459b-ba39-9baeaddac7e7'`;
  console.log(JSON.stringify(e[0], null, 1));
});
process.exit(0);
