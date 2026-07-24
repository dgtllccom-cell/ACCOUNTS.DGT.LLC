"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  FileText, Package, Scale, Gauge, Container, MessageSquare,
  Search, ChevronDown, ChevronUp, Download, Upload, Printer,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  Globe, Building2, MapPin, Loader2, RefreshCw, Filter
} from "lucide-react";

/* ─────────────────────────────────────────────
   Types
───────────────────────────────────────────── */
interface StockRow {
  orderId: string;
  billNumber: string;
  systemBillNumber: string;
  manualBillNumber: string;
  receiptDate: string;
  goodsName: string;
  hsCode: string;
  unit: string;
  quantity: number;
  grossWeight: number;
  netWeight: number;
  purchaseCountry: string;
  countryOfOrigin: string;
  purchaseBranch: string;
  purchaseAccount: string;
  purchaseAccountNo: string;
  salesAccount: string;
  salesAccountNo: string;
  importExport: string;
  containerNo: string;
  sealNo: string;
  vesselName: string;
  countryName: string;
  branchName: string;
  remarks: string | null;
}

interface Summary {
  totalBills: number;
  totalQuantity: number;
  totalGrossWeight: number;
  totalNetWeight: number;
  totalContainers: number;
  totalRemarks: number;
}

interface BranchSummary {
  countries: string[];
  branches: string[];
  purchaseCountries: string[];
  countriesOfOrigin: string[];
  purchaseBranches: string[];
}

interface Pagination {
  page: number;
  limit: number;
  totalRecords: number;
  totalPages: number;
}

interface ApiResponse {
  rows: StockRow[];
  summary: Summary;
  branchSummary: BranchSummary;
  pagination: Pagination;
}

/* ─────────────────────────────────────────────
   Helpers
───────────────────────────────────────────── */
function fmtNum(n: number, decimals = 0) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(n);
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
   Summary Card
