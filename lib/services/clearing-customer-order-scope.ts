import { canAccessCountry, canAccessCityBranch, canAccessCountryBranch, isGlobalSession } from "@/lib/permissions/middleware";
import { isCountryLevelRole } from "@/lib/permissions/enterprise-roles";

/**
 * Extracted from app/api/erp/clearing-agent/customer-order/[id]/route.ts so it
 * can be shared with sibling routes (e.g. the approval sub-route) without a
 * non-handler export from a route.ts file — that fails the generated
 * .next/types route-shape check (same reason app/api/erp/roznamcha/posting.ts
 * was split out of roznamcha/route.ts).
 *
 * A record scoped to a country/branch a non-super-admin doesn't belong to must
 * never be readable/writable by them, even if they know the id.
 *
 * The MOST SPECIFIC scope column of the order decides (RBAC audit 2026-10):
 *   city branch set   -> the login must hold that city branch (a Deira admin never opens an Al Ras order merely because both
 *                        are in the UAE — the old country check let it through);
 *   main branch only  -> the login must hold that main branch;
 *   country only      -> only a country-level (or global) login.
 * Assigned-only logins (clearing agent, shipping line roles) open an order only when it is assigned to them: their agent, their
 * own record, or a handover addressed to them — never every order of their branch.
 * Orders with no scope at all are reachable by global logins only (they used to fail open for everyone).
 */
const ASSIGNED_ONLY_ROLES = new Set(["agent_user", "shipping_line_user", "shipping_line_admin"]);

function inBranchScope(session: any, city?: string | null, main?: string | null, country?: string | null): boolean {
  if (city) return canAccessCityBranch(session, city);
  if (main) return canAccessCountryBranch(session, main);
  if (country) return (session.roles ?? []).some((r: string) => isCountryLevelRole(r)) && canAccessCountry(session, country);
  return false;
}

export function canAccessOrder(session: any, order: Record<string, any>) {
  if (session.isSuperAdmin) return true;
  if (order.created_by && order.created_by === session.userId) return true;
  if (order.latest_handover?.receiver_user_id && order.latest_handover.receiver_user_id === session.userId) return true;
  if (order.clearing_agent_id && (session.clearingAgentIds ?? []).includes(order.clearing_agent_id)) return true;

  const roles: string[] = session.roles ?? [];
  const assignedOnly = Boolean(session.isShippingScoped) || (roles.length > 0 && roles.every((r) => ASSIGNED_ONLY_ROLES.has(r)));
  if (assignedOnly) return false;

  if (isGlobalSession(session)) return true;
  if (inBranchScope(session, order.city_branch_id, order.country_branch_id, order.country_id)) return true;
  const h = order.latest_handover;
  if (h && inBranchScope(session, h.dest_city_branch_id, h.dest_country_branch_id, null)) return true;
  return false;
}
