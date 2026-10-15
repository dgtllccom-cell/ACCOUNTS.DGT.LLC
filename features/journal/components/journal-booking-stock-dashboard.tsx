"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Th } from "@/components/ui/translated-th";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { ErpDatePicker } from "@/components/ui/erp-date-picker";
import { SimpleModal } from "@/components/ui/simple-modal";
import { t } from "@/lib/i18n/ui";
import { openScopedGenericReport } from "@/lib/reports/open-scoped-report";
import {
  FileText, Package, Scale, Gauge, Container, MessageSquare,
  Search, ChevronDown, ChevronUp, Download, Upload, Printer,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  Globe, Building2, MapPin, Loader2, RefreshCw, Filter,
  ArrowRight, CheckCircle2, Clock, Truck, ShieldCheck,
  Boxes, Ship, ShoppingBag, ArrowLeftRight, CheckCircle,
  AlertCircle, History, ExternalLink, Info
} from "lucide-react";

/* ─────────────────────────────────────────────
   Types
───────────────────────────────────────────── */
export type StockStage = "all" | "journal" | "loading" | "confirmed" | "warehouse" | "export" | "local_sales" | "transfer" | "history";

export interface UnifiedStockRow {
  id: string;
  sourceId: string;
  sourceType: "purchase_booking" | "local_purchase";
  sourceLabel: string;
  billNumber: string;
  systemBillNumber: string;
  manualBillNumber: string;
  date: string;
  countryName: string;
  countryCode: string;
  branchName: string;
  branchCode: string;
  countryId: string | null;
  countryBranchId: string | null;
  cityBranchId: string | null;
  supplierName: string;
  purchaseAccount: string;
  productName: string;
  brand: string;
  size: string;
  unit: string;
  bookedQuantity: number;
  loadedQuantity: number;
  transferredQuantity: number;
  availableQuantity: number;
  currentStage: "journal" | "loading" | "warehouse" | "export" | "local_sales" | "confirmed";
  stageLabel: string;
  currentLocation: string;
  truckOrContainer: string;
  loadingRecordId: string | null;
  loadingRecordNo: string | null;
  loadingDate: string | null;
  destinationType: "warehouse" | "export" | "local_sales" | null;
  warehouseId: string | null;
  warehouseName: string | null;
  confirmationStatus?: string;
  isConfirmed?: boolean;
  verifiedAt?: string | null;
  verifiedBy?: string | null;
  transferNo?: string;
  transferDate?: string;
  referenceNo?: string;
  remarks: string | null;
  canTransfer: boolean;
  loadings?: Array<{
    id: string;
    loadingRecordNo?: string;
    containerNumber?: string;
    loadedQuantity: number;
    loadingDate?: string;
    driverName?: string;
    warehouseName?: string;
    status?: string;
  }>;
}

export interface Summary {
  totalBookedStock: number;
  journalStock: number;
  loadingStock: number;
  confirmedStock?: number;
  warehouseStock: number;
  exportStock: number;
  localSalesStock: number;
  totalActivePipeline: number;
  totalBills: number;
  totalWarehouses: number;
}

export interface WarehouseOption {
  id: string;
  warehouse_name: string;
  warehouse_code: string;
  warehouse_type?: string;
}

export interface Pagination {
  page: number;
  limit: number;
  totalRecords: number;
  totalPages: number;
}

export interface ApiResponse {
  rows: UnifiedStockRow[];
  summary: Summary;
  warehouses: WarehouseOption[];
  pagination: Pagination;
}

/* ─────────────────────────────────────────────
   Helpers
───────────────────────────────────────────── */
function fmtNum(n: number | string | undefined | null, decimals = 0) {
  const val = typeof n === "number" ? n : Number(n || 0);
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(val || 0);
}

function fmtDate(d: string | null | undefined) {
  if (!d) return "-";
  try {
    return new Date(d).toLocaleDateString("en-GB", {
      day: "2-digit", month: "2-digit", year: "numeric"
    });
  } catch {
    return d;
  }
}

/* ─────────────────────────────────────────────
   Summary Metric Card
───────────────────────────────────────────── */
function SummaryCard({
  icon: Icon,
  label,
  value,
  subLabel,
  iconColor,
  active = false,
  onClick
}: {
  icon: React.ComponentType<any>;
  label: string;
  value: string | number;
  subLabel?: string;
  iconColor: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3.5 rounded-xl border p-4 shadow-xs transition-all cursor-pointer select-none ${
        active
          ? "bg-blue-50/90 border-blue-500 shadow-sm dark:bg-blue-950/40 dark:border-blue-500 ring-2 ring-blue-500/20"
          : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-xs"
      }`}
    >
      <div className={`flex-shrink-0 w-11 h-11 rounded-lg flex items-center justify-center text-white shadow-xs ${iconColor}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">{label}</p>
        <p className="text-xl font-black mt-0.5 tabular-nums text-slate-900 dark:text-slate-100">{value}</p>
        {subLabel && <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 truncate mt-0.5">{subLabel}</p>}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Stage Badge Helper
───────────────────────────────────────────── */
function StageBadge({ stage }: { stage: UnifiedStockRow["currentStage"] }) {
  switch (stage) {
    case "journal":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-800 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800">
          <FileText className="w-2.5 h-2.5" />
          Journal Stock (Purchase Entry)
        </span>
      );
    case "loading":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800">
          <Truck className="w-2.5 h-2.5" />
          Loading Stock (Truck / Container)
        </span>
      );
    case "warehouse":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-900 border border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800">
          <Boxes className="w-2.5 h-2.5" />
          Warehouse Stock
        </span>
      );
    case "export":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-100 text-purple-900 border border-purple-300 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800">
          <Ship className="w-2.5 h-2.5" />
          Export Stock
        </span>
      );
    case "local_sales":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-teal-100 text-teal-900 border border-teal-300 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800">
          <ShoppingBag className="w-2.5 h-2.5" />
          Local Market Stock
        </span>
      );
    case "confirmed":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-900 border border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800">
          <ShieldCheck className="w-2.5 h-2.5" />
          Confirmed Stock (Verified)
        </span>
      );
    default:
      return null;
  }
}

