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
