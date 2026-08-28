import { withLocalPg } from "../lib/db/local-postgres.ts";
const sfx = Math.random().toString(36).slice(2, 7).toUpperCase();
await withLocalPg(async (sql) => {
  // clean any leftovers from earlier partial runs
  await sql`DELETE FROM public.hr_payroll_run_lines WHERE run_id IN (SELECT id FROM public.hr_payroll_runs WHERE run_no LIKE 'RECON-TEST%')`;
  await sql`DELETE FROM public.hr_payroll_runs WHERE run_no LIKE 'RECON-TEST%'`;
  await sql`DELETE FROM public.roznamcha_lines WHERE roznamcha_entry_id IN (SELECT id FROM public.roznamcha_entries WHERE voucher_no LIKE 'RV-%' AND source_module='hr_payroll')`;
  await sql`DELETE FROM public.roznamcha_entries WHERE voucher_no LIKE 'RV-%' AND source_module='hr_payroll'`;

  const emp = (await sql`SELECT id, country_id, country_branch_id, city_branch_id FROM public.employees WHERE deleted_at IS NULL LIMIT 1`)[0];
  const led = await sql`SELECT id FROM public.ledgers WHERE deleted_at IS NULL LIMIT 2`;
  const [run] = await sql`INSERT INTO public.hr_payroll_runs (run_no, period_month, country_id, country_branch_id, city_branch_id, presentation_currency, status, employee_count, total_gross, total_net, created_by)
    VALUES (${'RECON-TEST-' + sfx}, ${'2099-' + sfx.slice(0,2)}, ${emp.country_id}, ${emp.country_branch_id}, ${emp.city_branch_id}, 'AED', 'approved', 1, 5000, 4500, ${emp.id}) RETURNING id`;
  const [re] = await sql`INSERT INTO public.roznamcha_entries (type, country_id, country_branch_id, city_branch_id, entry_date, journal_no, voucher_no, entry_serial, status, source_module)
    VALUES ('branch', ${emp.country_id}, ${emp.country_branch_id}, ${emp.city_branch_id}, '2026-09-30', ${'RJ-' + sfx}, ${'RV-' + sfx}, ${'RE-' + sfx}, 'posted', 'hr_payroll') RETURNING id`;
  await sql`INSERT INTO public.roznamcha_lines (roznamcha_entry_id, payment_entry_type, ledger_id, debit, credit, currency) VALUES
    (${re.id}, 'debit', ${led[0].id}, 5000, 0, 'AED'),
    (${re.id}, 'credit', ${led[1]?.id ?? led[0].id}, 0, 5000, 'AED')`;
  const [line] = await sql`INSERT INTO public.hr_payroll_run_lines (run_id, employee_id, basic_salary, gross_salary, tax_employee, net_salary, currency, accrual_roznamcha_id, status)
    VALUES (${run.id}, ${emp.id}, 5000, 5000, 0, 4500, 'AED', ${re.id}, 'posted') RETURNING id`;

  const v1 = await sql`SELECT run_no, gross_salary, accrual_voucher_no, accrual_dr_minus_cr, accrual_balance_check FROM public.hr_payroll_reconciliation_v WHERE run_id = ${run.id}`;
  console.log("balanced case:  ", JSON.stringify(v1[0]));
  await sql`UPDATE public.roznamcha_lines SET debit = 5100 WHERE roznamcha_entry_id = ${re.id} AND payment_entry_type = 'debit'`;
  const v2 = await sql`SELECT accrual_dr_minus_cr, accrual_balance_check FROM public.hr_payroll_reconciliation_v WHERE run_id = ${run.id}`;
  console.log("unbalanced case:", JSON.stringify(v2[0]));

  await sql`DELETE FROM public.hr_payroll_run_lines WHERE id = ${line.id}`;
  await sql`DELETE FROM public.roznamcha_lines WHERE roznamcha_entry_id = ${re.id}`;
  await sql`DELETE FROM public.roznamcha_entries WHERE id = ${re.id}`;
  await sql`DELETE FROM public.hr_payroll_runs WHERE id = ${run.id}`;
  console.log("cleaned");
});
process.exit(0);
