import type { ErpSession } from "@/lib/auth/session";
import { deriveCanViewFinancials } from "@/lib/auth/session";
import { GLOBAL_SCOPE_ROLES } from "@/lib/permissions/enterprise-roles";
import { authorize, ErpPermissionError } from "@/lib/permissions/middleware";

/** For audited direct-SQL paths: never borrow a permission or global flag from a different assignment.
 * A custom permission without an assignment-level scope is intentionally refused until its scope is explicit. */
export function scopedSessionForPermission(session: ErpSession, resource: string, action: string): ErpSession {
  const scoped = { ...session };
  if (!session.isSuperAdmin && session.assignmentGrants) {
    const normalized = resource === "goods" ? "products" : resource;
    const grants = session.assignmentGrants.filter((g) => g.permissions.includes(`${normalized}:${action}`)
      || g.permissions.includes(`${normalized}:*`) || g.permissions.includes("*:*"));
    if (!grants.length) throw new ErpPermissionError(`No scoped assignment grants ${resource}:${action}`);
    scoped.assignmentGrants = grants;
    scoped.assignments = grants.map((g) => g.assignment);
    scoped.roles = [...new Set(grants.map((g) => g.role))];
    scoped.countryIds = [...new Set(grants.flatMap((g) => g.countryIds))];
    scoped.countryBranchIds = [...new Set(grants.flatMap((g) => g.countryBranchIds))];
    scoped.cityBranchIds = [...new Set(grants.flatMap((g) => g.cityBranchIds))];
    scoped.permissions = [...new Set(grants.flatMap((g) => g.permissions))];
    scoped.isGlobalScope = scoped.roles.some((r) => GLOBAL_SCOPE_ROLES.includes(r));
    scoped.canViewFinancials = session.canViewFinancials && deriveCanViewFinancials(scoped.roles, scoped.permissions, false);
    const domains = grants.map((g) => g.assignment.operationalDomain).filter(Boolean);
    if (domains.length) scoped.operationalDomains = [...new Set(domains)];
  }
  authorize(scoped, { resource, action });
  return scoped;
}
