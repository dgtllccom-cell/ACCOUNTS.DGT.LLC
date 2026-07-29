"use client";

import { useState } from "react";
import { Download, FileText, Table2, Printer, Share2, RefreshCw, Clock } from "lucide-react";
import { t, type UiKey } from "@/lib/i18n/ui";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { cn } from "@/lib/utils";

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
};

function exportToCsv(data: Record<string, any>[], filename: string) {
  if (!data.length) return;
  const headers = Object.keys(data[0]).join(",");
  const rows = data.map((r) =>
    Object.values(r)
      .map((v) => (v === null || v === undefined ? "" : String(v).replace(/,/g, ";")))
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

function exportToJson(data: Record<string, any>[], summary: Record<string, any> | undefined, filename: string) {
  const payload = { report: { summary, data } };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
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
  currency = "USD"
}: Props) {
  const _ = (key: UiKey, fallback?: string) => t(lang, key, fallback);
  const isRTL = ["ar", "ur", "fa", "ps"].includes(lang);
  const [isExporting, setIsExporting] = useState(false);

  const filename = `${reportType}-${new Date().toISOString().slice(0, 10)}`;

  const handleCsv = () => {
    setIsExporting(true);
    try {
      exportToCsv(data, `${filename}.csv`);
    } finally {
      setTimeout(() => setIsExporting(false), 1000);
    }
  };

  const handleJson = () => {
    setIsExporting(true);
    try {
      exportToJson(data, summary, `${filename}.json`);
    } finally {
      setTimeout(() => setIsExporting(false), 1000);
    }
  };

  const handlePrint = () => {
    window.print();
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
        className="flex items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 dark:bg-violet-950/40 dark:border-violet-900 px-3 py-1.5 text-xs font-bold text-violet-700 dark:text-violet-400 hover:bg-violet-100 dark:hover:bg-violet-950/70 transition-all shadow-sm"
      >
        <Printer className="h-3.5 w-3.5" />
        {_("report.print")}
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
