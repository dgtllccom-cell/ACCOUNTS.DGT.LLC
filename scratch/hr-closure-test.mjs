import { withLocalPg } from "../lib/db/local-postgres.ts";
await withLocalPg(async (sql) => {
  const lt = await sql`SELECT id, code, name, country_id, annual_entitlement_days FROM public.hr_leave_types WHERE deleted_at IS NULL LIMIT 5`;
  console.log("leave types:", JSON.stringify(lt));
  const emp = await sql`SELECT id, employee_code, country_id, city_branch_id, working_shift FROM public.employees WHERE deleted_at IS NULL AND country_id IS NOT NULL LIMIT 1`;
  const e = emp[0];
  console.log("test employee:", JSON.stringify(e));

  // ensure a leave type for this country
  let ltId = lt.find(x => !x.country_id || x.country_id === e.country_id)?.id;
  if (!ltId) {
    const [r] = await sql`INSERT INTO public.hr_leave_types (code, name, country_id, is_paid, annual_entitlement_days, is_active, rank_order)
      VALUES ('ANNUAL','Annual Leave', ${e.country_id}, true, 30, true, 1) RETURNING id`;
    ltId = r.id;
    console.log("seeded leave type", ltId);
  }

  console.log("\n--- A1: leave balance lifecycle ---");
  // 1. request (Pending)
  const [lr] = await sql`INSERT INTO public.office_leave_requests (employee_id, leave_type, from_date, to_date, days, status, country_id, city_branch_id, created_by)
    VALUES (${e.id}, 'Annual Leave', '2026-09-10', '2026-09-14', 5, 'Pending', ${e.country_id}, ${e.city_branch_id}, ${e.id}) RETURNING id, balance_effect`;
  console.log("1. requested Pending → effect:", lr.balance_effect);
  let bal = await sql`SELECT pending_days, taken_days, entitled_days FROM public.hr_employee_leave_balances WHERE employee_id = ${e.id} AND leave_type_id = ${ltId} AND year = 2026`;
  console.log("   balance:", JSON.stringify(bal[0]));

  // 2. approve
  await sql`UPDATE public.office_leave_requests SET status = 'Approved' WHERE id = ${lr.id}`;
  bal = await sql`SELECT pending_days, taken_days FROM public.hr_employee_leave_balances WHERE employee_id = ${e.id} AND leave_type_id = ${ltId} AND year = 2026`;
  console.log("2. approved → balance:", JSON.stringify(bal[0]), "(expect pending 0, taken 5)");

  // 3. re-save approved (no double count)
  await sql`UPDATE public.office_leave_requests SET reason = 'x' WHERE id = ${lr.id}`;
  bal = await sql`SELECT pending_days, taken_days FROM public.hr_employee_leave_balances WHERE employee_id = ${e.id} AND leave_type_id = ${ltId} AND year = 2026`;
  console.log("3. re-save → balance:", JSON.stringify(bal[0]), "(expect unchanged)");

  // 4. reject after approve
  await sql`UPDATE public.office_leave_requests SET status = 'Rejected' WHERE id = ${lr.id}`;
  bal = await sql`SELECT pending_days, taken_days FROM public.hr_employee_leave_balances WHERE employee_id = ${e.id} AND leave_type_id = ${ltId} AND year = 2026`;
  console.log("4. rejected → balance:", JSON.stringify(bal[0]), "(expect pending 0, taken 0)");

  console.log("\n--- A2: shift attendance calc ---");
  const [att] = await sql`INSERT INTO public.office_attendance (employee_id, attendance_date, check_in, check_out, status, country_id, city_branch_id, created_by)
    VALUES (${e.id}, '2026-09-01', '09:25', '18:30', 'Present', ${e.country_id}, ${e.city_branch_id}, ${e.id})
    RETURNING shift_id, expected_hours, work_hours, late_minutes, early_leave_minutes, overtime_hours, is_holiday, on_approved_leave`;
  console.log("attendance (09:25-18:30, shift 09:00-17:00 grace15 break60):", JSON.stringify(att));
  console.log("   expect: expected_hours 7, work_hours ~8.08, late ~10, early_leave 0, overtime ~1.08");

  console.log("\n--- A3: reconciliation view ---");
  const rv = await sql`SELECT count(*)::int rows FROM public.hr_payroll_reconciliation_v`;
  console.log("recon view rows:", rv[0].rows);

  console.log("\n--- A4: employee-user link ---");
  const pf = await sql`SELECT p.id FROM public.profiles p
    WHERE p.deleted_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM public.employees em WHERE em.user_id = p.id AND em.deleted_at IS NULL)
    LIMIT 1`;
  await sql`SELECT public.hr_link_employee_user(${e.id}, ${pf[0].id})`;
  const linked = await sql`SELECT user_id FROM public.employees WHERE id = ${e.id}`;
  console.log("linked employee.user_id:", linked[0].user_id, "==", pf[0].id);
  try {
    const emp2 = await sql`SELECT id FROM public.employees WHERE deleted_at IS NULL AND id <> ${e.id} LIMIT 1`;
    await sql`SELECT public.hr_link_employee_user(${emp2[0].id}, ${pf[0].id})`;
    console.log("   !!! duplicate link allowed");
  } catch (err) { console.log("   duplicate link blocked:", err.message); }

  console.log("\n--- cleanup ---");
  await sql`DELETE FROM public.office_leave_requests WHERE id = ${lr.id}`;
  await sql`DELETE FROM public.office_attendance WHERE employee_id = ${e.id} AND attendance_date = '2026-09-01'`;
  await sql`DELETE FROM public.hr_employee_leave_balances WHERE employee_id = ${e.id} AND leave_type_id = ${ltId} AND year = 2026`;
  await sql`UPDATE public.employees SET user_id = NULL WHERE id = ${e.id}`;
  console.log("done");
});
process.exit(0);