/* ─────────────────────────────────────────────
   Main Component
───────────────────────────────────────────── */
export function JournalBookingStockDashboard({
  session,
  initialStage = "all"
}: {
  session: any;
  initialStage?: StockStage;
}) {
  const lang = useActiveLanguage();

  // ── Data State ──
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // ── Filters & Tabs ──
  const [stageTab, setStageTab] = useState<StockStage>(initialStage);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [goodsName, setGoodsName] = useState("");
  const [purchaseOrderNo, setPurchaseOrderNo] = useState("");
  const [containerNo, setContainerNo] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [countryId, setCountryId] = useState("");
  const [countryBranchId, setCountryBranchId] = useState("");

  // ── Locations & Warehouses ──
  const [countries, setCountries] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);

  // ── Pagination & Expansion ──
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  // ── Modals State ──
  const [transferModalRow, setTransferModalRow] = useState<UnifiedStockRow | null>(null);
  const [transferDestination, setTransferDestination] = useState<"warehouse" | "export" | "local_sales">("warehouse");
  const [transferWarehouseId, setTransferWarehouseId] = useState("");
  const [transferQty, setTransferQty] = useState<string>("");
  const [transferReference, setTransferReference] = useState("");
  const [transferDate, setTransferDate] = useState(new Date().toISOString().slice(0, 10));
  const [transferRemarks, setTransferRemarks] = useState("");
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);

  // ── History Modal State ──
  const [historyModalRow, setHistoryModalRow] = useState<UnifiedStockRow | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyData, setHistoryData] = useState<any | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  // ── Load location dropdowns ──
  useEffect(() => {
    async function loadLocations() {
      try {
        const [cRes, bRes] = await Promise.all([
          fetch("/api/branch-management/countries"),
          fetch("/api/branch-management/city-branches?limit=500")
        ]);
        if (cRes.ok && bRes.ok) {
          const cData = await cRes.json();
          const bData = await bRes.json();
          setCountries(cData.countries ?? []);
          setBranches(bData.cityBranches ?? []);
        }
      } catch { /* silent */ }
    }
    loadLocations();
  }, []);

  // ── Fetch unified stock data ──
  const fetchData = useCallback(async (pg = 1, currentStage = stageTab) => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("stage", currentStage);
      if (searchQuery) params.set("search", searchQuery);
      if (goodsName) params.set("goodsName", goodsName);
      if (purchaseOrderNo) params.set("purchaseOrderNo", purchaseOrderNo);
      if (containerNo) params.set("containerNo", containerNo);
      if (warehouseId) params.set("warehouseId", warehouseId);
      if (countryId) params.set("countryId", countryId);
      if (countryBranchId) params.set("countryBranchId", countryBranchId);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      params.set("page", String(pg));
      params.set("limit", String(limit));

      const res = await fetch(`/api/erp/inventory/journal-stock?${params.toString()}`, {
        signal: abortRef.current.signal,
        credentials: "include"
      });
      const body = await res.json();
      if (!res.ok || !body?.ok) {
        throw new Error(body?.error?.message ?? "Failed to load stock data");
      }
      setData(body.data as ApiResponse);
      setPage(pg);
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setError(err.message ?? "Error fetching stock information");
      }
    } finally {
      setLoading(false);
    }
  }, [stageTab, searchQuery, goodsName, purchaseOrderNo, containerNo, warehouseId, countryId, countryBranchId, dateFrom, dateTo, limit]);

  useEffect(() => {
    fetchData(1, stageTab);
  }, [stageTab, countryId, countryBranchId, warehouseId, fetchData]);

  const handleResetFilters = () => {
    setSearchQuery("");
    setGoodsName("");
    setPurchaseOrderNo("");
    setContainerNo("");
    setWarehouseId("");
    setDateFrom("");
    setDateTo("");
    setCountryId("");
    setCountryBranchId("");
    setStageTab("all");
  };

  // ── Open Transfer Modal ──
  const handleOpenTransfer = (row: UnifiedStockRow) => {
    setTransferModalRow(row);
    setTransferDestination("warehouse");
    setTransferWarehouseId(data?.warehouses?.[0]?.id || "");
    setTransferQty(String(row.availableQuantity || 0));
    setTransferReference(`TRF-${row.billNumber}`);
    setTransferDate(new Date().toISOString().slice(0, 10));
    setTransferRemarks("");
    setTransferError(null);
  };

  // ── Submit Stock Transfer ──
  const handleSubmitTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferModalRow) return;

    const qty = Number(transferQty);
    if (!qty || qty <= 0) {
      setTransferError("Please enter a valid positive transfer quantity.");
      return;
    }

    if (qty > transferModalRow.availableQuantity + 0.001) {
      setTransferError(`Transfer quantity (${qty}) exceeds available loading stock balance (${transferModalRow.availableQuantity}).`);
      return;
    }

    if (transferDestination === "warehouse" && !transferWarehouseId) {
      setTransferError("Please select a destination warehouse.");
      return;
    }

    setTransferLoading(true);
    setTransferError(null);

    try {
      const payload = {
        sourceType: transferModalRow.sourceType,
        purchaseOrderId: transferModalRow.sourceType === "purchase_booking" ? transferModalRow.sourceId : undefined,
        localPurchaseId: transferModalRow.sourceType === "local_purchase" ? transferModalRow.sourceId : undefined,
        loadingRecordId: transferModalRow.loadingRecordId || undefined,
        goodsName: transferModalRow.productName,
        unit: transferModalRow.unit || "KG",
        quantity: qty,
        destinationType: transferDestination,
        warehouseId: transferDestination === "warehouse" ? transferWarehouseId : undefined,
        referenceNo: transferReference || undefined,
        transferDate: transferDate || undefined,
        remarks: transferRemarks || undefined
      };

      const res = await fetch("/api/erp/inventory/journal-stock/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error?.message || "Failed to process stock transfer.");
      }

      setTransferModalRow(null);
      setSuccessBanner(`Stock Transfer ${json.data.transferNo} completed successfully! ${qty} ${transferModalRow.unit} transferred to ${json.data.destinationType.toUpperCase()}.`);
      setTimeout(() => setSuccessBanner(null), 6000);
      fetchData(page);
    } catch (err: any) {
      setTransferError(err.message || "An unexpected error occurred during transfer.");
    } finally {
      setTransferLoading(false);
    }
  };

  // ── Open History Modal ──
  const handleOpenHistory = async (row: UnifiedStockRow) => {
    setHistoryModalRow(row);
    setHistoryLoading(true);
    setHistoryData(null);

    try {
      const params = new URLSearchParams({
        sourceType: row.sourceType,
        sourceId: row.sourceId
      });
      if (row.loadingRecordId) params.set("loadingRecordId", row.loadingRecordId);

      const res = await fetch(`/api/erp/inventory/journal-stock/history?${params.toString()}`);
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error?.message || "Failed to fetch stock history.");
      setHistoryData(json.data);
    } catch (err: any) {
      console.error("Error loading movement history:", err);
    } finally {
      setHistoryLoading(false);
    }
  };

  // ── Export CSV ──
  const handleExportCSV = () => {
    const rowsToExport = data?.rows || [];
    if (rowsToExport.length === 0) return;

    const headers = [
      "Sr.#", "Date", "Stage", "Bill Number", "Product Name", "Unit",
      "Booked Qty", "Loaded Qty", "Transferred Qty", "Available Balance",
      "Current Location", "Truck/Container", "Supplier", "Country", "Branch", "Warehouse"
    ];

    const csvRows = rowsToExport.map((r, i) => [
      i + 1,
      fmtDate(r.date),
      r.stageLabel,
      `"${r.billNumber.replace(/"/g, '""')}"`,
      `"${r.productName.replace(/"/g, '""')}"`,
      r.unit,
      r.bookedQuantity,
      r.loadedQuantity,
      r.transferredQuantity,
      r.availableQuantity,
      `"${(r.currentLocation || "").replace(/"/g, '""')}"`,
      `"${(r.truckOrContainer || "").replace(/"/g, '""')}"`,
      `"${(r.supplierName || "").replace(/"/g, '""')}"`,
      `"${(r.countryName || "").replace(/"/g, '""')}"`,
      `"${(r.branchName || "").replace(/"/g, '""')}"`,
      `"${(r.warehouseName || "-").replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers.join(","), ...csvRows.map(row => row.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `journal_stock_${stageTab}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ── Scoped Report / Universal Print ──
  const handlePrint = async () => {
    if (!data?.rows) return;

    await openScopedGenericReport({
      title: "Journal Stock & Stock Transfer Register",
      subtitle: `Stage: ${stageTab.toUpperCase()} | Live Dynamic ERP Inventory Traceability`,
      orientation: "landscape",
      columns: [
        { key: "index", label: "Sr.#", align: "center" },
        { key: "dateFormatted", label: "Date", align: "center" },
        { key: "billNumber", label: "Bill / Ref #" },
        { key: "stageLabel", label: "Stage" },
        { key: "productName", label: "Product" },
        { key: "unit", label: "Unit", align: "center" },
        { key: "bookedQuantity", label: "Booked Qty", align: "right", format: "number" },
        { key: "loadedQuantity", label: "Loaded Qty", align: "right", format: "number" },
        { key: "transferredQuantity", label: "Transferred", align: "right", format: "number" },
        { key: "availableQuantity", label: "Available Balance", align: "right", format: "number" },
        { key: "currentLocation", label: "Location / Truck / WH" },
        { key: "countryName", label: "Country" },
        { key: "supplierName", label: "Supplier" }
      ],
      rows: data.rows.map((r, i) => ({
        ...r,
        index: i + 1,
        dateFormatted: fmtDate(r.date)
      })),
      summary: {
        "Total Booked Stock": fmtNum(data.summary?.totalBookedStock) + " KG",
        "Journal Stock": fmtNum(data.summary?.journalStock) + " KG",
        "Loading Stock": fmtNum(data.summary?.loadingStock) + " KG",
        "Warehouse Stock": fmtNum(data.summary?.warehouseStock) + " KG",
        "Export Stock": fmtNum(data.summary?.exportStock) + " KG",
        "Local Sales Stock": fmtNum(data.summary?.localSalesStock) + " KG"
      }
    });
  };

  const rows = data?.rows || [];
  const summary = data?.summary || {
    totalBookedStock: 0,
    journalStock: 0,
    loadingStock: 0,
    warehouseStock: 0,
    exportStock: 0,
    localSalesStock: 0,
    totalActivePipeline: 0,
    totalBills: 0,
    totalWarehouses: 0
  };
  const warehouses = data?.warehouses || [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-5 p-3 sm:p-6 max-w-[1920px] mx-auto min-h-screen">
      {/* ── Page Header & Quick Controls ── */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-[#0d2d6b] text-white shadow-xs">
                <Boxes className="w-6 h-6" />
              </span>
              <div>
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100">
                  {t(lang, "jr.jbsd_title", "Journal Stock & Stock Transfer Management")}
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Unified Inventory Pipeline: Purchase Booking & Local Purchase → Loading Stock (Truck / Container) → Warehouse, Export, or Local Sales Stock
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => fetchData(page)}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
              title="Refresh Stock Data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-blue-600" : ""}`} />
              <span>{t(lang, "common.refresh", "Refresh")}</span>
            </button>

            <button
              type="button"
              onClick={() => setFiltersOpen(!filtersOpen)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition ${
                filtersOpen || searchQuery || goodsName || purchaseOrderNo || containerNo || warehouseId
                  ? "bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-300"
                  : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50"
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>{t(lang, "common.filter", "Filters")}</span>
              {(searchQuery || goodsName || purchaseOrderNo || containerNo || warehouseId) && (
                <span className="w-2 h-2 rounded-full bg-blue-600"></span>
              )}
            </button>

            <button
              type="button"
              onClick={handleExportCSV}
              disabled={rows.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>Export CSV</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              disabled={rows.length === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0d2d6b] hover:bg-blue-900 text-white text-xs font-bold shadow-xs transition disabled:opacity-50"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{t(lang, "common.print", "Print / PDF")}</span>
            </button>
          </div>
        </div>

        {/* ── Success Toast Banner ── */}
        {successBanner && (
          <div className="mt-4 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 flex items-center justify-between animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-2.5 text-xs font-bold text-emerald-800 dark:text-emerald-300">
              <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>{successBanner}</span>
            </div>
            <button onClick={() => setSuccessBanner(null)} className="text-emerald-700 hover:text-emerald-900 text-xs font-bold">×</button>
          </div>
        )}

        {/* ── Filter Accordion / Drawer ── */}
        {filtersOpen && (
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700/60 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 animate-in fade-in duration-200">
            <div>
              <label className="text-[10.5px] font-bold uppercase text-slate-500 dark:text-slate-400 block mb-1">Search Anything</label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Bill, Product, Truck..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && fetchData(1)}
                  className="w-full text-xs pl-8 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="text-[10.5px] font-bold uppercase text-slate-500 dark:text-slate-400 block mb-1">Product / Commodity</label>
              <input
                type="text"
                placeholder="Filter by product..."
                value={goodsName}
                onChange={(e) => setGoodsName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchData(1)}
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="text-[10.5px] font-bold uppercase text-slate-500 dark:text-slate-400 block mb-1">Purchase / Bill No</label>
              <input
                type="text"
                placeholder="PO-xxxx or LP-xxxx"
                value={purchaseOrderNo}
                onChange={(e) => setPurchaseOrderNo(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchData(1)}
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="text-[10.5px] font-bold uppercase text-slate-500 dark:text-slate-400 block mb-1">Truck / Container</label>
              <input
                type="text"
                placeholder="Container or Truck #"
                value={containerNo}
                onChange={(e) => setContainerNo(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchData(1)}
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="text-[10.5px] font-bold uppercase text-slate-500 dark:text-slate-400 block mb-1">Warehouse Filter</label>
              <select
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Warehouses</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>{w.warehouse_name} ({w.warehouse_code})</option>
                ))}
              </select>
            </div>

            <div className="flex items-end gap-2">
              <button
                type="button"
                onClick={() => fetchData(1)}
                className="flex-1 px-3 py-2 bg-[#0d2d6b] hover:bg-blue-900 text-white rounded-lg text-xs font-bold shadow-xs transition"
              >
                Apply Filters
              </button>
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-3 py-2 border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold transition"
              >
                Reset
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Unified Stage Summary Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7 gap-3">
        <SummaryCard
          icon={Package}
          label="Total Booked"
          value={`${fmtNum(summary.totalBookedStock)}`}
          subLabel={`${summary.totalBills} Purchase Bills`}
          iconColor="bg-slate-700"
          active={stageTab === "all"}
          onClick={() => setStageTab("all")}
        />

        <SummaryCard
          icon={FileText}
          label="1. Journal Stock"
          value={`${fmtNum(summary.journalStock)}`}
          subLabel="Purchase Entry"
          iconColor="bg-blue-600"
          active={stageTab === "journal"}
          onClick={() => setStageTab("journal")}
        />

        <SummaryCard
          icon={Truck}
          label="2. Loading Stock"
          value={`${fmtNum(summary.loadingStock)}`}
          subLabel="Truck / Container"
          iconColor="bg-amber-600"
          active={stageTab === "loading"}
          onClick={() => setStageTab("loading")}
        />

        <SummaryCard
          icon={ShieldCheck}
          label="3. Confirmed Stock"
          value={`${fmtNum(summary.confirmedStock ?? summary.loadingStock)}`}
          subLabel="Verified / Inspection"
          iconColor="bg-emerald-600"
          active={stageTab === "confirmed"}
          onClick={() => setStageTab("confirmed")}
        />

        <SummaryCard
          icon={Boxes}
          label="4. Warehouse Stock"
          value={`${fmtNum(summary.warehouseStock)}`}
          subLabel="In Warehouses"
          iconColor="bg-indigo-600"
          active={stageTab === "warehouse"}
          onClick={() => setStageTab("warehouse")}
        />

        <SummaryCard
          icon={Ship}
          label="5. Export Stock"
          value={`${fmtNum(summary.exportStock)}`}
          subLabel="Re-export / Dock"
          iconColor="bg-purple-600"
          active={stageTab === "export"}
          onClick={() => setStageTab("export")}
        />

        <SummaryCard
          icon={ShoppingBag}
          label="6. Local Market"
          value={`${fmtNum(summary.localSalesStock)}`}
          subLabel="Local Market Sales"
          iconColor="bg-teal-600"
          active={stageTab === "local_sales"}
          onClick={() => setStageTab("local_sales")}
        />
      </div>

      {/* ── Stage Filter Tabs ── */}
      <div className="flex border-b border-slate-200 dark:border-slate-700 gap-1 overflow-x-auto pb-1">
        {[
          { key: "all", label: "All Stock Pipeline", count: summary.totalBookedStock, icon: Package },
          { key: "journal", label: "Journal Stock (Purchase Entry)", count: summary.journalStock, icon: FileText },
          { key: "loading", label: "Loading Stock (Trucks / Containers)", count: summary.loadingStock, icon: Truck },
          { key: "confirmed", label: "Confirmed Stock (Verification Stage)", count: summary.confirmedStock ?? summary.loadingStock, icon: ShieldCheck },
          { key: "warehouse", label: "Warehouse Stock", count: summary.warehouseStock, icon: Boxes },
          { key: "export", label: "Export Stock", count: summary.exportStock, icon: Ship },
          { key: "local_sales", label: "Local Market Stock", count: summary.localSalesStock, icon: ShoppingBag },
          { key: "transfer", label: "Stock Transfer", count: summary.loadingStock, icon: ArrowLeftRight },
          { key: "history", label: "Stock Movement History", count: rows.length, icon: History }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = stageTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setStageTab(tab.key as StockStage)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                isActive
                  ? "bg-[#0d2d6b] text-white shadow-xs"
                  : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-black ${
                isActive ? "bg-white/20 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400"
              }`}>
                {fmtNum(tab.count)}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Main Stock Register Table Card ── */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden">
        {/* Table Top Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 border-b border-slate-100 dark:border-slate-700/60 gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-[#0d2d6b] dark:text-blue-400">
              {stageTab === "all" ? "Complete Stock Movement Register" : `${stageTab.toUpperCase()} Stock View`}
            </span>
            <span className="text-[11px] text-slate-400 font-medium">• Zero Roznamcha / Accounting postings on physical movement</span>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
            ) : error ? (
              <span className="text-red-500 text-xs font-semibold">{error}</span>
            ) : (
              <span className="font-semibold">
                Total Records: <strong className="text-slate-800 dark:text-slate-200">{pagination?.totalRecords ?? 0}</strong>
              </span>
            )}
            {!loading && pagination && pagination.totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button onClick={() => fetchData(1)} disabled={page === 1} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30"><ChevronsLeft className="w-4 h-4" /></button>
                <button onClick={() => fetchData(page - 1)} disabled={page === 1} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
                {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                  const start = Math.max(1, Math.min(page - 2, pagination.totalPages - 4));
                  const pg = start + i;
                  return (
                    <button
                      key={pg}
                      onClick={() => fetchData(pg)}
                      className={`w-7 h-7 rounded text-xs font-bold transition-all ${
                        pg === page ? "bg-[#0d2d6b] text-white" : "hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
                      }`}
                    >
                      {pg}
                    </button>
                  );
                })}
                <button onClick={() => fetchData(page + 1)} disabled={page === pagination.totalPages} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
                <button onClick={() => fetchData(pagination.totalPages)} disabled={page === pagination.totalPages} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30"><ChevronsRight className="w-4 h-4" /></button>
              </div>
            )}
          </div>
        </div>

        {/* Responsive Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[1400px]">
            <thead>
              <tr className="bg-[#0d2d6b] text-white">
                <Th className="px-3 py-3 text-center font-bold text-[10.5px] uppercase tracking-wide w-[45px]">Sr.#</Th>
                <Th className="px-3 py-3 text-left font-bold text-[10.5px] uppercase tracking-wide w-[85px]">Date</Th>
                <Th className="px-3 py-3 text-left font-bold text-[10.5px] uppercase tracking-wide w-[180px]">Stage & Status</Th>
                <Th className="px-3 py-3 text-left font-bold text-[10.5px] uppercase tracking-wide w-[160px]">Purchase / Bill Ref</Th>
                <Th className="px-3 py-3 text-left font-bold text-[10.5px] uppercase tracking-wide w-[160px]">Product / Commodity</Th>
                <Th className="px-3 py-3 text-center font-bold text-[10.5px] uppercase tracking-wide w-[55px]">Unit</Th>
                <Th className="px-3 py-3 text-right font-bold text-[10.5px] uppercase tracking-wide w-[90px]">Booked Qty</Th>
                <Th className="px-3 py-3 text-right font-bold text-[10.5px] uppercase tracking-wide w-[90px]">Loaded Qty</Th>
                <Th className="px-3 py-3 text-right font-bold text-[10.5px] uppercase tracking-wide w-[95px]">Transferred</Th>
                <Th className="px-3 py-3 text-right font-bold text-[10.5px] uppercase tracking-wide w-[120px]">Available Balance</Th>
                <Th className="px-3 py-3 text-left font-bold text-[10.5px] uppercase tracking-wide w-[170px]">Location / Truck / WH</Th>
                <Th className="px-3 py-3 text-left font-bold text-[10.5px] uppercase tracking-wide w-[140px]">Country & Branch</Th>
                <Th className="px-3 py-3 text-left font-bold text-[10.5px] uppercase tracking-wide w-[150px]">Supplier / Account</Th>
                <Th className="px-3 py-3 text-center font-bold text-[10.5px] uppercase tracking-wide w-[140px]">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className={i % 2 === 0 ? "bg-white dark:bg-slate-800" : "bg-blue-50/40 dark:bg-slate-700/30"}>
                    {Array.from({ length: 14 }).map((_, j) => (
                      <td key={j} className="px-3 py-3">
                        <div className="h-3.5 bg-slate-100 dark:bg-slate-700 rounded animate-pulse" style={{ width: j === 3 ? "80%" : "65%" }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : error ? (
                <tr>
                  <td colSpan={14} className="px-6 py-16 text-center text-slate-400 dark:text-slate-500">
                    <div className="flex flex-col items-center gap-3">
                      <AlertCircle className="w-10 h-10 text-red-500 opacity-60" />
                      <span className="text-sm font-semibold text-red-500">{error}</span>
                      <button onClick={() => fetchData(1)} className="text-xs text-blue-600 hover:underline">Try Again</button>
                    </div>
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={14} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center gap-3 text-slate-400 dark:text-slate-500">
                      <Package className="w-10 h-10 opacity-30" />
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-300">No Stock Records Found</p>
                      <p className="text-xs text-slate-500">There are no records matching the selected stage and filter criteria.</p>
                      <button onClick={handleResetFilters} className="text-xs text-blue-600 hover:underline">Reset Filters</button>
                    </div>
                  </td>
                </tr>
              ) : (
                rows.map((row, idx) => {
                  const globalIdx = (page - 1) * limit + idx + 1;
                  const isEven = idx % 2 === 1;
                  const isExpanded = expandedRowId === row.id;

                  return (
                    <React.Fragment key={row.id}>
                      <tr className={`border-b border-slate-100 dark:border-slate-700/50 transition-colors hover:bg-blue-50/70 dark:hover:bg-blue-950/20 ${
                        isEven ? "bg-[#f8faff] dark:bg-slate-800/60" : "bg-white dark:bg-slate-800"
                      }`}>
                        <td className="px-3 py-2.5 text-center font-bold text-slate-400">{globalIdx}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap font-medium text-slate-600 dark:text-slate-300">{fmtDate(row.date)}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <StageBadge stage={row.currentStage} />
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedRowId(isExpanded ? null : row.id);
                              }}
                              className={`w-5 h-5 rounded flex items-center justify-center font-black text-xs transition-all cursor-pointer shadow-2xs ${
                                isExpanded
                                  ? "bg-slate-700 text-white dark:bg-slate-300 dark:text-slate-900"
                                  : "bg-blue-600 text-white hover:bg-blue-700 ring-2 ring-blue-400/30"
                              }`}
                              title={isExpanded ? "Collapse Breakdown" : "Click to view Initial Booking vs Loading Breakdown (+)"}
                            >
                              {isExpanded ? "−" : "+"}
                            </button>
                            <div className="font-mono font-black text-[#0d2d6b] dark:text-blue-400 truncate" title={row.billNumber}>
                              {row.billNumber}
                            </div>
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">{row.sourceLabel}</div>
                        </td>
                        <td className="px-3 py-2.5 font-bold text-slate-900 dark:text-slate-100">
                          <div className="truncate max-w-[160px]" title={row.productName}>{row.productName}</div>
                          {(row.brand !== "-" || row.size !== "-") && (
                            <div className="text-[10px] text-slate-400 font-normal">{row.brand} • {row.size}</div>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-center font-semibold text-slate-600 dark:text-slate-300">{row.unit}</td>
                        <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-600 dark:text-slate-300">{fmtNum(row.bookedQuantity)}</td>
                        <td className="px-3 py-2.5 text-right font-mono font-bold text-amber-600 dark:text-amber-400">{fmtNum(row.loadedQuantity)}</td>
                        <td className="px-3 py-2.5 text-right font-mono font-bold text-purple-600 dark:text-purple-400">{fmtNum(row.transferredQuantity)}</td>
                        <td className="px-3 py-2.5 text-right">
                          <span className={`inline-flex items-center justify-end font-mono font-black text-xs px-2.5 py-0.5 rounded-md border ${
                            row.currentStage === "loading"
                              ? "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300"
                              : row.currentStage === "warehouse"
                                ? "bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300"
                                : "bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300"
                          }`}>
                            {fmtNum(row.availableQuantity)} {row.unit}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-slate-700 dark:text-slate-300">
                          <div className="truncate max-w-[160px] font-medium" title={row.currentLocation}>
                            {row.currentLocation}
                          </div>
                          {row.truckOrContainer && row.truckOrContainer !== "-" && (
                            <div className="text-[10px] text-slate-400 font-mono truncate">
                              Ref: {row.truckOrContainer}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-slate-700 dark:text-slate-300 whitespace-nowrap text-[11px]">
                          <span className="font-semibold">{row.countryName}</span>
                          <span className="text-slate-400"> • </span>
                          <span>{row.branchName}</span>
                        </td>
                        <td className="px-3 py-2.5 text-slate-700 dark:text-slate-300 max-w-[150px] truncate text-[10.5px]">
                          <div className="truncate font-semibold">{row.supplierName}</div>
                          <div className="truncate text-slate-400 text-[10px]">{row.purchaseAccount}</div>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {row.canTransfer ? (
                              <button
                                type="button"
                                onClick={() => handleOpenTransfer(row)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-[10px] uppercase shadow-xs transition"
                                title="Transfer Stock to Warehouse, Export, or Local Sales"
                              >
                                <ArrowLeftRight className="w-3 h-3" />
                                Transfer
                              </button>
                            ) : null}

                            <button
                              type="button"
                              onClick={() => handleOpenHistory(row)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 font-bold text-[10px] shadow-2xs transition"
                              title="View Full Stock Movement History"
                            >
                              <History className="w-3 h-3 text-blue-600" />
                              History
                            </button>

                            <button
                              type="button"
                              onClick={() => setExpandedRowId(isExpanded ? null : row.id)}
                              className={`p-1 rounded-lg border text-slate-500 hover:bg-slate-100 transition ${
                                isExpanded ? "border-blue-500 text-blue-600 bg-blue-50 dark:bg-blue-950/40" : "border-slate-200 dark:border-slate-700"
                              }`}
                              title={isExpanded ? "Collapse Details" : "Expand Breakdown"}
                            >
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Accordion Row Details: Booking vs Loading Breakdown */}
                      {isExpanded && (
                        <tr className="bg-slate-50/90 dark:bg-slate-900/80 border-t-2 border-b-2 border-blue-200 dark:border-blue-900/50">
                          <td colSpan={14} className="px-4 py-4">
                            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-blue-200/80 dark:border-blue-900/40 shadow-sm space-y-4 max-w-5xl">
                              {/* Header */}
                              <div className="flex flex-wrap items-center justify-between border-b pb-3 gap-2">
                                <div className="flex items-center gap-2.5">
                                  <span className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950 flex items-center justify-center text-blue-600 dark:text-blue-400 font-black">
                                    📦
                                  </span>
                                  <div>
                                    <h5 className="font-black text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                      Booking vs Loading Breakdown: <span className="font-mono text-blue-600 dark:text-blue-400">{row.billNumber}</span> ({row.productName})
                                    </h5>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                      {row.sourceLabel} • {row.branchName} ({row.countryName}) • Supplier: {row.supplierName}
                                    </p>
                                  </div>
                                </div>
                                <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                  Stage: {row.stageLabel}
                                </span>
                              </div>

                              {/* 3 Core Booking Quantity Cards */}
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                {/* Card 1: Initial Booking */}
                                <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/60 dark:bg-blue-950/30 dark:border-blue-900/40">
                                  <span className="text-[10px] font-black uppercase tracking-wider text-blue-700 dark:text-blue-400 block mb-1">
                                    1. Initial Booked Stock (پہلی بکنگ)
                                  </span>
                                  <div className="text-xl font-black font-mono text-blue-900 dark:text-blue-200">
                                    {fmtNum(row.bookedQuantity)} <span className="text-xs font-semibold">{row.unit}</span>
                                  </div>
                                  <p className="text-[10.5px] text-blue-600/80 dark:text-blue-400/80 mt-1">
                                    Original booked quantity registered in purchase bill
                                  </p>
                                </div>

                                {/* Card 2: Loaded Quantity */}
                                <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/60 dark:bg-amber-950/30 dark:border-amber-900/40">
                                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400 block mb-1">
                                    2. Total Loaded Stock (لوڈ شدہ سامان)
                                  </span>
                                  <div className="text-xl font-black font-mono text-amber-900 dark:text-amber-200">
                                    {fmtNum(row.loadedQuantity)} <span className="text-xs font-semibold">{row.unit}</span>
                                  </div>
                                  <p className="text-[10.5px] text-amber-700/80 dark:text-amber-400/80 mt-1">
                                    {row.loadedQuantity > 0 ? `${fmtNum(row.loadedQuantity)} ${row.unit} dispatched in trucks / containers` : "No loadings created yet (0 loaded)"}
                                  </p>
                                </div>

                                {/* Card 3: Remaining Journal Stock */}
                                <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/60 dark:bg-emerald-950/30 dark:border-emerald-900/40">
                                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block mb-1">
                                    3. Remaining Journal Stock (باقی بکنگ اسٹاک)
                                  </span>
                                  <div className="text-xl font-black font-mono text-emerald-900 dark:text-emerald-200">
                                    {fmtNum(row.availableQuantity)} <span className="text-xs font-semibold">{row.unit}</span>
                                  </div>
                                  <p className="text-[10.5px] text-emerald-700/80 dark:text-emerald-400/80 mt-1">
                                    {row.availableQuantity > 0 ? "Pending loading dispatch into containers" : "Fully loaded (0 remaining in Journal)"}
                                  </p>
                                </div>
                              </div>

                              {/* Visual Progress Bar */}
                              <div>
                                <div className="flex justify-between text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                                  <span>Loading Progress: {row.bookedQuantity > 0 ? ((row.loadedQuantity / row.bookedQuantity) * 100).toFixed(1) : 0}%</span>
                                  <span>Remaining: {row.bookedQuantity > 0 ? ((row.availableQuantity / row.bookedQuantity) * 100).toFixed(1) : 0}%</span>
                                </div>
                                <div className="w-full h-3 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden flex">
                                  <div
                                    style={{ width: `${Math.min(100, Math.max(0, row.bookedQuantity > 0 ? (row.loadedQuantity / row.bookedQuantity) * 100 : 0))}%` }}
                                    className="bg-amber-500 h-full transition-all duration-300"
                                    title={`Loaded: ${fmtNum(row.loadedQuantity)} ${row.unit}`}
                                  />
                                  <div
                                    style={{ width: `${Math.min(100, Math.max(0, row.bookedQuantity > 0 ? (row.availableQuantity / row.bookedQuantity) * 100 : 0))}%` }}
                                    className="bg-emerald-500 h-full transition-all duration-300"
                                    title={`Remaining: ${fmtNum(row.availableQuantity)} ${row.unit}`}
                                  />
                                </div>
                              </div>

                              {/* Loadings Detail Table or Empty Alert */}
                              {row.loadings && row.loadings.length > 0 ? (
                                <div className="space-y-2 pt-2 border-t">
                                  <h6 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                                    Loading Records for this Bill ({row.loadings.length})
                                  </h6>
                                  <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                                    <table className="w-full text-xs text-left">
                                      <thead className="bg-slate-100 dark:bg-slate-800 text-[10.5px] uppercase font-bold text-slate-600 dark:text-slate-400">
                                        <tr>
                                          <th className="p-2">Date</th>
                                          <th className="p-2">Loading Ref #</th>
                                          <th className="p-2">Truck / Container</th>
                                          <th className="p-2">Driver / Carrier</th>
                                          <th className="p-2 text-right">Loaded Qty</th>
                                          <th className="p-2">Receiving Destination</th>
                                          <th className="p-2 text-center">Status</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {row.loadings.map((lr) => (
                                          <tr key={lr.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                            <td className="p-2 whitespace-nowrap">{fmtDate(lr.loadingDate)}</td>
                                            <td className="p-2 font-mono font-bold text-blue-600">{lr.loadingRecordNo || "-"}</td>
                                            <td className="p-2 font-mono">{lr.containerNumber || "-"}</td>
                                            <td className="p-2">{lr.driverName || "-"}</td>
                                            <td className="p-2 text-right font-mono font-bold text-amber-600">{fmtNum(lr.loadedQuantity)} {row.unit}</td>
                                            <td className="p-2">{lr.warehouseName || "-"}</td>
                                            <td className="p-2 text-center">
                                              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                                {lr.status || "Loaded"}
                                              </span>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              ) : (
                                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400">
                                  <Info className="w-5 h-5 text-blue-600 flex-shrink-0" />
                                  <div>
                                    <span className="font-bold text-slate-800 dark:text-slate-200">No trucks or containers loaded yet.</span>
                                    <p className="text-[11px] mt-0.5">
                                      All <strong>{fmtNum(row.bookedQuantity)} {row.unit}</strong> are currently in Journal Stock (Pending Loading). Once loading records are posted in Purchase Loading, loaded amounts will automatically deduct from this balance.
                                    </p>
                                  </div>
                                </div>
                              )}

                              {row.remarks && (
                                <div className="text-xs p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                                  <strong className="text-slate-700 dark:text-slate-300">Remarks:</strong> {row.remarks}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Stock Transfer Modal ── */}
      {transferModalRow && (
        <SimpleModal
          title={
            <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <ArrowLeftRight className="w-5 h-5 text-amber-600" />
              <span>Stock Transfer from Loading Stock</span>
            </div>
          }
          onClose={() => setTransferModalRow(null)}
          maxWidth="max-w-xl"
        >
          <form onSubmit={handleSubmitTransfer} className="space-y-4">
            {/* Source Overview Banner */}
            <div className="p-3.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-amber-900 dark:text-amber-200">Bill Ref: {transferModalRow.billNumber}</span>
                <span className="font-mono font-bold text-slate-600 dark:text-slate-400">
                  Loading Ref: {transferModalRow.loadingRecordNo || "-"}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Commodity</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{transferModalRow.productName}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Available in Loading</span>
                  <span className="font-mono font-black text-amber-700 dark:text-amber-300 text-sm">
                    {fmtNum(transferModalRow.availableQuantity)} {transferModalRow.unit}
                  </span>
                </div>
              </div>
              <div className="text-[11px] text-slate-500">
                Loaded Truck / Container: <strong>{transferModalRow.truckOrContainer}</strong>
              </div>
            </div>

            {/* Destination Selection */}
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                Select Stock Destination <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { key: "warehouse", label: "Warehouse Stock", icon: Boxes },
                  { key: "export", label: "Export Stock", icon: Ship },
                  { key: "local_sales", label: "Local Sales Stock", icon: ShoppingBag }
                ].map((dest) => {
                  const Icon = dest.icon;
                  const isSelected = transferDestination === dest.key;
                  return (
                    <button
                      key={dest.key}
                      type="button"
                      onClick={() => setTransferDestination(dest.key as any)}
                      className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-bold transition ${
                        isSelected
                          ? "bg-blue-50 border-blue-500 text-blue-800 dark:bg-blue-950/60 dark:border-blue-400 dark:text-blue-200 shadow-xs ring-2 ring-blue-500/20"
                          : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50"
                      }`}
                    >
                      <Icon className="w-5 h-5 mb-1 text-slate-700 dark:text-slate-300" />
                      <span>{dest.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Warehouse Select (Only if Warehouse is destination) */}
            {transferDestination === "warehouse" && (
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Destination Warehouse <span className="text-red-500">*</span>
                </label>
                <select
                  value={transferWarehouseId}
                  onChange={(e) => setTransferWarehouseId(e.target.value)}
                  required
                  className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a warehouse...</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.warehouse_name} ({w.warehouse_code}) - {w.warehouse_type || "General"}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Transfer Quantity */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Transfer Quantity ({transferModalRow.unit}) <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setTransferQty(String(transferModalRow.availableQuantity))}
                  className="text-[11px] font-bold text-blue-600 hover:underline cursor-pointer"
                >
                  Transfer Max ({transferModalRow.availableQuantity} {transferModalRow.unit})
                </button>
              </div>
              <input
                type="number"
                step="any"
                min="0.001"
                max={transferModalRow.availableQuantity}
                value={transferQty}
                onChange={(e) => setTransferQty(e.target.value)}
                required
                className="w-full text-sm font-mono font-bold px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Date & Reference */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Transfer Date
                </label>
                <input
                  type="date"
                  value={transferDate}
                  onChange={(e) => setTransferDate(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Reference / Gate Pass #
                </label>
                <input
                  type="text"
                  placeholder="Gate Pass / Ref No"
                  value={transferReference}
                  onChange={(e) => setTransferReference(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Remarks */}
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Remarks / Handling Notes
              </label>
              <textarea
                rows={2}
                placeholder="Optional transfer notes..."
                value={transferRemarks}
                onChange={(e) => setTransferRemarks(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Safety Notice */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-start gap-2.5 text-slate-600 dark:text-slate-400 text-xs">
              <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              <span>
                <strong>Physical Stock Movement Only:</strong> Deducts from Loading Stock and adds to destination inventory. No Roznamcha or ledger entries will be posted.
              </span>
            </div>

            {/* Error Message */}
            {transferError && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 text-xs font-bold text-red-700 dark:text-red-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{transferError}</span>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setTransferModalRow(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={transferLoading}
                className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs transition disabled:opacity-50 flex items-center gap-1.5"
              >
                {transferLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Confirm Transfer
              </button>
            </div>
          </form>
        </SimpleModal>
      )}

      {/* ── Movement History Timeline Modal ── */}
      {historyModalRow && (
        <SimpleModal
          title={
            <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <History className="w-5 h-5 text-blue-600" />
              <span>Stock Movement Audit Trail: {historyModalRow.billNumber}</span>
            </div>
          }
          onClose={() => setHistoryModalRow(null)}
          maxWidth="max-w-3xl"
        >
          {historyLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              <p className="text-xs text-slate-500">Loading complete stock history...</p>
            </div>
          ) : historyData ? (
            <div className="space-y-5">
              {/* Purchase Origin Info */}
              <div className="p-4 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800">
                <div className="flex items-center justify-between border-b border-blue-200 dark:border-blue-800/60 pb-2 mb-3">
                  <h6 className="font-bold text-xs uppercase tracking-wider text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-blue-600" />
                    Step 1: Purchase Booking Entry
                  </h6>
                  <span className="font-mono text-xs font-bold text-blue-700 dark:text-blue-300">
                    {historyData.purchaseInfo?.billNo}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Date</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{fmtDate(historyData.purchaseInfo?.date)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Product</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{historyData.purchaseInfo?.goodsName}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Supplier</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{historyData.purchaseInfo?.supplier}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Initial Booked Qty</span>
                    <span className="font-mono font-black text-blue-700 dark:text-blue-300 text-sm">
                      {fmtNum(historyData.purchaseInfo?.bookedQuantity)} {historyData.purchaseInfo?.unit}
                    </span>
                  </div>
                </div>
              </div>

              {/* Step 2: Confirmed Loadings */}
              <div>
                <h6 className="font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5 mb-2">
                  <Truck className="w-4 h-4 text-amber-600" />
                  Step 2: Confirmed Loading Events ({historyData.loadingEvents?.length || 0})
                </h6>
                {historyData.loadingEvents?.length === 0 ? (
                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-500 text-xs italic">
                    Goods have not yet been loaded. 100% of quantity resides in Journal Stock.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {historyData.loadingEvents.map((lr: any) => (
                      <div key={lr.id} className="p-3 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20 text-xs flex justify-between items-center">
                        <div>
                          <div className="font-bold text-amber-950 dark:text-amber-200">
                            Loading Ref: {lr.loadingRecordNo} • {fmtDate(lr.loadingDate)}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            Truck / Container: <strong className="font-mono">{lr.containerTruck}</strong> {lr.driverName !== "-" ? `• Driver: ${lr.driverName}` : ""}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-mono font-black text-amber-700 dark:text-amber-400 text-sm block">
                            {fmtNum(lr.loadedQuantity)} {historyData.purchaseInfo?.unit}
                          </span>
                          <span className="text-[10px] text-slate-400 font-semibold">{lr.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Step 3: Destination Transfers */}
              <div>
                <h6 className="font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5 mb-2">
                  <ArrowLeftRight className="w-4 h-4 text-purple-600" />
                  Step 3: Stock Transfers from Loading ({historyData.transferEvents?.length || 0})
                </h6>
                {historyData.transferEvents?.length === 0 ? (
                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-500 text-xs italic">
                    No transfers have been executed from loading stock yet.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {historyData.transferEvents.map((tr: any) => (
                      <div key={tr.id} className="p-3 rounded-xl border border-purple-200 dark:border-purple-900/60 bg-purple-50/40 dark:bg-purple-950/20 text-xs flex justify-between items-center">
                        <div>
                          <div className="font-bold text-purple-950 dark:text-purple-200 flex items-center gap-1.5">
                            <span>{tr.transferNo}</span>
                            <span className="text-slate-400">•</span>
                            <span>{fmtDate(tr.transferDate)}</span>
                          </div>
                          <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                            Destination: <strong className="text-purple-800 dark:text-purple-300">{tr.destinationLabel}</strong>
                            {tr.remarks && tr.remarks !== "-" ? ` • Notes: ${tr.remarks}` : ""}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-mono font-black text-purple-700 dark:text-purple-300 text-sm block">
                            {fmtNum(tr.quantity)} {tr.unit}
                          </span>
                          <span className="text-[10px] text-slate-400">By: {tr.transferredBy}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Current Pipeline Balance Breakdown */}
              <div className="p-4 rounded-xl bg-slate-900 text-white shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Live Stock Balance Breakdown
                  </span>
                  <span className="text-[11px] text-emerald-400 font-bold">100% Stock Conserved</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs text-center">
                  <div className="bg-slate-800 p-2 rounded-lg">
                    <span className="text-[10px] text-slate-400 block">In Journal</span>
                    <span className="font-mono font-black text-blue-400 text-sm">{fmtNum(historyData.summary?.journalRemaining)}</span>
                  </div>
                  <div className="bg-slate-800 p-2 rounded-lg">
                    <span className="text-[10px] text-slate-400 block">In Loading</span>
                    <span className="font-mono font-black text-amber-400 text-sm">{fmtNum(historyData.summary?.loadingRemaining)}</span>
                  </div>
                  <div className="bg-slate-800 p-2 rounded-lg">
                    <span className="text-[10px] text-slate-400 block">Warehouse</span>
                    <span className="font-mono font-black text-emerald-400 text-sm">{fmtNum(historyData.summary?.warehouseTotal)}</span>
                  </div>
                  <div className="bg-slate-800 p-2 rounded-lg">
                    <span className="text-[10px] text-slate-400 block">Export</span>
                    <span className="font-mono font-black text-purple-400 text-sm">{fmtNum(historyData.summary?.exportTotal)}</span>
                  </div>
                  <div className="bg-slate-800 p-2 rounded-lg">
                    <span className="text-[10px] text-slate-400 block">Local Sales</span>
                    <span className="font-mono font-black text-teal-400 text-sm">{fmtNum(historyData.summary?.localSalesTotal)}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-red-500 py-4">Unable to load movement history.</p>
          )}
        </SimpleModal>
      )}
    </div>
  );
}
