import { canAccessCountry, canAccessCityBranch, canAccessCountryBranch } from "@/lib/permissions/middleware";

/**
 * Extracted from app/api/erp/clearing-agent/customer-order/[id]/route.ts so it
 * can be shared with sibling routes (e.g. the approval sub-route) without a
 * non-handler export from a route.ts file — that fails the generated
 * .next/types route-shape check (same reason app/api/erp/roznamcha/posting.ts
 * was split out of roznamcha/route.ts).
 *
 * A record scoped to a country/branch a non-super-admin doesn't belong to must
 * never be readable/writable by them, even if they know the id — mirrors the
 * canAccessCountry/CityBranch checks every other hardened module in this ERP uses.
 */
export function canAccessOrder(session: any, order: Record<string, any>) {
  if (session.isSuperAdmin) return true;
  if (order.clearing_agent_id && (session.clearingAgentIds ?? []).includes(order.clearing_agent_id)) return true;
  if (order.city_branch_id && canAccessCityBranch(session, order.city_branch_id)) return true;
  if (order.country_branch_id && canAccessCountryBranch(session, order.country_branch_id)) return true;
  if (order.country_id && canAccessCountry(session, order.country_id)) return true;
  if (order.created_by && order.created_by === session.userId) return true;
  // An order created before this scope model existed has no scope columns set at
  // all — fail open only for that legacy case so existing data stays reachable,
  // never for a row that has a scope which simply doesn't match this session.
  if (!order.country_id && !order.country_branch_id && !order.city_branch_id && !order.clearing_agent_id && !order.created_by) return true;
  return false;
}
