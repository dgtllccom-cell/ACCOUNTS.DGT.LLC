"use client";

import React, { useState, useEffect } from "react";
import {
  History,
  Clock,
  ShieldAlert,
  RotateCcw,
  Globe,
  Building2,
  Download,
  FileText,
  RefreshCw,
  Search,
  Filter,
  Eye,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Sparkles,
  Layers,
  Calendar,
  User,
  ShieldCheck,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErpDatePicker } from "@/components/ui/erp-date-picker";
import { Badge } from "@/components/ui/badge";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";
import { downloadCsv } from "@/features/branches/components/branch-report-export";
import { openScopedGenericReport } from "@/lib/reports/open-scoped-report";
import { VersionComparisonModal } from "./version-comparison-modal";

interface EditHistoryRow {
  entity_type: string;
  entity_id: string;
  reference_no?: string;
  module: string;
  country_id?: string;
  country_name?: string;
  city_branch_id?: string;
  branch_name?: string;
  party_name?: string;
  amount?: number;
  currency?: string;
  user_id: string;
  user_name: string;
  user_role: string;
  reason?: string;
  risk_level: "High" | "Medium" | "Low";
  approval_status: "Pending" | "Approved" | "Rejected";
  approval_reference?: string;
  edit_access_window?: string;
  ip_address?: string;
  device_session?: string;
  session_id?: string;
  version_number: number;
  total_versions: number;
  edit_count: number;
  original_created_at: string;
  created_at: string;
}

