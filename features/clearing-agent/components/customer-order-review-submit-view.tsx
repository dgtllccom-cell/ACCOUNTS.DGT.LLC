"use client";

import React, { useMemo } from "react";
import {
  FileText,
  User,
  Building2,
  Phone,
  Mail,
  MapPin,
  Route,
  Ship,
  Plane,
  Truck,
  Train,
  Boxes,
  Receipt,
  Download,
  Eye,
  Printer,
  Calendar,
  Clock,
  ArrowRight,
  Pencil,
  Trash2,
  Plus,
  CheckCircle2,
  RefreshCw,
  Save,
  Globe2,
  ChevronRight,
  ShieldCheck,
  CreditCard
} from "lucide-react";
import { t } from "@/lib/i18n/ui";
import type { SupportedLanguage } from "@/lib/i18n/languages";
export type CustomerOrderGoodsItem = {
  id?: string;
  goodsId?: string;
  goodsName?: string;
  goods_name?: string;
  goodsChsCode?: string;
  goodsVariationLabel?: string;
  brandQuality?: string;
  size?: string;
  unit?: string;
  quantity?: string | number;
  kgPerQty?: string | number;
  grossWeight?: string | number;
  emptyWeight?: string | number;
  emptyKgPerUnit?: string | number;
  totalKg?: string | number;
  netWeight?: string | number;
  originCountry?: string;
  warehouseName?: string;
  warehouseSourceType?: string;
  photoUrl?: string;
  lotName?: string;
  qualityReport?: string;
  ratePerUnit?: string | number;
  totalAmount?: string | number;
  [key: string]: any;
};

function goodsWeights(g: Partial<CustomerOrderGoodsItem>) {
  const qty = Number(g.quantity) || 0;
  const gross = Number(g.grossWeight || g.totalKg) || 0;
  const tare = Number(g.emptyWeight) || (Number(g.emptyKgPerUnit) || 0) * qty;
  return { qty, gross, tare, net: Math.max(0, gross - tare) };
}

interface Props {
  lang: SupportedLanguage;
  formData: any;
  partySelections: any;
  selectedCustomerInfo?: any;
  selectedAccountInfo?: any;
  clearingAgents: any[];
  shippingLines: any[];
  userContext: any;
  onBack: () => void;
  onGoToSubStep: (subStep: "1A" | "1B" | "1C") => void;
  onSaveDraft: () => void;
  onConfirmSave: () => void;
  onStartNewOrder?: () => void;
  saving: boolean;
  onEditGoodsRow?: (idx: number) => void;
  onRemoveGoodsRow?: (idx: number) => void;
}

