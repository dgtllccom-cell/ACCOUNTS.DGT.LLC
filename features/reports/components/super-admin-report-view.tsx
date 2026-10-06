"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Globe,
  Search,
  ChevronDown,
  Users,
  Building2,
  FileText,
  DollarSign,
  Download,
  Printer,
  Columns3,
  Calendar,
  RotateCw,
  ClipboardList,
  Check,
  BarChart3,
  ArrowUpRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { listCountries, type LocationCountry } from "@/features/locations/location-api";
import { apiGet } from "@/lib/api/client";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";
import { getLanguageDirection } from "@/lib/i18n/languages";

interface CountryPerformanceRow {
  id: string;
  name: string;
  iso2: string;
  currencyCode: string;
  totalBranches: number;
  activeBranches: number;
  totalUsers: number;
  status: "ACTIVE" | "INACTIVE";
}

interface LedgerSummary {
  totalRecords: number;
  totalCredit: number;
  totalDebit: number;
  posted: number;
  pending: number;
}

interface SuperAdminReportViewProps {
  viewerName?: string;
  viewerId?: string;
  viewerRole?: string;
}

interface OverviewApiRecord {
  id: string;
  name: string;
  iso2?: string;
  currencyCode?: string;
  totalBranches?: number;
  activeBranches?: number;
  totalUsers?: number;
  status?: string;
}

interface OverviewApiResponse {
  data?: OverviewApiRecord[];
}

interface LedgerApiResponse {
  summary?: {
    records?: number;
    totalCredit?: number;
    totalDebit?: number;
    posted?: number;
    pending?: number;
  };
}

