import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { resolveReportScope } from "@/lib/permissions/middleware";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { localizeRecordNames } from "@/lib/i18n/localize-records";
import { withLocalPg } from "@/lib/db/local-postgres";
import type { SupportedLanguage } from "@/lib/i18n/languages";

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

const superAdminReportTypes = [
  { key: "ledger", icon: "book-open" },
  { key: "bills", icon: "file-text" },
  { key: "payments", icon: "banknote" },
  { key: "sales", icon: "bar-chart" },
  { key: "purchase", icon: "shopping-bag" },
  { key: "user-activity", icon: "users" },
  { key: "edit-history", icon: "history" },
  { key: "employee", icon: "badge" },
  { key: "branch", icon: "building" },
  { key: "project", icon: "folder" },
  { key: "cash-entry", icon: "scroll-text" },
  { key: "receipts", icon: "file-text" },
  { key: "customer-accounts", icon: "users" },
  { key: "customer-companies", icon: "building" },
  { key: "exchange-rate", icon: "globe" },
  { key: "exchange-rates", icon: "globe" },
  { key: "branch-transactions", icon: "bar-chart" },
  { key: "audit-logs", icon: "shield" },
  { key: "approval-workflows", icon: "check-square" },
  { key: "expenses", icon: "coins" },
  { key: "financial-summaries", icon: "calculator" },
  { key: "purchase-booking-register", icon: "package" },
  { key: "daily-comprehensive", icon: "calendar" }
];

const standardReportTypes = [
  { key: "cash-entry", icon: "scroll-text" },
  { key: "receipts", icon: "file-text" },
  { key: "payments", icon: "banknote" },
  { key: "customer-accounts", icon: "users" },
  { key: "customer-companies", icon: "building" },
  { key: "exchange-rate", icon: "globe" },
  { key: "exchange-rates", icon: "globe" },
  { key: "branch-transactions", icon: "bar-chart" },
  { key: "user-activity", icon: "users" },
  { key: "audit-logs", icon: "shield" },
  { key: "approval-workflows", icon: "check-square" },
  { key: "expenses", icon: "coins" },
  { key: "financial-summaries", icon: "calculator" },
  { key: "purchase-booking-register", icon: "package" },
  { key: "daily-comprehensive", icon: "calendar" },
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
  { key: "purchase-booking", icon: "package" }
];

