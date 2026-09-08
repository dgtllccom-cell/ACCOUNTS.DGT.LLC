import { redirect } from "next/navigation";
import { getCurrentErpSession, type ErpSession } from "@/lib/auth/session";
import { MOBILE_PROFILE_HOME, type MobileProfile } from "@/lib/permissions/mobile-profiles";

/**
 * Server guard for a mobile-interface route group. Returns the session only when
 * the user is allowed to be here:
 *   - a user ON this exact mobile profile, or
 *   - a super admin (so an admin can preview / support the interface).
 * Everyone else is redirected to where they belong.
 */
export async function requireMobileProfile(profile: Exclude<MobileProfile, "standard">): Promise<ErpSession> {
  const session = await getCurrentErpSession();
  if (!session) redirect("/auth/login");

  if (session.isSuperAdmin) return session;

  if (session.mobileProfile === profile) return session;

  // A different mobile profile → send to its own home; a standard user → dashboard.
  if (session.mobileProfile && session.mobileProfile !== "standard") {
    redirect(MOBILE_PROFILE_HOME[session.mobileProfile]);
  }
  redirect("/dashboard");
}
