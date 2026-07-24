"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Boxes,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileText,
  MapPinned,
  PackageCheck,
  RefreshCw,
  Search,
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

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

const quickActions = [
  { label: "Shipment Details", href: "/dashboard/shipping-line/shipment-details", icon: Ship },
  { label: "Shipment Report", href: "/dashboard/shipping-line/shipment-report", icon: FileText },
  { label: "Shipping Agent Entry", href: "/dashboard/shipping-line/agent-entry", icon: Truck },
  { label: "Agent Custom Entry", href: "/dashboard/clearing-agent/agent-custom-entry", icon: ShieldCheck },
  { label: "Bill Entry", href: "/dashboard/clearing-agent/bill-entry", icon: ClipboardList },
  { label: "Payment Bill Entry", href: "/dashboard/clearing-agent/payment-bill-entry", icon: PackageCheck },
];

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

function KpiCard({ title, value, caption, icon: Icon, tone }: {
  title: string;
  value: number;
  caption: string;
  icon: React.ElementType;
  tone: string;
}) {
  return (
    <div className="bg-card text-card-foreground border border-border hover:border-border/80 p-4 rounded-2xl flex items-center justify-between shadow-lg transition-transform hover:-translate-y-0.5 duration-200">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{title}</p>
          <p className="mt-2.5 text-xl font-black text-foreground">{value}</p>
          <p className="mt-1 text-[10px] font-semibold text-muted-foreground">{caption}</p>
        </div>
        <span className={`grid h-9 w-9 place-items-center rounded-xl border border-border bg-muted shrink-0 ${tone}`}>
          <Icon className="h-4.5 w-4.5" />
        </span>
      </div>
    </div>
  );
}

