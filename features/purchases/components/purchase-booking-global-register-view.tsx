"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ShoppingCart,
  Crown,
  ChevronDown,
  Filter,
  SlidersHorizontal,
  Check,
  CheckCircle2,
  MoreVertical,
  Maximize2,
  Minimize2,
  Printer,
  FileSpreadsheet,
  FileText,
  Download,
  RotateCcw,
  Eye,
  Calendar,
  Globe,
  Building2,
  User,
  Layers,
  Search,
  RefreshCw,
  X,
  Sparkles,
  ArrowRight,
  BookOpen,
  Scale,
  CreditCard,
  Grid
} from "lucide-react";
import { translateHeader } from "@/lib/i18n/table-headers";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { cn } from "@/lib/utils";
import { DetailDrawer } from "@/components/ui/detail-drawer";
import { OpenFullBillModal } from "@/components/invoices/open-full-bill-modal";
import { PurchaseOrderWizard } from "@/features/purchases/components/purchase-order-wizard.jsx";

interface PurchaseBookingGlobalRegisterViewProps {
  session: any;
  lang?: string;
  initialPurchaseId?: string | null;
}

export function PurchaseBookingGlobalRegisterView({
  session,
  lang: propLang,
  initialPurchaseId = null,
}: PurchaseBookingGlobalRegisterViewProps) {
  const activeLang = useActiveLanguage();
  const lang = propLang || activeLang || "en";
  const tr = useCallback((key: string) => translateHeader(lang, key), [lang]);
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);

  const router = useRouter();
  const searchParams = useSearchParams();
  const modeParam = searchParams.get("mode");
  const idParam = searchParams.get("id") || searchParams.get("purchaseId") || initialPurchaseId;

  // Form mode vs Register mode
  const [isFormMode, setIsFormMode] = useState<boolean>(() => modeParam === "new" || Boolean(idParam));

  useEffect(() => {
    if (modeParam === "new" || idParam) {
      setIsFormMode(true);
    } else {
      setIsFormMode(false);
    }
  }, [modeParam, idParam]);

  // Data states
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [usdRates, setUsdRates] = useState<Record<string, number>>({});
  const [selectedRow, setSelectedRow] = useState<any | null>(null);
  const [fullBillRow, setFullBillRow] = useState<any | null>(null);
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);

  // UI Menus & Popups
  const [reportsOpen, setReportsOpen] = useState<boolean>(false);
  const [actionsOpen, setActionsOpen] = useState<boolean>(false);
  const [filterModalOpen, setFilterModalOpen] = useState<boolean>(false);
  const [isFullScreen, setIsFullScreen] = useState<boolean>(false);
  const [activeRowMenuId, setActiveRowMenuId] = useState<string | null>(null);

  // Filters
  const [filterDateFrom, setFilterDateFrom] = useState<string>("");
  const [filterDateTo, setFilterDateTo] = useState<string>("");
  const [filterCountry, setFilterCountry] = useState<string>("all");
  const [filterBranch, setFilterBranch] = useState<string>("all");
  const [filterSupplier, setFilterSupplier] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const reportsRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);

  // Close menus on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (reportsRef.current && !reportsRef.current.contains(e.target as Node)) {
        setReportsOpen(false);
      }
      if (actionsRef.current && !actionsRef.current.contains(e.target as Node)) {
        setActionsOpen(false);
      }
      const target = e.target as HTMLElement | null;
      if (!target?.closest("[data-row-menu]")) {
        setActiveRowMenuId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch reports from genuine API
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/erp/purchases/booking-journal-report?limit=1500", { cache: "no-store" });
      const json = await res.json();
      if (json.ok && json.data) {
        setReports(json.data.reports || []);
        if (json.data.usdRates) setUsdRates(json.data.usdRates);
      }
    } catch (err) {
      console.error("Failed to load purchase booking reports:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Distinct filter options
  const filterOptions = useMemo(() => {
    const countries = new Set<string>();
    const branches = new Set<string>();
    const suppliers = new Set<string>();
    const statuses = new Set<string>();

    reports.forEach((r) => {
      if (r.countryName && r.countryName !== "-") countries.add(r.countryName);
      if (r.branchName && r.branchName !== "-") branches.add(r.branchName);
      if (r.supplierName && r.supplierName !== "-") suppliers.add(r.supplierName);
      if (r.status && r.status !== "-") statuses.add(r.status);
    });

    return {
      countries: Array.from(countries).sort(),
      branches: Array.from(branches).sort(),
      suppliers: Array.from(suppliers).sort(),
      statuses: Array.from(statuses).sort(),
    };
  }, [reports]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    return reports.filter((r) => {
      if (filterCountry !== "all" && r.countryName !== filterCountry) return false;
      if (filterBranch !== "all" && r.branchName !== filterBranch) return false;
      if (filterSupplier !== "all" && r.supplierName !== filterSupplier) return false;
      if (filterStatus !== "all" && String(r.status).toLowerCase() !== filterStatus.toLowerCase()) return false;

      if (filterDateFrom) {
        const d = r.purchaseDate || r.bookingDate || r.createdAt;
        if (d && new Date(d) < new Date(filterDateFrom)) return false;
      }
      if (filterDateTo) {
        const d = r.purchaseDate || r.bookingDate || r.createdAt;
        if (d && new Date(d) > new Date(filterDateTo + "T23:59:59")) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const bNo = String(r.purchaseBookingOrderNumber || r.purchase_order_no || r.billNumber || "").toLowerCase();
        const sName = String(r.supplierName || "").toLowerCase();
        const gName = String(r.productName || r.goodsDescription || "").toLowerCase();
        const origin = String(r.form_data?.form?.originCountry || r.form_data?.goodsEntries?.[0]?.origin || "").toLowerCase();
        if (!bNo.includes(q) && !sName.includes(q) && !gName.includes(q) && !origin.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [reports, filterCountry, filterBranch, filterSupplier, filterStatus, filterDateFrom, filterDateTo, searchQuery]);

  // Card 1: Purchase Booking Summary calculations
  const summaryMetrics = useMemo(() => {
    let totalPurchUSD = 0;
    let totalPaidUSD = 0;
    let completedCount = 0;
    let pendingCount = 0;

    filteredRows.forEach((r) => {
      const cur = String(r.currency || "USD").toUpperCase();
      const rate = cur === "USD" ? 1 : (usdRates[cur] || Number(r.exchange_rate) || 1);
      const purchAmt = Number(r.purchaseAmount || r.totalPurchaseAmount || 0);
      const paidAmt = Number(r.advance_paid || 0) + Number(r.remaining_paid || 0);

      // Convert to USD representation for summary
      const pUSD = cur === "USD" ? purchAmt : (rate > 0 ? purchAmt / rate : purchAmt);
      const pdUSD = cur === "USD" ? paidAmt : (rate > 0 ? paidAmt / rate : paidAmt);

      totalPurchUSD += pUSD;
      totalPaidUSD += pdUSD;

      const st = String(r.status || "").toLowerCase();
      const isCompleted = st === "completed" || st === "posted" || st === "received" || st === "transferred" || (purchAmt > 0 && paidAmt >= purchAmt - 0.05);
      if (isCompleted) {
        completedCount++;
      } else {
        pendingCount++;
      }
    });

    const balanceUSD = Math.max(0, totalPurchUSD - totalPaidUSD);

    return {
      totalBills: filteredRows.length,
      totalPurchase: totalPurchUSD,
      totalPaid: totalPaidUSD,
      completed: completedCount,
      pending: pendingCount,
      balance: balanceUSD,
    };
  }, [filteredRows, usdRates]);

  // Card 2: Booking Status breakdown
  const statusMetrics = useMemo(() => {
    let completed = 0;
    let partial = 0;
    let pending = 0;
    const total = filteredRows.length;

    filteredRows.forEach((r) => {
      const purchAmt = Number(r.purchaseAmount || r.totalPurchaseAmount || 0);
      const paidAmt = Number(r.advance_paid || 0) + Number(r.remaining_paid || 0);
      const st = String(r.status || "").toLowerCase();

      if (st === "completed" || st === "posted" || st === "received" || st === "transferred" || (purchAmt > 0 && paidAmt >= purchAmt - 0.05)) {
        completed++;
      } else if (paidAmt > 0.05) {
        partial++;
      } else {
        pending++;
      }
    });

    return {
      completed,
      completedPct: total > 0 ? ((completed / total) * 100).toFixed(1) : "0.0",
      partial,
      partialPct: total > 0 ? ((partial / total) * 100).toFixed(1) : "0.0",
      pending,
      pendingPct: total > 0 ? ((pending / total) * 100).toFixed(1) : "0.0",
      total,
    };
  }, [filteredRows]);

  // Card 3: Country Wise breakdown (Final Currency Wise)
  const countryMetrics = useMemo(() => {
    const map = new Map<string, { country: string; currency: string; bills: number; purchaseAmount: number; paidAmount: number }>();

    filteredRows.forEach((r) => {
      const rawCountry = String(r.countryName || r.form_data?.form?.destinationCountry || "UAE").trim();
      const country = shortenCountry(rawCountry);
      const exRate = Number(r.exchange_rate || r.form_data?.form?.exchangeRate || 1);
      const finalCurr = String(r.finalCurrency || r.form_data?.form?.secondaryCurrency?.split(" ")?.[0] || (country.includes("Pakistan") ? "PKR" : country.includes("Afghanistan") ? "AFN" : country.includes("Iran") ? "IRR" : country.includes("China") ? "CNY" : "AED")).toUpperCase();

      const purchPC = Number(r.purchaseAmount || r.totalPurchaseAmount || 0);
      const paidPC = Number(r.advance_paid || 0) + Number(r.remaining_paid || 0);

      const purchFC = r.finalAmount ? Number(r.finalAmount) : purchPC * exRate;
      const paidFC = paidPC * exRate;

      const entry = map.get(country) || {
        country,
        currency: finalCurr,
        bills: 0,
        purchaseAmount: 0,
        paidAmount: 0,
      };

      entry.bills += 1;
      entry.purchaseAmount += purchFC;
      entry.paidAmount += paidFC;
      map.set(country, entry);
    });

    // Sort by bills descending
    return Array.from(map.values()).sort((a, b) => b.bills - a.bills);
  }, [filteredRows]);

  // Format helpers
  const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtInt = (n: number) => n.toLocaleString();

  const formatDashDate = (val: any) => {
    if (!val) return "—";
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val).slice(0, 10) || "—";
    const day = String(d.getDate()).padStart(2, "0");
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const mon = months[d.getMonth()];
    const yr = d.getFullYear();
    return `${day}-${mon}-${yr}`;
  };

  const shortenCountry = (c: string) => {
    if (!c) return "—";
    const s = String(c).trim();
    if (s.toLowerCase().includes("united arab emirates") || s.toLowerCase() === "emirates") return "UAE";
    return s;
  };

  const getCountryFlag = (country: string) => {
    const c = country.toLowerCase();
    if (c.includes("uae") || c.includes("dubai") || c.includes("emirates")) return "🇦🇪";
    if (c.includes("pakistan") || c.includes("pk")) return "🇵🇰";
    if (c.includes("afghanistan") || c.includes("af")) return "🇦🇫";
    if (c.includes("iran") || c.includes("ir")) return "🇮🇷";
    if (c.includes("china") || c.includes("cn")) return "🇨🇳";
    if (c.includes("india") || c.includes("in")) return "🇮🇳";
    if (c.includes("usa") || c.includes("america") || c.includes("us")) return "🇺🇸";
    if (c.includes("vietnam") || c.includes("vn")) return "🇻🇳";
    return "🌐";
  };

  const getStatusBadge = (st: string) => {
    const s = String(st || "draft").toLowerCase();
    if (s.includes("load") || s === "loading") {
      return <span className="inline-block px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-[#dbeafe] text-[#1e40af]">{tr("Loading")}</span>;
    }
    if (s.includes("receiv") || s === "received" || s === "completed" || s === "posted") {
      return <span className="inline-block px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-[#dcfce7] text-[#166534]">{tr("Received")}</span>;
    }
    if (s.includes("transit") || s === "in transit") {
      return <span className="inline-block px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-[#fef3c7] text-[#92400e]">{tr("In Transit")}</span>;
    }
    return <span className="inline-block px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-700">{st || "Draft"}</span>;
  };

  const resetFilters = () => {
    setFilterDateFrom("");
    setFilterDateTo("");
    setFilterCountry("all");
    setFilterBranch("all");
    setFilterSupplier("all");
    setFilterStatus("all");
    setSearchQuery("");
  };

  const handleExportCsv = () => {
    const headers = [
      "#",
      "Bill No",
      "Date",
      "Country",
      "Ex Rate",
      "Supplier Name",
      "Goods Name",
      "Brand",
      "Size",
      "Qty",
      "Unit",
      "Gross Wt",
      "Net Wt",
      "Origin",
      "Purchase Amount",
      "Purchase Currency",
      "Final Amount",
      "Final Currency",
      "Loading Country",
      "Loading Port",
      "Loading Date",
      "Receiving Country",
      "Receiving Port",
      "Receiving Date",
      "Advance Paid",
      "Remaining Due",
      "Status",
    ];

    const rows = filteredRows.map((r, i) => {
      const form = r.form_data?.form || {};
      const goods0 = r.form_data?.goodsEntries?.[0] || {};
      const exRate = Number(r.exchange_rate || form.exchangeRate || 1);
      const purchAmt = Number(r.purchaseAmount || r.totalPurchaseAmount || 0);
      const finalAmt = r.finalAmount ? Number(r.finalAmount) : purchAmt * exRate;

      return [
        i + 1,
        `"${r.purchaseBookingOrderNumber || r.purchase_order_no || ""}"`,
        `"${formatDashDate(r.purchaseDate || r.bookingDate)}"`,
        `"${r.countryName || ""}"`,
        exRate.toFixed(4),
        `"${(r.supplierName || "").replace(/"/g, '""')}"`,
        `"${(r.productName || goods0.goodsName || "").replace(/"/g, '""')}"`,
        `"${(goods0.brand || form.brand || "").replace(/"/g, '""')}"`,
        `"${(goods0.size || form.size || "").replace(/"/g, '""')}"`,
        Number(r.quantity || 0),
        `"${r.unit || ""}"`,
        Number(r.totalGrossWeight || 0),
        Number(r.totalNetWeight || 0),
        `"${(form.originCountry || goods0.origin || "").replace(/"/g, '""')}"`,
        purchAmt.toFixed(2),
        `"${r.currency || "USD"}"`,
        finalAmt.toFixed(2),
        `"${r.finalCurrency || "AED"}"`,
        `"${(form.loadingCountry || "").replace(/"/g, '""')}"`,
        `"${(form.loadingPort || "").replace(/"/g, '""')}"`,
        `"${formatDashDate(form.loadingDate)}"`,
        `"${(form.receivingCountry || "").replace(/"/g, '""')}"`,
        `"${(form.receivingPort || "").replace(/"/g, '""')}"`,
        `"${formatDashDate(form.receivingDate)}"`,
        Number(r.advance_paid || 0).toFixed(2),
        Number(r.remaining_due || 0).toFixed(2),
        `"${r.status || ""}"`,
      ].join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `purchase-booking-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // If in Form Mode (e.g. creating/editing an order)
  if (isFormMode) {
    return (
      <div dir={isRtl ? "rtl" : "ltr"} className="w-full space-y-4 p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setIsFormMode(false);
                router.push("/dashboard/purchase/new-purchase-booking-order");
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 text-xs font-black text-slate-800 shadow-sm transition dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
            >
              ← {tr("Back to Register")}
            </button>
            <span className="hidden sm:inline-block h-4 w-px bg-slate-300 dark:bg-slate-700" />
            <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
              <Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              {idParam ? `${tr("Editing Booking Order")} (${idParam})` : tr("New Purchase Booking Order Entry")}
            </div>
          </div>
        </div>

        <PurchaseOrderWizard session={session} />
      </div>
    );
  }

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className={cn("w-full space-y-3 p-2 sm:p-3 text-slate-900 dark:text-slate-100", isFullScreen && "fixed inset-0 z-50 overflow-y-auto bg-slate-50 dark:bg-slate-950 p-4")}>
      
      {/* ── 1. Page Title & Breadcrumb Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
            <ShoppingCart className="h-5 w-5" aria-hidden="true" />
          </div>
          <h1 className="text-xl font-black tracking-tight text-[#1e3a8a] dark:text-blue-400">
            {tr("Purchase Booking (Global & Country Wise)")}
          </h1>
          <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-[#eff6ff] px-2.5 py-0.5 text-xs font-bold text-[#1d4ed8] dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300">
            <Crown className="h-3 w-3" aria-hidden="true" />
            {tr("Super Admin View")}
          </span>
        </div>

        <nav aria-label="breadcrumb" className="text-xs font-semibold text-slate-500">
          <span className="hover:text-slate-700">{tr("Dashboard")}</span>
          <span className="mx-1.5 text-slate-400">/</span>
          <span className="hover:text-slate-700">{tr("Purchase & Trade")}</span>
          <span className="mx-1.5 text-slate-400">/</span>
          <span className="font-bold text-slate-800 dark:text-slate-200">{tr("Purchase Booking")}</span>
        </nav>
      </div>

      {/* ── 2. Top Control Strip / Action Toolbar ── */}
      <div className="relative flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200/90 bg-white p-2 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2">
          {/* Reports Dropdown Button */}
          <div className="relative" ref={reportsRef}>
            <button
              type="button"
              onClick={() => setReportsOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563eb] hover:bg-[#1d4ed8] text-white px-3.5 py-1.5 text-xs font-bold shadow-xs transition cursor-pointer"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span>{tr("Reports")}</span>
              <ChevronDown className="h-3.5 w-3.5 opacity-80" />
            </button>

            {reportsOpen && (
              <div className="absolute start-0 top-full mt-1.5 z-40 w-60 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-800 dark:bg-slate-900 animate-in fade-in-50 zoom-in-95">
                <button
                  type="button"
                  onClick={() => { setReportsOpen(false); }}
                  className="w-full flex items-center gap-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 px-3 py-2 text-xs font-bold text-blue-700 dark:text-blue-300"
                >
                  <ShoppingCart className="h-4 w-4" />
                  <span>{tr("Purchase Booking")}</span>
                  <Check className="ms-auto h-3.5 w-3.5 text-blue-600" />
                </button>
                <a
                  href="/dashboard/purchase/purchase-booking-journal-report"
                  className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/60"
                >
                  <BookOpen className="h-4 w-4 text-slate-400" />
                  <span>{tr("Purchase Booking Journal")}</span>
                </a>
                <a
                  href="/dashboard/purchase/stock/report"
                  className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/60"
                >
                  <Scale className="h-4 w-4 text-slate-400" />
                  <span>{tr("Weight Report")}</span>
                </a>
                <a
                  href="/dashboard/purchase/purchase-payments"
                  className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/60"
                >
                  <CreditCard className="h-4 w-4 text-slate-400" />
                  <span>{tr("Payment Report")}</span>
                </a>
                <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
                <a
                  href="/dashboard/purchase/finalized-purchase-orders"
                  className="w-full flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/60"
                >
                  <span className="flex items-center gap-2.5">
                    <Grid className="h-4 w-4 text-slate-400" />
                    <span>{tr("More Reports")}</span>
                  </span>
                  <ChevronDown className="-rotate-90 h-3 w-3 text-slate-400" />
                </a>
              </div>
            )}
          </div>

          <span className="text-slate-300 dark:text-slate-700 font-bold select-none">|</span>

          {/* Filter Button */}
          <button
            type="button"
            onClick={() => setFilterModalOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563eb] hover:bg-[#1d4ed8] text-white px-3.5 py-1.5 text-xs font-bold shadow-xs transition cursor-pointer"
          >
            <Filter className="h-3.5 w-3.5" />
            <span>{tr("Filter")}</span>
            <ChevronDown className="h-3.5 w-3.5 opacity-80" />
          </button>
        </div>

        {/* Right side: Apply Button & 3-dots Menu */}
        <div className="flex items-center gap-2">
          {/* New Booking quick action */}
          <button
            type="button"
            onClick={() => {
              setIsFormMode(true);
              router.push("/dashboard/purchase/new-purchase-booking-order?mode=new");
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 text-xs font-bold shadow-xs transition cursor-pointer"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>+ {tr("New Booking")}</span>
          </button>

          <button
            type="button"
            onClick={() => loadData()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563eb] hover:bg-[#1d4ed8] text-white px-3.5 py-1.5 text-xs font-bold shadow-xs transition cursor-pointer"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>{tr("Apply")}</span>
          </button>

          {/* Action Menu (3-dots) */}
          <div className="relative" ref={actionsRef}>
            <button
              type="button"
              onClick={() => setActionsOpen((v) => !v)}
              className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-slate-250 bg-white hover:bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 transition cursor-pointer"
            >
              <MoreVertical className="h-4 w-4" />
            </button>

            {actionsOpen && (
              <div className="absolute end-0 top-full mt-1.5 z-40 w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-800 dark:bg-slate-900 animate-in fade-in-50 zoom-in-95">
                <button
                  type="button"
                  onClick={() => {
                    setIsFullScreen((v) => !v);
                    setActionsOpen(false);
                  }}
                  className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/60"
                >
                  <Maximize2 className="h-4 w-4 text-slate-400" />
                  <span>{isFullScreen ? tr("Exit Full View") : tr("Full Page View")}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    window.print();
                    setActionsOpen(false);
                  }}
                  className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/60"
                >
                  <Printer className="h-4 w-4 text-slate-400" />
                  <span>{tr("Print (Full Page)")}</span>
                </button>
                <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
                <button
                  type="button"
                  onClick={() => {
                    handleExportCsv();
                    setActionsOpen(false);
                  }}
                  className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/60"
                >
                  <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                  <span>{tr("Export Excel")}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    window.print();
                    setActionsOpen(false);
                  }}
                  className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/60"
                >
                  <FileText className="h-4 w-4 text-red-500" />
                  <span>{tr("Export PDF")}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleExportCsv();
                    setActionsOpen(false);
                  }}
                  className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/60"
                >
                  <Download className="h-4 w-4 text-slate-500" />
                  <span>{tr("Export CSV")}</span>
                </button>
                <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
                <button
                  type="button"
                  onClick={() => {
                    resetFilters();
                    setActionsOpen(false);
                  }}
                  className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/60"
                >
                  <RotateCcw className="h-4 w-4 text-amber-500" />
                  <span>{tr("Reset Filters")}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── 3. Three Top Summary Cards ── */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-12">
        
        {/* Card 1: Purchase Booking Summary (Span 4) */}
        <div className="lg:col-span-4 rounded-xl border border-amber-200/90 bg-gradient-to-b from-[#fffef8] to-white p-3.5 shadow-xs dark:border-amber-900/60 dark:from-slate-900 dark:to-slate-950 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-amber-100 dark:border-amber-900/40">
              <div className="flex items-center gap-2">
                <span className="text-amber-500 text-base">📊</span>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
                  {tr("Purchase Booking Summary")}
                </h3>
              </div>
            </div>

            <div className="space-y-1.5 py-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-600 dark:text-slate-400">{tr("Total Bills")}</span>
                <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{fmtInt(summaryMetrics.totalBills)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-600 dark:text-slate-400">{tr("Total Purchase")}</span>
                <span className="font-mono font-bold text-slate-900 dark:text-slate-100">USD {fmt(summaryMetrics.totalPurchase)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-600 dark:text-slate-400">{tr("Total Paid")}</span>
                <span className="font-mono font-bold text-slate-900 dark:text-slate-100">USD {fmt(summaryMetrics.totalPaid)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-600 dark:text-slate-400">{tr("Finalized (Completed)")}</span>
                <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{fmtInt(summaryMetrics.completed)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-600 dark:text-slate-400">{tr("Pending (Remaining)")}</span>
                <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{fmtInt(summaryMetrics.pending)}</span>
              </div>
            </div>
          </div>

          {/* Bottom Highlighted Bar */}
          <div className="rounded-lg bg-[#fed7aa]/50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900/60 px-3 py-2 flex items-center justify-between">
            <span className="font-black text-xs text-slate-900 dark:text-slate-100">{tr("Balance (To Be Paid)")}</span>
            <span className="font-mono font-black text-xs text-[#ea580c] dark:text-orange-400">USD {fmt(summaryMetrics.balance)}</span>
          </div>
        </div>

        {/* Card 2: Booking Status (Span 3) */}
        <div className="lg:col-span-3 rounded-xl border border-blue-200/90 bg-gradient-to-b from-[#f8faff] to-white p-3.5 shadow-xs dark:border-blue-900/60 dark:from-slate-900 dark:to-slate-950 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-blue-100 dark:border-blue-900/40">
              <div className="flex items-center gap-2">
                <span className="text-blue-500 text-base">📈</span>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
                  {tr("Booking Status")}
                </h3>
              </div>
            </div>

            <table className="w-full text-xs mt-1.5 border-collapse">
              <thead>
                <tr className="text-[10px] font-extrabold uppercase text-slate-500 dark:text-slate-400 border-b border-slate-150 dark:border-slate-800">
                  <th className="py-1 text-start">{tr("Status")}</th>
                  <th className="py-1 text-end">{tr("Bills")}</th>
                  <th className="py-1 text-end">{tr("% of Bills")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-semibold text-slate-800 dark:text-slate-200">
                <tr>
                  <td className="py-1.5 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span>{tr("Completed")}</span>
                  </td>
                  <td className="py-1.5 text-end font-mono font-bold">{statusMetrics.completed}</td>
                  <td className="py-1.5 text-end font-mono text-slate-500">{statusMetrics.completedPct}%</td>
                </tr>
                <tr>
                  <td className="py-1.5 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-blue-500" />
                    <span>{tr("Partially Completed")}</span>
                  </td>
                  <td className="py-1.5 text-end font-mono font-bold">{statusMetrics.partial}</td>
                  <td className="py-1.5 text-end font-mono text-slate-500">{statusMetrics.partialPct}%</td>
                </tr>
                <tr>
                  <td className="py-1.5 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-amber-500" />
                    <span>{tr("Pending")}</span>
                  </td>
                  <td className="py-1.5 text-end font-mono font-bold">{statusMetrics.pending}</td>
                  <td className="py-1.5 text-end font-mono text-slate-500">{statusMetrics.pendingPct}%</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs font-black">
            <span className="text-slate-900 dark:text-slate-100">{tr("Total")}</span>
            <div className="flex items-center gap-4">
              <span className="font-mono text-slate-900 dark:text-slate-100">{statusMetrics.total}</span>
              <span className="font-mono text-slate-600 dark:text-slate-400">100.0%</span>
            </div>
          </div>
        </div>

        {/* Card 3: Country Wise Purchase Booking (Final Currency Wise) (Span 5) */}
        <div className="lg:col-span-5 rounded-xl border border-emerald-200/90 bg-gradient-to-b from-[#f7fdf9] to-white p-3.5 shadow-xs dark:border-emerald-900/60 dark:from-slate-900 dark:to-slate-950 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-emerald-100 dark:border-emerald-900/40">
              <div className="flex items-center gap-2">
                <span className="text-emerald-500 text-base">🏛️</span>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
                  {tr("Country Wise Purchase Booking (Final Currency Wise)")}
                </h3>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs mt-1.5 border-collapse whitespace-nowrap">
                <thead>
                  <tr className="text-[10px] font-extrabold uppercase text-slate-500 dark:text-slate-400 border-b border-emerald-100 dark:border-emerald-900/40">
                    <th className="py-1 text-center w-6">#</th>
                    <th className="py-1 text-start">{tr("Country")}</th>
                    <th className="py-1 text-center">{tr("Currency")}</th>
                    <th className="py-1 text-end">{tr("Total Bills")}</th>
                    <th className="py-1 text-end">{tr("Purchase Amount")}</th>
                    <th className="py-1 text-end">{tr("Paid Amount")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-emerald-50 dark:divide-emerald-950/40 font-semibold text-slate-800 dark:text-slate-200 text-[11px]">
                  {countryMetrics.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-4 text-center text-slate-400 font-normal">
                        {tr("No records found.")}
                      </td>
                    </tr>
                  ) : (
                    countryMetrics.slice(0, 5).map((c, i) => (
                      <tr key={c.country}>
                        <td className="py-1 text-center text-slate-500">{i + 1}</td>
                        <td className="py-1 text-start">
                          <span className="mr-1">{getCountryFlag(c.country)}</span>
                          <span className="font-bold">{c.country}</span>
                        </td>
                        <td className="py-1 text-center font-mono font-bold text-slate-600 dark:text-slate-400">{c.currency}</td>
                        <td className="py-1 text-end font-mono font-bold">{c.bills}</td>
                        <td className="py-1 text-end font-mono font-bold text-slate-900 dark:text-slate-100">{fmt(c.purchaseAmount)}</td>
                        <td className="py-1 text-end font-mono font-bold text-emerald-600 dark:text-emerald-400">{fmt(c.paidAmount)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>

      {/* ── 4. Main Purchase Booking List Table ── */}
      <div className="rounded-xl border border-slate-200/90 bg-white shadow-xs overflow-hidden dark:border-slate-800 dark:bg-slate-900">
        
        {/* Table Banner Header Bar */}
        <div className="bg-[#1e3a8a] text-white px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center h-6 w-6 rounded-full bg-white/15 text-white">
              <BookOpen className="h-3.5 w-3.5" />
            </div>
            <h2 className="text-xs font-black uppercase tracking-wider text-white">
              {tr("Purchase Booking List (All Countries)")}
            </h2>
          </div>
          <span className="text-[11px] font-bold text-blue-200">
            {filteredRows.length} {tr("Records")}
          </span>
        </div>

        {/* 14-Column Table */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1600px] border-collapse text-left text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-extrabold text-[11px] uppercase border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">
                <th className="py-2.5 px-2 text-center w-8 border-r border-slate-200 dark:border-slate-700">#</th>
                <th className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-700">{tr("Bill No. / Date")}</th>
                <th className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-700">{tr("Country (Ex. Rate)")}</th>
                <th className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-700">{tr("SUPPLIER / BUYER (PARTY)")}</th>
                <th className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-700">{tr("Goods Name (Brand / Size)")}</th>
                <th className="py-2.5 px-2 text-center border-r border-slate-200 dark:border-slate-700">{tr("Qty (Unit)")}</th>
                <th className="py-2.5 px-3 text-right border-r border-slate-200 dark:border-slate-700">{tr("Gross Wt Net Wt (Kg)")}</th>
                <th className="py-2.5 px-2.5 text-center border-r border-slate-200 dark:border-slate-700">{tr("Origin")}</th>
                <th className="py-2.5 px-2.5 text-right border-r border-slate-200 dark:border-slate-700">{tr("Amount (Purchase / Final) USD -> AED")}</th>
                <th className="py-2.5 px-3 text-center border-r border-slate-200 dark:border-slate-700">{tr("Loading Country / Port / Date")}</th>
                <th className="py-2.5 px-3 text-center border-r border-slate-200 dark:border-slate-700">{tr("Receiving Country / Port / Date")}</th>
                <th className="py-2.5 px-2.5 text-right border-r border-slate-200 dark:border-slate-700">{tr("PAYMENT (PAID / BAL)")}</th>
                <th className="py-2.5 px-2.5 text-center border-r border-slate-200 dark:border-slate-700">{tr("Status")}</th>
                <th className="py-2.5 px-2.5 text-center w-20">{tr("Actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={14} className="py-12 text-center text-slate-400">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-blue-600" />
                    <span>{tr("Loading purchase booking orders...")}</span>
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={14} className="py-12 text-center text-slate-400">
                    {tr("No purchase booking records found.")}
                  </td>
                </tr>
              ) : (
                filteredRows.map((r, i) => {
                  const form = r.form_data?.form || {};
                  const goods0 = r.form_data?.goodsEntries?.[0] || {};
                  const billNo = r.purchaseBookingOrderNumber || r.purchase_order_no || r.billNumber || "—";
                  const billDate = formatDashDate(r.purchaseDate || r.bookingDate || r.createdAt);
                  const countryName = r.countryName || form.destinationCountry || "UAE";
                  const exRate = Number(r.exchange_rate || form.exchangeRate || 1);

                  // 1. Purchase Account & Sales Account stacked
                  const purchaseAcc = r.purchaseAccountName && r.purchaseAccountName !== "-" ? r.purchaseAccountName : (r.supplierName || form.supplierName || "—");
                  const salesAcc = r.salesAccountName && r.salesAccountName !== "-" ? r.salesAccountName : (r.buyerName || form.customerName || form.salesAccountName || "—");

                  const goodsName = r.productName || goods0.goodsName || form.goodsName || "—";
                  const brand = goods0.brand || form.brand || "";
                  const size = goods0.size || form.size || "";
                  const qty = Number(r.quantity || form.totalQuantity || 0);
                  const unit = r.unit || form.qtyName || goods0.qtyName || "";
                  const grossKg = Number(r.totalGrossWeight || form.grossWeight || 0);
                  const netKg = Number(r.totalNetWeight || form.netWeight || 0);
                  const origin = form.originCountry || goods0.origin || r.originCountry || "—";

                  const purchCurr = String(r.currency || "USD").toUpperCase();
                  const finalCurr = String(r.finalCurrency || form.secondaryCurrency?.split(" ")?.[0] || (countryName.includes("Pakistan") ? "PKR" : "AED")).toUpperCase();
                  const purchAmt = Number(r.purchaseAmount || r.totalPurchaseAmount || 0);
                  const finalAmt = r.finalAmount ? Number(r.finalAmount) : purchAmt * exRate;

                  // 2. Loading Port & Date
                  const rawLoadCountry = form.loadingCountry || form.originCountry || r.countryName || "";
                  const loadCountry = shortenCountry(rawLoadCountry);
                  const loadPort = form.loadingPort || form.exitPort || form.particularPort || r.loadingPort || "";
                  const loadDate = formatDashDate(form.loadingDate || form.expectedLoadingDate || r.loadingDate || r.workflow?.loadingDate || r.workflowDates?.loadingDate);

                  // 3. Receiving Port & Date
                  const rawRcvCountry = form.receivingCountry || form.destinationCountry || r.countryName || "";
                  const rcvCountry = shortenCountry(rawRcvCountry);
                  const rcvPort = form.receivedPort || form.receivingPort || form.destinationPort || r.receivingPort || "";
                  const rcvDate = formatDashDate(form.receivingDate || form.receivedDate || form.arrivalDate || form.expectedReceivingDate || r.receivingDate || r.workflow?.receivingDate || r.workflowDates?.receivingDate);

                  // 4. Payment: Total Paid vs Balance
                  const totalPaidPC = Number(r.advance_paid || form.advancePaid || 0) + Number(r.remaining_paid || form.remainingPaid || 0);
                  const balPC = Math.max(0, purchAmt - totalPaidPC);
                  const balFC = balPC * exRate;
                  const isCleared = purchAmt > 0 && balPC <= 0.05;

                  return (
                    <tr key={r.id || i} className="hover:bg-blue-50/40 dark:hover:bg-slate-800/50 transition-colors">
                      {/* 1. # */}
                      <td className="py-2 px-2 text-center text-slate-500 font-mono text-[11px] border-r border-slate-100 dark:border-slate-800">
                        {i + 1}
                      </td>

                      {/* 2. Bill No. / Date */}
                      <td className="py-2 px-3 border-r border-slate-100 dark:border-slate-800 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedRow(r);
                            setDrawerOpen(true);
                          }}
                          className="font-bold text-blue-600 hover:text-blue-800 dark:text-blue-400 hover:underline block text-start font-mono text-xs"
                        >
                          {billNo}
                        </button>
                        <div className="text-[10px] text-slate-500 font-mono">{billDate}</div>
                      </td>

                      {/* 3. Country (Ex. Rate) */}
                      <td className="py-2 px-3 border-r border-slate-100 dark:border-slate-800 whitespace-nowrap">
                        <div className="font-bold text-blue-600 dark:text-blue-400">{shortenCountry(countryName)}</div>
                        <div className="text-[10px] text-slate-500 font-mono">Ex: {exRate.toFixed(4)}</div>
                      </td>

                      {/* 4. Supplier / Buyer (Accounts) */}
                      <td className="py-2 px-3 border-r border-slate-100 dark:border-slate-800 whitespace-nowrap">
                        <div className="font-bold text-slate-900 dark:text-slate-100 leading-tight">{purchaseAcc}</div>
                        <div className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 mt-0.5 leading-tight">{salesAcc}</div>
                      </td>

                      {/* 5. Goods Name (Brand / Size) */}
                      <td className="py-2 px-3 border-r border-slate-100 dark:border-slate-800 whitespace-nowrap">
                        <div className="font-bold text-slate-900 dark:text-slate-100">{goodsName}</div>
                        {(brand || size) && (
                          <div className="text-[10px] text-slate-500">
                            {brand ? `Brand: ${brand}` : ""}{brand && size ? " | " : ""}{size ? `Size: ${size}` : ""}
                          </div>
                        )}
                      </td>

                      {/* 6. Qty (Unit) */}
                      <td className="py-2 px-2 text-center border-r border-slate-100 dark:border-slate-800 whitespace-nowrap font-mono font-bold text-slate-900 dark:text-slate-100">
                        {fmtInt(qty)} {unit}
                      </td>

                      {/* 7. Gross Wt Net Wt (Kg) */}
                      <td className="py-2 px-3 text-right border-r border-slate-100 dark:border-slate-800 whitespace-nowrap font-mono">
                        <div className="font-bold text-slate-900 dark:text-slate-100">{fmt(grossKg)}</div>
                        <div className="text-[10px] text-slate-500">{fmt(netKg)}</div>
                      </td>

                      {/* 8. Origin */}
                      <td className="py-2 px-2.5 text-center border-r border-slate-100 dark:border-slate-800 whitespace-nowrap text-slate-700 dark:text-slate-300">
                        {origin}
                      </td>

                      {/* 9. Amount (Purchase / Final) USD -> AED (Compact) */}
                      <td className="py-2 px-2.5 text-right border-r border-slate-100 dark:border-slate-800 whitespace-nowrap font-mono">
                        <div className="font-bold text-[11px] text-slate-900 dark:text-slate-100">
                          <span className="text-[10px] opacity-70 mr-1">{purchCurr}</span>
                          {fmt(purchAmt)}
                        </div>
                        <div className="font-bold text-[10px] text-red-600 dark:text-red-400">
                          <span className="text-[9px] opacity-70 mr-1">{finalCurr}</span>
                          {fmt(finalAmt)}
                        </div>
                      </td>

                      {/* 10. Loading Country / Port / Date */}
                      <td className="py-2 px-3 text-center border-r border-slate-100 dark:border-slate-800 whitespace-nowrap">
                        <div className="font-medium text-slate-800 dark:text-slate-200">
                          {loadCountry}{loadPort ? ` / ${loadPort}` : ""}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">{loadDate !== "—" ? `📅 ${loadDate}` : "—"}</div>
                      </td>

                      {/* 11. Receiving Country / Port / Date */}
                      <td className="py-2 px-3 text-center border-r border-slate-100 dark:border-slate-800 whitespace-nowrap">
                        <div className="font-medium text-slate-800 dark:text-slate-200">
                          {rcvCountry}{rcvPort ? ` / ${rcvPort}` : ""}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">{rcvDate !== "—" ? `📅 ${rcvDate}` : "—"}</div>
                      </td>

                      {/* 12. Payment (Paid / Bal) */}
                      <td className="py-2 px-2.5 text-right border-r border-slate-100 dark:border-slate-800 whitespace-nowrap font-mono">
                        <div className="font-bold text-[11px] text-slate-900 dark:text-slate-100">
                          <span className="text-[10px] font-semibold text-slate-500 mr-1">{tr("PAID")}:</span>
                          <span className="text-[10px] opacity-70 mr-0.5">{purchCurr}</span>
                          {fmt(totalPaidPC)}
                        </div>
                        <div className={cn("font-bold text-[10px]", isCleared ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                          <span className="text-[9px] font-semibold opacity-80 mr-1">{tr("BALANCE")}:</span>
                          <span className="text-[9px] opacity-70 mr-0.5">{purchCurr}</span>
                          {isCleared ? "0.00" : fmt(balPC)}
                        </div>
                        {!isCleared && finalCurr !== purchCurr && (
                          <div className="text-[9px] font-semibold text-red-500 dark:text-red-400 opacity-90">
                            <span className="mr-0.5">{finalCurr}</span>
                            {fmt(balFC)}
                          </div>
                        )}
                      </td>

                      {/* 13. Status */}
                      <td className="py-2 px-2.5 text-center border-r border-slate-100 dark:border-slate-800 whitespace-nowrap">
                        {getStatusBadge(r.status || "Loading")}
                      </td>

                      {/* 14. Actions */}
                      <td className="py-2 px-2.5 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedRow(r);
                              setDrawerOpen(true);
                            }}
                            className="p-1 rounded hover:bg-slate-100 text-slate-600 hover:text-blue-600 dark:hover:bg-slate-800 dark:text-slate-400 cursor-pointer"
                            title={tr("View Details")}
                          >
                            <Eye className="h-4 w-4" />
                          </button>

                          <div className="relative" data-row-menu="true">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveRowMenuId((curr) => curr === r.id ? null : r.id);
                              }}
                              className="p-1 rounded hover:bg-slate-100 text-slate-600 dark:hover:bg-slate-800 dark:text-slate-400 cursor-pointer"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </button>

                            {activeRowMenuId === r.id && (
                              <div className="absolute end-0 top-full mt-1 z-30 w-48 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-800 dark:bg-slate-900 text-start text-xs animate-in fade-in-50 zoom-in-95">
                                {/* 1. View Details */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedRow(r);
                                    setDrawerOpen(true);
                                    setActiveRowMenuId(null);
                                  }}
                                  className="w-full px-2.5 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold flex items-center gap-2"
                                >
                                  <Eye className="h-3.5 w-3.5 text-blue-600" />
                                  <span>{tr("View Details")}</span>
                                </button>

                                {/* 2. View Full Bill */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setFullBillRow(r);
                                    setActiveRowMenuId(null);
                                  }}
                                  className="w-full px-2.5 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold flex items-center gap-2"
                                >
                                  <FileText className="h-3.5 w-3.5 text-slate-500" />
                                  <span>{tr("View Full Bill")}</span>
                                </button>

                                <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

                                {/* 3. Payment Entry */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    router.push(`/dashboard/journal/purchase-order-payment/advance?purchaseOrderNo=${encodeURIComponent(billNo)}`);
                                    setActiveRowMenuId(null);
                                  }}
                                  className="w-full px-2.5 py-1.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-semibold flex items-center gap-2"
                                >
                                  <CreditCard className="h-3.5 w-3.5 text-emerald-600" />
                                  <span>{tr("PAYMENT ENTRY")}</span>
                                </button>

                                {/* 4. Transfer Bill to Lane */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    router.push(`/dashboard/purchase/purchase-transit-lane?purchaseOrderNo=${encodeURIComponent(billNo)}`);
                                    setActiveRowMenuId(null);
                                  }}
                                  className="w-full px-2.5 py-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-semibold flex items-center gap-2"
                                >
                                  <ArrowRight className="h-3.5 w-3.5 text-blue-600" />
                                  <span>{tr("TRANSFER BILL")}</span>
                                </button>

                                <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

                                {/* 5. Edit Booking */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsFormMode(true);
                                    router.push(`/dashboard/purchase/new-purchase-booking-order?id=${encodeURIComponent(r.id)}&purchaseOrderNo=${encodeURIComponent(billNo)}`);
                                    setActiveRowMenuId(null);
                                  }}
                                  className="w-full px-2.5 py-1.5 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-950/40 text-amber-700 dark:text-amber-300 font-semibold flex items-center gap-2"
                                >
                                  <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                                  <span>{tr("Edit Booking")}</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* ── 5. Floating / Modal Filter Dialog ── */}
      {filterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-4xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900 space-y-4">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-150 pb-3 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-blue-600" />
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
                  {tr("Filter — Purchase Booking")}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setFilterModalOpen(false)}
                className="h-7 w-7 rounded-lg hover:bg-slate-100 text-slate-500 flex items-center justify-center dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Fields Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 text-xs">
              
              {/* Date Range */}
              <div className="space-y-1">
                <label className="font-bold text-slate-600 dark:text-slate-400 uppercase text-[10px]">
                  {tr("Date Range")}
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  <input
                    type="date"
                    value={filterDateFrom}
                    onChange={(e) => setFilterDateFrom(e.target.value)}
                    className="h-8 w-full rounded-lg border border-slate-250 bg-white px-2 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                  <input
                    type="date"
                    value={filterDateTo}
                    onChange={(e) => setFilterDateTo(e.target.value)}
                    className="h-8 w-full rounded-lg border border-slate-250 bg-white px-2 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>
              </div>

              {/* Country */}
              <div className="space-y-1">
                <label className="font-bold text-slate-600 dark:text-slate-400 uppercase text-[10px]">
                  {tr("Country")}
                </label>
                <div className="relative">
                  <Globe className="absolute start-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <select
                    value={filterCountry}
                    onChange={(e) => setFilterCountry(e.target.value)}
                    className="h-8 w-full rounded-lg border border-slate-250 bg-white ps-8 pe-3 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 cursor-pointer"
                  >
                    <option value="all">{tr("All Countries")}</option>
                    {filterOptions.countries.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Branch */}
              <div className="space-y-1">
                <label className="font-bold text-slate-600 dark:text-slate-400 uppercase text-[10px]">
                  {tr("Branch")}
                </label>
                <div className="relative">
                  <Building2 className="absolute start-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <select
                    value={filterBranch}
                    onChange={(e) => setFilterBranch(e.target.value)}
                    className="h-8 w-full rounded-lg border border-slate-250 bg-white ps-8 pe-3 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 cursor-pointer"
                  >
                    <option value="all">{tr("All Branches")}</option>
                    {filterOptions.branches.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Supplier */}
              <div className="space-y-1">
                <label className="font-bold text-slate-600 dark:text-slate-400 uppercase text-[10px]">
                  {tr("Supplier")}
                </label>
                <div className="relative">
                  <User className="absolute start-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <select
                    value={filterSupplier}
                    onChange={(e) => setFilterSupplier(e.target.value)}
                    className="h-8 w-full rounded-lg border border-slate-250 bg-white ps-8 pe-3 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 cursor-pointer"
                  >
                    <option value="all">{tr("All Suppliers")}</option>
                    {filterOptions.suppliers.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Status */}
              <div className="space-y-1">
                <label className="font-bold text-slate-600 dark:text-slate-400 uppercase text-[10px]">
                  {tr("Status")}
                </label>
                <div className="relative">
                  <Layers className="absolute start-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="h-8 w-full rounded-lg border border-slate-250 bg-white ps-8 pe-3 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 cursor-pointer"
                  >
                    <option value="all">{tr("All Status")}</option>
                    {filterOptions.statuses.map((st) => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-end justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={resetFilters}
                  className="h-8 px-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>{tr("Reset")}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFilterModalOpen(false)}
                  className="h-8 px-4 rounded-lg bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>{tr("Apply")}</span>
                </button>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* ── Detail Drawer ── */}
      {selectedRow && (
        <DetailDrawer
          isOpen={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          title={`${tr("Purchase Booking Order")} — ${selectedRow.purchaseBookingOrderNumber || selectedRow.purchase_order_no || ""}`}
        >
          <div className="p-4 space-y-4 text-xs font-medium">
            <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-lg">
              <div>
                <span className="text-slate-500 uppercase text-[10px] block font-bold">{tr("Bill No")}</span>
                <span className="font-mono font-bold text-blue-600">{selectedRow.purchaseBookingOrderNumber || selectedRow.purchase_order_no}</span>
              </div>
              <div>
                <span className="text-slate-500 uppercase text-[10px] block font-bold">{tr("Date")}</span>
                <span className="font-mono">{formatDashDate(selectedRow.purchaseDate || selectedRow.bookingDate)}</span>
              </div>
              <div>
                <span className="text-slate-500 uppercase text-[10px] block font-bold">{tr("Supplier")}</span>
                <span className="font-bold">{selectedRow.supplierName}</span>
              </div>
              <div>
                <span className="text-slate-500 uppercase text-[10px] block font-bold">{tr("Country / Branch")}</span>
                <span>{selectedRow.countryName} / {selectedRow.branchName}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 border border-slate-200 dark:border-slate-800 p-3 rounded-lg">
              <div>
                <span className="text-slate-500 uppercase text-[10px] block font-bold">{tr("Goods Name")}</span>
                <span className="font-bold">{selectedRow.productName || selectedRow.goodsDescription}</span>
              </div>
              <div>
                <span className="text-slate-500 uppercase text-[10px] block font-bold">{tr("Quantity")}</span>
                <span className="font-mono font-bold">{selectedRow.quantity} {selectedRow.unit}</span>
              </div>
              <div>
                <span className="text-slate-500 uppercase text-[10px] block font-bold">{tr("Purchase Amount")}</span>
                <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{selectedRow.currency} {fmt(Number(selectedRow.purchaseAmount || 0))}</span>
              </div>
              <div>
                <span className="text-slate-500 uppercase text-[10px] block font-bold">{tr("Final Amount")}</span>
                <span className="font-mono font-bold text-red-600">{selectedRow.finalCurrency} {fmt(Number(selectedRow.finalAmount || 0))}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setFullBillRow(selectedRow);
                  setDrawerOpen(false);
                }}
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold"
              >
                {tr("View Full Bill")}
              </button>
            </div>
          </div>
        </DetailDrawer>
      )}

      {/* ── Open Full Bill Modal ── */}
      {fullBillRow && (
        <OpenFullBillModal
          isOpen={Boolean(fullBillRow)}
          onClose={() => setFullBillRow(null)}
          order={fullBillRow}
          lang={lang as any}
        />
      )}

    </div>
  );
}
