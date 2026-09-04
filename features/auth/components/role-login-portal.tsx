import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { t } from "@/lib/i18n/ui";
import { InstallAppBanner } from "@/components/layout/install-app-banner";
import { LoginErrorBoundary } from "@/features/auth/components/login-error-boundary";
import { LoginForm, type LoginTab } from "@/features/auth/components/login-form";
import { AuthPortalShell } from "@/features/auth/components/auth-portal-shell";

export type RoleLoginPortalConfig = {
  title: string;
  subtitle: string;
  badge: string;
  formTab: LoginTab;
  scope: string;
  highlights: { label: string; value: string; icon: ReactNode }[];
  backHref?: string;
};

export function RoleLoginPortal({
  lang,
  config,
  error,
}: {
  lang: SupportedLanguage;
  config: RoleLoginPortalConfig;
  error?: string;
}) {
  const rightPanel = (
    <div className="mx-auto flex w-full max-w-[560px] flex-col items-stretch justify-center">
      <div className="rounded-[28px] border border-white/10 bg-white/95 p-6 shadow-2xl shadow-black/20 backdrop-blur-sm lg:p-8">
        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">
          {config.badge}
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900 lg:text-4xl">
          {config.title}
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-6 font-medium text-slate-600 lg:text-base">
          {config.subtitle}
        </p>

        <div className="mt-6 grid gap-3">
          {config.highlights.map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/40"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                  {item.icon}
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                    {item.label}
                  </p>
                  <p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">{item.value}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300">
            {config.scope}
          </span>
          <Link
            href={config.backHref || "/auth/login"}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-700 transition-colors hover:border-blue-200 hover:text-blue-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300"
          >
            {t(lang, "rlp.back_to_portal", "Back to portal")} <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <InstallAppBanner />
      <AuthPortalShell lang={lang} rightPanel={rightPanel}>
        <LoginErrorBoundary>
          <div className="mb-5 rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-4 shadow-xs dark:border-blue-900/40 dark:from-slate-900 dark:to-slate-950">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-blue-700 dark:text-blue-300">
              {config.badge}
            </p>
            <h2 className="mt-2 text-xl font-black tracking-tight text-slate-900 dark:text-white">
              {config.title}
            </h2>
            <p className="mt-2 text-sm leading-6 font-medium text-slate-600 dark:text-slate-400">
              {error || "This page is locked to the selected access path for a cleaner and more professional ERP sign-in experience."}
            </p>
          </div>

          <LoginForm lang={lang} initialTab={config.formTab} showRoleTabs={false} />
        </LoginErrorBoundary>
      </AuthPortalShell>
    </>
  );
}

