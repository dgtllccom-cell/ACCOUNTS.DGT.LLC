import { withLocalPg } from "../lib/db/local-postgres.ts";
await withLocalPg(async (sql) => {
  // 1. Payroll Register total
  const pr = await sql`SELECT round(sum(gross_salary),2) gross, round(sum(net_salary),2) net, round(sum(tax_employee),2) tax FROM public.hr_payroll_run_lines WHERE run_id='9c960afa-7e80-481c-8989-dd04fd0db31a'`;
  // 2. hr_payroll_runs totals
  const run = await sql`SELECT total_gross, total_net, total_tax_employee FROM public.hr_payroll_runs WHERE id='9c960afa-7e80-481c-8989-dd04fd0db31a'`;
  // 3. employee_salaries_due total
  const sd = await sql`SELECT round(sum(net_salary),2) net, count(*) n FROM public.employee_salaries_due WHERE salary_month='2026-09' AND branch_id='87c2e253-b6c1-482d-a808-272337f3ffda' AND deleted_at IS NULL`;
  // 4. Roznamcha total debit / credit for the accrual entries
  const roz = await sql`SELECT round(sum(rl.debit),2) dr, round(sum(rl.credit),2) cr, count(DISTINCT re.id) entries
    FROM public.roznamcha_entries re JOIN public.roznamcha_lines rl ON rl.roznamcha_entry_id = re.id
    WHERE re.voucher_no LIKE 'PR-202609-0001-A%' AND re.deleted_at IS NULL`;
  console.log("1. Payroll Register lines : gross", pr[0].gross, "net", pr[0].net, "tax", pr[0].tax);
  console.log("2. hr_payroll_runs totals : gross", run[0].total_gross, "net", run[0].total_net, "tax", run[0].total_tax_employee);
  console.log("3. Salary Due rows        :", sd[0].n, "rows, net", sd[0].net);
  console.log("4. Roznamcha accrual      :", roz[0].entries, "entries, Dr", roz[0].dr, "Cr", roz[0].cr, "→ balanced:", roz[0].dr === roz[0].cr);
  console.log("\nRECONCILE: Register net == Run net == Salary Due net == Roznamcha Cr :",
    pr[0].net === run[0].total_net && pr[0].net === sd[0].net && String(pr[0].net) === String(roz[0].cr));
});
process.exit(0);
