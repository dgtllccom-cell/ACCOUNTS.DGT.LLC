import type { ReactNode } from "react";
import { AuthTopControls } from "@/components/layout/auth-top-controls";
import type { SupportedLanguage } from "@/lib/i18n/languages";

export function AuthPortalShell({
  lang,
  children,
  rightPanel,
  className,
}: {
  lang: SupportedLanguage;
  children: ReactNode;
  rightPanel: ReactNode;
  className?: string;
}) {
  return (
    <div className={`min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-950 dark:text-slate-50 ${className ?? ""}`.trim()}>
      <main className="flex-1 flex flex-col justify-center">
        <div className="grid min-h-screen w-full lg:grid-cols-[1fr_1.08fr]">
          <section className="relative flex min-h-screen flex-col justify-between bg-white px-4 py-6 sm:px-8 sm:py-10 lg:px-12 xl:px-16 dark:bg-slate-950">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-blue-100 bg-white shadow-md shadow-blue-100 dark:border-blue-900/40 dark:bg-slate-900 dark:shadow-none sm:h-12 sm:w-12">
                  <svg viewBox="0 0 40 40" width="40" height="40" className="h-7 w-7 sm:h-8 sm:w-8" fill="none" aria-hidden>
                    <rect width="40" height="40" rx="10" fill="#EFF6FF" />
                    <path d="M10 28 L10 14 L20 8 L30 14 L30 28 L20 34 Z" fill="#1e3a8a" opacity="0.15" />
                    <path d="M10 20 L20 14 L30 20" stroke="#1e40af" strokeWidth="2.5" strokeLinecap="round" />
                    <path d="M10 25 L20 19 L30 25" stroke="#1d4ed8" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
                    <path d="M15 28 L25 22 L30 25" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
                    <rect x="17" y="22" width="6" height="8" rx="1" fill="#1e40af" />
                  </svg>
                </div>
                <div>
                  <div className="text-lg font-black tracking-[0.18em] text-[#06122d] dark:text-white sm:text-xl sm:tracking-[0.22em]">
                    DAMAAN
                  </div>
                  <div className="text-[8px] font-bold uppercase tracking-[0.3em] text-slate-400 sm:text-[9px] sm:tracking-[0.38em]">
                    Business Group
                  </div>
                </div>
              </div>

              <div className="flex items-center lg:hidden">
                <div className="rounded-full border border-slate-200 bg-slate-50 px-1 py-1 shadow-xs dark:border-slate-800 dark:bg-slate-900">
                  <AuthTopControls lang={lang} />
                </div>
              </div>
            </div>

            <div className="my-auto w-full max-w-[460px] mx-auto py-6">{children}</div>

            <div className="flex flex-col items-center justify-between gap-2 border-t border-slate-100 pt-4 text-[10px] font-semibold text-slate-400 sm:flex-row dark:border-slate-900">
              <span>© 2026 DAMAAN BUSINESS GROUP</span>
              <div className="flex gap-4">
                <a href="#" className="transition-colors hover:text-slate-600 dark:hover:text-slate-300">
                  Privacy Policy
                </a>
                <a href="#" className="transition-colors hover:text-slate-600 dark:hover:text-slate-300">
                  Security
                </a>
              </div>
            </div>
          </section>

          <section
            className="relative hidden overflow-hidden lg:flex lg:flex-col justify-between"
            style={{ background: "linear-gradient(160deg, #06122d 0%, #0a1f45 45%, #071828 100%)", color: "#ffffff" }}
          >
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

            <div className="relative z-20 flex items-center justify-end px-8 py-6">
              <div className="rounded-full border border-white/15 bg-white/8 px-1 py-1 shadow-xl backdrop-blur-sm">
                <AuthTopControls lang={lang} />
              </div>
            </div>

            <div className="relative z-10 flex flex-1 flex-col justify-center px-8 pb-8">
              {rightPanel}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
