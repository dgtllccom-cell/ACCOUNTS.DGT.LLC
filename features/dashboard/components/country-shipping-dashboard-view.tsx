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
import { localizeCountryName } from "@/lib/i18n/country-names";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";

export type CountryShippingBranchSummary = {
  id: string;
  name: string;
  code: string;
  cityName: string;
  activeShipments: number;
  totalShipments: number;
  inTransit: number;
  arrived: number;
  currency: string;
};

export type CountryShippingData = {
  countryId: string;
  countryName: string;
  countryCode: string;
  currency: string;
  totalBranches: number;
  totalShipments: number;
  inTransitCount: number;
  arrivedCount: number;
  pendingCount: number;
  delayedCount: number;
  statusBreakdown: { name: string; value: number; color: string }[];
  branchWiseShipments: { branchName: string; shipments: number }[];
  branches: CountryShippingBranchSummary[];
  recentShipments: {
    id: string;
    blNumber: string;
    branchName: string;
    vesselName: string;
    portOfDischarge: string;
    status: string;
    eta?: string;
  }[];
  canSwitchToBusiness?: boolean;
};

const CHART_COLORS = ["#2563eb", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

function StatusBadge({ status }: { status: string }) {
  const norm = (status || "pending").toLowerCase();
  let tone = "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300";
  if (norm.includes("transit") || norm.includes("sailing")) {
    tone = "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300";
  } else if (norm.includes("arrived") || norm.includes("completed") || norm.includes("cleared")) {
    tone = "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300";
  } else if (norm.includes("delayed") || norm.includes("hold") || norm.includes("danger")) {
    tone = "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300";
  } else if (norm.includes("pending") || norm.includes("draft") || norm.includes("booking")) {
    tone = "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300";
  }

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${tone}`}>
      {status || "Pending"}
    </span>
  );
}

export function CountryShippingDashboardView({ data }: { data: CountryShippingData }) {
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

  const filteredBranches = useMemo(() => {
    if (!searchTerm.trim()) return data.branches;
    const term = searchTerm.toLowerCase();
    return data.branches.filter(
      (b) =>
        b.name.toLowerCase().includes(term) ||
        b.code.toLowerCase().includes(term) ||
        b.cityName.toLowerCase().includes(term)
    );
  }, [data.branches, searchTerm]);

  const pieData = useMemo(() => {
    const list = data.statusBreakdown || [];
    if (list.length > 0) return list;
    return [
      { name: tr("In Transit"), value: data.inTransitCount || 0, color: "#2563eb" },
      { name: tr("Arrived"), value: data.arrivedCount || 0, color: "#10b981" },
      { name: tr("Pending"), value: data.pendingCount || 0, color: "#f59e0b" },
      { name: tr("Delayed"), value: data.delayedCount || 0, color: "#ef4444" }
    ];
  }, [data.statusBreakdown, data.inTransitCount, data.arrivedCount, data.pendingCount, data.delayedCount, lang]);

  const barData = useMemo(() => {
    if (data.branchWiseShipments && data.branchWiseShipments.length > 0) {
      return data.branchWiseShipments;
    }
    return [
      { branchName: tr("Chaman"), shipments: 0 },
      { branchName: tr("Quetta"), shipments: 0 },
      { branchName: tr("Karachi"), shipments: 0 },
      { branchName: tr("Other"), shipments: 0 }
    ];
  }, [data.branchWiseShipments, lang]);

  return (
    <div className="space-y-6 text-foreground p-3 sm:p-5 lg:p-6 min-h-screen" dir={isRtl ? "rtl" : "ltr"}>
      {/* 1. Top Header Bar: Country Title + Badges + Switcher + Localized Date */}
      <section className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-b border-border/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-indigo-600 text-white shadow-md shadow-indigo-500/20 shrink-0">
            <Globe2 className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
                {localizeCountryName(data.countryName, lang)}
              </h1>
              <span className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-[10px] font-black uppercase text-indigo-700 dark:border-indigo-900/50 dark:bg-indigo-950/40 dark:text-indigo-300">
                <Ship className="h-3 w-3" />
                {tr("Shipping Line Dashboard")}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-purple-200 bg-purple-50 px-2 py-0.5 text-[9px] font-black uppercase text-purple-700 dark:border-purple-900/50 dark:bg-purple-950/40 dark:text-purple-300">
                <ShieldCheck className="h-3 w-3" />
                {tr("Country Admin")}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {tr("National overview for cargo lines, port operations, vessel manifests, and regional branch tracking.")}
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
            <Link href={`/dashboard/country?countryId=${data.countryId}` as Route}>
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

      {/* 2. Maritime National Logistics Hero Banner */}
      <section className="relative overflow-hidden rounded-3xl border border-indigo-950/20 bg-gradient-to-r from-[#071d38] via-[#092952] to-[#0c3970] p-6 text-white shadow-xl">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-25 mix-blend-overlay"
          style={{ backgroundImage: `url('/images/cyber_earth_globe.jpg')` }}
        />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/20 px-3 py-1 text-xs font-bold text-indigo-300 ring-1 ring-inset ring-indigo-400/30">
              <Ship className="h-3.5 w-3.5" />
              {tr("Country Shipping Line Authority")}
            </span>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              {localizeCountryName(data.countryName, lang)} · {tr("Shipping Line Operations")}
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              {tr("Manage nation-wide shipping branches, container vessel manifests, port clearance, and tracking operations across all national hubs.")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <div className="rounded-2xl border border-white/10 bg-white/10 p-3 text-center backdrop-blur-md min-w-[100px]">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-300">{tr("Country")}</p>
              <p className="text-sm font-black text-white">{data.countryCode || "PK"}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 p-3 text-center backdrop-blur-md min-w-[100px]">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-300">{tr("Currency")}</p>
              <p className="text-sm font-black text-white">{data.currency || "PKR"}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 p-3 text-center backdrop-blur-md min-w-[100px]">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-300">{tr("Branches")}</p>
              <p className="text-sm font-black text-white">{data.totalBranches}</p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Four Core Operational Cards Matching Image 2 Design 3 */}
      <section className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        {/* Total Branches */}
        <div className="bg-card text-card-foreground border border-border/80 p-4 sm:p-5 rounded-2xl flex items-center justify-between shadow-sm hover:shadow-md transition-all">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {tr("Total Branches")}
            </p>
            <p className="mt-2 text-2xl sm:text-3xl font-black tracking-tight text-foreground">
              {data.totalBranches}
            </p>
            <p className="mt-1 text-[11px] font-semibold text-muted-foreground/80">
              {tr("Active branches")}
            </p>
          </div>
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 shrink-0">
            <Building2 className="h-5 w-5" />
          </div>
        </div>

        {/* Total Shipments */}
        <div className="bg-card text-card-foreground border border-border/80 p-4 sm:p-5 rounded-2xl flex items-center justify-between shadow-sm hover:shadow-md transition-all">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {tr("Total Shipments")}
            </p>
            <p className="mt-2 text-2xl sm:text-3xl font-black tracking-tight text-foreground">
              {data.totalShipments}
            </p>
            <p className="mt-1 text-[11px] font-semibold text-muted-foreground/80">
              {tr("All branches")}
            </p>
          </div>
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400 shrink-0">
            <Ship className="h-5 w-5" />
          </div>
        </div>

        {/* In Transit */}
        <div className="bg-card text-card-foreground border border-border/80 p-4 sm:p-5 rounded-2xl flex items-center justify-between shadow-sm hover:shadow-md transition-all">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {tr("In Transit")}
            </p>
            <p className="mt-2 text-2xl sm:text-3xl font-black tracking-tight text-blue-600 dark:text-blue-400">
              {data.inTransitCount}
            </p>
            <p className="mt-1 text-[11px] font-semibold text-muted-foreground/80">
              {tr("Active shipments")}
            </p>
          </div>
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-cyan-50 text-cyan-600 dark:bg-cyan-950/40 dark:text-cyan-400 shrink-0">
            <Truck className="h-5 w-5" />
          </div>
        </div>

        {/* Arrived */}
        <div className="bg-card text-card-foreground border border-border/80 p-4 sm:p-5 rounded-2xl flex items-center justify-between shadow-sm hover:shadow-md transition-all">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {tr("Arrived")}
            </p>
            <p className="mt-2 text-2xl sm:text-3xl font-black tracking-tight text-emerald-600 dark:text-emerald-400">
              {data.arrivedCount}
            </p>
            <p className="mt-1 text-[11px] font-semibold text-muted-foreground/80">
              {tr("This month")}
            </p>
          </div>
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 shrink-0">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>
      </section>

      {/* 4. Two Recharts Visualizations: Branch Wise Shipments + Shipment Status */}
      <section className="grid gap-6 lg:grid-cols-2">
        {/* Branch Wise Shipments Bar */}
        <Card className="border-border/80 bg-card shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
              <Building2 className="h-4 w-4 text-blue-600" />
              {tr("Branch Wise Shipments")}
            </CardTitle>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase">
              {tr("Shipments count across city branches")}
            </p>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="h-[240px] w-full">
              {mounted && barData.some((d) => d.shipments > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? "#334155" : "#e2e8f0"} />
                    <XAxis dataKey="branchName" tick={{ fontSize: 10, fill: isDark ? "#94a3b8" : "#64748b" }} interval={0} angle={-15} textAnchor="end" />
                    <YAxis tick={{ fontSize: 10, fill: isDark ? "#94a3b8" : "#64748b" }} />
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
                  <p className="text-xs font-semibold text-muted-foreground">{tr("No branch shipment data available")}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Shipment Status Donut */}
        <Card className="border-border/80 bg-card shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-500" />
              {tr("Shipment Status")}
            </CardTitle>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase">
              {tr("National delivery distribution")}
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
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">{tr("Total")}</span>
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

      {/* 5. Quick Administrative Access Row */}
      <section className="grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-4">
        <Link
          href={"/dashboard/shipping-line/tracking" as Route}
          className="flex items-center gap-3 p-4 rounded-2xl border border-blue-200/80 bg-blue-50/40 hover:bg-blue-50 transition-all text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-300 shadow-xs"
        >
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-600 text-white shrink-0">
            <Compass className="h-5 w-5" />
          </div>
          <div>
            <p className="font-black text-xs leading-snug">{tr("Shipping Tracking")}</p>
            <p className="text-[10px] text-muted-foreground">{tr("National tracking hub")}</p>
          </div>
        </Link>

        <Link
          href={"/dashboard/settings/locations" as Route}
          className="flex items-center gap-3 p-4 rounded-2xl border border-purple-200/80 bg-purple-50/40 hover:bg-purple-50 transition-all text-purple-900 dark:border-purple-900/40 dark:bg-purple-950/20 dark:text-purple-300 shadow-xs"
        >
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-purple-600 text-white shrink-0">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <p className="font-black text-xs leading-snug">{tr("Manage Branches")}</p>
            <p className="text-[10px] text-muted-foreground">{tr("Shipping branch network")}</p>
          </div>
        </Link>

        <Link
          href={"/dashboard/new-entry/users/registration" as Route}
          className="flex items-center gap-3 p-4 rounded-2xl border border-emerald-200/80 bg-emerald-50/40 hover:bg-emerald-50 transition-all text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300 shadow-xs"
        >
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-600 text-white shrink-0">
            <UserPlus className="h-5 w-5" />
          </div>
          <div>
            <p className="font-black text-xs leading-snug">{tr("New User")}</p>
            <p className="text-[10px] text-muted-foreground">{tr("Branch staff onboarding")}</p>
          </div>
        </Link>

        <Link
          href={"/dashboard/reports/country" as Route}
          className="flex items-center gap-3 p-4 rounded-2xl border border-amber-200/80 bg-amber-50/40 hover:bg-amber-50 transition-all text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300 shadow-xs"
        >
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-600 text-white shrink-0">
            <FileBarChart className="h-5 w-5" />
          </div>
          <div>
            <p className="font-black text-xs leading-snug">{tr("Country Reports")}</p>
            <p className="text-[10px] text-muted-foreground">{tr("National reports center")}</p>
          </div>
        </Link>
      </section>

      {/* 6. Country Branches Network Table */}
      <Card className="border-border/80 bg-card shadow-sm">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3">
          <div>
            <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
              <Building2 className="h-4 w-4 text-blue-600" />
              {tr("Shipping Line Branch Network")} ({data.branches.length})
            </CardTitle>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase">
              {tr("Operational status, branch admins, and active volume per branch")}
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder={tr("Search branch or city...")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-8 pl-8 pr-3 text-xs rounded-xl border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 border-y border-border/80 text-[10px] font-black uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">{tr("Branch Name")}</th>
                  <th className="px-3 py-3">{tr("City")}</th>
                  <th className="px-3 py-3">{tr("Code")}</th>
                  <th className="px-3 py-3 text-center">{tr("Active Shipments")}</th>
                  <th className="px-3 py-3 text-center">{tr("In Transit")}</th>
                  <th className="px-3 py-3 text-center">{tr("Arrived")}</th>
                  <th className="px-4 py-3 text-right">{tr("Actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredBranches.length > 0 ? (
                  filteredBranches.map((branch) => (
                    <tr key={branch.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-bold text-foreground">
                        <div className="flex items-center gap-2">
                          <Ship className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                          <span>{branch.name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-muted-foreground font-medium">{branch.cityName || "—"}</td>
                      <td className="px-3 py-3 font-mono font-bold">{branch.code}</td>
                      <td className="px-3 py-3 text-center font-bold text-blue-600 dark:text-blue-400">
                        {branch.activeShipments}
                      </td>
                      <td className="px-3 py-3 text-center font-bold text-cyan-600 dark:text-cyan-400">
                        {branch.inTransit}
                      </td>
                      <td className="px-3 py-3 text-center font-bold text-emerald-600 dark:text-emerald-400">
                        {branch.arrived}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          asChild
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2.5 rounded-lg text-xs font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        >
                          <Link href={`/dashboard/city/shipping-line?branchId=${branch.id}` as Route}>
                            <span>{tr("Open Branch")}</span>
                            <ArrowRight className="h-3 w-3 ms-1" />
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                      {tr("No shipping branches found in this country scope.")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 7. Bottom Country Badge */}
      <section className="flex items-center justify-between border-t border-border/80 pt-4 text-xs">
        <div className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50/60 px-3 py-1.5 font-bold text-indigo-900 dark:border-indigo-900/50 dark:bg-indigo-950/40 dark:text-indigo-300">
          <Globe2 className="h-4 w-4 text-indigo-600" />
          <span>{localizeCountryName(data.countryName, lang)} · {tr("Country Admin")}</span>
        </div>
        <p className="text-muted-foreground font-semibold text-[11px]">
          DGT LLC ERP SYSTEM • Version 1.0.0
        </p>
      </section>
    </div>
  );
}
