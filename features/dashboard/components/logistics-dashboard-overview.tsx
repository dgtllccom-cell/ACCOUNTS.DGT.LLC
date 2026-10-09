"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
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
} from "lucide-react";
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
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n/ui";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { DashboardHeroBanner } from "@/features/dashboard/components/dashboard-hero-banner";
import { Th } from "@/components/ui/translated-th";

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

/* ── Trend Data for Bar Chart ─────────────────────────────────────── */
const EMPTY_TREND_DATA = [
  { month: "May", shipments: 0, clearance: 0, deliveries: 0 },
  { month: "Jun", shipments: 0, clearance: 0, deliveries: 0 },
  { month: "Jul", shipments: 0, clearance: 0, deliveries: 0 },
  { month: "Aug", shipments: 0, clearance: 0, deliveries: 0 },
  { month: "Sep", shipments: 0, clearance: 0, deliveries: 0 },
  { month: "Oct", shipments: 0, clearance: 0, deliveries: 0 },
];

/* ── Helper Badge Stylers ─────────────────────────────────────────── */
function getStatusBadge(status: string) {
  const norm = (status || "").toLowerCase().replace(/_/g, " ");
  if (norm.includes("in transit") || norm.includes("departed") || norm.includes("sailing")) {
    return "bg-blue-50 text-blue-600 border border-blue-200/80 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-900";
  }
  if (norm.includes("pending") || norm.includes("attention")) {
    return "bg-amber-50 text-amber-600 border border-amber-200/80 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-900";
  }
  if (norm.includes("clearance") || norm.includes("under review") || norm.includes("under clearance")) {
    return "bg-orange-50 text-orange-600 border border-orange-200/80 dark:bg-orange-950/50 dark:text-orange-400 dark:border-orange-900";
  }
  if (norm.includes("completed") || norm.includes("verified") || norm.includes("delivered") || norm.includes("approved") || norm.includes("released")) {
    return "bg-emerald-50 text-emerald-600 border border-emerald-200/80 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-900";
  }
  if (norm.includes("hold") || norm.includes("cancelled") || norm.includes("high")) {
    return "bg-rose-50 text-rose-600 border border-rose-200/80 dark:bg-rose-950/50 dark:text-rose-400 dark:border-rose-900";
  }
  return "bg-slate-50 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-300";
}