function extractProject(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  for (const key of ["projectName", "project_name", "project", "projectTitle", "project_title"]) {
    const candidate = record[key];
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
    if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
      const nested = candidate as Record<string, unknown>;
      const name = nested.name ?? nested.title;
      if (typeof name === "string" && name.trim()) return name.trim();
    }
  }
  for (const key of ["details", "metadata", "header", "booking", "order"]) {
    const nested = extractProject(record[key]);
    if (nested) return nested;
  }
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const reportTypes = request.nextUrl.searchParams.get("workspace") === "super-admin" ? superAdminReportTypes : standardReportTypes;
    const lang = (["en", "ur", "ar", "fa", "ps"].includes(request.nextUrl.searchParams.get("lang") || "") ? request.nextUrl.searchParams.get("lang") : session.preferredLanguage) as SupportedLanguage;
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

    const localPgMeta = await withLocalPg(async (sql) => {
      const countries = await sql`
        select id, name, iso2, iso3, currency_code
        from public.countries
        where deleted_at is null
        order by name
      `;
      const mainBranches = await sql`
        select id, name, code, country_id, city_id, phone, local_currency, status
        from public.country_branches
        where deleted_at is null
        order by name
      `;
      const cityBranches = await sql`
        select id, name, code, country_id, country_branch_id, city_name, local_currency, status
        from public.city_branches
        where deleted_at is null
        order by name
      `;
      const assignments = await sql`
        select user_id, country_id, country_branch_id, city_branch_id
        from public.user_role_assignments
        where is_active = true and deleted_at is null
      `;
      const profileIds = [...new Set((assignments as Array<{ user_id: string }>)
        .map((row) => row.user_id)
        .filter(Boolean))];
      const users = profileIds.length
        ? await sql`
            select id, full_name, user_code
            from public.profiles
            where deleted_at is null and id = any(${profileIds})
            order by full_name
          `
        : [];
      const purchaseProjects = await sql`
        select id, form_data, country_id, country_branch_id, city_branch_id
        from public.purchase_orders
        where deleted_at is null
        order by created_at desc
        limit 1000
      `;
      const salesProjects = await sql`
        select id, form_data, country_id, country_branch_id, city_branch_id
        from public.sales_orders
        where deleted_at is null
        order by created_at desc
        limit 1000
      `;
      const projectMap = new Map<string, any>();
      for (const row of [...purchaseProjects, ...salesProjects]) {
        const name = extractProject((row as any).form_data);
        if (!name) continue;
        const key = `${(row as any).country_id || ""}:${(row as any).country_branch_id || ""}:${(row as any).city_branch_id || ""}:${name}`;
        if (!projectMap.has(key)) {
          projectMap.set(key, { id: key, name, country_id: (row as any).country_id, country_branch_id: (row as any).country_branch_id, city_branch_id: (row as any).city_branch_id });
        }
      }
      return {
        countries,
        mainBranches,
        cityBranches,
        assignments,
        users,
        projects: [...projectMap.values()]
      };
    });

    if (localPgMeta) {
      const [localizedCountries, localizedMainBranches, localizedCityBranches] = await Promise.all([
        localizeRecordNames((localPgMeta.countries ?? []) as Array<{ id: string; name: string }>, "countries", "name", lang),
        localizeRecordNames((localPgMeta.mainBranches ?? []) as Array<{ id: string; name: string }>, "country_branches", "name", lang),
        localizeRecordNames((localPgMeta.cityBranches ?? []) as Array<{ id: string; name: string }>, "city_branches", "name", lang)
      ]);
      const lockedCountryName = (localizedCountries ?? []).find((country: any) => country.id === scope.countryId)?.name ?? null;
      const lockedMainBranchName = (localizedMainBranches ?? []).find((branch: any) => branch.id === scope.countryBranchId)?.name ?? null;
      const lockedBranchName = (localizedCityBranches ?? []).find((branch: any) => branch.id === scope.branchId)?.name ?? lockedMainBranchName;
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
        countries: localizedCountries,
        mainBranches: localizedMainBranches,
        cityBranches: localizedCityBranches,
        users: (localPgMeta.users ?? []).map((user: any) => ({
          id: user.id,
          name: user.full_name || user.user_code || user.id,
          assignments: (localPgMeta.assignments ?? []).filter((assignment: any) => assignment.user_id === user.id).map((assignment: any) => ({
            country_id: assignment.country_id,
            country_branch_id: assignment.country_branch_id,
            city_branch_id: assignment.city_branch_id
          }))
        })),
        projects: localPgMeta.projects,
        currencies,
        reportTypes
      });
    }

    const admin = await createServerSupabaseClient();

    let countriesQuery = admin
      .from("countries")
      .select("id, name, iso2, iso3, currency_code")
      .is("deleted_at", null)
      .order("name");
    if (scope.level !== "global" && scope.countryId) {
      countriesQuery = countriesQuery.eq("id", scope.countryId);
    }
    const { data: countries, error: countriesError } = await countriesQuery;
    if (countriesError) console.warn("[reports/meta] countries query error:", countriesError.message);

    let mainBranchesQuery = admin
      .from("country_branches")
      .select("id, name, code, country_id, city_id, phone, local_currency, status")
      .is("deleted_at", null)
      .order("name");
    if (scope.level !== "global" && scope.countryId) {
      mainBranchesQuery = mainBranchesQuery.eq("country_id", scope.countryId);
    }
    const { data: mainBranches, error: mainBranchesError } = await mainBranchesQuery;
    if (mainBranchesError) console.warn("[reports/meta] main branches query error:", mainBranchesError.message);

    let cityBranchesQuery = admin
      .from("city_branches")
      .select("id, name, code, country_id, country_branch_id, city_name, local_currency, status")
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

    let assignmentsQuery = admin
      .from("user_role_assignments")
      .select("user_id, country_id, country_branch_id, city_branch_id")
      .eq("is_active", true)
      .is("deleted_at", null);
    if (scope.level !== "global" && scope.countryId) assignmentsQuery = assignmentsQuery.eq("country_id", scope.countryId);
    if (scope.level === "branch" && scope.branchId) assignmentsQuery = assignmentsQuery.eq("city_branch_id", scope.branchId);
    const { data: assignments, error: assignmentsError } = await assignmentsQuery.limit(1000);
    if (assignmentsError) throw new Error(`Report user scope query failed: ${assignmentsError.message}`);
    const allowedUserIds = [...new Set((assignments ?? []).map((item: any) => item.user_id).filter(Boolean))];
    let users: any[] = [];
    if (scope.level === "global") {
      const result = await admin.from("profiles").select("id, full_name, user_code").is("deleted_at", null).order("full_name").limit(500);
      if (result.error) throw new Error(`Report users query failed: ${result.error.message}`);
      users = result.data ?? [];
    } else if (allowedUserIds.length) {
      const result = await admin.from("profiles").select("id, full_name, user_code").in("id", allowedUserIds).is("deleted_at", null).order("full_name").limit(500);
      if (result.error) throw new Error(`Report users query failed: ${result.error.message}`);
      users = result.data ?? [];
    }

    let purchaseProjectQuery = admin.from("purchase_orders").select("id, form_data, country_id, country_branch_id, city_branch_id").is("deleted_at", null).limit(1000);
    let salesProjectQuery = admin.from("sales_orders").select("id, form_data, country_id, country_branch_id, city_branch_id").is("deleted_at", null).limit(1000);
    if (scope.level !== "global" && scope.countryId) {
      purchaseProjectQuery = purchaseProjectQuery.eq("country_id", scope.countryId);
      salesProjectQuery = salesProjectQuery.eq("country_id", scope.countryId);
    }
    if (scope.level === "branch" && scope.branchId) {
      purchaseProjectQuery = purchaseProjectQuery.eq("city_branch_id", scope.branchId);
      salesProjectQuery = salesProjectQuery.eq("city_branch_id", scope.branchId);
    }
    const [purchaseProjectsResult, salesProjectsResult] = await Promise.all([purchaseProjectQuery, salesProjectQuery]);
    if (purchaseProjectsResult.error) throw new Error(`Purchase projects query failed: ${purchaseProjectsResult.error.message}`);
    if (salesProjectsResult.error) throw new Error(`Sales projects query failed: ${salesProjectsResult.error.message}`);
    const projectMap = new Map<string, any>();
    for (const row of [...(purchaseProjectsResult.data ?? []), ...(salesProjectsResult.data ?? [])]) {
      const name = extractProject(row.form_data);
      if (!name) continue;
      const key = `${row.country_id || ""}:${row.country_branch_id || ""}:${row.city_branch_id || ""}:${name}`;
      if (!projectMap.has(key)) projectMap.set(key, { id: key, name, country_id: row.country_id, country_branch_id: row.country_branch_id, city_branch_id: row.city_branch_id });
    }

    const localizedCountries = await localizeRecordNames((countries ?? []) as Array<{ id: string; name: string }>, "countries", "name", lang);
    const localizedMainBranches = await localizeRecordNames((mainBranches ?? []) as Array<{ id: string; name: string }>, "country_branches", "name", lang);
    const localizedCityBranches = await localizeRecordNames((cityBranches ?? []) as Array<{ id: string; name: string }>, "city_branches", "name", lang);

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
      countries: localizedCountries,
      mainBranches: localizedMainBranches,
      cityBranches: localizedCityBranches,
      users: (users ?? []).map((user: any) => ({
        id: user.id,
        name: user.full_name || user.user_code || user.id,
        assignments: (assignments ?? []).filter((assignment: any) => assignment.user_id === user.id).map((assignment: any) => ({
          country_id: assignment.country_id,
          country_branch_id: assignment.country_branch_id,
          city_branch_id: assignment.city_branch_id
        }))
      })),
      projects: [...projectMap.values()],
      currencies,
      reportTypes
    });
  } catch (error) {
    return handleApiError(error);
  }
}
