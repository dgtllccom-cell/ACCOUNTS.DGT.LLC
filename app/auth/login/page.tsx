import { Building2, Globe2, MapPin, ShieldCheck, Server, ArrowRight, Layers3, Zap, CheckCircle2, Lock } from "lucide-react";
import { LoginForm } from "@/features/auth/components/login-form";
import { LoginErrorBoundary } from "@/features/auth/components/login-error-boundary";
import { getRequestLanguage } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/ui";
import { AuthPortalShell } from "@/features/auth/components/auth-portal-shell";

export const metadata = {
  title: "ERP Access Portal | Digital Dock ERP",
  description: "Secure Enterprise Login Portal for Digital Dock ERP.",
};

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const params = resolvedSearchParams || {};
  const lang = await getRequestLanguage();

  const rightPanel = (
    <div className="mx-auto flex w-full max-w-[600px] flex-col items-stretch justify-center">
      <div className="rounded-[32px] border border-white/15 bg-white/10 p-7 lg:p-9 shadow-2xl backdrop-blur-xl text-white">
        {/* Header Badge & Status */}
        <div className="flex items-center justify-between gap-4 pb-6 border-b border-white/10">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-[11px] font-black uppercase tracking-[0.2em] text-blue-200">
            <Server className="h-3.5 w-3.5 text-blue-400" />
            {t(lang, "login.org_erp", "Digital Dock Global Enterprise")}
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-bold text-emerald-300">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
            </span>
            <span>{t(lang, "login.connected", "System Online")}</span>
          </div>
        </div>

        {/* Hero Title */}
        <div className="mt-6">
          <h2 className="text-2xl lg:text-3xl font-black tracking-tight text-white leading-snug">
            Multi-Country Enterprise ERP Platform
          </h2>
          <p className="mt-2 text-xs lg:text-sm text-slate-300 font-medium leading-relaxed">
            Unified accounts, cross-border commercial trade, customs clearance, and real-time multi-branch ledgers.
          </p>
        </div>

        {/* Feature Grid */}
        <div className="mt-7 grid gap-3.5 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 transition-all duration-200 hover:bg-white/10">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/20 text-blue-300 border border-blue-400/30">
                <Globe2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-black text-white">5 Core Regions</p>
                <p className="text-[11px] text-slate-300 font-medium">UAE, PK, AF, IN, CN</p>
              </div>
            </div>
            <p className="mt-2.5 text-[11px] text-slate-300 leading-relaxed font-normal">
              Unified financial ledgers with live multi-currency auto conversion (PKR, AED, AFN, INR, CNY).
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 transition-all duration-200 hover:bg-white/10">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                <Zap className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-black text-white">Dual-Entry Roznamcha</p>
                <p className="text-[11px] text-slate-300 font-medium">Real-Time Balancing</p>
              </div>
            </div>
            <p className="mt-2.5 text-[11px] text-slate-300 leading-relaxed font-normal">
              Instant cashbook reconciliation, multi-branch journal entries, and automated daily closing.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 transition-all duration-200 hover:bg-white/10">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-300 border border-amber-400/30">
                <Layers3 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-black text-white">Shipping & Customs</p>
                <p className="text-[11px] text-slate-300 font-medium">Port Logistics Flow</p>
              </div>
            </div>
            <p className="mt-2.5 text-[11px] text-slate-300 leading-relaxed font-normal">
              End-to-end container tracking, clearance agents workflow, customs duty & port management.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 transition-all duration-200 hover:bg-white/10">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/20 text-violet-300 border border-violet-400/30">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-black text-white">Bank-Grade Security</p>
                <p className="text-[11px] text-slate-300 font-medium">256-Bit SSL Encrypted</p>
              </div>
            </div>
            <p className="mt-2.5 text-[11px] text-slate-300 leading-relaxed font-normal">
              Granular role-based scope access, tamper-evident audit logs, and verified operator sessions.
            </p>
          </div>
        </div>

        {/* Footer info pill */}
        <div className="mt-6 flex items-center justify-between text-[11px] font-semibold text-slate-400 pt-4 border-t border-white/10">
          <div className="flex items-center gap-1.5 text-slate-300">
            <Lock className="h-3.5 w-3.5 text-emerald-400" />
            <span>Authorized Personnel Access Only</span>
          </div>
          <span>Digital Dock ERP v2.4</span>
        </div>
      </div>
    </div>
  );

  return (
    <AuthPortalShell lang={lang} rightPanel={rightPanel}>
      <LoginErrorBoundary>
        {params.error && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
            {decodeURIComponent(params.error)}
          </div>
        )}
        <LoginForm lang={lang} />
      </LoginErrorBoundary>
    </AuthPortalShell>
  );
}
