"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  RefreshCcw,
  ShieldCheck,
  Upload,
  UserPlus,
  MapPin,
  ClipboardList,
  Search,
  Building2,
  Paperclip,
  Briefcase,
  BadgeDollarSign,
  UserCheck,
  Phone,
  Mail,
  Calendar,
  CreditCard,
  Building,
  Key,
  Eye,
  EyeOff,
  Printer,
  FileText,
  Lock,
  Sparkles,
  Users
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchSelect, type SearchSelectOption } from "@/components/ui/search-select";
import type { LocationCountry } from "@/features/locations/location-api";
import { listCities, listCountries, type LocationCity } from "@/features/locations/location-api";
import type { EnterpriseRole } from "@/lib/permissions/enterprise-roles";
import { enterpriseRolePermissions } from "@/lib/permissions/enterprise-roles";
import { apiGet, apiPost } from "@/lib/api/client";
import { normalizeUserCode } from "@/lib/services/user-identity-service";
import { UserLiveReportPanel } from "./user-live-report-panel";
import { openUserA4ReportWindow } from "@/lib/reports/open-user-a4-report-window";

type MainBranchRow = { id: string; name: string; code: string; local_currency: string; is_main: boolean; city_id?: string | null };
type CityBranchRow = { id: string; name: string; code: string; city_name: string; local_currency: string; country_branch_id: string };

type WizardStep = 1 | 2 | 3 | 4;

type Banner = { tone: "ok" | "err"; text: string } | null;

const genderOptions = ["Male", "Female", "Other"] as const;

const employmentTypeOptions = [
  "Permanent",
  "Contract",
  "Probation",
  "Part-time",
  "Daily Wage",
  "Temporary"
] as const;

const departmentOptions = [
  "Management & Executive",
  "Finance & Accounting",
  "Sales & Marketing",
  "Warehouse & Inventory",
  "Operations & Logistics",
  "HR & Administration",
  "Transport & Driving",
  "Field & General Work"
] as const;

const designationOptions = [
  "Manager",
  "Assistant Manager",
  "Supervisor",
  "Accountant",
  "Cashier",
  "Sales Executive",
  "Office Staff / Clerk",
  "Warehouse Keeper",
  "Logistics Coordinator",
  "Driver",
  "General Worker",
  "Security Officer",
  "Other Company Staff"
] as const;

const paymentFrequencyOptions = ["Monthly", "Bi-Weekly", "Weekly", "Daily"] as const;

const branchTypeOptions = [
  { value: "main", label: "Main Branch" },
  { value: "city", label: "City Branch" }
] as const;

const roleOptions: Array<{ value: EnterpriseRole; label: string; help: string }> = [
  { value: "super_admin", label: "Super Admin User", help: "Global scope (full access)." },
  { value: "country_admin", label: "Country Admin User", help: "Country scope (one country)." },
  { value: "country_user", label: "Country User", help: "Country scope user (one country)." },
  { value: "main_branch_admin", label: "Main Branch Admin User", help: "Main branch scope." },
  { value: "city_branch_admin", label: "City/Branch User", help: "City branch scope." },
  { value: "accountant", label: "Accountant", help: "Branch scope with accounting permissions." },
  { value: "cashier", label: "Cashier", help: "Branch scope with payment permissions." },
  { value: "agent_user", label: "Agent User", help: "Limited branch access." },
  { value: "staff_user", label: "Staff User", help: "Limited branch access." },
  { value: "auditor_viewer", label: "Auditor / Viewer", help: "Read-only scope." }
];

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function makeAutoEmployeeCode() {
  const rand = Math.floor(1000 + Math.random() * 8999);
  return `EMP-${rand}`;
}

function toCountryOption(row: LocationCountry): SearchSelectOption {
  return {
    value: row.id,
    label: row.name,
    keywords: `${row.name} ${row.iso2 ?? ""} ${row.iso3 ?? ""} ${row.currency_code ?? ""}`
  };
}

