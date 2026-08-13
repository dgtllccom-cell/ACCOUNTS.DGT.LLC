"use client";

import { useState, useEffect, useCallback } from "react";
import { Globe2, AlertCircle, Loader2, X, Printer, History } from "lucide-react";
import { t, type UiKey } from "@/lib/i18n/ui";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { cn } from "@/lib/utils";
import { ReportFilterBar, type ReportFilterValues, type ReportMetaItem } from "./report-filter-bar";
import { ReportKpiCards } from "./report-kpi-cards";
import { ReportDataTable, getColumnsForReportType } from "./report-data-table";
import { ReportExportToolbar } from "./report-export-toolbar";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { openGenericErpReport } from "@/lib/reports/open-generic-erp-report";

type ReportScopeLevel = "global" | "country" | "branch";

type ReportMeta = {
  scope: {
    level: ReportScopeLevel;
    scopeLabel: string;
    lockedCountryId: string | null;
    lockedCountryName?: string | null;
    lockedMainBranchId?: string | null;
    lockedMainBranchName?: string | null;
    lockedBranchId: string | null;
    lockedBranchName?: string | null;
  };
  countries: ReportMetaItem[];
  mainBranches: ReportMetaItem[];
  cityBranches: ReportMetaItem[];
  users: { id: string; name: string; assignments?: Array<{ country_id?: string | null; country_branch_id?: string | null; city_branch_id?: string | null }> }[];
  projects?: { id: string; name: string; country_id?: string; country_branch_id?: string; city_branch_id?: string }[];
  currencies: { code: string; name: string }[];
  reportTypes: { key: string; icon: string }[];
};

type ReportResult = {
  reportType: string;
  scope: {
    level: string;
    label: string;
    enforced: { countryId: string | null; branchId: string | null };
  };
  lang: string;
  currency: string;
  data: Record<string, any>[];
  summary: Record<string, any>;
  records: number;
  generatedAt: string;
  generatedBy?: { id: string; name: string };
  applied?: Record<string, any>;
  history?: Record<string, any[]>;
  sourceTables?: string[];
};

type Props = {
  lang: SupportedLanguage;
  initialScopeLevel?: ReportScopeLevel;
  viewerName?: string;
  viewerId?: string;
  workspace?: "standard" | "super-admin";
};

const DEFAULT_FILTERS: ReportFilterValues = {
  countryId: "all",
  scopeMode: "entire-country",
  mainBranchId: "all",
  branchId: "all",
  project: "all",
  fromDate: "",
  toDate: "",
  currency: "USD",
  userId: "all",
  reportType: "roznamcha"
};