function getCountryFlag(iso2?: string): string {
  if (!iso2 || iso2.length !== 2) return "🌐";
  const upper = iso2.toUpperCase();
  // Standard Unicode regional indicator symbols for country flags
  const codePoints = upper
    .split("")
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

export function SuperAdminReportView({
  viewerName = "SUPER ADMIN",
  viewerId = "00000000-0000-0000-0000-000000000001",
  viewerRole = "GLOBAL"
}: SuperAdminReportViewProps) {
  const activeLang = useActiveLanguage();
  const lang = activeLang || "en";
  const isRtl = getLanguageDirection(lang) === "rtl";
  const tt = (key: Parameters<typeof t>[1], fallback: string) => t(lang, key, fallback);

  // Filter states
  const [selectedReport, setSelectedReport] = useState("super-admin-reports");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateRange, setDateRange] = useState("all");
  const [selectedRole, setSelectedRole] = useState("all");
  const [selectedCountryId, setSelectedCountryId] = useState("all");
  const [selectedBranchId, setSelectedBranchId] = useState("all");
  const [selectedCurrency, setSelectedCurrency] = useState("USD");
  const [showDetails, setShowDetails] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [reportDropdownOpen, setReportDropdownOpen] = useState(false);
  const [dateDropdownOpen, setDateDropdownOpen] = useState(false);
  const [columnsModalOpen, setColumnsModalOpen] = useState(false);

  // Data states
  const [countries, setCountries] = useState<LocationCountry[]>([]);
  const [countryRows, setCountryRows] = useState<CountryPerformanceRow[]>([]);
  const [ledgerSummary, setLedgerSummary] = useState<LedgerSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentDateTime, setCurrentDateTime] = useState("");

  // Visible columns
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    country: true,
    totalBranches: true,
    activeBranches: true,
    totalUsers: true,
    status: true,
    actions: true
  });

  // Clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const options: Intl.DateTimeFormatOptions = {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true
      };
      setCurrentDateTime(now.toLocaleDateString("en-GB", options));
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch real data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const countryList = await listCountries();
      setCountries(countryList);

      const overviewQp = new URLSearchParams({
        reportType: "country-overview",
        countryId: selectedCountryId === "all" ? "" : selectedCountryId,
        lang
      });
      const ledgerQp = new URLSearchParams({
        reportType: "ledger",
        countryId: selectedCountryId === "all" ? "" : selectedCountryId,
        currency: selectedCurrency,
        limit: "2000",
        lang
      });



      const [overviewRes, ledgerRes] = await Promise.all([
        apiGet<OverviewApiResponse>(`/api/erp/reports/super-admin?${overviewQp.toString()}`).catch(() => null),
        apiGet<LedgerApiResponse>(`/api/erp/reports/super-admin?${ledgerQp.toString()}`).catch(() => null)
      ]);

      const rows: CountryPerformanceRow[] = Array.isArray(overviewRes?.data)
        ? overviewRes.data.map((r: OverviewApiRecord) => ({
            id: r.id,
            name: r.name,
            iso2: r.iso2 || "GL",
            currencyCode: r.currencyCode || "USD",
            totalBranches: Number(r.totalBranches ?? 0),
            activeBranches: Number(r.activeBranches ?? 0),
            totalUsers: Number(r.totalUsers ?? 0),
            status: r.status === "ACTIVE" ? "ACTIVE" : "INACTIVE"
          }))
        : [];
      setCountryRows(rows);

      if (ledgerRes?.summary) {
        setLedgerSummary({
          totalRecords: Number(ledgerRes.summary.records ?? 0),
          totalCredit: Number(ledgerRes.summary.totalCredit ?? 0),
          totalDebit: Number(ledgerRes.summary.totalDebit ?? 0),
          posted: Number(ledgerRes.summary.posted ?? 0),
          pending: Number(ledgerRes.summary.pending ?? 0)
        });
      } else {
        setLedgerSummary(null);
      }
    } catch (err) {
      console.error("Failed to load Super Admin report data:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedCountryId, selectedCurrency, lang]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filtered country rows
  const filteredCountryRows = useMemo(() => {
    if (!searchQuery.trim()) return countryRows;
    const q = searchQuery.toLowerCase().trim();
    return countryRows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.currencyCode.toLowerCase().includes(q) ||
        r.iso2.toLowerCase().includes(q)
    );
  }, [countryRows, searchQuery]);

  // Aggregated totals
  const totals = useMemo(() => {
    const totalBranches = filteredCountryRows.reduce((sum, r) => sum + r.totalBranches, 0);
    const totalUsers = filteredCountryRows.reduce((sum, r) => sum + r.totalUsers, 0);
    const activeBranches = filteredCountryRows.reduce((sum, r) => sum + r.activeBranches, 0);
    const activeCountries = filteredCountryRows.filter((r) => r.status === "ACTIVE").length;
    const inactiveCountries = filteredCountryRows.filter((r) => r.status === "INACTIVE").length;
    return {
      totalBranches,
      totalUsers,
      activeBranches,
      activeCountries,
      inactiveCountries,
      totalRecords: filteredCountryRows.length
    };
  }, [filteredCountryRows]);

  const netBalance = (ledgerSummary?.totalCredit ?? 0) - (ledgerSummary?.totalDebit ?? 0);

  // Export handlers
  const handleExportCsv = () => {
    const headers = [
      "#",
      tt("sarh.col_country", "Country"),
      tt("sarh.col_total_branches", "Total Branches"),
      tt("sarh.col_active_branches", "Active Branches"),
      tt("sarh.col_total_users", "Total Users"),
      t(lang, "common.status", "Status")
    ];
    const csvRows = filteredCountryRows.map((r, i) => [
      i + 1,
      `"${r.name}"`,
      r.totalBranches,
      r.activeBranches,
      r.totalUsers,
      r.status
    ]);
    const csvContent = [headers.join(","), ...csvRows.map((e) => e.join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Super_Admin_Reports_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setActionsOpen(false);
  };

  const handlePrint = () => {
    window.print();
    setActionsOpen(false);
  };

  const reportNames: Record<string, string> = {
    "super-admin-reports": tt("sarh.opt_super_admin_reports", "Super Admin Reports"),
    "ledger": tt("sarh.opt_general_ledger", "General Ledger Report"),
    "bills": tt("sarh.opt_bill_entries", "Bill Entries Report"),
    "payments": tt("sarh.opt_cash_payments", "Cash & Payments"),
    "sales": tt("sarh.opt_sales_journal", "Sales Journal"),
    "purchase": tt("sarh.opt_purchase_orders", "Purchase Orders")
  };

  const dateRangeNames: Record<string, string> = {
    all: tt("sarh.date_all", "All Dates"),
    today: tt("sarh.date_today", "Today"),
    yesterday: tt("sarh.date_yesterday", "Yesterday"),
    month: tt("sarh.date_this_month", "This Month")
  };

  return (
    <div
      dir={isRtl ? "rtl" : "ltr"}
      className="min-h-screen w-full bg-[#f4f6fa] dark:bg-slate-950 font-sans text-slate-800 dark:text-slate-100 flex flex-col"
    >
      <div className="flex-1 w-full max-w-[1600px] mx-auto p-3 sm:p-5 lg:p-6 space-y-4">
        {/* ============================================================== */}
        {/* 1. Frosted Icy-Blue Header Banner with Integrated Controls & Globe */}
        {/* ============================================================== */}
        <div className="relative overflow-hidden rounded-2xl border border-sky-300/60 dark:border-blue-900/50 bg-gradient-to-r from-[#d3e3f5] via-[#e2edfa] to-[#d4e6f6] dark:from-slate-900 dark:via-blue-950/70 dark:to-slate-900 p-5 sm:p-6 shadow-sm">
          {/* Globe Graphic on Right */}
          <div className="absolute -right-4 -top-8 -bottom-8 w-72 sm:w-96 pointer-events-none opacity-85 overflow-hidden flex items-center justify-end select-none">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/reports/header_globe.jpg"
              alt="Global Operations"
              className="w-full h-full object-contain mix-blend-multiply dark:mix-blend-screen drop-shadow-sm"
              style={{
                maskImage: "radial-gradient(circle at 50% 50%, black 48%, transparent 72%)",
                WebkitMaskImage: "radial-gradient(circle at 50% 50%, black 48%, transparent 72%)"
              }}
            />
          </div>

          {/* User Welcome Header */}
          <div className="relative z-10">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Welcome, {viewerName || "[User Name]"}
            </h1>
            <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 mt-0.5">
              Super Admin
            </p>
          </div>

          {/* Primary Controls Row: Report Selector, Search, Date Range, Refresh, Actions */}
          <div className="relative z-10 mt-3.5 flex flex-wrap items-center gap-2.5">
            {/* Select Report Pill Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setReportDropdownOpen(!reportDropdownOpen)}
                className="h-9 px-3.5 rounded-full bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition"
              >
                <ClipboardList className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                <span>{reportNames[selectedReport] || "Super Admin Reports"}</span>
                <ChevronDown className="h-3 w-3 text-slate-400" />
              </button>

              {reportDropdownOpen && (
                <div
                  className="absolute start-0 top-full mt-1.5 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-800 dark:bg-slate-900 z-50 animate-in fade-in zoom-in-95"
                  onMouseLeave={() => setReportDropdownOpen(false)}
                >
                  {Object.entries(reportNames).map(([key, name]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setSelectedReport(key);
                        setReportDropdownOpen(false);
                      }}
                      className={cn(
                        "w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-semibold text-start transition",
                        selectedReport === key
                          ? "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 font-bold"
                          : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                      )}
                    >
                      <span>{name}</span>
                      {selectedReport === key && <Check className="h-3 w-3 text-blue-600" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Search Input Bar */}
            <div className="relative flex-1 min-w-[240px] max-w-xl">
              <Search className="h-3.5 w-3.5 absolute start-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={tt("sarh.search_placeholder", "Search & filter reports, countries, branches, users...")}
                className="w-full h-9 ps-9 pe-4 rounded-full bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 text-xs font-medium text-slate-800 dark:text-slate-200 placeholder-slate-400 shadow-2xs focus-visible:ring-1 focus-visible:ring-blue-400"
              />
            </div>

            {/* All Dates Pill Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setDateDropdownOpen(!dateDropdownOpen)}
                className="h-9 px-3.5 rounded-full bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition"
              >
                <Calendar className="h-3.5 w-3.5 text-slate-500" />
                <span>{dateRangeNames[dateRange] || "All Dates"}</span>
                <ChevronDown className="h-3 w-3 text-slate-400" />
              </button>

              {dateDropdownOpen && (
                <div
                  className="absolute end-0 top-full mt-1.5 w-44 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-800 dark:bg-slate-900 z-50 animate-in fade-in zoom-in-95"
                  onMouseLeave={() => setDateDropdownOpen(false)}
                >
                  {Object.entries(dateRangeNames).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setDateRange(key);
                        setDateDropdownOpen(false);
                      }}
                      className={cn(
                        "w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-semibold text-start transition",
                        dateRange === key
                          ? "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 font-bold"
                          : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                      )}
                    >
                      <span>{label}</span>
                      {dateRange === key && <Check className="h-3 w-3 text-blue-600" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={fetchData}
              disabled={loading}
              className="h-9 px-3.5 rounded-full bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition"
            >
              <RotateCw className={cn("h-3.5 w-3.5 text-slate-600 dark:text-slate-400", loading && "animate-spin text-blue-600")} />
              <span>{t(lang, "common.refresh", "Refresh")}</span>
            </button>

            {/* Actions Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setActionsOpen(!actionsOpen)}
                className="h-9 px-4 rounded-full bg-white/95 hover:bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300 border border-blue-200/90 dark:border-blue-900 shadow-2xs text-xs font-semibold flex items-center gap-1.5 transition"
              >
                <span>{t(lang, "common.actions", "Actions")}</span>
                <ChevronDown className="h-3.5 w-3.5 text-blue-600" />
              </button>

              {actionsOpen && (
                <div
                  className="absolute end-0 top-full mt-1.5 w-44 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-800 dark:bg-slate-900 z-50 animate-in fade-in zoom-in-95"
                  onMouseLeave={() => setActionsOpen(false)}
                >
                  <button
                    type="button"
                    onClick={handleExportCsv}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    <Download className="h-3.5 w-3.5 text-blue-600" />
                    <span>{t(lang, "common.export", "Export")} CSV</span>
                  </button>
                  <button
                    type="button"
                    onClick={handlePrint}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    <Printer className="h-3.5 w-3.5 text-slate-600" />
                    <span>{t(lang, "common.print", "Print")}</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Secondary Filter Row: Roles, Countries, Branches, Currencies & Real-time Badge */}
          <div className="relative z-10 mt-3 flex flex-wrap items-center gap-2.5 text-xs">
            {/* ROLE Filter */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/95 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
              <Users className="h-3.5 w-3.5 text-blue-600" />
              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase">
                {tt("sarh.role_label", "ROLE")}:
              </span>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                aria-label={tt("sarh.role_label", "Role")}
                className="bg-transparent font-medium text-xs text-slate-800 dark:text-slate-200 outline-none cursor-pointer pe-1"
              >
                <option value="all">{tt("sarh.all_roles", "All Roles")}</option>
                <option value="super_admin">{tt("sarh.opt_super_admin", "Super Admin")}</option>
                <option value="country_admin">{tt("sarh.opt_country_admin", "Country Admin")}</option>
                <option value="branch_admin">{tt("sarh.opt_branch_admin", "Branch Admin")}</option>
              </select>
            </div>

            {/* COUNTRY Filter */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/95 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
              <Globe className="h-3.5 w-3.5 text-cyan-600" />
              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase">
                {tt("sarh.country_label", "COUNTRY")}:
              </span>
              <select
                value={selectedCountryId}
                onChange={(e) => setSelectedCountryId(e.target.value)}
                aria-label={tt("sarh.country_label", "Country")}
                className="bg-transparent font-medium text-xs text-slate-800 dark:text-slate-200 outline-none cursor-pointer max-w-[160px] truncate pe-1"
              >
                <option value="all">{tt("sarh.all_countries_global", "All Countries (Global)")}</option>
                {countries.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* BRANCH Filter */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/95 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
              <Building2 className="h-3.5 w-3.5 text-purple-600" />
              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase">
                {tt("sarh.branch_label", "BRANCH")}:
              </span>
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                aria-label={tt("sarh.branch_label", "Branch")}
                className="bg-transparent font-medium text-xs text-slate-800 dark:text-slate-200 outline-none cursor-pointer pe-1"
              >
                <option value="all">{tt("sarh.all_branches", "All Branches")}</option>
              </select>
            </div>

            {/* CURRENCY Filter */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/95 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
              <DollarSign className="h-3.5 w-3.5 text-emerald-600" />
              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase">
                {tt("sarh.currency_label", "CURRENCY")}:
              </span>
              <select
                value={selectedCurrency}
                onChange={(e) => setSelectedCurrency(e.target.value)}
                aria-label={tt("sarh.currency_label", "Currency")}
                className="bg-transparent font-medium text-xs text-slate-800 dark:text-slate-200 outline-none cursor-pointer font-mono pe-1"
              >
                <option value="USD">USD</option>
                <option value="AED">AED</option>
                <option value="PKR">PKR</option>
                <option value="EUR">EUR</option>
              </select>
            </div>

            {/* Real-time sync note */}
            <span className="text-[11px] text-slate-600 dark:text-slate-400 font-medium ms-1">
              All Dates syncs in real-time
            </span>

            {/* Report Scope Badge */}
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100/90 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300/70 dark:border-emerald-800 text-xs font-semibold">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{tt("sarh.report_scope_global", "Report Scope: Global")}</span>
            </div>

            {/* Date Synced note */}
            <span className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">
              {tt("sarh.data_synced", "Date synced in real-time")}
            </span>
          </div>
        </div>

        {/* ============================================================== */}
        {/* 2. Main Content Grid: Active Countries Table (Left) + Stats (Right) */}
        {/* ============================================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Active Countries Table Card (9 columns) */}
          <div className="lg:col-span-9 rounded-2xl border border-slate-200/90 bg-white dark:border-slate-800 dark:bg-slate-900 shadow-2xs overflow-hidden flex flex-col">
            {/* Card Header with Show Details Toggle */}
            <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-100">
                {tt("sarh.active_countries_colon", "Active Countries:").replace(/:\s*$/, "")}
              </h2>
              <button
                type="button"
                onClick={() => setShowDetails(!showDetails)}
                className="text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 flex items-center gap-1 transition"
              >
                <span>{tt("sarh.show_details", "Show Details")}</span>
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", showDetails && "rotate-180")} />
              </button>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-start">
                <thead>
                  <tr className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/90">
                    <th className="py-3 px-4 text-start">{tt("sarh.col_country", "Country")}</th>
                    <th className="py-3 px-3 text-center">{tt("sarh.col_total_branches", "Total Branches")}</th>
                    <th className="py-3 px-3 text-center">{tt("sarh.col_active_branches", "Active Branches")}</th>
                    <th className="py-3 px-3 text-center">{tt("sarh.col_total_users", "Total Users")}</th>
                    <th className="py-3 px-3 text-center">{t(lang, "common.status", "Status")}</th>
                    <th className="py-3 px-4 text-end"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-xs text-slate-400">
                        {t(lang, "common.loading", "Loading...")}
                      </td>
                    </tr>
                  ) : filteredCountryRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-xs text-slate-400">
                        {tt("sarh.no_data_found", "No data found")}
                      </td>
                    </tr>
                  ) : (
                    filteredCountryRows.map((row) => (
                      <tr
                        key={row.id}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="py-3 px-4 font-semibold text-slate-850 dark:text-slate-100 flex items-center gap-2.5">
                          {row.iso2 && row.iso2.length === 2 ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={`https://flagcdn.com/w40/${row.iso2.toLowerCase()}.png`}
                              alt={row.name}
                              className="w-5 h-3.5 object-cover rounded-xs shadow-2xs border border-slate-200/60 shrink-0"
                              onError={(e) => {
                                (e.currentTarget as HTMLElement).style.display = "none";
                              }}
                            />
                          ) : (
                            <span className="text-base leading-none" title={row.iso2}>
                              {getCountryFlag(row.iso2)}
                            </span>
                          )}
                          <span>{row.name}</span>
                        </td>
                        <td className="py-3 px-3 text-center font-medium text-slate-700 dark:text-slate-300">
                          {row.totalBranches}
                        </td>
                        <td className="py-3 px-3 text-center font-medium text-slate-700 dark:text-slate-300">
                          {row.activeBranches}
                        </td>
                        <td className="py-3 px-3 text-center font-medium text-slate-700 dark:text-slate-300">
                          {row.totalUsers}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span
                            className={cn(
                              "px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase border",
                              row.status === "ACTIVE"
                                ? "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
                                : "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800"
                            )}
                          >
                            {row.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-end">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCountryId(row.id);
                              window.scrollTo({ top: 0, behavior: "smooth" });
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1 rounded-md border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/80 shadow-2xs transition"
                          >
                            <span>{t(lang, "common.view", "View")}</span>
                            <ChevronDown className="h-3 w-3 text-slate-400" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right Summary Widgets Panel (3 columns) */}
          <div className="lg:col-span-3 space-y-3.5">
            {/* Total Branches Widget */}
            <div className="rounded-2xl border border-slate-200/90 bg-white dark:border-slate-800 dark:bg-slate-900 p-4 shadow-2xs">
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {tt("sarh.col_total_branches", "Total Branches")}
              </div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1 tracking-tight">
                {totals.totalBranches}
              </div>
            </div>

            {/* Users Widget */}
            <div className="rounded-2xl border border-slate-200/90 bg-white dark:border-slate-800 dark:bg-slate-900 p-4 shadow-2xs">
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                <Building2 className="h-4 w-4 text-blue-600" />
                <span>Users</span>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1 tracking-tight">
                {totals.totalUsers}
              </div>
            </div>

            {/* Status Details Widget */}
            <div className="rounded-2xl border border-slate-200/90 bg-white dark:border-slate-800 dark:bg-slate-900 p-4 shadow-2xs flex items-center justify-between">
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {tt("sarh.status_colon", "Status:").replace(/:\s*$/, "") + " " + (tt("sarh.show_details", "Details").split(" ").pop() || "Details")}
              </div>
              <span
                className={cn(
                  "px-3 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase border",
                  totals.inactiveCountries > 0
                    ? "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800"
                    : "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
                )}
              >
                {totals.inactiveCountries > 0 ? "INACTIVE" : "ACTIVE"}
              </span>
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* 3. Expandable Detailed Analytics (toggled by "Show Details ⌵") */}
        {/* ============================================================== */}
        {showDetails && (
          <div className="space-y-4 pt-2 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Branch & User Details */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2.5 mb-1">
                    <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-300 flex items-center justify-center font-bold">
                      <Users className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
                        {tt("sarh.card1_title", "1. Branch & User Details")}
                      </h3>
                      <p className="text-[10px] text-slate-400 font-medium">
                        {tt("sarh.card1_sub", "Global user and branch information")}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3.5 space-y-1.5 text-xs font-semibold">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-400 font-bold uppercase text-[10px]">{tt("sarh.country_colon", "Country:")}</span>
                      <span className="font-extrabold text-slate-850 dark:text-slate-100">{tt("sarh.all_countries_global", "All Countries (Global)")}</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-400 font-bold uppercase text-[10px]">{tt("sarh.branch_name_colon", "Branch Name:")}</span>
                      <span className="font-extrabold text-slate-850 dark:text-slate-100">{tt("sarh.all_branches", "All Branches")}</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-400 font-bold uppercase text-[10px]">{tt("sarh.user_id_colon", "User ID:")}</span>
                      <span className="font-mono text-[10px] font-bold text-slate-600 dark:text-slate-300">{viewerId.slice(0, 16)}…</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-400 font-bold uppercase text-[10px]">{tt("sarh.user_name_colon", "User Name:")}</span>
                      <span className="font-black text-slate-900 dark:text-slate-100 uppercase">{viewerName}</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-400 font-bold uppercase text-[10px]">{tt("sarh.role_colon", "Role:")}</span>
                      <span className="font-bold text-blue-600 uppercase">{viewerRole}</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-400 font-bold uppercase text-[10px]">{tt("sarh.date_time_colon", "Date & Time:")}</span>
                      <span className="font-bold text-slate-700 dark:text-slate-300 text-[10.5px]">{currentDateTime}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">{tt("sarh.status_colon", "Status:")}</span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-[10px] font-extrabold tracking-wider">
                    {t(lang, "common.active", "Active").toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Card 2: Global Financial Summary */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2.5 mb-1">
                    <div className="h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-300 flex items-center justify-center font-bold">
                      <BarChart3 className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
                        {tt("sarh.card2_title", "2. Global Financial Summary")}
                      </h3>
                      <p className="text-[10px] text-slate-400 font-medium">
                        {tt("sarh.card2_sub", "Financial overview across all countries")}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3.5 space-y-2 text-xs font-semibold">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-500 font-medium">{tt("sarh.total_records_colon", "Total Records:")}</span>
                      <span className="font-mono font-black text-slate-850 dark:text-slate-100">{ledgerSummary?.totalRecords ?? 0}</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-500 font-medium">{tt("sarh.total_credit_colon", "Total Credit (USD):")}</span>
                      <span className="font-mono font-black text-emerald-600">{(ledgerSummary?.totalCredit ?? 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-500 font-medium">{tt("sarh.total_debit_colon", "Total Debit (USD):")}</span>
                      <span className="font-mono font-black text-rose-600">{(ledgerSummary?.totalDebit ?? 0).toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                  <span className="text-xs font-black text-slate-700 dark:text-slate-300">{tt("sarh.net_balance_colon", "Net Balance (USD):")}</span>
                  <span className="font-mono font-black text-blue-600 text-sm">
                    {netBalance.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Card 3: Bill Entries Summary */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2.5 mb-1">
                    <div className="h-8 w-8 rounded-full bg-purple-100 dark:bg-purple-900/60 text-purple-600 dark:text-purple-300 flex items-center justify-center font-bold">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
                        {tt("sarh.card3_title", "3. Bill Entries Summary")}
                      </h3>
                      <p className="text-[10px] text-slate-400 font-medium">
                        {tt("sarh.card3_sub", "Status of bill entries worldwide")}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3.5 space-y-2 text-xs font-semibold">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-500 font-medium uppercase text-[10px]">{tt("sarh.total_bill_entries_colon", "Total Bill Entries:")}</span>
                      <span className="font-mono font-black text-slate-850 dark:text-slate-100">{ledgerSummary?.totalRecords ?? 0}</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-500 font-medium uppercase text-[10px]">{tt("sarh.cleared_entries_colon", "Cleared Entries:")}</span>
                      <span className="font-mono font-black text-emerald-600">{ledgerSummary?.posted ?? 0}</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-500 font-medium uppercase text-[10px]">{tt("sarh.remaining_entries_colon", "Remaining Entries:")}</span>
                      <span className="font-mono font-black text-rose-600">{ledgerSummary?.pending ?? 0}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">{tt("sarh.system_status_colon", "System Status:")}</span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 text-[10px] font-bold">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    <span>{tt("sarh.online_synced", "Online & Synced")}</span>
                  </span>
                </div>
              </div>

              {/* Card 4: All Countries Report */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2.5 mb-1">
                    <div className="h-8 w-8 rounded-full bg-orange-100 dark:bg-orange-900/60 text-orange-600 dark:text-orange-300 flex items-center justify-center font-bold">
                      <Globe className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
                        {tt("sarh.card4_title", "4. All Countries Report")}
                      </h3>
                      <p className="text-[10px] text-slate-400 font-medium">
                        {tt("sarh.card4_sub", "Coverage across global operations")}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3.5 space-y-1.5 text-xs font-semibold">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-500 font-medium uppercase text-[10px]">{tt("sarh.active_countries_colon", "Active Countries:")}</span>
                      <span className="font-mono font-black text-orange-600 text-sm">{totals.activeCountries}</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-500 font-medium">{tt("sarh.total_branches_colon", "Total Branches:")}</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{totals.totalBranches}</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-500 font-medium">{tt("sarh.col_total_users", "Total Users")}:</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{totals.totalUsers}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                  <button
                    type="button"
                    onClick={() => setColumnsModalOpen(true)}
                    className="text-[10.5px] font-extrabold text-orange-600 hover:text-orange-700 flex items-center gap-1 hover:underline"
                  >
                    <Columns3 className="h-3 w-3" />
                    <span>{tt("sarh.visible_columns", "Columns")}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleExportCsv}
                    className="px-2 py-0.5 rounded border border-orange-200 text-orange-700 hover:bg-orange-50 dark:border-orange-800 dark:text-orange-300 text-[10px] font-bold flex items-center gap-1"
                  >
                    <span>{t(lang, "common.export", "Export")}</span>
                    <ArrowUpRight className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Columns Manager Modal */}
      {columnsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b pb-2 mb-3">
              <span className="text-xs font-black uppercase text-slate-800 dark:text-slate-100">
                {tt("sarh.visible_columns", "Visible Columns")}
              </span>
              <button
                type="button"
                onClick={() => setColumnsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>
            <div className="space-y-2 max-h-72 overflow-y-auto pe-1">
              {Object.keys(visibleColumns).map((col) => (
                <label
                  key={col}
                  className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer text-xs"
                >
                  <span className="capitalize font-semibold text-slate-700 dark:text-slate-200">
                    {col.replace(/([A-Z])/g, " $1")}
                  </span>
                  <input
                    type="checkbox"
                    checked={visibleColumns[col]}
                    onChange={(e) =>
                      setVisibleColumns((prev) => ({ ...prev, [col]: e.target.checked }))
                    }
                    className="rounded text-blue-600"
                  />
                </label>
              ))}
            </div>
            <div className="mt-4 pt-2 border-t flex justify-end">
              <Button
                type="button"
                size="sm"
                onClick={() => setColumnsModalOpen(false)}
                className="text-xs font-bold"
              >
                {t(lang, "datepick.done", "Done")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Clean ERP Global Footer */}
      <footer className="w-full border-t border-slate-200/80 bg-white/80 dark:border-slate-800 dark:bg-slate-900/80 py-3 px-6 text-[11px] text-slate-400 flex flex-wrap items-center justify-between gap-3 mt-8">
        <div>
          <span>© {new Date().getFullYear()} ERP Global. {tt("sarh.footer_rights", "All rights reserved.")}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {tt("sarh.global_operations", "Global Operations")}
          </span>
          <span className="text-slate-300 dark:text-slate-700">|</span>
          <span>{tt("sarh.secure", "Secure")}</span>
          <span className="text-slate-300 dark:text-slate-700">|</span>
          <span>{tt("sarh.realtime", "Real-time")}</span>
          <span className="text-slate-300 dark:text-slate-700">|</span>
          <span>{tt("sarh.smarter_tomorrow", "Smarter Tomorrow")}</span>
        </div>
      </footer>
    </div>
  );
}
