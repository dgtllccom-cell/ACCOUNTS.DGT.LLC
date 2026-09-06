import type { ErpSession } from "@/lib/auth/session";

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

export function canAccessCountry(session: ErpSession, countryId?: string | null) {
  // If a route does not provide a countryId, treat it as "any allowed country".
  // Super Admin and Super Admin Reports can access all. Non-super users must have at least one assigned country.
  const isGlobal = session.isSuperAdmin || session.roles?.includes("super_admin_reports");
  if (!countryId) return isGlobal || session.countryIds.length > 0;
  return isGlobal || session.countryIds.includes(countryId);
}

export function canAccessCountryBranch(session: ErpSession, countryBranchId?: string | null) {
  const isGlobal = session.isSuperAdmin || session.roles?.includes("super_admin_reports");
  if (!countryBranchId) return isGlobal || session.countryBranchIds.length > 0;
  return isGlobal || session.countryBranchIds.includes(countryBranchId);
}

export function canAccessCityBranch(session: ErpSession, cityBranchId?: string | null) {
  const isGlobal = session.isSuperAdmin || session.roles?.includes("super_admin_reports");
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

export function authorize(session: ErpSession, check: PermissionCheck) {
  assertResourceDomain(session, check.resource);

  if (!hasRolePermission(session, check.resource, check.action)) {
    throw new ErpPermissionError(`Missing permission: ${check.resource}:${check.action}`);
  }

  if (check.countryId && !canAccessCountry(session, check.countryId)) {
    throw new ErpPermissionError(`Country scope is not allowed for this user. Required: ${check.countryId}`);
  }

  if (check.countryBranchId && !canAccessCountryBranch(session, check.countryBranchId)) {
    throw new ErpPermissionError(`Main branch scope is not allowed for this user. Required: ${check.countryBranchId}`);
  }

  if (check.cityBranchId && !canAccessCityBranch(session, check.cityBranchId)) {
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
  // Super Admin and Super Admin Reports: global access
  if (session.isSuperAdmin || session.roles?.includes("super_admin_reports")) {
    return {
      level: "global",
      countryId: null,
      branchId: null,
      countryBranchId: null,
      scopeLabel: "Global"
    };
  }

  const primaryCountryId = session.countryIds[0] ?? null;
  const primaryBranchId = session.cityBranchIds[0] ?? null;
  const primaryCountryBranchId = session.countryBranchIds[0] ?? null;

  const roles = session.roles;

  // Country-level roles: see entire country data, no branch restriction
  const countryLevelRoles = ["country_admin", "country_user"] as const;
  if (roles.some((r) => (countryLevelRoles as readonly string[]).includes(r))) {
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
