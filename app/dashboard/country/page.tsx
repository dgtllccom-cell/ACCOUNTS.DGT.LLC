import Link from "next/link";
import type { Route } from "next";
import postgres from "postgres";
import { ArrowRight, Banknote, Building, Database, GitBranch, Globe, ReceiptText, ShieldCheck, ShoppingCart, Users, Activity, ListFilter, RefreshCw, CheckCircle2, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/layout/stat-card";
import { getRequestLanguage } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/ui";
import { getCurrentErpSession } from "@/lib/auth/session";
import { CountryProductsDashboard } from "@/features/dashboard/components/country-products-dashboard";
import { CountryDashboardOverview } from "@/features/dashboard/components/country-dashboard-overview";
import { CountrySelectDropdown } from "@/components/dashboard/country-select-dropdown";
import { CountryHeaderControls } from "@/components/dashboard/country-header-controls";

import { withLocalPg } from "@/lib/db/local-postgres";
import { domainSuperAdminDomain } from "@/lib/permissions/enterprise-roles";

export const metadata = { title: "Country Dashboard" };

type RecentEntry = {
  id: string;
  voucher_no: string | null;
  entry_date: string | null;
  type: string | null;
  status: string | null;
  created_at: string | null;
  branch_name?: string;
};

type CityBranchData = {
  id: string;
  name: string;
  code: string;
  cityName: string;
  status: string;
};

type BranchFinancialSummary = {
  id: string;
  name: string;
  code: string;
  type: "main" | "city";
  currency: string;
  totalPurchase: number;
  totalSales: number;
  totalDebit: number;
  totalCredit: number;
  ledgerBalance: number;
};

type CountryDashboardData = {
  countryName: string;
  currency: string;
  branchesCount: number;
  usersCount: number;
  accountsCount: number;
  ledgersCount: number;
  productsCount: number;
  purchaseTotal: number;
  salesTotal: number;
  stockValueTotal: number;
  profitLossTotal: number;
  ledgerDebit: number;
  ledgerCredit: number;
  ledgerBalance: number;
  recentRoznamcha: RecentEntry[];
  cityBranches: CityBranchData[];
  branchSummaries: BranchFinancialSummary[];
  databaseReady: boolean;
  error: string | null;
};

type CountryItem = {
  id: string;
  name: string;
  currency_code: string;
};

/**
 * Load ONLY countries where actual branches exist in the real database.
 * No duplicate dummy countries or countries without physical branch networks.
 */
async function loadCountryList(): Promise<CountryItem[]> {
  try {
    const res = await withLocalPg(async (sql) => {
      const rows = await sql<CountryItem[]>`
        SELECT DISTINCT c.id, c.name, c.currency_code
        FROM countries c
        WHERE c.deleted_at IS NULL
          AND (
            EXISTS (SELECT 1 FROM country_branches cb WHERE cb.country_id = c.id AND cb.deleted_at IS NULL)
            OR EXISTS (SELECT 1 FROM city_branches ctb WHERE ctb.country_id = c.id AND ctb.deleted_at IS NULL)
          )
        ORDER BY c.name ASC;
      `;
      return rows;
    });
    return res || [];
  } catch {
    return [];
  }
}

async function loadCountryData(countryId: string): Promise<CountryDashboardData> {
  try {
    const isAll = countryId === "all";

    const data = await withLocalPg(async (sql) => {
      const [
        countryRes,
        mainBranchesRes,
        cityBranchesRes,
        usersRes,
        accountsRes,
        ledgersRes,
        purchaseRows,
        salesRows,
        recentRows,
        productsCountRes
      ] = await Promise.all([
        isAll
          ? sql`SELECT 'All Countries (Global)' as name, 'USD' as currency_code;`
          : sql`SELECT name, currency_code FROM countries WHERE id = ${countryId} LIMIT 1;`.catch(() => []),
        isAll
          ? sql`SELECT id, name, code, local_currency, country_id FROM country_branches WHERE deleted_at IS NULL;`.catch(() => [])
          : sql`SELECT id, name, code, local_currency, country_id FROM country_branches WHERE country_id = ${countryId} AND deleted_at IS NULL;`.catch(() => []),
        isAll
          ? sql`SELECT id, country_branch_id, country_id, name, code, city_name, status, local_currency FROM city_branches WHERE deleted_at IS NULL;`.catch(() => [])
          : sql`SELECT id, country_branch_id, country_id, name, code, city_name, status, local_currency FROM city_branches WHERE country_id = ${countryId} AND deleted_at IS NULL;`.catch(() => []),
        isAll
          ? sql`SELECT count(*)::int as c FROM user_role_assignments WHERE is_active = true AND deleted_at IS NULL;`.catch(() => [{ c: 0 }])
          : sql`SELECT count(*)::int as c FROM user_role_assignments WHERE country_id = ${countryId} AND is_active = true AND deleted_at IS NULL;`.catch(() => [{ c: 0 }]),
        isAll
          ? sql`SELECT count(*)::int as c FROM enterprise_accounts WHERE deleted_at IS NULL;`.catch(() => [{ c: 0 }])
          : sql`SELECT count(*)::int as c FROM enterprise_accounts WHERE country_id = ${countryId} AND deleted_at IS NULL;`.catch(() => [{ c: 0 }]),
        isAll
          ? sql`SELECT id, country_branch_id, city_branch_id, debit_total, credit_total, current_balance, currency FROM ledgers WHERE deleted_at IS NULL;`.catch(() => [])
          : sql`SELECT id, country_branch_id, city_branch_id, debit_total, credit_total, current_balance, currency FROM ledgers WHERE country_id = ${countryId} AND deleted_at IS NULL;`.catch(() => []),
        isAll
          ? sql`SELECT order_total, country_branch_id, city_branch_id, form_data FROM purchase_orders WHERE deleted_at IS NULL;`.catch(() => [])
          : sql`SELECT order_total, country_branch_id, city_branch_id, form_data FROM purchase_orders WHERE country_id = ${countryId} AND deleted_at IS NULL;`.catch(() => []),
        isAll
          ? sql`SELECT order_total, country_branch_id, city_branch_id FROM sales_orders WHERE deleted_at IS NULL;`.catch(() => [])
          : sql`SELECT order_total, country_branch_id, city_branch_id FROM sales_orders WHERE country_id = ${countryId} AND deleted_at IS NULL;`.catch(() => []),
        isAll
          ? sql`SELECT id, voucher_no, entry_date, type, status, created_at FROM roznamcha_entries WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 8;`.catch(() => [])
          : sql`SELECT id, voucher_no, entry_date, type, status, created_at FROM roznamcha_entries WHERE country_id = ${countryId} ORDER BY created_at DESC LIMIT 8;`.catch(() => []),
        isAll
          ? sql`SELECT product_specifications FROM products WHERE deleted_at IS NULL;`.catch(() => [])
          : sql`SELECT product_specifications FROM products WHERE country_id = ${countryId} AND deleted_at IS NULL;`.catch(() => [])
      ]);
      return { countryRes, mainBranchesRes, cityBranchesRes, usersRes, accountsRes, ledgersRes, purchaseRows, salesRows, recentRows, productsCountRes };
    });

    if (!data) throw new Error("Database connection could not be established");
    const { countryRes, mainBranchesRes, cityBranchesRes, usersRes, accountsRes, ledgersRes, purchaseRows, salesRows, recentRows, productsCountRes } = data;

    const countryObj = countryRes[0] || {};
    const countryName = countryObj.name || (isAll ? "All Countries (Global)" : "Country Scoped");
    const currency = countryObj.currency_code || (isAll ? "USD" : "USD");
    const branchesCount = (mainBranchesRes.length || 0) + (cityBranchesRes.length || 0);
    const usersCount = usersRes[0]?.c || 0;
    const accountsCount = accountsRes[0]?.c || 0;
    const ledgersCount = ledgersRes.length || 0;

    const purchaseTotal = (purchaseRows || []).reduce((sum: number, row: any) => sum + Number(row.order_total || 0), 0);
    const salesTotal = (salesRows || []).reduce((sum: number, row: any) => sum + Number(row.order_total || 0), 0);
    const ledgerDebit = (ledgersRes || []).reduce((sum: number, row: any) => sum + Number(row.debit_total || 0), 0);
    const ledgerCredit = (ledgersRes || []).reduce((sum: number, row: any) => sum + Number(row.credit_total || 0), 0);
    const ledgerBalance = (ledgersRes || []).reduce((sum: number, row: any) => sum + Number(row.current_balance || 0), 0);

    const cityBranches: CityBranchData[] = (cityBranchesRes || []).map((cb: any) => ({
      id: cb.id,
      name: cb.name,
      code: cb.code,
      cityName: cb.city_name,
      status: cb.status
    }));

    const branchSummaryMap = new Map<string, BranchFinancialSummary>();
    for (const branch of (mainBranchesRes || [])) {
      branchSummaryMap.set(`main:${branch.id}`, {
        id: branch.id,
        name: branch.name,
        code: branch.code,
        type: "main",
        currency: branch.local_currency || currency,
        totalPurchase: 0,
        totalSales: 0,
        totalDebit: 0,
        totalCredit: 0,
        ledgerBalance: 0
      });
    }
    for (const branch of (cityBranchesRes || [])) {
      branchSummaryMap.set(`city:${branch.id}`, {
        id: branch.id,
        name: branch.name || branch.city_name,
        code: branch.code,
        type: "city",
        currency: branch.local_currency || currency,
        totalPurchase: 0,
        totalSales: 0,
        totalDebit: 0,
        totalCredit: 0,
        ledgerBalance: 0
      });
    }

    const getBranchSummary = (row: any) => {
      if (row.city_branch_id) return branchSummaryMap.get(`city:${row.city_branch_id}`);
      if (row.country_branch_id) return branchSummaryMap.get(`main:${row.country_branch_id}`);
      return undefined;
    };

    for (const row of (purchaseRows || [])) {
      const target = getBranchSummary(row);
      if (target) target.totalPurchase += Number(row.order_total || 0);
    }
    for (const row of (salesRows || [])) {
      const target = getBranchSummary(row);
      if (target) target.totalSales += Number(row.order_total || 0);
    }
    for (const row of (ledgersRes || [])) {
      const target = getBranchSummary(row);
      if (target) {
        target.totalDebit += Number(row.debit_total || 0);
        target.totalCredit += Number(row.credit_total || 0);
        target.ledgerBalance += Number(row.current_balance || 0);
      }
    }

    const branchSummaries = Array.from(branchSummaryMap.values());

    const stockValueTotal = (productsCountRes || []).reduce((sum: number, row: any) => {
      const spec = row.product_specifications || {};
      const qty = Number(spec.stockQty || spec.stock_qty || spec.quantity || spec.qty || 0);
      const price = Number(spec.costPrice || spec.cost_price || spec.purchaseRate || spec.purchase_rate || 0);
      const val = Number(spec.inventoryValue || spec.inventory_value || 0) || (qty * price);
      return sum + val;
    }, 0);

    // Derive distinct goods from purchase orders if products table has not registered formal SKUs yet
    const goodsFromPOs = new Set<string>();
    for (const p of (purchaseRows || [])) {
      const fd = p.form_data || {};
      if (fd.form?.goodsName) goodsFromPOs.add(String(fd.form.goodsName));
      if (Array.isArray(fd.goodsEntries)) {
        for (const g of fd.goodsEntries) {
          if (g.goodsName || g.name) goodsFromPOs.add(String(g.goodsName || g.name));
        }
      }
    }
    const productsCount = (productsCountRes || []).length || goodsFromPOs.size;

    const recentRoznamcha: RecentEntry[] = (recentRows || []).map((row: any) => ({
      id: row.id,
      voucher_no: row.voucher_no,
      entry_date: row.entry_date,
      type: row.type,
      status: row.status,
      created_at: row.created_at
    }));
    const profitLossTotal = salesTotal - purchaseTotal;

    return {
      countryName,
      currency,
      branchesCount,
      usersCount,
      accountsCount,
      ledgersCount,
      productsCount,
      purchaseTotal,
      salesTotal,
      stockValueTotal,
      profitLossTotal,
      ledgerDebit,
      ledgerCredit,
      ledgerBalance,
      recentRoznamcha,
      cityBranches,
      branchSummaries,
      databaseReady: true,
      error: null
    };
  } catch (error) {
    return {
      countryName: "Country Dashboard",
      currency: "USD",
      branchesCount: 0,
      usersCount: 0,
      accountsCount: 0,
      ledgersCount: 0,
      productsCount: 0,
      purchaseTotal: 0,
      salesTotal: 0,
      stockValueTotal: 0,
      profitLossTotal: 0,
      ledgerDebit: 0,
      ledgerCredit: 0,
      ledgerBalance: 0,
      recentRoznamcha: [],
      cityBranches: [],
      branchSummaries: [],
      databaseReady: false,
      error: error instanceof Error ? error.message : "Failed to load country data"
    };
  }
}

export default async function CountryDashboardPage(props: { searchParams?: Promise<{ tab?: string; countryId?: string }> }) {
  const searchParams = props.searchParams ? await props.searchParams : {};
  const currentTab = searchParams.tab || "overview";
  const lang = await getRequestLanguage();

  const session = await getCurrentErpSession();
  const isSuperAdmin = Boolean(session?.isSuperAdmin || session?.roles.includes("super_admin"));

  // Only load countries where physical branches exist in the real database
  const domainSuper = !isSuperAdmin && session ? domainSuperAdminDomain(session.roles) : null;
  const allCountries = await loadCountryList();
  const countries = domainSuper ? allCountries.filter((c) => session!.countryIds.includes(c.id)) : allCountries;

  let countryId = session?.countryIds?.[0];

  if (domainSuper && searchParams.countryId && session!.countryIds.includes(searchParams.countryId)) {
    countryId = searchParams.countryId;
  }

  if (isSuperAdmin) {
    // If countryId in query is valid and exists in real branch countries, use it
    if (searchParams.countryId && countries.some((c) => c.id === searchParams.countryId)) {
      countryId = searchParams.countryId;
    } else if (countries.length > 0) {
      // Default to UAE or the first active country
      const uae = countries.find((c) => (c.name || "").toLowerCase().includes("emirates") || c.currency_code === "AED");
      countryId = uae ? uae.id : countries[0].id;
    } else {
      countryId = "all";
    }
  }

  if (!countryId) {
    return (
      <div className="p-6">
        <Card className="border-amber-200 bg-amber-50 text-amber-900">
          <CardContent className="p-4">
            <h2 className="text-lg font-bold">{t(lang, "cpage.access_scoping_required", "Access Scoping Required")}</h2>
            <p className="text-sm mt-1">{t(lang, "cpage.access_scoping_desc", "Your user role does not have an assigned country. Please contact the administrator to assign your role to a country scope.")}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const loadedRaw = await loadCountryData(countryId);
  const ownCities = new Set(session?.cityBranchIds ?? []);
  const loaded = domainSuper
    ? (() => {
        const cityBranches = loadedRaw.cityBranches.filter((b) => ownCities.has(b.id));
        const branchSummaries = loadedRaw.branchSummaries.filter((b) => b.type === "main" || ownCities.has(b.id));
        const mains = loadedRaw.branchSummaries.filter((b) => b.type === "main").length;
        return { ...loadedRaw, cityBranches, branchSummaries, branchesCount: mains + cityBranches.length };
      })()
    : loadedRaw;

  const financialsHidden = !isSuperAdmin && session?.canViewFinancials === false;
  const zeroNumbers = <T extends Record<string, unknown>>(row: T): T =>
    Object.fromEntries(Object.entries(row).map(([k, v]) => [k, typeof v === "number" ? 0 : v])) as T;
  const data = financialsHidden
    ? { ...loaded, purchaseTotal: 0, salesTotal: 0, stockValueTotal: 0, profitLossTotal: 0, ledgerDebit: 0, ledgerCredit: 0, ledgerBalance: 0,
        recentRoznamcha: [], branchSummaries: loaded.branchSummaries.map((b) => zeroNumbers(b)) }
    : loaded;

  const countryFlag = (data.countryName || "").toLowerCase().includes("emirates") || (data.countryName || "").toLowerCase().includes("uae")
    ? "🇦🇪"
    : (data.countryName || "").toLowerCase().includes("afghanistan")
    ? "🇦🇫"
    : (data.countryName || "").toLowerCase().includes("pakistan")
    ? "🇵🇰"
    : (data.countryName || "").toLowerCase().includes("india")
    ? "🇮🇳"
    : "🌐";

  return (
    <div className="space-y-4" dir={lang !== "en" ? "rtl" : "ltr"}>
      {/* ── TOP BREADCRUMB & CONTROLS TOOLBAR (Country Dropdown, Date Selector, Settings) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md p-2.5 px-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
        {/* Left: Breadcrumbs */}
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
          <Link href="/dashboard" className="hover:text-blue-600 transition-colors">
            {t(lang, "nav.dashboard", "Home")}
          </Link>
          <span className="text-slate-400">›</span>
          <Link href="/dashboard" className="hover:text-blue-600 transition-colors">
            {t(lang, "nav.dashboard", "Dashboard")}
          </Link>
          <span className="text-slate-400">›</span>
          <span className="font-bold text-slate-800 dark:text-slate-200">
            {t(lang, "cmd.country_admin_dashboard", "Country Dashboard")}
          </span>
        </div>

        {/* Right: Country Dropdown, Date Selector, Settings (Cleanly Grouped) */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <CountrySelectDropdown
            countries={countries}
            currentCountryId={countryId}
            currentTab={currentTab}
          />
          <CountryHeaderControls />
        </div>
      </div>

      {/* ── MODERN HERO BANNER (Glassmorphic Design) ───────────────────────── */}
      <div className="relative rounded-3xl overflow-hidden border border-blue-200/60 dark:border-slate-800 shadow-[0_8px_30px_rgb(0,0,0,0.04)] min-h-[155px] bg-gradient-to-r from-blue-50/90 via-sky-50/60 to-indigo-50/80 dark:from-slate-900 dark:via-blue-950/40 dark:to-slate-900">
        {/* Soft Ambient Light Effects */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-blue-400/15 to-indigo-400/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-72 h-72 bg-sky-400/10 rounded-full blur-2xl pointer-events-none" />

        {/* Content */}
        <div className="relative z-10 p-5 sm:p-6 flex flex-col justify-between min-h-[155px]">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div className="space-y-1.5 max-w-xl">
              {/* Role Badge */}
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-blue-50/80 dark:bg-blue-950/60 border border-blue-200/80 dark:border-blue-900 text-[11px] font-bold text-blue-700 dark:text-blue-300 backdrop-blur-xs">
                {isSuperAdmin
                  ? "Global Super Admin"
                  : domainSuper
                  ? "Business Super Admin"
                  : "Country Admin"}
              </div>

              {/* Title with Country Flag */}
              <div className="flex items-center gap-3 pt-0.5">
                <div className="h-8 w-11 rounded-md overflow-hidden shadow-xs border border-slate-200 dark:border-slate-700 flex items-center justify-center bg-white text-lg">
                  {countryFlag}
                </div>
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                  {data.countryName} {t(lang, "common.dashboard", "Dashboard")}
                </h1>
              </div>

              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-medium">
                {t(lang, "cpage.subtitle", "Country-level reporting, city branches, local ledger stand, and product inventory details.")}
              </p>
            </div>

            {/* Action Buttons: View Products / View Overview toggle */}
            <div className="flex items-center gap-2.5 self-start md:self-center shrink-0">
              <Link
                href={`/dashboard/country?countryId=${countryId}&tab=${currentTab === "overview" ? "products" : "overview"}` as Route}
                className="h-9 px-4 rounded-xl bg-[#6366f1] hover:bg-[#4f46e5] text-white text-xs font-bold inline-flex items-center gap-2 shadow-md shadow-indigo-500/25 transition-all cursor-pointer"
              >
                <Database className="h-4 w-4" />
                <span>{currentTab === "overview" ? t(lang, "cpage.view_products", "View Products & Inventory") : t(lang, "cpage.view_overview", "View Overview")}</span>
              </Link>
            </div>
          </div>

          {/* Navigation Tabs (Overview | Products & Inventory) */}
          <div className="flex items-center gap-6 pt-4 border-t border-slate-200/60 dark:border-slate-800/60 mt-3">
            <Link
              href={`/dashboard/country?countryId=${countryId}&tab=overview` as Route}
              className={`text-xs font-bold pb-1 transition-all relative ${
                currentTab === "overview"
                  ? "text-blue-600 dark:text-blue-400 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-blue-600 dark:after:bg-blue-400"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800"
              }`}
            >
              {t(lang, "cpage.overview", "Overview")}
            </Link>
            <Link
              href={`/dashboard/country?countryId=${countryId}&tab=products` as Route}
              className={`text-xs font-bold pb-1 transition-all relative ${
                currentTab === "products"
                  ? "text-blue-600 dark:text-blue-400 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-blue-600 dark:after:bg-blue-400"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800"
              }`}
            >
              {t(lang, "cpage.products_inventory", "Products & Inventory")}
            </Link>
          </div>
        </div>
      </div>

      {currentTab === "products" ? (
        <CountryProductsDashboard />
      ) : (
        <div className="space-y-6">
          {!data.databaseReady && (
            <Card className="border-red-200 bg-red-50 text-red-900 dark:border-red-950/40 dark:bg-red-950/20 dark:text-red-300">
              <CardContent className="p-4 text-sm font-semibold">
                {t(lang, "cpage.stats_load_error", "Country statistics could not load:")} {data.error}
              </CardContent>
            </Card>
          )}
          {financialsHidden && (
            <div data-testid="financials-hidden" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              {t(lang, "bdash.fin_hidden", "Financial figures (purchases, sales, balances and ledgers) are not part of your access.")}
            </div>
          )}
          {data.databaseReady && <CountryDashboardOverview data={data} />}
        </div>
      )}
    </div>
  );
}
