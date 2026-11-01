import { requireErpSession } from "@/lib/auth/session";
import type { ErpSession } from "@/lib/auth/session";
import { ErpPermissionError } from "@/lib/permissions/middleware";
import { sessionSqlScope, type SqlScope } from "@/lib/api/scope-middleware";

/**
 * Shared guard for the HRM / Office-Management routes (departments, designations,
 * employment history, KYC, attendance, leave, payroll …).
 *
 * HR data is gated by role rather than by a per-resource permission string
 * (the enterprise role catalog has no `employees:*` grants) — mirroring the
 * role lists already used for the General Office sidebar group. Geographic scope
 * is still enforced by each service repeating the country/branch filter in its
 * WHERE clause (withLocalPg bypasses RLS).
 */
const HR_READ_ROLES = new Set([
  "super_admin",
  "super_admin_reports",
  "country_admin",
  "country_user",
  "main_branch_admin",
  "city_branch_admin",
  "accountant",
  "auditor_viewer",
  "hr_admin",
  "hr_manager",
  "payroll_officer",
]);

const HR_WRITE_ROLES = new Set([
  "super_admin",
  "country_admin",
  "main_branch_admin",
  "city_branch_admin",
  "accountant",
  "hr_admin",
  "hr_manager",
  "payroll_officer",
]);

export type HrScope = {
  countryIds: string[] | null;
  cityBranchIds: string[] | null;
  countryBranchIds: string[] | null;
  /** Set for branch-level users (sessionSqlScope kind "cityBranch"): employee-level HR records
   *  are limited to these city branches. null = country-level or global access. */
  branchCityIds: string[] | null;
  /** The shared scope rule (sessionSqlScope) - KYC / document queries apply it with sqlScopeCondition so main-branch logins stay on their branch. */
  sqlScope: SqlScope;
  /** Set for a login that may only see its OWN employee profile (no HR role): every query narrows to employees.user_id = this. */
  ownUserId?: string | null;
};

/** Branch restriction for an HR record alias whose table carries city_branch_id. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function hrBranch(sql: any, scope: HrScope, alias: string) {
  if (!scope.branchCityIds) return sql`TRUE`;
  return sql`${sql(alias + ".city_branch_id")} = ANY(${scope.branchCityIds})`;
}

export function hrScopeFromSession(session: ErpSession): HrScope {
  if (session.isSuperAdmin || session.roles?.includes("super_admin_reports")) {
    return { countryIds: null, cityBranchIds: null, countryBranchIds: null, branchCityIds: null, sqlScope: { kind: "all" } };
  }
  // A real city/branch-admin assignment carries country_id + country_branch_id +
  // city_branch_id, but getAssignmentRoots() only keeps the deepest level as the
  // authority root — so session.countryIds can be empty for a branch admin whose
  // own branch employees DO have a country_id. Recover the country context from
  // the raw assignments so the country filter doesn't collapse to the
  // "match nothing" sentinel and hide the admin's own branch.
  const asgCountryIds = [...new Set((session.assignments ?? []).map((a) => a.countryId).filter((v): v is string => Boolean(v)))];
  const countryIds = session.countryIds.length
    ? session.countryIds
    : (asgCountryIds.length ? asgCountryIds : ["00000000-0000-0000-0000-000000000000"]);
  return {
    countryIds,
    cityBranchIds: session.cityBranchIds.length ? session.cityBranchIds : null,
    countryBranchIds: session.countryBranchIds.length ? session.countryBranchIds : null,
    // One scope rule (sessionSqlScope): branch users see only their own branch's HR records.
    branchCityIds: (() => { const sc = sessionSqlScope(session); return sc.kind === "cityBranch" ? sc.ids : null; })(),
    sqlScope: sessionSqlScope(session),
  };
}

/** Non-throwing role check (same role lists as guardHr) for mixed-audience features. */
export function hasHrRole(session: ErpSession, action: "read" | "write"): boolean {
  if (session.isSuperAdmin) return true;
  const allowed = action === "read" ? HR_READ_ROLES : HR_WRITE_ROLES;
  return (session.roles ?? []).some((r) => allowed.has(r));
}

export async function guardHr(action: "read" | "write"): Promise<{ session: ErpSession; scope: HrScope }> {
  const session = await requireErpSession();
  const roles: string[] = session.roles ?? [];
  const allowed = action === "read" ? HR_READ_ROLES : HR_WRITE_ROLES;
  if (!session.isSuperAdmin && !roles.some((r) => allowed.has(r))) {
    throw new ErpPermissionError(`HRM ${action} is not permitted for this user.`);
  }
  return { session, scope: hrScopeFromSession(session) };
}

