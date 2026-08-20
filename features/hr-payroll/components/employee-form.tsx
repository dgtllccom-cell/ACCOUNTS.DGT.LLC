"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  Printer,
  FileText,
  Building2,
  MapPin,
  Calendar,
  BadgeDollarSign,
  Clock,
  ShieldCheck,
  Layers,
  Sparkles,
  UserPlus,
  Phone,
  Mail
} from "lucide-react";
import { apiGet, apiPost, apiPatch } from "@/lib/api/client";
import { PersonPicker } from "./person-picker";
import { Button } from "@/components/ui/button";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { t } from "@/lib/i18n/ui";
import { openMasterProfileReportWindow } from "@/lib/reports/open-master-profile-report-window";

type EmployeeFormProps = {
  employeeId?: string | null;
  /** Called after a successful create/update. `newEmployeeId` is the created/updated
   * employee's id — callers that embed this form to pick-and-create-on-the-fly (e.g. the
   * User Registration wizard) use it to auto-select the new row without a second lookup. */
  onSave: (newEmployeeId?: string) => void;
  onCancel: () => void;
  /** Active language from the host page. When this form is rendered inside a modal, the shared
   * useActiveLanguage() store can lag behind the page's resolved language, so hosts that already
   * know the language pass it here; we reconcile (prefer a non-"en" explicit value). */
  lang?: SupportedLanguage;
};

type LedgerOption = {
  id: string;
  name: string;
  code: string;
  currency: string;
};

type CountryOption = {
  id: string;
  name: string;
  currency_code: string;
};

type BranchOption = {
  id: string;
  name: string;
  code: string;
  country_branch_id?: string | null;
};

