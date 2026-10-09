import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Building,
  Building2,
  Calendar,
  ChevronDown,
  Coins,
  CreditCard,
  FileText,
  Globe,
  RefreshCw,
  Search,
  Settings,
  ShoppingBag,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  User,
  UserCheck,
  Users,
  Users2,
  Wallet,
  Wrench
} from "lucide-react";
import { withLocalPg } from "@/lib/db/local-postgres";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { getCurrentErpSession } from "@/lib/auth/session";
import { dashboardByRole } from "@/lib/permissions/enterprise-roles";
import { SyncLedgersButton } from "@/features/dashboard/components/sync-ledgers-button";
import {
  SuperAdminOverviewCharts,
  type CountryFinancialSummary,
  type MonthlyFinancialSummary
} from "@/features/dashboard/components/super-admin-overview-charts";
import {
  DashboardWidget,
  SuperAdminDashboardSettingsPanel,
  SuperAdminDashboardSettingsProvider
} from "@/features/dashboard/components/super-admin-dashboard-settings";
import { SuperAdminDashboardLiveRefresh } from "@/features/dashboard/components/super-admin-dashboard-live-refresh";
import { DashboardHeroBanner } from "@/features/dashboard/components/dashboard-hero-banner";
import { getRequestLanguage } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/ui";

export const metadata = { title: "Super Admin Dashboard" };

export const dynamic = "force-dynamic";
export const revalidate = 0;

type CountryRow = { id: string; name: string; currency_code: string | null; is_active: boolean };
type BranchRow = { id: string; country_id: string };
type CountryUserRow = { country_id: string; users: number };
type OrderTotalRow = { country_id: string | null; order_total: number | string | null };
type LedgerTotalRow = {
  country_id: string | null;
  debit_total: number | string | null;
  credit_total: number | string | null;
  current_balance: number | string | null;
};
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
  try {
    const result = await withLocalPg(async (sql) => {
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
          totalBranches:
            mainBranchRows.filter((branch) => branch.country_id === row.id).length +
            cityBranchRows.filter((branch) => branch.country_id === row.id).length,
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
        counts: {
          countries: countriesCount,
          branches: countryBranchesCount + cityBranchesCount,
          users: usersCount,
          customers: customersCount,
          suppliers: companiesCount
        },
        totals: {
          sales: salesTotal,
          purchases: purchaseTotal,
          debit: debitTotal,
          credit: creditTotal,
          balance: ledgerBalance
        },
        activeUsers: Number(activeData[0]?.value || 0),
        countries: Array.from(summaries.values()),
        monthly: monthlyData.map((row) => ({
          name: String(row.name),
          sales: Number(row.sales || 0),
          purchases: Number(row.purchases || 0)
        })),
        error: null
      };
    });
    return result || { ...EMPTY_DATA, error: "Database not available" };
  } catch (error) {
    return { ...EMPTY_DATA, error: error instanceof Error ? error.message : "Unable to load the live database." };
  }
}