/**
 * Employee KYC / QVC permissions - VIEW, UPLOAD/EDIT and APPROVE/REJECT are three different rights.
 *   - view:   any HR reader inside the HR scope; every other login sees ONLY its own employee profile (employees.user_id).
 *   - upload: the HR write roles (not own-profile logins).
 *   - verify: the narrower approver list (payroll officers and accountants keep their HR write rights but do not approve identity documents).
 *   - identifiers: ID / passport numbers and the file reference are shown in full only to those who maintain them (and to the employee himself);
 *     read-only HR roles (auditor, country user) see them masked.
 */
const HR_KYC_VERIFY_ROLES = new Set(["super_admin", "country_admin", "main_branch_admin", "city_branch_admin", "hr_admin", "hr_manager"]);

export type HrKycCaps = { ownOnly: boolean; upload: boolean; verify: boolean; identifiers: boolean };

export function hrKycCaps(session: ErpSession): HrKycCaps {
  const isHrReader = hasHrRole(session, "read");
  const upload = isHrReader && hasHrRole(session, "write");
  const verify = isHrReader && (session.isSuperAdmin || (session.roles ?? []).some((r) => HR_KYC_VERIFY_ROLES.has(r)));
  return { ownOnly: !isHrReader, upload, verify, identifiers: !isHrReader || upload };
}

export async function guardHrKyc(action: "read" | "upload" | "verify"): Promise<{ session: ErpSession; scope: HrScope; caps: HrKycCaps }> {
  const session = await requireErpSession();
  const caps = hrKycCaps(session);
  if (action === "upload" && !caps.upload) throw new ErpPermissionError("Uploading or editing employee KYC documents is not permitted for this user.");
  if (action === "verify" && !caps.verify) throw new ErpPermissionError("Approving or rejecting employee KYC documents is not permitted for this user.");
  const scope = hrScopeFromSession(session);
  return { session, caps, scope: caps.ownOnly ? { ...scope, ownUserId: session.userId } : scope };
}

/** True when the session may edit/approve payroll specifically. */
export function canRunPayroll(session: ErpSession): boolean {
  if (session.isSuperAdmin) return true;
  const roles: string[] = session.roles ?? [];
  return roles.some((r) => ["country_admin", "main_branch_admin", "accountant", "payroll_officer", "hr_admin", "hr_manager"].includes(r));
}

/** Throws ErpPermissionError unless the employee sits inside the caller's scope (one rule: sessionSqlScope). */
export async function assertEmployeeAccess(session: ErpSession, employeeId: string | null | undefined): Promise<void> {
  if (session.isSuperAdmin) return;
  if (!employeeId) throw new ErpPermissionError("Employee is outside your authorized scope.");
  const { withLocalPg } = await import("@/lib/db/local-postgres");
  const { recordInSessionScope } = await import("@/lib/api/scope-middleware");
  const rows = await withLocalPg(async (sql) =>
    sql`SELECT country_id, country_branch_id, city_branch_id FROM public.employees WHERE id = ${employeeId}::uuid LIMIT 1`
  );
  if (!rows?.[0] || !recordInSessionScope(session, rows[0] as any)) {
    throw new ErpPermissionError("Employee is outside your authorized scope.");
  }
}

/** Keeps only the rows whose employee_id is inside the caller's scope. */
export async function filterRowsByEmployeeScope<T extends { employee_id?: string | null }>(session: ErpSession, rows: T[]): Promise<T[]> {
  if (session.isSuperAdmin || rows.length === 0) return rows;
  const { withLocalPg } = await import("@/lib/db/local-postgres");
  const { recordInSessionScope } = await import("@/lib/api/scope-middleware");
  const ids = [...new Set(rows.map((r) => r.employee_id).filter(Boolean))] as string[];
  const emp = await withLocalPg(async (sql) =>
    sql`SELECT id, country_id, country_branch_id, city_branch_id FROM public.employees WHERE id = ANY(${ids}::uuid[])`
  );
  const byId = new Map((emp || []).map((e: any) => [e.id, e]));
  return rows.filter((r) => r.employee_id && recordInSessionScope(session, byId.get(r.employee_id)));
}
