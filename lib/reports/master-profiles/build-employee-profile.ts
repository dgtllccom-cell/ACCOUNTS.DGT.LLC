/**
 * Employee Master Profile — professional A4 profile for an employee:
 * photo, Person ID, Employee Code, identity & contact, designation/department,
 * company/country/branch, joining/employment, KYC, and a payroll summary.
 *
 * Input: a flat record assembled from the employee form / employee detail API.
 */

import type { MasterProfileConfig } from "@/lib/reports/open-master-profile-report-window";
import type { DocumentBranding } from "@/lib/reports/resolve-document-branding";
import {
  makeT, pushRow, section, relatedTable, compact, money, fmtDate, fmtDateTime,
  metaCells, kpiCards, brandingConfig, type Lang,
} from "./shared";

export type EmployeeProfileRecord = {
  id?: string;
  personCode?: string | null;
  employeeCode?: string | null;
  fullName: string;
  firstName?: string | null;
  lastName?: string | null;
  fatherName?: string | null;
  gender?: string | null;
  nationalId?: string | null;
  photoUrl?: string | null;
  category?: string | null;
  designation?: string | null;
  department?: string | null;
  employmentType?: string | null;
  jobStatus?: string | null;
  status?: string | null;
  companyName?: string | null;
  countryName?: string | null;
  countryId?: string | null;
  countryBranchId?: string | null;
  cityBranchId?: string | null;
  mainBranchName?: string | null;
  cityBranchName?: string | null;
  reportingManager?: string | null;
  joiningDate?: string | null;
  probationStartDate?: string | null;
  probationEndDate?: string | null;
  contractStartDate?: string | null;
  contractEndDate?: string | null;
  workingShift?: string | null;
  dutyStartTime?: string | null;
  dutyEndTime?: string | null;
  weeklyOffDay?: string | null;
  salaryType?: string | null;
  basicSalary?: number | null;
  salaryCurrency?: string | null;
  totalAllowances?: number | null;
  deduction?: number | null;
  taxDeduction?: number | null;
  netSalary?: number | null;
  mobile?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  address?: string | null;
  createdAt?: string | null;
  createdBy?: string | null;
  attendanceSummary?: Array<{ period?: string; present?: number | string; absent?: number | string; leave?: number | string; overtime?: number | string }>;
  payrollSummary?: Array<{ period?: string; gross?: number; deductions?: number; net?: number; currency?: string; status?: string }>;
};