export function AllEditVersionHistoryView() {
  const lang = useActiveLanguage();
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);

  // Filters
  const [selectedCountry, setSelectedCountry] = useState("all");
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [selectedModule, setSelectedModule] = useState("all");
  const [selectedUser, setSelectedUser] = useState("all");
  const [selectedRisk, setSelectedRisk] = useState("all");
  const [selectedApprovalStatus, setSelectedApprovalStatus] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Data & Pagination
  const [records, setRecords] = useState<EditHistoryRow[]>([]);
  const [kpis, setKpis] = useState({
    editsToday: 0,
    pendingApprovals: 0,
    highRiskChanges: 0,
    expiredAccess: 0,
    totalCountries: 0,
    totalBranches: 0
  });
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [loading, setLoading] = useState(false);

  // Timeline / Compare Dialog
  const [compareModalOpen, setCompareModalOpen] = useState(false);
  const [selectedRowTimeline, setSelectedRowTimeline] = useState<any[]>([]);
  const [selectedRowRecord, setSelectedRowRecord] = useState<any>(null);

  // Dynamic dropdown options
  const [countriesList, setCountriesList] = useState<any[]>([]);
  const [branchesList, setBranchesList] = useState<any[]>([]);

  useEffect(() => {
    fetchFilterOptions();
  }, []);

  useEffect(() => {
    fetchRecords();
  }, [currentPage, pageSize, selectedCountry, selectedBranch, selectedModule, selectedRisk, selectedApprovalStatus]);

  async function fetchFilterOptions() {
    try {
      const [cRes, bRes] = await Promise.allSettled([
        fetch("/api/erp/locations/countries").then(r => r.json()),
        fetch("/api/erp/locations/branches/city?scope=all").then(r => r.json())
      ]);
      if (cRes.status === "fulfilled" && cRes.value?.countries) {
        setCountriesList(cRes.value.countries);
      }
      if (bRes.status === "fulfilled" && bRes.value?.data?.branches) {
        setBranchesList(bRes.value.data.branches);
      }
    } catch (_) {}
  }

  async function fetchRecords() {
    setLoading(true);
    try {
      const offset = (currentPage - 1) * pageSize;
      const qp = new URLSearchParams({
        limit: String(pageSize),
        offset: String(offset)
      });
      if (selectedCountry !== "all") qp.set("countryId", selectedCountry);
      if (selectedBranch !== "all") qp.set("cityBranchId", selectedBranch);
      if (selectedModule !== "all") qp.set("module", selectedModule);
      if (selectedUser !== "all") qp.set("user", selectedUser);
      if (selectedRisk !== "all") qp.set("riskLevel", selectedRisk);
      if (selectedApprovalStatus !== "all") qp.set("approvalStatus", selectedApprovalStatus);
      if (fromDate) qp.set("fromDate", fromDate);
      if (toDate) qp.set("toDate", toDate);
      if (searchQuery.trim()) qp.set("search", searchQuery.trim());

      const res = await fetch(`/api/erp/audit/edit-history?${qp.toString()}`);
      const data = await res.json();
      if (data.success) {
        setRecords(data.records || []);
        setTotalCount(data.total || 0);
        if (data.kpis) setKpis(data.kpis);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleOpenVersionHistory(row: EditHistoryRow) {
    try {
      const res = await fetch(`/api/erp/audit/version-timeline?entityType=${encodeURIComponent(row.entity_type)}&entityId=${encodeURIComponent(row.entity_id)}`);
      const data = await res.json();
      if (data.success && data.timeline) {
        setSelectedRowTimeline(data.timeline);
        setSelectedRowRecord(row);
        setCompareModalOpen(true);
      }
    } catch (e) {
      console.error("Failed to load timeline", e);
    }
  }

  function handleResetFilters() {
    setSelectedCountry("all");
    setSelectedBranch("all");
    setSelectedModule("all");
    setSelectedUser("all");
    setSelectedRisk("all");
    setSelectedApprovalStatus("all");
    setFromDate("");
    setToDate("");
    setSearchQuery("");
    setCurrentPage(1);
  }

  function handleExportCsv() {
    if (!records.length) return;
    const headers = [
      "#",
      t(lang, "audit.bill_ref_no", "Bill / Ref No"),
      t(lang, "audit.filter_module", "Module"),
      t(lang, "audit.filter_country", "Country"),
      t(lang, "audit.filter_branch", "Branch"),
      t(lang, "audit.party", "Party"),
      t(lang, "audit.total_edits", "Total Edits"),
      t(lang, "audit.original_date", "Original Date"),
      t(lang, "audit.last_edited_at", "Last Edited At"),
      t(lang, "audit.th_edited_by", "Last Edited By"),
      t(lang, "audit.risk_level", "Risk Level"),
      t(lang, "audit.approval_status", "Approval Status"),
    ];
    const exportRows = records.map((r, i) => [
      String(i + 1),
      String(r.reference_no || r.entity_id || ""),
      String(r.module || ""),
      String(r.country_name || "—"),
      String(r.branch_name || "—"),
      String(r.party_name || "-"),
      String(r.edit_count || 1),
      new Date(r.original_created_at).toLocaleString(),
      new Date(r.created_at).toLocaleString(),
      `${r.user_name} (${r.user_role})`,
      String(r.risk_level || ""),
      String(r.approval_status || "")
    ]);
    downloadCsv(`all_edit_version_history_${new Date().toISOString().split("T")[0]}.csv`, [headers, ...exportRows]);
  }

  function handlePrint() {
    void openScopedGenericReport({
      title: t(lang, "audit.edit_history_title", "All Edit / Version History — All Countries & Branches"),
      lang,
      orientation: "landscape",
      columns: [
        { key: (r) => r.reference_no || r.entity_id || "", label: t(lang, "audit.bill_ref_no", "Bill / Ref No") },
        { key: "module", label: t(lang, "audit.filter_module", "Module") },
        { key: (r) => r.country_name || "—", label: t(lang, "audit.filter_country", "Country") },
        { key: (r) => r.branch_name || "-", label: t(lang, "audit.filter_branch", "Branch") },
        { key: (r) => r.party_name || "-", label: t(lang, "audit.party", "Party") },
        { key: (r) => r.edit_count || 1, label: t(lang, "audit.total_edits", "Total Edits"), align: "right" },
        { key: "original_created_at", label: t(lang, "audit.original_date", "Original Date"), format: "date" },
        { key: "created_at", label: t(lang, "audit.last_edited_at", "Last Edited At"), format: "date" },
        { key: (r) => `${r.user_name} (${r.user_role})`, label: t(lang, "audit.th_edited_by", "Last Edited By") },
        { key: "risk_level", label: t(lang, "audit.risk_level", "Risk Level"), format: "status" },
        { key: "approval_status", label: t(lang, "audit.approval_status", "Approval Status"), format: "status" },
      ],
      rows: records as unknown as Record<string, unknown>[],
    });
  }

  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  return (
    <div className="mx-auto w-full max-w-[1720px] p-4 lg:p-6 space-y-6 font-sans antialiased text-slate-900 dark:text-slate-100" dir={isRtl ? "rtl" : "ltr"}>
      
      {/* ── HEADER STRIP ── */}
      <header className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-black text-slate-950 dark:text-white tracking-tight flex items-center gap-2.5">
            <History className="h-6 w-6 text-blue-600" />
            <span>{t(lang, "audit.edit_history_title", "All Edit / Version History — All Countries & Branches")}</span>
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-1">
            {t(lang, "audit.edit_history_subtitle", "Enterprise version control, immutable before/after field comparisons, and Super Admin audit trails")}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 h-9 px-3.5 border-slate-200 dark:border-slate-700 font-bold text-xs hover:bg-slate-50"
          >
            <Download className="h-4 w-4 text-slate-600" />
            <span>{t(lang, "audit.export_csv", "Export CSV")}</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={handlePrint}
            className="flex items-center gap-1.5 h-9 px-3.5 border-slate-200 dark:border-slate-700 font-bold text-xs hover:bg-slate-50"
          >
            <FileText className="h-4 w-4 text-blue-600" />
            <span>{t(lang, "audit.audit_pdf", "Audit PDF")}</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={fetchRecords}
            className="flex items-center gap-1.5 h-9 px-3 border-slate-200 dark:border-slate-700 font-bold text-xs"
            title={t(lang, "audit.refresh", "Refresh")}
          >
            <RefreshCw className={`h-4 w-4 text-slate-600 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">{t(lang, "audit.refresh", "Refresh")}</span>
          </Button>
        </div>
      </header>

      {/* ── 6 KPI SUMMARY CARDS ── */}
      <section className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 gap-3.5">
        
        {/* KPI 1: Edits Today */}
        <Card className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs hover:shadow-md transition">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                {t(lang, "audit.kpi_edits_today", "Edits Today")}
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                {kpis.editsToday.toLocaleString()}
              </div>
            </div>
            <div className="h-11 w-11 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center shadow-xs">
              <History className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* KPI 2: Pending Approvals */}
        <Card className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs hover:shadow-md transition">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                {t(lang, "audit.kpi_pending_approvals", "Pending Approvals")}
              </div>
              <div className="text-2xl font-black text-amber-600 mt-1">
                {kpis.pendingApprovals.toLocaleString()}
              </div>
              <div className="flex items-center gap-1 text-[10.5px] font-semibold text-amber-600 mt-1">
                <Clock className="h-3 w-3" />
                <span>{t(lang, "audit.requires_review", "Requires Review")}</span>
              </div>
            </div>
            <div className="h-11 w-11 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center shadow-xs">
              <Clock className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* KPI 3: High-Risk Changes */}
        <Card className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs hover:shadow-md transition">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                {t(lang, "audit.kpi_high_risk_changes", "High-Risk Changes")}
              </div>
              <div className="text-2xl font-black text-rose-700 mt-1">
                {kpis.highRiskChanges.toLocaleString()}
              </div>
              <div className="flex items-center gap-1 text-[10.5px] font-semibold text-rose-600 mt-1">
                <ShieldAlert className="h-3 w-3" />
                <span>{t(lang, "audit.financial_account_diffs", "Financial / Account diffs")}</span>
              </div>
            </div>
            <div className="h-11 w-11 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-700 flex items-center justify-center shadow-xs">
              <ShieldAlert className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* KPI 4: Expired Access */}
        <Card className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs hover:shadow-md transition">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                {t(lang, "audit.kpi_expired_access", "Expired Access")}
              </div>
              <div className="text-2xl font-black text-slate-700 dark:text-slate-300 mt-1">
                {kpis.expiredAccess.toLocaleString()}
              </div>
              <div className="text-[10.5px] font-medium text-slate-400 mt-1">
                {t(lang, "audit.window_closed", "Window closed")}
              </div>
            </div>
            <div className="h-11 w-11 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 flex items-center justify-center shadow-xs">
              <RotateCcw className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* KPI 5: Countries */}
        <Card className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs hover:shadow-md transition">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                {t(lang, "audit.kpi_countries", "Countries")}
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                {kpis.totalCountries}
              </div>
              <div className="text-[10.5px] font-medium text-slate-400 mt-1">
                {t(lang, "audit.all_operating_countries", "All operating countries")}
              </div>
            </div>
            <div className="h-11 w-11 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center shadow-xs">
              <Globe className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* KPI 6: Branches */}
        <Card className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs hover:shadow-md transition">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                {t(lang, "audit.kpi_branches", "Branches")}
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                {kpis.totalBranches}
              </div>
              <div className="text-[10.5px] font-medium text-slate-400 mt-1">
                {t(lang, "audit.all_offices_branches", "All offices / branches")}
              </div>
            </div>
            <div className="h-11 w-11 rounded-2xl bg-teal-50 dark:bg-teal-950/40 text-teal-600 flex items-center justify-center shadow-xs">
              <Building2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ── COMPREHENSIVE FILTER BAR ── */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
          
          {/* Country */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
              {t(lang, "audit.filter_country", "Country")}
            </label>
            <select
              value={selectedCountry}
              onChange={(e) => {
                setSelectedCountry(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 px-2.5 text-xs font-semibold outline-none focus:border-blue-600"
            >
              <option value="all">{t(lang, "audit.filter_all_countries", "All Countries")}</option>
              {countriesList.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Branch */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
              {t(lang, "audit.filter_branch", "Branch")}
            </label>
            <select
              value={selectedBranch}
              onChange={(e) => {
                setSelectedBranch(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 px-2.5 text-xs font-semibold outline-none focus:border-blue-600"
            >
              <option value="all">{t(lang, "audit.filter_all_branches", "All Branches")}</option>
              {branchesList.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          {/* Module */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
              {t(lang, "audit.filter_module", "Module")}
            </label>
            <select
              value={selectedModule}
              onChange={(e) => {
                setSelectedModule(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 px-2.5 text-xs font-semibold outline-none focus:border-blue-600"
            >
              <option value="all">{t(lang, "audit.filter_all_modules", "All Modules")}</option>
              <option value="Purchase">{t(lang, "audit.mod_purchase", "Purchase")}</option>
              <option value="Local Purchase">{t(lang, "audit.mod_local_purchase", "Local Purchase")}</option>
              <option value="Sales">{t(lang, "audit.mod_sales", "Sales")}</option>
              <option value="Local Sales">{t(lang, "audit.mod_local_sales", "Local Sales")}</option>
              <option value="Cash Entry">{t(lang, "audit.mod_cash_roznamcha", "Cash Entry / Roznamcha")}</option>
              <option value="Ledger">{t(lang, "audit.mod_ledger", "Ledger")}</option>
              <option value="Payment">{t(lang, "audit.mod_payment_transfers", "Payment & Transfers")}</option>
              <option value="Shipping">{t(lang, "audit.mod_shipping_clearing", "Shipping & Clearing")}</option>
              <option value="Invoices">{t(lang, "audit.mod_invoices_endorsements", "Invoices & Endorsements")}</option>
            </select>
          </div>

          {/* User */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
              {t(lang, "audit.filter_edited_by", "Edited By")}
            </label>
            <select
              value={selectedUser}
              onChange={(e) => {
                setSelectedUser(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 px-2.5 text-xs font-semibold outline-none focus:border-blue-600"
            >
              <option value="all">{t(lang, "audit.filter_all_users", "All Users")}</option>
              {Array.from(new Set(records.map((r) => r.user_name).filter(Boolean))).sort().map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>

          {/* Risk Level */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
              {t(lang, "audit.filter_risk_level", "Risk Level")}
            </label>
            <select
              value={selectedRisk}
              onChange={(e) => {
                setSelectedRisk(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 px-2.5 text-xs font-semibold outline-none focus:border-blue-600"
            >
              <option value="all">{t(lang, "audit.filter_all_risk_levels", "All Risk Levels")}</option>
              <option value="High">{t(lang, "audit.risk_high", "High")}</option>
              <option value="Medium">{t(lang, "audit.risk_medium", "Medium")}</option>
              <option value="Low">{t(lang, "audit.risk_low", "Low")}</option>
            </select>
          </div>

          {/* Approval Status */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
              {t(lang, "audit.filter_approval_status", "Approval Status")}
            </label>
            <select
              value={selectedApprovalStatus}
              onChange={(e) => {
                setSelectedApprovalStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 px-2.5 text-xs font-semibold outline-none focus:border-blue-600"
            >
              <option value="all">{t(lang, "audit.filter_all_statuses", "All Statuses")}</option>
              <option value="Approved">{t(lang, "audit.status_approved", "Approved")}</option>
              <option value="Pending">{t(lang, "audit.status_pending", "Pending")}</option>
              <option value="Rejected">{t(lang, "audit.status_rejected", "Rejected")}</option>
            </select>
          </div>
        </div>

        {/* Dates and Search Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1 border-t border-slate-100 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            <div className="w-full sm:w-64">
              <ErpDatePicker
                mode="range"
                lang={lang}
                size="sm"
                value={{ from: fromDate || null, to: toDate || null }}
                onApply={(v) => {
                  setFromDate(v.from ?? "");
                  setToDate(v.to ?? "");
                }}
              />
            </div>

            <div className="relative flex-1 sm:w-72">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <Input
                type="text"
                placeholder={t(lang, "audit.search_placeholder", "Search bill, reference or keywords...")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchRecords()}
                className="h-8.5 pl-8 pr-3 text-xs bg-slate-50/50 dark:bg-slate-800"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleResetFilters}
              className="h-8.5 px-3 text-xs font-bold border-slate-200 dark:border-slate-700"
            >
              {t(lang, "audit.reset", "Reset")}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={fetchRecords}
              className="h-8.5 px-4 text-xs font-black bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
            >
              <Filter className="h-3.5 w-3.5 mr-1" />
              {t(lang, "audit.filter_btn", "Filter")}
            </Button>
          </div>
        </div>
      </section>

      {/* ── MAIN EDIT HISTORY TABLE (1 Row Per Record with Edit Count Button) ── */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-3.5 text-center w-8">#</th>
                <th className="py-3 px-3.5">{t(lang, "audit.th_bill_ref", "Bill / Ref No.")}</th>
                <th className="py-3 px-3 text-center">{t(lang, "audit.th_version", "Total Edits")}</th>
                <th className="py-3 px-3">{t(lang, "audit.th_module", "Module")}</th>
                <th className="py-3 px-3">{t(lang, "audit.th_country", "Country")}</th>
                <th className="py-3 px-3">{t(lang, "audit.th_branch", "Branch")}</th>
                <th className="py-3 px-3">{t(lang, "audit.th_record_party", "Record / Party")}</th>
                <th className="py-3 px-3">{t(lang, "audit.th_original_date", "Original Date")}</th>
                <th className="py-3 px-3">{t(lang, "audit.th_edited_at", "Last Edited At")}</th>
                <th className="py-3 px-3">{t(lang, "audit.th_edited_by", "Last Edited By")}</th>
                <th className="py-3 px-3 text-center">{t(lang, "audit.th_risk", "Risk")}</th>
                <th className="py-3 px-3 text-center">{t(lang, "audit.th_status", "Approval")}</th>
                <th className="py-3 px-3.5 text-center">{t(lang, "audit.th_action", "Action")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11.5px]">
              {loading ? (
                <tr>
                  <td colSpan={13} className="py-12 text-center text-slate-400 font-medium">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-blue-600" />
                    {t(lang, "audit.loading_edit_history", "Loading enterprise edit & version history...")}
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-12 text-center text-slate-400 font-medium">
                    {t(lang, "audit.no_versioned_records", "No versioned records found matching current criteria.")}
                  </td>
                </tr>
              ) : (
                records.map((row, idx) => {
                  const itemNumber = (currentPage - 1) * pageSize + idx + 1;
                  const editCount = row.edit_count || row.total_versions - 1 || 1;
                  return (
                    <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition">
                      <td className="py-2.5 px-3.5 text-center font-mono text-slate-400 text-[10.5px]">
                        {itemNumber}
                      </td>

                      {/* Bill / Ref No */}
                      <td className="py-2.5 px-3.5">
                        <span className="font-mono font-bold text-slate-900 dark:text-white">
                          {row.reference_no || row.entity_id}
                        </span>
                      </td>

                      {/* Edit Count Button */}
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleOpenVersionHistory(row)}
                          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-black bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-950 dark:text-blue-300 transition shadow-xs"
                        >
                          <Sparkles className="h-3 w-3" />
                          <span>+{editCount} Edits</span>
                        </button>
                      </td>

                      {/* Module */}
                      <td className="py-2.5 px-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md font-bold text-[10.5px] bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                          {row.module}
                        </span>
                      </td>

                      {/* Country */}
                      <td className="py-2.5 px-3 font-semibold text-slate-700 dark:text-slate-300">
                        {row.country_name || "Global"}
                      </td>

                      {/* Branch */}
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                        {row.branch_name || "Main Branch"}
                      </td>

                      {/* Record / Party */}
                      <td className="py-2.5 px-3 font-bold text-slate-800 dark:text-slate-200">
                        {row.party_name || "General Entry"}
                      </td>

                      {/* Original Date */}
                      <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                        {new Date(row.original_created_at || row.created_at).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
                      </td>

                      {/* Last Edited At */}
                      <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-slate-200">
                        {new Date(row.created_at).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
                      </td>

                      {/* Last Edited By */}
                      <td className="py-2.5 px-3 font-medium text-slate-700 dark:text-slate-300">
                        {row.user_name || "—"}
                      </td>

                      {/* Risk Level */}
                      <td className="py-2.5 px-3 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black ${
                          row.risk_level === "High"
                            ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                            : row.risk_level === "Medium"
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                            : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                        }`}>
                          {row.risk_level}
                        </span>
                      </td>

                      {/* Approval Status */}
                      <td className="py-2.5 px-3 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black ${
                          row.approval_status === "Pending"
                            ? "bg-amber-50 text-amber-600 border border-amber-200"
                            : row.approval_status === "Rejected"
                            ? "bg-rose-50 text-rose-600 border border-rose-200"
                            : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        }`}>
                          {row.approval_status || "Approved"}
                        </span>
                      </td>

                      {/* Action Button */}
                      <td className="py-2.5 px-3.5 text-center">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenVersionHistory(row)}
                          className="h-7.5 px-2.5 text-[11px] font-bold border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400"
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          <span>{t(lang, "audit.view_changes", "View Changes")}</span>
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── PAGINATION CONTROLS ── */}
        <div className="p-3.5 bg-slate-50/50 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="text-slate-500 font-medium">
            {t(lang, "audit.showing_range", "Showing")} <span className="font-bold text-slate-800 dark:text-slate-200">{records.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}</span> {t(lang, "audit.showing_to", "to")} <span className="font-bold text-slate-800 dark:text-slate-200">{Math.min(currentPage * pageSize, totalCount)}</span> {t(lang, "audit.showing_of", "of")} <span className="font-bold text-slate-800 dark:text-slate-200">{totalCount.toLocaleString()}</span> {t(lang, "audit.showing_records", "records")}
          </div>

          <div className="flex items-center gap-2">
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-xs font-semibold"
            >
              <option value="25">{t(lang, "audit.per_page_25", "25 per page")}</option>
              <option value="50">{t(lang, "audit.per_page_50", "50 per page")}</option>
              <option value="100">{t(lang, "audit.per_page_100", "100 per page")}</option>
            </select>

            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(1)}
                className="h-8 w-8"
              >
                <ChevronsLeft className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(p => p - 1)}
                className="h-8 w-8"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>

              <span className="px-2.5 py-1 rounded-md bg-blue-600 text-white font-black text-xs">
                {currentPage}
              </span>

              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(p => p + 1)}
                className="h-8 w-8"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(totalPages)}
                className="h-8 w-8"
              >
                <ChevronsRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ── VERSION COMPARISON MODAL ── */}
      {compareModalOpen && (
        <VersionComparisonModal
          isOpen={compareModalOpen}
          onClose={() => setCompareModalOpen(false)}
          versionData={selectedRowRecord}
          lifecycleTimeline={selectedRowTimeline}
        />
      )}

    </div>
  );
}
