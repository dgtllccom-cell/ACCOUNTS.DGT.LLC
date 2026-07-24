import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { dashboardByRole, enterpriseRoleScopes } from "@/lib/permissions/enterprise-roles";

export async function GET() {
  try {
    const session = await requireErpSession();
    const primaryRole = session.roles[0] ?? null;

    return apiOk({
      user: {
        id: session.userId,
        email: session.email,
        fullName: session.fullName,
        preferredLanguage: session.preferredLanguage
      },
      roles: session.roles,
      permissions: session.permissions,
      scopes: {
        assignments: session.assignments,
        countryIds: session.countryIds,
        countryBranchIds: session.countryBranchIds,
        cityBranchIds: session.cityBranchIds,
        isSuperAdmin: session.isSuperAdmin
      },
      dashboard: primaryRole ? dashboardByRole[primaryRole] : "/dashboard",
      roleScopes: enterpriseRoleScopes
    });
  } catch (error) {
    return handleApiError(error);
  }
}
