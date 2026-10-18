import type { ErpSession } from "@/lib/auth/session";
import { hasRolePermission, ErpPermissionError } from "@/lib/permissions/middleware";

/**
 * CRM and Employee Management have no per-resource permission gate today — every
 * existing role reaches them via `requireErpSession()` alone. Adding a blanket
 * `authorizeApiScope` requirement there would silently lock out every role that
 * currently works (accountant, cashier, country_admin, ...), none of which carry a
 * `crm:*`/`employees:*` token. Per the owner's explicit requirement ("Allow ... to
 * Shipping users only through explicit permission"), this gate is additive-only: it
 * restricts ONLY a Shipping Line session (agent_user / shipping-scoped), and only when
 * that session lacks the specific new permission — every other existing role's access
 * is completely unchanged.
 */
export function assertShippingUserExplicitPermission(session: ErpSession, resource: string, action: string) {
  const isShippingUser = !session.isSuperAdmin && (session.roles?.includes("agent_user") || session.isShippingScoped);
  if (!isShippingUser) return;
  if (!hasRolePermission(session, resource, action)) {
    throw new ErpPermissionError(`Missing permission: ${resource}:${action}`);
  }
}

/** A login bound only to the Shipping operational domain (never Business/both), not Super Admin. */
export function isShippingDomainOnly(session: ErpSession) {
  if (session.isSuperAdmin) return false;
  const d = session.operationalDomains ?? ["business"];
  return d.length > 0 && !d.includes("business") && !d.includes("both");
}

/** Permission-or-wildcard check for tokens outside the resource:action helper's normalisation. */
export function sessionHasToken(session: ErpSession, resource: string, action: string) {
  return hasRolePermission(session, resource, action);
}

/**
 * Business-confidential reports/ledgers (trial balance, general ledger, roznamcha, payments,
 * journal, business summary ...) are refused to a Shipping-only login regardless of which
 * report/account permissions it holds — the Shipping equivalents are the domain-filtered
 * account statement and the shipping report types.
 */
export function assertNotShippingOnly(session: ErpSession, what = "This report") {
  if (isShippingDomainOnly(session)) {
    throw new ErpPermissionError(`${what} contains Business data and is not available to a Shipping-only login.`);
  }
}

/** Report types a Shipping-only login may run on /api/erp/reports/scoped. */
export const SHIPPING_ONLY_REPORT_TYPES = new Set(["loading"]);

/** A login bound only to the Business operational domain (never Shipping/both), not Super Admin. */
export function isBusinessDomainOnly(session: ErpSession) {
  if (session.isSuperAdmin) return false;
  const d = session.operationalDomains ?? ["business"];
  return d.length > 0 && !d.includes("shipping") && !d.includes("both");
}

/**
 * Mirror of assertNotShippingOnly for the Shipping Line ACCOUNTING surface (customer bills, payment bills, agent entries, Shipping
 * account access, customer receipts, Shipping transfers): a Business-only login receives a 403 response, whatever permission it holds.
 * Shared logistics data used by Business pages (loading records, pickers, handovers) is deliberately not behind this gate.
 * Returns null when allowed, so a route can `const denied = shippingAccountingDenied(session); if (denied) return denied;`.
 */
export function shippingAccountingDenied(session: ErpSession | null | undefined): Response | null {
  if (!session || !isBusinessDomainOnly(session)) return null;
  return Response.json(
    { ok: false, success: false, error: { code: "DOMAIN_FORBIDDEN", message: "This is Shipping Line accounting data and your login belongs to the Business domain." } },
    { status: 403 }
  );
}
