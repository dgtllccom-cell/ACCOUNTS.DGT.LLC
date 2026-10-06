import type { ErpSession } from "@/lib/auth/session";
import { mobileProfileAllows } from "@/lib/permissions/mobile-profiles";
import { isCountryLevelRole, storedRoleScopeLevel, NON_FINANCIAL_ROLES } from "@/lib/permissions/enterprise-roles";

export type PermissionCheck = {
  resource: string;
  action: string;
  countryId?: string | null;
  countryBranchId?: string | null;
  cityBranchId?: string | null;
  approvalAction?: string;
};

export class ErpPermissionError extends Error {
  status = 403;

  constructor(message = "You do not have permission to perform this action") {
    super(message);
  }
}

export function hasRolePermission(session: ErpSession, resource: string, action: string) {
  if (session?.isSuperAdmin) return true;

  // Map 'goods' resource to 'products' to match roles configuration
  const normalizedResource = resource === "goods" ? "products" : resource;

  const required = `${normalizedResource}:${action}`;
  const perms = session?.permissions || [];
  return perms.includes(required) || perms.includes(`${normalizedResource}:*`) || perms.includes("*:*");
}

/** Global DATA scope: Super Admin, Super Admin Reports, Global Operations Admin. Says nothing about permissions. */
export function isGlobalSession(session: ErpSession): boolean {
  return Boolean(session.isSuperAdmin || session.isGlobalScope || session.roles?.includes("super_admin_reports"));
}

/**
 * A FINANCIAL module (Arzi bills, expenses, money exchange, ledgers, ...) is denied unless the login may see financial amounts
 * AND holds one of the module's permissions. Super Admin always passes. Returns true when the request must be refused (403).
 */
export function financialModuleDenied(session: ErpSession, resources: readonly string[], action: string): boolean {
  if (session.isSuperAdmin) return false;
  if (!session.canViewFinancials) return true;
  return !resources.some((r) => hasRolePermission(session, r, action));
}

/**
 * Field-level financial permission for whole FINANCIAL reports (ledger statements, balances, exports, print): a login whose
 * session says it may not see amounts gets 403 — module permissions alone (ledgers:read, reports:read) are not enough.
 */
export function assertFinancialAccess(session: ErpSession) {
  if (session.isSuperAdmin) return;
  if (session.canViewFinancials === false) {
    throw new ErpPermissionError("Financial reports (ledgers, balances, statements) are outside your access.");
  }
}

/** Every effective role is operational / shipping-line (no business, CRM, HR or finance module may answer it). */
export function isStrictOperationalSession(session: ErpSession): boolean {
  const roles = session.roles ?? [];
  return !session.isSuperAdmin && roles.length > 0 && roles.every((r) => NON_FINANCIAL_ROLES.includes(r));
}

/**
 * Bind permissions to the scope that grants them. A login with several assignments of different permission sets (e.g. Country
 * Admin + Finance for one branch) holds a permission only inside the assignments that grant it. Called by authorize() for every
 * permission the request uses; the session is narrowed to the assignments that grant ALL of them (monotone intersection), so the
 * scope helpers that run afterwards (sessionSqlScope, enforceScopeFilter, ...) can never widen a permission beyond its grant.
 */
export function narrowSessionToPermission(session: ErpSession, resource: string, action: string) {
  const grants = session.assignmentGrants;
  if (!grants || grants.length < 2 || session.isSuperAdmin) return;
  const normalized = resource === "goods" ? "products" : resource;
  const need = `${normalized}:${action}`;
  const grants2 = grants.filter((g) => g.permissions.includes(need) || g.permissions.includes(`${normalized}:*`) || g.permissions.includes("*:*"));
  if (grants2.length === 0 || grants2.length === grants.length) return; // not granted per assignment (custom/branch-rule grant) or granted everywhere
  session.assignmentGrants = grants2;
  session.assignments = grants2.map((g) => g.assignment);
  session.roles = [...new Set(grants2.map((g) => g.role))];
  session.countryIds = [...new Set(grants2.flatMap((g) => g.countryIds))];
  session.countryBranchIds = [...new Set(grants2.flatMap((g) => g.countryBranchIds))];
  session.cityBranchIds = [...new Set(grants2.flatMap((g) => g.cityBranchIds))];
}

