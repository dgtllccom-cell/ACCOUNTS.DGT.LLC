import type { ErpSession } from "@/lib/auth/session";
import { requireErpSession } from "@/lib/auth/session";
import { assertExplicitScopeAllowed, sessionSqlScope, type ApiScope, type SqlScope } from "@/lib/api/scope-middleware";
import { canAccessCityBranch, canAccessCountry, canAccessCountryBranch, ErpPermissionError, hasRolePermission } from "@/lib/permissions/middleware";
import { assertNotShippingOnly } from "@/lib/permissions/shipping-explicit-gate";

/**
 * One access rule for every Settlement & Reconciliation API (business accounting):
 *  - reads need transactions:read, writes need transactions:create;
 *  - Shipping-only sessions are blocked (business ledgers);
 *  - results are always clamped to the caller's scope (sessionSqlScope), and explicit
 *    country / branch filters outside that scope are rejected with 403.
 */
export async function requireSettlementAccess(
  mode: "read" | "write",
  explicit: ApiScope = {}
): Promise<{ session: ErpSession; scope: SqlScope }> {
  const session = await requireErpSession();
  const action = mode === "read" ? "read" : "create";
  if (!hasRolePermission(session, "transactions", action)) {
    throw new ErpPermissionError(`Missing permission: transactions:${action}`);
  }
  assertNotShippingOnly(session, "Settlement & Reconciliation");
  assertExplicitScopeAllowed(session, explicit);
  return { session, scope: sessionSqlScope(session) };
}

/** True when a single settlement record (its country / branch columns) is inside the caller's scope. */
export function canAccessSettlementRecord(
  session: ErpSession,
  rec: { country_id: string | null; country_branch_id: string | null; city_branch_id: string | null } | null
): boolean {
  if (session.isSuperAdmin) return true;
  if (!rec) return false;
  if (rec.city_branch_id) return canAccessCityBranch(session, rec.city_branch_id);
  if (rec.country_branch_id) return canAccessCountryBranch(session, rec.country_branch_id);
  if (rec.country_id) return canAccessCountry(session, rec.country_id);
  return false;
}
