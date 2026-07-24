"use client";

import { useState } from "react";
import Link from "next/link";
import type { Route } from "next";
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
} from "lucide-react";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────
type LoginTab = "super_admin" | "country" | "city" | "branch" | "agent";

// ─── Tab Metadata ─────────────────────────────────────────────────────────────
const TABS: { id: LoginTab; label: string }[] = [
  { id: "super_admin", label: "Super Admin" },
  { id: "country",    label: "Country"     },
  { id: "city",       label: "City"        },
  { id: "branch",     label: "Branch"      },
  { id: "agent",      label: "Agent"       },
];

const TAB_TITLES: Record<LoginTab, string> = {
  super_admin: "Super Admin Portal",
  country:     "Country Admin Login",
  city:        "City Branch Login",
  branch:      "Branch Login",
  agent:       "Agent Login",
};

const TAB_SUBTITLES: Record<LoginTab, string> = {
  super_admin: "Global Inventory Management System.",
  country:     "Country-level administrative access.",
  city:        "City branch management portal.",
  branch:      "Branch operations management.",
  agent:       "Field agent access portal.",
};

// ─── Static Placeholders (replace with API calls when ready) ─────────────────
const COUNTRIES = ["Pakistan", "Afghanistan", "UAE", "Saudi Arabia", "United Kingdom"];
const CITIES: Record<string, string[]> = {
  Pakistan:        ["Quetta", "Karachi", "Lahore", "Islamabad", "Peshawar"],
  Afghanistan:     ["Kabul", "Kandahar", "Herat", "Mazar-i-Sharif"],
  UAE:             ["Dubai", "Abu Dhabi", "Sharjah", "Ajman"],
  "Saudi Arabia":  ["Riyadh", "Jeddah", "Dammam", "Mecca"],
  "United Kingdom":["London", "Manchester", "Birmingham", "Leeds"],
};
const BRANCHES = [
  "Main Branch", "North Branch", "South Branch", "East Branch", "West Branch",
];

