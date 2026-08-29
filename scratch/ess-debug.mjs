import { withLocalPg } from "../lib/db/local-postgres.ts";
const EMP = 'e19368fb-c6a8-4158-b19c-b4020d5e1bdb';
await withLocalPg(async (sql) => {
  const cc = await sql`SELECT 1 FROM information_schema.columns WHERE table_name='employees' AND column_name='confirmation_date'`;
  console.log("employees.confirmation_date exists:", cc.length > 0);
  const cols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name='employees' AND column_name ILIKE '%confirm%'`;
  console.log("confirm-ish cols:", cols.map(c=>c.column_name));
  // test each ESS query
  const tests = [
    ['leaveBalances_v', sql`SELECT * FROM public.hr_employee_leave_balances_v WHERE employee_id = ${EMP} LIMIT 1`],
    ['kyc_status_v', sql`SELECT * FROM public.hr_employee_kyc_status_v WHERE employee_id = ${EMP} LIMIT 1`],
    ['lifecycle_v', sql`SELECT * FROM public.hr_employee_lifecycle_v WHERE employee_id = ${EMP} LIMIT 1`],
    ['emp_currency', sql`SELECT public.hr_employee_currency(${EMP}::uuid)`],
  ];
  for (const [n, q] of tests) {
    try { await q; console.log(n, "OK"); } catch (e) { console.log(n, "ERR:", e.message); }
  }
});
process.exit(0);
