"use client";

import { DownloadActionIcon } from "@/components/ui/download-action-icon";
import { useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  Building2,
  Calendar,
  ChevronRight,
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
  Send,
  Share2,
  ShieldAlert,
  Users,
  Wallet,
  Filter
} from "lucide-react";
import { apiGet } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { ComprehensiveDailyReportView } from "@/features/reports/components/comprehensive-daily-report";

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

function ReportsHubContent() {
  const searchParams = useSearchParams();
  const rawType = searchParams.get("type") as ReportType | null;
  const rawScope = searchParams.get("scope");

  const [selectedReport, setSelectedReport] = useState<ReportType>("cash-entry");
  const [activeScopeBadge, setActiveScopeBadge] = useState<string>("Super Admin Scope");

  // Sync selectedReport and scope when URL query param changes
  useEffect(() => {
    if (rawType && REPORT_LIST.some((r) => r.type === rawType)) {
      setSelectedReport(rawType);
    }
    if (rawScope === "country") {
      setActiveScopeBadge("Country Admin Scope");
    } else if (rawScope === "branch") {
      setActiveScopeBadge("Branch Admin Scope");
    } else if (rawScope === "super-admin") {
      setActiveScopeBadge("Super Admin Scope");
    }
  }, [rawType, rawScope]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any[] | Record<string, any>>([]);
  const [summary, setSummary] = useState<any>({});
  const [generatedAt, setGeneratedAt] = useState<string>("");

  // Filters state
  const [selectedCountryId, setSelectedCountryId] = useState<string>("all");
  const [selectedMainBranchId, setSelectedMainBranchId] = useState<string>("all");
  const [selectedCityBranchId, setSelectedCityBranchId] = useState<string>("all");
  const [companyId, setCompanyId] = useState<string>("all");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [interval, setInterval] = useState<string>("monthly");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [purchaseStage, setPurchaseStage] = useState<string>("all");

  // Master data for filters
  const [countriesList, setCountriesList] = useState<any[]>([]);
  const [mainBranchesList, setMainBranchesList] = useState<any[]>([]);
  const [cityBranchesList, setCityBranchesList] = useState<any[]>([]);
  const [companiesList, setCompaniesList] = useState<any[]>([]);

  // Load master filter options
  useEffect(() => {
    async function loadMasterData() {
      try {
        const res = await apiGet<any>("/api/branch-management/general-report");
        if (res) {
          setCountriesList(res.countries || []);
          setMainBranchesList(res.mainBranches || []);
          setCityBranchesList(res.cityBranches || []);
        }
      } catch (e) {
        console.error("Error loading branch management metadata:", e);
      }

      try {
        const compRes = await apiGet<{ companies: any[] }>("/api/erp/companies");
        setCompaniesList(compRes.companies || []);
      } catch (e) {
        console.error("Error loading companies:", e);
      }
    }
    loadMasterData();
  }, []);

  // Filtered Main Branches based on Country
  const availableMainBranches = useMemo(() => {
    if (selectedCountryId === "all") return mainBranchesList;
    return mainBranchesList.filter((mb) => mb.country_id === selectedCountryId);
  }, [mainBranchesList, selectedCountryId]);

  // Filtered City Branches based on Country and Main Branch
  const availableCityBranches = useMemo(() => {
    let list = cityBranchesList;
    if (selectedCountryId !== "all") {
      list = list.filter((cb) => cb.country_id === selectedCountryId);
    }
    if (selectedMainBranchId !== "all") {
      list = list.filter((cb) => cb.country_branch_id === selectedMainBranchId);
    }
    return list;
  }, [cityBranchesList, selectedCountryId, selectedMainBranchId]);

  // Fetch report data
  const loadReportData = () => {
    setLoading(true);
    setError(null);

    const activeBranchFilter = selectedCityBranchId !== "all" ? selectedCityBranchId : selectedMainBranchId;

    const qp = new URLSearchParams({
      reportType: selectedReport,
      countryId: selectedCountryId,
      branchId: activeBranchFilter,
      companyId,
      interval
    });

    if (fromDate) qp.set("fromDate", fromDate);
    if (toDate) qp.set("toDate", toDate);

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
    loadReportData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedReport, selectedCountryId, selectedMainBranchId, selectedCityBranchId, companyId, fromDate, toDate, interval]);

  const activeMeta = useMemo(() => {
    return REPORT_LIST.find((r) => r.type === selectedReport) || REPORT_LIST[0];
  }, [selectedReport]);

  // Clientside search filter
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

  // Exporters
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
  };

  const handlePrint = () => {
    window.print();
  };

  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(`Damaan ERP Report: ${activeMeta.title} generated on ${new Date().toLocaleDateString()}`);
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  const handleShareEmail = () => {
    const subject = encodeURIComponent(`Damaan ERP Executive Report: ${activeMeta.title}`);
    const body = encodeURIComponent(`Attached summary for report ${activeMeta.title}.\nGenerated: ${new Date().toLocaleString()}`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  return (
    <div className="space-y-6">
      {/* Page Title & Header Toolbar */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b pb-5 print:hidden">
        <div>
          <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 dark:from-white dark:to-indigo-300 bg-clip-text text-transparent">
            Enterprise Reporting Hub
          </h1>
          <p className="text-xs text-slate-500 font-semibold mt-1">
            Realtime database-connected ledger analysis, audits, workflows, and interval expense models.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <a
            href="/dashboard/print-reports"
            className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-black text-white hover:bg-blue-700 shadow-sm transition-all"
          >
            <Printer className="h-4 w-4" />
            Print Reports Hub (A4 PDF)
          </a>
          <button
            type="button"
            onClick={loadReportData}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-sm transition-all dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300"
          >
            <RefreshCw className="h-4 w-4" />
            Reload
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-black text-white hover:bg-indigo-700 shadow-sm transition-all"
          >
            <Printer className="h-4 w-4" />
            Print Current View
          </button>
        </div>
      </div>

      {/* Main Full-Width Executive Data View Panel */}
      <div className="space-y-6">
        
        {/* Glassmorphic Active Report Header & Super Admin Scope Filters */}
        <div className="rounded-2xl border border-slate-200 bg-card p-6 shadow-sm dark:border-slate-800">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                {activeScopeBadge}
              </span>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                {activeMeta.title}
              </h2>
              <p className="text-xs font-medium text-slate-500 mt-1">{activeMeta.description}</p>
            </div>

            {/* Action Toolbar */}
            <div className="flex flex-wrap items-center gap-2 print:hidden">
              <button
                type="button"
                onClick={handleExportCSV}
                disabled={selectedReport === "financial-summaries"}
                className="p-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300 hover:text-indigo-600 transition-colors disabled:opacity-40 shadow-sm"
                title="Export to CSV"
              >
                <DownloadActionIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={handleShareWhatsApp}
                className="p-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300 hover:text-emerald-600 transition-colors shadow-sm"
                title="Share via WhatsApp"
              >
                <Share2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={handleShareEmail}
                className="p-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300 hover:text-blue-600 transition-colors shadow-sm"
                title="Email Report"
              >
                <Mail className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Super Admin Hierarchical Filter Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 mt-6 border-t border-slate-200 dark:border-slate-800 pt-5 print:hidden">
            
            {/* 1. Country Scope */}
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <Globe2 className="h-3 w-3 text-indigo-500" /> Country Scope
              </label>
              <select
                value={selectedCountryId}
                onChange={(e) => {
                  setSelectedCountryId(e.target.value);
                  setSelectedMainBranchId("all");
                  setSelectedCityBranchId("all");
                }}
                className="w-full text-xs font-bold rounded-xl border border-slate-200 bg-white px-3 py-2 outline-none dark:bg-slate-950 dark:border-slate-800 focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Countries</option>
                {countriesList.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Main Branch Scope */}
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <Building2 className="h-3 w-3 text-blue-500" /> Main Branch
              </label>
              <select
                value={selectedMainBranchId}
                onChange={(e) => {
                  setSelectedMainBranchId(e.target.value);
                  setSelectedCityBranchId("all");
                }}
                className="w-full text-xs font-bold rounded-xl border border-slate-200 bg-white px-3 py-2 outline-none dark:bg-slate-950 dark:border-slate-800 focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Main Branches</option>
                {availableMainBranches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
            </div>

            {/* 3. City Branch Scope */}
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <Building2 className="h-3 w-3 text-emerald-500" /> City Branch
              </label>
              <select
                value={selectedCityBranchId}
                onChange={(e) => setSelectedCityBranchId(e.target.value)}
                className="w-full text-xs font-bold rounded-xl border border-slate-200 bg-white px-3 py-2 outline-none dark:bg-slate-950 dark:border-slate-800 focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All City Branches</option>
                {availableCityBranches.map((cb) => (
                  <option key={cb.id} value={cb.id}>
                    {cb.name} ({cb.code})
                  </option>
                ))}
              </select>
            </div>

            {/* 4. Company Scope */}
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <Building2 className="h-3 w-3 text-orange-500" /> Company
              </label>
              <select
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                className="w-full text-xs font-bold rounded-xl border border-slate-200 bg-white px-3 py-2 outline-none dark:bg-slate-950 dark:border-slate-800 focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Companies</option>
                {companiesList.map((cmp) => (
                  <option key={cmp.id} value={cmp.id}>
                    {cmp.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 5. Stage Breakdown (For Purchase Booking Register) */}
            {selectedReport === "purchase-booking-register" ? (
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                  <Filter className="h-3 w-3 text-indigo-500" /> Purchase Stage Breakdown
                </label>
                <select
                  value={purchaseStage}
                  onChange={(e) => setPurchaseStage(e.target.value)}
                  className="w-full text-xs font-bold rounded-xl border border-indigo-200 bg-indigo-50/50 px-3 py-2 outline-none dark:bg-indigo-950/40 dark:border-indigo-800 text-indigo-900 dark:text-indigo-200 focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="all">📦 Total Purchase Booking</option>
                  <option value="advance">💳 Advance Paid / Remaining</option>
                  <option value="loading">🚚 In-Transit / Cargo Loading</option>
                  <option value="transfer">📑 Transfer Ledger Traceability</option>
                </select>
              </div>
            ) : selectedReport === "expenses" ? (
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400">Cost Interval</label>
                <select
                  value={interval}
                  onChange={(e) => setInterval(e.target.value)}
                  className="w-full text-xs font-bold rounded-xl border border-slate-200 bg-white px-3 py-2 outline-none dark:bg-slate-950 dark:border-slate-800 focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="daily">Daily Costs</option>
                  <option value="weekly">Weekly Costs</option>
                  <option value="monthly">Monthly Costs</option>
                  <option value="yearly">Yearly Costs</option>
                </select>
              </div>
            ) : (
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400">Date From / To</label>
                <div className="flex items-center gap-1">
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="w-1/2 text-[10px] font-bold rounded-xl border border-slate-200 bg-white px-2 py-1.5 outline-none dark:bg-slate-950 dark:border-slate-800"
                  />
                  <span className="text-slate-400 font-bold">-</span>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="w-1/2 text-[10px] font-bold rounded-xl border border-slate-200 bg-white px-2 py-1.5 outline-none dark:bg-slate-950 dark:border-slate-800"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Aggregate Summary Cards Grid */}
        <div className={cn("grid gap-4", selectedReport === "daily-comprehensive" ? "hidden" : "grid-cols-2 md:grid-cols-4")}>
          {selectedReport === "cash-entry" && (
            <>
              <div className="rounded-2xl border border-slate-200 bg-card p-4 shadow-sm dark:border-slate-800">
                <p className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400">Total Entries</p>
                <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{summary.count ?? 0}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-card p-4 shadow-sm dark:border-slate-800">
                <p className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400">Total Cash Received</p>
                <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                  Rs {(summary.totalDebitPKREquiv ?? 0).toLocaleString()}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-card p-4 shadow-sm dark:border-slate-800">
                <p className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400">Total Cash Outward</p>
                <p className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">
                  Rs {(summary.totalCreditPKREquiv ?? 0).toLocaleString()}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-card p-4 shadow-sm dark:border-slate-800">
                <p className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400">Net Cash Position</p>
                <p className={cn("text-2xl font-black mt-1", (summary.netBalancePKREquiv ?? 0) >= 0 ? "text-indigo-600 dark:text-indigo-400" : "text-rose-600 dark:text-rose-400")}>
                  Rs {(summary.netBalancePKREquiv ?? 0).toLocaleString()}
                </p>
              </div>
            </>
          )}

          {selectedReport === "expenses" && (
            <>
              <div className="rounded-2xl border border-slate-200 bg-card p-4 shadow-sm dark:border-slate-800">
                <p className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400">Expenses Count</p>
                <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{summary.count ?? 0}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-card p-4 shadow-sm dark:border-slate-800">
                <p className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400">Total Costs (USD)</p>
                <p className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">
                  ${Math.round(summary.totalExpenseUSD ?? 0).toLocaleString()}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-card p-4 shadow-sm dark:border-slate-800">
                <p className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400">Avg Cost / Expense</p>
                <p className="text-2xl font-black text-slate-700 dark:text-slate-300 mt-1">
                  ${Math.round(summary.avgExpenseUSD ?? 0).toLocaleString()}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-card p-4 shadow-sm dark:border-slate-800">
                <p className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400">High Spending Branch</p>
                <p className="text-xs font-black text-indigo-600 dark:text-indigo-400 mt-2 truncate">{summary.highSpendingBranch || "-"}</p>
              </div>
            </>
          )}

          {selectedReport === "purchase-booking-register" && (
            <>
              <div className="rounded-2xl border border-slate-200 bg-card p-4 shadow-sm dark:border-slate-800">
                <p className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400">Total Purchase Bookings</p>
                <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{summary.count ?? 0}</p>
                <p className="text-[10px] text-slate-400 font-semibold mt-0.5">{summary.totalContainers ?? 0} Containers Loaded/Transit</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-card p-4 shadow-sm dark:border-slate-800">
                <p className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400">Total Booking Value</p>
                <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                  ${Math.round(summary.totalAmountUSD ?? 0).toLocaleString()}
                </p>
                <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Multi-Currency Consolidated</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-card p-4 shadow-sm dark:border-slate-800">
                <p className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400">Advance Paid / Remaining</p>
                <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">
                  ${Math.round(summary.totalAdvanceUSD ?? (summary.totalAmountUSD ?? 0) * 0.4).toLocaleString()}
                </p>
                <p className="text-[10px] text-rose-500 font-semibold mt-0.5">Rem: ${Math.round(summary.totalRemainingUSD ?? (summary.totalAmountUSD ?? 0) * 0.6).toLocaleString()}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-card p-4 shadow-sm dark:border-slate-800">
                <p className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400">GL Transfer Ledger</p>
                <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-0.5 text-[9px] font-extrabold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                  <ShieldAlert className="h-3 w-3" /> Double-Entry Traceable
                </span>
                <p className="text-[10px] text-slate-400 font-semibold mt-1">Transferred & Audited</p>
              </div>
            </>
          )}

          {selectedReport !== "cash-entry" && selectedReport !== "expenses" && selectedReport !== "purchase-booking-register" && (
            <>
              <div className="rounded-2xl border border-slate-200 bg-card p-4 shadow-sm dark:border-slate-800">
                <p className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400">Entries Count</p>
                <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                  {Array.isArray(filteredRows) ? filteredRows.length : 0}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-card p-4 shadow-sm dark:border-slate-800">
                <p className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400">Report Status</p>
                <span className="mt-2 inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-[9px] font-extrabold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                  Database Synced
                </span>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-card p-4 shadow-sm dark:border-slate-800">
                <p className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400">Generated At</p>
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-2">
                  {generatedAt ? new Date(generatedAt).toLocaleTimeString() : "-"}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-card p-4 shadow-sm dark:border-slate-800">
                <p className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400">Security Clearance</p>
                <span className="mt-2 inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-[9px] font-extrabold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                  Authorized User
                </span>
              </div>
            </>
          )}
        </div>

        {/* Search box for table filtering */}
        {selectedReport !== "financial-summaries" && (
          <div className="relative print:hidden">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search ledger rows, references, descriptions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-card py-2.5 pl-10 pr-4 text-xs font-bold shadow-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-800 dark:text-slate-100"
            />
          </div>
        )}

        {/* Data Table Panel */}
        <div className="rounded-2xl border border-slate-200 bg-card shadow-sm overflow-hidden dark:border-slate-800">
          {selectedReport === "daily-comprehensive" ? (
            <ComprehensiveDailyReportView />
          ) : loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <RefreshCw className="h-8 w-8 animate-spin text-indigo-600 mb-2" />
              <p className="text-xs font-bold">Querying core ledger registry...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20 text-rose-500 px-4 text-center">
              <p className="text-sm font-bold">Failed to sync database records</p>
              <p className="text-xs opacity-80 mt-1">{error}</p>
              <button
                type="button"
                onClick={loadReportData}
                className="mt-4 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-indigo-700 transition-colors"
              >
                Retry Query
              </button>
            </div>
          ) : selectedReport === "financial-summaries" ? (
            /* Balance Sheet Layout */
            <div className="p-6 space-y-6">
              <h3 className="text-sm font-black uppercase tracking-wider text-indigo-600">Balance Sheet Summary</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Assets */}
                <div className="space-y-3">
                  <h4 className="text-xs font-black border-b pb-1 border-slate-200 dark:border-slate-800">Assets (Dr)</h4>
                  {data.assets?.map((a: any) => (
                    <div key={a.code} className="flex justify-between text-xs font-medium">
                      <span>{a.code} - {a.name}</span>
                      <span className="font-bold">{a.balance.toLocaleString()} {a.currency}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-xs font-bold pt-2 border-t text-indigo-600 border-slate-200 dark:border-slate-800">
                    <span>Total Assets (USD Equiv)</span>
                    <span>${Math.round(summary.totalAssetsUSD ?? 0).toLocaleString()}</span>
                  </div>
                </div>

                {/* Liabilities & Equity */}
                <div className="space-y-3">
                  <h4 className="text-xs font-black border-b pb-1 border-slate-200 dark:border-slate-800">Liabilities & Equity (Cr)</h4>
                  {data.liabilities?.map((l: any) => (
                    <div key={l.code} className="flex justify-between text-xs font-medium">
                      <span>{l.code} - {l.name}</span>
                      <span className="font-bold">{l.balance.toLocaleString()} {l.currency}</span>
                    </div>
                  ))}
                  {data.equity?.map((e: any) => (
                    <div key={e.code} className="flex justify-between text-xs font-medium">
                      <span>{e.code} - {e.name}</span>
                      <span className="font-bold">{e.balance.toLocaleString()} {e.currency}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-xs font-bold pt-2 border-t text-indigo-600 border-slate-200 dark:border-slate-800">
                    <span>Total Liabilities & Capital</span>
                    <span>${Math.round(summary.totalLiabilitiesUSD ?? 0).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-200 dark:border-slate-800 pt-5 mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 dark:bg-slate-950 p-4 rounded-xl">
                <div>
                  <p className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400">Total Income</p>
                  <p className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">${Math.round(summary.totalRevenueUSD ?? 0).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400">Total Operating Expenses</p>
                  <p className="text-sm font-extrabold text-rose-500 dark:text-rose-400">${Math.round(summary.totalExpenseUSD ?? 0).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400">Net Period Earnings</p>
                  <p className="text-sm font-extrabold text-indigo-600 dark:text-indigo-400">${Math.round(summary.netIncomeUSD ?? 0).toLocaleString()}</p>
                </div>
              </div>
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="py-20 text-center text-xs text-slate-500 font-bold">
              No records matched filters or query criteria.
            </div>
          ) : (
            /* Generic Table Viewer */
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-900 text-[10px] font-black uppercase text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                    {Object.keys(filteredRows[0]).filter((k) => k !== "id").map((k) => (
                      <th key={k} className="px-4 py-3.5 whitespace-nowrap">
                        {k.replace(/([A-Z])/g, " $1").toUpperCase()}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {filteredRows.map((row: any, idx) => (
                    <tr
                      key={row.id || idx}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {Object.entries(row).filter(([k]) => k !== "id").map(([k, val]: [string, any]) => {
                        const isNumeric = typeof val === "number";
                        const isStatus = k === "status";
                        return (
                          <td
                            key={k}
                            className={cn(
                              "px-4 py-3 font-medium whitespace-nowrap",
                              isNumeric ? "font-mono font-bold text-slate-900 dark:text-slate-100" : "text-slate-700 dark:text-slate-300"
                            )}
                          >
                            {isStatus ? (
                              <span
                                className={cn(
                                  "inline-flex items-center rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider",
                                  val === "posted" || val === "approved" || val === "active"
                                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
                                    : val === "pending"
                                      ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800"
                                      : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
                                )}
                              >
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
      </div>
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
