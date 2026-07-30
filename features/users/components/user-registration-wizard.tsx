"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  UserPlus,
  MapPin,
  Building2,
  Briefcase,
  Phone,
  Mail,
  Key,
  Eye,
  EyeOff,
  Printer,
  Users,
  Globe2,
  CheckCircle2,
  Lock,
  Plus,
  Search,
  UserCheck,
  BadgeCheck,
  Shield
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchSelect, type SearchSelectOption } from "@/components/ui/search-select";
import { SimpleModal } from "@/components/ui/simple-modal";
import { EmployeeForm } from "@/features/hr-payroll/components/employee-form";
import type { LocationCountry } from "@/features/locations/location-api";
import { listCities, listCountries, type LocationCity } from "@/features/locations/location-api";
import type { EnterpriseRole } from "@/lib/permissions/enterprise-roles";
import { enterpriseRolePermissions } from "@/lib/permissions/enterprise-roles";
import { apiPost } from "@/lib/api/client";
import { normalizeUserCode } from "@/lib/services/user-identity-service";
import { openUserA4ReportWindow } from "@/lib/reports/open-user-a4-report-window";

type MainBranchRow = { id: string; name: string; code: string; local_currency: string; is_main: boolean; city_id?: string | null };
type CityBranchRow = { id: string; name: string; code: string; city_name: string; local_currency: string; country_branch_id: string };

type WizardStep = 1 | 2 | 3;

type Banner = { tone: "ok" | "err"; text: string } | null;

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

