"use client";

import { useEffect, useMemo, useState } from "react";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";
import {
  Users, UserCheck, Shield, KeyRound, Building2, Globe, MapPin,
  Sparkles, CheckCircle2, AlertCircle, RefreshCw, Eye, EyeOff,
  Copy, Check, UserPlus, ArrowRight, Layers, FileText
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { SearchSelect } from "@/components/ui/search-select";
import { supportedLanguages } from "@/lib/i18n/languages";
import type { EnterpriseRole } from "@/lib/permissions/enterprise-roles";
import { listCountries, type LocationCountry } from "@/features/locations/location-api";
import { SimpleModal } from "@/components/ui/simple-modal";
import { EmployeeForm } from "@/features/hr-payroll/components/employee-form";
import { personFullName } from "@/features/hr-payroll/components/person-picker";

export type UserEntryKind = "super_admin" | "country" | "branch" | "agent" | "staff";

type RoleOption = { value: EnterpriseRole; label: string };

const roleOptionsByKind: Record<UserEntryKind, RoleOption[]> = {
  super_admin: [{ value: "super_admin", label: "Super Admin (Global Head)" }],
  country: [
    { value: "country_admin", label: "Country Admin" },
    { value: "main_branch_admin", label: "Main Branch Admin" },
    { value: "auditor_viewer", label: "Auditor / Viewer" }
  ],
  branch: [
    { value: "city_branch_admin", label: "City Branch Admin" },
    { value: "accountant", label: "Accountant" },
    { value: "cashier", label: "Cashier" },
    { value: "staff_user", label: "Staff User" },
    { value: "auditor_viewer", label: "Auditor / Viewer" }
  ],
  agent: [{ value: "agent_user", label: "Agent User" }],
  staff: [{ value: "staff_user", label: "Staff User" }]
};

const scopeHelpByKind: Record<UserEntryKind, string> = {
  super_admin: "Global scope (unrestricted access to all countries, branches, and ledgers).",
  country: "Country scope (choose a Country and Main Branch).",
  branch: "Branch scope (choose Country, Country Main Branch, and City Branch).",
  agent: "Branch-scoped agent user (choose Country and City Branch).",
  staff: "Branch-scoped staff user (choose Country and City Branch)."
};

function generateSecurePassword() {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const nums = "23456789";
  const spec = "!@#$%&*";
  const pick = (s: string) => s[Math.floor(Math.random() * s.length)];
  return `${pick(upper)}${pick(lower)}${pick(nums)}${pick(spec)}${Math.random().toString(36).slice(-5)}`;
}

export function UserEntryForm({ kind }: { kind: UserEntryKind }) {
  const lang = useActiveLanguage();
  const tt = (key: string, fallback: string) => t(lang, key as never, fallback);
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);
  const roleOptions = roleOptionsByKind[kind];

  // Employee Dropdown Data
  const [employees, setEmployees] = useState<any[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");

  // Location / Scope Data
  const [countries, setCountries] = useState<LocationCountry[]>([]);
  const [loadingCountries, setLoadingCountries] = useState(false);
  const [countryId, setCountryId] = useState("");
  const [countryBranchId, setCountryBranchId] = useState("");
  const [cityBranchId, setCityBranchId] = useState("");
  const [mainBranches, setMainBranches] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [cityBranches, setCityBranches] = useState<Array<{ id: string; name: string; code: string; city_name: string }>>([]);

  // Form Fields
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState(generateSecurePassword());
  const [showPassword, setShowPassword] = useState(false);
  const [preferredLanguage, setPreferredLanguage] = useState("en");
  const [role, setRole] = useState<EnterpriseRole>(roleOptions[0]?.value || "staff_user");
  const [department, setDepartment] = useState("");
  const [designation, setDesignation] = useState("");
  const [copiedKey, setCopiedKey] = useState(false);

  // Status & Notifications
  const [submitting, setSubmitting] = useState(false);
  const [successResult, setSuccessResult] = useState<any | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showNewEmployeeModal, setShowNewEmployeeModal] = useState(false);

  // Load Employees from HR API
  const fetchEmployees = async () => {
    setLoadingEmployees(true);
    try {
      const res = await fetch("/api/erp/hr-payroll/employees");
      if (res.ok) {
        const json = await res.json();
        setEmployees(Array.isArray(json.employees) ? json.employees : []);
      }
    } catch (e) {
      console.error("Error loading employees:", e);
    } finally {
      setLoadingEmployees(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  // Load Countries
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingCountries(true);
      try {
        const rows = await listCountries();
        if (!cancelled) setCountries(rows);
      } finally {
        if (!cancelled) setLoadingCountries(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Load Main Branches when Country changes
  useEffect(() => {
    let cancelled = false;
    setCountryBranchId("");
    setCityBranchId("");
    setMainBranches([]);
    setCityBranches([]);
    if (!countryId) return;

    (async () => {
      const res = await fetch(`/api/branch-management/country-branches?countryId=${encodeURIComponent(countryId)}`, {
        cache: "no-store"
      });
      if (!res.ok) return;
      const json = (await res.json()) as { countryBranches?: Array<{ id: string; name: string; code: string; is_main: boolean }> };
      const list = Array.isArray(json.countryBranches) ? json.countryBranches : [];
      if (!cancelled) setMainBranches(list.filter((b) => b.is_main).map((b) => ({ id: b.id, name: b.name, code: b.code })));
    })();

    return () => { cancelled = true; };
  }, [countryId]);

  // Load City Branches when Main Branch changes
  useEffect(() => {
    let cancelled = false;
    setCityBranchId("");
    setCityBranches([]);
    if (!countryId || !countryBranchId) return;

    (async () => {
      const res = await fetch(
        `/api/branch-management/city-branches?countryId=${encodeURIComponent(countryId)}&countryBranchId=${encodeURIComponent(
          countryBranchId
        )}`,
        { cache: "no-store" }
      );
      if (!res.ok) return;
      const json = (await res.json()) as { cityBranches?: Array<{ id: string; name: string; code: string; city_name: string }> };
      const list = Array.isArray(json.cityBranches) ? json.cityBranches : [];
      if (!cancelled) setCityBranches(list.map((b) => ({ id: b.id, name: b.name, code: b.code, city_name: b.city_name })));
    })();

    return () => { cancelled = true; };
  }, [countryId, countryBranchId]);

  // Handle Employee Dropdown Selection
  const handleSelectEmployee = (empId: string) => {
    setSelectedEmployeeId(empId);
    if (!empId) return;

    const emp = employees.find((e) => e.id === empId);
    if (emp) {
      const name = personFullName(emp.person || {}) || emp.name || emp.employee_code;
      setFullName(name);
      if (emp.person?.email || emp.email) {
        setEmail(emp.person?.email || emp.email);
      } else {
        const cleanName = name.toLowerCase().replace(/[^a-z0-9]/g, ".");
        setEmail(`${cleanName}@dgt.llc`);
      }
      setPhone(emp.person?.mobile || emp.person?.whatsapp || emp.phone || "");
      setDepartment(emp.department || "");
      setDesignation(emp.designation || "");
      if (emp.country_id && kind !== "super_admin") {
        setCountryId(emp.country_id);
      }
      if (emp.country_branch_id && kind !== "super_admin") {
        setCountryBranchId(emp.country_branch_id);
      }
      if (emp.city_branch_id && kind !== "super_admin") {
        setCityBranchId(emp.city_branch_id);
      }
    }
  };

  const selectedCountry = useMemo(() => countries.find((c) => c.id === countryId) ?? null, [countries, countryId]);
  const selectedMainBranch = useMemo(() => mainBranches.find((b) => b.id === countryBranchId) ?? null, [mainBranches, countryBranchId]);
  const selectedCityBranch = useMemo(() => cityBranches.find((b) => b.id === cityBranchId) ?? null, [cityBranches, cityBranchId]);

  // Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessResult(null);

    if (!fullName.trim() || !email.trim()) {
      setErrorMessage("Full Name and Email are mandatory.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        password,
        phone: phone.trim() || undefined,
        preferredLanguage,
        role,
        countryId: kind === "super_admin" ? undefined : countryId || undefined,
        countryBranchId: kind === "super_admin" ? undefined : countryBranchId || undefined,
        cityBranchId: kind === "super_admin" ? undefined : cityBranchId || undefined,
        department: department.trim() || undefined,
        designation: designation.trim() || undefined
      };

      const res = await fetch("/api/erp/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create user");
      }

      setSuccessResult(data);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to create user");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6" dir={isRtl ? "rtl" : "ltr"}>
      {/* 2-Column Split: Left = Compact Form, Right = Live Report & Profile Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* LEFT COLUMN: User Setup Form */}
        <div className="lg:col-span-7 bg-card rounded-2xl border border-border p-5 sm:p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-emerald-600" />
                {tt("uf.form_title", "User Setup & Credential Form")}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {tt("uf.form_sub", "Select from Employee Master or register a new administrative account.")}
              </p>
            </div>
            <Badge variant="outline" className="font-bold text-xs uppercase text-emerald-700 bg-emerald-50 border-emerald-300">
              {roleOptions[0]?.label || kind}
            </Badge>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* EMPLOYEE PICKER DROPDOWN (Mulazim ka Naam) */}
            <div className="p-3.5 bg-sky-50/50 dark:bg-sky-950/20 rounded-xl border border-sky-200 dark:border-sky-900 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-sky-900 dark:text-sky-300 flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-sky-600" />
                  {tt("uf.select_employee", "Select Registered Employee")}:
                </Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setShowNewEmployeeModal(true)}
                  className="h-6.5 text-[11px] font-bold text-sky-700 border-sky-300 hover:bg-sky-100 gap-1"
                >
                  <UserPlus className="h-3 w-3" />
                  {tt("uf.new_employee", "+ New Employee")}
                </Button>
              </div>

              <select
                value={selectedEmployeeId}
                onChange={(e) => handleSelectEmployee(e.target.value)}
                className="h-9 w-full rounded-lg border border-sky-300 bg-white px-3 text-xs font-semibold text-slate-800 shadow-xs dark:bg-slate-950 dark:text-slate-200"
              >
                <option value="">{tt("uf.choose_employee", "-- Choose Employee (or type manually below) --")}</option>
                {employees.map((emp) => {
                  const empName = personFullName(emp.person || {}) || emp.name || emp.employee_code;
                  return (
                    <option key={emp.id} value={emp.id}>
                      {empName} ({emp.employee_code}) - {emp.department || "General"} / {emp.designation || "Staff"}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Basic Info Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{tt("uf.full_name", "Full Name")} *</Label>
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder={tt("uf.full_name_ph", "e.g. Asmat Abdullah")}
                  className="h-9 text-xs"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{tt("uf.login_email", "Login Email")} *</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@dgt.llc"
                  className="h-9 text-xs"
                  required
                />
              </div>
            </div>

            {/* Phone & Language */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{tt("uf.phone", "Contact Mobile / Phone")}</Label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+92 300 1234567"
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{tt("uf.preferred_lang", "Preferred Language")}</Label>
                <select
                  value={preferredLanguage}
                  onChange={(e) => setPreferredLanguage(e.target.value)}
                  className="h-9 w-full rounded-lg border border-input bg-background px-3 text-xs font-medium"
                >
                  {supportedLanguages.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.englishName} ({l.nativeName})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Role & Password */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{tt("uf.assigned_role", "Assigned Role")}</Label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as EnterpriseRole)}
                  className="h-9 w-full rounded-lg border border-input bg-background px-3 text-xs font-semibold"
                >
                  {roleOptions.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-muted-foreground">{scopeHelpByKind[kind]}</p>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">{tt("uf.password_key", "Password / Key")}</Label>
                  <button
                    type="button"
                    onClick={() => setPassword(generateSecurePassword())}
                    className="text-[10px] font-bold text-sky-600 hover:underline flex items-center gap-1"
                  >
                    <RefreshCw className="h-2.5 w-2.5" />
                    {tt("uf.auto_generate", "Auto-Generate")}
                  </button>
                </div>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-9 pr-9 font-mono text-xs"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Scope / Location Selection (Disabled for Super Admin) */}
            {kind !== "super_admin" && (
              <div className="p-3.5 rounded-xl border bg-slate-50/60 dark:bg-slate-900/40 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-emerald-600" />
                    {tt("uf.scope_title", "Operational Location Scope")}
                  </Label>
                  <span className="text-[10px] text-muted-foreground">{tt("uf.central_branch", "Centralized Branch Hierarchy")}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <SearchSelect
                      label={loadingCountries ? tt("common.loading", "Loading...") : tt("common.country", "Country")}
                      value={countryId}
                      placeholder={tt("common.country", "Country")}
                      options={countries.map((c) => ({ value: c.id, label: `${c.name} (${c.currency_code})` }))}
                      disabled={loadingCountries}
                      onValueChange={(value) => setCountryId(value)}
                    />
                  </div>
                  <div>
                    <SearchSelect
                      label={tt("uf.main_branch", "Main Branch")}
                      value={countryBranchId}
                      placeholder={countryId ? tt("uf.main_branch", "Main Branch") : tt("common.country", "Country") + " first"}
                      options={mainBranches.map((b) => ({ value: b.id, label: `${b.name} (${b.code})` }))}
                      disabled={!countryId}
                      onValueChange={(value) => setCountryBranchId(value)}
                    />
                  </div>
                  <div>
                    <SearchSelect
                      label={tt("uf.city_branch", "City Branch")}
                      value={cityBranchId}
                      placeholder={countryBranchId ? tt("uf.city_branch", "City Branch") : tt("uf.main_branch", "Main Branch") + " first"}
                      options={cityBranches.map((b) => ({ value: b.id, label: `${b.city_name} - ${b.name}` }))}
                      disabled={!countryId || !countryBranchId}
                      onValueChange={(value) => setCityBranchId(value)}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Error Message */}
            {errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs flex items-center gap-2 font-medium">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {errorMessage}
              </div>
            )}

            {/* Success Result */}
            {successResult && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs space-y-1.5">
                <div className="font-bold flex items-center gap-1.5 text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" />
                  User #{successResult.user?.user_code || "NEW"} Created Successfully!
                </div>
                <div className="font-mono text-[11px] text-slate-700">
                  {tt("uf.login_url", "Login URL:")} <span className="font-bold">{successResult.user?.login_url || "/login"}</span>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-2 border-t">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setFullName("");
                  setEmail("");
                  setPhone("");
                  setSelectedEmployeeId("");
                  setSuccessResult(null);
                  setErrorMessage(null);
                }}
                className="text-xs"
              >
                {tt("uf.clear_form", "Clear Form")}
              </Button>

              <Button
                type="submit"
                disabled={submitting}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-5 h-9 rounded-xl gap-1.5 shadow-sm"
              >
                <UserCheck className="h-4 w-4" />
                {submitting ? tt("uf.creating", "Creating & Encrypting...") : tt("uf.create_user", "Create User & Sync Vault")}
              </Button>
            </div>
          </form>
        </div>

        {/* RIGHT COLUMN: Live Report & User Profile Preview Card */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-5 shadow-lg border border-slate-700 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-700/80 pb-3">
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black text-sm border border-emerald-500/30">
                  {fullName ? fullName.slice(0, 2).toUpperCase() : "USR"}
                </div>
                <div>
                  <h3 className="font-black text-sm text-white">{tt("uf.preview_title", "Live User Profile Preview")}</h3>
                  <p className="text-[10px] text-slate-300">{tt("uf.preview_sub", "Real-time credentials & scope summary")}</p>
                </div>
              </div>
              <Badge className="bg-emerald-600 text-white font-bold text-[10px] uppercase">
                {role.replace(/_/g, " ")}
              </Badge>
            </div>

            {/* Profile Data List */}
            <div className="space-y-2 text-xs">
              <div className="flex justify-between p-2 rounded-lg bg-slate-800/60 border border-slate-700/50">
                <span className="text-slate-400 font-medium">{tt("uf.full_name_label", "Full Name:")}</span>
                <span className="font-bold text-white">{fullName || "—"}</span>
              </div>

              <div className="flex justify-between p-2 rounded-lg bg-slate-800/60 border border-slate-700/50">
                <span className="text-slate-400 font-medium">{tt("uf.email_label", "Login Email:")}</span>
                <span className="font-mono text-emerald-400 font-bold">{email || "—"}</span>
              </div>

              <div className="flex justify-between p-2 rounded-lg bg-slate-800/60 border border-slate-700/50">
                <span className="text-slate-400 font-medium">{tt("uf.phone_label", "Phone:")}</span>
                <span className="font-mono text-slate-200">{phone || "—"}</span>
              </div>

              <div className="flex justify-between p-2 rounded-lg bg-slate-800/60 border border-slate-700/50">
                <span className="text-slate-400 font-medium">{tt("uf.scope_label", "Assigned Scope:")}</span>
                <span className="font-bold text-sky-400 text-right truncate max-w-[180px]">
                  {kind === "super_admin"
                    ? tt("uf.global_scope", "Global (All Countries)")
                    : `${selectedCountry?.name || "Any Country"} / ${selectedCityBranch?.name || selectedMainBranch?.name || "Main Branch"}`}
                </span>
              </div>

              <div className="flex justify-between p-2 rounded-lg bg-slate-800/60 border border-slate-700/50">
                <span className="text-slate-400 font-medium">{tt("uf.password_label", "Password Key:")}</span>
                <div className="flex items-center gap-1.5 font-mono text-amber-400 font-bold">
                  <span>{password ? "••••••••" : "—"}</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(password);
                      setCopiedKey(true);
                      setTimeout(() => setCopiedKey(false), 2000);
                    }}
                    className="text-[10px] text-slate-400 hover:text-white"
                    title={tt("uf.copy_password", "Copy Password")}
                  >
                    {copiedKey ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Permission Coverage Indicator */}
            <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-slate-300 flex items-center gap-1">
                  <Shield className="h-3.5 w-3.5 text-indigo-400" />
                  {tt("uf.security_tier", "Security Tier & Vault:")}
                </span>
                <span className="text-emerald-400 font-mono font-bold text-[10px]">{tt("uf.encrypted", "ENCRYPTED / SYNCED")}</span>
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                {tt("uf.vault_desc", "Upon creation, credentials are automatically synchronized with the Super Admin Credential Vault and an immutable audit event is recorded.")}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Modal for creating a new Employee if not present */}
      <SimpleModal
        isOpen={showNewEmployeeModal}
        onClose={() => setShowNewEmployeeModal(false)}
        title={tt("uf.modal_title", "Register New Employee in HR Master")}
      >
        <EmployeeForm
          lang="en"
          onSave={() => {
            setShowNewEmployeeModal(false);
            fetchEmployees();
          }}
          onCancel={() => setShowNewEmployeeModal(false)}
        />
      </SimpleModal>
    </div>
  );
}
