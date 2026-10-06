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
import { apiGet } from "@/lib/api/client";
import { downloadCsv } from "@/features/branches/components/branch-report-export";
import { openScopedGenericReport } from "@/lib/reports/open-scoped-report";
import { VersionComparisonModal } from "./version-comparison-modal";

type SessionInfo = {
  user?: { fullName?: string | null; email?: string | null };
  scopes?: {
    isSuperAdmin?: boolean;
    summary?: { countryName?: string | null; branchDisplayName?: string | null; scopeLabel?: string | null };
  };
};

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
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [kpis, setKpis] = useState({
    editsToday: 0,
    editsThisWeek: 0,
    editsThisMonth: 0,
    pendingApprovals: 0,
    highRiskChanges: 0,
    rejectedChanges: 0,
    expiredAccess: 0,
    totalCountries: 0,
    totalBranches: 0,
    totalModules: 0,
    totalUsers: 0
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
    apiGet<SessionInfo>("/api/erp/auth/session").then(setSession).catch(() => null);
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
  const isSuperAdmin = !!session?.scopes?.isSuperAdmin;
  const moduleOptions = Array.from(new Set(records.map((r) => r.module).filter(Boolean))).sort();
  const userOptions = Array.from(
    new Map(records.filter((r) => r.user_id).map((r) => [r.user_id, r.user_name])).entries()
  );

  return (
    <div className="mx-auto w-full max-w-[1720px] p-4 lg:p-6 space-y-4 font-sans antialiased text-slate-900 dark:text-slate-100" dir={isRtl ? "rtl" : "ltr"}>

      {/* ── BREADCRUMB + HEADER ── */}
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => window.history.back()}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-blue-600 transition-colors w-fit"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          <span>{t(lang, "common.back", "Back")}</span>
        </button>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                {t(lang, "audit.edit_history_title", "All Edit / Version History — All Countries & Branches")}
              </h1>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                {t(lang, "audit.edit_history_subtitle_v2", "Track every change. Ensure compliance. Maintain a complete and immutable audit trail.")}
              </p>
            </div>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5 self-center">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>{t(lang, "audit.immutable_banner", "Immutable Audit Trail — All records are read-only and cannot be altered or deleted.")}</span>
          </div>
        </div>
      </div>

      {/* ── 4 KPI SUMMARY CARDS ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3.5">
        {/* Card 1: Branch & User Details */}
        <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-blue-600 to-indigo-600" />
          <div className="p-3.5 space-y-2.5">
            <span className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-blue-600" />
              {t(lang, "audit.branch_user_details", "Branch & User Details")}
            </span>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between"><span className="text-slate-500 font-medium">{t(lang, "audit.filter_branch", "Branch")}:</span><span className="font-bold text-slate-800 dark:text-slate-200">{session?.scopes?.summary?.branchDisplayName || "—"}</span></div>
              <div className="flex justify-between"><span className="text-slate-500 font-medium">{t(lang, "audit.filter_country", "Country")}:</span><span className="font-bold text-slate-800 dark:text-slate-200">{session?.scopes?.summary?.countryName || "—"}</span></div>
              <div className="flex justify-between"><span className="text-slate-500 font-medium">{t(lang, "common.user_name", "User Name")}:</span><span className="font-bold text-slate-800 dark:text-slate-200">{session?.user?.fullName || "—"}</span></div>
              <div className="flex justify-between"><span className="text-slate-500 font-medium">{t(lang, "audit.user_email", "User Email")}:</span><span className="font-mono text-[11px] font-bold text-blue-600 truncate max-w-[130px]" title={session?.user?.email || ""}>{session?.user?.email || "—"}</span></div>
              <div className="flex justify-between"><span className="text-slate-500 font-medium">{t(lang, "audit.role", "Role")}:</span><span className="font-bold text-slate-800 dark:text-slate-200">{isSuperAdmin ? t(lang, "audit.super_admin", "Super Admin") : (session?.scopes?.summary?.scopeLabel || "—")}</span></div>
            </div>
          </div>
        </div>

        {/* Card 2: Edit Activity Summary */}
        <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-purple-500 to-violet-600" />
          <div className="p-3.5 space-y-2.5">
            <span className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
              <History className="h-3.5 w-3.5 text-purple-600" />
              {t(lang, "audit.edit_activity_summary", "Edit Activity Summary")}
            </span>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between"><span className="text-slate-500 font-medium">{t(lang, "audit.kpi_edits_today", "Edits Today")}:</span><span className="font-bold text-purple-600">{kpis.editsToday}</span></div>
              <div className="flex justify-between"><span className="text-slate-500 font-medium">{t(lang, "audit.this_week", "This Week")}:</span><span className="font-bold text-slate-800 dark:text-slate-200">{kpis.editsThisWeek}</span></div>
              <div className="flex justify-between"><span className="text-slate-500 font-medium">{t(lang, "audit.this_month", "This Month")}:</span><span className="font-bold text-slate-800 dark:text-slate-200">{kpis.editsThisMonth}</span></div>
              <div className="flex justify-between"><span className="text-slate-500 font-medium">{t(lang, "audit.total_versions", "Total Versions")}:</span><span className="font-bold text-blue-600">{totalCount}</span></div>
            </div>
          </div>
        </div>

        {/* Card 3: Approval & Risk Summary */}
        <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-amber-500 to-orange-500" />
          <div className="p-3.5 space-y-2.5">
            <span className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
              <ShieldAlert className="h-3.5 w-3.5 text-amber-600" />
              {t(lang, "audit.approval_risk_summary", "Approval & Risk Summary")}
            </span>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between"><span className="text-slate-500 font-medium">{t(lang, "audit.kpi_pending_approvals", "Pending Approvals")}:</span><span className="font-bold text-amber-600">{kpis.pendingApprovals}</span></div>
              <div className="flex justify-between"><span className="text-slate-500 font-medium">{t(lang, "audit.kpi_high_risk_changes", "High-Risk Changes")}:</span><span className="font-bold text-rose-600">{kpis.highRiskChanges}</span></div>
              <div className="flex justify-between"><span className="text-slate-500 font-medium">{t(lang, "audit.status_rejected", "Rejected")}:</span><span className="font-bold text-red-600">{kpis.rejectedChanges}</span></div>
              <div className="flex justify-between"><span className="text-slate-500 font-medium">{t(lang, "audit.kpi_expired_access", "Expired Access")}:</span><span className="font-bold text-slate-500">{kpis.expiredAccess}</span></div>
            </div>
          </div>
        </div>

        {/* Card 4: All Countries Audit Report */}
        {isSuperAdmin ? (
          <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-emerald-500 to-teal-600" />
            <div className="p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5 text-emerald-600" />
                  {t(lang, "audit.all_countries_report", "All Countries Audit Report")}
                </span>
                <span className="px-1.5 py-0.5 text-[9px] font-black uppercase rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                  {t(lang, "audit.super_admin_only", "Super Admin Only")}
                </span>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-slate-500 font-medium">{t(lang, "audit.kpi_countries", "Countries")}:</span><span className="font-bold text-slate-800 dark:text-slate-200">{kpis.totalCountries}</span></div>
                <div className="flex justify-between"><span className="text-slate-500 font-medium">{t(lang, "audit.kpi_branches", "Branches")}:</span><span className="font-bold text-slate-800 dark:text-slate-200">{kpis.totalBranches}</span></div>
                <div className="flex justify-between"><span className="text-slate-500 font-medium">{t(lang, "audit.modules", "Modules")}:</span><span className="font-bold text-emerald-600">{kpis.totalModules}</span></div>
                <div className="flex justify-between"><span className="text-slate-500 font-medium">{t(lang, "audit.users", "Users")}:</span><span className="font-bold text-blue-600">{kpis.totalUsers}</span></div>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* ── FILTER ROW ── */}
      <div className="flex flex-wrap items-center gap-2.5 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-xs">
        {/* Country */}
        <select
          value={selectedCountry}
          onChange={(e) => { setSelectedCountry(e.target.value); setCurrentPage(1); }}
          className="h-9 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800 px-2.5 text-xs font-semibold outline-none text-slate-700 dark:text-slate-200"
        >
          <option value="all">{t(lang, "audit.filter_all_countries", "All Countries")}</option>
          {countriesList.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        {/* Branch */}
        <select
          value={selectedBranch}
          onChange={(e) => { setSelectedBranch(e.target.value); setCurrentPage(1); }}
          className="h-9 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800 px-2.5 text-xs font-semibold outline-none text-slate-700 dark:text-slate-200"
        >
          <option value="all">{t(lang, "audit.filter_all_branches", "All Branches")}</option>
          {branchesList.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>

        {/* Module */}
        <select
          value={selectedModule}
          onChange={(e) => { setSelectedModule(e.target.value); setCurrentPage(1); }}
          className="h-9 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800 px-2.5 text-xs font-semibold outline-none text-slate-700 dark:text-slate-200"
        >
          <option value="all">{t(lang, "audit.filter_all_modules", "All Modules")}</option>
          {moduleOptions.map(m => <option key={m} value={m}>{m}</option>)}
        </select>

        {/* Edited By */}
        <select
          value={selectedUser}
          onChange={(e) => { setSelectedUser(e.target.value); setCurrentPage(1); }}
          className="h-9 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800 px-2.5 text-xs font-semibold outline-none text-slate-700 dark:text-slate-200"
        >
          <option value="all">{t(lang, "audit.filter_all_users", "All Users")}</option>
          {userOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>

        {/* Risk Level */}
        <select
          value={selectedRisk}
          onChange={(e) => { setSelectedRisk(e.target.value); setCurrentPage(1); }}
          className="h-9 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800 px-2.5 text-xs font-semibold outline-none text-slate-700 dark:text-slate-200"
        >
          <option value="all">{t(lang, "audit.filter_all_risk_levels", "All Risk Levels")}</option>
          <option value="High">{t(lang, "audit.risk_high", "High")}</option>
          <option value="Medium">{t(lang, "audit.risk_medium", "Medium")}</option>
          <option value="Low">{t(lang, "audit.risk_low", "Low")}</option>
        </select>

        {/* Approval Status */}
        <select
          value={selectedApprovalStatus}
          onChange={(e) => { setSelectedApprovalStatus(e.target.value); setCurrentPage(1); }}
          className="h-9 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800 px-2.5 text-xs font-semibold outline-none text-slate-700 dark:text-slate-200"
        >
          <option value="all">{t(lang, "audit.filter_all_statuses", "All Statuses")}</option>
          <option value="Completed">{t(lang, "audit.status_approved", "Approved")}</option>
          <option value="Pending">{t(lang, "audit.status_pending", "Pending")}</option>
          <option value="Rejected">{t(lang, "audit.status_rejected", "Rejected")}</option>
        </select>

        {/* Date Range */}
        <div className="w-64">
          <ErpDatePicker
            mode="range"
            lang={lang}
            size="sm"
            value={{ from: fromDate || null, to: toDate || null }}
            onApply={(v) => { setFromDate(v.from ?? ""); setToDate(v.to ?? ""); }}
          />
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            type="text"
            placeholder={t(lang, "audit.search_placeholder", "Search Bill / Reference No...")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && fetchRecords()}
            className="h-9 pl-9 pr-3 text-xs bg-slate-50/50 dark:bg-slate-800"
          />
        </div>

        {/* Refresh */}
        <Button
          type="button"
          variant="outline"
          onClick={fetchRecords}
          className="h-9 w-9 p-0 border-slate-200 dark:border-slate-800"
          title={t(lang, "audit.refresh", "Refresh")}
        >
          <RefreshCw className={`h-4 w-4 text-slate-600 ${loading ? "animate-spin" : ""}`} />
        </Button>

        {/* Export CSV */}
        <Button
          type="button"
          variant="outline"
          onClick={handleExportCsv}
          className="h-9 px-3 text-xs font-bold border-slate-200 dark:border-slate-800"
        >
          <Download className="h-3.5 w-3.5 mr-1.5 text-slate-500" />
          {t(lang, "audit.export_csv", "Export CSV")}
        </Button>

        {/* Audit PDF */}
        <Button
          type="button"
          onClick={handlePrint}
          className="h-9 px-3.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
        >
          <FileText className="h-3.5 w-3.5 mr-1.5" />
          {t(lang, "audit.audit_pdf", "Audit PDF")}
        </Button>
      </div>

      {/* ── REGISTER TABLE CARD ── */}
      <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
        {/* Table Header */}
        <div className="p-3.5 border-b border-slate-100 dark:border-slate-800 space-y-1.5">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-black text-slate-900 dark:text-white">
              {t(lang, "audit.register_title", "Version History & Audit Register")}
            </h2>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              {totalCount} {t(lang, "audit.showing_records", "records")}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 font-medium">
            {t(lang, "audit.immutable_notice_full", "This is an immutable audit trail. All changes are permanently recorded for compliance and cannot be modified or deleted.")}
          </p>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-3 text-center w-8"><input type="checkbox" className="rounded border-slate-300" /></th>
                <th className="py-3 px-3 text-center w-8">#</th>
                <th className="py-3 px-3">{t(lang, "audit.th_bill_ref", "Bill / Ref No.")}</th>
                <th className="py-3 px-3 text-center">{t(lang, "audit.th_version", "Total Edits")}</th>
                <th className="py-3 px-3">{t(lang, "audit.th_module", "Module")}</th>
                <th className="py-3 px-3">{t(lang, "audit.th_country", "Country")}</th>
                <th className="py-3 px-3">{t(lang, "audit.th_branch", "Branch")}</th>
                <th className="py-3 px-3">{t(lang, "audit.th_record_party", "Record / Party")}</th>
                <th className="py-3 px-3">{t(lang, "audit.th_original_date", "Original Date")}</th>
                <th className="py-3 px-3">{t(lang, "audit.th_edited_at", "Last Edited At")}</th>
                <th className="py-3 px-3">{t(lang, "audit.th_edited_by", "Last Edited By")}</th>
                <th className="py-3 px-3 text-center">{t(lang, "audit.th_change_type", "Change Type")}</th>
                <th className="py-3 px-3 text-center">{t(lang, "audit.th_risk", "Risk")}</th>
                <th className="py-3 px-3 text-center">{t(lang, "audit.th_status", "Approval Status")}</th>
                <th className="py-3 px-3 text-center">{t(lang, "audit.th_action", "Actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11.5px]">
              {loading ? (
                <tr>
                  <td colSpan={15} className="py-12 text-center text-slate-400 font-medium">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-blue-600" />
                    {t(lang, "audit.loading_edit_history", "Loading enterprise edit & version history...")}
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={15} className="py-12 text-center text-slate-400 font-medium">
                    {t(lang, "audit.no_versioned_records", "No versioned records found matching current criteria.")}
                  </td>
                </tr>
              ) : (
                records.map((row, idx) => {
                  const itemNumber = (currentPage - 1) * pageSize + idx + 1;
                  const editCount = row.edit_count || row.total_versions - 1 || 1;
                  return (
                    <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition">
                      <td className="py-2.5 px-3 text-center"><input type="checkbox" className="rounded border-slate-300" /></td>
                      <td className="py-2.5 px-3 text-center font-mono text-slate-400 text-[10.5px]">{itemNumber}</td>

                      {/* Bill / Ref No */}
                      <td className="py-2.5 px-3">
                        <span className="font-mono font-bold text-slate-900 dark:text-white">
                          {row.reference_no || row.entity_id}
                        </span>
                      </td>

                      {/* Edit Count */}
                      <td className="py-2.5 px-3 text-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-black bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                          <Sparkles className="h-3 w-3" />
                          +{editCount}
                        </span>
                      </td>

                      {/* Module */}
                      <td className="py-2.5 px-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md font-bold text-[10.5px] bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                          {row.module}
                        </span>
                      </td>

                      <td className="py-2.5 px-3 font-semibold text-slate-700 dark:text-slate-300">{row.country_name || t(lang, "audit.global", "Global")}</td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">{row.branch_name || t(lang, "audit.main_branch", "Main Branch")}</td>
                      <td className="py-2.5 px-3 font-bold text-slate-800 dark:text-slate-200">{row.party_name || t(lang, "audit.general_entry", "General Entry")}</td>

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

                      {/* Change Type */}
                      <td className="py-2.5 px-3 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                          {row.reason || t(lang, "audit.field_update", "Field Update")}
                        </span>
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
                          {row.risk_level === "High" ? t(lang, "audit.risk_high", "High") : row.risk_level === "Medium" ? t(lang, "audit.risk_medium", "Medium") : t(lang, "audit.risk_low", "Low")}
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
                          {row.approval_status === "Pending" ? t(lang, "audit.status_pending", "Pending")
                            : row.approval_status === "Rejected" ? t(lang, "audit.status_rejected", "Rejected")
                            : t(lang, "audit.status_approved", "Approved")}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="py-2.5 px-3 text-center">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenVersionHistory(row)}
                          className="h-7 px-2.5 text-[11px] font-bold border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400"
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          {t(lang, "audit.view_changes", "View")}
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-3.5 bg-slate-50/50 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="text-slate-500 font-medium">
            {t(lang, "audit.showing_range", "Showing")} <span className="font-bold text-slate-800 dark:text-slate-200">{records.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}</span> {t(lang, "audit.showing_to", "to")} <span className="font-bold text-slate-800 dark:text-slate-200">{Math.min(currentPage * pageSize, totalCount)}</span> {t(lang, "audit.showing_of", "of")} <span className="font-bold text-slate-800 dark:text-slate-200">{totalCount.toLocaleString()}</span> {t(lang, "audit.showing_records", "records")}
          </div>

          <div className="flex items-center gap-2">
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
              className="h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-xs font-semibold"
            >
              {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n} {t(lang, "audit.per_page", "per page")}</option>)}
            </select>

            <div className="flex items-center gap-1">
              <Button type="button" variant="outline" size="icon" disabled={currentPage <= 1} onClick={() => setCurrentPage(1)} className="h-8 w-8">
                <ChevronsLeft className="h-3.5 w-3.5" />
              </Button>
              <Button type="button" variant="outline" size="icon" disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)} className="h-8 w-8">
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <span className="px-2.5 py-1 rounded-md bg-blue-600 text-white font-black text-xs">{currentPage}</span>
              <Button type="button" variant="outline" size="icon" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)} className="h-8 w-8">
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
              <Button type="button" variant="outline" size="icon" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(totalPages)} className="h-8 w-8">
                <ChevronsRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>

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
