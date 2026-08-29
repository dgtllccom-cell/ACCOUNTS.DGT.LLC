import { withLocalPg } from "../lib/db/local-postgres.ts";
const EMP='e19368fb-c6a8-4158-b19c-b4020d5e1bdb';
await withLocalPg(async (sql) => {
  const cols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name='employees' AND column_name IN ('probation_start_date','probation_end_date','joining_date')`;
  console.log("date cols exist:", cols.map(c=>c.column_name));
  // lifecycle_v sub_type / kind
  try { const r = await sql`SELECT kind, sub_type, effective_date, status, reason FROM public.hr_employee_lifecycle_v WHERE employee_id = ${EMP} ORDER BY effective_date DESC LIMIT 20`; console.log("lifecycle full OK", r.length); } catch(e){ console.log("lifecycle ERR:", e.message); }
  try { const r = await sql`SELECT leave_type_name, year, entitled_days, carried_forward, taken_days, pending_days, remaining_days FROM public.hr_employee_leave_balances_v WHERE employee_id = ${EMP} ORDER BY year DESC, leave_type_name`; console.log("leaveBalances full OK", r.length); } catch(e){ console.log("leaveBal ERR:", e.message); }
});
process.exit(0);
