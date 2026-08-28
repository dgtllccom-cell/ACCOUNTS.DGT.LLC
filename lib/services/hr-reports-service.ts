import { withLocalPg } from "@/lib/db/local-postgres";
import type { HrScope } from "@/lib/services/hr-api";

/**
 * HRM reports service — one scoped dataset per report type. Every WHERE repeats
 * the country/branch scope (withLocalPg bypasses RLS). Currency columns are the
 * employee's resolved official currency (hr_employee_currency).
 */

export type HrReportType =
  | "employee_directory"
  | "attendance"
  | "leave"
  | "overtime"
  | "payroll_register"
  | "salary_slip"
  | "employee_ledger"
  | "expiring_documents"
  | "gratuity"
  | "audit_history";

export type HrReportFilters = {
  from?: string;
  to?: string;
  periodMonth?: string;
  employeeId?: string;
  countryId?: string;
  status?: string;
};

function empScope(sql: any, scope: HrScope, col = "e.country_id") {
  if (scope.countryIds === null) return sql`TRUE`;
  return sql`(${sql(col)} = ANY(${scope.countryIds}) OR ${sql(col)} IS NULL)`;
}

export class HrReportsService {
  async run(type: HrReportType, filters: HrReportFilters, scope: HrScope): Promise<{ columns: { key: string; label: string; align?: "right" }[]; rows: any[] }> {
    switch (type) {
      case "employee_directory":
        return this.employeeDirectory(filters, scope);
      case "attendance":
        return this.attendance(filters, scope);
      case "leave":
        return this.leave(filters, scope);
      case "overtime":
        return this.overtime(filters, scope);
      case "payroll_register":
        return this.payrollRegister(filters, scope);
      case "salary_slip":
        return this.salarySlip(filters, scope);
      case "employee_ledger":
        return this.employeeLedger(filters, scope);
      case "expiring_documents":
        return this.expiringDocuments(filters, scope);
      case "gratuity":
        return this.gratuity(filters, scope);
      case "audit_history":
        return this.auditHistory(filters, scope);
      default:
        throw new Error(`Unknown report type: ${type}`);
    }
  }

  private async employeeDirectory(f: HrReportFilters, scope: HrScope) {
    const rows = await withLocalPg(async (sql) => {
      const where: any[] = [sql`e.deleted_at IS NULL`, empScope(sql, scope)];
      if (f.status) where.push(sql`e.status = ${f.status}`);
      if (f.countryId) where.push(sql`e.country_id = ${f.countryId}`);
      const w = where.reduce((a, p, i) => (i === 0 ? p : sql`${a} AND ${p}`));
      return sql`
        SELECT e.employee_code, COALESCE(c.customer_name, c.company_name, e.employee_code) AS employee_name,
               e.designation, e.department, co.name AS country, cib.name AS city_branch,
               e.joining_date, e.status, e.employment_type,
               e.basic_salary, public.hr_employee_currency(e.id) AS currency,
               rm.employee_code AS reporting_manager
        FROM public.employees e
        LEFT JOIN public.customers c ON c.id = e.person_master_id
        LEFT JOIN public.countries co ON co.id = e.country_id
        LEFT JOIN public.city_branches cib ON cib.id = e.city_branch_id
        LEFT JOIN public.employees rm ON rm.id = e.reporting_manager_id
        WHERE ${w} ORDER BY employee_name`;
    });
    return {
      columns: [
        { key: "employee_code", label: "Code" }, { key: "employee_name", label: "Employee" },
        { key: "designation", label: "Designation" }, { key: "department", label: "Department" },
        { key: "country", label: "Country" }, { key: "city_branch", label: "Branch" },
        { key: "joining_date", label: "Joining Date" }, { key: "status", label: "Status" },
        { key: "employment_type", label: "Type" }, { key: "basic_salary", label: "Basic Salary", align: "right" as const },
        { key: "currency", label: "Currency" }, { key: "reporting_manager", label: "Manager" },
      ],
      rows: rows ?? [],
    };
  }

