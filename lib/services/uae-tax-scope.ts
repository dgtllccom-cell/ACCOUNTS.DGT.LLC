import type { ErpSession } from "@/lib/auth/session";
import type { UaeTaxScope } from "@/lib/services/uae-tax-service";

/**
 * Derives the service-layer scope constraint from an ERP session.
 * Super admin / super_admin_reports -> global (null). Everyone else is pinned
 * to their assigned countries and (where they are branch-scoped) branches.
 *
 * `withLocalPg` bypasses RLS, so the service applies this in its WHERE clause.
 */
export function uaeTaxScopeFromSession(session: ErpSession): UaeTaxScope {
  if (session.isSuperAdmin || session.roles?.includes("super_admin_reports")) {
    return { countryIds: null, cityBranchIds: null };
  }
  return {
    countryIds: session.countryIds.length ? session.countryIds : ["00000000-0000-0000-0000-000000000000"],
    cityBranchIds: session.cityBranchIds.length ? session.cityBranchIds : null,
  };
}
