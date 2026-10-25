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

/** Roles that may open the COUNTRY-level shipping dashboard (the page also pins the country to the session's own scope). */
export const COUNTRY_SHIPPING_DASHBOARD_ROLES = ["country_admin", "country_operations_admin", "shipping_super_admin", "global_operations_admin", "business_super_admin", "super_admin"] as const;
