"use client";

import React, { useState } from "react";
import { Printer, FileText, Download, ChevronDown, Check } from "lucide-react";
import { openUniversalPrintReport, type UniversalPrintInput } from "@/lib/reports/universal-print-engine";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { translateHeader } from "@/lib/i18n/table-headers";
import { cn } from "@/lib/utils";

export interface UniversalPrintActionButtonProps {
  reportConfig: () => UniversalPrintInput;
  className?: string;
  buttonLabel?: string;
  hideExcel?: boolean;
}

export function UniversalPrintActionButton({
  reportConfig,
  className,
  buttonLabel,
  hideExcel = false
}: UniversalPrintActionButtonProps) {
  const lang = useActiveLanguage();
  const [isOpen, setIsOpen] = useState(false);

  const tr = (text: string) => translateHeader(lang, text);

  const handleAction = (type: "print" | "pdf" | "excel") => {
    setIsOpen(false);
    const config = reportConfig();
    config.lang = lang;

    if (type === "print") {
      config.autoPrint = true;
      openUniversalPrintReport(config);
    } else if (type === "pdf") {
      config.autoPrint = false;
      openUniversalPrintReport(config);
    } else if (type === "excel") {
      exportToCsv(config);
    }
  };

  const exportToCsv = (config: UniversalPrintInput) => {
    const headers = config.columns.map(c => tr(c.label));
    const csvRows = config.rows.map(r => {
      return config.columns.map(c => {
        const val = String(r[c.key] ?? "");
        return `"${val.replace(/"/g, '""')}"`;
      }).join(",");
    });

    const csvContent = [headers.map(h => `"${h.replace(/"/g, '""')}"`).join(","), ...csvRows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${config.title.toLowerCase().replace(/[^a-z0-9]/g, "_")}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="relative inline-flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => handleAction("print")}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 shadow-sm hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300 transition",
          className
        )}
      >
        <Printer className="h-3.5 w-3.5" />
        <span>{buttonLabel || tr("Print")}</span>
      </button>

      <button
        type="button"
        onClick={() => handleAction("pdf")}
        className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 shadow-sm hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300 transition"
      >
        <FileText className="h-3.5 w-3.5" />
        <span>{tr("PDF")}</span>
      </button>

      {!hideExcel && (
        <button
          type="button"
          onClick={() => handleAction("excel")}
          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 shadow-sm hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 transition"
        >
          <Download className="h-3.5 w-3.5" />
          <span>{tr("Excel")}</span>
        </button>
      )}
    </div>
  );
}