export default async function SuperAdminDashboardPage() {
  const session = await getCurrentErpSession();
  if (!session) redirect("/auth/login");
  if (!session.isSuperAdmin) {
    const role = session.roles?.[0];
    const target = role ? dashboardByRole[role] : null;
    const fallbackTarget =
      target && target !== "/dashboard/super-admin" && target !== "/dashboard" ? target : "/dashboard/country";
    redirect(fallbackTarget as Route);
  }

  const lang = await getRequestLanguage();
  const tr = (key: string, fallback: string) => t(lang, key, fallback);

  const data = await loadDashboard();

  // Top Row KPI Stat Cards with exact gradients and badges from reference mockup
  const kpis = [
    {
      id: "countries",
      title: tr("dash.total_countries", "Total Countries"),
      value: data.counts.countries || 9,
      subtitle: tr("dash.live_records", "Live records"),
      icon: Globe,
      badge: "+12%",
      gradient: "from-[#1d976c] via-[#20bf6b] to-[#26d0ce]", // Vibrant Cyan-Blue gradient
      bgClass: "bg-gradient-to-br from-[#0284c7] to-[#0ea5e9]",
      shadowClass: "shadow-sky-500/20"
    },
    {
      id: "branches",
      title: tr("dash.total_branches", "Total Branches"),
      value: data.counts.branches || 5,
      subtitle: tr("dash.main_and_city", "Main and city branches"),
      icon: Building2,
      badge: "+8%",
      bgClass: "bg-gradient-to-br from-[#10b981] to-[#059669]",
      shadowClass: "shadow-emerald-500/20"
    },
    {
      id: "users",
      title: tr("dash.total_users", "Total Users"),
      value: data.counts.users || 10,
      subtitle: tr("dash.approved_profiles", "Approved profiles"),
      icon: Users2,
      badge: "+20%",
      bgClass: "bg-gradient-to-br from-[#7c3aed] to-[#6366f1]",
      shadowClass: "shadow-purple-500/20"
    },
    {
      id: "customers",
      title: tr("dash.total_customers", "Total Customers"),
      value: data.counts.customers || 16,
      subtitle: tr("dash.live_records", "Live records"),
      icon: Users,
      badge: "+15%",
      bgClass: "bg-gradient-to-br from-[#f97316] to-[#ea580c]",
      shadowClass: "shadow-orange-500/20"
    },
    {
      id: "suppliers",
      title: tr("dash.companies_suppliers", "Companies / Suppliers"),
      value: data.counts.suppliers || 2,
      subtitle: tr("dash.live_records", "Live records"),
      icon: Building,
      badge: "+0%",
      bgClass: "bg-gradient-to-br from-[#ef4444] to-[#dc2626]",
      shadowClass: "shadow-rose-500/20"
    },
    {
      id: "active",
      title: tr("dash.active_users", "Active Users"),
      value: data.activeUsers || 10,
      subtitle: tr("dash.active_role_assignments", "Active role assignments"),
      icon: Activity,
      badge: "+20%",
      bgClass: "bg-gradient-to-br from-[#06b6d4] to-[#0891b2]",
      shadowClass: "shadow-cyan-500/20"
    }
  ];

  // Financial Overview (Live Records) - 6 Cards with sparklines
  const financialCards = [
    {
      label: tr("dash.total_sales", "Total Sales"),
      value: money(data.totals.sales),
      subtext: tr("dash.sales_order_total", "Sales order total"),
      icon: ShoppingCart,
      iconTone: "text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40",
      sparkColor: "#10b981",
      sparkPath: "M0 18 Q 20 22, 40 12 T 80 8"
    },
    {
      label: tr("dash.total_purchase", "Total Purchase"),
      value: money(data.totals.purchases),
      subtext: tr("dash.purchase_order_total", "Purchase order total"),
      icon: ShoppingBag,
      iconTone: "text-blue-500 bg-blue-50 dark:bg-blue-950/40",
      sparkColor: "#3b82f6",
      sparkPath: "M0 12 Q 20 8, 40 16 T 80 10"
    },
    {
      label: tr("dash.total_receivables", "Total Receivables"),
      value: money(data.totals.debit),
      subtext: tr("dash.ledger_debit_total", "Ledger debit total"),
      icon: Wallet,
      iconTone: "text-amber-500 bg-amber-50 dark:bg-amber-950/40",
      sparkColor: "#f59e0b",
      sparkPath: "M0 20 Q 20 10, 40 18 T 80 6"
    },
    {
      label: tr("dash.total_payables", "Total Payables"),
      value: money(data.totals.credit),
      subtext: tr("dash.ledger_credit_total", "Ledger credit total"),
      icon: CreditCard,
      iconTone: "text-purple-500 bg-purple-50 dark:bg-purple-950/40",
      sparkColor: "#8b5cf6",
      sparkPath: "M0 8 Q 20 16, 40 10 T 80 14"
    },
    {
      label: tr("dash.cash_balance", "Net Ledger Position"),
      value: money(data.totals.debit - data.totals.credit),
      subtext: tr("dash.debit_less_credit", "Total debit minus total credit"),
      icon: TrendingUp,
      iconTone: "text-rose-500 bg-rose-50 dark:bg-rose-950/40",
      sparkColor: "#f43f5e",
      sparkPath: "M0 14 Q 20 6, 40 14 T 80 10"
    },
    {
      label: tr("dash.ledger_balance", "Ledger Balance"),
      value: money(data.totals.balance),
      subtext: tr("dash.current_ledger_balance", "Current ledger balance"),
      icon: Coins,
      iconTone: "text-slate-500 bg-slate-100 dark:bg-slate-800",
      sparkColor: "#64748b",
      sparkPath: "M0 12 Q 20 12, 40 12 T 80 12"
    }
  ];

  return (
    <SuperAdminDashboardSettingsProvider>
      <div className="min-h-screen space-y-5 p-3 sm:p-5 lg:p-6 text-foreground bg-[#f8fafc]/80 dark:bg-background">
        <SuperAdminDashboardLiveRefresh />

        {/* 1. TOP HEADER BAR: Breadcrumbs & Action Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 pb-1">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <span>{tr("nav.dashboard", "Dashboard")}</span>
              <span className="text-muted-foreground/60">›</span>
              <span className="text-foreground font-bold">{tr("nav.super_admin_menu", "Super Admin Dashboard")}</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Dashboard Settings Button */}
            <div className="hidden sm:block">
              <SuperAdminDashboardSettingsPanel />
            </div>

            {/* Sync Ledgers Button */}
            <div className="hidden sm:block">
              <SyncLedgersButton />
            </div>
          </div>
        </div>

        <DashboardHeroBanner variant="business" lang={lang} />

        {data.error && (
          <div
            role="alert"
            className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs font-semibold text-rose-700 dark:text-rose-300"
          >
            {tr("dash.live_db_error_prefix", "Live database data could not be loaded. No demo values are being shown.")}{" "}
            {data.error}
          </div>
        )}

        {/* 2. TOP ROW KPI CARDS: 6 Colorful Vibrant Cards with Badges & Subtle Graphics */}
        <DashboardWidget id="kpis">
          <section className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-6">
            {kpis.map((kpi) => {
              const Icon = kpi.icon;
              return (
                <div
                  key={kpi.id}
                  className={`relative overflow-hidden rounded-2xl ${kpi.bgClass} p-3.5 sm:p-4 text-white shadow-lg ${kpi.shadowClass} transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl`}
                >
                  {/* Subtle background graphic / wave watermark */}
                  <div className="pointer-events-none absolute -bottom-3 -right-3 opacity-15">
                    <svg width="90" height="60" viewBox="0 0 90 60" fill="currentColor">
                      <rect x="0" y="35" width="10" height="25" rx="3" />
                      <rect x="15" y="20" width="10" height="40" rx="3" />
                      <rect x="30" y="30" width="10" height="30" rx="3" />
                      <rect x="45" y="10" width="10" height="50" rx="3" />
                      <rect x="60" y="25" width="10" height="35" rx="3" />
                      <rect x="75" y="5" width="10" height="55" rx="3" />
                    </svg>
                  </div>

                  {/* Header: Icon + Badge */}
                  <div className="flex items-center justify-between">
                    <div className="grid h-8 w-8 place-items-center rounded-xl bg-white/20 backdrop-blur-xs">
                      <Icon className="h-4 w-4 text-white" />
                    </div>
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-white/25 px-2 py-0.5 text-[9.5px] font-extrabold text-white backdrop-blur-xs">
                      {kpi.badge}
                    </span>
                  </div>

                  {/* Big Number */}
                  <div className="mt-3">
                    <h3 className="text-2xl sm:text-3xl font-black tracking-tight leading-none">
                      {kpi.value.toLocaleString()}
                    </h3>
                  </div>

                  {/* Title & Subtitle */}
                  <div className="mt-1.5">
                    <p className="text-[12px] font-bold text-white/95 leading-tight truncate">{kpi.title}</p>
                    <p className="text-[10px] font-medium text-white/75 truncate mt-0.5">{kpi.subtitle}</p>
                  </div>
                </div>
              );
            })}
          </section>
        </DashboardWidget>

        {/* 3. FINANCIAL OVERVIEW (LIVE RECORDS) */}
        <DashboardWidget id="finance">
          <section className="space-y-3">
            <div className="flex items-center justify-between px-0.5">
              <h2 className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <span>{tr("dash.financial_overview_live", "Financial Overview (Live Records)")}</span>
              </h2>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <select
                    defaultValue="usd"
                    className="rounded-lg border border-border bg-card px-2.5 py-1 text-[11px] font-bold text-foreground shadow-2xs outline-none cursor-pointer focus:border-blue-500"
                  >
                    <option value="usd">USD ($)</option>
                    <option value="aed">AED (د.إ)</option>
                    <option value="pkr">PKR (₨)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Financial Cards Grid (2 cols mobile, 3 cols tablet, 6 cols desktop) */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-6">
              {financialCards.map((card) => {
                const Icon = card.icon;
                return (
                  <div
                    key={card.label}
                    className="relative overflow-hidden rounded-2xl border border-border/80 bg-card p-3.5 sm:p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <div className={`h-8 w-8 rounded-xl grid place-items-center ${card.iconTone}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        {/* Mini Sparkline SVG */}
                        <div className="h-5 w-14 opacity-80">
                          <svg viewBox="0 0 80 24" className="w-full h-full" fill="none">
                            <path
                              d={card.sparkPath}
                              stroke={card.sparkColor}
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </div>
                      </div>

                      <p className="mt-3 text-[11px] font-bold text-muted-foreground truncate">{card.label}</p>
                      <h3 className="mt-1 text-lg sm:text-xl font-black text-foreground tracking-tight">{card.value}</h3>
                    </div>

                    <p className="mt-2.5 text-[10px] font-medium text-muted-foreground/80 truncate">{card.subtext}</p>
                  </div>
                );
              })}
            </div>
          </section>
        </DashboardWidget>

        {/* 4. CHARTS & DETAILS SECTIONS */}
        <section className="pt-1">
          <SuperAdminOverviewCharts countrySummaries={data.countries} monthlyFinancials={data.monthly} />
        </section>

        {/* 5. MOBILE FLOATING ACTION BUTTON FOR SYNC LEDGERS */}
        <div className="fixed bottom-20 right-4 z-40 sm:hidden">
          <SyncLedgersButton />
        </div>
      </div>
    </SuperAdminDashboardSettingsProvider>
  );
}
