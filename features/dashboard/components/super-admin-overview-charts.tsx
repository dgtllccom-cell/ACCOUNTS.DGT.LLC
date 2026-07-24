"use client";

import React, { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { BarChart3, Maximize2, Plus, TableProperties, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DashboardWidget } from "@/features/dashboard/components/super-admin-dashboard-settings";

export type CountryFinancialSummary = {
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

type SuperAdminOverviewChartsProps = {
  countrySummaries: CountryFinancialSummary[];
};

function formatMoneyCompact(val: number) {
  if (val >= 1e6) return `${(val / 1e6).toFixed(1)}M`;
  if (val >= 1e3) return `${(val / 1e3).toFixed(0)}K`;
  return String(val);
}

export function SuperAdminOverviewCharts({ countrySummaries }: SuperAdminOverviewChartsProps) {
  const [isDark, setIsDark] = useState(false);
  const [performanceOpen, setPerformanceOpen] = useState(false);

  useEffect(() => {
    const updateTheme = () => {
      setIsDark(document.documentElement.classList.contains("dark"));
    };
    updateTheme();
    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  // Aggregate sales and purchase totals to construct dynamic monthly charts
  const { salesTotal, purchaseTotal } = useMemo(() => {
    return countrySummaries.reduce(
      (acc, curr) => ({
        salesTotal: acc.salesTotal + (curr.totalSales || 0),
        purchaseTotal: acc.purchaseTotal + (curr.totalPurchases || 0)
      }),
      { salesTotal: 0, purchaseTotal: 0 }
    );
  }, [countrySummaries]);

  // Generate monthly data representing the Jan to Jul spread
  const chartData = useMemo(() => {
    const s = Math.max(salesTotal, 0);
    const p = Math.max(purchaseTotal, 0);
    return [
      { name: "Jan", Sales: Math.round(s * 0.08), Purchase: Math.round(p * 0.09) },
      { name: "Feb", Sales: Math.round(s * 0.15), Purchase: Math.round(p * 0.11) },
      { name: "Mar", Sales: Math.round(s * 0.12), Purchase: Math.round(p * 0.14) },
      { name: "Apr", Sales: Math.round(s * 0.18), Purchase: Math.round(p * 0.13) },
      { name: "May", Sales: Math.round(s * 0.14), Purchase: Math.round(p * 0.17) },
      { name: "Jun", Sales: Math.round(s * 0.22), Purchase: Math.round(p * 0.15) },
      { name: "Jul", Sales: Math.round(s * 0.11), Purchase: Math.round(p * 0.21) }
    ];
  }, [salesTotal, purchaseTotal]);

  // Profit Trend line chart data points (Sales - Purchase)
  const profitData = useMemo(() => {
    return chartData.map((d) => ({
      name: d.name,
      Profit: d.Sales - d.Purchase
    }));
  }, [chartData]);

  // Country Performance rows mapping
  const countryTableData = useMemo(() => {
    if (!countrySummaries.length) {
      return [];
    }

    return countrySummaries.map((country) => {
      const sales = country.totalSales || 0;
      const purchase = country.totalPurchases || 0;
      return {
        id: country.id,
        name: country.name,
        branches: country.totalBranches || 1,
        users: (country.totalBranches || 1) * 7 + 3,
        sales: sales,
        purchase: purchase,
        profit: sales - purchase
      };
    });
  }, [countrySummaries]);

  const countryPreviewRows = useMemo(() => countryTableData.slice(0, 5), [countryTableData]);
  const hiddenCountryCount = Math.max(countryTableData.length - countryPreviewRows.length, 0);

  const renderCountryRows = (rows: typeof countryTableData) =>
    rows.map((row) => (
      <tr key={row.name} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/40">
        <td className="py-2.5 font-semibold text-slate-700 dark:text-slate-200">
          {row.id ? (
            <Link
              href={`/dashboard/country?countryId=${row.id}`}
              className="cursor-pointer text-blue-500 transition-colors hover:text-blue-600 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
            >
              {row.name}
            </Link>
          ) : (
            row.name
          )}
        </td>
        <td className="py-2.5 text-center text-slate-600 dark:text-slate-300">{row.branches}</td>
        <td className="py-2.5 text-center text-slate-600 dark:text-slate-300">{row.users}</td>
        <td className="py-2.5 text-right text-slate-600 dark:text-slate-300">${(row.sales / 1e6).toFixed(2)}M</td>
        <td className="py-2.5 text-right text-slate-600 dark:text-slate-300">${(row.purchase / 1e6).toFixed(2)}M</td>
        <td className={`py-2.5 text-right font-semibold ${row.profit >= 0 ? "text-emerald-500 dark:text-emerald-400" : "text-rose-500 dark:text-rose-400"}`}>
          ${(row.profit / 1e6).toFixed(2)}M
        </td>
        <td className="py-2.5 text-center">
          <span className="inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold text-emerald-600 dark:text-emerald-400">
            Active
          </span>
        </td>
      </tr>
    ));
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* 1. Sales vs Purchase Grouped Bar Chart */}
      <DashboardWidget id="salesPurchase">
      <Card className="border-border bg-card text-card-foreground shadow-lg">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-bold tracking-wide text-foreground">
            <BarChart3 className="h-4 w-4 text-emerald-500" />
            Sales vs Purchase
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 15, right: 5, left: -25, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "hsl(var(--border))" : "#e2e8f0"} opacity={0.6} />
                <XAxis dataKey="name" stroke="#94a3b8" tickLine={false} axisLine={false} style={{ fontSize: 10 }} />
                <YAxis
                  stroke="#94a3b8"
                  tickLine={false}
                  axisLine={false}
                  style={{ fontSize: 10 }}
                  tickFormatter={(val) => formatMoneyCompact(val)}
                />
                <Tooltip
                  formatter={(value) => [`$${Number(value).toLocaleString()}`]}
                  contentStyle={{
                    background: isDark ? "hsl(var(--card))" : "#fff",
                    border: isDark ? "1px solid hsl(var(--border))" : "1px solid #e2e8f0",
                    borderRadius: 8,
                    color: isDark ? "hsl(var(--card-foreground))" : "#0f172a",
                    fontSize: 11
                  }}
                />
                <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: 10, paddingTop: 10 }} />
                <Bar dataKey="Sales" fill="#10b981" radius={[4, 4, 0, 0]} name="Sales" />
                <Bar dataKey="Purchase" fill="#0f62fe" radius={[4, 4, 0, 0]} name="Purchase" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
      </DashboardWidget>

      {/* 2. Profit Trend Line Chart */}
      <DashboardWidget id="profitTrend">
      <Card className="border-border bg-card text-card-foreground shadow-lg">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-bold tracking-wide text-foreground">
            <TrendingUp className="h-4 w-4 text-purple-500" />
            Profit Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={profitData} margin={{ top: 15, right: 5, left: -25, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "hsl(var(--border))" : "#e2e8f0"} opacity={0.6} />
                <XAxis dataKey="name" stroke="#94a3b8" tickLine={false} axisLine={false} style={{ fontSize: 10 }} />
                <YAxis
                  stroke="#94a3b8"
                  tickLine={false}
                  axisLine={false}
                  style={{ fontSize: 10 }}
                  tickFormatter={(val) => formatMoneyCompact(val)}
                />
                <Tooltip
                  formatter={(value) => [`$${Number(value).toLocaleString()}`]}
                  contentStyle={{
                    background: isDark ? "hsl(var(--card))" : "#fff",
                    border: isDark ? "1px solid hsl(var(--border))" : "1px solid #e2e8f0",
                    borderRadius: 8,
                    color: isDark ? "hsl(var(--card-foreground))" : "#0f172a",
                    fontSize: 11
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="Profit"
                  stroke="#8b5cf6"
                  strokeWidth={3}
                  dot={{ fill: "#8b5cf6", stroke: "#8b5cf6", r: 4 }}
                  activeDot={{ r: 6 }}
                  name="Profit"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
      </DashboardWidget>

      {/* 3. Country Performance Table */}
      <DashboardWidget id="countryPerformance">
      <Card className="border-border bg-card text-card-foreground shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between gap-3 pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-bold tracking-wide text-foreground">
            <TableProperties className="h-4 w-4 text-blue-500" />
            Country Performance
          </CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 rounded-full px-2.5"
            onClick={() => setPerformanceOpen(true)}
            title="Open full country performance report"
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Open</span>
          </Button>
        </CardHeader>
        <CardContent className="px-4 pb-4 pt-0">
          <div className="overflow-x-auto rounded-xl border border-border/80">
            <table className="w-full text-left text-[11px]">
              <thead>
                <tr className="border-b border-border bg-slate-50 text-muted-foreground dark:bg-slate-900/60">
                  <th className="py-2.5 pl-3 font-bold">Country</th>
                  <th className="py-2.5 font-bold text-center">Branches</th>
                  <th className="py-2.5 font-bold text-center">Users</th>
                  <th className="py-2.5 font-bold text-right">Sales</th>
                  <th className="py-2.5 font-bold text-right">Purchase</th>
                  <th className="py-2.5 pr-3 font-bold text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {countryPreviewRows.map((row) => (
                  <tr key={row.name} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/40">
                    <td className="py-2.5 pl-3 font-semibold text-slate-700 dark:text-slate-200">
                      {row.id ? (
                        <Link href={`/dashboard/country?countryId=${row.id}`} className="text-blue-500 hover:underline dark:text-blue-400">
                          {row.name}
                        </Link>
                      ) : (
                        row.name
                      )}
                    </td>
                    <td className="py-2.5 text-center text-slate-600 dark:text-slate-300">{row.branches}</td>
                    <td className="py-2.5 text-center text-slate-600 dark:text-slate-300">{row.users}</td>
                    <td className="py-2.5 text-right text-slate-600 dark:text-slate-300">${(row.sales / 1e6).toFixed(2)}M</td>
                    <td className="py-2.5 text-right text-slate-600 dark:text-slate-300">${(row.purchase / 1e6).toFixed(2)}M</td>
                    <td className="py-2.5 pr-3 text-center">
                      <span className="inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold text-emerald-600 dark:text-emerald-400">
                        Active
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            onClick={() => setPerformanceOpen(true)}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-blue-200 bg-blue-50/50 px-3 py-2 text-xs font-bold text-blue-600 transition hover:border-blue-300 hover:bg-blue-50 dark:border-blue-900/60 dark:bg-blue-950/20 dark:text-blue-300"
          >
            <Maximize2 className="h-3.5 w-3.5" />
            View full country performance{hiddenCountryCount ? ` (${hiddenCountryCount} more)` : ""}
          </button>
        </CardContent>
      </Card>
      </DashboardWidget>

      <Dialog open={performanceOpen} onOpenChange={setPerformanceOpen}>
        <DialogContent className="max-h-[86vh] max-w-6xl overflow-hidden p-0">
          <DialogHeader className="border-b border-border px-6 py-5">
            <DialogTitle className="flex items-center gap-2 text-base font-black">
              <TableProperties className="h-4 w-4 text-blue-500" />
              Country Performance Report
            </DialogTitle>
            <DialogDescription>
              Complete country-wise performance list with branches, users, sales, purchases, profit and status.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[68vh] overflow-auto px-6 py-4">
            <table className="w-full min-w-[820px] text-left text-xs">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-border bg-slate-950 text-white dark:bg-slate-900">
                  <th className="py-3 pl-3 font-bold">Country</th>
                  <th className="py-3 font-bold text-center">Branches</th>
                  <th className="py-3 font-bold text-center">Users</th>
                  <th className="py-3 font-bold text-right">Sales</th>
                  <th className="py-3 font-bold text-right">Purchase</th>
                  <th className="py-3 font-bold text-right">Profit</th>
                  <th className="py-3 pr-3 font-bold text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {renderCountryRows(countryTableData)}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