export function canAccessCountry(session: ErpSession, countryId?: string | null) {
  // If a route does not provide a countryId, treat it as "any allowed country".
  // Super Admin and Super Admin Reports can access all. Non-super users must have at least one assigned country.
  const isGlobal = isGlobalSession(session);
  if (!countryId) return isGlobal || session.countryIds.length > 0;
  return isGlobal || session.countryIds.includes(countryId);
}

export function canAccessCountryBranch(session: ErpSession, countryBranchId?: string | null) {
  const isGlobal = isGlobalSession(session);
  if (!countryBranchId) return isGlobal || session.countryBranchIds.length > 0;
  return isGlobal || session.countryBranchIds.includes(countryBranchId);
}

export function canAccessCityBranch(session: ErpSession, cityBranchId?: string | null) {
  const isGlobal = isGlobalSession(session);
  if (!cityBranchId) {
    // To query without a specific city branch (cross-branch query), you must be Super Admin, Super Admin Reports, or have country-level access.
    return isGlobal || session.countryIds.length > 0 || session.countryBranchIds.length > 0;
  }
  return isGlobal || session.cityBranchIds.includes(cityBranchId);
}

export function canApprove(session: ErpSession, countryId?: string | null, cityBranchId?: string | null) {
  if (session.isSuperAdmin) return true;
  if (!hasRolePermission(session, "approvals", "approve")) return false;
  if (cityBranchId) return canAccessCityBranch(session, cityBranchId);
  return canAccessCountry(session, countryId);
}

/**
 * Confidential domain of a resource. A session that is bound only to the OTHER
 * operational domain is refused access — regardless of role permissions — so a
 * Business login never touches Clearing/Shipping data and vice-versa.
 * Resources not listed here are shared (documents, reports, dashboard, users…).
 */
const RESOURCE_DOMAIN: Record<string, "business" | "shipping"> = {
  purchase_orders: "business", purchases: "business", purchase: "business",
  sales_orders: "business", sales: "business",
  roznamcha: "business", cash_entry: "business", daily_payment: "business",
  ledgers: "business", ledger: "business", accounting: "business", journal: "business",
  expenses: "business", bill_expenses: "business", bank_roznamcha: "business",
  shipping_records: "shipping", shipping: "shipping", bl_records: "shipping",
  clearing_agents: "shipping", clearing_agent: "shipping", clearing: "shipping",
  clearing_agent_branches: "shipping", customs_entries: "shipping",
  clearing_bill_customer_charges: "shipping", customer_receipts: "shipping",
  shipping_transfers: "shipping",
};

export function assertResourceDomain(session: ErpSession, resource: string) {
  if (session.isSuperAdmin) return;
  const needed = RESOURCE_DOMAIN[resource] ?? RESOURCE_DOMAIN[resource === "goods" ? "products" : resource];
  if (!needed) return; // shared resource
  const domains = session.operationalDomains ?? ["business"];
  if (domains.includes("both") || domains.includes(needed)) return;

  // A Clearing Agent / Shipping-only login must NEVER reach Business-confidential
  // data (purchase prices, margins, ledger). This is the confidentiality the
  // owner requires. The reverse direction (a Business login reading shipping
  // records) stays governed by role permissions only, so existing Business
  // admins that legitimately manage shipping keep working — create such a user
  // with operational_domain='both' to make it explicit.
  const shippingOnly = domains.length === 1 && domains[0] === "shipping";
  if (needed === "business" && shippingOnly) {
    throw new ErpPermissionError(
      "This is Business data and your login is a Clearing Agent / Shipping Line account."
    );
  }
}

/**
 * A user on a simplified mobile profile (Brother User / Field User) may ONLY
 * touch the resources/actions on that profile's allow-list — regardless of what
 * their enterprise role would otherwise permit. This is the server-side cap that
 * makes the mobile interfaces real security, not just hidden menus. Scope
 * (country/branch) is still enforced by the canAccess* checks below.
 */
