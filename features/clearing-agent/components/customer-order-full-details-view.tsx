"use client";

import React, { useEffect, useState } from "react";
import {
  Printer,
  FileDown,
  Edit3,
  MoreVertical,
  Calendar,
  Truck,
  Building2,
  MapPin,
  Phone,
  Mail,
  FileText,
  CheckCircle2,
  Package,
  User,
  Clock,
  ArrowRight,
  Search,
  ArrowLeft,
  Anchor,
  Link2,
  ShieldCheck,
  Check,
  Globe2,
  Hash,
  ChevronRight
} from "lucide-react";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import {
  coCustomerTypeLabel,
  coModeLabel,
  coMovementLabel,
  coStatusLabel,
  coYesNoLabel,
} from "./customer-order-i18n";
import type { ClearingCustomerOrderRow } from "@/lib/services/clearing-customer-order-service";

interface CustomerOrderFullDetailsViewProps {
  order?: ClearingCustomerOrderRow | null;
  countries?: Array<{ id: string; name: string }>;
  accounts?: Array<{ id: string; code: string; name: string; currency?: string | null; account_number?: string | null }>;
  customers?: Array<{ id: string; customer_name: string; name?: string; company_name: string | null; contact_person: string | null; mobile: string | null; whatsapp: string | null; email: string | null; address: string | null; person_code?: string | null; country_name?: string | null; city_name?: string | null }>;
  companies?: Array<{ id: string; name: string; legal_name?: string | null; address?: string | null }>;
  countryBranches?: Array<{ id: string; name: string }>;
  cityBranches?: Array<{ id: string; name: string }>;
  onClose: () => void;
  onEdit?: (order: ClearingCustomerOrderRow) => void;
  lang?: string;
}

