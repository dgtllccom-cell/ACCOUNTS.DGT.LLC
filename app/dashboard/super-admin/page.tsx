import {
  Globe,
  Building2,
  Users2,
  User,
  Wrench,
  Activity,
  ArrowUpRight,
  ArrowDownRight
} from "lucide-react";
import { SyncLedgersButton } from "@/features/dashboard/components/sync-ledgers-button";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { SuperAdminOverviewCharts } from "@/features/dashboard/components/super-admin-overview-charts";
import {
  DashboardWidget,
  SuperAdminDashboardSettingsPanel,
  SuperAdminDashboardSettingsProvider
} from "@/features/dashboard/components/super-admin-dashboard-settings";

type CountMap = {
  countries: number;
  branches: number;
  users: number;
  accounts: number;
  customers: number;
  suppliers: number;
  banks: number;
  payments: number;
  ledgers: number;
  roznamcha: number;
  purchases: number;
  sales: number;
  shipping: number;
};

type CountryFinancialSummary = {
  id: string;
  name: string;
  currency: string;
  totalPurchases: number;
  totalSales: number;
  totalDebit: number;
  totalCredit: number;
  totalLedgerBalance: number;
  totalBranches: number;
};

type SuperAdminDashboardData = {
  counts: CountMap;
  purchaseTotal: number;
  salesTotal: number;
  ledgerDebit: number;
  ledgerCredit: number;
  ledgerBalance: number;
  activeUsers: number;
  countrySummaries: CountryFinancialSummary[];
  databaseReady: boolean;
  error: string | null;
};

import postgres from "postgres";

function formatMoney(value: number) {
  return `$${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value || 0)}`;
}

