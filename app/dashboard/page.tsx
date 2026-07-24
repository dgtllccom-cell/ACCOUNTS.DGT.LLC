import Link from "next/link";
import { ArrowRight, Banknote, Database, GitBranch, ReceiptText, ShieldCheck, Ship, ShoppingCart, TrendingUp, Users, BarChart } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/layout/stat-card";
import { getRequestLanguage } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/ui";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentErpSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { dashboardByRole } from "@/lib/permissions/enterprise-roles";
import type { Route } from "next";


type CountMap = {
  countries: number;
  branches: number;
  users: number;
  accounts: number;
  ledgers: number;
  roznamcha: number;
  purchases: number;
  sales: number;
  shipping: number;
};

type RecentEntry = {
  id: string;
  voucher_no: string | null;
  entry_date: string | null;
  type: string | null;
  status: string | null;
  created_at: string | null;
};

type DashboardData = {
  counts: CountMap;
  purchaseTotal: number;
  salesTotal: number;
  ledgerDebit: number;
  ledgerCredit: number;
  ledgerBalance: number;
  recentRoznamcha: RecentEntry[];
  databaseReady: boolean;
  error: string | null;
};

function money(value: number, currency = "USD") {
  return `${currency} ${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value || 0)}`;
}

async function countRows(supabase: ReturnType<typeof createSupabaseAdminClient>, table: string, deleted = true) {
  let query = supabase.from(table).select("id", { count: "exact", head: true });
  if (deleted) query = query.is("deleted_at", null);
  const { count, error } = await query;
  if (error) return 0;
  return count ?? 0;
}

async function loadDashboardData(): Promise<DashboardData> {
  const emptyCounts: CountMap = {
    countries: 0,
    branches: 0,
    users: 0,
    accounts: 0,
    ledgers: 0,
    roznamcha: 0,
    purchases: 0,
    sales: 0,
    shipping: 0
  };

  try {
    const supabase = createSupabaseAdminClient();
    const [
      countries,
      countryBranches,
      cityBranches,
      users,
      accounts,
      ledgers,
      roznamcha,
      purchases,
      sales,
      shipping,
      purchaseRows,
      salesRows,
      balanceRows,
      recentRows
    ] = await Promise.all([
      countRows(supabase, "countries"),
      countRows(supabase, "country_branches"),
      countRows(supabase, "city_branches"),
      countRows(supabase, "profiles", false),
      countRows(supabase, "enterprise_accounts"),
      countRows(supabase, "ledgers"),
      countRows(supabase, "roznamcha_entries"),
      countRows(supabase, "purchase_orders"),
      countRows(supabase, "sales_orders"),
      countRows(supabase, "shipping_line_records"),
      supabase.from("purchase_orders").select("order_total").is("deleted_at", null),
      supabase.from("sales_orders").select("order_total").is("deleted_at", null),
      supabase.from("ledger_balances").select("debit_total, credit_total, current_balance"),
      supabase
        .from("roznamcha_entries")
        .select("id, voucher_no, entry_date, type, status, created_at")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(8)
    ]);

    const purchaseTotal = (purchaseRows.data ?? []).reduce((sum: number, row: any) => sum + Number(row.order_total || 0), 0);
    const salesTotal = (salesRows.data ?? []).reduce((sum: number, row: any) => sum + Number(row.order_total || 0), 0);
    const ledgerDebit = (balanceRows.data ?? []).reduce((sum: number, row: any) => sum + Number(row.debit_total || 0), 0);
    const ledgerCredit = (balanceRows.data ?? []).reduce((sum: number, row: any) => sum + Number(row.credit_total || 0), 0);
    const ledgerBalance = (balanceRows.data ?? []).reduce((sum: number, row: any) => sum + Number(row.current_balance || 0), 0);

    return {
      counts: {
        countries,
        branches: countryBranches + cityBranches,
        users,
        accounts,
        ledgers,
        roznamcha,
        purchases,
        sales,
        shipping
      },
      purchaseTotal,
      salesTotal,
      ledgerDebit,
      ledgerCredit,
      ledgerBalance,
      recentRoznamcha: (recentRows.data ?? []) as RecentEntry[],
      databaseReady: true,
      error: null
    };
  } catch (error) {
    return {
      counts: emptyCounts,
      purchaseTotal: 0,
      salesTotal: 0,
      ledgerDebit: 0,
      ledgerCredit: 0,
      ledgerBalance: 0,
      recentRoznamcha: [],
      databaseReady: false,
      error: error instanceof Error ? error.message : "Database summary failed"
    };
  }
}

