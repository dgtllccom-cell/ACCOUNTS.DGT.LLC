"use client";

import { useMemo, useState } from "react";
import { Download, FileText, Table2, Printer, Share2, RefreshCw, Clock, Search, Columns3, Rows3, ArrowUp, ArrowDown } from "lucide-react";
import { t, type UiKey } from "@/lib/i18n/ui";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { cn } from "@/lib/utils";
import { openGenericErpReport, type GenericReportColumn } from "@/lib/reports/open-generic-erp-report";
import type { ERPCompanyInfo, ERPFilterPill } from "@/lib/reports/erp-report-template-builder";

type Props = {
  lang: SupportedLanguage;
  reportType: string;
  reportTitle: string;
  data: Record<string, any>[];
  summary?: Record<string, any>;
  scopeLabel: string;
  generatedAt?: string;
  isLoading?: boolean;
  onReload?: () => void;
  currency?: string;
  searchQuery?: string;
  onSearchQueryChange?: (value: string) => void;
  density?: "compact" | "comfortable";
  onDensityChange?: (value: "compact" | "comfortable") => void;
  columns?: GenericReportColumn[];
  visibleColumnKeys?: string[];
  onToggleColumn?: (key: string) => void;
  onMoveColumn?: (key: string, direction: -1 | 1) => void;
  previewFilters?: ERPFilterPill[];
  companyInfo?: ERPCompanyInfo;
};

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function htmlCell(value: unknown) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function columnKeyString(key: GenericReportColumn["key"]): string {
  return typeof key === "function" ? (key.name || "custom") : key;
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

export function ReportExportToolbar({
  lang,
  reportType,
  reportTitle,
  data,
  summary,
  scopeLabel,
  generatedAt,
  isLoading,
  onReload,
  currency = "USD",
  searchQuery = "",
  onSearchQueryChange,
  density = "comfortable",
  onDensityChange,
  columns = [],
  visibleColumnKeys = [],
  onToggleColumn,
  onMoveColumn,
  previewFilters = [],
  companyInfo
}: Props) {
  const _ = (key: UiKey, fallback?: string) => t(lang, key, fallback);
  const isRTL = ["ar", "ur", "fa", "ps"].includes(lang);
  const [isExporting, setIsExporting] = useState(false);
  const [showColumns, setShowColumns] = useState(false);

  const filename = `${reportType}-${new Date().toISOString().slice(0, 10)}`;
  const visibleSet = useMemo(() => new Set(visibleColumnKeys), [visibleColumnKeys]);

  const handleCsv = () => {
    setIsExporting(true);
    try {
      exportToCsv(data, columns.filter((column) => visibleSet.has(columnKeyString(column.key))), `${filename}.csv`);
    } finally {
      setTimeout(() => setIsExporting(false), 1000);
    }
  };

  const handleJson = () => {
    setIsExporting(true);
    try {
      exportToExcel(data, columns.filter((column) => visibleSet.has(columnKeyString(column.key))), `${filename}.xls`);
    } finally {
      setTimeout(() => setIsExporting(false), 1000);
    }
  };

  const handlePrint = () => {
    openGenericErpReport({
      title: reportTitle,
      lang,
      columns: columns.filter((column) => visibleSet.has(columnKeyString(column.key))),
      rows: data,
      summary,
      filters: previewFilters,
      companyInfo,
    });
  };

  const handleWhatsApp = () => {
    const text = encodeURIComponent(
      `*${reportTitle}*\n📊 ${scopeLabel}\n📅 ${generatedAt ? new Date(generatedAt).toLocaleString() : "Now"}\n💡 ${data.length} records`
    );
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 print:hidden",
        isRTL && "flex-row-reverse"
      )}
      dir={isRTL ? "rtl" : "ltr"}
    >
      {onSearchQueryChange && (
        <div className={cn("relative min-w-[220px] flex-1 max-w-[360px]", isRTL && "order-[-1]")}>
          <Search className={cn("absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400", isRTL ? "right-3" : "left-3")} />
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            placeholder={_("report.search_placeholder")}
            className={cn(
              "h-9 w-full rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 shadow-sm outline-none transition-all focus:ring-2 focus:ring-indigo-500 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-200",
              isRTL ? "pr-9 pl-3 text-right" : "pl-9 pr-3"
            )}
          />
        </div>
      )}

      {/* Scope badge */}
      <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-800 px-3 py-1.5 shadow-sm">
        <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-[10px] font-black uppercase text-slate-600 dark:text-slate-400">
          {_("report.scope_label")}: {scopeLabel}
        </span>
      </div>

      {/* Generated at */}
      {generatedAt && (
        <div className="flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500">
          <Clock className="h-3 w-3" />
          <span>{_("report.generated_at")}: {new Date(generatedAt).toLocaleString()}</span>
        </div>
      )}

      <div className="flex-1" />

      {/* Reload */}
      {onReload && (
        <button
          type="button"
          onClick={onReload}
          disabled={isLoading}
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-800 px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm disabled:opacity-50"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
          {_("report.reload")}
        </button>
      )}

      {onDensityChange && (
        <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-xs font-bold text-slate-600 shadow-sm dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300">
          <Rows3 className="h-3.5 w-3.5" />
          <button
            type="button"
            onClick={() => onDensityChange("comfortable")}
            className={cn("rounded-md px-2 py-0.5 transition-colors", density === "comfortable" ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300" : "hover:bg-slate-100 dark:hover:bg-slate-800")}
          >
            Comfortable
          </button>
          <button
            type="button"
            onClick={() => onDensityChange("compact")}
            className={cn("rounded-md px-2 py-0.5 transition-colors", density === "compact" ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300" : "hover:bg-slate-100 dark:hover:bg-slate-800")}
          >
            Compact
          </button>
        </div>
      )}

      {columns.length > 0 && onToggleColumn && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowColumns((current) => !current)}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-800 px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm"
          >
            <Columns3 className="h-3.5 w-3.5" />
            Columns
          </button>
          {showColumns && (
            <div className={cn("absolute z-20 mt-2 w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-800 dark:bg-slate-900", isRTL ? "left-0" : "right-0")}>
              <div className="max-h-72 space-y-1 overflow-auto">
                {columns.map((column, index) => {
                  const keyStr = columnKeyString(column.key);
                  return (
                    <div key={keyStr} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800">
                      <input
                        type="checkbox"
                        checked={visibleSet.has(keyStr)}
                        onChange={() => onToggleColumn(keyStr)}
                        className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="min-w-0 flex-1 truncate">{column.label}</span>
                      {onMoveColumn && (
                        <span className="flex items-center gap-0.5">
                          <button type="button" disabled={index === 0} onClick={() => onMoveColumn(keyStr, -1)} className="rounded p-1 hover:bg-slate-200 disabled:opacity-25 dark:hover:bg-slate-700" aria-label={`Move ${column.label} up`}><ArrowUp className="h-3 w-3" /></button>
                          <button type="button" disabled={index === columns.length - 1} onClick={() => onMoveColumn(keyStr, 1)} className="rounded p-1 hover:bg-slate-200 disabled:opacity-25 dark:hover:bg-slate-700" aria-label={`Move ${column.label} down`}><ArrowDown className="h-3 w-3" /></button>
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* CSV Export */}
      <button
        type="button"
        onClick={handleCsv}
        disabled={isExporting || isLoading || !data.length}
        className="flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/40 dark:border-emerald-900 px-3 py-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-950/70 transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Table2 className="h-3.5 w-3.5" />
        {_("report.export_csv")}
      </button>

      {/* Excel export (exports as JSON; user can open in Excel) */}
      <button
        type="button"
        onClick={handleJson}
        disabled={isExporting || isLoading || !data.length}
        className="flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 dark:bg-blue-950/40 dark:border-blue-900 px-3 py-1.5 text-xs font-bold text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-950/70 transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Download className="h-3.5 w-3.5" />
        {_("report.export_excel")}
      </button>

      {/* Print */}
      <button
        type="button"
        onClick={handlePrint}
        disabled={isLoading || !data.length}
        className="flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 shadow-sm transition-all hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-400"
      >
        <FileText className="h-3.5 w-3.5" />
        {_("report.export_pdf")}
      </button>

      <button
        type="button"
        onClick={handlePrint}
        className="flex items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 dark:bg-violet-950/40 dark:border-violet-900 px-3 py-1.5 text-xs font-bold text-violet-700 dark:text-violet-400 hover:bg-violet-100 dark:hover:bg-violet-950/70 transition-all shadow-sm"
      >
        <Printer className="h-3.5 w-3.5" />
        {_("report.print", "Print")}
      </button>

      {/* WhatsApp Share */}
      <button
        type="button"
        onClick={handleWhatsApp}
        className="flex items-center gap-1.5 rounded-xl border border-green-200 bg-green-50 dark:bg-green-950/40 dark:border-green-900 px-3 py-1.5 text-xs font-bold text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-950/70 transition-all shadow-sm"
      >
        <Share2 className="h-3.5 w-3.5" />
        {_("report.share_whatsapp")}
      </button>
    </div>
  );
}
