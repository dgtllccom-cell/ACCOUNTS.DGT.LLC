"use client";

import { useState } from "react";
import {
  ArrowRight,
  ChevronDown,
  Eye,
  EyeOff,
  Fingerprint,
  Globe,
  Lock,
  ShieldCheck,
  User,
  Loader2,
  Check,
  AlertCircle,
  HelpCircle,
  Sparkles,
  KeyRound
} from "lucide-react";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { cn } from "@/lib/utils";
import { LOGIN_TRANSLATIONS } from "./login-translations";
import { useLoginScope } from "./login-scope-context";

const LANGUAGES: { code: SupportedLanguage; name: string; nativeName: string; flag: string }[] = [
  { code: "en", name: "English", nativeName: "English", flag: "🇺🇸" },
  { code: "ur", name: "Urdu", nativeName: "اردو", flag: "🇵🇰" },
  { code: "ar", name: "Arabic", nativeName: "العربية", flag: "🇦🇪" },
  { code: "fa", name: "Farsi", nativeName: "فارسی", flag: "🇮🇷" },
  { code: "ps", name: "Pashto", nativeName: "پښتو", flag: "🇦🇫" },
];

// The "Preview / Sandbox Mode" drawer lists real-looking account ids (Super Admin, Country Admin …). It must never reach a public
// login page or a store-review build, so it exists only when a developer sets NEXT_PUBLIC_ENABLE_SANDBOX_LOGIN=true in .env.local.
const SANDBOX_LOGIN_ENABLED = process.env.NEXT_PUBLIC_ENABLE_SANDBOX_LOGIN === "true";

const DEMO_PRESETS = [
  { presetName: "Super Admin", id: "superadmin@dgt.llc", scopeName: "Global Root" },
  { presetName: "UAE Admin", id: "uae.admin@dgt.llc", scopeName: "Country Admin" },
  { presetName: "Pakistan Admin", id: "pakistan.admin@dgt.llc", scopeName: "Country Admin" },
  { presetName: "City Branch", id: "chaman.branch@dgt.llc", scopeName: "City Branch" },
  { presetName: "Clearing Agent", id: "shipping@dgt.llc", scopeName: "Maritime Clearing" },
];

export type LoginTab = "super_admin" | "country" | "city" | "branch" | "agent";

