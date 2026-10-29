"use client";

import React, { useEffect, useState, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FileText,
  Printer,
  Download,
  Edit,
  ArrowLeft,
  ArrowRight,
  Inbox,
  Building2,
  Shield,
  Truck,
  UserCheck,
  Receipt,
  ChevronRight,
  CheckCircle2,
  Clock,
  Check,
  X,
  ExternalLink,
  PlusCircle,
  HelpCircle,
  Sparkles,
  Share2
} from "lucide-react";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import {
  coCustomerTypeLabel,
  coFill,
  coModeLabel,
  coMovementLabel,
  coStatusLabel,
  coYesNoLabel,
} from "./customer-order-i18n";

export interface TransferHistoryEntry {
  id: string;
  serial: number;
  dateTime: string;
  transferredTo: string;
  transferredToKey: "general_received" | "clearing_agent" | "customs" | "truck" | "customer" | "other";
  billNo: string;
  message: string;
  status: "Completed" | "In Process" | "Pending";
  postedBy: string;
}

export interface GoodsItem {
  id?: string;
  serial: number;
  goodsName: string;
  hsCode: string;
  brand: string;
  size: string;
  unit: string;
  quantity: number;
  grossWeight: number;
  netWeight: number;
  remarks: string;
  /** which localized placeholder to show when the order carries no goods name */
  nameFallback?: "commercial_cargo" | "general_cargo";
}

export interface TransferHubOrderData {
  id: string;
  orderNo: string;
  orderDate: string;
  operationType: string;
  shipmentType: string;
  status: "Completed" | "In Process" | "Draft" | "Pending" | "-";
  expectedDispatch: string;
  expectedDelivery: string;
  branch: string;

  // Customer Details
  customerName: string;
  accountCode: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  country: string;
  customerType: string;

  // Route & Transport
  loadingCountry: string;
  loadingLocation: string;
  exitBorder: string;
  transitCountry: string;
  receivingLocation: string;
  finalDestination: string;
  transportMode: string;
  carrierTruckNo: string;
  driverName: string;

  // Goods
  goods: GoodsItem[];

  // Loading Details
  loadingCity: string;
  loadingDate: string;
  loadingCustomsClearance: string;
  loadingCustomsName: string;
  loadingWarehouse: string;
  loadingRemarks: string;

  // Receiving Details
  receivingCountry: string;
  receivingCityPort: string;
  receivingDateEta: string;
  entryBorder: string;
  receivingCustomsClearance: string;
  receivingCustomsName: string;
  receivingWarehouse: string;
  receivingRemarks: string;

  // Transfer History
  transfers: TransferHistoryEntry[];
}

const EMPTY_ORDER: TransferHubOrderData = {
  id: "",
  orderNo: "-",
  orderDate: "-",
  operationType: "-",
  shipmentType: "-",
  status: "-",
  expectedDispatch: "-",
  expectedDelivery: "-",
  branch: "-",

  customerName: "-",
  accountCode: "-",
  contactPerson: "-",
  phone: "-",
  email: "-",
  address: "-",
  country: "-",
  customerType: "-",

  loadingCountry: "-",
  loadingLocation: "-",
  exitBorder: "-",
  transitCountry: "-",
  receivingLocation: "-",
  finalDestination: "-",
  transportMode: "-",
  carrierTruckNo: "-",
  driverName: "-",

  goods: [],

  loadingCity: "-",
  loadingDate: "-",
  loadingCustomsClearance: "-",
  loadingCustomsName: "-",
  loadingWarehouse: "-",
  loadingRemarks: "-",

  receivingCountry: "-",
  receivingCityPort: "-",
  receivingDateEta: "-",
  entryBorder: "-",
  receivingCustomsClearance: "-",
  receivingCustomsName: "-",
  receivingWarehouse: "-",
  receivingRemarks: "-",

  transfers: []
};

export const TRANSFER_SIDEBAR_CARDS = [
  {
    key: "general_received" as const,
    titleKey: "card_general_received_title",
    subtitleKey: "card_general_received_sub",
    icon: Inbox,
    colorClass: "text-blue-600 bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900/60",
    borderActive: "border-blue-500 ring-2 ring-blue-500/20",
    badgeClass: "bg-blue-100 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300",
    messageBg: "bg-blue-50/70 text-blue-900 dark:bg-blue-950/30 dark:text-blue-200",
    route: "/dashboard/clearing-agent/bill-entry"
  },
  {
    key: "clearing_agent" as const,
    titleKey: "card_clearing_agent_title",
    subtitleKey: "card_clearing_agent_sub",
    icon: Building2,
    colorClass: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/60",
    borderActive: "border-emerald-500 ring-2 ring-emerald-500/20",
    badgeClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300",
    messageBg: "bg-emerald-50/70 text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200",
    route: "/dashboard/clearing-agent/bill-entry"
  },
  {
    key: "customs" as const,
    titleKey: "card_customs_title",
    subtitleKey: "card_customs_sub",
    icon: Shield,
    colorClass: "text-amber-600 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/60",
    borderActive: "border-amber-500 ring-2 ring-amber-500/20",
    badgeClass: "bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300",
    messageBg: "bg-amber-50/70 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200",
    route: "/dashboard/clearing-agent/customs-expenses"
  },
  {
    key: "truck" as const,
    titleKey: "card_truck_title",
    subtitleKey: "card_truck_sub",
    icon: Truck,
    colorClass: "text-purple-600 bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-900/60",
    borderActive: "border-purple-500 ring-2 ring-purple-500/20",
    badgeClass: "bg-purple-100 text-purple-700 dark:bg-purple-950/70 dark:text-purple-300",
    messageBg: "bg-purple-50/70 text-purple-900 dark:bg-purple-950/30 dark:text-purple-200",
    route: "/dashboard/clearing-agent/truck-expenses"
  },
  {
    key: "customer" as const,
    titleKey: "card_customer_title",
    subtitleKey: "card_customer_sub",
    icon: UserCheck,
    colorClass: "text-teal-600 bg-teal-50 dark:bg-teal-950/40 border-teal-200 dark:border-teal-900/60",
    borderActive: "border-teal-500 ring-2 ring-teal-500/20",
    badgeClass: "bg-teal-100 text-teal-700 dark:bg-teal-950/70 dark:text-teal-300",
    messageBg: "bg-teal-50/70 text-teal-900 dark:bg-teal-950/30 dark:text-teal-200",
    route: "/dashboard/clearing-agent/customer-expenses"
  },
  {
    key: "other" as const,
    titleKey: "card_other_title",
    subtitleKey: "card_other_sub",
    icon: Receipt,
    colorClass: "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-900/60",
    borderActive: "border-indigo-500 ring-2 ring-indigo-500/20",
    badgeClass: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300",
    messageBg: "bg-indigo-50/70 text-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-200",
    route: "/dashboard/clearing-agent/other-expenses"
  }
];

