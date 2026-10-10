"use client";

// DGT ERP V21 LOCAL visual upgrade of the existing Super Admin edit-history route.
// Read-only audit interface. All rows/KPIs come from the ORIGINAL authenticated ERP API.
// It does not write to any API, ledger, stock, or audit record.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight,
  Clock3, Download, Eye, FileText, Filter, History, LockKeyhole,
  MoreVertical, Printer, RefreshCw, Search, ShieldAlert, ShieldCheck,
  SlidersHorizontal, XCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ErpDatePicker } from "@/components/ui/erp-date-picker";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";
import { downloadCsv } from "@/features/branches/components/branch-report-export";
import { openScopedGenericReport } from "@/lib/reports/open-scoped-report";
import { VersionComparisonModal } from "./version-comparison-modal";

type Risk = "High" | "Medium" | "Low";
type Approval = "Pending" | "Rejected" | "Completed" | "Approved";
interface AuditRow {
  entity_type: string;
  entity_id: string;
  reference_no?: string;
  module: string;
  country_name?: string;
  branch_name?: string;
  party_name?: string;
  user_id: string;
  user_name: string;
  user_role: string;
  reason?: string;
  risk_level: Risk;
  approval_status: Approval;
  total_versions: number;
  edit_count: number;
  original_created_at: string;
  created_at: string;
}
interface AuditKpis {
  editsToday: number; editsThisWeek: number; editsThisMonth: number;
  pendingApprovals: number; highRiskChanges: number; rejectedChanges: number;
  expiredAccess: number; totalCountries: number; totalBranches: number;
  totalModules: number; totalUsers: number;
}
interface Filters {
  country: string; branch: string; module: string; user: string;
  risk: string; approval: string; from: string; to: string; search: string;
}
interface Option { id: string; name: string }
const DEFAULT_FILTERS: Filters = {
  country: "all", branch: "all", module: "all", user: "all", risk: "all",
  approval: "all", from: "", to: "", search: ""
};
const EMPTY_KPIS: AuditKpis = {
  editsToday: 0, editsThisWeek: 0, editsThisMonth: 0,
  pendingApprovals: 0, highRiskChanges: 0, rejectedChanges: 0,
  expiredAccess: 0, totalCountries: 0, totalBranches: 0,
  totalModules: 0, totalUsers: 0
};
const selectClass = "h-9 min-w-0 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";
const pillClass = "inline-flex items-center justify-center rounded-full px-2.5 py-1 text-[10px] font-bold";

