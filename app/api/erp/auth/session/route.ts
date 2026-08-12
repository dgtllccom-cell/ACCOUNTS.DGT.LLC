import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { resolveReportScope } from "@/lib/permissions/middleware";
import { dashboardByRole, enterpriseRoleScopes } from "@/lib/permissions/enterprise-roles";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export async function GET() {
  try {
    const session = await requireErpSession();
    const primaryRole = session.roles[0] ?? null;
    const reportScope = resolveReportScope(session);

    const [countryRow, countryBranchRow, cityBranchRow] = isSupabaseConfigured()
      ? await (async () => {
          const admin = createSupabaseAdminClient() as any;
          return Promise.all([
            session.countryIds[0]
              ? admin.from("countries").select("id, name, code").eq("id", session.countryIds[0]).maybeSingle()
              : Promise.resolve({ data: null }),
            session.countryBranchIds[0]
              ? admin.from("country_branches").select("id, name, code, country_id").eq("id", session.countryBranchIds[0]).maybeSingle()
              : Promise.resolve({ data: null }),
            session.cityBranchIds[0]
              ? admin.from("city_branches").select("id, name, code, country_id, country_branch_id").eq("id", session.cityBranchIds[0]).maybeSingle()
              : Promise.resolve({ data: null })
          ]);
        })()
      : [{ data: null }, { data: null }, { data: null }];

    const countryName = countryRow?.data?.name ?? null;
    const countryBranchName = countryBranchRow?.data?.name ?? null;
    const cityBranchName = cityBranchRow?.data?.name ?? null;
    const branchDisplayName =
      cityBranchName ?? countryBranchName ?? (reportScope.level === "global" ? null : countryName);

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
        isSuperAdmin: session.isSuperAdmin,
        summary: {
          level: reportScope.level,
          scopeLabel: reportScope.scopeLabel,
          countryId: session.countryIds[0] ?? null,
          countryName,
          countryBranchId: session.countryBranchIds[0] ?? null,
          countryBranchName,
          cityBranchId: session.cityBranchIds[0] ?? null,
          cityBranchName,
          branchDisplayName
        }
      },
      dashboard: primaryRole ? dashboardByRole[primaryRole] : "/dashboard",
      roleScopes: enterpriseRoleScopes
    });
  } catch (error) {
    return handleApiError(error);
  }
}
