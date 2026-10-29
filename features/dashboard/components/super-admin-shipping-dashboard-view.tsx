"use client";

import React, { useMemo, useState, useEffect } from "react";
import {
  Bar,
  BarChart,
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
  Activity,
  Anchor,
  ArrowRight,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Compass,
  FileBarChart,
  FileSpreadsheet,
  FileText,
  Globe2,
  Inbox,
  Landmark,
  MapPin,
  Package,
  Receipt,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Ship,
  TrendingUp,
  Truck,
  UserCheck,
  UserPlus,
  Users,
  Wallet
} from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n/ui";
import { translateHeader } from "@/lib/i18n/table-headers";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";

export type CountryShippingSummary = {
  countryId: string;
  countryName: string;
  countryCode: string;
  currency: string;
  branchCount: number;
  totalShipments: number;
  inTransit: number;
  arrived: number;
};

export type SuperAdminShippingData = {
  totalBranches: number;
  totalCountries: number;
  totalShipments: number;
  inTransitCount: number;
  arrivedCount: number;
  pendingCount: number;
  delayedCount: number;
  statusBreakdown: { name: string; value: number; color: string }[];
  countryWiseShipments: { countryName: string; shipments: number }[];
  countries: CountryShippingSummary[];
  recentShipments: {
    id: string;
    blNumber: string;
    countryName: string;
    vesselName: string;
    portOfDischarge: string;
    status: string;
    eta?: string;
  }[];
};

