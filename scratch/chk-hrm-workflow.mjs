import { withLocalPg } from "../lib/db/local-postgres.ts";
await withLocalPg(async (sql) => {
  const a = await sql`SELECT employee_id, attendance_date, check_in, check_out, shift_id IS NOT NULL has_shift, expected_hours, work_hours, late_minutes, early_leave_minutes, overtime_hours FROM public.office_attendance WHERE attendance_date = '2026-09-02' AND deleted_at IS NULL`;
  console.log("attendance (09:35-18:45):");
  for (const r of a) console.log(`  shift=${r.has_shift} exp=${r.expected_hours} work=${r.work_hours} late=${r.late_minutes} early=${r.early_leave_minutes} ot=${r.overtime_hours}`);
  const lb = await sql`SELECT b.pending_days, b.taken_days, b.entitled_days, lt.name FROM public.hr_employee_leave_balances b JOIN public.hr_leave_types lt ON lt.id = b.leave_type_id WHERE b.employee_id = '11fba42f-1404-459b-ba39-9baeaddac7e7' AND b.year = 2026`;
  console.log("leave balance emp1:", JSON.stringify(lb));
});
process.exit(0);
