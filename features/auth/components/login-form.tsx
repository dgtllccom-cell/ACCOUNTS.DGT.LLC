"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  ChevronDown,
  Eye,
  EyeOff,
  Globe,
  LockKeyhole,
  Mail,
  MapPin,
  ShieldCheck,
  UserCircle2,
  Loader2,
  Server,
  AlertCircle,
  CheckCircle2,
  Sparkles
} from "lucide-react";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { t } from "@/lib/i18n/ui";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { listCountries, listCities, type LocationCountry, type LocationCity } from "@/features/master-forms";

export type LoginTab = "super_admin" | "country" | "city" | "branch" | "agent";

const TABS: { id: LoginTab; label: string; shortKey: string }[] = [
  { id: "super_admin", label: "Super Admin", shortKey: "login.tab_admin" },
  { id: "country", label: "Country Admin", shortKey: "login.tab_country" },
  { id: "city", label: "City Branch", shortKey: "login.tab_city" },
  { id: "branch", label: "Branch User", shortKey: "login.tab_branch" },
  { id: "agent", label: "Clearing Agent", shortKey: "login.tab_agent" },
];

const ACCESS_PROFILES: Record<
  LoginTab,
  {
    eyebrow: string;
    title: string;
    subtitle: string;
    note: string;
    scopeLabel: string;
    formatPlaceholder: string;
    quickExamples: string[];
  }
> = {
  super_admin: {
    eyebrow: "Global ERP Control",
    title: "Super Admin Access",
    subtitle: "Full system visibility for configuration, audit, reporting, and cross-country administration.",
    note: "Use this entry point for global ERP operations and security oversight.",
    scopeLabel: "All countries, all branches",
    formatPlaceholder: "superadmin@dgt.llc or admin@dgt.llc",
    quickExamples: ["superadmin@dgt.llc", "admin@dgt.llc"]
  },
  country: {
    eyebrow: "Country Workspace",
    title: "Country Admin Access",
    subtitle: "Scoped access for country-level operations, master data, and business oversight.",
    note: "Format: {countryCode}.{countryName}@dgt.llc (e.g. pk.pakistan@dgt.llc, ae.uae@dgt.llc).",
    scopeLabel: "Country-level access",
    formatPlaceholder: "pk.pakistan@dgt.llc, ae.uae@dgt.llc, af.afghanistan@dgt.llc",
    quickExamples: ["pk.pakistan@dgt.llc", "ae.uae@dgt.llc", "af.afghanistan@dgt.llc", "in.india@dgt.llc", "cn.china@dgt.llc"]
  },
  city: {
    eyebrow: "City Branch Workspace",
    title: "City Branch Access",
    subtitle: "Operational entry for city-specific teams with branch-aware ERP workflows.",
    note: "Format: {cityName}.branch.b@dgt.llc (e.g. chaman.branch.b@dgt.llc, dubai.branch.b@dgt.llc).",
    scopeLabel: "City branch access",
    formatPlaceholder: "chaman.branch.b@dgt.llc, dubai.branch.b@dgt.llc",
    quickExamples: ["chaman.branch.b@dgt.llc", "dubai.branch.b@dgt.llc", "quetta.branch.b@dgt.llc", "kabul.branch.b@dgt.llc"]
  },
  branch: {
    eyebrow: "Branch Operations",
    title: "Branch User Access",
    subtitle: "Focused access for branch users handling local transactions, reports, and approvals.",
    note: "Format: {cityName}.branch.b@dgt.llc",
    scopeLabel: "Branch-level access",
    formatPlaceholder: "chaman.branch.b@dgt.llc, dubai.branch.b@dgt.llc",
    quickExamples: ["chaman.branch.b@dgt.llc", "dubai.branch.b@dgt.llc", "quetta.branch.b@dgt.llc"]
  },
  agent: {
    eyebrow: "Shipping & Clearing",
    title: "Clearing Agent Access",
    subtitle: "Workflow access for shipping line and clearing operations with linked order visibility.",
    note: "Format: {countryCode}.clearingagent@dgt.llc or {cityName}.clearingagent.c@dgt.llc",
    scopeLabel: "Agent workflow access",
    formatPlaceholder: "pk.clearingagent@dgt.llc, chaman.clearingagent.c@dgt.llc",
    quickExamples: ["pk.clearingagent@dgt.llc", "ae.clearingagent@dgt.llc", "chaman.clearingagent.c@dgt.llc", "dubai.clearingagent.c@dgt.llc"]
  },
};