export function EmployeeForm({ employeeId, onSave, onCancel, lang: langProp }: EmployeeFormProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeStep, setActiveStep] = useState<number>(1);

  // Core fields
  const [personMasterId, setPersonMasterId] = useState("");
  // Structured person identity (item 4). Populated from the selected person master, editable here,
  // and synced back to the person master (customers) on save. Full name is derived from these.
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [gender, setGender] = useState("");
  const [category, setCategory] = useState<"Manager" | "Normal Staff" | "Employee" | "Others">("Employee");
  const [designation, setDesignation] = useState("");
  const [department, setDepartment] = useState("");

  // Location scopes
  const [countryId, setCountryId] = useState("");
  const [countryBranchId, setCountryBranchId] = useState("");
  const [cityBranchId, setCityBranchId] = useState("");
  const [reportingManagerId, setReportingManagerId] = useState("");

  // Timelines
  const [joiningDate, setJoiningDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [probationStartDate, setProbationStartDate] = useState("");
  const [probationEndDate, setProbationEndDate] = useState("");
  const [employmentType, setEmploymentType] = useState("Full-time");
  const [jobStatus, setJobStatus] = useState("Probation");
  const [workingShift, setWorkingShift] = useState("Day Shift");
  const [dutyStartTime, setDutyStartTime] = useState("09:00");
  const [dutyEndTime, setDutyEndTime] = useState("18:00");
  const [weeklyOffDay, setWeeklyOffDay] = useState("Sunday");
  const [contractStartDate, setContractStartDate] = useState("");
  const [contractEndDate, setContractEndDate] = useState("");
  const [status, setStatus] = useState("Active");

  // Salary components
  const [salaryType, setSalaryType] = useState("Monthly");
  const [basicSalary, setBasicSalary] = useState<number>(0);
  const [salaryCurrency, setSalaryCurrency] = useState("USD");
  const [accommodationAllowance, setAccommodationAllowance] = useState<number>(0);
  const [transportAllowance, setTransportAllowance] = useState<number>(0);
  const [foodAllowance, setFoodAllowance] = useState<number>(0);
  const [mobileAllowance, setMobileAllowance] = useState<number>(0);
  const [otherAllowance, setOtherAllowance] = useState<number>(0);
  const [deduction, setDeduction] = useState<number>(0);
  const [taxDeduction, setTaxDeduction] = useState<number>(0);

  // Account integration links
  const [salaryExpenseAccountId, setSalaryExpenseAccountId] = useState("");
  const [employeePayableAccountId, setEmployeePayableAccountId] = useState("");
  const [cashAccountId, setCashAccountId] = useState("");
  const [bankAccountId, setBankAccountId] = useState("");
  const [advanceSalaryAccountId, setAdvanceSalaryAccountId] = useState("");
  const [loanAccountId, setLoanAccountId] = useState("");
  const [deductionAccountId, setDeductionAccountId] = useState("");

  // Select Options Lists
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [cityBranches, setCityBranches] = useState<BranchOption[]>([]);
  const [managers, setManagers] = useState<any[]>([]);
  const [ledgers, setLedgers] = useState<LedgerOption[]>([]);
  const [personsList, setPersonsList] = useState<any[]>([]);

  // Load select lists
  useEffect(() => {
    async function loadSelectData() {
      try {
        const countriesRes = await apiGet<{ countries: any[] }>("/api/erp/locations/countries");
        setCountries(countriesRes.countries || []);

        const managersRes = await apiGet<{ employees: any[] }>("/api/erp/hr-payroll/employees?category=Manager");
        setManagers(managersRes.employees || []);

        const ledgersRes = await apiGet<{ ledgers: any[] }>("/api/erp/ledgers");
        setLedgers(ledgersRes.ledgers || []);

        const personsRes = await apiGet<{ customers: any[] }>("/api/erp/customers?type=person");
        if (personsRes && personsRes.customers) {
          setPersonsList(personsRes.customers);
        }
      } catch (err) {
        console.error(err);
      }
    }
    loadSelectData();
  }, []);

  // Fetch branches when country changes
  useEffect(() => {
    if (!countryId) {
      setBranches([]);
      setCountryBranchId("");
      setCityBranches([]);
      setCityBranchId("");
      return;
    }
    async function loadBranches() {
      try {
        const res = await apiGet<{ ok: boolean; data: { branches: any[] } }>(`/api/erp/locations/branches/main?countryId=${countryId}`);
        if (res.ok && res.data?.branches) {
          const list = res.data.branches;
          setBranches(list);
          if (list.length > 0) {
            setCountryBranchId((prev) => (list.some((b) => b.id === prev) ? prev : list[0].id));
          } else {
            setCountryBranchId("");
          }
        }
      } catch (err) {
        console.error(err);
      }
    }
    loadBranches();
  }, [countryId]);

  // Fetch city branches when country or main branch changes
  useEffect(() => {
    if (!countryId) {
      setCityBranches([]);
      setCityBranchId("");
      return;
    }
    async function loadCityBranches() {
      try {
        const url = `/api/erp/locations/branches/city?countryId=${countryId}${countryBranchId ? `&countryBranchId=${countryBranchId}` : ""}`;
        const res = await apiGet<{ ok: boolean; data: { cityBranches: any[] } }>(url);
        if (res.ok && res.data?.cityBranches) {
          const list = res.data.cityBranches;
          setCityBranches(list);
          if (list.length > 0) {
            setCityBranchId((prev) => (list.some((cb) => cb.id === prev) ? prev : list[0].id));
          } else {
            setCityBranchId("");
          }
        }
      } catch (err) {
        console.error(err);
      }
    }
    loadCityBranches();
  }, [countryId, countryBranchId]);

  // Auto-sync countryBranchId if a city branch with parent branch is selected
  useEffect(() => {
    if (cityBranchId && cityBranches.length > 0) {
      const selectedCb = cityBranches.find((cb) => cb.id === cityBranchId);
      if (selectedCb?.country_branch_id && selectedCb.country_branch_id !== countryBranchId) {
        setCountryBranchId(selectedCb.country_branch_id);
      }
    }
  }, [cityBranchId, cityBranches, countryBranchId]);

  // Fetch employee details if editing
  useEffect(() => {
    if (!employeeId) return;
    async function loadEmployee() {
      setLoading(true);
      try {
        const res = await apiGet<{ employee: any }>(`/api/erp/hr-payroll/employees/${employeeId}`);
        if (res.employee) {
          const emp = res.employee;
          setPersonMasterId(emp.person_master_id);
          setCategory(emp.category || "Employee");
          setDesignation(emp.designation || "");
          setDepartment(emp.department || "");
          setCountryId(emp.country_id || "");
          setCountryBranchId(emp.country_branch_id || "");
          setCityBranchId(emp.city_branch_id || "");
          setReportingManagerId(emp.reporting_manager_id || "");
          setJoiningDate(emp.joining_date || "");
          setProbationStartDate(emp.probation_start_date || "");
          setProbationEndDate(emp.probation_end_date || "");
          setEmploymentType(emp.employment_type || "Full-time");
          setJobStatus(emp.job_status || "Probation");
          setWorkingShift(emp.working_shift || "Day Shift");
          setDutyStartTime(emp.duty_start_time || "09:00");
          setDutyEndTime(emp.duty_end_time || "18:00");
          setWeeklyOffDay(emp.weekly_off_day || "Sunday");
          setContractStartDate(emp.contract_start_date || "");
          setContractEndDate(emp.contract_end_date || "");
          setStatus(emp.status || "Active");

          setSalaryType(emp.salary_type || "Monthly");
          setBasicSalary(emp.basic_salary || emp.monthly_salary || 0);
          setSalaryCurrency(emp.salary_currency || "USD");
          setAccommodationAllowance(emp.accommodation_allowance || 0);
          setTransportAllowance(emp.transport_allowance || 0);
          setFoodAllowance(emp.food_allowance || 0);
          setMobileAllowance(emp.mobile_allowance || 0);
          setOtherAllowance(emp.other_allowance || 0);
          setDeduction(emp.deduction || 0);
          setTaxDeduction(emp.tax_deduction || 0);

          setSalaryExpenseAccountId(emp.salary_expense_account_id || "");
          setEmployeePayableAccountId(emp.employee_payable_account_id || "");
          setCashAccountId(emp.cash_account_id || "");
          setBankAccountId(emp.bank_account_id || "");
          setAdvanceSalaryAccountId(emp.advance_salary_account_id || "");
          setLoanAccountId(emp.loan_account_id || "");
          setDeductionAccountId(emp.deduction_account_id || "");
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadEmployee();
  }, [employeeId]);

  // Calculations
  const totalAllowances = Number(accommodationAllowance) + Number(transportAllowance) + Number(foodAllowance) + Number(mobileAllowance) + Number(otherAllowance);
  const netSalary = Math.max(0, Number(basicSalary) + totalAllowances - Number(deduction) - Number(taxDeduction));

  const selectedPersonObj = useMemo(() => personsList.find((p) => p.id === personMasterId) ?? null, [personsList, personMasterId]);
  const selectedCountryObj = useMemo(() => countries.find((c) => c.id === countryId) ?? null, [countries, countryId]);
  const selectedMainBranchObj = useMemo(() => branches.find((b) => b.id === countryBranchId) ?? null, [branches, countryBranchId]);
  const selectedCityBranchObj = useMemo(() => cityBranches.find((b) => b.id === cityBranchId) ?? null, [cityBranches, cityBranchId]);
  const selectedManagerObj = useMemo(() => managers.find((m) => m.id === reportingManagerId) ?? null, [managers, reportingManagerId]);

  // When the selected person changes, load their structured identity from the master; clear when
  // deselected so no stale values from a previously selected person are ever retained (item 5).
  useEffect(() => {
    if (!selectedPersonObj) { setFirstName(""); setLastName(""); setGender(""); return; }
    setFirstName(selectedPersonObj.first_name || "");
    setLastName(selectedPersonObj.last_name || "");
    setGender(selectedPersonObj.gender || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPersonObj?.id]);

  // Full name is always derived from the structured fields, falling back to the stored display name.
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim() || (selectedPersonObj?.customer_name || "");

  async function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!personMasterId) {
      alert("Please select or add an Employee / Person Name first.");
      setActiveStep(1);
      return;
    }

    setSaving(true);
    const payload = {
      personMasterId,
      category,
      designation,
      department,
      countryId,
      countryBranchId,
      cityBranchId,
      reportingManagerId,
      joiningDate,
      probationStartDate,
      probationEndDate,
      employmentType,
      jobStatus,
      workingShift,
      dutyStartTime,
      dutyEndTime,
      weeklyOffDay,
      contractStartDate,
      contractEndDate,
      status,

      salaryType,
      basicSalary,
      salaryCurrency,
      monthlySalary: salaryType === "Monthly" ? basicSalary : 0,
      dailySalary: salaryType === "Daily" ? basicSalary : 0,
      hourlySalary: salaryType === "Hourly" ? basicSalary : 0,
      allowance: totalAllowances,
      accommodationAllowance,
      transportAllowance,
      foodAllowance,
      mobileAllowance,
      otherAllowance,
      deduction,
      taxDeduction,
      netSalary,
      salaryStartDate: joiningDate,
      salaryPaymentMethod: bankAccountId ? "Bank" : "Cash",
      salarySchedule: "Monthly",

      salaryExpenseAccountId,
      employeePayableAccountId,
      cashAccountId,
      bankAccountId,
      advanceSalaryAccountId,
      loanAccountId,
      deductionAccountId
    };

    try {
      // Persist the structured identity back to the person master (customers) so First/Last/Full
      // Name stay canonical and synced across the selector, wizard, table and Print/PDF (item 4).
      const personCountryId = selectedPersonObj?.country_id || countryId;
      if (personMasterId && personCountryId && (firstName.trim() || lastName.trim())) {
        try {
          await apiPatch(`/api/erp/customers/${personMasterId}`, {
            countryId: personCountryId,
            customerName: fullName,
            firstName: firstName.trim() || null,
            lastName: lastName.trim() || null,
            gender: gender || null
          });
        } catch { /* non-fatal — the employee still saves even if the master sync fails */ }
      }

      let savedId = employeeId ?? undefined;
      if (employeeId) {
        await apiPatch(`/api/erp/hr-payroll/employees/${employeeId}`, payload);
      } else {
        const result = await apiPost<{ employee?: { id?: string } }>("/api/erp/hr-payroll/employees", payload);
        savedId = result?.employee?.id;
      }
      onSave(savedId);
    } catch (err: any) {
      alert("Error saving employee profile: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  // NOTE: hooks must run unconditionally — keep this above the `loading` early return.
  const activeLang = useActiveLanguage();
  // Prefer an explicit non-"en" language from the host; otherwise follow the reactive store.
  const lang = (langProp && langProp !== "en") ? langProp : activeLang;
  // Central-dictionary labels only — no per-component machine translation.
  const CAT_KEYS: Record<string, string> = { "Manager": "hr.f_cat_manager", "Normal Staff": "hr.f_cat_normal_staff", "Employee": "hr.f_cat_employee", "Others": "hr.f_cat_others" };
  const catLabel = (c: string) => t(lang, (CAT_KEYS[c] || "hr.f_cat_employee") as never, c);

  // A4 Employee Master Profile Print/PDF via the shared master-profile engine (item 10).
  function printProfile() {
    const dash = "-";
    const cur = salaryCurrency;
    openMasterProfileReportWindow({
      lang,
      title: t(lang, "hr.f_master_report_card", "Employee Master Profile"),
      subtitle: fullName || t(lang, "hr.f_cat_employee", "Employee"),
      reportTypeLabel: catLabel(category),
      meta: [
        { label: t(lang, "hr.f_full_name", "Full Name"), value: fullName },
        { label: t(lang, "rozrep.country", "Country"), value: selectedCountryObj?.name },
        { label: t(lang, "hr.f_main_branch", "Main Branch"), value: selectedMainBranchObj?.name },
        { label: t(lang, "hr.f_joining_date", "Joining Date"), value: joiningDate }
      ],
      kpis: [
        { label: t(lang, "hr.f_basic_salary", "Basic Salary"), value: `${Number(basicSalary).toLocaleString()} ${cur}`, tone: "current" },
        { label: t(lang, "hr.f_total_allowances", "Total Allowances"), value: `${totalAllowances.toLocaleString()} ${cur}`, tone: "credit" },
        { label: t(lang, "hr.f_deductions", "Deductions"), value: `${(Number(deduction) + Number(taxDeduction)).toLocaleString()} ${cur}`, tone: "debit" },
        { label: t(lang, "hr.f_net_salary", "Net Salary"), value: `${netSalary.toLocaleString()} ${cur}`, tone: "open" }
      ],
      sections: [
        { title: t(lang, "hr.f_sec_identity", "Identity & Contact"), rows: [
          { label: t(lang, "hr.f_first_name", "First Name"), value: firstName || dash },
          { label: t(lang, "hr.f_last_name", "Last Name"), value: lastName || dash },
          { label: t(lang, "hr.f_full_name", "Full Name"), value: fullName || dash },
          { label: t(lang, "hr.f_gender", "Gender"), value: gender || dash },
          { label: t(lang, "hr.pp_mobile_phone", "Mobile Phone"), value: selectedPersonObj?.mobile || dash },
          { label: t(lang, "sed.f_whatsapp", "WhatsApp"), value: selectedPersonObj?.whatsapp || dash },
          { label: t(lang, "hr.pp_email_address", "Email"), value: selectedPersonObj?.email || dash },
          { label: t(lang, "hr.pp_address_location", "Address"), value: selectedPersonObj?.address || dash }
        ] },
        { title: t(lang, "hr.f_sec_employment", "Employment & Designation"), rows: [
          { label: t(lang, "hr.f_lbl_category", "Category"), value: catLabel(category) },
          { label: t(lang, "hr.f_lbl_designation_short", "Designation"), value: designation || dash },
          { label: t(lang, "hr.f_lbl_department", "Department"), value: department || dash },
          { label: t(lang, "hr.f_employment_type", "Employment Type"), value: employmentType || dash },
          { label: t(lang, "hr.f_job_status", "Job Status"), value: jobStatus || dash }
        ] },
        { title: t(lang, "hr.f_sec_location", "Country / Branches"), rows: [
          { label: t(lang, "rozrep.country", "Country"), value: selectedCountryObj?.name || dash },
          { label: t(lang, "hr.f_main_branch", "Main Branch"), value: selectedMainBranchObj?.name || dash },
          { label: t(lang, "hr.f_city_branch", "City Branch"), value: selectedCityBranchObj?.name || dash }
        ] },
        { title: t(lang, "hr.f_sec_shift", "Shift & Attendance"), rows: [
          { label: t(lang, "hr.f_working_shift", "Working Shift"), value: workingShift || dash },
          { label: t(lang, "hr.f_duty_hours", "Duty Hours"), value: (dutyStartTime && dutyEndTime) ? `${dutyStartTime} – ${dutyEndTime}` : dash },
          { label: t(lang, "hr.f_weekly_off", "Weekly Off"), value: weeklyOffDay || dash },
          { label: t(lang, "hr.f_joining_date", "Joining Date"), value: joiningDate || dash }
        ] },
        { title: t(lang, "hr.f_sec_payroll", "Salary & Payroll"), rows: [
          { label: t(lang, "hr.f_salary_type", "Salary Type"), value: salaryType || dash },
          { label: t(lang, "hr.f_basic_salary", "Basic Salary"), value: `${Number(basicSalary).toLocaleString()} ${cur}` },
          { label: t(lang, "hr.f_total_allowances", "Total Allowances"), value: `${totalAllowances.toLocaleString()} ${cur}` },
          { label: t(lang, "hr.f_net_salary", "Net Salary"), value: `${netSalary.toLocaleString()} ${cur}` },
          { label: t(lang, "hr.f_currency", "Currency"), value: cur }
        ] },
        { title: t(lang, "hr.f_sec_status", "Status & Audit"), rows: [
          { label: t(lang, "hr.f_status", "Status"), value: status || dash },
          { label: t(lang, "hr.f_job_status", "Job Status"), value: jobStatus || dash }
        ] }
      ]
    });
  }

  if (loading) {
    return <div className="text-center py-12 text-slate-500 dark:text-slate-400 font-medium">{t(lang, "hr.f_loading_details", "Loading employee details...")}</div>;
  }

  const stepsList = [
    { number: 1, label: t(lang, "hr.f_step_lbl_1", "Step 1: Category & Identity"), icon: <UserCheck className="h-4 w-4" /> },
    { number: 2, label: t(lang, "hr.f_step_lbl_2", "Step 2: Location & Scopes"), icon: <MapPin className="h-4 w-4" /> },
    { number: 3, label: t(lang, "hr.f_step_lbl_3", "Step 3: Timelines & Shift"), icon: <Clock className="h-4 w-4" /> },
    { number: 4, label: t(lang, "hr.f_step_lbl_4", "Step 4: Salary & Accounts"), icon: <BadgeDollarSign className="h-4 w-4" /> },
    { number: 5, label: t(lang, "hr.f_step_lbl_5", "Step 5: Entry Verification Report"), icon: <FileText className="h-4 w-4" /> }
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-card text-card-foreground p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
      
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
            <Sparkles className="h-4 w-4 text-emerald-600" />
            <span>{t(lang, "hr.f_wizard_title", "Enterprise Employee Registration Wizard")}</span>
          </div>
          <h2 className="text-xl font-black text-slate-900 dark:text-slate-100">
            {employeeId ? t(lang, "hr.f_edit_title", "Edit Employee Master Setup") : t(lang, "hr.f_register_title", "Register New Employee Master Record")}
          </h2>
        </div>

        {selectedPersonObj && (
          <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800">
            {(fullName || t(lang, "hr.f_cat_employee", "Employee"))} ({catLabel(category)})
          </span>
        )}
      </div>

      {/* 5-Step Packets Bar */}
      <div className="grid gap-2 sm:grid-cols-5">
        {stepsList.map((s) => {
          const isActive = activeStep === s.number;
          const isDone = activeStep > s.number;

          return (
            <button
              key={s.number}
              type="button"
              onClick={() => setActiveStep(s.number)}
              className={`flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition-all ${
                isActive
                  ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shadow-sm ring-1 ring-emerald-500/30"
                  : isDone
                  ? "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-slate-700 dark:text-slate-300"
                  : "border-slate-200 dark:border-slate-800 bg-card text-slate-500 hover:border-slate-300"
              }`}
            >
              <div
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs font-bold transition-colors ${
                  isActive
                    ? "bg-emerald-600 text-white"
                    : isDone
                    ? "bg-slate-900 text-emerald-400 dark:bg-slate-800"
                    : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                }`}
              >
                {isDone ? <Check className="h-3.5 w-3.5" /> : s.number}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-bold">{s.label}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* STEP 1 PACKET: Category & Identity */}
      {activeStep === 1 && (
        <div className="space-y-5">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-emerald-600" />
              <span>{t(lang, "hr.f_step1_title", "Step 1 Packet: Employee Category & Person Selection")}</span>
            </h3>
            <span className="text-xs font-semibold text-slate-400">{t(lang, "hr.f_step1_of5", "Step 1 of 5")}</span>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-2">
              {t(lang, "hr.f_select_category", "Select Employee Category *")}
            </label>
            <div className="grid grid-cols-4 gap-2 bg-slate-100 dark:bg-slate-950 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800">
              {(["Manager", "Normal Staff", "Employee", "Others"] as const).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`py-2.5 rounded-lg text-xs font-bold transition-all ${
                    category === cat
                      ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm border border-slate-200 dark:border-slate-700"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-900"
                  }`}
                >
                  {catLabel(cat)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <PersonPicker
              label={t(lang, "hr.f_select_person", "Select or Add Employee / Person Master Name *")}
              value={personMasterId}
              onValueChange={setPersonMasterId}
              countryId={countryId}
              lang={lang}
            />
          </div>

          {/* Selected Employee Master Profile card — confirm the selected person at a glance (item 6). */}
          {selectedPersonObj ? (
            <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50/40 dark:bg-emerald-950/20 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white text-base font-black uppercase">
                    {(fullName || "?").trim().charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">{t(lang, "hr.f_selected_profile", "Selected Employee Master Profile")}</div>
                    <div className="truncate text-sm font-black text-slate-900 dark:text-slate-100">{fullName}</div>
                    <div className="truncate text-[11px] text-slate-500">{selectedPersonObj.company_name || t(lang, "hr.pp_independent", "Independent Account")} · {catLabel(category)}</div>
                  </div>
                </div>
                <div className="flex flex-shrink-0 items-center gap-2">
                  <button type="button" onClick={() => setPersonMasterId("")} className="rounded-lg border border-slate-300 dark:border-slate-700 px-2.5 py-1 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800">
                    {t(lang, "hr.f_change_selection", "Change / Clear Selection")}
                  </button>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
                {[
                  [t(lang, "hr.pp_contact_person", "Contact Person"), selectedPersonObj.contact_person],
                  [t(lang, "hr.pp_mobile_phone", "Mobile Phone"), selectedPersonObj.mobile],
                  [t(lang, "sed.f_whatsapp", "WhatsApp"), selectedPersonObj.whatsapp],
                  [t(lang, "hr.pp_email_address", "Email Address"), selectedPersonObj.email],
                  [t(lang, "hr.pp_address_location", "Address / Location"), selectedPersonObj.address]
                ].map(([lbl, v], i) => (
                  <div key={i} className="min-w-0">
                    <div className="text-[9px] font-bold uppercase tracking-wide text-slate-400">{lbl}</div>
                    <div className="truncate text-xs font-semibold text-slate-800 dark:text-slate-200">{v || "-"}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-3 text-[11px] text-slate-400">
              {t(lang, "hr.f_no_person_selected", "No person selected yet — search and select a Person / Employee Master above.")}
            </div>
          )}

          {/* Structured identity (item 4): First / Last are independent fields; Full Name is derived. */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">{t(lang, "hr.f_first_name", "First Name *")}</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder={t(lang, "hr.f_ph_first_name", "e.g. Ahmad")}
                className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">{t(lang, "hr.f_last_name", "Surname / Last Name *")}</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder={t(lang, "hr.f_ph_last_name", "e.g. Khan")}
                className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">{t(lang, "hr.f_gender", "Gender")}</label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-2 text-xs font-medium text-slate-900 dark:text-slate-100"
              >
                <option value="">{t(lang, "hr.f_gender_select", "Select…")}</option>
                <option value="Male">{t(lang, "hr.f_gender_male", "Male")}</option>
                <option value="Female">{t(lang, "hr.f_gender_female", "Female")}</option>
                <option value="Other">{t(lang, "hr.f_gender_other", "Other")}</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">{t(lang, "hr.f_full_name", "Full Name")}</label>
            <div className="w-full rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 px-3.5 py-2 text-xs font-black text-slate-800 dark:text-slate-100">
              {fullName || "-"}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">{t(lang, "hr.f_lbl_designation", "Designation / Position *")}</label>
              <input
                type="text"
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                placeholder={t(lang, "hr.f_ph_designation", "e.g. Finance Manager / General Staff")}
                className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">{t(lang, "hr.f_lbl_department", "Department *")}</label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder={t(lang, "hr.f_ph_department", "e.g. Accounts / Operations")}
                className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          {/* Packet Summary Box */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs space-y-1.5">
            <div className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">{t(lang, "hr.f_step1_preview", "STEP 1 PACKET PREVIEW")}</div>
            <div className="grid grid-cols-3 gap-2">
              <div><span className="font-semibold text-slate-400">{t(lang, "hr.f_lbl_category", "Category:")}</span> {catLabel(category)}</div>
              <div><span className="font-semibold text-slate-400">{t(lang, "hr.f_lbl_name", "Name:")}</span> {fullName || t(lang, "hr.f_not_selected", "Not Selected")}</div>
              <div><span className="font-semibold text-slate-400">{t(lang, "hr.f_lbl_designation_short", "Designation:")}</span> {designation || "-"}</div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2 PACKET: Location & Branch Scopes */}
      {activeStep === 2 && (
        <div className="space-y-5">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <MapPin className="h-4 w-4 text-emerald-600" />
              <span>{t(lang, "hr.f_step2_title", "Step 2 Packet: Country, Branch Scopes & Reporting Manager")}</span>
            </h3>
            <span className="text-xs font-semibold text-slate-400">{t(lang, "hr.f_step2_of5", "Step 2 of 5")}</span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">{t(lang, "common.country", "Country")} *</label>
              <select
                value={countryId}
                onChange={(e) => setCountryId(e.target.value)}
                className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-2 text-xs font-medium text-slate-900 dark:text-slate-100"
              >
                <option value="">{t(lang, "hr.f_select_country", "Select Country")}</option>
                {countries.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">{t(lang, "hr.f_main_branch", "Main Branch")}</label>
              <select
                value={countryBranchId}
                onChange={(e) => setCountryBranchId(e.target.value)}
                disabled={!countryId}
                className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-2 text-xs font-medium text-slate-900 dark:text-slate-100 disabled:opacity-40"
              >
                <option value="">{t(lang, "hr.f_select_main_branch", "Select Main Branch")}</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} {b.code ? `(${b.code})` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">{t(lang, "hr.f_city_branch", "City Branch")}</label>
              <select
                value={cityBranchId}
                onChange={(e) => setCityBranchId(e.target.value)}
                disabled={!countryId}
                className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-2 text-xs font-medium text-slate-900 dark:text-slate-100 disabled:opacity-40"
              >
                <option value="">{t(lang, "hr.f_select_city_branch", "Select City Branch")}</option>
                {cityBranches.map((cb) => (
                  <option key={cb.id} value={cb.id}>
                    {cb.name} {cb.code ? `(${cb.code})` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {category !== "Manager" && (
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">{t(lang, "hr.f_reporting_manager", "Reporting Manager")}</label>
              <select
                value={reportingManagerId}
                onChange={(e) => setReportingManagerId(e.target.value)}
                className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-2 text-xs font-medium text-slate-900 dark:text-slate-100"
              >
                <option value="">{t(lang, "hr.f_select_manager", "Select Manager")}</option>
                {managers.map((m) => (
                  <option key={m.id} value={m.id}>{m.person?.customer_name} ({m.employee_code})</option>
                ))}
              </select>
            </div>
          )}

          {/* Packet Summary Box */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs space-y-1.5">
            <div className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">{t(lang, "hr.f_step2_preview", "Step 2 Packet Preview")}</div>
            <div className="grid grid-cols-3 gap-2">
              <div><span className="font-semibold text-slate-400">{t(lang, "common.country", "Country")}:</span> {selectedCountryObj?.name || "-"}</div>
              <div>
                <span className="font-semibold text-slate-400">{t(lang, "hr.f_main_branch", "Main Branch")}:</span>{" "}
                {selectedMainBranchObj ? `${selectedMainBranchObj.name} ${selectedMainBranchObj.code ? `(${selectedMainBranchObj.code})` : ""}` : "-"}
              </div>
              <div>
                <span className="font-semibold text-slate-400">{t(lang, "hr.f_city_branch", "City Branch")}:</span>{" "}
                {selectedCityBranchObj ? `${selectedCityBranchObj.name} ${selectedCityBranchObj.code ? `(${selectedCityBranchObj.code})` : ""}` : "-"}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3 PACKET: Timelines, Duty Shift & Contract */}
      {activeStep === 3 && (
        <div className="space-y-5">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Clock className="h-4 w-4 text-emerald-600" />
              <span>{t(lang, "hr.f_step3_title", "Step 3 Packet: Employment Type, Shift & Contract Timelines")}</span>
            </h3>
            <span className="text-xs font-semibold text-slate-400">{t(lang, "hr.f_step3_of5", "Step 3 of 5")}</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">{t(lang, "hr.f_joining_date", "Joining Date")} *</label>
              <input
                type="date"
                value={joiningDate}
                onChange={(e) => setJoiningDate(e.target.value)}
                className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">{t(lang, "hr.f_employment_type", "Employment Type")}</label>
              <select
                value={employmentType}
                onChange={(e) => setEmploymentType(e.target.value)}
                className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-2 text-xs font-medium text-slate-900 dark:text-slate-100"
              >
                <option value="Full-time">{t(lang, "hr.f_full_time", "Full-time")}</option>
                <option value="Part-time">{t(lang, "hr.f_part_time", "Part-time")}</option>
                <option value="Contract">{t(lang, "hr.f_contract", "Contract")}</option>
                <option value="Internship">{t(lang, "hr.f_internship", "Internship")}</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">{t(lang, "hr.f_duty_shift", "Duty Shift")}</label>
              <input
                type="text"
                value={workingShift}
                onChange={(e) => setWorkingShift(e.target.value)}
                placeholder={t(lang, "hr.f_ph_day_shift", "Day Shift")}
                className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">{t(lang, "hr.f_duty_start", "Duty Start Time")}</label>
              <input
                type="time"
                value={dutyStartTime}
                onChange={(e) => setDutyStartTime(e.target.value)}
                className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">{t(lang, "hr.f_duty_end", "Duty End Time")}</label>
              <input
                type="time"
                value={dutyEndTime}
                onChange={(e) => setDutyEndTime(e.target.value)}
                className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          {/* Conditional Timelines */}
          {(category === "Normal Staff" || category === "Employee") && (
            <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">{t(lang, "hr.f_probation_start", "Probation Start Date")}</label>
                <input
                  type="date"
                  value={probationStartDate}
                  onChange={(e) => setProbationStartDate(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">{t(lang, "hr.f_probation_end", "Probation End Date")}</label>
                <input
                  type="date"
                  value={probationEndDate}
                  onChange={(e) => setProbationEndDate(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>
          )}

          {(category === "Employee" || category === "Others") && (
            <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">{t(lang, "hr.f_contract_start", "Contract Start Date")}</label>
                <input
                  type="date"
                  value={contractStartDate}
                  onChange={(e) => setContractStartDate(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">{t(lang, "hr.f_contract_end", "Contract End Date")}</label>
                <input
                  type="date"
                  value={contractEndDate}
                  onChange={(e) => setContractEndDate(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>
          )}

          {/* Packet Summary Box */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs space-y-1.5">
            <div className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">{t(lang, "hr.f_step3_preview", "Step 3 Packet Preview")}</div>
            <div className="grid grid-cols-3 gap-2">
              <div><span className="font-semibold text-slate-400">{t(lang, "hr.f_joining_date", "Joining Date")}:</span> {joiningDate || "-"}</div>
              <div><span className="font-semibold text-slate-400">{t(lang, "hr.f_type", "Type")}:</span> {employmentType}</div>
              <div><span className="font-semibold text-slate-400">{t(lang, "hr.f_shift", "Shift")}:</span> {workingShift} ({dutyStartTime} - {dutyEndTime})</div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 4 PACKET: Salary Details & Account Mapping */}
      {activeStep === 4 && (
        <div className="space-y-5">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <BadgeDollarSign className="h-4 w-4 text-emerald-600" />
              <span>{t(lang, "hr.f_step4_title", "Step 4 Packet: Basic Salary, Allowances & GL Ledgers")}</span>
            </h3>
            <span className="text-xs font-semibold text-slate-400">{t(lang, "hr.f_step4_of5", "Step 4 of 5")}</span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">{t(lang, "hr.f_salary_basis", "Salary Basis")}</label>
              <select
                value={salaryType}
                onChange={(e) => setSalaryType(e.target.value)}
                className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-2 text-xs font-medium text-slate-900 dark:text-slate-100"
              >
                <option value="Monthly">{t(lang, "hr.f_monthly", "Monthly")}</option>
                <option value="Daily">{t(lang, "hr.f_daily", "Daily")}</option>
                <option value="Hourly">{t(lang, "hr.f_hourly", "Hourly")}</option>
                <option value="Custom">{t(lang, "hr.f_custom", "Custom")}</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">{t(lang, "hr.f_basic_salary", "Basic Salary Rate")} ({salaryCurrency})</label>
              <div className="relative">
                <input
                  type="number"
                  value={basicSalary || ""}
                  onChange={(e) => setBasicSalary(Number(e.target.value))}
                  placeholder="0.00"
                  className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-3.5 pr-14 py-2 text-xs font-bold text-slate-900 dark:text-slate-100"
                />
                <span className="absolute right-3 top-2 text-xs font-bold text-slate-400">{salaryCurrency}</span>
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-2">{t(lang, "hr.f_monthly_allowances", "Monthly Allowances")}</label>
            <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">{t(lang, "hr.f_housing", "Housing")}</label>
                <input
                  type="number"
                  value={accommodationAllowance || ""}
                  onChange={(e) => setAccommodationAllowance(Number(e.target.value))}
                  placeholder="0"
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">{t(lang, "hr.f_transport", "Transport")}</label>
                <input
                  type="number"
                  value={transportAllowance || ""}
                  onChange={(e) => setTransportAllowance(Number(e.target.value))}
                  placeholder="0"
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">{t(lang, "hr.f_food", "Food")}</label>
                <input
                  type="number"
                  value={foodAllowance || ""}
                  onChange={(e) => setFoodAllowance(Number(e.target.value))}
                  placeholder="0"
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">{t(lang, "hr.f_mobile_utility", "Mobile / Utility")}</label>
                <input
                  type="number"
                  value={mobileAllowance || ""}
                  onChange={(e) => setMobileAllowance(Number(e.target.value))}
                  placeholder="0"
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">{t(lang, "hr.f_general_deduction", "General Monthly Deduction")}</label>
              <input
                type="number"
                value={deduction || ""}
                onChange={(e) => setDeduction(Number(e.target.value))}
                placeholder="0.00"
                className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">{t(lang, "hr.f_tax_social", "Tax / Social Security")}</label>
              <input
                type="number"
                value={taxDeduction || ""}
                onChange={(e) => setTaxDeduction(Number(e.target.value))}
                placeholder="0.00"
                className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block border-b border-slate-200 dark:border-slate-800 pb-1">
              {t(lang, "hr.f_gl_mapping", "General Ledger Accounts Mapping")}
            </label>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">{t(lang, "hr.f_salary_expense_acc", "Salary Expense Account")}</label>
                <select
                  value={salaryExpenseAccountId}
                  onChange={(e) => setSalaryExpenseAccountId(e.target.value)}
                  className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-2 text-xs text-slate-900 dark:text-slate-100"
                >
                  <option value="">{t(lang, "hr.f_select_ledger", "Select Ledger")}</option>
                  {ledgers.map((l) => (
                    <option key={l.id} value={l.id}>{l.code} - {l.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">{t(lang, "hr.f_payable_acc", "Employee Payable Account")}</label>
                <select
                  value={employeePayableAccountId}
                  onChange={(e) => setEmployeePayableAccountId(e.target.value)}
                  className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-2 text-xs text-slate-900 dark:text-slate-100"
                >
                  <option value="">{t(lang, "hr.f_select_ledger", "Select Ledger")}</option>
                  {ledgers.map((l) => (
                    <option key={l.id} value={l.id}>{l.code} - {l.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Packet Summary Box */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs space-y-1.5">
            <div className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">{t(lang, "hr.f_step4_preview", "Step 4 Packet Preview")}</div>
            <div className="grid grid-cols-3 gap-2">
              <div><span className="font-semibold text-slate-400">{t(lang, "hr.f_basic_salary", "Basic Salary")}:</span> {basicSalary} {salaryCurrency}</div>
              <div><span className="font-semibold text-slate-400">{t(lang, "hr.f_allowances", "Allowances")}:</span> +{totalAllowances}</div>
              <div><span className="font-semibold text-slate-400">{t(lang, "hr.f_net_payroll", "Net Payroll")}:</span> {netSalary.toLocaleString()} {salaryCurrency}</div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 5 PACKET: Entry Verification Report */}
      {activeStep === 5 && (
        <div className="space-y-5">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <FileText className="h-4 w-4 text-emerald-600" />
              <span>{t(lang, "hr.f_step5_title", "Step 5 Packet: Employee Master Entry Verification Report")}</span>
            </h3>
            <div className="flex items-center gap-2">
              <button type="button" onClick={printProfile} className="inline-flex items-center gap-1 rounded-lg border border-blue-300 dark:border-blue-800 px-2.5 py-1 text-xs font-bold text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/40">
                <Printer className="h-3.5 w-3.5" /> {t(lang, "bankroz.print_pdf", "Print / PDF")}
              </button>
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-2.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                {t(lang, "hr.f_verified_ready", "Verified & Ready")}
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-emerald-500/30 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white p-5 sm:p-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-400">{t(lang, "hr.f_master_report_card", "Employee Master Report Card")}</div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white">{fullName || "Employee Name"}</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">{designation || "Staff"} — {department || "General"}</p>
              </div>
              <div className="text-right">
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-600 text-white shadow-xs">
                  {catLabel(category)}
                </span>
              </div>
            </div>

            {/* Comprehensive sectioned review (item 7) — every value from the wizard's own state. */}
            {(() => {
              const dash = "-";
              const sections: Array<{ title: string; rows: Array<[string, string]> }> = [
                { title: t(lang, "hr.f_sec_identity", "Identity & Contact"), rows: [
                  [t(lang, "hr.f_lbl_name", "Name:"), fullName || dash],
                  [t(lang, "hr.f_first_name", "First Name"), firstName || dash],
                  [t(lang, "hr.f_last_name", "Last Name"), lastName || dash],
                  [t(lang, "hr.f_gender", "Gender"), gender || dash],
                  [t(lang, "hr.f_lbl_category", "Category:"), catLabel(category)],
                  [t(lang, "hr.pp_contact_person", "Contact Person"), selectedPersonObj?.contact_person || dash],
                  [t(lang, "hr.pp_mobile_phone", "Mobile Phone"), selectedPersonObj?.mobile || dash],
                  [t(lang, "sed.f_whatsapp", "WhatsApp"), selectedPersonObj?.whatsapp || dash],
                  [t(lang, "hr.pp_email_address", "Email Address"), selectedPersonObj?.email || dash],
                  [t(lang, "hr.pp_address_location", "Address / Location"), selectedPersonObj?.address || dash]
                ] },
                { title: t(lang, "hr.f_sec_employment", "Employment & Designation"), rows: [
                  [t(lang, "hr.f_lbl_designation_short", "Designation:"), designation || dash],
                  [t(lang, "hr.f_lbl_department", "Department *"), department || dash],
                  [t(lang, "hr.f_employment_type", "Employment Type"), employmentType || dash],
                  [t(lang, "hr.f_job_status", "Job Status"), jobStatus || dash],
                  [t(lang, "hr.f_reporting_manager", "Reporting Manager"), selectedManagerObj?.person?.customer_name || selectedManagerObj?.employee_code || dash]
                ] },
                { title: t(lang, "hr.f_sec_location", "Country / Main Branch / City Branch"), rows: [
                  [t(lang, "common.country", "Country"), selectedCountryObj?.name || dash],
                  [t(lang, "hr.f_main_branch", "Main Branch"), selectedMainBranchObj ? `${selectedMainBranchObj.name}${selectedMainBranchObj.code ? ` (${selectedMainBranchObj.code})` : ""}` : dash],
                  [t(lang, "hr.f_city_branch", "City Branch"), selectedCityBranchObj ? `${selectedCityBranchObj.name}${selectedCityBranchObj.code ? ` (${selectedCityBranchObj.code})` : ""}` : dash]
                ] },
                { title: t(lang, "hr.f_sec_shift", "Shift / Timings / Attendance"), rows: [
                  [t(lang, "hr.f_working_shift", "Working Shift"), workingShift || dash],
                  [t(lang, "hr.f_duty_hours", "Duty Hours"), (dutyStartTime && dutyEndTime) ? `${dutyStartTime} – ${dutyEndTime}` : dash],
                  [t(lang, "hr.f_weekly_off", "Weekly Off"), weeklyOffDay || dash],
                  [t(lang, "hr.f_joining_date", "Joining Date"), joiningDate || dash]
                ] },
                { title: t(lang, "hr.f_sec_payroll", "Salary / Payroll / Currency"), rows: [
                  [t(lang, "hr.f_salary_type", "Salary Type"), salaryType || dash],
                  [t(lang, "hr.f_basic_salary", "Basic Salary Rate"), `${Number(basicSalary).toLocaleString()} ${salaryCurrency}`],
                  [t(lang, "hr.f_total_allowances", "Total Allowances"), `${totalAllowances.toLocaleString()} ${salaryCurrency}`],
                  [t(lang, "hr.f_deductions", "Deductions"), `${(Number(deduction) + Number(taxDeduction)).toLocaleString()} ${salaryCurrency}`],
                  [t(lang, "hr.f_net_salary", "Net Salary"), `${netSalary.toLocaleString()} ${salaryCurrency}`],
                  [t(lang, "hr.f_currency", "Currency"), salaryCurrency || dash]
                ] },
                { title: t(lang, "hr.f_sec_status", "Status & Audit Information"), rows: [
                  [t(lang, "hr.f_status", "Status"), status || dash],
                  [t(lang, "hr.f_job_status", "Job Status"), jobStatus || dash]
                ] }
              ];
              return (
                <div className="grid gap-4 md:grid-cols-2">
                  {sections.map((sec, i) => (
                    <div key={i} className="rounded-xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 p-4 shadow-xs">
                      <div className="mb-2 border-b border-slate-100 dark:border-slate-700 pb-1.5 text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400">{sec.title}</div>
                      <div className="space-y-1.5">
                        {sec.rows.map(([lbl, val], j) => (
                          <div key={j} className="flex items-start justify-between gap-3 text-xs">
                            <span className="text-slate-500 dark:text-slate-400 font-medium">{lbl}</span>
                            <span className="text-end font-semibold text-slate-900 dark:text-white break-words">{val}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Footer Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
        <Button
          type="button"
          onClick={onCancel}
          variant="outline"
          className="text-xs font-semibold"
        >
          {t(lang, "common.cancel", "Cancel")}
        </Button>

        <div className="flex items-center gap-2">
          {activeStep > 1 && (
            <Button
              type="button"
              onClick={() => setActiveStep((s) => s - 1)}
              variant="outline"
              className="text-xs font-semibold gap-1"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>{t(lang, "common.previous_step", "Previous Step")}</span>
            </Button>
          )}

          {activeStep < 5 && (
            <Button
              type="button"
              onClick={() => setActiveStep((s) => s + 1)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-5 gap-1"
            >
              <span>{t(lang, "common.next_step", "Next Step")}</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}

          <Button
            type="submit"
            disabled={saving}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-6 shadow-sm gap-1.5"
          >
            <ShieldCheck className="h-4 w-4" />
            <span>{saving ? t(lang, "common.saving", "Saving...") : t(lang, "hr.f_save_finalize_employee", "Save & Finalize Employee")}</span>
          </Button>
        </div>
      </div>
    </form>
  );
}
