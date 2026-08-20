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

import { withLocalPg } from "@/lib/db/local-postgres";

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

async function loadCountryList(): Promise<CountryItem[]> {
  try {
    const res = await withLocalPg(async (sql) => {
      const rows = await sql<CountryItem[]>`SELECT id, name, currency_code FROM countries WHERE deleted_at IS NULL ORDER BY name ASC;`;
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
          ? sql`SELECT order_total, country_branch_id, city_branch_id FROM purchase_orders WHERE deleted_at IS NULL;`.catch(() => [])
          : sql`SELECT order_total, country_branch_id, city_branch_id FROM purchase_orders WHERE country_id = ${countryId} AND deleted_at IS NULL;`.catch(() => []),
        isAll
          ? sql`SELECT order_total, country_branch_id, city_branch_id FROM sales_orders WHERE deleted_at IS NULL;`.catch(() => [])
          : sql`SELECT order_total, country_branch_id, city_branch_id FROM sales_orders WHERE country_id = ${countryId} AND deleted_at IS NULL;`.catch(() => []),
        isAll
          ? sql`SELECT id, voucher_no, entry_date, type, status, created_at FROM roznamcha_entries WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 8;`.catch(() => [])
          : sql`SELECT id, voucher_no, entry_date, type, status, created_at FROM roznamcha_entries WHERE country_id = ${countryId} ORDER BY created_at DESC LIMIT 8;`.catch(() => []),
        isAll
          ? sql`SELECT product_specifications FROM goods_registry WHERE deleted_at IS NULL;`.catch(() => [])
          : sql`SELECT product_specifications FROM goods_registry WHERE country_id = ${countryId} AND deleted_at IS NULL;`.catch(() => [])
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

    const productsCount = (productsCountRes || []).length;
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

  const countries = await loadCountryList();

  let countryId = session?.countryIds?.[0];

  if (isSuperAdmin) {
    // Super Admin defaults to 'all' or selected country or the first available country
    if (searchParams.countryId) {
      countryId = searchParams.countryId;
    } else if (countries.length > 0) {
      countryId = countries[0].id;
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

  const data = await loadCountryData(countryId);

  return (
    <div className="space-y-6">
      {/* Super Admin Country Selector Bar */}
      {isSuperAdmin && countries.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
              {t(lang, "cpage.country_scope", "Country Scope:")}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              asChild
              size="sm"
              variant={countryId === "all" ? "default" : "outline"}
              className="h-8 rounded-lg text-xs font-bold"
            >
              <Link href={`/dashboard/country?countryId=all&tab=${currentTab}` as Route}>
                {t(lang, "cpage.all_countries_global", "All Countries (Global)")}
              </Link>
            </Button>
            {countries.map((c) => (
              <Button
                key={c.id}
                asChild
                size="sm"
                variant={countryId === c.id ? "default" : "outline"}
                className="h-8 rounded-lg text-xs font-bold"
              >
                <Link href={`/dashboard/country?countryId=${c.id}&tab=${currentTab}` as Route}>
                  {c.name} ({c.currency_code})
                </Link>
              </Button>
            ))}
          </div>
        </div>
      )}

      <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-6 items-center rounded-md bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-700 ring-1 ring-inset ring-sky-700/10 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-500/20">
              {isSuperAdmin ? t(lang, "cpage.global_super_admin_scope", "Global Super Admin Scope") : t(lang, "cpage.country_admin_scope", "Country Admin Scope")}
            </span>
          </div>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
            {data.countryName} {t(lang, "common.dashboard", "Dashboard")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t(lang, "cpage.subtitle", "Country-level reporting, city branches, local ledger stand, and product inventory details.")}
          </p>
        </div>

        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/dashboard/new-entry/branch-entry/city-branch">
              <Building className="mr-2 h-4 w-4" /> {t(lang, "cpage.add_branch", "Add Branch")}
            </Link>
          </Button>
          <Button asChild>
            <Link href={`/dashboard/country?countryId=${countryId}&tab=${currentTab === "overview" ? "products" : "overview"}` as Route}>
              {currentTab === "overview" ? t(lang, "cpage.view_products", "View Products") : t(lang, "cpage.view_overview", "View Overview")}
            </Link>
          </Button>
        </div>
      </section>

      {/* Tabs list navigation */}
      <div className="border-b border-slate-200 dark:border-slate-800">
        <nav className="flex space-x-6" aria-label="Tabs">
          <Link
            href={`/dashboard/country?countryId=${countryId}&tab=overview` as Route}
            className={`border-b-2 py-2 px-1 text-sm font-semibold transition duration-150 ${
              currentTab === "overview"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:border-slate-300 hover:text-foreground"
            }`}
          >
            {t(lang, "cpage.overview", "Overview")}
          </Link>
          <Link
            href={`/dashboard/country?countryId=${countryId}&tab=products` as Route}
            className={`border-b-2 py-2 px-1 text-sm font-semibold transition duration-150 ${
              currentTab === "products"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:border-slate-300 hover:text-foreground"
            }`}
          >
            {t(lang, "cpage.products_inventory", "Products & Inventory")}
          </Link>
        </nav>
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
          {data.databaseReady && <CountryDashboardOverview data={data} />}
        </div>
      )}
    </div>
  );
}
