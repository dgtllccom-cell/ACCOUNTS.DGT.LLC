export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { withLocalPg } from "@/lib/db/local-postgres";
import { getRequestLanguage } from "@/lib/i18n/server";
import { localizeRecordFields } from "@/lib/i18n/localize-records";

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const { searchParams } = request.nextUrl;
    const domainFilter = searchParams.get("domain"); // "business" | "shipping" | "both"
    const targetCountryId = searchParams.get("countryId");
    const targetBranchId = searchParams.get("branchId");
    const targetCityBranchId = searchParams.get("cityBranchId");

    const lang = await getRequestLanguage(searchParams.get("lang"));

    const countryIds = session.countryIds ?? [];
    const countryBranchIds = session.countryBranchIds ?? [];
    const cityBranchIds = session.cityBranchIds ?? [];

    const rows = await withLocalPg(async (sql) => {
      // Base query joining profiles with active user_role_assignments and location entities
      const result = await sql`
        select distinct on (p.id)
          p.id,
          p.user_code,
          p.full_name,
          p.default_company_id,
          ura.role,
          ura.country_id,
          ura.country_branch_id,
          ura.city_branch_id,
          coalesce(ura.operational_domain, 'business') as operational_domain,
          ura.clearing_agent_id,
          co.name as country_name,
          cb.name as country_branch_name,
          cib.name as city_branch_name
        from public.profiles p
        join public.user_role_assignments ura 
          on ura.user_id = p.id 
         and ura.is_active = true 
         and ura.deleted_at is null
        left join public.countries co on co.id = ura.country_id and co.deleted_at is null
        left join public.country_branches cb on cb.id = ura.country_branch_id and cb.deleted_at is null
        left join public.city_branches cib on cib.id = ura.city_branch_id and cib.deleted_at is null
        where p.deleted_at is null
        order by p.id, ura.created_at desc
      `;
      return result as unknown as any[];
    });

    let assignees = (rows || []).map((r) => ({
      id: r.id as string,
      userCode: (r.user_code || "") as string,
      name: (r.full_name || r.user_code || "Unnamed User") as string,
      role: (r.role || "") as string,
      countryId: (r.country_id || null) as string | null,
      countryName: (r.country_name || "") as string,
      countryBranchId: (r.country_branch_id || null) as string | null,
      countryBranchName: (r.country_branch_name || "") as string,
      cityBranchId: (r.city_branch_id || null) as string | null,
      cityBranchName: (r.city_branch_name || "") as string,
      operationalDomain: (r.operational_domain || "business") as string,
      clearingAgentId: (r.clearing_agent_id || null) as string | null,
    }));

    // ── RBAC Scope Enforcement ────────────────────────────────────────────────
    if (!session.isSuperAdmin) {
      const isCountryLevel = session.roles.some((r) => r === "country_admin" || r === "country_user");

      assignees = assignees.filter((u) => {
        // Super admins are never assignees for branch tasks unless explicit
        if (u.role === "super_admin") return false;

        // If caller is country level, restrict to caller's authorized countries
        if (isCountryLevel) {
          return u.countryId && countryIds.includes(u.countryId);
        }

        // Branch-level users: restrict to users belonging to caller's city branch or parent country branch
        const inCity = u.cityBranchId && cityBranchIds.includes(u.cityBranchId);
        const inCountryBranch = u.countryBranchId && countryBranchIds.includes(u.countryBranchId);
        const inCountry = u.countryId && countryIds.includes(u.countryId);

        return inCity || inCountryBranch || inCountry;
      });
    }

    // ── Operational Domain Separation ─────────────────────────────────────────
    if (domainFilter && domainFilter !== "all") {
      assignees = assignees.filter((u) => {
        if (u.operationalDomain === "both") return true;
        if (domainFilter === "shipping") return u.operationalDomain === "shipping";
        if (domainFilter === "business") return u.operationalDomain === "business";
        return true;
      });
    }

    // ── Explicit Filters (if provided) ────────────────────────────────────────
    if (targetCountryId) {
      assignees = assignees.filter((u) => u.countryId === targetCountryId);
    }
    if (targetBranchId) {
      assignees = assignees.filter((u) => u.countryBranchId === targetBranchId);
    }
    if (targetCityBranchId) {
      assignees = assignees.filter((u) => u.cityBranchId === targetCityBranchId);
    }

    // Localize names
    try {
      assignees = await localizeRecordFields(assignees, "profiles", ["name"], lang);
    } catch {
      // preserve names on error
    }

    return apiOk({ users: assignees });
  } catch (error) {
    return handleApiError(error);
  }
}
