import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getCurrentErpSession } from "@/lib/auth/session";
import { supportedLanguages, type SupportedLanguage } from "@/lib/i18n/languages";
import { isSupabaseConfigured } from "@/lib/supabase/config";

function normalizeLanguage(value: string | undefined): SupportedLanguage | null {
  if (!value) return null;
  return supportedLanguages.some((l) => l.code === value) ? (value as SupportedLanguage) : null;
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const isPreviewSession = cookieStore.get("damaan_dashboard_preview")?.value === "1";
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

  return (
    <DashboardShell
      userEmail={session.email ?? "User"}
      userName={session.fullName}
      roles={session.roles}
      permissions={session.permissions}
      lang={cookieLang ?? session.preferredLanguage ?? "en"}
    >
      {children}
    </DashboardShell>
  );
}
