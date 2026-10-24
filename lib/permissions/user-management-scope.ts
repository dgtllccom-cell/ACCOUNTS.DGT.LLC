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
  /** Operational domains of the manager; absent = not domain-limited (legacy callers / tests). */
  operationalDomains?: readonly string[];
  roles: readonly string[];
  countryIds: readonly string[];
  countryBranchIds: readonly string[];
  cityBranchIds: readonly string[];
  permissions?: readonly string[];
  assignments?: readonly {
    role: string;
    countryId: string | null;
    countryBranchId: string | null;
    cityBranchId: string | null;
    operationalDomain: string;
  }[];
};

/** City admins may create staff only when creation has explicitly been delegated.
 * Keep this separate from isUserManager: creation must not unlock password resets,
 * global permission-set edits, or administration of existing multi-scope users.
 */
export function isUserCreator(session: ManagerSession): boolean {
  return isUserManager(session) || (session.roles.includes("city_branch_admin") &&
    Boolean(session.permissions?.some((p) => p === "users:create" || p === "users:*")));
}

const BRANCH_STAFF_ROLES = new Set(["staff_user", "accountant", "cashier", "agent_user", "auditor_viewer"]);

export function canDelegateUserRole(session: ManagerSession, role: string): boolean {
  if (session.isSuperAdmin) return true;
  if (SUPER_ADMIN_ONLY_ROLES.has(role)) return false;
  if (domainSuperAdminDomain(session.roles)) return BRANCH_STAFF_ROLES.has(role) || role === "main_branch_admin" || role === "city_branch_admin";
  if (session.roles.includes("country_admin")) return BRANCH_STAFF_ROLES.has(role) || role === "main_branch_admin" || role === "city_branch_admin" || role === "country_user";
  if (session.roles.includes("main_branch_admin")) return BRANCH_STAFF_ROLES.has(role);
  return session.roles.includes("city_branch_admin") && BRANCH_STAFF_ROLES.has(role) && role !== "agent_user";
}

/** Validate the complete target against ONE authoritative assignment, rather than
 * combining country, branch and domain grants from unrelated assignments.
 */
export function userCreationTargetError(session: ManagerSession, target: {
  role: string; countryId?: string | null; countryBranchId?: string | null;
  cityBranchId?: string | null; operationalDomain: string; accessProfile?: string | null;
  mode?: string;
}): string | null {
  if (session.isSuperAdmin) return null;
  if (!isUserCreator(session)) return "Not authorized to create users. Explicit user-creation delegation is required.";
  if (!canDelegateUserRole(session, target.role)) return "That role is outside your delegated user-creation authority.";
  if (domainSuperAdminDomain(session.roles)) return domainManagerTargetError(session, target);
  const cityOnly = !session.roles.includes("country_admin") && !session.roles.includes("main_branch_admin");
  if (cityOnly && session.assignments?.length !== 1) return "Multi-scope staff delegation requires an authorized user manager's review.";
  if (cityOnly && target.mode === "assign_scope") return "Only an authorized user manager may modify an existing login's scope.";
  if (cityOnly && target.accessProfile) return "Branch staff delegation cannot issue administrative access profiles.";
  const matched = session.assignments?.some((a) => {
    if (!session.roles.includes(a.role) || !["country_admin", "main_branch_admin", "city_branch_admin"].includes(a.role)) return false;
    if (!target.countryId || a.countryId !== target.countryId) return false;
    if (a.operationalDomain !== "both" && a.operationalDomain !== target.operationalDomain) return false;
    if (a.role === "country_admin") return true;
    if (a.role === "main_branch_admin") return Boolean(a.countryBranchId && a.countryBranchId === target.countryBranchId);
    return Boolean(a.cityBranchId && a.cityBranchId === target.cityBranchId &&
      (a.countryBranchId ?? null) === (target.countryBranchId ?? null));
  });
  return matched ? null : "Country, branch or operational domain is outside your delegated scope.";
}

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

/** The single operational domain a (non-super) manager is limited to, or null when it spans both. */
function managerSingleDomain(session: ManagerSession): "business" | "shipping" | null {
  const d = session.operationalDomains;
  if (!d || d.length === 0 || d.includes("both") || (d.includes("business") && d.includes("shipping"))) return null;
  return d.includes("shipping") ? "shipping" : "business";
}

/** A manager may open / edit / archive this user. Fails closed for unassigned users and anything outside scope. */
export function userInManagerScope(session: ManagerSession, assignment: AssignmentLike | null | undefined): boolean {
  if (session.isSuperAdmin) return true;
  if (!assignment) return false;
  const domain = domainSuperAdminDomain(session.roles);
  if (domain) return inDomainManagerScope(session, domain, assignment);
  // a Country / Main Branch Admin limited to ONE operational domain manages that domain's users only (never 'both', never the other)
  const own = managerSingleDomain(session);
  if (own && (assignment.operational_domain ?? "business") !== own) return false;
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

/**
 * Branch ↔ domain consistency, for EVERY creator (Global Super Admin included): a Business user may only be assigned to a
 * Business branch, a Shipping Line user only to a Shipping Line branch. A user explicitly assigned to 'both' domains may sit in a
 * branch of either; a branch tagged 'both' hosts either. Returns an error message, or null when consistent.
 */
export function assignmentBranchDomainError(userDomain: string | null | undefined, branchDomain: string | null | undefined): string | null {
  const u = userDomain || "business";
  const b = branchDomain || "business";
  if (u === "both" || b === "both" || u === b) return null;
  return u === "shipping"
    ? "A Shipping Line user must be assigned to a Shipping Line branch — this branch belongs to the Business domain."
    : "A Business user must be assigned to a Business branch — this branch belongs to the Shipping Line domain.";
}
