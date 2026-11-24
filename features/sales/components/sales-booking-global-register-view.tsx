"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ShoppingBag,
  Crown,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  FileText,
  Printer,
  Eye,
  Pencil,
  Search,
  RefreshCw,
  Sparkles,
  Plus,
  Download,
  CheckCircle2,
  Clock,
  Store,
  MoreVertical,
  ArrowRightLeft,
} from "lucide-react";
import { translateHeader } from "@/lib/i18n/table-headers";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { cn } from "@/lib/utils";
import { apiGet, apiPost } from "@/lib/api/client";
import { InvoiceDocumentView } from "@/components/invoices/invoice-document-view";
import { EntryMethodSelector } from "@/features/document-intelligence/components/entry-method-selector";
import { SalesOrderWizard } from "@/features/sales/components/sales-order-wizard.jsx";

import { ViewportActionMenu } from "@/components/ui/viewport-action-menu";
// @ts-expect-error JSX view module
import { SalesBookingTransferReport } from "./sales-booking-transfer-report.jsx";

interface SalesBookingGlobalRegisterViewProps {
  session: any;
  lang?: string;
  initialOrderId?: string | null;
  initialLotId?: string | null;
  initialSource?: string | null;
}

export function SalesBookingGlobalRegisterView({
  session,
  lang: propLang,
  initialOrderId = null,
  initialLotId = null,
  initialSource = null,
}: SalesBookingGlobalRegisterViewProps) {
  const activeLang = useActiveLanguage();
  const lang = propLang || activeLang || "en";
  const tr = useCallback((key: string) => translateHeader(lang, key), [lang]);
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);

  const router = useRouter();
  const searchParams = useSearchParams();
  const modeParam = searchParams.get("mode");
  const sourceParam = searchParams.get("source") || initialSource || "";
  const idParam =
    searchParams.get("salesOrderId") ||
    searchParams.get("salesId") ||
    searchParams.get("orderId") ||
    searchParams.get("id") ||
    searchParams.get("salesOrderNo") ||
    initialOrderId;
  const lotParam = searchParams.get("lotId") || initialLotId;

  const isLocalSalesPage = sourceParam.toLowerCase() === "local";

  // Show Table/Register by default; enter Form/Gate mode only when clicking + New or editing an existing order / lot
  const [isFormMode, setIsFormMode] = useState<boolean>(
    () => modeParam === "new" || Boolean(idParam) || Boolean(lotParam)
  );

  useEffect(() => {
    if (modeParam === "new" || idParam || lotParam) {
      setIsFormMode(true);
    } else {
      setIsFormMode(false);
    }
  }, [modeParam, idParam, lotParam]);

  // Register data
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  // Popups & Modals
  const [activeAccountPopupId, setActiveAccountPopupId] = useState<string | null>(null);
  const [activeRowMenuId, setActiveRowMenuId] = useState<string | null>(null);
  const [invoiceRow, setInvoiceRow] = useState<any | null>(null);

  const [review, setReview] = useState<{ id: string; allowPost: boolean } | null>(null);
  const [reviewOrder, setReviewOrder] = useState<any>(null);
  const [reviewConfirmation, setReviewConfirmation] = useState<any>(null);
  const [reviewError, setReviewError] = useState("");
  const [reviewBusy, setReviewBusy] = useState(false);
  const postingReview = useRef(false);

  useEffect(() => {
    if (!review) return;
    let current = true;
    apiGet<{ order: any }>(`/api/erp/sales/orders/${encodeURIComponent(review.id)}`)
      .then(({ order }) => { if (current) setReviewOrder(order); })
      .catch((error: Error) => { if (current) setReviewError(error.message); })
      .finally(() => { if (current) setReviewBusy(false); });
    return () => { current = false; };
  }, [review]);

  const openReview = (id: string, allowPost: boolean) => {
    setReviewOrder(null);
    setReviewConfirmation(null);
    setReviewError("");
    setReviewBusy(true);
    setReview({ id, allowPost });
  };

  // Pagination (replaces bottom yellow total bar per owner design standard)
  const [pageSize, setPageSize] = useState<number>(25);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filterCountry, setFilterCountry] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [localScopeFilter, setLocalScopeFilter] = useState<"local" | "all">(
    isLocalSalesPage ? "local" : "all"
  );

  useEffect(() => {
    setLocalScopeFilter(isLocalSalesPage ? "local" : "all");
  }, [isLocalSalesPage]);

  const [reportsOpen, setReportsOpen] = useState<boolean>(false);
  const reportsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (reportsRef.current && target && !reportsRef.current.contains(target)) {
        setReportsOpen(false);
      }
      if (!target?.closest("[data-sales-account-popup]")) {
        setActiveAccountPopupId(null);
      }
      if (!target?.closest("[data-sales-row-menu]")) {
        setActiveRowMenuId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiGet<{ reports: any[] }>(
        `/api/erp/sales/booking-journal-report?limit=500&lang=${encodeURIComponent(lang)}`
      );
      setReports(Array.isArray(res?.reports) ? res.reports : []);
    } catch (err: any) {
      setError(err?.message || "Failed to load sales booking register");
    } finally {
      setLoading(false);
    }
  }, [lang]);

  useEffect(() => {
    if (!isFormMode) {
      void loadReports();
    }
  }, [isFormMode, loadReports]);

  const postReviewedOrder = async () => {
    if (!review?.allowPost || !reviewOrder || postingReview.current) return;
    postingReview.current = true;
    setReviewBusy(true);
    setReviewError("");
    try {
      const result = await apiPost<unknown>(`/api/erp/sales/orders/${encodeURIComponent(review.id)}/transfer`, {});
      setReviewConfirmation(result);
      void loadReports();
    } catch (error) {
      setReviewError(error instanceof Error ? error.message : tr("Transfer failed."));
    } finally {
      postingReview.current = false;
      setReviewBusy(false);
    }
  };

  const isRowLocalSale = useCallback((r: any) => {
    const form = r?.form_data?.form || {};
    const src = String(form.saleSource || "").toLowerCase();
    const sm = String(form.saleMode || "").toLowerCase();
    return src === "local" || sm === "local";
  }, []);

  const isRowTransferred = useCallback((r: any) => {
    const form = r?.form_data?.form || {};
    const wf = r?.workflowState || r?.workflow_state || {};
    const st = String(r?.status || "").toLowerCase();
    return Boolean(
      r?.is_transferred ||
        r?.isTransferred ||
        form?.isTransferred ||
        wf?.isTransferred ||
        wf?.transferredAt ||
        st === "transferred" ||
        st === "completed" ||
        st === "confirmed" ||
        st === "posted"
    );
  }, []);

  const availableCountries = useMemo(() => {
    const set = new Set<string>();
    reports.forEach((r) => {
      if (r.countryName && r.countryName !== "-") set.add(r.countryName);
    });
    return Array.from(set).sort();
  }, [reports]);

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return reports.filter((r) => {
      if (localScopeFilter === "local" && !isRowLocalSale(r)) return false;
      if (filterCountry !== "all" && r.countryName !== filterCountry) return false;
      if (filterStatus !== "all") {
        const transferred = isRowTransferred(r);
        if (filterStatus === "transferred" && !transferred) return false;
        if (filterStatus === "pending" && transferred) return false;
      }
      if (q) {
        const hay = [
          r.salesBookingOrderNumber,
          r.manualBillNumber,
          r.superAdminSerialNo,
          r.countrySerialNo,
          r.branchSerialNo,
          r.customerName,
          r.salesAccountName,
          r.productName,
          r.goodsDescription,
          r.countryName,
          r.branchName,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [reports, localScopeFilter, isRowLocalSale, filterCountry, filterStatus, isRowTransferred, searchQuery]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterCountry, filterStatus, localScopeFilter]);

  // Awaiting transfer in red at top, transferred in black at bottom (matching Purchase Booking)
  const sortedRows = useMemo(() => {
    return [...filteredRows].sort((a, b) => {
      const aT = isRowTransferred(a);
      const bT = isRowTransferred(b);
      if (!aT && bT) return -1;
      if (aT && !bT) return 1;
      const dA = new Date(a.salesDate || a.bookingDate || a.createdAt || 0).getTime();
      const dB = new Date(b.salesDate || b.bookingDate || b.createdAt || 0).getTime();
      return dB - dA;
    });
  }, [filteredRows, isRowTransferred]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedRows.slice(start, start + pageSize);
  }, [sortedRows, currentPage, pageSize]);

  // Summary metrics (per-currency — never sum different currencies together)
  const summary = useMemo(() => {
    const totalBills = filteredRows.length;
    const salesByCur: Record<string, number> = {};
    const paidByCur: Record<string, number> = {};
    const remainingByCur: Record<string, number> = {};
    let completed = 0;
    let partial = 0;
    let pending = 0;

    filteredRows.forEach((r) => {
      const cur = String(r.currency || "AED").toUpperCase();
      const amt = Number(r.totalSalesAmount || r.salesAmount || 0);
      const paid = Number(r.paid_amount || 0);
      const rem = r.remaining_amount != null ? Number(r.remaining_amount) : Math.max(0, amt - paid);

      salesByCur[cur] = (salesByCur[cur] || 0) + amt;
      paidByCur[cur] = (paidByCur[cur] || 0) + paid;
      remainingByCur[cur] = (remainingByCur[cur] || 0) + rem;

      if (isRowTransferred(r) || (amt > 0 && paid >= amt - 0.05)) {
        completed++;
      } else if (paid > 0.05) {
        partial++;
      } else {
        pending++;
      }
    });

    return {
      totalBills,
      salesByCur,
      paidByCur,
      remainingByCur,
      completed,
      completedPct: totalBills > 0 ? ((completed / totalBills) * 100).toFixed(1) : "0.0",
      partial,
      partialPct: totalBills > 0 ? ((partial / totalBills) * 100).toFixed(1) : "0.0",
      pending,
      pendingPct: totalBills > 0 ? ((pending / totalBills) * 100).toFixed(1) : "0.0",
    };
  }, [filteredRows, isRowTransferred]);

  const countryMetrics = useMemo(() => {
    const map = new Map<
      string,
      { country: string; currency: string; bills: number; salesAmount: number; paidAmount: number }
    >();
    filteredRows.forEach((r) => {
      const rawCountry = String(r.countryName || "UAE").trim();
      const country = rawCountry.toLowerCase().includes("united arab emirates") ? "UAE" : rawCountry;
      const currency = String(r.finalCurrency || r.currency || "AED").toUpperCase();
      const entry = map.get(country) || {
        country,
        currency,
        bills: 0,
        salesAmount: 0,
        paidAmount: 0,
      };
      entry.bills += 1;
      entry.salesAmount += Number(r.finalAmount || r.totalSalesAmount || r.salesAmount || 0);
      entry.paidAmount += Number(r.paid_amount || 0);
      map.set(country, entry);
    });
    return Array.from(map.values()).sort((a, b) => b.bills - a.bills);
  }, [filteredRows]);

  const fmt = (n: number) =>
    Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const renderCurrencyLines = (values: Record<string, number>) => {
    const keys = Object.keys(values).sort();
    if (keys.length === 0) return <>—</>;
    return (
      <span className="flex flex-col items-end font-mono">
        {keys.map((cur) => (
          <span key={cur}>{cur} {fmt(values[cur])}</span>
        ))}
      </span>
    );
  };

  const formatDashDate = (val: any) => {
    if (!val) return "—";
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val).slice(0, 10) || "—";
    const day = String(d.getDate()).padStart(2, "0");
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${day}-${months[d.getMonth()]}-${d.getFullYear()}`;
  };

  const getCountryFlag = (country: string) => {
    const c = String(country || "").toLowerCase();
    if (c.includes("uae") || c.includes("dubai") || c.includes("emirates")) return "🇦🇪";
    if (c.includes("pakistan") || c.includes("pk")) return "🇵🇰";
    if (c.includes("afghanistan") || c.includes("af")) return "🇦🇫";
    if (c.includes("iran") || c.includes("ir")) return "🇮🇷";
    if (c.includes("china") || c.includes("cn")) return "🇨🇳";
    if (c.includes("india") || c.includes("in")) return "🇮🇳";
    return "🌐";
  };

  const shortenCountry = (c: string) => {
    if (!c) return "—";
    const s = String(c).trim();
    if (s.toLowerCase().includes("united arab emirates") || s.toLowerCase() === "emirates") return "UAE";
    return s;
  };

  const baseRegisterUrl = isLocalSalesPage
    ? "/dashboard/sales/new-sales-booking-order?source=local"
    : "/dashboard/sales/new-sales-booking-order";

  const openNewEntry = () => {
    const nextUrl = isLocalSalesPage
      ? "/dashboard/sales/new-sales-booking-order?source=local&mode=new"
      : "/dashboard/sales/new-sales-booking-order?mode=new";
    setIsFormMode(true);
    router.push(nextUrl as any);
  };

  const openEditOrder = (orderId: string) => {
    const nextUrl = isLocalSalesPage
      ? `/dashboard/sales/new-sales-booking-order?source=local&salesOrderId=${encodeURIComponent(orderId)}`
      : `/dashboard/sales/new-sales-booking-order?salesOrderId=${encodeURIComponent(orderId)}`;
    setIsFormMode(true);
    router.push(nextUrl as any);
  };

  const exitFormMode = () => {
    setIsFormMode(false);
    router.push(baseRegisterUrl as any);
  };

  const handleExportCsv = () => {
    const headers = [
      "#",
      "Bill No",
      "Date",
      "Country",
      "Branch",
      "Customer",
      "Sales Account",
      "Goods",
      "Qty",
      "Unit",
      "Gross Wt",
      "Net Wt",
      "Sales Amount",
      "Currency",
      "Paid",
      "Remaining",
      "Status",
    ];
    const rows = sortedRows.map((r, i) =>
      [
        i + 1,
        `"${r.salesBookingOrderNumber || r.sales_order_no || ""}"`,
        `"${formatDashDate(r.salesDate || r.bookingDate)}"`,
        `"${r.countryName || ""}"`,
        `"${r.branchName || ""}"`,
        `"${(r.customerName || "").replace(/"/g, '""')}"`,
        `"${(r.salesAccountName || "").replace(/"/g, '""')}"`,
        `"${(r.productName || r.goodsDescription || "").replace(/"/g, '""')}"`,
        Number(r.quantity || 0),
        `"${r.unit || ""}"`,
        Number(r.totalGrossWeight || 0),
        Number(r.totalNetWeight || 0),
        Number(r.totalSalesAmount || r.salesAmount || 0).toFixed(2),
        `"${r.currency || "USD"}"`,
        Number(r.paid_amount || 0).toFixed(2),
        Number(r.remaining_amount || 0).toFixed(2),
        `"${isRowTransferred(r) ? "Transferred" : r.status || "Pending"}"`,
      ].join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${isLocalSalesPage ? "local-sales" : "sales-booking"}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const selectedInvoiceRecord = useMemo(() => {
    if (!invoiceRow) return {};
    const form = invoiceRow.form_data?.form || {};
    return {
      ...invoiceRow,
      created_at: invoiceRow.createdAt || invoiceRow.bookingDate || null,
      id: invoiceRow.id,
      sales_order_no: invoiceRow.salesBookingOrderNumber || invoiceRow.sales_order_no,
      sales_contract_no: invoiceRow.sales_contract_no,
      currency_code: invoiceRow.currency || invoiceRow.finalCurrency,
      exchange_rate: invoiceRow.exchange_rate,
      country_id: form.countryId ?? null,
      country_branch_id: invoiceRow.countryBranchId ?? form.countryBranchId ?? null,
      city_branch_id: invoiceRow.cityBranchId ?? form.cityBranchId ?? null,
      country_name: invoiceRow.countryName,
      branch_name: invoiceRow.branchName,
      customer_name: invoiceRow.customerName,
      form_data: invoiceRow.form_data,
    };
  }, [invoiceRow]);

  const selectedInvoiceScope = useMemo(() => {
    if (!invoiceRow) return {};
    const form = invoiceRow.form_data?.form || {};
    return {
      countryId: form.countryId || null,
      countryBranchId: invoiceRow.countryBranchId || form.countryBranchId || null,
      cityBranchId: invoiceRow.cityBranchId || form.cityBranchId || null,
      countryName: invoiceRow.countryName || null,
      branchName: invoiceRow.branchName || null,
    };
  }, [invoiceRow]);

  // ── FORM / ENTRY METHOD GATE MODE ──
  if (isFormMode) {
    return (
      <div dir={isRtl ? "rtl" : "ltr"} className="w-full max-w-[1920px] mx-auto px-2 sm:px-4 py-3 space-y-3">
        <div className="hidden sm:flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={exitFormMode}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 text-xs font-black text-slate-800 shadow-sm transition dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
            >
              ← {tr("Back to Register")}
            </button>
            <span className="h-4 w-px bg-slate-300 dark:bg-slate-700" />
            <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
              <Sparkles className={cn("h-4 w-4", isLocalSalesPage ? "text-amber-600" : "text-blue-600")} />
              {idParam
                ? `${tr("Sales Booking")} (${idParam})`
                : isLocalSalesPage
                ? tr("Local Sales")
                : tr("New Sales Booking")}
            </div>
          </div>
        </div>

        <EntryMethodSelector
          targetModule="sales_orders"
          domain="business"
          lang={lang}
          skipGate={Boolean(idParam) || Boolean(lotParam)}
          onCancel={exitFormMode}
        >
          <SalesOrderWizard session={session} useSalesBookingTransferReport={!isLocalSalesPage} />
        </EntryMethodSelector>
      </div>
    );
  }

  // ── REGISTER TABLE VIEW (DEFAULT) ──
  const accentHeaderBg = isLocalSalesPage
    ? "bg-gradient-to-r from-[#78350f] via-[#92400e] to-[#b45309]"
    : "bg-gradient-to-r from-[#1e3a8a] via-[#1d4ed8] to-[#1e40af]";

  return (
    <div
      dir={isRtl ? "rtl" : "ltr"}
      data-page-chrome="true"
      className="w-full max-w-[1920px] mx-auto space-y-3 p-2 sm:p-3 text-slate-900 dark:text-slate-100"
    >
      {/* 1. Consolidated Top Control Bar ("White Patti") */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-slate-200/90 bg-white p-3 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200 transition cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>{tr("Back")}</span>
          </button>

          <div
            className={cn(
              "flex items-center justify-center h-8 w-8 rounded-lg",
              isLocalSalesPage
                ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                : "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
            )}
          >
            {isLocalSalesPage ? <Store className="h-4 w-4" /> : <ShoppingBag className="h-4 w-4" />}
          </div>

          <div className="flex items-center gap-2">
            <h1
              className={cn(
                "text-base font-black tracking-tight sm:text-lg",
                isLocalSalesPage ? "text-[#92400e] dark:text-amber-400" : "text-[#1e3a8a] dark:text-blue-400"
              )}
            >
              {isLocalSalesPage
                ? tr("Local Sales (Global & Country Wise)")
                : tr("Sales Booking (Global & Country Wise)")}
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-[#eff6ff] px-2 py-0.5 text-[10px] font-bold text-[#1d4ed8] dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300">
              <Crown className="h-3 w-3" />
              {tr("Super Admin View")}
            </span>
          </div>

          <nav aria-label="breadcrumb" className="hidden xl:flex items-center text-[11px] font-semibold text-slate-400 ms-1">
            <span>/</span>
            <span className="mx-1 text-slate-500">{tr("Purchase & Trade")}</span>
            <span>/</span>
            <span className="mx-1 font-bold text-slate-700 dark:text-slate-300">
              {isLocalSalesPage ? tr("Local Sales") : tr("Sales Booking")}
            </span>
          </nav>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Reports Dropdown */}
          <div className="relative" ref={reportsRef}>
            <button
              type="button"
              onClick={() => setReportsOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563eb] hover:bg-[#1d4ed8] text-white px-3 py-1.5 text-xs font-bold shadow-xs transition cursor-pointer"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span>{tr("Reports")}</span>
              <ChevronDown className="h-3.5 w-3.5 opacity-80" />
            </button>
            {reportsOpen && (
              <div className="absolute end-0 top-full mt-1.5 z-40 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-800 dark:bg-slate-900">
                <button
                  type="button"
                  onClick={() => {
                    setReportsOpen(false);
                    router.push("/dashboard/sales/sales-booking-journal-report" as any);
                  }}
                  className="w-full text-start rounded-lg px-3 py-2 text-xs font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-700 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                >
                  {tr("Sales Booking Journal")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setReportsOpen(false);
                    router.push("/dashboard/sales/sales-confirm" as any);
                  }}
                  className="w-full text-start rounded-lg px-3 py-2 text-xs font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-700 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                >
                  {tr("Confirmed Sales Orders")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setReportsOpen(false);
                    handleExportCsv();
                  }}
                  className="w-full text-start rounded-lg px-3 py-2 text-xs font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-700 dark:text-slate-200 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" />
                  {tr("Export CSV")}
                </button>
              </div>
            )}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={tr("Search bill #, customer, goods...")}
              className="h-8 w-44 sm:w-56 rounded-lg border border-slate-200 bg-slate-50 ps-8 pe-3 text-xs font-medium text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          {/* Country filter */}
          <select
            value={filterCountry}
            onChange={(e) => setFilterCountry(e.target.value)}
            className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <option value="all">{tr("All Countries")}</option>
            {availableCountries.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {/* Transfer Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <option value="all">{tr("All Status")}</option>
            <option value="pending">{tr("Awaiting Transfer")}</option>
            <option value="transferred">{tr("Transferred")}</option>
          </select>

          {/* Local Sales scope toggle */}
          {isLocalSalesPage && (
            <div className="inline-flex rounded-lg border border-amber-200 bg-amber-50/70 p-0.5 dark:border-amber-800 dark:bg-amber-950/40">
              <button
                type="button"
                onClick={() => setLocalScopeFilter("local")}
                className={cn(
                  "rounded-md px-2.5 py-1 text-[11px] font-bold transition cursor-pointer",
                  localScopeFilter === "local"
                    ? "bg-amber-600 text-white shadow-2xs"
                    : "text-amber-800 hover:bg-amber-100 dark:text-amber-300"
                )}
              >
                {tr("Local Sales")}
              </button>
              <button
                type="button"
                onClick={() => setLocalScopeFilter("all")}
                className={cn(
                  "rounded-md px-2.5 py-1 text-[11px] font-bold transition cursor-pointer",
                  localScopeFilter === "all"
                    ? "bg-amber-600 text-white shadow-2xs"
                    : "text-amber-800 hover:bg-amber-100 dark:text-amber-300"
                )}
              >
                {tr("All Sales")}
              </button>
            </div>
          )}

          {/* Refresh */}
          <button
            type="button"
            onClick={() => void loadReports()}
            className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 cursor-pointer"
            title={tr("Refresh")}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          </button>

          {/* + New Button (Triggers Entry Method Gateway) */}
          <button
            type="button"
            onClick={openNewEntry}
            data-testid="new-sales-booking-btn"
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#16a34a] hover:bg-[#15803d] text-white px-3.5 py-1.5 text-xs font-black shadow-sm transition cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{isLocalSalesPage ? tr("New Local Sale") : tr("New Booking")}</span>
          </button>
        </div>
      </div>

      {/* 2. KPI Summary Strip (3-Card Layout matching Purchase Booking) */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {/* Card 1: Sales Summary */}
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-2 text-[11px] font-black uppercase tracking-wider text-slate-500">
            {isLocalSalesPage ? tr("LOCAL SALES SUMMARY") : tr("SALES BOOKING SUMMARY")}
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">{tr("Total Bills")}</span>
              <span className="font-black text-slate-900 dark:text-white">{summary.totalBills}</span>
            </div>
            <div className="flex items-start justify-between">
              <span className="text-slate-500">{tr("Total Sales")}</span>
              <span className="font-black text-blue-700 dark:text-blue-400">{renderCurrencyLines(summary.salesByCur)}</span>
            </div>
            <div className="flex items-start justify-between">
              <span className="text-slate-500">{tr("Total Paid")}</span>
              <span className="font-bold text-emerald-700 dark:text-emerald-400">{renderCurrencyLines(summary.paidByCur)}</span>
            </div>
            <div className="mt-1.5 flex items-start justify-between rounded-lg bg-amber-50 px-2.5 py-1.5 dark:bg-amber-950/40">
              <span className="font-bold text-amber-900 dark:text-amber-300">{tr("Balance (Remaining)")}</span>
              <span className="font-black text-amber-900 dark:text-amber-300">{renderCurrencyLines(summary.remainingByCur)}</span>
            </div>
          </div>
        </div>

        {/* Card 2: Booking Status */}
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-2 text-[11px] font-black uppercase tracking-wider text-slate-500">
            {tr("BOOKING STATUS")}
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-[10px] font-bold uppercase text-slate-400 dark:border-slate-800">
                <th className="py-1 text-start">{tr("Status")}</th>
                <th className="py-1 text-end">{tr("Bills")}</th>
                <th className="py-1 text-end">%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              <tr>
                <td className="py-1.5 flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-400">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  {tr("Transferred / Completed")}
                </td>
                <td className="py-1.5 text-end font-bold">{summary.completed}</td>
                <td className="py-1.5 text-end text-slate-500">{summary.completedPct}%</td>
              </tr>
              <tr>
                <td className="py-1.5 flex items-center gap-1.5 font-semibold text-blue-700 dark:text-blue-400">
                  <span className="h-2 w-2 rounded-full bg-blue-500" />
                  {tr("Partially Paid")}
                </td>
                <td className="py-1.5 text-end font-bold">{summary.partial}</td>
                <td className="py-1.5 text-end text-slate-500">{summary.partialPct}%</td>
              </tr>
              <tr>
                <td className="py-1.5 flex items-center gap-1.5 font-semibold text-rose-700 dark:text-rose-400">
                  <span className="h-2 w-2 rounded-full bg-rose-500" />
                  {tr("Pending / Awaiting Transfer")}
                </td>
                <td className="py-1.5 text-end font-bold">{summary.pending}</td>
                <td className="py-1.5 text-end text-slate-500">{summary.pendingPct}%</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Card 3: Country Wise Breakdown */}
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-2 text-[11px] font-black uppercase tracking-wider text-slate-500">
            {tr("COUNTRY WISE SALES")}
          </div>
          {countryMetrics.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-400">{tr("No records yet")}</div>
          ) : (
            <div className="max-h-28 overflow-y-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] font-bold uppercase text-slate-400 dark:border-slate-800">
                    <th className="py-1 text-start">{tr("Country")}</th>
                    <th className="py-1 text-center">{tr("Currency")}</th>
                    <th className="py-1 text-end">{tr("Bills")}</th>
                    <th className="py-1 text-end">{tr("Amount")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {countryMetrics.map((cm) => (
                    <tr key={cm.country}>
                      <td className="py-1.5 font-bold">
                        {getCountryFlag(cm.country)} {cm.country}
                      </td>
                      <td className="py-1.5 text-center font-mono text-[11px]">{cm.currency}</td>
                      <td className="py-1.5 text-end font-bold">{cm.bills}</td>
                      <td className="py-1.5 text-end font-black text-slate-900 dark:text-white">
                        {fmt(cm.salesAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* 3. Main Register Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className={cn("flex items-center justify-between px-4 py-2.5 text-white", accentHeaderBg)}>
          <div className="text-xs font-black uppercase tracking-wider">
            {isLocalSalesPage
              ? tr("LOCAL SALES LIST (ALL COUNTRIES)")
              : tr("SALES BOOKING LIST (ALL COUNTRIES)")}
          </div>
          <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-bold">
            {sortedRows.length} {tr("Records")}
          </span>
        </div>

        {error && (
          <div className="border-b border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-bold text-rose-700">
            {error}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="bg-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-700 border-b border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700">
              {isLocalSalesPage ? (
              <tr>
                <th className="px-2.5 py-2.5 text-center w-10">#</th>
                <th className="px-3 py-2.5 text-start">{tr("BILL NO. / DATE")}</th>
                <th className="px-3 py-2.5 text-start">{tr("LOCATION")}</th>
                <th className="px-3 py-2.5 text-start">{tr("ACCOUNTS")}</th>
                <th className="px-3 py-2.5 text-start">{tr("GOODS NAME (BRAND / SIZE)")}</th>
                <th className="px-2.5 py-2.5 text-center">{tr("QTY (UNIT)")}</th>
                <th className="px-3 py-2.5 text-end">{tr("WEIGHT (KG)")}</th>
                <th className="px-3 py-2.5 text-end">{tr("SALES AMOUNT")}</th>
                <th className="px-3 py-2.5 text-center">{tr("PAYMENT / STATUS")}</th>
                <th className="px-2.5 py-2.5 text-center">{tr("ACTIONS")}</th>
              </tr>
              ) : (
                <tr>
                  {["#", "Sales Booking No. / Date", "Location", "User Name (Posted By)", "Purchase DR (Acc. No. / Name)", "Sales CR (Acc. No. / Name)", "Goods Name (Brand / Size)", "Lot Name", "Qty (Unit)", "Weight (KG) Gross / Net", "Exchange Rate", "Amount (Sales / Final)", "Payment Type", "Loading Country / Port", "Received Country / Port", "Dates (Loading / Received)", "Actions"].map((label, index) => (
                    <th key={label} scope="col" className={cn("min-w-14 px-2 py-2 text-start leading-tight", index === 13 && "bg-sky-100 text-sky-950", index === 14 && "bg-emerald-100 text-emerald-950", index === 15 && "bg-violet-100 text-violet-950")}>{tr(label)}</th>
                  ))}
                </tr>
              )}

            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={isLocalSalesPage ? 10 : 17} className="px-4 py-12 text-center text-slate-400 font-semibold">
                    {tr("Loading sales register...")}
                  </td>
                </tr>
              ) : paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={isLocalSalesPage ? 10 : 17} className="px-4 py-12 text-center">
                    <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
                      {isLocalSalesPage ? tr("No local sales bills found yet.") : tr("No sales booking bills found yet.")}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {tr("Click the + New button above to create a new bill (Manual, Scan, Draft, or Voice).")}
                    </p>
                    <button
                      type="button"
                      onClick={openNewEntry}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#16a34a] hover:bg-[#15803d] text-white px-4 py-2 text-xs font-black shadow-sm transition cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      {isLocalSalesPage ? tr("New Local Sale") : tr("New Booking")}
                    </button>
                  </td>
                </tr>
              ) : (
                paginatedRows.map((r, idx) => {
                  const rowNum = (currentPage - 1) * pageSize + idx + 1;
                  const rowKey = String(r.id || rowNum);
                  const transferred = isRowTransferred(r);
                  const rowColorCls = transferred
                    ? "text-slate-900 dark:text-slate-100"
                    : "text-rose-700 dark:text-rose-400 bg-rose-50/25 dark:bg-rose-950/10";
                  const salesAmt = Number(r.totalSalesAmount || r.salesAmount || 0);
                  const finalAmt = Number(r.finalAmount || salesAmt);
                  const isLocal = isRowLocalSale(r);
                  const billNo = r.salesBookingOrderNumber || r.sales_order_no || "—";
                  const superSerialNo = r.superAdminSerialNo || `GBL-${billNo}`;
                  const countrySerialNo = r.countrySerialNo || `CTY-${billNo}`;
                  const branchSerialNo = r.branchSerialNo || `${r.branchCode && r.branchCode !== "-" ? r.branchCode : "BR"}-${billNo}`;
                  const goods0 = r.form_data?.goodsEntries?.[0] || r.form_data?.form || {};
                  const brand = goods0.brand || "";
                  const size = goods0.size || "";

                  if (!isLocalSalesPage) {
                    const form = r.form_data?.form || {};
                    const goods = Array.isArray(r.form_data?.goodsEntries) ? r.form_data.goodsEntries : [];
                    const lots = [...new Set(goods.map((item: any) => item.stockLotNo || item.lotNo).filter(Boolean))];
                    const payment = String(form.paymentType || r.paymentType || "");
                    const advance = /advance/i.test(payment);
                    const paymentLabel = advance && Number(form.advancePercent) > 0
                      ? `${tr("Advance")} (${Number(form.advancePercent)}%)` : tr(advance ? "Advance" : payment || "—");
                    const cell = "border-e border-slate-100 px-2 py-1.5 align-middle dark:border-slate-800";
                    const stacked = (top: React.ReactNode, bottom: React.ReactNode) => <>
                      <div className="font-bold">{top || "—"}</div><div className="text-[10px] text-slate-600 dark:text-slate-300">{bottom || "—"}</div>
                    </>;
                    return (
                      <tr key={rowKey} className="text-[11px] leading-tight hover:bg-blue-50/50 dark:hover:bg-slate-800/50">
                        <td className={cn(cell, "text-center")}>{rowNum}</td>
                        <td className={cn(cell, "whitespace-nowrap font-mono")}>
                          {stacked(<button type="button" className="text-blue-700 hover:underline dark:text-blue-400" onClick={() => openEditOrder(r.id)}>{billNo}</button>, formatDashDate(r.salesDate || r.bookingDate || r.createdAt))}
                        </td>
                        <td className={cell}>{stacked(form.mainBranchName || r.countryName, r.branchName || form.branchName)}</td>
                        <td className={cell}>{form.transferAudit?.userName || r.postedByName || r.createdByName || form.createdByName || "—"}</td>
                        <td className={cell}>{stacked(form.customerAccountNo, form.customerAccountName || r.customerName)}</td>
                        <td className={cell}>{stacked(form.salesAccountNo || r.salesAccountNumber, form.salesAccountName || r.salesAccountName)}</td>
                        <td className={cell}>{stacked(r.productName || goods0.goodsName, [brand, size, goods0.hsCode].filter(Boolean).join(" · "))}</td>
                        <td className={cn(cell, "font-mono")}>{lots.join(", ") || goods0.stockLotNo || goods0.lotNo || "—"}</td>
                        <td className={cn(cell, "whitespace-nowrap text-end tabular-nums")}>{stacked(Number(r.quantity || 0).toLocaleString(lang), r.unit)}</td>
                        <td className={cn(cell, "whitespace-nowrap text-end tabular-nums")}>{stacked(`G ${fmt(Number(r.totalGrossWeight ?? r.totalWeight ?? 0))}`, `N ${fmt(Number(r.totalNetWeight ?? r.totalWeight ?? 0))}`)}</td>
                        <td className={cn(cell, "whitespace-nowrap font-mono")}><bdi>{form.exchangeRate || r.exchange_rate ? `${form.operator === "/" ? "÷ " : ""}${form.exchangeRate || r.exchange_rate}` : "—"}</bdi></td>
                        <td className={cn(cell, "whitespace-nowrap text-end tabular-nums")}>{stacked(`${r.currency || form.salesCurrency || "—"} ${fmt(salesAmt)}`, `${r.finalCurrency || form.secondaryCurrency || r.currency || "—"} ${fmt(r.finalAmount == null ? finalAmt : Number(r.finalAmount))}`)}</td>
                        <td className={cell}><span className={cn("inline-block rounded-md px-1.5 py-1 text-center font-bold", advance ? "bg-blue-100 text-blue-800" : "bg-amber-100 text-amber-900")}>{paymentLabel}</span></td>
                        <td className={cn(cell, "bg-sky-50 dark:bg-sky-950/40")}>{stacked(form.loadingCountry, form.loadingPort)}</td>
                        <td className={cn(cell, "bg-emerald-50 dark:bg-emerald-950/40")}>{stacked(form.receivedCountry || form.receivingCountry, form.receivedPort || form.receivingPort)}</td>
                        <td className={cn(cell, "whitespace-nowrap bg-violet-50 dark:bg-violet-950/40")}>{stacked(formatDashDate(form.loadingDate), formatDashDate(form.receivedDate || form.receivingDate))}</td>
                        <td className={cn(cell, "text-center")}>
                          <ViewportActionMenu
                            ariaLabel={`${tr("Actions")} ${billNo}`}
                            align={isRtl ? "left" : "right"}
                            buttonClassName="inline-flex h-7 w-7 items-center justify-center rounded-full border hover:bg-slate-100 dark:hover:bg-slate-700"
                            menuClassName="w-40 text-xs"
                            trigger={<MoreVertical className="h-4 w-4" />}
                          >
                            {(close) => (
                              <>
                                <button type="button" className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-start font-bold text-blue-700 hover:bg-blue-50 disabled:opacity-50 dark:text-blue-400 dark:hover:bg-slate-800"
                                  disabled={Boolean(form.transferAudit) || r.form_data?.workflow?.transferStatus === "transferred" || !r.id}
                                  onClick={() => { close(); openReview(r.id, true); }}>
                                  <ArrowRightLeft className="h-4 w-4" />{tr("Transfer / Post")}
                                </button>
                                <button type="button" className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-start font-bold hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-slate-800"
                                  disabled={!r.id} onClick={() => { close(); openReview(r.id, false); }}>
                                  <Eye className="h-4 w-4" />{tr("View")}
                                </button>
                              </>
                            )}
                          </ViewportActionMenu>
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr
                      key={rowKey}
                      className={cn(
                        "hover:bg-blue-50/40 dark:hover:bg-slate-800/60 transition-colors",
                        rowColorCls
                      )}
                    >
                      {/* 1. # */}
                      <td className="px-2.5 py-2.5 text-center font-mono text-[11px] text-slate-500 border-r border-slate-100 dark:border-slate-800">
                        {rowNum}
                      </td>

                      {/* 2. Bill No. (with 4-Serial Popover) & Bold Date */}
                      <td className="px-3 py-2 border-r border-slate-100 dark:border-slate-800 whitespace-nowrap">
                        <div className="relative group inline-block">
                          <button
                            type="button"
                            onClick={() => openEditOrder(r.id)}
                            className="font-mono text-xs font-black text-blue-700 hover:underline dark:text-blue-400 cursor-pointer inline-flex items-center gap-1.5"
                          >
                            <span>{billNo}</span>
                            {isLocal && (
                              <span className="rounded bg-amber-100 px-1.5 py-0.2 text-[9px] font-black text-amber-800">
                                LOCAL
                              </span>
                            )}
                          </button>

                          {/* 4-Serial Speech Bubble Popover */}
                          <div className="pointer-events-none opacity-0 group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity duration-150 absolute start-0 bottom-full mb-1.5 z-50 w-64 rounded-xl border border-slate-200 bg-white p-2.5 shadow-2xl dark:border-slate-700 dark:bg-slate-900 text-start">
                            <div className="mb-1.5 text-[10px] font-black uppercase tracking-wider text-blue-700 dark:text-blue-400 border-b border-slate-100 dark:border-slate-800 pb-1">
                              {tr("Serial Information")}
                            </div>
                            <div className="space-y-1 text-[11px]">
                              <div className="flex justify-between gap-2">
                                <span className="text-slate-500">{tr("Super Admin")}:</span>
                                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{superSerialNo}</span>
                              </div>
                              <div className="flex justify-between gap-2">
                                <span className="text-slate-500">{tr("Country")}:</span>
                                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{countrySerialNo}</span>
                              </div>
                              <div className="flex justify-between gap-2">
                                <span className="text-slate-500">{tr("Branch")}:</span>
                                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{branchSerialNo}</span>
                              </div>
                              <div className="flex justify-between gap-2 border-t border-slate-100 dark:border-slate-800 pt-1">
                                <span className="text-slate-500 font-semibold">{tr("Entry/Bill")}:</span>
                                <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{billNo}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="text-[11px] font-bold text-slate-800 dark:text-slate-200 font-mono mt-0.5">
                          {formatDashDate(r.salesDate || r.bookingDate || r.createdAt)}
                        </div>
                      </td>

                      {/* 3. Location: Country, Branch, City stacked */}
                      <td className="px-3 py-2 border-r border-slate-100 dark:border-slate-800 whitespace-nowrap">
                        <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1 leading-tight">
                          <span>{getCountryFlag(r.countryName)}</span>
                          <span>{shortenCountry(r.countryName)}</span>
                        </div>
                        <div className="text-[10px] font-semibold text-blue-700 dark:text-blue-300 leading-tight mt-0.5">
                          {r.branchName || "—"}
                        </div>
                        {r.cityName && r.cityName !== "-" && (
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                            {r.cityName}
                          </div>
                        )}
                      </td>

                      {/* 4. Accounts: Customer (DR) + Sales Account (CR) with message-style popup */}
                      <td className="px-3 py-2 border-r border-slate-100 dark:border-slate-800 whitespace-nowrap relative group" data-sales-account-popup="true">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveAccountPopupId((curr) => (curr === rowKey ? null : rowKey));
                          }}
                          className="text-start w-full cursor-pointer focus:outline-none"
                        >
                          <div className="font-bold text-slate-900 dark:text-slate-100 leading-tight truncate max-w-[165px]" title={r.customerName}>
                            {r.customerName || "—"}
                          </div>
                          <div className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 mt-0.5 leading-tight truncate max-w-[165px]" title={r.salesAccountName}>
                            {r.salesAccountName && r.salesAccountName !== "-" ? r.salesAccountName : "—"}
                          </div>
                        </button>

                        <div
                          className={cn(
                            "absolute start-1/2 -translate-x-1/2 bottom-full mb-2 z-40 w-72 rounded-xl border border-slate-200 bg-white p-3 shadow-2xl dark:border-slate-700 dark:bg-slate-900 text-start text-xs transition-all duration-150 pointer-events-none",
                            activeAccountPopupId === rowKey
                              ? "opacity-100 pointer-events-auto block"
                              : "opacity-0 group-hover:opacity-100 group-hover:pointer-events-auto hidden sm:block"
                          )}
                        >
                          <div className="space-y-1 pb-2 border-b border-slate-100 dark:border-slate-800">
                            <div className="flex items-center justify-between">
                              <span className="inline-flex items-center gap-1 rounded bg-sky-50 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                                👥 {tr("Customer")} (DR)
                              </span>
                              <span className="text-[10px] font-mono text-slate-400">
                                {r.form_data?.form?.customerAccountNo || "—"}
                              </span>
                            </div>
                            <div className="font-bold text-slate-900 dark:text-slate-100">{r.customerName || "—"}</div>
                          </div>
                          <div className="space-y-1 pt-2">
                            <div className="flex items-center justify-between">
                              <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                                🏢 {tr("Sales Account")} (CR)
                              </span>
                              <span className="text-[10px] font-mono text-slate-400">
                                {r.salesAccountNumber && r.salesAccountNumber !== "-" ? r.salesAccountNumber : "—"}
                              </span>
                            </div>
                            <div className="font-bold text-slate-900 dark:text-slate-100">
                              {r.salesAccountName && r.salesAccountName !== "-" ? r.salesAccountName : "—"}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 5. Goods Name (Brand / Size stacked underneath) */}
                      <td className="px-3 py-2 border-r border-slate-100 dark:border-slate-800 whitespace-nowrap max-w-[240px]">
                        <div className="font-bold text-slate-900 dark:text-slate-100 truncate" title={r.productName || r.goodsDescription}>
                          {r.productName || "—"}
                        </div>
                        {(brand || size) ? (
                          <div className="text-[10px] text-slate-500 truncate">
                            {brand ? `Brand: ${brand}` : ""}{brand && size ? " | " : ""}{size ? `Size: ${size}` : ""}
                          </div>
                        ) : r.goodsDescription && r.goodsDescription !== r.productName ? (
                          <div className="text-[10px] text-slate-500 truncate" title={r.goodsDescription}>
                            {r.goodsDescription}
                          </div>
                        ) : null}
                      </td>

                      {/* 6. Qty stacked on top, Unit underneath */}
                      <td className="px-2.5 py-2 text-center border-r border-slate-100 dark:border-slate-800 whitespace-nowrap">
                        <div className="font-mono font-bold text-slate-900 dark:text-slate-100 text-xs">
                          {Number(r.quantity || 0).toLocaleString()}
                        </div>
                        <div className="text-[10px] font-semibold uppercase text-slate-500 dark:text-slate-400">
                          {r.unit || "—"}
                        </div>
                      </td>

                      {/* 7. Gross Wt on top, Net Wt underneath */}
                      <td className="px-3 py-2 text-end font-mono border-r border-slate-100 dark:border-slate-800 whitespace-nowrap">
                        <div className="font-bold text-slate-900 dark:text-slate-100">
                          {fmt(Number(r.totalGrossWeight || r.totalWeight || 0))}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {fmt(Number(r.totalNetWeight || r.totalWeight || 0))}
                        </div>
                      </td>

                      {/* 8. Sales Amount (Sales Currency + Final Currency) */}
                      <td className="px-3 py-2 text-end font-mono border-r border-slate-100 dark:border-slate-800 whitespace-nowrap">
                        <div className="font-black text-slate-900 dark:text-slate-100">
                          <span className="text-[10px] opacity-70 me-1">{r.currency || "AED"}</span>
                          {fmt(salesAmt)}
                        </div>
                        {r.finalCurrency && r.finalCurrency !== r.currency && (
                          <div className="text-[10px] font-bold text-blue-700 dark:text-blue-400">
                            <span className="text-[9px] opacity-70 me-1">{r.finalCurrency}</span>
                            {fmt(finalAmt)}
                          </div>
                        )}
                      </td>

                      {/* 9. Consolidated Payment & Transfer Status */}
                      <td className="px-3 py-2 text-center border-r border-slate-100 dark:border-slate-800 whitespace-nowrap">
                        <div className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800 capitalize">
                          {r.paymentStatus || "Pending"}
                        </div>
                        <div className="mt-1">
                          {transferred ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-950 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white dark:bg-emerald-700">
                              <CheckCircle2 className="h-2.5 w-2.5 text-emerald-400" />
                              {tr("TRANSFERRED")}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-rose-700">
                              <Clock className="h-2.5 w-2.5" />
                              {tr("AWAITING TRANSFER")}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 10. Actions (Three-dot menu with View Invoice, Edit Order) */}
                      <td className="px-2.5 py-2 text-center whitespace-nowrap" data-sales-row-menu="true">
                        <div className="relative inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setInvoiceRow(r)}
                            title={tr("View Invoice")}
                            className="inline-flex items-center justify-center h-7 w-7 rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveRowMenuId((curr) => (curr === rowKey ? null : rowKey));
                            }}
                            title={tr("Actions")}
                            className="inline-flex items-center justify-center h-7 w-7 rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 cursor-pointer"
                          >
                            <MoreVertical className="h-3.5 w-3.5" />
                          </button>

                          {activeRowMenuId === rowKey && (
                            <div className="absolute end-0 top-full mt-1 z-50 w-44 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-800 dark:bg-slate-900 text-start text-xs">
                              <button
                                type="button"
                                onClick={() => {
                                  setInvoiceRow(r);
                                  setActiveRowMenuId(null);
                                }}
                                className="w-full px-2.5 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold flex items-center gap-2 cursor-pointer"
                              >
                                <FileText className="h-3.5 w-3.5 text-blue-600" />
                                <span>{tr("View Invoice")}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveRowMenuId(null);
                                  openEditOrder(r.id);
                                }}
                                className="w-full px-2.5 py-1.5 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-950/40 text-amber-700 dark:text-amber-300 font-semibold flex items-center gap-2 cursor-pointer"
                              >
                                <Pencil className="h-3.5 w-3.5 text-amber-500" />
                                <span>{tr("Open / Edit")}</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Clean Pagination Footer (20 / 25 / 50 / 100 per page — no yellow total bar) */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/80 px-4 py-2.5 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
          <div>
            {tr("Showing")}{" "}
            <strong className="text-slate-700 dark:text-slate-200">
              {sortedRows.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}–
              {Math.min(sortedRows.length, currentPage * pageSize)}
            </strong>{" "}
            {tr("of")} <strong className="text-slate-700 dark:text-slate-200">{sortedRows.length}</strong>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span>{tr("Rows per page")}:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="h-7 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <option value={20}>20</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="h-7 px-2.5 rounded-lg border border-slate-200 bg-white disabled:opacity-40 text-xs font-semibold inline-flex items-center gap-1 dark:border-slate-700 dark:bg-slate-800 cursor-pointer"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                <span>{tr("Previous")}</span>
              </button>
              <span className="h-7 min-w-7 px-2 rounded-lg bg-blue-600 text-white font-bold inline-flex items-center justify-center text-xs">
                {currentPage}
              </span>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="h-7 px-2.5 rounded-lg border border-slate-200 bg-white disabled:opacity-40 text-xs font-semibold inline-flex items-center gap-1 dark:border-slate-700 dark:bg-slate-800 cursor-pointer"
              >
                <span>{tr("Next")}</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Full A4 Sales Invoice View Modal */}
      {review && <SalesBookingTransferReport
        open onClose={() => setReview(null)} lang={lang} order={reviewOrder ?? undefined}
        form={reviewOrder?.form_data?.form} goods={Array.isArray(reviewOrder?.form_data?.goodsEntries) ? reviewOrder.form_data.goodsEntries : []}
        confirmation={reviewConfirmation} busy={reviewBusy} error={reviewError}
        onPost={review.allowPost && reviewOrder ? postReviewedOrder : undefined}
      />}
      {invoiceRow && (
        <InvoiceDocumentView
          isOpen={Boolean(invoiceRow)}
          onClose={() => setInvoiceRow(null)}
          title={`${tr("Sales Booking Invoice")} — ${invoiceRow.salesBookingOrderNumber || invoiceRow.sales_order_no || ""}`}
          source="sales_order"
          record={selectedInvoiceRecord}
          scope={selectedInvoiceScope}
          companyId={invoiceRow.form_data?.form?.salesCompanyId || null}
        />
      )}
    </div>
  );
}