  private async attendance(f: HrReportFilters, scope: HrScope) {
    const rows = await withLocalPg(async (sql) => {
      const where: any[] = [sql`a.deleted_at IS NULL`, scope.countryIds === null ? sql`TRUE` : sql`(a.country_id = ANY(${scope.countryIds}) OR a.country_id IS NULL)`];
      if (f.from) where.push(sql`a.attendance_date >= ${f.from}`);
      if (f.to) where.push(sql`a.attendance_date <= ${f.to}`);
      if (f.employeeId) where.push(sql`a.employee_id = ${f.employeeId}`);
      const w = where.reduce((a, p, i) => (i === 0 ? p : sql`${a} AND ${p}`));
      return sql`
        SELECT a.attendance_date, e.employee_code, COALESCE(c.customer_name, c.company_name, e.employee_code) AS employee_name,
               a.check_in, a.check_out, a.status, a.work_hours, a.late_minutes, a.early_leave_minutes, a.overtime_hours
        FROM public.office_attendance a
        JOIN public.employees e ON e.id = a.employee_id
        LEFT JOIN public.customers c ON c.id = e.person_master_id
        WHERE ${w} ORDER BY a.attendance_date DESC, employee_name`;
    });
    return {
      columns: [
        { key: "attendance_date", label: "Date" }, { key: "employee_code", label: "Code" }, { key: "employee_name", label: "Employee" },
        { key: "check_in", label: "In" }, { key: "check_out", label: "Out" }, { key: "status", label: "Status" },
        { key: "work_hours", label: "Hours", align: "right" as const }, { key: "late_minutes", label: "Late (min)", align: "right" as const },
        { key: "early_leave_minutes", label: "Early (min)", align: "right" as const }, { key: "overtime_hours", label: "OT Hrs", align: "right" as const },
      ],
      rows: rows ?? [],
    };
  }

  private async leave(f: HrReportFilters, scope: HrScope) {
    const rows = await withLocalPg(async (sql) => {
      const where: any[] = [sql`l.deleted_at IS NULL`, scope.countryIds === null ? sql`TRUE` : sql`(l.country_id = ANY(${scope.countryIds}) OR l.country_id IS NULL)`];
      if (f.from) where.push(sql`l.to_date >= ${f.from}`);
      if (f.to) where.push(sql`l.from_date <= ${f.to}`);
      if (f.employeeId) where.push(sql`l.employee_id = ${f.employeeId}`);
      if (f.status) where.push(sql`lower(l.status) = lower(${f.status})`);
      const w = where.reduce((a, p, i) => (i === 0 ? p : sql`${a} AND ${p}`));
      return sql`
        SELECT e.employee_code, COALESCE(c.customer_name, c.company_name, e.employee_code) AS employee_name,
               l.leave_type, l.from_date, l.to_date, l.days, l.status, l.reason
        FROM public.office_leave_requests l
        JOIN public.employees e ON e.id = l.employee_id
        LEFT JOIN public.customers c ON c.id = e.person_master_id
        WHERE ${w} ORDER BY l.from_date DESC, employee_name`;
    });
    return {
      columns: [
        { key: "employee_code", label: "Code" }, { key: "employee_name", label: "Employee" }, { key: "leave_type", label: "Type" },
        { key: "from_date", label: "From" }, { key: "to_date", label: "To" }, { key: "days", label: "Days", align: "right" as const },
        { key: "status", label: "Status" }, { key: "reason", label: "Reason" },
      ],
      rows: rows ?? [],
    };
  }

  private async overtime(f: HrReportFilters, scope: HrScope) {
    const rows = await withLocalPg(async (sql) => {
      const where: any[] = [sql`a.deleted_at IS NULL`, sql`a.overtime_hours > 0`, scope.countryIds === null ? sql`TRUE` : sql`(a.country_id = ANY(${scope.countryIds}) OR a.country_id IS NULL)`];
      if (f.from) where.push(sql`a.attendance_date >= ${f.from}`);
      if (f.to) where.push(sql`a.attendance_date <= ${f.to}`);
      if (f.employeeId) where.push(sql`a.employee_id = ${f.employeeId}`);
      const w = where.reduce((a, p, i) => (i === 0 ? p : sql`${a} AND ${p}`));
      return sql`
        SELECT e.employee_code, COALESCE(c.customer_name, c.company_name, e.employee_code) AS employee_name,
               public.hr_employee_currency(e.id) AS currency, e.overtime_rate,
               COUNT(*)::int AS ot_days, COALESCE(SUM(a.overtime_hours),0) AS ot_hours,
               ROUND(COALESCE(SUM(a.overtime_hours),0) * COALESCE(e.overtime_rate,0), 2) AS ot_amount
        FROM public.office_attendance a
        JOIN public.employees e ON e.id = a.employee_id
        LEFT JOIN public.customers c ON c.id = e.person_master_id
        WHERE ${w}
        GROUP BY e.employee_code, employee_name, e.id, e.overtime_rate
        ORDER BY ot_hours DESC`;
    });
    return {
      columns: [
        { key: "employee_code", label: "Code" }, { key: "employee_name", label: "Employee" },
        { key: "ot_days", label: "OT Days", align: "right" as const }, { key: "ot_hours", label: "OT Hours", align: "right" as const },
        { key: "overtime_rate", label: "Rate/Hr", align: "right" as const }, { key: "ot_amount", label: "OT Amount", align: "right" as const },
        { key: "currency", label: "Currency" },
      ],
      rows: rows ?? [],
    };
  }