function getPriorityBadge(priority: string) {
  const p = (priority || "").toLowerCase();
  if (p === "high") return "text-rose-600 font-bold bg-rose-50 dark:bg-rose-950/50 dark:text-rose-400 border border-rose-200 dark:border-rose-900";
  if (p === "medium") return "text-amber-600 font-bold bg-amber-50 dark:bg-amber-950/50 dark:text-amber-400 border border-amber-200 dark:border-amber-900";
  return "text-emerald-600 font-bold bg-emerald-50 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900";
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
  const [trendRange, setTrendRange] = useState("Last 6 Months");
  const [actionsOpen, setActionsOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);

  // Close actions dropdown when clicked outside
  useEffect(() => {
    const handleClick = () => setActionsOpen(false);
    if (actionsOpen) {
      window.addEventListener("click", handleClick);
      return () => window.removeEventListener("click", handleClick);
    }
  }, [actionsOpen]);

  // Authentic records derived strictly from loaded data
  const displayShipments = (data.shipments || []).map((s) => ({
    id: s.id,
    date: s.date || "-",
    shippingLine: s.shippingLineName || "-",
    container: s.containerNumber || "-",
    vessel: s.vesselName || "-",
    eta: s.eta || "-",
    status: s.status || "Pending",
  }));

  const displayTasks = (data.tasks || []).map((t, idx) => ({
    id: t.id,
    task: t.title || t.assignmentNo,
    relatedTo: t.targetType || "Shipment",
    dueDate: t.dueAt || "-",
    priority: t.priority || (idx === 0 || idx === 1 ? "High" : idx === 2 ? "Medium" : "Low"),
    status: t.status === "completed" ? "Completed" : "Open",
  }));

  const containersData = (data.shipments || [])
    .filter((s) => Boolean(s.containerNumber && s.containerNumber !== "-"))
    .map((s, idx) => ({
      id: s.id || String(idx + 1),
      containerNo: s.containerNumber,
      line: s.shippingLineName || "-",
      type: "Standard",
      vessel: s.vesselName || "-",
      location: "-",
      seal: "-",
      status: s.status || "In Transit"
    }));

  const recentDocuments = (data.shipments || [])
    .filter((s) => Boolean(s.blNumber && s.blNumber !== "-"))
    .map((s, idx) => ({
      id: s.id || String(idx + 1),
      date: s.date || "-",
      type: "Bill of Lading",
      ref: s.blNumber,
      relatedTo: s.containerNumber || "-",
      status: s.status || "Verified"
    }));

  const statusMix = React.useMemo(() => {
    const total = data.assignedShipments || data.shipments.length || 0;
    const pending = data.pendingClearance || 0;
    const inTransit = data.inTransit || 0;
    const delivered = data.delivered || 0;
    const completed = data.completedShipments || 0;
    if (total === 0) {
      return [
        { name: "Pending Clearance", count: 0, pct: "0%", color: "#f97316" },
        { name: "In Transit", count: 0, pct: "0%", color: "#2563eb" },
        { name: "Delivered", count: 0, pct: "0%", color: "#10b981" },
      ];
    }
    return [
      { name: "Pending Clearance", count: pending, pct: `${Math.round((pending / total) * 100)}%`, color: "#f97316" },
      { name: "In Transit", count: inTransit, pct: `${Math.round((inTransit / total) * 100)}%`, color: "#2563eb" },
      { name: "Delivered", count: delivered, pct: `${Math.round((delivered / total) * 100)}%`, color: "#10b981" },
      { name: "Completed", count: completed, pct: `${Math.round((completed / total) * 100)}%`, color: "#06b6d4" },
    ];
  }, [data]);

  const totalStatusCount = data.assignedShipments || data.shipments.length || 0;
  const trendData = data.shipments.length > 0 ? [
    { month: "Sep", shipments: data.shipments.length, clearance: data.pendingClearance, deliveries: data.delivered }
  ] : EMPTY_TREND_DATA;

  return (
    <div className="space-y-6 text-slate-800 dark:text-slate-100 p-2 sm:p-4 lg:p-6" dir={isRtl ? "rtl" : "ltr"}>
      <DashboardHeroBanner variant="shipping" lang={lang} />

      {/* ── Sub-header Banner & Actions ─────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200/80 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center shadow-sm shrink-0">
            <Ship className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black text-slate-900 dark:text-white">Shipping & Clearing</h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Dashboard for shipment and clearance operations
            </p>
          </div>
        </div>

        {/* Top Actions Dropdown */}
        <div className="relative">
          <Button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setActionsOpen(!actionsOpen);
            }}
            variant="outline"
            className="h-9 px-3.5 text-xs font-bold gap-1.5 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-xs"
          >
            <span>Actions</span>
            <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
          </Button>

          {actionsOpen && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute right-0 top-full mt-1.5 w-56 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl py-1.5 z-50 animate-in fade-in-50 duration-150"
            >
              <Link
                href="/dashboard/clearing-agent/customer-order"
                className="flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-950/50 hover:text-blue-600"
              >
                <Plus className="h-3.5 w-3.5 text-blue-600" />
                New Customer Order
              </Link>
              <Link
                href="/dashboard/shipping-line/bl-entry"
                className="flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-950/50 hover:text-blue-600"
              >
                <FileText className="h-3.5 w-3.5 text-blue-600" />
                New BL Entry
              </Link>
              <Link
                href="/dashboard/clearing-agent/truck-registration"
                className="flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-950/50 hover:text-blue-600"
              >
                <Truck className="h-3.5 w-3.5 text-blue-600" />
                Register Truck
              </Link>
              <Link
                href="/dashboard/shipping-line/agent-entry"
                className="flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-950/50 hover:text-blue-600"
              >
                <Users className="h-3.5 w-3.5 text-blue-600" />
                Shipping Agent Entry
              </Link>
              <div className="h-px bg-slate-100 dark:bg-slate-800 my-1" />
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-left"
              >
                <RefreshCw className="h-3.5 w-3.5 text-slate-500" />
                Refresh Dashboard
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Main Section Title ──────────────────────────────────────────── */}
      <div>
        <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[10px] font-black text-blue-600 dark:border-blue-900/60 dark:bg-blue-950/50 dark:text-blue-400 uppercase tracking-wider">
          Logistics Operations
        </span>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1.5 tracking-tight">
          Logistics Tracking Dashboard
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Operational dashboard tracking freight shipments, customs clearance, transit containers, and task handovers.
        </p>
      </div>

      {/* ── 8 KPI Cards (Top Row) ────────────────────────────────────────── */}
      <section className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
        {/* 1. Assigned Shipments */}
        <Link href="/dashboard/shipping-line/bl-entry" className="group">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-3.5 shadow-xs hover:shadow-md hover:border-blue-300 dark:hover:border-blue-800 transition-all duration-200 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between">
              <span className="p-2.5 rounded-xl bg-blue-100/70 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                <Package className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-3">
              <p className="text-[11px] font-bold text-slate-600 dark:text-slate-400 leading-tight">
                Assigned Shipments
              </p>
              <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                {data.assignedShipments ?? 0}
              </p>
              <p className={`text-[10px] font-bold mt-1 flex items-center gap-0.5 ${data.assignedShipments > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"}`}>
                <ArrowUpRight className="h-3 w-3" />
                {data.assignedShipments > 0 ? `${data.assignedShipments} active in scope` : "No active shipments"}
              </p>
            </div>
          </div>
        </Link>

        {/* 2. Pending Clearance */}
        <Link href="/dashboard/clearing-agent/clearing-workspace?status=pending" className="group">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-3.5 shadow-xs hover:shadow-md hover:border-amber-300 dark:hover:border-amber-800 transition-all duration-200 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between">
              <span className="p-2.5 rounded-xl bg-amber-100/70 text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                <Briefcase className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-3">
              <p className="text-[11px] font-bold text-slate-600 dark:text-slate-400 leading-tight">
                Pending Clearance
              </p>
              <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                {data.pendingClearance ?? 0}
              </p>
              <p className={`text-[10px] font-semibold mt-1 ${data.pendingClearance > 0 ? "text-amber-600 dark:text-amber-400" : "text-slate-400"}`}>
                {data.pendingClearance > 0 ? "Requires action" : "All cleared"}
              </p>
            </div>
          </div>
        </Link>

        {/* 3. In Transit */}
        <Link href="/dashboard/shipping-line/tracking?status=in_transit" className="group">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-3.5 shadow-xs hover:shadow-md hover:border-emerald-300 dark:hover:border-emerald-800 transition-all duration-200 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between">
              <span className="p-2.5 rounded-xl bg-emerald-100/70 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
                <Truck className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-3">
              <p className="text-[11px] font-bold text-slate-600 dark:text-slate-400 leading-tight">
                In Transit
              </p>
              <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                {data.inTransit ?? 0}
              </p>
              <p className={`text-[10px] font-semibold mt-1 ${data.inTransit > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"}`}>
                {data.inTransit > 0 ? "On the way" : "None in transit"}
              </p>
            </div>
          </div>
        </Link>

        {/* 4. Containers Tracking */}
        <Link href="/dashboard/shipping-line/tracking?tab=containers" className="group">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-3.5 shadow-xs hover:shadow-md hover:border-purple-300 dark:hover:border-purple-800 transition-all duration-200 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between">
              <span className="p-2.5 rounded-xl bg-purple-100/70 text-purple-600 dark:bg-purple-950 dark:text-purple-400">
                <Boxes className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-3">
              <p className="text-[11px] font-bold text-slate-600 dark:text-slate-400 leading-tight">
                Containers Tracking
              </p>
              <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                {data.trackedContainers ?? 0}
              </p>
              <p className={`text-[10px] font-semibold mt-1 ${data.trackedContainers > 0 ? "text-purple-600 dark:text-purple-400" : "text-slate-400"}`}>
                {data.trackedContainers > 0 ? "Active tracking" : "No active containers"}
              </p>
            </div>
          </div>
        </Link>

        {/* 5. Open Documents */}
        <Link href="/dashboard/shipping-line/bl-entry" className="group">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-3.5 shadow-xs hover:shadow-md hover:border-rose-300 dark:hover:border-rose-800 transition-all duration-200 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between">
              <span className="p-2.5 rounded-xl bg-rose-100/70 text-rose-600 dark:bg-rose-950 dark:text-rose-400">
                <FileText className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-3">
              <p className="text-[11px] font-bold text-slate-600 dark:text-slate-400 leading-tight">
                Open Documents
              </p>
              <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                {data.documents ?? 0}
              </p>
              <p className={`text-[10px] font-semibold mt-1 ${data.documents > 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-400"}`}>
                {data.documents > 0 ? "Need review" : "No open documents"}
              </p>
            </div>
          </div>
        </Link>

        {/* 6. Delivery Completed */}
        <Link href="/dashboard/shipping-line/bl-entry?status=delivered" className="group">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-3.5 shadow-xs hover:shadow-md hover:border-blue-300 dark:hover:border-blue-800 transition-all duration-200 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between">
              <span className="p-2.5 rounded-xl bg-blue-100/70 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                <CheckCircle2 className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-3">
              <p className="text-[11px] font-bold text-slate-600 dark:text-slate-400 leading-tight">
                Delivery Completed
              </p>
              <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                {data.delivered ?? 0}
              </p>
              <p className={`text-[10px] font-semibold mt-1 ${data.delivered > 0 ? "text-blue-600 dark:text-blue-400" : "text-slate-400"}`}>
                {data.delivered > 0 ? "Completed" : "None completed"}
              </p>
            </div>
          </div>
        </Link>

        {/* 7. Pending Tasks */}
        <Link href="/dashboard/user-tasks?status=open" className="group">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-3.5 shadow-xs hover:shadow-md hover:border-rose-300 dark:hover:border-rose-800 transition-all duration-200 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between">
              <span className="p-2.5 rounded-xl bg-rose-100/70 text-rose-600 dark:bg-rose-950 dark:text-rose-400">
                <AlertCircle className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-3">
              <p className="text-[11px] font-bold text-slate-600 dark:text-slate-400 leading-tight">
                Pending Tasks
              </p>
              <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                {data.pendingTasks ?? 0}
              </p>
              <p className={`text-[10px] font-semibold mt-1 ${data.pendingTasks > 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-400"}`}>
                {data.pendingTasks > 0 ? "Need attention" : "No pending tasks"}
              </p>
            </div>
          </div>
        </Link>

        {/* 8. Notifications */}
        <Link href="/dashboard/user-tasks" className="group">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-3.5 shadow-xs hover:shadow-md hover:border-emerald-300 dark:hover:border-emerald-800 transition-all duration-200 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between">
              <span className="p-2.5 rounded-xl bg-emerald-100/70 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
                <Bell className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-3">
              <p className="text-[11px] font-bold text-slate-600 dark:text-slate-400 leading-tight">
                Notifications
              </p>
              <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                {data.notifications ?? 0}
              </p>
              <p className={`text-[10px] font-semibold mt-1 ${data.notifications > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"}`}>
                {data.notifications > 0 ? "New alerts" : "All caught up"}
              </p>
            </div>
          </div>
        </Link>
      </section>

      {/* ── Row 2: Charts & Quick Access (3 Columns) ────────────────────── */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* 1. Shipment & Clearance Trend (BarChart) */}
        <Card className="lg:col-span-5 border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl shadow-xs">
          <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800/80">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-blue-600" />
                Shipment & Clearance Trend
              </CardTitle>
              <div className="relative">
                <select
                  value={trendRange}
                  onChange={(e) => setTrendRange(e.target.value)}
                  className="text-[11px] font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                >
                  <option>Last 6 Months</option>
                  <option>Last 3 Months</option>
                  <option>This Year</option>
                </select>
              </div>
            </div>

            {/* Custom Legend */}
            <div className="flex items-center gap-4 text-[10px] font-bold pt-2">
              <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                <span className="h-2 w-2 rounded-full bg-blue-600" />
                <span>Shipments</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                <span>Clearance</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span>Deliveries</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="h-[210px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trendData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" className="dark:stroke-slate-800" />
                  <XAxis dataKey="month" stroke="#94a3b8" tickLine={false} axisLine={false} style={{ fontSize: 10, fontWeight: 600 }} />
                  <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} style={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(15, 23, 42, 0.95)",
                      borderRadius: 10,
                      border: "none",
                      color: "#fff",
                      fontSize: 11,
                      fontWeight: 600,
                      boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.3)",
                    }}
                  />
                  <Bar dataKey="shipments" fill="#2563eb" radius={[3, 3, 0, 0]} barSize={8} />
                  <Bar dataKey="clearance" fill="#f97316" radius={[3, 3, 0, 0]} barSize={8} />
                  <Bar dataKey="deliveries" fill="#10b981" radius={[3, 3, 0, 0]} barSize={8} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* 2. Status Mix (Donut Chart) */}
        <Card className="lg:col-span-3.5 border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl shadow-xs">
          <CardHeader className="pb-2 border-b border-slate-100 dark:border-slate-800/80">
            <CardTitle className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Activity className="h-4 w-4 text-cyan-600" />
              Status Mix
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              {/* Donut with Total in Center */}
              <div className="relative h-[170px] w-[170px] shrink-0 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusMix}
                      dataKey="count"
                      innerRadius={46}
                      outerRadius={66}
                      paddingAngle={3}
                      stroke="none"
                    >
                      {statusMix.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: any, name: any) => [`${value} shipments`, name]}
                      contentStyle={{
                        backgroundColor: "rgba(15, 23, 42, 0.95)",
                        borderRadius: 8,
                        border: "none",
                        color: "#fff",
                        fontSize: 10,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-black text-slate-900 dark:text-white">{totalStatusCount}</span>
                  <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Total</span>
                </div>
              </div>

              {/* Legend List */}
              <div className="space-y-1.5 w-full text-xs">
                {statusMix.map((item) => (
                  <div key={item.name} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="text-slate-600 dark:text-slate-400 font-medium truncate text-[11px]">
                        {item.name}
                      </span>
                    </div>
                    <span className="font-bold text-slate-800 dark:text-slate-200 text-[11px] whitespace-nowrap">
                      {item.count} ({item.pct})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 3. Quick Access (Grid of 8 Buttons) */}
        <Card className="lg:col-span-3.5 border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl shadow-xs">
          <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800/80">
            <CardTitle className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Zap className="h-4 w-4 text-blue-600" />
              Quick Access
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-3">
            <div className="grid grid-cols-2 gap-2">
              {/* Left Column */}
              <Link
                href="/dashboard/shipping-line/shipment-details"
                className="flex items-center justify-between p-2.5 rounded-xl border border-blue-100 dark:border-blue-900/40 bg-blue-50/40 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300 hover:bg-blue-100/70 hover:shadow-xs transition-all group"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Package className="h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-blue-400" />
                  <span className="font-bold text-[11px] truncate">Shipment Details</span>
                </div>
                <ChevronDown className="h-3 w-3 -rotate-90 text-blue-500 shrink-0 group-hover:translate-x-0.5 transition-transform" />
              </Link>

              <Link
                href="/dashboard/shipping-line/bl-entry"
                className="flex items-center justify-between p-2.5 rounded-xl border border-blue-100 dark:border-blue-900/40 bg-blue-50/40 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300 hover:bg-blue-100/70 hover:shadow-xs transition-all group"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-blue-400" />
                  <span className="font-bold text-[11px] truncate">BL Entry</span>
                </div>
                <ChevronDown className="h-3 w-3 -rotate-90 text-blue-500 shrink-0 group-hover:translate-x-0.5 transition-transform" />
              </Link>

              <Link
                href="/dashboard/shipping-line/shipment-report"
                className="flex items-center justify-between p-2.5 rounded-xl border border-blue-100 dark:border-blue-900/40 bg-blue-50/40 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300 hover:bg-blue-100/70 hover:shadow-xs transition-all group"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <FileSpreadsheet className="h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-blue-400" />
                  <span className="font-bold text-[11px] truncate">Shipment Report</span>
                </div>
                <ChevronDown className="h-3 w-3 -rotate-90 text-blue-500 shrink-0 group-hover:translate-x-0.5 transition-transform" />
              </Link>

              <Link
                href="/dashboard/shipping-line/tracking"
                className="flex items-center justify-between p-2.5 rounded-xl border border-blue-100 dark:border-blue-900/40 bg-blue-50/40 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300 hover:bg-blue-100/70 hover:shadow-xs transition-all group"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Compass className="h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-blue-400" />
                  <span className="font-bold text-[11px] truncate">Container Tracking</span>
                </div>
                <ChevronDown className="h-3 w-3 -rotate-90 text-blue-500 shrink-0 group-hover:translate-x-0.5 transition-transform" />
              </Link>

              <Link
                href="/dashboard/shipping-line/agent-entry"
                className="flex items-center justify-between p-2.5 rounded-xl border border-blue-100 dark:border-blue-900/40 bg-blue-50/40 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300 hover:bg-blue-100/70 hover:shadow-xs transition-all group"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Users className="h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-blue-400" />
                  <span className="font-bold text-[11px] truncate">Shipping Agent Entry</span>
                </div>
                <ChevronDown className="h-3 w-3 -rotate-90 text-blue-500 shrink-0 group-hover:translate-x-0.5 transition-transform" />
              </Link>

              <Link
                href="/dashboard/clearing-agent/truck-registration"
                className="flex items-center justify-between p-2.5 rounded-xl border border-blue-100 dark:border-blue-900/40 bg-blue-50/40 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300 hover:bg-blue-100/70 hover:shadow-xs transition-all group"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Truck className="h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-blue-400" />
                  <span className="font-bold text-[11px] truncate">Truck Register</span>
                </div>
                <ChevronDown className="h-3 w-3 -rotate-90 text-blue-500 shrink-0 group-hover:translate-x-0.5 transition-transform" />
              </Link>

              <Link
                href="/dashboard/clearing-agent/agent-custom-entry"
                className="flex items-center justify-between p-2.5 rounded-xl border border-blue-100 dark:border-blue-900/40 bg-blue-50/40 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300 hover:bg-blue-100/70 hover:shadow-xs transition-all group"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-blue-400" />
                  <span className="font-bold text-[11px] truncate">Agent Custom Entry</span>
                </div>
                <ChevronDown className="h-3 w-3 -rotate-90 text-blue-500 shrink-0 group-hover:translate-x-0.5 transition-transform" />
              </Link>

              <Link
                href="/dashboard/clearing-agent/payment-bill-entry"
                className="flex items-center justify-between p-2.5 rounded-xl border border-blue-100 dark:border-blue-900/40 bg-blue-50/40 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300 hover:bg-blue-100/70 hover:shadow-xs transition-all group"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <CreditCard className="h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-blue-400" />
                  <span className="font-bold text-[11px] truncate">Payment Bill Entry</span>
                </div>
                <ChevronDown className="h-3 w-3 -rotate-90 text-blue-500 shrink-0 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ── Row 3: 2 Tables (Recent Shipments & Pending Tasks) ──────────── */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Left: Recent Shipment Operations */}
        <Card className="lg:col-span-7 border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl shadow-xs overflow-hidden">
          <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800/80">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Boxes className="h-4 w-4 text-emerald-600" />
                Recent Shipment Operations
              </CardTitle>
              <Link
                href="/dashboard/shipping-line/tracking"
                className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
              >
                View All <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                  <Th className="px-3.5 py-2.5">#</Th>
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
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-1.5 py-2">
                        <Package className="h-6 w-6 text-slate-300 dark:text-slate-600" />
                        <p className="text-xs font-semibold">No recent shipments recorded in your branch scope.</p>
                        <p className="text-[11px] text-slate-400">When BL records or freight consignments are created, they will appear here.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  displayShipments.map((s, idx) => (
                    <tr key={s.id || idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="px-3.5 py-2.5 text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                      <td className="px-3.5 py-2.5 text-slate-600 dark:text-slate-400 whitespace-nowrap text-[11px]">{s.date}</td>
                      <td className="px-3.5 py-2.5 font-bold text-slate-900 dark:text-white whitespace-nowrap">{s.shippingLine}</td>
                      <td className="px-3.5 py-2.5 font-mono text-blue-600 dark:text-blue-400 font-semibold">{s.container}</td>
                      <td className="px-3.5 py-2.5 text-slate-600 dark:text-slate-400 whitespace-nowrap">{s.vessel}</td>
                      <td className="px-3.5 py-2.5 text-slate-600 dark:text-slate-400 whitespace-nowrap">{s.eta}</td>
                      <td className="px-3.5 py-2.5 text-center">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${getStatusBadge(s.status)}`}>
                          {s.status}
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedRecord({ type: "Shipment", ...s })}
                            className="h-6 w-6 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-blue-600 transition-colors"
                            title={tt("common.view_details", "View Details")}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            className="h-6 w-6 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-600"
                          >
                            <MoreVertical className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Right: Pending Tasks */}
        <Card className="lg:col-span-5 border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl shadow-xs overflow-hidden">
          <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800/80">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Clock className="h-4 w-4 text-rose-500" />
                Pending Tasks
              </CardTitle>
              <Link
                href="/dashboard/user-tasks"
                className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
              >
                View All <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                  <Th className="px-3.5 py-2.5">#</Th>
                  <Th className="px-3.5 py-2.5">Task</Th>
                  <Th className="px-3.5 py-2.5">Related To</Th>
                  <Th className="px-3.5 py-2.5">Due Date</Th>
                  <Th className="px-3.5 py-2.5">Priority</Th>
                  <Th className="px-3.5 py-2.5 text-center">Status</Th>
                  <Th className="px-3.5 py-2.5 text-right">Actions</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium text-slate-700 dark:text-slate-300">
                {displayTasks.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-1.5 py-2">
                        <CheckCircle2 className="h-6 w-6 text-slate-300 dark:text-slate-600" />
                        <p className="text-xs font-semibold">No pending operational tasks assigned.</p>
                        <p className="text-[11px] text-slate-400">All workflow handovers and clearing assignments are up to date.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  displayTasks.map((t, idx) => (
                    <tr key={t.id || idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="px-3.5 py-2.5 text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                      <td className="px-3.5 py-2.5 font-bold text-slate-900 dark:text-white truncate max-w-[130px]">{t.task}</td>
                      <td className="px-3.5 py-2.5 text-slate-600 dark:text-slate-400 font-mono text-[11px] whitespace-nowrap">{t.relatedTo}</td>
                      <td className="px-3.5 py-2.5 text-slate-500 whitespace-nowrap text-[11px]">{t.dueDate}</td>
                      <td className="px-3.5 py-2.5 whitespace-nowrap">
                        <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${getPriorityBadge(t.priority || "Medium")}`}>
                          {t.priority}
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5 text-center">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${getStatusBadge(t.status)}`}>
                          {t.status}
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedRecord({ type: "Task", ...t })}
                            className="h-6 w-6 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-blue-600 transition-colors"
                            title={tt("common.view_details", "View Details")}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            className="h-6 w-6 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-600"
                          >
                            <MoreVertical className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      {/* ── Row 4: Tabbed Section (Documents, Containers & Alerts) ───────── */}
      <Card className="border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl shadow-xs overflow-hidden">
        <CardHeader className="pb-2 border-b border-slate-100 dark:border-slate-800/80">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-blue-600" />
              Documents, Containers & Alerts
            </CardTitle>
            <Link
              href="/dashboard/shipping-line/shipment-report"
              className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              View All <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {/* Interactive Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pt-3 scrollbar-none">
            <button
              type="button"
              onClick={() => setActiveTab("documents")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                activeTab === "documents"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              Recent Documents ({recentDocuments.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("containers")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                activeTab === "containers"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
              }`}
            >
              <Boxes className="h-3.5 w-3.5" />
              Containers ({containersData.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("trucks")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                activeTab === "trucks"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
              }`}
            >
              <Truck className="h-3.5 w-3.5" />
              Truck Movements (0)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("agents")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                activeTab === "agents"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              Agent Activities (0)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("alerts")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                activeTab === "alerts"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
              }`}
            >
              <Bell className="h-3.5 w-3.5" />
              System Alerts (0)
            </button>
          </div>
        </CardHeader>

        {/* Tab 1: Recent Documents */}
        {activeTab === "documents" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                  <Th className="px-4 py-3">#</Th>
                  <Th className="px-4 py-3">Date</Th>
                  <Th className="px-4 py-3">Document Type</Th>
                  <Th className="px-4 py-3">Reference No</Th>
                  <Th className="px-4 py-3">Related To</Th>
                  <Th className="px-4 py-3 text-center">Status</Th>
                  <Th className="px-4 py-3 text-right">Actions</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium text-slate-700 dark:text-slate-300">
                {recentDocuments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                      No recent shipping documents recorded
                    </td>
                  </tr>
                ) : (
                  recentDocuments.map((doc, idx) => (
                    <tr key={doc.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="px-4 py-3 text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400 whitespace-nowrap text-[11px]">{doc.date}</td>
                      <td className="px-4 py-3 font-bold text-slate-900 dark:text-white whitespace-nowrap">{doc.type}</td>
                      <td className="px-4 py-3 font-mono font-bold text-blue-600 dark:text-blue-400">{doc.ref}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400 font-mono text-[11px]">{doc.relatedTo}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${getStatusBadge(doc.status)}`}>
                          {doc.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedRecord({ ...doc, recordType: "Document" })}
                            className="h-6 w-6 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-blue-600"
                            title="View Details"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 2: Containers */}
        {activeTab === "containers" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                  <Th className="px-4 py-3">#</Th>
                  <Th className="px-4 py-3">Container No</Th>
                  <Th className="px-4 py-3">Shipping Line</Th>
                  <Th className="px-4 py-3">Size / Type</Th>
                  <Th className="px-4 py-3">Vessel</Th>
                  <Th className="px-4 py-3">Current Location</Th>
                  <Th className="px-4 py-3">Seal No</Th>
                  <Th className="px-4 py-3 text-center">Status</Th>
                  <Th className="px-4 py-3 text-right">Actions</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium text-slate-700 dark:text-slate-300">
                {containersData.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                      No tracked containers found
                    </td>
                  </tr>
                ) : (
                  containersData.map((c, idx) => (
                    <tr key={c.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="px-4 py-3 text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                      <td className="px-4 py-3 font-mono font-bold text-blue-600 dark:text-blue-400">{c.containerNo}</td>
                      <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{c.line}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{c.type}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{c.vessel}</td>
                      <td className="px-4 py-3 text-slate-800 dark:text-slate-200 font-medium">{c.location}</td>
                      <td className="px-4 py-3 font-mono text-slate-500 text-[11px]">{c.seal}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${getStatusBadge(c.status)}`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            href={`/dashboard/shipping-line/tracking?q=${encodeURIComponent(c.containerNo)}`}
                            className="h-6 w-6 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-blue-600"
                            title="Track Container"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 3: Truck Movements */}
        {activeTab === "trucks" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                  <Th className="px-4 py-3">#</Th>
                  <Th className="px-4 py-3">Date</Th>
                  <Th className="px-4 py-3">Truck No</Th>
                  <Th className="px-4 py-3">Driver Name</Th>
                  <Th className="px-4 py-3">Origin - Destination</Th>
                  <Th className="px-4 py-3">Cargo Type</Th>
                  <Th className="px-4 py-3 text-center">Status</Th>
                  <Th className="px-4 py-3 text-right">Actions</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium text-slate-700 dark:text-slate-300">
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                    No truck movements recorded
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 4: Agent Activities */}
        {activeTab === "agents" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                  <Th className="px-4 py-3">#</Th>
                  <Th className="px-4 py-3">Date & Time</Th>
                  <Th className="px-4 py-3">Agent Name</Th>
                  <Th className="px-4 py-3">Activity / Operation</Th>
                  <Th className="px-4 py-3">Reference</Th>
                  <Th className="px-4 py-3 text-center">Status</Th>
                  <Th className="px-4 py-3 text-right">Actions</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium text-slate-700 dark:text-slate-300">
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                    No agent activities recorded
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 5: System Alerts */}
        {activeTab === "alerts" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                  <Th className="px-4 py-3">#</Th>
                  <Th className="px-4 py-3">Alert Description</Th>
                  <Th className="px-4 py-3">Affected Entity</Th>
                  <Th className="px-4 py-3">Date</Th>
                  <Th className="px-4 py-3">Severity</Th>
                  <Th className="px-4 py-3 text-center">Status</Th>
                  <Th className="px-4 py-3 text-right">Actions</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium text-slate-700 dark:text-slate-300">
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                    No active system alerts
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ── Quick Record Preview Modal ───────────────────────────────────── */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-4 animate-in fade-in-50 duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400">
                  <Info className="h-4 w-4" />
                </span>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {selectedRecord.recordType || selectedRecord.type} Details
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="h-7 w-7 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              {Object.entries(selectedRecord)
                .filter(([k]) => k !== "id" && k !== "recordType")
                .map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between py-1 border-b border-slate-50 dark:border-slate-800/40">
                    <span className="font-semibold text-slate-500 capitalize">{key.replace(/([A-Z])/g, " $1")}</span>
                    <span className="font-bold text-slate-900 dark:text-white font-mono">{String(value)}</span>
                  </div>
                ))}
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedRecord(null)}
                className="text-xs"
              >
                Close
              </Button>
              <Link href="/dashboard/shipping-line/tracking">
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold">
                  Open in Tracking
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
