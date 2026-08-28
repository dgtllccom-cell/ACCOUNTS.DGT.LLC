import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import type { ErpSession } from "@/lib/auth/session";
import type { ContractScope } from "@/lib/services/contract-register-service";

/**
 * Shared guard for every /api/erp/hr/contracts/** route.
 *   read  -> contracts:read
 *   write -> contracts:write   (follow-ups / reminder sync)
 * Scope: super_admin / super_admin_reports = global (null); everyone else is
 * pinned to their assigned countries + (branch users) branches. The service
 * repeats the filter in its WHERE because withLocalPg bypasses RLS.
 */
export async function guardContracts(
  action: "read" | "write",
): Promise<{ session: ErpSession; scope: ContractScope }> {
  const session = await requireErpSession();
  authorizeApiScope(session, { resource: "contracts", action: action === "read" ? "read" : "write" });
  return { session, scope: contractScopeFromSession(session) };
}

export function contractScopeFromSession(session: ErpSession): ContractScope {
  if (session.isSuperAdmin || session.roles?.includes("super_admin_reports")) {
    return { countryIds: null, cityBranchIds: null };
  }
  return {
    countryIds: session.countryIds.length ? session.countryIds : ["00000000-0000-0000-0000-000000000000"],
    cityBranchIds: session.cityBranchIds.length ? session.cityBranchIds : null,
  };
}
