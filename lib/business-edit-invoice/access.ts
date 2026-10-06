import type { ErpSession } from "@/lib/auth/session";

/**
 * Business Edit Invoice permissions — a BUSINESS module. Explicitly NOT tied to
 * Customs / Clearing Agent / Shipping Line / Shipping Agent permissions.
 * Reuses the standard business report/accounting scope (super admin → country →
 * branch → user) already enforced across Purchase / Sales / Ledger.
 */

const MANAGER_ROLES = new Set([
  "super_admin", "super_admin_reports", "country_admin", "main_branch_admin",
  "city_branch_admin", "accountant",
]);

const CLEARING_ONLY_ROLES = new Set(["agent_user", "clearing_agent", "shipping_agent"]);

export function canUseBusinessEditInvoice(session: ErpSession): boolean {
  if (session.isSuperAdmin) return true;
  const roles = session.roles ?? [];
  // a purely clearing/shipping-agent user has no business here
  if (roles.length && roles.every((r) => CLEARING_ONLY_ROLES.has(r))) return false;
  return roles.some((r) => MANAGER_ROLES.has(r) || r === "country_user" || r === "staff_user" || r === "cashier");
}

export function canManageBusinessEditInvoice(session: ErpSession): boolean {
  if (session.isSuperAdmin) return true;
  return (session.roles ?? []).some((r) => MANAGER_ROLES.has(r));
}

export function canEditInvoice(session: ErpSession, inv: { created_by?: string | null; status?: string | null }): boolean {
  if (inv.status === "finalized" || inv.status === "void") return canManageBusinessEditInvoice(session);
  if (canManageBusinessEditInvoice(session)) return true;
  return Boolean(inv.created_by && inv.created_by === session.userId);
}
