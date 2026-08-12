import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { resolveReportScope } from "@/lib/permissions/middleware";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

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

const reportTypes = [
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
];

export async function GET(_request: NextRequest) {
  try {
    const session = await requireErpSession();
    const scope = resolveReportScope(session);

    if (!isSupabaseConfigured()) {
      return apiOk({
        scope: {
          level: scope.level,
          scopeLabel: scope.scopeLabel,
          lockedCountryId: scope.countryId,
          lockedCountryName: null,
          lockedMainBranchId: scope.countryBranchId,
          lockedMainBranchName: null,
          lockedBranchId: scope.branchId,
          lockedBranchName: null
        },
        countries: [],
        mainBranches: [],
        cityBranches: [],
        users: [],
        currencies,
        reportTypes
      });
    }

    const admin = createSupabaseAdminClient() as any;

    let countriesQuery = admin
      .from("countries")
      .select("id, name, code, currency_code, flag_emoji")
      .is("deleted_at", null)
      .order("name");
    if (scope.level !== "global" && scope.countryId) {
      countriesQuery = countriesQuery.eq("id", scope.countryId);
    }
    const { data: countries, error: countriesError } = await countriesQuery;
    if (countriesError) console.warn("[reports/meta] countries query error:", countriesError.message);

    let mainBranchesQuery = admin
      .from("country_branches")
      .select("id, name, code, country_id, city, phone")
      .is("deleted_at", null)
      .order("name");
    if (scope.level !== "global" && scope.countryId) {
      mainBranchesQuery = mainBranchesQuery.eq("country_id", scope.countryId);
    }
    const { data: mainBranches, error: mainBranchesError } = await mainBranchesQuery;
    if (mainBranchesError) console.warn("[reports/meta] main branches query error:", mainBranchesError.message);

    let cityBranchesQuery = admin
      .from("city_branches")
      .select("id, name, code, country_id, country_branch_id, city, is_active")
      .is("deleted_at", null)
      .order("name");
    if (scope.level !== "global" && scope.countryId) {
      cityBranchesQuery = cityBranchesQuery.eq("country_id", scope.countryId);
    }
    if (scope.level === "branch" && scope.branchId) {
      cityBranchesQuery = cityBranchesQuery.eq("id", scope.branchId);
    }
    const { data: cityBranches, error: cityBranchesError } = await cityBranchesQuery;
    if (cityBranchesError) console.warn("[reports/meta] city branches query error:", cityBranchesError.message);

    const lockedCountryName = (countries ?? []).find((country: any) => country.id === scope.countryId)?.name ?? null;
    const lockedMainBranchName = (mainBranches ?? []).find((branch: any) => branch.id === scope.countryBranchId)?.name ?? null;
    const lockedBranchName =
      (cityBranches ?? []).find((branch: any) => branch.id === scope.branchId)?.name ?? lockedMainBranchName;

    const { data: users } = await admin
      .from("user_profiles")
      .select("id, full_name, email")
      .order("full_name")
      .limit(200);

    return apiOk({
      scope: {
        level: scope.level,
        scopeLabel: scope.scopeLabel,
        lockedCountryId: scope.countryId,
        lockedCountryName,
        lockedMainBranchId: scope.countryBranchId,
        lockedMainBranchName,
        lockedBranchId: scope.branchId,
        lockedBranchName
      },
      countries: countries ?? [],
      mainBranches: mainBranches ?? [],
      cityBranches: cityBranches ?? [],
      users: (users ?? []).map((user: any) => ({
        id: user.id,
        name: user.full_name || user.email || user.id
      })),
      currencies,
      reportTypes
    });
  } catch (error) {
    return handleApiError(error);
  }
}
