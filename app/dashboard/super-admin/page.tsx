import { Activity, Building2, Globe, User, Users2, Wrench } from "lucide-react";
import postgres from "postgres";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { getCurrentErpSession } from "@/lib/auth/session";
import { dashboardByRole } from "@/lib/permissions/enterprise-roles";
import { SyncLedgersButton } from "@/features/dashboard/components/sync-ledgers-button";
import { SuperAdminOverviewCharts, type CountryFinancialSummary, type MonthlyFinancialSummary } from "@/features/dashboard/components/super-admin-overview-charts";
import { DashboardWidget, SuperAdminDashboardSettingsPanel, SuperAdminDashboardSettingsProvider } from "@/features/dashboard/components/super-admin-dashboard-settings";
import { SuperAdminDashboardLiveRefresh } from "@/features/dashboard/components/super-admin-dashboard-live-refresh";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type CountryRow = { id: string; name: string; currency_code: string | null; is_active: boolean };
type BranchRow = { id: string; country_id: string };
type CountryUserRow = { country_id: string; users: number };
type OrderTotalRow = { country_id: string | null; order_total: number | string | null };
type LedgerTotalRow = { country_id: string | null; debit_total: number | string | null; credit_total: number | string | null; current_balance: number | string | null };
type MonthlyRow = { name: string; sales: number | string; purchases: number | string };
type CountRow = { value: number | string };
type DashboardData = {
  counts: { countries: number; branches: number; users: number; customers: number; suppliers: number };
  totals: { sales: number; purchases: number; debit: number; credit: number; balance: number };
  activeUsers: number;
  countries: CountryFinancialSummary[];
  monthly: MonthlyFinancialSummary[];
  error: string | null;
};

const EMPTY_DATA: DashboardData = {
  counts: { countries: 0, branches: 0, users: 0, customers: 0, suppliers: 0 },
  totals: { sales: 0, purchases: 0, debit: 0, credit: 0, balance: 0 },
  activeUsers: 0,
  countries: [],
  monthly: [],
  error: null
};

function money(value: number) {
  return `$${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value)}`;
}

