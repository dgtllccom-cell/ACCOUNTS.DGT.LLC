"use client";

import React, { useState } from "react";
import { Printer, FileText, Download, ChevronDown, Check, MoreVertical } from "lucide-react";
import { openUniversalPrintReport, type UniversalPrintInput } from "@/lib/reports/universal-print-engine";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { translateHeader } from "@/lib/i18n/table-headers";
import { cn } from "@/lib/utils";

export interface UniversalPrintActionButtonProps {
  reportConfig: () => UniversalPrintInput;
  className?: string;
  buttonLabel?: string;
  hideExcel?: boolean;
  /**
   * "buttons" (default, unchanged) renders Print / PDF / Excel side by side.
   * "menu" renders ONE compact ⋮ button whose menu holds Print, Download PDF and Excel/CSV - used by every register that gets its Print / PDF from this
   * shared engine, so the same action looks and behaves the same across the ERP.
   */
  variant?: "buttons" | "menu";
}

export function UniversalPrintActionButton({
  reportConfig,
  className,
  buttonLabel,
  hideExcel = false,
  variant = "buttons"
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
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${config.title.toLowerCase().replace(/[^a-z0-9]/g, "_")}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (variant === "menu") {
    return (
      <div className="relative inline-flex">
        <button
          type="button"
          data-testid="register-actions-menu"
          aria-label={buttonLabel || tr("Print")}
          aria-haspopup="menu"
          aria-expanded={isOpen}
          title={buttonLabel || tr("Print")}
          onClick={() => setIsOpen((v) => !v)}
          className={cn(
            "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200",
            className
          )}
        >
          <MoreVertical className="h-4 w-4" />
        </button>
        {isOpen ? (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setIsOpen(false)} />
            <div role="menu" className="absolute end-0 top-full z-40 mt-1.5 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl dark:border-slate-700 dark:bg-slate-900">
              <button type="button" role="menuitem" data-testid="register-menu-print" onClick={() => handleAction("print")} className="flex w-full items-center gap-2 px-3 py-1.5 text-start text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800">
                <Printer className="h-3.5 w-3.5" /> {tr("Print")}
              </button>
              <button type="button" role="menuitem" data-testid="register-menu-pdf" onClick={() => handleAction("pdf")} className="flex w-full items-center gap-2 px-3 py-1.5 text-start text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800">
                <FileText className="h-3.5 w-3.5" /> {tr("PDF")}
              </button>
              {!hideExcel ? (
                <button type="button" role="menuitem" data-testid="register-menu-excel" onClick={() => handleAction("excel")} className="flex w-full items-center gap-2 px-3 py-1.5 text-start text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800">
                  <Download className="h-3.5 w-3.5" /> {tr("Excel")}
                </button>
              ) : null}
            </div>
          </>
        ) : null}
      </div>
    );
  }

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