  private async payrollRegister(f: HrReportFilters, scope: HrScope) {
    const rows = await withLocalPg(async (sql) => {
      const where: any[] = [sql`r.deleted_at IS NULL`, scope.countryIds === null ? sql`TRUE` : sql`(r.country_id = ANY(${scope.countryIds}) OR r.country_id IS NULL)`];
      if (f.periodMonth) where.push(sql`r.period_month = ${f.periodMonth}`);
      if (f.countryId) where.push(sql`r.country_id = ${f.countryId}`);
      const w = where.reduce((a, p, i) => (i === 0 ? p : sql`${a} AND ${p}`));
      return sql`
        SELECT r.run_no, r.period_month, co.name AS country, l.status AS line_status,
               e.employee_code, COALESCE(c.customer_name, c.company_name, e.employee_code) AS employee_name,
               l.basic_salary, l.allowances_total, l.overtime_amount, l.bonus_amount,
               l.advance_recovery, l.tax_employee, l.other_deductions, l.net_salary, l.currency, l.usd_amount
        FROM public.hr_payroll_run_lines l
        JOIN public.hr_payroll_runs r ON r.id = l.run_id
        JOIN public.employees e ON e.id = l.employee_id
        LEFT JOIN public.customers c ON c.id = e.person_master_id
        LEFT JOIN public.countries co ON co.id = r.country_id
        WHERE ${w} AND l.status <> 'excluded'
        ORDER BY r.period_month DESC, r.run_no, employee_name`;
    });
    return {
      columns: [
        { key: "run_no", label: "Run" }, { key: "period_month", label: "Period" }, { key: "employee_code", label: "Code" },
        { key: "employee_name", label: "Employee" }, { key: "basic_salary", label: "Basic", align: "right" as const },
        { key: "allowances_total", label: "Allowances", align: "right" as const }, { key: "overtime_amount", label: "OT", align: "right" as const },
        { key: "bonus_amount", label: "Bonus", align: "right" as const }, { key: "advance_recovery", label: "Adv Rec", align: "right" as const },
        { key: "tax_employee", label: "Tax", align: "right" as const }, { key: "other_deductions", label: "Deductions", align: "right" as const },
        { key: "net_salary", label: "Net", align: "right" as const }, { key: "currency", label: "Ccy" },
        { key: "usd_amount", label: "Net USD", align: "right" as const },
      ],
      rows: rows ?? [],
    };
  }

  private async salarySlip(f: HrReportFilters, scope: HrScope) {
    if (!f.employeeId || !f.periodMonth) throw new Error("Salary slip needs employeeId and periodMonth.");
    const empId: string = f.employeeId;
    const period: string = f.periodMonth;
    const rows = await withLocalPg(async (sql) => {
      const inScope = scope.countryIds === null ? sql`TRUE` : sql`(e.country_id = ANY(${scope.countryIds}) OR e.country_id IS NULL)`;
      return sql`
        SELECT e.employee_code, COALESCE(c.customer_name, c.company_name, e.employee_code) AS employee_name,
               e.designation, e.department, co.name AS country,
               l.basic_salary, l.allowances_total, l.allowances_breakdown, l.overtime_amount, l.bonus_amount,
               l.unpaid_leave_deduction, l.other_deductions, l.advance_recovery, l.tax_employee, l.employer_contributions,
               l.gross_salary, l.net_salary, l.currency, l.usd_amount, l.exchange_rate,
               r.run_no, r.period_month, r.status AS run_status
        FROM public.hr_payroll_run_lines l
        JOIN public.hr_payroll_runs r ON r.id = l.run_id
        JOIN public.employees e ON e.id = l.employee_id
        LEFT JOIN public.customers c ON c.id = e.person_master_id
        LEFT JOIN public.countries co ON co.id = e.country_id
        WHERE l.employee_id = ${empId} AND r.period_month = ${period} AND ${inScope}
        ORDER BY r.created_at DESC LIMIT 1`;
    });
    return {
      columns: [
        { key: "component", label: "Component" }, { key: "amount", label: "Amount", align: "right" as const },
      ],
      rows: this.slipLines(rows?.[0]),
    };
  }

