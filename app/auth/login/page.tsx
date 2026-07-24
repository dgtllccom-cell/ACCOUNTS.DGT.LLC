import { LoginForm }       from "@/features/auth/components/login-form";
import { AuthTopControls } from "@/components/layout/auth-top-controls";
import { getRequestLanguage } from "@/lib/i18n/server";

export const metadata = {
  title: "Login | Damaan Business Group ERP",
  description: "Sign in to the Damaan Business Group ERP — Global Inventory & Logistics Management System.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const lang   = await getRequestLanguage();

  return (
    <main className="min-h-screen bg-white text-slate-950 dark:bg-slate-950 dark:text-slate-50">
      <div className="grid min-h-screen lg:grid-cols-[1fr_1fr]">

        {/* ═══════════════════════════════════════════════════════════════
            LEFT PANEL — Login Form (white / clean)
        ═══════════════════════════════════════════════════════════════ */}
        <section className="relative flex min-h-screen flex-col px-8 py-10 sm:px-12 lg:px-16">

          {/* ── Logo ── */}
          <div className="flex items-center gap-3">
            {/* Icon mark */}
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-100 bg-white shadow-md shadow-blue-100">
              <svg viewBox="0 0 40 40" className="h-8 w-8" fill="none" aria-hidden>
                <rect width="40" height="40" rx="10" fill="#EFF6FF"/>
                <path d="M10 28 L10 14 L20 8 L30 14 L30 28 L20 34 Z" fill="#1e3a8a" opacity="0.15"/>
                <path d="M10 20 L20 14 L30 20" stroke="#1e40af" strokeWidth="2.5" strokeLinecap="round"/>
                <path d="M10 25 L20 19 L30 25" stroke="#1d4ed8" strokeWidth="2" strokeLinecap="round" opacity="0.7"/>
                <path d="M15 28 L25 22 L30 25" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>
                <rect x="17" y="22" width="6" height="8" rx="1" fill="#1e40af"/>
              </svg>
            </div>
            <div>
              <div className="text-xl font-black tracking-[0.22em] text-[#06122d] dark:text-white">
                DAMAAN
              </div>
              <div className="text-[9px] font-bold uppercase tracking-[0.38em] text-slate-400">
                Business Group
              </div>
            </div>
          </div>

          {/* ── Form Card ── */}
          <div className="my-auto w-full max-w-[440px] pt-8">
            {/* Error banner */}
            {params.error && (
              <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
                {decodeURIComponent(params.error)}
              </div>
            )}

            <LoginForm lang={lang} />
          </div>

          {/* ── Footer ── */}
          <div className="mt-auto flex items-center justify-between pt-6 text-[10px] font-semibold text-slate-400">
            <span>© 2026 DAMAAN BUSINESS GROUP</span>
            <div className="flex gap-4">
              <a href="#" className="transition-colors hover:text-slate-600 dark:hover:text-slate-300">Privacy Policy</a>
              <a href="#" className="transition-colors hover:text-slate-600 dark:hover:text-slate-300">Security</a>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════
            RIGHT PANEL — Visual Dashboard (dark navy + widgets)
        ═══════════════════════════════════════════════════════════════ */}
        <section
          className="relative hidden overflow-hidden lg:flex lg:flex-col"
          style={{ background: "linear-gradient(160deg, #06122d 0%, #0a1f45 45%, #071828 100%)" }}
          aria-hidden="true"
        >
          {/* ── Organic texture blobs ── */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {/* Deep blueberry cluster — top right */}
            <div
              className="absolute -right-24 -top-24 h-[520px] w-[520px] rounded-full opacity-30"
              style={{
                background: "radial-gradient(circle at 60% 40%, #1e1b4b 0%, #312e81 35%, #1e3a8a 65%, transparent 100%)",
              }}
            />
            {/* Mid-tone cluster — bottom left */}
            <div
              className="absolute -bottom-32 -left-20 h-[440px] w-[440px] rounded-full opacity-25"
              style={{
                background: "radial-gradient(circle at 40% 60%, #064e3b 0%, #065f46 40%, #0369a1 75%, transparent 100%)",
              }}
            />
            {/* Accent glow — centre */}
            <div
              className="absolute left-1/2 top-1/2 h-[360px] w-[360px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-10"
              style={{
                background: "radial-gradient(circle, #7c3aed 0%, transparent 70%)",
              }}
            />
            {/* Subtle dot grid */}
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

          {/* ── Dashboard Widgets (vertically centred) ── */}
          <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-10 pb-8">

            {/* ─── Main inventory card ─── */}
            <div
              className="w-full max-w-[340px] rounded-2xl border border-white/10 p-5 shadow-2xl"
              style={{ background: "rgba(255,255,255,0.95)", backdropFilter: "blur(20px)" }}
            >
              {/* Card header */}
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-600">
                    Live Inventory
                  </p>
                  <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-slate-400">
                    Analytics Dashboard
                  </p>
                </div>
                <span className="rounded-full bg-emerald-500 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-white">
                  Operational
                </span>
              </div>

              {/* SVG Line Chart */}
              <svg viewBox="0 0 280 90" className="w-full" aria-hidden>
                <defs>
                  <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1e40af" stopOpacity="0.15"/>
                    <stop offset="100%" stopColor="#1e40af" stopOpacity="0"/>
                  </linearGradient>
                  <linearGradient id="chartLine" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#3b82f6"/>
                    <stop offset="100%" stopColor="#0d9488"/>
                  </linearGradient>
                </defs>
                {/* Fill area */}
                <path
                  d="M0,70 C20,65 35,72 55,60 C75,48 90,55 115,42 C140,29 155,38 180,25 C205,12 225,20 255,10 L280,8 L280,90 L0,90 Z"
                  fill="url(#chartFill)"
                />
                {/* Line */}
                <path
                  d="M0,70 C20,65 35,72 55,60 C75,48 90,55 115,42 C140,29 155,38 180,25 C205,12 225,20 255,10 L280,8"
                  fill="none"
                  stroke="url(#chartLine)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {/* Data dots */}
                {[
                  [0,70],[55,60],[115,42],[180,25],[280,8],
                ].map(([x, y], i) => (
                  <circle key={i} cx={x} cy={y} r="3" fill="#1e40af" opacity="0.7"/>
                ))}
              </svg>

              {/* Stats row */}
              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                    Active Units
                  </p>
                  <p className="mt-0.5 text-xl font-black text-[#06122d]">1.2M+</p>
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                    Efficiency
                  </p>
                  <p className="mt-0.5 text-xl font-black text-emerald-600">98.4%</p>
                </div>
              </div>
            </div>

            {/* ─── Circular progress mini-card ─── */}
            <div
              className="mt-4 flex w-[160px] items-center gap-4 self-end rounded-2xl border border-white/10 p-4 shadow-xl"
              style={{ background: "rgba(255,255,255,0.92)", backdropFilter: "blur(16px)" }}
            >
              {/* Progress ring */}
              <svg width="52" height="52" viewBox="0 0 52 52" aria-hidden>
                <circle cx="26" cy="26" r="20" fill="none" stroke="#e2e8f0" strokeWidth="5"/>
                <circle
                  cx="26" cy="26" r="20"
                  fill="none"
                  stroke="url(#ringGrad)"
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeDasharray="125.6"
                  strokeDashoffset="31.4"
                  transform="rotate(-90 26 26)"
                />
                <defs>
                  <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#1e40af"/>
                    <stop offset="100%" stopColor="#0d9488"/>
                  </linearGradient>
                </defs>
                <text x="26" y="30" textAnchor="middle" fontSize="11" fontWeight="900" fill="#06122d">75%</text>
              </svg>
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Capacity</p>
                <p className="mt-0.5 text-sm font-black text-[#06122d]">On Track</p>
              </div>
            </div>
          </div>

          {/* ── Bottom brand text ── */}
          <div className="relative z-10 pb-10 text-center">
            <p className="text-[9px] font-bold uppercase tracking-[0.34em] text-white/40">
              Established Excellence
            </p>
            <p className="mt-1.5 text-2xl font-black text-white">
              Damaan <span className="font-light">Group Of Business</span>
            </p>
            <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.28em] text-white/35">
              Global Logistics &amp; Inventory
            </p>
          </div>
        </section>

      </div>
    </main>
  );
}