const LANGUAGES = [
  { code: "en", name: "English", flag: "🇺🇸" },
  { code: "ur", name: "اردو", flag: "🇵🇰" },
  { code: "ps", name: "پښتو", flag: "🇦🇫" },
  { code: "ar", name: "العربية", flag: "🇦🇪" },
  { code: "fa", name: "فارسی", flag: "🇮🇷" },
];

const DEFAULT_COUNTRIES = ["Pakistan", "Afghanistan", "United Arab Emirates", "Saudi Arabia", "India", "China"];
const DEFAULT_CITIES: Record<string, string[]> = {
  Pakistan: ["Chaman", "Quetta", "Karachi", "Lahore", "Islamabad", "Peshawar", "Gwadar", "Torkham"],
  Afghanistan: ["Kabul", "Kandahar", "Herat", "Spin Boldak", "Mazar-i-Sharif"],
  "United Arab Emirates": ["Dubai", "Abu Dhabi", "Sharjah", "Jebel Ali"],
  "Saudi Arabia": ["Riyadh", "Jeddah", "Dammam", "Mecca"],
  India: ["Delhi", "Mumbai", "Attari", "Bangalore"],
  China: ["Shenzhen", "Dalian", "Guangzhou", "Shanghai"]
};
const BRANCHES = ["Main Branch", "North Branch", "South Branch", "East Branch", "West Branch"];

function SelectField({
  label,
  name,
  icon: Icon,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  name: string;
  icon: React.ElementType;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
        {label}
      </label>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" aria-hidden />
        <select
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-12 w-full appearance-none rounded-xl border border-slate-200 bg-white pl-10 pr-10 text-xs sm:text-sm font-semibold text-slate-700 shadow-xs outline-none transition-all focus:border-blue-600 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:focus:border-blue-400 dark:focus:ring-blue-950"
        >
          <option value="">{placeholder}</option>
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3.5 top-3.5 h-4 w-4 text-slate-400" aria-hidden />
      </div>
    </div>
  );
}