export function CustomerOrderReviewSubmitView({
  lang,
  formData,
  partySelections,
  selectedCustomerInfo,
  selectedAccountInfo,
  userContext,
  onBack,
  onGoToSubStep,
  onSaveDraft,
  onConfirmSave,
  onStartNewOrder,
  saving,
  onEditGoodsRow,
  onRemoveGoodsRow
}: Props) {
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);
  const tt = (key: string, fb: string) => t(lang, ("com." + key) as never, fb);

  // Goods items normalization
  const goodsList = useMemo(() => {
    const named = Array.isArray(formData.goods_items)
      ? formData.goods_items.filter((g: any) => String(g.goodsName || "").trim())
      : [];
    if (named.length > 0) return named;
    if (formData.goods_name || formData.goods_quantity) {
      return [
        {
          goodsId: formData.goods_id || "",
          goodsName: formData.goods_name || "",
          goodsChsCode: formData.goods_chs_code || "",
          unit: formData.goods_unit || "Bags",
          quantity: formData.goods_quantity || "0",
          kgPerQty:
            formData.goods_gross_weight && formData.goods_quantity
              ? String(Number(formData.goods_gross_weight) / Number(formData.goods_quantity))
              : "0",
          totalKg: formData.goods_gross_weight || "0",
          grossWeight: formData.goods_gross_weight || "0",
          emptyWeight: "0",
          warehouseSourceType: "company_warehouse",
          warehouseName: formData.loading_source_name || formData.loading_source || "Main Warehouse (Dubai)"
        }
      ];
    }
    return [];
  }, [formData]);

  const cargoTotals = useMemo(() => {
    let qty = 0;
    let gross = 0;
    let tare = 0;
    let net = 0;
    goodsList.forEach((g: any) => {
      const w = goodsWeights(g);
      qty += w.qty;
      gross += w.gross;
      tare += w.tare;
      net += w.net;
    });
    const cbm = (gross * 0.0054).toFixed(2); // estimated volume
    return { count: goodsList.length, qty, gross, tare, net, cbm };
  }, [goodsList]);

  const custName =
    selectedCustomerInfo?.customer_name ||
    partySelections?.supplier?.customerName ||
    formData.customer_name ||
    "ABC Trading LLC";
  const custCompany =
    selectedCustomerInfo?.company_name || partySelections?.supplier?.companyName || "ABC Trading LLC";
  const custPhone =
    selectedCustomerInfo?.mobile || selectedCustomerInfo?.whatsapp || "+971 50 123 4567";
  const custEmail = selectedCustomerInfo?.email || "ops@abctrading.ae";
  const custAddress =
    selectedCustomerInfo?.address ||
    partySelections?.supplier?.addressText ||
    "Office 1204, Business Bay, Dubai, UAE";
  const consigneeName =
    partySelections?.buyer?.customerName ||
    partySelections?.consignee?.customerName ||
    formData.consignee_name ||
    custName;

  const orderNo = formData.order_no || formData.global_serial || "CL-ORD-202610-4090";
  const entrySerial = formData.entry_serial || "ENT-0081";
  const countrySerial = formData.country_serial || "INTL-ORD-0081";
  const branchSerial = formData.branch_serial || "HQ-ORD-0081";
  const createdAtFormatted = formData.order_date
    ? `${formData.order_date} ${formData.order_time || "15:01"}`
    : "11 Oct 2026 15:01";

  const routeOrigin = formData.loading_country_name || "China (Shanghai)";
  const routePod = formData.receiving_country_name || "UAE (Jebel Ali)";
  const routeDisplayName =
    formData.route_name || `${routeOrigin} → Singapore → ${routePod} → Dubai Warehouse`;

  // Standard sample charges for freight & handling
  const charges = [
    { label: tt("charge_freight", "Freight Charge"), amount: 800.0 },
    { label: tt("charge_handling", "Handling Charge"), amount: 250.0 },
    { label: tt("charge_clearance", "Customs Clearance"), amount: 200.0 }
  ];
  const totalCharges = charges.reduce((acc, c) => acc + c.amount, 0);

  // Documents summary
  const sampleDocs = [
    {
      name: "Commercial Invoice.pdf",
      type: "Invoice",
      uploadedBy: userContext?.context?.userName || "Super Admin",
      date: formData.order_date || "11 Oct 2026"
    },
    {
      name: "Packing List.pdf",
      type: "Packing List",
      uploadedBy: userContext?.context?.userName || "Super Admin",
      date: formData.order_date || "11 Oct 2026"
    },
    {
      name: "Bill of Lading.pdf",
      type: "B/L",
      uploadedBy: userContext?.context?.userName || "Super Admin",
      date: formData.order_date || "11 Oct 2026"
    }
  ];

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="space-y-4 pb-16">
      {/* 5-Step Stepper Bar matching reference-02.jpeg */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900 print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          {/* Step 1A */}
          <button
            type="button"
            onClick={() => onGoToSubStep("1A")}
            className="flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 transition"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white text-[10px]">
              ✓
            </span>
            <span>1A {tt("tab_1a_short", "Customer & Route")}</span>
          </button>

          {/* Step 1B */}
          <button
            type="button"
            onClick={() => onGoToSubStep("1B")}
            className="flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 transition"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white text-[10px]">
              ✓
            </span>
            <span>1B {tt("tab_1b_short", "Fleet & Transport")}</span>
          </button>

          {/* Step 1C */}
          <button
            type="button"
            onClick={() => onGoToSubStep("1C")}
            className="flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 transition"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white text-[10px]">
              ✓
            </span>
            <span>1C {tt("tab_1c_short", "Goods Entry")}</span>
          </button>

          {/* Step 1D */}
          <div className="flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white text-[10px]">
              ✓
            </span>
            <span>1D {tt("tab_1d_short", "Documents & Charges")}</span>
          </div>

          {/* Step 1E (Active) */}
          <div className="flex items-center gap-1.5 rounded-xl border border-blue-500 bg-blue-600 px-3.5 py-1.5 text-xs font-black text-white shadow-xs">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-blue-700 text-[10px] font-black">
              5
            </span>
            <span>1E {tt("tab_review_submit", "Review & Submit")}</span>
          </div>
        </div>

        {/* Top Header Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onSaveDraft}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition"
          >
            <Save className="h-3.5 w-3.5" />
            <span>{tt("save_draft", "Save Draft")}</span>
          </button>

          {onStartNewOrder && (
            <button
              type="button"
              onClick={onStartNewOrder}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{tt("new", "New Order")}</span>
            </button>
          )}
        </div>
      </div>

      {/* 2-Column Review Layout matching reference-02.jpeg */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] 2xl:grid-cols-[1fr_400px] gap-4 items-start">
        {/* LEFT COLUMN: The Main Order Specification Sheet */}
        <div className="space-y-4">
          {/* Compact Serials Bar matching reference-02.jpeg */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900 text-xs">
            <div className="col-span-2 sm:col-span-1 border-b sm:border-b-0 sm:border-r border-slate-100 pb-2 sm:pb-0 sm:pr-2.5 dark:border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">
                {tt("customer_order_no", "Customer Order No.")}
              </span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="font-mono font-black text-slate-900 dark:text-white text-xs truncate">
                  {orderNo}
                </span>
                <span className="rounded-full bg-amber-100 dark:bg-amber-950 px-1.5 py-0.2 text-[9px] font-bold text-amber-800 dark:text-amber-300">
                  {formData.status === "completed" ? "COMPLETED" : "PENDING"}
                </span>
              </div>
              <span className="text-[9.5px] text-slate-400 block mt-0.5">{createdAtFormatted}</span>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">
                {tt("entry_serial", "Entry Serial")}
              </span>
              <span className="font-mono font-black text-blue-700 dark:text-blue-400 text-xs block mt-0.5">
                {entrySerial}
              </span>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">
                {tt("global_serial_bill", "Global Serial / Bill")}
              </span>
              <span className="font-mono font-black text-slate-900 dark:text-white text-xs block mt-0.5 truncate">
                {orderNo}
              </span>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">
                {tt("country_serial", "Country Serial")}
              </span>
              <span className="font-mono font-black text-slate-700 dark:text-slate-300 text-xs block mt-0.5">
                {countrySerial}
              </span>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">
                {tt("branch_serial", "Branch Serial")}
              </span>
              <span className="font-mono font-black text-slate-700 dark:text-slate-300 text-xs block mt-0.5">
                {branchSerial}
              </span>
            </div>
          </div>

          {/* Row 1: Paired Cards 1A Customer & Billing Profile + 1B Consignee & Destination */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 1A. Customer & Billing Profile */}
            <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                    <User className="h-3.5 w-3.5" />
                  </span>
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    1A. {tt("customer_billing_profile", "Customer & Billing Profile")}
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => onGoToSubStep("1A")}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:underline print:hidden"
                >
                  <Pencil className="h-3 w-3" />
                  <span>{tt("edit_1a", "Edit 1A")}</span>
                </button>
              </div>

              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">{tt("customer", "Customer")}</span>
                  <span className="font-black text-slate-900 dark:text-white text-sm">{custName}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">{tt("account_ref", "Account Ref")}</span>
                    <span className="font-mono font-bold text-blue-700 dark:text-blue-300">
                      {selectedAccountInfo?.account_number || selectedAccountInfo?.code || "CUST-0001"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">{tt("phone_mobile", "Phone / Mobile")}</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300" dir="ltr">{custPhone}</span>
                  </div>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">{tt("email", "Email")}</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">{custEmail}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">{tt("address", "Address")}</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">{custAddress}</span>
                </div>
              </div>
            </div>

            {/* 1B. Consignee & Shipping Destination */}
            <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
                    <MapPin className="h-3.5 w-3.5" />
                  </span>
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    1B. {tt("consignee_shipping_destination", "Consignee & Shipping Destination")}
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => onGoToSubStep("1A")}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 hover:underline print:hidden"
                >
                  <Pencil className="h-3 w-3" />
                  <span>{tt("edit_1b", "Edit 1B")}</span>
                </button>
              </div>

              <div className="space-y-2 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">{tt("movement_type", "Movement Type")}</span>
                    <span className="font-black text-purple-700 dark:text-purple-300 uppercase">
                      {formData.movement_type || "IMPORT"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">{tt("transport_mode", "Transport Mode")}</span>
                    <span className="font-black text-blue-700 dark:text-blue-300 capitalize">
                      {formData.transport_mode ? formData.transport_mode.replace("by_", "By ") : "By Sea"}
                    </span>
                  </div>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">{tt("final_destination", "Final Destination")}</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {formData.destination_port_name || formData.destination_city || "Jebel Ali (AE)"}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">{tt("notify_party", "Notify Party")}</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {partySelections?.notify_party?.customerName || "Same as Consignee"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">{tt("buyer_name", "Buyer Name")}</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {partySelections?.buyer?.customerName || custName}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Row 2: Paired Cards 1C Route & Schedule + 1D Vehicle & Driver Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 1C. Route & Operational Schedule */}
            <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                    <Route className="h-3.5 w-3.5" />
                  </span>
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    1C. {tt("route_schedule", "Route & Operational Schedule")}
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => onGoToSubStep("1A")}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:underline print:hidden"
                >
                  <Pencil className="h-3 w-3" />
                  <span>{tt("edit_1c", "Edit 1C")}</span>
                </button>
              </div>

              {/* Visual Transit Flag Nodes matching reference-02.jpeg */}
              <div className="flex items-center gap-1.5 overflow-x-auto py-1 text-xs">
                <div className="flex items-center gap-1 rounded-lg bg-slate-50 dark:bg-slate-800 p-1.5 border border-slate-200 dark:border-slate-700 shrink-0">
                  <span className="text-base">🇨🇳</span>
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white block text-[11px]">China (Shanghai)</span>
                    <span className="text-[9.5px] text-slate-400 block">POL: CNSHA</span>
                  </div>
                </div>

                <ArrowRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />

                <div className="flex items-center gap-1 rounded-lg bg-slate-50 dark:bg-slate-800 p-1.5 border border-slate-200 dark:border-slate-700 shrink-0">
                  <span className="text-base">🇸🇬</span>
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white block text-[11px]">Singapore</span>
                    <span className="text-[9.5px] text-slate-400 block">Transit: 22 Days</span>
                  </div>
                </div>

                <ArrowRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />

                <div className="flex items-center gap-1 rounded-lg bg-slate-50 dark:bg-slate-800 p-1.5 border border-slate-200 dark:border-slate-700 shrink-0">
                  <span className="text-base">🇦🇪</span>
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white block text-[11px]">UAE (Jebel Ali)</span>
                    <span className="text-[9.5px] text-slate-400 block">POD: AEJEA</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs border-t border-slate-100 dark:border-slate-800">
                <div>
                  <span className="text-[9.5px] font-bold uppercase text-slate-400 block">{tt("route_type", "Route Type")}</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 text-[11px]">Direct Import (Local)</span>
                </div>
                <div>
                  <span className="text-[9.5px] font-bold uppercase text-slate-400 block">{tt("planned_pickup", "Planned Pickup")}</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300 text-[11px]">11 Oct 2026</span>
                </div>
                <div>
                  <span className="text-[9.5px] font-bold uppercase text-slate-400 block">{tt("planned_dispatch", "Planned Dispatch")}</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300 text-[11px]">12 Oct 2026</span>
                </div>
                <div>
                  <span className="text-[9.5px] font-bold uppercase text-slate-400 block">{tt("planned_arrival", "Planned Arrival")}</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300 text-[11px]">27 Oct 2026</span>
                </div>
              </div>
            </div>

            {/* 1D. Vehicle & Driver Details */}
            <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
                    <Truck className="h-3.5 w-3.5" />
                  </span>
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    1D. {tt("vehicle_driver_details", "Vehicle & Driver Details")}
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => onGoToSubStep("1B")}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:underline print:hidden"
                >
                  <Pencil className="h-3 w-3" />
                  <span>{tt("edit_1d", "Edit 1D")}</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">{tt("assignment_mode", "Assignment Mode")}</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {formData.truck_assignment_mode === "permanent"
                      ? "Permanent Fleet"
                      : formData.truck_assignment_mode === "hired"
                      ? "Hired / Contractor"
                      : "Permanent Fleet"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">{tt("truck_plate", "Truck / Vehicle Plate")}</span>
                  <span className="font-mono font-black text-blue-700 dark:text-blue-400 text-sm">
                    {formData.truck_number || "DGT-7742"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">{tt("driver_name", "Driver Name")}</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {formData.truck_driver_name || "Mohammed Rashed"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">{tt("driver_mobile", "Driver Mobile")}</span>
                  <span className="font-mono font-medium text-slate-700 dark:text-slate-300" dir="ltr">
                    {formData.truck_driver_mobile || "+971 55 987 6543"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Row 3: 1C. Goods & Cargo Manifest (Table with totals immediately below) matching reference-02.jpeg */}
          <div className="rounded-2xl border border-slate-200/90 bg-white overflow-hidden shadow-2xs dark:border-slate-800 dark:bg-slate-900">
            <div className="p-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
                  <Boxes className="h-3.5 w-3.5" />
                </span>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  1C. {tt("goods_cargo_manifest", "Goods & Cargo Manifest")}
                </h4>
                <span className="rounded-full bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:text-emerald-300">
                  {cargoTotals.count} {tt("items", "Items")}
                </span>
              </div>

              <div className="flex items-center gap-2 print:hidden">
                <button
                  type="button"
                  onClick={() => onGoToSubStep("1C")}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>{tt("add_goods_item", "+ Add Goods Item")}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onGoToSubStep("1C")}
                  className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  <span>{tt("edit_goods", "Edit Goods")}</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50/90 text-[10px] font-black uppercase tracking-wider text-slate-600 dark:bg-slate-800/80 dark:text-slate-300">
                  <tr>
                    <th className="py-2 px-3 text-center w-8">#</th>
                    <th className="py-2 px-3">{tt("col_warehouse_source", "Warehouse (Source)")}</th>
                    <th className="py-2 px-3">{tt("col_goods_name", "Goods Name")}</th>
                    <th className="py-2 px-3">{tt("col_hs_code", "HS Code")}</th>
                    <th className="py-2 px-3">{tt("col_packaging_unit", "Packaging / Unit")}</th>
                    <th className="py-2 px-3 text-right">{tt("col_qty", "Qty")}</th>
                    <th className="py-2 px-3 text-right">{tt("col_kg_unit", "KG / Unit")}</th>
                    <th className="py-2 px-3 text-right">{tt("col_gross_kg", "Gross (kg)")}</th>
                    <th className="py-2 px-3 text-right">{tt("col_tare_kg", "Tare (kg)")}</th>
                    <th className="py-2 px-3 text-right">{tt("col_net_kg", "Net (kg)")}</th>
                    <th className="py-2 px-3 text-right">{tt("col_volume", "Volume (CBM)")}</th>
                    <th className="py-2 px-3 text-center w-16 print:hidden">{tt("actions", "Actions")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                  {goodsList.map((item: any, idx: number) => {
                    const w = goodsWeights(item);
                    const kgPer = parseFloat(String(item.kgPerQty || 0)) || (w.qty > 0 ? w.gross / w.qty : 0);
                    const itemVol = ((w.gross * 0.0054) / (goodsList.length || 1)).toFixed(2);

                    return (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                        <td className="py-2.5 px-3 text-center font-bold text-slate-400">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-semibold text-slate-700 dark:text-slate-300">
                          {item.warehouseName || "Main Warehouse (Dubai)"}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">
                          {item.goodsName}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-400">
                          {item.goodsChsCode || "8517.12"}
                        </td>
                        <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">
                          {item.unit || "Carton"}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-black text-blue-700 dark:text-blue-400">
                          {w.qty.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-600 dark:text-slate-400">
                          {kgPer.toFixed(0)} kg
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                          {w.gross.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-500">
                          {w.tare.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700 dark:text-emerald-400">
                          {w.net.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-600 dark:text-slate-400">
                          {itemVol}
                        </td>
                        <td className="py-2.5 px-3 text-center print:hidden">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => onEditGoodsRow?.(idx)}
                              className="p-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950 rounded"
                              title={tt("edit", "Edit")}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onRemoveGoodsRow?.(idx)}
                              className="p-1 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 rounded"
                              title={tt("delete", "Delete")}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {/* Total Row immediately below table */}
                <tfoot className="bg-slate-100/90 font-black text-xs border-t-2 border-slate-300 dark:border-slate-700 dark:bg-slate-800">
                  <tr>
                    <td colSpan={5} className="py-2.5 px-3 text-right uppercase tracking-wider text-slate-700 dark:text-slate-200">
                      {tt("total", "TOTAL")}:
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-black text-blue-700 dark:text-blue-300">
                      {cargoTotals.qty.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3"></td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                      {cargoTotals.gross.toLocaleString()} kg
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-600 dark:text-slate-400">
                      {cargoTotals.tare.toLocaleString()} kg
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700 dark:text-emerald-400">
                      {cargoTotals.net.toLocaleString()} kg
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                      {cargoTotals.cbm} m³
                    </td>
                    <td className="print:hidden"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Row 4: Paired Cards 1D Documents & Charges */}
          <div className="grid grid-cols-1 md:grid-cols-[1.3fr_1fr] gap-4">
            {/* Documents & Charges Table */}
            <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                    <FileText className="h-3.5 w-3.5" />
                  </span>
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    1D. {tt("documents_and_charges", "Documents & Charges")}
                  </h4>
                  <span className="rounded-full bg-blue-100 dark:bg-blue-950 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:text-blue-300">
                    {sampleDocs.length} {tt("documents", "Documents")}
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-[10px] font-bold uppercase text-slate-400 border-b border-slate-100 dark:border-slate-800">
                    <tr>
                      <th className="py-1.5 px-2 w-6">#</th>
                      <th className="py-1.5 px-2">{tt("col_document_name", "Document Name")}</th>
                      <th className="py-1.5 px-2">{tt("col_type", "Type")}</th>
                      <th className="py-1.5 px-2">{tt("col_uploaded_by", "Uploaded By")}</th>
                      <th className="py-1.5 px-2">{tt("col_date", "Date")}</th>
                      <th className="py-1.5 px-2 text-center print:hidden">{tt("actions", "Actions")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {sampleDocs.map((doc, i) => (
                      <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-2 px-2 text-slate-400 font-bold">{i + 1}</td>
                        <td className="py-2 px-2 font-bold text-blue-700 dark:text-blue-400">
                          {doc.name}
                        </td>
                        <td className="py-2 px-2 text-slate-600 dark:text-slate-400">{doc.type}</td>
                        <td className="py-2 px-2 text-slate-600 dark:text-slate-400">{doc.uploadedBy}</td>
                        <td className="py-2 px-2 font-mono text-slate-500">{doc.date}</td>
                        <td className="py-2 px-2 text-center print:hidden">
                          <div className="flex items-center justify-center gap-1 text-slate-400">
                            <button type="button" className="p-1 hover:text-blue-600" title="View">
                              <Eye className="h-3.5 w-3.5" />
                            </button>
                            <button type="button" className="p-1 hover:text-blue-600" title="Download">
                              <Download className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Charges Summary (AED) */}
            <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900 space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
                      <Receipt className="h-3.5 w-3.5" />
                    </span>
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                      {tt("charges_summary_aed", "Charges Summary (AED)")}
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => onGoToSubStep("1C")}
                    className="text-[11px] font-bold text-emerald-600 hover:underline print:hidden"
                  >
                    [{tt("edit_charges", "Edit Charges")}]
                  </button>
                </div>

                <div className="space-y-2 text-xs pt-2">
                  {charges.map((c, i) => (
                    <div key={i} className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                      <span>{c.label}</span>
                      <span className="font-mono font-bold">{c.amount.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t-2 border-slate-200 pt-3 dark:border-slate-700 flex items-center justify-between text-xs">
                <span className="font-black uppercase text-slate-900 dark:text-white">
                  {tt("total_charges", "Total Charges")}:
                </span>
                <span className="font-mono font-black text-sm text-blue-700 dark:text-blue-400">
                  {totalCharges.toFixed(2)} AED
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Live Order Report & Quick Actions matching reference-02.jpeg */}
        <div className="space-y-4 print:hidden">
          {/* Live Order Report Card */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                  <Route className="h-3.5 w-3.5" />
                </span>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                  {tt("live_order_report", "Live Order Report")}
                </h4>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Live</span>
                </span>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                  title={tt("refresh", "Refresh")}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400">{tt("order_no", "Order No")}</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white truncate max-w-[190px]">
                  {orderNo}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400">{tt("customer", "Customer")}</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[190px]">
                  {custName}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400">{tt("route", "Route")}</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[190px]">
                  Shanghai → Jebel Ali
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400">{tt("etd_eta", "ETD / ETA")}</span>
                <span className="font-mono text-slate-700 dark:text-slate-300 text-[11px]">
                  11 Oct 2026 / 27 Oct 2026
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400">{tt("status", "Status")}</span>
                <span className="rounded-full bg-amber-100 dark:bg-amber-950 px-2 py-0.2 text-[10px] font-bold text-amber-800 dark:text-amber-300">
                  {formData.status || "Draft"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400">{tt("created_by", "Created By")}</span>
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {userContext?.context?.userName || "Super Admin"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400">{tt("created_at", "Created At")}</span>
                <span className="font-mono text-slate-500 text-[11px]">{createdAtFormatted}</span>
              </div>
            </div>
          </div>

          {/* Route Map & Details Card */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                  <MapPin className="h-3.5 w-3.5" />
                </span>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                  {tt("route_map_details", "Route Map & Details")}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => onGoToSubStep("1A")}
                className="text-[10px] font-bold text-blue-600 hover:underline"
              >
                {tt("view_full_route", "View Full Route")}
              </button>
            </div>

            {/* Illustration Map / Visual Nodes matching reference-02.jpeg */}
            <div className="rounded-xl border border-blue-100 bg-gradient-to-b from-blue-50/60 to-white p-3 dark:border-slate-800 dark:from-slate-800/40 dark:to-slate-900 space-y-2">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-sm">🔴</span>
                <div>
                  <span className="font-bold text-slate-900 dark:text-white block">Shanghai</span>
                  <span className="text-[9.5px] text-slate-500">CNSHA</span>
                </div>
              </div>
              <div className="pl-2 border-l-2 border-dashed border-blue-300 dark:border-blue-800 py-1 ml-1.5 text-[10px] text-blue-600 dark:text-blue-400 font-bold flex items-center gap-1">
                <span>🚢 Singapore Transit: 22 Days</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-sm">🟢</span>
                <div>
                  <span className="font-bold text-slate-900 dark:text-white block">Jebel Ali</span>
                  <span className="text-[9.5px] text-slate-500">AEJEA</span>
                </div>
              </div>
            </div>
          </div>

          {/* Summary (Live) Card */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900 space-y-2.5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
                  <Receipt className="h-3.5 w-3.5" />
                </span>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                  {tt("summary_live", "Summary (Live)")}
                </h4>
              </div>
              <span className="text-[10px] font-bold text-slate-400">
                {tt("view_details", "View Details >")}
              </span>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                <span>{tt("total_items", "Total Items")}</span>
                <span className="font-black text-slate-900 dark:text-white">{cargoTotals.count}</span>
              </div>
              <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                <span>{tt("total_quantity", "Total Quantity")}</span>
                <span className="font-mono font-black text-blue-700 dark:text-blue-400">
                  {cargoTotals.qty.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                <span>{tt("total_gross_weight", "Total Gross Weight")}</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  {cargoTotals.gross.toLocaleString()} kg
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                <span>{tt("total_net_weight", "Total Net Weight")}</span>
                <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                  {cargoTotals.net.toLocaleString()} kg
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                <span>{tt("total_volume", "Total Volume")}</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                  {cargoTotals.cbm} m³
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-100 pt-1.5 dark:border-slate-800 font-bold text-slate-900 dark:text-white">
                <span>{tt("total_charges_aed", "Total Charges (AED)")}</span>
                <span className="font-mono font-black text-blue-700 dark:text-blue-400">
                  {totalCharges.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Actions Card matching reference-02.jpeg */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900 space-y-2.5">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 border-b border-slate-100 pb-2 dark:border-slate-800">
              {tt("quick_actions", "Quick Actions")}
            </h4>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 py-2 px-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition shadow-2xs"
              >
                <Printer className="h-3.5 w-3.5 text-slate-600" />
                <span>{tt("print_a4_sheet", "Print A4 Sheet")}</span>
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 py-2 px-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition shadow-2xs"
              >
                <Download className="h-3.5 w-3.5 text-slate-600" />
                <span>{tt("print_report_pdf", "Print Report (PDF)")}</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onConfirmSave}
              disabled={saving}
              className="w-full mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 py-3 text-xs font-black text-white shadow-md shadow-emerald-600/30 active:scale-98 transition disabled:opacity-50"
            >
              {saving ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              <span>{tt("confirm_submit_customer_order", "Confirm & Submit Customer Order")}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
