import { LoginForm } from "@/features/auth/components/login-form";
import { LoginErrorBoundary } from "@/features/auth/components/login-error-boundary";
import { getRequestLanguage } from "@/lib/i18n/server";
import { AuthPortalShell } from "@/features/auth/components/auth-portal-shell";
import { LoginScopeProvider } from "@/features/auth/components/login-scope-context";
import { LoginShowcasePanel } from "@/features/auth/components/login-showcase-panel";

export const metadata = {
  title: "ERP Access Portal | Damaan Business Group",
  description: "Secure Enterprise Login Portal for Damaan Business Group (DGT.LLC).",
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
    <LoginScopeProvider initialLang={lang}>
      <AuthPortalShell lang={lang} rightPanel={<LoginShowcasePanel lang={lang} />}>
        <LoginErrorBoundary>
          {params.error && (
            <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
              {decodeURIComponent(params.error)}
            </div>
          )}
          <LoginForm lang={lang} />
        </LoginErrorBoundary>
      </AuthPortalShell>
    </LoginScopeProvider>
  );
}
