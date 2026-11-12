"use client";

import React, { useMemo, useState } from "react";
import {
  Search,
  Filter,
  Printer,
  FileSpreadsheet,
  Download,
  ChevronDown,
  ChevronRight,
  MoreVertical,
  Ship,
  FileText,
  DollarSign,
  Package,
  Building2,
  Calendar,
  Layers,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  Pencil,
  Eye,
  RotateCcw,
  Boxes,
  Truck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { translateHeader } from "@/lib/i18n/table-headers";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";

export interface PurchaseLoadingPaymentStatementProps {
  records: any[];
  poGroups: [string, any][];
  loadingSummaryRows: any[];
  isSuperAdmin: boolean;
  isCountryAdmin: boolean;
  isBranchUser: boolean;
  apiSession: any;
  apiScope: any;
  activeLang: string;
  loading: boolean;
  onEditRecord?: (record: any) => void;
  onReceiveRecord?: (record: any) => void;
  onRefresh?: () => void;
}

const fmt = (v: unknown, digits = 2) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return "0.00";
  return n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
};

const fmtQty = (v: unknown, digits = 0) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
};

const notRecorded = (v: unknown) => {
  if (v === null || v === undefined) return "Not Recorded";
  const s = String(v).trim();
  return s === "" || s === "-" || s === "—" ? "Not Recorded" : s;
};

