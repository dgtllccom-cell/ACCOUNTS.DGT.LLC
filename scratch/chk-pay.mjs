import { withLocalPg } from "../lib/db/local-postgres.ts";
await withLocalPg(async (sql) => {
  const r = await sql`SELECT run_no, status, paid_at, payment_journal_entry_id FROM public.hr_payroll_runs WHERE id='9c960afa-7e80-481c-8989-dd04fd0db31a'`;
  console.log("run:", JSON.stringify(r[0]));
  const l = await sql`SELECT count(*) FILTER (WHERE status='paid') paid, count(*) FILTER (WHERE payment_roznamcha_id IS NOT NULL) with_payroz, count(*) total FROM public.hr_payroll_run_lines WHERE run_id='9c960afa-7e80-481c-8989-dd04fd0db31a'`;
  console.log("lines:", JSON.stringify(l[0]));
  // payment roznamcha balance
  const p = await sql`SELECT round(sum(rl.debit),2) dr, round(sum(rl.credit),2) cr, count(DISTINCT re.id) entries
    FROM public.roznamcha_entries re JOIN public.roznamcha_lines rl ON rl.roznamcha_entry_id=re.id
    WHERE re.voucher_no LIKE 'PR-202609-0001-P%' AND re.deleted_at IS NULL`;
  console.log("payment roznamcha:", JSON.stringify(p[0]), "balanced:", p[0].dr === p[0].cr);
  // recon view payment column
  const rv = await sql`SELECT count(*) FILTER (WHERE payment_roznamcha_id IS NOT NULL) with_pay, round(sum(payment_dr_minus_cr),2) drcr FROM public.hr_payroll_reconciliation_v WHERE run_id='9c960afa-7e80-481c-8989-dd04fd0db31a'`;
  console.log("recon payment:", JSON.stringify(rv[0]));
  // salary due now
  const sd = await sql`SELECT status, count(*) n FROM public.employee_salaries_due WHERE salary_month='2026-09' AND branch_id='87c2e253-b6c1-482d-a808-272337f3ffda' AND deleted_at IS NULL GROUP BY 1`;
  console.log("salary due:", JSON.stringify(sd));
});
process.exit(0);
