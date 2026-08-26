"use client";

import { useEffect, useState } from "react";
import {
  MoreVertical,
  Edit3,
  CreditCard,
  FileText,
  Award,
  Trash2,
  Printer,
  Layers
} from "lucide-react";
import { apiGet, apiDelete } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { SimpleModal } from "@/components/ui/simple-modal";
import { EmployeeForm } from "./employee-form";
import { AdvanceLoanModal } from "./advance-loan-modal";
import { EmployeeLedgerPanel } from "./employee-ledger-panel";
import { PayrollReportsView } from "./payroll-reports-view";
import { printEmployeeCertificate } from "@/components/ui/employee-certificate-print";
import { UniversalReportModal } from "@/components/ui/universal-report-modal";
import { JournalPrintButton } from "@/components/reports/journal-print-button";
import { Th } from "@/components/ui/translated-th";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";
import { Party360Modal } from "@/features/customers/components/party-360-modal";

export function EmployeeManagementView() {
  const lang = useActiveLanguage();
  const [activeTab, setActiveTab] = useState<"master" | "payroll">("master");
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [countryId, setCountryId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [countriesList, setCountriesList] = useState<any[]>([]);
  const [branchesList, setBranchesList] = useState<any[]>([]);

  // Action Menu Dropdown per row
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);

  const journalColumns = [
    { key: "employee_code", label: t(lang, "hr.col_emp_code", "Emp Code") },
    { key: "person_name", label: t(lang, "hr.col_employee_name", "Employee Name") },
    { key: "mobile", label: t(lang, "cbs.mobile_word", "Mobile") },
    { key: "country_name", label: t(lang, "common.country", "Country") },
    { key: "branch_name", label: t(lang, "common.branch", "Branch") },
    { key: "category", label: t(lang, "common.category", "Category") },
    { key: "designation", label: t(lang, "cbs.designation_word", "Designation") },
    { key: "department", label: t(lang, "hr.department_word", "Department") },
    { key: "joining_date", label: t(lang, "hr.col_joining_date", "Joining Date") },
    { key: "salary_formatted", label: t(lang, "hr.col_net_payroll", "Net Payroll"), align: "right" as const },
    { key: "status", label: t(lang, "common.status", "Status"), format: "status" as const },
  ];

  const formattedEmployees = employees.map((emp) => ({
    ...emp,
    person_name: emp.person?.customer_name || "-",
    mobile: emp.person?.mobile || "-",
    country_name: emp.country?.name || "-",
    branch_name: emp.country_branch?.name || emp.city_branch?.name || "-",
    salary_formatted: `${emp.net_salary?.toLocaleString() ?? 0} ${emp.salary_currency || ""}`,
  }));

  // Modals state
  const [showFormModal, setShowFormModal] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);

  const [selectedEmployeeForLoan, setSelectedEmployeeForLoan] = useState<any | null>(null);
  const [selectedEmployeeForHistory, setSelectedEmployeeForHistory] = useState<any | null>(null);
  const [party360PersonId, setParty360PersonId] = useState<string | null>(null);

  // Load location options for filters
  useEffect(() => {
    async function loadFilterLocations() {
      try {
        const res = await apiGet<{ countries: any[] }>("/api/erp/locations/countries");
        setCountriesList(res.countries || []);
      } catch {}
    }
    loadFilterLocations();
  }, []);

  useEffect(() => {
    if (!countryId) {
      setBranchesList([]);
      setBranchId("");
      return;
    }
    async function loadFilterBranches() {
      try {
        const res = await apiGet<{ ok: boolean; data: { branches: any[] } }>(`/api/erp/locations/branches/main?countryId=${countryId}`);
        if (res.ok && res.data?.branches) {
          setBranchesList(res.data.branches);
        }
      } catch {}
    }
    loadFilterBranches();
  }, [countryId]);

  async function loadEmployees() {
    setLoading(true);
    try {
      const qp = new URLSearchParams();
      if (search) qp.set("search", search);
      if (category) qp.set("category", category);
      if (status) qp.set("status", status);
      if (countryId) qp.set("countryId", countryId);
      if (branchId) qp.set("branchId", branchId);
      qp.set("lang", lang);

      const res = await apiGet<{ employees: any[] }>(`/api/erp/hr-payroll/employees?${qp.toString()}`);
      setEmployees(res.employees || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (activeTab === "master") {
      loadEmployees().catch(() => null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, search, category, status, countryId, branchId, lang]);

  async function handleDelete(id: string) {
    if (!confirm(t(lang, "hr.confirm_delete_employee", "Are you sure you want to delete this employee record?"))) return;
    try {
      await apiDelete(`/api/erp/hr-payroll/employees/${id}`);
      loadEmployees().catch(() => null);
    } catch (err: any) {
      alert(t(lang, "hr.error_deleting_employee", "Error deleting employee: ") + err.message);
    }
  }

  return (
    <div className="w-full max-w-full p-2 sm:p-4 md:p-6 space-y-6 min-h-screen pb-16 font-sans">
      
      {/* Header Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-white rounded-3xl border border-slate-800 p-5 sm:p-7 shadow-lg">
        <div className="relative z-10 flex justify-between items-center flex-wrap gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight text-white mb-1.5">{t(lang, "hr.title_master", "Master Setup — Employee Management")}</h2>
            <p className="text-slate-300 text-xs sm:text-sm font-medium max-w-2xl">
              {t(lang, "hr.subtitle_master", "Register employees, structure categories (Manager, Staff, Employee, Other), define currency allowances, and map accounts with General Ledger (GL) integrations.")}
            </p>
          </div>
          {activeTab === "master" && (
            <div className="flex items-center gap-3">
              <JournalPrintButton
                title={t(lang, "hr.journal_title", "Employee Master Setup Journal")}
                subtitle={t(lang, "hr.journal_subtitle", "Complete Employee Directory & Payroll Master Listing")}
                columns={journalColumns}
                rows={formattedEmployees as Record<string, unknown>[]}
                fetchFullData={async () => {
                  const qp = new URLSearchParams();
                  if (search) qp.set("search", search);
                  if (category) qp.set("category", category);
                  if (status) qp.set("status", status);
                  if (countryId) qp.set("countryId", countryId);
                  if (branchId) qp.set("branchId", branchId);
                  qp.set("limit", "1000");
                  const res = await apiGet<{ employees: any[] }>(`/api/erp/hr-payroll/employees?${qp.toString()}`);
                  return (res.employees || []).map((emp) => ({
                    ...emp,
                    person_name: emp.person?.customer_name || "-",
                    mobile: emp.person?.mobile || "-",
                    country_name: emp.country?.name || "-",
                    branch_name: emp.country_branch?.name || emp.city_branch?.name || "-",
                    salary_formatted: `${emp.net_salary?.toLocaleString() ?? 0} ${emp.salary_currency || ""}`,
                  }));
                }}
                className="h-11 px-5 rounded-2xl font-extrabold text-xs sm:text-sm shadow-md bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700"
              />
              <Button
                onClick={() => {
                  setSelectedEmployeeId(null);
                  setShowFormModal(true);
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs sm:text-sm px-6 py-3 rounded-2xl shadow-md transition-all flex items-center gap-2 h-11"
              >
                <span className="text-lg font-black">+</span> {t(lang, "hr.register_new_employee", "Register New Employee")}
              </Button>
            </div>
          )}
        </div>
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Main Mode Tabs Switcher */}
      <div className="flex border border-slate-200 dark:border-slate-800 gap-1 p-1 bg-slate-100 dark:bg-slate-900 max-w-md rounded-2xl shadow-xs">
        <button
          onClick={() => setActiveTab("master")}
          className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition-all ${
            activeTab === "master"
              ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm border border-slate-200 dark:border-slate-700"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
          }`}
        >
          {t(lang, "hr.tab_master", "Employees Master Setup")}
        </button>
        <button
          onClick={() => setActiveTab("payroll")}
          className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition-all ${
            activeTab === "payroll"
              ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm border border-slate-200 dark:border-slate-700"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
          }`}
        >
          {t(lang, "hr.tab_payroll", "Payroll Register & Reports")}
        </button>
      </div>

      {activeTab === "master" ? (
        <div className="space-y-6">
          
          {/* Filters Grid — Responsive Across Mobile, Tablet & Desktop */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-center shadow-sm">
            <div className="lg:col-span-2">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t(lang, "hr.search_placeholder", "Search by Employee Code, Person Name, Passport...")}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-slate-900 dark:text-slate-100 placeholder-slate-400 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
              />
            </div>

            <div>
              <select
                value={countryId}
                onChange={(e) => { setCountryId(e.target.value); setCategory(""); }}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-slate-900 dark:text-slate-100 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
              >
                <option value="">{t(lang, "common.all_countries", "All Countries")}</option>
                {countriesList.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-slate-900 dark:text-slate-100 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
              >
                <option value="">{t(lang, "common.all_categories", "All Categories")}</option>
                <option value="Manager">{t(lang, "hr.cat_manager", "Manager")}</option>
                <option value="Accountant">Accountant</option>
                <option value="Branch Administrator">Branch Administrator</option>
                <option value="Cashier">Cashier</option>
                <option value="Driver">Driver</option>
                <option value="Cook">Cook</option>
                <option value="Cleaner">Cleaner</option>
                <option value="Security">Security</option>
                <option value="Worker">Worker</option>
                <option value="Normal Staff">{t(lang, "hr.cat_normal_staff", "Normal Staff")}</option>
                <option value="Employee">{t(lang, "hr.cat_employee", "Employee")}</option>
                <option value="Others">{t(lang, "hr.cat_others", "Others")}</option>
              </select>
            </div>

            {countryId ? (
              <div>
                <select
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-slate-900 dark:text-slate-100 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
                >
                  <option value="">{t(lang, "common.all_branches", "All Branches")}</option>
                  {branchesList.map((b) => (
                    <option key={b.id} value={b.id}>{b.name} {b.code ? `(${b.code})` : ""}</option>
                  ))}
                </select>
              </div>
            ) : null}
            
            <div>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-slate-900 dark:text-slate-100 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
              >
                <option value="">{t(lang, "common.all_statuses", "All Statuses")}</option>
                <option value="Active">{t(lang, "common.active", "Active")}</option>
                <option value="Inactive">{t(lang, "common.inactive", "Inactive")}</option>
                <option value="On Leave">{t(lang, "common.on_leave", "On Leave")}</option>
                <option value="Suspended">{t(lang, "common.suspended", "Suspended")}</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <JournalPrintButton
                title={t(lang, "hr.journal_title", "Employee Master Setup Journal")}
                subtitle={t(lang, "hr.journal_subtitle", "Complete Employee Directory & Payroll Master Listing")}
                columns={journalColumns}
                rows={formattedEmployees as Record<string, unknown>[]}
                fetchFullData={async () => {
                  const qp = new URLSearchParams();
                  if (search) qp.set("search", search);
                  if (category) qp.set("category", category);
                  if (status) qp.set("status", status);
                  if (countryId) qp.set("countryId", countryId);
                  if (branchId) qp.set("branchId", branchId);
                  qp.set("limit", "1000");
                  const res = await apiGet<{ employees: any[] }>(`/api/erp/hr-payroll/employees?${qp.toString()}`);
                  return (res.employees || []).map((emp) => ({
                    ...emp,
                    person_name: emp.person?.customer_name || "-",
                    mobile: emp.person?.mobile || "-",
                    country_name: emp.country?.name || "-",
                    branch_name: emp.country_branch?.name || emp.city_branch?.name || "-",
                    salary_formatted: `${emp.net_salary?.toLocaleString() ?? 0} ${emp.salary_currency || ""}`,
                  }));
                }}
                className="w-full h-10 font-extrabold"
              />
            </div>
          </div>

          {/* Master Employee Table — Spacious & Legible */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
            <table className="min-w-full text-xs sm:text-sm text-left text-slate-700 dark:text-slate-300">
              <thead className="bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-200 uppercase font-black text-[11px] sm:text-xs border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <Th className="px-5 py-4">{t(lang, "hr.col_emp_code", "Emp Code")}</Th>
                  <Th className="px-5 py-4">{t(lang, "hr.col_employee_name", "Employee / Person Name")}</Th>
                  <Th className="px-5 py-4">{t(lang, "hr.col_country_branch", "Assigned Country / Branch")}</Th>
                  <Th className="px-5 py-4">{t(lang, "common.category", "Category")}</Th>
                  <Th className="px-5 py-4">{t(lang, "hr.col_designation_dept", "Designation / Department")}</Th>
                  <Th className="px-5 py-4">{t(lang, "hr.col_joining_date", "Joining Date")}</Th>
                  <Th className="px-5 py-4">{t(lang, "hr.col_net_payroll", "Net Payroll")}</Th>
                  <Th className="px-5 py-4">{t(lang, "hr.col_deductions", "Deductions (Adv/Loan)")}</Th>
                  <Th className="px-5 py-4">{t(lang, "common.status", "Status")}</Th>
                  <Th className="px-5 py-4 text-center">{t(lang, "common.actions", "Actions")}</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
                {loading ? (
                  <tr>
                    <td colSpan={10} className="px-6 py-12 text-center text-slate-500 font-medium">{t(lang, "common.loading", "Loading...")}</td>
                  </tr>
                ) : employees.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-6 py-12 text-center text-slate-500 font-medium">{t(lang, "hr.no_employees_cta", "No employees registered yet.")}</td>
                  </tr>
                ) : (
                  employees.map((emp) => (
                    <tr key={emp.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="px-5 py-4 font-mono font-bold text-slate-900 dark:text-slate-100 text-sm align-middle max-w-[200px] break-all">
                        {emp.employee_code}
                      </td>
                      <td className="px-5 py-4 align-middle max-w-[220px]">
                        <div className="font-extrabold text-slate-900 dark:text-slate-100 text-sm break-words">{emp.person?.customer_name}</div>
                        {emp.person?.father_name && (
                          <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                            S/O {emp.person.father_name}
                          </div>
                        )}
                        {emp.person?.person_code ? (
                          <div className="text-[10px] font-mono font-black text-blue-600 dark:text-blue-400 mt-0.5">{emp.person.person_code}</div>
                        ) : null}
                        <div className="text-xs text-slate-500 font-mono mt-0.5">{emp.person?.mobile || "-"}</div>
                      </td>
                      <td className="px-5 py-4 align-middle">
                        <div className="font-bold text-slate-900 dark:text-slate-100">{emp.country?.name || "-"}</div>
                        <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">
                          {emp.country_branch?.name || emp.city_branch?.name || "-"}
                          {emp.country_branch?.code ? ` (${emp.country_branch.code})` : emp.city_branch?.code ? ` (${emp.city_branch.code})` : ""}
                        </div>
                      </td>
                      <td className="px-5 py-4 align-middle">
                        <span className="inline-flex items-center whitespace-nowrap px-3 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-lg font-bold text-xs uppercase shadow-2xs">
                          {emp.category}
                        </span>
                      </td>
                      <td className="px-5 py-4 align-middle max-w-[220px]">
                        <div className="font-bold text-slate-900 dark:text-slate-100 break-words">{emp.designation || "-"}</div>
                        <div className="text-xs text-slate-500 break-words">{emp.department || "-"}</div>
                      </td>
                      <td className="px-5 py-4 text-slate-600 dark:text-slate-400 font-medium text-xs sm:text-sm align-middle">{emp.joining_date || "-"}</td>
                      <td className="px-5 py-4 font-black text-emerald-600 dark:text-emerald-400 font-mono text-sm align-middle">
                        {emp.net_salary?.toLocaleString()} {emp.salary_currency}
                      </td>
                      <td className="px-5 py-4 text-red-600 dark:text-red-400 font-semibold font-mono text-xs sm:text-sm align-middle">
                        -{((emp.advance_deduction || 0) + (emp.loan_deduction || 0))?.toLocaleString()} /mo
                      </td>
                      <td className="px-5 py-4 align-middle">
                        <span className={`inline-flex items-center whitespace-nowrap px-3 py-1 rounded-full text-xs font-black uppercase ${
                          emp.status === "Active" 
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800" 
                            : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
                        }`}>
                          {emp.status}
                        </span>
                      </td>
                      
                      {/* Clean 3-Dots Dropdown Menu per Row */}
                      <td className="px-5 py-4 text-center relative align-middle">
                        <div className="inline-block text-left relative">
                          <button
                            type="button"
                            onClick={() => setOpenActionMenuId(openActionMenuId === emp.id ? null : emp.id)}
                            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition shadow-xs"
                            title={t(lang, "common.actions", "Actions")}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>

                          {openActionMenuId === emp.id ? (
                            <div className="absolute right-0 z-30 mt-1 w-52 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1.5 shadow-2xl text-xs font-bold text-slate-800 dark:text-slate-200">
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenActionMenuId(null);
                                  setSelectedEmployeeId(emp.id);
                                  setShowFormModal(true);
                                }}
                                className="flex w-full items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                              >
                                <Edit3 className="h-4 w-4 text-blue-500" />
                                <span>{t(lang, "common.edit", "Edit Profile")}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setOpenActionMenuId(null);
                                  setSelectedEmployeeForLoan(emp);
                                }}
                                className="flex w-full items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                              >
                                <CreditCard className="h-4 w-4 text-amber-500" />
                                <span>{t(lang, "hr.l_loan_adv", "Loan / Advance")}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setOpenActionMenuId(null);
                                  setSelectedEmployeeForHistory(emp);
                                }}
                                className="flex w-full items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                              >
                                <FileText className="h-4 w-4 text-cyan-500" />
                                <span>{t(lang, "hr.l_ledger", "Ledger Statement")}</span>
                              </button>

                              <button
                                type="button"
                                onClick={async () => {
                                  setOpenActionMenuId(null);
                                  let company: any = {};
                                  try {
                                    const r = await fetch(`/api/erp/branding?countryId=${emp.country_id ?? ""}`);
                                    const j = await r.json();
                                    if (j?.branding) company = { name: j.branding.companyName, logoUrl: j.branding.logoUrl, stampUrl: j.branding.stampUrl, certificateHeader: j.branding.certificateHeader, hrManagerName: j.branding.hrManagerName, address: j.branding.address, country: j.branding.countryName, branch: emp.country_branch_name ?? emp.city_branch_name ?? null };
                                  } catch { /* fall back */ }
                                  printEmployeeCertificate({
                                    employeeId: emp.employee_code,
                                    name: emp.person?.customer_name,
                                    photoUrl: emp.person?.photo_url ?? emp.photo_url ?? null,
                                    cnicPassport: emp.person?.cnic ?? emp.person?.passport ?? emp.cnic_passport ?? null,
                                    department: emp.department,
                                    designation: emp.designation,
                                    joiningDate: emp.joining_date,
                                    employmentType: emp.employment_type,
                                    status: emp.status,
                                    nationality: emp.person?.nationality,
                                    address: emp.person?.address,
                                    mobile: emp.person?.mobile,
                                    email: emp.person?.email,
                                    emergencyContact: emp.person?.emergency_contact ?? emp.person?.whatsapp,
                                    salary: emp.salary ?? emp.basic_salary ?? null,
                                    reportingManager: emp.reporting_manager_name ?? emp.reporting_manager_id ?? null,
                                    serials: { superAdmin: emp.super_admin_serial, country: emp.country_serial, branch: emp.branch_serial, entry: emp.entry_serial },
                                  }, company);
                                }}
                                className="flex w-full items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                              >
                                <Award className="h-4 w-4 text-emerald-500" />
                                <span>{t(lang, "hr.l_certificate", "Print Certificate")}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => { setOpenActionMenuId(null); setParty360PersonId(emp.person_master_id); }}
                                className="flex w-full items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                              >
                                <Layers className="h-4 w-4 text-purple-500" />
                                <span>{t(lang, "hr.erp_links", "ERP Links / 360°")}</span>
                              </button>

                              <div className="my-1 border-t border-slate-200 dark:border-slate-800" />

                              <button
                                type="button"
                                onClick={() => {
                                  setOpenActionMenuId(null);
                                  handleDelete(emp.id);
                                }}
                                className="flex w-full items-center gap-2.5 px-3 py-2 rounded-xl text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition font-black"
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                                <span>{t(lang, "common.delete", "Delete Employee")}</span>
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <PayrollReportsView />
      )}

      {/* Forms Modal */}
      {showFormModal && (
        <SimpleModal
          title={selectedEmployeeId ? t(lang, "hr.edit_profile_title", "Edit Employee Profile Setup") : t(lang, "hr.register_profile_title", "Register New Employee Profile")}
          onClose={() => setShowFormModal(false)}
          className="max-w-6xl w-[95vw] max-h-[90vh] overflow-y-auto"
        >
          <EmployeeForm
            employeeId={selectedEmployeeId}
            onSave={() => {
              setShowFormModal(false);
              loadEmployees().catch(() => null);
            }}
            onCancel={() => setShowFormModal(false)}
          />
        </SimpleModal>
      )}

      {/* Loan/Advance Modal */}
      {selectedEmployeeForLoan && (
        <SimpleModal
          title={t(lang, "hr.l_issue_advance", "Issue Salary Advance / Loan")}
          onClose={() => setSelectedEmployeeForLoan(null)}
          className="max-w-3xl w-[95vw]"
        >
          <AdvanceLoanModal
            employee={selectedEmployeeForLoan}
            onClose={() => setSelectedEmployeeForLoan(null)}
            onSuccess={() => {
              setSelectedEmployeeForLoan(null);
              loadEmployees().catch(() => null);
            }}
          />
        </SimpleModal>
      )}

      {/* History Ledger Modal */}
      {selectedEmployeeForHistory && (
        <SimpleModal
          title={`${t(lang, "hr.l_statement_history", "Employee Statement Recovery History")} — ${selectedEmployeeForHistory?.person?.customer_name}`}
          onClose={() => setSelectedEmployeeForHistory(null)}
          className="max-w-5xl w-[95vw]"
        >
          <EmployeeLedgerPanel
            employeeId={selectedEmployeeForHistory.id}
          />
        </SimpleModal>
      )}

      {party360PersonId && (
        <Party360Modal
          customerId={party360PersonId}
          onClose={() => setParty360PersonId(null)}
        />
      )}

      <UniversalReportModal
        isOpen={showReport}
        onClose={() => setShowReport(false)}
        title={t(lang, "hr.report_title", "Employee Master Report")}
        subtitle={t(lang, "hr.report_subtitle", "Comprehensive Employee Registry — HR & Payroll Division")}
        exportFileName="employee_master_report"
        filters={[
          { label: t(lang, "common.search", "Search"), value: search || t(lang, "common.all", "All") },
          { label: t(lang, "common.category", "Category"), value: category || t(lang, "common.all", "All") },
          { label: t(lang, "common.status", "Status"), value: status || t(lang, "common.all", "All") }
        ]}
        columns={[
          { key: "employee_code", label: t(lang, "hr.employee_code_full", "Employee Code") },
          { key: "person_name", label: t(lang, "hr.person_customer_name", "Person / Customer Name") },
          { key: "category", label: t(lang, "common.category", "Category") },
          { key: "designation", label: t(lang, "cbs.designation_word", "Designation") },
          { key: "salary", label: t(lang, "hr.col_salary", "Salary"), align: "right", isNumeric: true },
          { key: "status", label: t(lang, "common.status", "Status"), align: "center" },
          { key: "join_date", label: t(lang, "hr.col_join_date", "Join Date") }
        ]}
        data={employees.map(e => ({
          employee_code: e.employee_code || "-",
          person_name: e.person?.customer_name || "-",
          category: e.category || "-",
          designation: e.designation || "-",
          salary: e.salary ?? 0,
          status: e.status || "Active",
          join_date: e.join_date ? new Date(e.join_date).toLocaleDateString() : "-"
        }))}
      />
    </div>
  );
}