export function LoginForm({
  lang: propLang,
  initialTab,
  showRoleTabs = false,
}: {
  lang?: SupportedLanguage;
  initialTab?: LoginTab;
  showRoleTabs?: boolean;
}) {
  const scope = useLoginScope();
  const lang = (scope.selectedLang || propLang || "en") as SupportedLanguage;
  const t = LOGIN_TRANSLATIONS[lang] || LOGIN_TRANSLATIONS.en;
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorState, setErrorState] = useState<string | null>(null);

  // UI state toggles
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const [showSandbox, setShowSandbox] = useState(false);
  const [showBiometricModal, setShowBiometricModal] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [biometricFeedback, setBiometricFeedback] = useState<string | null>(null);

  const currentLangObj = LANGUAGES.find((l) => l.code === lang) || LANGUAGES[0];

  function handleSwitchLanguage(code: SupportedLanguage) {
    scope.setSelectedLang(code);
    setIsLangMenuOpen(false);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("erp_lang", code);
        document.cookie = `erp_lang=${encodeURIComponent(code)}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax`;
        const newRtl = ["ar", "ur", "fa", "ps"].includes(code);
        document.documentElement.lang = code;
        document.documentElement.dir = newRtl ? "rtl" : "ltr";
        const headerSelect = document.querySelector('select[data-language-picker], select[aria-label*="Lang"]') as HTMLSelectElement | null;
        if (headerSelect && headerSelect.value !== code) {
          headerSelect.value = code;
          headerSelect.dispatchEvent(new Event("change", { bubbles: true }));
        }
      } catch (e) {}
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorState(null);

    if (!identifier.trim() || !password.trim()) {
      setErrorState(
        lang === "ur"
          ? "برائے مہربانی ای میل / یوزر کوڈ اور پاس ورڈ درج کریں۔"
          : lang === "ar"
          ? "الرجاء إدخال البريد الإلكتروني أو رمز المستخدم وكلمة المرور."
          : "Please enter both Email / User Code and Password."
      );
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

      window.location.href = data.redirectUrl || "/dashboard";
    } catch (err: any) {
      setErrorState(err.message || "Invalid credentials or unauthorized user.");
    } finally {
      setLoading(false);
    }
  };

  async function handleBiometricAuth() {
    setBiometricFeedback(null);
    setShowBiometricModal(true);

    if (typeof window !== "undefined" && window.PublicKeyCredential) {
      try {
        const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        if (!available) {
          setBiometricFeedback(t.biometricNotEnrolled);
        }
      } catch (e) {
        setBiometricFeedback(t.biometricNotEnrolled);
      }
    } else {
      setBiometricFeedback(t.biometricNotEnrolled);
    }
  }

  return (
    <div className="w-full max-w-[420px] mx-auto" dir={isRtl ? "rtl" : "ltr"}>
      {/* ── App Icon & Header matching the mockup ── */}
      <div className="flex flex-col items-center text-center">
        {/* Blue Square DGT App Icon */}
        <div className="w-16 h-16 rounded-[22px] bg-gradient-to-br from-[#1e60f0] via-[#1a56db] to-[#0c3da8] shadow-xl shadow-blue-500/25 flex items-center justify-center transition-transform hover:scale-105 cursor-pointer">
          <span className="text-2xl font-black tracking-tight text-white font-sans drop-shadow-xs">
            DGT
          </span>
        </div>

        {/* Title */}
        <h1 className="text-2xl sm:text-[26px] font-black tracking-tight text-slate-900 dark:text-white mt-5">
          {t.brandTitle}
        </h1>

        {/* Subtitle */}
        <p className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400 mt-1 mb-8">
          {t.brandSubtitle}
        </p>
      </div>

      {/* ── Error Banner ── */}
      {errorState && (
        <div className="mb-5 flex items-start gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-xs font-bold text-rose-700 shadow-xs dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300 animate-in fade-in duration-150">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
          <span className="flex-1 leading-snug">{errorState}</span>
        </div>
      )}

      {/* ── Login Form ── */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 1. Email / User Code Input */}
        <div className="relative">
          <User className={cn("h-4 w-4 text-slate-400 absolute top-1/2 -translate-y-1/2 pointer-events-none transition-colors", isRtl ? "right-4" : "left-4")} />
          <input
            type="text"
            id="identifier"
            autoComplete="username"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder={t.identifierPlaceholder}
            className={cn(
              "h-12 w-full rounded-xl border border-slate-200/90 bg-slate-50/70 text-sm font-semibold text-slate-800 placeholder:text-slate-400 shadow-2xs transition-all outline-none",
              "focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-100",
              "dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-100 dark:focus:bg-slate-900 dark:focus:border-blue-500 dark:focus:ring-blue-950/50",
              isRtl ? "pr-11 pl-4 text-right" : "pl-11 pr-4 text-left"
            )}
          />
        </div>

        {/* 2. Password Input */}
        <div className="relative">
          <Lock className={cn("h-4 w-4 text-slate-400 absolute top-1/2 -translate-y-1/2 pointer-events-none transition-colors", isRtl ? "right-4" : "left-4")} />
          <input
            type={showPassword ? "text" : "password"}
            id="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t.passwordPlaceholder}
            className={cn(
              "h-12 w-full rounded-xl border border-slate-200/90 bg-slate-50/70 text-sm font-semibold text-slate-800 placeholder:text-slate-400 shadow-2xs transition-all outline-none",
              "focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-100",
              "dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-100 dark:focus:bg-slate-900 dark:focus:border-blue-500 dark:focus:ring-blue-950/50",
              isRtl ? "pr-11 pl-11 text-right" : "pl-11 pr-11 text-left"
            )}
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={t.passwordPlaceholder}
            className={cn(
              "absolute top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg transition-colors cursor-pointer",
              isRtl ? "left-2.5" : "right-2.5"
            )}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>

        {/* 3. Remember Me & Forgot Password Row */}
        <div className="flex items-center justify-between pt-1 text-xs">
          <label className="flex items-center gap-2 cursor-pointer select-none font-semibold text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-4 w-4 rounded-md border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:focus:ring-blue-600 accent-blue-600 cursor-pointer"
            />
            <span>{t.rememberMe}</span>
          </label>

          <button
            type="button"
            onClick={() => setShowForgotModal(true)}
            className="font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline transition-colors cursor-pointer"
          >
            {t.forgotPassword}
          </button>
        </div>

        {/* 4. Primary Submit Button: SIGN IN SECURELY */}
        <button
          type="submit"
          disabled={loading}
          className="h-12 w-full mt-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs sm:text-sm tracking-wider uppercase shadow-md shadow-blue-600/25 flex items-center justify-center gap-2.5 transition-all active:scale-[0.99] cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{t.authenticating}</span>
            </>
          ) : (
            <>
              <ShieldCheck className="h-4.5 w-4.5 shrink-0" />
              <span>{t.signInSecurely}</span>
              <ArrowRight className={cn("h-4 w-4 shrink-0 transition-transform", isRtl ? "rotate-180" : "")} />
            </>
          )}
        </button>

        {/* 5. Secondary Biometric Button: Face ID / Fingerprint */}
        <button
          type="button"
          onClick={handleBiometricAuth}
          className="h-12 w-full rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-200 font-bold text-xs sm:text-sm shadow-2xs flex items-center justify-center gap-2.5 transition-all cursor-pointer active:scale-[0.99]"
        >
          <Fingerprint className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0" />
          <span>{t.faceIdFingerprint}</span>
        </button>
      </form>

      {/* ── 6. Centered Language Selector Dropdown ── */}
      <div className="relative mt-6 flex justify-center">
        <button
          type="button"
          onClick={() => setIsLangMenuOpen((prev) => !prev)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-slate-50/80 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 text-xs font-bold text-slate-700 dark:text-slate-300 transition-all shadow-2xs cursor-pointer"
        >
          <Globe className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <span>{currentLangObj.flag} {currentLangObj.name}</span>
          <ChevronDown className={cn("h-3.5 w-3.5 text-slate-400 transition-transform", isLangMenuOpen ? "rotate-180" : "")} />
        </button>

        {/* Language Options Popover */}
        {isLangMenuOpen && (
          <div className="absolute bottom-11 z-50 w-52 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-2xl dark:border-slate-800 dark:bg-slate-900 animate-in fade-in zoom-in-95 duration-100">
            <div className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800 mb-1">
              {t.selectLanguage}
            </div>
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                type="button"
                onClick={() => handleSwitchLanguage(l.code)}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer",
                  lang === l.code
                    ? "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
                    : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/60"
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">{l.flag}</span>
                  <span>{l.nativeName}</span>
                </div>
                {lang === l.code && <Check className="h-3.5 w-3.5 text-blue-600" />}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── 7. Preview / Sandbox Mode Divider (developer-only, see SANDBOX_LOGIN_ENABLED) ── */}
      {SANDBOX_LOGIN_ENABLED && (<div className="mt-7 flex items-center gap-3">
        <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
        <button
          type="button"
          onClick={() => setShowSandbox((prev) => !prev)}
          className="text-[11px] font-semibold text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer select-none"
        >
          {t.sandboxMode}
        </button>
        <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
      </div>)}

      {/* ── Sandbox Preset Credentials Drawer ── */}
      {SANDBOX_LOGIN_ENABLED && showSandbox && (
        <div className="mt-4 p-3.5 rounded-2xl border border-blue-200/70 bg-blue-50/50 dark:border-blue-900/40 dark:bg-blue-950/20 text-xs animate-in fade-in duration-200">
          <div className="flex items-center justify-between mb-2">
            <span className="font-extrabold text-[11px] text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-blue-600" />
              {t.demoCredentialsTitle}
            </span>
            <span className="text-[10px] text-blue-600/80 font-semibold">{t.fillCreds}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {DEMO_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setIdentifier(p.id);
                }}
                className="flex flex-col text-left p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-500 hover:shadow-xs transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between w-full">
                  <span className="font-bold text-[11px] text-slate-800 dark:text-slate-200">{p.presetName}</span>
                  <span className="text-[9px] font-semibold text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">{p.scopeName}</span>
                </div>
                <span className="text-[10px] text-slate-500 font-mono truncate mt-0.5">{p.id}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Biometric Dialog Modal ── */}
      {showBiometricModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4" dir={isRtl ? "rtl" : "ltr"}>
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 text-center space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-14 h-14 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto">
              <Fingerprint className="h-8 w-8 animate-pulse" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {t.passkeyPromptTitle}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {biometricFeedback || t.passkeyPromptDesc}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowBiometricModal(false)}
              className="w-full h-10 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition-all cursor-pointer"
            >
              {t.close}
            </button>
          </div>
        </div>
      )}

      {/* ── Forgot Password Dialog Modal ── */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4" dir={isRtl ? "rtl" : "ltr"}>
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 text-center space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-14 h-14 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto">
              <KeyRound className="h-7 w-7" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {t.forgotPasswordTitle}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                {t.forgotPasswordDesc}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowForgotModal(false)}
              className="w-full h-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all cursor-pointer"
            >
              {t.close}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
