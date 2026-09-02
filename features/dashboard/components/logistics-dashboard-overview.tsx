"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  Boxes,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileText,
  Inbox,
  MapPinned,
  PackageCheck,
  Ship,
  ShieldCheck,
  Truck,
  ArrowRight
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Th } from "@/components/ui/translated-th";
import { t } from "@/lib/i18n/ui";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";

export type LogisticsShipment = {
  id: string;
  shippingLineName: string;
  blNumber: string;
  containerNumber: string;
  vesselName: string;
  eta: string;
  status: string;
};

export type LogisticsTask = {
  id: string;
  assignmentNo: string;
  title: string;
  message: string;
  status: string;
  dueAt: string;
  targetType: string;
};

export type LogisticsDashboardData = {
  assignedShipments: number;
  pendingClearance: number;
  inTransit: number;
  trackedContainers: number;
  documents: number;
  delivered: number;
  completedShipments: number;
  pendingTasks: number;
  notifications: number;
  shipments: LogisticsShipment[];
  tasks: LogisticsTask[];
  databaseReady: boolean;
  error?: string | null;
};

const statusColors = ["#2563eb", "#0f766e", "#f59e0b", "#dc2626", "#7c3aed"];

function formatStatus(status: string) {
  return (status || "pending")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusBadgeClass(status: string) {
  const normalized = (status || "").toLowerCase();
  if (["delivered", "cleared", "completed"].includes(normalized)) {
    return "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
  }
  if (["delayed", "overdue", "blocked"].includes(normalized)) {
    return "border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400";
  }
  if (["in_transit", "loaded", "sailing"].includes(normalized)) {
    return "border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400";
  }
  return "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400";
}

function KpiCard({ title, value, caption, icon: Icon, tone, href }: {
  title: string;
  value: number;
  caption: string;
  icon: React.ElementType;
  tone: string;
  href?: string;
}) {
  const body = (
    <div className="bg-card text-card-foreground border border-border/60 group-hover:border-cyan-500/40 p-4 rounded-2xl flex items-center justify-between shadow-sm transition-all group-hover:shadow-md group-hover:-translate-y-0.5 duration-200 h-full">
      <div className="flex items-start justify-between gap-3 w-full">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{title}</p>
          <p className="mt-2 text-2xl font-black text-foreground">{value}</p>
          <p className="mt-1 text-[10px] font-semibold text-muted-foreground">{caption}</p>
        </div>
        <span className={`grid h-10 w-10 place-items-center rounded-xl border border-border/50 bg-muted/40 shrink-0 ${tone}`}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </div>
  );
  if (href) {
    return (
      <Link href={href as any} className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50 rounded-2xl">
        {body}
      </Link>
    );
  }
  return <div className="group">{body}</div>;
}

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

export function LogisticsDashboardOverview({ data, canCreateShipment = false }: { data: LogisticsDashboardData; canCreateShipment?: boolean }) {
  const lang = useActiveLanguage();
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);
  const tt = (key: string, fallback: string) => t(lang, key as never, fallback);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const updateTheme = () => {
      setIsDark(document.documentElement.classList.contains("dark"));
    };
    updateTheme();
    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  // Single source of truth: charts render REAL values only. No mock fallbacks — when a
  // metric is 0 the chart reflects 0 and the empty-state renders, so cards, charts and
  // tables always reconcile against the same numbers.
  const statusData = [
    { name: tt("log.seg_assigned", "Assigned"), value: data.assignedShipments },
    { name: tt("log.seg_in_transit", "In Transit"), value: data.inTransit },
    { name: tt("log.seg_pending", "Pending"), value: data.pendingClearance },
    { name: tt("log.seg_delivered", "Delivered"), value: data.delivered },
    { name: tt("log.seg_tasks", "Tasks"), value: data.pendingTasks },
  ].filter((item) => item.value > 0);

  const trendData = [
    { name: tt("log.seg_assigned", "Assigned"), value: data.assignedShipments },
    { name: tt("log.seg_pending", "Pending"), value: data.pendingClearance },
    { name: tt("log.seg_tracking", "Tracking"), value: data.trackedContainers },
    { name: tt("log.seg_delivered", "Delivered"), value: data.delivered },
    { name: tt("log.seg_completed", "Completed"), value: data.completedShipments },
  ];
  const trendEmpty = trendData.every((d) => !d.value);

  const progressData = [
    { name: tt("log.seg_documents", "Documents"), value: data.documents },
    { name: tt("log.seg_containers", "Containers"), value: data.trackedContainers },
    { name: tt("log.seg_notifications", "Notifications"), value: data.notifications },
    { name: tt("log.seg_tasks", "Tasks"), value: data.pendingTasks },
  ];
  const progressEmpty = progressData.every((d) => !d.value);

  const quickActions = [
    { key: "log.qa_shipment_details", fallback: "Shipment Details", href: "/dashboard/shipping-line/shipment-details", icon: Ship },
    { key: "log.qa_shipment_report", fallback: "Shipment Report", href: "/dashboard/shipping-line/shipment-report", icon: FileText },
    { key: "log.qa_shipping_agent_entry", fallback: "Shipping Agent Entry", href: "/dashboard/shipping-line/agent-entry", icon: Truck },
    { key: "log.qa_agent_custom_entry", fallback: "Agent Custom Entry", href: "/dashboard/clearing-agent/agent-custom-entry", icon: ShieldCheck },
    { key: "log.qa_bill_entry", fallback: "Bill Entry", href: "/dashboard/clearing-agent/bill-entry", icon: ClipboardList },
    { key: "log.qa_payment_bill_entry", fallback: "Payment Bill Entry", href: "/dashboard/clearing-agent/payment-bill-entry", icon: PackageCheck },
  ];

  return (
    <div className="space-y-6 text-foreground p-4 lg:p-6 min-h-screen" dir={isRtl ? "rtl" : "ltr"}>
      {/* Header banner */}
      <section className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <div>
          <span className="inline-flex rounded-full border border-border bg-card px-2 py-0.5 text-[9px] font-bold text-blue-600 dark:text-blue-400 uppercase">
            {tt("log.command_center", "Logistics Command Center")}
          </span>
          <h1 className="text-2xl font-black text-foreground mt-1">{tt("log.dashboard_title", "Shipping & Clearance Dashboard")}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {tt("log.dashboard_subtitle", "Operational dashboard tracking live shipments, customs clearing, BL tasks and container locations.")}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card px-3.5 py-1.5 backdrop-blur shrink-0 flex items-center gap-3">
          <div>
            <p className="text-[9px] font-bold uppercase text-muted-foreground">{tt("log.live_shipments", "Live Shipments")}</p>
            <p className="font-mono text-xs font-black text-foreground">{data.assignedShipments}</p>
          </div>
          <div className="h-6 w-px bg-border" />
          <div>
            <p className="text-[9px] font-bold uppercase text-muted-foreground">{tt("log.pending_tasks", "Pending Tasks")}</p>
            <p className="font-mono text-xs font-black text-foreground">{data.pendingTasks}</p>
          </div>
        </div>
      </section>

      {!data.databaseReady && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3.5 text-xs font-medium text-amber-600 dark:text-amber-400">
          {tt("log.db_not_ready", "Logistics data tables are not fully ready yet. Showing the dashboard with available data.")}
          {data.error ? ` ${data.error}` : ""}
        </div>
      )}

      {/* Grid of 8 stats cards — clicking a card jumps to the matching module */}
      <section className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <KpiCard title={tt("log.kpi_assigned", "Assigned Shipments")} value={data.assignedShipments} caption={tt("log.cap_assigned", "Open logistics workload")} icon={Boxes} tone="text-blue-500 dark:text-blue-400" href="/dashboard/shipping-line/shipment-details" />
        <KpiCard title={tt("log.kpi_pending_clearance", "Pending Clearance")} value={data.pendingClearance} caption={tt("log.cap_pending_clearance", "Needs clearance action")} icon={AlertTriangle} tone="text-amber-600 dark:text-amber-400" href="/dashboard/clearing-agent/agent-custom-entry" />
        <KpiCard title={tt("log.kpi_shipping_status", "Shipping Status")} value={data.inTransit} caption={tt("log.cap_shipping_status", "Currently in transit")} icon={Ship} tone="text-purple-500 dark:text-purple-400" href="/dashboard/shipping-line/shipment-details" />
        <KpiCard title={tt("log.kpi_container_tracking", "Container Tracking")} value={data.trackedContainers} caption={tt("log.cap_container_tracking", "Containers with tracking")} icon={MapPinned} tone="text-emerald-600 dark:text-emerald-400" href="/dashboard/shipping-line/shipment-details" />
        <KpiCard title={tt("log.kpi_documents", "Documents")} value={data.documents} caption={tt("log.cap_documents", "BL and shipment records")} icon={FileText} tone="text-slate-500 dark:text-slate-400" href="/dashboard/shipping-line/shipment-report" />
        <KpiCard title={tt("log.kpi_delivery_status", "Delivery Status")} value={data.delivered} caption={tt("log.cap_delivery_status", "Delivered or released")} icon={CheckCircle2} tone="text-emerald-500 dark:text-emerald-400" href="/dashboard/shipping-line/shipment-details" />
        <KpiCard title={tt("log.kpi_completed", "Completed Shipments")} value={data.completedShipments} caption={tt("log.cap_completed", "Closed logistics files")} icon={PackageCheck} tone="text-blue-500 dark:text-blue-400" href="/dashboard/shipping-line/shipment-report" />
        <KpiCard title={tt("log.kpi_notifications", "Notifications")} value={data.notifications} caption={tt("log.cap_notifications", "Open system alerts")} icon={Bell} tone="text-rose-500 dark:text-rose-400" />
      </section>

      {/* Recharts graphic visualization row */}
      <section className="grid gap-6 md:grid-cols-3">
        {/* Shipment & Clearance Trend Area chart */}
        <Card className="border-border bg-card text-card-foreground shadow-lg col-span-1 md:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-blue-500" />
              {tt("log.trend_title", "Shipment & Clearance Trend")}
            </CardTitle>
            <p className="text-[9px] font-semibold text-muted-foreground uppercase">{tt("log.trend_subtitle", "Operational movement by current stage")}</p>
          </CardHeader>
          <CardContent>
            <div className="h-[230px] w-full">
              {trendEmpty ? (
                <EmptyChartState message={tt("log.no_data", "No data available")} height={230} />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <defs>
                      <linearGradient id="logisticsTrend" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0.01} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "hsl(var(--border))" : "#e2e8f0"} opacity={0.6} />
                    <XAxis dataKey="name" stroke="#94a3b8" tickLine={false} axisLine={false} style={{ fontSize: 9 }} />
                    <YAxis allowDecimals={false} stroke="#94a3b8" tickLine={false} axisLine={false} style={{ fontSize: 9 }} />
                    <Tooltip contentStyle={{ background: isDark ? "hsl(var(--card))" : "#fff", border: isDark ? "1px solid hsl(var(--border))" : "1px solid #e2e8f0", borderRadius: 8, color: isDark ? "hsl(var(--card-foreground))" : "#0f172a", fontSize: 10 }} />
                    <Area type="monotone" dataKey="value" stroke="#2563eb" fill="url(#logisticsTrend)" strokeWidth={2.5} name={tt("log.trend_title", "Shipment & Clearance Trend")} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Status Mix Donut */}
        <Card className="border-border bg-card text-card-foreground shadow-lg col-span-1 md:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
              <Activity className="h-4 w-4 text-cyan-500" />
              {tt("log.status_mix", "Status Mix")}
            </CardTitle>
            <p className="text-[9px] font-semibold text-muted-foreground uppercase">{tt("log.status_mix_subtitle", "Shipment status distribution")}</p>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center">
            <div className="h-[150px] w-full flex items-center justify-center relative">
              {statusData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusData} dataKey="value" innerRadius={40} outerRadius={60} paddingAngle={4}>
                      {statusData.map((entry, index) => (
                        <Cell key={entry.name} fill={statusColors[index % statusColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: isDark ? "hsl(var(--card))" : "#fff", border: isDark ? "1px solid hsl(var(--border))" : "1px solid #e2e8f0", borderRadius: 8, color: isDark ? "hsl(var(--card-foreground))" : "#0f172a", fontSize: 9 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChartState message={tt("log.no_data", "No data available")} height={150} />
              )}
            </div>
            {statusData.length > 0 && (
              <div className="grid grid-cols-2 gap-2 text-[9px] font-semibold text-muted-foreground mt-2">
                {statusData.map((entry, index) => (
                  <div key={entry.name} className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: statusColors[index % statusColors.length] }} />
                    <span>{entry.name}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions Links */}
        <Card className="border-border bg-card text-card-foreground shadow-lg col-span-1 md:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-indigo-500" />
              {tt("dash.quick_actions", "Quick Actions")}
            </CardTitle>
            <p className="text-[9px] font-semibold text-muted-foreground uppercase">{tt("log.quick_actions_subtitle", "Common logistics workflows")}</p>
          </CardHeader>
          <CardContent className="space-y-2">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.href}
                  href={action.href as any}
                  className="group flex items-center justify-between rounded-xl border border-border bg-muted/40 p-2.5 text-xs transition hover:bg-muted text-foreground"
                >
                  <span className="flex items-center gap-2.5 font-bold group-hover:text-primary">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    {tt(action.key, action.fallback)}
                  </span>
                  <ArrowRight className={`h-3.5 w-3.5 text-muted-foreground transition group-hover:translate-x-0.5 ${isRtl ? "rotate-180" : ""}`} />
                </Link>
              );
            })}
          </CardContent>
        </Card>
      </section>

      {/* Grid of details tables */}
      <section className="grid gap-6 xl:grid-cols-[1.35fr_0.8fr]">
        {/* Shipment operations */}
        <Card className="border-border bg-card text-card-foreground shadow-lg">
          <CardHeader className="pb-2 border-b border-border">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                <Ship className="h-4 w-4 text-emerald-500" />
                {tt("log.shipment_operations", "Shipment Operations")}
              </CardTitle>
              {canCreateShipment && (
                <Link
                  href="/dashboard/shipping-line/shipment-details"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 transition-colors"
                >
                  <span className="text-sm leading-none">+</span> {tt("log.create_shipment", "Create Shipment")}
                </Link>
              )}
            </div>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] text-start">
              <thead>
                <tr className="bg-muted/40 text-[9px] uppercase font-bold text-muted-foreground">
                  <Th className="px-4 py-3 text-start">{tt("log.tbl_bl_no", "BL No")}</Th>
                  <Th className="px-4 py-3 text-start">{tt("log.tbl_shipping_line", "Shipping Line")}</Th>
                  <Th className="px-4 py-3 text-start">{tt("log.tbl_container", "Container")}</Th>
                  <Th className="px-4 py-3 text-start">{tt("log.tbl_vessel", "Vessel")}</Th>
                  <Th className="px-4 py-3 text-start">{tt("log.tbl_eta", "ETA")}</Th>
                  <Th className="px-4 py-3 text-center">{tt("log.tbl_status", "Status")}</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.shipments.length ? (
                  data.shipments.map((shipment) => (
                    <tr key={shipment.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-blue-500 dark:text-blue-400">{shipment.blNumber || "-"}</td>
                      <td className="px-4 py-3 font-semibold text-foreground/90">{shipment.shippingLineName || "-"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{shipment.containerNumber || "-"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{shipment.vesselName || "-"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{shipment.eta || "-"}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[9px] font-black uppercase ${statusBadgeClass(shipment.status)}`}>
                          {formatStatus(shipment.status)}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center">
                      <p className="text-muted-foreground font-semibold">{tt("log.no_shipments", "No logistics shipments found yet.")}</p>
                      {canCreateShipment && (
                        <Link
                          href="/dashboard/shipping-line/shipment-details"
                          className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition-colors"
                        >
                          <span className="text-sm leading-none">+</span> {tt("log.create_shipment", "Create Shipment")}
                        </Link>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Pending tasks */}
        <Card className="border-border bg-card text-card-foreground shadow-lg">
          <CardHeader className="pb-2 border-b border-border">
            <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
              <Clock className="h-4 w-4 text-rose-500" />
              {tt("log.pending_tasks", "Pending Tasks")}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="space-y-3 max-h-[300px] overflow-auto">
              {data.tasks.length ? (
                data.tasks.map((task) => (
                  <div key={task.id} className="rounded-xl border border-border bg-muted/20 p-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-black text-foreground/90">{task.title || task.assignmentNo || tt("log.assignment", "Assignment")}</p>
                        <p className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-muted-foreground">{task.message || task.targetType || tt("log.pending_task_fallback", "Pending logistics task")}</p>
                      </div>
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-black uppercase ${statusBadgeClass(task.status)}`}>
                        {formatStatus(task.status)}
                      </span>
                    </div>
                    <p className="mt-3.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                      {tt("log.due", "Due")}: {task.dueAt || tt("log.not_scheduled", "Not scheduled")}
                    </p>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-border p-6 text-center">
                  <CheckCircle2 className="mx-auto h-7 w-7 text-emerald-500" />
                  <p className="mt-2.5 text-xs font-black text-foreground/90">{tt("log.no_pending_tasks", "No pending tasks")}</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">{tt("log.new_assignments_appear", "New assignments will appear here.")}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Bar chart for containers, alerts */}
      <Card className="border-border bg-card text-card-foreground shadow-lg">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
            <FileText className="h-4 w-4 text-cyan-500" />
            {tt("log.docs_containers_alerts", "Documents, Containers & Alerts")}
          </CardTitle>
          <p className="text-[9px] font-semibold text-muted-foreground uppercase">{tt("log.docs_containers_subtitle", "Logistics database record count metrics")}</p>
        </CardHeader>
        <CardContent>
          <div className="h-[180px] w-full">
            {progressEmpty ? (
              <EmptyChartState message={tt("log.no_data", "No data available")} height={180} />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={progressData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "hsl(var(--border))" : "#e2e8f0"} opacity={0.6} />
                  <XAxis dataKey="name" stroke="#94a3b8" tickLine={false} axisLine={false} style={{ fontSize: 9 }} />
                  <YAxis allowDecimals={false} stroke="#94a3b8" tickLine={false} axisLine={false} style={{ fontSize: 9 }} />
                  <Tooltip contentStyle={{ background: isDark ? "hsl(var(--card))" : "#fff", border: isDark ? "1px solid hsl(var(--border))" : "1px solid #e2e8f0", borderRadius: 8, color: isDark ? "hsl(var(--card-foreground))" : "#0f172a", fontSize: 9 }} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]} fill="#0f766e" name={tt("log.docs_containers_alerts", "Documents, Containers & Alerts")} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