function StatusPill({ value }: { value: string }) {
  const tone =
    value === "posted" || value === "approved"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : value === "draft"
        ? "bg-amber-50 text-amber-700 border-amber-200"
        : "bg-slate-50 text-slate-700 border-slate-200";
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${tone}`}>{value}</span>;
}

export default async function DashboardPage() {
  const session = await getCurrentErpSession();
  if (session) {
    const primary = session.roles.includes("super_admin")
      ? "super_admin"
      : session.roles.includes("country_admin")
        ? "country_admin"
        : session.roles.includes("country_user")
          ? "country_user"
          : session.roles[0];
    const target = primary ? dashboardByRole[primary] : "/dashboard/super-admin";
    if (target && target !== "/dashboard") {
      redirect(target as Route);
    }
  }

  const lang = await getRequestLanguage();
  const data = await loadDashboardData();


  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t(lang, "nav.dashboard")}</h1>
          <p className="text-sm text-muted-foreground">
            Live ERP overview from production tables: accounts, ledgers, roznamcha, purchases, sales, and shipping.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button asChild variant="secondary">
            <Link href="/dashboard/new-entry">
              {t(lang, "dash.quick_actions")} <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard/accounts/setup">New Account</Link>
          </Button>
        </div>
      </section>

      {!data.databaseReady ? (
        <Card className="border-amber-200 bg-amber-50 text-amber-900">
          <CardContent className="p-4 text-sm font-semibold">
            Database summary could not load: {data.error}
          </CardContent>
        </Card>
      ) : null}

      {/* Experimental Setup Quick Login Block */}
      <section>
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Experimental Setup: Test Accounts
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Use these credentials to quickly log in and test multi-country behaviors.
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {[
                { name: "United Arab Emirates", branch: "UAE / Dubai Main Branch", code: "ARE-CA-000001", cur: "AED" },
                { name: "India", branch: "India Main Branch", code: "IND-CA-000001", cur: "INR" },
                { name: "Iran", branch: "Iran Main Branch", code: "IRN-CA-000001", cur: "IRR" },
                { name: "Pakistan", branch: "Pakistan Main Branch", code: "PAK-CA-000001", cur: "PKR" },
                { name: "Afghanistan", branch: "Afghanistan Main Branch", code: "AFG-CA-000001", cur: "AFN" }
              ].map((testUser) => (
                <div key={testUser.code} className="flex flex-col gap-1 rounded-md border bg-card p-3 text-sm shadow-sm">
                  <div className="flex items-center justify-between font-semibold">
                    <span>{testUser.name}</span>
                    <span className="text-xs text-muted-foreground">{testUser.cur}</span>
                  </div>
                  <div className="text-muted-foreground text-xs">{testUser.branch}</div>
                  <div className="mt-2 flex items-center justify-between bg-muted/50 p-2 rounded text-xs font-mono">
                    <span className="select-all">{testUser.code}@test.com</span>
                    <span className="select-all">TestUser@1234</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Countries" value={String(data.counts.countries)} icon={Database} />
        <StatCard label={t(lang, "dash.total_branches")} value={String(data.counts.branches)} icon={GitBranch} />
        <StatCard label={t(lang, "dash.total_users")} value={String(data.counts.users)} icon={Users} />
        <StatCard label="Account Master" value={String(data.counts.accounts)} icon={Banknote} />
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Ledgers" value={String(data.counts.ledgers)} icon={ReceiptText} />
        <StatCard label="Roznamcha Entries" value={String(data.counts.roznamcha)} icon={ShieldCheck} />
        <StatCard label="Purchase Orders" value={String(data.counts.purchases)} icon={ShoppingCart} />
        <StatCard label="Shipping Records" value={String(data.counts.shipping)} icon={Ship} />
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Live Financial Summary</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Calculated from ledger balances and order tables.</p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <SummaryBox label="Ledger Debit" value={money(data.ledgerDebit)} />
              <SummaryBox label="Ledger Credit" value={money(data.ledgerCredit)} />
              <SummaryBox label="Ledger Balance" value={money(data.ledgerBalance)} />
              <SummaryBox label="Purchase Total" value={money(data.purchaseTotal)} />
              <SummaryBox label="Sales Total" value={money(data.salesTotal)} />
              <SummaryBox label="Sales Orders" value={String(data.counts.sales)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Database Coverage</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Core module tables verified by migration 0028.</p>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {[
              ["Account Master", data.counts.accounts],
              ["Ledger", data.counts.ledgers],
              ["Roznamcha", data.counts.roznamcha],
              ["Purchase", data.counts.purchases],
              ["Sales", data.counts.sales],
              ["Shipping", data.counts.shipping]
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between rounded-md border px-3 py-2">
                <span className="font-medium">{label}</span>
                <span className="font-mono text-xs">{value}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="xl:col-span-3">
          <CardHeader>
            <CardTitle>{t(lang, "dash.recent_transactions")}</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Latest live Roznamcha entries from database.</p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-muted-foreground">
                  <tr className="border-b">
                    <th className="py-2 text-start font-semibold">Voucher</th>
                    <th className="py-2 text-start font-semibold">Date</th>
                    <th className="py-2 text-start font-semibold">Type</th>
                    <th className="py-2 text-start font-semibold">Status</th>
                    <th className="py-2 text-start font-semibold">Record ID</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentRoznamcha.length ? (
                    data.recentRoznamcha.map((row) => (
                      <tr key={row.id} className="border-b last:border-b-0">
                        <td className="py-3 font-mono text-xs text-foreground">{row.voucher_no || "-"}</td>
                        <td className="py-3">{row.entry_date || "-"}</td>
                        <td className="py-3">{row.type || "-"}</td>
                        <td className="py-3"><StatusPill value={row.status || "draft"} /></td>
                        <td className="py-3 font-mono text-xs text-muted-foreground">{row.id}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="py-6 text-center text-muted-foreground" colSpan={5}>
                        No Roznamcha entries found yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Enterprise Reporting Hub Banner */}
      <section>
        <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/20 hover:border-primary/40 transition-colors">
          <CardContent className="p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-primary/10 p-3 text-primary">
                <BarChart className="h-8 w-8" />
              </div>
              <div>
                <h3 className="text-xl font-bold tracking-tight text-foreground">Enterprise Reporting Hub</h3>
                <p className="mt-1 text-sm text-muted-foreground max-w-xl">
                  Access comprehensive Audit Trail Logs, Approval Workflows, Financial Analytics, and custom general reports all in one place.
                </p>
              </div>
            </div>
            <Button asChild size="lg" className="shrink-0 shadow-lg shadow-primary/20 w-full sm:w-auto">
              <Link href="/dashboard/reports">
                Open Reports Hub <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function SummaryBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-xl font-semibold">{value}</p>
    </div>
  );
}
