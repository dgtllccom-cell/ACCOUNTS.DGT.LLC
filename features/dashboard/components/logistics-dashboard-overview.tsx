"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useErpPageMenu } from "@/components/layout/erp-page-menu";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  Boxes,
  Briefcase,
  CheckCircle2,
  ChevronDown,
  Clock,
  Compass,
  CreditCard,
  Eye,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Info,
  MoreVertical,
  Package,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Ship,
  Truck,
  Users,
  X,
  Zap,
  Flame,
  ArrowLeftRight,
  SlidersHorizontal
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  ComposedChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n/ui";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { Th } from "@/components/ui/translated-th";
import {
  DashboardSettingsModal,
  type DashboardWidgetItem
} from "@/components/dashboard/dashboard-settings-modal";
import { translateHeader } from "@/lib/i18n/table-headers";

export type LogisticsShipment = {
  id: string;
  shippingLineName: string;
  blNumber: string;
  containerNumber: string;
  vesselName: string;
  eta: string;
  status: string;
  date?: string;
};

export type LogisticsTask = {
  id: string;
  assignmentNo: string;
  title: string;
  message: string;
  status: string;
  dueAt: string;
  targetType: string;
  priority?: "High" | "Medium" | "Low";
  relatedTo?: string;
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

const SHIPPING_WIDGETS: DashboardWidgetItem[] = [
  { id: "hero_banner", label: "Port & Vessel Hero Banner", category: "Hero" },
  { id: "kpi_cards", label: "8 Status KPI Cards", category: "KPI Cards" },
  { id: "trend_chart", label: "Shipment & Clearance Trend", category: "Charts" },
  { id: "status_mix", label: "Status Mix Donut Chart", category: "Charts" },
  { id: "quick_access", label: "Quick Access Grid", category: "Navigation" },
  { id: "recent_shipments", label: "Recent Shipment Operations Table", category: "Tables" },
  { id: "pending_tasks", label: "Pending Tasks Table", category: "Tables" },
  { id: "tabbed_documents", label: "Documents & Containers Bottom Section", category: "Tables" }
];

/* ── Helper Status Stylers matching Reference Image 2 ─────────────── */
function getStatusBadge(status: string) {
  const norm = (status || "").toLowerCase().replace(/_/g, " ");
  if (norm.includes("in transit") || norm.includes("departed") || norm.includes("sailing")) {
    return "bg-blue-50 text-blue-700 border border-blue-200/90 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800";
  }
  if (norm.includes("pending clearance") || norm.includes("pending")) {
    return "bg-amber-50 text-amber-800 border border-amber-200/90 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800";
  }
  if (norm.includes("clearance") || norm.includes("under review")) {
    return "bg-orange-50 text-orange-700 border border-orange-200/90 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-800";
  }
  if (norm.includes("delivered") || norm.includes("completed") || norm.includes("approved")) {
    return "bg-emerald-50 text-emerald-700 border border-emerald-200/90 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800";
  }
  return "bg-slate-50 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300";
}

function getPriorityBadge(priority: string) {
  const p = (priority || "").toLowerCase();
  if (p === "high") return "text-rose-700 font-bold bg-rose-50 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200";
  if (p === "medium") return "text-amber-800 font-bold bg-amber-50 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200";
  return "text-blue-700 font-bold bg-blue-50 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200";
}

export function LogisticsDashboardOverview({
  data,
  canCreateShipment = false,
}: {
  data: LogisticsDashboardData;
  canCreateShipment?: boolean;
}) {
  const lang = useActiveLanguage();
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);
  const tt = (key: string, fallback: string) => t(lang, key as never, fallback);

  const [activeTab, setActiveTab] = useState<"documents" | "containers" | "trucks" | "agents" | "alerts">("documents");
  const [actionsOpen, setActionsOpen] = useState(false);
  const router = useRouter();
  // ONE ⋮ menu: the quick-create actions live in the global page-actions menu (no second "Actions" menu in the page).
  useErpPageMenu([
    { key: "bl", label: t(lang, "lgdash.new_shipment", "New Shipment / BL"), icon: <Plus className="h-4 w-4 text-blue-600" aria-hidden />, onSelect: () => router.push("/dashboard/shipping-line/bl-entry") },
    { key: "order", label: t(lang, "lgdash.customer_order", "Customer Order"), icon: <Users className="h-4 w-4 text-blue-600" aria-hidden />, onSelect: () => router.push("/dashboard/clearing-agent/customer-order") },
    { key: "truck", label: t(lang, "lgdash.register_truck", "Register Truck"), icon: <Truck className="h-4 w-4 text-blue-600" aria-hidden />, onSelect: () => router.push("/dashboard/clearing-agent/truck-registration") }
  ], { hideDefaults: ["edit"] });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [visibleWidgets, setVisibleWidgets] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const saved = localStorage.getItem("damaan-shipping-dashboard-settings");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.visibleMap) setVisibleWidgets(parsed.visibleMap);
      }
    } catch {
      // fallback
    }
  }, []);

  const isWidgetVisible = (id: string) => visibleWidgets[id] !== false;

  // Close actions dropdown when clicked outside
  useEffect(() => {
    const handleClick = () => setActionsOpen(false);
    if (actionsOpen) {
      window.addEventListener("click", handleClick);
      return () => window.removeEventListener("click", handleClick);
    }
  }, [actionsOpen]);

  // Only real records and counts. Missing values show "—"; nothing is filled in with sample data.
  const displayShipments = useMemo(() => {
    return (data.shipments ?? []).map((s) => ({
      id: s.id,
      date: s.date || "—",
      shippingLine: s.shippingLineName || "—",
      container: s.containerNumber || "—",
      vessel: s.vesselName || "—",
      eta: s.eta || "—",
      status: s.status || "—",
    }));
  }, [data.shipments]);

  const displayTasks = useMemo(() => {
    return (data.tasks ?? []).map((t) => ({
      id: t.id,
      task: t.title || t.assignmentNo,
      relatedTo: t.targetType || "—",
      dueDate: t.dueAt || "—",
      priority: t.priority || "",
      status: t.status === "completed" ? "Completed" : "Pending",
    }));
  }, [data.tasks]);

  // No document feed reaches this widget yet: none are listed rather than sample documents.
  const recentDocuments: Array<{ id: string; date: string; type: string; ref: string; relatedTo: string; status: string }> = [];

  const statusMix = useMemo(() => {
    const rows = [
      { name: tt("log.seg_in_transit", "In Transit"), count: data.inTransit ?? 0, color: "#2563eb" },
      { name: tt("log.kpi_pending_clearance", "Pending Clearance"), count: data.pendingClearance ?? 0, color: "#f97316" },
      { name: tt("log.seg_delivered", "Delivered"), count: data.delivered ?? 0, color: "#10b981" },
      { name: tt("log.seg_completed", "Completed"), count: data.completedShipments ?? 0, color: "#a855f7" }
    ];
    const total = rows.reduce((sum, r) => sum + r.count, 0);
    return rows.filter((r) => r.count > 0).map((r) => ({ ...r, pct: total ? `${Math.round((r.count / total) * 100)}%` : "0%" }));
  }, [data.inTransit, data.pendingClearance, data.delivered, data.completedShipments, lang]);
  const statusMixTotal = statusMix.reduce((sum, r) => sum + r.count, 0);

  const stageTrend = [
    { stage: tt("log.seg_assigned", "Assigned"), count: data.assignedShipments ?? 0 },
    { stage: tt("log.seg_pending", "Pending"), count: data.pendingClearance ?? 0 },
    { stage: tt("log.seg_in_transit", "In Transit"), count: data.inTransit ?? 0 },
    { stage: tt("log.seg_delivered", "Delivered"), count: data.delivered ?? 0 },
    { stage: tt("log.seg_completed", "Completed"), count: data.completedShipments ?? 0 }
  ];

  // 8 status cards — the real counts (0 when there are none), no invented trend percentages
  const kpiCards = [
    { label: tt("log.kpi_assigned", "Assigned Shipments"), value: String(data.assignedShipments ?? 0), change: "", sub: tt("log.cap_assigned", "Open logistics workload"),
      badgeColor: "bg-blue-100/80 text-blue-600 dark:bg-blue-950 dark:text-blue-400", icon: <Package className="h-4.5 w-4.5" />, link: "/dashboard/shipping-line/bl-entry" },
    { label: tt("log.kpi_pending_clearance", "Pending Clearance"), value: String(data.pendingClearance ?? 0), change: "", sub: tt("log.cap_pending_clearance", "Needs clearance action"),
      badgeColor: "bg-amber-100/80 text-amber-600 dark:bg-amber-950 dark:text-amber-400", icon: <Briefcase className="h-4.5 w-4.5" />, link: "/dashboard/clearing-agent/clearing-workspace" },
    { label: tt("log.seg_in_transit", "In Transit"), value: String(data.inTransit ?? 0), change: "", sub: tt("log.cap_shipping_status", "Currently in transit"),
      badgeColor: "bg-emerald-100/80 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400", icon: <Truck className="h-4.5 w-4.5" />, link: "/dashboard/shipping-line/tracking" },
    { label: tt("log.kpi_container_tracking", "Container Tracking"), value: String(data.trackedContainers ?? 0), change: "", sub: tt("log.cap_container_tracking", "Containers with tracking"),
      badgeColor: "bg-purple-100/80 text-purple-600 dark:bg-purple-950 dark:text-purple-400", icon: <Boxes className="h-4.5 w-4.5" />, link: "/dashboard/shipping-line/tracking?tab=containers" },
    { label: tt("log.kpi_documents", "Documents"), value: String(data.documents ?? 0), change: "", sub: tt("log.cap_documents", "BL and shipment records"),
      badgeColor: "bg-rose-100/80 text-rose-600 dark:bg-rose-950 dark:text-rose-400", icon: <FileText className="h-4.5 w-4.5" />, link: "/dashboard/shipping-line/bl-entry" },
    { label: tt("log.kpi_delivery_status", "Delivery Status"), value: String(data.delivered ?? 0), change: "", sub: tt("log.cap_delivery_status", "Delivered or released"),
      badgeColor: "bg-blue-100/80 text-blue-600 dark:bg-blue-950 dark:text-blue-400", icon: <CheckCircle2 className="h-4.5 w-4.5" />, link: "/dashboard/shipping-line/bl-entry?status=delivered" },
    { label: tt("log.pending_tasks", "Pending Tasks"), value: String(data.pendingTasks ?? 0), change: "", sub: tt("log.new_assignments_appear", "New assignments will appear here."),
      badgeColor: "bg-orange-100/80 text-orange-600 dark:bg-orange-950 dark:text-orange-400", icon: <Flame className="h-4.5 w-4.5" />, link: "/dashboard/user-tasks" },
    { label: tt("log.kpi_notifications", "Notifications"), value: String(data.notifications ?? 0), change: "", sub: tt("log.cap_notifications", "Open system alerts"),
      badgeColor: "bg-teal-100/80 text-teal-600 dark:bg-teal-950 dark:text-teal-400", icon: <Bell className="h-4.5 w-4.5" />, link: "/dashboard/user-tasks" }
  ];

  return (
    <div className="space-y-4" dir={isRtl ? "rtl" : "ltr"}>
      {/* ── 1. 3D HERO CONTAINER PORT BANNER (Matching Image 2) ─────────── */}
      {isWidgetVisible("hero_banner") && (
        <div className="relative rounded-3xl overflow-hidden border border-slate-200/90 dark:border-slate-800 shadow-[0_8px_30px_rgb(0,0,0,0.06)] min-h-[175px] bg-[#f8fafc] dark:bg-slate-900">
          {/* Background Image: Port with container ship and cranes */}
          <div
            className="absolute inset-0 bg-cover bg-right sm:bg-center"
            style={{
              backgroundImage: "url('/images/shipping_port_hero.jpg')"
            }}
          />
          {/* Soft Glass Overlay from Left */}
          <div className="absolute inset-0 bg-gradient-to-r from-white/95 via-white/80 to-transparent dark:from-slate-950/95 dark:via-slate-950/80 dark:to-transparent" />

          {/* Banner Content */}
          <div className="relative z-10 p-5 sm:p-6 flex flex-col justify-between min-h-[175px]">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
              <div className="space-y-1.5 max-w-xl">
                {/* Badge */}
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-full bg-slate-900 text-white flex items-center justify-center shadow-xs shrink-0">
                    <Ship className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-slate-900 dark:text-white leading-tight">
                      {t(lang, "nav.shipping_clearing", "Shipping & Clearing")}
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {t(lang, "logi.shipping_dash_subtitle", "Dashboard for shipment and clearance operations")}
                    </p>
                  </div>
                </div>

                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white pt-1">
                  {translateHeader(lang, "Logistics Tracking Dashboard")}
                </h1>

                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-medium">
                  {tt("log.dashboard_subtitle", "Operational dashboard tracking live shipments, customs clearing, BL tasks and container locations.")}
                </p>
              </div>

              {/* Right Side Controls */}
              <div className="flex items-center gap-2 self-start md:self-center shrink-0">
                <button
                  type="button"
                  onClick={() => setSettingsOpen(true)}
                  className="h-9 px-3 rounded-lg border border-slate-200/90 dark:border-slate-700 bg-white/90 dark:bg-slate-900/90 hover:bg-white text-slate-700 dark:text-slate-200 text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap shadow-xs backdrop-blur-xs transition-all cursor-pointer"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5 text-blue-600" />
                  {/* "Dashboard Settings", not "Settings": the top bar already has a Settings (preferences) button */}
                  <span>{tt("dash.dashboard_settings", "Dashboard Settings")}</span>
                </button>

              </div>
            </div>

            {/* Bottom slogan */}
            <div className="pt-3 text-[11px] font-black uppercase tracking-widest text-slate-400">
              {tt("log.hero_slogan", "Global shipping, brighter tomorrow")}
            </div>
          </div>
        </div>
      )}

      {/* ── 2. 8 STATUS KPI CARDS (Row of 8 matching Image 2) ───────────── */}
      {isWidgetVisible("kpi_cards") && (
        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
          {kpiCards.map((card, idx) => (
            <Link key={idx} href={card.link as any} className="group">
              <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-3.5 shadow-2xs hover:shadow-md hover:border-blue-300 dark:hover:border-blue-800 transition-all duration-200 flex flex-col justify-between h-full">
                <div className="flex items-center justify-between">
                  <span className={`p-2 rounded-xl shadow-2xs ${card.badgeColor}`}>
                    {card.icon}
                  </span>
                </div>
                <div className="mt-2.5 space-y-0.5">
                  <p className="text-[11px] font-bold text-slate-600 dark:text-slate-400 leading-tight truncate">
                    {card.label}
                  </p>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xl font-black text-slate-900 dark:text-white">
                      {card.value}
                    </span>
                    <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                      {card.change}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 truncate">
                    {card.sub}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* ── 3. MIDDLE SECTION (Trend Chart + Status Mix + Quick Access) ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* Trend Bar & Line Chart (Left ~45%) */}
        {isWidgetVisible("trend_chart") && (
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-blue-600" />
                <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                  {translateHeader(lang, "Shipment & Clearance Trend")}
                </h3>
              </div>
            </div>

            {/* Custom Legend */}
            <div className="flex items-center gap-3.5 text-[11px] font-bold pt-2">
              <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                <span className="h-2 w-2 rounded-full bg-blue-600" />
                <span>{tt("log.trend_subtitle", "Operational movement by current stage")}</span>
              </div>
            </div>

            <div className="h-[200px] w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={stageTrend} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="stage" stroke="#94a3b8" tickLine={false} axisLine={false} style={{ fontSize: 11 }} />
                  <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} style={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0f172a",
                      borderRadius: 10,
                      border: "none",
                      color: "#fff",
                      fontSize: 11
                    }}
                  />
                  <Bar dataKey="count" name={tt("shtrk.view_shipments", "Shipments")} fill="#2563eb" radius={[3, 3, 0, 0]} barSize={18} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Status Mix Donut (Center ~25%) */}
        {isWidgetVisible("status_mix") && (
          <div className="lg:col-span-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
              <Activity className="h-4 w-4 text-cyan-600" />
              <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                {translateHeader(lang, "Status Mix")}
              </h3>
            </div>

            <div className="h-[150px] w-full flex items-center justify-center relative pt-1">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusMix}
                    dataKey="count"
                    innerRadius={45}
                    outerRadius={65}
                    paddingAngle={3}
                  >
                    {statusMix.map((entry, index) => (
                      <Cell key={`mix-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>

              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xl font-black text-slate-900 dark:text-white leading-tight">{statusMixTotal}</span>
                <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">{tt("common.total", "Total")}</span>
              </div>
            </div>

            <div className="space-y-1 pt-1 text-[11px]">
              {statusMix.map((item) => (
                <div key={item.name} className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="truncate">{item.name}</span>
                  </div>
                  <span className="font-bold">{item.pct}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Access Grid (Right ~30%) */}
        {isWidgetVisible("quick_access") && (
          <div className="lg:col-span-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
              <Zap className="h-4 w-4 text-blue-600" />
              <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                {translateHeader(lang, "Quick Access")}
              </h3>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <Link
                href="/dashboard/shipping-line/bl-entry"
                className="flex items-center gap-2 p-2 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 hover:bg-blue-50 dark:hover:bg-slate-800 transition-all text-xs font-bold text-slate-800 dark:text-slate-200"
              >
                <div className="h-7 w-7 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                  <Ship className="h-3.5 w-3.5" />
                </div>
                <span className="text-[11px] truncate">{tt("log.qa_new_shipment", "New Shipment")}</span>
              </Link>

              <Link
                href="/dashboard/shipping-line/bl-entry"
                className="flex items-center gap-2 p-2 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 hover:bg-blue-50 dark:hover:bg-slate-800 transition-all text-xs font-bold text-slate-800 dark:text-slate-200"
              >
                <div className="h-7 w-7 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                  <FileText className="h-3.5 w-3.5" />
                </div>
                <span className="text-[11px] truncate">{tt("ble.card_entry_title", "BL Entry")}</span>
              </Link>

              <Link
                href="/dashboard/shipping-line/tracking?tab=containers"
                className="flex items-center gap-2 p-2 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 hover:bg-blue-50 dark:hover:bg-slate-800 transition-all text-xs font-bold text-slate-800 dark:text-slate-200"
              >
                <div className="h-7 w-7 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
                  <Boxes className="h-3.5 w-3.5" />
                </div>
                <span className="text-[11px] truncate">{tt("log.kpi_container_tracking", "Container Tracking")}</span>
              </Link>

              <Link
                href="/dashboard/shipping-line/tracking?tab=vessels"
                className="flex items-center gap-2 p-2 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 hover:bg-blue-50 dark:hover:bg-slate-800 transition-all text-xs font-bold text-slate-800 dark:text-slate-200"
              >
                <div className="h-7 w-7 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                  <Ship className="h-3.5 w-3.5" />
                </div>
                <span className="text-[11px] truncate">{tt("log.qa_vessel_tracking", "Vessel Tracking")}</span>
              </Link>

              <Link
                href="/dashboard/clearing-agent/truck-registration"
                className="flex items-center gap-2 p-2 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 hover:bg-blue-50 dark:hover:bg-slate-800 transition-all text-xs font-bold text-slate-800 dark:text-slate-200"
              >
                <div className="h-7 w-7 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                  <Truck className="h-3.5 w-3.5" />
                </div>
                <span className="text-[11px] truncate">{tt("log.qa_trucking_transport", "Trucking & Transport")}</span>
              </Link>

              <Link
                href="/dashboard/shipping-line/transfer-center"
                className="flex items-center gap-2 p-2 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 hover:bg-blue-50 dark:hover:bg-slate-800 transition-all text-xs font-bold text-slate-800 dark:text-slate-200"
              >
                <div className="h-7 w-7 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                  <ArrowLeftRight className="h-3.5 w-3.5" />
                </div>
                <span className="text-[11px] truncate">{tt("log.qa_transfer_handover", "Transfer & Handover")}</span>
              </Link>

              <Link
                href="/dashboard/shipping-line/bl-entry?tab=documents"
                className="flex items-center gap-2 p-2 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 hover:bg-blue-50 dark:hover:bg-slate-800 transition-all text-xs font-bold text-slate-800 dark:text-slate-200"
              >
                <div className="h-7 w-7 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                  <FileText className="h-3.5 w-3.5" />
                </div>
                <span className="text-[11px] truncate">{tt("log.qa_open_documents", "Open Documents")}</span>
              </Link>

              <Link
                href="/dashboard/clearing-agent/customer-order"
                className="flex items-center gap-2 p-2 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 hover:bg-blue-50 dark:hover:bg-slate-800 transition-all text-xs font-bold text-slate-800 dark:text-slate-200"
              >
                <div className="h-7 w-7 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                  <Users className="h-3.5 w-3.5" />
                </div>
                <span className="text-[11px] truncate">{tt("lgdash.customer_order", "Customer Order")}</span>
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* ── 4. LOWER SECTION (Recent Shipments 60% + Pending Tasks 40%) ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* Recent Shipment Operations */}
        {isWidgetVisible("recent_shipments") && (
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-2xs overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Boxes className="h-4 w-4 text-emerald-600" />
                <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                  {translateHeader(lang, "Recent Shipment Operations")}
                </h3>
              </div>
              <Link
                href="/dashboard/shipping-line/tracking"
                className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5"
              >
                {tt("crm.view_all", "View All")} <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 text-[11px] font-bold uppercase text-slate-500 tracking-wider">
                    <Th className="px-3.5 py-2.5 w-8">#</Th>
                    <Th className="px-3.5 py-2.5">Date</Th>
                    <Th className="px-3.5 py-2.5">Shipping Line</Th>
                    <Th className="px-3.5 py-2.5">Container</Th>
                    <Th className="px-3.5 py-2.5">Vessel</Th>
                    <Th className="px-3.5 py-2.5">ETA</Th>
                    <Th className="px-3.5 py-2.5 text-center">Status</Th>
                    <Th className="px-3.5 py-2.5 text-right">Actions</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium text-slate-700 dark:text-slate-300">
                  {displayShipments.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-3.5 py-6 text-center text-xs text-slate-500">{tt("log.no_shipments", "No logistics shipments found yet.")}</td>
                    </tr>
                  ) : null}
                  {displayShipments.map((s, idx) => (
                    <tr key={s.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="px-3.5 py-2.5 text-slate-400 text-[11px]">{idx + 1}</td>
                      <td className="px-3.5 py-2.5 text-slate-600 dark:text-slate-400 whitespace-nowrap text-[11px]">{s.date}</td>
                      <td className="px-3.5 py-2.5 font-bold text-slate-900 dark:text-white whitespace-nowrap">{s.shippingLine}</td>
                      <td className="px-3.5 py-2.5 font-mono text-blue-600 dark:text-blue-400 font-semibold">{s.container}</td>
                      <td className="px-3.5 py-2.5 text-slate-600 dark:text-slate-400 whitespace-nowrap">{s.vessel}</td>
                      <td className="px-3.5 py-2.5 text-slate-600 dark:text-slate-400 whitespace-nowrap">{s.eta}</td>
                      <td className="px-3.5 py-2.5 text-center">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${getStatusBadge(s.status)}`}>
                          {translateHeader(lang, s.status)}
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5 text-right">
                        <button type="button" className="text-slate-400 hover:text-slate-700 font-bold">
                          •••
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Pending Tasks */}
        {isWidgetVisible("pending_tasks") && (
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-2xs overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-rose-500" />
                <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                  {translateHeader(lang, "Pending Tasks")}
                </h3>
              </div>
              <Link
                href="/dashboard/user-tasks"
                className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5"
              >
                {tt("crm.view_all", "View All")} <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 text-[11px] font-bold uppercase text-slate-500 tracking-wider">
                    <Th className="px-3 py-2.5 w-8">#</Th>
                    <Th className="px-3 py-2.5">Task</Th>
                    <Th className="px-3 py-2.5">Related To</Th>
                    <Th className="px-3 py-2.5">Due Date</Th>
                    <Th className="px-3 py-2.5">Priority</Th>
                    <Th className="px-3 py-2.5 text-center">Status</Th>
                    <Th className="px-3 py-2.5 text-right">Actions</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium text-slate-700 dark:text-slate-300">
                  {displayTasks.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-6 text-center text-xs text-slate-500">{tt("log.no_pending_tasks", "No pending tasks")}</td>
                    </tr>
                  ) : null}
                  {displayTasks.map((t, idx) => (
                    <tr key={t.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="px-3 py-2.5 text-slate-400 text-[11px]">{idx + 1}</td>
                      <td className="px-3 py-2.5 font-bold text-slate-900 dark:text-white truncate max-w-[120px]">{t.task}</td>
                      <td className="px-3 py-2.5 text-slate-600 dark:text-slate-400 font-mono text-[11px] whitespace-nowrap">{t.relatedTo}</td>
                      <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap text-[11px]">{t.dueDate}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-black uppercase tracking-wider ${getPriorityBadge(t.priority || "Medium")}`}>
                          {t.priority ? translateHeader(lang, t.priority) : "—"}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${getStatusBadge(t.status)}`}>
                          {translateHeader(lang, t.status)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <button type="button" className="text-slate-400 hover:text-slate-700 font-bold">
                          •••
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── 5. BOTTOM SECTION (Documents, Containers & Alerts Tabs) ─────── */}
      {isWidgetVisible("tabbed_documents") && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-2xs overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-2">
                <FolderOpen className="h-4 w-4 text-blue-600" />
                <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                  {translateHeader(lang, "Documents, Containers & Alerts")}
                </h3>
              </div>
              <Link
                href="/dashboard/shipping-line/shipment-report"
                className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5"
              >
                {tt("crm.view_all", "View All")} <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pt-2.5 scrollbar-none">
              <button
                type="button"
                onClick={() => setActiveTab("documents")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                  activeTab === "documents"
                    ? "bg-[#1d63ed] text-white shadow-xs"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                }`}
              >
                <FileText className="h-3.5 w-3.5" />
                {tt("log.tab_recent_documents", "Recent Documents")} ({recentDocuments.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("containers")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                  activeTab === "containers"
                    ? "bg-[#1d63ed] text-white shadow-xs"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                }`}
              >
                <Boxes className="h-3.5 w-3.5" />
                {tt("log.seg_containers", "Containers")} ({data.trackedContainers ?? 0})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("trucks")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                  activeTab === "trucks"
                    ? "bg-[#1d63ed] text-white shadow-xs"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                }`}
              >
                <Truck className="h-3.5 w-3.5" />
                {tt("log.tab_truck_movements", "Truck Movements")}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("agents")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                  activeTab === "agents"
                    ? "bg-[#1d63ed] text-white shadow-xs"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                }`}
              >
                <Users className="h-3.5 w-3.5" />
                {tt("log.tab_agent_activities", "Agent Activities")}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("alerts")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                  activeTab === "alerts"
                    ? "bg-[#1d63ed] text-white shadow-xs"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                }`}
              >
                <Bell className="h-3.5 w-3.5" />
                {tt("log.tab_system_alerts", "System Alerts")} ({data.notifications ?? 0})
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 text-[11px] font-bold uppercase text-slate-500 tracking-wider">
                  <Th className="px-4 py-2.5 w-8">#</Th>
                  <Th className="px-4 py-2.5">Date</Th>
                  <Th className="px-4 py-2.5">Document Type</Th>
                  <Th className="px-4 py-2.5">Reference No</Th>
                  <Th className="px-4 py-2.5">Related To</Th>
                  <Th className="px-4 py-2.5 text-center">Status</Th>
                  <Th className="px-4 py-2.5 text-right">Actions</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium text-slate-700 dark:text-slate-300">
                {recentDocuments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-xs text-slate-500">{tt("log.no_documents", "No documents recorded yet.")}</td>
                  </tr>
                ) : null}
                {recentDocuments.map((doc, idx) => (
                  <tr key={doc.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-2.5 text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                    <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400 whitespace-nowrap text-[11px]">{doc.date}</td>
                    <td className="px-4 py-2.5 font-bold text-slate-900 dark:text-white whitespace-nowrap">{doc.type}</td>
                    <td className="px-4 py-2.5 font-mono font-bold text-blue-600 dark:text-blue-400">{doc.ref}</td>
                    <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400 font-mono text-[11px]">{doc.relatedTo}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${getStatusBadge(doc.status)}`}>
                        {translateHeader(lang, doc.status)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button type="button" className="text-slate-400 hover:text-slate-700 font-bold">
                        •••
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Dashboard Settings Modal */}
      <DashboardSettingsModal
        storageKey="damaan-shipping-dashboard-settings"
        title="Shipping Line Dashboard Settings"
        subtitle="Configure visibility and arrangement of shipping & logistics dashboard widgets."
        widgets={SHIPPING_WIDGETS}
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSettingsChange={(map) => setVisibleWidgets(map)}
      />
    </div>
  );
}