function StatusBadge({ value }: { value: string | null }) {
  const normalized = (value || "draft").toLowerCase();
  const tone = normalized === "posted" || normalized === "approved" || normalized === "completed"
    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
    : normalized === "pending" || normalized === "draft"
      ? "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400"
      : "border-border bg-muted text-muted-foreground";
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase ${tone}`}>{value || "Draft"}</span>;
}

export function LogisticsDashboardOverview({ data }: { data: LogisticsDashboardData }) {
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

  const statusData = [
    { name: "Assigned", value: data.assignedShipments },
    { name: "In Transit", value: data.inTransit },
    { name: "Pending", value: data.pendingClearance },
    { name: "Delivered", value: data.delivered },
    { name: "Tasks", value: data.pendingTasks },
  ].filter((item) => item.value > 0);

  const trendData = [
    { name: "Assigned", value: data.assignedShipments || 8 },
    { name: "Pending", value: data.pendingClearance || 5 },
    { name: "Tracking", value: data.trackedContainers || 6 },
    { name: "Delivered", value: data.delivered || 4 },
    { name: "Completed", value: data.completedShipments || 12 },
  ];

  const progressData = [
    { name: "Documents", value: data.documents || 8 },
    { name: "Containers", value: data.trackedContainers || 6 },
    { name: "Notifications", value: data.notifications || 3 },
    { name: "Tasks", value: data.pendingTasks || 4 },
  ];

  return (
    <div className="space-y-6 text-foreground p-4 lg:p-6 min-h-screen">
      {/* Header banner */}
      <section className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <div>
          <span className="inline-flex rounded-full border border-border bg-card px-2 py-0.5 text-[9px] font-bold text-blue-600 dark:text-blue-400 uppercase">
            Logistics Command Center
          </span>
          <h1 className="text-2xl font-black text-foreground mt-1">Shipping & Clearance Dashboard</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Operational dashboard tracking live shipments, customs clearing processes, BL tasks and container locations.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card px-3.5 py-1.5 backdrop-blur shrink-0 flex items-center gap-3">
          <div>
            <p className="text-[9px] font-bold uppercase text-muted-foreground">Live Shipments</p>
            <p className="font-mono text-xs font-black text-foreground">{data.assignedShipments}</p>
          </div>
          <div className="h-6 w-px bg-border" />
          <div>
            <p className="text-[9px] font-bold uppercase text-muted-foreground">Pending Tasks</p>
            <p className="font-mono text-xs font-black text-foreground">{data.pendingTasks}</p>
          </div>
        </div>
      </section>

      {!data.databaseReady && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3.5 text-xs font-medium text-amber-600 dark:text-amber-400">
          Logistics data tables are not fully ready yet. Showing the dashboard shell with available data.
          {data.error ? ` ${data.error}` : ""}
        </div>
      )}

      {/* Grid of 8 stats cards */}
      <section className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <KpiCard title="Assigned Shipments" value={data.assignedShipments} caption="Open logistics workload" icon={Boxes} tone="text-blue-500 dark:text-blue-400" />
        <KpiCard title="Pending Clearance" value={data.pendingClearance} caption="Needs clearance action" icon={AlertTriangle} tone="text-amber-600 dark:text-amber-400" />
        <KpiCard title="Shipping Status" value={data.inTransit} caption="Currently in transit" icon={Ship} tone="text-purple-500 dark:text-purple-400" />
        <KpiCard title="Container Tracking" value={data.trackedContainers} caption="Containers with tracking" icon={MapPinned} tone="text-emerald-600 dark:text-emerald-400" />
        <KpiCard title="Documents" value={data.documents} caption="BL and shipment records" icon={FileText} tone="text-slate-500 dark:text-slate-400" />
        <KpiCard title="Delivery Status" value={data.delivered} caption="Delivered or released" icon={CheckCircle2} tone="text-emerald-500 dark:text-emerald-400" />
        <KpiCard title="Completed Shipments" value={data.completedShipments} caption="Closed logistics files" icon={PackageCheck} tone="text-blue-500 dark:text-blue-400" />
        <KpiCard title="Notifications" value={data.notifications} caption="Open system alerts" icon={Bell} tone="text-rose-500 dark:text-rose-400" />
      </section>

      {/* Recharts graphic visualization row */}
      <section className="grid gap-6 md:grid-cols-3">
        {/* Shipment & Clearance Trend Area chart */}
        <Card className="border-border bg-card text-card-foreground shadow-lg col-span-1 md:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-blue-500" />
              Shipment & Clearance Trend
            </CardTitle>
            <p className="text-[9px] font-semibold text-muted-foreground uppercase">Operational movement by current stage</p>
          </CardHeader>
          <CardContent>
            <div className="h-[230px] w-full">
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
                  <Area type="monotone" dataKey="value" stroke="#2563eb" fill="url(#logisticsTrend)" strokeWidth={2.5} name="Workload" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Status Mix Donut */}
        <Card className="border-border bg-card text-card-foreground shadow-lg col-span-1 md:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
              <Activity className="h-4 w-4 text-cyan-500" />
              Status Mix
            </CardTitle>
            <p className="text-[9px] font-semibold text-muted-foreground uppercase">Shipment status distribution</p>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center">
            <div className="h-[150px] w-full flex items-center justify-center relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusData.length ? statusData : [{ name: "No Data", value: 1 }]} dataKey="value" innerRadius={40} outerRadius={60} paddingAngle={4}>
                    {(statusData.length ? statusData : [{ name: "No Data", value: 1 }]).map((entry, index) => (
                      <Cell key={entry.name} fill={statusData.length ? statusColors[index % statusColors.length] : "#cbd5e1"} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: isDark ? "hsl(var(--card))" : "#fff", border: isDark ? "1px solid hsl(var(--border))" : "1px solid #e2e8f0", borderRadius: 8, color: isDark ? "hsl(var(--card-foreground))" : "#0f172a", fontSize: 9 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[9px] font-semibold text-muted-foreground mt-2">
              {statusData.map((entry, index) => (
                <div key={entry.name} className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: statusColors[index % statusColors.length] }} />
                  <span>{entry.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions Links */}
        <Card className="border-border bg-card text-card-foreground shadow-lg col-span-1 md:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-indigo-500" />
              Quick Actions
            </CardTitle>
            <p className="text-[9px] font-semibold text-muted-foreground uppercase">Common logistics workflows</p>
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
                    {action.label}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground transition group-hover:translate-x-0.5" />
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
            <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
              <Ship className="h-4 w-4 text-emerald-500" />
              Shipment Operations
            </CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] text-left">
              <thead>
                <tr className="bg-muted/40 text-[9px] uppercase font-bold text-muted-foreground">
                  <th className="px-4 py-3">BL No</th>
                  <th className="px-4 py-3">Shipping Line</th>
                  <th className="px-4 py-3">Container</th>
                  <th className="px-4 py-3">Vessel</th>
                  <th className="px-4 py-3">ETA</th>
                  <th className="px-4 py-3 text-center">Status</th>
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
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground font-semibold">
                      No logistics shipments found yet.
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
              Pending Tasks
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="space-y-3 max-h-[300px] overflow-auto">
              {data.tasks.length ? (
                data.tasks.map((task) => (
                  <div key={task.id} className="rounded-xl border border-border bg-muted/20 p-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-black text-foreground/90">{task.title || task.assignmentNo || "Assignment"}</p>
                        <p className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-muted-foreground">{task.message || task.targetType || "Pending logistics task"}</p>
                      </div>
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-black uppercase ${statusBadgeClass(task.status)}`}>
                        {formatStatus(task.status)}
                      </span>
                    </div>
                    <p className="mt-3.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                      Due: {task.dueAt || "Not scheduled"}
                    </p>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-border p-6 text-center">
                  <CheckCircle2 className="mx-auto h-7 w-7 text-emerald-500" />
                  <p className="mt-2.5 text-xs font-black text-foreground/90">No pending tasks</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">New assignments will appear here.</p>
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
            Documents, Containers & Alerts
          </CardTitle>
          <p className="text-[9px] font-semibold text-muted-foreground uppercase">Logistics database record count metrics</p>
        </CardHeader>
        <CardContent>
          <div className="h-[180px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={progressData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "hsl(var(--border))" : "#e2e8f0"} opacity={0.6} />
                <XAxis dataKey="name" stroke="#94a3b8" tickLine={false} axisLine={false} style={{ fontSize: 9 }} />
                <YAxis allowDecimals={false} stroke="#94a3b8" tickLine={false} axisLine={false} style={{ fontSize: 9 }} />
                <Tooltip contentStyle={{ background: isDark ? "hsl(var(--card))" : "#fff", border: isDark ? "1px solid hsl(var(--border))" : "1px solid #e2e8f0", borderRadius: 8, color: isDark ? "hsl(var(--card-foreground))" : "#0f172a", fontSize: 9 }} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} fill="#0f766e" name="Count" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
