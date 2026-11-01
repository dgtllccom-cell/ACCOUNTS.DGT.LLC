/**
 * One place that answers "may this login open this report / audit endpoint, and which operational domain's records may it see?".
 *
 * Rules (enforced on the SERVER by the API routes and the page guards - hiding a button is never the control):
 *   - Audit evidence (edit history, deleted records, activity, version timeline, audit export) is for audit-eligible roles only:
 *     Super Admin and the domain Super Admins, the country / main-branch / branch admins (inside their own scope), the Shipping Line admins
 *     (Shipping records only) and auditors. A normal user (cashier, staff, agent, accountant, country user) never reads another person's audit trail.
 *   - A Business login never sees Shipping Line audit records, a Shipping-only login never sees Business records (they carry Business amounts).
 *   - Super-Admin-only pages (the system forms directory, the global activity monitor) are closed to every other role.
 * The row scope (country / branch) is applied separately by the routes (resolveReportScope + enforceScopeFilters / sessionSqlScope).
 */

import type { ErpSession } from "@/lib/auth/session";
import { ErpPermissionError, hasRolePermission } from "@/lib/permissions/middleware";

type SessionLike = Pick<ErpSession, "isSuperAdmin" | "roles" | "operationalDomains">;

/** Roles that may read audit evidence (inside their own scope and domain). */
export const AUDIT_READER_ROLES: readonly string[] = [
  "super_admin",
  "super_admin_reports",
  "auditor_viewer",
  "business_super_admin",
  "shipping_super_admin",
  "country_admin",
  "main_branch_admin",
  "city_branch_admin",
  "shipping_line_admin",
  "global_operations_admin",
  "country_operations_admin",
  "city_operations_admin"
];

/** Record tables that belong to the Shipping Line world (everything else in the change history is Business / master data). */
const SHIPPING_RECORD_TABLE = /^(clearing_|shipping_|customs_|truck|container|bl_|bills_of_lading|customer_receipts)/i;

export function isShippingRecordTable(table: string | null | undefined): boolean {
  return SHIPPING_RECORD_TABLE.test(String(table ?? "").trim());
}

/** Which operational domains this login's reports may cover. */
export function sessionReportDomains(session: SessionLike): { business: boolean; shipping: boolean } {
  if (session.isSuperAdmin) return { business: true, shipping: true };
  const roles = session.roles ?? [];
  if (roles.includes("super_admin_reports")) return { business: true, shipping: true };
  const d = session.operationalDomains ?? ["business"];
  const both = d.includes("both");
  return { business: both || d.includes("business") || d.length === 0, shipping: both || d.includes("shipping") };
}

export function canReadAudit(session: SessionLike & Parameters<typeof hasRolePermission>[0]): boolean {
  if (session.isSuperAdmin) return true;
  if ((session.roles ?? []).some((r) => AUDIT_READER_ROLES.includes(r))) return true;
  return hasRolePermission(session, "audit_logs", "read");
}

/** Throws a 403 for a login that is not audit-eligible. */
export function assertAuditAccess(session: SessionLike & Parameters<typeof hasRolePermission>[0], what = "Audit records"): void {
  if (!canReadAudit(session)) {
    throw new ErpPermissionError(`${what} are restricted to audit-eligible roles.`);
  }
}

/** True when an audit row about `recordTable` may be shown to this login (Business and Shipping records stay separate). */
export function auditTableVisible(session: SessionLike, recordTable: string | null | undefined): boolean {
  const d = sessionReportDomains(session);
  return isShippingRecordTable(recordTable) ? d.shipping : d.business;
}

/** Throws a 403 unless the login is the (global) Super Admin. */
export function assertSuperAdminOnly(session: SessionLike, what = "This report"): void {
  if (!session.isSuperAdmin) {
    throw new ErpPermissionError(`${what} is available to the Super Admin only.`);
  }
}

/** The scope level a login's reports are limited to, for the Reports Center header and the report scope badges. */
export type CenterScopeLevel = "global" | "country" | "main_branch" | "branch" | "own";

export function reportScopeLevel(session: SessionLike): CenterScopeLevel {
  if (session.isSuperAdmin) return "global";
  const roles = session.roles ?? [];
  if (roles.some((r) => ["super_admin_reports", "global_operations_admin", "business_super_admin", "shipping_super_admin"].includes(r))) return "global";
  if (roles.some((r) => ["country_admin", "country_operations_admin", "country_user"].includes(r))) return "country";
  if (roles.includes("main_branch_admin")) return "main_branch";
  if (roles.some((r) => ["city_branch_admin", "city_operations_admin", "shipping_line_admin"].includes(r))) return "branch";
  return "own";
}

/**
 * The permission a Reports Center register / record needs: Business reports need reports:read; Shipping Line reports need reports:read OR
 * shipping_reports:read (the Shipping operations admins hold the latter). Throws a 403 otherwise.
 */
export function assertCenterRead(session: SessionLike & Parameters<typeof hasRolePermission>[0], domain: "business" | "shipping"): void {
  if (hasRolePermission(session, "reports", "read")) return;
  if (domain === "shipping" && hasRolePermission(session, "shipping_reports", "read")) return;
  throw new ErpPermissionError("Missing permission: reports:read");
}