function mobilePageSize(): number {
  if (typeof window === "undefined") return 50;
  if (window.innerWidth < 640) return window.innerHeight >= 850 ? 6 : window.innerHeight >= 730 ? 5 : 4;
  if (window.innerWidth < 1200) return window.innerHeight >= 900 ? 12 : 8;
  return 50;
}
function dateText(value?: string): string {
  if (!value) return "-";
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d.toLocaleString(undefined, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-";
}
function normalizeKpis(input: unknown): AuditKpis {
  const obj = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const result = { ...EMPTY_KPIS };
  (Object.keys(result) as Array<keyof AuditKpis>).forEach((key) => {
    const n = Number(obj[key]);
    result[key] = Number.isFinite(n) && n >= 0 ? n : 0;
  });
  return result;
}

export function EditHistoryV21LocalView() {
  const lang = useActiveLanguage();
  const rtl = ["ur", "ar", "fa", "ps"].includes(lang);
  const tt = useCallback((key: string, fallback: string) => t(lang, key, fallback), [lang]);
  const [draft, setDraft] = useState<Filters>({ ...DEFAULT_FILTERS });
  const [applied, setApplied] = useState<Filters>({ ...DEFAULT_FILTERS });
  const [filterOpen, setFilterOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [countries, setCountries] = useState<Option[]>([]);
  const [branches, setBranches] = useState<Option[]>([]);
  const [records, setRecords] = useState<AuditRow[]>([]);
  const [kpis, setKpis] = useState<AuditKpis>({ ...EMPTY_KPIS });
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [autoSize, setAutoSize] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshToken, setRefreshToken] = useState(0);
  const [selectedRow, setSelectedRow] = useState<AuditRow | null>(null);
  const [timeline, setTimeline] = useState<unknown[]>([]);
  const [comparisonOpen, setComparisonOpen] = useState(false);

  // Different phones get genuinely different page lengths, based on AVAILABLE viewport height.
  // Once a user selects a fixed page size, their choice is respected.
  useEffect(() => {
    if (!autoSize) return;
    const resize = () => setPageSize((current) => {
      const next = mobilePageSize();
      if (next !== current) setPage(1);
      return next;
    });
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [autoSize]);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([
      fetch("/api/erp/locations/countries", { credentials: "same-origin" }).then((r) => { if (!r.ok) throw new Error(); return r.json(); }),
      fetch("/api/erp/locations/branches/city?scope=all", { credentials: "same-origin" }).then((r) => { if (!r.ok) throw new Error(); return r.json(); })
    ]).then(([countryResult, branchResult]) => {
      if (cancelled) return;
      if (countryResult.status === "fulfilled" && Array.isArray(countryResult.value?.countries)) {
        setCountries(countryResult.value.countries.filter((r: Option) => r?.id && r?.name));
      }
      if (branchResult.status === "fulfilled" && Array.isArray(branchResult.value?.data?.branches)) {
        setBranches(branchResult.value.data.branches.filter((r: Option) => r?.id && r?.name));
      }
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const qp = new URLSearchParams({ limit: String(pageSize), offset: String((page - 1) * pageSize) });
    if (applied.country !== "all") qp.set("countryId", applied.country);
    if (applied.branch !== "all") qp.set("cityBranchId", applied.branch);
    if (applied.module !== "all") qp.set("module", applied.module);
    if (applied.user !== "all") qp.set("user", applied.user);
    if (applied.risk !== "all") qp.set("riskLevel", applied.risk);
    if (applied.approval !== "all") qp.set("approvalStatus", applied.approval);
    if (applied.from) qp.set("fromDate", applied.from);
    if (applied.to) qp.set("toDate", applied.to);
    if (applied.search.trim()) qp.set("search", applied.search.trim());
    setLoading(true);
    setError("");
    fetch(`/api/erp/audit/edit-history?${qp}`, { signal: controller.signal, credentials: "same-origin", cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Audit request failed (${response.status})`);
        const data = await response.json();
        if (!data.success || !Array.isArray(data.records)) throw new Error("Audit records unavailable");
        return data;
      })
      .then((data) => {
        if (controller.signal.aborted) return;
        setRecords(data.records);
        setTotal(Math.max(0, Number(data.total) || 0));
        setKpis(normalizeKpis(data.kpis));
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setRecords([]); setTotal(0); setKpis({ ...EMPTY_KPIS });
        setError(err instanceof Error ? err.message : t(lang, "audit.no_versioned_records", "Audit records unavailable"));
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [applied, lang, page, pageSize, refreshToken]);

  const moduleOptions = useMemo(() => Array.from(new Set(records.map((r) => r.module).filter(Boolean))).sort(), [records]);
  const userOptions = useMemo(() => Array.from(new Map(records.filter((r) => r.user_id).map((r) => [r.user_id, r.user_name])).entries()), [records]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const filteredCount = Object.entries(applied).filter(([k, v]) => k !== "search" ? v !== "all" && v !== "" : !!v.trim()).length;
  const update = (key: keyof Filters, value: string) => setDraft((old) => ({ ...old, [key]: value }));
  const applyFilters = () => { setPage(1); setApplied({ ...draft }); setFilterOpen(false); };
  const resetFilters = () => {
    setDraft({ ...DEFAULT_FILTERS }); setApplied({ ...DEFAULT_FILTERS }); setPage(1); setFilterOpen(false);
  };
  const refresh = () => setRefreshToken((n) => n + 1);

  async function openVersion(row: AuditRow) {
    setError("");
    try {
      const qp = new URLSearchParams({ entityType: row.entity_type, entityId: row.entity_id });
      const r = await fetch(`/api/erp/audit/version-timeline?${qp}`, { credentials: "same-origin", cache: "no-store" });
      if (!r.ok) throw new Error(`Timeline request failed (${r.status})`);
      const data = await r.json();
      if (!data.success || !Array.isArray(data.timeline)) throw new Error(t(lang, "audit.no_versioned_records", "Timeline unavailable"));
      setTimeline(data.timeline);
      setSelectedRow(row);
      setComparisonOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t(lang, "audit.no_versioned_records", "Timeline unavailable"));
    }
  }
  function exportCsv() {
    setActionsOpen(false);
    if (!records.length) return;
    const header = ["#", "Bill / Ref No", "Module", "Country", "Branch", "Record / Party", "Total Edits", "Original Date", "Last Edited At", "Last Edited By", "Risk", "Approval Status"];
    const rows = records.map((r, idx) => [
      String((page - 1) * pageSize + idx + 1), r.reference_no || r.entity_id,
      r.module, r.country_name || "", r.branch_name || "", r.party_name || "",
      String(r.edit_count ?? 0), dateText(r.original_created_at), dateText(r.created_at),
      r.user_name, r.risk_level, r.approval_status
    ]);
    // Export is deliberately limited to the loaded, authorized page of real records.
    downloadCsv(`edit_version_history_page_${page}.csv`, [header, ...rows]);
  }
  function printReport() {
    setActionsOpen(false);
    if (!records.length) return;
    void openScopedGenericReport({
      title: tt("audit.edit_history_title", "All Edit / Version History - All Countries & Branches"),
      lang,
      orientation: "landscape",
      columns: [
        { key: (r) => r.reference_no || r.entity_id || "", label: tt("audit.bill_ref_no", "Bill / Ref No") },
        { key: "module", label: tt("audit.filter_module", "Module") },
        { key: (r) => r.country_name || "", label: tt("audit.filter_country", "Country") },
        { key: (r) => r.branch_name || "", label: tt("audit.filter_branch", "Branch") },
        { key: "created_at", label: tt("audit.last_edited_at", "Last Edited At"), format: "date" },
        { key: "user_name", label: tt("audit.th_edited_by", "Last Edited By") },
        { key: "risk_level", label: tt("audit.risk_level", "Risk") },
        { key: "approval_status", label: tt("audit.approval_status", "Approval Status") }
      ],
      rows: records as unknown as Record<string, unknown>[]
    });
  }
  const stats = [
    { label: tt("audit.total_versions", "Total Edits"), value: total, icon: History, color: "text-blue-600", surface: "bg-blue-50 dark:bg-blue-950/40" },
    { label: tt("audit.this_week", "This Week"), value: kpis.editsThisWeek, icon: Clock3, color: "text-emerald-600", surface: "bg-emerald-50 dark:bg-emerald-950/40" },
    { label: tt("audit.this_month", "This Month"), value: kpis.editsThisMonth, icon: CalendarDays, color: "text-violet-600", surface: "bg-violet-50 dark:bg-violet-950/40" },
    { label: tt("audit.kpi_pending_approvals", "Pending Approvals"), value: kpis.pendingApprovals, icon: ShieldAlert, color: "text-amber-600", surface: "bg-amber-50 dark:bg-amber-950/40" },
    { label: tt("audit.status_rejected", "Rejected"), value: kpis.rejectedChanges, icon: XCircle, color: "text-rose-600", surface: "bg-rose-50 dark:bg-rose-950/40" },
    { label: tt("audit.kpi_expired_access", "Expired Access"), value: kpis.expiredAccess, icon: LockKeyhole, color: "text-slate-600", surface: "bg-slate-100 dark:bg-slate-800" }
  ];
  const riskBadge = (risk: string) => risk === "High" ? "bg-rose-100 text-rose-700" : risk === "Medium" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700";
  const statusBadge = (status: string) => status === "Pending" ? "bg-amber-100 text-amber-700" : status === "Rejected" ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700";
  const statusText = (status: string) => status === "Pending" ? tt("audit.status_pending", "Pending") : status === "Rejected" ? tt("audit.status_rejected", "Rejected") : tt("audit.status_approved", "Approved");

  return (
    <main data-dgt-v21-local="edit-history" dir={rtl ? "rtl" : "ltr"} className="mx-auto w-full max-w-[1720px] space-y-3 p-3 text-slate-900 antialiased sm:p-4 lg:p-5 dark:text-slate-100">
      <div className="flex items-center gap-2 text-[11px] text-slate-500">
        <button type="button" onClick={() => window.history.back()} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-semibold hover:text-blue-600 dark:border-slate-700 dark:bg-slate-900" aria-label={tt("common.back", "Back")}>
          <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" />
        </button>
        <span>{tt("audit.edit_history_title", "All Edit / Version History - All Countries & Branches")}</span>
      </div>
      <section className="relative rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4 dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-sm"><History className="h-5 w-5" /></div>
            <div className="min-w-0">
              <h1 className="text-base font-extrabold leading-tight tracking-tight sm:text-xl">{tt("audit.edit_history_title", "All Edit / Version History - All Countries & Branches")}</h1>
              <p className="mt-1 text-[11px] font-medium text-slate-500">{tt("audit.edit_history_subtitle_v2", "Track every change. Ensure compliance. Maintain a complete and immutable audit trail.")}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Popover open={filterOpen} onOpenChange={setFilterOpen}>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" className="h-9 gap-1.5 rounded-xl border-blue-200 px-3 text-xs font-bold text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-300">
                  <SlidersHorizontal className="h-4 w-4" />{tt("common.filter", "Filters")}
                  {filteredCount > 0 && <span className="rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] text-white">{filteredCount}</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent align={rtl ? "start" : "end"} sideOffset={8} className="z-[1000010] w-[min(94vw,360px)] space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-700 dark:bg-slate-900" dir={rtl ? "rtl" : "ltr"}>
                <div className="flex items-center justify-between gap-2"><h2 className="text-sm font-extrabold">{tt("common.filter", "Filters")} &amp; {tt("common.search", "Search")}</h2><Filter className="h-4 w-4 text-blue-600" /></div>
                <label className="relative block"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><Input value={draft.search} onChange={(e) => update("search", e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") applyFilters(); }} placeholder={tt("audit.search_placeholder", "Search Bill / Reference No...")} className="h-9 pl-9 text-xs" /></label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <label className="space-y-1"><span className="text-[11px] font-semibold">{tt("audit.filter_country", "Country")}</span><select value={draft.country} onChange={(e) => update("country", e.target.value)} className={selectClass}><option value="all">{tt("audit.filter_all_countries", "All Countries")}</option>{countries.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
                  <label className="space-y-1"><span className="text-[11px] font-semibold">{tt("audit.filter_branch", "Branch")}</span><select value={draft.branch} onChange={(e) => update("branch", e.target.value)} className={selectClass}><option value="all">{tt("audit.filter_all_branches", "All Branches")}</option>{branches.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
                  <label className="space-y-1"><span className="text-[11px] font-semibold">{tt("audit.filter_module", "Module")}</span><select value={draft.module} onChange={(e) => update("module", e.target.value)} className={selectClass}><option value="all">{tt("audit.filter_all_modules", "All Modules")}</option>{moduleOptions.map((r) => <option key={r} value={r}>{r}</option>)}</select></label>
                  <label className="space-y-1"><span className="text-[11px] font-semibold">{tt("common.user", "User")}</span><select value={draft.user} onChange={(e) => update("user", e.target.value)} className={selectClass}><option value="all">{tt("audit.filter_all_users", "All Users")}</option>{userOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
                  <label className="space-y-1"><span className="text-[11px] font-semibold">{tt("audit.risk_level", "Risk Level")}</span><select value={draft.risk} onChange={(e) => update("risk", e.target.value)} className={selectClass}><option value="all">{tt("audit.filter_all_risk_levels", "All Risk Levels")}</option>{["High", "Medium", "Low"].map((v) => <option key={v} value={v}>{tt(`audit.risk_${v.toLowerCase()}`, v)}</option>)}</select></label>
                  <label className="space-y-1"><span className="text-[11px] font-semibold">{tt("audit.approval_status", "Status")}</span><select value={draft.approval} onChange={(e) => update("approval", e.target.value)} className={selectClass}><option value="all">{tt("audit.filter_all_statuses", "All Statuses")}</option><option value="Completed">{tt("audit.status_approved", "Approved")}</option><option value="Pending">{tt("audit.status_pending", "Pending")}</option><option value="Rejected">{tt("audit.status_rejected", "Rejected")}</option></select></label>
                </div>
                <div className="space-y-1"><span className="text-[11px] font-semibold">{tt("audit.date_range", "Date Range")}</span><ErpDatePicker mode="range" lang={lang} size="sm" value={{ from: draft.from || null, to: draft.to || null }} onApply={(v) => setDraft((d) => ({ ...d, from: v.from ?? "", to: v.to ?? "" }))} /></div>
                <div className="flex gap-2 border-t border-slate-100 pt-3 dark:border-slate-800"><Button type="button" variant="outline" onClick={resetFilters} className="h-9 flex-1 text-xs">{tt("common.reset", "Reset")}</Button><Button type="button" onClick={applyFilters} className="h-9 flex-1 bg-blue-600 text-xs hover:bg-blue-700">{tt("report.apply_filters", "Apply Filters")}</Button></div>
              </PopoverContent>
            </Popover>
            <Popover open={actionsOpen} onOpenChange={setActionsOpen}>
              <PopoverTrigger asChild><Button type="button" variant="outline" aria-label={tt("common.actions", "More actions")} className="h-9 w-9 rounded-xl border-slate-200 p-0"><MoreVertical className="h-4 w-4" /></Button></PopoverTrigger>
              <PopoverContent align={rtl ? "start" : "end"} className="z-[1000010] w-48 space-y-1 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                <button type="button" onClick={exportCsv} disabled={!records.length} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-slate-800"><Download className="h-4 w-4 text-blue-600" />{tt("audit.export_csv", "Export CSV")}</button>
                <button type="button" onClick={printReport} disabled={!records.length} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-slate-800"><FileText className="h-4 w-4 text-violet-600" />{tt("audit.audit_pdf", "Audit PDF")}</button>
                <button type="button" onClick={printReport} disabled={!records.length} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-slate-800"><Printer className="h-4 w-4 text-emerald-600" />{tt("common.print", "Print Report")}</button>
                <button type="button" onClick={() => { setActionsOpen(false); refresh(); }} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"><RefreshCw className="h-4 w-4 text-slate-500" />{tt("audit.refresh", "Refresh")}</button>
              </PopoverContent>
            </Popover>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[10px] font-semibold text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200"><ShieldCheck className="h-4 w-4 shrink-0" />{tt("audit.immutable_banner", "Immutable Audit Trail - All records are read-only and cannot be altered or deleted.")}</div>
      </section>

      <section aria-label={tt("audit.edit_activity_summary", "Edit Activity Summary")} className="grid grid-cols-3 gap-2 lg:grid-cols-6">
        {stats.map((s) => <article key={s.label} className="flex min-w-0 items-center gap-2 rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm dark:border-slate-700 dark:bg-slate-900"><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${s.surface} ${s.color}`}><s.icon className="h-4 w-4" /></span><div className="min-w-0"><strong className={`block text-lg leading-tight ${s.color}`}>{s.value.toLocaleString()}</strong><span className="block break-words text-[10px] font-semibold leading-tight text-slate-500">{s.label}</span></div></article>)}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-3 py-3 dark:border-slate-800 sm:px-4"><h2 className="text-xs font-extrabold sm:text-sm">{tt("audit.register_title", "Version History & Audit Register")}</h2><span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-300">{total.toLocaleString()} {tt("audit.showing_records", "records")}</span></div>
        {error && <div role="alert" className="border-b border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-300">{error}</div>}
        <div className="hidden overflow-x-auto xl:block"><table className="w-full min-w-[1000px] text-left text-[11px]"><thead className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase text-slate-500 dark:border-slate-700 dark:bg-slate-800/70"><tr><th className="px-3 py-3">#</th><th className="px-3 py-3">{tt("audit.last_edited_at", "Date & Time")}</th><th className="px-3 py-3">{tt("audit.th_module", "Module")}</th><th className="px-3 py-3">{tt("audit.th_bill_ref", "Record / Reference")}</th><th className="px-3 py-3">{tt("audit.th_change_type", "Change Type")}</th><th className="px-3 py-3">{tt("audit.th_edited_by", "User")}</th><th className="px-3 py-3">{tt("audit.th_risk", "Risk")}</th><th className="px-3 py-3">{tt("audit.th_status", "Status")}</th><th className="px-3 py-3 text-center">{tt("audit.th_action", "Action")}</th></tr></thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">{loading ? <tr><td colSpan={9} className="p-10 text-center text-slate-500"><RefreshCw className="mx-auto mb-2 h-5 w-5 animate-spin" />{tt("audit.loading_edit_history", "Loading enterprise edit & version history...")}</td></tr> : records.length === 0 ? <tr><td colSpan={9} className="p-10 text-center text-slate-500">{tt("audit.no_versioned_records", "No versioned records found matching current criteria.")}</td></tr> : records.map((row, idx) => <tr key={`${row.entity_type}:${row.entity_id}:${idx}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/50"><td className="px-3 py-3 text-slate-500">{(page - 1) * pageSize + idx + 1}</td><td className="px-3 py-3">{dateText(row.created_at)}</td><td className="px-3 py-3 font-semibold">{row.module}</td><td className="px-3 py-3 font-mono font-bold text-blue-700 dark:text-blue-300">{row.reference_no || row.entity_id}</td><td className="px-3 py-3">{row.reason || tt("audit.field_update", "Field Update")}</td><td className="px-3 py-3">{row.user_name || "-"}</td><td className="px-3 py-3"><span className={`${pillClass} ${riskBadge(row.risk_level)}`}>{tt(`audit.risk_${String(row.risk_level).toLowerCase()}`, row.risk_level)}</span></td><td className="px-3 py-3"><span className={`${pillClass} ${statusBadge(row.approval_status)}`}>{statusText(row.approval_status)}</span></td><td className="px-3 py-3 text-center"><Button type="button" variant="outline" size="sm" onClick={() => void openVersion(row)} className="h-8 rounded-lg border-blue-200 px-2.5 text-blue-700"><Eye className="h-4 w-4" /><span className="sr-only">{tt("audit.view_changes", "View Changes")}</span></Button></td></tr>)}</tbody></table></div>
        <div className="space-y-2 p-2.5 xl:hidden">{loading ? <div className="p-8 text-center text-xs text-slate-500"><RefreshCw className="mx-auto mb-2 h-5 w-5 animate-spin" />{tt("audit.loading_edit_history", "Loading enterprise edit & version history...")}</div> : records.length === 0 ? <p className="p-8 text-center text-xs text-slate-500">{tt("audit.no_versioned_records", "No versioned records found matching current criteria.")}</p> : records.map((row, idx) => <button key={`${row.entity_type}:${row.entity_id}:${idx}`} type="button" onClick={() => void openVersion(row)} className="flex w-full min-w-0 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 p-2.5 text-start transition hover:border-blue-300 dark:border-slate-700 dark:bg-slate-800/40"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-950"><History className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block truncate font-mono text-[11px] font-bold text-blue-700 dark:text-blue-300">{row.reference_no || row.entity_id}</span><span className="block truncate text-[10px] text-slate-500">{row.module} / {row.country_name || "-"} / {row.branch_name || "-"}</span><span className="block truncate text-[10px] text-slate-500">{dateText(row.created_at)} / {row.user_name || "-"}</span></span><span className="flex shrink-0 flex-col items-end gap-1"><span className={`${pillClass} ${riskBadge(row.risk_level)}`}>{tt(`audit.risk_${String(row.risk_level).toLowerCase()}`, row.risk_level)}</span><span className={`${pillClass} ${statusBadge(row.approval_status)}`}>{statusText(row.approval_status)}</span></span><ChevronRight className="h-4 w-4 shrink-0 text-slate-400 rtl:rotate-180" /></button>)}</div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50/80 px-3 py-3 text-[11px] dark:border-slate-800 dark:bg-slate-800/30 sm:px-4"><span className="font-medium text-slate-500">{tt("audit.showing_range", "Showing")} <strong>{total > 0 ? (page - 1) * pageSize + 1 : 0}</strong> {tt("audit.showing_to", "to")} <strong>{Math.min(page * pageSize, total)}</strong> {tt("audit.showing_of", "of")} <strong>{total}</strong> {tt("audit.showing_records", "records")}</span><div className="flex items-center gap-2"><label className="sr-only" htmlFor="dgt-v21-pagesize">{tt("audit.per_page", "per page")}</label><select id="dgt-v21-pagesize" value={pageSize} onChange={(e) => { setAutoSize(false); setPage(1); setPageSize(Number(e.target.value)); }} className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">{[4, 5, 6, 8, 10, 12, 25, 50, 100].filter((n) => n === pageSize || n === 4 || n === 5 || n === 10 || n === 25 || n === 50 || n === 100).map((n) => <option key={n} value={n}>{n} {tt("audit.per_page", "per page")}</option>)}</select><Button type="button" variant="outline" size="icon" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} aria-label={tt("common.back", "Previous page")} className="h-8 w-8"><ChevronLeft className="h-4 w-4 rtl:rotate-180" /></Button><span className="rounded-lg bg-blue-600 px-2.5 py-1.5 text-[11px] font-bold text-white">{page} / {totalPages}</span><Button type="button" variant="outline" size="icon" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} aria-label={tt("common.next", "Next page")} className="h-8 w-8"><ChevronRight className="h-4 w-4 rtl:rotate-180" /></Button></div></div>
      </section>
      {comparisonOpen && selectedRow && <VersionComparisonModal isOpen={comparisonOpen} onClose={() => setComparisonOpen(false)} versionData={selectedRow} lifecycleTimeline={timeline} />}
    </main>
  );
}
