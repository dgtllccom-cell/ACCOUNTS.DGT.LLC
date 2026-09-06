import { NextResponse } from "next/server";
import { ErpAuthError, requireErpSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getRequestLanguage } from "@/lib/i18n/server";
import { localizeRecordFields } from "@/lib/i18n/localize-records";
import { withLocalPg } from "@/lib/db/local-postgres";

const selectColumns =
  "id,country_id,country_branch_id,city_name,name,code,local_currency,status,is_business_branch,state_province_id,district_id,city_id,area_location_id,address,phone,email,whatsapp_number,company_id,owner_name,contacts,documents,created_at,updated_at";

export async function GET(request: Request) {
  try {
    const session = await requireErpSession();
    const url = new URL(request.url);
    const countryId = url.searchParams.get("countryId");
    const countryBranchId = url.searchParams.get("countryBranchId");
    // scope: business (default — hides agent/shipping branches), agent, or all (admin views).
    const scope = (url.searchParams.get("scope") || "business").toLowerCase();

    let cityBranchesRaw: any[] = [];
    const viaPg = await withLocalPg(async (sql) => {
      if (countryId && !session.isSuperAdmin && !session.countryIds.includes(countryId)) {
        return { cityBranches: [] };
      }
      if (!countryId && !session.isSuperAdmin && session.countryIds.length === 0) {
        return { cityBranches: [] };
      }
      const rows = await sql`
        select
          id, country_id, country_branch_id, city_name, name, code, local_currency, status,
          is_business_branch, state_province_id, district_id, city_id, area_location_id,
          address, phone, email, whatsapp_number, company_id, owner_name, contacts, documents,
          created_at, updated_at
        from public.city_branches
        where deleted_at is null
          and (${scope === "business" ? sql`is_business_branch is not false` : scope === "agent" ? sql`is_business_branch is false` : sql`true`})
          and (${countryId ? sql`country_id = ${countryId}` : sql`true`})
          and (${!countryId && !session.isSuperAdmin ? sql`country_id = any(${session.countryIds})` : sql`true`})
          and (${countryBranchId ? sql`country_branch_id = ${countryBranchId}` : sql`true`})
        order by created_at asc
      `;
      return { cityBranches: rows as any[] };
    });

    if (viaPg) {
      cityBranchesRaw = viaPg.cityBranches;
    } else {
      const supabase = createSupabaseAdminClient() as any;
      let query = supabase
        .from("city_branches")
        .select(selectColumns)
        .is("deleted_at", null)
        .order("created_at", { ascending: true });

      if (scope === "business") {
        query = query.neq("is_business_branch", false);
      } else if (scope === "agent") {
        query = query.eq("is_business_branch", false);
      }
      // scope === "all" → no branch-type filter

      if (countryId) {
        if (!session.isSuperAdmin && !session.countryIds.includes(countryId)) {
          return NextResponse.json({ ok: true, data: { cityBranches: [] } });
        }
        query = query.eq("country_id", countryId);
      } else if (!session.isSuperAdmin) {
        query = query.in(
          "country_id",
          session.countryIds.length ? session.countryIds : ["00000000-0000-0000-0000-000000000000"]
        );
      }

      if (countryBranchId) {
        query = query.eq("country_branch_id", countryBranchId);
      }

      const { data, error } = await query;
      if (error) {
        return NextResponse.json({ ok: false, error: { message: error.message } }, { status: 500 });
      }
      cityBranchesRaw = data ?? [];
    }

    // City-branch name / city_name / owner_name / address follow the active language
    // (city_branches is a registered translatable table); codes / ids stay canonical.
    const lang = await getRequestLanguage(url.searchParams.get("lang") || url.searchParams.get("language"));
    const localized = await localizeRecordFields<any>(
      cityBranchesRaw,
      "city_branches",
      ["name", "city_name", "owner_name", "address"],
      lang,
    ).catch(() => cityBranchesRaw);

    const cityBranches = (localized as any[]).map((branch: any) => ({
      ...branch,
      countryId: branch.country_id,
      countryBranchId: branch.country_branch_id,
      cityName: branch.city_name,
      localCurrency: branch.local_currency,
      isBusinessBranch: branch.is_business_branch !== false
    }));

    return NextResponse.json({
      ok: true,
      data: {
        cityBranches,
        branches: cityBranches
      },
      cityBranches,
      branches: cityBranches
    });
  } catch (error) {
    // A Next redirect (unauthenticated → /auth/login) must propagate, not be
    // swallowed into a 500.
    if (typeof (error as any)?.digest === "string" && (error as any).digest.startsWith("NEXT_REDIRECT")) throw error;
    if (error instanceof ErpAuthError) {
      return NextResponse.json({ ok: false, error: { message: error.message } }, { status: error.status });
    }
    return NextResponse.json(
      { ok: false, error: { message: error instanceof Error ? error.message : "Server error" } },
      { status: 500 }
    );
  }
}
