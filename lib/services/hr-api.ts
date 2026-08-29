import { requireErpSession } from "@/lib/auth/session";
import type { ErpSession } from "@/lib/auth/session";
import { ErpPermissionError } from "@/lib/permissions/middleware";

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

export type HrScope = { countryIds: string[] | null; cityBranchIds: string[] | null; countryBranchIds: string[] | null };

export function hrScopeFromSession(session: ErpSession): HrScope {
  if (session.isSuperAdmin || session.roles?.includes("super_admin_reports")) {
    return { countryIds: null, cityBranchIds: null, countryBranchIds: null };
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
  };
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

/** True when the session may edit/approve payroll specifically. */
export function canRunPayroll(session: ErpSession): boolean {
  if (session.isSuperAdmin) return true;
  const roles: string[] = session.roles ?? [];
  return roles.some((r) => ["country_admin", "main_branch_admin", "accountant", "payroll_officer", "hr_admin", "hr_manager"].includes(r));
}