async function loadDashboard(): Promise<DashboardData> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return { ...EMPTY_DATA, error: "DATABASE_URL is not configured." };

  const sql = postgres(dbUrl, { max: 1, prepare: false, idle_timeout: 5, connect_timeout: 10 });
  const count = async (table: string) => {
    try {
      const rows = await sql`select count(*)::int as value from ${sql(table)} where deleted_at is null`;
      return Number(rows[0]?.value || 0);
    } catch {
      try {
        const rows = await sql`select count(*)::int as value from ${sql(table)}`;
        return Number(rows[0]?.value || 0);
      } catch {
        return 0;
      }
    }
  };

  try {
    await sql`select 1 as connected`;
    const countriesCount = await count("countries");
    const countryBranchesCount = await count("country_branches");
    const cityBranchesCount = await count("city_branches");
    const usersCount = await count("profiles");
    const customersCount = await count("customers");
    const companiesCount = await count("companies");
    const activeRows = await sql`select count(distinct user_id)::int as value from user_role_assignments where is_active=true and deleted_at is null`.catch(() => [{ value: 0 }]);
    const purchaseRows = await sql`select country_id, order_total from purchase_orders where deleted_at is null`.catch(() => []);
    const salesRows = await sql`select country_id, order_total from sales_orders where deleted_at is null`.catch(() => []);
    const ledgerRows = await sql`select country_id, debit_total, credit_total, current_balance from ledgers where deleted_at is null`.catch(() => []);
    const countries = await sql`select id, name, currency_code, is_active from countries where deleted_at is null order by name`.catch(() => []);
    const mainBranches = await sql`select id, country_id from country_branches where deleted_at is null`.catch(() => []);
    const cityBranches = await sql`select id, country_id from city_branches where deleted_at is null`.catch(() => []);
    const countryUsers = await sql`select country_id, count(distinct user_id)::int as users from user_role_assignments where is_active=true and deleted_at is null and country_id is not null group by country_id`.catch(() => []);
    const monthly = await sql`
      with months as (
        select generate_series(date_trunc('month', current_date)-interval '5 months', date_trunc('month', current_date), interval '1 month') month_start
      )
      select to_char(month_start,'Mon YYYY') name,
        coalesce((select sum(order_total) from sales_orders where deleted_at is null and created_at>=month_start and created_at<month_start+interval '1 month'),0)::float8 sales,
        coalesce((select sum(order_total) from purchase_orders where deleted_at is null and created_at>=month_start and created_at<month_start+interval '1 month'),0)::float8 purchases
      from months order by month_start
    `.catch(() => []);
    const countryRows = countries as unknown as CountryRow[];
    const mainBranchRows = mainBranches as unknown as BranchRow[];
    const cityBranchRows = cityBranches as unknown as BranchRow[];
    const countryUserData = countryUsers as unknown as CountryUserRow[];
    const purchases = purchaseRows as unknown as OrderTotalRow[];
    const sales = salesRows as unknown as OrderTotalRow[];
    const ledgers = ledgerRows as unknown as LedgerTotalRow[];
    const monthlyData = monthly as unknown as MonthlyRow[];
    const activeData = activeRows as unknown as CountRow[];

    const summaries = new Map<string, CountryFinancialSummary>();
    for (const row of countryRows) {
      summaries.set(row.id, {
        id: row.id,
        name: row.name,
        currency: row.currency_code || "",
        totalPurchases: 0,
        totalSales: 0,
        totalDebit: 0,
        totalCredit: 0,
        totalLedgerBalance: 0,
        totalBranches: mainBranchRows.filter((branch) => branch.country_id === row.id).length + cityBranchRows.filter((branch) => branch.country_id === row.id).length,
        totalUsers: Number(countryUserData.find((entry) => entry.country_id === row.id)?.users || 0),
        isActive: row.is_active === true
      });
    }
    for (const row of purchases) {
      if (!row.country_id) continue;
      const summary = summaries.get(row.country_id);
      if (summary) summary.totalPurchases += Number(row.order_total || 0);
    }
    for (const row of sales) {
      if (!row.country_id) continue;
      const summary = summaries.get(row.country_id);
      if (summary) summary.totalSales += Number(row.order_total || 0);
    }
    for (const row of ledgers) {
      if (!row.country_id) continue;
      const summary = summaries.get(row.country_id);
      if (summary) {
        summary.totalDebit += Number(row.debit_total || 0);
        summary.totalCredit += Number(row.credit_total || 0);
        summary.totalLedgerBalance += Number(row.current_balance || 0);
      }
    }

    const salesTotal = sales.reduce((total, row) => total + Number(row.order_total || 0), 0);
    const purchaseTotal = purchases.reduce((total, row) => total + Number(row.order_total || 0), 0);
    const debitTotal = ledgers.reduce((total, row) => total + Number(row.debit_total || 0), 0);
    const creditTotal = ledgers.reduce((total, row) => total + Number(row.credit_total || 0), 0);
    const ledgerBalance = ledgers.reduce((total, row) => total + Number(row.current_balance || 0), 0);
    return {
      counts: { countries: countriesCount, branches: countryBranchesCount + cityBranchesCount, users: usersCount, customers: customersCount, suppliers: companiesCount },
      totals: {
        sales: salesTotal,
        purchases: purchaseTotal,
        debit: debitTotal,
        credit: creditTotal,
        balance: ledgerBalance
      },
      activeUsers: Number(activeData[0]?.value || 0),
      countries: Array.from(summaries.values()),
      monthly: monthlyData.map((row) => ({ name: String(row.name), sales: Number(row.sales || 0), purchases: Number(row.purchases || 0) })),
      error: null
    };
  } catch (error) {
    return { ...EMPTY_DATA, error: error instanceof Error ? error.message : "Unable to load the live database." };
  } finally {
    await sql.end({ timeout: 2 }).catch(() => undefined);
  }
}

import { getRequestLanguage } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/ui";

