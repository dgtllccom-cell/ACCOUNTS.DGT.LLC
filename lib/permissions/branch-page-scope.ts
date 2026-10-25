import type { ErpSession } from "@/lib/auth/session";
import { canAccessCityBranch } from "@/lib/permissions/middleware";

/**
 * The city branch a branch-level page (Branch Reports, User Permission Management, …) may show.
 *
 * Always inside the session's own scope: a requested branch must be one the login may access (Global sessions: any), and a login
 * without a branch of its own gets NOTHING — there is no "first active branch of the database" fallback for anyone but a Global
 * Super Admin, who is the only login that may look at a branch it is not assigned to.
 */
export function resolveScopedCityBranch(
  session: ErpSession,
  requestedBranchId?: string | null
): { branchId: string | null; denied: boolean } {
  const requested = (requestedBranchId ?? "").trim() || null;
  if (requested) {
    return canAccessCityBranch(session, requested) ? { branchId: requested, denied: false } : { branchId: null, denied: true };
  }
  const own = session.cityBranchIds?.[0] ?? session.assignments?.find((a) => a.cityBranchId)?.cityBranchId ?? null;
  return { branchId: own, denied: false };
}

/**
 * A login bound to ONE operational domain (Business only / Shipping only) never opens a branch of the other domain — the same rule the
 * users API applies when it assigns a user to a branch. Returns true when the branch may be shown.
 */
export function branchDomainAllowed(session: ErpSession, branchDomain: string | null | undefined): boolean {
  if (session.isSuperAdmin) return true;
  const d = session.operationalDomains ?? [];
  const single = d.length > 0 && !d.includes("both") && !(d.includes("business") && d.includes("shipping")) ? d[0] : null;
  if (!single) return true;
  const b = branchDomain || "business";
  return b === "both" || b === single;
}

/** Roles that may open the COUNTRY-level shipping dashboard (the page also pins the country to the session's own scope). */
export const COUNTRY_SHIPPING_DASHBOARD_ROLES = ["country_admin", "country_operations_admin", "shipping_super_admin", "global_operations_admin", "business_super_admin", "super_admin"] as const;
