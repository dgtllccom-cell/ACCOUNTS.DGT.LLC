import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { permissionCheckSchema, rolesQuerySchema } from "@/lib/api/erp-validation";
import { requireErpSession } from "@/lib/auth/session";
import { authorize, hasRolePermission } from "@/lib/permissions/middleware";
import { enterpriseRolePermissions, enterpriseRoleScopes } from "@/lib/permissions/enterprise-roles";
import { permissionCatalog, permissionHierarchy, permissionTemplates } from "@/lib/permissions/catalog";

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries());
    const query = rolesQuerySchema.parse(searchParams);

    const resource = request.nextUrl.searchParams.get("resource");
    const action = request.nextUrl.searchParams.get("action");
    const countryId = request.nextUrl.searchParams.get("countryId");
    const countryBranchId = request.nextUrl.searchParams.get("countryBranchId");
    const cityBranchId = request.nextUrl.searchParams.get("cityBranchId");

    if (resource && action) {
      const check = permissionCheckSchema.parse({
        resource,
        action,
        countryId,
        countryBranchId,
        cityBranchId
      });

      let allowed = true;

      try {
        authorize(session, check);
      } catch {
        allowed = false;
      }

      return apiOk({
        allowed,
        check,
        roles: session.roles,
        reason: allowed ? "permission and scope allowed" : "permission or scope denied"
      });
    }

    const ownPermissions = session.permissions;
    const canReadRoleMatrix = hasRolePermission(session, "roles", "read");

    return apiOk({
      roles: session.roles,
      scopes: {
        assignments: session.assignments,
        countryIds: session.countryIds,
        countryBranchIds: session.countryBranchIds,
        cityBranchIds: session.cityBranchIds,
        isSuperAdmin: session.isSuperAdmin
      },
      permissions: ownPermissions,
      catalog: permissionCatalog,
      templates: permissionTemplates,
      hierarchy: permissionHierarchy,
      roleScopes: enterpriseRoleScopes,
      permissionMatrix: query.includeMatrix && canReadRoleMatrix ? enterpriseRolePermissions : null
    });
  } catch (error) {
    return handleApiError(error);
  }
}
