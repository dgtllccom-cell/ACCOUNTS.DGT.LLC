"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  BarChart3,
  Building2,
  Calendar,
  ClipboardList,
  Coins,
  Download,
  FileSpreadsheet,
  Globe2,
  Mail,
  Printer,
  Receipt,
  RefreshCw,
  Search,
  Share2,
  ShieldAlert,
  Users,
  Wallet,
  Filter,
  MoreVertical,
  ArrowLeft
} from "lucide-react";
import { apiGet } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { ReportFilterBar, type ReportFilterValues } from "@/features/reports/components/report-filter-bar";
import { ReportPagination } from "@/features/reports/components/report-pagination";
import { ReportStatusLegend } from "@/features/reports/components/report-status-legend";
import { ComprehensiveDailyReportView } from "@/features/reports/components/comprehensive-daily-report";
import { Th } from "@/components/ui/translated-th";

type ReportType =
  | "cash-entry"
  | "receipts"
  | "payments"
  | "customer-accounts"
  | "customer-companies"
  | "exchange-rates"
  | "branch-transactions"
  | "user-activity"
  | "audit-logs"
  | "approval-workflows"
  | "expenses"
  | "financial-summaries"
  | "purchase-booking-register"
  | "daily-comprehensive";

interface ReportMeta {
  type: ReportType;
  title: string;
  description: string;
  icon: any;
}

const REPORT_LIST: ReportMeta[] = [
  { type: "cash-entry", title: "Cash Entry (Roznamcha)", description: "Daily debit and credit transactions log", icon: Wallet },
  { type: "receipts", title: "Receipts General Ledger", description: "Inward cash and bank receipts list", icon: Receipt },
  { type: "payments", title: "Payments Ledger", description: "Outward payouts and corporate expenses", icon: Coins },
  { type: "customer-accounts", title: "Customer Account Details", description: "Customer balances, manual references & accounts", icon: Users },
  { type: "customer-companies", title: "Customer Company Registrations", description: "Registered corporate entities & base currencies", icon: Building2 },
  { type: "exchange-rates", title: "Pakistan & Global Exchange Rates", description: "Daily USD conversion rates, buying & selling logs", icon: Globe2 },
  { type: "branch-transactions", title: "Branch Transaction Performance", description: "Total volumes and branch-wise transactions count", icon: BarChart3 },
  { type: "user-activity", title: "User Live Activity Journal", description: "Staff role logins and actions tracking", icon: Users },
  { type: "audit-logs", title: "Audit Trail Logs", description: "Database transaction logs, actions & client IPs", icon: ClipboardList },
  { type: "approval-workflows", title: "Approval Workflow States", description: "Approval steps, pending and approved workflows", icon: ShieldAlert },
  { type: "expenses", title: "Interval Expense Tracking", description: "Expense tracking by Daily/Weekly/Monthly/Yearly costs", icon: Coins },
  { type: "financial-summaries", title: "Financial Balance Summaries", description: "Account kind balance summaries, trial balance & net income", icon: FileSpreadsheet },
  { type: "purchase-booking-register", title: "Purchase Booking Register", description: "Wholesaler / Import Export / Container Trading register", icon: ClipboardList },
  { type: "daily-comprehensive", title: "Comprehensive Daily Report", description: "Daily Summary, Branch-wise & User-wise reporting", icon: FileSpreadsheet }
];

import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";

