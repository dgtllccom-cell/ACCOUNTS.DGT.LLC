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
  ArrowUpRight,
  Filter,
  BarChart3
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
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [columnsModalOpen, setColumnsModalOpen] = useState(false);

  // Data states
  const [countries, setCountries] = useState<LocationCountry[]>([]);
  const [countryRows, setCountryRows] = useState<CountryPerformanceRow[]>([]);
  const [ledgerSummary, setLedgerSummary] = useState<LedgerSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentDateTime, setCurrentDateTime] = useState("");

  // Visible columns
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    index: true,
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

  // Fetch real data - no fabricated/hardcoded numbers.
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
        apiGet<any>(`/api/erp/reports/super-admin?${overviewQp.toString()}`).catch(() => null),
        apiGet<any>(`/api/erp/reports/super-admin?${ledgerQp.toString()}`).catch(() => null)
      ]);

      const rows: CountryPerformanceRow[] = Array.isArray(overviewRes?.data)
        ? overviewRes.data.map((r: any) => ({
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

  // Filtered country performance
  const filteredCountryRows = useMemo(() => {
    if (!searchQuery.trim()) return countryRows;
    const q = searchQuery.toLowerCase().trim();
    return countryRows.filter(
      r =>
        r.name.toLowerCase().includes(q) ||
        r.currencyCode.toLowerCase().includes(q) ||
        r.iso2.toLowerCase().includes(q)
    );
  }, [countryRows, searchQuery]);

  // Real totals (from the country-overview endpoint; no fabricated fallbacks)
  const totals = useMemo(() => {
    const totalBranches = filteredCountryRows.reduce((sum, r) => sum + r.totalBranches, 0);
    const activeCountries = filteredCountryRows.filter(r => r.status === "ACTIVE").length;
    return { totalBranches, activeCountries, totalRecords: filteredCountryRows.length };
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
    const csvContent = [headers.join(","), ...csvRows.map(e => e.join(","))].join("\n");
    const blob = new Blob(["﻿" + csvContent], { type: "text/csv;charset=utf-8;" });
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

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="min-h-screen w-full bg-[#f4f7fb] dark:bg-slate-950 font-sans text-slate-850 dark:text-slate-100 flex flex-col">
      {/* Top Main Content Container */}
      <div className="flex-1 w-full max-w-[1600px] mx-auto p-3 sm:p-5 lg:p-6 space-y-4">

        {/* 1. Hero Banner */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#071329] via-[#0c1f42] to-[#08152e] border border-blue-900/40 shadow-xl text-white p-6 sm:p-8">
          <div className="absolute right-0 top-0 bottom-0 w-full md:w-[65%] pointer-events-none opacity-40 md:opacity-85 mix-blend-screen overflow-hidden flex items-center justify-end">
            <svg viewBox="0 0 800 500" className="w-full h-full object-cover">
              <defs>
                <radialGradient id="globeGlow" cx="60%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.6" />
                  <stop offset="40%" stopColor="#0284c7" stopOpacity="0.3" />
                  <stop offset="80%" stopColor="#0369a1" stopOpacity="0.08" />
                  <stop offset="100%" stopColor="#000" stopOpacity="0" />
                </radialGradient>
                <linearGradient id="netGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#818cf8" stopOpacity="0.2" />
                </linearGradient>
              </defs>
              <circle cx="520" cy="240" r="190" fill="url(#globeGlow)" />
              <ellipse cx="520" cy="240" rx="190" ry="190" fill="none" stroke="#38bdf8" strokeWidth="1.2" strokeOpacity="0.4" />
              <ellipse cx="520" cy="240" rx="140" ry="190" fill="none" stroke="#38bdf8" strokeWidth="1" strokeOpacity="0.3" strokeDasharray="4 4" />
              <ellipse cx="520" cy="240" rx="90" ry="190" fill="none" stroke="#38bdf8" strokeWidth="1" strokeOpacity="0.3" />
              <ellipse cx="520" cy="240" rx="40" ry="190" fill="none" stroke="#38bdf8" strokeWidth="1" strokeOpacity="0.3" strokeDasharray="3 3" />
              <ellipse cx="520" cy="240" rx="190" ry="60" fill="none" stroke="#38bdf8" strokeWidth="1" strokeOpacity="0.3" />
              <ellipse cx="520" cy="240" rx="190" ry="120" fill="none" stroke="#38bdf8" strokeWidth="1" strokeOpacity="0.25" strokeDasharray="4 4" />
              <circle cx="480" cy="180" r="4" fill="#38bdf8" className="animate-ping" />
              <circle cx="480" cy="180" r="3" fill="#ffffff" />
              <circle cx="560" cy="220" r="3.5" fill="#34d399" />
              <circle cx="420" cy="270" r="4" fill="#fbbf24" />
              <circle cx="610" cy="290" r="3" fill="#60a5fa" />
              <path d="M 480 180 Q 520 200 560 220" stroke="url(#netGrad)" strokeWidth="1.5" fill="none" />
              <path d="M 480 180 Q 450 225 420 270" stroke="url(#netGrad)" strokeWidth="1.5" fill="none" />
              <path d="M 560 220 Q 585 255 610 290" stroke="url(#netGrad)" strokeWidth="1.5" fill="none" />
            </svg>
          </div>

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-blue-500/10 border border-blue-400/20 text-blue-300 text-[10.5px] font-extrabold uppercase tracking-widest">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
                <span>{tt("sarh.badge", "Reports & Analytics")}</span>
              </div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white flex items-center gap-3">
                <span>{tt("sarh.title", "Super Admin Reports")}</span>
              </h1>
              <p className="text-sm sm:text-base font-bold text-cyan-300">
                {tt("sarh.tagline", "Global visibility. Complete control.")}
              </p>
              <p className="text-xs sm:text-sm text-slate-300 font-medium leading-relaxed max-w-xl">
                {tt("sarh.subtitle", "Monitor branches, users, financials and billing activities across all countries from a single, powerful view.")}
              </p>
            </div>

            <div className="lg:self-center">
              <div className="relative rounded-xl border border-blue-400/30 bg-blue-950/40 backdrop-blur-md px-5 py-4 shadow-lg max-w-[260px]">
                <div className="text-blue-400 mb-1 text-lg font-serif">"</div>
                <div className="text-xs font-black tracking-wide text-slate-100 space-y-0.5">
                  <p>{tt("sarh.quote_one_world", "One World")}</p>
                  <p>{tt("sarh.quote_one_erp", "One ERP")}</p>
                  <p className="text-cyan-300">{tt("sarh.quote_infinite", "Infinite Possibilities")}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 2. Primary Filter Bar Card */}
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
            <div className="flex flex-col">
              <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">{tt("sarh.select_report_label", "Select Report")}</span>
              <div className="relative">
                <select
                  value={selectedReport}
                  onChange={(e) => setSelectedReport(e.target.value)}
                  className="h-8.5 ps-8 pe-7 rounded-lg border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 outline-none cursor-pointer hover:bg-slate-100 transition appearance-none"
                >
                  <option value="super-admin-reports">{tt("sarh.opt_super_admin_reports", "Super Admin Reports")}</option>
                  <option value="ledger">{tt("sarh.opt_general_ledger", "General Ledger Report")}</option>
                  <option value="bills">{tt("sarh.opt_bill_entries", "Bill Entries Report")}</option>
                  <option value="payments">{tt("sarh.opt_cash_payments", "Cash & Payments")}</option>
                  <option value="sales">{tt("sarh.opt_sales_journal", "Sales Journal")}</option>
                  <option value="purchase">{tt("sarh.opt_purchase_orders", "Purchase Orders")}</option>
                </select>
                <FileText className="h-3.5 w-3.5 absolute start-2.5 top-1/2 -translate-y-1/2 text-blue-600 dark:text-blue-400 pointer-events-none" />
                <ChevronDown className="h-3 w-3 absolute end-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div className="flex-1 min-w-[220px] self-end">
              <div className="relative">
                <Search className="h-3.5 w-3.5 absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={tt("sarh.search_placeholder", "Search & filter reports, countries, branches, users...")}
                  className="h-8.5 ps-9 pe-3 rounded-lg text-xs font-medium border-slate-200 bg-slate-50/70 focus:bg-white dark:border-slate-700 dark:bg-slate-800/80"
                />
              </div>
            </div>

            <div className="self-end">
              <div className="relative">
                <select
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value)}
                  className="h-8.5 ps-8 pe-7 rounded-lg border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 outline-none cursor-pointer hover:bg-slate-100 transition appearance-none"
                >
                  <option value="all">{tt("sarh.date_all", "All Dates")}</option>
                  <option value="today">{tt("sarh.date_today", "Today")}</option>
                  <option value="yesterday">{tt("sarh.date_yesterday", "Yesterday")}</option>
                  <option value="month">{tt("sarh.date_this_month", "This Month")}</option>
                </select>
                <Calendar className="h-3.5 w-3.5 absolute start-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                <ChevronDown className="h-3 w-3 absolute end-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end">
            <Button
              type="button"
              variant={filtersOpen ? "default" : "outline"}
              size="sm"
              onClick={() => setFiltersOpen(!filtersOpen)}
              className="h-8.5 px-3 rounded-lg text-xs font-bold gap-1.5"
            >
              <Filter className="h-3.5 w-3.5 text-blue-500" />
              <span>{t(lang, "common.filters", "Filters")}</span>
              <span className="ms-0.5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-[10px] font-black px-1.5 py-0.2">
                2
              </span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={fetchData}
              disabled={loading}
              className="h-8.5 px-3 rounded-lg text-xs font-bold gap-1.5 text-slate-700 hover:text-slate-900 dark:text-slate-300"
            >
              <BarChart3 className={cn("h-3.5 w-3.5", loading && "animate-pulse text-blue-600")} />
              <span>{t(lang, "common.refresh", "Refresh")}</span>
            </Button>

            <div className="relative">
              <Button
                type="button"
                size="sm"
                onClick={() => setActionsOpen(!actionsOpen)}
                className="h-8.5 px-3.5 rounded-lg text-xs font-black bg-blue-600 hover:bg-blue-700 text-white gap-1.5 shadow-xs"
              >
                <span>{t(lang, "common.actions", "Actions")}</span>
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>

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
        </div>

        {/* 3. Secondary Scope Bar */}
        <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700">
              <Users className="h-3.5 w-3.5 text-blue-600" />
              <span className="text-[10px] font-bold text-slate-400 uppercase">{tt("sarh.role_label", "Role")}:</span>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="bg-transparent font-bold text-xs text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
              >
                <option value="all">{tt("sarh.all_roles", "All Roles")}</option>
                <option value="super_admin">{tt("sarh.opt_super_admin", "Super Admin")}</option>
                <option value="country_admin">{tt("sarh.opt_country_admin", "Country Admin")}</option>
                <option value="branch_admin">{tt("sarh.opt_branch_admin", "Branch Admin")}</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700">
              <Globe className="h-3.5 w-3.5 text-cyan-600" />
              <span className="text-[10px] font-bold text-slate-400 uppercase">{tt("sarh.country_label", "Country")}:</span>
              <select
                value={selectedCountryId}
                onChange={(e) => setSelectedCountryId(e.target.value)}
                className="bg-transparent font-bold text-xs text-slate-800 dark:text-slate-200 outline-none cursor-pointer max-w-[150px] truncate"
              >
                <option value="all">{tt("sarh.all_countries_global", "All Countries (Global)")}</option>
                {countries.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700">
              <Building2 className="h-3.5 w-3.5 text-indigo-600" />
              <span className="text-[10px] font-bold text-slate-400 uppercase">{tt("sarh.branch_label", "Branch")}:</span>
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="bg-transparent font-bold text-xs text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
              >
                <option value="all">{tt("sarh.all_branches", "All Branches")}</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700">
              <DollarSign className="h-3.5 w-3.5 text-emerald-600" />
              <span className="text-[10px] font-bold text-slate-400 uppercase">{tt("sarh.currency_label", "Currency")}:</span>
              <select
                value={selectedCurrency}
                onChange={(e) => setSelectedCurrency(e.target.value)}
                className="bg-transparent font-bold text-xs text-slate-800 dark:text-slate-200 outline-none cursor-pointer font-mono"
              >
                <option value="USD">USD</option>
                <option value="AED">AED</option>
                <option value="PKR">PKR</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[11px] font-bold shadow-2xs">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{tt("sarh.report_scope_global", "Report Scope: Global")}</span>
            </div>
            <span className="hidden sm:inline-block text-[11px] font-medium text-slate-400">
              {tt("sarh.data_synced", "Data synced in real-time")}
            </span>
          </div>
        </div>

        {/* 4. Four KPI Summary Cards */}
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
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between relative overflow-hidden">
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
              </div>

              <div className="mt-2 h-10 w-full opacity-30 flex items-center justify-center pointer-events-none">
                <svg viewBox="0 0 300 120" className="w-full h-full stroke-orange-500 fill-orange-500/10">
                  <path d="M30 40 Q 50 30 70 45 T 110 50 T 150 40 T 190 60 T 230 45 T 270 55" strokeWidth="1.5" fill="none" strokeDasharray="3 3" />
                  <circle cx="60" cy="40" r="3" fill="#f97316" />
                  <circle cx="120" cy="50" r="3" fill="#f97316" />
                  <circle cx="180" cy="55" r="3" fill="#f97316" />
                  <circle cx="240" cy="45" r="3" fill="#f97316" />
                </svg>
              </div>
            </div>

            <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <button
                type="button"
                onClick={() => setColumnsModalOpen(true)}
                className="text-[10.5px] font-extrabold text-orange-600 hover:text-orange-700 flex items-center gap-1 hover:underline"
              >
                <span>{tt("sarh.show_details", "Show Details").toUpperCase()}</span>
                <span>{isRtl ? "←" : "→"}</span>
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="px-2 py-0.5 rounded border border-orange-200 text-orange-700 hover:bg-orange-50 dark:border-orange-800 dark:text-orange-300 text-[10px] font-bold flex items-center gap-1"
              >
                <span>{tt("sarh.explore", "Explore").toUpperCase()}</span>
                <ArrowUpRight className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>

        {/* 5. Country Performance Table Card */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
          <div className="border-b border-slate-200 bg-slate-50/70 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/80 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-lg bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-300 flex items-center justify-center font-bold">
                <FileText className="h-3.5 w-3.5" />
              </div>
              <div>
                <h2 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
                  {tt("sarh.country_performance_title", "Country Performance")}
                </h2>
                <p className="text-[10px] text-slate-400 font-medium">
                  {tt("sarh.country_performance_sub", "Country-wise branch and user coverage")}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 text-[10px] font-extrabold">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span>{tt("sarh.records_loaded", "Records Loaded")}</span>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setColumnsModalOpen(!columnsModalOpen)}
                className="h-8 px-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 gap-1.5"
              >
                <Columns3 className="h-3.5 w-3.5 text-slate-500" />
                <span>Columns</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleExportCsv}
                className="h-8 px-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 gap-1.5"
              >
                <Download className="h-3.5 w-3.5 text-slate-500" />
                <span>{t(lang, "common.export", "Export")}</span>
                <ChevronDown className="h-3 w-3 text-slate-400" />
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100/60 dark:border-slate-800 dark:bg-slate-900/90 text-[10px] font-black uppercase tracking-wider text-slate-500">
                  {visibleColumns.index && <th className="py-2.5 px-3 w-10 text-center">#</th>}
                  {visibleColumns.country && <th className="py-2.5 px-4 text-start">{tt("sarh.col_country", "Country")}</th>}
                  {visibleColumns.totalBranches && <th className="py-2.5 px-3 text-center">{tt("sarh.col_total_branches", "Total Branches")}</th>}
                  {visibleColumns.activeBranches && <th className="py-2.5 px-3 text-center">{tt("sarh.col_active_branches", "Active Branches")}</th>}
                  {visibleColumns.totalUsers && <th className="py-2.5 px-3 text-center">{tt("sarh.col_total_users", "Total Users")}</th>}
                  {visibleColumns.status && <th className="py-2.5 px-3 text-center">{t(lang, "common.status", "Status")}</th>}
                  {visibleColumns.actions && <th className="py-2.5 px-3 text-center">{t(lang, "common.actions", "Actions")}</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-xs text-slate-400">
                      {t(lang, "common.loading", "Loading...")}
                    </td>
                  </tr>
                ) : filteredCountryRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <div className="h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-1">
                          <svg className="w-6 h-6 stroke-slate-400 fill-none" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                          </svg>
                        </div>
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          {tt("sarh.no_data_found", "No data found")}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {tt("sarh.try_adjusting", "Try adjusting your filters or select a different time period.")}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredCountryRows.map((row, index) => (
                    <tr
                      key={row.id}
                      className="hover:bg-blue-50/40 dark:hover:bg-blue-950/20 transition-colors"
                    >
                      {visibleColumns.index && (
                        <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px]">
                          {index + 1}
                        </td>
                      )}
                      {visibleColumns.country && (
                        <td className="py-2.5 px-4 font-bold text-slate-850 dark:text-slate-100 flex items-center gap-2">
                          <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            {row.iso2}
                          </span>
                          <span>{row.name}</span>
                        </td>
                      )}
                      {visibleColumns.totalBranches && (
                        <td className="py-2.5 px-3 text-center font-mono font-bold">
                          {row.totalBranches}
                        </td>
                      )}
                      {visibleColumns.activeBranches && (
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-emerald-600">
                          {row.activeBranches}
                        </td>
                      )}
                      {visibleColumns.totalUsers && (
                        <td className="py-2.5 px-3 text-center font-mono text-slate-600 dark:text-slate-300">
                          {row.totalUsers}
                        </td>
                      )}
                      {visibleColumns.status && (
                        <td className="py-2.5 px-3 text-center">
                          <span className={cn(
                            "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border",
                            row.status === "ACTIVE"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300"
                              : "bg-slate-50 text-slate-500 border-slate-200"
                          )}>
                            {row.status === "ACTIVE" ? t(lang, "common.active", "Active").toUpperCase() : t(lang, "common.inactive", "Inactive").toUpperCase()}
                          </span>
                        </td>
                      )}
                      {visibleColumns.actions && (
                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCountryId(row.id);
                              window.scrollTo({ top: 0, behavior: "smooth" });
                            }}
                            className="px-2 py-1 rounded text-[10px] font-bold bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-950/50 dark:text-blue-300 transition"
                          >
                            {t(lang, "common.view", "View")}
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 6. Columns Manager Modal */}
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
                <label key={col} className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer text-xs">
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

      {/* 7. Footer */}
      <footer className="w-full border-t border-slate-200 bg-white/90 py-3 px-6 dark:border-slate-800 dark:bg-slate-900/90 text-[11px] text-slate-400 flex flex-wrap items-center justify-between gap-3 mt-8">
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
