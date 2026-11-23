"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ShoppingBag,
  Crown,
  ChevronDown,
  FileSpreadsheet,
  Printer,
  Eye,
  MoreVertical,
  Pencil,
  Search,
  RefreshCw,
  Sparkles,
  Plus,
  Download,
  CheckCircle2,
  Clock,
  Store,
} from "lucide-react";
import { translateHeader } from "@/lib/i18n/table-headers";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { cn } from "@/lib/utils";
import { apiGet } from "@/lib/api/client";
import { openUniversalPrintReport } from "@/lib/reports/universal-print-engine";
import { EntryMethodSelector } from "@/features/document-intelligence/components/entry-method-selector";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SalesOrderWizard } from "@/features/sales/components/sales-order-wizard.jsx";

function nameAndCode(name?: string, code?: string) {
  return [name, code].filter(value => value && value !== "-").join(" · ") || "—";
}

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
  const [reviewRow, setReviewRow] = useState<any>(null);
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

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
      if (reportsRef.current && !reportsRef.current.contains(e.target as Node)) {
        setReportsOpen(false);
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
        `/api/erp/sales/booking-journal-report?limit=250&lang=${encodeURIComponent(lang)}`
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

  const isRowLocalSale = useCallback((r: any) => {
    const form = r?.form_data?.form || {};
    const src = String(form.saleSource || r?.form_data?.saleSource || "").toLowerCase();
    const mode = String(form.saleMode || r?.form_data?.saleMode || "").toLowerCase();
    return mode !== "export" && (src === "local" || mode === "local");
  }, []);

  const isRowTransferred = useCallback((r: any) => {
    if (typeof r?.isTransferred === "boolean") return r.isTransferred;
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
          r.customerName,
          r.salesAccountName,
          r.productName,
          r.goodsDescription,
          r.countryName,
          r.countryCode,
          r.countryMainBranchName,
          r.countryMainBranchCode,
          r.cityBranchName,
          r.cityBranchCode,
          r.purchaseAccountName,
          r.purchaseAccountNumber,
          r.superAdminSerialNo,
          r.countrySerialNo,
          r.branchSerialNo,
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

  // Summary metrics
  const summary = useMemo(() => {
    let totalBills = filteredRows.length;
    const money = new Map<string, { sales: number; paid: number; remaining: number }>();
    let completed = 0;
    let partial = 0;
    let pending = 0;
    let totalQty = 0;
    let totalGross = 0;
    let totalNet = 0;

    filteredRows.forEach((r) => {
      const amt = Number(r.finalAmount ?? 0);
      const paid = Number(r.paid_amount || 0);
      const rem = r.remaining_amount != null ? Number(r.remaining_amount) : Math.max(0, amt - paid);

      if (r.finalCurrency) {
        const entry = money.get(r.finalCurrency) ?? { sales: 0, paid: 0, remaining: 0 };
        entry.sales += amt;
        entry.paid += paid;
        entry.remaining += rem;
        money.set(r.finalCurrency, entry);
      }
      totalQty += Number(r.quantity || 0);
      totalGross += Number(r.totalGrossWeight || r.totalWeight || 0);
      totalNet += Number(r.totalNetWeight || r.totalWeight || 0);

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
      money,
      completed,
      completedPct: totalBills > 0 ? ((completed / totalBills) * 100).toFixed(1) : "0.0",
      partial,
      partialPct: totalBills > 0 ? ((partial / totalBills) * 100).toFixed(1) : "0.0",
      pending,
      pendingPct: totalBills > 0 ? ((pending / totalBills) * 100).toFixed(1) : "0.0",
      totalQty,
      totalGross,
      totalNet,
    };
  }, [filteredRows, isRowTransferred]);

  const countryMetrics = useMemo(() => {
    const map = new Map<
      string,
      { country: string; currency: string; bills: number; salesAmount: number; paidAmount: number }
    >();
    filteredRows.forEach((r) => {
      const country = r.countryName && r.countryName !== "-" ? r.countryName : "—";
      const currency = r.finalCurrency || "—";
      const key = `${country}:${currency}`;
      const entry = map.get(key) || {
        country,
        currency,
        bills: 0,
        salesAmount: 0,
        paidAmount: 0,
      };
      entry.bills += 1;
      entry.salesAmount += Number(r.finalAmount ?? 0);
      entry.paidAmount += Number(r.paid_amount || 0);
      map.set(key, entry);
    });
    return Array.from(map.values()).sort((a, b) => b.bills - a.bills);
  }, [filteredRows]);

  const fmt = (n: number) =>
    Number(n || 0).toLocaleString(lang, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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

  const displayAmount = (amount: number | null | undefined, currency: string | null | undefined) =>
    amount == null || !currency ? "—" : `${currency} ${fmt(amount)}`;
  const purchaseAmountLabel = (row: any) => row.purchaseAmounts?.length
    ? row.purchaseAmounts.map(({ amount, currency }: { amount: number; currency: string }) => displayAmount(amount, currency)).join(" / ")
    : displayAmount(row.purchaseAmount, row.purchaseCurrency);
  const purchaseAccountLabel = (row: any) => row.localPurchaseAccounts?.length
    ? row.localPurchaseAccounts.map(({ name, code }: { name: string; code: string }) => nameAndCode(name, code)).join(" / ")
    : nameAndCode(row.purchaseAccountName, row.purchaseAccountNumber);
  const rateLabel = (row: any) => {
    if (!(row.exchange_rate > 0) || !row.currency || !row.finalCurrency) return "—";
    const rate = Number(row.exchange_rate).toLocaleString(lang, { maximumFractionDigits: 8 });
    if (row.currency === row.finalCurrency) return rate;
    const operator = row.exchangeRateOperator === "/" ? "÷" : "×";
    return `${row.currency} ${operator} ${rate} → ${row.finalCurrency}`;
  };
  const combinedAmounts = (field: "sales" | "paid" | "remaining") =>
    Array.from(summary.money, ([currency, amounts]) => <bdi key={currency} className="block">{displayAmount(amounts[field], currency)}</bdi>);

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
          <SalesOrderWizard session={session} />
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
      {/* 1. Top Control Bar */}
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
                  className="w-full text-start rounded-lg px-3 py-2 text-xs font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  {tr("Sales Booking Journal")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setReportsOpen(false);
                    router.push("/dashboard/sales/sales-confirm" as any);
                  }}
                  className="w-full text-start rounded-lg px-3 py-2 text-xs font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  {tr("Confirmed Sales Orders")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setReportsOpen(false);
                    handleExportCsv();
                  }}
                  className="w-full text-start rounded-lg px-3 py-2 text-xs font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-700 dark:text-slate-200 dark:hover:bg-slate-800 flex items-center gap-2"
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

      {/* 2. KPI Summary Strip (Matching Purchase Booking 3-Card Layout) */}
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
            <div className="flex items-center justify-between">
              <span className="text-slate-500">{tr("Total Sales")}</span>
              <span className="font-black text-blue-700 dark:text-blue-400">{combinedAmounts("sales")}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">{tr("Total Paid")}</span>
              <span className="font-bold text-emerald-700 dark:text-emerald-400">{combinedAmounts("paid")}</span>
            </div>
            <div className="mt-1.5 flex items-center justify-between rounded-lg bg-amber-50 px-2.5 py-1.5 dark:bg-amber-950/40">
              <span className="font-bold text-amber-900 dark:text-amber-300">{tr("Balance (Remaining)")}</span>
              <span className="font-black text-amber-900 dark:text-amber-300">{combinedAmounts("remaining")}</span>
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
                    <tr key={`${cm.country}:${cm.currency}`}>
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

      <Dialog open={Boolean(reviewRow)} onOpenChange={open => { if (!open) setReviewRow(null); }}>
        {reviewRow && (
          <DialogContent dir={isRtl ? "rtl" : "ltr"} className="max-h-[85dvh] w-[calc(100%-1.5rem)] overflow-y-auto rounded-xl">
            <DialogTitle>{tr("Sales Booking Invoice")} · <bdi>{reviewRow.salesBookingOrderNumber}</bdi></DialogTitle>
            <dl className="grid gap-2 text-sm">
              {[
                ["Customer", nameAndCode(reviewRow.customerName, reviewRow.customerAccountNumber)],
                ["Sales Account", nameAndCode(reviewRow.salesAccountName, reviewRow.salesAccountNumber)],
                ["Purchase Account", purchaseAccountLabel(reviewRow)],
                ["Goods / Description", reviewRow.goodsDescription],
                ["Quantity", reviewRow.quantity == null ? "—" : `${reviewRow.quantity} ${reviewRow.unit === "-" ? "" : reviewRow.unit}`],
                ["Gross Weight", reviewRow.totalGrossWeight == null ? "—" : fmt(reviewRow.totalGrossWeight)],
                ["Net Weight", reviewRow.totalNetWeight == null ? "—" : fmt(reviewRow.totalNetWeight)],
                ["Purchase Amount", purchaseAmountLabel(reviewRow)],
                ["Sales Amount", displayAmount(reviewRow.totalSalesAmount, reviewRow.currency)],
                ["Exchange Rate", rateLabel(reviewRow)],
                ["Final Amount", displayAmount(reviewRow.finalAmount, reviewRow.finalCurrency)],
              ].map(([label, value]) => (
                <div key={label} className="grid grid-cols-[2fr_3fr] gap-2">
                  <dt className="font-bold">{tr(label)}</dt><dd className="break-words"><bdi>{value || "—"}</bdi></dd>
                </div>
              ))}
            </dl>
          </DialogContent>
        )}
      </Dialog>

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
              <tr>
                <th className="px-3 py-2.5 text-center w-10">#</th>
                <th className="px-3 py-2.5 text-start">{tr("BILL NO. / DATE")}</th>
                <th className="px-3 py-2.5 text-start">{tr("Country / Main Branch / City Branch")}</th>
                <th className="px-3 py-2.5 text-start">{tr("Customer / Sales & Purchase Accounts")}</th>
                <th className="px-3 py-2.5 text-start">{tr("GOODS NAME (BRAND / SIZE)")}</th>
                <th className="px-3 py-2.5 text-end">{tr("QTY (UNIT)")}</th>
                <th className="px-3 py-2.5 text-end">{tr("WEIGHT (KG)")}</th>
                <th className="px-3 py-2.5 text-end">{tr("Amounts / Exchange Rate")}</th>
                <th className="px-3 py-2.5 text-center">{tr("PAYMENT")}</th>
                <th className="px-3 py-2.5 text-center">{tr("TRANSFER STATUS")}</th>
                <th className="px-3 py-2.5 text-center">{tr("ACTIONS")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={11} className="px-4 py-12 text-center text-slate-400 font-semibold">
                    {tr("Loading sales register...")}
                  </td>
                </tr>
              ) : sortedRows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-12 text-center">
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
                sortedRows.map((r, idx) => {
                  const transferred = isRowTransferred(r);
                  const rowColorCls = transferred
                    ? "text-slate-900 dark:text-slate-100"
                    : "text-rose-700 dark:text-rose-400 bg-rose-50/30 dark:bg-rose-950/10";
                  const salesAmt = r.totalSalesAmount ?? r.salesAmount;
                  const isLocal = isRowLocalSale(r);

                  return (
                    <tr
                      key={r.id}
                      className={cn(
                        "hover:bg-blue-50/40 dark:hover:bg-slate-800/60 transition-colors",
                        rowColorCls
                      )}
                    >
                      <td className="px-3 py-2.5 text-center font-mono text-[11px] text-slate-500">
                        {idx + 1}
                      </td>
                      <td className="px-3 py-2.5">
                        <Popover>
                          <PopoverTrigger asChild>
                            <button type="button" className="block whitespace-nowrap text-start font-mono text-xs font-black text-blue-700 hover:underline dark:text-blue-400">
                              <bdi>{r.salesBookingOrderNumber || r.sales_order_no || "—"}</bdi>
                            </button>
                          </PopoverTrigger>
                          <PopoverContent dir={isRtl ? "rtl" : "ltr"} align="start" className="max-w-[calc(100vw-1rem)] space-y-2 p-3 text-xs">
                            <div className="font-black">{tr("Bill serial numbers")}</div>
                            <dl className="space-y-1.5">
                              {[
                                ["Super Admin", r.superAdminSerialNo],
                                ["Country Admin", r.countrySerialNo],
                                ["Country Main Branch", r.countryMainBranchSerialNo],
                                ["City Branch", r.cityBranchSerialNo],
                                ["Original bill number", r.systemBillNumber],
                              ].map(([label, value]) => (
                                <div key={label} className="flex justify-between gap-2">
                                  <dt>{tr(label)}</dt><dd className="break-all text-end font-mono font-bold"><bdi>{value && value !== "-" ? value : "—"}</bdi></dd>
                                </div>
                              ))}
                            </dl>
                          </PopoverContent>
                        </Popover>
                        <div className="mt-0.5 whitespace-nowrap text-[10px] text-slate-500">{formatDashDate(r.salesDate || r.bookingDate || r.createdAt)}</div>
                        <div className="text-[10px] font-bold">{isLocal ? tr("Local Sales") : (r.form_data?.form?.saleMode || r.form_data?.saleMode) === "export" ? tr("Export Sales") : tr("Sales Booking")}</div>
                      </td>
                      <td className="px-3 py-2.5 min-w-36">
                        <div className="font-bold">{nameAndCode(r.countryName, r.countryCode)}</div>
                        <div className="text-[10px] text-slate-500">{tr("Country Main Branch")} · <bdi>{nameAndCode(r.countryMainBranchName, r.countryMainBranchCode)}</bdi></div>
                        <div className="text-[10px] text-slate-500">{tr("City Branch")} · <bdi>{nameAndCode(r.cityBranchName, r.cityBranchCode)}</bdi></div>
                      </td>
                      <td className="px-3 py-2.5 min-w-36 max-w-52">
                        {[
                          ["Customer", r.customerName, r.customerAccountNumber],
                          ["Sales Account", r.salesAccountName, r.salesAccountNumber],
                          ["Purchase Account", purchaseAccountLabel(r), undefined],
                        ].map(([label, name, code]) => (
                          <div key={label} title={nameAndCode(name, code)} className="truncate text-[10px]">
                            <span className="text-slate-500">{tr(label)} · </span><bdi className="font-bold">{nameAndCode(name, code)}</bdi>
                          </div>
                        ))}
                      </td>
                      <td className="px-3 py-2.5 max-w-[240px]">
                        <div className="font-bold truncate" title={r.productName || r.goodsDescription}>
                          {r.productName || "—"}
                        </div>
                        {r.goodsDescription && r.goodsDescription !== r.productName && (
                          <div className="text-[10px] text-slate-500 truncate" title={r.goodsDescription}>
                            {r.goodsDescription}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-end font-mono font-bold">
                        {r.quantity == null ? "—" : Number(r.quantity).toLocaleString(lang)}{" "}
                        <span className="text-[10px] font-normal text-slate-500">{r.unit !== "-" ? r.unit : ""}</span>
                      </td>
                      <td className="px-3 py-2.5 text-end font-mono whitespace-nowrap">
                        <div>{tr("Gross Weight")} · <bdi>{r.totalGrossWeight == null ? "—" : fmt(r.totalGrossWeight)}</bdi></div>
                        <div className="text-[10px] text-slate-500">{tr("Net Weight")} · <bdi>{r.totalNetWeight == null ? "—" : fmt(r.totalNetWeight)}</bdi></div>
                      </td>
                      <td className="px-3 py-2.5 text-end whitespace-nowrap text-[10px]">
                        <div>{tr("Purchase Amount")} · <bdi className="font-mono">{purchaseAmountLabel(r)}</bdi></div>
                        <div>{tr("Sales Amount")} · <bdi className="font-mono">{displayAmount(salesAmt, r.currency)}</bdi></div>
                        <div>{tr("Exchange Rate")} · <bdi dir="ltr" className="font-mono">{rateLabel(r)}</bdi></div>
                        <div className="font-black">{tr("Final Amount")} · <bdi className="font-mono">{displayAmount(r.finalAmount, r.finalCurrency)}</bdi></div>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className="inline-block rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                          {r.paymentStatus || "Pending"}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {transferred ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-2.5 py-0.5 text-[10px] font-black text-white dark:bg-emerald-700">
                            <CheckCircle2 className="h-3 w-3" />
                            {tr("TRANSFERRED")}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full border border-rose-300 bg-rose-50 px-2.5 py-0.5 text-[10px] font-black text-rose-700">
                            <Clock className="h-3 w-3" />
                            {tr("AWAITING TRANSFER")}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <div className="inline-flex items-center gap-1">
                          {r.canEdit === true && (
                            <button type="button" onClick={() => openEditOrder(r.id)} className="inline-flex min-h-8 items-center gap-1 rounded-md border border-slate-200 px-2 font-bold hover:bg-blue-50 dark:border-slate-700 dark:hover:bg-slate-800">
                              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />{tr("Edit")}
                            </button>
                          )}
                          <DropdownMenu.Root dir={isRtl ? "rtl" : "ltr"}>
                            <DropdownMenu.Trigger asChild>
                              <button type="button" aria-label={tr("Actions")} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 hover:bg-blue-50 dark:border-slate-700 dark:hover:bg-slate-800">
                                <MoreVertical className="h-4 w-4" aria-hidden="true" />
                              </button>
                            </DropdownMenu.Trigger>
                            <DropdownMenu.Portal>
                              <DropdownMenu.Content style={{ direction: isRtl ? "rtl" : "ltr" }} align="end" sideOffset={4} className="z-50 min-w-36 rounded-lg border bg-background p-1 text-xs shadow-lg">
                                <DropdownMenu.Item onSelect={() => setReviewRow(r)} className="flex cursor-pointer items-center gap-2 rounded px-2 py-2 outline-none data-[highlighted]:bg-accent">
                                  <Eye className="h-3.5 w-3.5" aria-hidden="true" />{tr("View")}
                                </DropdownMenu.Item>
                                <DropdownMenu.Item onSelect={() => {
                              openUniversalPrintReport({
                                title: tr("Sales Booking Invoice"),
                                subtitle: `${tr("SO Ref")}: ${r.salesBookingOrderNumber || "-"}`,
                                documentNo: r.salesBookingOrderNumber || "SO-DOC",
                                reportType: "single_document",
                                moduleType: "sales_invoice",
                                orientation: "portrait",
                                lang,
                                scope: {
                                  scopeLevel: "Sales Booking Invoice",
                                  country: r.countryName || "All Countries",
                                  branch: r.branchName || "Main Branch",
                                  currency: r.currency || "",
                                  userName: r.audit?.userName || "",
                                },
                                partyDetails: {
                                  type: "customer",
                                  name: r.customerName || "-",
                                  address: r.countryName || "-",
                                  departmentOrBranch: r.branchName || "-",
                                },
                                kpis: [
                                  { label: tr("Total Amount"), value: displayAmount(salesAmt, r.currency), color: "blue" },
                                  { label: tr("Quantity"), value: `${Number(r.quantity || 0).toLocaleString()} ${r.unit || ""}`, color: "emerald" },
                                  { label: tr("Status"), value: r.status || "PENDING", color: "amber" },
                                ],
                                columns: [
                                  { key: "item", label: tr("Goods / Description"), width: "45%" },
                                  { key: "qty", label: tr("Quantity"), align: "right", width: "20%" },
                                  { key: "amount", label: tr("Total Amount"), align: "right", format: "currency", width: "35%" },
                                ],
                                rows: [
                                  {
                                    item: r.goodsDescription || r.productName || "-",
                                    qty: `${Number(r.quantity || 0).toLocaleString()} ${r.unit || ""}`,
                                    amount: salesAmt ?? "",
                                  },
                                ],
                                autoPrint: false,
                              });
                                }} className="flex cursor-pointer items-center gap-2 rounded px-2 py-2 outline-none data-[highlighted]:bg-accent">
                                  <Printer className="h-3.5 w-3.5" aria-hidden="true" />{tr("Print Invoice")}
                                </DropdownMenu.Item>
                              </DropdownMenu.Content>
                            </DropdownMenu.Portal>
                          </DropdownMenu.Root>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {sortedRows.length > 0 && (
              <tfoot className="bg-amber-50/70 font-black text-slate-900 border-t-2 border-slate-300 dark:bg-slate-800 dark:text-white dark:border-slate-700">
                <tr>
                  <td colSpan={5} className="px-3 py-2.5 text-xs">
                    {tr("Total")} ({sortedRows.length} {tr("Bills")})
                  </td>
                  <td className="px-3 py-2.5 text-end font-mono">
                    {summary.totalQty.toLocaleString()}
                  </td>
                  <td className="px-3 py-2.5 text-end font-mono">
                    {fmt(summary.totalGross)}
                  </td>
                  <td className="px-3 py-2.5 text-end font-mono">
                    {Object.entries(sortedRows.reduce<Record<string, number>>((totals, row) => {
                      if (row.currency && row.totalSalesAmount != null) {
                        totals[row.currency] = (totals[row.currency] ?? 0) + row.totalSalesAmount;
                      }
                      return totals;
                    }, {})).map(([currency, total]) => <bdi key={currency} className="block">{displayAmount(total, currency)}</bdi>)}
                  </td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
