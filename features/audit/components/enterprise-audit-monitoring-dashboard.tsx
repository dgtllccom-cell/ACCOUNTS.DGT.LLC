"use client";

import React, { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Printer
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
    <div className="space-y-6 p-6" dir={isRtl ? "rtl" : "ltr"}>
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Layers className="h-6 w-6 text-sky-600" />
            Enterprise Audit, Monitoring & Accountability Center
          </h1>
          <p className="text-sm text-muted-foreground">
            Multi-country audit trails, immutable version timelines, soft-delete archive, and daily branch accountability.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-sky-50 text-sky-700 border-sky-300 dark:bg-sky-950/40">
            Immutable Audit Trail Active
          </Badge>
          <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-1">
            <Printer className="h-4 w-4" />
            Print Report
          </Button>
        </div>
      </div>

      {actionMessage && (
        <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-md text-sm flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          {actionMessage}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-sky-200 dark:border-sky-900 bg-sky-50/40 dark:bg-sky-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase text-sky-800 dark:text-sky-300">
              {tt("eaud.entries_created", "Entries Created")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{monthlyEdits?.stats?.total_created || "—"}</div>
            <p className="text-xs text-muted-foreground">{tt("eaud.this_month", "This Month")}</p>
          </CardContent>
        </Card>

        <Card className="border-blue-200 dark:border-blue-900 bg-blue-50/40 dark:bg-blue-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase text-blue-800 dark:text-blue-300">
              Entries Edited & Traced
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{monthlyEdits?.stats?.total_edits || "0"}</div>
            <p className="text-xs text-muted-foreground">{monthlyEdits?.stats?.unique_entities_edited || 0} unique records</p>
          </CardContent>
        </Card>

        <Card className="border-rose-200 dark:border-rose-900 bg-rose-50/40 dark:bg-rose-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase text-rose-800 dark:text-rose-300">
              Soft Deleted (Archived)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-600">{monthlyEdits?.stats?.total_deleted || "0"}</div>
            <p className="text-xs text-muted-foreground">{monthlyEdits?.stats?.total_restored || 0} restored</p>
          </CardContent>
        </Card>

        <Card className="border-emerald-200 dark:border-emerald-900 bg-emerald-50/40 dark:bg-emerald-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase text-emerald-800 dark:text-emerald-300">
              Active Branches Monitored
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-700">{dailyBranchData?.totals?.totalBranches || "—"}</div>
            <p className="text-xs text-muted-foreground">Live Global Feed</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid grid-cols-2 md:grid-cols-4 lg:w-[650px]">
          <TabsTrigger value="edits" className="gap-1.5">
            <History className="h-4 w-4" />
            {tt("eaud.monthly_tab", "Edit History")}
          </TabsTrigger>
          <TabsTrigger value="deleted" className="gap-1.5">
            <Trash2 className="h-4 w-4" />
            {tt("eaud.entries_deleted", "Deleted Records")}
          </TabsTrigger>
          <TabsTrigger value="daily" className="gap-1.5">
            <Building2 className="h-4 w-4" />
            {tt("eaud.daily_tab", "Daily Activity")}
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-1.5">
            <Users className="h-4 w-4" />
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
                    Every modification across Purchases, Sales, Roznamcha, and Ledgers creates an immutable timeline version.
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={fetchMonthlyEdits} className="gap-1">
                  <RotateCcw className="h-3.5 w-3.5" />
                  Refresh
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
                              <Badge variant="secondary">{m.edit_count} edits</Badge>
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
                              <Badge variant="secondary">{c.edit_count} edits</Badge>
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
                        Click on any record below to view its complete date-by-date version history, exact time, and field-level diffs.
                      </p>
                      <div className="text-xs font-medium text-sky-700">
                        Total Traceable Audit Events: {monthlyEdits?.stats?.total_edits || 0}
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
                                    View Timeline
                                  </Button>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={6} className="p-6 text-center text-muted-foreground">
                                No edited records found for this period.
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
                    Deleted Records Archive & Restore Vault
                  </CardTitle>
                  <CardDescription>
                    Soft-deleted records are preserved permanently with reason, user, and full historical snapshots.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative w-64">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Search deleted records..."
                      value={deletedSearch}
                      onChange={(e) => setDeletedSearch(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && fetchDeletedRecords()}
                      className="h-8 pl-8 text-xs"
                    />
                  </div>
                  <Button variant="outline" size="sm" onClick={fetchDeletedRecords} className="h-8 text-xs">
                    Search
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
                            <td className="p-2.5">{del.user_name || "Admin"} ({del.user_role || "User"})</td>
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
                                View
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenRestoreAuth(del.entity_type, del.entity_id, del.reference_no)}
                                className="h-7 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 border-emerald-200"
                              >
                                <RotateCcw className="h-3 w-3 mr-1" />
                                Restore
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenPermanentDeleteAuth(del.entity_type, del.entity_id, del.reference_no)}
                                className="h-7 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200"
                              >
                                <Trash2 className="h-3 w-3 mr-1" />
                                Hard Delete
                              </Button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={8} className="p-6 text-center text-muted-foreground">
                            No soft-deleted records in vault.
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
                    Live daily aggregated breakdown of Purchases, Sales, Payments, Roznamcha, Cash Flow, and Edits by Branch.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="h-8 w-36 text-xs"
                  />
                  <Button variant="outline" size="sm" onClick={fetchDailyBranchActivity} className="h-8 text-xs">
                    Filter Date
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
                Track user login sessions, records created, edited, and soft-deleted across all forms.
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
                        <th className="p-2.5 border-b">User</th>
                        <th className="p-2.5 border-b">Role</th>
                        <th className="p-2.5 border-b">Country / Branch</th>
                        <th className="p-2.5 border-b text-center">Entries Created</th>
                        <th className="p-2.5 border-b text-center">Entries Edited</th>
                        <th className="p-2.5 border-b text-center">Entries Deleted</th>
                        <th className="p-2.5 border-b text-right">Status</th>
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
                            <td className="p-2.5 capitalize">{u.role?.replace(/_/g, " ")}</td>
                            <td className="p-2.5 text-muted-foreground">{u.country_name || "Global"} / {u.branch_name || "Main"}</td>
                            <td className="p-2.5 text-center font-mono text-emerald-600 font-semibold">{u.records_created}</td>
                            <td className="p-2.5 text-center font-mono text-blue-600 font-semibold">{u.records_edited}</td>
                            <td className="p-2.5 text-center font-mono text-rose-600 font-semibold">{u.records_deleted}</td>
                            <td className="p-2.5 text-right">
                              <Badge className="bg-emerald-600 text-white text-[10px]">Active</Badge>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} className="p-6 text-center text-muted-foreground">
                            No user activity recorded.
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