  private slipLines(l: any): any[] {
    if (!l) return [];
    const cur = l.currency || "";
    const bd = l.allowances_breakdown || {};
    const lines: any[] = [
      { component: "Basic Salary", amount: `${l.basic_salary} ${cur}` },
      ...Object.entries(bd).filter(([, v]) => Number(v) > 0).map(([k, v]) => ({ component: `Allowance — ${k}`, amount: `${v} ${cur}` })),
      { component: "Overtime", amount: `${l.overtime_amount} ${cur}` },
      { component: "Bonus", amount: `${l.bonus_amount} ${cur}` },
      { component: "Gross Salary", amount: `${l.gross_salary} ${cur}` },
      { component: "Unpaid Leave Deduction", amount: `-${l.unpaid_leave_deduction} ${cur}` },
      { component: "Salary Advance Recovery", amount: `-${l.advance_recovery} ${cur}` },
      { component: "Payroll Tax", amount: `-${l.tax_employee} ${cur}` },
      { component: "Other Deductions", amount: `-${l.other_deductions} ${cur}` },
      { component: "NET PAY", amount: `${l.net_salary} ${cur}` },
      { component: "USD equivalent", amount: `${l.usd_amount} USD @ ${l.exchange_rate}` },
    ];
    return lines;
  }

  private async employeeLedger(f: HrReportFilters, scope: HrScope) {
    if (!f.employeeId) throw new Error("Employee ledger needs employeeId.");
    const empId: string = f.employeeId;
    const rows = await withLocalPg(async (sql) => {
      const inScope = scope.countryIds === null ? sql`TRUE` : sql`(e.country_id = ANY(${scope.countryIds}) OR e.country_id IS NULL)`;
      const salaries = await sql`
        SELECT d.salary_month AS ref, d.due_date AS entry_date, 'Salary' AS kind,
               d.net_salary AS amount, d.currency, d.status
        FROM public.employee_salaries_due d
        JOIN public.employees e ON e.id = d.employee_id
        WHERE d.employee_id = ${empId} AND d.deleted_at IS NULL AND ${inScope}`;
      const advances = await sql`
        SELECT COALESCE(a.start_month, to_char(a.payment_date,'YYYY-MM')) AS ref, a.payment_date AS entry_date, 'Salary Advance' AS kind,
               -a.amount AS amount, a.currency, a.status
        FROM public.employee_advances_loans a
        JOIN public.employees e ON e.id = a.employee_id
        WHERE a.employee_id = ${empId} AND a.deleted_at IS NULL AND lower(a.type) = 'advance' AND ${inScope}`;
      return [...(salaries ?? []), ...(advances ?? [])].sort((x, y) => String(y.entry_date).localeCompare(String(x.entry_date)));
    });
    return {
      columns: [
        { key: "entry_date", label: "Date" }, { key: "ref", label: "Reference" }, { key: "kind", label: "Type" },
        { key: "amount", label: "Amount", align: "right" as const }, { key: "currency", label: "Ccy" }, { key: "status", label: "Status" },
      ],
      rows: rows ?? [],
    };
  }

  private async expiringDocuments(f: HrReportFilters, scope: HrScope) {
    const rows = await withLocalPg(async (sql) => {
      const days = f.to ? sql`${f.to}::date` : sql`current_date + 60`;
      const where: any[] = [sql`d.deleted_at IS NULL`, sql`d.expiry_date IS NOT NULL`, sql`d.expiry_date <= ${days}`, scope.countryIds === null ? sql`TRUE` : sql`(d.country_id = ANY(${scope.countryIds}) OR d.country_id IS NULL)`];
      if (f.employeeId) where.push(sql`d.employee_id = ${f.employeeId}`);
      const w = where.reduce((a, p, i) => (i === 0 ? p : sql`${a} AND ${p}`));
      return sql`
        SELECT e.employee_code, COALESCE(c.customer_name, c.company_name, e.employee_code) AS employee_name,
               d.document_type, d.document_number, d.issue_date, d.expiry_date, d.status,
               (d.expiry_date - current_date) AS days_left
        FROM public.hr_employee_kyc_documents d
        JOIN public.employees e ON e.id = d.employee_id
        LEFT JOIN public.customers c ON c.id = e.person_master_id
        WHERE ${w} ORDER BY d.expiry_date ASC`;
    });
    return {
      columns: [
        { key: "employee_code", label: "Code" }, { key: "employee_name", label: "Employee" }, { key: "document_type", label: "Document" },
        { key: "document_number", label: "Number" }, { key: "issue_date", label: "Issued" }, { key: "expiry_date", label: "Expires" },
        { key: "days_left", label: "Days Left", align: "right" as const }, { key: "status", label: "Status" },
      ],
      rows: rows ?? [],
    };
  }