export function LoginForm({
  lang: initialLang,
  initialTab = "super_admin",
  showRoleTabs = true,
}: {
  lang?: SupportedLanguage;
  initialTab?: LoginTab;
  showRoleTabs?: boolean;
}) {
  const [activeTab, setActiveTab] = useState<LoginTab>(initialTab);
  const [selectedLang, setSelectedLang] = useState<string>(initialLang || "en");
  const [showPassword, setShowPassword] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorState, setErrorState] = useState<string | null>(null);
  const [idFocused, setIdFocused] = useState(false);
  const [pwFocused, setPwFocused] = useState(false);

  const lang = (selectedLang || "en") as SupportedLanguage;
  const tt = (key: string, fallback: string) => t(lang, key as never, fallback);

  const [masterCountries, setMasterCountries] = useState<LocationCountry[]>([]);
  const [masterCities, setMasterCities] = useState<LocationCity[]>([]);

  useEffect(() => {
    setActiveTab(initialTab);
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const emailParam = params.get("email");
      if (emailParam) {
        setIdentifier(emailParam);
      }
    }
  }, [initialTab]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await listCountries();
        if (!cancelled && rows && rows.length > 0) {
          setMasterCountries(rows);
        }
      } catch {
        // Fallback to default
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const countryOptions = masterCountries.length > 0 ? masterCountries.map((c) => c.name) : DEFAULT_COUNTRIES;

  useEffect(() => {
    let cancelled = false;
    setMasterCities([]);
    if (!selectedCountry) return;

    const matchedCountry = masterCountries.find((c) => c.name === selectedCountry || c.id === selectedCountry);
    if (matchedCountry) {
      (async () => {
        try {
          const rows = await listCities({ countryId: matchedCountry.id });
          if (!cancelled) setMasterCities(rows);
        } catch {
          // Fallback to default
        }
      })();
    }
    return () => {
      cancelled = true;
    };
  }, [selectedCountry, masterCountries]);

  const availableCities =
    masterCities.length > 0
      ? masterCities.map((c) => c.name)
      : selectedCountry
      ? DEFAULT_CITIES[selectedCountry] ?? []
      : [];

  const needsCountry = ["country", "city", "branch", "agent"].includes(activeTab);
  const needsCity = ["city", "branch", "agent"].includes(activeTab);
  const needsBranch = ["branch"].includes(activeTab);

  function handleTabChange(tab: LoginTab) {
    setActiveTab(tab);
    setSelectedCountry("");
    setSelectedCity("");
    setSelectedBranch("");
    setErrorState(null);
  }

  // Smart Username Generator based on selected country & city
  function generateSuggestedUsername() {
    const cCode = selectedCountry === "Pakistan" ? "PK" :
                  selectedCountry === "Afghanistan" ? "AF" :
                  selectedCountry === "United Arab Emirates" ? "AE" :
                  selectedCountry === "India" ? "IN" :
                  selectedCountry === "China" ? "CN" : "";
    
    if (activeTab === "country" && selectedCountry) {
      if (selectedCountry === "United Arab Emirates") return "UAE@DGT.DALNC";
      return `${selectedCountry.toUpperCase()}@DGT.LLC`;
    }
    if (activeTab === "city" && cCode && selectedCity) {
      const cityCode = selectedCity.toUpperCase().replace(/\s+/g, "");
      if (cCode === "AF" && cityCode === "KABUL") return "AF/KABUL@DGT.DALNC";
      return `${cCode}/${cityCode}@DGT.LLC`;
    }
    if (activeTab === "agent" && cCode) {
      if (selectedCity) {
        const shortCity = selectedCity.substring(0, 3).toUpperCase();
        return `${cCode}/${shortCity}/CLEARINGAGENT@DGT.DALNC`;
      }
      return `${cCode}/CLEARINGAGENT@DGT.LLC`;
    }
    return "";
  }

  const suggestedUser = generateSuggestedUsername();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorState(null);

    if (!identifier.trim() || !password.trim()) {
      setErrorState(tt("login.err_required", "Please enter both User ID / Email and Password."));
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/erp/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify({
          identifier: identifier.trim(),
          password: password.trim(),
          remember: rememberMe,
          login_type: activeTab,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 401) {
          throw new Error(data.error || "Invalid User ID or Password. Only authorized ERP users can log in.");
        } else if (res.status === 503) {
          throw new Error("ERP Production Server (72.60.209.121) is temporarily unavailable. Please try again.");
        } else {
          throw new Error(data.error || "Authentication failed. Unauthorized user access.");
        }
      }

      // Successful login redirect to dashboard
      window.location.href = data.redirectUrl || "/dashboard";
    } catch (err: any) {
      setErrorState(err.message || "Invalid credentials or unauthorized user.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full rounded-[2rem] border border-slate-200/80 bg-white/95 p-4 shadow-xl shadow-slate-900/5 backdrop-blur-sm sm:p-6 dark:border-slate-800 dark:bg-slate-950/90 dark:shadow-black/20">
      {/* ── Server Connection Status Badge ── */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-100/90 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 px-3 py-2 text-[11px] font-bold">
        <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <span className="font-mono text-[10.5px]">Production Cloud Server (72.60.209.121)</span>
        </div>
        <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-[10px] font-extrabold">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>{tt("login.secure_access", "Secure Upcountry ERP Access")}</span>
        </div>
      </div>

      {/* ── Welcome Heading ── */}
      <div className="mb-4 text-center sm:text-left">
        <h2 className="text-xl sm:text-2xl font-black leading-tight tracking-tight text-slate-900 dark:text-white">
          {tt("login.welcome_title", "Welcome to Digital Dock ERP")}
        </h2>
        <p className="mt-1 text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400">
          {tt("login.welcome_sub", "Authorized Multi-Country Enterprise Management System")}
        </p>
      </div>

      {/* ── 5-Language Switcher Pills ── */}
      <div className="mb-4">
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1">
          <Globe className="h-3 w-3 text-blue-600" /> {tt("login.select_lang", "Select System Language")}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              type="button"
              onClick={() => {
                setSelectedLang(l.code);
                if (typeof window !== "undefined") {
                  try {
                    localStorage.setItem("erp_lang", l.code);
                    document.cookie = `erp_lang=${encodeURIComponent(l.code)}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax`;
                    const isRtl = ["ar", "ur", "fa", "ps"].includes(l.code);
                    document.documentElement.lang = l.code;
                    document.documentElement.dir = isRtl ? "rtl" : "ltr";
                    const headerSelect = document.querySelector('select[aria-label="Language"]') as HTMLSelectElement | null;
                    if (headerSelect && headerSelect.value !== l.code) {
                      headerSelect.value = l.code;
                      headerSelect.dispatchEvent(new Event("change", { bubbles: true }));
                    }
                  } catch (e) {}
                }
              }}
              className={cn(
                "flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer",
                selectedLang === l.code
                  ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                  : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800"
              )}
            >
              <span>{l.flag}</span>
              <span>{l.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Role Scope Pills ── */}
      {showRoleTabs && (
        <div className="mb-4 flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-slate-100/90 p-1.5 shadow-xs no-scrollbar dark:border-slate-800 dark:bg-slate-800/60">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              aria-label={tab.label}
              title={tab.label}
              onClick={() => handleTabChange(tab.id)}
              className={cn(
                "shrink-0 flex-1 rounded-xl px-3 py-2 text-[9px] sm:text-[9.5px] font-black uppercase tracking-[0.14em] text-center whitespace-nowrap transition-all duration-200 cursor-pointer border",
                activeTab === tab.id
                  ? "border-slate-900 bg-slate-900 text-white shadow-md shadow-slate-900/10 dark:border-white dark:bg-white dark:text-slate-900"
                  : "border-transparent bg-transparent text-slate-500 hover:border-slate-200 hover:bg-white hover:text-slate-900 dark:text-slate-400 dark:hover:border-slate-700 dark:hover:bg-slate-900/60 dark:hover:text-white"
              )}
            >
              {tt(tab.shortKey, tab.label)}
            </button>
          ))}
        </div>
      )}

      {/* ── Role Header Banner ── */}
      <div className="mb-4 rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-blue-50 p-4 shadow-[0_12px_30px_rgba(15,23,42,0.06)] dark:border-slate-800 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-blue-700 dark:text-blue-300">
              {ACCESS_PROFILES[activeTab].eyebrow}
            </p>
            <h3 className="mt-1 text-lg font-black tracking-tight text-slate-900 dark:text-white">
              {ACCESS_PROFILES[activeTab].title}
            </h3>
            <p className="mt-1 text-xs leading-5 font-medium text-slate-600 dark:text-slate-400">
              {ACCESS_PROFILES[activeTab].subtitle}
            </p>
          </div>
          <div className="hidden sm:flex flex-col items-end gap-1 rounded-2xl border border-blue-100 bg-white px-3 py-2 text-right shadow-sm dark:border-blue-900/40 dark:bg-slate-900">
            <span className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-400">{tt("login.scope_heading", "Scope")}</span>
            <span className="text-[11px] font-extrabold text-blue-700 dark:text-blue-300">
              {ACCESS_PROFILES[activeTab].scopeLabel}
            </span>
          </div>
        </div>
        <p className="mt-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
          {ACCESS_PROFILES[activeTab].note}
        </p>
      </div>

      {/* ── Error Banner ── */}
      {errorState && (
        <div className="mb-4 flex items-start gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-xs font-bold text-rose-700 shadow-sm dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300 animate-in fade-in zoom-in-95 duration-150">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
          <div>{errorState}</div>
        </div>
      )}

      {/* ── Login Form ── */}
      <form method="post" action="/api/erp/auth/login" onSubmit={handleSubmit} className="space-y-4">
        {needsCountry && (
          <SelectField
            label={tt("login.country_scope", "Country Scope")}
            name="country"
            icon={Globe}
            value={selectedCountry}
            onChange={(v) => {
              setSelectedCountry(v);
              setSelectedCity("");
              setSelectedBranch("");
            }}
            options={countryOptions}
            placeholder={tt("login.select_country", "Select Country")}
          />
        )}

        {needsCity && (
          <SelectField
            label={tt("login.city_scope", "City Branch Scope")}
            name="city"
            icon={MapPin}
            value={selectedCity}
            onChange={(v) => {
              setSelectedCity(v);
              setSelectedBranch("");
            }}
            options={availableCities}
            placeholder={selectedCountry ? tt("login.select_city", "Select City") : tt("login.select_country_first", "Select a country first")}
          />
        )}

        {needsBranch && (
          <SelectField
            label={tt("login.tab_branch", "Branch")}
            name="branch"
            icon={Building2}
            value={selectedBranch}
            onChange={setSelectedBranch}
            options={BRANCHES}
            placeholder={tt("login.select_branch", "Select Branch")}
          />
        )}

        {/* Email / User ID */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="identifier" className="block text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              {tt("login.email_label", "Username / User ID (e.g. CountryCode/CityCode@DGT.LLC)")}
            </label>
            {suggestedUser && (
              <button
                type="button"
                onClick={() => setIdentifier(suggestedUser)}
                className="text-[10.5px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Sparkles className="h-3 w-3" /> Auto-fill: <span className="font-mono font-black">{suggestedUser}</span>
              </button>
            )}
          </div>
          <div className="relative">
            <Mail
              className={cn(
                "pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 transition-colors duration-200",
                idFocused ? "text-blue-600" : "text-slate-400"
              )}
              aria-hidden
            />
            <Input
              id="identifier"
              name="identifier"
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              onFocus={() => setIdFocused(true)}
              onBlur={() => setIdFocused(false)}
              className="h-12 rounded-xl border border-slate-200 bg-white pl-10 font-mono text-xs sm:text-sm font-bold shadow-xs placeholder:font-sans placeholder:font-normal placeholder:text-slate-400 transition-all focus-visible:border-blue-600 focus-visible:ring-4 focus-visible:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:focus-visible:border-blue-400 dark:focus-visible:ring-blue-950"
              placeholder={ACCESS_PROFILES[activeTab].formatPlaceholder}
              autoComplete="username"
              required
            />
          </div>

          {/* Quick Format Picker Badges */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{tt("login.quick_pick", "Quick Pick:")}</span>
            {ACCESS_PROFILES[activeTab].quickExamples.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setIdentifier(ex)}
                className="rounded-lg bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10.5px] font-bold font-mono text-slate-700 dark:text-slate-300 hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-blue-950 dark:hover:text-blue-300 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              {tt("login.password_label", "Password")}
            </label>
            <Link
              href="/auth/forgot-password"
              className="text-[11px] font-bold text-blue-600 hover:text-blue-700 transition-colors hover:underline dark:text-blue-400"
            >
              {tt("login.forgot_password", "Forgot Password?")}
            </Link>
          </div>
          <div className="relative">
            <LockKeyhole
              className={cn(
                "pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 transition-colors duration-200",
                pwFocused ? "text-blue-600" : "text-slate-400"
              )}
              aria-hidden
            />
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onFocus={() => setPwFocused(true)}
              onBlur={() => setPwFocused(false)}
              className="h-12 rounded-xl border border-slate-200 bg-white pl-10 pr-12 text-xs sm:text-sm font-semibold shadow-xs placeholder:font-normal placeholder:text-slate-400 transition-all focus-visible:border-blue-600 focus-visible:ring-4 focus-visible:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:focus-visible:border-blue-400 dark:focus-visible:ring-blue-950"
              placeholder="••••••••••••"
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              className="absolute right-3 top-2 inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Remember me */}
        <div className="flex items-center gap-2 pt-0.5">
          <input
            id="remember"
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-blue-600 dark:accent-blue-400"
          />
          <label htmlFor="remember" className="cursor-pointer select-none text-xs font-semibold text-slate-600 dark:text-slate-400">
            {tt("login.remember_me", "Remember Me")}
          </label>
        </div>

        {/* Secure Login Button */}
        <Button
          type="submit"
          disabled={loading}
          className="h-12 w-full rounded-2xl bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 px-4 text-xs font-black tracking-[0.08em] text-white shadow-[0_12px_30px_rgba(30,64,175,0.24)] transition-all duration-200 hover:-translate-y-0.5 hover:from-blue-800 hover:via-indigo-800 hover:to-blue-900 hover:shadow-[0_16px_36px_rgba(30,64,175,0.28)] sm:text-sm cursor-pointer"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-white" />
              {tt("login.authenticating", "Authenticating Security Credentials...")}
            </>
          ) : (
            <>
              <ShieldCheck className="h-4 w-4 text-white" />
              {tt("login.btn", "SECURE ERP LOGIN")} <ArrowRight className="h-4 w-4 ml-1" />
            </>
          )}
        </Button>
      </form>

      {/* Security footer note */}
      <div className="mt-5 flex items-center justify-center gap-2 border-t border-slate-100 pt-4 text-[10.5px] font-bold text-slate-400 dark:border-slate-800">
        <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" />
        <span>{tt("login.footer", "Private ERP System • 256-Bit SSL Encrypted Access Only")}</span>
      </div>
    </div>
  );
}
