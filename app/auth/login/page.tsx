import Link from "next/link";
import { Building2, Globe2, MapPin, ShieldCheck, Server, ArrowRight, Layers3 } from "lucide-react";
import { LoginForm } from "@/features/auth/components/login-form";
import { LoginErrorBoundary } from "@/features/auth/components/login-error-boundary";
import { InstallAppBanner } from "@/components/layout/install-app-banner";
import { getRequestLanguage } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/ui";
import { AuthPortalShell } from "@/features/auth/components/auth-portal-shell";

export const metadata = {
  title: "ERP Access Portal | Digital Dock ERP",
  description: "Choose your ERP access path and sign in to the Digital Dock ERP system.",
};

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const ROLE_CARDS = [
  {
    href: "/auth/login/admin",
    titleKey: "login.card_admin_title", title: "Admin Login",
    descKey: "login.card_admin_desc", description: "Global access for configuration, audit, and cross-country ERP control.",
    badgeKey: "role.super_admin", badge: "Super Admin",
    icon: ShieldCheck,
  },
  {
    href: "/auth/login/country",
    titleKey: "login.card_country_title", title: "Country Login",
    descKey: "login.card_country_desc", description: "Country-level access for scoped operations and branch oversight.",
    badgeKey: "role.country_admin", badge: "Country Admin",
    icon: Globe2,
  },
  {
    href: "/auth/login/city",
    titleKey: "login.card_city_title", title: "City Login",
    descKey: "login.card_city_desc", description: "City branch access for localized ERP operations and reporting.",
    badgeKey: "login.badge_city_branch", badge: "City Branch",
    icon: MapPin,
  },
  {
    href: "/auth/login/clearing-agent",
    titleKey: "login.card_agent_title", title: "Clearing Agent Login",
    descKey: "login.card_agent_desc", description: "Shipping line and clearing workflow access for operational teams.",
    badgeKey: "login.badge_clearing_agent", badge: "Clearing Agent",
    icon: Layers3,
  },
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const params = resolvedSearchParams || {};
  const lang = await getRequestLanguage();

  const rightPanel = (
    <div className="mx-auto flex w-full max-w-[620px] flex-col items-stretch justify-center">
      <div className="rounded-[28px] border border-white/10 bg-white/95 p-6 shadow-2xl shadow-black/20 backdrop-blur-sm lg:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
              <Server className="h-3.5 w-3.5 text-blue-600" />
              {t(lang, "login.org_erp", "Business Group ERP")}
            </div>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900 lg:text-4xl">
              {t(lang, "login.choose_path", "Select access")}
            </h1>
            <p className="mt-3 hidden max-w-xl text-sm leading-6 font-medium text-slate-600 lg:text-base">
              {t(lang, "login.choose_path_sub", "Separate login entry points for Admin, Country, City, and Clearing Agent teams — polished for a professional ERP experience.")}
            </p>
          </div>
          <div className="hidden shrink-0 rounded-3xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-right shadow-sm lg:block">
            <p className="text-[9px] font-black uppercase tracking-[0.22em] text-emerald-700">{t(lang, "common.status", "Status")}</p>
            <p className="mt-1 text-sm font-extrabold text-emerald-700">{t(lang, "login.connected", "Connected")}</p>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {ROLE_CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.href}
                href={card.href}
                className="group rounded-3xl border border-slate-200 bg-slate-50 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:bg-white hover:shadow-xl dark:border-slate-800 dark:bg-slate-950/40"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 ring-1 ring-blue-100 transition-colors group-hover:bg-blue-600 group-hover:text-white dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-900/50">
                      <Icon className="h-5 w-5" aria-hidden />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">
                        {t(lang, card.badgeKey as never, card.badge)}
                      </p>
                      <h2 className="mt-1 text-sm font-black text-slate-900 dark:text-white">
                        {t(lang, card.titleKey as never, card.title)}
                      </h2>
                    </div>
                  </div>
                  <ArrowRight className="mt-1 h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-blue-600" />
                </div>
                <p className="mt-3 hidden text-xs leading-5 font-medium text-slate-600 dark:text-slate-400">
                  {t(lang, card.descKey as never, card.description)}
                </p>
              </Link>
            );
          })}
        </div>

        <div className="mt-6 hidden grid gap-3 sm:grid-cols-3">
          <div className="rounded-3xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
              <Server className="h-3.5 w-3.5 text-blue-600" />
              {t(lang, "login.tile_live_erp", "Live ERP")}
            </div>
            <p className="mt-2 text-sm font-bold text-slate-900 dark:text-white">{t(lang, "login.tile_live_erp_h", "Production-style layout")}</p>
            <p className="mt-1 text-xs font-medium text-slate-500">{t(lang, "login.tile_live_erp_p", "Clear login paths for each operator group.")}</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
              <Building2 className="h-3.5 w-3.5 text-blue-600" />
              {t(lang, "login.tile_brand", "Brand")}
            </div>
            <p className="mt-2 text-sm font-bold text-slate-900 dark:text-white">{t(lang, "login.tile_brand_h", "Business Group")}</p>
            <p className="mt-1 text-xs font-medium text-slate-500">{t(lang, "login.tile_brand_p", "Professional ERP identity for the organization.")}</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              {t(lang, "login.tile_security", "Security")}
            </div>
            <p className="mt-2 text-sm font-bold text-slate-900 dark:text-white">{t(lang, "login.tile_security_h", "Role-aware access")}</p>
            <p className="mt-1 text-xs font-medium text-slate-500">{t(lang, "login.tile_security_p", "Login pages map to the right ERP scope.")}</p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <InstallAppBanner />
      <AuthPortalShell lang={lang} rightPanel={rightPanel}>
        <LoginErrorBoundary>
          <div className="mb-3 hidden rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-4 shadow-xs dark:border-blue-900/40 dark:from-slate-900 dark:to-slate-950">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-blue-700 dark:text-blue-300">
              {t(lang, "login.access_portal", "ERP Access Portal")}
            </p>
            <h2 className="mt-2 text-xl font-black tracking-tight text-slate-900 dark:text-white">
              {t(lang, "login.signin_workspace", "Sign in to the right workspace")}
            </h2>
            <p className="mt-2 text-sm leading-6 font-medium text-slate-600 dark:text-slate-400">
              {t(lang, "login.signin_workspace_sub", "Use the universal login below, or jump straight into a role-specific portal from the cards on the right.")}
            </p>
          </div>

          {params.error && (
            <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
              {decodeURIComponent(params.error)}
            </div>
          )}

          <LoginForm lang={lang} />
        </LoginErrorBoundary>
      </AuthPortalShell>
    </>
  );
}
