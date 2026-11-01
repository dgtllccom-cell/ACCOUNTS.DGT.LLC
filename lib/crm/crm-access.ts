/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * CRM scope - one fail-closed rule for every CRM query.
 *
 * The CRM services used to read `allowedCountryIds` / `allowedBranchIds` from the session and add a filter ONLY when the list was non-empty.
 * A non-Super-Admin whose lists were both empty (a main-branch-only login, an assignment still being set up) therefore got NO filter and read every
 * country's receivables, payables and follow-ups. Now a login with no usable scope gets a scope that matches nothing.
 *   - Super Admin (global scope): no filter.
 *   - Everybody else: its country / city-branch lists; a main-branch login is additionally restricted by country_branch_id; no scope -> nothing.
 *   - Business CRM and Shipping Line CRM stay apart (a Shipping Payment follow-up is Shipping CRM; the receivables / payables are Business financials).
 *   - A login that only sees its own work sees only the follow-ups it is responsible for.
 */

import type { ErpSession } from "@/lib/auth/session";
import { sessionSqlScope } from "@/lib/api/scope-middleware";
import { ErpPermissionError, hasRolePermission } from "@/lib/permissions/middleware";
import { assertNotShippingOnly } from "@/lib/permissions/shipping-explicit-gate";
import { reportScopeLevel, sessionReportDomains } from "@/lib/reports/report-access";

/** matches no row (a valid uuid / text that no record carries) */
export const NO_MATCH_ID = "00000000-0000-0000-0000-000000000000";

const SHIPPING_ITEM = /shipping|clearing|customs/i;

export function crmScopeIds(session: ErpSession): { countries: string[]; branches: string[] } {
  const scope = sessionSqlScope(session);
  if (scope.kind === "all") return { countries: [], branches: [] };
  const countries = session.countryIds ?? [];
  const branches = session.cityBranchIds ?? [];
  // a main-branch login with no city list would otherwise be unfiltered: it fails closed
  if (scope.kind === "countryBranch" && branches.length === 0) return { countries: [NO_MATCH_ID], branches: [] };
  if (countries.length === 0 && branches.length === 0) return { countries: [NO_MATCH_ID], branches: [] };
  return { countries, branches };
}

export function assertCrmRead(session: ErpSession) {
  if (!hasRolePermission(session, "crm", "read") && !hasRolePermission(session, "customers", "read")) {
    throw new ErpPermissionError("Missing permission: crm:read / customers:read");
  }
}

/** Business CRM financials (receivables, payables, customer 360) are never served to a Shipping-only login. */
export function assertBusinessCrm(session: ErpSession) {
  assertNotShippingOnly(session, "Business CRM financial information");
}

/** AND-fragment for crm_action_items: operational domain and (own-work logins) responsible user. */
export function crmItemExtraSql(sql: any, session: ErpSession) {
  if (session.isSuperAdmin) return sql``;
  const dom = sessionReportDomains(session);
  const shippingTest = sql`(item_type ~* ${SHIPPING_ITEM.source} or coalesce(module,'') ~* ${SHIPPING_ITEM.source} or coalesce(source_type,'') ~* ${SHIPPING_ITEM.source})`;
  const domainCond = dom.business && dom.shipping ? sql`` : dom.shipping ? sql`AND ${shippingTest}` : dom.business ? sql`AND NOT ${shippingTest}` : sql`AND false`;
  const ownCond = reportScopeLevel(session) === "own" ? sql`AND responsible_user_id = ${session.userId}` : sql``;
  return sql`${domainCond} ${ownCond}`;
}

/** The domain a manual follow-up created by this login belongs to. */
export function crmModuleFor(session: ErpSession): "business" | "shipping" {
  const dom = sessionReportDomains(session);
  return dom.shipping && !dom.business ? "shipping" : "business";
}
