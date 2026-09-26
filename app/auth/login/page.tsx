import { LoginForm } from "@/features/auth/components/login-form";
import { LoginErrorBoundary } from "@/features/auth/components/login-error-boundary";
import { getRequestLanguage } from "@/lib/i18n/server";
import { AuthPortalShell } from "@/features/auth/components/auth-portal-shell";
import { LoginScopeProvider } from "@/features/auth/components/login-scope-context";
import { LoginShowcasePanel } from "@/features/auth/components/login-showcase-panel";
import { t } from "@/lib/i18n/ui";

export async function generateMetadata() {
  const lang = await getRequestLanguage();
  return {
    title: t(lang, "login.meta_title", "ERP Access Portal | Damaan Business Group"),
    description: t(lang, "login.meta_description", "Secure Enterprise Login Portal for Damaan Business Group (DGT.LLC)."),
  };
}

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
    <LoginScopeProvider initialLang={lang}>
      <AuthPortalShell layoutVariant="operations" lang={lang} rightPanel={<LoginShowcasePanel lang={lang} />}>
        <LoginErrorBoundary>
          {params.error && (
            <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
              {decodeURIComponent(params.error)}
            </div>
          )}
          {(process.env.APP_ENV || "").toLowerCase() === "development" && (
            <div className="mb-5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/30 dark:text-amber-200">
              {t(lang, "login.dev_banner", "DEV TEST ENVIRONMENT — test data only. Do not enter real business data.")}
            </div>
          )}
          <LoginForm lang={lang} />
        </LoginErrorBoundary>
      </AuthPortalShell>
    </LoginScopeProvider>
  );
}
