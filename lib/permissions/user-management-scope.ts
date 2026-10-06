import { domainSuperAdminDomain } from "@/lib/permissions/enterprise-roles";

/**
 * Who may open User Management, and whose users they may manage. Single source for the users API and the users pages.
 *
 *   Global Super Admin          everyone
 *   Country Admin               users of its country
 *   Main Branch Admin           users of its own branch tree
 *   Business / Shipping Super Admin
 *                               branch users of ITS operational domain only: the target assignment must be in the same
 *                               domain (never 'both', never the other domain) and inside a branch of that domain the
 *                               session holds. Super Admin / Reports Auditor / Country Admin identities stay Global-only.
 */
type ManagerSession = {
  isSuperAdmin: boolean;
  roles: readonly string[];
  countryIds: readonly string[];
  countryBranchIds: readonly string[];
  cityBranchIds: readonly string[];
};

export function isUserManager(session: ManagerSession): boolean {
  if (session.isSuperAdmin) return true;
  return session.roles.some((r) => r === "country_admin" || r === "main_branch_admin") || domainSuperAdminDomain(session.roles) !== null;
}

/** Roles only the Global Super Admin may grant or edit. */
export const SUPER_ADMIN_ONLY_ROLES = new Set(["super_admin", "super_admin_reports", "country_admin"]);

type AssignmentLike = {
  role?: string | null;
  country_id?: string | null;
  country_branch_id?: string | null;
  city_branch_id?: string | null;
  operational_domain?: string | null;
};

/** Domain super admin: the target user's assignment is a branch user of the manager's own domain inside its branches. */
function inDomainManagerScope(session: ManagerSession, domain: "business" | "shipping", a: AssignmentLike): boolean {
  if (!a || SUPER_ADMIN_ONLY_ROLES.has(String(a.role ?? ""))) return false;
  if ((a.operational_domain ?? "business") !== domain) return false;
  if (a.city_branch_id) return session.cityBranchIds.includes(a.city_branch_id);
  // a main-branch-level user (no city branch): main branches are Business units — only the Business Super Admin
  return domain === "business" && Boolean(a.country_branch_id && session.countryBranchIds.includes(a.country_branch_id));
}

/** A manager may open / edit / archive this user. Fails closed for unassigned users and anything outside scope. */
export function userInManagerScope(session: ManagerSession, assignment: AssignmentLike | null | undefined): boolean {
  if (session.isSuperAdmin) return true;
  if (!assignment) return false;
  const domain = domainSuperAdminDomain(session.roles);
  if (domain) return inDomainManagerScope(session, domain, assignment);
  if (!assignment.country_id || !session.countryIds.includes(assignment.country_id)) return false;
  if (session.roles.includes("country_admin")) return true;
  return Boolean(assignment.country_branch_id && session.countryBranchIds.includes(assignment.country_branch_id));
}

/**
 * A domain super admin creating / moving a user: the new assignment must be in its own domain and in one of its branches.
 * Returns an error message, or null when allowed. Other managers return null (their own checks apply).
 */
export function domainManagerTargetError(
  session: ManagerSession,
  target: { role: string; operationalDomain?: string | null; countryBranchId?: string | null; cityBranchId?: string | null; accessProfile?: string | null }
): string | null {
  if (session.isSuperAdmin) return null;
  const domain = domainSuperAdminDomain(session.roles);
  if (!domain) return null;
  if (SUPER_ADMIN_ONLY_ROLES.has(target.role)) return "Only the Global Super Admin can grant Super Admin, Reports Auditor or Country Admin roles.";
  if ((target.operationalDomain ?? "business") !== domain) {
    return `You can only manage ${domain === "business" ? "Business" : "Shipping Line"} users — this user is outside your operational domain.`;
  }
  if (domain === "business" && target.accessProfile === "shipping_line") return "A Business Super Admin cannot issue a Shipping Line access profile.";
  if (target.cityBranchId) {
    return session.cityBranchIds.includes(target.cityBranchId) ? null : "That branch is not one of your operational domain's branches.";
  }
  if (domain === "business" && target.countryBranchId && session.countryBranchIds.includes(target.countryBranchId)) return null;
  return domain === "shipping" ? "A Shipping Line user must be assigned to a Shipping Line branch." : "A branch assignment inside your scope is required.";
}