export function CustomerOrderTransferHubView({
  orderId,
  onBack,
  lang = "en"
}: {
  orderId?: string | null;
  onBack?: () => void;
  lang?: SupportedLanguage;
}) {
  const router = useRouter();
  const s = useErpScreen("cohub", lang);
  const L = s.lang;
  const tg = s.tGlobal;
  const [data, setData] = useState<TransferHubOrderData>(EMPTY_ORDER);
  const [loading, setLoading] = useState(false);
  const [activeTransferCard, setActiveTransferCard] = useState<string | null>(null);

  // Modal State for Transfer
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<typeof TRANSFER_SIDEBAR_CARDS[0] | null>(null);
  const [billNoInput, setBillNoInput] = useState("");
  const [messageInput, setMessageInput] = useState("");
  const [postedByInput, setPostedByInput] = useState("Asmatullah");
  const [navigateAfterTransfer, setNavigateAfterTransfer] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Fetch real order / bill if available
  useEffect(() => {
    if (!orderId || orderId === "5acbeb8a-66d6-4adc-9836-6e6972194bae") {
      setData(EMPTY_ORDER);
      return;
    }

    let isMounted = true;
    setLoading(true);

    async function loadOrder() {
      try {
        // Try getting customer bill or customer order
        const [resBill, resOrder] = await Promise.all([
          fetch(`/api/erp/clearing-agent/customer-bill?id=${encodeURIComponent(orderId!)}`).catch(() => null),
          fetch(`/api/erp/clearing-agent/customer-order/${encodeURIComponent(orderId!)}`).catch(() => null)
        ]);

        let foundOrder: any = null;
        let foundBill: any = null;

        if (resBill && resBill.ok) {
          const json = await resBill.json();
          if (json.data) foundBill = json.data;
          if (json.order) foundOrder = json.order;
        }

        if (!foundOrder && resOrder && resOrder.ok) {
          const json = await resOrder.json();
          if (json.data) foundOrder = json.data;
        }

        if (isMounted) {
          if (foundOrder) {
            const mappedGoods: GoodsItem[] = Array.isArray(foundOrder.goods_items) && foundOrder.goods_items.length > 0
              ? foundOrder.goods_items.map((g: any, idx: number) => ({
                  serial: idx + 1,
                  goodsName: g.goods_name || g.goodsName || foundOrder.goods_name || "",
                  nameFallback: "commercial_cargo" as const,
                  hsCode: g.hs_code || g.goodsChsCode || foundOrder.goods_chs_code || "0802.12",
                  brand: g.brand || foundOrder.goods_brand || "",
                  size: g.size || foundOrder.goods_size || "-",
                  unit: g.unit || foundOrder.goods_unit || "KG",
                  quantity: Number(g.quantity || foundOrder.goods_quantity || 1),
                  grossWeight: Number(g.gross_weight || g.grossWeight || foundOrder.goods_gross_weight || 0),
                  netWeight: Number(g.net_weight || g.netWeight || foundOrder.goods_net_weight || 0),
                  remarks: g.remarks || "-"
                }))
              : [
                  {
                    serial: 1,
                    goodsName: foundOrder.goods_name || "",
                    nameFallback: "general_cargo" as const,
                    hsCode: foundOrder.goods_chs_code || "0802.12",
                    brand: foundOrder.goods_brand || "",
                    size: foundOrder.goods_size || "-",
                    unit: foundOrder.goods_unit || "KG",
                    quantity: Number(foundOrder.goods_quantity || 1),
                    grossWeight: Number(foundOrder.goods_gross_weight || 0),
                    netWeight: Number(foundOrder.goods_net_weight || 0),
                    remarks: "-"
                  }
                ];

            const legs = Array.isArray(foundOrder.legs) ? foundOrder.legs : [];
            const leg1 = legs[0];
            const legLast = legs[legs.length - 1];

            setData({
              id: foundOrder.id || orderId!,
              orderNo: foundOrder.order_no || EMPTY_ORDER.orderNo,
              orderDate: foundOrder.created_at ? new Date(foundOrder.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase() : EMPTY_ORDER.orderDate,
              operationType: foundOrder.movement_type ? foundOrder.movement_type.charAt(0).toUpperCase() + foundOrder.movement_type.slice(1) : EMPTY_ORDER.operationType,
              shipmentType: foundOrder.shipment_type || foundOrder.transport_mode?.replace("_", " ")?.toUpperCase() || EMPTY_ORDER.shipmentType,
              status: foundOrder.status === "completed" ? "Completed" : "In Process",
              expectedDispatch: foundOrder.expected_loading_date ? new Date(foundOrder.expected_loading_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase() : EMPTY_ORDER.expectedDispatch,
              expectedDelivery: EMPTY_ORDER.expectedDelivery,
              branch: foundOrder.country_branch_name || EMPTY_ORDER.branch,

              customerName: foundOrder.customer_name || EMPTY_ORDER.customerName,
              accountCode: foundBill?.customer_account_number || EMPTY_ORDER.accountCode,
              contactPerson: foundOrder.truck_driver_name || EMPTY_ORDER.contactPerson,
              phone: foundOrder.truck_driver_mobile || EMPTY_ORDER.phone,
              email: EMPTY_ORDER.email,
              address: EMPTY_ORDER.address,
              country: foundOrder.loading_country_name || EMPTY_ORDER.country,
              customerType: "Company",

              loadingCountry: foundOrder.loading_country_name || EMPTY_ORDER.loadingCountry,
              loadingLocation: leg1?.from_location_text || foundOrder.route_name?.split("->")?.[0]?.trim() || EMPTY_ORDER.loadingLocation,
              exitBorder: leg1?.to_location_text || EMPTY_ORDER.exitBorder,
              transitCountry: foundOrder.receiving_country_name || EMPTY_ORDER.transitCountry,
              receivingLocation: legLast?.to_location_text || EMPTY_ORDER.receivingLocation,
              finalDestination: legLast?.to_location_text || EMPTY_ORDER.finalDestination,
              transportMode: foundOrder.transport_mode ? foundOrder.transport_mode.replace("by_", "By ").replace("_", " ") : EMPTY_ORDER.transportMode,
              carrierTruckNo: foundOrder.truck_number || EMPTY_ORDER.carrierTruckNo,
              driverName: foundOrder.truck_driver_name || EMPTY_ORDER.driverName,

              goods: mappedGoods,

              loadingCity: leg1?.from_location_text || EMPTY_ORDER.loadingCity,
              loadingDate: EMPTY_ORDER.loadingDate,
              loadingCustomsClearance: "Yes",
              loadingCustomsName: leg1?.customs_agent_name || "",
              loadingWarehouse: EMPTY_ORDER.loadingWarehouse,
              loadingRemarks: foundOrder.remarks || "-",

              receivingCountry: foundOrder.receiving_country_name || EMPTY_ORDER.receivingCountry,
              receivingCityPort: legLast?.to_location_text || EMPTY_ORDER.receivingCityPort,
              receivingDateEta: EMPTY_ORDER.receivingDateEta,
              entryBorder: legLast?.from_location_text || EMPTY_ORDER.entryBorder,
              receivingCustomsClearance: "Yes",
              receivingCustomsName: "",
              receivingWarehouse: EMPTY_ORDER.receivingWarehouse,
              receivingRemarks: "-",

              transfers: []
            });
          } else {
            setData(EMPTY_ORDER);
          }
        }
      } catch (err) {
        console.error("Error loading order for transfer hub:", err);
        if (isMounted) setData(EMPTY_ORDER);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadOrder();
    return () => {
      isMounted = false;
    };
  }, [orderId]);

  // Compute Goods Totals
  const totals = useMemo(() => {
    return data.goods.reduce(
      (acc, item) => ({
        quantity: acc.quantity + Number(item.quantity || 0),
        grossWeight: acc.grossWeight + Number(item.grossWeight || 0),
        netWeight: acc.netWeight + Number(item.netWeight || 0)
      }),
      { quantity: 0, grossWeight: 0, netWeight: 0 }
    );
  }, [data.goods]);

  const cardTitle = (card: typeof TRANSFER_SIDEBAR_CARDS[0]) => s.t(card.titleKey, card.key);
  const cardSub = (card: typeof TRANSFER_SIDEBAR_CARDS[0]) => s.t(card.subtitleKey, card.key);
  const defaultMessage = (card: typeof TRANSFER_SIDEBAR_CARDS[0]) =>
    coFill(s.t("default_message", "This Customer Order has been transferred to {title} ({purpose})."), {
      title: cardTitle(card),
      purpose: cardSub(card),
    });

  // Open Transfer Modal
  const handleOpenTransferModal = (card: typeof TRANSFER_SIDEBAR_CARDS[0]) => {
    setSelectedTarget(card);
    setActiveTransferCard(card.key);

    // Auto-generate next sequential bill no
    const prefix =
      card.key === "general_received" ? "GRB" :
      card.key === "clearing_agent" ? "CAB" :
      card.key === "customs" ? "CSB" :
      card.key === "truck" ? "TEB" :
      card.key === "customer" ? "CEB" : "OEB";

    const nextNum = String(data.transfers.length + 1).padStart(3, "0");
    setBillNoInput(`${prefix}-202610-${nextNum}`);
    setMessageInput(defaultMessage(card));
    setModalOpen(true);
  };

  // Confirm Transfer
  const handleConfirmTransfer = () => {
    if (!selectedTarget) return;

    const now = new Date();
    const formattedDate = `${now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase()} ${now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;

    const newEntry: TransferHistoryEntry = {
      id: `tr-${Date.now()}`,
      serial: data.transfers.length + 1,
      dateTime: formattedDate,
      transferredTo: cardTitle(selectedTarget),
      transferredToKey: selectedTarget.key,
      billNo: billNoInput.trim() || `${selectedTarget.key.substring(0, 3).toUpperCase()}-202610-001`,
      message: messageInput.trim(),
      status: "In Process",
      postedBy: postedByInput.trim() || "Asmatullah"
    };

    setData((prev) => ({
      ...prev,
      transfers: [...prev.transfers, newEntry]
    }));

    setToastMessage(
      coFill(s.t("toast_success", "✓ Order transferred successfully to {title} (Bill No: {billNo})"), {
        title: cardTitle(selectedTarget),
        billNo: newEntry.billNo,
      })
    );
    setModalOpen(false);

    if (navigateAfterTransfer) {
      router.push(`${selectedTarget.route}?orderId=${encodeURIComponent(data.id)}&orderNo=${encodeURIComponent(data.orderNo)}`);
    }
  };

  return (
    <div dir={s.dir} className="w-full bg-[#f8fafc] dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-sans pb-16">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 end-6 z-50 flex items-center gap-3 rounded-2xl bg-emerald-600 text-white px-5 py-3.5 shadow-2xl shadow-emerald-600/30 text-xs font-bold animate-in fade-in slide-in-from-bottom-5">
          <CheckCircle2 className="h-5 w-5" />
          <span>{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="ms-2 hover:bg-emerald-700 rounded-lg p-1"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Main 2-Column Container */}
      <div className="max-w-[1720px] mx-auto p-3 sm:p-5">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* ============================================================== */}
          {/* LEFT SIDEBAR: Customer Order Transfer (3 cols)                  */}
          {/* ============================================================== */}
          <div className="lg:col-span-3 space-y-3.5 print:hidden">
            {/* Top Brand Banner */}
            <div className="rounded-2xl border border-blue-200/80 bg-gradient-to-br from-blue-700 via-blue-800 to-indigo-900 text-white p-4 shadow-lg shadow-blue-900/10">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-white/10 backdrop-blur-xs border border-white/20">
                  <Receipt className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="font-black text-sm tracking-tight text-white">
                    {s.t("banner_title", "Customer Order Transfer")}
                  </h3>
                  <p className="text-[11px] text-blue-200 mt-0.5">
                    {s.t("banner_sub", "Transfer order to related bills and expenses")}
                  </p>
                </div>
              </div>
            </div>

            {/* Back Button */}
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="w-full flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 text-xs font-bold shadow-2xs transition cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4 text-slate-500 rtl:rotate-180" />
                <span>{tg("cod.back_to_orders", "Back to Customer Orders")}</span>
              </button>
            )}

            {/* 6 Colored Transfer Cards */}
            <div className="space-y-2.5">
              {TRANSFER_SIDEBAR_CARDS.map((card) => {
                const IconComponent = card.icon;
                const isActive = activeTransferCard === card.key;
                return (
                  <button
                    key={card.key}
                    type="button"
                    onClick={() => handleOpenTransferModal(card)}
                    className={`w-full text-start p-3.5 rounded-2xl border transition-all duration-200 flex items-center justify-between gap-3 shadow-2xs cursor-pointer group bg-white dark:bg-slate-900 hover:shadow-md ${
                      isActive ? card.borderActive : "border-slate-200/90 dark:border-slate-800 hover:border-blue-300 dark:hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`p-2.5 rounded-xl border shrink-0 transition-transform group-hover:scale-105 ${card.colorClass}`}>
                        <IconComponent className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-xs text-slate-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">
                          {cardTitle(card)}
                        </div>
                        <div className="text-[11px] text-slate-400 dark:text-slate-400 truncate mt-0.5">
                          {cardSub(card)}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 rtl:rotate-180 text-slate-300 group-hover:text-blue-500 group-hover:translate-x-0.5 transition shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* ============================================================== */}
          {/* RIGHT MAIN PANEL: Customer Order Document (9 cols)             */}
          {/* ============================================================== */}
          <div className="lg:col-span-9 space-y-4">
            {/* Top Document Header Bar */}
            <div className="rounded-2xl border border-slate-200/90 bg-white dark:border-slate-800 dark:bg-slate-900 p-4 sm:p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="p-3 rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-600/20 shrink-0">
                  <FileText className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                    {tg("cod.title", "Customer Order")}
                  </h1>
                  <p className="text-xs font-semibold text-slate-400 dark:text-slate-400 mt-0.5">
                    {tg("cod.subtitle", "Import, Export and Transit Order Details")}
                  </p>
                </div>
              </div>

              {/* Action Buttons: Print, Download PDF, Edit */}
              <div className="flex items-center gap-2 shrink-0 print:hidden">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 text-xs font-bold shadow-2xs transition cursor-pointer"
                >
                  <Printer className="h-4 w-4 text-slate-500" />
                  <span>{tg("common.print", "Print")}</span>
                </button>

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 text-xs font-bold shadow-2xs transition cursor-pointer"
                >
                  <Download className="h-4 w-4 text-slate-500" />
                  <span>{s.t("download_pdf", "Download PDF")}</span>
                </button>

                <button
                  type="button"
                  onClick={() => router.push(`/dashboard/clearing-agent/customer-order?editId=${encodeURIComponent(data.id)}`)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-600/20 transition cursor-pointer"
                >
                  <Edit className="h-4 w-4" />
                  <span>{tg("common.edit", "Edit")}</span>
                </button>
              </div>
            </div>

            {/* ============================================================ */}
            {/* ROW 1: 3-Col Top Info Boxes (1, 2, 3)                         */}
            {/* ============================================================ */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Box 1: Order Information */}
              <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
                <div className="bg-[#0b5394] px-3.5 py-2 text-white flex items-center gap-2">
                  <span className="w-5 h-5 rounded-md bg-white/20 text-white font-bold text-xs flex items-center justify-center shrink-0">
                    1
                  </span>
                  <span className="font-bold text-xs uppercase tracking-wide">{s.t("box_order_info", "Order Information")}</span>
                </div>
                <div className="p-3 text-[11.5px] divide-y divide-slate-100 dark:divide-slate-800">
                  <div className="py-1.5 flex justify-between gap-2">
                    <span className="text-slate-400 font-semibold">{tg("cod.order_no", "Order No.")}</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">{data.orderNo}</span>
                  </div>
                  <div className="py-1.5 flex justify-between gap-2">
                    <span className="text-slate-400 font-semibold">{tg("cod.order_date", "Order Date")}</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">{data.orderDate}</span>
                  </div>
                  <div className="py-1.5 flex justify-between gap-2">
                    <span className="text-slate-400 font-semibold">{tg("cod.operation_type", "Operation Type")}</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{coMovementLabel(L, data.operationType)}</span>
                  </div>
                  <div className="py-1.5 flex justify-between gap-2">
                    <span className="text-slate-400 font-semibold">{tg("cod.shipment_type", "Shipment Type")}</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{coModeLabel(L, data.shipmentType)}</span>
                  </div>
                  <div className="py-1.5 flex justify-between items-center gap-2">
                    <span className="text-slate-400 font-semibold">{tg("common.status", "Status")}</span>
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500 text-white whitespace-nowrap">
                      {coStatusLabel(L, data.status)}
                    </span>
                  </div>
                  <div className="py-1.5 flex justify-between gap-2">
                    <span className="text-slate-400 font-semibold">{s.t("expected_dispatch", "Expected Dispatch")}</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">{data.expectedDispatch}</span>
                  </div>
                  <div className="py-1.5 flex justify-between gap-2">
                    <span className="text-slate-400 font-semibold">{s.t("expected_delivery", "Expected Delivery")}</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">{data.expectedDelivery}</span>
                  </div>
                  <div className="py-1.5 flex justify-between gap-2">
                    <span className="text-slate-400 font-semibold">{tg("common.branch", "Branch")}</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">{data.branch}</span>
                  </div>
                </div>
              </div>

              {/* Box 2: Customer Details */}
              <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
                <div className="bg-[#0b5394] px-3.5 py-2 text-white flex items-center gap-2">
                  <span className="w-5 h-5 rounded-md bg-white/20 text-white font-bold text-xs flex items-center justify-center shrink-0">
                    2
                  </span>
                  <span className="font-bold text-xs uppercase tracking-wide">{tg("cod.customer_details", "Customer Details")}</span>
                </div>
                <div className="p-3 text-[11.5px] divide-y divide-slate-100 dark:divide-slate-800">
                  <div className="py-1.5 flex justify-between gap-2">
                    <span className="text-slate-400 font-semibold">{tg("cod.customer_name", "Customer Name")}</span>
                    <span className="font-bold text-slate-900 dark:text-white truncate">{data.customerName}</span>
                  </div>
                  <div className="py-1.5 flex justify-between gap-2">
                    <span className="text-slate-400 font-semibold">{tg("cod.account_code", "Account Code")}</span>
                    <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{data.accountCode}</span>
                  </div>
                  <div className="py-1.5 flex justify-between gap-2">
                    <span className="text-slate-400 font-semibold">{tg("cod.contact_person", "Contact Person")}</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200 truncate">{data.contactPerson}</span>
                  </div>
                  <div className="py-1.5 flex justify-between gap-2">
                    <span className="text-slate-400 font-semibold">{tg("common.phone", "Phone")}</span>
                    <span className="font-mono text-slate-800 dark:text-slate-200">{data.phone}</span>
                  </div>
                  <div className="py-1.5 flex justify-between gap-2">
                    <span className="text-slate-400 font-semibold">{tg("common.email", "Email")}</span>
                    <span className="text-blue-600 dark:text-blue-400 truncate">{data.email}</span>
                  </div>
                  <div className="py-1.5 flex justify-between gap-2">
                    <span className="text-slate-400 font-semibold">{tg("common.address", "Address")}</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200 truncate">{data.address}</span>
                  </div>
                  <div className="py-1.5 flex justify-between gap-2">
                    <span className="text-slate-400 font-semibold">{tg("common.country", "Country")}</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">{data.country}</span>
                  </div>
                  <div className="py-1.5 flex justify-between gap-2">
                    <span className="text-slate-400 font-semibold">{tg("cod.customer_type", "Customer Type")}</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{coCustomerTypeLabel(L, data.customerType)}</span>
                  </div>
                </div>
              </div>

              {/* Box 3: Route & Transport Details */}
              <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
                <div className="bg-[#0b5394] px-3.5 py-2 text-white flex items-center gap-2">
                  <span className="w-5 h-5 rounded-md bg-white/20 text-white font-bold text-xs flex items-center justify-center shrink-0">
                    3
                  </span>
                  <span className="font-bold text-xs uppercase tracking-wide">{s.t("box_route", "Route & Transport Details")}</span>
                </div>
                <div className="p-3 text-[11.5px] divide-y divide-slate-100 dark:divide-slate-800">
                  <div className="py-1.5 flex justify-between gap-2">
                    <span className="text-slate-400 font-semibold">{s.t("loading_country", "Loading Country")}</span>
                    <span className="font-bold text-slate-900 dark:text-white truncate">{data.loadingCountry}</span>
                  </div>
                  <div className="py-1.5 flex justify-between gap-2">
                    <span className="text-slate-400 font-semibold">{s.t("loading_location", "Loading Location")}</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200 truncate">{data.loadingLocation}</span>
                  </div>
                  <div className="py-1.5 flex justify-between gap-2">
                    <span className="text-slate-400 font-semibold">{tg("cod.exit_border", "Exit Border")}</span>
                    <span className="font-medium text-blue-600 dark:text-blue-400 truncate">{data.exitBorder}</span>
                  </div>
                  <div className="py-1.5 flex justify-between gap-2">
                    <span className="text-slate-400 font-semibold">{s.t("transit_country", "Transit Country")}</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">{data.transitCountry}</span>
                  </div>
                  <div className="py-1.5 flex justify-between gap-2">
                    <span className="text-slate-400 font-semibold">{s.t("receiving_location", "Receiving Location")}</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200 truncate">{data.receivingLocation}</span>
                  </div>
                  <div className="py-1.5 flex justify-between gap-2">
                    <span className="text-slate-400 font-semibold">{s.t("final_destination", "Final Destination")}</span>
                    <span className="font-bold text-slate-900 dark:text-white truncate">{data.finalDestination}</span>
                  </div>
                  <div className="py-1.5 flex justify-between gap-2">
                    <span className="text-slate-400 font-semibold">{tg("cbill.transport_mode", "Transport Mode")}</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{coModeLabel(L, data.transportMode)}</span>
                  </div>
                  <div className="py-1.5 flex justify-between gap-2">
                    <span className="text-slate-400 font-semibold">{tg("cod.carrier_truck", "Carrier / Truck No.")}</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white truncate">{data.carrierTruckNo}</span>
                  </div>
                  <div className="py-1.5 flex justify-between gap-2">
                    <span className="text-slate-400 font-semibold">{tg("cod.driver_name", "Driver Name")}</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">{data.driverName}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ============================================================ */}
            {/* ROW 2: Goods Details Table (4)                               */}
            {/* ============================================================ */}
            <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
              <div className="bg-[#0b5394] px-3.5 py-2 text-white flex items-center gap-2">
                <span className="w-5 h-5 rounded-md bg-white/20 text-white font-bold text-xs flex items-center justify-center shrink-0">
                  4
                </span>
                <span className="font-bold text-xs uppercase tracking-wide">{tg("cod.goods_details", "Goods Details")}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-start text-xs">
                  <thead className="bg-[#f1f5f9] dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                    <tr>
                      <th className="py-2.5 px-3 w-10 text-center">#</th>
                      <th className="py-2.5 px-3">{tg("cod.col_goods_name", "Goods Name")}</th>
                      <th className="py-2.5 px-3">{tg("cod.col_hs_code", "HS Code")}</th>
                      <th className="py-2.5 px-3">{tg("cod.col_brand", "Brand")}</th>
                      <th className="py-2.5 px-3">{tg("cod.col_size", "Size")}</th>
                      <th className="py-2.5 px-3">{tg("cod.col_unit", "Unit")}</th>
                      <th className="py-2.5 px-3 text-end">{tg("common.quantity", "Quantity")}</th>
                      <th className="py-2.5 px-3 text-end">{tg("cod.col_gross", "Gross Weight")}</th>
                      <th className="py-2.5 px-3 text-end">{tg("cod.col_net", "Net Weight")}</th>
                      <th className="py-2.5 px-3 text-center">{tg("common.remarks", "Remarks")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11.5px]">
                    {data.goods.map((item) => (
                      <tr key={item.serial} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition">
                        <td className="py-2 px-3 text-center font-bold text-slate-400">{item.serial}</td>
                        <td className="py-2 px-3 font-bold text-slate-900 dark:text-white">
                          {item.goodsName || (item.nameFallback ? s.t(`fb_${item.nameFallback}`, item.nameFallback === "general_cargo" ? "General Cargo" : "Commercial Cargo") : "")}
                        </td>
                        <td className="py-2 px-3 font-mono text-slate-600 dark:text-slate-400">{item.hsCode}</td>
                        <td className="py-2 px-3 text-slate-700 dark:text-slate-300">{item.brand || tg("cod.standard", "Standard")}</td>
                        <td className="py-2 px-3 text-slate-700 dark:text-slate-300">{item.size}</td>
                        <td className="py-2 px-3 text-slate-700 dark:text-slate-300">{item.unit}</td>
                        <td className="py-2 px-3 text-end font-mono font-bold text-slate-900 dark:text-white">
                          {Number(item.quantity).toLocaleString()}
                        </td>
                        <td className="py-2 px-3 text-end font-mono text-slate-800 dark:text-slate-200">
                          {Number(item.grossWeight).toLocaleString()}
                        </td>
                        <td className="py-2 px-3 text-end font-mono text-slate-800 dark:text-slate-200">
                          {Number(item.netWeight).toLocaleString()}
                        </td>
                        <td className="py-2 px-3 text-center text-slate-400">{item.remarks}</td>
                      </tr>
                    ))}
                    {/* Total Row */}
                    <tr className="bg-[#f8fafc] dark:bg-slate-850 font-bold border-t-2 border-slate-200 dark:border-slate-700">
                      <td colSpan={6} className="py-2 px-3 text-end font-black uppercase text-slate-700 dark:text-slate-200">
                        {tg("common.total", "Total")}
                      </td>
                      <td className="py-2 px-3 text-end font-mono font-black text-blue-600 dark:text-blue-400">
                        {Number(totals.quantity).toLocaleString()}
                      </td>
                      <td className="py-2 px-3 text-end font-mono font-black text-slate-900 dark:text-white">
                        {Number(totals.grossWeight).toLocaleString()}
                      </td>
                      <td className="py-2 px-3 text-end font-mono font-black text-slate-900 dark:text-white">
                        {Number(totals.netWeight).toLocaleString()}
                      </td>
                      <td className="py-2 px-3 text-center text-slate-400">-</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* ============================================================ */}
            {/* ROW 3: Loading & Receiving Details (5)                        */}
            {/* ============================================================ */}
            <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
              <div className="bg-[#0b5394] px-3.5 py-2 text-white flex items-center gap-2">
                <span className="w-5 h-5 rounded-md bg-white/20 text-white font-bold text-xs flex items-center justify-center shrink-0">
                  5
                </span>
                <span className="font-bold text-xs uppercase tracking-wide">{s.t("box_loading_receiving", "Loading & Receiving Details")}</span>
              </div>
              <div className="p-4 grid grid-cols-1 md:grid-cols-11 gap-3 items-center">
                {/* Left Box: Loading Details (From) (5 cols) */}
                <div className="md:col-span-5 rounded-xl border border-blue-200 dark:border-blue-900/60 overflow-hidden">
                  <div className="bg-[#d9e8fb] dark:bg-blue-950/60 text-blue-900 dark:text-blue-200 px-3.5 py-2 text-xs font-bold flex items-center justify-center gap-2">
                    <span className="text-blue-600">↑</span>
                    <span>{tg("cod.loading_from", "Loading Details (From)")}</span>
                  </div>
                  <div className="p-3 text-[11px] divide-y divide-slate-100 dark:divide-slate-800">
                    <div className="py-1 flex justify-between gap-2">
                      <span className="text-slate-400 font-semibold">{s.t("loading_country", "Loading Country")}</span>
                      <span className="font-bold text-slate-900 dark:text-white">{data.loadingCountry}</span>
                    </div>
                    <div className="py-1 flex justify-between gap-2">
                      <span className="text-slate-400 font-semibold">{s.t("loading_city_location", "Loading City / Location")}</span>
                      <span className="font-medium text-slate-800 dark:text-slate-200">{data.loadingCity}</span>
                    </div>
                    <div className="py-1 flex justify-between gap-2">
                      <span className="text-slate-400 font-semibold">{s.t("loading_date", "Loading Date")}</span>
                      <span className="font-medium text-slate-800 dark:text-slate-200">{data.loadingDate}</span>
                    </div>
                    <div className="py-1 flex justify-between gap-2">
                      <span className="text-slate-400 font-semibold">{tg("cod.exit_border", "Exit Border")}</span>
                      <span className="font-medium text-blue-600 dark:text-blue-400">{data.exitBorder}</span>
                    </div>
                    <div className="py-1 flex justify-between gap-2">
                      <span className="text-slate-400 font-semibold">{tg("cod.customs_clearance", "Customs Clearance")}</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">{coYesNoLabel(L, data.loadingCustomsClearance)}</span>
                    </div>
                    <div className="py-1 flex justify-between gap-2">
                      <span className="text-slate-400 font-semibold">{tg("cod.customs_name", "Customs Name")}</span>
                      <span className="font-medium text-slate-800 dark:text-slate-200">{data.loadingCustomsName || s.t("fb_customs_post", "Customs Clearance Post")}</span>
                    </div>
                    <div className="py-1 flex justify-between gap-2">
                      <span className="text-slate-400 font-semibold">{tg("cod.warehouse_yard", "Warehouse / Yard")}</span>
                      <span className="font-medium text-slate-800 dark:text-slate-200">{data.loadingWarehouse}</span>
                    </div>
                    <div className="py-1 flex justify-between gap-2">
                      <span className="text-slate-400 font-semibold">{tg("common.remarks", "Remarks")}</span>
                      <span className="text-slate-400">{data.loadingRemarks}</span>
                    </div>
                  </div>
                </div>

                {/* Center Transition Arrow (1 col) */}
                <div className="md:col-span-1 flex items-center justify-center py-2">
                  <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-950 flex items-center justify-center text-blue-600 dark:text-blue-400 font-black shadow-xs">
                    {s.isRtl ? "⬅" : "➔"}
                  </div>
                </div>

                {/* Right Box: Receiving Details (To) (5 cols) */}
                <div className="md:col-span-5 rounded-xl border border-emerald-200 dark:border-emerald-900/60 overflow-hidden">
                  <div className="bg-[#dcfce7] dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 px-3.5 py-2 text-xs font-bold flex items-center justify-center gap-2">
                    <span className="text-emerald-600">↓</span>
                    <span>{tg("cod.receiving_to", "Receiving Details (To)")}</span>
                  </div>
                  <div className="p-3 text-[11px] divide-y divide-slate-100 dark:divide-slate-800">
                    <div className="py-1 flex justify-between gap-2">
                      <span className="text-slate-400 font-semibold">{s.t("receiving_country", "Receiving Country")}</span>
                      <span className="font-bold text-slate-900 dark:text-white">{data.receivingCountry}</span>
                    </div>
                    <div className="py-1 flex justify-between gap-2">
                      <span className="text-slate-400 font-semibold">{s.t("receiving_city_port", "Receiving City / Port")}</span>
                      <span className="font-medium text-slate-800 dark:text-slate-200">{data.receivingCityPort}</span>
                    </div>
                    <div className="py-1 flex justify-between gap-2">
                      <span className="text-slate-400 font-semibold">{s.t("receiving_date_eta", "Receiving Date (ETA)")}</span>
                      <span className="font-medium text-slate-800 dark:text-slate-200">{data.receivingDateEta}</span>
                    </div>
                    <div className="py-1 flex justify-between gap-2">
                      <span className="text-slate-400 font-semibold">{tg("cod.entry_border", "Entry Border")}</span>
                      <span className="font-medium text-emerald-600 dark:text-emerald-400">{data.entryBorder}</span>
                    </div>
                    <div className="py-1 flex justify-between gap-2">
                      <span className="text-slate-400 font-semibold">{tg("cod.customs_clearance", "Customs Clearance")}</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">{coYesNoLabel(L, data.receivingCustomsClearance)}</span>
                    </div>
                    <div className="py-1 flex justify-between gap-2">
                      <span className="text-slate-400 font-semibold">{tg("cod.customs_name", "Customs Name")}</span>
                      <span className="font-medium text-slate-800 dark:text-slate-200">{data.receivingCustomsName || s.t("fb_dest_customs", "Destination Port Customs")}</span>
                    </div>
                    <div className="py-1 flex justify-between gap-2">
                      <span className="text-slate-400 font-semibold">{tg("cod.warehouse_yard", "Warehouse / Yard")}</span>
                      <span className="font-medium text-slate-800 dark:text-slate-200">{data.receivingWarehouse}</span>
                    </div>
                    <div className="py-1 flex justify-between gap-2">
                      <span className="text-slate-400 font-semibold">{tg("common.remarks", "Remarks")}</span>
                      <span className="text-slate-400">{data.receivingRemarks}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ============================================================ */}
            {/* ROW 4: Transfer History (6)                                  */}
            {/* ============================================================ */}
            <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
              <div className="bg-[#0b5394] px-3.5 py-2 text-white flex items-center gap-2">
                <span className="w-5 h-5 rounded-md bg-white/20 text-white font-bold text-xs flex items-center justify-center shrink-0">
                  6
                </span>
                <span className="font-bold text-xs uppercase tracking-wide">
                  {s.t("box_history", "Transfer History (This Customer Order has been transferred to the following bills)")}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-start text-xs">
                  <thead className="bg-[#f1f5f9] dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                    <tr>
                      <th className="py-2.5 px-3 w-10 text-center">#</th>
                      <th className="py-2.5 px-3 w-36">{tg("cod.date_time", "Date & Time")}</th>
                      <th className="py-2.5 px-3 w-48">{s.t("col_transferred_to", "Transferred To")}</th>
                      <th className="py-2.5 px-3 w-36">{tg("cod.bill_no", "Bill No.")}</th>
                      <th className="py-2.5 px-3">{s.t("col_message", "Message")}</th>
                      <th className="py-2.5 px-3 w-28 text-center">{tg("common.status", "Status")}</th>
                      <th className="py-2.5 px-3 w-32">{s.t("col_posted_by", "Posted By")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11.5px]">
                    {data.transfers.map((item) => {
                      const cardDef = TRANSFER_SIDEBAR_CARDS.find((c) => c.key === item.transferredToKey) || TRANSFER_SIDEBAR_CARDS[0];
                      const IconComponent = cardDef.icon;
                      return (
                        <tr key={item.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition">
                          <td className="py-2.5 px-3 text-center font-bold text-slate-400">{item.serial}</td>
                          <td className="py-2.5 px-3 font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                            {item.dateTime}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border ${cardDef.colorClass}`}>
                              <IconComponent className="h-3.5 w-3.5" />
                              <span>{cardTitle(cardDef)}</span>
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                            {item.billNo}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className={`p-2 rounded-xl text-[11px] leading-relaxed border border-slate-200/40 dark:border-slate-800/40 ${cardDef.messageBg}`}>
                              {item.message || defaultMessage(cardDef)}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                item.status === "Completed"
                                  ? "bg-emerald-500 text-white"
                                  : "bg-blue-500 text-white"
                              }`}
                            >
                              {coStatusLabel(L, item.status)}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                            {item.postedBy}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* TRANSFER MODAL DIALOG                                          */}
      {/* ============================================================== */}
      {modalOpen && selectedTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-xl border ${selectedTarget.colorClass}`}>
                  <selectedTarget.icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-slate-900 dark:text-white">
                    {s.t("modal_title", "Transfer Customer Order")}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {s.t("destination", "Destination")}: {cardTitle(selectedTarget)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">
                  {s.t("lbl_bill_ref", "Generated Bill / Reference No.")}
                </label>
                <input
                  type="text"
                  value={billNoInput}
                  onChange={(e) => setBillNoInput(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 font-mono font-bold text-blue-600 focus:bg-white focus:outline-hidden dark:border-slate-800 dark:bg-slate-800 dark:text-blue-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">
                  {s.t("lbl_narration", "Transfer Narration / Instructions")}
                </label>
                <textarea
                  rows={3}
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs text-slate-900 focus:bg-white focus:outline-hidden dark:border-slate-800 dark:bg-slate-800 dark:text-white resize-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">
                  {s.t("lbl_posted_by", "Posted / Assigned By")}
                </label>
                <input
                  type="text"
                  value={postedByInput}
                  onChange={(e) => setPostedByInput(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 font-semibold text-slate-900 focus:bg-white focus:outline-hidden dark:border-slate-800 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <label className="flex items-center gap-2 pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={navigateAfterTransfer}
                  onChange={(e) => setNavigateAfterTransfer(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
                <span className="text-[11.5px] font-semibold text-slate-700 dark:text-slate-300">
                  {coFill(s.t("open_after", "Open {title} page immediately after recording"), { title: cardTitle(selectedTarget) })}
                </span>
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
              >
                {tg("common.cancel", "Cancel")}
              </button>
              <button
                type="button"
                onClick={handleConfirmTransfer}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-600/20 transition cursor-pointer"
              >
                {s.t("confirm_record", "Confirm & Record Transfer")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