export function assertMobileProfile(session: ErpSession, resource: string, action: string) {
  const profile = session.mobileProfile ?? "standard";
  if (profile === "standard") return;
  if (!mobileProfileAllows(profile, resource, action)) {
    throw new ErpPermissionError(
      `Your mobile access profile does not allow ${action} on ${resource}.`
    );
  }
}

/** A Country Admin / Country User owns its whole country — including branches that were later
 *  deactivated (those drop out of session.cityBranchIds). Branch users never qualify, even though
 *  their session also carries the parent country id. */
export function isCountryRoleFor(session: ErpSession, countryId?: string | null): boolean {
  if (!countryId) return false;
  const isCountryRole = (session.roles ?? []).some((r) => isCountryLevelRole(r));
  return isCountryRole && session.countryIds.includes(countryId);
}

export function authorize(session: ErpSession, check: PermissionCheck) {
  assertResourceDomain(session, check.resource);
  assertMobileProfile(session, check.resource, check.action);

  if (!hasRolePermission(session, check.resource, check.action)) {
    throw new ErpPermissionError(`Missing permission: ${check.resource}:${check.action}`);
  }
  narrowSessionToPermission(session, check.resource, check.action);

  if (check.countryId && !canAccessCountry(session, check.countryId)) {
    throw new ErpPermissionError(`Country scope is not allowed for this user. Required: ${check.countryId}`);
  }

  const countryRoleCovers = isCountryRoleFor(session, check.countryId);

  if (check.countryBranchId && !countryRoleCovers && !canAccessCountryBranch(session, check.countryBranchId)) {
    throw new ErpPermissionError(`Main branch scope is not allowed for this user. Required: ${check.countryBranchId}`);
  }

  if (check.cityBranchId && !countryRoleCovers && !canAccessCityBranch(session, check.cityBranchId)) {
    throw new ErpPermissionError("City branch scope is not allowed for this user");
  }

  if (check.approvalAction && !canApprove(session, check.countryId, check.cityBranchId)) {
    throw new ErpPermissionError("Approval access is not allowed for this user");
  }
}

// ─────────────────────────────────────────────────────────────
// Report Scope Resolution
// Used by all report API handlers to enforce data boundaries
// ─────────────────────────────────────────────────────────────

export type ReportScopeLevel = "global" | "country" | "branch";

export type ReportScope = {
  /** The access level granted to this user for reports */
  level: ReportScopeLevel;
  /** Null = all countries (super admin). Non-null = enforced country filter. */
  countryId: string | null;
  /** Null = all branches within allowed scope. Non-null = enforced branch filter. */
  branchId: string | null;
  /** The first assigned countryBranchId (main branch) for this user, if any */
  countryBranchId: string | null;
  /** Human-readable scope label for UI display */
  scopeLabel: string;
};

/**
 * Resolves what data scope a user is allowed to see in reports.
 * Called at the top of every report API handler.
 *
 * Security contract:
 *   - super_admin: no restrictions (countryId=null, branchId=null)
 *   - country_admin / country_user / main_branch_admin: restricted to their country
 *   - city_branch_admin / accountant / cashier / staff_user: restricted to their branch
 *   - auditor_viewer: restricted to assigned scope (country or branch)
 */