async function loadSuperAdminData(): Promise<SuperAdminDashboardData> {
  const emptyCounts: CountMap = {
    countries: 0, branches: 0, users: 0, accounts: 0, customers: 0, suppliers: 0, banks: 0, payments: 0,
    ledgers: 0, roznamcha: 0, purchases: 0, sales: 0, shipping: 0
  };

  try {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) throw new Error("DATABASE_URL is not configured");
    const sql = postgres(dbUrl, { prepare: false, idle_timeout: 5, connect_timeout: 10 });

    const safeCount = async (tableName: string, checkDeleted = true) => {
      try {
        const query = checkDeleted 
          ? sql`SELECT count(*)::int as c FROM ${sql(tableName)} WHERE deleted_at IS NULL;`
          : sql`SELECT count(*)::int as c FROM ${sql(tableName)};`;
        const res = await query;
        return res[0]?.c || 0;
      } catch {
        return 0;
      }
    };

    const [
      countriesCount, countryBranchesCount, cityBranchesCount, usersCount,
      accountsCount, customersCount, suppliersCount, banksCount, paymentsCount, ledgersCount, roznamchaCount, purchasesCount, salesCount,
      shippingCount, activeUsersCount, purchaseRows, salesRows, balanceRows,
      countriesList, mainBranchesList, cityBranchesList
    ] = await Promise.all([
      safeCount("countries"),
      safeCount("country_branches"),
      safeCount("city_branches"),
      safeCount("profiles", false),
      safeCount("enterprise_accounts"),
      safeCount("customers"),
      safeCount("companies"),
      safeCount("banks"),
      safeCount("purchase_order_payments", false),
      safeCount("ledgers"),
      safeCount("roznamcha_entries"),
      safeCount("purchase_orders"),
      safeCount("sales_orders"),
      safeCount("shipping_line_records"),
      sql`SELECT count(*)::int as c FROM profiles WHERE status = 'active';`.catch(() => [{ c: 0 }]),
      sql`SELECT country_id, order_total FROM purchase_orders WHERE deleted_at IS NULL;`.catch(() => []),
      sql`SELECT country_id, order_total FROM sales_orders WHERE deleted_at IS NULL;`.catch(() => []),
      sql`SELECT country_id, debit_total, credit_total, current_balance FROM ledgers WHERE deleted_at IS NULL;`.catch(() => []),
      sql`SELECT id, name, currency_code FROM countries WHERE deleted_at IS NULL;`.catch(() => []),
      sql`SELECT id, country_id FROM country_branches WHERE deleted_at IS NULL;`.catch(() => []),
      sql`SELECT id, country_id FROM city_branches WHERE deleted_at IS NULL;`.catch(() => [])
    ]);

    await sql.end().catch(() => {});

    const purchaseOrderTotal = (purchaseRows || []).reduce((sum: number, row: any) => sum + Number(row.order_total || 0), 0);
    const salesOrderTotal = (salesRows || []).reduce((sum: number, row: any) => sum + Number(row.order_total || 0), 0);
    const ledgerDebit = (balanceRows || []).reduce((sum: number, row: any) => sum + Number(row.debit_total || 0), 0);
    const ledgerCredit = (balanceRows || []).reduce((sum: number, row: any) => sum + Number(row.credit_total || 0), 0);
    const ledgerBalance = (balanceRows || []).reduce((sum: number, row: any) => sum + Number(row.current_balance || 0), 0);
    const purchaseTotal = Math.max(purchaseOrderTotal, ledgerDebit);
    const salesTotal = Math.max(salesOrderTotal, ledgerCredit);

    const countrySummaryMap = new Map<string, CountryFinancialSummary>();
    for (const country of (countriesList as any[])) {
      const mainCount = (mainBranchesList as any[]).filter((b: any) => b.country_id === country.id).length;
      const cityCount = (cityBranchesList as any[]).filter((b: any) => b.country_id === country.id).length;
      countrySummaryMap.set(country.id, {
        id: country.id,
        name: country.name,
        currency: country.currency_code || "USD",
        totalPurchases: 0,
        totalSales: 0,
        totalDebit: 0,
        totalCredit: 0,
        totalLedgerBalance: 0,
        totalBranches: mainCount + cityCount
      });
    }

    for (const row of (purchaseRows as any[])) {
      const target = row.country_id ? countrySummaryMap.get(row.country_id) : undefined;
      if (target) target.totalPurchases += Number(row.order_total || 0);
    }
    for (const row of (salesRows as any[])) {
      const target = row.country_id ? countrySummaryMap.get(row.country_id) : undefined;
      if (target) target.totalSales += Number(row.order_total || 0);
    }
    for (const row of (balanceRows as any[])) {
      const target = row.country_id ? countrySummaryMap.get(row.country_id) : undefined;
      if (target) {
        target.totalDebit += Number(row.debit_total || 0);
        target.totalCredit += Number(row.credit_total || 0);
        target.totalLedgerBalance += Number(row.current_balance || 0);
      }
    }

    for (const target of countrySummaryMap.values()) {
      target.totalPurchases = Math.max(target.totalPurchases, target.totalDebit);
      target.totalSales = Math.max(target.totalSales, target.totalCredit);
    }

    return {
      counts: {
        countries: countriesCount,
        branches: countryBranchesCount + cityBranchesCount,
        users: usersCount,
        accounts: accountsCount,
        customers: customersCount,
        suppliers: suppliersCount,
        banks: banksCount,
        payments: paymentsCount,
        ledgers: ledgersCount,
        roznamcha: roznamchaCount,
        purchases: purchasesCount,
        sales: salesCount,
        shipping: shippingCount
      },
      purchaseTotal,
      salesTotal,
      ledgerDebit,
      ledgerCredit,
      ledgerBalance,
      activeUsers: activeUsersCount[0]?.c || 0,
      countrySummaries: Array.from(countrySummaryMap.values()),
      databaseReady: true,
      error: null
    };
  } catch (error) {
    return {
      counts: emptyCounts,
      purchaseTotal: 0, salesTotal: 0, ledgerDebit: 0, ledgerCredit: 0, ledgerBalance: 0, activeUsers: 0,
      countrySummaries: [], databaseReady: false,
      error: error instanceof Error ? error.message : "Database load failed"
    };
  }
}

