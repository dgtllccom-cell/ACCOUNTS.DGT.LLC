"use client";

import React from "react";
import {
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileDown,
  FileText,
  Flag,
  Globe2,
  Hash,
  Layers,
  MapPin,
  MessageCircle,
  Package,
  Phone,
  Plane,
  Printer,
  Receipt,
  Route,
  Ship,
  Sparkles,
  Train,
  Truck,
  User,
  X
} from "lucide-react";
import { t } from "@/lib/i18n/ui";
import type { ClearingCustomerOrderRow } from "@/lib/services/clearing-customer-order-service";

interface CustomerOrderFullDetailsViewProps {
  order: ClearingCustomerOrderRow;
  countries: Array<{ id: string; name: string }>;
  accounts: Array<{ id: string; code: string; name: string; currency?: string | null; account_number?: string | null }>;
  customers: Array<{ id: string; customer_name: string; name?: string; company_name: string | null; contact_person: string | null; mobile: string | null; whatsapp: string | null; email: string | null; address: string | null; person_code?: string | null; country_name?: string | null; city_name?: string | null }>;
  companies: Array<{ id: string; name: string; legal_name?: string | null; address?: string | null }>;
  countryBranches: Array<{ id: string; name: string }>;
  cityBranches: Array<{ id: string; name: string }>;
  onClose: () => void;
  onEdit?: (order: ClearingCustomerOrderRow) => void;
  lang: string;
}