export function resolveReportScope(session: ErpSession): ReportScope {
  // Super Admin, Super Admin Reports and Global Operations Admin: global DATA scope
  if (isGlobalSession(session)) {
    return {
      level: "global",
      countryId: null,
      branchId: null,
      countryBranchId: null,
      scopeLabel: "Global"
    };
  }

  // session.countryIds/countryBranchIds are intentionally sparse for a login whose only
  // assignment is at the city-branch level - getAssignmentRoots() (lib/auth/session.ts)
  // deliberately does NOT seed them in that case, so the downward hierarchy-expansion in
  // resolveHierarchyScopes() never widens a branch login's actual DATA ACCESS to its whole
  // country. But that leaves session.countryIds[0] empty here too, which made this function
  // return countryId: null for a branch-scoped session - i.e. "no country filter" - which
  // callers (see enforceScopeFilters below) then read as "show every country". Fall back to
  // the assignment's own countryId/countryBranchId (always present) for DISPLAY/FILTER
  // purposes only; this does not touch or widen the access-grant arrays themselves.
  const primaryCountryId = session.countryIds[0] ?? session.assignments.find((a) => a.countryId)?.countryId ?? null;
  const primaryBranchId = session.cityBranchIds[0] ?? null;
  const primaryCountryBranchId = session.countryBranchIds[0] ?? session.assignments.find((a) => a.countryBranchId)?.countryBranchId ?? null;

  const roles = session.roles;

  // Country-level roles: see entire country data, no branch restriction
  if (roles.some((r) => isCountryLevelRole(r))) {
    return {
      level: "country",
      countryId: primaryCountryId,
      branchId: null,
      countryBranchId: primaryCountryBranchId,
      scopeLabel: "Country"
    };
  }

  // Main branch admin: can see entire country (they manage all city branches within a country)
  if (roles.includes("main_branch_admin")) {
    return {
      level: "country",
      countryId: primaryCountryId,
      branchId: null,
      countryBranchId: primaryCountryBranchId,
      scopeLabel: "Main Branch"
    };
  }

  // City branch level roles: restricted to their specific branch
  const branchLevelRoles = ["city_branch_admin", "accountant", "cashier", "staff_user"] as const;
  if (roles.some((r) => (branchLevelRoles as readonly string[]).includes(r))) {
    return {
      level: "branch",
      countryId: primaryCountryId,
      branchId: primaryBranchId,
      countryBranchId: primaryCountryBranchId,
      scopeLabel: "Branch"
    };
  }

  // Operations / shipping-line logins: the scope level is the one of the assignment's STORED role
  // (a Shipping Line Admin stored as country_admin owns the country; one stored as city_branch_admin owns the branch).
  const levels = (session.assignments ?? []).map((a) => storedRoleScopeLevel(a.storedRole ?? a.role));
  if (roles.some((r) => r === "city_operations_admin" || r === "shipping_line_admin" || r === "shipping_line_user")) {
    if (levels.includes("country")) {
      return { level: "country", countryId: primaryCountryId, branchId: null, countryBranchId: primaryCountryBranchId, scopeLabel: "Country" };
    }
    if (levels.includes("main_branch") && !levels.includes("city_branch")) {
      return { level: "country", countryId: primaryCountryId, branchId: null, countryBranchId: primaryCountryBranchId, scopeLabel: "Main Branch" };
    }
    return { level: "branch", countryId: primaryCountryId, branchId: primaryBranchId, countryBranchId: primaryCountryBranchId, scopeLabel: "Branch" };
  }

  // Auditor/viewer: use most restrictive scope available
  if (roles.includes("auditor_viewer")) {
    if (primaryBranchId) {
      return {
        level: "branch",
        countryId: primaryCountryId,
        branchId: primaryBranchId,
        countryBranchId: primaryCountryBranchId,
        scopeLabel: "Auditor (Branch)"
      };
    }
    return {
      level: "country",
      countryId: primaryCountryId,
      branchId: null,
      countryBranchId: primaryCountryBranchId,
      scopeLabel: "Auditor (Country)"
    };
  }

  // Fallback: most restrictive
  return {
    level: "branch",
    countryId: primaryCountryId,
    branchId: primaryBranchId,
    countryBranchId: primaryCountryBranchId,
    scopeLabel: "Restricted"
  };
}

/**
 * Given a ReportScope and requested filters from the API query,
 * returns the effective countryId and branchId to use in DB queries.
 * Ensures users cannot bypass their scope by passing different IDs in query params.
 */
export function enforceScopeFilters(
  scope: ReportScope,
  requestedCountryId: string | null,
  requestedBranchId: string | null
): { effectiveCountryId: string | null; effectiveBranchId: string | null } {
  if (scope.level === "global") {
    // Super admin: use whatever was requested (null = all)
    return {
      effectiveCountryId: requestedCountryId,
      effectiveBranchId: requestedBranchId
    };
  }

  if (scope.level === "country") {
    // Country admin: force their country, allow branch filter within it
    const effectiveBranchId =
      requestedBranchId && scope.countryId ? requestedBranchId : null;
    return {
      effectiveCountryId: scope.countryId,
      effectiveBranchId
    };
  }

  // Branch level: force both country and branch
  return {
    effectiveCountryId: scope.countryId,
    effectiveBranchId: scope.branchId
  };
}
