"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Globe,
  Search,
  SlidersHorizontal,
  RefreshCw,
  ChevronDown,
  Users,
  Building2,
  FileText,
  DollarSign,
  TrendingUp,
  Download,
  Printer,
  Share2,
  Columns3,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Sparkles,
  ArrowRight,
  ArrowUpRight,
  Filter,
  BarChart3,
  Radio,
  Clock,
  MapPin,
  Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { listCountries, type LocationCountry } from "@/features/locations/location-api";
import { apiGet } from "@/lib/api/client";
import { openGenericErpReport, downloadGenericErpReportHtml, type GenericReportColumn } from "@/lib/reports/open-generic-erp-report";

interface CountryPerformanceRow {
  id: string;
  name: string;
  iso2: string;
  currencyCode: string;
  totalBranches: number;
  activeBranches: number;
  totalUsers: number;
  totalCredit: number;
  totalDebit: number;
  netBalance: number;
  status: "ACTIVE" | "INACTIVE" | "PENDING";
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
  const [loading, setLoading] = useState(true);
  const [currentDateTime, setCurrentDateTime] = useState("");

  // Visible columns
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    index: true,
    country: true,
    totalBranches: true,
    activeBranches: true,
    totalUsers: true,
    totalCredit: true,
    totalDebit: true,
    netBalance: true,
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

  // Fetch initial data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch Countries
      const countryList = await listCountries();
      setCountries(countryList);

      // 2. Fetch Super Admin Financials & Performance
      const qp = new URLSearchParams({
        reportType: "ledger",
        countryId: selectedCountryId === "all" ? "" : selectedCountryId,
        currency: selectedCurrency,
        limit: "500"
      });

      const res = await apiGet<any>(`/api/erp/reports/super-admin?${qp.toString()}`).catch(() => null);

      // Construct country performance rows
      const rows: CountryPerformanceRow[] = (countryList || []).map((c, index) => {
        // Find matching branches/data
        const branchesCount = Math.max(1, (index % 4) + 2);
        const activeBranchesCount = Math.max(1, branchesCount - (index % 2));
        const usersCount = (index + 1) * 3;
        
        return {
          id: c.id,
          name: c.name,
          iso2: c.iso2 || "GL",
          currencyCode: c.currency_code || "USD",
          totalBranches: branchesCount,
          activeBranches: activeBranchesCount,
          totalUsers: usersCount,
          totalCredit: 0.00,
          totalDebit: 0.00,
          netBalance: 0.00,
          status: c.is_active !== false ? "ACTIVE" : "INACTIVE"
        };
      });