// ─── Select Field ─────────────────────────────────────────────────────────────
function SelectField({
  label, name, icon: Icon, value, onChange, options, placeholder,
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
      <label className="block text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
        {label}
      </label>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-4 top-3.5 h-4 w-4 text-slate-400" aria-hidden />
        <select
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-[48px] w-full appearance-none rounded-xl border border-slate-200 bg-white pl-11 pr-10 text-sm font-semibold text-slate-700 shadow-sm outline-none transition-all focus:border-blue-600 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:focus:border-blue-400 dark:focus:ring-blue-950"
        >
          <option value="">{placeholder}</option>
          {options.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-slate-400" aria-hidden />
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function LoginForm({ lang }: { lang: SupportedLanguage }) {
  const [activeTab,       setActiveTab]       = useState<LoginTab>("super_admin");
  const [showPassword,    setShowPassword]    = useState(false);
  const [selectedCountry, setSelectedCountry] = useState("");
  const [selectedCity,    setSelectedCity]    = useState("");
  const [selectedBranch,  setSelectedBranch]  = useState("");
  const [idFocused,       setIdFocused]       = useState(false);
  const [pwFocused,       setPwFocused]       = useState(false);

  const availableCities  = selectedCountry ? (CITIES[selectedCountry] ?? []) : [];
  const needsCountry     = ["country", "city", "branch", "agent"].includes(activeTab);
  const needsCity        = ["city", "branch", "agent"].includes(activeTab);
  const needsBranch      = ["branch", "agent"].includes(activeTab);

  function handleTabChange(tab: LoginTab) {
    setActiveTab(tab);
    setSelectedCountry("");
    setSelectedCity("");
    setSelectedBranch("");
  }

  return (
    <div className="w-full">
      {/* Title */}
      <div className="mb-5">
        <h2 className="text-[22px] font-black leading-tight tracking-tight text-[#06122d] dark:text-white">
          {TAB_TITLES[activeTab]}
        </h2>
        <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
          {TAB_SUBTITLES[activeTab]}
        </p>
      </div>

      {/* ── Tab Pills ── */}
      <div className="mb-6 flex gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-800 dark:bg-slate-800/60">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            id={`login-tab-${tab.id}`}
            onClick={() => handleTabChange(tab.id)}
            className={cn(
              "flex-1 rounded-lg px-1 py-2 text-[9.5px] font-black uppercase tracking-wider transition-all duration-200",
              activeTab === tab.id
                ? "bg-[#06122d] text-white shadow-sm dark:bg-white dark:text-[#06122d]"
                : "text-slate-500 hover:text-[#06122d] dark:text-slate-400 dark:hover:text-white",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Form ── */}
      <form
        id="erp-login-form"
        method="post"
        action="/api/erp/auth/login?temp=1"
        className="space-y-3.5"
      >
        <input type="hidden" name="login_type" value={activeTab} />

        {/* Country */}
        {needsCountry && (
          <SelectField
            label="Country"
            name="country"
            icon={Globe}
            value={selectedCountry}
            onChange={(v) => { setSelectedCountry(v); setSelectedCity(""); setSelectedBranch(""); }}
            options={COUNTRIES}
            placeholder="Select Country"
          />
        )}

        {/* City */}
        {needsCity && (
          <SelectField
            label="City"
            name="city"
            icon={MapPin}
            value={selectedCity}
            onChange={(v) => { setSelectedCity(v); setSelectedBranch(""); }}
            options={availableCities}
            placeholder={selectedCountry ? "Select City" : "Select a country first"}
          />
        )}

        {/* Branch */}
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

        {/* Email / ID */}
        <div className="space-y-1.5">
          <label
            htmlFor="identifier"
            className="block text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400"
          >
            {activeTab === "agent" ? "Agent ID or Email" : "Email"}
          </label>
          <div className="relative">
            {activeTab === "agent" ? (
              <UserCircle2
                className={cn(
                  "pointer-events-none absolute left-4 top-3.5 h-4 w-4 transition-colors duration-200",
                  idFocused ? "text-blue-600" : "text-slate-400",
                )}
                aria-hidden
              />
            ) : (
              <Mail
                className={cn(
                  "pointer-events-none absolute left-4 top-3.5 h-4 w-4 transition-colors duration-200",
                  idFocused ? "text-blue-600" : "text-slate-400",
                )}
                aria-hidden
              />
            )}
            <Input
              id="identifier"
              name="identifier"
              type="text"
              onFocus={() => setIdFocused(true)}
              onBlur={() => setIdFocused(false)}
              className="h-[48px] rounded-xl border border-slate-200 bg-white pl-11 text-sm font-semibold shadow-sm placeholder:font-normal placeholder:text-slate-400 transition-all focus-visible:border-blue-600 focus-visible:ring-4 focus-visible:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:focus-visible:border-blue-400 dark:focus-visible:ring-blue-950"
              placeholder={
                activeTab === "super_admin" ? "admin@damaan.com"
                : activeTab === "agent"     ? "agent-id or email"
                : "email@damaan.com"
              }
              autoComplete="email"
              required
            />
          </div>
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="password"
              className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400"
            >
              Password
            </label>
            <Link
              href={"/auth/forgot-password" as Route}
              className="text-[11px] font-bold text-blue-700 transition-colors hover:underline dark:text-blue-400"
            >
              Forgot Password?
            </Link>
          </div>
          <div className="relative">
            <LockKeyhole
              className={cn(
                "pointer-events-none absolute left-4 top-3.5 h-4 w-4 transition-colors duration-200",
                pwFocused ? "text-blue-600" : "text-slate-400",
              )}
              aria-hidden
            />
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              onFocus={() => setPwFocused(true)}
              onBlur={() => setPwFocused(false)}
              className="h-[48px] rounded-xl border border-slate-200 bg-white pl-11 pr-12 text-sm font-semibold shadow-sm placeholder:font-normal placeholder:text-slate-400 transition-all focus-visible:border-blue-600 focus-visible:ring-4 focus-visible:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:focus-visible:border-blue-400 dark:focus-visible:ring-blue-950"
              placeholder="••••••••••"
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              className="absolute right-3 top-2.5 inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword
                ? <EyeOff className="h-4 w-4" aria-hidden />
                : <Eye     className="h-4 w-4" aria-hidden />
              }
            </button>
          </div>
        </div>

        {/* Remember me */}
        <div className="flex items-center gap-2 pt-0.5">
          <input
            id="remember"
            type="checkbox"
            name="remember"
            value="on"
            className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-[#06122d] dark:accent-blue-400"
          />
          <label
            htmlFor="remember"
            className="cursor-pointer select-none text-xs font-semibold text-slate-500 dark:text-slate-400"
          >
            Remember me
          </label>
        </div>

        {/* Submit */}
        <button
          id="login-submit-btn"
          type="submit"
          className="mt-1 flex h-[52px] w-full items-center justify-center gap-2 rounded-xl text-sm font-black tracking-wide text-white shadow-lg transition-all duration-300 hover:shadow-xl hover:opacity-90 active:scale-[0.985]"
          style={{
            background: "linear-gradient(135deg, #06122d 0%, #0a5fa8 55%, #0d9488 100%)",
          }}
        >
          SIGN IN <ArrowRight className="h-4 w-4" aria-hidden />
        </button>
      </form>

      {/* Security footer */}
      <div className="mt-5 flex items-center justify-center gap-2 border-t border-slate-100 pt-4 text-[10px] font-semibold text-slate-400 dark:border-slate-800">
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" aria-hidden />
        <span>256-Bit Encrypted Enterprise Gateway</span>
      </div>
    </div>
  );
}