export function buildEmployeeProfileConfig(
  r: EmployeeProfileRecord,
  branding: DocumentBranding,
  lang: Lang,
): MasterProfileConfig {
  const tt = makeT(lang);
  const cur = r.salaryCurrency || branding.baseCurrency || "";
  const dutyHours = r.dutyStartTime && r.dutyEndTime ? `${r.dutyStartTime} – ${r.dutyEndTime}` : "";

  const sections = compact([
    section(tt("pdoc.sec_identity", "Identity"), (rows) => {
      pushRow(rows, tt("pdoc.full_name", "Full Name"), r.fullName);
      pushRow(rows, tt("pdoc.first_name", "First Name"), r.firstName);
      pushRow(rows, tt("pdoc.last_name", "Last Name"), r.lastName);
      pushRow(rows, tt("pdoc.father_name", "Father / Guardian Name"), r.fatherName);
      pushRow(rows, tt("pdoc.gender", "Gender"), r.gender);
      pushRow(rows, tt("pdoc.national_id", "National ID / Passport"), r.nationalId);
      pushRow(rows, tt("pdoc.person_id", "Person ID"), r.personCode);
      pushRow(rows, tt("pdoc.employee_code", "Employee Code"), r.employeeCode);
    }),
    section(tt("pdoc.sec_contact", "Contact Information"), (rows) => {
      pushRow(rows, tt("pdoc.phone", "Phone"), r.mobile);
      pushRow(rows, tt("pdoc.whatsapp", "WhatsApp"), r.whatsapp);
      pushRow(rows, tt("pdoc.email", "Email"), r.email);
      pushRow(rows, tt("pdoc.address", "Address"), r.address);
    }),
    section(tt("pdoc.sec_employment", "Employment & Designation"), (rows) => {
      pushRow(rows, tt("pdoc.category", "Category"), r.category);
      pushRow(rows, tt("pdoc.designation", "Designation"), r.designation);
      pushRow(rows, tt("pdoc.department", "Department"), r.department);
      pushRow(rows, tt("pdoc.employment_type", "Employment Type"), r.employmentType);
      pushRow(rows, tt("pdoc.job_status", "Job Status"), r.jobStatus);
      pushRow(rows, tt("pdoc.reporting_manager", "Reporting Manager"), r.reportingManager);
    }),
    section(tt("pdoc.sec_org", "Company · Country · Branch"), (rows) => {
      pushRow(rows, tt("pdoc.company", "Company"), r.companyName || branding.entityName);
      pushRow(rows, tt("pdoc.country", "Country"), r.countryName || branding.countryName);
      pushRow(rows, tt("pdoc.main_branch", "Main Branch"), r.mainBranchName);
      pushRow(rows, tt("pdoc.city_branch", "City Branch"), r.cityBranchName);
    }),
    section(tt("pdoc.sec_timeline", "Joining & Contract"), (rows) => {
      pushRow(rows, tt("pdoc.joining_date", "Joining Date"), fmtDate(r.joiningDate));
      pushRow(rows, tt("pdoc.probation_start", "Probation Start"), fmtDate(r.probationStartDate));
      pushRow(rows, tt("pdoc.probation_end", "Probation End"), fmtDate(r.probationEndDate));
      pushRow(rows, tt("pdoc.contract_start", "Contract Start"), fmtDate(r.contractStartDate));
      pushRow(rows, tt("pdoc.contract_end", "Contract End"), fmtDate(r.contractEndDate));
    }),
    section(tt("pdoc.sec_shift", "Shift & Attendance"), (rows) => {
      pushRow(rows, tt("pdoc.working_shift", "Working Shift"), r.workingShift);
      pushRow(rows, tt("pdoc.duty_hours", "Duty Hours"), dutyHours);
      pushRow(rows, tt("pdoc.weekly_off", "Weekly Off"), r.weeklyOffDay);
    }),
    section(tt("pdoc.sec_payroll", "Salary & Payroll"), (rows) => {
      pushRow(rows, tt("pdoc.salary_type", "Salary Type"), r.salaryType);
      pushRow(rows, tt("pdoc.basic_salary", "Basic Salary"), r.basicSalary != null ? money(r.basicSalary, cur) : "");
      pushRow(rows, tt("pdoc.total_allowances", "Total Allowances"), r.totalAllowances != null ? money(r.totalAllowances, cur) : "");
      pushRow(rows, tt("pdoc.deductions", "Deductions"), (r.deduction != null || r.taxDeduction != null) ? money((Number(r.deduction) || 0) + (Number(r.taxDeduction) || 0), cur) : "");
      pushRow(rows, tt("pdoc.net_salary", "Net Salary"), r.netSalary != null ? money(r.netSalary, cur) : "");
      pushRow(rows, tt("pdoc.currency", "Currency"), cur);
    }),
    section(tt("pdoc.sec_audit", "System / Audit"), (rows) => {
      pushRow(rows, tt("pdoc.created_on", "Created On"), fmtDateTime(r.createdAt));
      pushRow(rows, tt("pdoc.created_by", "Created By"), r.createdBy);
    }),
  ]);

  const relatedTables = compact([
    relatedTable(
      tt("pdoc.rt_attendance", "Attendance Summary"),
      [tt("pdoc.period", "Period"), tt("pdoc.present", "Present"), tt("pdoc.absent", "Absent"), tt("pdoc.leave", "Leave"), tt("pdoc.overtime", "Overtime")],
      (r.attendanceSummary || []).map((a) => [a.period, a.present, a.absent, a.leave, a.overtime]),
    ),
    relatedTable(
      tt("pdoc.rt_payroll", "Payroll History"),
      [tt("pdoc.period", "Period"), tt("pdoc.gross", "Gross"), tt("pdoc.deductions", "Deductions"), tt("pdoc.net_salary", "Net"), tt("pdoc.status", "Status")],
      (r.payrollSummary || []).map((p) => [
        p.period,
        p.gross != null ? money(p.gross, p.currency || cur) : "",
        p.deductions != null ? money(p.deductions, p.currency || cur) : "",
        p.net != null ? money(p.net, p.currency || cur) : "",
        p.status,
      ]),
    ),
  ]);

  const kpis = kpiCards([
    { label: tt("pdoc.basic_salary", "Basic Salary"), value: money(r.basicSalary ?? 0, cur), tone: "current" },
    { label: tt("pdoc.total_allowances", "Total Allowances"), value: money(r.totalAllowances ?? 0, cur), tone: "credit" },
    { label: tt("pdoc.deductions", "Deductions"), value: money((Number(r.deduction) || 0) + (Number(r.taxDeduction) || 0), cur), tone: "debit" },
    { label: tt("pdoc.net_salary", "Net Salary"), value: money(r.netSalary ?? 0, cur), tone: "open" },
  ]);

  return {
    lang,
    title: tt("pdoc.employee_report_title", "Employee Master Profile"),
    subtitle: tt("pdoc.employee_report_subtitle", "Employee Profile & Payroll Summary"),
    overviewLabel: tt("pdoc.employee_overview", "Employee Profile Overview"),
    reportTypeLabel: r.category || tt("pdoc.employee_report_title", "Employee Master Profile"),
    name: r.fullName,
    status: r.status || r.jobStatus || undefined,
    reportIdPrefix: "EMP",
    reportIdValue: r.employeeCode || r.personCode || (r.id ? r.id.slice(0, 8).toUpperCase() : ""),
    photoUrl: r.photoUrl || undefined,
    meta: metaCells([
      [tt("pdoc.designation", "Designation"), r.designation],
      [tt("pdoc.company", "Company"), r.companyName || branding.entityName],
      [tt("pdoc.country", "Country"), r.countryName || branding.countryName],
      [tt("pdoc.joining_date", "Joining Date"), fmtDate(r.joiningDate)],
    ]),
    kpis,
    sections,
    relatedTables,
    createdBy: r.createdBy || undefined,
    ...brandingConfig(branding),
  };
}