const CHART_COLORS = ["#2563eb", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

export function SuperAdminShippingDashboardView({ data }: { data: SuperAdminShippingData }) {
  const lang = useActiveLanguage();
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);
  const tr = (s: string) => translateHeader(lang, s);

  const [mounted, setMounted] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

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

  const localizedDate = useMemo(() => {
    try {
      return new Intl.DateTimeFormat(lang, { day: "numeric", month: "short", year: "numeric" }).format(new Date());
    } catch {
      return new Date().toLocaleDateString();
    }
  }, [lang]);

  const filteredCountries = useMemo(() => {
    if (!searchTerm.trim()) return data.countries;
    const term = searchTerm.toLowerCase();
    return data.countries.filter(
      (c) =>
        c.countryName.toLowerCase().includes(term) ||
        c.countryCode.toLowerCase().includes(term)
    );
  }, [data.countries, searchTerm]);

  const pieData = useMemo(() => {
    const list = data.statusBreakdown || [];
    if (list.length > 0) return list.map((x) => ({ ...x, name: tr(x.name) }));
    return [
      { name: tr("In Transit"), value: data.inTransitCount || 0, color: "#2563eb" },
      { name: tr("Arrived"), value: data.arrivedCount || 0, color: "#10b981" },
      { name: tr("Pending"), value: data.pendingCount || 0, color: "#f59e0b" },
      { name: tr("Delayed"), value: data.delayedCount || 0, color: "#ef4444" }
    ];
  }, [data.statusBreakdown, data.inTransitCount, data.arrivedCount, data.pendingCount, data.delayedCount, lang]);

  const barData = useMemo(() => {
    if (data.countryWiseShipments && data.countryWiseShipments.length > 0) {
      return data.countryWiseShipments;
    }
    return [
      { countryName: tr("Pakistan"), shipments: 0 },
      { countryName: tr("UAE"), shipments: 0 },
      { countryName: tr("Afghanistan"), shipments: 0 },
      { countryName: tr("Iran"), shipments: 0 }
    ];
  }, [data.countryWiseShipments, lang]);

  return (
    <div className="space-y-6 text-foreground p-3 sm:p-5 lg:p-6 min-h-screen" dir={isRtl ? "rtl" : "ltr"}>
      {/* 1. Header Bar: Title + Switcher + Super Admin Badge + Localized Date */}
      <section className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-b border-border/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-700 text-white shadow-md shadow-blue-600/20 shrink-0">
            <Ship className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
                {tr("Global Shipping Line")}
              </h1>
              <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[11px] font-black uppercase text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300 whitespace-nowrap">
                <Anchor className="h-3 w-3" />
                {tr("Executive Shipping Dashboard")}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-black uppercase text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300 whitespace-nowrap">
                <ShieldCheck className="h-3 w-3" />
                {tr("Super Management")}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {tr("Global overview for international container lines, vessel tracking, multi-country hubs, and clearance ledgers.")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            asChild
            variant="outline"
            size="sm"
            className="h-8 rounded-xl border-slate-200 bg-white font-bold text-xs hover:bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 shadow-xs"
          >
            <Link href={"/dashboard/super-admin" as Route}>
              <Building2 className="h-3.5 w-3.5 text-amber-600 me-1.5" />
              <span>{tr("Business Dashboard")}</span>
            </Link>
          </Button>

          <Button
            asChild
            variant="outline"
            size="sm"
            className="h-8 rounded-xl border-blue-200 bg-blue-50/60 font-bold text-xs hover:bg-blue-100 text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-300 shadow-xs"
          >
            <Link href={"/dashboard/shipping-line/tracking" as Route}>
              <Compass className="h-3.5 w-3.5 text-blue-600 me-1.5" />
              <span>{tr("Shipping Tracking")}</span>
            </Link>
          </Button>

          <div className="rounded-xl border border-border bg-card px-3 py-1.5 backdrop-blur shrink-0 flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 shadow-xs">
            <Calendar className="h-3.5 w-3.5 text-blue-600 shrink-0" />
            <span className="font-mono">{localizedDate}</span>
          </div>
        </div>
      </section>

      {/* 2. Executive Global Logistics Hero Banner */}
      <section className="relative overflow-hidden rounded-3xl border border-blue-950/20 bg-gradient-to-r from-[#061830] via-[#092d5a] to-[#0c4384] p-6 text-white shadow-xl">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-30 mix-blend-overlay"
          style={{ backgroundImage: `url('/images/global_logistics_hero.jpg')` }}
        />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/20 px-3 py-1 text-xs font-bold text-blue-300 ring-1 ring-inset ring-blue-400/30">
              <Globe2 className="h-3.5 w-3.5" />
              {tr("Executive Shipping Control")}
            </span>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              {tr("Global Shipping Line & Clearing Network")}
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              {tr("Global command center monitoring international vessel schedules, container tracking, port handovers, and country branch performance.")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <div className="rounded-2xl border border-white/10 bg-white/10 p-3 text-center backdrop-blur-md min-w-[100px]">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-300">{tr("Countries")}</p>
              <p className="text-sm font-black text-white">{data.totalCountries}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 p-3 text-center backdrop-blur-md min-w-[100px]">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-300">{tr("Branches")}</p>
              <p className="text-sm font-black text-white">{data.totalBranches}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 p-3 text-center backdrop-blur-md min-w-[100px]">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-300">{tr("Shipments")}</p>
              <p className="text-sm font-black text-white">{data.totalShipments}</p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Four Core Metric Cards */}
      <section className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        {/* Global Branches */}
        <div className="bg-card text-card-foreground border border-border/80 p-4 sm:p-5 rounded-2xl flex items-center justify-between shadow-sm hover:shadow-md transition-all">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              {tr("Shipping Branches")}
            </p>
            <p className="mt-2 text-2xl sm:text-3xl font-black tracking-tight text-foreground">
              {data.totalBranches}
            </p>
            <p className="mt-1 text-[11px] font-semibold text-muted-foreground/80">
              {data.totalCountries} {tr("countries")}
            </p>
          </div>
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 shrink-0">
            <Building2 className="h-5 w-5" />
          </div>
        </div>

        {/* Total Shipments */}
        <div className="bg-card text-card-foreground border border-border/80 p-4 sm:p-5 rounded-2xl flex items-center justify-between shadow-sm hover:shadow-md transition-all">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              {tr("Global Shipments")}
            </p>
            <p className="mt-2 text-2xl sm:text-3xl font-black tracking-tight text-foreground">
              {data.totalShipments}
            </p>
            <p className="mt-1 text-[11px] font-semibold text-muted-foreground/80">
              {tr("All registered orders")}
            </p>
          </div>
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400 shrink-0">
            <Ship className="h-5 w-5" />
          </div>
        </div>

        {/* In Transit */}
        <div className="bg-card text-card-foreground border border-border/80 p-4 sm:p-5 rounded-2xl flex items-center justify-between shadow-sm hover:shadow-md transition-all">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              {tr("In Transit")}
            </p>
            <p className="mt-2 text-2xl sm:text-3xl font-black tracking-tight text-blue-600 dark:text-blue-400">
              {data.inTransitCount}
            </p>
            <p className="mt-1 text-[11px] font-semibold text-muted-foreground/80">
              {tr("Active container sailings")}
            </p>
          </div>
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-cyan-50 text-cyan-600 dark:bg-cyan-950/40 dark:text-cyan-400 shrink-0">
            <Truck className="h-5 w-5" />
          </div>
        </div>

        {/* Arrived */}
        <div className="bg-card text-card-foreground border border-border/80 p-4 sm:p-5 rounded-2xl flex items-center justify-between shadow-sm hover:shadow-md transition-all">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              {tr("Arrived & Cleared")}
            </p>
            <p className="mt-2 text-2xl sm:text-3xl font-black tracking-tight text-emerald-600 dark:text-emerald-400">
              {data.arrivedCount}
            </p>
            <p className="mt-1 text-[11px] font-semibold text-muted-foreground/80">
              {tr("Port clearances")}
            </p>
          </div>
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 shrink-0">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>
      </section>

      {/* 4. Two Recharts Visualizations: Country Wise Volume + Status Breakdown */}
      <section className="grid gap-6 lg:grid-cols-2">
        {/* Country Wise Shipments Bar */}
        <Card className="border-border/80 bg-card shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
              <Globe2 className="h-4 w-4 text-blue-600" />
              {tr("Country Wise Shipments")}
            </CardTitle>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase">
              {tr("Total shipments distribution by national hub")}
            </p>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="h-[240px] w-full">
              {mounted && barData.some((d) => d.shipments > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? "#334155" : "#e2e8f0"} />
                    <XAxis dataKey="countryName" tick={{ fontSize: 11, fill: isDark ? "#94a3b8" : "#64748b" }} interval={0} angle={-15} textAnchor="end" />
                    <YAxis tick={{ fontSize: 11, fill: isDark ? "#94a3b8" : "#64748b" }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: isDark ? "#0f172a" : "#ffffff",
                        borderColor: isDark ? "#334155" : "#e2e8f0",
                        borderRadius: "12px",
                        fontSize: "12px",
                        fontWeight: "bold"
                      }}
                    />
                    <Bar dataKey="shipments" fill="#2563eb" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-muted/10 text-center">
                  <Inbox className="h-7 w-7 text-muted-foreground/40" />
                  <p className="text-xs font-semibold text-muted-foreground">{tr("No country shipment data available")}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Global Shipment Status Donut */}
        <Card className="border-border/80 bg-card shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-500" />
              {tr("Global Shipment Status")}
            </CardTitle>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase">
              {tr("Status proportion across international routes")}
            </p>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="h-[240px] w-full flex flex-col sm:flex-row items-center justify-around gap-4">
              <div className="h-[200px] w-[200px] shrink-0 relative">
                {mounted ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={4}
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color || CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: isDark ? "#0f172a" : "#ffffff",
                          borderColor: isDark ? "#334155" : "#e2e8f0",
                          borderRadius: "12px",
                          fontSize: "12px",
                          fontWeight: "bold"
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : null}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[11px] font-bold text-muted-foreground uppercase">{tr("Total")}</span>
                  <span className="text-lg font-black text-foreground">{data.totalShipments}</span>
                </div>
              </div>

              {/* Status Legend */}
              <div className="space-y-2 text-xs font-bold w-full sm:w-auto">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-[#2563eb]" />
                    <span className="text-slate-700 dark:text-slate-300">{tr("In Transit")}</span>
                  </div>
                  <span className="font-mono text-foreground">{data.inTransitCount}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-[#10b981]" />
                    <span className="text-slate-700 dark:text-slate-300">{tr("Arrived")}</span>
                  </div>
                  <span className="font-mono text-foreground">{data.arrivedCount}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-[#f59e0b]" />
                    <span className="text-slate-700 dark:text-slate-300">{tr("Pending")}</span>
                  </div>
                  <span className="font-mono text-foreground">{data.pendingCount}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-[#ef4444]" />
                    <span className="text-slate-700 dark:text-slate-300">{tr("Delayed")}</span>
                  </div>
                  <span className="font-mono text-foreground">{data.delayedCount}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* 5. Country Shipping Hubs Table */}
      <Card className="border-border/80 bg-card shadow-sm">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3">
          <div>
            <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
              <Globe2 className="h-4 w-4 text-blue-600" />
              {tr("Country Shipping Hubs")} ({data.countries.length})
            </CardTitle>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase">
              {tr("National operations, branch counts, and active shipping volumes")}
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder={tr("Search country...")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-8 pl-8 pr-3 text-xs rounded-xl border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 border-y border-border/80 text-[11px] font-black uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">{tr("Country")}</th>
                  <th className="px-3 py-3">{tr("Code")}</th>
                  <th className="px-3 py-3 text-center">{tr("Branches")}</th>
                  <th className="px-3 py-3 text-center">{tr("Total Shipments")}</th>
                  <th className="px-3 py-3 text-center">{tr("In Transit")}</th>
                  <th className="px-3 py-3 text-center">{tr("Arrived")}</th>
                  <th className="px-4 py-3 text-right">{tr("Actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredCountries.length > 0 ? (
                  filteredCountries.map((c) => (
                    <tr key={c.countryId} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-bold text-foreground">
                        <div className="flex items-center gap-2">
                          <Globe2 className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                          <span>{c.countryName}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 font-mono font-bold">{c.countryCode}</td>
                      <td className="px-3 py-3 text-center font-bold text-foreground">
                        {c.branchCount}
                      </td>
                      <td className="px-3 py-3 text-center font-bold text-blue-600 dark:text-blue-400">
                        {c.totalShipments}
                      </td>
                      <td className="px-3 py-3 text-center font-bold text-cyan-600 dark:text-cyan-400">
                        {c.inTransit}
                      </td>
                      <td className="px-3 py-3 text-center font-bold text-emerald-600 dark:text-emerald-400">
                        {c.arrived}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          asChild
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2.5 rounded-lg text-xs font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        >
                          <Link href={`/dashboard/country/shipping-line?countryId=${c.countryId}` as Route}>
                            <span>{tr("Open Hub")}</span>
                            <ArrowRight className="h-3 w-3 ms-1" />
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                      {tr("No countries found.")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 6. Bottom Super Admin Badge */}
      <section className="flex items-center justify-between border-t border-border/80 pt-4 text-xs">
        <div className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50/60 px-3 py-1.5 font-bold text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300">
          <Ship className="h-4 w-4 text-blue-600" />
          <span>DGT LLC ERP SYSTEM • {tr("Global Executive Shipping Line")}</span>
        </div>
        <p className="text-muted-foreground font-semibold text-[11px]">
          DGT LLC ERP SYSTEM • Version 1.0.0
        </p>
      </section>
    </div>
  );
}
