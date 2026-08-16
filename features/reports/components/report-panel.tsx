"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createPortal } from "react-dom";
import {
  Globe2,
  AlertCircle,
  Loader2,
  X,
  Printer,
  History,
  ChevronRight,
  Search,
  MoreVertical,
  RefreshCcw,
  SlidersHorizontal,
  ChevronDown,
  Building2,
  Users,
  DollarSign,
  Receipt,
  FileSpreadsheet
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DownloadActionIcon } from "@/components/ui/download-action-icon";
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

function fmtNum(val: number | string | null | undefined): string {
  const n = Number(val);
  if (!Number.isFinite(n)) return "0.00";
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function ReportPanel({ lang: initialLang, initialScopeLevel = "global", viewerName, viewerId, workspace = "standard" }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
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
  
  // Executive summary and filter drawer state
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [showAllCountries, setShowAllCountries] = useState(false);
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);
  const [actionsSlot, setActionsSlot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setActionsSlot(document.getElementById("erp-page-actions-slot"));
  }, []);

  const reportData = reportResult?.data ?? [];
  const reportSummary = reportResult?.summary ?? {};
  const appliedReportType = reportResult?.reportType ?? filters.reportType;
  const appliedCurrency = reportResult?.applied?.currency ?? filters.currency;
  const baseColumns = getColumnsForReportType(
    appliedReportType,
    lang,
    appliedCurrency !== "all" ? appliedCurrency : "USD"
  );

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
          const urlType = searchParams.get("type");
          const targetReportType = urlType || json.data.reportTypes?.[0]?.key || "roznamcha";
          const initialFilterVals: ReportFilterValues = {
            ...DEFAULT_FILTERS,
            reportType: targetReportType,
            countryId: json.data.scope?.lockedCountryId ?? json.data.countries?.[0]?.id ?? "all",
            mainBranchId: json.data.scope?.lockedMainBranchId ?? "all",
            branchId: json.data.scope?.lockedBranchId ?? "all"
          };
          setFilters(initialFilterVals);
          // Auto-fetch initial report
          void fetchReport(initialFilterVals);
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
  }, [workspace, lang, searchParams, fetchReport]);

  const handleFilterChange = (key: keyof ReportFilterValues, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleReset = () => {
    const nextFilters: ReportFilterValues = {
      ...DEFAULT_FILTERS,
      countryId: meta?.scope.lockedCountryId ?? meta?.countries[0]?.id ?? "all",
      reportType: meta?.reportTypes[0]?.key ?? (workspace === "super-admin" ? "ledger" : "roznamcha")
    };
    setFilters(nextFilters);
    setReportResult(null);
    setAppliedFilters(null);
    setHasLoaded(false);
    void fetchReport(nextFilters);
  };

  const handleApply = () => {
    fetchReport(filters);
  };

  const scope = meta?.scope;

  const panelTitleKey: UiKey = scope?.level === "global"
    ? "report.panel_super_admin"
    : scope?.level === "country"
    ? "report.panel_country"
    : "report.panel_branch";

  const panelTitle = _(panelTitleKey);

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
  }, [appliedReportType, lang, baseColumns]);

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
      // Ignore
    }
  }, [appliedReportType, reportResult, viewerId, baseColumns]);

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

  // Executive summary metrics calculation
  const totalEntriesCount = reportResult?.records || reportData.length || 0;
  const totalCreditVal = Number(reportSummary?.credit || reportSummary?.totalCredit || reportSummary?.totalIncome || 0);
  const totalDebitVal = Number(reportSummary?.debit || reportSummary?.totalDebit || reportSummary?.totalExpense || 0);
  const netBalanceVal = Number(reportSummary?.balance || reportSummary?.netBalance || reportSummary?.totalAmount || (totalCreditVal - totalDebitVal));
  const clearedCount = Number(reportSummary?.clearedCount || reportSummary?.postedCount || 0);
  const remainingCount = Math.max(0, totalEntriesCount - clearedCount);
  const currentCurrencySymbol = appliedCurrency !== "all" ? appliedCurrency : "AED";

  // Active country / branch names for Card 1
  const selectedCountryName = meta?.countries.find((c) => c.id === filters.countryId)?.name || scope?.lockedCountryName || "United Arab Emirates";
  const selectedBranchName = meta?.cityBranches.find((b) => b.id === filters.branchId)?.name || meta?.mainBranches.find((b) => b.id === filters.mainBranchId)?.name || scope?.lockedBranchName || "UNITED ARAB EMIRATES MAIN BRANCH";

  if (metaLoading) {
    return (
      <div className="flex h-64 w-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-xs font-semibold text-slate-500">Loading Report Engine...</p>
        </div>
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

  const topActionsContent = (
    <div className="flex items-center gap-2">
      <Button type="button" variant="ghost" size="sm" className="gap-2 text-xs font-semibold" onClick={() => router.back()}>
        <ChevronRight className="h-4 w-4 rotate-180" aria-hidden />
        Back
      </Button>
      <Button
        type="button"
        variant={filtersOpen ? "default" : "outline"}
        size="sm"
        className="gap-2 text-xs font-semibold"
        onClick={() => setFiltersOpen((v) => !v)}
      >
        <SlidersHorizontal className="h-4 w-4" aria-hidden />
        {filtersOpen ? "Hide Filters" : "Search / Filters"}
      </Button>
      <div className="relative">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2 text-xs font-semibold"
          onClick={() => setActionsMenuOpen((v) => !v)}
        >
          <MoreVertical className="h-4 w-4" />
          Actions
        </Button>
        {actionsMenuOpen ? (
          <div
            className="absolute right-0 top-full z-50 mt-1.5 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-800 dark:bg-slate-900 animate-in fade-in zoom-in-95"
            onMouseLeave={() => setActionsMenuOpen(false)}
          >
            <button
              type="button"
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 text-left"
              onClick={() => {
                setActionsMenuOpen(false);
                if (appliedFilters) fetchReport(appliedFilters);
              }}
            >
              <RefreshCcw className="h-3.5 w-3.5" />
              Reload Report
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 text-left"
              onClick={() => {
                setActionsMenuOpen(false);
                openGenericErpReport({
                  title: `${panelTitle} — ${t(lang, `report.${appliedReportType.replace(/-/g, "_")}` as UiKey, appliedReportType)}`,
                  lang,
                  columns: visibleColumns,
                  rows: reportData,
                  summary: reportSummary,
                  filters: previewFilters,
                  companyInfo
                });
              }}
            >
              <Printer className="h-3.5 w-3.5" />
              Print / PDF Document
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 text-left"
              onClick={() => {
                setActionsMenuOpen(false);
                const csvRows = [
                  visibleColumns.map((c) => c.label),
                  ...reportData.map((r) => visibleColumns.map((c) => String(r[c.key] ?? "")))
                ];
                const csvStr = csvRows.map((r) => r.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")).join("\n");
                const blob = new Blob(["\uFEFF" + csvStr], { type: "text/csv;charset=utf-8;" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `report_${appliedReportType}_${new Date().toISOString().slice(0, 10)}.csv`;
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              <DownloadActionIcon className="h-3.5 w-3.5" />
              Excel / CSV Export
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );

  return (
    <div className="w-full space-y-4 text-foreground" dir={isRTL ? "rtl" : "ltr"}>
      {/* Action portal mount */}
      {actionsSlot && createPortal(topActionsContent, actionsSlot)}

      {/* Header Bar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              {panelTitle}
            </h1>
            <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-300 uppercase">
              {t(lang, `report.${appliedReportType.replace(/-/g, "_")}` as UiKey, appliedReportType)}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Generated Date: {reportResult?.generatedAt ? new Date(reportResult.generatedAt).toLocaleString() : new Date().toLocaleString()}
          </p>
        </div>

        {/* Fallback top buttons if action slot is not in layout */}
        {!actionsSlot && topActionsContent}
      </div>

      {/* 4 Executive KPI Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3.5">
        {/* Card 1: Branch & User Details */}
        <div className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
          <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-slate-100 dark:border-slate-800 bg-blue-50/60 dark:bg-blue-900/15">
            <div className="bg-blue-600 p-1 rounded-full text-white flex-shrink-0">
              <Users className="h-3.5 w-3.5" />
            </div>
            <h4 className="text-xs font-black uppercase tracking-wider text-blue-800 dark:text-blue-400">
              1. BRANCH & USER DETAILS
            </h4>
          </div>
          <div className="p-3.5 flex flex-col gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400 h-full">
            <div className="flex justify-between items-center">
              <span>COUNTRY:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{selectedCountryName}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>BRANCH NAME:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 uppercase truncate max-w-[180px]">{selectedBranchName}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>USER ID:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 uppercase text-[9px] font-mono">{viewerId || "1001-000000000000000000"}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>USER NAME:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 uppercase">{viewerName || "SUPER ADMIN"}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>ROLE:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 uppercase">{scope?.level ? scope.level.toUpperCase() : "SUPER ADMIN"}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>DATE & TIME:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}, {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true })}</span>
            </div>
            <div className="flex justify-between items-center mt-auto pt-1.5">
              <span>STATUS:</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded text-[10px]">ACTIVE</span>
            </div>
          </div>
        </div>

        {/* Card 2: Global Financial Summary */}
        <div className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
          <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-slate-100 dark:border-slate-800 bg-emerald-50/60 dark:bg-emerald-900/15">
            <div className="bg-emerald-600 p-1 rounded-full text-white flex-shrink-0">
              <DollarSign className="h-3.5 w-3.5" />
            </div>
            <h4 className="text-xs font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-400">
              2. GLOBAL FINANCIAL SUMMARY
            </h4>
          </div>
          <div className="p-3.5 flex flex-col gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400 h-full">
            <div className="flex justify-between items-center">
              <span>TOTAL GLOBAL ENTRIES:</span>
              <span className="font-black text-slate-800 dark:text-slate-200">{totalEntriesCount}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>TOTAL CREDIT ({currentCurrencySymbol}):</span>
              <span className="font-black text-emerald-600 dark:text-emerald-400 font-mono">{fmtNum(totalCreditVal)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-rose-600 dark:text-rose-400">TOTAL DEBIT ({currentCurrencySymbol}):</span>
              <span className="font-black text-rose-600 dark:text-rose-400 font-mono">{fmtNum(totalDebitVal)}</span>
            </div>
            <div className="flex justify-between items-center mt-auto pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="text-slate-700 dark:text-slate-300 font-bold">BALANCE ({currentCurrencySymbol}):</span>
              <span className="font-black text-blue-600 dark:text-blue-400 font-mono text-sm">{fmtNum(netBalanceVal)}</span>
            </div>
          </div>
        </div>

        {/* Card 3: Bill Entries Summary */}
        <div className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
          <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-slate-100 dark:border-slate-800 bg-purple-50/60 dark:bg-purple-900/15">
            <div className="bg-purple-600 p-1 rounded-full text-white flex-shrink-0">
              <Receipt className="h-3.5 w-3.5" />
            </div>
            <h4 className="text-xs font-black uppercase tracking-wider text-purple-800 dark:text-purple-400">
              3. BILL ENTRIES SUMMARY
            </h4>
          </div>
          <div className="p-3.5 flex flex-col gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400 h-full">
            <div className="flex justify-between items-center">
              <span>TOTAL BILL ENTRIES:</span>
              <span className="font-black text-slate-800 dark:text-slate-200">{totalEntriesCount}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>CLEARED ENTRIES:</span>
              <span className="font-black text-emerald-600 dark:text-emerald-400">{clearedCount}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-rose-600">REMAINING ENTRIES:</span>
              <span className="font-black text-rose-600">{remainingCount}</span>
            </div>
            <div className="flex justify-between items-center mt-auto pt-2 border-t border-slate-100 dark:border-slate-800 text-[10px]">
              <span>SYSTEM STATUS:</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">ONLINE & SYNCED</span>
            </div>
          </div>
        </div>

        {/* Card 4: All Countries Report Breakdown */}
        <button
          type="button"
          onClick={() => setShowAllCountries(!showAllCountries)}
          className={cn(
            "flex flex-col rounded-xl border transition-all duration-200 text-left overflow-hidden h-full group",
            showAllCountries
              ? "border-orange-500 bg-orange-50/30 shadow-md dark:border-orange-500/50 dark:bg-orange-950/20"
              : "border-slate-200 bg-white shadow-sm hover:border-orange-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
          )}
        >
          <div className={cn(
            "flex items-center justify-between px-3.5 py-2.5 border-b w-full transition-colors",
            showAllCountries
              ? "border-orange-200 bg-orange-100/50 dark:border-orange-900/50 dark:bg-orange-900/30"
              : "border-slate-100 bg-orange-50/60 dark:border-slate-800 dark:bg-orange-900/15"
          )}>
            <div className="flex items-center gap-2">
              <div className="bg-orange-600 p-1 rounded-full text-white flex-shrink-0">
                <Globe2 className="h-3.5 w-3.5" />
              </div>
              <h4 className="text-xs font-black uppercase tracking-wider text-orange-800 dark:text-orange-400">
                4. ALL COUNTRIES REPORT
              </h4>
            </div>
            <ChevronDown className={cn("h-4 w-4 text-orange-600 transition-transform duration-200", showAllCountries ? "rotate-180" : "")} />
          </div>
          <div className="p-3.5 flex flex-col justify-between h-full w-full">
            <div className="space-y-1">
              <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                Active Countries: <span className="font-extrabold text-orange-600">{meta?.countries?.length || 1}</span>
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">
                Total Branches: <span className="font-semibold text-slate-700 dark:text-slate-300">{(meta?.mainBranches?.length || 0) + (meta?.cityBranches?.length || 0)}</span>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="text-[11px] font-bold text-orange-600 group-hover:underline">
                {showAllCountries ? "Hide Details" : "Show Details"}
              </span>
              <span className="text-[10px] font-bold text-orange-600 bg-orange-100/80 dark:bg-orange-950/60 px-2 py-0.5 rounded">
                EXPLORE â†’
              </span>
            </div>
          </div>
        </button>
      </div>

      {/* Expanded All Countries Breakdown Panel */}
      {showAllCountries ? (
        <div className="rounded-xl border border-orange-200 bg-orange-50/40 p-4 dark:border-orange-900/50 dark:bg-orange-950/20 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-orange-900 dark:text-orange-300">
              Country & Branch Breakdown Directory
            </h3>
            <span className="text-[11px] text-orange-700 dark:text-orange-400">
              Click a country to filter instantly
            </span>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {meta?.countries?.map((c) => (
              <div
                key={c.id}
                onClick={() => {
                  handleFilterChange("countryId", c.id);
                  void fetchReport({ ...filters, countryId: c.id });
                }}
                className={cn(
                  "cursor-pointer rounded-xl border p-3 transition-all hover:shadow-md",
                  filters.countryId === c.id
                    ? "border-orange-500 bg-orange-100/70 dark:border-orange-400 dark:bg-orange-900/40 font-bold"
                    : "border-white/80 bg-white/90 dark:border-slate-800 dark:bg-slate-900/80"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-800 dark:text-slate-200">{c.name}</span>
                  <span className="text-[10px] font-mono text-slate-400">{c.currency_code || "AED"}</span>
                </div>
                <div className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                  {meta?.mainBranches?.filter((b: any) => b.country_id === c.id).length || 1} Branches Active
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Collapsible Filter Bar */}
      {filtersOpen ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 animate-in fade-in slide-in-from-top-2">
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
        </div>
      ) : null}

      {/* Applied report snapshot */}
      {reportResult && (
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3 dark:border-indigo-900/60 dark:bg-indigo-950/20">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[11px] font-black uppercase tracking-wider text-indigo-900 dark:text-indigo-200">
              {t(lang, "report.applied_filters" as UiKey, "Applied report snapshot")}
            </h2>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              {t(lang, "report.real_data" as UiKey, "Real database data")} · {(reportResult.sourceTables ?? []).join(", ")}
            </span>
          </div>
          <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
            {previewFilters.slice(0, 6).map((item) => (
              <div key={item.label} className="rounded-lg border border-white/80 bg-white/80 px-2.5 py-1.5 dark:border-slate-800 dark:bg-slate-900/80">
                <div className="text-[9px] font-bold uppercase tracking-wide text-slate-400">{item.label}</div>
                <div className="mt-0.5 truncate text-xs font-bold text-slate-800 dark:text-slate-200">{item.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Export Toolbar */}
      {hasLoaded && (
        <ReportExportToolbar
          lang={lang}
          reportType={appliedReportType}
          reportTitle={`${panelTitle} — ${t(lang, `report.${appliedReportType.replace(/-/g, "_")}` as UiKey, appliedReportType)}`}
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
      )}

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
      {hasLoaded && (
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
      )}

      {/* Record details modal */}
      {selectedRow && reportResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedRow(null); }}>
          <div className="max-h-[90vh] w-full max-w-4xl overflow-auto rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950 animate-in fade-in zoom-in-95">
            <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
              <div>
                <h2 className="text-base font-black text-slate-900 dark:text-white">{t(lang, "report.record_details" as UiKey, "Report record details")}</h2>
                <p className="text-xs text-slate-500">{String(selectedRow.reference || selectedRow.serial || selectedRow.id)}</p>
              </div>
              <button
                type="button"
                className="ml-auto flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-black text-white hover:bg-blue-700"
                onClick={() => openGenericErpReport({ title: `${t(lang, "report.record_details" as UiKey, "Record details")} — ${String(selectedRow.reference || selectedRow.id)}`, lang, columns: visibleColumns, rows: [selectedRow], summary: reportSummary, filters: previewFilters, companyInfo })}
              >
                <Printer className="h-4 w-4" /> {t(lang, "report.print")}
              </button>
              <button type="button" aria-label="Close" onClick={() => setSelectedRow(null)} className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-100 dark:border-slate-800 dark:hover:bg-slate-900"><X className="h-4 w-4" /></button>
            </div>
            <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(selectedRow).filter(([key]) => !["sourceTable"].includes(key)).map(([key, value]) => (
                <div key={key} className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
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
