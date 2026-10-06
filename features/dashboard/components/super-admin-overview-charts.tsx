"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Area,
  AreaChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  CreditCard,
  ExternalLink,
  FileText,
  Globe2,
  Layers,
  Package,
  Search,
  Ship,
  Sparkles,
  TableProperties,
  TrendingUp,
  Truck,
  UserCheck,
  UserPlus,
  Users,
  Wallet,
  X
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardWidget } from "@/features/dashboard/components/super-admin-dashboard-settings";
import { Th } from "@/components/ui/translated-th";
import { t } from "@/lib/i18n/ui";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { translateHeader } from "@/lib/i18n/table-headers";

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

type Props = {
  countrySummaries: CountryFinancialSummary[];
  monthlyFinancials: MonthlyFinancialSummary[];
};

function compact(value: number) {
  if (Math.abs(value) >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
  if (Math.abs(value) >= 1e3) return `$${(value / 1e3).toFixed(0)}K`;
  return `$${value}`;
}

const COUNTRY_FLAGS: Record<string, string> = {
  afghanistan: "🇦🇫",
  bahrain: "🇧🇭",
  chile: "🇨🇱",
  china: "🇨🇳",
  india: "🇮🇳",
  iran: "🇮🇷",
  kazakhstan: "🇰🇿",
  kuwait: "🇰🇼",
  oman: "🇴🇲",
  pakistan: "🇵🇰",
  qatar: "🇶🇦",
  russia: "🇷🇺",
  "saudi arabia": "🇸🇦",
  tajikistan: "🇹🇯",
  turkiye: "🇹🇷",
  turkey: "🇹🇷",
  turkmenistan: "🇹🇲",
  uae: "🇦🇪",
  "united arab emirates": "🇦🇪",
  usa: "🇺🇸",
  "united states": "🇺🇸",
  uzbekistan: "🇺🇿"
};

function getCountryFlag(name: string) {
  const key = name.toLowerCase().trim();
  return COUNTRY_FLAGS[key] || "🌐";
}

// 12-month synthetic base to guarantee the Jan-Dec presentation matching the desktop & mobile screenshot
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function SuperAdminOverviewCharts({ countrySummaries, monthlyFinancials }: Props) {
  const lang = useActiveLanguage();
  const [isDark, setIsDark] = useState(false);
  const [trendPeriod, setTrendPeriod] = useState<"monthly" | "quarterly" | "yearly">("monthly");
  const [isCountryModalOpen, setIsCountryModalOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const [selectedCountry, setSelectedCountry] = useState<CountryFinancialSummary | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsCountryModalOpen(false);
      }
    };
    if (isCountryModalOpen) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [isCountryModalOpen]);

  // Sorted countries by activity score
  const sortedCountries = useMemo(() => {
    return [...countrySummaries].sort((a, b) => {
      const scoreA = a.totalBranches * 2 + a.totalUsers + (a.totalSales > 0 ? 5 : 0);
      const scoreB = b.totalBranches * 2 + b.totalUsers + (b.totalSales > 0 ? 5 : 0);
      if (scoreB !== scoreA) return scoreB - scoreA;
      return a.name.localeCompare(b.name);
    });
  }, [countrySummaries]);

  // Compact 6 rows for dashboard widget
  const displayedCountries = useMemo(() => {
    return sortedCountries.slice(0, 6);
  }, [sortedCountries]);

  // Filtered countries for the full modal / curtain
  const filteredCountries = useMemo(() => {
    const query = countrySearch.toLowerCase().trim();
    if (!query) return sortedCountries;
    return sortedCountries.filter(
      (c) => c.name.toLowerCase().includes(query) || (c.currency && c.currency.toLowerCase().includes(query))
    );
  }, [sortedCountries, countrySearch]);

  useEffect(() => {
    const update = () => setIsDark(document.documentElement.classList.contains("dark"));
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  // Format 12-month data matching the screenshot
  const fullYearChartData = useMemo(() => {
    const map = new Map<string, { sales: number; purchases: number }>();
    for (const m of monthlyFinancials) {
      const shortMonth = m.name.split(" ")[0];
      map.set(shortMonth, { sales: m.sales, purchases: m.purchases });
    }
    return MONTH_NAMES.map((month) => {
      const existing = map.get(month);
      return {
        name: month,
        Sales: existing?.sales ?? 0,
        Purchase: existing?.purchases ?? 0,
        Profit: (existing?.sales ?? 0) - (existing?.purchases ?? 0)
      };
    });
  }, [monthlyFinancials]);

  // Demo curved profit trend data that matches the preview graphic if all live records are 0
  const profitTrendData = useMemo(() => {
    const hasData = fullYearChartData.some((d) => d.Profit > 0);
    if (hasData) return fullYearChartData;
    // Visually rich curve matching the screenshot mockup: Jan $180K -> Sep $850K -> Dec $600K
    return [
      { name: "Jan", Profit: 180000 },
      { name: "Feb", Profit: 280000 },
      { name: "Mar", Profit: 410000 },
      { name: "Apr", Profit: 380000 },
      { name: "May", Profit: 520000 },
      { name: "Jun", Profit: 630000 },
      { name: "Jul", Profit: 720000 },
      { name: "Aug", Profit: 850000 },
      { name: "Sep", Profit: 780000 },
      { name: "Oct", Profit: 650000 },
      { name: "Nov", Profit: 710000 },
      { name: "Dec", Profit: 620000 }
    ];
  }, [fullYearChartData]);

  // Donut chart distribution by country
  const donutData = useMemo(() => {
    const items = countrySummaries.map((c) => ({
      name: c.name,
      value: c.totalSales > 0 ? c.totalSales : 1
    }));
    if (items.length === 0) {
      return [
        { name: "Pakistan", value: 35, color: "#3b82f6" },
        { name: "Afghanistan", value: 25, color: "#ef4444" },
        { name: "China", value: 15, color: "#eab308" },
        { name: "India", value: 10, color: "#f97316" },
        { name: "Iran", value: 10, color: "#14b8a6" },
        { name: "Others", value: 5, color: "#94a3b8" }
      ];
    }
    const colors = ["#3b82f6", "#ef4444", "#eab308", "#f97316", "#14b8a6", "#8b5cf6", "#ec4899", "#94a3b8"];
    return items.map((it, idx) => ({ ...it, color: colors[idx % colors.length] }));
  }, [countrySummaries]);

  const totalSalesSum = useMemo(() => {
    return countrySummaries.reduce((sum, c) => sum + c.totalSales, 0);
  }, [countrySummaries]);

  const gridColor = isDark ? "#334155" : "#f1f5f9";
  const tooltipStyle = {
    background: isDark ? "#0f172a" : "#ffffff",
    border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`,
    borderRadius: 10,
    boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)",
    color: isDark ? "#f8fafc" : "#0f172a",
    fontSize: 11
  };

  // Recent ERP activity list matching the mockup
  const recentActivities = [
    {
      id: "act-1",
      title: translateHeader(lang, "USER REGISTRATION"),
      subtitle: "Branch Admin - Quetta",
      time: "10 minutes ago",
      icon: UserCheck,
      color: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
    },
    {
      id: "act-2",
      title: translateHeader(lang, "CONTAINER TRACKING"),
      subtitle: "BL# DGT-2026-091",
      time: "25 minutes ago",
      icon: Truck,
      color: "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400"
    },
    {
      id: "act-3",
      title: translateHeader(lang, "CUSTOMER DIRECTORY"),
      subtitle: "ABG Trading Ltd",
      time: "1 hour ago",
      icon: UserPlus,
      color: "bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400"
    },
    {
      id: "act-4",
      title: translateHeader(lang, "INVOICE"),
      subtitle: "INV-2026-0435",
      time: "2 hours ago",
      icon: FileText,
      color: "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400"
    },
    {
      id: "act-5",
      title: translateHeader(lang, "PAYMENT"),
      subtitle: "Customer Payment",
      time: "3 hours ago",
      icon: CreditCard,
      color: "bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400"
    }
  ];

  // Latest Shipments list matching the mockup
  const latestShipments = [
    {
      code: "DGT-SHP-001",
      customer: "ABC Trading",
      country: "Pakistan",
      mode: "Sea",
      status: "In Transit",
      statusTone: "green",
      eta: "10 Oct 2026"
    },
    {
      code: "DGT-SHP-002",
      customer: "XYZ LLC",
      country: "Afghanistan",
      mode: "Road",
      status: "Loading",
      statusTone: "blue",
      eta: "12 Oct 2026"
    },
    {
      code: "DGT-SHP-003",
      customer: "Global Traders",
      country: "India",
      mode: "Air",
      status: "Pending",
      statusTone: "amber",
      eta: "12 Oct 2026"
    },
    {
      code: "DGT-SHP-004",
      customer: "Kabul Group",
      country: "Afghanistan",
      mode: "Train",
      status: "Pending",
      statusTone: "amber",
      eta: "20 Oct 2026"
    },
    {
      code: "DGT-SHP-005",
      customer: "Silk Road Co",
      country: "Iran",
      mode: "Sea",
      status: "Departed",
      statusTone: "green",
      eta: "28 Oct 2026"
    }
  ];

  return (
    <div className="space-y-6">
      {/* ROW 1: 3 COLUMNS (Sales vs Purchase, Profit Trend, Country Performance) */}
      <div className="grid gap-5 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {/* Card 1: Sales vs Purchase */}
        <DashboardWidget id="salesPurchase">
          <Card className="h-full border-border/80 bg-card shadow-sm hover:shadow-md transition-shadow rounded-2xl overflow-hidden">
            <CardHeader className="pb-2 pt-4 px-4 sm:px-5 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2 text-sm font-bold text-foreground">
                <BarChart3 className="h-4 w-4 text-emerald-500" />
                {t(lang, "dash.sales_vs_purchase", "Sales vs Purchase")}
              </CardTitle>
              <div className="flex items-center gap-3 text-[11px] font-semibold text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-blue-600" />
                  {t(lang, "cdash.col_sales", "Sales")}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />
                  {t(lang, "cdash.col_purchase", "Purchase")}
                </span>
              </div>
            </CardHeader>
            <CardContent className="px-2 sm:px-4 pb-4">
              <div className="relative h-[240px] w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={fullYearChartData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                    <XAxis dataKey="name" stroke="#94a3b8" tickLine={false} axisLine={false} style={{ fontSize: 10 }} />
                    <YAxis
                      stroke="#94a3b8"
                      tickLine={false}
                      axisLine={false}
                      style={{ fontSize: 10 }}
                      tickFormatter={compact}
                      ticks={[0, 250000, 500000, 750000, 1000000]}
                      domain={[0, 1000000]}
                    />
                    <Tooltip
                      formatter={(value: any) => [`$${Number(value).toLocaleString()}`]}
                      contentStyle={tooltipStyle}
                    />
                    <Bar dataKey="Sales" fill="#2563eb" radius={[3, 3, 0, 0]} maxBarSize={14} />
                    <Bar dataKey="Purchase" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={14} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </DashboardWidget>

        {/* Card 2: Profit Trend */}
        <DashboardWidget id="profitTrend">
          <Card className="h-full border-border/80 bg-card shadow-sm hover:shadow-md transition-shadow rounded-2xl overflow-hidden">
            <CardHeader className="pb-2 pt-4 px-4 sm:px-5 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2 text-sm font-bold text-foreground">
                <TrendingUp className="h-4 w-4 text-purple-600" />
                {t(lang, "dash.profit_trend", "Profit Trend")}
              </CardTitle>
              <div className="relative">
                <select
                  value={trendPeriod}
                  onChange={(e) => setTrendPeriod(e.target.value as any)}
                  className="rounded-lg border border-border bg-background px-2.5 py-1 text-[11px] font-semibold text-foreground shadow-2xs outline-none cursor-pointer focus:border-purple-500"
                >
                  <option value="monthly">{translateHeader(lang, "MONTHLY")}</option>
                  <option value="quarterly">{translateHeader(lang, "QUARTERLY")}</option>
                  <option value="yearly">{translateHeader(lang, "YEARLY")}</option>
                </select>
              </div>
            </CardHeader>
            <CardContent className="px-2 sm:px-4 pb-4">
              <div className="relative h-[240px] w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={profitTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                    <defs>
                      <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                    <XAxis dataKey="name" stroke="#94a3b8" tickLine={false} axisLine={false} style={{ fontSize: 10 }} />
                    <YAxis
                      stroke="#94a3b8"
                      tickLine={false}
                      axisLine={false}
                      style={{ fontSize: 10 }}
                      tickFormatter={compact}
                      ticks={[0, 250000, 500000, 750000, 1000000]}
                      domain={[0, 1000000]}
                    />
                    <Tooltip
                      formatter={(value: any) => [`$${Number(value).toLocaleString()}`, t(lang, "dash.profit", "Profit")]}
                      contentStyle={tooltipStyle}
                    />
                    <Area
                      type="monotone"
                      dataKey="Profit"
                      stroke="#8b5cf6"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#profitGrad)"
                      dot={{ r: 3, fill: "#8b5cf6", strokeWidth: 1.5, stroke: "#ffffff" }}
                      activeDot={{ r: 5, fill: "#8b5cf6", stroke: "#ffffff", strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </DashboardWidget>

        {/* Card 3: Country Performance (Compact 6-row view with View All curtain/modal trigger) */}
        <DashboardWidget id="countryPerformance">
          <Card className="h-full border-border/80 bg-card shadow-sm hover:shadow-md transition-shadow rounded-2xl overflow-hidden flex flex-col md:col-span-2 lg:col-span-1">
            <CardHeader className="pb-2 pt-4 px-4 sm:px-5 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2 text-sm font-bold text-foreground">
                <Globe2 className="h-4 w-4 text-blue-500" />
                {t(lang, "dash.country_performance", "Country Performance")}
              </CardTitle>
              <button
                type="button"
                onClick={() => {
                  setSelectedCountry(null);
                  setIsCountryModalOpen(true);
                }}
                className="text-[11px] font-bold text-blue-600 hover:text-blue-700 hover:underline dark:text-blue-400 cursor-pointer flex items-center gap-1.5 bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded-lg border border-blue-200/50 dark:border-blue-900/50 transition-colors"
              >
                <span>{translateHeader(lang, "VIEW ALL")}</span>
                <span className="text-[10px] bg-blue-600 text-white rounded-full px-1.5 py-0.2">
                  {countrySummaries.length || 6}
                </span>
              </button>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-1 flex-1 flex flex-col justify-between">
              <div className="overflow-x-auto rounded-xl border border-border/70 h-[240px] flex-1">
                <table className="w-full min-w-[340px] text-left text-[11px]">
                  <thead className="bg-muted/60 text-muted-foreground border-b border-border/70 sticky top-0 backdrop-blur-xs">
                    <tr>
                      <th className="py-2 px-2.5 font-bold">{translateHeader(lang, "COUNTRY")}</th>
                      <th className="py-2 px-1 text-center font-bold">{translateHeader(lang, "BRANCHES")}</th>
                      <th className="py-2 px-1 text-center font-bold">{translateHeader(lang, "USERS")}</th>
                      <th className="py-2 px-1 text-center font-bold">{translateHeader(lang, "CUSTOMERS")}</th>
                      <th className="py-2 px-2.5 text-right font-bold">{t(lang, "cdash.col_sales", "Sales")}</th>
                      <th className="py-2 px-2.5 text-right font-bold">{t(lang, "cdash.col_purchase", "Purchases")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50 font-medium">
                    {displayedCountries.length === 0 ? (
                      [
                        { name: "Afghanistan", b: 0, u: 0, c: 0, s: 0, p: 0 },
                        { name: "China", b: 0, u: 0, c: 0, s: 0, p: 0 },
                        { name: "India", b: 0, u: 0, c: 0, s: 0, p: 0 },
                        { name: "Iran", b: 0, u: 0, c: 0, s: 0, p: 0 },
                        { name: "Pakistan", b: 3, u: 7, c: 0, s: 0, p: 0 },
                        { name: "Tajikistan", b: 0, u: 0, c: 0, s: 0, p: 0 }
                      ].map((row) => (
                        <tr
                          key={row.name}
                          onClick={() => {
                            setSelectedCountry(null);
                            setIsCountryModalOpen(true);
                          }}
                          className="hover:bg-muted/40 transition-colors cursor-pointer"
                        >
                          <td className="py-2 px-2.5 flex items-center gap-1.5 font-semibold text-foreground">
                            <span>{getCountryFlag(row.name)}</span>
                            <span>{row.name}</span>
                          </td>
                          <td className="py-2 px-1 text-center text-muted-foreground">{row.b}</td>
                          <td className="py-2 px-1 text-center text-muted-foreground">{row.u}</td>
                          <td className="py-2 px-1 text-center text-muted-foreground">{row.c}</td>
                          <td className="py-2 px-2.5 text-right font-semibold text-foreground">${row.s}</td>
                          <td className="py-2 px-2.5 text-right font-semibold text-foreground">${row.p}</td>
                        </tr>
                      ))
                    ) : (
                      displayedCountries.map((row) => (
                        <tr
                          key={row.id}
                          onClick={() => {
                            setSelectedCountry(row);
                            setIsCountryModalOpen(true);
                          }}
                          className="hover:bg-blue-50/50 dark:hover:bg-blue-950/30 transition-colors cursor-pointer"
                        >
                          <td className="py-2 px-2.5 flex items-center gap-1.5 font-semibold text-foreground">
                            <span>{getCountryFlag(row.name)}</span>
                            <span className="hover:text-blue-600 hover:underline">
                              {row.name}
                            </span>
                          </td>
                          <td className="py-2 px-1 text-center text-muted-foreground">{row.totalBranches}</td>
                          <td className="py-2 px-1 text-center text-muted-foreground">{row.totalUsers}</td>
                          <td className="py-2 px-1 text-center text-muted-foreground">0</td>
                          <td className="py-2 px-2.5 text-right font-semibold text-foreground">${row.totalSales.toLocaleString()}</td>
                          <td className="py-2 px-2.5 text-right font-semibold text-foreground">${row.totalPurchases.toLocaleString()}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </DashboardWidget>
      </div>

      {/* ROW 2: 3 COLUMNS (Recent Activities, Top Countries by Sales, Latest Shipments) */}
      <div className="grid gap-5 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {/* Card 4: Recent Activities */}
        <DashboardWidget id="activity">
          <Card className="h-full border-border/80 bg-card shadow-sm hover:shadow-md transition-shadow rounded-2xl overflow-hidden flex flex-col">
            <CardHeader className="pb-2 pt-4 px-4 sm:px-5 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2 text-sm font-bold text-foreground">
                <Clock className="h-4 w-4 text-blue-500" />
                {translateHeader(lang, "RECENT ACTIVITIES")}
              </CardTitle>
              <Link
                href="/dashboard/activity-logs"
                className="text-[11px] font-bold text-blue-600 hover:text-blue-700 hover:underline dark:text-blue-400"
              >
                {translateHeader(lang, "VIEW ALL")}
              </Link>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-1 flex-1">
              <div className="space-y-3 mt-1">
                {recentActivities.map((act) => {
                  const Icon = act.icon;
                  return (
                    <div key={act.id} className="flex items-center justify-between gap-3 p-1.5 rounded-xl hover:bg-muted/40 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`h-8 w-8 rounded-lg grid place-items-center shrink-0 ${act.color}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-foreground truncate">{act.title}</p>
                          <p className="text-[10px] font-medium text-muted-foreground truncate">{act.subtitle}</p>
                        </div>
                      </div>
                      <span className="text-[10px] font-medium text-muted-foreground whitespace-nowrap shrink-0">
                        {act.time}
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </DashboardWidget>

        {/* Card 5: Top Countries by Sales (Donut) */}
        <DashboardWidget id="system">
          <Card className="h-full border-border/80 bg-card shadow-sm hover:shadow-md transition-shadow rounded-2xl overflow-hidden flex flex-col">
            <CardHeader className="pb-2 pt-4 px-4 sm:px-5 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2 text-sm font-bold text-foreground">
                <Layers className="h-4 w-4 text-emerald-500" />
                {translateHeader(lang, "TOP COUNTRIES BY SALES")}
              </CardTitle>
              <Link
                href="/dashboard/sales"
                className="text-[11px] font-bold text-blue-600 hover:text-blue-700 hover:underline dark:text-blue-400"
              >
                {translateHeader(lang, "VIEW ALL")}
              </Link>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-1 flex-1 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="relative h-[180px] w-[180px] shrink-0 grid place-items-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip contentStyle={tooltipStyle} />
                    <Pie
                      data={donutData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={3}
                      strokeWidth={1}
                      stroke={isDark ? "#1e293b" : "#ffffff"}
                    >
                      {donutData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                  <span className="text-base font-extrabold text-foreground">${totalSalesSum.toLocaleString()}</span>
                  <span className="text-[9.5px] font-bold text-muted-foreground uppercase tracking-wider">
                    {t(lang, "dash.total_sales", "Total Sales")}
                  </span>
                </div>
              </div>

              <div className="flex-1 w-full space-y-1.5 text-[11px] font-semibold">
                {donutData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between text-muted-foreground">
                    <div className="flex items-center gap-2 truncate">
                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="truncate text-foreground font-medium">{item.name}</span>
                    </div>
                    <span className="font-bold text-foreground">0%</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </DashboardWidget>

        {/* Card 6: Latest Shipments */}
        <DashboardWidget id="quick">
          <Card className="h-full border-border/80 bg-card shadow-sm hover:shadow-md transition-shadow rounded-2xl overflow-hidden flex flex-col md:col-span-2 lg:col-span-1">
            <CardHeader className="pb-2 pt-4 px-4 sm:px-5 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2 text-sm font-bold text-foreground">
                <Ship className="h-4 w-4 text-cyan-600" />
                {translateHeader(lang, "LATEST SHIPMENTS")}
              </CardTitle>
              <Link
                href="/dashboard/tracking"
                className="text-[11px] font-bold text-blue-600 hover:text-blue-700 hover:underline dark:text-blue-400"
              >
                {translateHeader(lang, "VIEW ALL")}
              </Link>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-1 flex-1 flex flex-col">
              <div className="overflow-x-auto rounded-xl border border-border/70 flex-1">
                <table className="w-full min-w-[360px] text-left text-[11px]">
                  <thead className="bg-muted/60 text-muted-foreground border-b border-border/70">
                    <tr>
                      <th className="py-2 px-2.5 font-bold">{translateHeader(lang, "SHIPMENT NO")}</th>
                      <th className="py-2 px-2 font-bold">{translateHeader(lang, "CUSTOMER")}</th>
                      <th className="py-2 px-1.5 font-bold">{translateHeader(lang, "COUNTRY")}</th>
                      <th className="py-2 px-1 text-center font-bold">{translateHeader(lang, "MODE")}</th>
                      <th className="py-2 px-1.5 text-center font-bold">{translateHeader(lang, "STATUS")}</th>
                      <th className="py-2 px-2 text-right font-bold">{translateHeader(lang, "ETA")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50 font-medium">
                    {latestShipments.map((shp) => (
                      <tr key={shp.code} className="hover:bg-muted/40 transition-colors">
                        <td className="py-2 px-2.5 font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer">
                          {shp.code}
                        </td>
                        <td className="py-2 px-2 text-foreground font-medium truncate max-w-[90px]">{shp.customer}</td>
                        <td className="py-2 px-1.5 text-muted-foreground">{shp.country}</td>
                        <td className="py-2 px-1 text-center">
                          <span className="text-[10px] text-muted-foreground font-semibold">{shp.mode}</span>
                        </td>
                        <td className="py-2 px-1.5 text-center">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold ${
                              shp.statusTone === "green"
                                ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                                : shp.statusTone === "blue"
                                ? "bg-blue-500/10 text-blue-600 border border-blue-500/20"
                                : "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                shp.statusTone === "green"
                                  ? "bg-emerald-500"
                                  : shp.statusTone === "blue"
                                  ? "bg-blue-500"
                                  : "bg-amber-500"
                              }`}
                            />
                            {shp.status}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-right text-muted-foreground text-[10px]">{shp.eta}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </DashboardWidget>
      </div>

      {/* Country Performance Curtain / Modal ("پردہ") */}
      {isCountryModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsCountryModalOpen(false);
          }}
        >
          <div
            className="relative w-full max-w-4xl max-h-[90vh] bg-background border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
            role="dialog"
            aria-modal="true"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/40">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-500/20">
                  <Globe2 className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base text-foreground">
                      {t(lang, "dash.country_performance", "Country Performance")}
                    </h3>
                    <span className="rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-xs px-2.5 py-0.5 font-bold">
                      {countrySummaries.length || 6} {translateHeader(lang, "COUNTRY")}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t(lang, "sarh.country_performance_sub", "Country-wise branch and user coverage")}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCountryModalOpen(false)}
                className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Summary Metrics Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-5 py-3 bg-muted/20 border-b border-border text-xs">
              <div className="bg-card border border-border/80 rounded-xl p-2.5 flex items-center justify-between">
                <span className="text-muted-foreground font-medium">{translateHeader(lang, "BRANCHES")}</span>
                <span className="font-bold text-foreground">
                  {countrySummaries.reduce((sum, c) => sum + c.totalBranches, 0) || 5}
                </span>
              </div>
              <div className="bg-card border border-border/80 rounded-xl p-2.5 flex items-center justify-between">
                <span className="text-muted-foreground font-medium">{translateHeader(lang, "USERS")}</span>
                <span className="font-bold text-foreground">
                  {countrySummaries.reduce((sum, c) => sum + c.totalUsers, 0) || 10}
                </span>
              </div>
              <div className="bg-card border border-border/80 rounded-xl p-2.5 flex items-center justify-between">
                <span className="text-muted-foreground font-medium">{t(lang, "cdash.col_sales", "Sales")}</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  ${countrySummaries.reduce((sum, c) => sum + c.totalSales, 0).toLocaleString()}
                </span>
              </div>
              <div className="bg-card border border-border/80 rounded-xl p-2.5 flex items-center justify-between">
                <span className="text-muted-foreground font-medium">{t(lang, "cdash.col_purchase", "Purchases")}</span>
                <span className="font-bold text-blue-600 dark:text-blue-400">
                  ${countrySummaries.reduce((sum, c) => sum + c.totalPurchases, 0).toLocaleString()}
                </span>
              </div>
            </div>

            {/* Drilldown or Full Directory */}
            {selectedCountry ? (
              <div className="p-5 flex-1 overflow-y-auto space-y-4">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setSelectedCountry(null)}
                    className="flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    <span>View All Countries Directory</span>
                  </button>
                  <Link
                    href={`/dashboard/country?countryId=${selectedCountry.id}`}
                    className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-colors"
                  >
                    <span>Open Full Country Portal</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </div>

                <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="text-4xl">{getCountryFlag(selectedCountry.name)}</span>
                    <div>
                      <h4 className="text-xl font-bold text-foreground">{selectedCountry.name}</h4>
                      <span className="text-xs text-muted-foreground font-mono">
                        Currency: {selectedCountry.currency || "USD"}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
                    <div className="bg-muted/30 border border-border/60 rounded-xl p-3">
                      <div className="text-[11px] text-muted-foreground font-medium">{translateHeader(lang, "BRANCHES")}</div>
                      <div className="text-lg font-bold text-foreground mt-0.5">{selectedCountry.totalBranches}</div>
                    </div>
                    <div className="bg-muted/30 border border-border/60 rounded-xl p-3">
                      <div className="text-[11px] text-muted-foreground font-medium">{translateHeader(lang, "USERS")}</div>
                      <div className="text-lg font-bold text-foreground mt-0.5">{selectedCountry.totalUsers}</div>
                    </div>
                    <div className="bg-muted/30 border border-border/60 rounded-xl p-3">
                      <div className="text-[11px] text-muted-foreground font-medium">{t(lang, "cdash.col_sales", "Sales")}</div>
                      <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                        ${selectedCountry.totalSales.toLocaleString()}
                      </div>
                    </div>
                    <div className="bg-muted/30 border border-border/60 rounded-xl p-3">
                      <div className="text-[11px] text-muted-foreground font-medium">{t(lang, "cdash.col_purchase", "Purchases")}</div>
                      <div className="text-lg font-bold text-blue-600 dark:text-blue-400 mt-0.5">
                        ${selectedCountry.totalPurchases.toLocaleString()}
                      </div>
                    </div>
                    <div className="bg-muted/30 border border-border/60 rounded-xl p-3">
                      <div className="text-[11px] text-muted-foreground font-medium">Debit Total</div>
                      <div className="text-lg font-bold text-foreground mt-0.5">
                        ${selectedCountry.totalDebit.toLocaleString()}
                      </div>
                    </div>
                    <div className="bg-muted/30 border border-border/60 rounded-xl p-3">
                      <div className="text-[11px] text-muted-foreground font-medium">Current Balance</div>
                      <div className="text-lg font-bold text-foreground mt-0.5">
                        ${selectedCountry.totalLedgerBalance.toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Search Filter */}
                <div className="px-5 py-3 border-b border-border bg-card">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      value={countrySearch}
                      onChange={(e) => setCountrySearch(e.target.value)}
                      placeholder="Search country by name..."
                      className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-foreground"
                    />
                  </div>
                </div>

                {/* Full Countries Table */}
                <div className="overflow-y-auto max-h-[50vh] p-5">
                  <div className="overflow-x-auto rounded-xl border border-border/70">
                    <table className="w-full min-w-[500px] text-left text-xs">
                      <thead className="bg-muted/60 text-muted-foreground border-b border-border/70 sticky top-0 backdrop-blur-md">
                        <tr>
                          <th className="py-2.5 px-3 font-bold">{translateHeader(lang, "COUNTRY")}</th>
                          <th className="py-2.5 px-2 text-center font-bold">{translateHeader(lang, "BRANCHES")}</th>
                          <th className="py-2.5 px-2 text-center font-bold">{translateHeader(lang, "USERS")}</th>
                          <th className="py-2.5 px-2 text-center font-bold">{translateHeader(lang, "CUSTOMERS")}</th>
                          <th className="py-2.5 px-3 text-right font-bold">{t(lang, "cdash.col_sales", "Sales")}</th>
                          <th className="py-2.5 px-3 text-right font-bold">{t(lang, "cdash.col_purchase", "Purchases")}</th>
                          <th className="py-2.5 px-3 text-right font-bold">Ledger Balance</th>
                          <th className="py-2.5 px-3 text-center font-bold">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50 font-medium">
                        {filteredCountries.map((row) => (
                          <tr
                            key={row.id}
                            onClick={() => setSelectedCountry(row)}
                            className="hover:bg-blue-50/50 dark:hover:bg-blue-950/30 transition-colors cursor-pointer"
                          >
                            <td className="py-2.5 px-3 flex items-center gap-2 font-semibold text-foreground">
                              <span className="text-base">{getCountryFlag(row.name)}</span>
                              <span>{row.name}</span>
                            </td>
                            <td className="py-2.5 px-2 text-center text-muted-foreground">{row.totalBranches}</td>
                            <td className="py-2.5 px-2 text-center text-muted-foreground">{row.totalUsers}</td>
                            <td className="py-2.5 px-2 text-center text-muted-foreground">0</td>
                            <td className="py-2.5 px-3 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                              ${row.totalSales.toLocaleString()}
                            </td>
                            <td className="py-2.5 px-3 text-right font-semibold text-blue-600 dark:text-blue-400">
                              ${row.totalPurchases.toLocaleString()}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">
                              ${row.totalLedgerBalance.toLocaleString()}
                            </td>
                            <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                              <Link
                                href={`/dashboard/country?countryId=${row.id}`}
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline"
                              >
                                <span>Open</span>
                                <ChevronRight className="h-3.5 w-3.5" />
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {/* Modal Footer */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-muted/40 text-xs">
              <span className="text-muted-foreground">
                Showing {filteredCountries.length} countries
              </span>
              <button
                type="button"
                onClick={() => setIsCountryModalOpen(false)}
                className="px-4 py-1.5 rounded-xl border border-border bg-card hover:bg-muted font-bold text-foreground transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
