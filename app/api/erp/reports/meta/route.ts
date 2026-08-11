import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { resolveReportScope, type ReportScope } from "@/lib/permissions/middleware";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { withLocalPg } from "@/lib/db/local-postgres";

export const dynamic = "force-dynamic";

/**
 * GET /api/erp/reports/meta
 *
 * Returns all countries and branches the requesting user is allowed to see.
 * - Super Admin: all countries + all branches
 * - Country Admin: only their country + its branches
 * - Branch Admin: only their country + their branch
 *
 * Used by report panels to build dynamic country/branch selectors.
 *
 * Reads via a direct Postgres connection (withLocalPg) when DATABASE_URL is
 * configured — the app's "admin" Supabase client isn't guaranteed to carry a
 * real service-role key locally, and these tables' RLS policies are gated on
 * auth.uid() (is_super_admin() / can_access_country()), which is NULL under
 * the temp-session bootstrap and silently returns zero rows. Falls back to
 * the Supabase client path when DATABASE_URL isn't set.
 */
export async function GET(_request: NextRequest) {
  try {
    const session = await requireErpSession();
    const scope = resolveReportScope(session);

    const viaPg = await withLocalPg((sql) => loadViaPg(sql, scope));
    if (viaPg) return apiOk(viaPg);

    return apiOk(await loadViaSupabase(scope));
  } catch (error) {
    return handleApiError(error);
  }
}

async function loadViaPg(sql: any, scope: ReportScope) {
  const countryFilter = scope.level !== "global" && scope.countryId ? scope.countryId : null;
  const branchFilter = scope.level === "branch" && scope.branchId ? scope.branchId : null;

  const countries = await sql`
    select id, name, iso2 as code, currency_code
    from public.countries
    where deleted_at is null
      and (${countryFilter}::uuid is null or id = ${countryFilter}::uuid)
    order by name
  `;

  const mainBranches = await sql`
    select id, name, code, country_id, phone
    from public.country_branches
    where deleted_at is null
      and (${countryFilter}::uuid is null or country_id = ${countryFilter}::uuid)
    order by name
  `;

  const cityBranches = await sql`
    select id, name, code, country_id, country_branch_id, city_name, status
    from public.city_branches
    where deleted_at is null
      and (${countryFilter}::uuid is null or country_id = ${countryFilter}::uuid)
      and (${branchFilter}::uuid is null or id = ${branchFilter}::uuid)
    order by name
  `;

  const users = await sql`
    select id, full_name
    from public.profiles
    where deleted_at is null
    order by full_name
    limit 200
  `;

  return buildPayload(scope, countries, mainBranches, cityBranches, users);
}

async function loadViaSupabase(scope: ReportScope) {
  const admin = createSupabaseAdminClient();

  let countriesQuery = admin
    .from("countries")
    .select("id, name, code:iso2, currency_code")
    .is("deleted_at", null)
    .order("name");
  if (scope.level !== "global" && scope.countryId) {
    countriesQuery = countriesQuery.eq("id", scope.countryId);
  }
  const { data: countries, error: countriesError } = await countriesQuery;
  if (countriesError) {
    console.warn("[reports/meta] countries query error:", countriesError.message);
  }

  let mainBranchesQuery = admin
    .from("country_branches")
    .select("id, name, code, country_id, phone")
    .is("deleted_at", null)
    .order("name");
  if (scope.level !== "global" && scope.countryId) {
    mainBranchesQuery = mainBranchesQuery.eq("country_id", scope.countryId);
  }
  const { data: mainBranches, error: mainBranchError } = await mainBranchesQuery;
  if (mainBranchError) {
    console.warn("[reports/meta] main branches query error:", mainBranchError.message);
  }

  let cityBranchesQuery = admin
    .from("city_branches")
    .select("id, name, code, country_id, country_branch_id, city_name, status")
    .is("deleted_at", null)
    .order("name");
  if (scope.level !== "global" && scope.countryId) {
    cityBranchesQuery = cityBranchesQuery.eq("country_id", scope.countryId);
  }
  if (scope.level === "branch" && scope.branchId) {
    cityBranchesQuery = cityBranchesQuery.eq("id", scope.branchId);
  }
  const { data: cityBranches, error: cityBranchError } = await cityBranchesQuery;
  if (cityBranchError) {
    console.warn("[reports/meta] city branches query error:", cityBranchError.message);
  }

  const { data: users, error: usersError } = await admin
    .from("profiles")
    .select("id, full_name")
    .is("deleted_at", null)
    .order("full_name")
    .limit(200);
  if (usersError) {
    console.warn("[reports/meta] users query error:", usersError.message);
  }

  return buildPayload(scope, countries ?? [], mainBranches ?? [], cityBranches ?? [], users ?? []);
}

function buildPayload(scope: ReportScope, countries: any[], mainBranches: any[], cityBranches: any[], users: any[]) {
  const currencies = [
    { code: "USD", name: "US Dollar" },
    { code: "PKR", name: "Pakistani Rupee" },
    { code: "AFN", name: "Afghan Afghani" },
    { code: "AED", name: "UAE Dirham" },
    { code: "IRR", name: "Iranian Rial" },
    { code: "INR", name: "Indian Rupee" },
    { code: "EUR", name: "Euro" },
    { code: "GBP", name: "British Pound" }
  ];

  return {
    scope: {
      level: scope.level,
      scopeLabel: scope.scopeLabel,
      lockedCountryId: scope.countryId,
      lockedBranchId: scope.branchId
    },
    countries,
    mainBranches,
    cityBranches,
    users: users.map((u: any) => ({
      id: u.id,
      name: u.full_name || u.id
    })),
    currencies,
    reportTypes: [
      { key: "purchase", icon: "shopping-bag" },
      { key: "sales", icon: "bar-chart" },
      { key: "loading", icon: "truck" },
      { key: "transfer", icon: "arrow-right-left" },
      { key: "payment", icon: "banknote" },
      { key: "remaining", icon: "clock" },
      { key: "ledger", icon: "book-open" },
      { key: "roznamcha", icon: "scroll-text" },
      { key: "journal", icon: "file-text" },
      { key: "cash", icon: "coins" },
      { key: "inventory", icon: "clipboard-list" },
      { key: "daily-comprehensive", icon: "calendar" },
      { key: "purchase-booking", icon: "package" },
      { key: "user-activity", icon: "users" },
      { key: "exchange-rate", icon: "globe" }
    ]
  };
}
