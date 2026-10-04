import type { ReactNode } from "react";
import Image from "next/image";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { t } from "@/lib/i18n/ui";

export function AuthPortalShell({
  lang,
  children,
  rightPanel,
  className,
  layoutVariant = "default",
}: {
  lang: SupportedLanguage;
  children: ReactNode;
  rightPanel: ReactNode;
  className?: string;
  layoutVariant?: "default" | "operations";
}) {
  const isOperationsLayout = layoutVariant === "operations";

  return (
    <div className={`min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-slate-50 overflow-x-hidden ${className ?? ""}`.trim()}>
      <main className="min-h-screen">
        <div
          className={`grid min-h-screen w-full ${
            isOperationsLayout
              ? "lg:grid-cols-[minmax(0,1.04fr)_minmax(0,0.96fr)]"
              : "lg:grid-cols-2"
          }`}
        >
          {/* ── Left Column: Clean Login Form Container ── */}
          <section
            className={`relative flex min-h-screen flex-col justify-between bg-white px-4 py-8 sm:px-8 sm:py-12 lg:px-12 xl:px-16 dark:bg-slate-950 border-slate-200/80 dark:border-slate-800/80 ${
              isOperationsLayout ? "lg:order-2 lg:border-l" : "lg:order-1 lg:border-r"
            }`}
          >
            {/* Form Content Area */}
            <div className="my-auto mx-auto w-full max-w-[440px] py-4 relative z-10">
              {children}
            </div>

            {/* Mobile-Only Faded Bottom Illustration matching the phone mockup */}
            <div className="absolute inset-x-0 bottom-0 h-64 lg:hidden pointer-events-none overflow-hidden select-none z-0">
              <Image
                src="/images/global_logistics_hero.jpg"
                alt=""
                aria-hidden="true"
                fill
                sizes="100vw"
                className="object-cover object-bottom opacity-25 dark:opacity-35"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-white via-white/80 to-transparent dark:from-slate-950 dark:via-slate-950/80" />
            </div>

            {/* Subtle Footer */}
            <div className="relative z-10 flex flex-col items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-900 pt-4 text-[10px] font-semibold text-slate-400 sm:flex-row mt-4">
              <span>
                {lang === "ur"
                  ? "© 2026 ڈی جی ٹی اکاؤنٹس ای آر پی (DGT.LLC)۔ جملہ حقوق محفوظ ہیں۔"
                  : lang === "ar"
                  ? "© 2026 دي جي تي لنظم الحسابات ERP (DGT.LLC). جميع الحقوق محفوظة."
                  : lang === "fa"
                  ? "© 2026 حسابداری دی‌جی‌تی (DGT.LLC). تمامی حقوق محفوظ است."
                  : lang === "ps"
                  ? "© 2026 ډي جي ټي اکاونټس ای آر پي (DGT.LLC). ټول حقوق خوندي دي."
                  : "© 2026 DGT ACCOUNTS ERP (DGT.LLC). All rights reserved."}
              </span>
              <div className="flex gap-4">
                <span className="text-slate-400">
                  {t(lang, "mbl.security", "Enterprise Grade Security")}
                </span>
              </div>
            </div>
          </section>

          {/* ── Right Column: High-Tech Global Logistics Hero Showcase ── */}
          <section
            className={`relative hidden overflow-hidden lg:flex lg:flex-col justify-center bg-[#06122d] ${
              isOperationsLayout ? "lg:order-1 lg:border-r" : "lg:order-2 lg:border-l"
            } border-slate-800`}
          >
            {rightPanel}
          </section>
        </div>
      </main>
    </div>
  );
}