export default async function SuperAdminDashboardPage() {
  const session = await getCurrentErpSession();
  if (!session) redirect("/auth/login");
  if (!session.isSuperAdmin) {
    const role = session.roles?.[0];
    const target = role ? dashboardByRole[role] : null;
    const fallbackTarget = (target && target !== "/dashboard/super-admin" && target !== "/dashboard")
      ? target
      : "/dashboard/country";
    redirect(fallbackTarget as Route);
  }

  const lang = await getRequestLanguage();
  const tr = (key: string, fallback: string) => t(lang, key, fallback);

  const data = await loadDashboard();
  const kpis = [
    { title: tr("dash.total_countries", "Total Countries"), value: data.counts.countries, subtitle: tr("dash.live_records", "Live records"), icon: Globe, color: "text-cyan-500" },
    { title: tr("dash.total_branches", "Total Branches"), value: data.counts.branches, subtitle: tr("dash.main_and_city", "Main and city"), icon: Building2, color: "text-emerald-500" },
    { title: tr("dash.total_users", "Total Users"), value: data.counts.users, subtitle: tr("dash.approved_profiles", "Approved profiles"), icon: Users2, color: "text-violet-500" },
    { title: tr("dash.total_customers", "Total Customers"), value: data.counts.customers, subtitle: tr("dash.live_records", "Live records"), icon: User, color: "text-amber-500" },
    { title: tr("dash.companies_suppliers", "Companies / Suppliers"), value: data.counts.suppliers, subtitle: tr("dash.live_records", "Live records"), icon: Wrench, color: "text-cyan-500" },
    { title: tr("dash.active_users", "Active Users"), value: data.activeUsers, subtitle: tr("dash.active_role_assignments", "Active role assignments"), icon: Activity, color: "text-blue-500" }
  ];
  const financial = [
    [tr("dash.total_sales", "Total Sales"), data.totals.sales, tr("dash.sales_order_total", "Sales order total")],
    [tr("dash.total_purchase", "Total Purchase"), data.totals.purchases, tr("dash.purchase_order_total", "Purchase order total")],
    [tr("dash.total_receivables", "Total Receivables"), data.totals.debit, tr("dash.ledger_debit_total", "Ledger debit total")],
    [tr("dash.total_payables", "Total Payables"), data.totals.credit, tr("dash.ledger_credit_total", "Ledger credit total")],
    [tr("dash.cash_balance", "Cash Balance"), data.totals.debit - data.totals.credit, tr("dash.debit_less_credit", "Debit less credit")],
    [tr("dash.ledger_balance", "Ledger Balance"), data.totals.balance, tr("dash.current_ledger_balance", "Current ledger balance")]
  ] as const;

  return (
    <SuperAdminDashboardSettingsProvider>
      <div className="min-h-screen space-y-6 p-4 text-foreground lg:p-6">
        <SuperAdminDashboardLiveRefresh />
        <section className="flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-extrabold"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />{tr("dash.super_admin_control_center", "Super Admin Control Center")}</h1>
            <p className="mt-1 text-xs font-medium text-muted-foreground">{tr("dash.live_db_overview_subtitle", "Live database overview. No demo or fallback statistics.")}</p>
          </div>
          <div className="flex items-center gap-2"><SuperAdminDashboardSettingsPanel /><SyncLedgersButton /></div>
        </section>

        {data.error && <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-700 dark:text-rose-300">{tr("dash.live_db_error_prefix", "Live database data could not be loaded. No demo values are being shown.")} {data.error}</div>}

        <DashboardWidget id="kpis">
          <section className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
            {kpis.map(({ title, value, subtitle, icon: Icon, color }) => (
              <div key={title} className="flex items-center justify-between rounded-2xl border border-border bg-card p-4 shadow-lg">
                <div><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{title}</p><h3 className="mt-1.5 text-xl font-extrabold">{value.toLocaleString()}</h3><p className="mt-1 text-[10px] font-semibold text-muted-foreground">{subtitle}</p></div>
                <div className={`grid h-9 w-9 place-items-center rounded-xl border border-current/20 bg-current/10 ${color}`}><Icon className="h-4 w-4" /></div>
              </div>
            ))}
          </section>
        </DashboardWidget>

        <DashboardWidget id="finance">
          <section className="space-y-3">
            <h2 className="px-1 text-xs font-black uppercase tracking-wider text-muted-foreground">{tr("dash.financial_overview_live", "Financial Overview (Live Records)")}</h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
              {financial.map(([label, value, subtitle]) => <div key={label} className="rounded-2xl border border-border bg-card p-4 shadow-lg"><p className="text-[10px] font-bold text-muted-foreground">{label}</p><h3 className="mt-2 text-lg font-black">{money(value)}</h3><p className="mt-3 text-[10px] font-semibold text-muted-foreground">{subtitle}</p></div>)}
            </div>
          </section>
        </DashboardWidget>

        <section className="pt-2"><SuperAdminOverviewCharts countrySummaries={data.countries} monthlyFinancials={data.monthly} /></section>
      </div>
    </SuperAdminDashboardSettingsProvider>
  );
}
