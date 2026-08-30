"use client";

import React, { useMemo, useState, useEffect } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import {
  GitBranch,
  Users,
  Wallet,
  Database,
  Banknote,
  ShoppingCart,
  TrendingUp,
  Activity,
  ArrowRight
} from "lucide-react";
import { Inbox } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Th } from "@/components/ui/translated-th";
import { t } from "@/lib/i18n/ui";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";

const CHART_COLORS = ["#2563eb", "#3b82f6", "#06b6d4", "#f59e0b", "#10b981", "#6366f1"];

function EmptyChartState({ message, height }: { message: string; height: number }) {
  return (
    <div
      className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/20 text-center"
      style={{ height }}
    >
      <Inbox className="h-6 w-6 text-muted-foreground" />
      <p className="px-4 text-[11px] font-semibold text-muted-foreground">{message}</p>
    </div>
  );
}

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

type CountryDashboardOverviewProps = {
  data: {
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
    recentRoznamcha: RecentEntry[];
    cityBranches: CityBranchData[];
    branchSummaries?: BranchFinancialSummary[];
  };
};

function formatMoney(value: number, currency = "USD") {
  return `${currency} ${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0
  }).format(value || 0)}`;
}

export function CountryDashboardOverview({ data }: CountryDashboardOverviewProps) {
  const lang = useActiveLanguage();
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);
  const tt = (key: string, fallback: string) => t(lang, key as never, fallback);
  const currency = data.currency || "USD";
  const [isDark, setIsDark] = useState(false);
  // render recharts only after mount — a 0×0 ResponsiveContainer measure on the
  // server/first paint otherwise leaves a permanently blank SVG.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const updateTheme = () => {
      setIsDark(document.documentElement.classList.contains("dark"));
    };
    updateTheme();
    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  // Real per-branch sales/purchase figures (no fabricated monthly series, no mock fallbacks).
  // When there is no real branch financial data the charts render an empty state instead of
  // inventing a trend, so cards, charts and the table always reconcile on the same numbers.
  const branchChartData = useMemo(() => {
    if (data.branchSummaries?.length) {
      return data.branchSummaries.map((branch) => ({
        name: branch.name,
        sales: Math.max(0, Math.round(branch.totalSales)),
        purchases: Math.max(0, Math.round(branch.totalPurchase))
      }));
    }
    return data.cityBranches.map((branch) => ({ name: branch.name, sales: 0, purchases: 0 }));
  }, [data.branchSummaries, data.cityBranches]);
  const salesChartEmpty = branchChartData.every((d) => !d.sales);
  const purchasesChartEmpty = branchChartData.every((d) => !d.purchases);

  // Donut chart branch sales distribution
  const branchesPieData = useMemo(() => {
    if (data.branchSummaries?.length) {
      return data.branchSummaries.map((branch) => ({
        name: branch.name,
        value: Math.max(0, Math.round(branch.totalSales))
      }));
    }
    return data.cityBranches.map((branch) => ({
      name: branch.name,
      value: 0
    }));
  }, [data.branchSummaries, data.cityBranches]);

  // Country performance sub-branches mapping
  const branchPerformanceList = useMemo(() => {
    if (data.branchSummaries?.length) {
      return data.branchSummaries.map((branch) => ({
        name: branch.name,
        code: branch.code,
        branchCurrency: branch.currency || currency,
        sales: branch.totalSales,
        purchases: branch.totalPurchase,
        debit: branch.totalDebit,
        credit: branch.totalCredit,
        balance: branch.ledgerBalance,
        status: "Active"
      }));
    }

    return data.cityBranches.map((branch) => ({
      name: branch.name,
      code: branch.code,
      branchCurrency: currency,
      sales: 0,
      purchases: 0,
      debit: 0,
      credit: 0,
      balance: 0,
      status: branch.status === "active" ? "Active" : "Inactive"
    }));
  }, [data.branchSummaries, data.cityBranches, currency]);

  // 8 Stats metrics
  const stats = [
    { labelKey: "dash.total_branches", label: "Total Branches", value: String(data.branchesCount), icon: <GitBranch className="h-4.5 w-4.5 text-blue-500" />, link: "/dashboard/settings/locations" },
    { labelKey: "dash.total_users", label: "Total Users", value: String(data.usersCount), icon: <Users className="h-4.5 w-4.5 text-indigo-500" />, link: "#" },
    { labelKey: "cdash.total_accounts", label: "Total Accounts", value: String(data.accountsCount), icon: <Wallet className="h-4.5 w-4.5 text-emerald-500" />, link: "#" },
    { labelKey: "cdash.total_products", label: "Total Products", value: String(data.productsCount), icon: <Database className="h-4.5 w-4.5 text-cyan-500" />, link: "/dashboard/settings/management/goods" },
    { labelKey: "cdash.total_stock_value", label: "Total Stock Value", value: formatMoney(data.stockValueTotal, currency), icon: <Banknote className="h-4.5 w-4.5 text-teal-500" />, link: "#" },
    { labelKey: "cdash.total_purchases", label: "Total Purchases", value: formatMoney(data.purchaseTotal, currency), icon: <ShoppingCart className="h-4.5 w-4.5 text-rose-500" />, link: "#" },
    { labelKey: "dash.total_sales", label: "Total Sales", value: formatMoney(data.salesTotal, currency), icon: <TrendingUp className="h-4.5 w-4.5 text-amber-500" />, link: "#" },
    { labelKey: "dash.profit_loss", label: "Profit / Loss", value: formatMoney(data.profitLossTotal, currency), icon: <Activity className="h-4.5 w-4.5 text-fuchsia-500" />, link: "#", highlight: true }
  ];

  return (
    <div className="space-y-6 text-foreground" dir={isRtl ? "rtl" : "ltr"}>
      {/* 8 Card Stats Grid */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        {stats.map((item) => (
          <div
            key={item.labelKey}
            className="bg-card text-card-foreground border border-border hover:border-border/80 p-4 rounded-2xl flex items-center justify-between shadow-lg transition-transform hover:-translate-y-0.5 duration-200"
          >
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{tt(item.labelKey, item.label)}</span>
              <div className={`text-lg font-black mt-2 leading-none ${item.highlight ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"}`}>
                {item.value}
              </div>
              <a href={item.link} className="text-[9px] font-semibold text-blue-500 dark:text-blue-400 hover:underline mt-2.5 inline-block">
                {tt("cdash.view_details", "View Details")}
              </a>
            </div>
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-muted border border-border shrink-0">
              {item.icon}
            </span>
          </div>
        ))}
      </div>

      {/* Recharts Graphics visual rows */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Sales Overview Area chart */}
        <Card className="border-border bg-card text-card-foreground shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-500" />
              {tt("dash.sales_overview", "Sales Overview")}
            </CardTitle>
            <CardDescription className="text-[9px] font-semibold text-muted-foreground uppercase">{tt("cdash.sales_by_branch", "Sales by Branch")} · {currency}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[200px] w-full">
              {!mounted ? null : salesChartEmpty ? (
                <EmptyChartState message={tt("common.no_data", "No data available")} height={200} />
              ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={branchChartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "hsl(var(--border))" : "#e2e8f0"} opacity={0.6} />
                  <XAxis dataKey="name" stroke="#94a3b8" tickLine={false} axisLine={false} style={{ fontSize: 9 }} />
                  <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} style={{ fontSize: 9 }} tickFormatter={(val) => `${val / 1000}k`} />
                  <Tooltip
                    formatter={(val) => formatMoney(Number(val), currency)}
                    contentStyle={{
                      background: isDark ? "hsl(var(--card))" : "#fff",
                      border: isDark ? "1px solid hsl(var(--border))" : "1px solid #e2e8f0",
                      borderRadius: 8,
                      color: isDark ? "hsl(var(--card-foreground))" : "#0f172a",
                      fontSize: 10
                    }}
                  />
                  <Area type="monotone" dataKey="sales" stroke="#2563eb" strokeWidth={2.5} fillOpacity={1} fill="url(#salesGrad)" name={tt("cdash.col_sales", "Sales")} />
                </AreaChart>
              </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Purchase Overview Area chart */}
        <Card className="border-border bg-card text-card-foreground shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-amber-500" />
              {tt("cdash.purchase_overview", "Purchase Overview")}
            </CardTitle>
            <CardDescription className="text-[9px] font-semibold text-muted-foreground uppercase">{tt("cdash.purchases_by_branch", "Purchases by Branch")} · {currency}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[200px] w-full">
              {!mounted ? null : purchasesChartEmpty ? (
                <EmptyChartState message={tt("common.no_data", "No data available")} height={200} />
              ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={branchChartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="purchGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "hsl(var(--border))" : "#e2e8f0"} opacity={0.6} />
                  <XAxis dataKey="name" stroke="#94a3b8" tickLine={false} axisLine={false} style={{ fontSize: 9 }} />
                  <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} style={{ fontSize: 9 }} tickFormatter={(val) => `${val / 1000}k`} />
                  <Tooltip
                    formatter={(val) => formatMoney(Number(val), currency)}
                    contentStyle={{
                      background: isDark ? "hsl(var(--card))" : "#fff",
                      border: isDark ? "1px solid hsl(var(--border))" : "1px solid #e2e8f0",
                      borderRadius: 8,
                      color: isDark ? "hsl(var(--card-foreground))" : "#0f172a",
                      fontSize: 10
                    }}
                  />
                  <Area type="monotone" dataKey="purchases" stroke="#d97706" strokeWidth={2.5} fillOpacity={1} fill="url(#purchGrad)" name={tt("cdash.col_purchases", "Purchases")} />
                </AreaChart>
              </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top Branches Donut */}
        <Card className="border-border bg-card text-card-foreground shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-cyan-500" />
              {tt("cdash.top_branches", "Top Branches by Sales")}
            </CardTitle>
            <CardDescription className="text-[9px] font-semibold text-muted-foreground uppercase">{tt("cdash.sales_distribution", "Sales distribution")} · {currency}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center">
            <div className="h-[140px] w-full flex justify-center items-center relative">
              {!mounted ? null : branchesPieData.every((b) => !b.value) ? (
                <EmptyChartState message={tt("common.no_data", "No data available")} height={140} />
              ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={branchesPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={58}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {branchesPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val) => formatMoney(Number(val), currency)}
                    contentStyle={{
                      background: isDark ? "hsl(var(--card))" : "#fff",
                      border: isDark ? "1px solid hsl(var(--border))" : "1px solid #e2e8f0",
                      borderRadius: 8,
                      color: isDark ? "hsl(var(--card-foreground))" : "#0f172a",
                      fontSize: 9
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              )}
            </div>
            {/* Legend layout */}
            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 w-full text-[9px] text-muted-foreground">
              {branchesPieData.slice(0, 4).map((entry, index) => (
                <div key={entry.name} className="flex items-center gap-1.5 truncate">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} />
                  <span className="truncate">{entry.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sub-branches Country performance table card */}
      <Card className="border-border bg-card text-card-foreground shadow-lg">
        <CardHeader className="pb-3 border-b border-border">
          <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
            <Database className="h-4 w-4 text-emerald-500" />
            {tt("cdash.sub_branch_performance", "Sub-Branch Performance")}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] text-start">
              <thead>
                <tr className="bg-muted/40 text-[10px] uppercase font-bold text-muted-foreground">
                  <Th className="px-4 py-3 text-start">{tt("cdash.col_branch_name", "Branch Name")}</Th>
                  <Th className="px-4 py-3 text-start">{tt("cdash.col_code", "Code")}</Th>
                  <Th className="px-4 py-3 text-start">{tt("report.col_currency", "Currency")}</Th>
                  <Th className="px-4 py-3 text-end">{tt("cdash.col_sales", "Sales")}</Th>
                  <Th className="px-4 py-3 text-end">{tt("cdash.col_purchases", "Purchases")}</Th>
                  <Th className="px-4 py-3 text-end">{tt("cdash.col_debit", "Debit")}</Th>
                  <Th className="px-4 py-3 text-end">{tt("cdash.col_credit", "Credit")}</Th>
                  <Th className="px-4 py-3 text-end">{tt("cdash.col_balance", "Balance")}</Th>
                  <Th className="px-4 py-3 text-center">{tt("report.col_status", "Status")}</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {branchPerformanceList.map((branch) => (
                  <tr key={branch.name} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-semibold text-foreground/90">{branch.name}</td>
                    <td className="px-4 py-3 font-mono text-[10px] text-muted-foreground">{branch.code}</td>
                    <td className="px-4 py-3 font-bold text-muted-foreground">{branch.branchCurrency}</td>
                    <td className="px-4 py-3 text-end font-bold text-emerald-600 dark:text-emerald-400">{formatMoney(branch.sales, branch.branchCurrency)}</td>
                    <td className="px-4 py-3 text-end text-muted-foreground">{formatMoney(branch.purchases, branch.branchCurrency)}</td>
                    <td className="px-4 py-3 text-end text-rose-500 dark:text-rose-400">{formatMoney(branch.debit, branch.branchCurrency)}</td>
                    <td className="px-4 py-3 text-end text-emerald-600 dark:text-emerald-400">{formatMoney(branch.credit, branch.branchCurrency)}</td>
                    <td className="px-4 py-3 text-end font-bold text-foreground">{formatMoney(branch.balance, branch.branchCurrency)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        {branch.status === "Active" ? tt("common.active", "Active") : tt("common.inactive", "Inactive")}
                      </span>
                    </td>
                  </tr>
                ))}
                {!branchPerformanceList.length && (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">{tt("cdash.no_registered_branches", "No registered branches found.")}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
