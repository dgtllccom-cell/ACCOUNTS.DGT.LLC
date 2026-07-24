import type { EnterpriseRole } from "@/lib/permissions/enterprise-roles";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { sidebarTree } from "@/lib/navigation/sidebar";
import { DashboardFrame } from "@/components/layout/dashboard-frame";

export function DashboardShell({
  children,
  userEmail,
  userName,
  roles,
  permissions,
  lang
}: {
  children: React.ReactNode;
  userEmail: string;
  userName?: string | null;
  roles: EnterpriseRole[] | null;
  permissions?: string[] | null;
  lang: SupportedLanguage;
}) {
  const isDemoMode = userEmail === "Demo mode" || userEmail === "Template preview";

  return (
    <DashboardFrame nodes={sidebarTree} roles={roles} permissions={permissions ?? null} lang={lang} userEmail={userEmail} userName={userName}>
      {isDemoMode ? (
        <div className="mb-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Supabase is not configured (or you are in preview), so this is a local UI preview.
        </div>
      ) : null}
      {children}
    </DashboardFrame>
  );
}
