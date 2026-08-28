import { withLocalPg } from "@/lib/db/local-postgres";
import type { ErpSession } from "@/lib/auth/session";

/**
 * Employee Self-Service — a strictly own-record view. The logged-in user is
 * matched to an employee by email (session.email → customers.email →
 * employees.person_master_id). Every query is pinned to that one employee id;
 * nothing else is ever returned.
 */

export async function resolveSelfEmployeeId(session: ErpSession): Promise<string | null> {
  const email = (session.email || "").trim().toLowerCase();
  if (!email) return null;
  return withLocalPg(async (sql) => {
    const r = await sql`
      SELECT e.id
      FROM public.employees e
      JOIN public.customers c ON c.id = e.person_master_id
      WHERE e.deleted_at IS NULL AND lower(btrim(c.email)) = ${email}
      ORDER BY e.created_at DESC LIMIT 1`;
    return r?.[0]?.id ?? null;
  });
}

export async function selfServiceBundle(employeeId: string) {
  return withLocalPg(async (sql) => {
    const profile = (await sql`
      SELECT e.employee_code, COALESCE(c.customer_name, c.company_name, e.employee_code) AS name,
             e.designation, e.department, e.category, e.employment_type, e.job_status, e.status,
             e.joining_date, e.confirmation_date, e.probation_end_date,
             co.name AS country, cb.name AS main_branch, cib.name AS city_branch,
             public.hr_employee_currency(e.id) AS currency,
             e.basic_salary, e.monthly_salary, e.salary_payment_method,
             c.email, c.mobile, c.address, rm.employee_code AS reporting_manager
      FROM public.employees e
      LEFT JOIN public.customers c ON c.id = e.person_master_id
      LEFT JOIN public.countries co ON co.id = e.country_id
      LEFT JOIN public.country_branches cb ON cb.id = e.country_branch_id
      LEFT JOIN public.city_branches cib ON cib.id = e.city_branch_id
      LEFT JOIN public.employees rm ON rm.id = e.reporting_manager_id
      WHERE e.id = ${employeeId}`)?.[0] ?? null;

    const payslips = await sql`
      SELECT r.period_month, r.run_no, l.gross_salary, l.net_salary, l.currency, l.usd_amount, r.status
      FROM public.hr_payroll_run_lines l
      JOIN public.hr_payroll_runs r ON r.id = l.run_id
      WHERE l.employee_id = ${employeeId} AND l.status IN ('posted','paid')
      ORDER BY r.period_month DESC LIMIT 24`;

    const leaveBalances = await sql`
      SELECT leave_type_name, year, entitled_days, carried_forward, taken_days, pending_days, remaining_days
      FROM public.hr_employee_leave_balances_v
      WHERE employee_id = ${employeeId}
      ORDER BY year DESC, leave_type_name`;

    const leaveRequests = await sql`
      SELECT leave_type, from_date, to_date, days, status
      FROM public.office_leave_requests
      WHERE employee_id = ${employeeId} AND deleted_at IS NULL
      ORDER BY from_date DESC LIMIT 20`;

    const kyc = (await sql`
      SELECT kyc_status, required_count, verified_count, missing_mandatory_count, expiring_soon_count, missing_items
      FROM public.hr_employee_kyc_status_v WHERE employee_id = ${employeeId}`)?.[0] ?? null;

    const documents = await sql`
      SELECT requirement_code, document_type, document_number, expiry_date, status
      FROM public.hr_employee_kyc_documents
      WHERE employee_id = ${employeeId} AND deleted_at IS NULL
      ORDER BY expiry_date NULLS LAST`;

    const attendance = await sql`
      SELECT attendance_date, check_in, check_out, status, work_hours, overtime_hours
      FROM public.office_attendance
      WHERE employee_id = ${employeeId} AND deleted_at IS NULL
      ORDER BY attendance_date DESC LIMIT 31`;

    const lifecycle = await sql`
      SELECT kind, sub_type, effective_date, status, reason
      FROM public.hr_employee_lifecycle_v
      WHERE employee_id = ${employeeId}
      ORDER BY effective_date DESC LIMIT 20`;

    return { profile, payslips: payslips ?? [], leaveBalances: leaveBalances ?? [], leaveRequests: leaveRequests ?? [], kyc, documents: documents ?? [], attendance: attendance ?? [], lifecycle: lifecycle ?? [] };
  });
}
