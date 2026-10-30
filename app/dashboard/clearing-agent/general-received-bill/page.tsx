"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  ArrowRightLeft,
  Inbox,
  RefreshCw,
  Plus,
  FileText,
  Landmark,
  Receipt,
  Truck,
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronRight,
  Search,
  X,
  User,
  MapPin,
  Boxes,
} from "lucide-react";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";
import type { SupportedLanguage } from "@/lib/i18n/languages";

interface CustomerOrder {
  id: string;
  order_no: string;
  created_at: string;
  status: string;
  current_stage?: string;
  customer_id?: string;
  customer_name?: string;
  loading_country_name?: string;
  receiving_country_name?: string;
  route_name?: string;
  transport_mode?: string;
  goods_name?: string;
  goods_gross_weight?: number;
  goods_quantity?: number;
  goods_unit?: string;
  truck_number?: string;
  truck_driver_name?: string;
  country_id?: string;
}

function GeneralReceivedBillPageInner() {
  const lang = (useActiveLanguage() || "en") as SupportedLanguage;
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedOrderIdParam = searchParams.get("orderId");

  const tt = (key: string, fallback: string) => t(lang, key as never, fallback);

  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(selectedOrderIdParam);

  useEffect(() => {
    const fetchOrders = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/erp/clearing-agent/customer-order");
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          // Filter to orders that are in general_received_bill stage or all orders
          setOrders(json.data);
        }
      } catch (err) {
        console.error("Failed to fetch orders:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, []);

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const haystack = [
        order.order_no,
        order.customer_name,
        order.goods_name,
        order.truck_number,
        order.truck_driver_name,
        order.loading_country_name,
        order.receiving_country_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [orders, searchQuery]);

  const selectedOrder = useMemo(() => {
    if (!selectedOrderId) return null;
    return orders.find((o) => o.id === selectedOrderId) || null;
  }, [orders, selectedOrderId]);

  const billTypes = [
    {
      key: "customs",
      label: tt("bill_type_customs", "Customs Bills"),
      desc: tt("bill_type_customs_desc", "Tariff clearance & border duty"),
      icon: <Landmark className="h-4 w-4" />,
      color: "amber",
      href: (order: CustomerOrder) =>
        `/dashboard/clearing-agent/customs-expenses?orderId=${order.id}&orderNo=${encodeURIComponent(order.order_no)}&customerId=${order.customer_id || ""}&customerName=${encodeURIComponent(order.customer_name || "")}&loadingCountry=${encodeURIComponent(order.loading_country_name || "")}&receivingCountry=${encodeURIComponent(order.receiving_country_name || "")}&goodsName=${encodeURIComponent(order.goods_name || "")}`,
    },
    {
      key: "truck",
      label: tt("bill_type_truck", "Truck Expense Bills"),
      desc: tt("bill_type_truck_desc", "Freight, tolls & driver advance"),
      icon: <Truck className="h-4 w-4" />,
      color: "blue",
      href: (order: CustomerOrder) =>
        `/dashboard/clearing-agent/truck-expenses?orderId=${order.id}&orderNo=${encodeURIComponent(order.order_no)}&customerId=${order.customer_id || ""}&customerName=${encodeURIComponent(order.customer_name || "")}&truckNo=${encodeURIComponent(order.truck_number || "")}&driver=${encodeURIComponent(order.truck_driver_name || "")}&loadingCountry=${encodeURIComponent(order.loading_country_name || "")}&receivingCountry=${encodeURIComponent(order.receiving_country_name || "")}&goodsName=${encodeURIComponent(order.goods_name || "")}`,
    },
    {
      key: "customer",
      label: tt("bill_type_customer", "Customer Expense Bills"),
      desc: tt("bill_type_customer_desc", "Direct client disbursements"),
      icon: <Receipt className="h-4 w-4" />,
      color: "emerald",
      href: (order: CustomerOrder) =>
        `/dashboard/clearing-agent/customer-expenses?orderId=${order.id}&orderNo=${encodeURIComponent(order.order_no)}&customerId=${order.customer_id || ""}&customerName=${encodeURIComponent(order.customer_name || "")}&loadingCountry=${encodeURIComponent(order.loading_country_name || "")}&receivingCountry=${encodeURIComponent(order.receiving_country_name || "")}&goodsName=${encodeURIComponent(order.goods_name || "")}`,
    },
    {
      key: "other",
      label: tt("bill_type_other", "Other Expense Bills"),
      desc: tt("bill_type_other_desc", "Inspection, lab, seals & fees"),
      icon: <FileText className="h-4 w-4" />,
      color: "purple",
      href: (order: CustomerOrder) =>
        `/dashboard/clearing-agent/other-expenses?orderId=${order.id}&orderNo=${encodeURIComponent(order.order_no)}&customerName=${encodeURIComponent(order.customer_name || "")}&loadingCountry=${encodeURIComponent(order.loading_country_name || "")}&receivingCountry=${encodeURIComponent(order.receiving_country_name || "")}&goodsName=${encodeURIComponent(order.goods_name || "")}`,
    },
  ];

  const colorMap: Record<string, { bg: string; text: string; border: string; btn: string }> = {
    amber: {
      bg: "bg-amber-50 dark:bg-amber-950/20",
      text: "text-amber-700 dark:text-amber-300",
      border: "border-amber-200 dark:border-amber-800",
      btn: "bg-amber-600 hover:bg-amber-700",
    },
    blue: {
      bg: "bg-blue-50 dark:bg-blue-950/20",
      text: "text-blue-700 dark:text-blue-300",
      border: "border-blue-200 dark:border-blue-800",
      btn: "bg-blue-600 hover:bg-blue-700",
    },
    emerald: {
      bg: "bg-emerald-50 dark:bg-emerald-950/20",
      text: "text-emerald-700 dark:text-emerald-300",
      border: "border-emerald-200 dark:border-emerald-800",
      btn: "bg-emerald-600 hover:bg-emerald-700",
    },
    purple: {
      bg: "bg-purple-50 dark:bg-purple-950/20",
      text: "text-purple-700 dark:text-purple-300",
      border: "border-purple-200 dark:border-purple-800",
      btn: "bg-purple-600 hover:bg-purple-700",
    },
  };

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="min-h-screen bg-slate-50/50 dark:bg-slate-950 p-4 md:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
            <Link href="/dashboard" className="hover:text-blue-600 transition">
              {tt("nav_dashboard", "Dashboard")}
            </Link>
            <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
            <Link href="/dashboard/clearing-agent/order-transfer" className="hover:text-blue-600 transition">
              {tt("nav_order_transfer", "Order Transfer")}
            </Link>
            <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
            <span className="text-slate-900 dark:text-white font-bold">
              {tt("nav_general_received_bill", "General Received Bill")}
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 text-white shadow-md shadow-cyan-500/20">
              <Inbox className="h-5 w-5" />
            </span>
            {tt("title_general_received_bill", "Clearing Agent — General Received Bill")}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {tt("general_received_subtitle", "Select a customer order and route it to the appropriate expense bill module.")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/clearing-agent/order-transfer"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 shadow-xs transition"
          >
            <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" />
            <span>{tt("btn_back_to_transfer", "Back to Order Transfer")}</span>
          </Link>
        </div>
      </div>

      {selectedOrder ? (
        /* ORDER SELECTED — Show bill routing options */
        <div className="space-y-5">
          {/* Back to list */}
          <button
            type="button"
            onClick={() => setSelectedOrderId(null)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 shadow-xs transition"
          >
            <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" />
            <span>{tt("btn_back_to_orders", "Back to Orders")}</span>
          </button>

          {/* Order Summary Banner */}
          <div className="rounded-2xl border-2 border-cyan-400/40 bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 text-white shadow-xl p-5 space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="px-3 py-1.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                <Inbox className="h-3.5 w-3.5" />
                {tt("general_received_tag", "General Received Bill Desk")}
              </span>
              <span className="font-mono text-xl font-black text-white">{selectedOrder.order_no}</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="rounded-xl border border-slate-700/80 bg-slate-800/60 p-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1 mb-1">
                  <User className="h-3 w-3 text-blue-400" />
                  {tt("customer", "Customer")}
                </span>
                <div className="font-bold text-white truncate">{selectedOrder.customer_name || "—"}</div>
              </div>
              <div className="rounded-xl border border-slate-700/80 bg-slate-800/60 p-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1 mb-1">
                  <MapPin className="h-3 w-3 text-emerald-400" />
                  {tt("route", "Route")}
                </span>
                <div className="font-bold text-white flex items-center gap-1 truncate">
                  <span>{selectedOrder.loading_country_name || "—"}</span>
                  <ArrowRight className="h-3 w-3 text-slate-400 shrink-0 rtl:rotate-180" />
                  <span>{selectedOrder.receiving_country_name || "—"}</span>
                </div>
              </div>
              <div className="rounded-xl border border-slate-700/80 bg-slate-800/60 p-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1 mb-1">
                  <Boxes className="h-3 w-3 text-amber-400" />
                  {tt("goods", "Goods")}
                </span>
                <div className="font-bold text-white truncate">{selectedOrder.goods_name || "—"}</div>
              </div>
              <div className="rounded-xl border border-slate-700/80 bg-slate-800/60 p-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1 mb-1">
                  <Truck className="h-3 w-3 text-indigo-400" />
                  {tt("truck", "Truck")}
                </span>
                <div className="font-mono font-bold text-white truncate">{selectedOrder.truck_number || "—"}</div>
                <div className="text-[10px] text-slate-400 truncate">{selectedOrder.truck_driver_name || ""}</div>
              </div>
            </div>
          </div>

          {/* Bill Type Cards */}
          <div>
            <h2 className="text-sm font-black text-slate-900 dark:text-white mb-3 flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4 text-blue-600" />
              {tt("select_bill_type", "Select Bill Type to Enter Expenses")}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {billTypes.map((bt) => {
                const colors = colorMap[bt.color];
                return (
                  <Link
                    key={bt.key}
                    href={bt.href(selectedOrder)}
                    className={`group rounded-2xl border ${colors.border} ${colors.bg} p-4 flex items-start justify-between gap-3 hover:shadow-md transition`}
                  >
                    <div className="flex items-start gap-3">
                      <span className={`p-2 rounded-xl border ${colors.border} ${colors.bg} ${colors.text} shrink-0`}>
                        {bt.icon}
                      </span>
                      <div>
                        <div className={`font-bold text-sm ${colors.text}`}>{bt.label}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{bt.desc}</div>
                      </div>
                    </div>
                    <span className={`shrink-0 inline-flex items-center gap-1 rounded-lg ${colors.btn} text-white font-bold px-3 py-1.5 text-xs shadow-xs transition`}>
                      <Plus className="h-3.5 w-3.5" />
                      {tt("btn_open_bill", "Open Bill")}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* ORDER LIST */
        <div className="rounded-2xl border border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900/90 shadow-sm overflow-hidden">
          {/* Search */}
          <div className="p-4 border-b border-slate-100 dark:border-slate-800">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder={tt("search_placeholder", "Search by order no, customer, goods...")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 pl-9 pr-3 text-xs text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-800 dark:bg-slate-800/50 dark:text-white"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/70 border-b border-slate-200/80 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:bg-slate-800/40 dark:border-slate-800 dark:text-slate-400">
                <tr>
                  <th className="py-3 px-4">{tt("col_order_no", "Order No")}</th>
                  <th className="py-3 px-4">{tt("col_customer", "Customer")}</th>
                  <th className="py-3 px-4">{tt("col_route", "Route")}</th>
                  <th className="py-3 px-4">{tt("col_goods", "Goods")}</th>
                  <th className="py-3 px-4">{tt("col_truck", "Truck")}</th>
                  <th className="py-3 px-4">{tt("col_status", "Status")}</th>
                  <th className="py-3 px-4 text-center">{tt("col_action", "Action")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-blue-500" />
                      <span>{tt("loading", "Loading orders...")}</span>
                    </td>
                  </tr>
                ) : filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <Inbox className="h-8 w-8 mx-auto mb-2 text-slate-300 dark:text-slate-700" />
                      <p className="font-bold text-sm text-slate-700 dark:text-slate-300">
                        {tt("no_orders", "No orders found")}
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order) => (
                    <tr
                      key={order.id}
                      className="hover:bg-cyan-50/40 dark:hover:bg-slate-800/40 transition group"
                    >
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => setSelectedOrderId(order.id)}
                          className="font-mono font-bold text-blue-600 hover:text-blue-800 hover:underline dark:text-blue-400"
                        >
                          {order.order_no}
                        </button>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {order.created_at ? new Date(order.created_at).toLocaleDateString() : "—"}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 dark:text-white">{order.customer_name || "—"}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-200">
                          <span>{order.loading_country_name || "—"}</span>
                          <ArrowRight className="h-3 w-3 text-slate-400 rtl:rotate-180" />
                          <span>{order.receiving_country_name || "—"}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 dark:text-white">{order.goods_name || "—"}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-mono font-bold text-slate-800 dark:text-slate-200">{order.truck_number || "—"}</div>
                        <div className="text-[10px] text-slate-500">{order.truck_driver_name || ""}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 rounded-full bg-cyan-50 px-2.5 py-0.5 text-[11px] font-bold text-cyan-700 border border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-400 dark:border-cyan-800">
                          <Inbox className="h-3 w-3" />
                          {tt("status_received", "Received")}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => setSelectedOrderId(order.id)}
                          className="inline-flex items-center gap-1 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold px-3 py-1.5 text-xs shadow-xs transition"
                        >
                          <ArrowRightLeft className="h-3.5 w-3.5" />
                          <span>{tt("btn_route_bills", "Route Bills")}</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function GeneralReceivedBillPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-slate-400">Loading General Received Bill...</div>}>
      <GeneralReceivedBillPageInner />
    </Suspense>
  );
}

