import { withLocalPg } from "../lib/db/local-postgres.ts";
await withLocalPg(async (sql) => {
  const r = await sql`SELECT run_no, status, posted_at, accrual_journal_entry_id, total_net FROM public.hr_payroll_runs WHERE id='9c960afa-7e80-481c-8989-dd04fd0db31a'`;
  console.log("run:", JSON.stringify(r[0]));
  const l = await sql`SELECT count(*) FILTER (WHERE accrual_roznamcha_id IS NOT NULL) posted, count(*) FILTER (WHERE salary_due_id IS NOT NULL) with_due, count(*) total FROM public.hr_payroll_run_lines WHERE run_id='9c960afa-7e80-481c-8989-dd04fd0db31a'`;
  console.log("lines:", JSON.stringify(l[0]));
  const rv = await sql`SELECT count(*) lines, count(*) FILTER (WHERE accrual_balance_check='balanced') balanced, count(*) FILTER (WHERE accrual_balance_check='unbalanced') unbal, round(sum(gross_salary),2) gross, round(sum(net_salary),2) net, round(sum(accrual_dr_minus_cr),2) drcr FROM public.hr_payroll_reconciliation_v WHERE run_id='9c960afa-7e80-481c-8989-dd04fd0db31a'`;
  console.log("reconciliation:", JSON.stringify(rv[0]));
});
process.exit(0);
