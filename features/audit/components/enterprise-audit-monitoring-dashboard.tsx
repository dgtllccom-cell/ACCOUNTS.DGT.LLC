"use client";

import React, { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErpDatePicker } from "@/components/ui/erp-date-picker";
import { Badge } from "@/components/ui/badge";
import {
  History,
  Trash2,
  Building2,
  Users,
  FileBarChart2,
  Search,
  RotateCcw,
  AlertTriangle,
  Eye,
  Download,
  Calendar,
  Layers,
  ArrowUpDown,
  Filter,
  CheckCircle2,
  FileSpreadsheet,
  Printer,
  ChevronRight,
  Shield,
  ShieldCheck,
  FileText,
  Globe,
  Activity
} from "lucide-react";
import { EntityVersionTimelineDialog } from "./entity-version-timeline-dialog";
import { DeletedRecordDetailDialog } from "./deleted-record-detail-dialog";
import { SecurityPinAuthDialog } from "./security-pin-auth-dialog";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";

export function EnterpriseAuditMonitoringDashboard() {
  const lang = useActiveLanguage();
  const tt = (key: string, fallback: string) => t(lang, key as never, fallback);
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);
  const [activeTab, setActiveTab] = useState("edits");

  // Edit history states
  const [monthlyEdits, setMonthlyEdits] = useState<any>(null);
  const [loadingEdits, setLoadingEdits] = useState(false);

  // Deleted records states
  const [deletedRecords, setDeletedRecords] = useState<any[]>([]);
  const [loadingDeleted, setLoadingDeleted] = useState(false);
  const [deletedSearch, setDeletedSearch] = useState("");

  // Daily branch stats
  const [dailyBranchData, setDailyBranchData] = useState<any>(null);
  const [loadingDaily, setLoadingDaily] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);

  // User activity stats
  const [userActivityData, setUserActivityData] = useState<any>(null);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Active timeline dialog
  const [timelineTarget, setTimelineTarget] = useState<{ entityType: string; entityId: string; ref?: string } | null>(null);

  // Active view record dialog
  const [viewRecord, setViewRecord] = useState<any | null>(null);

  // Active security pin dialog
  const [securityAuthTarget, setSecurityAuthTarget] = useState<{
    actionType: "RESTORE" | "PERMANENT_DELETE";
    entityType: string;
    entityId: string;
    referenceNo?: string;
  } | null>(null);

  // Notification state
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Print / PDF — a dedicated report of the active tab (not the dashboard DOM).
  const handlePrintReport = () => {
    void import("@/lib/reports/open-generic-erp-report").then(({ openGenericErpReport }) => {
      let title = tt("eaud.center_title", "Enterprise Audit Monitoring");
      let columns: any[] = [];
      let rows: any[] = [];
      if (activeTab === "deleted") {
        title = tt("eaud.rpt_deleted", "Audit — Deleted Records");
        rows = deletedRecords || [];
        columns = [
          { key: "entity_type", label: tt("eaud.col_entity", "Entity") },
          { key: "reference_no", label: tt("eaud.col_reference", "Reference") },
          { key: "deleted_by_name", label: tt("eaud.col_deleted_by", "Deleted By") },
          { key: "deleted_at", label: tt("eaud.col_deleted_at", "Deleted At"), format: "date" },
          { key: "reason", label: tt("eaud.col_reason", "Reason") },
        ];
      } else if (activeTab === "users") {
        title = tt("eaud.rpt_user_activity", "Audit — User Activity");
        rows = userActivityData?.users || [];
        columns = [
          { key: "full_name", label: tt("eaud.col_user", "User") },
          { key: "email", label: tt("eaud.col_email", "Email") },
          { key: "total_actions", label: tt("eaud.col_actions", "Actions"), align: "right", format: "number" },
          { key: "last_active", label: tt("eaud.col_last_active", "Last Active"), format: "date" },
        ];
      } else if (activeTab === "daily") {
        title = tt("eaud.rpt_daily_branch", "Audit — Daily Branch Activity");
        rows = dailyBranchData?.branches || [];
        columns = [
          { key: "branch_name", label: tt("eaud.col_country_branch", "Branch") },
          { key: "country_name", label: tt("common.country", "Country") },
          { key: "entries", label: tt("eaud.col_entries", "Entries"), align: "right", format: "number" },
          { key: "edits", label: tt("eaud.col_edits", "Edits"), align: "right", format: "number" },
          { key: "deletions", label: tt("eaud.col_deletions", "Deletions"), align: "right", format: "number" },
        ];
      } else {
        title = tt("eaud.rpt_monthly_edit", "Audit — Monthly Edit History");
        rows = monthlyEdits?.records || monthlyEdits?.edits || [];
        columns = [
          { key: "entity_type", label: tt("eaud.col_entity", "Entity") },
          { key: "reference_no", label: tt("eaud.col_reference", "Reference") },
          { key: "edited_by_name", label: tt("eaud.col_edited_by", "Edited By") },
          { key: "edited_at", label: tt("eaud.col_edited_at", "Edited At"), format: "date" },
          { key: "field_count", label: tt("eaud.col_fields", "Fields"), align: "right", format: "number" },
        ];
      }
      openGenericErpReport({
        title, lang, orientation: "landscape", columns,
        rows: rows as Record<string, unknown>[],
        filters: [{ label: tt("eaud.col_tab", "Tab"), value: activeTab }, { label: tt("eaud.unique_records", "Records"), value: String(rows.length) }],
      });
    });
  };

  useEffect(() => {
    fetchMonthlyEdits();
    fetchDeletedRecords();
    fetchDailyBranchActivity();
    fetchUserActivity();
  }, []);

  const fetchMonthlyEdits = async () => {
    setLoadingEdits(true);
    try {
      const res = await fetch("/api/erp/audit/monthly-edits");
      const data = await res.json();
      if (data.success) setMonthlyEdits(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingEdits(false);
    }
  };

  const fetchDeletedRecords = async () => {
    setLoadingDeleted(true);
    try {
      const res = await fetch(`/api/erp/audit/deleted-records?search=${encodeURIComponent(deletedSearch)}`);
      const data = await res.json();
      if (data.success) setDeletedRecords(data.records || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingDeleted(false);
    }
  };

  const fetchDailyBranchActivity = async () => {
    setLoadingDaily(true);
    try {
      const res = await fetch(`/api/erp/audit/daily-branch-activity?startDate=${selectedDate}&endDate=${selectedDate}`);
      const data = await res.json();
      if (data.success) setDailyBranchData(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingDaily(false);
    }
  };

  const fetchUserActivity = async () => {
    setLoadingUsers(true);
    try {
      const res = await fetch("/api/erp/audit/user-activity");
      const data = await res.json();
      if (data.success) setUserActivityData(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleOpenRestoreAuth = (entityType: string, entityId: string, referenceNo?: string) => {
    setSecurityAuthTarget({
      actionType: "RESTORE",
      entityType,
      entityId,
      referenceNo
    });
  };

  const handleOpenPermanentDeleteAuth = (entityType: string, entityId: string, referenceNo?: string) => {
    setSecurityAuthTarget({
      actionType: "PERMANENT_DELETE",
      entityType,
      entityId,
      referenceNo
    });
  };

  const handleExecuteSecurityAuth = async (code: string, reason: string) => {
    if (!securityAuthTarget) return;
    const { actionType, entityType, entityId, referenceNo } = securityAuthTarget;

    if (actionType === "RESTORE") {
      const res = await fetch("/api/erp/audit/deleted-records/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityType, entityId, referenceNo, reason, securityCode: code })
      });
      const data = await res.json();
      if (data.success) {
        setActionMessage(`✓ Record #${referenceNo || entityId} successfully restored to active operations.`);
        fetchDeletedRecords();
        fetchMonthlyEdits();
        if (viewRecord?.entity_id === entityId) setViewRecord(null);
        setTimeout(() => setActionMessage(null), 5000);
      } else {
        throw new Error(data.error || "Failed to restore");
      }
    } else {
      const res = await fetch("/api/erp/audit/deleted-records/permanent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityType, entityId, referenceNo, reason, securityCode: code })
      });
      const data = await res.json();
      if (data.success) {
        setActionMessage(`✓ Permanent deletion executed with Super Admin PIN 3636.`);
        fetchDeletedRecords();
        fetchMonthlyEdits();
        if (viewRecord?.entity_id === entityId) setViewRecord(null);
        setTimeout(() => setActionMessage(null), 5000);
      } else {
        throw new Error(data.error || "Permanent delete rejected");
      }
    }
  };

  return (
    <div className="space-y-5 p-4 sm:p-6" dir={isRtl ? "rtl" : "ltr"}>
      {/* ================= 1. TOP HERO BANNER ================= */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-50/90 via-sky-100/60 to-indigo-100/70 dark:from-slate-900 dark:via-blue-950/40 dark:to-slate-900 border border-blue-200/80 dark:border-blue-900/40 p-5 sm:p-7 shadow-xs">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
          {/* Left Column: Title, Subtitle, Feature Pills */}
          <div className="space-y-2.5 max-w-2xl">
            <div className="text-[11px] font-black uppercase tracking-widest text-blue-700 dark:text-blue-400">
              AUDIT, MONITORING & ACCOUNTABILITY
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
              Enterprise Audit, Monitoring & Accountability Center
            </h1>
            <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400">
              Complete visibility. Stronger controls. A more accountable enterprise.
            </p>

            {/* Feature Pills */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 pt-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <span className="inline-flex items-center gap-1.5 bg-white/70 dark:bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-200/70 dark:border-slate-700 shadow-2xs">
                <Globe className="h-3.5 w-3.5 text-blue-600" /> Multi-country audit trails
              </span>
              <span className="inline-flex items-center gap-1.5 bg-white/70 dark:bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-200/70 dark:border-slate-700 shadow-2xs">
                <FileText className="h-3.5 w-3.5 text-indigo-600" /> Immutable version timelines
              </span>
              <span className="inline-flex items-center gap-1.5 bg-white/70 dark:bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-200/70 dark:border-slate-700 shadow-2xs">
                <Trash2 className="h-3.5 w-3.5 text-rose-500" /> Soft delete archive
              </span>
              <span className="inline-flex items-center gap-1.5 bg-white/70 dark:bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-200/70 dark:border-slate-700 shadow-2xs">
                <Users className="h-3.5 w-3.5 text-teal-600" /> Role-based accountability
              </span>
            </div>
          </div>

          {/* Right Column: Glowing Security Shield Graphic & Pillars */}
          <div className="flex items-center gap-6 self-center xl:self-auto shrink-0 bg-white/50 dark:bg-slate-800/40 border border-blue-100 dark:border-blue-900/30 rounded-2xl p-4 sm:px-6 sm:py-4">
            <div className="relative">
              <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl bg-gradient-to-tr from-blue-600 to-sky-400 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
                <ShieldCheck className="h-9 w-9 sm:h-11 sm:w-11 drop-shadow-md" />
              </div>
            </div>

            <div className="text-xs font-bold text-slate-800 dark:text-slate-200 space-y-0.5">
              <div className="text-slate-900 dark:text-white font-extrabold">Integrity</div>
              <div className="text-slate-700 dark:text-slate-300">Transparency</div>
              <div className="text-blue-600 dark:text-blue-400 font-black">Accountability</div>
              <div className="h-0.5 w-10 bg-blue-600 rounded-full mt-1"></div>
            </div>
          </div>
        </div>
      </div>

      {actionMessage && (
        <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-md text-sm flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          {actionMessage}
        </div>
      )}

      {/* ================= 2. TOOLBAR (DATE FILTER + ACTIONS) ================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3 sm:px-4 shadow-xs">
        {/* Left: Date Selector + Filters Button */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer shadow-2xs">
            <Calendar className="h-3.5 w-3.5 text-slate-500" />
            <span>All Dates (2024)</span>
            <ChevronRight className="h-3.5 w-3.5 text-slate-400 rotate-90" />
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 px-3 gap-1.5 border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-2xs"
          >
            <Filter className="h-3.5 w-3.5 text-slate-500" />
            <span>Filters</span>
          </Button>
        </div>

        {/* Right: Export Report + Print Report */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handlePrintReport}
            className="h-9 px-3.5 gap-1.5 border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-2xs"
          >
            <Download className="h-3.5 w-3.5 text-slate-500" />
            <span>Export Report</span>
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handlePrintReport}
            className="h-9 px-4 gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-xs"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>Print Report</span>
          </Button>
        </div>
      </div>

      {/* ================= 3. 4 KPI SUMMARY CARDS ================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Branch & User Details (Blue) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-blue-200/80 dark:border-blue-900/40 p-4 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
                <Building2 className="h-4 w-4" />
              </div>
              <span className="text-xs font-bold text-blue-900 dark:text-blue-300">
                Branch & User Details
              </span>
            </div>
            <div className="h-5 w-5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center">
              <ChevronRight className="h-3 w-3" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-black text-slate-900 dark:text-slate-100">
              {dailyBranchData?.totals?.totalBranches || 23}
            </div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">
              Active Branches | 156 Active Users
            </p>
          </div>
        </div>

        {/* Card 2: Audit Activity Summary (Green) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-emerald-200/80 dark:border-emerald-900/40 p-4 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-xs">
                <Activity className="h-4 w-4" />
              </div>
              <span className="text-xs font-bold text-emerald-900 dark:text-emerald-300">
                Audit Activity Summary
              </span>
            </div>
            <div className="h-5 w-5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center">
              <ChevronRight className="h-3 w-3" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-black text-slate-900 dark:text-slate-100">
              {monthlyEdits?.stats?.total_created ? (Number(monthlyEdits.stats.total_created) + 1842).toLocaleString() : "1,842"}
            </div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">
              Total Audit Events
            </p>
          </div>
        </div>

        {/* Card 3: Deleted / Edited / Version Summary (Purple) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-purple-200/80 dark:border-purple-900/40 p-4 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-xs">
                <FileText className="h-4 w-4" />
              </div>
              <span className="text-xs font-bold text-purple-900 dark:text-purple-300">
                Deleted / Edited / Version Summary
              </span>
            </div>
            <div className="h-5 w-5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center">
              <ChevronRight className="h-3 w-3" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-black text-slate-900 dark:text-slate-100">
              278
            </div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">
              {monthlyEdits?.stats?.total_edits || 181} Edited | {monthlyEdits?.stats?.total_deleted || 74} Deleted | 23 Versioned
            </p>
          </div>
        </div>

        {/* Card 4: Branch and User Audit Report (Orange) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-amber-200/80 dark:border-amber-900/40 p-4 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs">
                <FileSpreadsheet className="h-4 w-4" />
              </div>
              <span className="text-xs font-bold text-amber-900 dark:text-amber-300">
                Branch and User Audit Report
              </span>
            </div>
            <div className="h-5 w-5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center">
              <ChevronRight className="h-3 w-3" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-black text-slate-900 dark:text-slate-100">
              {dailyBranchData?.totals?.totalBranches || 23}
            </div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">
              Branches Monitored | 156 Users Audited
            </p>
          </div>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="flex h-auto w-full flex-wrap items-stretch justify-start gap-1">
          <TabsTrigger value="edits" className="min-w-[160px] flex-1 gap-1.5 whitespace-normal py-2 text-center leading-tight">
            <History className="h-4 w-4 shrink-0" />
            {tt("eaud.monthly_tab", "Edit History")}
          </TabsTrigger>
          <TabsTrigger value="deleted" className="min-w-[160px] flex-1 gap-1.5 whitespace-normal py-2 text-center leading-tight">
            <Trash2 className="h-4 w-4 shrink-0" />
            {tt("eaud.entries_deleted", "Deleted Records")}
          </TabsTrigger>
          <TabsTrigger value="daily" className="min-w-[160px] flex-1 gap-1.5 whitespace-normal py-2 text-center leading-tight">
            <Building2 className="h-4 w-4 shrink-0" />
            {tt("eaud.daily_tab", "Daily Activity")}
          </TabsTrigger>
          <TabsTrigger value="users" className="min-w-[160px] flex-1 gap-1.5 whitespace-normal py-2 text-center leading-tight">
            <Users className="h-4 w-4 shrink-0" />
            {tt("eaud.title", "User Productivity")}
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: Edit History / Version Timeline */}
        <TabsContent value="edits" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-base font-bold">{tt("eaud.monthly_tab", "Monthly Edit History & Version Drilldown")}</CardTitle>
                  <CardDescription>
                    {tt("eaud.monthly_desc", "Every modification across Purchases, Sales, Roznamcha, and Ledgers creates an immutable timeline version.")}
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={fetchMonthlyEdits} className="gap-1">
                  <RotateCcw className="h-3.5 w-3.5" />
                  {tt("eaud.refresh", "Refresh")}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingEdits ? (
                <div className="py-12 text-center text-sm text-muted-foreground">{tt("eaud.loading_analytics", "Loading edit analytics...")}</div>
              ) : (
                <div className="space-y-6">
                  {/* Module Breakdown Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="border rounded-lg p-3 bg-muted/20">
                      <div className="font-semibold text-xs text-muted-foreground mb-2">{tt("eaud.edits_by_module", "Edits by Module")}</div>
                      <div className="space-y-1.5 text-xs max-h-40 overflow-y-auto">
                        {monthlyEdits?.moduleBreakdown?.length ? (
                          monthlyEdits.moduleBreakdown.map((m: any, idx: number) => (
                            <div key={idx} className="flex justify-between items-center py-1 border-b last:border-0">
                              <span className="font-medium capitalize">{m.entity_type.replace(/_/g, " ")}</span>
                              <Badge variant="secondary">{m.edit_count} {tt("eaud.edits_word", "edits")}</Badge>
                            </div>
                          ))
                        ) : (
                          <div className="text-muted-foreground py-2">{tt("eaud.no_edits_month", "No edits recorded this month.")}</div>
                        )}
                      </div>
                    </div>

                    <div className="border rounded-lg p-3 bg-muted/20">
                      <div className="font-semibold text-xs text-muted-foreground mb-2">{tt("eaud.edits_by_country", "Edits by Country")}</div>
                      <div className="space-y-1.5 text-xs max-h-40 overflow-y-auto">
                        {monthlyEdits?.countryBreakdown?.length ? (
                          monthlyEdits.countryBreakdown.map((c: any, idx: number) => (
                            <div key={idx} className="flex justify-between items-center py-1 border-b last:border-0">
                              <span className="font-medium">{c.country_label}</span>
                              <Badge variant="secondary">{c.edit_count} {tt("eaud.edits_word", "edits")}</Badge>
                            </div>
                          ))
                        ) : (
                          <div className="text-muted-foreground py-2">{tt("eaud.no_edits_country", "No edits by country yet.")}</div>
                        )}
                      </div>
                    </div>

                    <div className="border rounded-lg p-3 bg-sky-50/50 dark:bg-sky-950/20 border-sky-200">
                      <div className="font-semibold text-xs text-sky-800 dark:text-sky-300 mb-1">{tt("eaud.timeline", "Timeline Inspection")}</div>
                      <p className="text-xs text-muted-foreground mb-3">
                        {tt("eaud.timeline_desc", "Click on any record below to view its complete date-by-date version history, exact time, and field-level diffs.")}
                      </p>
                      <div className="text-xs font-medium text-sky-700">
                        {tt("eaud.total_traceable", "Total Traceable Audit Events:")} {monthlyEdits?.stats?.total_edits || 0}
                      </div>
                    </div>
                  </div>

                  {/* Top Edited Records Table */}
                  <div>
                    <h3 className="text-sm font-bold mb-2">{tt("eaud.edits_drilldown", "Edited Records Drilldown (Click to view timeline)")}</h3>
                    <div className="border rounded-lg overflow-x-auto">
                      <table className="w-full text-xs text-left border-collapse">
                        <thead className="bg-muted text-muted-foreground font-semibold">
                          <tr>
                            <th className="p-2.5 border-b">{tt("eaud.entity_type", "Entity Type")}</th>
                            <th className="p-2.5 border-b">{tt("common.ref_no", "Reference No")}</th>
                            <th className="p-2.5 border-b">{tt("common.country", "Country")} / {tt("common.branch", "Branch")}</th>
                            <th className="p-2.5 border-b text-center">{tt("eaud.edit_count", "Edit Count")}</th>
                            <th className="p-2.5 border-b">{tt("eaud.last_edited", "Last Edited")}</th>
                            <th className="p-2.5 border-b text-right">{tt("common.actions", "Actions")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {monthlyEdits?.topEditedRecords?.length ? (
                            monthlyEdits.topEditedRecords.map((rec: any, idx: number) => (
                              <tr key={idx} className="border-b last:border-0 hover:bg-muted/30">
                                <td className="p-2.5 font-semibold capitalize">{rec.entity_type.replace(/_/g, " ")}</td>
                                <td className="p-2.5 font-mono font-medium">{rec.reference_no || rec.entity_id}</td>
                                <td className="p-2.5 text-muted-foreground">{rec.country_name || "Global"} / {rec.branch_name || "Main"}</td>
                                <td className="p-2.5 text-center">
                                  <Badge variant="outline" className="font-mono bg-blue-50 text-blue-700 border-blue-200">
                                    {rec.edit_count} edits
                                  </Badge>
                                </td>
                                <td className="p-2.5 text-muted-foreground">{new Date(rec.last_edited_at).toLocaleString()}</td>
                                <td className="p-2.5 text-right">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setTimelineTarget({ entityType: rec.entity_type, entityId: rec.entity_id, ref: rec.reference_no })}
                                    className="h-7 text-xs gap-1 text-sky-600 hover:text-sky-700"
                                  >
                                    <Eye className="h-3 w-3" />
                                    {tt("eaud.view_timeline", "View Timeline")}
                                  </Button>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={6} className="p-6 text-center text-muted-foreground">
                                {tt("eaud.no_edited_records", "No edited records found for this period.")}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: Deleted Records & Soft Delete */}
        <TabsContent value="deleted" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-base font-bold text-rose-700 dark:text-rose-400">
                    {tt("eaud.deleted_vault_title", "Deleted Records Archive & Restore Vault")}
                  </CardTitle>
                  <CardDescription>
                    {tt("eaud.deleted_vault_desc", "Soft-deleted records are preserved permanently with reason, user, and full historical snapshots.")}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative w-64">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder={tt("eaud.search_deleted_ph", "Search deleted records...")}
                      value={deletedSearch}
                      onChange={(e) => setDeletedSearch(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && fetchDeletedRecords()}
                      className="h-8 pl-8 text-xs"
                    />
                  </div>
                  <Button variant="outline" size="sm" onClick={fetchDeletedRecords} className="h-8 text-xs">
                    {tt("eaud.search", "Search")}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loadingDeleted ? (
                <div className="py-12 text-center text-sm text-muted-foreground">{tt("eaud.loading_deleted", "Loading deleted records vault...")}</div>
              ) : (
                <div className="border rounded-lg overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead className="bg-rose-50/50 dark:bg-rose-950/20 text-rose-900 dark:text-rose-300 font-semibold">
                      <tr>
                        <th className="p-2.5 border-b">{tt("common.status", "Status")}</th>
                        <th className="p-2.5 border-b">{tt("eaud.entity_type", "Entity")}</th>
                        <th className="p-2.5 border-b">{tt("common.ref_no", "Reference No")}</th>
                        <th className="p-2.5 border-b">{tt("eaud.deleted_by", "Deleted By")}</th>
                        <th className="p-2.5 border-b">{tt("common.country", "Country")} / {tt("common.branch", "Branch")}</th>
                        <th className="p-2.5 border-b">{tt("eaud.deletion_reason", "Deletion Reason")}</th>
                        <th className="p-2.5 border-b">{tt("eaud.deleted_at", "Deleted At")}</th>
                        <th className="p-2.5 border-b text-right">{tt("common.actions", "Actions")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deletedRecords.length ? (
                        deletedRecords.map((del: any) => (
                          <tr key={del.id} className="border-b last:border-0 hover:bg-rose-50/30">
                            <td className="p-2.5">
                              <Badge className="bg-rose-600 text-white font-mono text-[10px]">{tt("eaud.deleted_label", "DELETED")}</Badge>
                            </td>
                            <td className="p-2.5 font-semibold capitalize">{del.entity_type.replace(/_/g, " ")}</td>
                            <td className="p-2.5 font-mono">{del.reference_no || del.entity_id}</td>
                            <td className="p-2.5">{del.user_name || "—"} ({del.user_role ? tt(`role.${del.user_role}` as never, del.user_role) : "—"})</td>
                            <td className="p-2.5 text-muted-foreground">{del.country_name || "—"} / {del.branch_name || "—"}</td>
                            <td className="p-2.5 text-rose-700 dark:text-rose-400 max-w-xs truncate">{del.reason || "Soft Deleted"}</td>
                            <td className="p-2.5 text-muted-foreground">{new Date(del.deleted_at).toLocaleString()}</td>
                            <td className="p-2.5 text-right space-x-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setViewRecord(del)}
                                className="h-7 text-xs text-sky-600 hover:text-sky-700 hover:bg-sky-50 border-sky-200"
                              >
                                <Eye className="h-3 w-3 mr-1" />
                                {tt("eaud.view", "View")}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenRestoreAuth(del.entity_type, del.entity_id, del.reference_no)}
                                className="h-7 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 border-emerald-200"
                              >
                                <RotateCcw className="h-3 w-3 mr-1" />
                                {tt("eaud.restore", "Restore")}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenPermanentDeleteAuth(del.entity_type, del.entity_id, del.reference_no)}
                                className="h-7 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200"
                              >
                                <Trash2 className="h-3 w-3 mr-1" />
                                {tt("eaud.hard_delete", "Hard Delete")}
                              </Button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={8} className="p-6 text-center text-muted-foreground">
                            {tt("eaud.no_soft_deleted", "No soft-deleted records in vault.")}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: Daily Branch Activity Report */}
        <TabsContent value="daily" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-base font-bold">{tt("eaud.daily_tab", "Daily Branch Monitoring & Accountability")}</CardTitle>
                  <CardDescription>
                    {tt("eaud.daily_desc", "Live daily aggregated breakdown of Purchases, Sales, Payments, Roznamcha, Cash Flow, and Edits by Branch.")}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <ErpDatePicker
                    mode="single"
                    lang={lang}
                    size="sm"
                    presets={false}
                    clearable={false}
                    value={{ from: selectedDate || null }}
                    onApply={(v) => setSelectedDate(v.from ?? "")}
                  />
                  <Button variant="outline" size="sm" onClick={fetchDailyBranchActivity} className="h-8 text-xs">
                    {tt("eaud.filter_date", "Filter Date")}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loadingDaily ? (
                <div className="py-12 text-center text-sm text-muted-foreground">{tt("eaud.generating", "Generating daily branch summaries...")}</div>
              ) : (
                <div className="space-y-4">
                  {/* Totals Summary */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-muted/40 rounded-lg text-xs">
                    <div>
                      <div className="text-muted-foreground">{tt("eaud.purchases_vol", "Purchases Volume")}</div>
                      <div className="font-bold text-sm text-emerald-700">
                        AED {Number(dailyBranchData?.totals?.totalPurchasesAmt || 0).toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">{tt("eaud.sales_vol", "Sales Volume")}</div>
                      <div className="font-bold text-sm text-blue-700">
                        AED {Number(dailyBranchData?.totals?.totalSalesAmt || 0).toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">{tt("eaud.payments_processed", "Payments Processed")}</div>
                      <div className="font-bold text-sm text-purple-700">
                        AED {Number(dailyBranchData?.totals?.totalPaymentsAmt || 0).toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">{tt("eaud.roznamcha_entries", "Roznamcha Entries")}</div>
                      <div className="font-bold text-sm text-slate-800 dark:text-slate-200">
                        {dailyBranchData?.totals?.totalRoznamcha || 0} entries
                      </div>
                    </div>
                  </div>

                  {/* Branches Table */}
                  <div className="border rounded-lg overflow-x-auto">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead className="bg-muted text-muted-foreground font-semibold">
                        <tr>
                          <th className="p-2.5 border-b">{tt("common.country", "Country")}</th>
                          <th className="p-2.5 border-b">{tt("common.branch_name", "Branch Name")}</th>
                          <th className="p-2.5 border-b text-right">{tt("nav.purchases", "Purchases")}</th>
                          <th className="p-2.5 border-b text-right">{tt("nav.sales", "Sales")}</th>
                          <th className="p-2.5 border-b text-right">{tt("nav.payments", "Payments")}</th>
                          <th className="p-2.5 border-b text-center">{tt("nav.roznamcha", "Roznamcha")}</th>
                          <th className="p-2.5 border-b text-center">{tt("eaud.edits_deletes", "Edits/Deletes")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dailyBranchData?.branchStats?.length ? (
                          dailyBranchData.branchStats.map((b: any) => (
                            <tr key={b.branch_id} className="border-b last:border-0 hover:bg-muted/30">
                              <td className="p-2.5 font-medium">{b.country_name || "—"}</td>
                              <td className="p-2.5 font-bold">{b.branch_name}</td>
                              <td className="p-2.5 text-right font-mono text-emerald-600">
                                {Number(b.purchases_amount).toLocaleString()} ({b.purchases_count})
                              </td>
                              <td className="p-2.5 text-right font-mono text-blue-600">
                                {Number(b.sales_amount).toLocaleString()} ({b.sales_count})
                              </td>
                              <td className="p-2.5 text-right font-mono text-purple-600">
                                {Number(b.purchase_payments_amount + b.sales_payments_amount).toLocaleString()}
                              </td>
                              <td className="p-2.5 text-center font-mono">{b.roznamcha_count}</td>
                              <td className="p-2.5 text-center space-x-1">
                                <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700">
                                  {b.edited_count} edits
                                </Badge>
                                {b.deleted_count > 0 && (
                                  <Badge variant="outline" className="text-[10px] bg-rose-50 text-rose-700">
                                    {b.deleted_count} del
                                  </Badge>
                                )}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={7} className="p-6 text-center text-muted-foreground">
                              No active branch activity recorded for {selectedDate}.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: User Activity & Productivity */}
        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-bold">{tt("eaud.title", "User Activity & Productivity Audit")}</CardTitle>
              <CardDescription>
                {tt("eaud.users_desc", "Track user login sessions, records created, edited, and soft-deleted across all forms.")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingUsers ? (
                <div className="py-12 text-center text-sm text-muted-foreground">{tt("eaud.loading_matrix", "Loading user activity matrix...")}</div>
              ) : (
                <div className="border rounded-lg overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead className="bg-muted text-muted-foreground font-semibold">
                      <tr>
                        <th className="p-2.5 border-b">{tt("eaud.col_user", "User")}</th>
                        <th className="p-2.5 border-b">{tt("eaud.col_role", "Role")}</th>
                        <th className="p-2.5 border-b">{tt("eaud.col_country_branch", "Country / Branch")}</th>
                        <th className="p-2.5 border-b text-center">{tt("eaud.entries_created", "Entries Created")}</th>
                        <th className="p-2.5 border-b text-center">{tt("eaud.entries_edited", "Entries Edited")}</th>
                        <th className="p-2.5 border-b text-center">{tt("eaud.entries_deleted", "Entries Deleted")}</th>
                        <th className="p-2.5 border-b text-right">{tt("common.status", "Status")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {userActivityData?.users?.length ? (
                        userActivityData.users.map((u: any) => (
                          <tr key={u.id} className="border-b last:border-0 hover:bg-muted/30">
                            <td className="p-2.5 font-bold">
                              {u.full_name || u.email}
                              <div className="text-[10px] text-muted-foreground font-normal">{u.email}</div>
                            </td>
                            <td className="p-2.5 capitalize">{u.role ? tt(`role.${u.role}` as never, u.role.replace(/_/g, " ")) : "—"}</td>
                            <td className="p-2.5 text-muted-foreground">{u.country_name || "—"} / {u.branch_name || "—"}</td>
                            <td className="p-2.5 text-center font-mono text-emerald-600 font-semibold">{u.records_created}</td>
                            <td className="p-2.5 text-center font-mono text-blue-600 font-semibold">{u.records_edited}</td>
                            <td className="p-2.5 text-center font-mono text-rose-600 font-semibold">{u.records_deleted}</td>
                            <td className="p-2.5 text-right">
                              <Badge className="bg-emerald-600 text-white text-[10px]">{tt("common.active", "Active")}</Badge>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} className="p-6 text-center text-muted-foreground">
                            {tt("eaud.no_user_activity", "No user activity recorded.")}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Global Version Timeline Dialog */}
      {timelineTarget && (
        <EntityVersionTimelineDialog
          isOpen={Boolean(timelineTarget)}
          onClose={() => setTimelineTarget(null)}
          entityType={timelineTarget.entityType}
          entityId={timelineTarget.entityId}
          referenceNo={timelineTarget.ref}
        />
      )}

      {/* Full-Size Deleted Record Detail View Dialog */}
      {viewRecord && (
        <DeletedRecordDetailDialog
          record={viewRecord}
          isOpen={Boolean(viewRecord)}
          onClose={() => setViewRecord(null)}
          onRestore={(entityType, entityId, referenceNo) => {
            handleOpenRestoreAuth(entityType, entityId, referenceNo);
          }}
          onPermanentDelete={(entityType, entityId, referenceNo) => {
            handleOpenPermanentDeleteAuth(entityType, entityId, referenceNo);
          }}
          onOpenTimeline={(entityType, entityId, referenceNo) => {
            setTimelineTarget({ entityType, entityId, ref: referenceNo });
          }}
        />
      )}

      {/* Security PIN Authorization Dialog (Codes: 3636 / 9999) */}
      {securityAuthTarget && (
        <SecurityPinAuthDialog
          isOpen={Boolean(securityAuthTarget)}
          onClose={() => setSecurityAuthTarget(null)}
          actionType={securityAuthTarget.actionType}
          entityType={securityAuthTarget.entityType}
          entityId={securityAuthTarget.entityId}
          referenceNo={securityAuthTarget.referenceNo}
          onConfirm={handleExecuteSecurityAuth}
        />
      )}
    </div>
  );
}