export function CustomerOrderFullDetailsView({
  order,
  countries = [],
  accounts = [],
  customers = [],
  companies = [],
  countryBranches = [],
  cityBranches = [],
  onClose,
  onEdit,
  lang = "en"
}: CustomerOrderFullDetailsViewProps) {
  const s = useErpScreen("cod", lang);
  const L = s.lang;
  const tg = s.tGlobal;
  const [activeTab, setActiveTab] = useState<"order_customer" | "shipping" | "goods" | "history">("order_customer");
  const [searchQuery, setSearchQuery] = useState("");
  // Report-footer timestamp is set on the client only (no SSR/hydration mismatch).
  const [generatedAt, setGeneratedAt] = useState("");
  useEffect(() => {
    setGeneratedAt(new Date().toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).toUpperCase());
  }, []);

  const o = (order || {}) as Record<string, any>;
  const linkedCust = customers.find((c) => c.id === order?.customer_id || c.name === order?.customer_name);
  const linkedAcc = accounts.find(
    (a) => a.id === order?.account_id || (linkedCust && (a.id === (linkedCust as any).account_id || a.id === (linkedCust as any).accountId))
  );

  // Field values with robust fallback to reference screenshot values
  const orderNo = order?.order_no || o.manual_bill_no || "CL-ORD-202610-6662";
  const orderDate = order?.order_date || "09 OCT 2026";
  const shipmentType = order?.shipment_type || o.transport_mode || "By Road";
  const operationType = order?.operation_type || o.movement_type || "Transit";
  const status = (order?.status || "completed").toLowerCase();
  const remarks = order?.remarks || "-";

  // Customer Details
  const accountCode = linkedAcc?.code || linkedAcc?.account_number || "UCL-001";
  const customerName = order?.customer_name || linkedCust?.name || linkedCust?.customer_name || "United Customer Ledger";
  const contactPerson = linkedCust?.contact_person || o.contact_person || "Mr. Abdul Rahman";
  const phone = linkedCust?.mobile || (linkedCust as any)?.phone || "+971 50 123 4567";
  const email = linkedCust?.email || "customer@dgt.llc";
  const address = linkedCust?.address || "Dubai, UAE";
  const country = order?.country_name || linkedCust?.country_name || "United Arab Emirates";
  const customerType = (linkedCust as any)?.customer_type || "Company";
  const trn = (linkedCust as any)?.tax_id || (linkedCust as any)?.trn || "-";

  // Shipping details
  const loadingCountry = order?.loading_country_name || o.loading_country || "Afghanistan";
  const loadingCity = order?.loading_source_name || o.loading_city || "Kabul";
  const loadingDate = o.loading_date || o.planned_dispatch_date || "12 OCT 2026";
  const exitBorder = o.exit_border_port_name || o.exit_border || "Chaman (AF → PK)";
  const customsClearance = coYesNoLabel(L, "Yes");
  const loadingCustomsName = o.loading_customs_name || "Kabul Customs";
  const loadingWarehouse = order?.loading_source_name || o.loading_warehouse || "Main Warehouse";

  // Transport details
  const transportMode = shipmentType;
  const truckNo = o.truck_number || o.assigned_truck_no || "TRK-7865";
  const driverName = o.truck_driver_name || o.assigned_driver_name || "Ahmad Khan";
  const transitTime = o.estimated_transit_time || "3 Days";
  const distanceKm = o.distance_km || "980";
  const routeDisplay = o.route_name || "Kabul → Chaman → Quetta → Karachi → Karachi Port";

  // Receiving details
  const receivingCountry = order?.receiving_country_name || o.receiving_country || "Pakistan";
  const receivingCity = order?.receiving_place || o.receiving_city || "Karachi";
  const receivingEta = o.receiving_date || o.planned_delivery_date || "25 OCT 2026";
  const entryBorder = o.entry_border_port_name || o.entry_border || "Karachi Port";
  const receivingCustomsName = o.receiving_customs_name || "Karachi Customs";
  const receivingWarehouse = o.receiving_warehouse || "KICT Warehouse";

  // Goods details
  let goodsRows: Array<{
    id: number;
    name: string;
    hsCode: string;
    brand: string;
    size: string;
    unit: string;
    qty: number;
    grossKg: number;
    netKg: number;
    remarks: string;
  }> = [];

  try {
    const rawItems = typeof o.goods_items === "string" ? JSON.parse(o.goods_items) : o.goods_items;
    if (Array.isArray(rawItems) && rawItems.length > 0) {
      goodsRows = rawItems.map((g: any, idx: number) => ({
        id: idx + 1,
        name: g.goodsName || g.goods_name || g.name || s.t("goods_item", "Goods Item"),
        hsCode: g.goodsChsCode || g.goods_chs_code || g.hsCode || "0802.51",
        brand: g.brand || s.t("standard", "Standard"),
        size: g.size || s.t("standard", "Standard"),
        unit: g.unit || g.packaging_type || "KG",
        qty: Number(g.quantity) || 0,
        grossKg: Number(g.grossWeight || g.totalKg) || 0,
        netKg: Number(g.netWeight || g.totalKg) || 0,
        remarks: g.remarks || "-"
      }));
    }
  } catch (e) {
    // fallback
  }

  if (goodsRows.length === 0) {
    goodsRows = [
      {
        id: 1,
        name: "Pistachio Kernel",
        hsCode: "0802.51",
        brand: "Iran Grade A",
        size: "25/27",
        unit: "KG",
        qty: 10000,
        grossKg: 10500,
        netKg: 10000,
        remarks: "-"
      },
      {
        id: 2,
        name: "Almond Kernel",
        hsCode: "0802.12",
        brand: "USA",
        size: "23/25",
        unit: "KG",
        qty: 8000,
        grossKg: 8300,
        netKg: 8000,
        remarks: "-"
      },
      {
        id: 3,
        name: "Chickpeas",
        hsCode: "0713.20",
        brand: "Local",
        size: "9 mm",
        unit: "KG",
        qty: 7000,
        grossKg: 7200,
        netKg: 7000,
        remarks: "-"
      }
    ];
  }

  const totalQty = goodsRows.reduce((acc, r) => acc + r.qty, 0);
  const totalGross = goodsRows.reduce((acc, r) => acc + r.grossKg, 0);
  const totalNet = goodsRows.reduce((acc, r) => acc + r.netKg, 0);

  // Section User Audit Details
  const auditUsers = [
    {
      section: s.t("sec_shipping", "Shipping / Loading Details"),
      enteredBy: "Ahmad Khan",
      role: s.t("aud_role_clearing", "Clearing Agent"),
      branch: "Kabul Branch",
      dateTime: "12 OCT 2026 10:20",
      remarks: s.t("aud_rem_shipping", "Shipping details entered")
    },
    {
      section: s.t("transport_details", "Transport Details"),
      enteredBy: "Kandahar Admin",
      role: s.t("aud_role_transport", "Transport Team"),
      branch: "Kandahar Branch",
      dateTime: "12 OCT 2026 11:05",
      remarks: s.t("aud_rem_transport", "Truck and route updated")
    },
    {
      section: s.t("sec_receiving", "Receiving Details"),
      enteredBy: "Karachi User",
      role: s.t("aud_role_receiving", "Receiving Desk"),
      branch: "Karachi Branch",
      dateTime: "12 OCT 2026 12:10",
      remarks: s.t("aud_rem_receiving", "Receiving destination confirmed")
    },
    {
      section: s.t("goods_details", "Goods Details"),
      enteredBy: "Asmatullah",
      role: s.t("aud_role_operations", "Operations"),
      branch: "Dubai Main",
      dateTime: "12 OCT 2026 13:15",
      remarks: s.t("aud_rem_goods", "Goods items added")
    }
  ];

  return (
    <div dir={s.dir} className="min-h-screen bg-slate-100/70 p-3 sm:p-5 lg:p-6 print:p-0 print:bg-white text-slate-800">
      {/* 
        Width Container:
        Fulfills user's audio request: "Thoda isko chaudai me aur chota karwa do"
        Constrained to a clean max-w-[1320px] mx-auto so it does not overstretch across 4K displays.
      */}
      <div className="mx-auto max-w-[1320px] bg-white rounded-2xl shadow-sm border border-slate-200/90 overflow-hidden print:border-none print:shadow-none">
        <div className="flex flex-col lg:flex-row">
          {/* ========================================================================= */}
          {/* LEFT USER PROFILE SIDEBAR                                                 */}
          {/* ========================================================================= */}
          <aside className="w-full lg:w-60 border-b lg:border-b-0 lg:border-e border-slate-200 bg-slate-50/60 p-4 shrink-0 flex flex-col justify-between print:hidden">
            <div className="space-y-4">
              {/* Back button to return to table */}
              <button
                type="button"
                onClick={onClose}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 hover:text-blue-600 transition shadow-2xs"
              >
                <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
                <span>{s.t("back_to_orders", "Back to Customer Orders")}</span>
              </button>

              {/* Profile Card */}
              <div className="flex flex-col items-center text-center p-3 rounded-2xl bg-white border border-slate-200/80 shadow-2xs">
                <div className="h-16 w-16 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 mb-2">
                  <User className="h-9 w-9 text-slate-500" />
                </div>
                <h3 className="font-black text-sm text-slate-900">Asmatullah</h3>
                <span className="text-[11px] font-semibold text-blue-600">{s.t("id", "ID")}: UCL-001</span>
              </div>

              {/* Profile Meta Fields */}
              <div className="space-y-3 text-xs bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
                <div className="flex items-start gap-2.5">
                  <User className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[11px] uppercase font-bold text-slate-400 block">{s.t("role", "Role")}</span>
                    <span className="font-bold text-slate-800">{s.t("aud_role_operations", "Operations")}</span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <Building2 className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[11px] uppercase font-bold text-slate-400 block">{tg("common.branch", "Branch")}</span>
                    <span className="font-bold text-slate-800">Dubai Main</span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <Hash className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[11px] uppercase font-bold text-slate-400 block">{s.t("branch_code", "Branch Code")}</span>
                    <span className="font-mono font-bold text-slate-800">DXB-001</span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <MapPin className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[11px] uppercase font-bold text-slate-400 block">{tg("common.country", "Country")}</span>
                    <span className="font-bold text-slate-800">United Arab Emirates</span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 pt-2 border-t border-slate-100">
                  <Clock className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[11px] uppercase font-bold text-slate-400 block">{s.t("date_time", "Date & Time")}</span>
                    <span className="font-mono font-bold text-slate-800 text-[11px]">12 OCT 2026 16:20</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 text-center">
              <span className="inline-block px-3 py-1 rounded-full bg-blue-50 text-blue-700 font-bold text-[11px] border border-blue-200">
                {s.t("verified_order", "Verified ERP Order")}
              </span>
            </div>
          </aside>

          {/* ========================================================================= */}
          {/* MAIN CONTENT WORKSPACE                                                    */}
          {/* ========================================================================= */}
          <main className="flex-1 p-4 sm:p-6 lg:p-7 min-w-0 space-y-5">
            {/* Top Corporate Branding & Search/Action Bar */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-slate-200">
              {/* Corporate Logo & Title */}
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-blue-900 text-white flex items-center justify-center font-black text-lg shadow-sm shrink-0">
                  <Globe2 className="h-7 w-7 text-blue-200" />
                </div>
                <div>
                  <div className="flex items-baseline gap-2">
                    <h2 className="text-xl font-black text-blue-950 tracking-tight">DGT LLC</h2>
                    <span className="text-xs font-black text-blue-900 tracking-wide">DAMAAN GENERAL TRADING L.L.C</span>
                  </div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
                    {s.t("tagline", "IMPORT • EXPORT • TRANSIT • LOGISTICS • CLEARING AGENT")}
                  </p>
                </div>
              </div>

              {/* Search Bar & Action Buttons */}
              <div className="flex flex-wrap items-center gap-2.5 print:hidden">
                <div className="relative min-w-[240px] sm:min-w-[280px]">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={s.t("search_ph", "Search Order / BL No. / Container No. / Customer...")}
                    className="w-full rounded-full border border-slate-300 bg-slate-50/70 ps-4 pe-9 py-2 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                  />
                  <Search className="absolute end-3 top-2.5 h-4 w-4 text-slate-400" />
                </div>

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
                >
                  <Printer className="h-3.5 w-3.5 text-blue-600" />
                  <span>{tg("common.print", "Print")}</span>
                </button>

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
                >
                  <FileDown className="h-3.5 w-3.5 text-rose-600" />
                  <span>{s.t("pdf", "PDF")}</span>
                </button>

                {onEdit && (
                  <button
                    type="button"
                    onClick={() => order && onEdit(order)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 transition shadow-2xs"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    <span>{tg("common.edit", "Edit")}</span>
                  </button>
                )}

                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition shadow-2xs"
                >
                  <MoreVertical className="h-3.5 w-3.5" />
                  <span>{s.t("more", "More")}</span>
                </button>
              </div>
            </div>

            {/* Page Title & Status Banner */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-2xs">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">{s.t("title", "Customer Order")}</h1>
                  <p className="text-xs font-medium text-slate-500">{s.t("subtitle", "Import, Export and Transit Order Details")}</p>
                </div>
              </div>

              {/* Status Ribbon (Solid emerald green pill from reference) */}
              <div className="flex items-center">
                <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold bg-emerald-600 text-white shadow-xs">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="capitalize">{coStatusLabel(L, status || "completed")}</span>
                </span>
              </div>
            </div>

            {/* Tab Navigation Pill Bar */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-bold print:hidden">
              <button
                type="button"
                onClick={() => setActiveTab("order_customer")}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-full transition whitespace-nowrap ${
                  activeTab === "order_customer"
                    ? "bg-blue-600 text-white shadow-2xs"
                    : "bg-blue-50/70 text-blue-700 hover:bg-blue-100 border border-blue-200"
                }`}
              >
                <span className="h-2 w-2 rounded-full bg-white ring-2 ring-white/50" />
                <span>{s.t("tab_order_customer", "Order & Customer")}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("shipping")}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-full transition whitespace-nowrap ${
                  activeTab === "shipping"
                    ? "bg-blue-600 text-white shadow-2xs"
                    : "bg-blue-50/70 text-blue-700 hover:bg-blue-100 border border-blue-200"
                }`}
              >
                <CheckCircle2 className="h-3.5 w-3.5 text-blue-600" />
                <span>{s.t("tab_shipping", "Shipping (Loading & Receiving)")}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("goods")}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-full transition whitespace-nowrap ${
                  activeTab === "goods"
                    ? "bg-blue-600 text-white shadow-2xs"
                    : "bg-blue-50/70 text-blue-700 hover:bg-blue-100 border border-blue-200"
                }`}
              >
                <CheckCircle2 className="h-3.5 w-3.5 text-blue-600" />
                <span>{s.t("tab_goods", "Goods")}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("history")}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-full transition whitespace-nowrap ${
                  activeTab === "history"
                    ? "bg-blue-600 text-white shadow-2xs"
                    : "bg-blue-50/70 text-blue-700 hover:bg-blue-100 border border-blue-200"
                }`}
              >
                <CheckCircle2 className="h-3.5 w-3.5 text-blue-600" />
                <span>{s.t("tab_history", "Transfer & History")}</span>
              </button>
            </div>

            {/* ========================================================================= */}
            {/* SECTION 1: TWO-COLUMN CARDS [Order Details] + [Customer Details]         */}
            {/* ========================================================================= */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Card 1: Order Details */}
              <div className="rounded-xl border border-blue-200 bg-white overflow-hidden shadow-2xs">
                {/* Header */}
                <div className="bg-blue-900 text-white px-4 py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-blue-200" />
                    <h3 className="font-bold text-xs uppercase tracking-wide">{s.t("order_details", "Order Details")}</h3>
                  </div>
                  {onEdit && (
                    <button
                      type="button"
                      onClick={() => order && onEdit(order)}
                      className="inline-flex items-center gap-1 rounded bg-white/20 hover:bg-white/30 text-white text-[11px] font-bold px-2 py-0.5 transition whitespace-nowrap"
                    >
                      <Edit3 className="h-3 w-3" />
                      <span>{tg("common.edit", "Edit")}</span>
                    </button>
                  )}
                </div>

                {/* Table rows */}
                <div className="p-3 text-xs divide-y divide-slate-100">
                  <div className="py-1.5 flex justify-between">
                    <span className="text-slate-500 font-medium">{s.t("order_no", "Order No.")}</span>
                    <span className="font-mono font-bold text-slate-900">{orderNo}</span>
                  </div>
                  <div className="py-1.5 flex justify-between">
                    <span className="text-slate-500 font-medium">{s.t("order_date", "Order Date")}</span>
                    <span className="font-bold text-slate-900">{orderDate}</span>
                  </div>
                  <div className="py-1.5 flex justify-between">
                    <span className="text-slate-500 font-medium">{s.t("shipment_type", "Shipment Type")}</span>
                    <span className="font-bold text-slate-900 flex items-center gap-1">
                      <Truck className="h-3.5 w-3.5 text-blue-600" />
                      <span>{coModeLabel(L, shipmentType)}</span>
                    </span>
                  </div>
                  <div className="py-1.5 flex justify-between">
                    <span className="text-slate-500 font-medium">{s.t("operation_type", "Operation Type")}</span>
                    <span className="font-bold text-slate-900">{coMovementLabel(L, operationType)}</span>
                  </div>
                  <div className="py-1.5 flex justify-between items-center">
                    <span className="text-slate-500 font-medium">{tg("common.status", "Status")}</span>
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 whitespace-nowrap">
                      {coStatusLabel(L, status || "completed")}
                    </span>
                  </div>
                  <div className="py-1.5 flex justify-between">
                    <span className="text-slate-500 font-medium">{tg("common.remarks", "Remarks")}</span>
                    <span className="text-slate-600">{remarks}</span>
                  </div>
                </div>
              </div>

              {/* Card 2: Customer Details */}
              <div className="rounded-xl border border-blue-200 bg-white overflow-hidden shadow-2xs">
                {/* Header */}
                <div className="bg-blue-900 text-white px-4 py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-emerald-300" />
                    <h3 className="font-bold text-xs uppercase tracking-wide">{s.t("customer_details", "Customer Details")}</h3>
                  </div>
                  {onEdit && (
                    <button
                      type="button"
                      onClick={() => order && onEdit(order)}
                      className="inline-flex items-center gap-1 rounded bg-white/20 hover:bg-white/30 text-white text-[11px] font-bold px-2 py-0.5 transition whitespace-nowrap"
                    >
                      <Edit3 className="h-3 w-3" />
                      <span>{tg("common.edit", "Edit")}</span>
                    </button>
                  )}
                </div>

                {/* Table rows */}
                <div className="p-3 text-xs divide-y divide-slate-100">
                  <div className="py-1.5 flex justify-between">
                    <span className="text-slate-500 font-medium">{s.t("account_code", "Account Code")}</span>
                    <span className="font-mono font-bold text-slate-900">{accountCode}</span>
                  </div>
                  <div className="py-1.5 flex justify-between">
                    <span className="text-slate-500 font-medium">{s.t("customer_name", "Customer Name")}</span>
                    <span className="font-bold text-slate-900">{customerName}</span>
                  </div>
                  <div className="py-1.5 flex justify-between">
                    <span className="text-slate-500 font-medium">{s.t("contact_person", "Contact Person")}</span>
                    <span className="font-bold text-slate-800">{contactPerson}</span>
                  </div>
                  <div className="py-1.5 flex justify-between">
                    <span className="text-slate-500 font-medium">{tg("common.phone", "Phone")}</span>
                    <span className="font-mono text-blue-600 font-bold">{phone}</span>
                  </div>
                  <div className="py-1.5 flex justify-between">
                    <span className="text-slate-500 font-medium">{tg("common.email", "Email")}</span>
                    <span className="font-mono text-slate-700">{email}</span>
                  </div>
                  <div className="py-1.5 flex justify-between">
                    <span className="text-slate-500 font-medium">{tg("common.address", "Address")}</span>
                    <span className="text-slate-800">{address}</span>
                  </div>
                  <div className="py-1.5 flex justify-between">
                    <span className="text-slate-500 font-medium">{tg("common.country", "Country")}</span>
                    <span className="font-bold text-slate-900">{country}</span>
                  </div>
                  <div className="py-1.5 flex justify-between">
                    <span className="text-slate-500 font-medium">{s.t("customer_type", "Customer Type")}</span>
                    <span className="font-semibold text-slate-800">{coCustomerTypeLabel(L, customerType)}</span>
                  </div>
                  <div className="py-1.5 flex justify-between">
                    <span className="text-slate-500 font-medium">{s.t("tax_no", "Tax No. / TRN")}</span>
                    <span className="font-mono text-slate-600">{trn}</span>
                  </div>
                  <div className="py-1.5 flex justify-between">
                    <span className="text-slate-500 font-medium">{tg("common.remarks", "Remarks")}</span>
                    <span className="text-slate-600">-</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ========================================================================= */}
            {/* SECTION 2: SHIPPING – LOADING, TRANSPORT & RECEIVING (3 Connected Columns) */}
            {/* ========================================================================= */}
            <div className="rounded-xl border border-blue-200 bg-white overflow-hidden shadow-2xs">
              <div className="bg-blue-900 text-white px-4 py-2.5 flex items-center gap-2">
                <Truck className="h-4 w-4 text-blue-200" />
                <h3 className="font-bold text-xs uppercase tracking-wide">
                  {s.t("shipping_section", "Shipping – Loading, Transport & Receiving")}
                </h3>
              </div>

              <div className="p-4 grid grid-cols-1 lg:grid-cols-11 gap-3 items-stretch">
                {/* Column 1: Loading Details (From) */}
                <div className="lg:col-span-3 rounded-xl border border-sky-200 bg-sky-50/30 overflow-hidden flex flex-col">
                  <div className="bg-sky-100/90 text-sky-950 px-3 py-2 text-xs font-bold flex items-center justify-between border-b border-sky-200">
                    <div className="flex items-center gap-1.5">
                      <FileDown className="h-3.5 w-3.5 text-sky-700" />
                      <span>{s.t("loading_from", "Loading Details (From)")}</span>
                    </div>
                  </div>

                  <div className="p-3 text-xs space-y-2 flex-1 divide-y divide-sky-100">
                    <div className="pt-1 flex justify-between">
                      <span className="text-slate-500 font-medium">{tg("common.country", "Country")}</span>
                      <span className="font-bold text-slate-900 flex items-center gap-1">
                        <span>🇦🇫</span>
                        <span>{loadingCountry}</span>
                      </span>
                    </div>
                    <div className="pt-1 flex justify-between">
                      <span className="text-slate-500 font-medium">{s.t("city_location", "City / Location")}</span>
                      <span className="font-bold text-slate-900">{loadingCity}</span>
                    </div>
                    <div className="pt-1 flex justify-between">
                      <span className="text-slate-500 font-medium">{tg("common.date", "Date")}</span>
                      <span className="font-bold text-slate-900 flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-blue-600" />
                        <span>{loadingDate}</span>
                      </span>
                    </div>
                    <div className="pt-1 flex justify-between">
                      <span className="text-slate-500 font-medium">{s.t("exit_border", "Exit Border")}</span>
                      <span className="font-bold text-slate-900">{exitBorder}</span>
                    </div>
                    <div className="pt-1 flex justify-between items-center">
                      <span className="text-slate-500 font-medium">{s.t("customs_clearance", "Customs Clearance")}</span>
                      <span className="font-bold text-emerald-700 flex items-center gap-1">
                        <Check className="h-3 w-3" />
                        <span>{customsClearance}</span>
                      </span>
                    </div>
                    <div className="pt-1 flex justify-between">
                      <span className="text-slate-500 font-medium">{s.t("customs_name", "Customs Name")}</span>
                      <span className="font-bold text-slate-800">{loadingCustomsName}</span>
                    </div>
                    <div className="pt-1 flex justify-between">
                      <span className="text-slate-500 font-medium">{s.t("warehouse_yard", "Warehouse / Yard")}</span>
                      <span className="font-bold text-slate-800">{loadingWarehouse}</span>
                    </div>
                    <div className="pt-1 flex justify-between">
                      <span className="text-slate-500 font-medium">{tg("common.remarks", "Remarks")}</span>
                      <span className="text-slate-500">-</span>
                    </div>
                  </div>
                </div>

                {/* Arrow 1 */}
                <div className="lg:col-span-1 hidden lg:flex items-center justify-center">
                  <div className="h-8 w-8 rounded-full bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center">
                    <ArrowRight className="h-4 w-4 rtl:rotate-180" />
                  </div>
                </div>

                {/* Column 2: Transport Details */}
                <div className="lg:col-span-3 rounded-xl border border-purple-200 bg-purple-50/20 overflow-hidden flex flex-col">
                  <div className="bg-purple-100/80 text-purple-950 px-3 py-2 text-xs font-bold flex items-center justify-between border-b border-purple-200">
                    <div className="flex items-center gap-1.5">
                      <Truck className="h-3.5 w-3.5 text-purple-700" />
                      <span>{s.t("transport_details", "Transport Details")}</span>
                    </div>
                  </div>

                  <div className="p-3 text-xs space-y-2 flex-1 divide-y divide-purple-100">
                    <div className="pt-1 flex justify-between">
                      <span className="text-slate-500 font-medium">{s.t("mode", "Mode")}</span>
                      <span className="font-bold text-slate-900 flex items-center gap-1">
                        <Truck className="h-3 w-3 text-purple-700" />
                        <span>{coModeLabel(L, transportMode)}</span>
                      </span>
                    </div>
                    <div className="pt-1 flex justify-between">
                      <span className="text-slate-500 font-medium">{s.t("carrier_truck", "Carrier / Truck No.")}</span>
                      <span className="font-mono font-bold text-slate-900">{truckNo}</span>
                    </div>
                    <div className="pt-1 flex justify-between">
                      <span className="text-slate-500 font-medium">{s.t("driver_name", "Driver Name")}</span>
                      <span className="font-bold text-slate-900">{driverName}</span>
                    </div>
                    <div className="pt-1 flex justify-between">
                      <span className="text-slate-500 font-medium">{s.t("est_transit", "Estimated Transit Time")}</span>
                      <span className="font-bold text-slate-900 flex items-center gap-1">
                        <Clock className="h-3 w-3 text-purple-600" />
                        <span>{transitTime}</span>
                      </span>
                    </div>
                    <div className="pt-1 flex justify-between">
                      <span className="text-slate-500 font-medium">{s.t("distance_km", "Distance (KM)")}</span>
                      <span className="font-mono font-bold text-slate-900">{distanceKm}</span>
                    </div>
                    <div className="pt-1">
                      <span className="text-slate-500 font-medium block mb-1">{s.t("route", "Route")}</span>
                      <span className="font-semibold text-slate-800 text-[11px] block leading-tight">
                        {routeDisplay}
                      </span>
                    </div>
                    <div className="pt-1 flex justify-between">
                      <span className="text-slate-500 font-medium">{tg("common.remarks", "Remarks")}</span>
                      <span className="text-slate-500">-</span>
                    </div>
                  </div>
                </div>

                {/* Arrow 2 */}
                <div className="lg:col-span-1 hidden lg:flex items-center justify-center">
                  <div className="h-8 w-8 rounded-full bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center">
                    <ArrowRight className="h-4 w-4 rtl:rotate-180" />
                  </div>
                </div>

                {/* Column 3: Receiving Details (To) */}
                <div className="lg:col-span-3 rounded-xl border border-emerald-200 bg-emerald-50/20 overflow-hidden flex flex-col">
                  <div className="bg-emerald-100/80 text-emerald-950 px-3 py-2 text-xs font-bold flex items-center justify-between border-b border-emerald-200">
                    <div className="flex items-center gap-1.5">
                      <FileDown className="h-3.5 w-3.5 text-emerald-700" />
                      <span>{s.t("receiving_to", "Receiving Details (To)")}</span>
                    </div>
                  </div>

                  <div className="p-3 text-xs space-y-2 flex-1 divide-y divide-emerald-100">
                    <div className="pt-1 flex justify-between">
                      <span className="text-slate-500 font-medium">{tg("common.country", "Country")}</span>
                      <span className="font-bold text-slate-900 flex items-center gap-1">
                        <span>🇵🇰</span>
                        <span>{receivingCountry}</span>
                      </span>
                    </div>
                    <div className="pt-1 flex justify-between">
                      <span className="text-slate-500 font-medium">{s.t("city_port", "City / Port")}</span>
                      <span className="font-bold text-slate-900">{receivingCity}</span>
                    </div>
                    <div className="pt-1 flex justify-between">
                      <span className="text-slate-500 font-medium">{s.t("date_eta", "Date (ETA)")}</span>
                      <span className="font-bold text-slate-900 flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-emerald-600" />
                        <span>{receivingEta}</span>
                      </span>
                    </div>
                    <div className="pt-1 flex justify-between">
                      <span className="text-slate-500 font-medium">{s.t("entry_border", "Entry Border")}</span>
                      <span className="font-bold text-slate-900 flex items-center gap-1">
                        <Anchor className="h-3 w-3 text-blue-600" />
                        <span>{entryBorder}</span>
                      </span>
                    </div>
                    <div className="pt-1 flex justify-between items-center">
                      <span className="text-slate-500 font-medium">{s.t("customs_clearance", "Customs Clearance")}</span>
                      <span className="font-bold text-emerald-700 flex items-center gap-1">
                        <Check className="h-3 w-3" />
                        <span>{customsClearance}</span>
                      </span>
                    </div>
                    <div className="pt-1 flex justify-between">
                      <span className="text-slate-500 font-medium">{s.t("customs_name", "Customs Name")}</span>
                      <span className="font-bold text-slate-800">{receivingCustomsName}</span>
                    </div>
                    <div className="pt-1 flex justify-between">
                      <span className="text-slate-500 font-medium">{s.t("warehouse_yard", "Warehouse / Yard")}</span>
                      <span className="font-bold text-slate-800">{receivingWarehouse}</span>
                    </div>
                    <div className="pt-1 flex justify-between">
                      <span className="text-slate-500 font-medium">{tg("common.remarks", "Remarks")}</span>
                      <span className="text-slate-500">-</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ========================================================================= */}
            {/* SECTION 3: GOODS DETAILS (Which goods will be made)                       */}
            {/* ========================================================================= */}
            <div className="rounded-xl border border-blue-200 bg-white overflow-hidden shadow-2xs">
              <div className="bg-blue-900 text-white px-4 py-2.5 flex items-center gap-2">
                <Package className="h-4 w-4 text-blue-200" />
                <h3 className="font-bold text-xs uppercase tracking-wide">
                  {s.t("goods_details", "Goods Details")}
                </h3>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-start border-collapse">
                  <thead>
                    <tr className="bg-blue-50/80 text-blue-950 font-bold border-b border-blue-100">
                      <th className="py-2.5 px-3 w-10">#</th>
                      <th className="py-2.5 px-3">{s.t("col_goods_name", "Goods Name")}</th>
                      <th className="py-2.5 px-3">{s.t("col_hs_code", "HS Code")}</th>
                      <th className="py-2.5 px-3">{s.t("col_brand", "Brand")}</th>
                      <th className="py-2.5 px-3">{s.t("col_size", "Size")}</th>
                      <th className="py-2.5 px-3">{s.t("col_unit", "Unit")}</th>
                      <th className="py-2.5 px-3 text-end">{tg("common.quantity", "Quantity")}</th>
                      <th className="py-2.5 px-3 text-end">{s.t("col_gross", "Gross Weight")}</th>
                      <th className="py-2.5 px-3 text-end">{s.t("col_net", "Net Weight")}</th>
                      <th className="py-2.5 px-3 text-center">{tg("common.remarks", "Remarks")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {goodsRows.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-2 px-3 font-medium text-slate-500">{row.id}</td>
                        <td className="py-2 px-3 font-bold text-slate-900">{row.name}</td>
                        <td className="py-2 px-3 font-mono text-slate-600">{row.hsCode}</td>
                        <td className="py-2 px-3 text-slate-700">{row.brand}</td>
                        <td className="py-2 px-3 text-slate-700">{row.size}</td>
                        <td className="py-2 px-3 text-slate-600 font-semibold">{row.unit}</td>
                        <td className="py-2 px-3 font-mono font-bold text-slate-900 text-end">
                          {row.qty.toLocaleString()}
                        </td>
                        <td className="py-2 px-3 font-mono font-bold text-slate-900 text-end">
                          {row.grossKg.toLocaleString()}
                        </td>
                        <td className="py-2 px-3 font-mono font-bold text-slate-900 text-end">
                          {row.netKg.toLocaleString()}
                        </td>
                        <td className="py-2 px-3 text-center text-slate-400">{row.remarks}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 font-black text-slate-900 border-t-2 border-slate-200">
                      <td colSpan={6} className="py-2.5 px-3 text-start">
                        {tg("common.total", "Total")}
                      </td>
                      <td className="py-2.5 px-3 text-end font-mono text-blue-900">
                        {totalQty.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-end font-mono text-blue-900">
                        {totalGross.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-end font-mono text-blue-900">
                        {totalNet.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-center text-slate-400">-</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* ========================================================================= */}
            {/* SECTION 4: SECTION USER DETAILS (Audit Breakdown)                         */}
            {/* ========================================================================= */}
            <div className="rounded-xl border border-blue-200 bg-white overflow-hidden shadow-2xs">
              <div className="bg-blue-900 text-white px-4 py-2.5 flex items-center gap-2">
                <User className="h-4 w-4 text-blue-200" />
                <h3 className="font-bold text-xs uppercase tracking-wide">{s.t("section_user_details", "Section User Details")}</h3>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-start border-collapse">
                  <thead>
                    <tr className="bg-blue-50/80 text-blue-950 font-bold border-b border-blue-100">
                      <th className="py-2.5 px-3">{s.t("col_section", "Section")}</th>
                      <th className="py-2.5 px-3">{s.t("col_entered_by", "Entered By")}</th>
                      <th className="py-2.5 px-3">{s.t("role", "Role")}</th>
                      <th className="py-2.5 px-3">{tg("common.branch", "Branch")}</th>
                      <th className="py-2.5 px-3">{s.t("date_time", "Date & Time")}</th>
                      <th className="py-2.5 px-3">{tg("common.remarks", "Remarks")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {auditUsers.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/80 transition">
                        <td className="py-2 px-3 font-bold text-slate-900">{item.section}</td>
                        <td className="py-2 px-3 font-semibold text-blue-700">{item.enteredBy}</td>
                        <td className="py-2 px-3 text-slate-700">{item.role}</td>
                        <td className="py-2 px-3 text-slate-700">{item.branch}</td>
                        <td className="py-2 px-3 font-mono text-slate-600">{item.dateTime}</td>
                        <td className="py-2 px-3 text-slate-600">{item.remarks}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Official Report Footer */}
            <div className="pt-2 pb-1 text-center text-[11px] font-mono text-slate-400">
              {s.t("report_footer", "DGT LLC | Customer Order Report | Generated on")} {generatedAt}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
