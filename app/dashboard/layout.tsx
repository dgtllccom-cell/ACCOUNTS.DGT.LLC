import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getCurrentErpSession } from "@/lib/auth/session";
import { MOBILE_PROFILE_HOME } from "@/lib/permissions/mobile-profiles";
import { supportedLanguages, type SupportedLanguage } from "@/lib/i18n/languages";
import { isDemoAuthEnabled } from "@/lib/supabase/config";

function normalizeLanguage(value: string | undefined): SupportedLanguage | null {
  if (!value) return null;
  return supportedLanguages.some((l) => l.code === value) ? (value as SupportedLanguage) : null;
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const isPreviewSession = isDemoAuthEnabled() && cookieStore.get("damaan_dashboard_preview")?.value === "1";
  const cookieLang = normalizeLanguage(cookieStore.get("erp_lang")?.value);

  // Preview mode is explicit via cookie (so the app behaves like production by default).
  if (isPreviewSession) {
    return (
      <DashboardShell userEmail="Template preview" roles={null} permissions={null} lang={cookieLang ?? "en"}>
        {children}
      </DashboardShell>
    );
  }

  // Real session: either Supabase Auth or temporary bootstrapping session.
  const session = await getCurrentErpSession();
  if (!session) {
    redirect("/auth/login");
  }

  // A user on a simplified mobile profile never sees the full ERP dashboard —
  // send them straight to their assigned mobile interface.
  if (session.mobileProfile && session.mobileProfile !== "standard") {
    redirect(MOBILE_PROFILE_HOME[session.mobileProfile]);
  }

  // An admin-issued temporary password reset must be replaced before the user
  // can use the rest of the ERP.
  if (session.mustChangePassword) {
    redirect("/auth/set-new-password");
  }

  return (
    <DashboardShell
      userEmail={session.email ?? "User"}
      userName={session.fullName}
      currentUserId={session.userId}
      roles={session.roles}
      permissions={session.permissions}
      lang={cookieLang ?? session.preferredLanguage ?? "en"}
    >
      {children}
    </DashboardShell>
  );
}
