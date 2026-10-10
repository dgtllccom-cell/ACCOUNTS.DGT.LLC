import { withLocalPg } from "@/lib/db/local-postgres";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { getCurrentErpSession } from "@/lib/auth/session";
import { dashboardByRole } from "@/lib/permissions/enterprise-roles";
import {
  type CountryFinancialSummary,
  type MonthlyFinancialSummary
} from "@/features/dashboard/components/super-admin-overview-charts";
import {
  SuperAdminDashboardSettingsProvider
} from "@/features/dashboard/components/super-admin-dashboard-settings";
import { SuperAdminDashboardLiveRefresh } from "@/features/dashboard/components/super-admin-dashboard-live-refresh";
import {
  SuperAdminV20DashboardView,
  type DashboardV20Data
} from "@/features/dashboard/components/super-admin-v20-dashboard-view";

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

const EMPTY_DATA: DashboardV20Data = {
  counts: { countries: 0, branches: 0, users: 0, customers: 0, suppliers: 0, purchasesCount: 0 },
  totals: { sales: 0, purchases: 0, debit: 0, credit: 0, balance: 0 },
  activeUsers: 0,
  countries: [],
  companies: [],
  monthly: [],
  error: null
};

async function loadDashboard(): Promise<DashboardV20Data> {
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
      const companiesList = (await sql`select id, name from companies where deleted_at is null order by name`.catch(() => [])) as unknown as { id: string; name: string }[];
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
          suppliers: companiesCount,
          purchasesCount: purchases.length
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
        companies: Array.isArray(companiesList) ? companiesList : [],
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

  const data = await loadDashboard();

  return (
    <SuperAdminDashboardSettingsProvider>
      <div className="min-h-screen p-2.5 sm:p-4 lg:p-6 text-foreground bg-[#f8fafc]/80 dark:bg-background">
        <SuperAdminDashboardLiveRefresh />
        {data.error && (
          <div
            role="alert"
            className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs font-semibold text-rose-700 dark:text-rose-300"
          >
            {data.error}
          </div>
        )}
        <SuperAdminV20DashboardView data={data} />
      </div>
    </SuperAdminDashboardSettingsProvider>
  );
}
