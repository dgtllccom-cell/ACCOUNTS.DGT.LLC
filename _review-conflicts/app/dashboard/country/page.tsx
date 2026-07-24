import Link from "next/link";
import type { Route } from "next";
import { ArrowRight, Banknote, Building, Database, GitBranch, Globe, ReceiptText, ShieldCheck, ShoppingCart, Users, Activity, ListFilter, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/layout/stat-card";
import { getRequestLanguage } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/ui";
import { getCurrentErpSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { CountryProductsDashboard } from "@/features/dashboard/components/country-products-dashboard";
import { CountryDashboardOverview } from "@/features/dashboard/components/country-dashboard-overview";

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

function money(value: number, currency = "USD") {
  return `${currency} ${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value || 0)}`;
}

async function loadCountryData(countryId: string): Promise<CountryDashboardData> {
  try {
    const supabase = createSupabaseAdminClient() as any;
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
      productsCountRes,
      productsListRes
    ] = await Promise.all([
      supabase.from("countries").select("name, currency_code").eq("id", countryId).maybeSingle(),
      supabase.from("country_branches").select("id, name, code, local_currency").eq("country_id", countryId).is("deleted_at", null),
      supabase.from("city_branches").select("id, country_branch_id, name, code, city_name, status, local_currency").eq("country_id", countryId).is("deleted_at", null),
      supabase.from("user_role_assignments").select("user_id", { count: "exact", head: true }).eq("country_id", countryId).eq("is_active", true).is("deleted_at", null),
      supabase.from("enterprise_accounts").select("id", { count: "exact", head: true }).eq("country_id", countryId).is("deleted_at", null),
      supabase.from("ledgers").select("id, country_branch_id, city_branch_id, debit_total, credit_total, current_balance").eq("country_id", countryId).is("deleted_at", null),
      supabase.from("purchase_orders").select("order_total, country_branch_id, city_branch_id").eq("country_id", countryId).is("deleted_at", null),
      supabase.from("sales_orders").select("order_total, country_branch_id, city_branch_id").eq("country_id", countryId).is("deleted_at", null),
      supabase
        .from("roznamcha_entries")
        .select(`
          id, voucher_no, entry_date, type, status, created_at,
          city_branches(name)
        `)
        .eq("country_id", countryId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(8),
      supabase.from("products").select("id", { count: "exact", head: true }).eq("country_id", countryId).is("deleted_at", null),
      supabase.from("products").select("product_specifications").eq("country_id", countryId).is("deleted_at", null).limit(1000)
    ]);

    const countryName = (countryRes as any).data?.name || "Country Scoped";
    const currency = (countryRes as any).data?.currency_code || "USD";
    const branchesCount = (mainBranchesRes.data?.length || 0) + (cityBranchesRes.data?.length || 0);
    const usersCount = usersRes.count || 0;
    const accountsCount = accountsRes.count || 0;
    const ledgersCount = ledgersRes.data?.length || 0;

    const purchaseTotal = (purchaseRows.data ?? []).reduce((sum: number, row: any) => sum + Number(row.order_total || 0), 0);
    const salesTotal = (salesRows.data ?? []).reduce((sum: number, row: any) => sum + Number(row.order_total || 0), 0);
    const ledgerDebit = (ledgersRes.data ?? []).reduce((sum: number, row: any) => sum + Number(row.debit_total || 0), 0);
    const ledgerCredit = (ledgersRes.data ?? []).reduce((sum: number, row: any) => sum + Number(row.credit_total || 0), 0);
    const ledgerBalance = (ledgersRes.data ?? []).reduce((sum: number, row: any) => sum + Number(row.current_balance || 0), 0);

    const cityBranches: CityBranchData[] = (cityBranchesRes.data ?? []).map((cb: any) => ({
      id: cb.id,
      name: cb.name,
      code: cb.code,
      cityName: cb.city_name,
      status: cb.status
    }));

    const branchSummaryMap = new Map<string, BranchFinancialSummary>();
    for (const branch of (mainBranchesRes.data ?? [])) {
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
    for (const branch of (cityBranchesRes.data ?? [])) {
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

    for (const row of (purchaseRows.data ?? [])) {
      const target = getBranchSummary(row);
      if (target) target.totalPurchase += Number(row.order_total || 0);
    }
    for (const row of (salesRows.data ?? [])) {
      const target = getBranchSummary(row);
      if (target) target.totalSales += Number(row.order_total || 0);
    }
    for (const row of (ledgersRes.data ?? [])) {
      const target = getBranchSummary(row);
      if (target) {
        target.totalDebit += Number(row.debit_total || 0);
        target.totalCredit += Number(row.credit_total || 0);
        target.ledgerBalance += Number(row.current_balance || 0);
      }
    }

    const branchSummaries = Array.from(branchSummaryMap.values());

    const recentRoznamcha: RecentEntry[] = (recentRows.data ?? []).map((row: any) => ({
      id: row.id,
      voucher_no: row.voucher_no,
      entry_date: row.entry_date,
      type: row.type,
      status: row.status,
      created_at: row.created_at,
      branch_name: row.city_branches?.name ?? undefined
    }));

    const productsCount = productsCountRes.count || 0;
    const productsData = productsListRes.data || [];
    let stockValueTotal = 0;
    productsData.forEach((row: any) => {
      const spec = row.product_specifications || {};
      const qty = Number(spec.stockQty || spec.stock_qty || spec.quantity || spec.qty || 0);
      const price = Number(spec.costPrice || spec.cost_price || spec.purchaseRate || spec.purchase_rate || 0);
      const val = Number(spec.inventoryValue || spec.inventory_value || 0) || (qty * price);
      stockValueTotal += val;
    });

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


function StatusPill({ value }: { value: string }) {
  const tone =
    value === "posted" || value === "approved" || value === "active"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900"
      : value === "draft"
        ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900"
        : "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900";
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${tone}`}>{value}</span>;
}

export default async function CountryDashboardPage(props: { searchParams?: Promise<{ tab?: string; countryId?: string }> }) {
  const searchParams = props.searchParams ? await props.searchParams : {};
  const currentTab = searchParams.tab || "overview";

  const session = await getCurrentErpSession();
  let countryId = session?.countryIds?.[0];

  if (session?.roles.includes("super_admin") && searchParams.countryId) {
    countryId = searchParams.countryId;
  }

  if (!countryId) {
    return (
      <div className="p-6">
        <Card className="border-amber-200 bg-amber-50 text-amber-900">
          <CardContent className="p-4">
            <h2 className="text-lg font-bold">Access Scoping Required</h2>
            <p className="text-sm mt-1">Your user role does not have an assigned country. Please contact the administrator to assign your role to a country scope.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const data = await loadCountryData(countryId);

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-6 items-center rounded-md bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-700 ring-1 ring-inset ring-sky-700/10 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-500/20">
              Country Admin Scope
            </span>
          </div>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
            {data.countryName} Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            Country-level reporting, city branches, local ledger stand, and product inventory details.
          </p>
        </div>

        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/dashboard/new-entry/branch-entry/city-branch">
              <Building className="mr-2 h-4 w-4" /> Add Branch
            </Link>
          </Button>
          <Button asChild>
            <Link href={`/dashboard/country?tab=${currentTab === "overview" ? "products" : "overview"}` as Route}>
              {currentTab === "overview" ? "View Products" : "View Overview"}
            </Link>
          </Button>
        </div>
      </section>

      {/* Tabs list navigation */}
      <div className="border-b border-slate-200 dark:border-slate-800">
        <nav className="flex space-x-6" aria-label="Tabs">
          <Link
            href="/dashboard/country?tab=overview"
            className={`border-b-2 py-2 px-1 text-sm font-semibold transition duration-150 ${
              currentTab === "overview"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:border-slate-300 hover:text-foreground"
            }`}
          >
            Overview
          </Link>
          <Link
            href="/dashboard/country?tab=products"
            className={`border-b-2 py-2 px-1 text-sm font-semibold transition duration-150 ${
              currentTab === "products"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:border-slate-300 hover:text-foreground"
            }`}
          >
            Products & Inventory
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
                Country statistics could not load: {data.error}
              </CardContent>
            </Card>
          )}
          {data.databaseReady && <CountryDashboardOverview data={data} />}
        </div>
      )}
    </div>
  );
}

