"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  ArrowRightLeft,
  Search,
  RefreshCw,
  Plus,
  Eye,
  FileText,
  Printer,
  Truck,
  Ship,
  Landmark,
  Receipt,
  UserCheck,
  CheckCircle2,
  Clock,
  MapPin,
  Calendar,
  Building2,
  User,
  Boxes,
  Scale,
  Sparkles,
  ChevronRight,
  Filter,
  ExternalLink,
  ShieldCheck,
  AlertCircle
} from "lucide-react";

import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { TaskHandoverModal } from "@/features/transfer-center/components/task-handover-modal";

interface OrderLeg {
  id?: string;
  leg_no?: number;
  from_country_name?: string;
  to_country_name?: string;
  transport_mode?: string;
  responsible_clearing_agent_name?: string;
}

interface OrderParty {
  party_type?: string;
  party_customer_name?: string;
  party_company_name?: string;
  selected_address_text?: string;
}

interface CustomerOrder {
  id: string;
  order_no: string;
  created_at: string;
  status: string;
  current_stage?: string;
  customer_id?: string;
  customer_name?: string;
  loading_country_id?: string;
  loading_country_name?: string;
  receiving_country_id?: string;
  receiving_country_name?: string;
  route_name?: string;
  transport_mode?: string;
  movement_type?: string;
  goods_name?: string;
  goods_chs_code?: string;
  goods_variation_label?: string;
  goods_quantity?: number;
  goods_unit?: string;
  goods_gross_weight?: number;
  goods_net_weight?: number;
  goods_empty_weight?: number;
  truck_number?: string;
  truck_driver_name?: string;
  truck_driver_mobile?: string;
  truck_transport_company?: string;
  truck_loading_location?: string;
  truck_registration_type?: string;
  remarks?: string;
  country_id?: string;
  legs?: OrderLeg[];
  party_links?: OrderParty[];
  latest_handover?: {
    id: string;
    status: string;
    receiver_user_id?: string;
    sender_user_id?: string;
  };
}

