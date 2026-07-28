"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPost, apiPatch } from "@/lib/api/client";
import { PersonPicker } from "./person-picker";
import { Button } from "@/components/ui/button";

type EmployeeFormProps = {
  employeeId?: string | null;
  onSave: () => void;
  onCancel: () => void;
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
};

export function EmployeeForm({ employeeId, onSave, onCancel }: EmployeeFormProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Core fields
  const [personMasterId, setPersonMasterId] = useState("");
  const [category, setCategory] = useState<"Manager" | "Normal Staff" | "Employee" | "Others">("Employee");
  const [designation, setDesignation] = useState("");
  const [department, setDepartment] = useState("");
  
  // Location scopes
  const [countryId, setCountryId] = useState("");
  const [countryBranchId, setCountryBranchId] = useState("");
  const [cityBranchId, setCityBranchId] = useState("");
  const [reportingManagerId, setReportingManagerId] = useState("");
  
  // Timelines
  const [joiningDate, setJoiningDate] = useState("");
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
      return;
    }
    async function loadBranches() {
      try {
        const res = await apiGet<{ ok: boolean; data: { branches: any[] } }>(`/api/erp/locations/branches/main?countryId=${countryId}`);
        if (res.ok && res.data?.branches) {
          setBranches(res.data.branches);
        }
      } catch (err) {
        console.error(err);
      }
    }
    loadBranches();
  }, [countryId]);

  // Fetch city branches when main branch changes
  useEffect(() => {
    if (!countryBranchId) {
      setCityBranches([]);
      setCityBranchId("");
      return;
    }
    async function loadCityBranches() {
      try {
        const res = await apiGet<{ ok: boolean; data: { cityBranches: any[] } }>(`/api/erp/locations/branches/city?countryBranchId=${countryBranchId}`);
        if (res.ok && res.data?.cityBranches) {
          setCityBranches(res.data.cityBranches);
        }
      } catch (err) {
        console.error(err);
      }
    }
    loadCityBranches();
  }, [countryBranchId]);

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!personMasterId) {
      alert("Please select or add an Employee/Person Name first.");
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
      if (employeeId) {
        await apiPatch(`/api/erp/hr-payroll/employees/${employeeId}`, payload);
      } else {
        await apiPost("/api/erp/hr-payroll/employees", payload);
      }
      onSave();
    } catch (err: any) {
      alert("Error saving employee profile: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="text-center py-12 text-slate-500 dark:text-slate-400 font-medium">Loading employee details...</div>;
  }

  const expenseAccounts = ledgers;
  const payableAccounts = ledgers;
  const assetAccounts = ledgers;

  return (
    <form onSubmit={handleSubmit} className="space-y-8 bg-card text-card-foreground p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
      
      {/* Employee Category Tabs */}
      <div>
        <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-2">Employee Category</label>
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
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Section 1: General Details */}
        <div className="space-y-5">
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-800 pb-2">Employment & Identity Details</h3>

          <div>
            <PersonPicker
              label="Select or Add Employee / Person Name"
              value={personMasterId}
              onValueChange={setPersonMasterId}
              countryId={countryId}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Designation</label>
              <input
                type="text"
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                placeholder="e.g. Finance Manager"
                className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Department</label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="e.g. Accounts"
                className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Country</label>
              <select
                value={countryId}
                onChange={(e) => setCountryId(e.target.value)}
                className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Select Country</option>
                {countries.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Main Branch</label>
              <select
                value={countryBranchId}
                onChange={(e) => setCountryBranchId(e.target.value)}
                disabled={!countryId}
                className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-40"
              >
                <option value="">Select Branch</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">City Branch</label>
              <select
                value={cityBranchId}
                onChange={(e) => setCityBranchId(e.target.value)}
                disabled={!countryBranchId}
                className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-40"
              >
                <option value="">Select City Branch</option>
                {cityBranches.map((cb) => (
                  <option key={cb.id} value={cb.id}>{cb.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Joining Date</label>
              <input
                type="date"
                value={joiningDate}
                onChange={(e) => setJoiningDate(e.target.value)}
                className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            {category !== "Manager" && (
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Reporting Manager</label>
                <select
                  value={reportingManagerId}
                  onChange={(e) => setReportingManagerId(e.target.value)}
                  className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Select Manager</option>
                  {managers.map((m) => (
                    <option key={m.id} value={m.id}>{m.person?.customer_name} ({m.employee_code})</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Conditional Timelines */}
          {(category === "Normal Staff" || category === "Employee") && (
            <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Probation Start Date</label>
                <input
                  type="date"
                  value={probationStartDate}
                  onChange={(e) => setProbationStartDate(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Probation End Date</label>
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
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Contract Start Date</label>
                <input
                  type="date"
                  value={contractStartDate}
                  onChange={(e) => setContractStartDate(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Contract End Date</label>
                <input
                  type="date"
                  value={contractEndDate}
                  onChange={(e) => setContractEndDate(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Employment Type</label>
              <select
                value={employmentType}
                onChange={(e) => setEmploymentType(e.target.value)}
                className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-900 dark:text-slate-100"
              >
                <option value="Full-time">Full-time</option>
                <option value="Part-time">Part-time</option>
                <option value="Contract">Contract</option>
                <option value="Internship">Internship</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Duty Shift</label>
              <input
                type="text"
                value={workingShift}
                onChange={(e) => setWorkingShift(e.target.value)}
                className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Weekly Off Day</label>
              <select
                value={weeklyOffDay}
                onChange={(e) => setWeeklyOffDay(e.target.value)}
                className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-900 dark:text-slate-100"
              >
                <option value="Sunday">Sunday</option>
                <option value="Friday">Friday</option>
                <option value="Saturday">Saturday</option>
                <option value="Thursday">Thursday</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Shift Duty Start Time</label>
              <input
                type="time"
                value={dutyStartTime}
                onChange={(e) => setDutyStartTime(e.target.value)}
                className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Shift Duty End Time</label>
              <input
                type="time"
                value={dutyEndTime}
                onChange={(e) => setDutyEndTime(e.target.value)}
                className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Salary and Accounts */}
        <div className="space-y-5">
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-800 pb-2">Salary Details & Account Mapping</h3>

          {/* Salary Type & Currencies */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Salary Basis</label>
              <select
                value={salaryType}
                onChange={(e) => setSalaryType(e.target.value)}
                className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-900 dark:text-slate-100"
              >
                <option value="Monthly">Monthly</option>
                <option value="Daily">Daily</option>
                <option value="Hourly">Hourly</option>
                <option value="Custom">Custom</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Basic Salary Rate ({salaryCurrency})</label>
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

          {/* Allowances */}
          <div>
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-2">Monthly Allowances</label>
            <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Housing</label>
                <input
                  type="number"
                  value={accommodationAllowance || ""}
                  onChange={(e) => setAccommodationAllowance(Number(e.target.value))}
                  placeholder="0"
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Transport</label>
                <input
                  type="number"
                  value={transportAllowance || ""}
                  onChange={(e) => setTransportAllowance(Number(e.target.value))}
                  placeholder="0"
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Food</label>
                <input
                  type="number"
                  value={foodAllowance || ""}
                  onChange={(e) => setFoodAllowance(Number(e.target.value))}
                  placeholder="0"
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Mobile / Utility</label>
                <input
                  type="number"
                  value={mobileAllowance || ""}
                  onChange={(e) => setMobileAllowance(Number(e.target.value))}
                  placeholder="0"
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Other Allowances</label>
                <input
                  type="number"
                  value={otherAllowance || ""}
                  onChange={(e) => setOtherAllowance(Number(e.target.value))}
                  placeholder="0"
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>
          </div>

          {/* Deductions */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">General Monthly Deduction</label>
              <input
                type="number"
                value={deduction || ""}
                onChange={(e) => setDeduction(Number(e.target.value))}
                placeholder="0.00"
                className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Tax / Social Security</label>
              <input
                type="number"
                value={taxDeduction || ""}
                onChange={(e) => setTaxDeduction(Number(e.target.value))}
                placeholder="0.00"
                className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          {/* Calculated Net Summary Card */}
          <div className="bg-emerald-50 dark:bg-emerald-950/40 p-4 rounded-xl border border-emerald-200 dark:border-emerald-900/60 flex justify-between items-center">
            <div>
              <span className="text-[10px] text-emerald-800 dark:text-emerald-300 uppercase tracking-wider block font-bold">Estimated Net Payroll</span>
              <span className="text-xl font-black text-slate-900 dark:text-white">{netSalary.toLocaleString()} {salaryCurrency}</span>
            </div>
            <div className="text-right text-[11px] text-slate-600 dark:text-slate-400 font-medium">
              <div>Basic: {basicSalary}</div>
              <div>Allowances: +{totalAllowances}</div>
              <div>Deductions: -{(Number(deduction) + Number(taxDeduction))}</div>
            </div>
          </div>

          {/* Accounts Integration Mapping */}
          <div className="space-y-3 pt-2">
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block border-b border-slate-200 dark:border-slate-800 pb-1">General Ledger Mapping</label>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Salary Expense Account</label>
                <select
                  value={salaryExpenseAccountId}
                  onChange={(e) => setSalaryExpenseAccountId(e.target.value)}
                  className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-2 text-xs text-slate-900 dark:text-slate-100"
                >
                  <option value="">Select Ledger</option>
                  {expenseAccounts.map((l) => (
                    <option key={l.id} value={l.id}>{l.code} - {l.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Employee Payable Account</label>
                <select
                  value={employeePayableAccountId}
                  onChange={(e) => setEmployeePayableAccountId(e.target.value)}
                  className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-2 text-xs text-slate-900 dark:text-slate-100"
                >
                  <option value="">Select Ledger</option>
                  {payableAccounts.map((l) => (
                    <option key={l.id} value={l.id}>{l.code} - {l.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Advance Salary Asset Account</label>
                <select
                  value={advanceSalaryAccountId}
                  onChange={(e) => setAdvanceSalaryAccountId(e.target.value)}
                  className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-2 text-xs text-slate-900 dark:text-slate-100"
                >
                  <option value="">Select Ledger</option>
                  {assetAccounts.map((l) => (
                    <option key={l.id} value={l.id}>{l.code} - {l.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Employee Loan Asset Account</label>
                <select
                  value={loanAccountId}
                  onChange={(e) => setLoanAccountId(e.target.value)}
                  className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-2 text-xs text-slate-900 dark:text-slate-100"
                >
                  <option value="">Select Ledger</option>
                  {assetAccounts.map((l) => (
                    <option key={l.id} value={l.id}>{l.code} - {l.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Buttons */}
      <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200 dark:border-slate-800">
        <Button
          type="button"
          onClick={onCancel}
          variant="outline"
          className="text-xs font-semibold"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={saving}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-6 shadow-sm"
        >
          {saving ? "Saving..." : "Save Employee Setup"}
        </Button>
      </div>
    </form>
  );
}
