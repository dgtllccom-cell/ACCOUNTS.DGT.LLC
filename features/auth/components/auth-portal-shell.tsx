import type { ReactNode } from "react";
import { AuthTopControls } from "@/components/layout/auth-top-controls";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { t } from "@/lib/i18n/ui";

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
  const tt = (key: string, fallback: string) => t(lang, key as never, fallback);
  return (
    <div className={`min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-slate-50 ${className ?? ""}`.trim()}>
      <main className="flex min-h-screen flex-col justify-center">
        <div className="grid min-h-screen w-full lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)]">
          <section className="relative flex min-h-screen flex-col justify-between border-slate-200/70 bg-white px-4 py-6 shadow-[0_0_0_1px_rgba(148,163,184,0.06)] sm:px-8 sm:py-10 lg:border-r lg:px-12 xl:px-16 dark:border-slate-900/70 dark:bg-slate-950 dark:shadow-none">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <img
                  src="/images/damaan-logo.png"
                  alt="Damaan Business Group"
                  className="h-11 w-11 shrink-0 rounded-full object-contain shadow-lg border border-amber-500/30 sm:h-12 sm:w-12"
                />
                <div>
                  <div className="text-base font-black tracking-wide text-[#06122d] dark:text-white sm:text-lg">
                    Damaan Business Group
                  </div>
                  <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-amber-700 dark:text-amber-400 sm:text-[10px]">
                    DGT.LLC • Super Quality
                  </div>
                </div>
              </div>

              <div className="flex items-center lg:hidden">
                <div className="rounded-full border border-slate-200 bg-slate-50 px-1 py-1 shadow-xs dark:border-slate-800 dark:bg-slate-900">
                  <AuthTopControls lang={lang} />
                </div>
              </div>
            </div>

            <div className="my-auto mx-auto w-full max-w-[460px] py-6">{children}</div>

            <div className="flex flex-col items-center justify-between gap-2 border-t border-slate-100 pt-4 text-[10px] font-semibold text-slate-400 sm:flex-row dark:border-slate-900">
              <span>
                {lang === "ur"
                  ? "© 2026 دامان بزنس گروپ (DGT.LLC)۔ جملہ حقوق محفوظ ہیں۔"
                  : lang === "ar"
                  ? "© 2026 مجموعة ضمان للأعمال (DGT.LLC). جميع الحقوق محفوظة."
                  : lang === "fa"
                  ? "© 2026 گروه تجاری دامان (DGT.LLC). تمامی حقوق محفوظ است."
                  : lang === "ps"
                  ? "© 2026 د دامان سوداګریزه ډله (DGT.LLC). ټول حقوق خوندي دي."
                  : "© 2026 Damaan Business Group (DGT.LLC). All rights reserved."}
              </span>
              <div className="flex gap-4">
                <a href="#" className="transition-colors hover:text-slate-600 dark:hover:text-slate-300">
                  {tt("mbl.privacy_policy", "Privacy Policy")}
                </a>
                <a href="#" className="transition-colors hover:text-slate-600 dark:hover:text-slate-300">
                  {tt("mbl.security", "Security")}
                </a>
              </div>
            </div>
          </section>

          <section
            className="relative hidden overflow-hidden border-l border-white/10 lg:flex lg:flex-col justify-between"
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
