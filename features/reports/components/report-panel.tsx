"use client";

import { useState, useEffect, useCallback } from "react";
import { Globe2, AlertCircle, Loader2 } from "lucide-react";
import { t, type UiKey } from "@/lib/i18n/ui";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { cn } from "@/lib/utils";
import { ReportFilterBar, type ReportFilterValues, type ReportMetaItem } from "./report-filter-bar";
import { ReportKpiCards } from "./report-kpi-cards";
import { ReportDataTable, getColumnsForReportType } from "./report-data-table";
import { ReportExportToolbar } from "./report-export-toolbar";

type ReportScopeLevel = "global" | "country" | "branch";

type ReportMeta = {
  scope: {
    level: ReportScopeLevel;
    scopeLabel: string;
    lockedCountryId: string | null;
    lockedBranchId: string | null;
  };
  countries: ReportMetaItem[];
  mainBranches: ReportMetaItem[];
  cityBranches: ReportMetaItem[];
  users: { id: string; name: string }[];
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
};

type Props = {
  lang: SupportedLanguage;
  initialScopeLevel?: ReportScopeLevel;
};

const DEFAULT_FILTERS: ReportFilterValues = {
  countryId: "all",
  mainBranchId: "all",
  branchId: "all",
  fromDate: "",
  toDate: "",
  currency: "USD",
  userId: "all",
  reportType: "roznamcha"
};

export function ReportPanel({ lang, initialScopeLevel = "global" }: Props) {
  const _ = (key: UiKey, fallback?: string) => t(lang, key, fallback);
  const isRTL = ["ar", "ur", "fa", "ps"].includes(lang);

  const [meta, setMeta] = useState<ReportMeta | null>(null);
  const [metaLoading, setMetaLoading] = useState(true);
  const [metaError, setMetaError] = useState<string | null>(null);

  const [filters, setFilters] = useState<ReportFilterValues>(DEFAULT_FILTERS);
  const [reportResult, setReportResult] = useState<ReportResult | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  // Load metadata on mount
  useEffect(() => {
    let cancelled = false;
    setMetaLoading(true);
    fetch("/api/erp/reports/meta")
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        if (json.ok) {
          setMeta(json.data);
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
  }, []);

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

    try {
      const res = await fetch(`/api/erp/reports/scoped?${params}`);
      const json = await res.json();
      if (json.ok) {
        setReportResult(json.data);
      } else {
        setReportError(json.error?.message || "Report fetch failed");
      }
    } catch (err: any) {
      setReportError(err.message || "Network error");
    } finally {
      setReportLoading(false);
    }
  }, [lang]);

  const handleFilterChange = (key: keyof ReportFilterValues, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleReset = () => {
    setFilters({
      ...DEFAULT_FILTERS,
      reportType: meta?.reportTypes[0]?.key ?? "roznamcha"
    });
    setReportResult(null);
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

  const reportData = reportResult?.data ?? [];
  const reportSummary = reportResult?.summary ?? {};

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
        currencies={meta?.currencies ?? []}
        reportTypes={meta?.reportTypes ?? []}
        lockedCountryId={scope?.lockedCountryId}
        lockedBranchId={scope?.lockedBranchId}
        showCountryFilter={scope?.level === "global"}
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
          {/* Export Toolbar */}
          <ReportExportToolbar
            lang={lang}
            reportType={filters.reportType}
            reportTitle={_(panelTitleKey)}
            data={reportData}
            summary={reportSummary}
            scopeLabel={reportResult?.scope?.label ?? scope?.scopeLabel ?? ""}
            generatedAt={reportResult?.generatedAt}
            isLoading={reportLoading}
            onReload={handleApply}
            currency={filters.currency}
          />

          {/* KPI Cards */}
          <ReportKpiCards
            lang={lang}
            summary={reportSummary}
            reportType={filters.reportType}
            currency={filters.currency !== "all" ? filters.currency : "USD"}
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
            columns={getColumnsForReportType(filters.reportType, lang, filters.currency !== "all" ? filters.currency : "USD")}
            rows={reportData}
            isLoading={reportLoading}
            hasError={Boolean(reportError)}
            currency={filters.currency !== "all" ? filters.currency : "USD"}
            searchable
            pageSize={50}
            stripedRows
          />
        </>
      )}
    </div>
  );
}
