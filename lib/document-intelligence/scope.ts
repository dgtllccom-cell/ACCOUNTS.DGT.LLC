/**
 * AI Document Intake — scoped composite identity + isolation.
 *
 * A document / record is NEVER identified by a contract number alone. Every job
 * carries a composite identity across:
 *   operational_domain · company · country · main branch · city branch ·
 *   clearing agent · shipping customer · source module · source id ·
 *   purchase/sales booking id · contract ref · document ref · container/BL ref
 *
 * Business ⟷ Shipping are isolated. A Business record never exposes internal
 * price / profit / payment / ledger data to a Shipping/Clearing Agent, and a
 * Shipping document never auto-attaches to a Business record.
 */

import { sessionSqlScope } from "@/lib/api/scope-middleware";
import type { ErpSession } from "@/lib/auth/session";
import { ErpPermissionError } from "@/lib/permissions/middleware";

export type OperationalDomain = "business" | "shipping";

export type IntakeScope = {
  domain: OperationalDomain | null;      // null = both (super admin viewing the whole queue)
  countryIds: string[] | null;           // null = global
  countryBranchIds: string[] | null;
  cityBranchIds: string[] | null;
  clearingAgentIds: string[] | null;     // shipping domain isolation
  isSuperAdmin: boolean;
  /** Branch users only: main branches they are assigned to at main-branch level (see SqlScope). */
  ownCountryBranchIds?: string[] | null;
};

export type CompositeIdentityInput = {
  operationalDomain: OperationalDomain;
  companyId?: string | null;
  countryId?: string | null;
  countryBranchId?: string | null;
  cityBranchId?: string | null;
  clearingAgentId?: string | null;
  shippingCustomerId?: string | null;
  sourceModule?: string | null;
  sourceId?: string | null;
  purchaseOrderId?: string | null;
  salesOrderId?: string | null;
  contractReference?: string | null;
  documentReference?: string | null;
  containerReference?: string | null;
  blReference?: string | null;
};

/** Build the deterministic composite identity string. Sorted, lower-cased components. */
export function buildCompositeIdentity(i: CompositeIdentityInput): string {
  const parts: Array<[string, string | null | undefined]> = [
    ["dom", i.operationalDomain],
    ["co", i.countryId],
    ["mb", i.countryBranchId],
    ["cb", i.cityBranchId],
    ["cmp", i.companyId],
    ["agt", i.clearingAgentId],
    ["scust", i.shippingCustomerId],
    ["mod", i.sourceModule],
    ["sid", i.sourceId],
    ["po", i.purchaseOrderId],
    ["so", i.salesOrderId],
    ["con", i.contractReference?.trim().toUpperCase() || null],
    ["doc", i.documentReference?.trim().toUpperCase() || null],
    ["ctr", i.containerReference?.trim().toUpperCase() || null],
    ["bl", i.blReference?.trim().toUpperCase() || null],
  ];
  return parts
    .filter(([, v]) => v != null && v !== "")
    .map(([k, v]) => `${k}:${String(v).toLowerCase()}`)
    .join("|");
}

export function intakeScopeFromSession(session: ErpSession, domain?: OperationalDomain | null): IntakeScope {
  const globalRead = session.isSuperAdmin || session.roles?.includes("super_admin_reports");
  // A shipping-only login (bound to a clearing agent, no 'full' grant) is pinned
  // to the shipping domain + its own agent(s).
  const forcedDomain: OperationalDomain | null = session.isShippingScoped ? "shipping" : (domain ?? null);
  const sq = sessionSqlScope(session);
  return {
    domain: forcedDomain,
    countryIds: globalRead ? null : (session.countryIds.length ? session.countryIds : ["00000000-0000-0000-0000-000000000000"]),
    // One scope rule (sessionSqlScope): country roles are filtered by country only; branch users by
    // their own city branches (+ rows saved at their own main-branch level). A country admin's
    // session also lists every city branch of the country, so it must not become a branch filter.
    countryBranchIds: globalRead ? null : sq.kind === "countryBranch" ? sq.ids : null,
    cityBranchIds: globalRead ? null : sq.kind === "cityBranch" ? sq.ids : null,
    ownCountryBranchIds: sq.kind === "cityBranch" ? sq.ownCountryBranchIds ?? [] : null,
    clearingAgentIds: session.isShippingScoped
      ? (session.clearingAgentIds.length ? session.clearingAgentIds : ["00000000-0000-0000-0000-000000000000"])
      : (globalRead ? null : (session.clearingAgentIds.length ? session.clearingAgentIds : null)),
    isSuperAdmin: session.isSuperAdmin,
  };
}

/** SQL WHERE fragment for `document_intake_jobs j` (or the queue view aliased `j`). */
export function jobScopeWhere(sql: any, scope: IntakeScope) {
  const parts: any[] = [];
  if (scope.domain) parts.push(sql`j.operational_domain = ${scope.domain}`);
  // A job with no country / branch is NOT visible to every scoped user (it used to be) — only to
  // global readers; branch users see their own branches (+ their own main-branch-level jobs).
  if (scope.countryIds) parts.push(sql`j.country_id = ANY(${scope.countryIds})`);
  if (scope.countryBranchIds) parts.push(sql`j.country_branch_id = ANY(${scope.countryBranchIds})`);
  if (scope.cityBranchIds) {
    parts.push(sql`(j.city_branch_id = ANY(${scope.cityBranchIds}) OR (j.city_branch_id IS NULL AND j.country_branch_id = ANY(${scope.ownCountryBranchIds ?? []}::uuid[])))`);
  }
  if (scope.clearingAgentIds) {
    // shipping-scoped users only see their own agent's jobs
    parts.push(sql`(j.clearing_agent_id = ANY(${scope.clearingAgentIds}) OR j.clearing_agent_id IS NULL)`);
  }
  if (!parts.length) return sql`TRUE`;
  return parts.reduce((a, p, idx) => (idx === 0 ? p : sql`${a} AND ${p}`));
}

/** True if a candidate row's scope is inside the user's scope. */
export function rowInScope(
  scope: IntakeScope,
  row: { country_id?: string | null; country_branch_id?: string | null; city_branch_id?: string | null; clearing_agent_id?: string | null; operational_domain?: string | null },
): boolean {
  if (scope.domain && row.operational_domain && row.operational_domain !== scope.domain) return false;
  if (scope.countryIds && (!row.country_id || !scope.countryIds.includes(row.country_id))) return false;
  if (scope.countryBranchIds && (!row.country_branch_id || !scope.countryBranchIds.includes(row.country_branch_id))) return false;
  if (scope.cityBranchIds) {
    const own = row.city_branch_id
      ? scope.cityBranchIds.includes(row.city_branch_id)
      : !!row.country_branch_id && (scope.ownCountryBranchIds ?? []).includes(row.country_branch_id);
    if (!own) return false;
  }
  if (scope.clearingAgentIds && row.clearing_agent_id && !scope.clearingAgentIds.includes(row.clearing_agent_id)) return false;
  return true;
}

export function assertRowInScope(scope: IntakeScope, row: Parameters<typeof rowInScope>[1]): void {
  if (!rowInScope(scope, row)) {
    throw new ErpPermissionError("This document / record is outside your country, branch or agent scope.");
  }
}

export const NO_MATCH_MESSAGE = "No authorized matching record was found in your country/branch scope.";