export function PurchaseLoadingPaymentStatement({
  records,
  poGroups,
  loadingSummaryRows,
  isSuperAdmin,
  isCountryAdmin,
  isBranchUser,
  apiSession,
  apiScope,
  activeLang,
  loading,
  onEditRecord,
  onReceiveRecord,
  onRefresh
}: PurchaseLoadingPaymentStatementProps) {
  const tt = (key: string, fb: string) => t((activeLang || "en") as any, key as any, fb);
  const label = (head: string) => translateHeader(activeLang, head);

  // ── Search & Filter State ──
  const [searchTerm, setSearchTerm] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [activeMenuPo, setActiveMenuPo] = useState<string | null>(null);

  // Draft filter state (changes only applied on "Apply Filters")
  const [draftCountry, setDraftCountry] = useState("all");
  const [draftBranch, setDraftBranch] = useState("all");
  const [draftSupplier, setDraftSupplier] = useState("all");
  const [draftCurrency, setDraftCurrency] = useState("all");
  const [draftLoadingStatus, setDraftLoadingStatus] = useState("all");
  const [draftPaymentStatus, setDraftPaymentStatus] = useState("all");
  const [draftDateFrom, setDraftDateFrom] = useState("");
  const [draftDateTo, setDraftDateTo] = useState("");

  // Applied filter state
  const [appliedFilters, setAppliedFilters] = useState({
    country: "all",
    branch: "all",
    supplier: "all",
    currency: "all",
    loadingStatus: "all",
    paymentStatus: "all",
    dateFrom: "",
    dateTo: ""
  });

  const handleApplyFilters = () => {
    setAppliedFilters({
      country: draftCountry,
      branch: draftBranch,
      supplier: draftSupplier,
      currency: draftCurrency,
      loadingStatus: draftLoadingStatus,
      paymentStatus: draftPaymentStatus,
      dateFrom: draftDateFrom,
      dateTo: draftDateTo
    });
  };

  const handleResetFilters = () => {
    setDraftCountry("all");
    setDraftBranch("all");
    setDraftSupplier("all");
    setDraftCurrency("all");
    setDraftLoadingStatus("all");
    setDraftPaymentStatus("all");
    setDraftDateFrom("");
    setDraftDateTo("");
    setAppliedFilters({
      country: "all",
      branch: "all",
      supplier: "all",
      currency: "all",
      loadingStatus: "all",
      paymentStatus: "all",
      dateFrom: "",
      dateTo: ""
    });
  };

  const toggleRow = (poNo: string) => {
    setExpandedRows(prev => ({ ...prev, [poNo]: !prev[poNo] }));
  };

  const collapseAll = () => setExpandedRows({});
  const expandAll = () => {
    const all: Record<string, boolean> = {};
    poGroups.forEach(([poNo]) => { all[poNo] = true; });
    setExpandedRows(all);
  };

  // ── Flattened statement rows computed from poGroups ──
  const statementRows = useMemo(() => {
    return poGroups.map(([poNo, group], idx) => {
      const poRow = group.poRow || {};
      const form = group.form || poRow.form_data?.form || {};
      const poData = poRow.form_data || {};
      const goods = Array.isArray(poData.goodsEntries) ? poData.goodsEntries : [];
      const firstGood = goods[0] || {};
      const realRecords = group.realRecords || [];
      const primaryRecord = realRecords[0] || group.records?.[0] || {};
      const payload = primaryRecord.report_payload || {};

      // Quantities & Weights
      const contractQty = Number(group.totalContractQty || form.quantity || 0);
      const loadedQty = Number(group.totalLoadedQty || 0);
      const remainingQty = Math.max(0, contractQty - loadedQty);

      const grossWeight = Number(group.totalContractGrossWeight || form.grossWeight || primaryRecord.gross_weight || 0);
      const tareWeight = Number(primaryRecord.tare_weight || form.tareWeight || 0);
      const netWeight = Math.max(0, Number(group.totalContractNetWeight || form.netWeight || primaryRecord.net_weight || (grossWeight - tareWeight)));

      // Currency & Amounts
      const purchaseCurrency = String(form.currency || group.currency || poRow.currency_code || "USD").toUpperCase();
      const exRate = Number(form.exchangeRate || poRow.exchange_rate || payload.exchangeRatePKR || 1) || 1;
      const countryKey = String(primaryRecord.countries?.name || form.branchCountry || "").toLowerCase();
      const financeCurrency = String(
        form.branchCurrency ||
        primaryRecord.countries?.currency ||
        poRow.countries?.currency ||
        (countryKey.includes("emirate") || countryKey.includes("uae") ? "AED" : countryKey.includes("afghanistan") ? "AFN" : countryKey.includes("iran") ? "IRR" : "PKR")
      ).toUpperCase();

      const purchaseTotal = Number(group.totalContractAmount || poRow.order_total || form.totalAmount || 0);
      const purchasePaid = Number(poRow.advance_paid || form.advanceAmount || 0) + Number(poRow.remaining_paid || 0);
      const purchaseRemaining = Math.max(0, purchaseTotal - purchasePaid);

      const financeTotal = purchaseTotal * exRate;
      const financePaid = purchasePaid * exRate;
      const financeRemaining = Math.max(0, financeTotal - financePaid);

      // Loading Stage & Status
      const isFullyLoaded = contractQty > 0 && loadedQty >= contractQty;
      const isPartiallyLoaded = loadedQty > 0 && loadedQty < contractQty;
      const loadingStatus = isFullyLoaded ? "Fully Loaded" : isPartiallyLoaded ? "Partially Loaded" : "Pending Loading";

      const currentStage = primaryRecord.loading_status
        ? String(primaryRecord.loading_status).replace(/_/g, " ").toUpperCase()
        : loadedQty > 0 ? "IN TRANSIT" : "PENDING";

      const nextStep = isFullyLoaded
        ? (financeRemaining > 0.05 ? "Final Payment Settlement" : "Completed")
        : isPartiallyLoaded
          ? "Next Container Loading"
          : "Loading Gate Entry";

      const billDate = String(form.orderDate || poRow.order_date || poRow.created_at || "—").slice(0, 10);
      const gate = primaryRecord.loading_location || form.loadingPort || payload.loadingPort || payload.loadingLocation || "Not Recorded";

      const countryName = primaryRecord.countries?.name || form.branchCountry || "—";
      const countryCode = primaryRecord.countries?.iso2 || form.countryCode || "—";
      const countryDisplay = countryCode !== "—" ? `${countryCode} - ${countryName}` : countryName;

      const mainBranch = primaryRecord.country_branches?.name || form.branchName || "Not Recorded";
      const cityBranch = primaryRecord.city_branches?.name || primaryRecord.city_branches?.city_name || form.cityBranchName || "Not Recorded";

      const purchaseAccount = form.purchaseAccountNumber || form.purchaseAccountNo
        ? `${form.purchaseAccountNumber || form.purchaseAccountNo} — ${form.purchaseAccountName || "Purchase Account"}`
        : form.purchaseAccountName || "Not Recorded";

      const salesAccount = form.salesAccountNumber || form.salesAccountNo
        ? `${form.salesAccountNumber || form.salesAccountNo} — ${form.salesAccountName || "Sales Account"}`
        : form.salesAccountName || "Not Recorded";

      const supplierName = form.supplierName || form.purchaseAccountName || "Not Recorded";
      const buyerName = form.customerName || form.buyerName || form.salesAccountName || "Not Recorded";

      const goodsName = goods.map((g: any) => g.itemName || g.goodsName).filter(Boolean).join(", ") || form.goodsName || form.itemName || "Not Recorded";
      const brand = goods.map((g: any) => g.brand).filter(Boolean).join(", ") || form.brand || "Not Recorded";
      const size = goods.map((g: any) => g.size || g.sizeSpec).filter(Boolean).join(", ") || form.size || "Not Recorded";
      const unit = form.quantityUnit || form.qtyName || firstGood.qtyUnit || "Bags";

      const loadingRef = primaryRecord.loading_record_no || (realRecords.length > 0 ? `PLR-${realRecords.length} Loadings` : "PLR-PENDING");
      const containerNumber = primaryRecord.container_number || payload.containerNumber || payload.containerNo || "—";

      return {
        id: poNo,
        sr: idx + 1,
        poNo,
        loadingRef,
        billDate,
        gate,
        countryName,
        countryCode,
        countryDisplay,
        mainBranch,
        cityBranch,
        purchaseAccount,
        salesAccount,
        supplierName,
        buyerName,
        goodsName,
        brand,
        size,
        unit,
        contractQty,
        loadedQty,
        remainingQty,
        grossWeight,
        tareWeight,
        netWeight,
        purchaseTotal,
        purchaseCurrency,
        purchasePaid,
        purchaseRemaining,
        financeTotal,
        financeCurrency,
        financePaid,
        financeRemaining,
        currentStage,
        nextStep,
        loadingStatus,
        exRate,
        containerNumber,
        poRow,
        form,
        goods,
        realRecords,
        primaryRecord
      };
    });
  }, [poGroups]);

  // ── Filtered statement rows ──
  const filteredRows = useMemo(() => {
    return statementRows.filter(r => {
      // 1. Text Search across 9 dimensions
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const match =
          r.poNo.toLowerCase().includes(q) ||
          r.loadingRef.toLowerCase().includes(q) ||
          r.countryDisplay.toLowerCase().includes(q) ||
          r.mainBranch.toLowerCase().includes(q) ||
          r.cityBranch.toLowerCase().includes(q) ||
          r.purchaseAccount.toLowerCase().includes(q) ||
          r.salesAccount.toLowerCase().includes(q) ||
          r.supplierName.toLowerCase().includes(q) ||
          r.buyerName.toLowerCase().includes(q) ||
          r.goodsName.toLowerCase().includes(q) ||
          r.containerNumber.toLowerCase().includes(q);
        if (!match) return false;
      }

      // 2. Country Filter
      if (appliedFilters.country !== "all" && !r.countryName.toLowerCase().includes(appliedFilters.country.toLowerCase())) {
        return false;
      }

      // 3. Branch Filter
      if (appliedFilters.branch !== "all" && !r.mainBranch.toLowerCase().includes(appliedFilters.branch.toLowerCase()) && !r.cityBranch.toLowerCase().includes(appliedFilters.branch.toLowerCase())) {
        return false;
      }

      // 4. Supplier Filter
      if (appliedFilters.supplier !== "all" && !r.supplierName.toLowerCase().includes(appliedFilters.supplier.toLowerCase())) {
        return false;
      }

      // 5. Currency Filter
      if (appliedFilters.currency !== "all" && r.purchaseCurrency !== appliedFilters.currency && r.financeCurrency !== appliedFilters.currency) {
        return false;
      }

      // 6. Loading Status Filter
      if (appliedFilters.loadingStatus !== "all" && r.loadingStatus.toLowerCase() !== appliedFilters.loadingStatus.toLowerCase()) {
        return false;
      }

      // 7. Payment Status Filter
      if (appliedFilters.paymentStatus !== "all") {
        if (appliedFilters.paymentStatus === "fully_paid" && r.purchaseRemaining > 0.05) return false;
        if (appliedFilters.paymentStatus === "partially_paid" && (r.purchasePaid <= 0.05 || r.purchaseRemaining <= 0.05)) return false;
        if (appliedFilters.paymentStatus === "unpaid" && r.purchasePaid > 0.05) return false;
      }

      // 8. Date Range Filter
      if (appliedFilters.dateFrom && r.billDate !== "—" && r.billDate < appliedFilters.dateFrom) return false;
      if (appliedFilters.dateTo && r.billDate !== "—" && r.billDate > appliedFilters.dateTo) return false;

      return true;
    });
  }, [statementRows, searchTerm, appliedFilters]);

  // ── Distinct options for filters (scoped to user data) ──
  const filterOptions = useMemo(() => {
    const countries = new Set<string>();
    const branches = new Set<string>();
    const suppliers = new Set<string>();
    const currencies = new Set<string>();

    statementRows.forEach(r => {
      if (r.countryName && r.countryName !== "—") countries.add(r.countryName);
      if (r.mainBranch && r.mainBranch !== "—") branches.add(r.mainBranch);
      if (r.cityBranch && r.cityBranch !== "—") branches.add(r.cityBranch);
      if (r.supplierName && r.supplierName !== "Not Recorded") suppliers.add(r.supplierName);
      if (r.purchaseCurrency) currencies.add(r.purchaseCurrency);
      if (r.financeCurrency) currencies.add(r.financeCurrency);
    });

    return {
      countries: Array.from(countries).sort(),
      branches: Array.from(branches).sort(),
      suppliers: Array.from(suppliers).sort(),
      currencies: Array.from(currencies).sort()
    };
  }, [statementRows]);

  // ── 5 Summary Cards Computation (Multi-Currency Compliant) ──
  const summaryFigures = useMemo(() => {
    let totalBookings = filteredRows.length;
    let totalContractQty = 0;
    let totalLoadedQty = 0;
    let totalRemainingQty = 0;

    // Multi-currency buckets: currency -> { total, paid, remaining }
    const currencyTotals: Record<string, { total: number; paid: number; remaining: number }> = {};

    filteredRows.forEach(r => {
      totalContractQty += r.contractQty;
      totalLoadedQty += r.loadedQty;
      totalRemainingQty += r.remainingQty;

      // Purchase currency breakdown
      if (!currencyTotals[r.purchaseCurrency]) {
        currencyTotals[r.purchaseCurrency] = { total: 0, paid: 0, remaining: 0 };
      }
      currencyTotals[r.purchaseCurrency].total += r.purchaseTotal;
      currencyTotals[r.purchaseCurrency].paid += r.purchasePaid;
      currencyTotals[r.purchaseCurrency].remaining += r.purchaseRemaining;
    });

    const loadingPercentage = totalContractQty > 0 ? (totalLoadedQty / totalContractQty) * 100 : 0;

    return {
      totalBookings,
      totalContractQty,
      totalLoadedQty,
      totalRemainingQty,
      loadingPercentage,
      currencyTotals
    };
  }, [filteredRows]);

  // ── Export to Excel (CSV) ──
  const handleExportCsv = () => {
    const headers = [
      "SR#", "Loading Ref", "Purchase Bill No", "Bill Date", "Gate", "Country", "Main Branch", "City Branch",
      "Purchase Account", "Sales Account", "Supplier", "Buyer", "Goods Name", "Brand", "Size", "Unit",
      "Contract Qty", "Loaded Qty", "Remaining Qty", "Gross Weight (KG)", "Tare Weight (KG)", "Net Weight (KG)",
      "Purchase Currency", "Purchase Total", "Purchase Paid", "Purchase Remaining",
      "Finance Currency", "Finance Total", "Finance Paid", "Finance Remaining",
      "Current Stage", "Next Step", "Loading Status"
    ];

    const rows = filteredRows.map(r => [
      r.sr, r.loadingRef, r.poNo, r.billDate, r.gate, r.countryDisplay, r.mainBranch, r.cityBranch,
      `"${r.purchaseAccount.replace(/"/g, '""')}"`, `"${r.salesAccount.replace(/"/g, '""')}"`,
      `"${r.supplierName.replace(/"/g, '""')}"`, `"${r.buyerName.replace(/"/g, '""')}"`,
      `"${r.goodsName.replace(/"/g, '""')}"`, `"${r.brand.replace(/"/g, '""')}"`, `"${r.size.replace(/"/g, '""')}"`, r.unit,
      r.contractQty, r.loadedQty, r.remainingQty, r.grossWeight, r.tareWeight, r.netWeight,
      r.purchaseCurrency, r.purchaseTotal.toFixed(2), r.purchasePaid.toFixed(2), r.purchaseRemaining.toFixed(2),
      r.financeCurrency, r.financeTotal.toFixed(2), r.financePaid.toFixed(2), r.financeRemaining.toFixed(2),
      r.currentStage, `"${r.nextStep.replace(/"/g, '""')}"`, r.loadingStatus
    ]);

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Purchase_Loading_Statement_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 pt-2">
      {/* ── Heading & Actions Bar (Requirement 3) ── */}
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs">
              <Ship className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight text-slate-900 dark:text-white sm:text-xl">
                Purchase Booking — Loading & Payment Statement
              </h2>
              <p className="text-xs font-semibold text-slate-500">
                Independent tracking & statement of contracts, physical loading progress, container movements and multi-currency finances
              </p>
            </div>
          </div>
        </div>

        {/* Global Toolbar Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search Box */}
          <div className="relative min-w-[240px] flex-1 sm:w-64">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={tt("pb_register.search_placeholder", "Search Bill, Loading, Container, Goods...")}
              className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs font-semibold text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>

          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "h-9 gap-1.5 text-xs font-bold",
              showFilters ? "border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950/40" : ""
            )}
          >
            <Filter className="h-3.5 w-3.5" />
            Filters
            {Object.values(appliedFilters).some(v => v !== "all" && v !== "") && (
              <span className="flex h-2 w-2 rounded-full bg-blue-600" />
            )}
          </Button>

          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={collapseAll}
            className="h-9 gap-1 text-xs font-bold"
            title={tt("loc.collapse_all", "Collapse all expanded records")}
          >
            Collapse All
          </Button>

          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handlePrint}
            className="h-9 gap-1.5 text-xs font-bold"
          >
            <Printer className="h-3.5 w-3.5" />
            Print Report
          </Button>

          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handlePrint}
            className="h-9 gap-1.5 text-xs font-bold"
          >
            <Download className="h-3.5 w-3.5" />
            Save as PDF
          </Button>

          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleExportCsv}
            className="h-9 gap-1.5 text-xs font-bold"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
            Export to Excel
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleExportCsv}
            className="h-9 gap-1.5 bg-blue-600 text-xs font-bold text-white hover:bg-blue-700"
          >
            <Download className="h-3.5 w-3.5" />
            Download
          </Button>
        </div>
      </div>

      {/* ── Expandable Filter Panel (Requirement 12) ── */}
      {showFilters && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4 shadow-sm dark:border-blue-900/60 dark:bg-blue-950/20">
          <div className="mb-3 flex items-center justify-between border-b border-blue-100 pb-2 dark:border-blue-900/40">
            <span className="text-xs font-black uppercase tracking-wider text-blue-900 dark:text-blue-200">
              Role-Based Advanced Filters (Applied on Click)
            </span>
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" variant="ghost" onClick={handleResetFilters} className="h-7 text-xs font-bold text-slate-500 hover:text-slate-800">
                <RotateCcw className="mr-1 h-3 w-3" />
                Reset
              </Button>
              <Button type="button" size="sm" onClick={handleApplyFilters} className="h-7 bg-blue-600 text-xs font-bold text-white hover:bg-blue-700">
                Apply Filters
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs md:grid-cols-4 lg:grid-cols-7">
            {/* Country */}
            <div>
              <label className="mb-1 block font-bold text-slate-600 dark:text-slate-300">Country</label>
              <select
                value={draftCountry}
                onChange={(e) => setDraftCountry(e.target.value)}
                className="h-8 w-full rounded-md border border-slate-300 bg-white px-2 font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="all">{tt("common.all_countries", "All Countries")}</option>
                {filterOptions.countries.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Branch */}
            <div>
              <label className="mb-1 block font-bold text-slate-600 dark:text-slate-300">Branch</label>
              <select
                value={draftBranch}
                onChange={(e) => setDraftBranch(e.target.value)}
                className="h-8 w-full rounded-md border border-slate-300 bg-white px-2 font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="all">{tt("common.all_branches", "All Branches")}</option>
                {filterOptions.branches.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>

            {/* Supplier */}
            <div>
              <label className="mb-1 block font-bold text-slate-600 dark:text-slate-300">Supplier</label>
              <select
                value={draftSupplier}
                onChange={(e) => setDraftSupplier(e.target.value)}
                className="h-8 w-full rounded-md border border-slate-300 bg-white px-2 font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="all">{tt("pbjr.all_suppliers", "All Suppliers")}</option>
                {filterOptions.suppliers.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* Currency */}
            <div>
              <label className="mb-1 block font-bold text-slate-600 dark:text-slate-300">Currency</label>
              <select
                value={draftCurrency}
                onChange={(e) => setDraftCurrency(e.target.value)}
                className="h-8 w-full rounded-md border border-slate-300 bg-white px-2 font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="all">{tt("sae.all_currencies", "All Currencies")}</option>
                {filterOptions.currencies.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Loading Status */}
            <div>
              <label className="mb-1 block font-bold text-slate-600 dark:text-slate-300">Loading Status</label>
              <select
                value={draftLoadingStatus}
                onChange={(e) => setDraftLoadingStatus(e.target.value)}
                className="h-8 w-full rounded-md border border-slate-300 bg-white px-2 font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="all">{tt("common.all_statuses", "All Statuses")}</option>
                <option value="fully loaded">{tt("plr.fully_loaded_100", "Fully Loaded")}</option>
                <option value="partially loaded">{tt("dintake.lp_partially_loaded", "Partially Loaded")}</option>
                <option value="pending loading">{tt("plr.pending", "Pending Loading")}</option>
              </select>
            </div>

            {/* Date From */}
            <div>
              <label className="mb-1 block font-bold text-slate-600 dark:text-slate-300">Date From</label>
              <input
                type="date"
                value={draftDateFrom}
                onChange={(e) => setDraftDateFrom(e.target.value)}
                className="h-8 w-full rounded-md border border-slate-300 bg-white px-2 font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>

            {/* Date To */}
            <div>
              <label className="mb-1 block font-bold text-slate-600 dark:text-slate-300">Date To</label>
              <input
                type="date"
                value={draftDateTo}
                onChange={(e) => setDraftDateTo(e.target.value)}
                className="h-8 w-full rounded-md border border-slate-300 bg-white px-2 font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Five Summary Cards (Requirement 4) ── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {/* 1. Purchase Bookings */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
              Purchase Bookings
            </span>
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300">
              <FileText className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="font-mono text-2xl font-black text-slate-900 dark:text-white">
              {summaryFigures.totalBookings}
            </span>
            <span className="text-[11px] font-bold text-slate-400">Contracts</span>
          </div>
        </div>

        {/* 2. Contract Quantity */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
              Contract Quantity
            </span>
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              <Boxes className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="font-mono text-2xl font-black text-slate-900 dark:text-white">
              {fmtQty(summaryFigures.totalContractQty)}
            </span>
            <span className="text-[11px] font-bold text-slate-400">Units</span>
          </div>
        </div>

        {/* 3. Loaded Quantity */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Loaded Quantity
            </span>
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300">
              <Truck className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="font-mono text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {fmtQty(summaryFigures.totalLoadedQty)}
            </span>
            <span className="text-[11px] font-bold text-emerald-500">
              {summaryFigures.loadingPercentage.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* 4. Remaining to Load */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-rose-600 dark:text-rose-400">
              Remaining to Load
            </span>
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-300">
              <Clock className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="font-mono text-2xl font-black text-rose-600 dark:text-rose-400">
              {fmtQty(summaryFigures.totalRemainingQty)}
            </span>
            <span className="text-[11px] font-bold text-slate-400">Pending</span>
          </div>
        </div>

        {/* 5. Financial Tracking (Multi-Currency Compliant) */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 sm:col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">
              Financial Tracking
            </span>
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300">
              <DollarSign className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 space-y-1.5 max-h-16 overflow-y-auto pr-1 text-[11px]">
            {Object.keys(summaryFigures.currencyTotals).length === 0 ? (
              <span className="text-slate-400">No active balance</span>
            ) : (
              Object.entries(summaryFigures.currencyTotals).map(([ccy, val]) => (
                <div key={ccy} className="flex items-center justify-between border-b border-slate-100 pb-1 last:border-0 dark:border-slate-800">
                  <span className="font-black text-slate-700 dark:text-slate-300">{ccy}</span>
                  <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                    Bal: {fmt(val.remaining, 0)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Main Statement Table (Requirement 5 & 6) ── */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[2200px] border-collapse text-left text-xs">
            {/* Sticky Header with 34 Columns */}
            <thead className="sticky top-0 z-20 bg-[#ffd257] text-slate-900 font-black uppercase text-[11px] border-b border-amber-300 shadow-xs">
              <tr>
                <th className="py-3 px-2 text-center border-r border-amber-300 sticky left-0 bg-[#ffd257] z-30 w-12 whitespace-nowrap">VIEW</th>
                <th className="py-3 px-2 text-center border-r border-amber-300 sticky left-12 bg-[#ffd257] z-30 w-12 whitespace-nowrap">SR#</th>
                <th className="py-3 px-3 border-r border-amber-300 sticky left-24 bg-[#ffd257] z-30 whitespace-nowrap">LOADING REF</th>
                <th className="py-3 px-3 border-r border-amber-300 whitespace-nowrap">BILL NO / DATE</th>

                <th className="py-3 px-2.5 border-r border-amber-300 whitespace-nowrap">GATE</th>
                {isSuperAdmin && <th className="py-2 px-2 border-r border-amber-300 whitespace-nowrap">COUNTRY</th>}
                {(isSuperAdmin || isCountryAdmin) && <th className="py-2 px-2 border-r border-amber-300 whitespace-nowrap">BRANCH</th>}
                <th className="py-3 px-3 border-r border-amber-300 whitespace-nowrap">PURCHASE / SALES ACCOUNT</th>

                <th className="py-3 px-3 border-r border-amber-300 whitespace-nowrap">GOODS / BRAND / SIZE</th>

                <th className="py-3 px-2.5 text-right border-r border-amber-300 whitespace-nowrap">CONTRACT QTY</th>
                <th className="py-3 px-2.5 text-right border-r border-amber-300 whitespace-nowrap">LOADED QTY</th>
                <th className="py-3 px-2.5 text-right border-r border-amber-300 whitespace-nowrap">REMAINING QTY</th>
                <th className="py-3 px-2.5 text-right border-r border-amber-300 whitespace-nowrap">GROSS / NET WT (KG)</th>

                <th className="py-3 px-3 text-right border-r border-amber-300 whitespace-nowrap">PURCHASE TOTAL</th>
                <th className="py-3 px-2 text-center border-r border-amber-300 whitespace-nowrap">CURR</th>
                <th className="py-3 px-3 text-right border-r border-amber-300 whitespace-nowrap">PURCHASE PAID</th>
                <th className="py-3 px-3 text-right border-r border-amber-300 whitespace-nowrap">PURCHASE REMAINING</th>
                <th className="py-3 px-3 text-right border-r border-amber-300 whitespace-nowrap">FINANCE TOTAL</th>
                <th className="py-3 px-2 text-center border-r border-amber-300 whitespace-nowrap">FIN CURR</th>
                <th className="py-3 px-3 text-right border-r border-amber-300 whitespace-nowrap">FINANCE PAID</th>
                <th className="py-3 px-3 text-right border-r border-amber-300 whitespace-nowrap">FINANCE REMAINING</th>
                <th className="py-3 px-2.5 text-center border-r border-amber-300 whitespace-nowrap">CURRENT STAGE</th>
                <th className="py-3 px-3 border-r border-amber-300 whitespace-nowrap">NEXT STEP</th>
                <th className="py-3 px-2.5 text-center border-r border-amber-300 whitespace-nowrap">STATUS</th>
                <th className="py-3 px-2.5 text-center whitespace-nowrap">ACTIONS</th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={23 + (isSuperAdmin ? 1 : 0) + (isSuperAdmin || isCountryAdmin ? 1 : 0)} className="py-12 text-center text-slate-400">
                    No matching purchase loading and statement records found.
                  </td>
                </tr>
              ) : (
                filteredRows.map((r) => {
                  const isExpanded = !!expandedRows[r.poNo];

                  return (
                    <React.Fragment key={r.poNo}>
                      {/* Main Statement Row */}
                      <tr className={cn(
                        "transition-colors",
                        isExpanded ? "bg-blue-50/40 dark:bg-blue-950/20" : "hover:bg-amber-50/30 dark:hover:bg-slate-800/40"
                      )}>
                        {/* 1. View / Expand Toggle (Frozen Column 1) */}
                        <td className="py-3 px-2 text-center border-r border-slate-200 dark:border-slate-800 sticky left-0 bg-white dark:bg-slate-900 z-10">
                          <button
                            type="button"
                            onClick={() => toggleRow(r.poNo)}
                            className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 shadow-xs transition hover:bg-slate-100 hover:text-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                            title={isExpanded ? "Collapse Details" : "View Details"}
                          >
                            {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-blue-600" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-500" />}
                          </button>
                        </td>

                        {/* 2. SR# (Frozen Column 2) */}
                        <td className="py-3 px-2 text-center border-r border-slate-200 dark:border-slate-800 sticky left-12 bg-white dark:bg-slate-900 z-10 font-bold text-slate-400">
                          {String(r.sr).padStart(2, "0")}
                        </td>

                        {/* 3. Loading Ref (Frozen Column 3) */}
                        <td className="py-3 px-3 border-r border-slate-200 dark:border-slate-800 sticky left-24 bg-white dark:bg-slate-900 z-10 font-mono font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                          {r.loadingRef}
                        </td>

                        {/* Original bill with date stacked in the same compact cell */}
                        <td className="py-2 px-2 border-r border-slate-200 dark:border-slate-800 font-mono whitespace-nowrap">
                          <div className="font-black text-blue-700 dark:text-blue-400">{r.poNo}</div>
                          <div className="text-[10px] text-slate-500">{r.billDate}</div>
                        </td>

                        {/* 6. Gate */}
                        <td className="py-3 px-2.5 border-r border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          {notRecorded(r.gate)}
                        </td>

                        {/* Country and branch columns follow the signed-in role. API scoping remains authoritative. */}
                        {isSuperAdmin && (
                          <td className="py-2 px-2 border-r border-slate-200 dark:border-slate-800 whitespace-nowrap">
                            {notRecorded(r.countryDisplay)}
                          </td>
                        )}
                        {(isSuperAdmin || isCountryAdmin) && (
                          <td className="py-2 px-2 border-r border-slate-200 dark:border-slate-800 whitespace-nowrap">
                            <div className="font-semibold">{notRecorded(r.cityBranch)}</div>
                            <div className="text-[10px] text-slate-500">{notRecorded(r.mainBranch)}</div>
                          </td>
                        )}

                        {/* Original account details and goods in compact stacked cells */}
                        <td className="py-2 px-2 border-r border-slate-200 dark:border-slate-800 whitespace-nowrap">
                          <div className="font-semibold">{notRecorded(r.purchaseAccount)}</div>
                          <div className="text-[10px] text-slate-500">{notRecorded(r.salesAccount)}</div>
                        </td>
                        <td className="py-2 px-2 border-r border-slate-200 dark:border-slate-800 whitespace-nowrap">
                          <div className="font-bold">{notRecorded(r.goodsName)}</div>
                          <div className="text-[10px] text-slate-500">{notRecorded(r.brand)} / {notRecorded(r.size)}</div>
                        </td>

                        {/* 17. Contract Quantity */}
                        <td className="py-3 px-2.5 text-right border-r border-slate-200 dark:border-slate-800 font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                          {fmtQty(r.contractQty)} <span className="text-[10px] text-slate-400 font-normal">{r.unit}</span>
                        </td>

                        {/* 18. Loaded Quantity */}
                        <td className="py-3 px-2.5 text-right border-r border-slate-200 dark:border-slate-800 font-mono font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                          {fmtQty(r.loadedQty)} <span className="text-[10px] text-emerald-500/70 font-normal">{r.unit}</span>
                        </td>

                        {/* 19. Remaining Quantity */}
                        <td className="py-3 px-2.5 text-right border-r border-slate-200 dark:border-slate-800 font-mono font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap">
                          {fmtQty(r.remainingQty)} <span className="text-[10px] text-rose-500/70 font-normal">{r.unit}</span>
                        </td>

                        {/* Gross and Net weight; tare is available in expanded loading detail */}
                        <td className="py-2 px-2 text-right border-r border-slate-200 dark:border-slate-800 font-mono whitespace-nowrap">
                          <div>{fmt(r.grossWeight, 0)} kg</div>
                          <div className="text-[10px] text-slate-500">{fmt(r.netWeight, 0)} kg</div>
                        </td>

                        {/* 23. Purchase Total */}
                        <td className="py-3 px-3 text-right border-r border-slate-200 dark:border-slate-800 font-mono font-black text-slate-900 dark:text-white whitespace-nowrap">
                          <span className="text-[10px] text-slate-400 mr-1">{r.purchaseCurrency}</span>
                          {fmt(r.purchaseTotal)}
                        </td>

                        {/* 24. Purchase Currency */}
                        <td className="py-3 px-2 text-center border-r border-slate-200 dark:border-slate-800 font-mono font-bold text-indigo-600 whitespace-nowrap">
                          {r.purchaseCurrency}
                        </td>

                        {/* 25. Purchase Paid */}
                        <td className="py-3 px-3 text-right border-r border-slate-200 dark:border-slate-800 font-mono font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                          <span className="text-[10px] text-emerald-500/70 mr-1">{r.purchaseCurrency}</span>
                          {fmt(r.purchasePaid)}
                        </td>

                        {/* 26. Purchase Remaining */}
                        <td className="py-3 px-3 text-right border-r border-slate-200 dark:border-slate-800 font-mono font-black text-rose-600 dark:text-rose-400 whitespace-nowrap">
                          <span className="text-[10px] text-rose-500/70 mr-1">{r.purchaseCurrency}</span>
                          {fmt(r.purchaseRemaining)}
                        </td>

                        {/* 27. Finance Total */}
                        <td className="py-3 px-3 text-right border-r border-slate-200 dark:border-slate-800 font-mono font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          <span className="text-[10px] text-slate-400 mr-1">{r.financeCurrency}</span>
                          {fmt(r.financeTotal)}
                        </td>

                        {/* 28. Finance Currency */}
                        <td className="py-3 px-2 text-center border-r border-slate-200 dark:border-slate-800 font-mono font-bold text-indigo-600 whitespace-nowrap">
                          {r.financeCurrency}
                        </td>

                        {/* 29. Finance Paid */}
                        <td className="py-3 px-3 text-right border-r border-slate-200 dark:border-slate-800 font-mono font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                          <span className="text-[10px] text-emerald-500/70 mr-1">{r.financeCurrency}</span>
                          {fmt(r.financePaid)}
                        </td>

                        {/* 30. Finance Remaining */}
                        <td className="py-3 px-3 text-right border-r border-slate-200 dark:border-slate-800 font-mono font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap">
                          <span className="text-[10px] text-rose-500/70 mr-1">{r.financeCurrency}</span>
                          {fmt(r.financeRemaining)}
                        </td>

                        {/* 31. Current Stage */}
                        <td className="py-3 px-2.5 text-center border-r border-slate-200 dark:border-slate-800 whitespace-nowrap">
                          <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                            {r.currentStage}
                          </span>
                        </td>

                        {/* 32. Next Step */}
                        <td className="py-3 px-3 border-r border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 whitespace-nowrap font-medium">
                          {r.nextStep}
                        </td>

                        {/* 33. Status */}
                        <td className="py-3 px-2.5 text-center border-r border-slate-200 dark:border-slate-800 whitespace-nowrap">
                          <span className={cn(
                            "inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase shadow-xs",
                            r.loadingStatus === "Fully Loaded"
                              ? "bg-slate-900 text-white dark:bg-black"
                              : r.loadingStatus === "Partially Loaded"
                                ? "bg-amber-400 text-amber-950"
                                : "bg-rose-600 text-white"
                          )}>
                            {r.loadingStatus}
                          </span>
                        </td>

                        {/* 34. Actions (Three-Dot Menu) */}
                        <td className="py-3 px-2.5 text-center whitespace-nowrap relative">
                          <button
                            type="button"
                            onClick={() => setActiveMenuPo(activeMenuPo === r.poNo ? null : r.poNo)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>

                          {/* Action Popover Menu (Requirement 10) */}
                          {activeMenuPo === r.poNo && (
                            <div className="absolute right-2 top-10 z-50 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-800 dark:bg-slate-900 text-left">
                              <button
                                type="button"
                                onClick={() => { toggleRow(r.poNo); setActiveMenuPo(null); }}
                                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                              >
                                <Eye className="h-3.5 w-3.5 text-blue-600" />
                                View Details
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  if (onEditRecord && r.primaryRecord) onEditRecord(r.primaryRecord);
                                  setActiveMenuPo(null);
                                }}
                                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                              >
                                <Pencil className="h-3.5 w-3.5 text-amber-600" />
                                Edit Loading
                              </button>

                              <button
                                type="button"
                                onClick={() => { window.print(); setActiveMenuPo(null); }}
                                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                              >
                                <Printer className="h-3.5 w-3.5 text-slate-600" />
                                Print Record
                              </button>

                              <button
                                type="button"
                                onClick={() => { handleExportCsv(); setActiveMenuPo(null); }}
                                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                              >
                                <Download className="h-3.5 w-3.5 text-emerald-600" />
                                Download Statement
                              </button>

                              <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

                              <button
                                type="button"
                                onClick={() => {
                                  window.open(`/dashboard/journal/purchase-order-payment/remaining`, "_blank");
                                  setActiveMenuPo(null);
                                }}
                                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                              >
                                <DollarSign className="h-3.5 w-3.5 text-emerald-600" />
                                View Payment History
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  window.open(`/dashboard/purchase/purchase-transit-lane`, "_blank");
                                  setActiveMenuPo(null);
                                }}
                                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                              >
                                <Truck className="h-3.5 w-3.5 text-blue-600" />
                                View Loading History
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>

                      {/* ── Expandable Record Details (Requirement 7, 8, 9) ── */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={23 + (isSuperAdmin ? 1 : 0) + (isSuperAdmin || isCountryAdmin ? 1 : 0)} className="bg-slate-50/80 p-5 dark:bg-slate-950/80 border-b-2 border-blue-200 dark:border-blue-900">
                            <div className="space-y-6">
                              {/* 5 Compact Numbered Detail Sections (Requirement 7) */}
                              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
                                {/* 01 — Purchase Booking / Contract */}
                                <div className="rounded-xl border border-blue-200 bg-white p-3.5 shadow-xs dark:border-blue-900 dark:bg-slate-900">
                                  <div className="mb-2.5 flex items-center justify-between border-b border-blue-100 pb-1.5 dark:border-blue-900">
                                    <span className="font-mono font-black text-blue-600">01</span>
                                    <span className="text-[11px] font-black uppercase text-slate-800 dark:text-slate-200">
                                      Contract Details
                                    </span>
                                  </div>
                                  <div className="space-y-1 text-[11px]">
                                    <div className="flex justify-between"><span className="text-slate-400">Bill No:</span><span className="font-bold text-blue-700">{r.poNo}</span></div>
                                    <div className="flex justify-between"><span className="text-slate-400">Contract No:</span><span className="font-mono">{r.form.contractNo || r.poNo}</span></div>
                                    <div className="flex justify-between"><span className="text-slate-400">Loading Ref:</span><span className="font-mono">{r.loadingRef}</span></div>
                                    <div className="flex justify-between"><span className="text-slate-400">BL No:</span><span className="font-mono">{notRecorded(r.primaryRecord?.bl_number || r.form.blNo)}</span></div>
                                    <div className="flex justify-between"><span className="text-slate-400">Bill Date:</span><span>{r.billDate}</span></div>
                                    <div className="flex justify-between"><span className="text-slate-400">Location:</span><span>{r.countryDisplay}</span></div>
                                    <div className="flex justify-between"><span className="text-slate-400">Contract Qty:</span><span className="font-bold">{fmtQty(r.contractQty)} {r.unit}</span></div>
                                    <div className="flex justify-between"><span className="text-slate-400">Loaded Qty:</span><span className="font-bold text-emerald-600">{fmtQty(r.loadedQty)} {r.unit}</span></div>
                                    <div className="flex justify-between"><span className="text-slate-400">Remaining:</span><span className="font-bold text-rose-600">{fmtQty(r.remainingQty)} {r.unit}</span></div>
                                    <div className="flex justify-between"><span className="text-slate-400">Gross / Net:</span><span>{fmt(r.grossWeight, 0)} / {fmt(r.netWeight, 0)} kg</span></div>
                                  </div>
                                </div>

                                {/* 02 — Purchase and Payment Summary */}
                                <div className="rounded-xl border border-emerald-200 bg-white p-3.5 shadow-xs dark:border-emerald-900 dark:bg-slate-900">
                                  <div className="mb-2.5 flex items-center justify-between border-b border-emerald-100 pb-1.5 dark:border-emerald-900">
                                    <span className="font-mono font-black text-emerald-600">02</span>
                                    <span className="text-[11px] font-black uppercase text-slate-800 dark:text-slate-200">
                                      Payment Summary
                                    </span>
                                  </div>
                                  <div className="space-y-1 text-[11px]">
                                    <div className="flex justify-between"><span className="text-slate-400">Purchase Total:</span><span className="font-bold">{fmt(r.purchaseTotal)} {r.purchaseCurrency}</span></div>
                                    <div className="flex justify-between"><span className="text-slate-400">Purchase Paid:</span><span className="font-bold text-emerald-600">{fmt(r.purchasePaid)} {r.purchaseCurrency}</span></div>
                                    <div className="flex justify-between"><span className="text-slate-400">Purchase Rem.:</span><span className="font-bold text-rose-600">{fmt(r.purchaseRemaining)} {r.purchaseCurrency}</span></div>
                                    <div className="flex justify-between"><span className="text-slate-400">Ex. Rate:</span><span className="font-mono">{r.exRate}</span></div>
                                    <div className="flex justify-between"><span className="text-slate-400">Finance Total:</span><span className="font-semibold">{fmt(r.financeTotal)} {r.financeCurrency}</span></div>
                                    <div className="flex justify-between"><span className="text-slate-400">Finance Paid:</span><span className="font-semibold text-emerald-600">{fmt(r.financePaid)} {r.financeCurrency}</span></div>
                                    <div className="flex justify-between"><span className="text-slate-400">Finance Rem.:</span><span className="font-bold text-rose-600">{fmt(r.financeRemaining)} {r.financeCurrency}</span></div>
                                    <div className="flex justify-between"><span className="text-slate-400">Pay Status:</span><span className="font-bold uppercase text-blue-600">{r.purchaseRemaining <= 0.05 ? "Fully Paid" : r.purchasePaid > 0 ? "Partially Paid" : "Unpaid"}</span></div>
                                  </div>
                                </div>

                                {/* 03 — Goods Details */}
                                <div className="rounded-xl border border-indigo-200 bg-white p-3.5 shadow-xs dark:border-indigo-900 dark:bg-slate-900">
                                  <div className="mb-2.5 flex items-center justify-between border-b border-indigo-100 pb-1.5 dark:border-indigo-900">
                                    <span className="font-mono font-black text-indigo-600">03</span>
                                    <span className="text-[11px] font-black uppercase text-slate-800 dark:text-slate-200">
                                      Goods Details
                                    </span>
                                  </div>
                                  <div className="space-y-1 text-[11px]">
                                    <div className="flex justify-between"><span className="text-slate-400">Goods:</span><span className="font-bold">{notRecorded(r.goodsName)}</span></div>
                                    <div className="flex justify-between"><span className="text-slate-400">Category:</span><span>{notRecorded(r.form.category || r.goods[0]?.category)}</span></div>
                                    <div className="flex justify-between"><span className="text-slate-400">Brand:</span><span>{notRecorded(r.brand)}</span></div>
                                    <div className="flex justify-between"><span className="text-slate-400">Size:</span><span>{notRecorded(r.size)}</span></div>
                                    <div className="flex justify-between"><span className="text-slate-400">Pack Unit:</span><span>{r.unit}</span></div>
                                    <div className="flex justify-between"><span className="text-slate-400">Contract Qty:</span><span>{fmtQty(r.contractQty)}</span></div>
                                    <div className="flex justify-between"><span className="text-slate-400">Loaded Qty:</span><span>{fmtQty(r.loadedQty)}</span></div>
                                    <div className="flex justify-between"><span className="text-slate-400">Tare Weight:</span><span>{fmt(r.tareWeight, 0)} kg</span></div>
                                    <div className="flex justify-between"><span className="text-slate-400">Quality / Lab:</span><span className="text-emerald-600 font-semibold">{notRecorded(r.primaryRecord?.report_payload?.qualityReportRef || r.form.qualityReportRef)}</span></div>
                                  </div>
                                </div>

                                {/* 04 — Purchase Account / Exporter */}
                                <div className="rounded-xl border border-amber-200 bg-white p-3.5 shadow-xs dark:border-amber-900 dark:bg-slate-900">
                                  <div className="mb-2.5 flex items-center justify-between border-b border-amber-100 pb-1.5 dark:border-amber-900">
                                    <span className="font-mono font-black text-amber-600">04</span>
                                    <span className="text-[11px] font-black uppercase text-slate-800 dark:text-slate-200">
                                      Purchase Account / Exporter
                                    </span>
                                  </div>
                                  <div className="space-y-1 text-[11px]">
                                    <div className="flex justify-between"><span className="text-slate-400">Account ID:</span><span className="font-mono">{notRecorded(r.form.purchaseAccountNumber || r.form.purchaseAccountId)}</span></div>
                                    <div className="flex justify-between"><span className="text-slate-400">Supplier:</span><span className="font-bold">{notRecorded(r.supplierName)}</span></div>
                                    <div className="flex justify-between"><span className="text-slate-400">Country:</span><span>{r.countryName}</span></div>
                                    <div className="flex justify-between"><span className="text-slate-400">Branch:</span><span>{r.mainBranch}</span></div>
                                    <div className="flex justify-between"><span className="text-slate-400">Address:</span><span className="truncate max-w-[140px]">{notRecorded(r.form.supplierAddress || r.form.companyAddress)}</span></div>
                                    <div className="flex justify-between"><span className="text-slate-400">Contact:</span><span>{notRecorded(r.form.supplierPhone || r.form.contactPhone)}</span></div>
                                    <div className="flex justify-between"><span className="text-slate-400">Currency:</span><span className="font-bold">{r.purchaseCurrency}</span></div>
                                    <div className="flex justify-between"><span className="text-slate-400">Bill Total:</span><span>{fmt(r.purchaseTotal)}</span></div>
                                    <div className="flex justify-between"><span className="text-slate-400">Outstanding:</span><span className="font-bold text-rose-600">{fmt(r.purchaseRemaining)}</span></div>
                                  </div>
                                </div>

                                {/* 05 — Sales Account / Importer */}
                                <div className="rounded-xl border border-purple-200 bg-white p-3.5 shadow-xs dark:border-purple-900 dark:bg-slate-900">
                                  <div className="mb-2.5 flex items-center justify-between border-b border-purple-100 pb-1.5 dark:border-purple-900">
                                    <span className="font-mono font-black text-purple-600">05</span>
                                    <span className="text-[11px] font-black uppercase text-slate-800 dark:text-slate-200">
                                      Sales Account / Importer
                                    </span>
                                  </div>
                                  <div className="space-y-1 text-[11px]">
                                    <div className="flex justify-between"><span className="text-slate-400">Account ID:</span><span className="font-mono">{notRecorded(r.form.salesAccountNumber || r.form.salesAccountId)}</span></div>
                                    <div className="flex justify-between"><span className="text-slate-400">Buyer Name:</span><span className="font-bold">{notRecorded(r.buyerName)}</span></div>
                                    <div className="flex justify-between"><span className="text-slate-400">Country:</span><span>{r.countryName}</span></div>
                                    <div className="flex justify-between"><span className="text-slate-400">Branch:</span><span>{r.cityBranch}</span></div>
                                    <div className="flex justify-between"><span className="text-slate-400">Address:</span><span className="truncate max-w-[140px]">{notRecorded(r.form.buyerAddress)}</span></div>
                                    <div className="flex justify-between"><span className="text-slate-400">Contact:</span><span>{notRecorded(r.form.buyerPhone)}</span></div>
                                    <div className="flex justify-between"><span className="text-slate-400">Currency:</span><span className="font-bold">{r.financeCurrency}</span></div>
                                    <div className="flex justify-between"><span className="text-slate-400">Finance Total:</span><span>{fmt(r.financeTotal)}</span></div>
                                    <div className="flex justify-between"><span className="text-slate-400">Outstanding:</span><span className="font-bold text-rose-600">{fmt(r.financeRemaining)}</span></div>
                                  </div>
                                </div>
                              </div>

                              {/* ── Goods and Container Statement Table (Requirement 8) ── */}
                              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs dark:border-slate-800 dark:bg-slate-900">
                                <div className="bg-slate-100/80 px-4 py-2.5 font-black uppercase tracking-wider text-xs text-slate-800 dark:bg-slate-800 dark:text-slate-200 flex items-center justify-between">
                                  <span className="flex items-center gap-2">
                                    <Ship className="h-4 w-4 text-blue-600" />
                                    Goods & Container Statement ({r.realRecords.length} Saved Entries)
                                  </span>
                                  <span className="text-[11px] font-bold text-slate-500">
                                    Bill: {r.poNo}
                                  </span>
                                </div>

                                <div className="overflow-x-auto">
                                  <table className="w-full min-w-[1400px] border-collapse text-left text-xs">
                                    <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-600 dark:bg-slate-800/60 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                                      <tr>
                                        <th className="py-2.5 px-3">SR#</th>
                                        <th className="py-2.5 px-3">Container No</th>
                                        <th className="py-2.5 px-3">Seal No</th>
                                        <th className="py-2.5 px-3">Goods Name</th>
                                        <th className="py-2.5 px-3">Brand</th>
                                        <th className="py-2.5 px-3">Size</th>
                                        <th className="py-2.5 px-2 text-center">Unit</th>
                                        <th className="py-2.5 px-3 text-right">Loaded Qty</th>
                                        <th className="py-2.5 px-3 text-right">Gross Wt (KG)</th>
                                        <th className="py-2.5 px-3 text-right">Tare Wt (KG)</th>
                                        <th className="py-2.5 px-3 text-right">Net Wt (KG)</th>
                                        <th className="py-2.5 px-2 text-center">Purch Curr</th>
                                        <th className="py-2.5 px-2 text-center">Fin Curr</th>
                                        <th className="py-2.5 px-3">Loading Date</th>
                                        <th className="py-2.5 px-3">Warehouse</th>
                                        <th className="py-2.5 px-3 text-center">Status</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                                      {r.realRecords.length === 0 ? (
                                        <tr>
                                          <td colSpan={16} className="py-6 text-center text-slate-400">
                                            No container loading entries recorded yet. Pending initial dispatch.
                                          </td>
                                        </tr>
                                      ) : (
                                        r.realRecords.map((rec: any, recIdx: number) => {
                                          const recPayload = rec.report_payload || {};
                                          const recLoadedQty = Number(recPayload.loadedQuantity || rec.loaded_quantity || 0);
                                          const recGross = Number(rec.gross_weight || recPayload.grossWeight || 0);
                                          const recTare = Number(rec.tare_weight || recPayload.tareWeight || 0);
                                          const recNet = Number(rec.net_weight || recPayload.netWeight || (recGross - recTare));
                                          const recLoadDate = String(rec.loaded_at ? String(rec.loaded_at).slice(0, 10) : rec.created_at ? String(rec.created_at).slice(0, 10) : "—");

                                          return (
                                            <tr key={rec.id || recIdx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                              <td className="py-2.5 px-3 font-bold text-slate-400">{recIdx + 1}</td>
                                              <td className="py-2.5 px-3 font-mono font-bold text-blue-700 dark:text-blue-400">{notRecorded(rec.container_number || recPayload.containerNumber)}</td>
                                              <td className="py-2.5 px-3 font-mono">{notRecorded(rec.seal_number || recPayload.sealNumber)}</td>
                                              <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-100">{notRecorded(recPayload.goodsName || rec.goods_name || r.goodsName)}</td>
                                              <td className="py-2.5 px-3 text-slate-600">{notRecorded(recPayload.brand || r.brand)}</td>
                                              <td className="py-2.5 px-3 text-slate-600">{notRecorded(recPayload.size || r.size)}</td>
                                              <td className="py-2.5 px-2 text-center text-slate-500">{r.unit}</td>
                                              <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-600">{fmtQty(recLoadedQty)}</td>
                                              <td className="py-2.5 px-3 text-right font-mono">{fmt(recGross, 0)}</td>
                                              <td className="py-2.5 px-3 text-right font-mono">{fmt(recTare, 0)}</td>
                                              <td className="py-2.5 px-3 text-right font-mono font-bold">{fmt(recNet, 0)}</td>
                                              <td className="py-2.5 px-2 text-center font-mono font-bold text-indigo-600">{r.purchaseCurrency}</td>
                                              <td className="py-2.5 px-2 text-center font-mono font-bold text-indigo-600">{r.financeCurrency}</td>
                                              <td className="py-2.5 px-3 font-mono">{recLoadDate}</td>
                                              <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">{notRecorded(rec.receiving_location || recPayload.warehouse || "Transit Yard")}</td>
                                              <td className="py-2.5 px-3 text-center">
                                                <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                                                  {rec.loading_status ? String(rec.loading_status).toUpperCase() : "CONFIRMED"}
                                                </span>
                                              </td>
                                            </tr>
                                          );
                                        })
                                      )}
                                    </tbody>
                                  </table>
                                </div>
                              </div>

                              {/* ── Final Record Summary (Requirement 9) ── */}
                              <div className="rounded-xl border border-blue-300 bg-gradient-to-r from-blue-50 to-indigo-50 p-4 shadow-xs dark:border-blue-900 dark:from-blue-950/40 dark:to-indigo-950/40">
                                <div className="flex flex-wrap items-center justify-between gap-4 text-xs font-semibold text-slate-800 dark:text-slate-200">
                                  <div className="flex items-center gap-4">
                                    <span className="font-black text-blue-900 dark:text-blue-100">SUMMARY:</span>
                                    <span>Contract: <b className="font-mono">{fmtQty(r.contractQty)}</b> {r.unit}</span>
                                    <span>Loaded: <b className="font-mono text-emerald-600">{fmtQty(r.loadedQty)}</b> {r.unit}</span>
                                    <span>Remaining: <b className="font-mono text-rose-600">{fmtQty(r.remainingQty)}</b> {r.unit}</span>
                                  </div>

                                  <div className="flex items-center gap-4">
                                    <span>Purchase: <b className="font-mono">{fmt(r.purchaseTotal)}</b> | Paid: <b className="font-mono text-emerald-600">{fmt(r.purchasePaid)}</b> | Bal: <b className="font-mono text-rose-600">{fmt(r.purchaseRemaining)} {r.purchaseCurrency}</b></span>
                                  </div>

                                  <div className="flex items-center gap-4">
                                    <span className="rounded bg-white px-2.5 py-1 text-xs font-black shadow-xs dark:bg-slate-900">
                                      Status: <span className="text-blue-600">{r.loadingStatus}</span>
                                    </span>
                                    <span className="rounded bg-white px-2.5 py-1 text-xs font-bold text-slate-700 shadow-xs dark:bg-slate-900 dark:text-slate-300">
                                      Next: {r.nextStep}
                                    </span>
                                  </div>
                                </div>
                              </div>
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
    </div>
  );
}