export function CustomerOrderTransferView() {
  const activeLang = useActiveLanguage();
  const lang = (activeLang || "en") as SupportedLanguage;
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);
  const router = useRouter();
  const searchParams = useSearchParams();

  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(searchParams.get("orderId") || null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [modeFilter, setModeFilter] = useState("all");
  const [handoverModalOpen, setHandoverModalOpen] = useState(false);

  const tt = (key: string, fallback: string) => t(lang, key as never, fallback);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/erp/clearing-agent/customer-order");
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setOrders(json.data);
      }
    } catch (err) {
      console.error("Failed to load customer orders for transfer:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const selectedOrder = useMemo(() => {
    if (!selectedOrderId) return null;
    return orders.find((o) => o.id === selectedOrderId) || null;
  }, [orders, selectedOrderId]);

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      if (statusFilter !== "all" && (order.status || "pending").toLowerCase() !== statusFilter.toLowerCase()) {
        return false;
      }
      if (modeFilter !== "all" && (order.transport_mode || "").toLowerCase() !== modeFilter.toLowerCase()) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const haystack = [
          order.order_no,
          order.customer_name,
          order.goods_name,
          order.truck_number,
          order.truck_driver_name,
          order.loading_country_name,
          order.receiving_country_name,
          order.route_name
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [orders, searchQuery, statusFilter, modeFilter]);

  const stats = useMemo(() => {
    return {
      total: orders.length,
      active: orders.filter((o) => ["in_progress", "booking_confirmed", "confirmed", "1C"].includes(o.status || o.current_stage || "")).length,
      completed: orders.filter((o) => (o.status || "").toLowerCase() === "completed").length,
      byRoad: orders.filter((o) => (o.transport_mode || "").toLowerCase().includes("road")).length
    };
  }, [orders]);

  const getStatusBadge = (status: string, stage?: string) => {
    const s = (status || stage || "pending").toLowerCase();
    if (s.includes("completed")) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
          <CheckCircle2 className="h-3 w-3" />
          {tt("status_completed", "Completed")}
        </span>
      );
    }
    if (s.includes("confirm") || s.includes("accepted") || s === "1c") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800">
          <Clock className="h-3 w-3" />
          {tt("status_confirmed", "Confirmed")}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800">
        <Clock className="h-3 w-3" />
        {status || "Draft"}
      </span>
    );
  };

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="min-h-screen bg-slate-50/50 dark:bg-slate-950 p-4 md:p-6 lg:p-8 space-y-6">
      {/* Top Header & Breadcrumbs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
            <Link href="/dashboard" className="hover:text-blue-600 transition">
              {tt("nav_dashboard", "Dashboard")}
            </Link>
            <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
            <span>{tt("nav_shipping_clearing", "Shipping & Clearing")}</span>
            <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
            <span className="text-slate-900 dark:text-white font-bold">
              {tt("nav_customer_order_transfer", "Customer Order Transfer")}
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20">
              <ArrowRightLeft className="h-5 w-5" />
            </span>
            {tt("nav_customer_order_transfer", "Customer Order Transfer")}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {tt("order_transfer_subtitle", "Transfer, route and manage customer orders across Customs, Truck, Customer and Other Expense bills")}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchOrders}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 shadow-xs transition"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>{tt("refresh", "Refresh")}</span>
          </button>
          <Link
            href="/dashboard/clearing-agent/customer-order"
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-blue-600/20 hover:bg-blue-700 transition"
          >
            <Plus className="h-4 w-4" />
            <span>{tt("new_order", "New Customer Order")}</span>
          </Link>
        </div>
      </div>

      {/* KPI Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/90 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              {tt("total_orders", "Total Orders")}
            </span>
            <FileText className="h-4 w-4 text-blue-500" />
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
            {stats.total}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/90 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-500">
              {tt("ready_for_transfer", "Ready for Transfer")}
            </span>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-black text-amber-600 dark:text-amber-400">
            {stats.active}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/90 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-500">
              {tt("completed_orders", "Completed")}
            </span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-600 dark:text-emerald-400">
            {stats.completed}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/90 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-500">
              {tt("road_transport", "Road Fleet")}
            </span>
            <Truck className="h-4 w-4 text-indigo-500" />
          </div>
          <div className="mt-2 text-2xl font-black text-indigo-600 dark:text-indigo-400">
            {stats.byRoad}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {!selectedOrder ? (
        /* ================= FULL SIZE ORDERS TABLE ================= */
        <div className="rounded-2xl border border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900/90 shadow-sm overflow-hidden">
          {/* Table Search & Controls Bar */}
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 rtl:left-auto rtl:right-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder={tt("search_transfer_placeholder", "Search by order no, customer, route, truck...")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 pl-9 pr-3 rtl:pl-3 rtl:pr-9 text-xs text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-hidden dark:border-slate-800 dark:bg-slate-800/50 dark:text-white"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
              >
                <option value="all">{tt("all_statuses", "All Statuses")}</option>
                <option value="draft">{tt("status_draft", "Draft")}</option>
                <option value="confirmed">{tt("status_confirmed", "Confirmed")}</option>
                <option value="completed">{tt("status_completed", "Completed")}</option>
              </select>

              <select
                value={modeFilter}
                onChange={(e) => setModeFilter(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
              >
                <option value="all">{tt("all_modes", "All Modes")}</option>
                <option value="road">{tt("mode_road", "By Road")}</option>
                <option value="sea">{tt("mode_sea", "By Sea")}</option>
                <option value="air">{tt("mode_air", "By Air")}</option>
              </select>
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto">
            <table className="w-full text-left rtl:text-right text-xs">
              <thead className="bg-slate-50/70 border-b border-slate-200/80 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:bg-slate-800/40 dark:border-slate-800 dark:text-slate-400">
                <tr>
                  <th className="py-3 px-4">{tt("order_no", "Order No")}</th>
                  <th className="py-3 px-4">{tt("customer", "Customer / Party")}</th>
                  <th className="py-3 px-4">{tt("route", "Route (From → To)")}</th>
                  <th className="py-3 px-4">{tt("cargo_manifest", "Cargo Manifest")}</th>
                  <th className="py-3 px-4">{tt("fleet_driver", "Fleet / Driver")}</th>
                  <th className="py-3 px-4">{tt("status", "Status")}</th>
                  <th className="py-3 px-4 text-center">{tt("actions", "Actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-blue-500" />
                      <span>{tt("loading_orders", "Loading customer orders...")}</span>
                    </td>
                  </tr>
                ) : filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <FileText className="h-8 w-8 mx-auto mb-2 text-slate-300 dark:text-slate-700" />
                      <p className="font-bold text-sm text-slate-700 dark:text-slate-300">
                        {tt("no_orders_found", "No customer orders found")}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        {tt("create_first_order_hint", "Create a new customer order to transfer to expense bills.")}
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order) => {
                    const fromLoc = order.loading_country_name || "-";
                    const toLoc = order.receiving_country_name || "-";
                    const cargoWeight = order.goods_gross_weight
                      ? `${Number(order.goods_gross_weight).toLocaleString()} kg`
                      : order.goods_net_weight
                      ? `${Number(order.goods_net_weight).toLocaleString()} kg`
                      : "-";

                    return (
                      <tr
                        key={order.id}
                        className="hover:bg-blue-50/40 dark:hover:bg-slate-800/40 transition group"
                      >
                        {/* Order No */}
                        <td className="py-3 px-4">
                          <button
                            type="button"
                            onClick={() => setSelectedOrderId(order.id)}
                            className="font-mono font-bold text-blue-600 hover:text-blue-800 hover:underline dark:text-blue-400 text-left rtl:text-right"
                          >
                            {order.order_no}
                          </button>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {order.created_at ? new Date(order.created_at).toLocaleDateString() : "-"}
                          </div>
                        </td>

                        {/* Customer */}
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900 dark:text-white">
                            {order.customer_name || tt("customer_unspecified", "Unspecified Customer")}
                          </div>
                          {order.movement_type ? (
                            <span className="inline-block mt-0.5 text-[10px] uppercase font-semibold text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                              {order.movement_type}
                            </span>
                          ) : null}
                        </td>

                        {/* Route */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-200">
                            <span>{fromLoc}</span>
                            <ArrowRight className="h-3 w-3 text-slate-400 rtl:rotate-180" />
                            <span>{toLoc}</span>
                          </div>
                          {order.route_name ? (
                            <div className="text-[10px] text-slate-400 mt-0.5">{order.route_name}</div>
                          ) : null}
                        </td>

                        {/* Cargo */}
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900 dark:text-white">
                            {order.goods_name || tt("general_cargo", "General Cargo")}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            {order.goods_quantity ? `${order.goods_quantity} ${order.goods_unit || "pkgs"}` : ""}
                            {cargoWeight !== "-" ? ` • ${cargoWeight}` : ""}
                          </div>
                        </td>

                        {/* Fleet / Truck */}
                        <td className="py-3 px-4">
                          <div className="font-mono font-bold text-slate-800 dark:text-slate-200">
                            {order.truck_number || "-"}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            {order.truck_driver_name || "-"}
                            {order.truck_driver_mobile ? ` (${order.truck_driver_mobile})` : ""}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4">
                          {getStatusBadge(order.status, order.current_stage)}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => setSelectedOrderId(order.id)}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-1.5 text-xs shadow-xs transition"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            <span>{tt("view_and_transfer", "View & Transfer")}</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ================= FULL-SIZE DETAIL & TRANSFER VIEW ================= */
        <div className="space-y-6">
          {/* Top Bar for Selected Order */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSelectedOrderId(null)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition"
              >
                <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
                <span>{tt("back_to_orders", "Back to Orders")}</span>
              </button>

              <div className="h-5 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block" />

              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  {tt("selected_order", "Selected Order")}
                </span>
                <span className="font-mono text-base font-black text-slate-900 dark:text-white">
                  {selectedOrder.order_no}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {getStatusBadge(selectedOrder.status, selectedOrder.current_stage)}

              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>{tt("print", "Print")}</span>
              </button>
            </div>
          </div>

          {/* 2-Column Split: LEFT Transfer Options Panel, RIGHT Full-Size Order Details */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* ================= LEFT SIDE: EXPENSES & TRANSFER OPTIONS (4 Cols) ================= */}
            <div className="lg:col-span-4 space-y-4">
              <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-900/60 dark:bg-blue-950/20">
                <div className="flex items-center gap-2 text-blue-800 dark:text-blue-300 font-black text-sm">
                  <ArrowRightLeft className="h-4 w-4" />
                  <span>{tt("transfer_destinations_title", "Transfer Order & Route Expenses")}</span>
                </div>
                <p className="text-[11px] text-blue-700/80 dark:text-blue-300/80 mt-1 leading-relaxed">
                  {tt(
                    "transfer_destinations_desc",
                    "Select an expense bill destination to create or transfer operational charges for this order."
                  )}
                </p>
              </div>

              {/* Destination Card 1: Customs Duty & Expenses */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 shadow-xs hover:border-blue-300 dark:hover:border-blue-700 transition">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="p-2 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
                      <Landmark className="h-4 w-4" />
                    </span>
                    <div>
                      <h4 className="font-bold text-xs text-slate-900 dark:text-white">
                        {tt("customs_expenses_bill", "Customs Bills")}
                      </h4>
                      <p className="text-[10px] text-slate-400">
                        {tt("customs_bill_desc", "Tariff clearance, border duty & agent fee")}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <Link
                    href={`/dashboard/clearing-agent/customs-expenses?orderId=${selectedOrder.id}&orderNo=${encodeURIComponent(selectedOrder.order_no)}&customerId=${selectedOrder.customer_id || ""}`}
                    className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold py-2 text-xs shadow-xs transition"
                  >
                    <span>{tt("transfer_to_customs", "Transfer to Customs Bill")}</span>
                    <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
                  </Link>
                </div>
              </div>

              {/* Destination Card 2: Truck Expenses Bills */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 shadow-xs hover:border-blue-300 dark:hover:border-blue-700 transition">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="p-2 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
                      <Truck className="h-4 w-4" />
                    </span>
                    <div>
                      <h4 className="font-bold text-xs text-slate-900 dark:text-white">
                        {tt("truck_expenses_bill", "Truck Expenses Bills")}
                      </h4>
                      <p className="text-[10px] text-slate-400">
                        {tt("truck_bill_desc", "Freight charges, fuel, tolls & driver advance")}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <Link
                    href={`/dashboard/clearing-agent/truck-expenses?orderId=${selectedOrder.id}&orderNo=${encodeURIComponent(selectedOrder.order_no)}&truckNo=${encodeURIComponent(selectedOrder.truck_number || "")}&driver=${encodeURIComponent(selectedOrder.truck_driver_name || "")}`}
                    className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 text-xs shadow-xs transition"
                  >
                    <span>{tt("transfer_to_truck_expenses", "Transfer to Truck Expenses")}</span>
                    <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
                  </Link>
                </div>
              </div>

              {/* Destination Card 3: Customer Expenses Bills */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 shadow-xs hover:border-blue-300 dark:hover:border-blue-700 transition">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                      <Receipt className="h-4 w-4" />
                    </span>
                    <div>
                      <h4 className="font-bold text-xs text-slate-900 dark:text-white">
                        {tt("customer_expenses_bill", "Customer Expenses Bills")}
                      </h4>
                      <p className="text-[10px] text-slate-400">
                        {tt("customer_bill_desc", "Direct client disbursements & billable expenses")}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <Link
                    href={`/dashboard/clearing-agent/customer-bill?type=expenses&orderId=${selectedOrder.id}&orderNo=${encodeURIComponent(selectedOrder.order_no)}&customerId=${selectedOrder.customer_id || ""}`}
                    className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 text-xs shadow-xs transition"
                  >
                    <span>{tt("transfer_to_customer_expenses", "Transfer to Customer Expenses")}</span>
                    <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
                  </Link>
                </div>
              </div>

              {/* Destination Card 4: Other Expenses Bills */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 shadow-xs hover:border-blue-300 dark:hover:border-blue-700 transition">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="p-2 rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400">
                      <FileText className="h-4 w-4" />
                    </span>
                    <div>
                      <h4 className="font-bold text-xs text-slate-900 dark:text-white">
                        {tt("other_expenses_bill", "Other Expenses Bills")}
                      </h4>
                      <p className="text-[10px] text-slate-400">
                        {tt("other_bill_desc", "Inspection, lab, seals, incidentals & extra fees")}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <Link
                    href={`/dashboard/clearing-agent/other-expenses?orderId=${selectedOrder.id}&orderNo=${encodeURIComponent(selectedOrder.order_no)}`}
                    className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 text-xs shadow-xs transition"
                  >
                    <span>{tt("transfer_to_other_expenses", "Transfer to Other Expenses")}</span>
                    <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
                  </Link>
                </div>
              </div>

              {/* Additional Operations: Handover / Assign & Official Customer Bill */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
                <button
                  type="button"
                  onClick={() => setHandoverModalOpen(true)}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50/70 hover:bg-indigo-100 text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-300 font-bold py-2 text-xs transition"
                >
                  <UserCheck className="h-4 w-4" />
                  <span>{tt("assign_handover_order", "Assign / Handover to User")}</span>
                </button>

                <Link
                  href={`/dashboard/clearing-agent/customer-bill?new=true&orderId=${selectedOrder.id}&customerId=${selectedOrder.customer_id || ""}`}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 font-bold py-2 text-xs transition"
                >
                  <Receipt className="h-4 w-4" />
                  <span>{tt("create_customer_invoice", "Create Customer Invoice")}</span>
                </Link>
              </div>
            </div>

            {/* ================= RIGHT SIDE: FULL SIZE ORDER DETAILS (8 Cols) ================= */}
            <div className="lg:col-span-8 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 shadow-sm space-y-6">
              {/* Order Header Summary */}
              <div className="border-b border-slate-100 dark:border-slate-800 pb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-lg font-black text-slate-900 dark:text-white">
                      {selectedOrder.order_no}
                    </span>
                    {getStatusBadge(selectedOrder.status, selectedOrder.current_stage)}
                  </div>
                  <div className="text-xs text-slate-400 mt-1 flex items-center gap-3">
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {selectedOrder.created_at ? new Date(selectedOrder.created_at).toLocaleDateString() : "-"}
                    </span>
                    {selectedOrder.transport_mode ? (
                      <span className="inline-flex items-center gap-1 uppercase font-semibold">
                        <Truck className="h-3 w-3" />
                        {selectedOrder.transport_mode}
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="text-right rtl:text-left">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    {tt("booking_party", "Booking Customer")}
                  </span>
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    {selectedOrder.customer_name || "-"}
                  </span>
                </div>
              </div>

              {/* Route & Geographic Legs */}
              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-800/40 space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-blue-500" />
                  <span>{tt("route_and_transit", "Transit Route")}</span>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm font-bold text-slate-900 dark:text-white pt-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-normal text-slate-400">{tt("from", "From")}:</span>
                    <span>{selectedOrder.loading_country_name || "-"}</span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-400 rtl:rotate-180" />
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-normal text-slate-400">{tt("to", "To")}:</span>
                    <span>{selectedOrder.receiving_country_name || "-"}</span>
                  </div>
                </div>
                {selectedOrder.route_name ? (
                  <p className="text-xs text-slate-500">{selectedOrder.route_name}</p>
                ) : null}
              </div>

              {/* Cargo & Goods Manifest */}
              <div className="space-y-3">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Boxes className="h-3.5 w-3.5 text-indigo-500" />
                  <span>{tt("cargo_manifest", "Cargo Manifest & Goods")}</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-xl border border-slate-100 bg-slate-50/40 p-3 dark:border-slate-800 dark:bg-slate-800/30">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">{tt("item_name", "Item Name")}</span>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1 block">
                      {selectedOrder.goods_name || "-"}
                    </span>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50/40 p-3 dark:border-slate-800 dark:bg-slate-800/30">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">{tt("chs_code", "CHS Code")}</span>
                    <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200 mt-1 block">
                      {selectedOrder.goods_chs_code || "-"}
                    </span>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50/40 p-3 dark:border-slate-800 dark:bg-slate-800/30">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">{tt("quantity", "Quantity")}</span>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1 block">
                      {selectedOrder.goods_quantity ? `${selectedOrder.goods_quantity} ${selectedOrder.goods_unit || ""}` : "-"}
                    </span>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50/40 p-3 dark:border-slate-800 dark:bg-slate-800/30">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">{tt("gross_weight", "Gross Weight")}</span>
                    <span className="text-xs font-bold text-blue-600 dark:text-blue-400 mt-1 block">
                      {selectedOrder.goods_gross_weight ? `${Number(selectedOrder.goods_gross_weight).toLocaleString()} kg` : "-"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Fleet & Transport Details */}
              <div className="space-y-3">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Truck className="h-3.5 w-3.5 text-emerald-500" />
                  <span>{tt("fleet_and_driver", "Fleet & Driver Details")}</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-xl border border-slate-100 bg-slate-50/40 p-3 dark:border-slate-800 dark:bg-slate-800/30">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">{tt("truck_no", "Truck No")}</span>
                    <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200 mt-1 block">
                      {selectedOrder.truck_number || "-"}
                    </span>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50/40 p-3 dark:border-slate-800 dark:bg-slate-800/30">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">{tt("driver_name", "Driver Name")}</span>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1 block">
                      {selectedOrder.truck_driver_name || "-"}
                    </span>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50/40 p-3 dark:border-slate-800 dark:bg-slate-800/30">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">{tt("driver_mobile", "Driver Contact")}</span>
                    <span className="text-xs font-mono text-slate-800 dark:text-slate-200 mt-1 block">
                      {selectedOrder.truck_driver_mobile || "-"}
                    </span>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50/40 p-3 dark:border-slate-800 dark:bg-slate-800/30">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">{tt("transport_co", "Transporter")}</span>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1 block">
                      {selectedOrder.truck_transport_company || "-"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Special Instructions & Remarks */}
              {selectedOrder.remarks ? (
                <div className="rounded-xl border border-slate-100 bg-slate-50/40 p-4 dark:border-slate-800 dark:bg-slate-800/30 space-y-1">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    {tt("remarks", "Remarks & Instructions")}
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                    {selectedOrder.remarks}
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Task Handover Modal */}
      {handoverModalOpen && selectedOrder ? (
        <TaskHandoverModal
          open={handoverModalOpen}
          onClose={() => setHandoverModalOpen(false)}
          orderReference={selectedOrder.order_no}
          sourceTable="clearing_customer_orders"
          sourceId={selectedOrder.id}
          targetUrl={`/dashboard/clearing-agent/order-transfer?orderId=${selectedOrder.id}`}
          defaultTask={tt("handover_transfer_task", "Please review and process expense transfers for customer order {orderNo}.").replace("{orderNo}", selectedOrder.order_no)}
          sourceCountryId={selectedOrder.country_id || selectedOrder.loading_country_id || null}
          domain="business"
          onSuccess={() => {
            setHandoverModalOpen(false);
            fetchOrders();
          }}
          lang={lang}
        />
      ) : null}
    </div>
  );
}