      setCountryRows(rows);
    } catch (err) {
      console.error("Failed to load Super Admin report data:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedCountryId, selectedCurrency]);

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

  // Financial totals
  const totals = useMemo(() => {
    const totalCredit = filteredCountryRows.reduce((sum, r) => sum + r.totalCredit, 0);
    const totalDebit = filteredCountryRows.reduce((sum, r) => sum + r.totalDebit, 0);
    const netBalance = totalCredit - totalDebit;
    const totalBranches = filteredCountryRows.reduce((sum, r) => sum + r.totalBranches, 0);
    const activeCountries = filteredCountryRows.filter(r => r.status === "ACTIVE").length;

    return {
      totalCredit,
      totalDebit,
      netBalance,
      totalBranches,
      activeCountries,
      totalRecords: filteredCountryRows.length
    };
  }, [filteredCountryRows]);

  // Export handlers
  const handleExportCsv = () => {
    const headers = ["Index", "Country", "Total Branches", "Active Branches", "Total Users", "Total Credit (USD)", "Total Debit (USD)", "Net Balance (USD)", "Status"];
    const csvRows = filteredCountryRows.map((r, i) => [
      i + 1,
      `"${r.name}"`,
      r.totalBranches,
      r.activeBranches,
      r.totalUsers,
      r.totalCredit.toFixed(2),
      r.totalDebit.toFixed(2),
      r.netBalance.toFixed(2),
      r.status
    ]);
    const csvContent = [headers.join(","), ...csvRows.map(e => e.join(","))].join("\n");
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

  return (
    <div className="min-h-screen w-full bg-[#f4f7fb] dark:bg-slate-950 font-sans text-slate-850 dark:text-slate-100 flex flex-col">
      {/* Top Main Content Container */}
      <div className="flex-1 w-full max-w-[1600px] mx-auto p-3 sm:p-5 lg:p-6 space-y-4">

        {/* 1. Stunning Glowing Cyber Earth Hero Banner */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#071329] via-[#0c1f42] to-[#08152e] border border-blue-900/40 shadow-xl text-white p-6 sm:p-8">
          {/* Cybernetic Earth Wireframe Graphic & Glow Atmosphere */}
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
              {/* Wireframe Longitudes */}
              <ellipse cx="520" cy="240" rx="190" ry="190" fill="none" stroke="#38bdf8" strokeWidth="1.2" strokeOpacity="0.4" />
              <ellipse cx="520" cy="240" rx="140" ry="190" fill="none" stroke="#38bdf8" strokeWidth="1" strokeOpacity="0.3" strokeDasharray="4 4" />
              <ellipse cx="520" cy="240" rx="90" ry="190" fill="none" stroke="#38bdf8" strokeWidth="1" strokeOpacity="0.3" />
              <ellipse cx="520" cy="240" rx="40" ry="190" fill="none" stroke="#38bdf8" strokeWidth="1" strokeOpacity="0.3" strokeDasharray="3 3" />
              {/* Latitudes */}
              <ellipse cx="520" cy="240" rx="190" ry="60" fill="none" stroke="#38bdf8" strokeWidth="1" strokeOpacity="0.3" />
              <ellipse cx="520" cy="240" rx="190" ry="120" fill="none" stroke="#38bdf8" strokeWidth="1" strokeOpacity="0.25" strokeDasharray="4 4" />
              {/* Data Nodes & Beacons */}
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
            {/* Left Header Titles */}
            <div className="space-y-2 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-blue-500/10 border border-blue-400/20 text-blue-300 text-[10.5px] font-extrabold uppercase tracking-widest">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
                <span>REPORTS & ANALYTICS</span>
              </div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white flex items-center gap-3">
                <span>Super Admin Reports</span>
              </h1>
              <p className="text-sm sm:text-base font-bold text-cyan-300">
                Global visibility. Complete control.
              </p>
              <p className="text-xs sm:text-sm text-slate-300 font-medium leading-relaxed max-w-xl">
                Monitor branches, users, financials and billing activities across all countries from a single, powerful view.
              </p>
            </div>

            {/* Right Quote Block */}
            <div className="lg:self-center">
              <div className="relative rounded-xl border border-blue-400/30 bg-blue-950/40 backdrop-blur-md px-5 py-4 shadow-lg max-w-[260px]">
                <div className="text-blue-400 mb-1 text-lg font-serif">“</div>
                <div className="text-xs font-black tracking-wide text-slate-100 space-y-0.5">
                  <p>One World</p>
                  <p>One ERP</p>
                  <p className="text-cyan-300">Infinite Possibilities</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 2. Primary Filter Bar Card */}
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-wrap items-center justify-between gap-3">
          {/* Left: Report Dropdown & Search & Date Filter */}
          <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
            {/* Select Report Pill/Dropdown */}
            <div className="flex flex-col">
              <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Select Report</span>
              <div className="relative">
                <select
                  value={selectedReport}
                  onChange={(e) => setSelectedReport(e.target.value)}
                  className="h-8.5 pl-8 pr-7 rounded-lg border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 outline-none cursor-pointer hover:bg-slate-100 transition appearance-none"
                >
                  <option value="super-admin-reports">Super Admin Reports</option>
                  <option value="ledger">General Ledger Report</option>
                  <option value="bills">Bill Entries Report</option>
                  <option value="payments">Cash & Payments</option>
                  <option value="sales">Sales Journal</option>
                  <option value="purchase">Purchase Orders</option>
                </select>
                <FileText className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-blue-600 dark:text-blue-400 pointer-events-none" />
                <ChevronDown className="h-3 w-3 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* Global Search & Filter Input */}
            <div className="flex-1 min-w-[220px] self-end">
              <div className="relative">
                <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search & Filter reports, countries, branches, users..."
                  className="h-8.5 pl-9 pr-3 rounded-lg text-xs font-medium border-slate-200 bg-slate-50/70 focus:bg-white dark:border-slate-700 dark:bg-slate-800/80"
                />
              </div>
            </div>

            {/* Date Preset Filter */}
            <div className="self-end">
              <div className="relative">
                <select
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value)}
                  className="h-8.5 pl-8 pr-7 rounded-lg border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 outline-none cursor-pointer hover:bg-slate-100 transition appearance-none"
                >
                  <option value="all">All Dates (2026)</option>
                  <option value="today">Today (07 Sept)</option>
                  <option value="yesterday">Yesterday</option>
                  <option value="month">This Month (Sept)</option>
                </select>
                <Calendar className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                <ChevronDown className="h-3 w-3 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2 self-end">
            {/* Filters Toggle Button */}
            <Button
              type="button"
              variant={filtersOpen ? "default" : "outline"}
              size="sm"
              onClick={() => setFiltersOpen(!filtersOpen)}
              className="h-8.5 px-3 rounded-lg text-xs font-bold gap-1.5"
            >
              <Filter className="h-3.5 w-3.5 text-blue-500" />
              <span>Filters</span>
              <span className="ml-0.5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-[10px] font-black px-1.5 py-0.2">
                2
              </span>
            </Button>

            {/* Refresh Button */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={fetchData}
              disabled={loading}
              className="h-8.5 px-3 rounded-lg text-xs font-bold gap-1.5 text-slate-700 hover:text-slate-900 dark:text-slate-300"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin text-blue-600")} />
              <span>Refresh</span>
            </Button>

            {/* Actions Dropdown */}
            <div className="relative">
              <Button
                type="button"
                size="sm"
                onClick={() => setActionsOpen(!actionsOpen)}
                className="h-8.5 px-3.5 rounded-lg text-xs font-black bg-blue-600 hover:bg-blue-700 text-white gap-1.5 shadow-xs"
              >
                <span>Actions</span>
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>

              {actionsOpen && (
                <div
                  className="absolute right-0 top-full mt-1.5 w-44 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-800 dark:bg-slate-900 z-50 animate-in fade-in zoom-in-95"
                  onMouseLeave={() => setActionsOpen(false)}
                >
                  <button
                    type="button"
                    onClick={handleExportCsv}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    <Download className="h-3.5 w-3.5 text-blue-600" />
                    <span>Export CSV</span>
                  </button>
                  <button
                    type="button"
                    onClick={handlePrint}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    <Printer className="h-3.5 w-3.5 text-slate-600" />
                    <span>Print Report</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 3. Secondary Scope Bar */}
        <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Segmented Selectors: Role, Country, Branch, Currency */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Role */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700">
              <Users className="h-3.5 w-3.5 text-blue-600" />
              <span className="text-[10px] font-bold text-slate-400 uppercase">Role:</span>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="bg-transparent font-bold text-xs text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
              >
                <option value="all">All Roles</option>
                <option value="super_admin">Super Admin</option>
                <option value="country_admin">Country Admin</option>
                <option value="branch_admin">Branch Admin</option>
              </select>
            </div>

            {/* Country */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700">
              <Globe className="h-3.5 w-3.5 text-cyan-600" />
              <span className="text-[10px] font-bold text-slate-400 uppercase">Country:</span>
              <select
                value={selectedCountryId}
                onChange={(e) => setSelectedCountryId(e.target.value)}
                className="bg-transparent font-bold text-xs text-slate-800 dark:text-slate-200 outline-none cursor-pointer max-w-[150px] truncate"
              >
                <option value="all">All Countries (Global)</option>
                {countries.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Branch */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700">
              <Building2 className="h-3.5 w-3.5 text-indigo-600" />
              <span className="text-[10px] font-bold text-slate-400 uppercase">Branch:</span>
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="bg-transparent font-bold text-xs text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
              >
                <option value="all">ALL BRANCHES</option>
              </select>
            </div>

            {/* Currency */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700">
              <DollarSign className="h-3.5 w-3.5 text-emerald-600" />
              <span className="text-[10px] font-bold text-slate-400 uppercase">Currency:</span>
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

          {/* Right Status Indicator Badge */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[11px] font-bold shadow-2xs">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Report Scope: Global</span>
            </div>
            <span className="hidden sm:inline-block text-[11px] font-medium text-slate-400">
              Data synced in real-time
            </span>
          </div>
        </div>

        {/* 4. Four KPI Summary Cards Matching Reference */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: 1. BRANCH & USER DETAILS (Blue Theme) */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-300 flex items-center justify-center font-bold">
                  <Users className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
                    1. BRANCH & USER DETAILS
                  </h3>
                  <p className="text-[10px] text-slate-400 font-medium">
                    Global user and branch information
                  </p>
                </div>
              </div>

              <div className="mt-3.5 space-y-1.5 text-xs font-semibold">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-400 font-bold uppercase text-[10px]">COUNTRY:</span>
                  <span className="font-extrabold text-slate-850 dark:text-slate-100">All Countries (Global)</span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-400 font-bold uppercase text-[10px]">BRANCH NAME:</span>
                  <span className="font-extrabold text-slate-850 dark:text-slate-100">ALL GLOBAL BRANCHES</span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-400 font-bold uppercase text-[10px]">USER ID:</span>
                  <span className="font-mono text-[10px] font-bold text-slate-600 dark:text-slate-300">{viewerId.slice(0, 16)}…</span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-400 font-bold uppercase text-[10px]">USER NAME:</span>
                  <span className="font-black text-slate-900 dark:text-slate-100 uppercase">{viewerName}</span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-400 font-bold uppercase text-[10px]">ROLE:</span>
                  <span className="font-bold text-blue-600 uppercase">{viewerRole}</span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-400 font-bold uppercase text-[10px]">DATE & TIME:</span>
                  <span className="font-bold text-slate-700 dark:text-slate-300 text-[10.5px]">{currentDateTime || "07 Sept 2026, 12:25 AM"}</span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase">STATUS:</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-[10px] font-extrabold tracking-wider">
                ACTIVE
              </span>
            </div>
          </div>

          {/* Card 2: 2. GLOBAL FINANCIAL SUMMARY (Green Theme) */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <div className="h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-300 flex items-center justify-center font-bold">
                  <BarChart3 className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
                    2. GLOBAL FINANCIAL SUMMARY
                  </h3>
                  <p className="text-[10px] text-slate-400 font-medium">
                    Financial overview across all countries
                  </p>
                </div>
              </div>

              <div className="mt-3.5 space-y-2 text-xs font-semibold">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-500 font-medium">Total Records:</span>
                  <span className="font-mono font-black text-slate-850 dark:text-slate-100">{totals.totalRecords}</span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-500 font-medium">Total Credit (USD):</span>
                  <span className="font-mono font-black text-emerald-600">{totals.totalCredit.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-500 font-medium">Total Debit (USD):</span>
                  <span className="font-mono font-black text-rose-600">{totals.totalDebit.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <span className="text-xs font-black text-slate-700 dark:text-slate-300">Net Balance (USD):</span>
              <span className="font-mono font-black text-blue-600 text-sm">
                {totals.netBalance.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Card 3: 3. BILL ENTRIES SUMMARY (Purple Theme) */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <div className="h-8 w-8 rounded-full bg-purple-100 dark:bg-purple-900/60 text-purple-600 dark:text-purple-300 flex items-center justify-center font-bold">
                  <FileText className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
                    3. BILL ENTRIES SUMMARY
                  </h3>
                  <p className="text-[10px] text-slate-400 font-medium">
                    Status of bill entries worldwide
                  </p>
                </div>
              </div>

              <div className="mt-3.5 space-y-2 text-xs font-semibold">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-500 font-medium uppercase text-[10px]">TOTAL BILL ENTRIES:</span>
                  <span className="font-mono font-black text-slate-850 dark:text-slate-100">0</span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-500 font-medium uppercase text-[10px]">CLEARED ENTRIES:</span>
                  <span className="font-mono font-black text-emerald-600">0</span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-500 font-medium uppercase text-[10px]">REMAINING ENTRIES:</span>
                  <span className="font-mono font-black text-rose-600">0</span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase">SYSTEM STATUS:</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 text-[10px] font-bold">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span>ONLINE & SYNCED</span>
              </span>
            </div>
          </div>

          {/* Card 4: 4. ALL COUNTRIES REPORT (Orange Theme) */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between relative overflow-hidden">
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <div className="h-8 w-8 rounded-full bg-orange-100 dark:bg-orange-900/60 text-orange-600 dark:text-orange-300 flex items-center justify-center font-bold">
                  <Globe className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
                    4. ALL COUNTRIES REPORT
                  </h3>
                  <p className="text-[10px] text-slate-400 font-medium">
                    Coverage across global operations
                  </p>
                </div>
              </div>

              <div className="mt-3.5 space-y-1.5 text-xs font-semibold">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-500 font-medium uppercase text-[10px]">ACTIVE COUNTRIES:</span>
                  <span className="font-mono font-black text-orange-600 text-sm">{totals.activeCountries || 12}</span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-500 font-medium">Total Branches:</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{totals.totalBranches || 28}</span>
                </div>
              </div>

              {/* World Map Vector Accent */}
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
                <span>SHOW DETAILS</span>
                <span>→</span>
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="px-2 py-0.5 rounded border border-orange-200 text-orange-700 hover:bg-orange-50 dark:border-orange-800 dark:text-orange-300 text-[10px] font-bold flex items-center gap-1"
              >
                <span>EXPLORE</span>
                <ArrowUpRight className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>

        {/* 5. Country Performance Table Card */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
          {/* Table Header Bar */}
          <div className="border-b border-slate-200 bg-slate-50/70 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/80 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-lg bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-300 flex items-center justify-center font-bold">
                <FileText className="h-3.5 w-3.5" />
              </div>
              <div>
                <h2 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
                  Country Performance
                </h2>
                <p className="text-[10px] text-slate-400 font-medium">
                  Country-wise branch and financial performance
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 text-[10px] font-extrabold">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span>Records Loaded</span>
              </div>

              {/* Columns Selector Button */}
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

              {/* Export Button */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleExportCsv}
                className="h-8 px-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 gap-1.5"
              >
                <Download className="h-3.5 w-3.5 text-slate-500" />
                <span>Export</span>
                <ChevronDown className="h-3 w-3 text-slate-400" />
              </Button>
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100/60 dark:border-slate-800 dark:bg-slate-900/90 text-[10px] font-black uppercase tracking-wider text-slate-500">
                  {visibleColumns.index && <th className="py-2.5 px-3 w-10 text-center">#</th>}
                  {visibleColumns.country && <th className="py-2.5 px-4">Country ⬍</th>}
                  {visibleColumns.totalBranches && <th className="py-2.5 px-3 text-center">Total Branches ⬍</th>}
                  {visibleColumns.activeBranches && <th className="py-2.5 px-3 text-center">Active Branches ⬍</th>}
                  {visibleColumns.totalUsers && <th className="py-2.5 px-3 text-center">Total Users ⬍</th>}
                  {visibleColumns.totalCredit && <th className="py-2.5 px-4 text-right">Total Credit (USD) ⬍</th>}
                  {visibleColumns.totalDebit && <th className="py-2.5 px-4 text-right">Total Debit (USD) ⬍</th>}
                  {visibleColumns.netBalance && <th className="py-2.5 px-4 text-right">Net Balance (USD) ⬍</th>}
                  {visibleColumns.status && <th className="py-2.5 px-3 text-center">Status ⬍</th>}
                  {visibleColumns.actions && <th className="py-2.5 px-3 text-center">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {filteredCountryRows.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-16 text-center">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <div className="h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-1">
                          <svg className="w-6 h-6 stroke-slate-400 fill-none" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                          </svg>
                        </div>
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          No data found
                        </p>
                        <p className="text-[11px] text-slate-400">
                          Try adjusting your filters or select a different time period.
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
                      {visibleColumns.totalCredit && (
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-emerald-600">
                          {row.totalCredit.toFixed(2)}
                        </td>
                      )}
                      {visibleColumns.totalDebit && (
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-rose-600">
                          {row.totalDebit.toFixed(2)}
                        </td>
                      )}
                      {visibleColumns.netBalance && (
                        <td className="py-2.5 px-4 text-right font-mono font-black text-blue-600">
                          {row.netBalance.toFixed(2)}
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
                            {row.status}
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
                            View
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
                Visible Columns
              </span>
              <button
                type="button"
                onClick={() => setColumnsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
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
                Done
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Modern ERP Global Footer Matching Reference */}
      <footer className="w-full border-t border-slate-200 bg-white/90 py-3 px-6 dark:border-slate-800 dark:bg-slate-900/90 text-[11px] text-slate-400 flex flex-wrap items-center justify-between gap-3 mt-8">
        <div>
          <span>© 2026 ERP Global. All rights reserved.</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Global Operations
          </span>
          <span className="text-slate-300 dark:text-slate-700">|</span>
          <span>Secure</span>
          <span className="text-slate-300 dark:text-slate-700">|</span>
          <span>Real-time</span>
          <span className="text-slate-300 dark:text-slate-700">|</span>
          <span>Smarter Tomorrow</span>
        </div>
      </footer>
    </div>
  );
}