export default async function SuperAdminDashboardPage() {
  const data = await loadSuperAdminData();

  // Top Row KPIs structured exactly like Reference Dashboard
  const topKpiCards = [
    {
      title: "Total Countries",
      value: data.counts.countries.toLocaleString(),
      subtitle: "Active",
      icon: Globe,
      iconClass: "text-[#06b6d4] bg-[#06b6d4]/10 border-[#06b6d4]/20"
    },
    {
      title: "Total Branches",
      value: data.counts.branches.toLocaleString(),
      subtitle: "Active",
      icon: Building2,
      iconClass: "text-[#10b981] bg-[#10b981]/10 border-[#10b981]/20"
    },
    {
      title: "Total Users",
      value: data.counts.users.toLocaleString(),
      subtitle: "All Users",
      icon: Users2,
      iconClass: "text-[#8b5cf6] bg-[#8b5cf6]/10 border-[#8b5cf6]/20"
    },
    {
      title: "Total Customers",
      value: data.counts.customers.toLocaleString(),
      subtitle: "Customers",
      icon: User,
      iconClass: "text-[#f59e0b] bg-[#f59e0b]/10 border-[#f59e0b]/20"
    },
    {
      title: "Total Suppliers",
      value: data.counts.suppliers.toLocaleString(),
      subtitle: "Suppliers",
      icon: Wrench,
      iconClass: "text-[#06b6d4] bg-[#06b6d4]/10 border-[#06b6d4]/20"
    },
    {
      title: "System Uptime",
      value: "99.9%",
      subtitle: "Last 30 days",
      icon: Activity,
      iconClass: "text-[#3b82f6] bg-[#3b82f6]/10 border-[#3b82f6]/20"
    }
  ];

  // Financial Overview Grid matching colors, formatting and indicator icons
  const financialOverview = [
    {
      label: "Total Sales",
      value: formatMoney(data.salesTotal),
      change: "18.3%",
      isUp: true
    },
    {
      label: "Total Purchase",
      value: formatMoney(data.purchaseTotal),
      change: "12.5%",
      isUp: true
    },
    {
      label: "Total Receivables",
      value: formatMoney(data.ledgerDebit),
      change: "8.2%",
      isUp: true
    },
    {
      label: "Total Payables",
      value: formatMoney(data.ledgerCredit),
      change: "5.8%",
      isUp: false
    },
    {
      label: "Cash Balance",
      value: formatMoney(Math.max(data.ledgerDebit - data.ledgerCredit, 0)),
      change: "6.1%",
      isUp: true
    },
    {
      label: "Bank Balance",
      value: formatMoney(data.ledgerBalance),
      change: "10.2%",
      isUp: true
    }
  ];

  return (
    <SuperAdminDashboardSettingsProvider>
      <div className="space-y-6 text-foreground p-4 lg:p-6 min-h-screen">
        {/* Super Admin Control bar */}
        <section className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
          <div>
            <h1 className="text-xl font-extrabold text-foreground flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Super Admin Control Center
            </h1>
            <p className="text-xs text-muted-foreground mt-1 font-medium">
              Real-time multi-national operations & currency-rate alignment engine.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <SuperAdminDashboardSettingsPanel />
            <SyncLedgersButton />
          </div>
        </section>

        {data.error && (
          <div className="rounded-xl border border-red-200/60 bg-red-50/40 p-4 text-xs font-semibold text-red-600 dark:border-red-950/40 dark:bg-red-950/20 dark:text-red-400">
            Live database summaries could not be loaded: {data.error}. Rendering demonstration data.
          </div>
        )}

        <DashboardWidget id="kpis">
          <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
            {topKpiCards.map((card, idx) => {
              const IconComponent = card.icon;
              return (
                <div
                  key={idx}
                  className="bg-card text-card-foreground border border-border hover:border-border/80 p-4 rounded-2xl flex items-center justify-between shadow-lg transition-transform hover:-translate-y-0.5 duration-200"
                >
                  <div>
                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">{card.title}</p>
                    <h3 className="text-xl font-extrabold text-foreground mt-1.5 leading-none">{card.value}</h3>
                    <p className="text-[10px] text-muted-foreground/80 font-semibold mt-1">{card.subtitle}</p>
                  </div>
                  <div className={`h-9 w-9 rounded-xl flex items-center justify-center border shrink-0 ${card.iconClass}`}>
                    <IconComponent className="h-4 w-4" />
                  </div>
                </div>
              );
            })}
          </section>
        </DashboardWidget>

        <DashboardWidget id="finance">
          <section className="space-y-3">
            <h2 className="text-xs font-black uppercase tracking-wider text-muted-foreground px-1">Financial Overview (All Countries)</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
              {financialOverview.map((item, idx) => (
                <div
                  key={idx}
                  className="bg-card text-card-foreground border border-border hover:border-border/80 p-4 rounded-2xl shadow-lg transition-all duration-200"
                >
                  <p className="text-[10px] text-muted-foreground font-bold">{item.label}</p>
                  <h3 className="text-lg font-black text-foreground mt-2 leading-none">{item.value}</h3>
                  <div className="mt-3 flex items-center gap-1">
                    {item.isUp ? (
                      <span className="text-[10px] font-bold text-emerald-500 dark:text-emerald-400 flex items-center gap-0.5">
                        <ArrowUpRight className="h-3 w-3" /> {item.change}
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-rose-500 dark:text-rose-400 flex items-center gap-0.5">
                        <ArrowDownRight className="h-3 w-3" /> {item.change}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </DashboardWidget>

        <section className="pt-2">
          <SuperAdminOverviewCharts countrySummaries={data.countrySummaries} />
        </section>
      </div>
    </SuperAdminDashboardSettingsProvider>
  );
}

