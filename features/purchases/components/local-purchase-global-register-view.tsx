"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ShoppingCart,
  Crown,
  ChevronDown,
  Filter,
  Check,
  CheckCircle2,
  MoreVertical,
  Maximize2,
  Printer,
  FileSpreadsheet,
  FileText,
  Download,
  RotateCcw,
  Eye,
  Calendar,
  Building2,
  Search,
  Sparkles,
  BookOpen,
  Truck,
  CreditCard,
  Grid,
  X,
  Edit3,
  Trash2,
  ArrowRight
} from "lucide-react";
import { translateHeader } from "@/lib/i18n/table-headers";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { cn } from "@/lib/utils";
import { DetailDrawer } from "@/components/ui/detail-drawer";
import { OpenFullBillModal } from "@/components/invoices/open-full-bill-modal";

export interface LocalPurchaseGlobalRegisterViewProps {
  purchases: any[];
  loading?: boolean;
  onRefresh?: () => void;
  countryBranches?: any[];
  cityBranches?: any[];
  session?: any;
  onNewPurchase: () => void;
  onEditPurchase: (purchase: any) => void;
  onViewVoucher: (purchase: any) => void;
  onDeletePurchase: (purchaseId: string) => Promise<void>;
}

export function LocalPurchaseGlobalRegisterView({
  purchases,
  loading = false,
  onRefresh,
  countryBranches = [],
  cityBranches = [],
  session,
  onNewPurchase,
  onEditPurchase,
  onViewVoucher,
  onDeletePurchase,
}: LocalPurchaseGlobalRegisterViewProps) {
  const activeLang = useActiveLanguage();
  const lang = activeLang || "en";
  const tr = useCallback((key: string) => translateHeader(lang, key), [lang]);
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);
  const router = useRouter();

  // Modals & Drawers
  const [selectedRow, setSelectedRow] = useState<any | null>(null);
  const [fullBillRow, setFullBillRow] = useState<any | null>(null);
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);

  // Menus & Popovers
  const [reportsOpen, setReportsOpen] = useState<boolean>(false);
  const [actionsOpen, setActionsOpen] = useState<boolean>(false);
  const [exportOpen, setExportOpen] = useState<boolean>(false);
  const [filterModalOpen, setFilterModalOpen] = useState<boolean>(false);
  const [isFullScreen, setIsFullScreen] = useState<boolean>(false);
  const [activeRowMenuId, setActiveRowMenuId] = useState<string | null>(null);

  // Filters
  const [filterBranch, setFilterBranch] = useState<string>("all");
  const [filterSupplier, setFilterSupplier] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterDateFrom, setFilterDateFrom] = useState<string>("");
  const [filterDateTo, setFilterDateTo] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const reportsRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  // Close menus on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (reportsRef.current && !reportsRef.current.contains(e.target as Node)) {
        setReportsOpen(false);
      }
      if (actionsRef.current && !actionsRef.current.contains(e.target as Node)) {
        setActionsOpen(false);
      }
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
      const target = e.target as HTMLElement | null;
      if (!target?.closest("[data-row-menu]")) {
        setActiveRowMenuId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

  /**
   * Currency resolution rule:
   * Each bill must display in its original country's currency (UAE = AED, Pakistan = PKR, etc.).
   * Never automatically convert currencies or combine different currencies into one total!
   */
  const getCurrency = (r: any): string => {
    const raw = String(r.currency || r.local_currency || r.purchase_currency || "").toUpperCase().trim();
    if (raw && raw !== "USD") return raw;
    const country = String(r.country_name || r.countryName || "").toLowerCase();
    const branch = String(r.branch_name || r.branchName || "").toLowerCase();
    if (country.includes("pakistan") || branch.includes("chaman") || branch.includes("quetta") || branch.includes("karachi") || branch.includes("lahore")) return "PKR";
    if (country.includes("afghanistan") || branch.includes("kabul") || branch.includes("kandahar") || branch.includes("herat")) return "AFN";
    if (country.includes("iran") || branch.includes("tehran")) return "IRR";
    if (country.includes("india")) return "INR";
    if (country.includes("china")) return "CNY";
    if (country.includes("emirates") || country.includes("uae") || branch.includes("ras") || branch.includes("dubai") || branch.includes("sharjah")) return "AED";
    return raw || "AED";
  };

  const getGoodsEmoji = (goodsName: string) => {
    const gn = String(goodsName || "").toLowerCase();
    if (gn.includes("walnut") || gn.includes("nut")) return "🌰";
    if (gn.includes("almond") || gn.includes("pistachio") || gn.includes("cashew")) return "🥜";
    if (gn.includes("seed") || gn.includes("bean") || gn.includes("grain")) return "🌱";
    if (gn.includes("fruit") || gn.includes("date") || gn.includes("fig")) return "🍇";
    return "📦";
  };

  const getCleanBranchName = (r: any): string => {
    const b = r.branch_name || r.branchName || r.city_branch_name || r.cityBranchName || "";
    if (b) {
      if (b.toLowerCase().includes("al ras")) return "Al Ras";
      if (b.toLowerCase().includes("chaman")) return "Chaman";
      if (b.toLowerCase().includes("dubai")) return "Dubai";
      if (b.toLowerCase().includes("kabul")) return "Kabul";
      return b.replace(/Main Branch|City Branch|Branch/gi, "").trim() || b;
    }
    return "Al Ras";
  };

  const getBillNumber = (r: any): string => {
    return r.manual_bill_no || r.bill_no || r.journal_serial_no || r.serial_no || (r.id ? `LP-${String(r.id).slice(0, 6).toUpperCase()}` : "—");
  };

  // Distinct filter options
  const filterOptions = useMemo(() => {
    const branches = new Set<string>();
    const suppliers = new Set<string>();
    const statuses = new Set<string>();

    purchases.forEach((r) => {
      const br = getCleanBranchName(r);
      if (br) branches.add(br);
      const sup = String(r.supplier_name || r.supplierName || "").trim();
      if (sup) suppliers.add(sup);
      const st = String(r.status || "Draft").trim();
      if (st) statuses.add(st);
    });

    return {
      branches: Array.from(branches).sort(),
      suppliers: Array.from(suppliers).sort(),
      statuses: Array.from(statuses).sort(),
    };
  }, [purchases]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    return purchases.filter((r) => {
      if (filterBranch !== "all") {
        const br = getCleanBranchName(r);
        if (br.toLowerCase() !== filterBranch.toLowerCase()) return false;
      }
      if (filterSupplier !== "all") {
        const sup = String(r.supplier_name || r.supplierName || "").trim().toLowerCase();
        if (sup !== filterSupplier.toLowerCase()) return false;
      }
      if (filterStatus !== "all") {
        const pCost = Number(r.final_cost || r.purchase_cost || 0);
        const pPaid = Number(r.posted_paid_amount || r.paid_amount || r.advance_amount || 0);
        const stRaw = String(r.status || "").toLowerCase();
        let computedStatus = "Pending";
        if (stRaw === "posted" || stRaw === "completed" || stRaw === "accepted" || (pCost > 0 && pPaid >= pCost - 0.05)) {
          computedStatus = "Paid";
        } else if (pPaid > 0.05) {
          computedStatus = "Partial";
        }
        if (computedStatus.toLowerCase() !== filterStatus.toLowerCase()) return false;
      }

      if (filterDateFrom) {
        const d = r.created_at || r.purchase_date || r.transfer_date;
        if (d && new Date(d) < new Date(filterDateFrom)) return false;
      }
      if (filterDateTo) {
        const d = r.created_at || r.purchase_date || r.transfer_date;
        if (d && new Date(d) > new Date(filterDateTo + "T23:59:59")) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const bNo = getBillNumber(r).toLowerCase();
        const sName = String(r.supplier_name || r.supplierName || "").toLowerCase();
        const gName = String(r.goods_name || r.goodsName || "").toLowerCase();
        const br = getCleanBranchName(r).toLowerCase();
        if (!bNo.includes(q) && !sName.includes(q) && !gName.includes(q) && !br.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [purchases, filterBranch, filterSupplier, filterStatus, filterDateFrom, filterDateTo, searchQuery]);

  // Card 1: Local Purchase Summary (Strictly per-currency totals!)
  const summaryMetrics = useMemo(() => {
    const purchaseByCurr: Record<string, number> = {};
    const paidByCurr: Record<string, number> = {};
    const balanceByCurr: Record<string, number> = {};

    filteredRows.forEach((r) => {
      const cur = getCurrency(r);
      const cost = Number(r.final_cost || r.purchase_cost || 0);
      const paid = Number(r.posted_paid_amount || r.paid_amount || r.advance_amount || 0);
      const bal = Math.max(0, cost - paid);

      purchaseByCurr[cur] = (purchaseByCurr[cur] || 0) + cost;
      paidByCurr[cur] = (paidByCurr[cur] || 0) + paid;
      balanceByCurr[cur] = (balanceByCurr[cur] || 0) + bal;
    });

    return {
      totalBills: filteredRows.length,
      purchaseByCurr,
      paidByCurr,
      balanceByCurr,
    };
  }, [filteredRows]);

  // Card 2: Purchase Status Breakdown (Paid, Partial, Pending)
  const statusMetrics = useMemo(() => {
    let paid = 0;
    let partial = 0;
    let pending = 0;
    const total = filteredRows.length;

    filteredRows.forEach((r) => {
      const cost = Number(r.final_cost || r.purchase_cost || 0);
      const paidAmt = Number(r.posted_paid_amount || r.paid_amount || r.advance_amount || 0);
      const st = String(r.status || "").toLowerCase();

      if (st === "posted" || st === "completed" || st === "accepted" || (cost > 0 && paidAmt >= cost - 0.05)) {
        paid++;
      } else if (paidAmt > 0.05) {
        partial++;
      } else {
        pending++;
      }
    });

    return {
      paid,
      paidPct: total > 0 ? ((paid / total) * 100).toFixed(1) : "0.0",
      partial,
      partialPct: total > 0 ? ((partial / total) * 100).toFixed(1) : "0.0",
      pending,
      pendingPct: total > 0 ? ((pending / total) * 100).toFixed(1) : "0.0",
      total,
    };
  }, [filteredRows]);

  // Card 3: Branch Wise Local Purchase (Native Currency per branch)
  const branchMetrics = useMemo(() => {
    const map = new Map<string, { branch: string; bills: number; currency: string; purchaseAmount: number; paidAmount: number; balance: number }>();

    filteredRows.forEach((r) => {
      const branch = getCleanBranchName(r);
      const cur = getCurrency(r);
      const cost = Number(r.final_cost || r.purchase_cost || 0);
      const paid = Number(r.posted_paid_amount || r.paid_amount || r.advance_amount || 0);
      const bal = Math.max(0, cost - paid);

      const entry = map.get(branch) || {
        branch,
        bills: 0,
        currency: cur,
        purchaseAmount: 0,
        paidAmount: 0,
        balance: 0,
      };

      entry.bills += 1;
      entry.purchaseAmount += cost;
      entry.paidAmount += paid;
      entry.balance += bal;
      map.set(branch, entry);
    });

    return Array.from(map.values()).sort((a, b) => b.bills - a.bills);
  }, [filteredRows]);

  // Status Badge Component
  const renderStatusBadge = (r: any) => {
    const cost = Number(r.final_cost || r.purchase_cost || 0);
    const paidAmt = Number(r.posted_paid_amount || r.paid_amount || r.advance_amount || 0);
    const st = String(r.status || "").toLowerCase();

    if (st === "posted" || st === "completed" || st === "accepted" || (cost > 0 && paidAmt >= cost - 0.05)) {
      return (
        <span className="inline-block px-3 py-1 rounded-md text-[11px] font-bold bg-[#dcfce7] text-[#15803d]">
          {tr("Paid")}
        </span>
      );
    }
    if (paidAmt > 0.05) {
      return (
        <span className="inline-block px-3 py-1 rounded-md text-[11px] font-bold bg-[#fef3c7] text-[#b45309]">
          {tr("Partial")}
        </span>
      );
    }
    return (
      <span className="inline-block px-3 py-1 rounded-md text-[11px] font-bold bg-[#ffedd5] text-[#c2410c]">
        {tr("Pending")}
      </span>
    );
  };

  const resetFilters = () => {
    setFilterBranch("all");
    setFilterSupplier("all");
    setFilterStatus("all");
    setFilterDateFrom("");
    setFilterDateTo("");
    setSearchQuery("");
  };

  const handleExportCsv = () => {
    const headers = [
      "#",
      "Bill No",
      "Date",
      "Branch",
      "Supplier Name",
      "Goods Name",
      "Brand",
      "Size",
      "Quantity",
      "Unit",
      "Gross Weight",
      "Net Weight",
      "Loading Country / Port",
      "Loading Date",
      "Receiving Country / Port",
      "Receiving Date",
      "Currency",
      "Purchase Amount",
      "Final Amount",
      "Paid Amount",
      "Balance",
      "Status",
    ];

    const rows = filteredRows.map((r, i) => {
      const cur = getCurrency(r);
      const purchCost = Number(r.purchase_cost || 0);
      const finalCost = Number(r.final_cost || purchCost);
      const paid = Number(r.posted_paid_amount || r.paid_amount || r.advance_amount || 0);
      const bal = Math.max(0, finalCost - paid);

      return [
        i + 1,
        `"${getBillNumber(r)}"`,
        `"${formatDashDate(r.created_at || r.purchase_date)}"`,
        `"${getCleanBranchName(r)}"`,
        `"${(r.supplier_name || r.supplierName || "").replace(/"/g, '""')}"`,
        `"${(r.goods_name || r.goodsName || "").replace(/"/g, '""')}"`,
        `"${(r.brand || "DGT").replace(/"/g, '""')}"`,
        `"${(r.size || "STANDARD").replace(/"/g, '""')}"`,
        Number(r.quantity_kgs || r.numbers || 0),
        `"${r.quantity_name || "MT"}"`,
        Number(r.total_gross_weight || 0),
        Number(r.net_weight || 0),
        `"${(r.origin_country_name || "USA") + " / " + (r.loading_port || "New York")}"`,
        `"${formatDashDate(r.loading_date || r.transfer_date)}"`,
        `"${(r.country_name || "UAE") + " / " + (r.warehouse_name || "Jebel Ali")}"`,
        `"${formatDashDate(r.created_at)}"`,
        `"${cur}"`,
        purchCost.toFixed(2),
        finalCost.toFixed(2),
        paid.toFixed(2),
        bal.toFixed(2),
        `"${r.status || "Pending"}"`,
      ].join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `local-purchase-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      dir={isRtl ? "rtl" : "ltr"}
      className={cn(
        "w-full space-y-3.5 p-2 sm:p-4 text-slate-900 dark:text-slate-100",
        isFullScreen && "fixed inset-0 z-50 overflow-y-auto bg-slate-50 dark:bg-slate-950 p-4"
      )}
    >
      {/* ── 1. Page Title & Super Admin Badge & Breadcrumbs ── */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
            <ShoppingCart className="h-5 w-5" aria-hidden="true" />
          </div>
          <h1 className="text-xl font-black tracking-tight text-[#1e3a8a] dark:text-blue-400">
            {tr("LOCAL PURCHASE (GLOBAL & BRANCH WISE)")}
          </h1>
          <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-[#eff6ff] px-2.5 py-0.5 text-xs font-bold text-[#1d4ed8] dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300">
            <Crown className="h-3 w-3" aria-hidden="true" />
            {tr("Super Admin View")}
          </span>
        </div>

        <nav aria-label="breadcrumb" className="text-xs font-semibold text-slate-500">
          <span className="hover:text-slate-700">{tr("Dashboard")}</span>
          <span className="mx-1.5 text-slate-400">/</span>
          <span className="hover:text-slate-700">{tr("Purchase")}</span>
          <span className="mx-1.5 text-slate-400">/</span>
          <span className="font-bold text-slate-800 dark:text-slate-200">{tr("Local Purchase")}</span>
        </nav>
      </div>

      {/* ── 2. Top Action Toolbar ── */}
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
                  onClick={() => setReportsOpen(false)}
                  className="w-full flex items-center gap-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 px-3 py-2 text-xs font-bold text-blue-700 dark:text-blue-300"
                >
                  <ShoppingCart className="h-4 w-4" />
                  <span>{tr("Local Purchase")}</span>
                  <Check className="ms-auto h-3.5 w-3.5 text-blue-600" />
                </button>
                <a
                  href="/dashboard/purchase/local-purchase-journal-report"
                  className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/60"
                >
                  <BookOpen className="h-4 w-4 text-slate-400" />
                  <span>{tr("Local Purchase Journal")}</span>
                </a>
                <a
                  href="/dashboard/purchase/local-purchase-loading"
                  className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/60"
                >
                  <Truck className="h-4 w-4 text-slate-400" />
                  <span>{tr("Loading Report")}</span>
                </a>
                <a
                  href="/dashboard/journal/purchase-order-payment/advance"
                  className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/60"
                >
                  <CreditCard className="h-4 w-4 text-slate-400" />
                  <span>{tr("Payment Report")}</span>
                </a>
                <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
                <a
                  href="/dashboard/purchase/local-purchase-export"
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
          <button
            type="button"
            onClick={() => onRefresh?.()}
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
              className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 transition cursor-pointer"
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
        {/* Card 1: Local Purchase Summary (Span 4) */}
        <div className="lg:col-span-4 rounded-xl border border-amber-200/90 bg-gradient-to-b from-[#fffef8] to-white p-3.5 shadow-xs dark:border-amber-900/60 dark:from-slate-900 dark:to-slate-950 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-amber-100 dark:border-amber-900/40">
              <div className="flex items-center gap-2">
                <span className="text-amber-500 text-base">📊</span>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
                  {tr("LOCAL PURCHASE SUMMARY")}
                </h3>
              </div>
            </div>

            <div className="space-y-1.5 py-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-600 dark:text-slate-400">{tr("Total Bills")}</span>
                <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{fmtInt(summaryMetrics.totalBills)}</span>
              </div>

              {/* Total Purchase in native currencies */}
              <div className="flex items-start justify-between">
                <span className="font-semibold text-slate-600 dark:text-slate-400">{tr("Total Purchase")}</span>
                <div className="text-end font-mono font-bold text-slate-900 dark:text-slate-100 space-y-0.5">
                  {Object.keys(summaryMetrics.purchaseByCurr).length === 0 ? (
                    <div>AED 0.00</div>
                  ) : (
                    Object.entries(summaryMetrics.purchaseByCurr).map(([c, amt]) => (
                      <div key={c}>{c} {fmt(amt)}</div>
                    ))
                  )}
                </div>
              </div>

              {/* Total Paid in native currencies */}
              <div className="flex items-start justify-between">
                <span className="font-semibold text-slate-600 dark:text-slate-400">{tr("Total Paid")}</span>
                <div className="text-end font-mono font-bold text-slate-900 dark:text-slate-100 space-y-0.5">
                  {Object.keys(summaryMetrics.paidByCurr).length === 0 ? (
                    <div>AED 0.00</div>
                  ) : (
                    Object.entries(summaryMetrics.paidByCurr).map(([c, amt]) => (
                      <div key={c}>{c} {fmt(amt)}</div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Highlighted Amber Bar with bold red balance */}
          <div className="rounded-lg bg-[#fed7aa]/50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900/60 px-3 py-2 flex items-center justify-between">
            <span className="font-black text-xs text-slate-900 dark:text-slate-100">{tr("Balance (Remaining)")}</span>
            <div className="text-end font-mono font-black text-xs text-[#ea580c] dark:text-orange-400 space-y-0.5">
              {Object.keys(summaryMetrics.balanceByCurr).length === 0 ? (
                <div>AED 0.00</div>
              ) : (
                Object.entries(summaryMetrics.balanceByCurr).map(([c, amt]) => (
                  <div key={c}>{c} {fmt(amt)}</div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Card 2: Purchase Status (Span 3) */}
        <div className="lg:col-span-3 rounded-xl border border-blue-200/90 bg-gradient-to-b from-[#f8faff] to-white p-3.5 shadow-xs dark:border-blue-900/60 dark:from-slate-900 dark:to-slate-950 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-blue-100 dark:border-blue-900/40">
              <div className="flex items-center gap-2">
                <span className="text-blue-500 text-base">📈</span>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
                  {tr("PURCHASE STATUS")}
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
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    <span>{tr("Paid")}</span>
                  </td>
                  <td className="py-1.5 text-end font-mono">{statusMetrics.paid}</td>
                  <td className="py-1.5 text-end font-mono text-slate-500">{statusMetrics.paidPct}%</td>
                </tr>
                <tr>
                  <td className="py-1.5 flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-full bg-amber-400 inline-block" />
                    <span>{tr("Partial")}</span>
                  </td>
                  <td className="py-1.5 text-end font-mono">{statusMetrics.partial}</td>
                  <td className="py-1.5 text-end font-mono text-slate-500">{statusMetrics.partialPct}%</td>
                </tr>
                <tr>
                  <td className="py-1.5 flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-full bg-orange-400 inline-block" />
                    <span>{tr("Pending")}</span>
                  </td>
                  <td className="py-1.5 text-end font-mono">{statusMetrics.pending}</td>
                  <td className="py-1.5 text-end font-mono text-slate-500">{statusMetrics.pendingPct}%</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs font-black">
            <span>{tr("Total")}</span>
            <div className="flex items-center gap-4">
              <span className="font-mono">{statusMetrics.total}</span>
              <span className="font-mono text-slate-500">100.0%</span>
            </div>
          </div>
        </div>

        {/* Card 3: Branch Wise Local Purchase (Span 5) */}
        <div className="lg:col-span-5 rounded-xl border border-emerald-200/90 bg-gradient-to-b from-[#f7fcf8] to-white p-3.5 shadow-xs dark:border-emerald-900/60 dark:from-slate-900 dark:to-slate-950 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-emerald-100 dark:border-emerald-900/40">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-emerald-600" />
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
                  {tr("BRANCH WISE LOCAL PURCHASE")}
                </h3>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs mt-1 border-collapse whitespace-nowrap">
                <thead>
                  <tr className="text-[10px] font-extrabold uppercase text-slate-500 dark:text-slate-400 border-b border-slate-150 dark:border-slate-800">
                    <th className="py-1 text-center w-6">#</th>
                    <th className="py-1 text-start">{tr("Branch")}</th>
                    <th className="py-1 text-center">{tr("Bills")}</th>
                    <th className="py-1 text-end">{tr("Purchase Amount")}</th>
                    <th className="py-1 text-end">{tr("Paid Amount")}</th>
                    <th className="py-1 text-end">{tr("Balance")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-semibold text-slate-800 dark:text-slate-200">
                  {branchMetrics.slice(0, 4).map((b, idx) => (
                    <tr key={b.branch}>
                      <td className="py-1.5 text-center font-mono text-slate-400">{idx + 1}</td>
                      <td className="py-1.5 text-start font-bold">{b.branch}</td>
                      <td className="py-1.5 text-center font-mono">{b.bills}</td>
                      <td className="py-1.5 text-end font-mono">{b.currency} {fmt(b.purchaseAmount)}</td>
                      <td className="py-1.5 text-end font-mono text-emerald-700">{b.currency} {fmt(b.paidAmount)}</td>
                      <td className="py-1.5 text-end font-mono text-rose-600">{b.currency} {fmt(b.balance)}</td>
                    </tr>
                  ))}
                  {branchMetrics.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-3 text-center text-slate-400 text-xs">
                        {tr("No records found")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs font-black">
            <span>{tr("Total")}</span>
            <div className="flex items-center gap-3">
              <span className="font-mono">{filteredRows.length}</span>
              <span className="font-mono text-slate-500">
                {Object.entries(summaryMetrics.purchaseByCurr).map(([c, amt]) => `${c} ${fmt(amt)}`).join(" | ") || "0.00"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── 4. Navigation Tab Strip ── */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg bg-[#2563eb] text-white px-4 py-2 text-xs font-black shadow-xs cursor-pointer"
        >
          <ShoppingCart className="h-4 w-4" />
          <span>{tr("Local Purchase")}</span>
        </button>

        <a
          href="/dashboard/purchase/local-purchase-journal-report"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-4 py-2 text-xs font-bold text-slate-700 shadow-2xs transition dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
        >
          <BookOpen className="h-4 w-4 text-slate-500" />
          <span>{tr("Local Purchase Journal")}</span>
        </a>

        <a
          href="/dashboard/purchase/local-purchase-loading"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-4 py-2 text-xs font-bold text-slate-700 shadow-2xs transition dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
        >
          <Truck className="h-4 w-4 text-slate-500" />
          <span>{tr("Loading Report")}</span>
        </a>

        <div className="relative group">
          <a
            href="/dashboard/journal/purchase-order-payment/advance"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-4 py-2 text-xs font-bold text-slate-700 shadow-2xs transition dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
          >
            <CreditCard className="h-4 w-4 text-slate-500" />
            <span>{tr("Payment Report")}</span>
            <ChevronDown className="h-3 w-3 opacity-60" />
          </a>
        </div>

        <div className="relative group">
          <a
            href="/dashboard/purchase/local-purchase-export"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-4 py-2 text-xs font-bold text-slate-700 shadow-2xs transition dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
          >
            <Grid className="h-4 w-4 text-slate-500" />
            <span>{tr("More Reports")}</span>
            <ChevronDown className="h-3 w-3 opacity-60" />
          </a>
        </div>
      </div>

      {/* ── 5. Filter Section & Header ── */}
      <div className="rounded-xl border border-slate-200 shadow-xs overflow-hidden dark:border-slate-800">
        {/* Blue Banner Header */}
        <div className="bg-[#2563eb] text-white px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            <h2 className="text-xs font-black tracking-wider uppercase">
              {tr("LOCAL PURCHASE LIST (ALL BRANCHES)")}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {/* Export Dropdown */}
            <div className="relative" ref={exportRef}>
              <button
                type="button"
                onClick={() => setExportOpen((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/30 bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 text-xs font-bold transition cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
                <span>{tr("Export")}</span>
                <ChevronDown className="h-3 w-3 opacity-80" />
              </button>

              {exportOpen && (
                <div className="absolute end-0 top-full mt-1.5 z-40 w-44 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 animate-in fade-in-50 zoom-in-95">
                  <button
                    type="button"
                    onClick={() => {
                      handleExportCsv();
                      setExportOpen(false);
                    }}
                    className="w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                    <span>{tr("Export Excel")}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      window.print();
                      setExportOpen(false);
                    }}
                    className="w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <FileText className="h-3.5 w-3.5 text-rose-500" />
                    <span>{tr("Export PDF")}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleExportCsv();
                      setExportOpen(false);
                    }}
                    className="w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <Download className="h-3.5 w-3.5 text-slate-500" />
                    <span>{tr("Export CSV")}</span>
                  </button>
                </div>
              )}
            </div>

            {/* + New Purchase Button */}
            <button
              type="button"
              onClick={onNewPurchase}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white text-[#2563eb] hover:bg-blue-50 px-3 py-1.5 text-xs font-black shadow-xs transition cursor-pointer"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>+ {tr("New Purchase")}</span>
            </button>
          </div>
        </div>

        {/* Filter Inputs Row */}
        <div className="bg-white dark:bg-slate-900 p-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-2.5 text-xs">
          {/* Branch Select */}
          <div className="w-36">
            <select
              value={filterBranch}
              onChange={(e) => setFilterBranch(e.target.value)}
              className="w-full h-8 rounded-lg border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-700 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="all">{tr("All Branches")}</option>
              {filterOptions.branches.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          {/* Supplier Select */}
          <div className="w-40">
            <select
              value={filterSupplier}
              onChange={(e) => setFilterSupplier(e.target.value)}
              className="w-full h-8 rounded-lg border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-700 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="all">{tr("All Suppliers")}</option>
              {filterOptions.suppliers.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Status Select */}
          <div className="w-32">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full h-8 rounded-lg border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-700 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="all">{tr("All Status")}</option>
              <option value="Paid">{tr("Paid")}</option>
              <option value="Partial">{tr("Partial")}</option>
              <option value="Pending">{tr("Pending")}</option>
            </select>
          </div>

          {/* Date From */}
          <div className="w-36">
            <input
              type="date"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
              className="w-full h-8 rounded-lg border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-700 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            />
          </div>

          {/* Date To */}
          <div className="w-36">
            <input
              type="date"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
              className="w-full h-8 rounded-lg border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-700 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            />
          </div>

          {/* Search Input */}
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={tr("SEARCH BILL NO., SUPPLIER, GOODS...")}
              className="w-full h-8 rounded-lg border border-slate-300 bg-white ps-8 pe-3 text-xs font-medium text-slate-800 placeholder-slate-400 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          {/* Search Button */}
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563eb] hover:bg-[#1d4ed8] text-white px-3.5 py-1.5 text-xs font-bold shadow-xs transition cursor-pointer"
          >
            <Search className="h-3 w-3" />
            <span>{tr("Search")}</span>
          </button>

          {/* Reset Button */}
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 px-3 py-1.5 text-xs font-bold shadow-xs transition dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 cursor-pointer"
          >
            <RotateCcw className="h-3 w-3 text-slate-500" />
            <span>{tr("Reset")}</span>
          </button>
        </div>
      </div>

      {/* ── 6. Main 15-Column Table with Amber Header ── */}
      <div className="rounded-xl border border-slate-200 shadow-xs overflow-hidden dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse whitespace-nowrap">
            {/* Approved Light Amber Header (#ffd257) with dark bold text */}
            <thead className="bg-[#ffd257] text-slate-900 border-b border-amber-300 text-[11px] font-black uppercase tracking-tight">
              <tr>
                <th className="py-2.5 px-2 text-center w-8">#</th>
                <th className="py-2.5 px-3 text-start">{tr("BILL NO. / DATE")}</th>
                <th className="py-2.5 px-3 text-start">{tr("Branch")}</th>
                <th className="py-2.5 px-3 text-start">{tr("Supplier Name")}</th>
                <th className="py-2.5 px-3 text-start">{tr("GOODS NAME (BRAND / SIZE)")}</th>
                <th className="py-2.5 px-2 text-center">{tr("Qty (Unit)")}</th>
                <th className="py-2.5 px-2 text-end">{tr("GROSS WT NET WT (KG)")}</th>
                <th className="py-2.5 px-3 text-start">{tr("LOADING (FROM) COUNTRY / PORT / DATE")}</th>
                <th className="py-2.5 px-3 text-start">{tr("RECEIVING (TO) COUNTRY / PORT / DATE")}</th>
                <th className="py-2.5 px-2 text-end">{tr("Purchase Amount")}</th>
                <th className="py-2.5 px-2 text-end">{tr("Final Amount")}</th>
                <th className="py-2.5 px-2 text-end">{tr("Paid Amount")}</th>
                <th className="py-2.5 px-2 text-end">{tr("Balance")}</th>
                <th className="py-2.5 px-3 text-center">{tr("Status")}</th>
                <th className="py-2.5 px-2 text-center w-10">{tr("Actions")}</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-semibold text-slate-800 dark:text-slate-200">
              {loading && purchases.length === 0 ? (
                <tr>
                  <td colSpan={15} className="py-8 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                      <span>{tr("Loading data...")}</span>
                    </div>
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={15} className="py-8 text-center text-slate-400">
                    {tr("No records found")}
                  </td>
                </tr>
              ) : (
                filteredRows.map((r, idx) => {
                  const billNo = getBillNumber(r);
                  const billDate = formatDashDate(r.created_at || r.purchase_date);
                  const branchName = getCleanBranchName(r);
                  const supplierName = r.supplier_name || r.supplierName || "—";
                  const goodsName = r.goods_name || r.goodsName || "Walnut Kernel";
                  const brand = r.brand || "DGT";
                  const size = r.size || "32/34";
                  const qty = Number(r.quantity_kgs || r.numbers || 0);
                  const unit = r.quantity_name || "MT";
                  const grossWt = Number(r.total_gross_weight || (qty > 0 ? qty * 1.02 : 0));
                  const netWt = Number(r.net_weight || qty);
                  const loadingOrigin = `${r.origin_country_name || "USA"} / ${r.loading_port || "New York"}`;
                  const loadingDate = formatDashDate(r.loading_date || r.transfer_date || r.created_at);
                  const receivingDest = `${r.country_name || "UAE"} / ${r.warehouse_name || "Jebel Ali"}`;
                  const receivingDate = formatDashDate(r.created_at);

                  const cur = getCurrency(r);
                  const purchAmt = Number(r.purchase_cost || 0);
                  const finalAmt = Number(r.final_cost || purchAmt);
                  const paidAmt = Number(r.posted_paid_amount || r.paid_amount || r.advance_amount || 0);
                  const balanceAmt = Math.max(0, finalAmt - paidAmt);

                  return (
                    <tr
                      key={r.id || idx}
                      className="hover:bg-blue-50/40 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      {/* Col 1: # */}
                      <td className="py-2.5 px-2 text-center font-mono text-slate-400 text-[11px]">
                        {idx + 1}
                      </td>

                      {/* Col 2: Bill No. / Date */}
                      <td className="py-2 px-3 text-start">
                        <button
                          type="button"
                          onClick={() => {
                            setFullBillRow(r);
                            setSelectedRow(r);
                          }}
                          className="font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer block leading-tight text-xs"
                        >
                          {billNo}
                        </button>
                        <div className="flex items-center gap-1 text-[10px] text-slate-500 font-medium mt-0.5">
                          <Calendar className="h-3 w-3 opacity-60" />
                          <span>{billDate}</span>
                        </div>
                      </td>

                      {/* Col 3: Branch */}
                      <td className="py-2.5 px-3 text-start font-bold text-slate-800 dark:text-slate-200">
                        {branchName}
                      </td>

                      {/* Col 4: Supplier Name */}
                      <td className="py-2.5 px-3 text-start font-medium text-slate-700 dark:text-slate-300">
                        {supplierName}
                      </td>

                      {/* Col 5: Goods Name (Brand / Size) */}
                      <td className="py-2 px-3 text-start">
                        <div className="flex items-center gap-1.5">
                          <span>{getGoodsEmoji(goodsName)}</span>
                          <span className="font-bold text-slate-900 dark:text-slate-100">{goodsName}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-medium ps-5">
                          Brand: {brand} | Size: {size}
                        </div>
                      </td>

                      {/* Col 6: Qty (Unit) */}
                      <td className="py-2.5 px-2 text-center font-bold text-slate-800 dark:text-slate-200">
                        {fmtInt(qty)} {unit}
                      </td>

                      {/* Col 7: Gross Wt Net Wt (Kg) */}
                      <td className="py-2 px-2 text-end font-mono">
                        <div className="font-bold text-slate-800 dark:text-slate-200">{fmt(grossWt)}</div>
                        <div className="text-[10px] text-slate-500 font-semibold">{fmt(netWt)}</div>
                      </td>

                      {/* Col 8: Loading (From) Country / Port / Date */}
                      <td className="py-2 px-3 text-start text-xs">
                        <div className="font-semibold text-slate-800 dark:text-slate-200">{loadingOrigin}</div>
                        <div className="text-[10px] text-slate-500 font-medium">{loadingDate}</div>
                      </td>

                      {/* Col 9: Receiving (To) Country / Port / Date */}
                      <td className="py-2 px-3 text-start text-xs">
                        <div className="font-semibold text-slate-800 dark:text-slate-200">{receivingDest}</div>
                        <div className="text-[10px] text-slate-500 font-medium">{receivingDate}</div>
                      </td>

                      {/* Col 10: Purchase Amount (Native Currency) */}
                      <td className="py-2.5 px-2 text-end font-mono font-bold text-slate-800 dark:text-slate-200">
                        {cur} {fmt(purchAmt)}
                      </td>

                      {/* Col 11: Final Amount (Native Currency) */}
                      <td className="py-2.5 px-2 text-end font-mono font-bold text-slate-800 dark:text-slate-200">
                        {cur} {fmt(finalAmt)}
                      </td>

                      {/* Col 12: Paid Amount (Native Currency) */}
                      <td className="py-2.5 px-2 text-end font-mono font-bold text-slate-800 dark:text-slate-200">
                        {cur} {fmt(paidAmt)}
                      </td>

                      {/* Col 13: Balance (Native Currency: green if 0, bold red if > 0) */}
                      <td className="py-2.5 px-2 text-end font-mono font-black">
                        {balanceAmt <= 0.05 ? (
                          <span className="text-emerald-600">{cur} 0.00</span>
                        ) : (
                          <span className="text-rose-600">{cur} {fmt(balanceAmt)}</span>
                        )}
                      </td>

                      {/* Col 14: Status */}
                      <td className="py-2.5 px-3 text-center">
                        {renderStatusBadge(r)}
                      </td>

                      {/* Col 15: Actions (⋮ Menu) */}
                      <td className="py-2.5 px-2 text-center relative" data-row-menu>
                        <button
                          type="button"
                          onClick={() => setActiveRowMenuId(activeRowMenuId === r.id ? null : r.id)}
                          className="inline-flex items-center justify-center h-7 w-7 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition cursor-pointer"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>

                        {activeRowMenuId === r.id && (
                          <div className="absolute end-2 top-8 z-40 w-48 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 text-start animate-in fade-in-50 zoom-in-95">
                            <button
                              type="button"
                              onClick={() => {
                                setActiveRowMenuId(null);
                                onViewVoucher(r);
                              }}
                              className="w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                            >
                              <Eye className="h-3.5 w-3.5 text-blue-600" />
                              <span>{tr("View Voucher")}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setActiveRowMenuId(null);
                                onEditPurchase(r);
                              }}
                              className="w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                            >
                              <Edit3 className="h-3.5 w-3.5 text-amber-600" />
                              <span>{tr("Edit Purchase")}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setActiveRowMenuId(null);
                                onViewVoucher(r);
                              }}
                              className="w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                            >
                              <Printer className="h-3.5 w-3.5 text-slate-600" />
                              <span>{tr("Print Voucher")}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setActiveRowMenuId(null);
                                router.push(`/dashboard/purchase/local-purchase/${r.id}/goods-transfer`);
                              }}
                              className="w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                            >
                              <Truck className="h-3.5 w-3.5 text-emerald-600" />
                              <span>{tr("Loading & Goods Transfer")}</span>
                            </button>

                            <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

                            <button
                              type="button"
                              onClick={async () => {
                                setActiveRowMenuId(null);
                                if (confirm(tr("Are you sure you want to delete this purchase entry?"))) {
                                  await onDeletePurchase(r.id);
                                }
                              }}
                              className="w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                              <span>{tr("Delete")}</span>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>

            {/* Approved Summary Footer Row (#ffd257) with per-currency totals */}
            <tfoot className="bg-[#ffd257] text-slate-900 border-t-2 border-amber-300 font-mono text-xs font-black">
              <tr>
                <td colSpan={5} className="py-2.5 px-3 text-start font-sans font-black">
                  {tr("Total")} ({filteredRows.length} {filteredRows.length === 1 ? tr("Bill") : tr("Bills")})
                </td>
                <td className="py-2.5 px-2 text-center font-bold">
                  {fmtInt(filteredRows.reduce((acc, r) => acc + Number(r.quantity_kgs || r.numbers || 0), 0))} MT
                </td>
                <td className="py-2.5 px-2 text-end font-bold">
                  <div>{fmt(filteredRows.reduce((acc, r) => acc + Number(r.total_gross_weight || 0), 0))}</div>
                  <div className="text-[10px]">{fmt(filteredRows.reduce((acc, r) => acc + Number(r.net_weight || 0), 0))}</div>
                </td>
                <td colSpan={2} />
                {/* Total Purchase Amount (Per Currency, never combined) */}
                <td className="py-2.5 px-2 text-end">
                  {Object.entries(summaryMetrics.purchaseByCurr).map(([c, amt]) => (
                    <div key={c}>{c} {fmt(amt)}</div>
                  ))}
                </td>
                {/* Total Final Amount */}
                <td className="py-2.5 px-2 text-end">
                  {Object.entries(summaryMetrics.purchaseByCurr).map(([c, amt]) => (
                    <div key={c}>{c} {fmt(amt)}</div>
                  ))}
                </td>
                {/* Total Paid Amount */}
                <td className="py-2.5 px-2 text-end text-emerald-800">
                  {Object.entries(summaryMetrics.paidByCurr).map(([c, amt]) => (
                    <div key={c}>{c} {fmt(amt)}</div>
                  ))}
                </td>
                {/* Total Balance (bold red font) */}
                <td className="py-2.5 px-2 text-end text-rose-700">
                  {Object.entries(summaryMetrics.balanceByCurr).map(([c, amt]) => (
                    <div key={c}>{c} {fmt(amt)}</div>
                  ))}
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ── 7. Filter Modal ── */}
      {filterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl border border-slate-200 space-y-4 dark:bg-slate-900 dark:border-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-blue-600" />
                <h3 className="text-sm font-black uppercase text-slate-800 dark:text-slate-100">
                  {tr("Filter")} — {tr("Local Purchase")}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setFilterModalOpen(false)}
                className="h-7 w-7 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 flex items-center justify-center"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">{tr("Branch")}</label>
                <select
                  value={filterBranch}
                  onChange={(e) => setFilterBranch(e.target.value)}
                  className="w-full h-8 rounded-lg border border-slate-300 bg-white px-2 font-semibold text-slate-700 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <option value="all">{tr("All Branches")}</option>
                  {filterOptions.branches.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">{tr("Supplier")}</label>
                <select
                  value={filterSupplier}
                  onChange={(e) => setFilterSupplier(e.target.value)}
                  className="w-full h-8 rounded-lg border border-slate-300 bg-white px-2 font-semibold text-slate-700 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <option value="all">{tr("All Suppliers")}</option>
                  {filterOptions.suppliers.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">{tr("Status")}</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full h-8 rounded-lg border border-slate-300 bg-white px-2 font-semibold text-slate-700 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <option value="all">{tr("All Status")}</option>
                  <option value="Paid">{tr("Paid")}</option>
                  <option value="Partial">{tr("Partial")}</option>
                  <option value="Pending">{tr("Pending")}</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">{tr("Date From")}</label>
                <input
                  type="date"
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                  className="w-full h-8 rounded-lg border border-slate-300 bg-white px-2 font-semibold text-slate-700 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">{tr("Date To")}</label>
                <input
                  type="date"
                  value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                  className="w-full h-8 rounded-lg border border-slate-300 bg-white px-2 font-semibold text-slate-700 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">{tr("Search")}</label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={tr("SEARCH BILL NO., SUPPLIER, GOODS...")}
                  className="w-full h-8 rounded-lg border border-slate-300 bg-white px-2 font-semibold text-slate-700 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={resetFilters}
                className="px-3.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition cursor-pointer"
              >
                {tr("Reset")}
              </button>
              <button
                type="button"
                onClick={() => setFilterModalOpen(false)}
                className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition cursor-pointer"
              >
                {tr("Apply")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 8. Open Full Bill Modal ── */}
      {fullBillRow && (
        <OpenFullBillModal
          isOpen={Boolean(fullBillRow)}
          onClose={() => setFullBillRow(null)}
          order={fullBillRow}
          payments={fullBillRow.payment_entries || []}
        />
      )}

      {/* ── 9. Detail Drawer ── */}
      {selectedRow && !fullBillRow && (
        <DetailDrawer
          isOpen={drawerOpen}
          onClose={() => {
            setDrawerOpen(false);
            setSelectedRow(null);
          }}
          title={`${tr("Local Purchase Voucher")} ${getBillNumber(selectedRow)}`}
        >
          <div className="p-4 space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-slate-500 font-bold uppercase">{tr("Bill No.")}:</span>
                <p className="font-mono font-bold text-slate-800 dark:text-slate-200">{getBillNumber(selectedRow)}</p>
              </div>
              <div>
                <span className="text-slate-500 font-bold uppercase">{tr("Date")}:</span>
                <p className="font-semibold text-slate-800 dark:text-slate-200">{formatDashDate(selectedRow.created_at || selectedRow.purchase_date)}</p>
              </div>
              <div>
                <span className="text-slate-500 font-bold uppercase">{tr("Branch")}:</span>
                <p className="font-semibold text-slate-800 dark:text-slate-200">{getCleanBranchName(selectedRow)}</p>
              </div>
              <div>
                <span className="text-slate-500 font-bold uppercase">{tr("Supplier")}:</span>
                <p className="font-semibold text-slate-800 dark:text-slate-200">{selectedRow.supplier_name || selectedRow.supplierName || "—"}</p>
              </div>
              <div>
                <span className="text-slate-500 font-bold uppercase">{tr("Goods Name")}:</span>
                <p className="font-semibold text-slate-800 dark:text-slate-200">{selectedRow.goods_name || selectedRow.goodsName || "—"}</p>
              </div>
              <div>
                <span className="text-slate-500 font-bold uppercase">{tr("Amount")}:</span>
                <p className="font-mono font-bold text-slate-800 dark:text-slate-200">{getCurrency(selectedRow)} {fmt(Number(selectedRow.final_cost || selectedRow.purchase_cost || 0))}</p>
              </div>
            </div>
          </div>
        </DetailDrawer>
      )}
    </div>
  );
}
