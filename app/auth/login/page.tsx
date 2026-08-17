import { LoginForm }       from "@/features/auth/components/login-form";
import { LoginErrorBoundary } from "@/features/auth/components/login-error-boundary";
import { AuthTopControls } from "@/components/layout/auth-top-controls";
import { InstallAppBanner } from "@/components/layout/install-app-banner";
import { getRequestLanguage } from "@/lib/i18n/server";

export const metadata = {
  title: "Login | Damaan Business Group ERP",
  description: "Sign in to the Damaan Business Group ERP — Global Inventory & Logistics Management System.",
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

  return (
    <div suppressHydrationWarning className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-950 dark:text-slate-50">
      <InstallAppBanner />
      <main className="flex-1 flex flex-col justify-center">
        <div className="grid min-h-screen w-full lg:grid-cols-[1fr_1.1fr]">

        {/* ═══════════════════════════════════════════════════════════════
            LEFT PANEL — Login Form (clean & fully responsive)
        ═══════════════════════════════════════════════════════════════ */}
        <section className="relative flex min-h-screen flex-col justify-between px-4 py-6 sm:px-8 sm:py-10 lg:px-12 xl:px-16 bg-white dark:bg-slate-950">

          {/* ── Header: Logo + Mobile Controls ── */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              {/* Icon mark */}
              <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-2xl border border-blue-100 bg-white shadow-md shadow-blue-100 dark:border-blue-900/40 dark:bg-slate-900 dark:shadow-none">
                <svg viewBox="0 0 40 40" width="40" height="40" className="h-7 w-7 sm:h-8 sm:w-8" fill="none" aria-hidden>
                  <rect width="40" height="40" rx="10" fill="#EFF6FF"/>
                  <path d="M10 28 L10 14 L20 8 L30 14 L30 28 L20 34 Z" fill="#1e3a8a" opacity="0.15"/>
                  <path d="M10 20 L20 14 L30 20" stroke="#1e40af" strokeWidth="2.5" strokeLinecap="round"/>
                  <path d="M10 25 L20 19 L30 25" stroke="#1d4ed8" strokeWidth="2" strokeLinecap="round" opacity="0.7"/>
                  <path d="M15 28 L25 22 L30 25" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>
                  <rect x="17" y="22" width="6" height="8" rx="1" fill="#1e40af"/>
                </svg>
              </div>
              <div>
                <div className="text-lg sm:text-xl font-black tracking-[0.18em] sm:tracking-[0.22em] text-[#06122d] dark:text-white">
                  DAMAAN
                </div>
                <div className="text-[8px] sm:text-[9px] font-bold uppercase tracking-[0.3em] sm:tracking-[0.38em] text-slate-400">
                  Business Group
                </div>
              </div>
            </div>

            {/* Mobile Controls (Language & Theme toggle) */}
            <div className="flex items-center lg:hidden">
              <div className="rounded-full border border-slate-200 bg-slate-50 px-1 py-1 shadow-xs dark:border-slate-800 dark:bg-slate-900">
                <AuthTopControls lang={lang} />
              </div>
            </div>
          </div>

          {/* ── Form Card ── */}
          <div className="my-auto w-full max-w-[460px] mx-auto py-6">
            {/* Error banner */}
            {params.error && (
              <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
                {decodeURIComponent(params.error)}
              </div>
            )}

            <LoginErrorBoundary>
              <LoginForm lang={lang} />
            </LoginErrorBoundary>
          </div>

          {/* ── Footer ── */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-4 text-[10px] font-semibold text-slate-400 border-t border-slate-100 dark:border-slate-900">
            <span>© 2026 DAMAAN BUSINESS GROUP</span>
            <div className="flex gap-4">
              <a href="#" className="transition-colors hover:text-slate-600 dark:hover:text-slate-300">Privacy Policy</a>
              <a href="#" className="transition-colors hover:text-slate-600 dark:hover:text-slate-300">Security</a>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════
            RIGHT PANEL — Visual Dashboard (desktop/tablet landscape)
        ═══════════════════════════════════════════════════════════════ */}
        <section
          className="relative hidden overflow-hidden lg:flex lg:flex-col justify-between"
          style={{ background: "linear-gradient(160deg, #06122d 0%, #0a1f45 45%, #071828 100%)", color: "#ffffff" }}
          aria-hidden="true"
        >
          {/* ── Organic texture blobs ── */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div
              className="absolute -right-24 -top-24 h-[520px] w-[520px] rounded-full opacity-30"
              style={{
                background: "radial-gradient(circle at 60% 40%, #1e1b4b 0%, #312e81 35%, #1e3a8a 65%, transparent 100%)",
              }}
            />
            <div
              className="absolute -bottom-32 -left-20 h-[440px] w-[440px] rounded-full opacity-25"
              style={{
                background: "radial-gradient(circle at 40% 60%, #064e3b 0%, #065f46 40%, #0369a1 75%, transparent 100%)",
              }}
            />
            <div
              className="absolute left-1/2 top-1/2 h-[360px] w-[360px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-10"
              style={{
                background: "radial-gradient(circle, #7c3aed 0%, transparent 70%)",
              }}
            />
            <div
              className="absolute inset-0 opacity-[0.06]"
              style={{
                backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)",
                backgroundSize: "28px 28px",
              }}
            />
          </div>

          {/* ── Language / Controls top-right ── */}
          <div className="relative z-20 flex items-center justify-end px-8 py-6">
            <div className="rounded-full border border-white/15 bg-white/8 px-1 py-1 shadow-xl backdrop-blur-sm">
              <AuthTopControls lang={lang} />
            </div>
          </div>
          {/* Production status (no sample metrics) */}
          <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-10 pb-8">
            <div
              className="w-full max-w-[340px] rounded-2xl border border-white/10 p-5 shadow-2xl"
              style={{ background: "rgba(255,255,255,0.95)", backdropFilter: "blur(20px)", color: "#0f172a" }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-600" style={{ color: "#475569" }}>
                    Production ERP
                  </p>
                  <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-slate-400" style={{ color: "#94a3b8" }}>
                    Live Database Only
                  </p>
                </div>
                <span className="rounded-full bg-emerald-500 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-white" style={{ backgroundColor: "#10b981", color: "#ffffff" }}>
                  Connected
                </span>
              </div>
              <div className="mt-5 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3" style={{ backgroundColor: "#ecfdf5", borderColor: "#d1fae5" }}>
                <p className="text-[10px] font-bold leading-5 text-emerald-800" style={{ color: "#065f46" }}>
                  Sign in to view live operational records. No sample or demo statistics are displayed.
                </p>
              </div>
            </div>
          </div>

          {/* Bottom brand text */}
          <div className="relative z-10 pb-8 text-center">
            <p className="text-[9px] font-bold uppercase tracking-[0.34em] text-white/40" style={{ color: "rgba(255, 255, 255, 0.6)" }}>
              Established Excellence
            </p>
            <p className="mt-1.5 text-2xl font-black text-white" style={{ color: "#ffffff" }}>
              Damaan <span className="font-light">Group Of Business</span>
            </p>
            <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.28em] text-white/35" style={{ color: "rgba(255, 255, 255, 0.5)" }}>
              Global Logistics &amp; Inventory
            </p>
          </div>
        </section>

        </div>
      </main>
    </div>
  );
}
