"use client";

import { useState } from "react";
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
  CheckCircle2
} from "lucide-react";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type LoginTab = "super_admin" | "country" | "city" | "branch" | "agent";

const TABS: { id: LoginTab; label: string }[] = [
  { id: "super_admin", label: "Super Admin" },
  { id: "country", label: "Country" },
  { id: "city", label: "City" },
  { id: "branch", label: "Branch" },
  { id: "agent", label: "Agent" },
];

const LANGUAGES = [
  { code: "en", name: "English", flag: "🇺🇸" },
  { code: "ur", name: "اردو", flag: "🇵🇰" },
  { code: "ps", name: "پښتو", flag: "🇦🇫" },
  { code: "ar", name: "العربية", flag: "🇦🇪" },
  { code: "fa", name: "فارسی", flag: "🇮🇷" },
];

const COUNTRIES = ["Pakistan", "Afghanistan", "UAE", "Saudi Arabia", "United Kingdom"];
const CITIES: Record<string, string[]> = {
  Pakistan: ["Quetta", "Karachi", "Lahore", "Islamabad", "Peshawar"],
  Afghanistan: ["Kabul", "Kandahar", "Herat", "Mazar-i-Sharif"],
  UAE: ["Dubai", "Abu Dhabi", "Sharjah", "Ajman"],
  "Saudi Arabia": ["Riyadh", "Jeddah", "Dammam", "Mecca"],
  "United Kingdom": ["London", "Manchester", "Birmingham", "Leeds"],
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

export function LoginForm({ lang: initialLang }: { lang?: SupportedLanguage }) {
  const [activeTab, setActiveTab] = useState<LoginTab>("super_admin");
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

  const availableCities = selectedCountry ? CITIES[selectedCountry] ?? [] : [];
  const needsCountry = ["country", "city", "branch", "agent"].includes(activeTab);
  const needsCity = ["city", "branch", "agent"].includes(activeTab);
  const needsBranch = ["branch", "agent"].includes(activeTab);

  function handleTabChange(tab: LoginTab) {
    setActiveTab(tab);
    setSelectedCountry("");
    setSelectedCity("");
    setSelectedBranch("");
    setErrorState(null);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorState(null);

    if (!identifier.trim() || !password.trim()) {
      setErrorState("Please enter both User ID / Email and Password.");
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
    <div className="w-full">
      {/* ── Server Connection Status Badge ── */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-100/90 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 px-3 py-2 text-[11px] font-bold">
        <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <span className="font-mono text-[10.5px]">Server Connected (72.60.209.121)</span>
        </div>
        <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-[10px] font-extrabold">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>Secure ERP Access</span>
        </div>
      </div>

      {/* ── Welcome Heading ── */}
      <div className="mb-4 text-center sm:text-left">
        <h2 className="text-xl sm:text-2xl font-black leading-tight tracking-tight text-slate-900 dark:text-white">
          Welcome to Digital Dock ERP
        </h2>
        <p className="mt-1 text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400">
          Authorized Multi-Country Enterprise Management System
        </p>
      </div>

      {/* ── 5-Language Switcher Pills ── */}
      <div className="mb-4">
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1">
          <Globe className="h-3 w-3 text-blue-600" /> Select System Language
        </div>
        <div className="flex flex-wrap gap-1.5">
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              type="button"
              onClick={() => setSelectedLang(l.code)}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all border",
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
      <div className="mb-4 flex overflow-x-auto gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-800 dark:bg-slate-800/60 no-scrollbar">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => handleTabChange(tab.id)}
            className={cn(
              "shrink-0 flex-1 rounded-lg px-2.5 py-2 text-[9px] sm:text-[9.5px] font-black uppercase tracking-wider transition-all duration-200 text-center whitespace-nowrap",
              activeTab === tab.id
                ? "bg-slate-900 text-white shadow-xs dark:bg-white dark:text-slate-900"
                : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Error Banner ── */}
      {errorState && (
        <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs font-bold text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300 animate-in fade-in zoom-in-95 duration-150">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
          <div>{errorState}</div>
        </div>
      )}

      {/* ── Login Form ── */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {needsCountry && (
          <SelectField
            label="Country Scope"
            name="country"
            icon={Globe}
            value={selectedCountry}
            onChange={(v) => {
              setSelectedCountry(v);
              setSelectedCity("");
              setSelectedBranch("");
            }}
            options={COUNTRIES}
            placeholder="Select Country"
          />
        )}

        {needsCity && (
          <SelectField
            label="City Branch Scope"
            name="city"
            icon={MapPin}
            value={selectedCity}
            onChange={(v) => {
              setSelectedCity(v);
              setSelectedBranch("");
            }}
            options={availableCities}
            placeholder={selectedCountry ? "Select City" : "Select a country first"}
          />
        )}

        {needsBranch && (
          <SelectField
            label="Branch"
            name="branch"
            icon={Building2}
            value={selectedBranch}
            onChange={setSelectedBranch}
            options={BRANCHES}
            placeholder="Select Branch"
          />
        )}

        {/* Email / User ID */}
        <div className="space-y-1.5">
          <label htmlFor="identifier" className="block text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            Email Address / User ID
          </label>
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
              className="h-12 rounded-xl border border-slate-200 bg-white pl-10 text-xs sm:text-sm font-semibold shadow-xs placeholder:font-normal placeholder:text-slate-400 transition-all focus-visible:border-blue-600 focus-visible:ring-4 focus-visible:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:focus-visible:border-blue-400 dark:focus-visible:ring-blue-950"
              placeholder="Enter User ID or email@damaan.com"
              autoComplete="username"
              required
            />
          </div>
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              Password
            </label>
            <Link
              href="/auth/forgot-password"
              className="text-[11px] font-bold text-blue-600 hover:text-blue-700 transition-colors hover:underline dark:text-blue-400"
            >
              Forgot Password?
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
            Remember Me
          </label>
        </div>

        {/* Secure Login Button */}
        <Button
          type="submit"
          disabled={loading}
          className="h-12 w-full font-black text-xs sm:text-sm tracking-wide text-white shadow-md transition-all duration-200 hover:shadow-lg rounded-xl bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 hover:from-blue-800 hover:to-indigo-800 gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-white" />
              Authenticating Security Credentials...
            </>
          ) : (
            <>
              <ShieldCheck className="h-4 w-4 text-white" />
              SECURE ERP LOGIN <ArrowRight className="h-4 w-4 ml-1" />
            </>
          )}
        </Button>
      </form>

      {/* Security footer note */}
      <div className="mt-5 flex items-center justify-center gap-2 border-t border-slate-100 pt-4 text-[10.5px] font-bold text-slate-400 dark:border-slate-800">
        <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" />
        <span>Private ERP System • 256-Bit SSL Encrypted Access Only</span>
      </div>
    </div>
  );
}
