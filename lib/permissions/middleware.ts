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
  // Super Admin can access all. Non-super users must have at least one assigned country.
  if (!countryId) return session.isSuperAdmin || session.countryIds.length > 0;
  return session.isSuperAdmin || session.countryIds.includes(countryId);
}

export function canAccessCountryBranch(session: ErpSession, countryBranchId?: string | null) {
  if (!countryBranchId) return session.isSuperAdmin || session.countryBranchIds.length > 0;
  return session.isSuperAdmin || session.countryBranchIds.includes(countryBranchId);
}

export function canAccessCityBranch(session: ErpSession, cityBranchId?: string | null) {
  if (!cityBranchId) {
    // To query without a specific city branch (cross-branch query), you must be Super Admin or have country-level access.
    // A mere city branch admin cannot query across all branches.
    return session.isSuperAdmin || session.countryIds.length > 0 || session.countryBranchIds.length > 0;
  }
  return session.isSuperAdmin || session.cityBranchIds.includes(cityBranchId);
}

export function canApprove(session: ErpSession, countryId?: string | null, cityBranchId?: string | null) {
  if (session.isSuperAdmin) return true;
  if (!hasRolePermission(session, "approvals", "approve")) return false;
  if (cityBranchId) return canAccessCityBranch(session, cityBranchId);
  return canAccessCountry(session, countryId);
}

export function authorize(session: ErpSession, check: PermissionCheck) {
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