function UserRegistrationWizardContent({ userIdProp }: { userIdProp?: string } = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlUserId = userIdProp || searchParams.get("userId");

  const [banner, setBanner] = useState<Banner>(null);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<WizardStep>(1);
  const [createdResult, setCreatedResult] = useState<null | { userId: string; userCode: string; createdAt: string }>(null);

  const [previewImageUrl, setPreviewImageUrl] = useState<string>("");
  const [profileFile, setProfileFile] = useState<File | null>(null);

  // STEP 1: Personal Information
  const [fullName, setFullName] = useState("");
  const [fatherOrSpouseName, setFatherOrSpouseName] = useState("");
  const [gender, setGender] = useState("Male");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [personalEmail, setPersonalEmail] = useState("");

  // STEP 2: Employment & Contract Details
  const [employeeCode, setEmployeeCode] = useState(() => makeAutoEmployeeCode());
  const [employmentType, setEmploymentType] = useState<string>("Permanent");
  const [department, setDepartment] = useState<string>("Operations & Logistics");
  const [designation, setDesignation] = useState<string>("Office Staff / Clerk");
  const [joiningDate, setJoiningDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [probationPeriod, setProbationPeriod] = useState("3 Months");
  const [contractEndDate, setContractEndDate] = useState("");

  // STEP 3: Location Information
  const [countries, setCountries] = useState<LocationCountry[]>([]);
  const [loadingCountries, setLoadingCountries] = useState(false);
  const [countryId, setCountryId] = useState("");
  const [branchType, setBranchType] = useState<"" | "main" | "city">("main");
  const [mainBranches, setMainBranches] = useState<MainBranchRow[]>([]);
  const [cityBranches, setCityBranches] = useState<CityBranchRow[]>([]);
  const [cities, setCities] = useState<LocationCity[]>([]);
  const [countryBranchId, setCountryBranchId] = useState("");
  const [cityBranchId, setCityBranchId] = useState("");
  const [residentialAddress, setResidentialAddress] = useState("");

  // STEP 4: Job, Salary & Payroll
  const [baseSalary, setBaseSalary] = useState("0");
  const [currency, setCurrency] = useState("USD");
  const [paymentFrequency, setPaymentFrequency] = useState("Monthly");
  const [bankName, setBankName] = useState("");
  const [accountOrIban, setAccountOrIban] = useState("");

  // ERP Login Access
  const [enableErpLogin, setEnableErpLogin] = useState(true);
  const [role, setRole] = useState<EnterpriseRole>("staff_user");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Edit / Employees List State
  const [employeesList, setEmployeesList] = useState<any[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [sidebarFilter, setSidebarFilter] = useState("");
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [isResettingBranch, setIsResettingBranch] = useState(true);

  async function fetchEmployees() {
    setEmployeesLoading(true);
    try {
      const res = await fetch("/api/erp/users/journal-report?limit=500").then((r) => r.json());
      if (res && res.rows && Array.isArray(res.rows)) {
        setEmployeesList(res.rows);
      }
    } catch (err) {
      console.error("Failed to load employees list", err);
    } finally {
      setEmployeesLoading(false);
    }
  }

  useEffect(() => {
    fetchEmployees();
  }, []);

  async function fetchSpecificUser(id: string) {
    try {
      const res = await fetch(`/api/erp/users?userId=${encodeURIComponent(id)}`).then((r) => r.json());
      if (res && res.data) {
        const data = res.data;
        setEditUserId(data.userId);
        setFullName(data.fullName || "");
        setEmployeeCode(data.userCode || makeAutoEmployeeCode());
        setRole(data.role || "staff_user");
        setCountryId(data.countryId || "");
        if (data.email) setPersonalEmail(data.email);
        if (data.phone) setContactPhone(data.phone);

        if (data.countryBranchId && !data.cityBranchId) {
          setBranchType("main");
          setCountryBranchId(data.countryBranchId);
          setCityBranchId("");
        } else if (data.cityBranchId) {
          setBranchType("city");
          setCityBranchId(data.cityBranchId);
        }

        setStep(1);
      }
    } catch (err) {
      console.error("Failed to load user for edit", err);
    }
  }

  useEffect(() => {
    if (urlUserId && !editUserId) {
      fetchSpecificUser(urlUserId);
    }
  }, [urlUserId, editUserId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingCountries(true);
      try {
        const rows = await listCountries();
        if (!cancelled) {
          setCountries(rows);
          if (rows.length > 0 && !countryId) {
            const defaultCountry = rows.find((r) => r.name.toLowerCase().includes("pakistan")) || rows[0];
            if (defaultCountry) setCountryId(defaultCountry.id);
          }
        }
      } finally {
        if (!cancelled) setLoadingCountries(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (isResettingBranch) {
      setBranchType("main");
      setCountryBranchId("");
      setCityBranchId("");
      setMainBranches([]);
      setCityBranches([]);
      setCities([]);
    } else {
      setIsResettingBranch(true);
    }

    if (!countryId) return;

    (async () => {
      const res = await fetch(`/api/branch-management/country-branches?countryId=${encodeURIComponent(countryId)}`, { cache: "no-store" });
      if (!res.ok) return;
      const json = (await res.json()) as { countryBranches?: MainBranchRow[] };
      const list = Array.isArray(json.countryBranches) ? json.countryBranches : [];
      const mains = list.filter((b) => Boolean(b.is_main));
      setMainBranches(mains);
      if (mains.length > 0 && !countryBranchId) {
        setCountryBranchId(mains[0].id);
        if (mains[0].local_currency) setCurrency(mains[0].local_currency);
      }
    })().catch(() => null);

    (async () => {
      const res = await fetch(`/api/branch-management/city-branches?countryId=${encodeURIComponent(countryId)}`, { cache: "no-store" });
      if (!res.ok) return;
      const json = (await res.json()) as { cityBranches?: CityBranchRow[] };
      setCityBranches(Array.isArray(json.cityBranches) ? json.cityBranches : []);
    })().catch(() => null);

    (async () => {
      const rows = await listCities(countryId);
      setCities(rows);
    })().catch(() => null);
  }, [countryId]);

  const countryOptions = useMemo(() => countries.map(toCountryOption), [countries]);
  const branchTypeSelectOptions = useMemo(
    () => branchTypeOptions.map((o) => ({ value: o.value, label: o.label, keywords: o.label })),
    []
  );

  const selectedCountry = useMemo(() => countries.find((c) => c.id === countryId) ?? null, [countries, countryId]);
  const selectedMainBranch = useMemo(() => mainBranches.find((b) => b.id === countryBranchId) ?? null, [mainBranches, countryBranchId]);
  const selectedCityBranch = useMemo(() => cityBranches.find((b) => b.id === cityBranchId) ?? null, [cityBranches, cityBranchId]);

  const branchCode = useMemo(() => {
    if (branchType === "main") return selectedMainBranch?.code ?? "";
    if (branchType === "city") return selectedCityBranch?.code ?? "";
    return "";
  }, [branchType, selectedMainBranch, selectedCityBranch]);

  const cityName = useMemo(() => {
    if (branchType === "city") return selectedCityBranch?.city_name ?? "";
    if (branchType === "main") {
      const cityId = selectedMainBranch?.city_id ?? null;
      if (!cityId) return "";
      const match = cities.find((c) => c.id === cityId);
      return match?.name ?? "";
    }
    return "";
  }, [branchType, selectedCityBranch, selectedMainBranch, cities]);

  const filteredEmployees = useMemo(() => {
    if (!sidebarFilter.trim()) return employeesList;
    const q = sidebarFilter.toLowerCase().trim();
    return employeesList.filter(
      (u) =>
        u.fullName?.toLowerCase().includes(q) ||
        u.userCode?.toLowerCase().includes(q) ||
        u.branchCode?.toLowerCase().includes(q) ||
        u.role?.toLowerCase().includes(q)
    );
  }, [employeesList, sidebarFilter]);

  function isStepValid(currentStep: WizardStep) {
    if (currentStep === 1) {
      return Boolean(fullName.trim().length >= 2 && gender);
    }
    if (currentStep === 2) {
      return Boolean(employeeCode && employmentType && department && designation);
    }
    if (currentStep === 3) {
      if (role === "super_admin") return true;
      if (!countryId) return false;
      if (branchType === "main") return Boolean(countryBranchId);
      if (branchType === "city") return Boolean(cityBranchId);
      return true;
    }
    if (currentStep === 4) {
      if (enableErpLogin) {
        if (!editUserId && (!password || password.length < 8)) return false;
        if (password && password !== confirmPassword) return false;
      }
      return true;
    }
    return true;
  }

  function next() {
    if (step < 4) setStep((s) => (s + 1) as WizardStep);
  }

  function prev() {
    if (step > 1) setStep((s) => (s - 1) as WizardStep);
  }

  async function finish() {
    setBanner(null);
    setCreatedResult(null);

    if (!fullName || fullName.trim().length < 2) {
      setBanner({ tone: "err", text: "Employee Full Name must be at least 2 characters." });
      return;
    }

    const issuedCode = normalizeUserCode(employeeCode || "");
    if (!issuedCode) {
      setBanner({ tone: "err", text: "Employee Code / ID is required." });
      return;
    }

    const isEdit = Boolean(editUserId);

    if (enableErpLogin) {
      if (!isEdit && (!password || password.length < 8)) {
        setBanner({ tone: "err", text: "Password must be at least 8 characters for ERP login." });
        return;
      }

      if (password && password.length < 8) {
        setBanner({ tone: "err", text: "Password must be at least 8 characters." });
        return;
      }

      if (password && password !== confirmPassword) {
        setBanner({ tone: "err", text: "Confirm Password does not match." });
        return;
      }
    }

    let resolvedCountryId: string | null = countryId || null;
    let resolvedCountryBranchId: string | null = null;
    let resolvedCityBranchId: string | null = null;

    if (role === "super_admin") {
      resolvedCountryId = null;
    } else if (role === "country_admin" || role === "country_user") {
      resolvedCountryBranchId = null;
      resolvedCityBranchId = null;
    } else if (role === "main_branch_admin" || branchType === "main") {
      resolvedCountryBranchId = countryBranchId || null;
      resolvedCityBranchId = null;
    } else {
      resolvedCityBranchId = cityBranchId || null;
      resolvedCountryBranchId = selectedCityBranch?.country_branch_id ?? null;
    }

    const preferredLanguage = (localStorage.getItem("erp_lang") || "en").toString();
    const email = personalEmail.trim() || `${issuedCode.toLowerCase()}@employees.damaan.local`;

    setSaving(true);
    try {
      const payload: any = {
        role: enableErpLogin ? role : "staff_user",
        fullName: fullName.trim(),
        userCode: issuedCode,
        countryId: resolvedCountryId,
        countryBranchId: resolvedCountryBranchId,
        cityBranchId: resolvedCityBranchId,
        phone: contactPhone.trim(),
        permissions: enterpriseRolePermissions[role] || []
      };

      let res;
      if (isEdit) {
        payload.userId = editUserId;
        if (password) payload.password = password;

        const fetchRes = await fetch("/api/erp/users", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const json = await fetchRes.json();
        if (!fetchRes.ok) throw new Error(json?.error?.message || json?.error || "Failed to update employee.");
        res = { userId: editUserId!, userCode: issuedCode };
      } else {
        payload.email = email;
        payload.password = password || "Emp@123456";
        payload.preferredLanguage = preferredLanguage;
        res = await apiPost<{ userId: string; userCode: string }>("/api/erp/users", payload);
      }

      setBanner({ tone: "ok", text: isEdit ? "Employee record updated successfully." : "Employee registered successfully." });
      setCreatedResult({ userId: res.userId, userCode: res.userCode, createdAt: new Date().toISOString() });
      fetchEmployees();
    } catch (e: any) {
      setBanner({ tone: "err", text: e?.message || "Employee operation failed." });
    } finally {
      setSaving(false);
    }
  }

  const steps = [
    { number: 1 as const, label: "Personal Info", icon: <UserPlus className="h-4 w-4" /> },
    { number: 2 as const, label: "Employment & Contract", icon: <Briefcase className="h-4 w-4" /> },
    { number: 3 as const, label: "Location & Branch", icon: <MapPin className="h-4 w-4" /> },
    { number: 4 as const, label: "Salary & ERP Access", icon: <BadgeDollarSign className="h-4 w-4" /> }
  ];

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
            <Users className="h-4 w-4" />
            <span>Employee Management System</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {editUserId ? "Edit Employee Master Record" : "Employee Master Form"}
          </h1>
          <p className="text-xs text-slate-500">
            Register and manage company employees: Managers, Supervisors, Accountants, Sales Staff, Cashiers, Drivers, and Workers.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {editUserId && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditUserId(null);
                setFullName("");
                setEmployeeCode(makeAutoEmployeeCode());
                setStep(1);
                setBanner(null);
              }}
              className="gap-1.5 text-xs"
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span>+ Register New Employee</span>
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              openUserA4ReportWindow({
                userId: editUserId || "EMP-PREVIEW",
                userCode: employeeCode,
                fullName: fullName || "Employee Name",
                countryName: selectedCountry?.name || "Pakistan",
                branchName: (branchType === "main" ? selectedMainBranch?.name : selectedCityBranch?.name) || "Main Branch",
                branchCode: branchCode || "PK-MAIN-001",
                branchType: designation || "Company Staff",
                role: role,
                registrationDate: joiningDate || new Date().toISOString(),
                status: "Active",
                permissions: [],
                lastActivity: new Date().toISOString(),
                lastActivityAction: "employee.registered",
                rawPassword: password || "••••••••",
                activityCounts: { logins: 1, transactions: 0, roznamcha: 0, purchases: 0, payments: 0, accounts: 0, approvals: 0, edits: 0 }
              });
            }}
            className="gap-1.5 text-xs bg-slate-900 text-white hover:bg-slate-800"
          >
            <Printer className="h-3.5 w-3.5 text-emerald-400" />
            <span>Print Employee A4 Report</span>
          </Button>
        </div>
      </div>

      {/* Progress Steps Header */}
      <div className="grid gap-2 sm:grid-cols-4">
        {steps.map((s) => {
          const isActive = step === s.number;
          const isDone = step > s.number;

          return (
            <button
              key={s.number}
              type="button"
              onClick={() => setStep(s.number)}
              className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                isActive
                  ? "border-primary bg-primary/5 text-primary shadow-sm ring-1 ring-primary/20"
                  : isDone
                  ? "border-emerald-200 bg-emerald-50/50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/20"
                  : "border-slate-200 bg-card text-slate-500 hover:border-slate-300"
              }`}
            >
              <div
                className={`grid h-8 w-8 place-items-center rounded-lg text-xs font-bold ${
                  isActive
                    ? "bg-primary text-white"
                    : isDone
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                }`}
              >
                {isDone ? <Check className="h-4 w-4" /> : s.number}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Step {s.number}</div>
                <div className="truncate text-xs font-semibold">{s.label}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Banner */}
      {banner && (
        <div
          className={`flex items-center justify-between rounded-lg p-3 text-xs font-medium ${
            banner.tone === "ok" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          <span>{banner.text}</span>
          <button type="button" onClick={() => setBanner(null)} className="text-slate-500 hover:text-slate-700">
            ×
          </button>
        </div>
      )}

      {/* Split Screen Layout */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Side (Form Wizard Steps) - 7 cols */}
        <div className="space-y-4 lg:col-span-7">
          <Card className="shadow-sm">
            <CardHeader className="border-b bg-slate-50/50 dark:bg-slate-900/50 py-3.5">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                {steps[step - 1].icon}
                <span>Step {step}: {steps[step - 1].label}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              {/* STEP 1: Personal Information */}
              {step === 1 && (
                <div className="space-y-4">
                  <div className="grid gap-3.5 sm:grid-cols-2">
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Employee Full Name *</Label>
                      <Input
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="e.g. Muhammad Ali Shah"
                        className="h-9 text-xs"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Father / Spouse Name</Label>
                      <Input
                        value={fatherOrSpouseName}
                        onChange={(e) => setFatherOrSpouseName(e.target.value)}
                        placeholder="e.g. Shah Zaman"
                        className="h-9 text-xs"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Gender *</Label>
                      <select
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-xs shadow-sm"
                        value={gender}
                        onChange={(e) => setGender(e.target.value)}
                      >
                        {genderOptions.map((g) => (
                          <option key={g} value={g}>{g}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Date of Birth</Label>
                      <Input
                        type="date"
                        value={dateOfBirth}
                        onChange={(e) => setDateOfBirth(e.target.value)}
                        className="h-9 text-xs"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">CNIC / Passport / National ID</Label>
                      <Input
                        value={nationalId}
                        onChange={(e) => setNationalId(e.target.value)}
                        placeholder="e.g. 54400-1234567-1"
                        className="h-9 text-xs font-mono"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Contact Phone Number *</Label>
                      <Input
                        value={contactPhone}
                        onChange={(e) => setContactPhone(e.target.value)}
                        placeholder="e.g. +92 300 1234567"
                        className="h-9 text-xs font-mono"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Emergency Contact Phone</Label>
                      <Input
                        value={emergencyPhone}
                        onChange={(e) => setEmergencyPhone(e.target.value)}
                        placeholder="e.g. +92 312 9876543"
                        className="h-9 text-xs font-mono"
                      />
                    </div>

                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Personal Email Address</Label>
                      <Input
                        type="email"
                        value={personalEmail}
                        onChange={(e) => setPersonalEmail(e.target.value)}
                        placeholder="e.g. employee@company.com"
                        className="h-9 text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: Employment & Contract Details */}
              {step === 2 && (
                <div className="space-y-4">
                  <div className="grid gap-3.5 sm:grid-cols-2">
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Employee Master Code / ID (Auto)</Label>
                      <Input value={employeeCode} readOnly className="bg-slate-100 dark:bg-slate-800 font-mono font-bold h-9 text-xs text-blue-600 dark:text-blue-400" />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Employment Type *</Label>
                      <select
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-xs shadow-sm"
                        value={employmentType}
                        onChange={(e) => setEmploymentType(e.target.value)}
                      >
                        {employmentTypeOptions.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Department *</Label>
                      <select
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-xs shadow-sm"
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                      >
                        {departmentOptions.map((d) => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Designation / Job Title *</Label>
                      <select
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-xs shadow-sm"
                        value={designation}
                        onChange={(e) => setDesignation(e.target.value)}
                      >
                        {designationOptions.map((des) => (
                          <option key={des} value={des}>{des}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Date of Joining *</Label>
                      <Input
                        type="date"
                        value={joiningDate}
                        onChange={(e) => setJoiningDate(e.target.value)}
                        className="h-9 text-xs"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Probation Period</Label>
                      <select
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-xs shadow-sm"
                        value={probationPeriod}
                        onChange={(e) => setProbationPeriod(e.target.value)}
                      >
                        <option value="None">None (Direct Confirmed)</option>
                        <option value="1 Month">1 Month</option>
                        <option value="3 Months">3 Months</option>
                        <option value="6 Months">6 Months</option>
                      </select>
                    </div>

                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Contract End Date (If Applicable)</Label>
                      <Input
                        type="date"
                        value={contractEndDate}
                        onChange={(e) => setContractEndDate(e.target.value)}
                        className="h-9 text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3: Location Information */}
              {step === 3 && (
                <div className="space-y-4">
                  <div className="grid gap-3.5">
                    <SearchSelect
                      label={loadingCountries ? "Assigned Country (Loading...)" : "Assigned Country *"}
                      value={countryId}
                      placeholder="Select country from master locations"
                      options={countryOptions}
                      disabled={loadingCountries}
                      onValueChange={setCountryId}
                    />

                    <SearchSelect
                      label="Branch Type *"
                      value={branchType}
                      placeholder="Select branch type"
                      options={branchTypeSelectOptions}
                      onValueChange={(v) => {
                        setBranchType(v as any);
                        setCountryBranchId("");
                        setCityBranchId("");
                      }}
                    />

                    {branchType === "main" ? (
                      <SearchSelect
                        label="Assigned Main Branch *"
                        value={countryBranchId}
                        placeholder="Select country main branch"
                        options={mainBranches.map((b) => ({ value: b.id, label: `${b.name} (${b.code})`, keywords: b.name }))}
                        disabled={!countryId}
                        onValueChange={setCountryBranchId}
                      />
                    ) : (
                      <SearchSelect
                        label="Assigned City Branch *"
                        value={cityBranchId}
                        placeholder="Select city branch"
                        options={cityBranches.map((b) => ({ value: b.id, label: `${b.cityName} - ${b.name} (${b.code})`, keywords: `${b.name} ${b.cityName}` }))}
                        disabled={!countryId}
                        onValueChange={setCityBranchId}
                      />
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Branch Code (Auto)</Label>
                        <Input value={branchCode} readOnly className="bg-slate-100 dark:bg-slate-800 font-mono font-bold h-9 text-xs text-emerald-600 dark:text-emerald-400" />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Work City (Auto)</Label>
                        <Input value={cityName || selectedCountry?.name || "-"} readOnly className="bg-slate-100 dark:bg-slate-800 font-bold h-9 text-xs text-slate-800 dark:text-slate-200" />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Residential / Present Address</Label>
                      <Input
                        value={residentialAddress}
                        onChange={(e) => setResidentialAddress(e.target.value)}
                        placeholder="Street address, City, Area"
                        className="h-9 text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 4: Job, Salary & Payroll */}
              {step === 4 && (
                <div className="space-y-4">
                  <div className="grid gap-3.5 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Base Salary / Rate</Label>
                      <Input
                        type="number"
                        value={baseSalary}
                        onChange={(e) => setBaseSalary(e.target.value)}
                        placeholder="0.00"
                        className="h-9 text-xs font-mono"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Salary Currency</Label>
                      <Input
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value)}
                        placeholder="USD, PKR, AED..."
                        className="h-9 text-xs font-bold"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Payment Frequency</Label>
                      <select
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-xs shadow-sm"
                        value={paymentFrequency}
                        onChange={(e) => setPaymentFrequency(e.target.value)}
                      >
                        {paymentFrequencyOptions.map((pf) => (
                          <option key={pf} value={pf}>{pf}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Bank Name</Label>
                      <Input
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        placeholder="e.g. Meezan Bank / HBL"
                        className="h-9 text-xs"
                      />
                    </div>

                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Account Number / IBAN</Label>
                      <Input
                        value={accountOrIban}
                        onChange={(e) => setAccountOrIban(e.target.value)}
                        placeholder="PK36MEZN00010203040506"
                        className="h-9 text-xs font-mono"
                      />
                    </div>
                  </div>

                  {/* System ERP Login Access Toggle */}
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3 bg-slate-50/60 dark:bg-slate-900/60">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Key className="h-4 w-4 text-emerald-600" />
                        <div>
                          <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">Enable System ERP Login Access</h3>
                          <p className="text-[11px] text-slate-500">Allow this employee to log into the ERP software with assigned role permissions</p>
                        </div>
                      </div>

                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={enableErpLogin}
                          onChange={(e) => setEnableErpLogin(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                      </label>
                    </div>

                    {enableErpLogin && (
                      <div className="pt-3 border-t grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5 sm:col-span-2">
                          <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">System Role Assignment *</Label>
                          <select
                            className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-xs shadow-sm"
                            value={role}
                            onChange={(e) => setRole(e.target.value as EnterpriseRole)}
                          >
                            {roleOptions.map((r) => (
                              <option key={r.value} value={r.value}>{r.label} — ({r.help})</option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">ERP System Password *</Label>
                          <div className="relative">
                            <Input
                              type={showPassword ? "text" : "password"}
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              placeholder="••••••••"
                              className="h-9 text-xs pr-8"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                            >
                              {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                            </button>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Confirm Password *</Label>
                          <Input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="••••••••"
                            className="h-9 text-xs"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Step Navigation Buttons */}
              <div className="flex items-center justify-between pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={prev}
                  disabled={step === 1}
                  className="gap-1 text-xs"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span>Previous</span>
                </Button>

                {step < 4 ? (
                  <Button
                    type="button"
                    size="sm"
                    onClick={next}
                    disabled={!isStepValid(step)}
                    className="gap-1 text-xs bg-primary text-white"
                  >
                    <span>Next Step</span>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    onClick={finish}
                    disabled={saving || !isStepValid(step)}
                    className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5"
                  >
                    <UserCheck className="h-4 w-4" />
                    <span>{saving ? "Saving..." : editUserId ? "Update Employee" : "Register Employee"}</span>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Side (Live Real-Time Employee Profile Card & Summary) - 5 cols */}
        <div className="space-y-4 lg:col-span-5">
          <Card className="shadow-sm border-slate-200 dark:border-slate-800 bg-slate-900 text-white overflow-hidden">
            <div className="border-b border-slate-800 px-5 py-4 bg-gradient-to-r from-slate-900 to-slate-850 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-emerald-400" />
                <h3 className="font-bold text-sm">Live Employee Profile Preview</h3>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300 border border-emerald-500/30">
                {employeeCode || "EMP-1001"}
              </span>
            </div>

            <CardContent className="p-5 space-y-5">
              {/* Profile Main Header */}
              <div className="flex items-center gap-4 border-b border-slate-800 pb-4">
                <div className="grid h-14 w-14 place-items-center rounded-2xl bg-emerald-600 text-white text-xl font-black shadow-inner border border-emerald-400/40">
                  {fullName ? fullName.substring(0, 2).toUpperCase() : "EM"}
                </div>
                <div>
                  <h4 className="text-base font-bold text-white">{fullName || "Employee Name"}</h4>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-emerald-400 font-semibold">{designation}</span>
                    <span className="text-slate-500">•</span>
                    <span className="text-xs text-slate-300">{department}</span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-300">
                      {employmentType}
                    </span>
                    <span className="rounded bg-blue-500/20 px-2 py-0.5 text-[10px] font-bold text-blue-300 border border-blue-500/30">
                      Code: {branchCode || "MAIN-001"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Profile Quick Summary Grid */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-lg bg-slate-800/60 p-2.5 border border-slate-800">
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block">Joining Date</span>
                  <span className="font-semibold text-slate-100 mt-0.5 block">{joiningDate || "-"}</span>
                </div>

                <div className="rounded-lg bg-slate-800/60 p-2.5 border border-slate-800">
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block">Probation</span>
                  <span className="font-semibold text-slate-100 mt-0.5 block">{probationPeriod}</span>
                </div>

                <div className="rounded-lg bg-slate-800/60 p-2.5 border border-slate-800">
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block">Base Salary</span>
                  <span className="font-semibold text-emerald-400 mt-0.5 block">{baseSalary} {currency} ({paymentFrequency})</span>
                </div>

                <div className="rounded-lg bg-slate-800/60 p-2.5 border border-slate-800">
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block">ERP Access</span>
                  <span className={`font-semibold mt-0.5 block ${enableErpLogin ? "text-emerald-400" : "text-slate-400"}`}>
                    {enableErpLogin ? `Active (${role})` : "Disabled"}
                  </span>
                </div>
              </div>

              {/* Contact Details */}
              <div className="space-y-2 border-t border-slate-800 pt-3 text-xs">
                <div className="flex items-center justify-between text-slate-300">
                  <span className="text-slate-400">Phone:</span>
                  <span className="font-mono font-semibold">{contactPhone || "-"}</span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span className="text-slate-400">Email:</span>
                  <span className="font-mono">{personalEmail || `${employeeCode.toLowerCase()}@employees.damaan.local`}</span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span className="text-slate-400">CNIC / ID:</span>
                  <span className="font-mono">{nationalId || "-"}</span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span className="text-slate-400">Assigned Branch:</span>
                  <span className="font-semibold text-emerald-400">{branchCode ? `${branchCode}` : "Main Country Branch"}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Existing Employees Directory Quick List */}
          <Card className="shadow-sm">
            <CardHeader className="py-3 px-4 border-b bg-slate-50/50 dark:bg-slate-900/50 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-blue-600" />
                <span>Recent Employees ({employeesList.length})</span>
              </CardTitle>

              <div className="relative w-36">
                <Search className="absolute left-2 top-2 h-3 w-3 text-slate-400" />
                <Input
                  placeholder="Search..."
                  value={sidebarFilter}
                  onChange={(e) => setSidebarFilter(e.target.value)}
                  className="h-7 text-[11px] pl-7"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[300px] overflow-y-auto divide-y">
                {employeesLoading ? (
                  <div className="p-4 text-center text-xs text-slate-400">Loading employees...</div>
                ) : filteredEmployees.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400">No employees registered yet.</div>
                ) : (
                  filteredEmployees.slice(0, 10).map((emp: any) => (
                    <div
                      key={emp.userId || emp.id}
                      onClick={() => fetchSpecificUser(emp.userId || emp.id)}
                      className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors flex items-center justify-between"
                    >
                      <div>
                        <div className="font-semibold text-xs text-slate-900 dark:text-slate-100">{emp.fullName}</div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {emp.userCode} • <span className="text-emerald-600 font-bold">{emp.branchCode || "MAIN"}</span>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[10px]">
                        {emp.role}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export function UserRegistrationWizard({ userIdProp }: { userIdProp?: string } = {}) {
  return (
    <Suspense fallback={<div className="p-8 text-slate-400">Loading Employee Master Form...</div>}>
      <UserRegistrationWizardContent userIdProp={userIdProp} />
    </Suspense>
  );
}
