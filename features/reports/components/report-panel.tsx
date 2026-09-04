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
  Search,
  MoreVertical,
  RefreshCcw,
  SlidersHorizontal,
  ChevronDown,
  ChevronLeft,
  Building2,
  Users,
  DollarSign,
  Receipt,
  Columns3,
  Share2,
  Table2,
  ArrowUp,
  ArrowDown,
  Download,
  FileText
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DownloadActionIcon } from "@/components/ui/download-action-icon";
import { t, type UiKey } from "@/lib/i18n/ui";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { cn } from "@/lib/utils";
import { ReportFilterBar, type ReportFilterValues, type ReportMetaItem } from "./report-filter-bar";
import { ReportDataTable, getColumnsForReportType } from "./report-data-table";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { translateHeader } from "@/lib/i18n/table-headers";
import { openGenericErpReport, downloadGenericErpReportHtml, type GenericReportColumn } from "@/lib/reports/open-generic-erp-report";

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

function sameStringArray(a: string[], b: string[]) {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function fmtNum(val: number | string | null | undefined): string {
  const n = Number(val);
  if (!Number.isFinite(n)) return "0.00";
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function htmlCell(value: unknown) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function getColumnValue(row: Record<string, any>, key: GenericReportColumn["key"]): unknown {
  return typeof key === "function" ? key(row) : row[key];
}

function exportToCsv(data: Record<string, any>[], columns: GenericReportColumn[], filename: string) {
  if (!data.length || !columns.length) return;
  const headers = columns.map((column) => csvCell(column.label)).join(",");
  const rows = data.map((r) =>
    columns.map((column) => getColumnValue(r, column.key))
      .map(csvCell)
      .join(",")
  );
  const csv = [headers, ...rows].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportToExcel(data: Record<string, any>[], columns: GenericReportColumn[], filename: string) {
  if (!data.length || !columns.length) return;
  const headerRow = columns.map((column) => `<th>${htmlCell(column.label)}</th>`).join("");
  const bodyRows = data
    .map((row) => `<tr>${columns.map((column) => `<td>${htmlCell(getColumnValue(row, column.key))}</td>`).join("")}</tr>`)
    .join("");
  const html = `<!doctype html><html><head><meta charset="utf-8" /></head><body><table><thead><tr>${headerRow}</tr></thead><tbody>${bodyRows}</tbody></table></body></html>`;
  const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ReportPanel({ lang: initialLang, initialScopeLevel = "global", viewerName, viewerId, workspace = "standard" }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const lang = useActiveLanguage() || initialLang;
  const _ = (key: UiKey, fallback?: string) => t(lang, key, fallback);
  const th = (label: string) => translateHeader(lang, label);
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
  const [columnPrefsLoaded, setColumnPrefsLoaded] = useState(false);
  const [savedViews, setSavedViews] = useState<Record<string, { visible: string[]; order: string[] }>>({});
  const [newViewName, setNewViewName] = useState("");
  const [selectedRow, setSelectedRow] = useState<Record<string, any> | null>(null);
  
  // Filter drawer & column picker state
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [showAllCountries, setShowAllCountries] = useState(false);
  const [showColumnsModal, setShowColumnsModal] = useState(false);
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);
  const [actionsSlot, setActionsSlot] = useState<HTMLElement | null>(null);
  const [titleSlot, setTitleSlot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setActionsSlot(document.getElementById("erp-page-actions-slot"));
    setTitleSlot(document.getElementById("erp-page-title-slot"));
  }, []);

  const reportData = reportResult?.data ?? [];
  const reportSummary = reportResult?.summary ?? {};
  const appliedReportType = reportResult?.reportType ?? filters.reportType;
  const appliedCurrency = reportResult?.applied?.currency ?? filters.currency;
  const isEditHistoryReport = appliedReportType === "edit-history";
  const selectedHistoryKey = String(selectedRow?.historyRecordId || selectedRow?.id || "");
  const selectedHistoryEntries = selectedRow && reportResult
    ? ((selectedRow.historyEntries ?? reportResult.history?.[selectedHistoryKey] ?? []) as any[])
    : [];
  const renderAuditValue = (value: unknown) => (value === null || value === undefined || value === "" ? "—" : typeof value === "object" ? JSON.stringify(value) : String(value));
  const baseColumns = useMemo(
    () =>
      getColumnsForReportType(
        appliedReportType,
        lang,
        appliedCurrency !== "all" ? appliedCurrency : "USD"
      ),
    [appliedReportType, lang, appliedCurrency]
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
        setReportError(json.error?.message || _("report.error"));
      }
    } catch (err: any) {
      setReportError(err.message || _("report.error"));
    } finally {
      setReportLoading(false);
    }
  }, [lang, workspace]);

  // Load metadata on mount or language/workspace change
  useEffect(() => {
    let cancelled = false;
    setMetaLoading(true);
    fetch(`/api/erp/reports/meta?lang=${lang}${workspace === "super-admin" ? "&workspace=super-admin" : ""}`)
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        if (json.ok) {
          setMeta(json.data);
          const rawUrlType = searchParams.get("type") || searchParams.get("reportType");
          let targetReportType = rawUrlType || json.data.reportTypes?.[0]?.key || (workspace === "super-admin" ? "ledger" : "roznamcha");
          if (targetReportType === "exchange-rates") targetReportType = "exchange-rate";
          const initialFilterVals: ReportFilterValues = {
            ...DEFAULT_FILTERS,
            reportType: targetReportType,
            countryId: json.data.scope?.lockedCountryId ?? "all",
            mainBranchId: json.data.scope?.lockedMainBranchId ?? "all",
            branchId: json.data.scope?.lockedBranchId ?? "all"
          };
          setFilters(initialFilterVals);
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
  }, [workspace, lang]);

  // Sync with URL search params when sidebar links or query params change
  useEffect(() => {
    const rawUrlType = searchParams.get("type") || searchParams.get("reportType");
    if (!rawUrlType) return;
    let targetType = rawUrlType;
    if (targetType === "exchange-rates") targetType = "exchange-rate";

    setFilters((prev) => {
      if (prev.reportType === targetType) return prev;
      const next = { ...prev, reportType: targetType };
      void fetchReport(next);
      return next;
    });
  }, [searchParams, fetchReport]);

  const handleFilterChange = (key: keyof ReportFilterValues, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleReset = () => {
    const nextFilters: ReportFilterValues = {
      ...DEFAULT_FILTERS,
      countryId: meta?.scope.lockedCountryId ?? "all",
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

  // Computed summary metrics
  const totalEntriesCount = Number(reportSummary?.totalRecords || reportSummary?.entriesCount || reportData.length || 0);
  const totalCreditVal = Number(reportSummary?.credit || reportSummary?.totalCredit || reportSummary?.totalIncome || 0);
  const totalDebitVal = Number(reportSummary?.debit || reportSummary?.totalDebit || reportSummary?.totalExpense || 0);
  const netBalanceVal = Number(reportSummary?.balance || reportSummary?.netBalance || reportSummary?.totalAmount || (totalCreditVal - totalDebitVal));
  const clearedCount = Number(reportSummary?.clearedCount || reportSummary?.postedCount || 0);
  const remainingCount = Math.max(0, totalEntriesCount - clearedCount);
  const currentCurrencySymbol = appliedCurrency !== "all" ? appliedCurrency : "AED";

  // Active country / branch names for Card 1
  const selectedMainBranch = meta?.mainBranches.find((b) => b.id === filters.mainBranchId);
  const selectedCityBranch = meta?.cityBranches.find((b) => b.id === filters.branchId);
  const activeBranchCountryId = selectedCityBranch?.country_id || selectedMainBranch?.country_id;

  const selectedCountryName =
    filters.countryId && filters.countryId !== "all"
      ? meta?.countries.find((c) => c.id === filters.countryId)?.name || scope?.lockedCountryName || _("report.all_countries", "All Countries")
      : activeBranchCountryId
        ? meta?.countries.find((c) => c.id === activeBranchCountryId)?.name || _("report.united_arab_emirates", "United Arab Emirates")
        : scope?.lockedCountryName || _("report.all_countries_global", "All Countries (Global)");

  const selectedBranchName =
    selectedCityBranch?.name ||
    selectedMainBranch?.name ||
    scope?.lockedBranchName ||
    (filters.countryId && filters.countryId !== "all"
      ? `${meta?.countries.find((c) => c.id === filters.countryId)?.name || ""} ${_("report.all_branches", "ALL BRANCHES")}`.trim()
      : _("report.all_global_branches", "ALL GLOBAL BRANCHES"));

  useEffect(() => {
    const allowed = baseColumns.map((column) => column.key);
    setVisibleColumnKeys((current) => {
      const next = current.length === 0
        ? allowed
        : (() => {
            const allowedKeys = new Set(allowed);
            const kept = current.filter((key) => allowedKeys.has(key));
            const missing = allowed.filter((key) => !kept.includes(key));
            return kept.length ? [...kept, ...missing] : allowed;
          })();
      return sameStringArray(current, next) ? current : next;
    });
    setColumnOrder((current) => {
      const kept = current.filter((key) => allowed.includes(key));
      const next = [...kept, ...allowed.filter((key) => !kept.includes(key))];
      return sameStringArray(current, next) ? current : next;
    });
  }, [appliedReportType, lang, baseColumns]);

  const columnStorageKey = `erp-report-columns:${viewerId || "anonymous"}:${appliedReportType}`;
  const viewsStorageKey = `erp-report-views:${viewerId || "anonymous"}:${appliedReportType}`;

  // Load the last-used column layout + any named saved views for this report/user.
  useEffect(() => {
    if (!reportResult || typeof window === "undefined") return;
    setColumnPrefsLoaded(false);
    try {
      const saved = JSON.parse(window.localStorage.getItem(columnStorageKey) || "null");
      if (saved && Array.isArray(saved.visible) && Array.isArray(saved.order)) {
        const allowed = new Set(baseColumns.map((column) => column.key));
        const visible = saved.visible.filter((key: string) => allowed.has(key));
        const order = saved.order.filter((key: string) => allowed.has(key));
        const fallbackVisible = baseColumns.map((column) => column.key);
        const nextVisible = visible.length ? visible : fallbackVisible;
        const nextOrder = [...order, ...fallbackVisible.filter((key) => !order.includes(key))];
        setVisibleColumnKeys((current) => (sameStringArray(current, nextVisible) ? current : nextVisible));
        setColumnOrder((current) => (sameStringArray(current, nextOrder) ? current : nextOrder));
      }
    } catch {
      // Ignore
    }
    try {
      const v = JSON.parse(window.localStorage.getItem(viewsStorageKey) || "null");
      setSavedViews(v && typeof v === "object" ? v : {});
    } catch {
      setSavedViews({});
    }
    setColumnPrefsLoaded(true);
  }, [appliedReportType, reportResult, viewerId, baseColumns]);

  // Persist the working column layout whenever the user changes it.
  useEffect(() => {
    if (!columnPrefsLoaded || typeof window === "undefined" || !visibleColumnKeys.length) return;
    try {
      window.localStorage.setItem(columnStorageKey, JSON.stringify({ visible: visibleColumnKeys, order: columnOrder }));
    } catch {
      // storage disabled / full — the layout still works for this session
    }
  }, [visibleColumnKeys, columnOrder, columnPrefsLoaded, columnStorageKey]);

  const resetColumnsToDefault = () => {
    const all = baseColumns.map((c) => c.key);
    setColumnOrder(all);
    setVisibleColumnKeys(all);
  };

  const applySavedView = (name: string) => {
    const v = savedViews[name];
    if (!v) return;
    const allowed = new Set(baseColumns.map((c) => c.key));
    const all = baseColumns.map((c) => c.key);
    const order = [...v.order.filter((k) => allowed.has(k)), ...all.filter((k) => !v.order.includes(k))];
    const visible = v.visible.filter((k) => allowed.has(k));
    setColumnOrder(order);
    setVisibleColumnKeys(visible.length ? visible : all);
  };

  const saveCurrentView = (name: string) => {
    const clean = name.trim();
    if (!clean) return;
    const next = { ...savedViews, [clean]: { visible: visibleColumnKeys, order: columnOrder } };
    setSavedViews(next);
    setNewViewName("");
    try {
      window.localStorage.setItem(viewsStorageKey, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const deleteSavedView = (name: string) => {
    const next = { ...savedViews };
    delete next[name];
    setSavedViews(next);
    try {
      window.localStorage.setItem(viewsStorageKey, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const orderedColumns = columnOrder.map((key) => baseColumns.find((column) => column.key === key)).filter(Boolean) as typeof baseColumns;
  const visibleColumns = orderedColumns.filter((column) => visibleColumnKeys.includes(column.key));
  const printableColumns = visibleColumns as unknown as GenericReportColumn[];
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
      ? `${applied.fromDate || _("report.start_date", "Start")} ${_("report.to", "To")} ${applied.toDate || _("report.today", "Today")}`
      : reportResult?.generatedAt
      ? `${_("report.as_of", "As of")} ${new Date(reportResult.generatedAt).toLocaleDateString("en-GB")}`
      : _("report.current_period", "Current Period")
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

  const filename = `${appliedReportType}-${new Date().toISOString().slice(0, 10)}`;

  const handlePrintAction = () => {
    openGenericErpReport({
      title: `${panelTitle} — ${t(lang, `report.${appliedReportType.replace(/-/g, "_")}` as UiKey, appliedReportType)}`,
      lang,
      columns: printableColumns,
      rows: reportData,
      summary: reportSummary,
      filters: previewFilters,
      companyInfo
    });
  };

  const handleDownloadHtmlAction = () => {
    downloadGenericErpReportHtml({
      title: `${panelTitle} — ${t(lang, `report.${appliedReportType.replace(/-/g, "_")}` as UiKey, appliedReportType)}`,
      lang,
      columns: printableColumns,
      rows: reportData,
      summary: reportSummary,
      filters: previewFilters,
      companyInfo
    });
  };

  const handleCsvExport = () => {
    exportToCsv(reportData, printableColumns, `${filename}.csv`);
  };

  const handleExcelExport = () => {
    exportToExcel(reportData, printableColumns, `${filename}.xls`);
  };

  const handleWhatsAppShare = () => {
    const text = encodeURIComponent(
      `*${panelTitle} — ${appliedReportType}*\n📊 ${_("report.filter_scope")}: ${reportResult?.scope?.label ?? scope?.scopeLabel ?? ""}\n📅 ${_("report.generated_at")}: ${reportResult?.generatedAt ? new Date(reportResult.generatedAt).toLocaleString() : new Date().toLocaleString()}\n💡 ${_("report.kpi_total_records")}: ${reportData.length}`
    );
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  if (metaLoading) {
    return (
      <div className="flex h-64 w-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-xs font-semibold text-slate-500">{_("report.loading_report_engine", "Loading Report Engine...")}</p>
        </div>
      </div>
    );
  }

  if (metaError) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 dark:bg-rose-950/20 dark:border-rose-900 p-8 flex items-center gap-3">
        <AlertCircle className="h-5 w-5 text-rose-500 flex-shrink-0" />
        <div>
          <p className="font-bold text-rose-700 dark:text-rose-400">{_("report.failed_to_load_metadata", "Failed to load report metadata")}</p>
          <p className="text-sm text-rose-600 dark:text-rose-500 mt-1">{metaError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-3 text-foreground" dir={isRTL ? "rtl" : "ltr"}>
      {/* Top Standard ERP Report Toolbar Strip (Matches exact UI design) */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200/80 bg-white/95 px-3 py-1.5 shadow-xs transition-all dark:border-slate-800 dark:bg-slate-900/90">
        <div className="flex flex-wrap items-center gap-2">
          {/* Back Button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => router.back()}
            className="h-7 gap-1 rounded-lg border-slate-200 bg-slate-50 px-2.5 text-[10px] font-bold text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <ChevronLeft className="h-3 w-3" />
            {_("common.back", "Back")}
          </Button>

          {/* Filter Drawer Toggle */}
          <Button
            type="button"
            variant={filtersOpen ? "default" : "outline"}
            size="sm"
            className="h-7 gap-1 rounded-lg px-2 text-[10px] font-bold"
            onClick={() => setFiltersOpen((v) => !v)}
          >
            <SlidersHorizontal className="h-3 w-3" aria-hidden />
            {filtersOpen ? _("report.hide_filters", "Hide Filters") : _("report.search_filters", "Search / Filters")}
          </Button>

          {/* Live Search Input */}
          <div className="relative min-w-[140px] sm:min-w-[180px]">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={_("report.filter_report_placeholder", "Filter report...")}
              className="h-7 pl-7 pr-2 text-[11px] rounded-lg"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Reload Button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1 rounded-lg px-2 text-[10px] font-bold"
            onClick={() => appliedFilters && fetchReport(appliedFilters)}
            disabled={reportLoading}
            title={_("report.reload_data", "Reload report data")}
          >
            <RefreshCcw className={cn("h-3 w-3", reportLoading && "animate-spin")} />
            <span className="hidden md:inline">{_("common.refresh", "Refresh")}</span>
          </Button>

          {/* Density Toggle */}
          <div className="hidden xl:flex items-center rounded-lg border border-slate-200 bg-slate-100/80 p-0.5 dark:border-slate-800 dark:bg-slate-900">
            <button
              type="button"
              onClick={() => setDensity("comfortable")}
              className={cn(
                "rounded-md px-1.5 py-0.5 text-[10px] font-bold transition-colors",
                density === "comfortable"
                  ? "bg-white text-blue-600 shadow-2xs dark:bg-slate-800 dark:text-blue-400"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              )}
            >
              {_("report.density_comfortable", "Comfortable")}
            </button>
            <button
              type="button"
              onClick={() => setDensity("compact")}
              className={cn(
                "rounded-md px-1.5 py-0.5 text-[10px] font-bold transition-colors",
                density === "compact"
                  ? "bg-white text-blue-600 shadow-2xs dark:bg-slate-800 dark:text-blue-400"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              )}
            >
              {_("report.compact_mode", "Compact")}
            </button>
          </div>

          {/* Columns Selector */}
          <div className="relative">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 gap-1 rounded-lg px-2 text-[10px] font-bold"
              onClick={() => setShowColumnsModal((v) => !v)}
            >
              <Columns3 className="h-3 w-3" />
              <span className="hidden sm:inline">{_("report.manage_columns", "Columns")}</span>
            </Button>
            {showColumnsModal && (
              <div
                className="absolute left-0 top-full z-50 mt-1.5 w-72 rounded-xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-800 dark:bg-slate-900 animate-in fade-in zoom-in-95"
                onMouseLeave={() => setShowColumnsModal(false)}
              >
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800 mb-2">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">{_("report.visible_columns", "Visible Columns")}</span>
                  <button type="button" onClick={() => setShowColumnsModal(false)} className="text-slate-400 hover:text-slate-600">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Saved layout views */}
                <div className="mb-2 space-y-1.5">
                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      onClick={resetColumnsToDefault}
                      className="rounded-md border border-slate-200 dark:border-slate-700 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      {_("report.reset_default", "Reset to Default")}
                    </button>
                    {Object.keys(savedViews).map((name) => (
                      <span key={name} className="inline-flex items-center rounded-md border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 text-[10px] font-bold text-blue-700 dark:text-blue-300">
                        <button type="button" onClick={() => applySavedView(name)} className="px-1.5 py-0.5 hover:underline">{name}</button>
                        <button type="button" onClick={() => deleteSavedView(name)} className="px-1 text-blue-400 hover:text-red-500" aria-label={t(lang, "rp.delete_view", "Delete view")}>×</button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-1">
                    <input
                      value={newViewName}
                      onChange={(e) => setNewViewName(e.target.value)}
                      placeholder={_("report.save_view_name", "Save current as…")}
                      className="flex-1 min-w-0 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1 text-[11px] text-slate-700 dark:text-slate-200 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => saveCurrentView(newViewName)}
                      disabled={!newViewName.trim()}
                      className="rounded-md bg-blue-600 px-2 py-1 text-[10px] font-bold text-white disabled:opacity-40"
                    >
                      {_("report.save_view", "Save")}
                    </button>
                  </div>
                </div>

                <div className="max-h-60 overflow-y-auto space-y-1 pr-1 border-t border-slate-100 dark:border-slate-800 pt-2">
                  {orderedColumns.map((col, idx) => {
                    const isVisible = visibleColumnKeys.includes(col.key);
                    return (
                      <div key={col.key} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs">
                        <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
                          <input
                            type="checkbox"
                            checked={isVisible}
                            onChange={() => toggleColumn(col.key)}
                            className="rounded border-slate-300 text-blue-600"
                          />
                          <span className="truncate text-slate-700 dark:text-slate-300">{col.label}</span>
                        </label>
                        <div className="flex items-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => moveColumn(col.key, -1)}
                            disabled={idx === 0}
                            className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                          >
                            <ArrowUp className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveColumn(col.key, 1)}
                            disabled={idx === orderedColumns.length - 1}
                            className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                          >
                            <ArrowDown className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Actions Dropdown */}
        <div className="flex items-center gap-1.5">
          <div className="relative">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 gap-1 rounded-lg px-2.5 text-[10px] font-bold bg-blue-50/50 hover:bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800"
              onClick={() => setActionsMenuOpen((v) => !v)}
            >
              <MoreVertical className="h-3 w-3" />
              {_("report.actions", "Actions")}
            </Button>
            {actionsMenuOpen ? (
              <div
                className="absolute right-0 top-full z-50 mt-1.5 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-800 dark:bg-slate-900 animate-in fade-in zoom-in-95"
                onMouseLeave={() => setActionsMenuOpen(false)}
              >
                <button
                  type="button"
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 text-left"
                  onClick={() => {
                    setActionsMenuOpen(false);
                    handlePrintAction();
                  }}
                >
                  <Printer className="h-3.5 w-3.5 text-blue-600" />
                  {_("report.print_pdf_document", "Print / PDF Document")}
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 text-left"
                  onClick={() => {
                    setActionsMenuOpen(false);
                    handleDownloadHtmlAction();
                  }}
                >
                  <Download className="h-3.5 w-3.5 text-indigo-600" />
                  {_("report.download_html", "Download HTML")}
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 text-left"
                  onClick={() => {
                    setActionsMenuOpen(false);
                    handleExcelExport();
                  }}
                >
                  <Table2 className="h-3.5 w-3.5 text-emerald-600" />
                  {_("report.export_excel", "Export to Excel")}
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 text-left"
                  onClick={() => {
                    setActionsMenuOpen(false);
                    handleCsvExport();
                  }}
                >
                  <DownloadActionIcon className="h-3.5 w-3.5 text-teal-600" />
                  {_("report.export_csv", "Export to CSV")}
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 text-left"
                  onClick={() => {
                    setActionsMenuOpen(false);
                    handleWhatsAppShare();
                  }}
                >
                  <Share2 className="h-3.5 w-3.5 text-emerald-500" />
                  {_("report.share_whatsapp", "Share via WhatsApp")}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* 4 Executive KPI Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {/* Card 1: Branch & User Details */}
        <div className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 dark:border-slate-800 bg-blue-50/60 dark:bg-blue-900/15">
              <div className="bg-blue-600 p-1 rounded-full text-white flex-shrink-0">
                <Users className="h-3 w-3" />
              </div>
              <h4 className="text-[11px] font-black uppercase tracking-wider text-blue-800 dark:text-blue-400">
              1. {_("report.branch_user_details", "BRANCH & USER DETAILS")}
              </h4>
            </div>
            <div className="p-3 flex flex-col gap-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400 h-full">
              <div className="flex justify-between items-center">
              <span>{th("COUNTRY")}:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{selectedCountryName}</span>
              </div>
              <div className="flex justify-between items-center">
              <span>{th("BRANCH NAME")}:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 uppercase truncate max-w-[180px]">{selectedBranchName}</span>
              </div>
              <div className="flex justify-between items-center">
              <span>{th("USER ID")}:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 uppercase text-[9px] font-mono">{viewerId || "1001-000000000000000000"}</span>
              </div>
              <div className="flex justify-between items-center">
              <span>{th("USER NAME")}:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 uppercase">{viewerName || "SUPER ADMIN"}</span>
              </div>
              <div className="flex justify-between items-center">
              <span>{th("ROLE")}:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 uppercase">{scope?.level ? scope.level.toUpperCase() : "SUPER ADMIN"}</span>
              </div>
              <div className="flex justify-between items-center">
              <span>{th("DATE & TIME")}:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}, {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true })}</span>
              </div>
              <div className="flex justify-between items-center mt-auto pt-1">
              <span>{th("STATUS")}:</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded text-[10px]">{th("ACTIVE")}</span>
              </div>
            </div>
          </div>

        {/* Card 2: Global Financial Summary */}
        <div className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 dark:border-slate-800 bg-emerald-50/60 dark:bg-emerald-900/15">
            <div className="bg-emerald-600 p-1 rounded-full text-white flex-shrink-0">
              <DollarSign className="h-3 w-3" />
            </div>
            <h4 className="text-[11px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-400">
              2. {_("report.global_financial_summary", "GLOBAL FINANCIAL SUMMARY")}
            </h4>
          </div>
          <div className="p-3 flex flex-col gap-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400 h-full">
            <div className="flex justify-between items-center">
              <span>{_("report.kpi_total_records", "Total Records")}:</span>
              <span className="font-black text-slate-800 dark:text-slate-200">{totalEntriesCount}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>{_("report.kpi_total_credit", "Total Credit")} ({currentCurrencySymbol}):</span>
              <span className="font-black text-emerald-600 dark:text-emerald-400 font-mono">{fmtNum(totalCreditVal)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-rose-600 dark:text-rose-400">{_("report.kpi_total_debit", "Total Debit")} ({currentCurrencySymbol}):</span>
              <span className="font-black text-rose-600 dark:text-rose-400 font-mono">{fmtNum(totalDebitVal)}</span>
            </div>
            <div className="flex justify-between items-center mt-auto pt-1.5 border-t border-slate-100 dark:border-slate-800">
              <span className="text-slate-700 dark:text-slate-300 font-bold">{_("report.kpi_net_balance", "Net Balance")} ({currentCurrencySymbol}):</span>
              <span className="font-black text-blue-600 dark:text-blue-400 font-mono text-sm">{fmtNum(netBalanceVal)}</span>
            </div>
          </div>
        </div>

        {/* Card 3: Bill Entries Summary */}
        <div className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 dark:border-slate-800 bg-purple-50/60 dark:bg-purple-900/15">
            <div className="bg-purple-600 p-1 rounded-full text-white flex-shrink-0">
              <Receipt className="h-3 w-3" />
            </div>
            <h4 className="text-[11px] font-black uppercase tracking-wider text-purple-800 dark:text-purple-400">
              3. {th("BILL ENTRIES SUMMARY")}
            </h4>
          </div>
          <div className="p-3 flex flex-col gap-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400 h-full">
            <div className="flex justify-between items-center">
              <span>{th("TOTAL BILL ENTRIES")}:</span>
              <span className="font-black text-slate-800 dark:text-slate-200">{totalEntriesCount}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>{th("CLEARED ENTRIES")}:</span>
              <span className="font-black text-emerald-600 dark:text-emerald-400">{clearedCount}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-rose-600">{th("REMAINING ENTRIES")}:</span>
              <span className="font-black text-rose-600">{remainingCount}</span>
            </div>
            <div className="flex justify-between items-center mt-auto pt-1.5 border-t border-slate-100 dark:border-slate-800 text-[10px]">
              <span>{th("SYSTEM STATUS")}:</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">{th("ONLINE & SYNCED")}</span>
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
              : "border-slate-200 bg-white shadow-xs hover:border-orange-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
          )}
        >
          <div className={cn(
            "flex items-center justify-between px-3 py-2 border-b w-full transition-colors",
            showAllCountries
              ? "border-orange-200 bg-orange-100/50 dark:border-orange-900/50 dark:bg-orange-900/30"
              : "border-slate-100 bg-orange-50/60 dark:border-slate-800 dark:bg-orange-900/15"
          )}>
            <div className="flex items-center gap-2">
            <div className="bg-orange-600 p-1 rounded-full text-white flex-shrink-0">
              <Globe2 className="h-3 w-3" />
            </div>
            <h4 className="text-[11px] font-black uppercase tracking-wider text-orange-800 dark:text-orange-400">
              4. {_("report.all_countries_report", "ALL COUNTRIES REPORT")}
            </h4>
          </div>
            <ChevronDown className={cn("h-3.5 w-3.5 text-orange-600 transition-transform duration-200", showAllCountries ? "rotate-180" : "")} />
          </div>
          <div className="p-3 flex flex-col justify-between h-full w-full">
            <div className="space-y-1">
              <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                {_("report.active_countries", "ACTIVE COUNTRIES")}: <span className="font-extrabold text-orange-600">{meta?.countries?.length || 1}</span>
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">
                {_("report.total_branches", "Total Branches")}: <span className="font-semibold text-slate-700 dark:text-slate-300">{(meta?.mainBranches?.length || 0) + (meta?.cityBranches?.length || 0)}</span>
              </div>
            </div>
            <div className="mt-2.5 flex items-center justify-between pt-1.5 border-t border-slate-100 dark:border-slate-800">
              <span className="text-[10px] font-bold text-orange-600 group-hover:underline">
                {showAllCountries ? _("report.hide_details", "Hide Details") : _("report.show_details", "Show Details")}
              </span>
              <span className="text-[9px] font-bold text-orange-600 bg-orange-100/80 dark:bg-orange-950/60 px-1.5 py-0.5 rounded">
                {th("EXPLORE")} →
              </span>
            </div>
          </div>
        </button>
      </div>

      {/* Expanded All Countries Breakdown Panel */}
      {showAllCountries ? (
        <div className="rounded-xl border border-orange-200 bg-orange-50/40 p-3.5 dark:border-orange-900/50 dark:bg-orange-950/20 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between mb-2.5">
            <h3 className="text-xs font-black uppercase tracking-wider text-orange-900 dark:text-orange-300">
              {_("report.country_branch_breakdown_directory", "Country & Branch Breakdown Directory")}
            </h3>
            <span className="text-[10px] text-orange-700 dark:text-orange-400">
              {_("report.click_a_country_to_filter_instantly", "Click a country to filter instantly")}
            </span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {meta?.countries?.map((c) => (
              <div
                key={c.id}
                onClick={() => {
                  handleFilterChange("countryId", c.id);
                  void fetchReport({ ...filters, countryId: c.id });
                }}
                className={cn(
                  "cursor-pointer rounded-xl border p-2.5 transition-all hover:shadow-md",
                  filters.countryId === c.id
                    ? "border-orange-500 bg-orange-100/70 dark:border-orange-400 dark:bg-orange-900/40 font-bold"
                    : "border-white/80 bg-white/90 dark:border-slate-800 dark:bg-slate-900/80"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-800 dark:text-slate-200">{c.name}</span>
                  <span className="text-[10px] font-mono text-slate-400">{c.code || "AED"}</span>
                </div>
                <div className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                  {meta?.mainBranches?.filter((b: any) => b.country_id === c.id).length || 1} {th("BRANCHES ACTIVE")}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Collapsible Filter Bar */}
      {filtersOpen ? (
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs dark:border-slate-800 dark:bg-slate-900 animate-in fade-in slide-in-from-top-2">
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

      {/* Applied report snapshot pill bar */}
      {reportResult && (
        <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 px-3 py-1.5 dark:border-slate-800 dark:bg-slate-900/50 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-blue-100 px-2 py-0.5 text-[9px] font-black text-blue-700 dark:bg-blue-950 dark:text-blue-300 uppercase">
              {reportResult?.scope?.label ?? "GLOBAL"}
            </span>
            <span className="text-[10.5px] font-semibold text-slate-600 dark:text-slate-300">
              {_("report.country_label", "Country")}: <strong className="text-slate-900 dark:text-white">{previewFilters[1]?.value}</strong>
            </span>
            <span className="text-[10.5px] font-semibold text-slate-600 dark:text-slate-300">
              {_("report.branch_label", "Branch")}: <strong className="text-slate-900 dark:text-white">{applied.branch || applied.mainBranch || th("ALL BRANCHES")}</strong>
            </span>
            <span className="text-[10.5px] font-semibold text-slate-600 dark:text-slate-300">
              {_("report.currency_label", "Currency")}: <strong className="text-slate-900 dark:text-white">{applied.currency ?? _("common.all", "All")}</strong>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9.5px] font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              {reportData.length} {_("report.records_loaded", "Records Loaded")}
            </span>
          </div>
        </div>
      )}

      {/* Error State */}
      {reportError && !reportLoading && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 dark:bg-rose-950/20 dark:border-rose-900 p-4 flex items-center gap-3">
          <AlertCircle className="h-4 w-4 text-rose-500 flex-shrink-0" />
          <div>
            <p className="font-bold text-rose-700 dark:text-rose-400 text-xs">{_("report.error")}</p>
            <p className="text-[11px] text-rose-600 dark:text-rose-500 mt-0.5">{reportError}</p>
          </div>
        </div>
      )}

      {/* Data Table directly below */}
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
                onClick={() => openGenericErpReport({ title: `${t(lang, "report.record_details" as UiKey, "Record details")} — ${String(selectedRow.reference || selectedRow.id)}`, lang, columns: printableColumns, rows: [selectedRow], summary: reportSummary, filters: previewFilters, companyInfo })}
              >
                <Printer className="h-4 w-4" /> {t(lang, "report.print")}
              </button>
                <button type="button" aria-label={t(lang, "common.close", "Close")} onClick={() => setSelectedRow(null)} className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-100 dark:border-slate-800 dark:hover:bg-slate-900"><X className="h-4 w-4" /></button>
            </div>
            <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(selectedRow).filter(([key]) => !["sourceTable", "historyEntries", "currentVersion", "originalVersion"].includes(key)).map(([key, value]) => (
                <div key={key} className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                  <div className="text-[9px] font-black uppercase tracking-wide text-slate-400">{translateHeader(lang, key.replace(/([A-Z])/g, " $1").toUpperCase())}</div>
                  <div className="mt-1 break-words text-xs font-semibold text-slate-800 dark:text-slate-200">{renderAuditValue(value)}</div>
                </div>
              ))}
            </div>
            <div className="border-t border-slate-200 p-5 dark:border-slate-800">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-black text-slate-900 dark:text-white">
                <History className="h-4 w-4" />
                {isEditHistoryReport ? t(lang, "report.edit_history" as UiKey, "Edit History") : t(lang, "report.activity_history" as UiKey, "Activity and edit history")}
              </h3>
              {selectedHistoryEntries.length ? (
                <div className="space-y-3">
                  {selectedHistoryEntries.map((entry: any) => (
                    <div key={entry.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-xs dark:border-slate-800 dark:bg-slate-900/60">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-indigo-600 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white">{entry.versionLabel || entry.action || "Version"}</span>
                        <span className="text-[10px] font-semibold text-slate-500">{new Date(entry.created_at).toLocaleString()}</span>
                      </div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        <div><div className="text-[9px] font-black uppercase tracking-wide text-slate-400">{_("report.who_changed_it", "Who changed it")}</div><div className="mt-1 font-semibold text-slate-800 dark:text-slate-200">{renderAuditValue(entry.user)}</div></div>
                        <div><div className="text-[9px] font-black uppercase tracking-wide text-slate-400">{_("report.login_user_id", "Login/User ID")}</div><div className="mt-1 font-semibold text-slate-800 dark:text-slate-200">{renderAuditValue(entry.loginUserId || entry.actor_id)}</div></div>
                        <div><div className="text-[9px] font-black uppercase tracking-wide text-slate-400">{t(lang, "report.role" as UiKey, "Role")}</div><div className="mt-1 font-semibold text-slate-800 dark:text-slate-200">{renderAuditValue(entry.role)}</div></div>
                        <div><div className="text-[9px] font-black uppercase tracking-wide text-slate-400">{_("report.country_label", "Country")} / {_("report.branch_label", "Branch")}</div><div className="mt-1 font-semibold text-slate-800 dark:text-slate-200">{renderAuditValue(entry.country)}</div></div>
                        <div><div className="text-[9px] font-black uppercase tracking-wide text-slate-400">{_("report.main_city_branch", "Main / City Branch")}</div><div className="mt-1 font-semibold text-slate-800 dark:text-slate-200">{`${renderAuditValue(entry.mainBranch)} / ${renderAuditValue(entry.cityBranch)}`}</div></div>
                        <div><div className="text-[9px] font-black uppercase tracking-wide text-slate-400">{_("report.reason", "Reason")}</div><div className="mt-1 font-semibold text-slate-800 dark:text-slate-200">{renderAuditValue(entry.reason)}</div></div>
                      </div>
                      <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
                        <div className="grid grid-cols-[1fr_1fr_1fr] bg-slate-100 px-3 py-2 text-[9px] font-black uppercase tracking-wider text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                          <span>{_("report.field", "Field")}</span>
                          <span>{_("report.before", "Before")}</span>
                          <span>{_("report.after", "After")}</span>
                        </div>
                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                          {(entry.fields?.length ? entry.fields : (entry.changedFields ?? []).map((field: string) => ({ field, before: null, after: null }))).map((fieldRow: any) => (
                            <div key={`${entry.id}-${fieldRow.field}`} className="grid grid-cols-[1fr_1fr_1fr] gap-2 px-3 py-2 text-[11px]">
                              <div className="font-bold text-slate-700 dark:text-slate-200">{renderAuditValue(fieldRow.field)}</div>
                              <div className="break-words text-slate-500">{renderAuditValue(fieldRow.before)}</div>
                              <div className="break-words text-slate-800 dark:text-slate-100">{renderAuditValue(fieldRow.after)}</div>
                            </div>
                          ))}
                        </div>
                      </div>
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