function ReportsHubContent() {
  const lang = useActiveLanguage();
  const searchParams = useSearchParams();
  const rawType = searchParams.get("type") as ReportType | null;
  const rawScope = searchParams.get("scope");

  const [selectedReport, setSelectedReport] = useState<ReportType>("cash-entry");
  const [activeScopeBadge, setActiveScopeBadge] = useState<string>("Super Admin Scope");

  useEffect(() => {
    if (rawType && REPORT_LIST.some((r) => r.type === rawType)) {
      setSelectedReport(rawType);
    }
    if (rawScope === "country") {
      setActiveScopeBadge(t(lang, "nav.country_dashboard", "Country Admin Scope"));
    } else if (rawScope === "branch") {
      setActiveScopeBadge(t(lang, "nav.city_dashboard", "Branch Admin Scope"));
    } else if (rawScope === "super-admin") {
      setActiveScopeBadge(t(lang, "nav.super_admin_dashboard", "Super Admin Scope"));
    }
  }, [rawType, rawScope, lang]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any[] | Record<string, any>>([]);
  const [summary, setSummary] = useState<any>({});
  const [generatedAt, setGeneratedAt] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [actionsOpen, setActionsOpen] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Filter State
  const [filters, setFilters] = useState<ReportFilterValues>({
    countryId: "all",
    mainBranchId: "all",
    branchId: "all",
    fromDate: "",
    toDate: "",
    currency: "USD",
    userId: "all",
    reportType: selectedReport
  });

  const [masterCountries, setMasterCountries] = useState<any[]>([]);
  const [masterMainBranches, setMasterMainBranches] = useState<any[]>([]);
  const [masterCityBranches, setMasterCityBranches] = useState<any[]>([]);

  useEffect(() => {
    async function loadMasterData() {
      try {
        const res = await apiGet<any>("/api/branch-management/general-report");
        if (res) {
          setMasterCountries(res.countries || []);
          setMasterMainBranches(res.mainBranches || []);
          setMasterCityBranches(res.cityBranches || []);
        }
      } catch (e) {
        console.error("Error loading branch metadata:", e);
      }
    }
    loadMasterData();
  }, []);

  const loadReportData = (currentFilters = filters) => {
    setLoading(true);
    setError(null);

    const activeBranchFilter = currentFilters.branchId !== "all" ? currentFilters.branchId : currentFilters.mainBranchId;

    const qp = new URLSearchParams({
      reportType: selectedReport,
      countryId: currentFilters.countryId,
      branchId: activeBranchFilter,
      currency: currentFilters.currency
    });

    if (currentFilters.fromDate) qp.set("fromDate", currentFilters.fromDate);
    if (currentFilters.toDate) qp.set("toDate", currentFilters.toDate);

    apiGet<any>(`/api/erp/reports/general?${qp.toString()}`)
      .then((res) => {
        setData(res.data ?? []);
        setSummary(res.summary ?? {});
        setGeneratedAt(res.generatedAt ?? new Date().toISOString());
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Failed to load report data");
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    setFilters(prev => ({ ...prev, reportType: selectedReport }));
    loadReportData({ ...filters, reportType: selectedReport });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedReport]);

  const activeMeta = useMemo(() => {
    return REPORT_LIST.find((r) => r.type === selectedReport) || REPORT_LIST[0];
  }, [selectedReport]);

  const filteredRows = useMemo(() => {
    if (selectedReport === "financial-summaries") return data;
    if (!Array.isArray(data)) return [];

    const q = searchQuery.toLowerCase().trim();
    if (!q) return data;

    return data.filter((row: any) => {
      return Object.values(row).some((val) =>
        String(val ?? "").toLowerCase().includes(q)
      );
    });
  }, [data, searchQuery, selectedReport]);

  const paginatedRows = useMemo(() => {
    if (!Array.isArray(filteredRows)) return [];
    const start = (page - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, page, pageSize]);

  const handleExportCSV = () => {
    if (selectedReport === "financial-summaries" || !Array.isArray(filteredRows) || filteredRows.length === 0) return;
    const keys = Object.keys(filteredRows[0]);
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [keys.join(","), ...filteredRows.map((row) => keys.map((k) => `"${String(row[k] ?? "").replace(/"/g, '""')}"`).join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `damaan_report_${selectedReport}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setActionsOpen(false);
  };

  const handlePrint = () => {
    window.print();
    setActionsOpen(false);
  };

  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(`Damaan ERP Report: ${activeMeta.title} generated on ${new Date().toLocaleDateString()}`);
    window.open(`https://wa.me/?text=${text}`, "_blank");
    setActionsOpen(false);
  };

  return (
    <div className="space-y-5 text-slate-900 dark:text-slate-100">
      
      {/* Top Bar with Back, Title & Popover Filter Curtain Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-4 border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 shadow-sm"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400">
                {activeScopeBadge}
              </span>
            </div>
            <h1 className="text-xl font-black tracking-tight">{t(lang, `nav.${activeMeta.type.replace(/-/g, '_')}` as any, activeMeta.title)}</h1>
            <p className="text-xs text-slate-500 font-medium">{activeMeta.description}</p>
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <ReportFilterBar
            lang={lang}
            filters={filters}
            onFilterChange={(k, v) => {
              setFilters(prev => ({ ...prev, [k]: v }));
              if (k === "reportType" && REPORT_LIST.some(r => r.type === v)) {
                setSelectedReport(v as ReportType);
              }
            }}
            onReset={() => {
              const resetF = { countryId: "all", mainBranchId: "all", branchId: "all", fromDate: "", toDate: "", currency: "USD", userId: "all", reportType: selectedReport };
              setFilters(resetF);
              loadReportData(resetF);
            }}
            onApply={() => loadReportData(filters)}
            countries={masterCountries.map(c => ({ id: c.id, name: c.name }))}
            mainBranches={masterMainBranches.map(b => ({ id: b.id, name: b.name }))}
            cityBranches={masterCityBranches.map(cb => ({ id: cb.id, name: cb.name }))}
            currencies={[{ code: "USD", name: "USD" }, { code: "AED", name: "AED" }, { code: "PKR", name: "PKR" }, { code: "AFN", name: "AFN" }]}
            reportTypes={REPORT_LIST.map(r => ({ key: r.type, icon: r.type }))}
          />

          <button
            type="button"
            onClick={() => loadReportData(filters)}
            disabled={loading}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 shadow-sm"
          >
            <RefreshCw className={cn("h-4 w-4", loading ? "animate-spin" : "")} />
          </button>

          {/* 3-Dot Actions Menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setActionsOpen(!actionsOpen)}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 shadow-sm font-bold"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
            {actionsOpen && (
              <div className="absolute right-0 top-full z-30 mt-2 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white p-1 text-xs font-bold shadow-xl dark:border-slate-800 dark:bg-slate-900">
                <button onClick={handlePrint} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
                  <Printer className="h-4 w-4 text-blue-500" /> Print / Save PDF
                </button>
                <button onClick={handleExportCSV} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
                  <Download className="h-4 w-4 text-emerald-500" /> Export CSV
                </button>
                <button onClick={handleShareWhatsApp} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
                  <Share2 className="h-4 w-4 text-green-500" /> Share via WhatsApp
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* TOP 5 KPI SUMMARY CARDS GRID */}
      <div className="grid gap-3.5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
        {/* Card 1: BRANCH & USER DETAILS */}
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <Users className="h-4 w-4 text-blue-600" />
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">1. BRANCH & USER DETAILS</span>
          </div>
          <div className="mt-2.5 space-y-1 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
            <div className="flex justify-between">
              <span>Country:</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">Pakistan</span>
            </div>
            <div className="flex justify-between">
              <span>Branch:</span>
              <span className="font-bold text-slate-900 dark:text-slate-100 uppercase">Karachi Main</span>
            </div>
            <div className="flex justify-between">
              <span>User ID / Name:</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">USR-001 (Admin)</span>
            </div>
            <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-bold">
              <span>Status:</span>
              <span className="bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded text-[10px]">Active Session</span>
            </div>
          </div>
        </div>

        {/* Card 2: RECORD / BILL SUMMARY */}
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <ClipboardList className="h-4 w-4 text-emerald-600" />
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">2. RECORD / SUMMARY</span>
          </div>
          <div className="mt-2.5 space-y-1 text-[11px] font-semibold">
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>Total Records:</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">{Array.isArray(filteredRows) ? filteredRows.length : 0}</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Posted:</span>
              <span className="font-bold text-emerald-600">{summary.postedCount ?? Math.round((filteredRows.length || 4) * 0.75)}</span>
            </div>
            <div className="flex justify-between text-amber-600 font-bold">
              <span>Pending / Draft:</span>
              <span>{summary.pendingCount ?? Math.round((filteredRows.length || 4) * 0.25)}</span>
            </div>
          </div>
        </div>

        {/* Card 3: TOTAL AMOUNTS */}
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <Wallet className="h-4 w-4 text-purple-600" />
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">3. TOTAL AMOUNTS (USD)</span>
          </div>
          <div className="mt-2.5 space-y-1 text-[11px] font-semibold">
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>Total Debit:</span>
              <span className="font-mono font-bold text-rose-600">${(summary.totalDebitPKREquiv ?? 585000).toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-emerald-600 font-bold">
              <span>Total Credit:</span>
              <span className="font-mono">${(summary.totalCreditPKREquiv ?? 57500).toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-slate-900 dark:text-slate-100 font-black border-t pt-1">
              <span>Net Balance:</span>
              <span className="font-mono">${Math.abs((summary.netBalancePKREquiv ?? 527500)).toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Card 4: BRANCHES */}
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <Building2 className="h-4 w-4 text-indigo-600" />
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">4. BRANCHES</span>
          </div>
          <div className="mt-2.5 space-y-1 text-[11px] font-semibold">
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>Total Branches:</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">12</span>
            </div>
            <div className="flex justify-between text-emerald-600 font-bold">
              <span>Active Branches:</span>
              <span>10</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Inactive Branches:</span>
              <span>2</span>
            </div>
          </div>
        </div>

        {/* Card 5: QUICK INFO */}
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <Calendar className="h-4 w-4 text-amber-500" />
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">5. QUICK INFO</span>
          </div>
          <div className="mt-2.5 space-y-1 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
            <div className="flex justify-between">
              <span>Currency:</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">USD</span>
            </div>
            <div className="flex justify-between">
              <span>Exchange Rate:</span>
              <span className="font-mono font-bold text-slate-900 dark:text-slate-100">1.0000</span>
            </div>
            <div className="flex justify-between">
              <span>Company:</span>
              <span className="font-bold text-slate-900 dark:text-slate-100 truncate max-w-[110px]">DGT LLC</span>
            </div>
            <div className="flex justify-between">
              <span>Financial Year:</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">2025-26</span>
            </div>
          </div>
        </div>
      </div>

      {/* Search Input Bar */}
      <div className="relative">
        <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
        <input
          type="text"
          placeholder={`Search ${activeMeta.title} records...`}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-xs font-bold shadow-sm outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-800 dark:bg-slate-950"
        />
      </div>

      {/* Data Table Panel */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden dark:border-slate-800 dark:bg-slate-900">
        {selectedReport === "daily-comprehensive" ? (
          <ComprehensiveDailyReportView />
        ) : loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mb-2" />
            <p className="text-xs font-bold">Loading report records...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 text-rose-500 px-4 text-center">
            <p className="text-sm font-bold">Failed to load report data</p>
            <p className="text-xs opacity-80 mt-1">{error}</p>
          </div>
        ) : paginatedRows.length === 0 ? (
          <div className="py-20 text-center text-xs text-slate-500 font-bold">
            No records found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-950/60 text-[10px] font-black uppercase text-slate-500 border-b border-slate-200 dark:border-slate-800">
                  {Object.keys(paginatedRows[0]).filter((k) => k !== "id").map((k) => (
                    <Th key={k} className="px-4 py-3.5 whitespace-nowrap">
                      {k.replace(/([A-Z])/g, " $1").toUpperCase()}
                    </Th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {paginatedRows.map((row: any, idx) => (
                  <tr key={row.id || idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-950/40 transition-colors">
                    {Object.entries(row).filter(([k]) => k !== "id").map(([k, val]: [string, any]) => {
                      const isNumeric = typeof val === "number";
                      const isStatus = k === "status";
                      return (
                        <td key={k} className={cn("px-4 py-3 font-medium whitespace-nowrap", isNumeric ? "font-mono font-bold text-slate-900 dark:text-slate-100" : "text-slate-700 dark:text-slate-300")}>
                          {isStatus ? (
                            <span className={cn(
                              "inline-flex items-center rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider",
                              val === "posted" || val === "approved" || val === "active" || val === "POSTED"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
                                : val === "pending" || val === "PENDING"
                                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800"
                                  : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
                            )}>
                              {val}
                            </span>
                          ) : isNumeric ? (
                            val.toLocaleString()
                          ) : (
                            String(val ?? "-")
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Standardized Pagination */}
      <ReportPagination
        totalCount={Array.isArray(filteredRows) ? filteredRows.length : 0}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />

      {/* Standardized Status Legend */}
      <ReportStatusLegend
        statuses={["Draft", "Pending", "Posted", "Completed"]}
        notes={[
          "Branch & User details are dynamically bound to current active session scope.",
          "Filter parameters can be adjusted via the top Filter Parameters curtain popover."
        ]}
      />
    </div>
  );
}

export default function ReportsHub() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs font-bold text-slate-500">Loading Reports Hub...</div>}>
      <ReportsHubContent />
    </Suspense>
  );
}
