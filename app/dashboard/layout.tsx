import { cookies, headers } from "next/headers";
import { forbidden, redirect } from "next/navigation";
import { evaluateRouteAccess } from "@/lib/navigation/route-policy";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getCurrentErpSession } from "@/lib/auth/session";
import { MOBILE_PROFILE_HOME } from "@/lib/permissions/mobile-profiles";
import { appChannelFromUserAgent, channelAllowsSession } from "@/lib/mobile/app-channel";
import { supportedLanguages, type SupportedLanguage } from "@/lib/i18n/languages";

function normalizeLanguage(value: string | undefined): SupportedLanguage | null {
  if (!value) return null;
  return supportedLanguages.some((l) => l.code === value) ? (value as SupportedLanguage) : null;
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const cookieLang = normalizeLanguage(cookieStore.get("erp_lang")?.value);

  // (The former "template preview" cookie rendered the ERP shell with NO session and skipped the route gate below; removed.)
  // Real session: either Supabase Auth or temporary bootstrapping session.
  const session = await getCurrentErpSession();
  if (!session) {
    redirect("/auth/login");
  }

  // Store apps: "DGT.llc B" (Business) and "DGT.llc BS" (Business Shipping) share this ERP; a login that belongs to the OTHER app
  // is told which app to use instead of landing in modules it can never open. (Channel only — permissions are enforced below / by the APIs.)
  const channel = appChannelFromUserAgent((await headers()).get("user-agent"));
  if (channel && !channelAllowsSession(channel, session)) {
    redirect(`/auth/app-access?app=${channel}`);
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

  // SERVER-side route gate: a pasted/typed URL the login may not open answers 403 (the client guard and the sidebar use the same policy).
  const requested = (await headers()).get("x-erp-pathname") ?? "";
  if (requested.startsWith("/dashboard")) {
    const decision = evaluateRouteAccess({
      pathname: requested,
      permissions: session.permissions,
      roles: session.roles,
      operationalDomains: session.operationalDomains,
      canViewFinancials: session.canViewFinancials,
    });
    if (!decision.allowed) forbidden();
  }

  return (
    <DashboardShell
      userEmail={session.email ?? "User"}
      userName={session.fullName}
      currentUserId={session.userId}
      roles={session.roles}
      permissions={session.permissions}
      isShippingScoped={session.isShippingScoped}
      operationalDomains={session.operationalDomains}
      ledgerVisibility={session.ledgerVisibility}
      canViewFinancials={session.canViewFinancials}
      lang={cookieLang ?? session.preferredLanguage ?? "en"}
    >
      {children}
    </DashboardShell>
  );
}
