import { withReadPg } from "@/lib/db/local-postgres";
import type { ErpSession } from "@/lib/auth/session";

export type SessionScopeDisplay = {
  countryName: string | null;
  countryBranchName: string | null;
  cityBranchName: string | null;
  branchDisplayName: string | null;
  scopeLabel: string | null;
};

/**
 * Resolves country and branch display names for the authenticated session.
 * Used during server rendering (DashboardLayout) and API session responses
 * so the user interface can display the user's operational scope (country/branch)
 * next to their role name without any layout flashing.
 */
export async function resolveSessionScopeDisplay(session: ErpSession | null | undefined): Promise<SessionScopeDisplay> {
  if (!session) {
    return {
      countryName: null,
      countryBranchName: null,
      cityBranchName: null,
      branchDisplayName: null,
      scopeLabel: null,
    };
  }

  if (session.isSuperAdmin || session.isGlobalScope) {
    return {
      countryName: null,
      countryBranchName: null,
      cityBranchName: null,
      branchDisplayName: "Global Head Office",
      scopeLabel: "Global",
    };
  }

  const primaryCountryId =
    session.countryIds[0] ??
    session.assignments.find((a) => a.countryId)?.countryId ??
    null;
  const primaryCountryBranchId =
    session.countryBranchIds[0] ??
    session.assignments.find((a) => a.countryBranchId)?.countryBranchId ??
    null;
  const primaryCityBranchId =
    session.cityBranchIds[0] ??
    session.assignments.find((a) => a.cityBranchId)?.cityBranchId ??
    null;

  try {
    const res = await withReadPg(async (sql) => {
      const [country, countryBranch, cityBranch] = await Promise.all([
        primaryCountryId
          ? sql`select id, name, iso2 as code from public.countries where id = ${primaryCountryId}::uuid limit 1`
          : Promise.resolve([]),
        primaryCountryBranchId
          ? sql`select id, name, code, country_id from public.country_branches where id = ${primaryCountryBranchId}::uuid limit 1`
          : Promise.resolve([]),
        primaryCityBranchId
          ? sql`select cb.id, cb.name, cb.code, cb.country_id, cb.country_branch_id, co.name as country_name
                from public.city_branches cb left join public.countries co on co.id = cb.country_id
                where cb.id = ${primaryCityBranchId}::uuid and cb.deleted_at is null limit 1`
          : Promise.resolve([]),
      ]);
      return {
        country: (country as any[])[0] ?? null,
        countryBranch: (countryBranch as any[])[0] ?? null,
        cityBranch: (cityBranch as any[])[0] ?? null,
      };
    });

    const countryBranchName = res?.countryBranch?.name ?? null;
    const cityBranchName = res?.cityBranch?.name ?? null;
    let countryName = res?.country?.name ?? res?.cityBranch?.country_name ?? null;

    if (!countryName && res?.countryBranch?.country_id) {
      const parentCountry = await withReadPg(async (sql) => {
        const rows = await sql`select name from public.countries where id = ${res.countryBranch.country_id}::uuid limit 1`;
        return rows[0]?.name ?? null;
      });
      countryName = parentCountry ?? null;
    }

    const branchDisplayName = cityBranchName ?? countryBranchName ?? countryName ?? null;

    let scopeLabel = "Scoped";
    if (session.roles.some((r) => r === "country_admin" || r === "country_user")) {
      scopeLabel = "Country";
    } else if (session.roles.includes("main_branch_admin")) {
      scopeLabel = "Main Branch";
    } else if (cityBranchName) {
      scopeLabel = "City Branch";
    }

    return {
      countryName,
      countryBranchName,
      cityBranchName,
      branchDisplayName,
      scopeLabel,
    };
  } catch (err) {
    console.error("resolveSessionScopeDisplay error:", err);
    return {
      countryName: null,
      countryBranchName: null,
      cityBranchName: null,
      branchDisplayName: null,
      scopeLabel: null,
    };
  }
}
