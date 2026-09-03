"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3, TableProperties, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardWidget } from "@/features/dashboard/components/super-admin-dashboard-settings";
import { Th } from "@/components/ui/translated-th";
import { t } from "@/lib/i18n/ui";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";

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
  totalUsers: number;
  isActive: boolean;
};

export type MonthlyFinancialSummary = { name: string; sales: number; purchases: number };

type Props = { countrySummaries: CountryFinancialSummary[]; monthlyFinancials: MonthlyFinancialSummary[] };

function compact(value: number) {
  if (Math.abs(value) >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (Math.abs(value) >= 1e3) return `${(value / 1e3).toFixed(0)}K`;
  return String(value);
}

function EmptyChart({ lang }: { lang: string }) {
  return (
    <div className="grid h-full w-full place-items-center rounded-lg border border-dashed border-border bg-muted/20 text-center">
      <div className="flex flex-col items-center gap-1.5 py-6">
        <BarChart3 className="h-6 w-6 text-muted-foreground/40" />
        <span className="text-xs font-semibold text-muted-foreground">{t(lang, "common.no_records", "No Records Found")}</span>
      </div>
    </div>
  );
}

export function SuperAdminOverviewCharts({ countrySummaries, monthlyFinancials }: Props) {
  const lang = useActiveLanguage();
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const update = () => setIsDark(document.documentElement.classList.contains("dark"));
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const chartData = useMemo(() => monthlyFinancials.map((row) => ({ name: row.name, Sales: row.sales, Purchase: row.purchases })), [monthlyFinancials]);
  const profitData = useMemo(() => chartData.map((row) => ({ name: row.name, Profit: row.Sales - row.Purchase })), [chartData]);
  const hasFinancialRecords = chartData.some((row) => row.Sales !== 0 || row.Purchase !== 0);
  const gridColor = isDark ? "hsl(var(--border))" : "#e2e8f0";
  const tooltipStyle = { background: isDark ? "hsl(var(--card))" : "#fff", border: `1px solid ${gridColor}`, borderRadius: 8, color: isDark ? "hsl(var(--card-foreground))" : "#0f172a", fontSize: 11 };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <DashboardWidget id="salesPurchase">
        <Card className="border-border bg-card shadow-lg">
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm font-bold"><BarChart3 className="h-4 w-4 text-emerald-500" />{t(lang, "dash.sales_vs_purchase", "Sales vs Purchase")}</CardTitle></CardHeader>
          <CardContent>
            <div className="relative h-[250px] w-full">
              {!hasFinancialRecords ? <EmptyChart lang={lang} /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 15, right: 5, left: -25, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} opacity={0.6} />
                  <XAxis dataKey="name" stroke="#94a3b8" tickLine={false} axisLine={false} style={{ fontSize: 10 }} />
                  <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} style={{ fontSize: 10 }} tickFormatter={compact} />
                  <Tooltip formatter={(value) => [`$${Number(value).toLocaleString()}`]} contentStyle={tooltipStyle} />
                  <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: 10, paddingTop: 10 }} />
                  <Bar dataKey="Sales" name={t(lang, "cdash.col_sales", "Sales")} fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Purchase" name={t(lang, "cdash.col_purchase", "Purchase")} fill="#0f62fe" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </DashboardWidget>

      <DashboardWidget id="profitTrend">
        <Card className="border-border bg-card shadow-lg">
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm font-bold"><TrendingUp className="h-4 w-4 text-purple-500" />{t(lang, "dash.profit_trend", "Profit Trend")}</CardTitle></CardHeader>
          <CardContent>
            <div className="relative h-[250px] w-full">
              {!hasFinancialRecords ? <EmptyChart lang={lang} /> : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={profitData} margin={{ top: 15, right: 5, left: -25, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} opacity={0.6} />
                  <XAxis dataKey="name" stroke="#94a3b8" tickLine={false} axisLine={false} style={{ fontSize: 10 }} />
                  <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} style={{ fontSize: 10 }} tickFormatter={compact} />
                  <Tooltip formatter={(value) => [`$${Number(value).toLocaleString()}`]} contentStyle={tooltipStyle} />
                  <Line type="monotone" dataKey="Profit" name={t(lang, "dash.profit", "Profit")} stroke="#8b5cf6" strokeWidth={3} dot={{ fill: "#8b5cf6", r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </DashboardWidget>

      <DashboardWidget id="countryPerformance">
        <Card className="border-border bg-card shadow-lg">
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm font-bold"><TableProperties className="h-4 w-4 text-blue-500" />{t(lang, "dash.country_performance", "Country Performance")}</CardTitle></CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            <div className="max-h-[270px] overflow-auto rounded-xl border border-border/80">
              <table className="w-full min-w-[620px] text-left text-[11px]">
                <thead className="sticky top-0 bg-muted"><tr className="border-b border-border"><Th className="p-2.5">Country</Th><Th className="p-2.5 text-center">Branches</Th><Th className="p-2.5 text-center">Users</Th><Th className="p-2.5 text-right">Sales</Th><Th className="p-2.5 text-right">Purchase</Th><Th className="p-2.5 text-center">Status</Th></tr></thead>
                <tbody className="divide-y divide-border/60">
                  {countrySummaries.length === 0 && <tr><td colSpan={6} className="py-12 text-center font-semibold text-muted-foreground">{t(lang, "common.no_records", "No Records Found")}</td></tr>}
                  {countrySummaries.map((row) => (
                    <tr key={row.id} className="hover:bg-muted/50">
                      <td className="p-2.5 font-semibold"><Link href={`/dashboard/country?countryId=${row.id}`} className="text-blue-500 hover:underline">{row.name}</Link></td>
                      <td className="p-2.5 text-center">{row.totalBranches}</td>
                      <td className="p-2.5 text-center">{row.totalUsers}</td>
                      <td className="p-2.5 text-right">${row.totalSales.toLocaleString()}</td>
                      <td className="p-2.5 text-right">${row.totalPurchases.toLocaleString()}</td>
                      <td className="p-2.5 text-center"><span className={`inline-flex rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${row.isActive ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600" : "border-slate-500/20 bg-slate-500/10 text-slate-500"}`}>{row.isActive ? t(lang, "common.active", "Active") : t(lang, "common.inactive", "Inactive")}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </DashboardWidget>
    </div>
  );
}
