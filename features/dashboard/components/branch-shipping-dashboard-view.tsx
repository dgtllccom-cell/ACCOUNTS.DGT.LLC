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
  AlertTriangle,
  Anchor,
  ArrowRight,
  Boxes,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Compass,
  FileCheck2,
  FileSpreadsheet,
  FileText,
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
import { useActiveLanguage } from "@/lib/i18n/use-active-language";

export type BranchShippingData = {
  branchId: string;
  branchName: string;
  branchCode: string;
  countryName: string;
  currency: string;
  todayRoznamchaCount: number;
  totalShipments: number;
  inTransitCount: number;
  arrivedCount: number;
  pendingCount: number;
  delayedCount: number;
  cashBalance: number;
  bankBalance: number;
  statusBreakdown: { name: string; value: number; color: string }[];
  portWiseShipments: { port: string; shipments: number; volume: number }[];
  recentShipments: {
    id: string;
    blNumber: string;
    vesselName: string;
    voyageNumber?: string;
    portOfDischarge: string;
    status: string;
    eta?: string;
    containerCount?: number;
    customerName?: string;
  }[];
  ledgers: {
    id: string;
    name: string;
    code: string;
    current_balance: number;
    currency: string;
  }[];
  isBranchAdmin?: boolean;
  canSwitchToBusiness?: boolean;
};

