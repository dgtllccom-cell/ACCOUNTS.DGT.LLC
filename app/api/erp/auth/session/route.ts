import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { resolveReportScope } from "@/lib/permissions/middleware";
import { dashboardByRole, enterpriseRoleScopes } from "@/lib/permissions/enterprise-roles";
import { withLocalPg } from "@/lib/db/local-postgres";

export async function GET() {
  try {
    const session = await requireErpSession();
    const primaryRole = session.roles[0] ?? null;
    const reportScope = resolveReportScope(session);

    const [countryRow, countryBranchRow, cityBranchRow] = (await withLocalPg(async (sql) => {
      const [country, countryBranch, cityBranch] = await Promise.all([
        session.countryIds[0]
          ? sql`select id, name, iso2 as code from public.countries where id = ${session.countryIds[0]}::uuid limit 1`
          : Promise.resolve([]),
        session.countryBranchIds[0]
          ? sql`select id, name, code, country_id from public.country_branches where id = ${session.countryBranchIds[0]}::uuid limit 1`
          : Promise.resolve([]),
        session.cityBranchIds[0]
          ? sql`select id, name, code, country_id, country_branch_id from public.city_branches where id = ${session.cityBranchIds[0]}::uuid limit 1`
          : Promise.resolve([])
      ]);
      return [
        { data: (country as any[])[0] ?? null },
        { data: (countryBranch as any[])[0] ?? null },
        { data: (cityBranch as any[])[0] ?? null }
      ] as const;
    })) ?? [{ data: null }, { data: null }, { data: null }];

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