export function ReportPanel({ lang: initialLang, initialScopeLevel = "global", viewerName, viewerId, workspace = "standard" }: Props) {
  const lang = useActiveLanguage() || initialLang;
  const _ = (key: UiKey, fallback?: string) => t(lang, key, fallback);
  const isRTL = ["ar", "ur", "fa", "ps"].includes(lang);

  const [meta, setMeta] = useState<ReportMeta | null>(null);
  const [metaLoading, setMetaLoading] = useState(true);
  const [metaError, setMetaError] = useState<string | null>(null);

  const [filters, setFilters] = useState<ReportFilterValues>(DEFAULT_FILTERS);
  const [reportResult, setReportResult] = useState<ReportResult | null>(null);
  const [appliedFilters, setAppliedFilters] = useState<ReportFilterValues | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [density, setDensity] = useState<"compact" | "comfortable">("comfortable");
  const [visibleColumnKeys, setVisibleColumnKeys] = useState<string[]>([]);
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [selectedRow, setSelectedRow] = useState<Record<string, any> | null>(null);
  const reportData = reportResult?.data ?? [];
  const reportSummary = reportResult?.summary ?? {};
  const appliedReportType = reportResult?.reportType ?? filters.reportType;
  const appliedCurrency = reportResult?.applied?.currency ?? filters.currency;
  const baseColumns = getColumnsForReportType(
    appliedReportType,
    lang,
    appliedCurrency !== "all" ? appliedCurrency : "USD"
  );

  // Load metadata on mount
  useEffect(() => {
    let cancelled = false;
    setMetaLoading(true);
    fetch(`/api/erp/reports/meta?lang=${lang}${workspace === "super-admin" ? "&workspace=super-admin" : ""}`)
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        if (json.ok) {
          setMeta(json.data);
          setFilters((prev) => ({
            ...prev,
            countryId: json.data.scope?.lockedCountryId ?? json.data.countries?.[0]?.id ?? prev.countryId,
            mainBranchId: json.data.scope?.lockedMainBranchId ?? prev.mainBranchId,
            branchId: json.data.scope?.lockedBranchId ?? prev.branchId
          }));
          // Set initial report type from first available
          if (json.data.reportTypes?.length) {
            setFilters((prev) => ({ ...prev, reportType: json.data.reportTypes[0].key }));
          }
        } else {
          setMetaError(json.error?.message || "Failed to load metadata");
        }
      })
      .catch((err) => {
        if (!cancelled) setMetaError(err.message);
      })
      .finally(() => {
        if (!cancelled) setMetaLoading(false);
      });
    return () => { cancelled = true; };
  }, [workspace, lang]);

  const fetchReport = useCallback(async (currentFilters: ReportFilterValues) => {
    setReportLoading(true);
    setReportError(null);
    setHasLoaded(true);

    const params = new URLSearchParams({
      reportType: currentFilters.reportType,
      lang,
      ...(currentFilters.countryId && currentFilters.countryId !== "all" && { countryId: currentFilters.countryId }),
      ...(currentFilters.branchId && currentFilters.branchId !== "all" && { branchId: currentFilters.branchId }),
      ...(currentFilters.mainBranchId && currentFilters.mainBranchId !== "all" && { mainBranchId: currentFilters.mainBranchId }),
      ...(currentFilters.fromDate && { fromDate: currentFilters.fromDate }),
      ...(currentFilters.toDate && { toDate: currentFilters.toDate }),
      ...(currentFilters.currency && currentFilters.currency !== "all" && { currency: currentFilters.currency }),
      ...(currentFilters.userId && currentFilters.userId !== "all" && { userId: currentFilters.userId })
    });
    if (workspace === "super-admin") {
      params.set("scopeMode", currentFilters.scopeMode);
      if (currentFilters.project !== "all") params.set("project", currentFilters.project);
    }

    try {
      const endpoint = workspace === "super-admin" ? "/api/erp/reports/super-admin" : "/api/erp/reports/scoped";
      const res = await fetch(`${endpoint}?${params}`, { cache: "no-store" });
      const json = await res.json();
      if (json.ok) {
        setReportResult(json.data);
        setAppliedFilters({ ...currentFilters });
      } else {
        setReportError(json.error?.message || "Report fetch failed");
      }
    } catch (err: any) {
      setReportError(err.message || "Network error");
    } finally {
      setReportLoading(false);
    }
  }, [lang, workspace]);

  const handleFilterChange = (key: keyof ReportFilterValues, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleReset = () => {
    setFilters({
      ...DEFAULT_FILTERS,
      countryId: meta?.scope.lockedCountryId ?? meta?.countries[0]?.id ?? "all",
      reportType: meta?.reportTypes[0]?.key ?? (workspace === "super-admin" ? "ledger" : "roznamcha")
    });
    setReportResult(null);
    setAppliedFilters(null);
    setHasLoaded(false);
  };

  const handleApply = () => {
    fetchReport(filters);
  };

  const scope = meta?.scope;

  // Panel title and subtitle
  const panelTitleKey: UiKey = scope?.level === "global"
    ? "report.panel_super_admin"
    : scope?.level === "country"
    ? "report.panel_country"
    : "report.panel_branch";

  const panelSubtitleKey: UiKey = scope?.level === "global"
    ? "report.panel_subtitle_super"
    : scope?.level === "country"
    ? "report.panel_subtitle_country"
    : "report.panel_subtitle_branch";

  useEffect(() => {
    setVisibleColumnKeys((current) => {
      if (current.length === 0) {
        return baseColumns.map((column) => column.key);
      }
      const allowedKeys = new Set(baseColumns.map((column) => column.key));
      const next = current.filter((key) => allowedKeys.has(key));
      const missing = baseColumns.map((column) => column.key).filter((key) => !next.includes(key));
      return next.length ? [...next, ...missing] : baseColumns.map((column) => column.key);
    });
    setColumnOrder((current) => {
      const allowed = baseColumns.map((column) => column.key);
      const kept = current.filter((key) => allowed.includes(key));
      return [...kept, ...allowed.filter((key) => !kept.includes(key))];
    });
  }, [appliedReportType, lang]);

  useEffect(() => {
    if (!reportResult || typeof window === "undefined") return;
    const storageKey = `erp-report-columns:${viewerId || "anonymous"}:${appliedReportType}`;
    try {
      const saved = JSON.parse(window.localStorage.getItem(storageKey) || "null");
      if (saved && Array.isArray(saved.visible) && Array.isArray(saved.order)) {
        const allowed = new Set(baseColumns.map((column) => column.key));
        const visible = saved.visible.filter((key: string) => allowed.has(key));
        const order = saved.order.filter((key: string) => allowed.has(key));
        setVisibleColumnKeys(visible.length ? visible : baseColumns.map((column) => column.key));
        setColumnOrder([...order, ...baseColumns.map((column) => column.key).filter((key) => !order.includes(key))]);
      }
    } catch {
      // Ignore invalid local preferences; allowed columns remain server/schema controlled.
    }
  }, [appliedReportType, reportResult, viewerId]);

  const orderedColumns = columnOrder.map((key) => baseColumns.find((column) => column.key === key)).filter(Boolean) as typeof baseColumns;
  const visibleColumns = orderedColumns.filter((column) => visibleColumnKeys.includes(column.key));
  const applied = reportResult?.applied ?? {};
  const previewFilters = [
    { label: t(lang, "report.filter_report_type"), value: t(lang, `report.${appliedReportType.replace(/-/g, "_")}` as UiKey, appliedReportType) },
    { label: t(lang, "report.filter_country"), value: applied.country ?? scope?.lockedCountryName ?? "—" },
    { label: t(lang, "report.filter_scope" as UiKey, "Scope"), value: t(lang, `report.scope_${String(applied.scopeMode || "").replace(/-/g, "_")}` as UiKey, applied.scopeMode || reportResult?.scope?.label || "—") },
    { label: t(lang, "report.filter_main_branch"), value: applied.mainBranch ?? "—" },
    { label: t(lang, "report.filter_branch"), value: applied.branch ?? "—" },
    { label: t(lang, "report.filter_project" as UiKey, "Project"), value: applied.project ?? t(lang, "report.filter_all_projects" as UiKey, "All Projects") },
    { label: t(lang, "report.filter_user"), value: applied.userId ? meta?.users.find((item) => item.id === applied.userId)?.name || applied.userId : t(lang, "report.filter_all_users") },
    { label: t(lang, "report.filter_date_from"), value: applied.fromDate ?? "—" },
    { label: t(lang, "report.filter_date_to"), value: applied.toDate ?? "—" },
    { label: t(lang, "report.filter_currency"), value: applied.currency ?? "all" },
    { label: t(lang, "report.generated_by" as UiKey, "Generated by"), value: reportResult?.generatedBy?.name ?? viewerName ?? "—" },
    { label: t(lang, "report.generated_at"), value: reportResult?.generatedAt ? new Date(reportResult.generatedAt).toLocaleString() : "—" }
  ];
  const companyInfo = {
    name: "DIGITAL DOCK ERP",
    printedBy: viewerName || "ERP User",
    country: previewFilters[1]?.value,
    branch: applied.branch || applied.mainBranch || applied.country || "—",
    currency: applied.currency !== "all" ? applied.currency : "USD",
    reportPeriod: applied.fromDate || applied.toDate
      ? `${applied.fromDate || "Start"} To ${applied.toDate || "Today"}`
      : reportResult?.generatedAt
      ? `As of ${new Date(reportResult.generatedAt).toLocaleDateString("en-GB")}`
      : "Current Period"
  };

  const toggleColumn = (key: string) => {
    setVisibleColumnKeys((current) => {
      if (current.includes(key)) {
        return current.length === 1 ? current : current.filter((item) => item !== key);
      }
      return [...current, key];
    });
  };

  const moveColumn = (key: string, direction: -1 | 1) => {
    setColumnOrder((current) => {
      const index = current.indexOf(key);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  useEffect(() => {
    if (!reportResult || typeof window === "undefined") return;
    window.localStorage.setItem(`erp-report-columns:${viewerId || "anonymous"}:${appliedReportType}`, JSON.stringify({ visible: visibleColumnKeys, order: columnOrder }));
  }, [visibleColumnKeys, columnOrder, appliedReportType, reportResult, viewerId]);

  if (metaLoading) {
    return (
      <div className="flex h-60 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (metaError) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 dark:bg-rose-950/20 dark:border-rose-900 p-8 flex items-center gap-3">
        <AlertCircle className="h-5 w-5 text-rose-500 flex-shrink-0" />
        <div>
          <p className="font-bold text-rose-700 dark:text-rose-400">Failed to load report metadata</p>
          <p className="text-sm text-rose-600 dark:text-rose-500 mt-1">{metaError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir={isRTL ? "rtl" : "ltr"}>

      {/* Panel Header */}
      <div className={cn(
        "relative overflow-hidden rounded-3xl p-6 text-white shadow-xl",
        scope?.level === "global"
          ? "bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700"
          : scope?.level === "country"
          ? "bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700"
          : "bg-gradient-to-br from-blue-600 via-blue-600 to-indigo-700"
      )}>
        {/* Background blobs */}
        <div className="absolute top-0 right-0 h-40 w-40 rounded-full bg-white/10 -translate-y-1/2 translate-x-1/2 blur-2xl" />
        <div className="absolute bottom-0 left-0 h-32 w-32 rounded-full bg-white/10 translate-y-1/2 -translate-x-1/2 blur-2xl" />

        <div className="relative flex flex-col sm:flex-row sm:items-center gap-4">
          <div className={cn(
            "rounded-2xl p-3 bg-white/20 backdrop-blur-sm w-fit",
          )}>
            <Globe2 className="h-7 w-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">
              {_(panelTitleKey)}
            </h1>
            <p className="text-sm text-white/75 mt-0.5">
              {_(panelSubtitleKey)}
            </p>
          </div>
          {/* Scope badge */}
          <div className="sm:ml-auto">
            <div className="flex items-center gap-2 rounded-xl bg-white/15 backdrop-blur-sm border border-white/20 px-4 py-2">
              <div className="h-2 w-2 rounded-full bg-emerald-300 animate-pulse" />
              <span className="text-xs font-black text-white uppercase tracking-wider">
                {scope?.scopeLabel}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <ReportFilterBar
        lang={lang}
        filters={filters}
        onFilterChange={handleFilterChange}
        onReset={handleReset}
        onApply={handleApply}
        countries={meta?.countries ?? []}
        mainBranches={meta?.mainBranches ?? []}
        cityBranches={meta?.cityBranches ?? []}
        users={meta?.users ?? []}
        projects={meta?.projects ?? []}
        currencies={meta?.currencies ?? []}
        reportTypes={meta?.reportTypes ?? []}
        lockedCountryId={scope?.lockedCountryId}
        lockedCountryName={scope?.lockedCountryName ?? undefined}
        lockedBranchId={scope?.lockedBranchId}
        lockedBranchName={scope?.lockedBranchName ?? scope?.lockedMainBranchName ?? undefined}
        showCountryFilter
        showBranchFilter
        showUserFilter
        showCurrencyFilter
        showReportTypeFilter
      />

      {/* Report Content */}
      {!hasLoaded && !reportLoading && (
        <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40">
          <div className="text-center">
            <Globe2 className="h-8 w-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-400 dark:text-slate-500">
              Select filters and click Apply to generate the report
            </p>
          </div>
        </div>
      )}

      {hasLoaded && (
        <>
          {reportResult && (
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 dark:border-indigo-900/60 dark:bg-indigo-950/20">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-xs font-black uppercase tracking-wider text-indigo-900 dark:text-indigo-200">
                  {t(lang, "report.applied_filters" as UiKey, "Applied report snapshot")}
                </h2>
                <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-black text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                  {t(lang, "report.real_data" as UiKey, "Real database data")} · {(reportResult.sourceTables ?? []).join(", ")}
                </span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {previewFilters.map((item) => (
                  <div key={item.label} className="rounded-xl border border-white/80 bg-white/80 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/80">
                    <div className="text-[9px] font-black uppercase tracking-wide text-slate-400">{item.label}</div>
                    <div className="mt-0.5 truncate text-xs font-bold text-slate-800 dark:text-slate-200">{item.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Export Toolbar */}
          <ReportExportToolbar
            lang={lang}
            reportType={appliedReportType}
            reportTitle={`${_(panelTitleKey)} — ${t(lang, `report.${appliedReportType.replace(/-/g, "_")}` as UiKey, appliedReportType)}`}
            data={reportData}
            summary={reportSummary}
            scopeLabel={reportResult?.scope?.label ?? scope?.scopeLabel ?? ""}
            generatedAt={reportResult?.generatedAt}
            isLoading={reportLoading}
            onReload={() => appliedFilters && fetchReport(appliedFilters)}
            currency={appliedCurrency}
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            density={density}
            onDensityChange={setDensity}
            columns={orderedColumns}
            visibleColumnKeys={visibleColumnKeys}
            onToggleColumn={toggleColumn}
            onMoveColumn={moveColumn}
            previewFilters={previewFilters}
            companyInfo={companyInfo}
          />

          {/* KPI Cards */}
          <ReportKpiCards
            lang={lang}
            summary={reportSummary}
            reportType={appliedReportType}
            currency={appliedCurrency !== "all" ? appliedCurrency : "USD"}
            isLoading={reportLoading}
          />

          {/* Error State */}
          {reportError && !reportLoading && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 dark:bg-rose-950/20 dark:border-rose-900 p-5 flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-rose-500 flex-shrink-0" />
              <div>
                <p className="font-bold text-rose-700 dark:text-rose-400">{_("report.error")}</p>
                <p className="text-xs text-rose-600 dark:text-rose-500 mt-0.5">{reportError}</p>
              </div>
            </div>
          )}

          {/* Data Table */}
          <ReportDataTable
            lang={lang}
            columns={visibleColumns}
            rows={reportData}
            isLoading={reportLoading}
            hasError={Boolean(reportError)}
            currency={appliedCurrency !== "all" ? appliedCurrency : "USD"}
            searchable={false}
            pageSize={50}
            stripedRows
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            density={density}
            onRowClick={setSelectedRow}
          />
        </>
      )}

      {selectedRow && reportResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedRow(null); }}>
          <div className="max-h-[90vh] w-full max-w-4xl overflow-auto rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950">
            <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
              <div>
                <h2 className="text-base font-black text-slate-900 dark:text-white">{t(lang, "report.record_details" as UiKey, "Report record details")}</h2>
                <p className="text-xs text-slate-500">{String(selectedRow.reference || selectedRow.serial || selectedRow.id)}</p>
              </div>
              <button
                type="button"
                className="ml-auto flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-black text-white hover:bg-indigo-700"
                onClick={() => openGenericErpReport({ title: `${t(lang, "report.record_details" as UiKey, "Record details")} — ${String(selectedRow.reference || selectedRow.id)}`, lang, columns: visibleColumns, rows: [selectedRow], summary: reportSummary, filters: previewFilters, companyInfo })}
              >
                <Printer className="h-4 w-4" /> {t(lang, "report.print")}
              </button>
              <button type="button" aria-label="Close" onClick={() => setSelectedRow(null)} className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-100 dark:border-slate-800 dark:hover:bg-slate-900"><X className="h-4 w-4" /></button>
            </div>
            <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(selectedRow).filter(([key]) => !["sourceTable"].includes(key)).map(([key, value]) => (
                <div key={key} className="rounded-2xl border border-slate-200 p-3 dark:border-slate-800">
                  <div className="text-[9px] font-black uppercase tracking-wide text-slate-400">{key.replace(/([A-Z])/g, " $1")}</div>
                  <div className="mt-1 break-words text-xs font-semibold text-slate-800 dark:text-slate-200">{value === null || value === undefined || value === "" ? "—" : typeof value === "object" ? JSON.stringify(value) : String(value)}</div>
                </div>
              ))}
            </div>
            <div className="border-t border-slate-200 p-5 dark:border-slate-800">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-black text-slate-900 dark:text-white"><History className="h-4 w-4" /> {t(lang, "report.activity_history" as UiKey, "Activity and edit history")}</h3>
              {(reportResult.history?.[String(selectedRow.historyRecordId || selectedRow.id)] ?? []).length ? (
                <div className="space-y-2">
                  {(reportResult.history?.[String(selectedRow.historyRecordId || selectedRow.id)] ?? []).map((entry: any) => (
                    <div key={entry.id} className="rounded-xl bg-slate-50 p-3 text-xs dark:bg-slate-900">
                      <div className="font-bold text-slate-800 dark:text-slate-200">{entry.action} · {new Date(entry.created_at).toLocaleString()} · {entry.actor_id || "—"}</div>
                      <div className="mt-1 text-slate-500">{(entry.changedFields ?? []).join(", ") || t(lang, "report.no_field_changes" as UiKey, "No field-level changes recorded")}</div>
                    </div>
                  ))}
                </div>
              ) : <p className="text-xs text-slate-500">{t(lang, "report.no_history" as UiKey, "No edit-history entries recorded for this record.")}</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