  private async gratuity(f: HrReportFilters, scope: HrScope) {
    const rows = await withLocalPg(async (sql) => {
      const where: any[] = [scope.countryIds === null ? sql`TRUE` : sql`(s.country_id = ANY(${scope.countryIds}) OR s.country_id IS NULL)`];
      if (f.status) where.push(sql`s.status = ${f.status}`);
      const w = where.reduce((a, p, i) => (i === 0 ? p : sql`${a} AND ${p}`));
      return sql`
        SELECT s.settlement_no, s.employee_code, s.employee_name, s.separation_type, s.calc_as_of,
               s.service_years, s.gratuity_amount, s.leave_encashment_amount, s.pending_salary_amount,
               s.advance_deduction, s.other_deductions, s.net_settlement, s.currency, s.usd_amount, s.status
        FROM public.hr_gratuity_settlements_v s WHERE ${w} ORDER BY s.calc_as_of DESC`;
    });
    return {
      columns: [
        { key: "settlement_no", label: "No" }, { key: "employee_name", label: "Employee" }, { key: "separation_type", label: "Type" },
        { key: "calc_as_of", label: "As Of" }, { key: "service_years", label: "Service Yrs", align: "right" as const },
        { key: "gratuity_amount", label: "Gratuity", align: "right" as const }, { key: "leave_encashment_amount", label: "Leave Enc.", align: "right" as const },
        { key: "pending_salary_amount", label: "Pending Sal.", align: "right" as const }, { key: "advance_deduction", label: "Adv Ded.", align: "right" as const },
        { key: "net_settlement", label: "Net", align: "right" as const }, { key: "currency", label: "Ccy" }, { key: "status", label: "Status" },
      ],
      rows: rows ?? [],
    };
  }

  private async auditHistory(f: HrReportFilters, scope: HrScope) {
    const rows = await withLocalPg(async (sql) => {
      const cf = scope.countryIds === null ? sql`TRUE` : sql`(x.country_id = ANY(${scope.countryIds}) OR x.country_id IS NULL)`;
      const pos = await sql`
        SELECT 'Position Event' AS area, x.event_type AS action, x.status, x.effective_date AS on_date, x.reason,
               e.employee_code, COALESCE(c.customer_name, c.company_name, e.employee_code) AS employee_name, x.created_at
        FROM public.hr_employee_position_events x
        JOIN public.employees e ON e.id = x.employee_id
        LEFT JOIN public.customers c ON c.id = e.person_master_id
        WHERE x.deleted_at IS NULL AND ${cf}`;
      const sep = await sql`
        SELECT 'Separation' AS area, x.separation_type AS action, x.status, x.last_working_date AS on_date, x.reason,
               e.employee_code, COALESCE(c.customer_name, c.company_name, e.employee_code) AS employee_name, x.created_at
        FROM public.hr_employee_separations x
        JOIN public.employees e ON e.id = x.employee_id
        LEFT JOIN public.customers c ON c.id = e.person_master_id
        WHERE x.deleted_at IS NULL AND ${cf}`;
      const pay = await sql`
        SELECT 'Payroll Run' AS area, ev.action, r.status, (r.period_month || '-01')::date AS on_date, r.run_no AS reason,
               NULL AS employee_code, r.run_no AS employee_name, ev.created_at
        FROM public.hr_payroll_run_events ev
        JOIN public.hr_payroll_runs r ON r.id = ev.run_id
        WHERE ${scope.countryIds === null ? sql`TRUE` : sql`(r.country_id = ANY(${scope.countryIds}) OR r.country_id IS NULL)`}`;
      return [...(pos ?? []), ...(sep ?? []), ...(pay ?? [])].sort((x, y) => String(y.created_at).localeCompare(String(x.created_at))).slice(0, 500);
    });
    return {
      columns: [
        { key: "created_at", label: "Timestamp" }, { key: "area", label: "Area" }, { key: "employee_name", label: "Employee / Ref" },
        { key: "action", label: "Action" }, { key: "status", label: "Status" }, { key: "on_date", label: "Effective" }, { key: "reason", label: "Detail" },
      ],
      rows: rows ?? [],
    };
  }
}

export const hrReportsService = new HrReportsService();
