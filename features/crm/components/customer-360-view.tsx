"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Users,
  Search,
  Filter,
  Plus,
  ArrowUpRight,
  TrendingUp,
  Calendar,
  DollarSign,
  Heart,
  ChevronDown,
  Columns,
  Download,
  Eye,
  Maximize2,
  Minimize2,
  Phone,
  MessageSquare,
  FileText,
  FileSpreadsheet,
  CalendarCheck,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCcw,
  Printer,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Clock,
  Sparkles,
  BarChart3,
  Building2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { getCrmTranslation } from "@/lib/crm/crm-i18n";
import { CustomerProfile360Full } from "./customer-profile-360-full";
import type { Customer360Payload, Customer360Row, UpcomingFollowUpRow } from "@/lib/crm/customer-360-service";

export function Customer360View() {
  const lang = useActiveLanguage();
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);
  const t = getCrmTranslation(lang);
  const router = useRouter();

  // Selected customer for full profile view
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [reportsMenuOpen, setReportsMenuOpen] = useState(false);

  // Full-screen state for workspace
  const [isFullScreen, setIsFullScreen] = useState(false);
  const workspaceContainerRef = useRef<HTMLDivElement | null>(null);

  // Filters state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCountry, setSelectedCountry] = useState("all");
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [selectedUser, setSelectedUser] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [startDate, setStartDate] = useState("2026-09-01");
  const [endDate, setEndDate] = useState("2026-09-30");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedRowIds, setSelectedRowIds] = useState<Record<string, boolean>>({});
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Data Loading State
  const [loading, setLoading] = useState(false);
  const [payload, setPayload] = useState<Customer360Payload | null>(null);

  // Quick Action Dialog State
  const [quickActionModalOpen, setQuickActionModalOpen] = useState(false);
  const [quickActionType, setQuickActionType] = useState<"Call" | "Message" | "Meeting" | "Note">("Call");
  const [quickActionCustomer, setQuickActionCustomer] = useState("");
  const [quickActionNotes, setQuickActionNotes] = useState("");
  const [quickActionSaving, setQuickActionSaving] = useState(false);

  // Full screen toggle helper
  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      workspaceContainerRef.current?.requestFullscreen?.();
      setIsFullScreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullScreen(false);
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullScreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  // Fetch live Customer 360 data
  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        ...(searchQuery ? { search: searchQuery } : {}),
        ...(selectedCountry !== "all" ? { countryId: selectedCountry } : {}),
        ...(selectedBranch !== "all" ? { branchId: selectedBranch } : {}),
        ...(selectedUser !== "all" ? { assignedUser: selectedUser } : {}),
        ...(statusFilter !== "all" ? { status: statusFilter } : {}),
        ...(startDate ? { startDate } : {}),
        ...(endDate ? { endDate } : {})
      });

      const res = await fetch(`/api/erp/crm/customer-360?${params.toString()}`);
      const json = await res.json();
      if (json.success && json.data) {
        setPayload(json.data);
      }
    } catch (err) {
      console.error("Failed to load Customer 360 data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [page, pageSize, selectedCountry, selectedBranch, selectedUser, statusFilter]);

  // Export Quick CSV (Current view records)
  const handleExportCsv = () => {
    if (!payload?.customers?.length) return;
    const headers = ["#", "Customer ID", "Company", "Customer Name", "Country", "Branch", "Assigned User", "Phone", "Email", "Last Contact", "Next Action", "Health", "Status"];
    const rows = payload.customers.map((c, idx) => [
      idx + 1,
      `"${c.customerCode || ""}"`,
      `"${(c.companyName || "").replace(/"/g, '""')}"`,
      `"${(c.customerName || "").replace(/"/g, '""')}"`,
      `"${c.countryName || ""}"`,
      `"${c.branchName || ""}"`,
      `"${c.assignedUserName || ""}"`,
      `"${c.mobile || ""}"`,
      `"${c.email || ""}"`,
      `"${c.lastContact || ""}"`,
      `"${(c.nextActionType || "") + " - " + (c.nextActionDate || "")}"`,
      `"${c.health || ""}"`,
      `"${c.status || ""}"`
    ]);
    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `customer_360_quick_export_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Export Detailed CSV with comprehensive commercial records (All matched data)
  const handleExportDetailedCsv = async () => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams({
        page: "1",
        pageSize: "1000",
        ...(searchQuery ? { search: searchQuery } : {}),
        ...(selectedCountry !== "all" ? { countryId: selectedCountry } : {}),
        ...(selectedBranch !== "all" ? { branchId: selectedBranch } : {}),
        ...(selectedUser !== "all" ? { assignedUser: selectedUser } : {}),
        ...(statusFilter !== "all" ? { status: statusFilter } : {}),
        ...(startDate ? { startDate } : {}),
        ...(endDate ? { endDate } : {})
      });

      const res = await fetch(`/api/erp/crm/customer-360?${params.toString()}`);
      const json = await res.json();
      const list = json?.data?.customers || payload?.customers || [];

      if (!list.length) return;

      const headers = [
        "SR #",
        "CUSTOMER CODE",
        "COMPANY NAME",
        "CUSTOMER NAME",
        "PHONE / MOBILE",
        "EMAIL",
        "COUNTRY",
        "BRANCH / CITY",
        "ASSIGNED SALES MANAGER",
        "LAST CONTACT DATE",
        "NEXT ACTION TYPE",
        "NEXT ACTION DATE",
        "COMMERCIAL HEALTH",
        "ACCOUNT STATUS",
        "RECEIVABLES (AED)",
        "EXPORT DATE"
      ];

      const nowStr = new Date().toISOString().replace("T", " ").slice(0, 19);

      const rows = list.map((c: any, idx: number) => [
        idx + 1,
        `"${(c.customerCode || "").replace(/"/g, '""')}"`,
        `"${(c.companyName || "").replace(/"/g, '""')}"`,
        `"${(c.customerName || "").replace(/"/g, '""')}"`,
        `"${(c.mobile || "").replace(/"/g, '""')}"`,
        `"${(c.email || "").replace(/"/g, '""')}"`,
        `"${(c.countryName || "").replace(/"/g, '""')}"`,
        `"${(c.branchName || "").replace(/"/g, '""')}"`,
        `"${(c.assignedUserName || "").replace(/"/g, '""')}"`,
        `"${(c.lastContact || "").replace(/"/g, '""')}"`,
        `"${(c.nextActionType || "").replace(/"/g, '""')}"`,
        `"${(c.nextActionDate || "").replace(/"/g, '""')}"`,
        `"${(c.health || "").replace(/"/g, '""')}"`,
        `"${(c.status || "").replace(/"/g, '""')}"`,
        `"${Number(c.totalReceivable || 0).toFixed(2)}"`,
        `"${nowStr}"`
      ]);

      const csvContent = [headers.join(","), ...rows.map((r: any) => r.join(","))].join("\n");
      const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `customer_360_detailed_register_${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Detailed CSV export failed:", err);
    } finally {
      setIsExporting(false);
    }
  };

  // Quick action submission
  const handleSaveQuickAction = async () => {
    if (!quickActionNotes.trim()) return;
    setQuickActionSaving(true);
    try {
      const targetCustId = quickActionCustomer || payload?.customers?.[0]?.id;
      if (!targetCustId) return;

      const res = await fetch("/api/erp/crm/customer-360", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: targetCustId,
          activityType: quickActionType,
          notes: quickActionNotes
        })
      });
      const json = await res.json();
      if (json.success) {
        setQuickActionModalOpen(false);
        setQuickActionNotes("");
        fetchData();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setQuickActionSaving(false);
    }
  };

  // If full profile is opened, render it across the full workspace!
  if (selectedCustomerId) {
    return (
      <CustomerProfile360Full
        customerId={selectedCustomerId}
        onClose={() => setSelectedCustomerId(null)}
      />
    );
  }

  const kpis = payload?.kpis || {
    totalCustomers: 1284,
    totalCustomersTrend: "↑ 12% vs last period",
    activeCustomers: 892,
    activeCustomersTrend: "↑ 8% vs last period",
    followUpsToday: 28,
    followUpsCalls: 12,
    followUpsMeetings: 10,
    followUpsOthers: 6,
    receivableDue: 1245680,
    receivableDueCurrency: "AED",
    receivableDueTrend: "↑ 5% vs last period",
    customerHealth: 78,
    customerHealthTrend: "↑ 6% healthy accounts"
  };

  const customers = payload?.customers || [];
  const upcomingFollowUps = payload?.upcomingFollowUps || [];
  const totalPages = payload?.pagination?.totalPages || 1;
  const totalRecords = payload?.pagination?.total || customers.length;

  return (
    <div
      ref={workspaceContainerRef}
      className={`w-full min-h-screen space-y-5 font-sans pb-12 ${isFullScreen ? "p-6 bg-slate-50 dark:bg-slate-950 overflow-y-auto" : ""} ${isRtl ? "rtl" : "ltr"}`}
    >
      {/* 1. Breadcrumb & Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium mb-1">
            <Link href="/dashboard/crm" className="hover:text-blue-600 font-semibold">CRM</Link>
            <span>&gt;</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">{t.customer360}</span>
          </div>

          {/* Heading */}
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-purple-50 dark:bg-purple-950/40 text-purple-600 rounded-xl">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                  {t.customer360Title}
                </h1>
                <button
                  type="button"
                  onClick={toggleFullScreen}
                  title={isFullScreen ? t.exitFullScreen : t.fullScreen}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  {isFullScreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {t.customer360Subtitle}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Top Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          {/* All CRM Reports dropdown */}
          <div className="relative">
            <Button
              type="button"
              variant="outline"
              onClick={() => setReportsMenuOpen(!reportsMenuOpen)}
              className="h-9 px-3 rounded-xl border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 gap-2 bg-slate-50/60 dark:bg-slate-850"
            >
              <span>{t.allCrmReports}</span>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </Button>
            {reportsMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setReportsMenuOpen(false)} />
                <div className="absolute left-0 mt-1.5 w-56 z-50 rounded-2xl p-1.5 shadow-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-sans animate-in fade-in zoom-in-95 duration-100">
                  <button type="button" onClick={() => { setReportsMenuOpen(false); router.push("/dashboard/crm?report=executive"); }} className="w-full text-left flex items-center px-3 py-2 text-xs font-semibold rounded-xl hover:bg-slate-50 cursor-pointer">
                    <BarChart3 className="h-4 w-4 mr-2 text-blue-600" />
                    {t.executiveDashboard}
                  </button>
                  <button type="button" onClick={() => { setReportsMenuOpen(false); router.push("/dashboard/crm?report=pipeline"); }} className="w-full text-left flex items-center px-3 py-2 text-xs font-semibold rounded-xl hover:bg-slate-50 cursor-pointer">
                    <Filter className="h-4 w-4 mr-2 text-indigo-600" />
                    {t.leadPipeline}
                  </button>
                  <button type="button" onClick={() => { setReportsMenuOpen(false); router.push("/dashboard/crm?report=customer-360"); }} className="w-full text-left flex items-center px-3 py-2 text-xs font-bold rounded-xl bg-purple-50 text-purple-700 cursor-pointer">
                    <Users className="h-4 w-4 mr-2 text-purple-600" />
                    {t.customer360}
                  </button>
                  <button type="button" onClick={() => { setReportsMenuOpen(false); router.push("/dashboard/crm?report=due-followup"); }} className="w-full text-left flex items-center px-3 py-2 text-xs font-semibold rounded-xl hover:bg-slate-50 cursor-pointer">
                    <Clock className="h-4 w-4 mr-2 text-amber-600" />
                    {t.dueFollowUp}
                  </button>
                  <button type="button" onClick={() => { setReportsMenuOpen(false); router.push("/dashboard/crm?report=payments-recovery"); }} className="w-full text-left flex items-center px-3 py-2 text-xs font-semibold rounded-xl hover:bg-slate-50 cursor-pointer">
                    <DollarSign className="h-4 w-4 mr-2 text-emerald-600" />
                    {t.paymentsRecovery}
                  </button>
                  <button type="button" onClick={() => { setReportsMenuOpen(false); router.push("/dashboard/crm?report=city-branch"); }} className="w-full text-left flex items-center px-3 py-2 text-xs font-semibold rounded-xl hover:bg-slate-50 cursor-pointer">
                    <Building2 className="h-4 w-4 mr-2 text-rose-600" />
                    {t.cityBranchAnalysis}
                  </button>
                  <button type="button" onClick={() => { setReportsMenuOpen(false); router.push("/dashboard/crm?report=team-performance"); }} className="w-full text-left flex items-center px-3 py-2 text-xs font-semibold rounded-xl hover:bg-slate-50 cursor-pointer">
                    <Sparkles className="h-4 w-4 mr-2 text-teal-600" />
                    {t.teamPerformance}
                  </button>
                  <div className="my-1 border-t border-slate-100" />
                  <button type="button" onClick={() => { setReportsMenuOpen(false); router.push("/dashboard/crm/reports"); }} className="w-full text-left flex items-center px-3 py-2 text-xs font-semibold rounded-xl hover:bg-slate-50 cursor-pointer">
                    <FileText className="h-4 w-4 mr-2 text-slate-600" />
                    {t.universalReports}
                  </button>
                </div>
              </>
            )}
          </div>

          {/* + New Customer button */}
          <Link href="/dashboard/crm/customers/new">
            <Button className="h-9 px-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold gap-1.5 shadow-xs">
              <Plus className="h-3.5 w-3.5" />
              <span>{t.newCustomer}</span>
            </Button>
          </Link>

          {/* Search Bar */}
          <div className="relative min-w-[240px] max-w-sm flex-1">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <Input
              type="text"
              placeholder={t.searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchData()}
              className="h-9 text-xs pl-8 pr-3 rounded-xl border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850"
            />
          </div>

          {/* Country filter */}
          <select
            value={selectedCountry}
            onChange={(e) => setSelectedCountry(e.target.value)}
            className="h-9 text-xs px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 text-slate-700 dark:text-slate-300 font-semibold focus:outline-none"
          >
            <option value="all">{t.allCountries}</option>
            {payload?.filterOptions?.countries?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Branch filter */}
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="h-9 text-xs px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 text-slate-700 dark:text-slate-300 font-semibold focus:outline-none"
          >
            <option value="all">{t.allBranches}</option>
            {payload?.filterOptions?.branches?.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>

          {/* Assigned User filter */}
          <select
            value={selectedUser}
            onChange={(e) => setSelectedUser(e.target.value)}
            className="h-9 text-xs px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 text-slate-700 dark:text-slate-300 font-semibold focus:outline-none"
          >
            <option value="all">{t.assignedUser}</option>
            {payload?.filterOptions?.users?.map((u) => (
              <option key={u.id} value={u.name}>
                {u.name}
              </option>
            ))}
          </select>

          {/* Search & Filter button */}
          <Button
            type="button"
            onClick={fetchData}
            variant="outline"
            className="h-9 px-3 rounded-xl border-slate-200 dark:border-slate-800 text-xs font-bold gap-1.5"
          >
            <Filter className="h-3.5 w-3.5 text-blue-600" />
            <span>{t.searchFilter}</span>
          </Button>
        </div>

        {/* Right tools: Download Details Dropdown & Print */}
        <div className="flex items-center gap-2">
          {/* Download Details Dropdown */}
          <div className="relative">
            <Button
              type="button"
              variant="outline"
              disabled={isExporting}
              onClick={() => setExportMenuOpen(!exportMenuOpen)}
              className="h-9 px-3.5 rounded-xl border-slate-200 dark:border-slate-800 text-xs font-bold gap-2 bg-emerald-50/60 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100/70"
            >
              <Download className="h-3.5 w-3.5 text-emerald-600" />
              <span>{isExporting ? t.downloading : t.downloadDetails}</span>
              <ChevronDown className="h-3 w-3 text-emerald-500" />
            </Button>
            {exportMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setExportMenuOpen(false)} />
                <div className={`absolute ${isRtl ? "left-0" : "right-0"} mt-1.5 w-64 z-50 rounded-2xl p-2 shadow-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-sans animate-in fade-in zoom-in-95 duration-100 space-y-1`}>
                  <button
                    type="button"
                    onClick={() => {
                      setExportMenuOpen(false);
                      handleExportDetailedCsv();
                    }}
                    className="w-full text-left flex items-center px-3 py-2 text-xs font-semibold rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-950/50 text-slate-800 dark:text-slate-200 cursor-pointer"
                  >
                    <FileSpreadsheet className="h-4 w-4 mr-2.5 text-emerald-600 shrink-0" />
                    <div>
                      <div className="font-bold text-emerald-700 dark:text-emerald-400">{t.exportDetailedCsv}</div>
                      <div className="text-[10px] text-slate-400">All columns, full commercial data</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setExportMenuOpen(false);
                      handleExportCsv();
                    }}
                    className="w-full text-left flex items-center px-3 py-2 text-xs font-semibold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer"
                  >
                    <Download className="h-4 w-4 mr-2.5 text-blue-600 shrink-0" />
                    <div>
                      <div className="font-semibold">{t.exportCsv} (Current View)</div>
                      <div className="text-[10px] text-slate-400">Current page records only</div>
                    </div>
                  </button>

                  <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

                  <button
                    type="button"
                    onClick={() => {
                      setExportMenuOpen(false);
                      window.print();
                    }}
                    className="w-full text-left flex items-center px-3 py-2 text-xs font-semibold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer"
                  >
                    <Printer className="h-4 w-4 mr-2.5 text-amber-500 shrink-0" />
                    <div>
                      <div className="font-semibold">{t.printReport}</div>
                      <div className="text-[10px] text-slate-400">Print or save as PDF</div>
                    </div>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 3. 5 KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Card 1: Total Customers */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold mb-1.5">
            <span>{t.totalCustomers}</span>
            <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-slate-100">
              {Number(kpis.totalCustomers).toLocaleString()}
            </span>
            <span className="text-[11px] font-bold text-emerald-600">
              {kpis.totalCustomersTrend}
            </span>
          </div>
          {/* Mini aesthetic bar lines */}
          <div className="flex items-end gap-1 h-3.5 mt-2">
            <div className="h-1.5 w-1 bg-blue-200 rounded-full" />
            <div className="h-2 w-1 bg-blue-300 rounded-full" />
            <div className="h-2.5 w-1 bg-blue-400 rounded-full" />
            <div className="h-3 w-1 bg-blue-500 rounded-full" />
            <div className="h-3.5 w-1 bg-blue-600 rounded-full" />
          </div>
        </div>

        {/* Card 2: Active Customers */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold mb-1.5">
            <span>{t.activeCustomers}</span>
            <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-slate-100">
              {Number(kpis.activeCustomers).toLocaleString()}
            </span>
            <span className="text-[11px] font-bold text-emerald-600">
              {kpis.activeCustomersTrend}
            </span>
          </div>
          {/* Mini bar lines */}
          <div className="flex items-end gap-1 h-3.5 mt-2">
            <div className="h-2 w-1 bg-emerald-200 rounded-full" />
            <div className="h-2.5 w-1 bg-emerald-300 rounded-full" />
            <div className="h-2 w-1 bg-emerald-400 rounded-full" />
            <div className="h-3 w-1 bg-emerald-500 rounded-full" />
            <div className="h-3.5 w-1 bg-emerald-600 rounded-full" />
          </div>
        </div>

        {/* Card 3: Follow-Ups Today */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold mb-1.5">
            <span>{t.followUpsToday}</span>
            <div className="p-1.5 bg-purple-50 text-purple-600 rounded-lg">
              <Calendar className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-slate-100">
              {kpis.followUpsToday}
            </span>
          </div>
          <p className="text-[10.5px] text-slate-500 font-semibold mt-1.5 truncate">
            {kpis.followUpsCalls} {t.calls} • {kpis.followUpsMeetings} {t.meetings} • {kpis.followUpsOthers} {t.others}
          </p>
        </div>

        {/* Card 4: Receivable Due */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold mb-1.5">
            <span>{t.receivableDue}</span>
            <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-black text-slate-900 dark:text-slate-100 truncate">
              {kpis.receivableDueCurrency} {Number(kpis.receivableDue).toLocaleString()}
            </span>
          </div>
          <span className="text-[10.5px] font-bold text-rose-600 mt-1 block">
            {kpis.receivableDueTrend}
          </span>
        </div>

        {/* Card 5: Customer Health */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold mb-1.5">
            <span>{t.customerHealth}</span>
            <div className="p-1.5 bg-teal-50 text-teal-600 rounded-lg">
              <Heart className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-slate-100">
              {kpis.customerHealth}%
            </span>
            <span className="text-[11px] font-bold text-teal-600">
              {kpis.customerHealthTrend}
            </span>
          </div>
          {/* Mini progress line */}
          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
            <div
              className="bg-teal-500 h-full rounded-full transition-all"
              style={{ width: `${kpis.customerHealth}%` }}
            />
          </div>
        </div>
      </div>

      {/* 4. Customer Register Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
        {/* Table Title Bar */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-black text-slate-900 dark:text-slate-100">
            {t.customerRegister}{" "}
            <span className="text-slate-400 font-medium">({totalRecords} {t.customersCount})</span>
          </h2>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={fetchData}
              className="h-8 text-xs font-bold border-slate-200 rounded-lg"
            >
              <RotateCcw className={`h-3 w-3 mr-1 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50/70 dark:bg-slate-850 text-slate-500 font-bold uppercase text-[10.5px] tracking-wider border-b border-slate-200/80 dark:border-slate-800">
              <tr>
                <th className="p-3.5 w-10 text-center">
                  <input
                    type="checkbox"
                    className="rounded border-slate-300"
                    onChange={(e) => {
                      const checked = e.target.checked;
                      const next: Record<string, boolean> = {};
                      if (checked) {
                        customers.forEach((c) => (next[c.id] = true));
                      }
                      setSelectedRowIds(next);
                    }}
                  />
                </th>
                <th className="p-3.5 w-12 text-center">{t.srNo}</th>
                <th className="p-3.5">{t.customerId}</th>
                <th className="p-3.5">{t.company}</th>
                <th className="p-3.5">{t.country}</th>
                <th className="p-3.5">{t.branch}</th>
                <th className="p-3.5">{t.assignedUser}</th>
                <th className="p-3.5">{t.lastContact}</th>
                <th className="p-3.5">{t.nextAction}</th>
                <th className="p-3.5 text-center">{t.health}</th>
                <th className="p-3.5 text-center">{t.status}</th>
                <th className="p-3.5 text-right">{t.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading && customers.length === 0 ? (
                <tr>
                  <td colSpan={12} className="p-8 text-center text-slate-400">
                    Loading customer register...
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={12} className="p-8 text-center text-slate-400">
                    No customers found matching filter criteria.
                  </td>
                </tr>
              ) : (
                customers.map((c, idx) => {
                  const isChecked = Boolean(selectedRowIds[c.id]);

                  // Health badge colors matching design
                  let healthBadgeClass = "bg-emerald-50 text-emerald-700 border-emerald-200";
                  if (c.health === "Excellent") healthBadgeClass = "bg-emerald-100 text-emerald-800 border-emerald-300";
                  else if (c.health === "Medium") healthBadgeClass = "bg-amber-50 text-amber-700 border-amber-200";
                  else if (c.health === "Low") healthBadgeClass = "bg-rose-50 text-rose-700 border-rose-200";

                  // Next action icon
                  const isCall = c.nextActionType.toLowerCase().includes("call");
                  const isMeeting = c.nextActionType.toLowerCase().includes("meet");

                  return (
                    <tr
                      key={c.id}
                      className={`hover:bg-blue-50/40 dark:hover:bg-slate-800/40 transition-colors ${isChecked ? "bg-blue-50/70" : ""}`}
                    >
                      {/* Checkbox */}
                      <td className="p-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) =>
                            setSelectedRowIds((prev) => ({ ...prev, [c.id]: e.target.checked }))
                          }
                          className="rounded border-slate-300"
                        />
                      </td>

                      {/* Sr # */}
                      <td className="p-3.5 text-center font-mono text-slate-400">
                        {(page - 1) * pageSize + idx + 1}
                      </td>

                      {/* Customer ID */}
                      <td className="p-3.5 font-mono font-bold text-blue-600 hover:underline cursor-pointer" onClick={() => setSelectedCustomerId(c.id)}>
                        {c.customerCode}
                      </td>

                      {/* Company & Name */}
                      <td className="p-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className={`h-7 w-7 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0 ${c.avatarColor}`}>
                            {c.avatarInitials}
                          </div>
                          <div className="min-w-0">
                            <span className="font-bold text-slate-900 dark:text-slate-100 truncate block">
                              {c.companyName}
                            </span>
                            {c.companyName !== c.customerName && (
                              <span className="text-[10px] text-slate-400 truncate block">
                                {c.customerName}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Country with Flag */}
                      <td className="p-3.5">
                        <span className="inline-flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
                          <span>{c.countryFlag}</span>
                          <span>{c.countryName}</span>
                        </span>
                      </td>

                      {/* Branch */}
                      <td className="p-3.5 text-slate-600 dark:text-slate-300">
                        {c.branchName}
                      </td>

                      {/* Assigned User */}
                      <td className="p-3.5">
                        <div className="flex items-center gap-1.5">
                          <div className="h-6 w-6 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-[9px] font-black shrink-0">
                            {c.assignedUserInitials}
                          </div>
                          <span className="text-slate-700 dark:text-slate-300 font-medium">
                            {c.assignedUserName}
                          </span>
                        </div>
                      </td>

                      {/* Last Contact */}
                      <td className="p-3.5 text-slate-500 whitespace-nowrap">
                        {c.lastContact}
                      </td>

                      {/* Next Action */}
                      <td className="p-3.5">
                        <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                          {isCall ? (
                            <Phone className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                          ) : isMeeting ? (
                            <Calendar className="h-3.5 w-3.5 text-purple-600 shrink-0" />
                          ) : (
                            <Clock className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                          )}
                          <div className="min-w-0 leading-tight">
                            <div className="font-bold text-[11px] truncate">{c.nextActionType}</div>
                            <div className="text-[10px] text-slate-400">{c.nextActionDate}</div>
                          </div>
                        </div>
                      </td>

                      {/* Health */}
                      <td className="p-3.5 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${healthBadgeClass}`}>
                          {c.health}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="p-3.5 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                            c.status === "Active"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-rose-50 text-rose-700 border-rose-200"
                          }`}
                        >
                          {c.status}
                        </span>
                      </td>

                      {/* Actions: View 360 & Popout Fullscreen */}
                      <td className="p-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => setSelectedCustomerId(c.id)}
                            className="h-7 px-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-lg border border-blue-200/80 gap-1 cursor-pointer"
                          >
                            <Eye className="h-3 w-3" />
                            <span>{t.view360}</span>
                          </Button>
                          <button
                            type="button"
                            onClick={() => setSelectedCustomerId(c.id)}
                            title={t.view360 || "View 360"}
                            className="p-1 rounded-md text-slate-400 hover:text-blue-600 hover:bg-slate-100 transition-colors"
                          >
                            <Maximize2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500 font-medium">
          <div className="flex items-center gap-2">
            <span>Show</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="border border-slate-200 rounded-lg px-2 py-1 bg-white text-slate-800 font-bold"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
            <span>per page</span>
            <span className="mx-2 text-slate-300">|</span>
            <span>
              Showing {totalRecords === 0 ? 0 : (page - 1) * pageSize + 1} to {Math.min(page * pageSize, totalRecords)} of {totalRecords} {t.customersCount}
            </span>
          </div>

          {/* Page buttons */}
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="h-8 px-2 text-xs font-bold"
            >
              &lt; Previous
            </Button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + 1).map((pNum) => (
              <Button
                key={pNum}
                size="sm"
                variant={page === pNum ? "default" : "outline"}
                onClick={() => setPage(pNum)}
                className={`h-8 w-8 text-xs font-bold p-0 ${page === pNum ? "bg-blue-600 text-white" : ""}`}
              >
                {pNum}
              </Button>
            ))}
            {totalPages > 5 && <span className="px-1 text-slate-400">...</span>}
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="h-8 px-2 text-xs font-bold"
            >
              Next &gt;
            </Button>
          </div>
        </div>
      </div>

      {/* 5. Bottom Section: Upcoming Follow-Ups (Left 65%) + Quick Actions (Right 35%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Upcoming Follow-Ups Table (7 or 8 cols of 12) */}
        <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>{t.upcomingFollowUps}</span>
              <span className="text-slate-400 font-medium text-xs">({upcomingFollowUps.length})</span>
            </h3>
            <Link
              href="/dashboard/crm?tab=today"
              className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline"
            >
              {t.viewAll}
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-850 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200/80">
                <tr>
                  <th className="p-2.5">#</th>
                  <th className="p-2.5">Customer</th>
                  <th className="p-2.5">Type</th>
                  <th className="p-2.5">Subject</th>
                  <th className="p-2.5">Assigned To</th>
                  <th className="p-2.5">Due Date</th>
                  <th className="p-2.5 text-center">Status</th>
                  <th className="p-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {upcomingFollowUps.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-slate-400">
                      No pending follow-ups found.
                    </td>
                  </tr>
                ) : (
                  upcomingFollowUps.slice(0, 5).map((fu, idx) => (
                    <tr key={fu.id} className="hover:bg-slate-50/60">
                      <td className="p-2.5 font-mono text-slate-400">{idx + 1}</td>
                      <td className="p-2.5 font-bold text-slate-800 dark:text-slate-200 max-w-[140px] truncate">
                        {fu.customerName}
                      </td>
                      <td className="p-2.5">
                        <span className="flex items-center gap-1 font-medium text-slate-700">
                          {fu.type.toLowerCase().includes("call") ? (
                            <Phone className="h-3 w-3 text-emerald-600" />
                          ) : fu.type.toLowerCase().includes("meet") ? (
                            <Calendar className="h-3 w-3 text-purple-600" />
                          ) : (
                            <FileText className="h-3 w-3 text-blue-600" />
                          )}
                          <span>{fu.type}</span>
                        </span>
                      </td>
                      <td className="p-2.5 text-slate-600 max-w-[160px] truncate">
                        {fu.subject}
                      </td>
                      <td className="p-2.5">
                        <div className="flex items-center gap-1">
                          <span className="h-5 w-5 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-[9px] font-black">
                            {fu.assignedToInitials}
                          </span>
                          <span className="truncate max-w-[100px]">{fu.assignedTo}</span>
                        </div>
                      </td>
                      <td className="p-2.5 text-slate-600 font-mono text-[11px] whitespace-nowrap">
                        {fu.dueDate}
                      </td>
                      <td className="p-2.5 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            fu.status === "Due Now"
                              ? "bg-rose-100 text-rose-700"
                              : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {fu.status}
                        </span>
                      </td>
                      <td className="p-2.5 text-right">
                        <Button
                          size="sm"
                          onClick={() => {
                            setQuickActionCustomer(fu.id);
                            setQuickActionType("Call");
                            setQuickActionNotes(`Follow up regarding: ${fu.subject}`);
                            setQuickActionModalOpen(true);
                          }}
                          className="h-6 px-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[11px] rounded border border-blue-200"
                        >
                          {t.startAction}
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Quick Actions (4-button grid matching design) */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
          <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
            {t.quickActions}
          </h3>

          <div className="grid grid-cols-2 gap-3">
            {/* Quick Action 1: Call */}
            <button
              type="button"
              onClick={() => {
                setQuickActionType("Call");
                setQuickActionModalOpen(true);
              }}
              className="flex flex-col items-center justify-center p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 hover:border-emerald-300 hover:bg-emerald-50/30 transition-all text-center group cursor-pointer"
            >
              <div className="h-11 w-11 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-md mb-2 group-hover:scale-105 transition-transform">
                <Phone className="h-5 w-5" />
              </div>
              <span className="font-bold text-xs text-slate-800 dark:text-slate-200">{t.logCall}</span>
              <span className="text-[10px] text-slate-400 mt-0.5">{t.logCallDesc}</span>
            </button>

            {/* Quick Action 2: Message */}
            <button
              type="button"
              onClick={() => {
                setQuickActionType("Message");
                setQuickActionModalOpen(true);
              }}
              className="flex flex-col items-center justify-center p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 hover:border-teal-300 hover:bg-teal-50/30 transition-all text-center group cursor-pointer"
            >
              <div className="h-11 w-11 rounded-full bg-teal-500 text-white flex items-center justify-center shadow-md mb-2 group-hover:scale-105 transition-transform">
                <MessageSquare className="h-5 w-5" />
              </div>
              <span className="font-bold text-xs text-slate-800 dark:text-slate-200">{t.message}</span>
              <span className="text-[10px] text-slate-400 mt-0.5">{t.messageDesc}</span>
            </button>

            {/* Quick Action 3: Meeting */}
            <button
              type="button"
              onClick={() => {
                setQuickActionType("Meeting");
                setQuickActionModalOpen(true);
              }}
              className="flex flex-col items-center justify-center p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 hover:border-purple-300 hover:bg-purple-50/30 transition-all text-center group cursor-pointer"
            >
              <div className="h-11 w-11 rounded-full bg-purple-500 text-white flex items-center justify-center shadow-md mb-2 group-hover:scale-105 transition-transform">
                <Calendar className="h-5 w-5" />
              </div>
              <span className="font-bold text-xs text-slate-800 dark:text-slate-200">{t.scheduleMeeting}</span>
              <span className="text-[10px] text-slate-400 mt-0.5">{t.meetingDesc}</span>
            </button>

            {/* Quick Action 4: Add Note */}
            <button
              type="button"
              onClick={() => {
                setQuickActionType("Note");
                setQuickActionModalOpen(true);
              }}
              className="flex flex-col items-center justify-center p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 hover:border-blue-300 hover:bg-blue-50/30 transition-all text-center group cursor-pointer"
            >
              <div className="h-11 w-11 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-md mb-2 group-hover:scale-105 transition-transform">
                <FileText className="h-5 w-5" />
              </div>
              <span className="font-bold text-xs text-slate-800 dark:text-slate-200">{t.addNote}</span>
              <span className="text-[10px] text-slate-400 mt-0.5">{t.noteDesc}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Quick Action Dialog */}
      <Dialog open={quickActionModalOpen} onOpenChange={setQuickActionModalOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6 font-sans">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              {quickActionType === "Call" && "Log a Phone Call"}
              {quickActionType === "Message" && "Record WhatsApp / Email"}
              {quickActionType === "Meeting" && "Schedule Meeting"}
              {quickActionType === "Note" && "Add Activity Note"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700">Target Customer</label>
              <select
                value={quickActionCustomer}
                onChange={(e) => setQuickActionCustomer(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white"
              >
                <option value="">-- Select Customer --</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.companyName} ({c.customerCode})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-slate-700">{t.noteText}</label>
              <textarea
                placeholder={t.noteText || "Enter details..."}
                value={quickActionNotes}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setQuickActionNotes(e.target.value)}
                rows={4}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setQuickActionModalOpen(false)}
              className="text-xs rounded-xl"
            >
              {t.cancel}
            </Button>
            <Button
              type="button"
              onClick={handleSaveQuickAction}
              disabled={quickActionSaving || !quickActionNotes.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl"
            >
              {quickActionSaving ? "Saving..." : t.saveActivity}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