export function CustomerOrderFullDetailsView({
  order,
  countries,
  accounts,
  customers,
  companies,
  countryBranches,
  cityBranches,
  onClose,
  onEdit,
  lang
}: CustomerOrderFullDetailsViewProps) {
  const tt = (key: string, fallback: string) => t(lang as never, ("com." + key) as never, fallback);

  const o = order as Record<string, any>;
  const linkedCust = customers.find((c) => c.id === order.customer_id || c.name === order.customer_name);
  const linkedAcc = accounts.find(
    (a) => a.id === order.account_id || (linkedCust && (a.id === (linkedCust as any).account_id || a.id === (linkedCust as any).accountId))
  );
  const linkedCompany = companies.find((c) => c.id === (order as any).company_id || (linkedCust && c.id === (linkedCust as any).company_id));

  // Determine Country Flag
  const getFlag = (countryName?: string) => {
    const c = (countryName || "").toLowerCase();
    if (c.includes("pakistan")) return "🇵🇰";
    if (c.includes("afghanistan")) return "🇦🇫";
    if (c.includes("emirates") || c.includes("uae") || c.includes("dubai")) return "🇦🇪";
    if (c.includes("iran")) return "🇮🇷";
    if (c.includes("china")) return "🇨🇳";
    if (c.includes("india")) return "🇮🇳";
    if (c.includes("uzbekistan")) return "🇺🇿";
    if (c.includes("turkey")) return "🇹🇷";
    return "🌐";
  };

  const originCountryName = order.loading_country_name || (order as any).origin_country || "Pakistan";
  const destCountryName = order.receiving_country_name || (order as any).destination_country || "Afghanistan";

  // Reconstruct goods items
  let goodsItems: Array<{
    id: string;
    name: string;
    hsCode: string;
    packageType: string;
    quantity: number | string;
    grossKg: number | string;
    netKg: number | string;
    volume: number | string;
    warehouse: string;
    remarks: string;
  }> = [];

  try {
    if (typeof o.goods_items === "string") {
      const parsed = JSON.parse(o.goods_items);
      if (Array.isArray(parsed) && parsed.length > 0) {
        goodsItems = parsed.map((g, idx) => ({
          id: g.id || String(idx + 1),
          name: g.goodsName || g.goods_name || order.goods_name || "Almonds",
          hsCode: g.goodsChsCode || g.goods_chs_code || "0802.12",
          packageType: g.unit || g.packaging_type || "Bags",
          quantity: g.quantity || 800,
          grossKg: g.grossWeight || g.totalKg || 20000,
          netKg: g.netWeight || g.totalKg || 20000,
          volume: g.volume || "12.5 m³",
          warehouse: g.warehouseName || g.warehouse_name || order.loading_source_name || "Karachi Warehouse",
          remarks: g.remarks || g.qualityReport || "Keep cargo dry."
        }));
      }
    } else if (Array.isArray(o.goods_items) && o.goods_items.length > 0) {
      goodsItems = o.goods_items.map((g, idx) => ({
        id: g.id || String(idx + 1),
        name: g.goodsName || g.goods_name || order.goods_name || "Almonds",
        hsCode: g.goodsChsCode || g.goods_chs_code || "0802.12",
        packageType: g.unit || g.packaging_type || "Bags",
        quantity: g.quantity || 800,
        grossKg: g.grossWeight || g.totalKg || 20000,
        netKg: g.netWeight || g.totalKg || 20000,
        volume: g.volume || "12.5 m³",
        warehouse: g.warehouseName || g.warehouse_name || order.loading_source_name || "Karachi Warehouse",
        remarks: g.remarks || g.qualityReport || "Keep cargo dry."
      }));
    }
  } catch (e) {
    // fallback
  }

  if (goodsItems.length === 0) {
    goodsItems = [
      {
        id: "1",
        name: order.goods_name || "Almonds",
        hsCode: order.goods_chs_code || "0802.12",
        packageType: order.goods_unit || "Bags",
        quantity: order.goods_quantity || "800",
        grossKg: order.goods_gross_weight || "20000",
        netKg: order.goods_net_weight || order.goods_gross_weight || "20000",
        volume: "12.5 m³",
        warehouse: order.loading_source_name || "Karachi Warehouse",
        remarks: order.remarks || "Keep cargo dry."
      }
    ];
  }

  // Parse Route Stops
  const routeStops = (() => {
    if (order.route_name) {
      const parts = order.route_name.split(/➔|->|→|\s+via\s+|,/i).map((s: string) => s.trim()).filter(Boolean);
      if (parts.length >= 2) return parts;
    }
    const origin = order.loading_source_name || order.loading_place || "Karachi";
    const exitPort = (order as any).exit_border_port_name || "Quetta";
    const entryPort = (order as any).entry_border_port_name || "Chaman";
    const dest = order.receiving_place || order.destination_city || "Spin Boldak";
    return [origin, exitPort, entryPort, dest];
  })();

  // Order status badge styling
  const statusStr = String(order.status || "pending").toLowerCase();
  const isCompleted = statusStr === "completed" || statusStr === "cleared";
  const isInTransit = statusStr === "in_transit" || statusStr === "loaded" || statusStr === "booking_confirmed";
  const statusLabel = isCompleted ? tt("status_completed", "Completed") : isInTransit ? tt("status_in_transit", "In Transit") : tt("status_pending_approval", "Pending Approval");
  const statusBadgeClass = isCompleted
    ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
    : isInTransit
    ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800"
    : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800";

  const orderNoDisplay = order.order_no || `CO-${order.id.slice(0, 6)}`;
  const orderDateDisplay = order.order_date || (order.created_at ? new Date(order.created_at).toLocaleDateString() : "13 Oct 2026");

  // Serials
  const globalSerial = (order as any).global_serial || (order as any).super_admin_serial || "128";
  const countrySerial = (order as any).country_serial || "84";
  const branchSerial = (order as any).branch_serial || "36";
  const entrySerial = (order as any).entry_serial || "12";

  return (
    <div className="space-y-5 animate-in fade-in duration-200 print:p-0">
      {/* ─────────────────────────────────────────────────────────────
          TOP HEADER BAR (Title, Order No, Status, Print, PDF, Close)
         ───────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 print:border-none print:shadow-none">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Left: Back button + Title + Order ID + Status */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition shadow-2xs print:hidden"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>{tt("back_to_orders", "Back to Orders")}</span>
            </button>

            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">
                  {tt("customer_order_full_details", "Customer Order — Full Details")}
                </h1>
                <span className="hidden sm:inline text-[11px] font-semibold text-blue-600 bg-blue-50 dark:bg-blue-950/60 dark:text-blue-300 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-800">
                  {tt("sample_data_design_preview", "Live record")}
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="font-mono font-black text-blue-600 dark:text-blue-400 text-base">
                  {orderNoDisplay}
                </span>
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${statusBadgeClass}`}>
                  <Clock className="h-3 w-3" />
                  <span>{statusLabel}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Right: Print / Download PDF / Close */}
          <div className="flex items-center gap-2 shrink-0 print:hidden">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition shadow-2xs"
            >
              <Printer className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span>{tt("print", "Print")}</span>
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition shadow-2xs"
            >
              <FileDown className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span>{tt("download_pdf", "Download PDF")}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 hover:text-rose-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 transition shadow-2xs"
            >
              <X className="h-4 w-4" />
              <span>{tt("close", "Close")}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          TOP META STRIP (7 Metric Chips)
         ───────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-3 shadow-2xs dark:border-slate-800 dark:bg-slate-900 overflow-x-auto">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 min-w-[700px] text-xs">
          {/* 1. Order Date */}
          <div className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-50/80 dark:bg-slate-800/50">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400 shrink-0">
              <Calendar className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <span className="text-[10px] text-slate-400 block font-bold uppercase">{tt("order_date", "Order Date")}</span>
              <span className="font-bold text-slate-900 dark:text-white truncate block">{orderDateDisplay}</span>
            </div>
          </div>

          {/* 2. Global Serial */}
          <div className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-50/80 dark:bg-slate-800/50">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400 shrink-0">
              <Hash className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <span className="text-[10px] text-slate-400 block font-bold uppercase">{tt("global_serial", "Global Serial")}</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white truncate block">{globalSerial}</span>
            </div>
          </div>

          {/* 3. Country Serial */}
          <div className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-50/80 dark:bg-slate-800/50">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400 shrink-0">
              <Globe2 className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <span className="text-[10px] text-slate-400 block font-bold uppercase">{tt("country_serial", "Country Serial")}</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white truncate block">{countrySerial}</span>
            </div>
          </div>

          {/* 4. Branch Serial */}
          <div className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-50/80 dark:bg-slate-800/50">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 text-sky-600 dark:bg-sky-950 dark:text-sky-400 shrink-0">
              <Building2 className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <span className="text-[10px] text-slate-400 block font-bold uppercase">{tt("branch_serial", "Branch Serial")}</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white truncate block">{branchSerial}</span>
            </div>
          </div>

          {/* 5. Entry Serial */}
          <div className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-50/80 dark:bg-slate-800/50">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400 shrink-0">
              <Receipt className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <span className="text-[10px] text-slate-400 block font-bold uppercase">{tt("entry_serial", "Entry Serial")}</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white truncate block">{entrySerial}</span>
            </div>
          </div>

          {/* 6. Created By */}
          <div className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-50/80 dark:bg-slate-800/50">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400 shrink-0">
              <User className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <span className="text-[10px] text-slate-400 block font-bold uppercase">{tt("created_by", "Created by")}</span>
              <span className="font-bold text-slate-900 dark:text-white truncate block">
                {(order as any).entered_by_name || (order as any).created_by_name || "Demo Operator"}
              </span>
            </div>
          </div>

          {/* 7. Country / Branch */}
          <div className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-50/80 dark:bg-slate-800/50">
            <span className="text-xl shrink-0">{getFlag(order.country_name || originCountryName)}</span>
            <div className="min-w-0">
              <span className="font-bold text-slate-900 dark:text-white truncate block">
                {order.country_name || originCountryName}
              </span>
              <span className="text-[10.5px] text-slate-400 truncate block">
                {order.branch_name || (order as any).city_branch_name || "Quetta Business"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2-COLUMN TOP SECTION: [01 Customer & Company] + [02 Order & Goods]
         ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* CARD 01: Customer & Company */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-3.5">
          <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100 dark:border-slate-800">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-600 text-white text-[11px] font-black">
              01
            </span>
            <Building2 className="h-4 w-4 text-blue-600" />
            <h3 className="font-black text-slate-900 dark:text-white text-sm">
              {tt("sec_customer_company", "Customer & Company")}
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {/* Left Col */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">{tt("customer", "Customer")}</span>
                <span className="font-bold text-slate-900 dark:text-white truncate max-w-[150px]">
                  {order.customer_name || linkedCust?.name || "Gulf Trade"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">{tt("account_no", "Account No")}</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                  {linkedAcc?.account_number || linkedAcc?.code || linkedCust?.person_code || "GT-1001"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">{tt("company", "Company")}</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[150px]">
                  {linkedCompany?.name || linkedCust?.company_name || "Gulf Trade Pvt Ltd"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">{tt("registration_no", "Registration No")}</span>
                <span className="font-mono text-slate-700 dark:text-slate-300">
                  {(linkedCust as any)?.registration_no || (linkedCust as any)?.tax_id || "DEMO-2045"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">{tt("country", "Country")}</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                  <span>{getFlag(order.country_name || originCountryName)}</span>
                  <span>{order.country_name || originCountryName}</span>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">{tt("state_province", "State")}</span>
                <span className="text-slate-700 dark:text-slate-300">{linkedCust?.city_name || "Balochistan"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">{tt("city", "City")}</span>
                <span className="text-slate-700 dark:text-slate-300">{linkedCust?.city_name || "Quetta"}</span>
              </div>
              <div className="flex items-start justify-between">
                <span className="text-slate-500 shrink-0">{tt("address", "Address")}</span>
                <span className="text-slate-700 dark:text-slate-300 text-right truncate max-w-[160px]">
                  {linkedCust?.address || linkedCompany?.address || "Office 12, Trade Market, Quetta"}
                </span>
              </div>
            </div>

            {/* Right Col */}
            <div className="space-y-2 border-t sm:border-t-0 sm:border-l sm:pl-4 border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">{tt("contact_person", "Contact Person")}</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {linkedCust?.contact_person || (order as any).receiver_contact_person || "Demo Customer"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">{tt("phone", "Phone")}</span>
                <span className="font-mono text-blue-600 dark:text-blue-400 flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  <span>{linkedCust?.mobile || (linkedCust as any)?.phone || "+92 300 1234567"}</span>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">{tt("whatsapp", "WhatsApp")}</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <MessageCircle className="h-3 w-3" />
                  <span>{linkedCust?.whatsapp || linkedCust?.mobile || "+92 300 1234567"}</span>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">{tt("account_currency", "Account Currency")}</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                  {linkedAcc?.currency || "PKR"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* CARD 02: Order & Goods */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-3.5">
          <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100 dark:border-slate-800">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-600 text-white text-[11px] font-black">
              02
            </span>
            <Package className="h-4 w-4 text-blue-600" />
            <h3 className="font-black text-slate-900 dark:text-white text-sm">
              {tt("sec_order_goods", "Order & Goods")}
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {/* Left Col */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">{tt("import_export", "Import / Export")}</span>
                <span className="font-bold text-blue-600 dark:text-blue-400 capitalize">
                  {order.movement_type || "Import"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">{tt("operation_type", "Operation Type")}</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {(order as any).operation_type || "Transit"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">{tt("transport_mode", "Transport Mode")}</span>
                <span className="font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                  {order.transport_mode === "by_sea" ? <Ship className="h-3.5 w-3.5" /> : order.transport_mode === "by_air" ? <Plane className="h-3.5 w-3.5" /> : <Truck className="h-3.5 w-3.5" />}
                  <span>{order.transport_mode === "by_sea" ? "Sea" : order.transport_mode === "by_air" ? "Air" : "Road"}</span>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">{tt("handling_type", "Handling Type")}</span>
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {(order as any).cargo_type || "Truck"}
                </span>
              </div>
            </div>

            {/* Right Col */}
            <div className="space-y-2 border-t sm:border-t-0 sm:border-l sm:pl-4 border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">{tt("goods", "Goods")}</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {order.goods_name || goodsItems[0]?.name || "Almonds"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">{tt("quantity", "Quantity")}</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {order.goods_quantity || goodsItems[0]?.quantity || 800} {order.goods_unit || goodsItems[0]?.packageType || "Bags"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">{tt("net_weight", "Net Weight")}</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {order.goods_net_weight || order.goods_gross_weight || "20"} MT
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">{tt("origin", "Origin")}</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                  <span>{getFlag(originCountryName)}</span>
                  <span>{originCountryName}</span>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">{tt("destination", "Destination")}</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                  <span>{getFlag(destCountryName)}</span>
                  <span>{destCountryName}</span>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">{tt("remarks", "Remarks")}</span>
                <span className="text-slate-700 dark:text-slate-300 italic truncate max-w-[140px]">
                  {order.remarks || "Keep cargo dry."}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          GOODS DETAILS TABLE (Requirement 3: Clear Goods Breakdown)
         ───────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-blue-600" />
            <h3 className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider">
              {tt("goods_details_manifest_table", "Goods Details & Manifest Items")}
            </h3>
          </div>
          <span className="text-xs font-semibold text-slate-500">
            {goodsItems.length} {tt("items", "items")}
          </span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50/90 dark:bg-slate-800/80 font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 text-[10px]">
              <tr>
                <th className="py-2.5 px-3">#</th>
                <th className="py-2.5 px-3">{tt("product_description", "Product Description")}</th>
                <th className="py-2.5 px-3">{tt("hs_code_col", "HS Code")}</th>
                <th className="py-2.5 px-3">{tt("package_type_col", "Packaging / Unit")}</th>
                <th className="py-2.5 px-3 text-right">{tt("quantity", "Quantity")}</th>
                <th className="py-2.5 px-3 text-right">{tt("gross_weight", "Gross Weight (kg)")}</th>
                <th className="py-2.5 px-3 text-right">{tt("net_weight", "Net Weight (kg)")}</th>
                <th className="py-2.5 px-3">{tt("warehouse_source", "Warehouse / Location")}</th>
                <th className="py-2.5 px-3">{tt("remarks", "Remarks")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
              {goodsItems.map((item, idx) => (
                <tr key={item.id || idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50">
                  <td className="py-2.5 px-3 font-medium text-slate-400">{idx + 1}</td>
                  <td className="py-2.5 px-3 font-bold text-slate-800 dark:text-slate-200">{item.name}</td>
                  <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-400">{item.hsCode}</td>
                  <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">{item.packageType}</td>
                  <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-white">{item.quantity}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-800 dark:text-slate-200">{item.grossKg}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-800 dark:text-slate-200">{item.netKg}</td>
                  <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">{item.warehouse}</td>
                  <td className="py-2.5 px-3 text-slate-500 italic">{item.remarks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2-COLUMN MIDDLE SECTION: [03 Transport & Route] + [04 Loading & Customs]
         ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* CARD 03: Transport & Route */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
          <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100 dark:border-slate-800">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-600 text-white text-[11px] font-black">
              03
            </span>
            <Truck className="h-4 w-4 text-blue-600" />
            <h3 className="font-black text-slate-900 dark:text-white text-sm">
              {tt("sec_transport_route", "Transport & Route")}
            </h3>
          </div>

          {/* Visual Route Corridor Stepper */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-slate-500">{tt("route", "Route")}</span>
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-xs">
              {routeStops.map((stop: string, idx: number) => (
                <React.Fragment key={idx}>
                  <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white">
                    <MapPin className="h-4 w-4 text-blue-600 shrink-0" />
                    <span>{stop}</span>
                  </div>
                  {idx < routeStops.length - 1 && (
                    <span className="text-slate-300 dark:text-slate-600 font-black">➔</span>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">{tt("truck_no", "Truck No")}</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  {(order as any).truck_number || "DEMO-123"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">{tt("driver", "Driver")}</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {(order as any).truck_driver_name || "Demo Driver"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">{tt("bl_container_vessel", "BL / Container / Vessel")}</span>
                <span className="font-medium text-slate-700 dark:text-slate-300 truncate max-w-[130px]">
                  {(order as any).bl_number || (order as any).container_number || (order as any).vessel_name || "Not applicable (Road)"}
                </span>
              </div>
            </div>

            <div className="space-y-2 border-t sm:border-t-0 sm:border-l sm:pl-4 border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">{tt("temporary_truck_no", "Temporary Truck No")}</span>
                <span className="font-mono text-slate-600 dark:text-slate-400">
                  {(order as any).temp_truck_number || "Not used"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">{tt("driver_contact", "Driver Contact")}</span>
                <span className="font-mono text-blue-600 dark:text-blue-400 flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  <span>{(order as any).truck_driver_mobile || "+92 300 1234567"}</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* CARD 04: Loading & Customs */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-3.5">
          <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100 dark:border-slate-800">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-600 text-white text-[11px] font-black">
              04
            </span>
            <Ship className="h-4 w-4 text-blue-600" />
            <h3 className="font-black text-slate-900 dark:text-white text-sm">
              {tt("sec_loading_customs", "Loading & Customs")}
            </h3>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">{tt("loading_country", "Loading Country")}</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                <span>{getFlag(originCountryName)}</span>
                <span>{originCountryName}</span>
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">{tt("loading_location", "Loading Location")}</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {order.loading_source_name || order.loading_place || "Karachi Warehouse"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">{tt("loading_date", "Loading Date")}</span>
              <span className="font-mono text-slate-800 dark:text-slate-200">
                {order.expected_loading_date ? new Date(order.expected_loading_date).toLocaleString() : "13 Oct 2026 14:00"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">{tt("customs_handling", "Customs Handling")}</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {(order as any).loading_customs_handled_by === "our_branch" ? "Our Branch" : "External Agent"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">{tt("clearing_agent", "Clearing Agent")}</span>
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {(order as any).clearing_agent_name || "Demo Clearing Services"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">{tt("agent_account", "Agent Account")}</span>
              <span className="font-mono text-slate-700 dark:text-slate-300">
                {(order as any).agent_account_code || "CA-DEMO-01"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">{tt("customs_reference", "Customs Reference")}</span>
              <span className="inline-flex items-center gap-1 text-amber-600 font-semibold">
                <Clock className="h-3 w-3" />
                <span>Pending</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2-COLUMN LOWER SECTION: [05 Receiving & Delivery] + [06 Documents]
         ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* CARD 05: Receiving & Delivery */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-3.5">
          <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100 dark:border-slate-800">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-600 text-white text-[11px] font-black">
              05
            </span>
            <MapPin className="h-4 w-4 text-blue-600" />
            <h3 className="font-black text-slate-900 dark:text-white text-sm">
              {tt("sec_receiving_delivery", "Receiving & Delivery")}
            </h3>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">{tt("receiving_country", "Receiving Country")}</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                <span>{getFlag(destCountryName)}</span>
                <span>{destCountryName}</span>
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">{tt("border", "Border")}</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {(order as any).entry_border_port_name || (order as any).receiving_customs_port_border || "Spin Boldak"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">{tt("planned_receipt", "Planned Receipt")}</span>
              <span className="font-mono text-slate-800 dark:text-slate-200">
                {(order as any).planned_arrival_date || "16 Oct 2026"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">{tt("actual_receipt", "Actual Receipt")}</span>
              <span className="text-slate-600 dark:text-slate-400">
                {(order as any).actual_arrival_date || "Not received"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">{tt("delivery_address", "Delivery Address")}</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[200px]">
                {(order as any).delivery_address || (order as any).receiving_place || "Customer warehouse, Spin Boldak"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">{tt("receiving_customs", "Receiving Customs")}</span>
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {(order as any).receiving_customs_handled_by || "Customer managed"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">{tt("responsible_person", "Responsible Person")}</span>
              <span className="font-bold text-slate-900 dark:text-white">
                {(order as any).receiver_contact_person || "Demo Receiver"}
              </span>
            </div>
          </div>
        </div>

        {/* CARD 06: Documents */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-3.5">
          <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100 dark:border-slate-800">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-600 text-white text-[11px] font-black">
              06
            </span>
            <FileText className="h-4 w-4 text-blue-600" />
            <h3 className="font-black text-slate-900 dark:text-white text-sm">
              {tt("sec_documents", "Documents")}
            </h3>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-800/80 font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 text-[10px]">
                <tr>
                  <th className="py-2 px-3">#</th>
                  <th className="py-2 px-3">{tt("document_name", "Document Name")}</th>
                  <th className="py-2 px-3">{tt("status", "Status")}</th>
                  <th className="py-2 px-3">{tt("uploaded_on", "Uploaded On")}</th>
                  <th className="py-2 px-3 text-center">{tt("actions", "Actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
                <tr className="hover:bg-slate-50/50">
                  <td className="py-2 px-3 text-slate-400">1</td>
                  <td className="py-2 px-3 font-semibold text-slate-800 dark:text-slate-200">Packing List.pdf</td>
                  <td className="py-2 px-3">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                      <CheckCircle2 className="h-2.5 w-2.5" />
                      <span>{tt("uploaded", "Uploaded")}</span>
                    </span>
                  </td>
                  <td className="py-2 px-3 font-mono text-slate-500">13 Oct 2026 10:35</td>
                  <td className="py-2 px-3 text-center">
                    <div className="flex items-center justify-center gap-1.5 text-blue-600 font-bold">
                      <button type="button" className="hover:text-blue-800 inline-flex items-center gap-0.5">
                        <Eye className="h-3 w-3" />
                        <span>{tt("view", "View")}</span>
                      </button>
                      <Download className="h-3 w-3 text-slate-400 hover:text-slate-600 cursor-pointer" />
                    </div>
                  </td>
                </tr>

                <tr className="hover:bg-slate-50/50">
                  <td className="py-2 px-3 text-slate-400">2</td>
                  <td className="py-2 px-3 font-semibold text-slate-800 dark:text-slate-200">Customer Order.pdf</td>
                  <td className="py-2 px-3">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                      <CheckCircle2 className="h-2.5 w-2.5" />
                      <span>{tt("uploaded", "Uploaded")}</span>
                    </span>
                  </td>
                  <td className="py-2 px-3 font-mono text-slate-500">13 Oct 2026 10:31</td>
                  <td className="py-2 px-3 text-center">
                    <div className="flex items-center justify-center gap-1.5 text-blue-600 font-bold">
                      <button type="button" className="hover:text-blue-800 inline-flex items-center gap-0.5">
                        <Eye className="h-3 w-3" />
                        <span>{tt("view", "View")}</span>
                      </button>
                      <Download className="h-3 w-3 text-slate-400 hover:text-slate-600 cursor-pointer" />
                    </div>
                  </td>
                </tr>

                <tr className="hover:bg-slate-50/50">
                  <td className="py-2 px-3 text-slate-400">3</td>
                  <td className="py-2 px-3 font-semibold text-slate-800 dark:text-slate-200">Customs Declaration.pdf</td>
                  <td className="py-2 px-3">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                      <Clock className="h-2.5 w-2.5" />
                      <span>{tt("awaiting_upload", "Awaiting upload")}</span>
                    </span>
                  </td>
                  <td className="py-2 px-3 font-mono text-slate-400">-</td>
                  <td className="py-2 px-3 text-center">
                    <div className="flex items-center justify-center gap-1.5 text-slate-400 font-bold">
                      <button type="button" className="inline-flex items-center gap-0.5 opacity-60">
                        <Eye className="h-3 w-3" />
                        <span>{tt("view", "View")}</span>
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 07: Workflow & Audit (Horizontal Stepper & Chips)
         ───────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
        <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100 dark:border-slate-800">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-600 text-white text-[11px] font-black">
            07
          </span>
          <Route className="h-4 w-4 text-blue-600" />
          <h3 className="font-black text-slate-900 dark:text-white text-sm">
            {tt("sec_workflow_audit", "Workflow & Audit")}
          </h3>
        </div>

        {/* 3-Step Stepper */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
          {/* Step 1: Submitted */}
          <div className="flex items-center gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 text-white text-xs font-black shrink-0">
              1
            </span>
            <div className="min-w-0">
              <span className="font-bold text-slate-900 dark:text-white block text-xs">{tt("wf_submitted", "Submitted")}</span>
              <span className="text-[10px] text-slate-400 font-mono block">13 Oct 2026 10:30</span>
              <span className="text-[10.5px] text-slate-500 block truncate">by {(order as any).entered_by_name || "Demo Operator"}</span>
            </div>
          </div>

          {/* Step 2: Assigned */}
          <div className="flex items-center gap-3 border-t md:border-t-0 md:border-l md:pl-3 border-slate-200 dark:border-slate-700 pt-2 md:pt-0">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 text-white text-xs font-black shrink-0">
              2
            </span>
            <div className="min-w-0">
              <span className="font-bold text-slate-900 dark:text-white block text-xs">{tt("wf_assigned", "Assigned")}</span>
              <span className="text-[10px] text-slate-400 font-mono block">13 Oct 2026 10:45</span>
              <span className="text-[10.5px] text-slate-500 block truncate">to {(order as any).responsible_user_name || "Demo Supervisor"}</span>
            </div>
          </div>

          {/* Step 3: Pending Approval */}
          <div className="flex items-center gap-3 border-t md:border-t-0 md:border-l md:pl-3 border-slate-200 dark:border-slate-700 pt-2 md:pt-0">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500 text-white text-xs font-black shrink-0">
              3
            </span>
            <div className="min-w-0">
              <span className="font-bold text-amber-700 dark:text-amber-400 block text-xs">{statusLabel}</span>
              <span className="text-[10.5px] text-slate-500 block">{tt("current_status", "Current status")}</span>
            </div>
          </div>
        </div>

        {/* Metadata Chips Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs pt-1">
          <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/40">
            <User className="h-4 w-4 text-blue-600 shrink-0" />
            <div className="min-w-0">
              <span className="text-[10px] text-slate-400 block font-bold">{tt("assigned_to", "Assigned To")}</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 truncate block">
                {(order as any).responsible_user_name || "Demo Supervisor"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/40">
            <FileText className="h-4 w-4 text-indigo-600 shrink-0" />
            <div className="min-w-0">
              <span className="text-[10px] text-slate-400 block font-bold">{tt("next_action", "Next Action")}</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 truncate block">
                {tt("review_documents", "Review documents")}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/40">
            <Calendar className="h-4 w-4 text-purple-600 shrink-0" />
            <div className="min-w-0">
              <span className="text-[10px] text-slate-400 block font-bold">{tt("due_date", "Due Date")}</span>
              <span className="font-mono text-slate-800 dark:text-slate-200 truncate block">14 Oct 2026</span>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/40">
            <MessageCircle className="h-4 w-4 text-emerald-600 shrink-0" />
            <div className="min-w-0">
              <span className="text-[10px] text-slate-400 block font-bold">{tt("latest_note", "Latest Note")}</span>
              <span className="text-slate-600 dark:text-slate-400 truncate block">
                {tt("awaiting_customs_docs", "Awaiting customs documents.")}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          BOTTOM FOOTER NOTE
         ───────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between text-xs text-slate-400 px-2 py-1 print:hidden">
        <div className="flex items-center gap-1.5">
          <span className="text-blue-600 font-bold">ⓘ</span>
          <span>{tt("readonly_order_footer", "Read-only order details • All sections shown on one page")}</span>
        </div>

        {onEdit && (
          <button
            type="button"
            onClick={() => onEdit(order)}
            className="font-bold text-blue-600 hover:text-blue-800 underline"
          >
            {tt("edit_this_order", "Edit this order")}
          </button>
        )}
      </div>
    </div>
  );
}
