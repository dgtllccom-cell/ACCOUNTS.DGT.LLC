import { withLocalPg } from "../lib/db/local-postgres.ts";
await withLocalPg(async (sql) => {
  const r = await sql`SELECT run_no, status, employee_count, total_gross, total_overtime, total_tax_employee, total_net, presentation_currency FROM public.hr_payroll_runs WHERE id = '9c960afa-7e80-481c-8989-dd04fd0db31a'`;
  console.log("run:", JSON.stringify(r[0]));
  const l = await sql`SELECT employee_id, basic_salary, overtime_amount, gross_salary, tax_employee, net_salary, currency, exchange_rate FROM public.hr_payroll_run_lines WHERE run_id = '9c960afa-7e80-481c-8989-dd04fd0db31a' ORDER BY basic_salary`;
  console.log("lines:", l.length);
  for (const x of l) console.log(`  basic=${x.basic_salary} ot=${x.overtime_amount} gross=${x.gross_salary} tax=${x.tax_employee} net=${x.net_salary} ${x.currency}@${x.exchange_rate}`);
});
process.exit(0);