const CHART_COLORS = ["#2563eb", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

function formatMoney(value: number, currency = "PKR") {
  return `${currency} ${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value || 0)}`;
}

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

export function BranchShippingDashboardView({ data }: { data: BranchShippingData }) {
  const lang = useActiveLanguage();
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);
  const tr = (s: string) => translateHeader(lang, s);

  const [mounted, setMounted] = useState(false);
  const [isDark, setIsDark] = useState(false);

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

  const todayDateString = useMemo(() => {
    try {
      const now = new Date();
      return new Intl.DateTimeFormat(lang === "ur" ? "ur-PK" : lang === "ar" ? "ar-AE" : "en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric"
      }).format(now);
    } catch {
      return "24 Oct 2026";
    }
  }, [lang]);

  // Chart data
  const statusData = useMemo(() => {
    const list = data.statusBreakdown && data.statusBreakdown.length > 0
      ? data.statusBreakdown
      : [
          { name: tr("In Transit"), value: data.inTransitCount || 0, color: "#2563eb" },
          { name: tr("Arrived"), value: data.arrivedCount || 0, color: "#10b981" },
          { name: tr("Pending"), value: data.pendingCount || 0, color: "#f59e0b" },
          { name: tr("Delayed"), value: data.delayedCount || 0, color: "#ef4444" }
        ];
    return list;
  }, [data.statusBreakdown, data.inTransitCount, data.arrivedCount, data.pendingCount, data.delayedCount, lang]);

  const totalStatusCount = useMemo(() => {
    return statusData.reduce((acc, curr) => acc + (curr.value || 0), 0);
  }, [statusData]);

  const portData = useMemo(() => {
    if (data.portWiseShipments && data.portWiseShipments.length > 0) {
      return data.portWiseShipments.map((p) => ({
        port: tr(p.port),
        shipments: p.shipments,
        volume: p.volume
      }));
    }
    return [
      { port: tr("Karachi"), shipments: 0, volume: 0 },
      { port: tr("Gwadar"), shipments: 0, volume: 0 },
      { port: tr("Jebel Ali"), shipments: 0, volume: 0 },
      { port: tr("Bandar Abbas"), shipments: 0, volume: 0 },
      { port: tr("Other"), shipments: 0, volume: 0 }
    ];
  }, [data.portWiseShipments, lang]);

  return (
    <div className="space-y-6 text-foreground p-3 sm:p-5 lg:p-6 min-h-screen" dir={isRtl ? "rtl" : "ltr"}>
      {/* 1. Header Bar: Branch Title + Switcher + Localized Date */}
      <section className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-b border-border/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-500/20 shrink-0">
            <Ship className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
                {data.branchName}
              </h1>
              <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[10px] font-black uppercase text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300">
                <Anchor className="h-3 w-3" />
                {tr("Shipping Line Dashboard")}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {tr("Operational view for branch shipments, vessel tracking, port clearance, and branch ledgers.")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {data.canSwitchToBusiness && (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-8 rounded-xl border-slate-200 bg-white font-bold text-xs hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
            >
              <Link href={`/dashboard/city?branchId=${data.branchId}` as Route}>
                <Building2 className="h-3.5 w-3.5 text-amber-600 me-1.5" />
                {tr("Business Dashboard")}
              </Link>
            </Button>
          )}

          <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-1.5 shadow-2xs">
            <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span className="text-xs font-bold text-foreground">{todayDateString}</span>
          </div>
        </div>
      </section>

      {/* 2. Hero Banner: Maritime Container Ship Theme */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#061838] via-[#0b285a] to-[#0a3875] text-white p-6 sm:p-8 shadow-xl border border-blue-900/40">
        <div
          className="absolute inset-0 opacity-25 mix-blend-luminosity bg-cover bg-center pointer-events-none"
          style={{ backgroundImage: `url('/images/shipping_port_hero.jpg'), url('/public/images/shipping_port_hero.jpg')` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#061838]/90 via-transparent to-transparent pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-2xl space-y-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/20 px-3 py-1 text-[11px] font-bold text-blue-200 backdrop-blur-md border border-blue-400/30">
              <Ship className="h-3.5 w-3.5 text-blue-300" />
              {tr("Welcome to")} {data.branchName}
            </span>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white drop-shadow-sm">
              {data.branchName}
            </h2>
            <p className="text-sm text-blue-100/90 leading-relaxed">
              {tr("Manage your branch shipping operations, vessel tracking, customs clearance, handovers and local ledger standing from here.")}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <div className="rounded-2xl border border-white/10 bg-white/10 backdrop-blur-md px-4 py-2.5 text-center min-w-[90px]">
              <p className="text-[10px] font-bold uppercase tracking-wider text-blue-200">{tr("Branch Code")}</p>
              <p className="font-mono text-sm font-black text-white mt-0.5">{data.branchCode || "BR"}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 backdrop-blur-md px-4 py-2.5 text-center min-w-[90px]">
              <p className="text-[10px] font-bold uppercase tracking-wider text-blue-200">{tr("Base Currency")}</p>
              <p className="font-mono text-sm font-black text-white mt-0.5">{data.currency || "PKR"}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 backdrop-blur-md px-4 py-2.5 text-center min-w-[90px]">
              <p className="text-[10px] font-bold uppercase tracking-wider text-blue-200">{tr("Country")}</p>
              <p className="text-sm font-black text-white mt-0.5">{data.countryName || "Pakistan"}</p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. 4 Standard KPI Stat Cards (Matching Image 2 Design 1) */}
      <section className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Today's Postings */}
        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{tr("Today's Postings")}</p>
              <p className="mt-2 text-2xl sm:text-3xl font-black tracking-tight text-foreground">{data.todayRoznamchaCount || 0}</p>
              <p className="mt-1 text-xs text-muted-foreground/80 font-medium">{tr("Roznamcha entries")}</p>
            </div>
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-600 border border-blue-200 dark:bg-blue-950/40 dark:border-blue-900 dark:text-blue-300 shrink-0">
              <FileText className="h-5 w-5" />
            </span>
          </div>
        </div>

        {/* Card 2: Shipments */}
        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{tr("Shipments")}</p>
              <p className="mt-2 text-2xl sm:text-3xl font-black tracking-tight text-foreground">{data.totalShipments || 0}</p>
              <p className="mt-1 text-xs text-muted-foreground/80 font-medium">{tr("Total shipments")}</p>
            </div>
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-50 text-cyan-600 border border-cyan-200 dark:bg-cyan-950/40 dark:border-cyan-900 dark:text-cyan-300 shrink-0">
              <Ship className="h-5 w-5" />
            </span>
          </div>
        </div>

        {/* Card 3: In Transit */}
        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{tr("In Transit")}</p>
              <p className="mt-2 text-2xl sm:text-3xl font-black tracking-tight text-foreground">{data.inTransitCount || 0}</p>
              <p className="mt-1 text-xs text-muted-foreground/80 font-medium">{tr("Active shipments")}</p>
            </div>
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-200 dark:bg-indigo-950/40 dark:border-indigo-900 dark:text-indigo-300 shrink-0">
              <Truck className="h-5 w-5" />
            </span>
          </div>
        </div>

        {/* Card 4: Arrived */}
        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{tr("Arrived")}</p>
              <p className="mt-2 text-2xl sm:text-3xl font-black tracking-tight text-foreground">{data.arrivedCount || 0}</p>
              <p className="mt-1 text-xs text-muted-foreground/80 font-medium">{tr("This month")}</p>
            </div>
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-900 dark:text-emerald-300 shrink-0">
              <CheckCircle2 className="h-5 w-5" />
            </span>
          </div>
        </div>
      </section>

      {/* 4. Visual Graphics Row: Shipment Status (Donut) & Port Wise Shipments (Bar) */}
      <section className="grid gap-6 lg:grid-cols-2">
        {/* Left: Shipment Status Donut */}
        <Card className="border-border bg-card text-card-foreground shadow-sm">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                <Compass className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                {tr("Shipment Status")}
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">{tr("Live lifecycle breakdown across assigned shipping records")}</p>
            </div>
            <span className="font-mono text-xs font-bold text-muted-foreground">
              {tr("Total")}: {totalStatusCount}
            </span>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-[1.2fr_1fr] items-center gap-4">
              <div className="h-[210px] w-full flex items-center justify-center relative">
                {!mounted ? null : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={55}
                        outerRadius={80}
                        paddingAngle={3}
                      >
                        {statusData.map((entry, index) => (
                          <Cell key={entry.name} fill={entry.color || CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: isDark ? "hsl(var(--card))" : "#fff",
                          border: isDark ? "1px solid hsl(var(--border))" : "1px solid #e2e8f0",
                          borderRadius: 8,
                          fontSize: 11
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-black tracking-tight text-foreground">{totalStatusCount}</span>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">{tr("Shipments")}</span>
                </div>
              </div>

              <div className="space-y-2 text-xs font-medium">
                {statusData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between p-2 rounded-lg bg-muted/40 border border-border/60">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="text-foreground">{item.name}</span>
                    </div>
                    <span className="font-mono font-bold text-foreground">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right: Port Wise Shipments Bar Chart */}
        <Card className="border-border bg-card text-card-foreground shadow-sm">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                <Anchor className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                {tr("Port Wise Shipments")}
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">{tr("Distribution of active cargo by major destination ports")}</p>
            </div>
            <span className="text-xs font-semibold text-muted-foreground">{data.currency}</span>
          </CardHeader>
          <CardContent>
            <div className="h-[210px] w-full">
              {!mounted ? null : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={portData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "hsl(var(--border))" : "#e2e8f0"} opacity={0.6} />
                    <XAxis dataKey="port" stroke="#94a3b8" tickLine={false} axisLine={false} style={{ fontSize: 10 }} />
                    <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} style={{ fontSize: 10 }} />
                    <Tooltip
                      formatter={(val: any) => [val, tr("Shipments")]}
                      contentStyle={{
                        background: isDark ? "hsl(var(--card))" : "#fff",
                        border: isDark ? "1px solid hsl(var(--border))" : "1px solid #e2e8f0",
                        borderRadius: 8,
                        fontSize: 11
                      }}
                    />
                    <Bar dataKey="shipments" radius={[6, 6, 0, 0]}>
                      {portData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* 5. Quick Access Shortcuts Grid */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Activity className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            {tr("Quick Access — Branch Shipping Operations")}
          </h2>
        </div>

        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {/* Tracking */}
          <Link
            href="/dashboard/shipping-line/tracking"
            className="group flex flex-col justify-between rounded-2xl border border-border bg-card p-4 hover:border-blue-500/50 hover:shadow-md transition-all"
          >
            <div className="flex items-center justify-between">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300">
                <Compass className="h-5 w-5" />
              </span>
              <ArrowRight className={`h-4 w-4 text-muted-foreground group-hover:text-blue-600 group-hover:translate-x-1 transition-all ${isRtl ? "rotate-180 group-hover:-translate-x-1" : ""}`} />
            </div>
            <div className="mt-3">
              <p className="font-bold text-sm text-foreground group-hover:text-blue-600 transition-colors">{tr("Shipping Tracking")}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{tr("Live container & vessel track")}</p>
            </div>
          </Link>

          {/* Cash Entry */}
          <Link
            href="/dashboard/roznamcha/cash-entry"
            className="group flex flex-col justify-between rounded-2xl border border-border bg-card p-4 hover:border-blue-500/50 hover:shadow-md transition-all"
          >
            <div className="flex items-center justify-between">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300">
                <Wallet className="h-5 w-5" />
              </span>
              <ArrowRight className={`h-4 w-4 text-muted-foreground group-hover:text-emerald-600 group-hover:translate-x-1 transition-all ${isRtl ? "rotate-180 group-hover:-translate-x-1" : ""}`} />
            </div>
            <div className="mt-3">
              <p className="font-bold text-sm text-foreground group-hover:text-emerald-600 transition-colors">{tr("Cash Entry")}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{tr("Post branch payment or receipt")}</p>
            </div>
          </Link>

          {/* Handover & Transfer */}
          <Link
            href="/dashboard/transfer-center"
            className="group flex flex-col justify-between rounded-2xl border border-border bg-card p-4 hover:border-blue-500/50 hover:shadow-md transition-all"
          >
            <div className="flex items-center justify-between">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-300">
                <Inbox className="h-5 w-5" />
              </span>
              <ArrowRight className={`h-4 w-4 text-muted-foreground group-hover:text-purple-600 group-hover:translate-x-1 transition-all ${isRtl ? "rotate-180 group-hover:-translate-x-1" : ""}`} />
            </div>
            <div className="mt-3">
              <p className="font-bold text-sm text-foreground group-hover:text-purple-600 transition-colors">{tr("Handover Center")}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{tr("Inter-branch handovers & transfers")}</p>
            </div>
          </Link>

          {/* Branch Reports */}
          <Link
            href="/dashboard/reports/branch-reports"
            className="group flex flex-col justify-between rounded-2xl border border-border bg-card p-4 hover:border-blue-500/50 hover:shadow-md transition-all"
          >
            <div className="flex items-center justify-between">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300">
                <FileSpreadsheet className="h-5 w-5" />
              </span>
              <ArrowRight className={`h-4 w-4 text-muted-foreground group-hover:text-amber-600 group-hover:translate-x-1 transition-all ${isRtl ? "rotate-180 group-hover:-translate-x-1" : ""}`} />
            </div>
            <div className="mt-3">
              <p className="font-bold text-sm text-foreground group-hover:text-amber-600 transition-colors">{tr("Branch Reports")}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{tr("Shipments, clearing & ledger statements")}</p>
            </div>
          </Link>

          {/* Ledger Report */}
          <Link
            href="/dashboard/ledger/general-report"
            className="group flex flex-col justify-between rounded-2xl border border-border bg-card p-4 hover:border-blue-500/50 hover:shadow-md transition-all"
          >
            <div className="flex items-center justify-between">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-50 text-cyan-600 dark:bg-cyan-950/40 dark:text-cyan-300">
                <Receipt className="h-5 w-5" />
              </span>
              <ArrowRight className={`h-4 w-4 text-muted-foreground group-hover:text-cyan-600 group-hover:translate-x-1 transition-all ${isRtl ? "rotate-180 group-hover:-translate-x-1" : ""}`} />
            </div>
            <div className="mt-3">
              <p className="font-bold text-sm text-foreground group-hover:text-cyan-600 transition-colors">{tr("Ledger Report")}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{tr("Review branch ledger statement")}</p>
            </div>
          </Link>

          {/* User Permission Management (for Branch Admin) */}
          <Link
            href="/dashboard/branch-management/permissions"
            className="group flex flex-col justify-between rounded-2xl border border-blue-200/80 bg-blue-50/50 p-4 hover:border-blue-500 hover:shadow-md transition-all dark:border-blue-900/40 dark:bg-blue-950/20"
          >
            <div className="flex items-center justify-between">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-600 text-white shadow-xs">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <ArrowRight className={`h-4 w-4 text-blue-600 group-hover:translate-x-1 transition-all ${isRtl ? "rotate-180 group-hover:-translate-x-1" : ""}`} />
            </div>
            <div className="mt-3">
              <p className="font-bold text-sm text-foreground group-hover:text-blue-600 transition-colors">{tr("User Permissions")}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{tr("Branch users & module rights")}</p>
            </div>
          </Link>
        </div>
      </section>

      {/* 6. Operational Data Tables: Recent Shipments & Branch Ledgers */}
      <section className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        {/* Recent Branch Shipments */}
        <Card className="border-border bg-card text-card-foreground shadow-sm overflow-hidden">
          <CardHeader className="pb-3 border-b border-border flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Ship className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <CardTitle className="text-sm font-bold text-foreground">{tr("Recent Branch Shipments")}</CardTitle>
            </div>
            <Link
              href="/dashboard/shipping-line/tracking"
              className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
            >
              {tr("View All")} <ArrowRight className={`h-3 w-3 ${isRtl ? "rotate-180" : ""}`} />
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 border-b border-border text-[10px] font-black uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5">{tr("BL / REF NO")}</th>
                    <th className="px-4 py-2.5">{tr("VESSEL / CARGO")}</th>
                    <th className="px-4 py-2.5">{tr("DESTINATION PORT")}</th>
                    <th className="px-4 py-2.5">{tr("STATUS")}</th>
                    <th className="px-4 py-2.5 text-right">{tr("ACTION")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.recentShipments && data.recentShipments.length > 0 ? (
                    data.recentShipments.map((s) => (
                      <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-foreground">
                          {s.blNumber}
                          {s.customerName && <p className="font-sans text-[10px] text-muted-foreground font-normal">{s.customerName}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-foreground">{s.vesselName}</p>
                          {s.voyageNumber && <p className="font-mono text-[10px] text-muted-foreground">Voy: {s.voyageNumber}</p>}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground font-medium">{s.portOfDischarge || "-"}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={s.status} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button asChild size="sm" variant="ghost" className="h-7 text-xs font-bold text-blue-600 hover:text-blue-700">
                            <Link href={`/dashboard/shipping-line/tracking?id=${s.id}` as Route}>
                              <Compass className="h-3.5 w-3.5 me-1" />
                              {tr("Track")}
                            </Link>
                          </Button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-xs text-muted-foreground">
                        <Inbox className="h-6 w-6 mx-auto text-muted-foreground/40 mb-1" />
                        {tr("No recent shipments recorded in this branch scope.")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Branch Cash, Bank & Ledger Standing */}
        <Card className="border-border bg-card text-card-foreground shadow-sm overflow-hidden">
          <CardHeader className="pb-3 border-b border-border flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Landmark className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <CardTitle className="text-sm font-bold text-foreground">{tr("Cash, Bank & Ledger Status")}</CardTitle>
            </div>
            <Link
              href="/dashboard/ledger/general-report"
              className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
            >
              {tr("Ledgers")} <ArrowRight className={`h-3 w-3 ${isRtl ? "rotate-180" : ""}`} />
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border max-h-[300px] overflow-y-auto">
              {data.ledgers && data.ledgers.length > 0 ? (
                data.ledgers.map((l) => (
                  <div key={l.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors">
                    <div>
                      <p className="text-xs font-bold text-foreground">{l.name}</p>
                      <p className="font-mono text-[10px] text-muted-foreground">{l.code}</p>
                    </div>
                    <p className={`font-mono text-xs font-black ${l.current_balance >= 0 ? "text-foreground" : "text-rose-600"}`}>
                      {formatMoney(l.current_balance, l.currency || data.currency)}
                    </p>
                  </div>
                ))
              ) : (
                <div className="px-4 py-8 text-center text-xs text-muted-foreground">
                  <Landmark className="h-6 w-6 mx-auto text-muted-foreground/40 mb-1" />
                  {tr("No ledgers assigned to this branch.")}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* 7. Bottom Badge: Reusable Branch Indicator */}
      <footer className="pt-2 flex items-center justify-between border-t border-border/60 text-xs text-muted-foreground">
        <div className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-1.5 shadow-2xs">
          <Building2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <span className="font-bold text-foreground">{data.branchName}</span>
          <span className="text-muted-foreground">•</span>
          <span className="font-semibold text-blue-600 dark:text-blue-400">{tr("Shipping Line")}</span>
        </div>
        <div className="text-[11px] font-mono">
          DGT LLC ERP SYSTEM • v2.0
        </div>
      </footer>
    </div>
  );
}
