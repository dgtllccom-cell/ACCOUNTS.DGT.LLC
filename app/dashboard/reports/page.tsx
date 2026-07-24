"use client";

import { DownloadActionIcon } from "@/components/ui/download-action-icon";
import { useEffect, useMemo, useState } from "react";
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
  Wallet
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
  { type: "approval-workflows", title: "Approval Workflow States", status: "Workflow steps, pending and approved transactions", icon: ShieldAlert, description: "Approval steps, pending and approved workflows" },
  { type: "expenses", title: "Interval Expense Tracking", description: "Expense tracking by Daily/Weekly/Monthly/Yearly costs", icon: Coins },
  { type: "financial-summaries", title: "Financial Balance Summaries", description: "Account kind balance summaries, trial balance & net income", icon: FileSpreadsheet },
  { type: "purchase-booking-register", title: "Purchase Booking Register", description: "Wholesaler / Import Export / Container Trading register", icon: ClipboardList },
  { type: "daily-comprehensive", title: "Comprehensive Daily Report", description: "Daily Summary, Branch-wise & User-wise reporting", icon: FileSpreadsheet }
];

export default function ReportsHub() {
  const [selectedReport, setSelectedReport] = useState<ReportType>("cash-entry");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any[] | Record<string, any>>([]);
  const [summary, setSummary] = useState<any>({});
  const [generatedAt, setGeneratedAt] = useState<string>("");

  // Filters state
  const [countryId, setCountryId] = useState<string>("all");
  const [branchId, setBranchId] = useState<string>("all");
  const [companyId, setCompanyId] = useState<string>("all");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [interval, setInterval] = useState<string>("monthly");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Options loaded from APIs
  const [countries, setCountries] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);

  // Load filter options
  useEffect(() => {
    // Countries
    apiGet<{ countries: any[] }>("/api/branch-management/countries")
      .then((res) => setCountries(res.countries || []))
      .catch((e) => console.error("Error loading countries:", e));

    // Companies
    apiGet<{ companies: any[] }>("/api/erp/companies")
      .then((res) => setCompanies(res.companies || []))
      .catch((e) => console.error("Error loading companies:", e));

    // Branches (try city-branches as primary)
    apiGet<{ entries: any[] }>("/api/branch-management/city-branches?limit=100")
      .then((res) => setBranches(res.entries || []))
      .catch(() => {
        // Fallback to empty if not configured
        setBranches([]);
      });
  }, []);

  // Fetch report data
  const loadReportData = () => {
    setLoading(true);
    setError(null);

    const qp = new URLSearchParams({
      reportType: selectedReport,
      countryId,
      branchId,
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
  }, [selectedReport, countryId, branchId, companyId, fromDate, toDate, interval]);

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
      {/* Page Title & Main Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b pb-5 print:hidden">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-slate-900 to-indigo-950 dark:from-white dark:to-indigo-300 bg-clip-text text-transparent">
            Enterprise Reporting Hub
          </h1>
          <p className="text-sm text-slate-500 font-medium mt-1">
            Realtime database-connected ledger analysis, audits, workflows, and interval expense models.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <a
            href="/dashboard/print-reports"
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-extrabold text-white hover:bg-blue-700 shadow-md shadow-blue-500/20 transition-all"
          >
            <Printer className="h-3.5 w-3.5" />
            Print Reports Hub (A4 PDF)
          </a>
          <button
            onClick={loadReportData}
            className="flex items-center gap-1.5 rounded-lg border bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-sm transition-all dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Reload
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-extrabold text-white hover:bg-indigo-700 shadow-md shadow-indigo-500/20 transition-all"
          >
            <Printer className="h-3.5 w-3.5" />
            Print Current View
          </button>
        </div>
      </div>

      {/* Main Layout Split */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Left Side: Report selector */}
        <aside className="lg:col-span-1 space-y-2.5 print:hidden">
          <div className="rounded-xl border bg-white/50 backdrop-blur-md p-4 shadow-sm dark:bg-slate-900/50 dark:border-slate-850">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3 px-1">
              Select Registry / Ledger
            </h2>
            <div className="space-y-1">
              {REPORT_LIST.map((item) => {
                const Icon = item.icon;
                const isSelected = selectedReport === item.type;
                return (
                  <button
                    key={item.type}
                    onClick={() => setSelectedReport(item.type)}
                    className={cn(
                      "w-full flex items-center justify-between rounded-lg px-3 py-2.5 text-start text-xs transition-all duration-200",
                      isSelected
                        ? "bg-indigo-50 text-indigo-700 font-black shadow-sm dark:bg-indigo-950/40 dark:text-indigo-400"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon className={cn("h-4 w-4 shrink-0", isSelected ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400")} />
                      <span className="truncate">{item.title}</span>
                    </div>
                    <ChevronRight className="h-3 w-3 opacity-40 shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        {/* Right Side: Data view panel */}
        <div className="lg:col-span-3 space-y-6">
          {/* Glassmorphic Report Meta Card */}
          <div className="rounded-xl border bg-gradient-to-br from-white to-slate-50/50 p-6 shadow-sm dark:from-slate-900 dark:to-slate-950/40 dark:border-slate-800">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400">
                  Active Report
                </span>
                <h2 className="text-xl font-black text-slate-900 dark:text-white mt-1">
                  {activeMeta.title}
                </h2>
                <p className="text-xs text-slate-400 mt-1">{activeMeta.description}</p>
              </div>

              {/* Action Toolbar */}
              <div className="flex flex-wrap items-center gap-1.5 print:hidden">
                <button
                  onClick={handleExportCSV}
                  disabled={selectedReport === "financial-summaries"}
                  className="p-1.5 rounded-lg border bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400 hover:text-indigo-600 transition-colors disabled:opacity-40"
                  title="Export to CSV"
                >
                  <DownloadActionIcon className="h-4 w-4" />
                </button>
                <button
                  onClick={handleShareWhatsApp}
                  className="p-1.5 rounded-lg border bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400 hover:text-emerald-600 transition-colors"
                  title="Share via WhatsApp"
                >
                  <Share2 className="h-4 w-4" />
                </button>
                <button
                  onClick={handleShareEmail}
                  className="p-1.5 rounded-lg border bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400 hover:text-blue-500 transition-colors"
                  title="Email Report"
                >
                  <Mail className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mt-6 border-t pt-5 print:hidden">
              {/* Country Scope */}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400">Country</label>
                <select
                  value={countryId}
                  onChange={(e) => setCountryId(e.target.value)}
                  className="w-full text-xs rounded-lg border bg-white px-2 py-1.5 outline-none dark:bg-slate-900 dark:border-slate-800"
                >
                  <option value="all">All Countries</option>
                  {countries.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Branch Scope */}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400">Branch</label>
                <select
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  className="w-full text-xs rounded-lg border bg-white px-2 py-1.5 outline-none dark:bg-slate-900 dark:border-slate-800"
                >
                  <option value="all">All Branches</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Company Scope */}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400">Company</label>
                <select
                  value={companyId}
                  onChange={(e) => setCompanyId(e.target.value)}
                  className="w-full text-xs rounded-lg border bg-white px-2 py-1.5 outline-none dark:bg-slate-900 dark:border-slate-800"
                >
                  <option value="all">All Companies</option>
                  {companies.map((cmp) => (
                    <option key={cmp.id} value={cmp.id}>
                      {cmp.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Interval (Visible only on Expenses) */}
              {selectedReport === "expenses" ? (
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400">Cost Interval</label>
                  <select
                    value={interval}
                    onChange={(e) => setInterval(e.target.value)}
                    className="w-full text-xs rounded-lg border bg-white px-2 py-1.5 outline-none dark:bg-slate-900 dark:border-slate-800"
                  >
                    <option value="daily">Daily Costs</option>
                    <option value="weekly">Weekly Costs</option>
                    <option value="monthly">Monthly Costs</option>
                    <option value="yearly">Yearly Costs</option>
                  </select>
                </div>
              ) : (
                /* Date Range Picker */
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400">Date From / To</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="date"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                      className="w-1/2 text-[10px] rounded-lg border bg-white px-1.5 py-1 outline-none dark:bg-slate-900 dark:border-slate-800"
                    />
                    <span className="text-slate-300">-</span>
                    <input
                      type="date"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                      className="w-1/2 text-[10px] rounded-lg border bg-white px-1.5 py-1 outline-none dark:bg-slate-900 dark:border-slate-800"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Aggregates Summary Cards Grid */}
          <div className={cn("grid gap-4", selectedReport === "daily-comprehensive" ? "hidden" : "grid-cols-2 md:grid-cols-4")}>
            {selectedReport === "cash-entry" && (
              <>
                <div className="rounded-xl border bg-white p-4 shadow-sm dark:bg-slate-900 dark:border-slate-800">
                  <p className="text-[10px] font-black uppercase text-slate-400">Total Entries</p>
                  <p className="text-xl font-extrabold text-slate-800 dark:text-white mt-1">{summary.count ?? 0}</p>
                </div>
                <div className="rounded-xl border bg-white p-4 shadow-sm dark:bg-slate-900 dark:border-slate-800">
                  <p className="text-[10px] font-black uppercase text-slate-400">Total Cash Received</p>
                  <p className="text-xl font-extrabold text-emerald-600 mt-1">
                    Rs {(summary.totalDebitPKREquiv ?? 0).toLocaleString()}
                  </p>
                </div>
                <div className="rounded-xl border bg-white p-4 shadow-sm dark:bg-slate-900 dark:border-slate-800">
                  <p className="text-[10px] font-black uppercase text-slate-400">Total Cash Outward</p>
                  <p className="text-xl font-extrabold text-rose-500 mt-1">
                    Rs {(summary.totalCreditPKREquiv ?? 0).toLocaleString()}
                  </p>
                </div>
                <div className="rounded-xl border bg-white p-4 shadow-sm dark:bg-slate-900 dark:border-slate-800">
                  <p className="text-[10px] font-black uppercase text-slate-400">Net Cash Position</p>
                  <p className={cn("text-xl font-extrabold mt-1", (summary.netBalancePKREquiv ?? 0) >= 0 ? "text-indigo-600" : "text-rose-500")}>
                    Rs {(summary.netBalancePKREquiv ?? 0).toLocaleString()}
                  </p>
                </div>
              </>
            )}

            {selectedReport === "expenses" && (
              <>
                <div className="rounded-xl border bg-white p-4 shadow-sm dark:bg-slate-900 dark:border-slate-800">
                  <p className="text-[10px] font-black uppercase text-slate-400">Expenses Count</p>
                  <p className="text-xl font-extrabold text-slate-800 dark:text-white mt-1">{summary.count ?? 0}</p>
                </div>
                <div className="rounded-xl border bg-white p-4 shadow-sm dark:bg-slate-900 dark:border-slate-800">
                  <p className="text-[10px] font-black uppercase text-slate-400">Total Costs (USD)</p>
                  <p className="text-xl font-extrabold text-rose-500 mt-1">
                    ${Math.round(summary.totalExpenseUSD ?? 0).toLocaleString()}
                  </p>
                </div>
                <div className="rounded-xl border bg-white p-4 shadow-sm dark:bg-slate-900 dark:border-slate-800">
                  <p className="text-[10px] font-black uppercase text-slate-400">Avg Cost / Expense</p>
                  <p className="text-xl font-extrabold text-slate-700 dark:text-slate-300 mt-1">
                    ${Math.round(summary.avgExpenseUSD ?? 0).toLocaleString()}
                  </p>
                </div>
                <div className="rounded-xl border bg-white p-4 shadow-sm dark:bg-slate-900 dark:border-slate-800">
                  <p className="text-[10px] font-black uppercase text-slate-400">High Spending Branch</p>
                  <p className="text-xs font-black text-indigo-600 mt-2 truncate">{summary.highSpendingBranch || "-"}</p>
                </div>
              </>
            )}

            {selectedReport === "purchase-booking-register" && (
              <>
                <div className="rounded-xl border bg-white p-4 shadow-sm dark:bg-slate-900 dark:border-slate-800">
                  <p className="text-[10px] font-black uppercase text-slate-400">Total Bookings</p>
                  <p className="text-xl font-extrabold text-slate-800 dark:text-white mt-1">{summary.count ?? 0}</p>
                </div>
                <div className="rounded-xl border bg-white p-4 shadow-sm dark:bg-slate-900 dark:border-slate-800">
                  <p className="text-[10px] font-black uppercase text-slate-400">Total Containers</p>
                  <p className="text-xl font-extrabold text-indigo-600 mt-1">
                    {summary.totalContainers ?? 0}
                  </p>
                </div>
                <div className="rounded-xl border bg-white p-4 shadow-sm dark:bg-slate-900 dark:border-slate-800">
                  <p className="text-[10px] font-black uppercase text-slate-400">Booking Value (USD)</p>
                  <p className="text-xl font-extrabold text-emerald-600 mt-1">
                    ${Math.round(summary.totalAmountUSD ?? 0).toLocaleString()}
                  </p>
                </div>
                <div className="rounded-xl border bg-white p-4 shadow-sm dark:bg-slate-900 dark:border-slate-800">
                  <p className="text-[10px] font-black uppercase text-slate-400">Register Status</p>
                  <span className="mt-2 inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-extrabold text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400">
                    Live Registry
                  </span>
                </div>
              </>
            )}

            {selectedReport !== "cash-entry" && selectedReport !== "expenses" && selectedReport !== "purchase-booking-register" && (
              <>
                <div className="rounded-xl border bg-white p-4 shadow-sm dark:bg-slate-900 dark:border-slate-800">
                  <p className="text-[10px] font-black uppercase text-slate-400">Entries Count</p>
                  <p className="text-xl font-extrabold text-slate-800 dark:text-white mt-1">
                    {Array.isArray(filteredRows) ? filteredRows.length : 0}
                  </p>
                </div>
                <div className="rounded-xl border bg-white p-4 shadow-sm dark:bg-slate-900 dark:border-slate-800">
                  <p className="text-[10px] font-black uppercase text-slate-400">Report Status</p>
                  <span className="mt-2 inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-extrabold text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400">
                    Database Synced
                  </span>
                </div>
                <div className="rounded-xl border bg-white p-4 shadow-sm dark:bg-slate-900 dark:border-slate-800">
                  <p className="text-[10px] font-black uppercase text-slate-400">Generated At</p>
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-2">
                    {generatedAt ? new Date(generatedAt).toLocaleTimeString() : "-"}
                  </p>
                </div>
                <div className="rounded-xl border bg-white p-4 shadow-sm dark:bg-slate-900 dark:border-slate-800">
                  <p className="text-[10px] font-black uppercase text-slate-400">Security Clearance</p>
                  <span className="mt-2 inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-[9px] font-extrabold text-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-400">
                    Authorized User
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Search box for table filtering */}
          {selectedReport !== "financial-summaries" && (
            <div className="relative print:hidden">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search ledger rows, references, descriptions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border bg-white py-2 pl-10 pr-4 text-xs shadow-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100"
              />
            </div>
          )}

          {/* Data Table */}
          <div className="rounded-xl border bg-white shadow-sm overflow-hidden dark:bg-slate-900 dark:border-slate-800">
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
                  onClick={loadReportData}
                  className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-indigo-700 transition-colors"
                >
                  Retry Query
                </button>
              </div>
            ) : selectedReport === "financial-summaries" ? (
              /* Special layout for Financial Summaries / Balance Sheet */
              <div className="p-6 space-y-6">
                <h3 className="text-sm font-black uppercase tracking-wider text-indigo-600">Balance Sheet Summary</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Assets */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-black border-b pb-1">Assets (Dr)</h4>
                    {data.assets?.map((a: any) => (
                      <div key={a.code} className="flex justify-between text-xs font-medium">
                        <span>{a.code} - {a.name}</span>
                        <span className="font-bold">{a.balance.toLocaleString()} {a.currency}</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-xs font-bold pt-2 border-t text-indigo-600">
                      <span>Total Assets (USD Equiv)</span>
                      <span>${Math.round(summary.totalAssetsUSD ?? 0).toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Liabilities & Equity */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-black border-b pb-1">Liabilities & Equity (Cr)</h4>
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
                    <div className="flex justify-between text-xs font-bold pt-2 border-t text-indigo-600">
                      <span>Total Liabilities & Capital</span>
                      <span>${Math.round(summary.totalLiabilitiesUSD ?? 0).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-5 mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50/50 p-4 rounded-xl dark:bg-slate-950/20">
                  <div>
                    <p className="text-[10px] font-black uppercase text-slate-400">Total Income</p>
                    <p className="text-sm font-extrabold text-emerald-600">${Math.round(summary.totalRevenueUSD ?? 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase text-slate-400">Total Operating Expenses</p>
                    <p className="text-sm font-extrabold text-rose-500">${Math.round(summary.totalExpenseUSD ?? 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase text-slate-400">Net Period Earnings</p>
                    <p className="text-sm font-extrabold text-indigo-600">${Math.round(summary.netIncomeUSD ?? 0).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            ) : filteredRows.length === 0 ? (
              <div className="py-20 text-center text-xs text-slate-400 font-bold">
                No records matched filters or query criteria.
              </div>
            ) : (
              /* Generic Table Viewer */
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-[10px] font-black uppercase text-slate-800 dark:bg-slate-900/60 dark:text-slate-200">
                      {Object.keys(filteredRows[0]).filter((k) => k !== "id").map((k) => (
                        <th key={k} className="border-b px-4 py-3 border-slate-100 dark:border-slate-800">
                          {k.replace(/([A-Z])/g, " $1").toUpperCase()}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((row: any, idx) => (
                      <tr
                        key={row.id || idx}
                        className="hover:bg-slate-50/50 transition-colors border-b last:border-b-0 border-slate-100 dark:border-slate-800 dark:hover:bg-slate-900/30"
                      >
                        {Object.entries(row).filter(([k]) => k !== "id").map(([k, val]: [string, any]) => {
                          const isNumeric = typeof val === "number";
                          const isStatus = k === "status";
                          return (
                            <td
                              key={k}
                              className={cn(
                                "px-4 py-3 font-medium",
                                isNumeric ? "font-mono font-bold text-slate-800 dark:text-slate-200" : "text-slate-600 dark:text-slate-300"
                              )}
                            >
                              {isStatus ? (
                                <span
                                  className={cn(
                                    "inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider",
                                    val === "posted" || val === "approved" || val === "active"
                                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
                                      : val === "pending"
                                        ? "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400"
                                        : "bg-slate-50 text-slate-500 dark:bg-slate-850 dark:text-slate-400"
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
    </div>
  );
}