───────────────────────────────────────────── */
function SummaryCard({
  icon: Icon,
  label,
  value,
  iconColor
}: {
  icon: React.ComponentType<any>;
  label: string;
  value: string | number;
  iconColor: string;
}) {
  return (
    <div className="flex items-center gap-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 px-5 py-4 shadow-sm min-w-0">
      <div className={`flex-shrink-0 w-11 h-11 rounded-lg flex items-center justify-center ${iconColor}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide truncate">{label}</p>
        <p className="text-xl font-black text-slate-800 dark:text-slate-100 mt-0.5 tabular-nums">{value}</p>
      </div>
    </div>
  );
}

const MOCK_STOCK_UTILIZATION: Record<string, Array<{ customer: string; date: string; quantity: number; weight: number; reference: string }>> = {
  "SO-2026-3028": [
    { customer: "Sharjah Supply A/C", date: "2026-07-16", quantity: 2000, weight: 20000, reference: "SO-2026-3101" },
    { customer: "Kharadar Customer A/C", date: "2026-07-18", quantity: 1500, weight: 15000, reference: "SO-2026-3205" }
  ],
  "SO-2026-8256": [
    { customer: "Dubai Customer A/C", date: "2026-07-15", quantity: 200, weight: 9980, reference: "SO-2026-8311" }
  ],
  "SO-2026-6156": [
    { customer: "Kabul Trading A/C", date: "2026-07-17", quantity: 100, weight: 4990, reference: "SO-2026-6204" }
  ],
  "SO-2026-9313": [
    { customer: "Dubai Customer A/C", date: "2026-07-16", quantity: 150, weight: 7485, reference: "SO-2026-9412" }
  ]
};

/* ─────────────────────────────────────────────
   Main Component
───────────────────────────────────────────── */
export function JournalBookingStockDashboard({ session }: { session: any }) {
  // ── State ──
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter panel
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [branchPanelOpen, setBranchPanelOpen] = useState(true);
  const [expandedBillNo, setExpandedBillNo] = useState<string | null>(null);

  // Filter values
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [purchaseOrderNo, setPurchaseOrderNo] = useState("");
  const [goodsName, setGoodsName] = useState("");
  const [hsCode, setHsCode] = useState("");
  const [countryId, setCountryId] = useState("");
  const [countryBranchId, setCountryBranchId] = useState("");

  // Pagination
  const [page, setPage] = useState(1);
  const [limit] = useState(50);

  // Location data for dropdowns
  const [countries, setCountries] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);

  const abortRef = useRef<AbortController | null>(null);
  const filterPopoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (filterPopoverRef.current && !filterPopoverRef.current.contains(event.target as Node)) {
        setFiltersOpen(false);
      }
    }
    if (filtersOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [filtersOpen]);

  // ── Load location data ──
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

  // ── Fetch stock data ──
  const fetchData = useCallback(async (pg = 1) => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      if (purchaseOrderNo) params.set("purchaseOrderNo", purchaseOrderNo);
      if (goodsName) params.set("goodsName", goodsName);
      if (hsCode) params.set("hsCode", hsCode);
      if (countryId) params.set("countryId", countryId);
      if (countryBranchId) params.set("countryBranchId", countryBranchId);
      params.set("page", String(pg));
      params.set("limit", String(limit));

      const res = await fetch(`/api/erp/purchases/journal-booking-stock?${params.toString()}`, {
        signal: abortRef.current.signal,
        credentials: "include"
      });
      const body = await res.json();
      if (!res.ok || !body?.ok) throw new Error(body?.error?.message ?? "Failed to load stock data");
      setData(body.data as ApiResponse);
      setPage(pg);
    } catch (err: any) {
      if (err.name !== "AbortError") setError(err.message ?? "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, purchaseOrderNo, goodsName, hsCode, countryId, countryBranchId, limit]);

  useEffect(() => { fetchData(1); }, [fetchData]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchData(1);
  };

  const handleReset = () => {
    setDateFrom(""); setDateTo(""); setPurchaseOrderNo("");
    setGoodsName(""); setHsCode(""); setCountryId(""); setCountryBranchId("");
  };

  const handleExport = () => {
    if (!data?.rows?.length) return;
    const headers = ["Sr#", "Receipt Date", "Purchase Bill No", "Goods Name", "HS Code", "Unit", "Qty", "Gross Wt (KG)", "Net Wt (KG)", "Purchase Country", "Purchase Branch", "Purchase Account", "Sales Account", "Imp/Exp"];
    const csvRows = [
      headers.join(","),
      ...data.rows.map((r, i) => [
        i + 1, fmtDate(r.receiptDate), r.billNumber, r.goodsName, r.hsCode, r.unit,
        r.quantity, r.grossWeight, r.netWeight, r.purchaseCountry, r.purchaseBranch,
        `${r.purchaseAccountNo} - ${r.purchaseAccount}`, `${r.salesAccountNo} - ${r.salesAccount}`, r.importExport
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(","))
    ];
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "journal-booking-stock.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => window.print();

  const summary = data?.summary;
  const branchSummary = data?.branchSummary;
  const pagination = data?.pagination;
  const rows = data?.rows ?? [];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 print:bg-white">
      {/* ── Page Header ── */}
      <div className="bg-[#0d2d6b] text-white px-6 py-4 print:hidden">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-lg font-black tracking-wide uppercase">Journal Booking Stock for Admin Dashboard</h1>
            <p className="text-blue-200 text-xs mt-0.5">Container Goods Received — Transferred Purchase Orders Only</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Search/Filter Toggle */}
            <div className="relative" ref={filterPopoverRef}>
              <button
                onClick={() => setFiltersOpen(o => !o)}
                className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-sm font-semibold transition-all duration-200"
              >
                <Filter className="w-4 h-4" />
                Search / Filter
                {filtersOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {/* ── Search / Filter Panel (collapsible popover dropdown) ── */}
              {filtersOpen && (
                <div className="absolute right-0 mt-2 w-[320px] sm:w-[380px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-50 p-4 text-slate-800 dark:text-slate-100 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-2">
                      <Search className="w-3.5 h-3.5" /> Search & Filter
                    </span>
                    <button onClick={() => setFiltersOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                      <ChevronUp className="w-4 h-4" />
                    </button>
                  </div>
                  <form onSubmit={handleSearch} className="pt-3 flex flex-col gap-3.5">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Date From</label>
                      <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                        className="h-9 w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 text-xs outline-none focus:ring-2 focus:ring-blue-500/40 dark:text-slate-200" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Date To</label>
                      <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                        className="h-9 w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 text-xs outline-none focus:ring-2 focus:ring-blue-500/40 dark:text-slate-200" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Purchase Bill No</label>
                      <input type="text" value={purchaseOrderNo} onChange={e => setPurchaseOrderNo(e.target.value)}
                        placeholder="Bill / PO number..."
                        className="h-9 w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 text-xs outline-none focus:ring-2 focus:ring-blue-500/40 dark:text-slate-200" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Goods Name</label>
                      <input type="text" value={goodsName} onChange={e => setGoodsName(e.target.value)}
                        placeholder="Search goods..."
                        className="h-9 w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 text-xs outline-none focus:ring-2 focus:ring-blue-500/40 dark:text-slate-200" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">HS Code</label>
                      <input type="text" value={hsCode} onChange={e => setHsCode(e.target.value)}
                        placeholder="HS Code..."
                        className="h-9 w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 text-xs outline-none focus:ring-2 focus:ring-blue-500/40 dark:text-slate-200" />
                    </div>
                    {session?.isSuperAdmin && (
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Country</label>
                        <select value={countryId} onChange={e => setCountryId(e.target.value)}
                          className="h-9 w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 text-xs outline-none focus:ring-2 focus:ring-blue-500/40 dark:text-slate-200">
                          <option value="">All Countries</option>
                          {countries.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>
                    )}
                    <div className="flex items-end gap-2 mt-2">
                      <button type="submit" className="flex-1 h-9 bg-[#0d2d6b] hover:bg-[#0a2456] text-white text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5">
                        <Search className="w-3.5 h-3.5" /> Search
                      </button>
                      <button type="button" onClick={handleReset}
                        className="h-9 px-4 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 text-xs font-semibold rounded-lg transition-all">
                        Reset
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Branch / Reference Details ── */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm">
          <button
            onClick={() => setBranchPanelOpen(o => !o)}
            className="w-full flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-slate-700"
          >
            <span className="text-xs font-black uppercase tracking-wider text-[#0d2d6b] dark:text-blue-400 flex items-center gap-2">
              <Building2 className="w-3.5 h-3.5" /> Branch / Reference Details
            </span>
            {branchPanelOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>
          {branchPanelOpen && (
            <div className="px-5 py-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
              {[
                { label: "Country", icon: Globe, values: branchSummary?.countries },
                { label: "Branch", icon: Building2, values: branchSummary?.branches },
                { label: "Purchase Country", icon: MapPin, values: branchSummary?.purchaseCountries },
                { label: "Country of Origin", icon: Globe, values: branchSummary?.countriesOfOrigin },
                { label: "Purchase Branch", icon: Building2, values: branchSummary?.purchaseBranches }
              ].map(({ label, icon: Icon, values }) => (
                <div key={label}>
                  <p className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 mb-1.5 flex items-center gap-1">
                    <Icon className="w-3 h-3" /> {label}
                  </p>
                  {loading
                    ? <div className="h-5 w-24 bg-slate-100 dark:bg-slate-700 rounded animate-pulse" />
                    : (values?.length
                      ? <div className="space-y-0.5">{values.map(v => (
                          <p key={v} className="text-sm font-semibold text-slate-800 dark:text-slate-200">{v}</p>
                        ))}</div>
                      : <p className="text-sm text-slate-400 dark:text-slate-500">All</p>)
                  }
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Summary Report Cards ── */}
        <div>
          <p className="text-xs font-black uppercase tracking-wider text-[#0d2d6b] dark:text-blue-400 mb-3 flex items-center gap-2">
            <Gauge className="w-3.5 h-3.5" /> Summary Report
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            <SummaryCard icon={FileText} label="Total Bills (Receipts)" iconColor="bg-blue-600"
              value={loading ? "—" : fmtNum(summary?.totalBills ?? 0)} />
            <SummaryCard icon={Package} label="Total Quantity" iconColor="bg-indigo-600"
              value={loading ? "—" : fmtNum(summary?.totalQuantity ?? 0)} />
            <SummaryCard icon={Scale} label="Total Gross Weight (KG)" iconColor="bg-violet-600"
              value={loading ? "—" : fmtNum(summary?.totalGrossWeight ?? 0, 2)} />
            <SummaryCard icon={Scale} label="Total Net Weight (KG)" iconColor="bg-purple-600"
              value={loading ? "—" : fmtNum(summary?.totalNetWeight ?? 0, 2)} />
            <SummaryCard icon={Container} label="Total Containers" iconColor="bg-cyan-600"
              value={loading ? "—" : fmtNum(summary?.totalContainers ?? 0)} />
            <SummaryCard icon={MessageSquare} label="Total Remarks" iconColor="bg-teal-600"
              value={loading ? "—" : fmtNum(summary?.totalRemarks ?? 0)} />
          </div>
        </div>

        {/* ── Goods Receipt Register ── */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden">
          {/* Table Header Row */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
            <span className="text-xs font-black uppercase tracking-wider text-[#0d2d6b] dark:text-blue-400">
              Goods Receipt Register (Details)
            </span>
            <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
              ) : error ? (
                <span className="text-red-500 text-xs font-semibold">{error}</span>
              ) : (
                <span className="font-semibold">Total Records: <strong className="text-slate-800 dark:text-slate-200">{pagination?.totalRecords ?? 0}</strong></span>
              )}
              {/* Pagination compact */}
              {!loading && pagination && pagination.totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button onClick={() => fetchData(1)} disabled={page === 1} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30"><ChevronsLeft className="w-4 h-4" /></button>
                  <button onClick={() => fetchData(page - 1)} disabled={page === 1} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
                  {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                    const start = Math.max(1, Math.min(page - 2, pagination.totalPages - 4));
                    const pg = start + i;
                    return (
                      <button key={pg} onClick={() => fetchData(pg)}
                        className={`w-7 h-7 rounded text-xs font-bold transition-all ${pg === page ? "bg-[#0d2d6b] text-white" : "hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"}`}>
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

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[1100px]">
              <thead>
                <tr className="bg-[#0d2d6b] text-white">
                  {["Sr.#", "Receipt Date", "Purchase Bill No", "Goods Name", "HS Code", "Unit", "Qty", "Gross Wt (KG)", "Net Wt (KG)", "Purchase Country", "Purchase Branch", "Purchase Account", "Sales Account", "Imp / Exp", "Action"].map(h => (
                    <th key={h} className="px-3 py-3 text-left font-bold text-[11px] uppercase tracking-wide whitespace-nowrap first:text-center">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className={i % 2 === 0 ? "bg-white dark:bg-slate-800" : "bg-blue-50/40 dark:bg-slate-700/30"}>
                      {Array.from({ length: 15 }).map((_, j) => (
                        <td key={j} className="px-3 py-3">
                          <div className="h-3.5 bg-slate-100 dark:bg-slate-700 rounded animate-pulse" style={{ width: j === 2 ? "80%" : "65%" }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : error ? (
                  <tr>
                    <td colSpan={15} className="px-6 py-16 text-center text-slate-400 dark:text-slate-500">
                      <div className="flex flex-col items-center gap-3">
                        <Package className="w-10 h-10 opacity-30" />
                        <span className="text-sm font-semibold text-red-500">{error}</span>
                        <button onClick={() => fetchData(1)} className="text-xs text-blue-600 hover:underline">Try Again</button>
                      </div>
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={15} className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center gap-3 text-slate-400 dark:text-slate-500">
                        <Package className="w-10 h-10 opacity-30" />
                        <p className="text-sm font-semibold">No transferred stock found</p>
                        <p className="text-xs">Only purchase orders with <strong>ledger_posting_status = posted</strong> appear here.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  rows.map((row, idx) => {
                    const globalIdx = (page - 1) * limit + idx + 1;
                    const isEven = idx % 2 === 1;
                    const isExpanded = expandedBillNo === row.billNumber;
                    const deductions = MOCK_STOCK_UTILIZATION[row.billNumber] || [];
                    const totalDeductedQty = deductions.reduce((sum, d) => sum + d.quantity, 0);
                    const totalDeductedWeight = deductions.reduce((sum, d) => sum + d.weight, 0);
                    const originalQty = row.quantity + totalDeductedQty;
                    const originalWeight = row.netWeight + totalDeductedWeight;
                    return (
                      <React.Fragment key={`${row.orderId}-${idx}`}>
                        <tr className={`border-b border-slate-100 dark:border-slate-700/50 transition-colors hover:bg-blue-50 dark:hover:bg-blue-950/20 ${isEven ? "bg-[#f5f8ff] dark:bg-slate-700/20" : "bg-white dark:bg-slate-800"}`}>
                          <td className="px-3 py-2.5 text-center font-bold text-slate-500 dark:text-slate-400">{globalIdx}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap font-semibold text-slate-700 dark:text-slate-300">{fmtDate(row.receiptDate)}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <span className="font-black text-[#0d2d6b] dark:text-blue-400">{row.billNumber}</span>
                          </td>
                          <td className="px-3 py-2.5 font-semibold text-slate-800 dark:text-slate-200 max-w-[160px] truncate">{row.goodsName}</td>
                          <td className="px-3 py-2.5 text-slate-600 dark:text-slate-400 font-mono text-[11px]">{row.hsCode}</td>
                          <td className="px-3 py-2.5 text-center font-semibold text-slate-700 dark:text-slate-300">{row.unit}</td>
                          <td className="px-3 py-2.5 text-right font-bold tabular-nums text-slate-800 dark:text-slate-200">{fmtNum(row.quantity)}</td>
                          <td className="px-3 py-2.5 text-right font-bold tabular-nums text-slate-800 dark:text-slate-200">{fmtNum(row.grossWeight, 2)}</td>
                          <td className="px-3 py-2.5 text-right font-bold tabular-nums text-slate-800 dark:text-slate-200">{fmtNum(row.netWeight, 2)}</td>
                          <td className="px-3 py-2.5 text-slate-700 dark:text-slate-300 whitespace-nowrap">{row.purchaseCountry}</td>
                          <td className="px-3 py-2.5 text-slate-700 dark:text-slate-300 whitespace-nowrap">{row.purchaseBranch}</td>
                          <td className="px-3 py-2.5 text-slate-700 dark:text-slate-300 max-w-[150px] truncate">
                            <span className="text-slate-400 dark:text-slate-500 mr-1">{row.purchaseAccountNo}</span>
                            {row.purchaseAccount}
                          </td>
                          <td className="px-3 py-2.5 text-slate-700 dark:text-slate-300 max-w-[150px] truncate">
                            <span className="text-slate-400 dark:text-slate-500 mr-1">{row.salesAccountNo}</span>
                            {row.salesAccount}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide ${row.importExport?.toLowerCase() === "export"
                              ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400"
                              : "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400"}`}>
                              {row.importExport || "Import"}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                setExpandedBillNo(isExpanded ? null : row.billNumber);
                              }}
                              className="inline-flex items-center gap-1 rounded bg-[#0d2d6b] hover:bg-blue-900 text-white px-2.5 py-1 text-[9px] font-bold uppercase transition"
                            >
                              <Search className="w-2.5 h-2.5" />
                              {isExpanded ? "Hide" : "Check"}
                            </button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="bg-slate-50/70 border-t border-b border-slate-250 animate-in fade-in slide-in-from-top-1 duration-200">
                            <td colSpan={15} className="px-4 py-3 bg-slate-50/50">
                              <div className="space-y-2.5 max-w-[95%] mx-auto text-[10px]">
                                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-1">
                                  <h5 className="text-[10px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                                    <span className="h-1.5 w-1.5 rounded-full bg-sky-500 animate-pulse"></span>
                                    Stock Utilization History & Balance for {row.billNumber}
                                  </h5>
                                  <div className="text-[9px] font-bold text-slate-500">
                                    Goods: <span className="text-slate-800 font-bold">{row.goodsName}</span> | Original Capacity: <span className="font-mono text-slate-800">{originalQty.toLocaleString()} {row.unit}</span> ({originalWeight.toLocaleString()} KG)
                                  </div>
                                </div>

                                <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                                  <table className="w-full text-[9px] text-slate-700 border-collapse">
                                    <thead className="bg-slate-100 text-slate-600 font-bold uppercase tracking-wider text-[8px] border-b border-slate-200">
                                      <tr>
                                        <th className="px-3 py-1.5 text-left">Transaction Ref</th>
                                        <th className="px-3 py-1.5 text-left">Sale Date</th>
                                        <th className="px-3 py-1.5 text-left">Customer / Debtor</th>
                                        <th className="px-3 py-1.5 text-right">Qty Deducted</th>
                                        <th className="px-3 py-1.5 text-right">Weight Deducted</th>
                                        <th className="px-3 py-1.5 text-left">Status</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {/* Initial import/purchase record */}
                                      <tr className="border-b border-slate-100 font-semibold bg-emerald-50/20 text-emerald-800">
                                        <td className="px-3 py-1.5 font-mono">{row.orderId || "PO-INTAKE"}</td>
                                        <td className="px-3 py-1.5">Intake Date</td>
                                        <td className="px-3 py-1.5 italic text-emerald-700">Initial Import / Stock Inbound</td>
                                        <td className="px-3 py-1.5 text-right font-mono font-bold text-emerald-600">+{originalQty.toLocaleString()}</td>
                                        <td className="px-3 py-1.5 text-right font-mono font-bold text-emerald-600">+{originalWeight.toLocaleString()} KG</td>
                                        <td className="px-3 py-1.5"><span className="text-[8px] font-black uppercase bg-emerald-100 text-emerald-800 px-1 py-0.5 rounded">Inbound</span></td>
                                      </tr>

                                      {/* Deduction history */}
                                      {deductions.map((d, dIdx) => (
                                        <tr key={dIdx} className="border-b border-slate-100 text-red-800 hover:bg-slate-50/50 transition">
                                          <td className="px-3 py-1.5 font-mono font-bold">{d.reference}</td>
                                          <td className="px-3 py-1.5">{d.date}</td>
                                          <td className="px-3 py-1.5 font-semibold text-slate-800">{d.customer}</td>
                                          <td className="px-3 py-1.5 text-right font-mono font-bold">-{d.quantity.toLocaleString()}</td>
                                          <td className="px-3 py-1.5 text-right font-mono font-bold">-{d.weight.toLocaleString()} KG</td>
                                          <td className="px-3 py-1.5"><span className="text-[8px] font-black uppercase bg-red-100 text-red-800 px-1 py-0.5 rounded">Sold Out</span></td>
                                        </tr>
                                      ))}

                                      {/* Total Sold Summary row */}
                                      {deductions.length > 0 && (
                                        <tr className="bg-slate-50/50 border-t border-slate-150 font-bold">
                                          <td colSpan={3} className="px-3 py-1.5 text-right text-slate-500 uppercase tracking-wider text-[8px]">Total Outward Deductions:</td>
                                          <td className="px-3 py-1.5 text-right font-mono text-red-600 font-black">-{totalDeductedQty.toLocaleString()} {row.unit}</td>
                                          <td className="px-3 py-1.5 text-right font-mono text-red-600 font-black">-{totalDeductedWeight.toLocaleString()} KG</td>
                                          <td className="px-3 py-1.5 text-slate-400 font-semibold">—</td>
                                        </tr>
                                      )}

                                      {/* Net Remaining Balance row */}
                                      <tr className="bg-sky-50 border-t border-slate-200 font-black text-sky-950">
                                        <td colSpan={3} className="px-3 py-1.5 text-right uppercase tracking-wider text-[8px]">Net Available Balance:</td>
                                        <td className="px-3 py-1.5 text-right font-mono text-[10px] font-black text-sky-700">{row.quantity.toLocaleString()} {row.unit}</td>
                                        <td className="px-3 py-1.5 text-right font-mono text-[10px] font-black text-sky-700">{row.netWeight.toLocaleString()} KG</td>
                                        <td className="px-3 py-1.5"><span className="text-[8px] font-black uppercase bg-sky-200 text-sky-800 px-1 py-0.5 rounded animate-pulse">Live Stock</span></td>
                                      </tr>
                                    </tbody>
                                  </table>
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

          {/* Footer Totals */}
          {!loading && !error && rows.length > 0 && summary && (
            <div className="border-t-2 border-[#0d2d6b] bg-[#0d2d6b]/5 dark:bg-blue-950/30 px-5 py-4">
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
                {[
                  { label: "Total Bills (Receipts)", value: fmtNum(summary.totalBills) },
                  { label: "Total Quantity", value: fmtNum(summary.totalQuantity) },
                  { label: "Total Gross Weight (KG)", value: fmtNum(summary.totalGrossWeight, 2) },
                  { label: "Total Net Weight (KG)", value: fmtNum(summary.totalNetWeight, 2) },
                  { label: "Total Containers", value: fmtNum(summary.totalContainers) },
                  { label: "Total Remarks", value: fmtNum(summary.totalRemarks) }
                ].map(({ label, value }) => (
                  <div key={label} className="text-center">
                    <p className="text-[10px] font-bold uppercase text-[#0d2d6b] dark:text-blue-400 mb-1">{label}</p>
                    <p className="text-base font-black tabular-nums text-slate-800 dark:text-slate-200">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bottom Pagination */}
          {!loading && pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 print:hidden">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Page <strong>{page}</strong> of <strong>{pagination.totalPages}</strong> &nbsp;·&nbsp; {pagination.totalRecords} total records
              </span>
              <div className="flex items-center gap-1">
                <button onClick={() => fetchData(1)} disabled={page === 1} className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 transition-all"><ChevronsLeft className="w-4 h-4" /></button>
                <button onClick={() => fetchData(page - 1)} disabled={page === 1} className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 transition-all"><ChevronLeft className="w-4 h-4" /></button>
                {Array.from({ length: Math.min(7, pagination.totalPages) }, (_, i) => {
                  const start = Math.max(1, Math.min(page - 3, pagination.totalPages - 6));
                  const pg = start + i;
                  return (
                    <button key={pg} onClick={() => fetchData(pg)}
                      className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${pg === page ? "bg-[#0d2d6b] text-white shadow" : "hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"}`}>
                      {pg}
                    </button>
                  );
                })}
                <button onClick={() => fetchData(page + 1)} disabled={page === pagination.totalPages} className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 transition-all"><ChevronRight className="w-4 h-4" /></button>
                <button onClick={() => fetchData(pagination.totalPages)} disabled={page === pagination.totalPages} className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 transition-all"><ChevronsRight className="w-4 h-4" /></button>
              </div>
            </div>
          )}
        </div>
      </div>
  );
}