function makeAutoUserCode() {
  const rand = Math.floor(1000 + Math.random() * 8999);
  return `USR-${rand}`;
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

  // Modal for creating new employee on the fly
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);

  // HR Employees list for Step 1 dropdown
  const [hrEmployees, setHrEmployees] = useState<any[]>([]);
  const [hrEmployeesLoading, setHrEmployeesLoading] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");

  // User Core State
  const [userCode, setUserCode] = useState(() => makeAutoUserCode());
  const [fullName, setFullName] = useState("");
  const [loginUsername, setLoginUsername] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [personalEmail, setPersonalEmail] = useState("");
  const [designation, setDesignation] = useState("Staff");
  const [department, setDepartment] = useState("General Office");

  // Step 2: Location & Branch
  const [countries, setCountries] = useState<LocationCountry[]>([]);
  const [loadingCountries, setLoadingCountries] = useState(false);
  const [countryId, setCountryId] = useState("");
  const [branchType, setBranchType] = useState<"" | "main" | "city">("main");
  const [mainBranches, setMainBranches] = useState<MainBranchRow[]>([]);
  const [cityBranches, setCityBranches] = useState<CityBranchRow[]>([]);
  const [cities, setCities] = useState<LocationCity[]>([]);
  const [countryBranchId, setCountryBranchId] = useState("");
  const [cityBranchId, setCityBranchId] = useState("");
  const [currency, setCurrency] = useState("USD");

  // Step 3: Login Credentials & Security
  const [role, setRole] = useState<EnterpriseRole>("staff_user");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Editing User
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [isResettingBranch, setIsResettingBranch] = useState(true);

  async function fetchHrEmployees() {
    setHrEmployeesLoading(true);
    try {
      const res = await fetch("/api/erp/hr-payroll/employees").then((r) => r.json());
      if (res && res.employees && Array.isArray(res.employees)) {
        setHrEmployees(res.employees);
      }
    } catch (err) {
      console.error("Failed to load HR employees list", err);
    } finally {
      setHrEmployeesLoading(false);
    }
  }

  useEffect(() => {
    fetchHrEmployees();
  }, []);

  // When Employee is selected from dropdown, populate fields
  useEffect(() => {
    if (!selectedEmployeeId) return;
    const emp = hrEmployees.find((e) => e.id === selectedEmployeeId);
    if (emp) {
      const empName = emp.person?.customer_name || emp.name || emp.full_name || "";
      setFullName(empName);
      if (!loginUsername) {
        setLoginUsername(empName.toLowerCase().replace(/\s+/g, "."));
      }
      if (emp.person?.mobile) setContactPhone(emp.person.mobile);
      if (emp.person?.email) setPersonalEmail(emp.person.email);
      if (emp.designation) setDesignation(emp.designation);
      if (emp.department) setDepartment(emp.department);
      if (emp.country_id) setCountryId(emp.country_id);
      if (emp.country_branch_id) {
        setBranchType("main");
        setCountryBranchId(emp.country_branch_id);
      } else if (emp.city_branch_id) {
        setBranchType("city");
        setCityBranchId(emp.city_branch_id);
      }
    }
  }, [selectedEmployeeId, hrEmployees]);

  async function fetchSpecificUser(id: string) {
    try {
      const res = await fetch(`/api/erp/users?userId=${encodeURIComponent(id)}`).then((r) => r.json());
      if (res && res.data) {
        const data = res.data;
        setEditUserId(data.userId);
        setFullName(data.fullName || "");
        setUserCode(data.userCode || makeAutoUserCode());
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

  const employeeOptions = useMemo(
    () =>
      hrEmployees.map((emp) => {
        const empName = emp.person?.customer_name || emp.name || emp.full_name || "Employee";
        const code = emp.employee_code || "";
        return {
          value: emp.id,
          label: code ? `${code} - ${empName}` : empName,
          keywords: `${code} ${empName} ${emp.designation || ""} ${emp.department || ""}`
        };
      }),
    [hrEmployees]
  );

  const selectedCountry = useMemo(() => countries.find((c) => c.id === countryId) ?? null, [countries, countryId]);
  const selectedMainBranch = useMemo(() => mainBranches.find((b) => b.id === countryBranchId) ?? null, [mainBranches, countryBranchId]);
  const selectedCityBranch = useMemo(() => cityBranches.find((b) => b.id === cityBranchId) ?? null, [cityBranches, cityBranchId]);

  const selectedEmployeeObj = useMemo(() => hrEmployees.find((e) => e.id === selectedEmployeeId) ?? null, [hrEmployees, selectedEmployeeId]);

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

  function isStepValid(currentStep: WizardStep) {
    if (currentStep === 1) {
      return Boolean(fullName.trim().length >= 2 || selectedEmployeeId);
    }
    if (currentStep === 2) {
      if (role === "super_admin") return true;
      if (!countryId) return false;
      if (branchType === "main") return Boolean(countryBranchId);
      if (branchType === "city") return Boolean(cityBranchId);
      return true;
    }
    if (currentStep === 3) {
      if (!editUserId && (!password || password.length < 8)) return false;
      if (password && password !== confirmPassword) return false;
      return Boolean(userCode.trim());
    }
    return true;
  }

  function next() {
    if (step < 3) setStep((s) => (s + 1) as WizardStep);
  }

  function prev() {
    if (step > 1) setStep((s) => (s - 1) as WizardStep);
  }

  async function finish() {
    setBanner(null);

    if (!fullName || fullName.trim().length < 2) {
      setBanner({ tone: "err", text: "User Full Name / Employee selection is required." });
      return;
    }

    const issuedCode = normalizeUserCode(userCode || "");
    if (!issuedCode) {
      setBanner({ tone: "err", text: "User ID / Code is required." });
      return;
    }

    const isEdit = Boolean(editUserId);

    if (!isEdit && (!password || password.length < 8)) {
      setBanner({ tone: "err", text: "Password must be at least 8 characters for login access." });
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
    const email = personalEmail.trim() || `${issuedCode.toLowerCase()}@users.dgt.local`;

    setSaving(true);
    try {
      const payload: any = {
        role: role,
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
        if (!fetchRes.ok) throw new Error(json?.error?.message || json?.error || "Failed to update user.");
        res = { userId: editUserId!, userCode: issuedCode };
      } else {
        payload.email = email;
        payload.password = password || "User@123456";
        payload.preferredLanguage = preferredLanguage;
        res = await apiPost<{ userId: string; userCode: string }>("/api/erp/users", payload);
      }

      setBanner({ tone: "ok", text: isEdit ? "User record updated successfully." : "User registered successfully." });
    } catch (e: any) {
      setBanner({ tone: "err", text: e?.message || "User operation failed." });
    } finally {
      setSaving(false);
    }
  }

  const steps = [
    { number: 1 as const, label: "Employee & Identity", icon: <Users className="h-4 w-4" /> },
    { number: 2 as const, label: "Branch Access", icon: <MapPin className="h-4 w-4" /> },
    { number: 3 as const, label: "Login & Security", icon: <Key className="h-4 w-4" /> }
  ];

  return (
    <div className="space-y-6">
      {/* Header Bar aligned with ERP theme */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
            <Users className="h-4 w-4 text-emerald-600" />
            <span>User Management & Identity Module</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {editUserId ? "Edit System User Record" : "User Registration Form"}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Link Employee master records, assign Country & Branch scopes, and issue System Login Credentials.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {editUserId && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditUserId(null);
                setFullName("");
                setLoginUsername("");
                setSelectedEmployeeId("");
                setUserCode(makeAutoUserCode());
                setStep(1);
                setBanner(null);
              }}
              className="gap-1.5 text-xs font-semibold"
            >
              <UserPlus className="h-3.5 w-3.5 text-slate-500" />
              <span>+ New User</span>
            </Button>
          )}

          <Button
            size="sm"
            onClick={() => {
              openUserA4ReportWindow({
                userId: editUserId || "USR-PREVIEW",
                userCode: userCode,
                fullName: fullName || "User Name",
                countryName: selectedCountry?.name || "Pakistan",
                branchName: (branchType === "main" ? selectedMainBranch?.name : selectedCityBranch?.name) || "Main Branch",
                branchCode: branchCode || "PK-MAIN-001",
                branchType: designation || "Company Staff",
                role: role,
                registrationDate: new Date().toISOString(),
                status: "Active",
                permissions: [],
                lastActivity: new Date().toISOString(),
                lastActivityAction: "user.registered",
                rawPassword: password || "••••••••",
                activityCounts: { logins: 1, transactions: 0, roznamcha: 0, purchases: 0, payments: 0, accounts: 0, approvals: 0, edits: 0 }
              });
            }}
            className="gap-1.5 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white shadow-sm"
          >
            <Printer className="h-3.5 w-3.5 text-emerald-400" />
            <span>Print A4 User Card</span>
          </Button>
        </div>
      </div>

      {/* Progress Steps Header */}
      <div className="grid gap-2 sm:grid-cols-3">
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
                  ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shadow-sm ring-1 ring-emerald-500/30"
                  : isDone
                  ? "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-slate-700 dark:text-slate-300"
                  : "border-slate-200 dark:border-slate-800 bg-card text-slate-500 hover:border-slate-300"
              }`}
            >
              <div
                className={`grid h-8 w-8 place-items-center rounded-lg text-xs font-bold transition-colors ${
                  isActive
                    ? "bg-emerald-600 text-white"
                    : isDone
                    ? "bg-slate-900 text-emerald-400 dark:bg-slate-800"
                    : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                }`}
              >
                {isDone ? <Check className="h-4 w-4" /> : s.number}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Step {s.number}</div>
                <div className="truncate text-xs font-bold text-slate-900 dark:text-slate-100">{s.label}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Banner Notification */}
      {banner && (
        <div
          className={`flex items-center justify-between rounded-xl p-3.5 text-xs font-semibold ${
            banner.tone === "ok"
              ? "bg-emerald-50 text-emerald-900 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-800"
              : "bg-red-50 text-red-900 border border-red-200 dark:bg-red-950/40 dark:text-red-200 dark:border-red-800"
          }`}
        >
          <div className="flex items-center gap-2">
            {banner.tone === "ok" ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Lock className="h-4 w-4 text-red-600" />}
            <span>{banner.text}</span>
          </div>
          <button type="button" onClick={() => setBanner(null)} className="text-slate-400 hover:text-slate-600">
            ×
          </button>
        </div>
      )}

      {/* Main Split-Screen Section */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Side Form Wizard (6 Columns) */}
        <div className="space-y-4 lg:col-span-6">
          <Card className="rounded-xl border border-slate-200 dark:border-slate-800 bg-card shadow-sm overflow-hidden">
            <CardHeader className="border-b bg-slate-900 text-white px-5 py-3 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 text-slate-100">
                {steps[step - 1].icon}
                <span>Step {step}: {steps[step - 1].label}</span>
              </CardTitle>
              <span className="text-xs font-mono font-bold text-emerald-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                {userCode}
              </span>
            </CardHeader>

            <CardContent className="p-4 space-y-3">
              {/* STEP 1: Select & Attach Employee */}
              {step === 1 && (
                <div className="space-y-3">
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-col gap-1">
                      <SearchSelect
                        label={hrEmployeesLoading ? "Select Employee Record (Loading...)" : "Select Registered Employee *"}
                        value={selectedEmployeeId}
                        placeholder="Search employee by code, name, designation..."
                        options={employeeOptions}
                        disabled={hrEmployeesLoading}
                        onValueChange={setSelectedEmployeeId}
                        createLabel="+ Register New Employee Master"
                        onCreateNew={() => setShowEmployeeModal(true)}
                      />
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => setShowEmployeeModal(true)}
                          className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 hover:underline flex items-center gap-1"
                        >
                          <Plus className="h-3 w-3" />
                          <span>+ Add New Employee</span>
                        </button>
                      </div>
                    </div>

                    <div className="grid gap-2.5 sm:grid-cols-2 pt-1">
                      <div className="space-y-1">
                        <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">User Full Name *</Label>
                        <Input
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="e.g. Muhammad Ali Shah"
                          className="h-8.5 text-xs font-medium"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">Login Username / Page Name *</Label>
                        <Input
                          value={loginUsername}
                          onChange={(e) => setLoginUsername(e.target.value)}
                          placeholder="e.g. ali.shah or USR-1001"
                          className="h-8.5 text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: Location & Branch Access (Compact 2-per-row) */}
              {step === 2 && (
                <div className="space-y-3">
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    <SearchSelect
                      label={loadingCountries ? "Country (Loading...)" : "Assigned Country *"}
                      value={countryId}
                      placeholder="Select country"
                      disabled={loadingCountries}
                      options={countryOptions}
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
                        placeholder="Select main branch"
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

                    <div className="space-y-1">
                      <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">Branch Code (Auto)</Label>
                      <Input value={branchCode} readOnly className="bg-slate-100 dark:bg-slate-900 font-mono font-bold h-9 text-xs text-emerald-600 dark:text-emerald-400 border-slate-200 dark:border-slate-700" />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">Work City / Country (Auto)</Label>
                      <Input value={cityName || selectedCountry?.name || "-"} readOnly className="bg-slate-100 dark:bg-slate-900 font-bold h-9 text-xs text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700" />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">Currency Scope (Auto)</Label>
                      <Input value={currency || "USD"} readOnly className="bg-slate-100 dark:bg-slate-900 font-bold h-9 text-xs text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700" />
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3: System Login Credentials & Role Privileges */}
              {step === 3 && (
                <div className="space-y-3">
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">User ID / System Code *</Label>
                      <Input
                        value={userCode}
                        onChange={(e) => setUserCode(e.target.value)}
                        placeholder="e.g. USR-1001"
                        className="h-8.5 text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">Login Email / Identifier *</Label>
                      <Input
                        type="email"
                        value={personalEmail}
                        onChange={(e) => setPersonalEmail(e.target.value)}
                        placeholder="user@dgt.com"
                        className="h-8.5 text-xs font-medium"
                      />
                    </div>

                    <div className="space-y-1 sm:col-span-2">
                      <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">System Role Assignment *</Label>
                      <select
                        className="flex h-8.5 w-full rounded-lg border border-input bg-background px-3 text-xs shadow-sm font-medium"
                        value={role}
                        onChange={(e) => setRole(e.target.value as EnterpriseRole)}
                      >
                        {roleOptions.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label} — {r.help}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {editUserId ? "New Password" : "Password *"}
                      </Label>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="At least 8 chars"
                          className="h-8.5 text-xs font-mono pr-8"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
                        >
                          {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">Confirm Password</Label>
                      <Input
                        type={showPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter password"
                        className="h-8.5 text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Step Navigation Controls */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={step === 1 || saving}
                  onClick={prev}
                  className="gap-1.5 text-xs font-semibold h-8"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  <span>Previous</span>
                </Button>

                {step < 3 ? (
                  <Button
                    type="button"
                    size="sm"
                    disabled={!isStepValid(step) || saving}
                    onClick={next}
                    className="gap-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white h-8"
                  >
                    <span>Next Step</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    disabled={!isStepValid(3) || saving}
                    onClick={finish}
                    className="gap-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-5 h-8"
                  >
                    {saving ? (
                      <span>Saving User...</span>
                    ) : (
                      <>
                        <ShieldCheck className="h-3.5 w-3.5" />
                        <span>{editUserId ? "Update User" : "Register User Now"}</span>
                      </>
                    )}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Side Live User Summary Card - ENLARGED & RICH A4 PREVIEW (6 Columns) */}
        <div className="space-y-4 lg:col-span-6">
          <Card className="rounded-xl border-2 border-emerald-500/20 bg-card shadow-md overflow-hidden sticky top-6">
            <CardHeader className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 text-white px-5 py-4 flex flex-row items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30">
                  <UserCheck className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">Live User Card</div>
                  <CardTitle className="text-sm font-black tracking-tight text-white">
                    {fullName || "System User Preview"}
                  </CardTitle>
                </div>
              </div>
              <span className="text-xs font-mono font-extrabold text-emerald-400 bg-slate-950 px-2.5 py-1 rounded-md border border-emerald-500/30">
                {userCode}
              </span>
            </CardHeader>

            <CardContent className="p-5 space-y-4 text-xs">
              {/* Profile Summary & Status Bar */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/80">
                <div className="space-y-0.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">System Role</div>
                  <div className="font-extrabold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <Shield className="h-4 w-4 text-emerald-600" />
                    <span>{roleOptions.find((r) => r.value === role)?.label || role}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-600 text-white shadow-xs">
                    <BadgeCheck className="h-3 w-3" /> Active User
                  </span>
                </div>
              </div>

              {/* Identity & Login Details Grid */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">User ID / Code</span>
                  <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs">{userCode}</div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Login Username</span>
                  <div className="font-mono font-bold text-slate-900 dark:text-slate-100 text-xs truncate">
                    {loginUsername || userCode.toLowerCase()}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Contact Mobile</span>
                  <div className="font-mono font-bold text-slate-800 dark:text-slate-200 text-xs">{contactPhone || "-"}</div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Official Email</span>
                  <div className="font-bold text-slate-800 dark:text-slate-200 text-xs truncate">{personalEmail || "-"}</div>
                </div>
              </div>

              {/* Employee & Location Scope Breakdown */}
              <div className="rounded-xl bg-slate-900 text-slate-100 p-4 space-y-3 border border-slate-800">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2 font-bold text-xs text-emerald-400">
                    <Building2 className="h-4 w-4" />
                    <span>Location & Office Scope</span>
                  </div>
                  <span className="font-mono text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-300">
                    {branchCode || "GLOBAL"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-400 text-[11px] block">Assigned Country:</span>
                    <span className="font-bold text-white">{selectedCountry?.name || "Global Scope"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[11px] block">Branch Scope:</span>
                    <span className="font-bold text-white">
                      {(branchType === "main" ? selectedMainBranch?.name : selectedCityBranch?.name) || "All Branches"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[11px] block">Designation:</span>
                    <span className="font-bold text-white">{designation || "Company Staff"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[11px] block">Department:</span>
                    <span className="font-bold text-white">{department || "Operations"}</span>
                  </div>
                </div>
              </div>

              {/* Quick Actions Footer */}
              <div className="pt-2 flex justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    openUserA4ReportWindow({
                      userId: editUserId || "USR-PREVIEW",
                      userCode: userCode,
                      fullName: fullName || "User Name",
                      countryName: selectedCountry?.name || "Pakistan",
                      branchName: (branchType === "main" ? selectedMainBranch?.name : selectedCityBranch?.name) || "Main Branch",
                      branchCode: branchCode || "PK-MAIN-001",
                      branchType: designation || "Company Staff",
                      role: role,
                      registrationDate: new Date().toISOString(),
                      status: "Active",
                      permissions: [],
                      lastActivity: new Date().toISOString(),
                      lastActivityAction: "user.registered",
                      rawPassword: password || "••••••••",
                      activityCounts: { logins: 1, transactions: 0, roznamcha: 0, purchases: 0, payments: 0, accounts: 0, approvals: 0, edits: 0 }
                    });
                  }}
                  className="gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200"
                >
                  <Printer className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Print Full A4 Report</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modal for creating a new Employee directly from User Registration Form */}
      {showEmployeeModal && (
        <SimpleModal
          title="Register New Employee Master Record"
          onClose={() => setShowEmployeeModal(false)}
          className="max-w-4xl"
        >
          <EmployeeForm
            onSave={() => {
              setShowEmployeeModal(false);
              fetchHrEmployees();
            }}
            onCancel={() => setShowEmployeeModal(false)}
          />
        </SimpleModal>
      )}
    </div>
  );
}

export function UserRegistrationWizard({ userIdProp }: { userIdProp?: string } = {}) {
  return (
    <Suspense fallback={<div className="p-8 text-slate-400">Loading User Registration Form...</div>}>
      <UserRegistrationWizardContent userIdProp={userIdProp} />
    </Suspense>
  );
}
