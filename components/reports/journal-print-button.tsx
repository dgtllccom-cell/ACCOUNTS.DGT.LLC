"use client";

import React, { useState } from "react";
import { Printer, Loader2, MoreVertical, FileText, Download, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { useErpScope } from "@/lib/hooks/use-erp-scope";
import { t } from "@/lib/i18n/ui";
import { openScopedGenericReport } from "@/lib/reports/open-scoped-report";
import { getRowValue, type GenericReportColumn } from "@/lib/reports/open-generic-erp-report";
import type { ERPCompanyInfo, ERPFilterPill } from "@/lib/reports/erp-report-template-builder";

export type JournalPrintButtonProps = {
  title: string;
  subtitle?: string;
  columns: GenericReportColumn[];
  rows?: Record<string, unknown>[];
  fetchFullData?: () => Promise<Record<string, unknown>[]>;
  summary?: Record<string, unknown>;
  totalsRow?: Record<string, unknown>;
  filters?: ERPFilterPill[];
  /** optional explicit branding override; when omitted branding resolves from the login scope */
  companyInfo?: ERPCompanyInfo;
  /** optional explicit scope for branding resolution (defaults to the logged-in scope) */
  countryId?: string | null;
  countryBranchId?: string | null;
  cityBranchId?: string | null;
  orientation?: "portrait" | "landscape";
  className?: string;
  variant?: "default" | "outline" | "secondary" | "ghost" | "menu";
  size?: "default" | "sm" | "lg" | "icon";
  /** menu variant: optional View Details callback (opens the caller's own detail flow, never a window). */
  onView?: () => void;
  /** menu variant: hide the Excel item (the engine's preview already offers CSV / Excel). Default: show it. */
  hideExcel?: boolean;
};

export function JournalPrintButton({
  title,
  subtitle,
  columns,
  rows,
  fetchFullData,
  summary,
  totalsRow,
  filters,
  companyInfo,
  countryId,
  countryBranchId,
  cityBranchId,
  orientation,
  className = "",
  variant = "outline",
  size = "sm",
  onView,
  hideExcel = false,
}: JournalPrintButtonProps) {
  const lang = useActiveLanguage();
  const scope = useErpScope();
  const [loading, setLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const buildAndOpen = async (overrideOrientation?: "portrait" | "landscape") => {
    try {
      setLoading(true);
      let dataset = rows || [];
      if (fetchFullData) {
        dataset = await fetchFullData();
      }

      // Branding: an explicit override wins; otherwise resolve dynamically from
      // the logged-in country/branch scope. Never a hard-coded company.
      const resolvedCountryId = countryId ?? scope.lockedCountryId ?? undefined;
      const resolvedCountryBranchId = countryBranchId ?? scope.lockedCountryBranchId ?? undefined;
      const resolvedCityBranchId = cityBranchId ?? scope.lockedCityBranchId ?? undefined;

      await openScopedGenericReport({
        title,
        subtitle,
        lang,
        columns,
        rows: dataset,
        summary,
        totalsRow,
        filters: filters?.map((f) => ({ label: f.label, value: String(f.value ?? "") })),
        orientation: overrideOrientation ?? orientation,
        countryId: resolvedCountryId,
        countryBranchId: resolvedCountryBranchId,
        cityBranchId: resolvedCityBranchId,
        countryName: companyInfo?.country ?? scope.countryName,
        branchName: companyInfo?.branch ?? scope.branchDisplayName,
        currency: companyInfo?.currency,
        printedBy: companyInfo?.printedBy ?? scope.userName,
      });
    } catch (err) {
      console.error("Journal Print Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => buildAndOpen();

  const exportCsv = async () => {
    // same data the preview engine loads: pull via fetchFullData when present
    const dataset = fetchFullData ? await fetchFullData() : rows ?? [];
    const headers = columns.map((c) => c.label);
    const csvRows = dataset.map((r) => columns.map((c) => `"${String(getRowValue(r, c.key) ?? "").replace(/"/g, '""')}"`).join(","));
    const blob = new Blob(["﻿" + [headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(","), ...csvRows].join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.toLowerCase().replace(/[^a-z0-9]/g, "_")}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (variant === "menu") {
    const run = async (fn: () => Promise<void> | void) => {
      setMenuOpen(false);
      await fn();
    };
    const itemCls =
      "flex w-full items-center gap-2 px-3 py-1.5 text-start text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800";
    return (
      <div className={`relative inline-flex ${className}`}>
        <Button
          type="button"
          variant="outline"
          size="icon"
          data-testid="register-actions-menu"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label={t(lang, "report.print", "Print Report")}
          onClick={() => setMenuOpen((v) => !v)}
          disabled={loading}
          className="h-8 w-8 rounded-lg"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreVertical className="h-4 w-4" />}
        </Button>
        {menuOpen ? (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
            <div role="menu" className="absolute end-0 top-full z-40 mt-1.5 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl dark:border-slate-700 dark:bg-slate-900">
              {onView ? (
                <button type="button" role="menuitem" data-testid="register-menu-view" onClick={() => run(onView)} className={itemCls}>
                  <Eye className="h-3.5 w-3.5" /> {t(lang, "report.view_details", "View Details")}
                </button>
              ) : null}
              <button type="button" role="menuitem" data-testid="register-menu-print" onClick={() => run(handlePrint)} className={itemCls}>
                <Printer className="h-3.5 w-3.5" /> {t(lang, "report.print", "Print Report")}
              </button>
              <button type="button" role="menuitem" data-testid="register-menu-pdf-portrait" onClick={() => run(() => buildAndOpen("portrait"))} className={itemCls}>
                <FileText className="h-3.5 w-3.5" /> {t(lang, "report.pdf_portrait", "Download PDF - Portrait")}
              </button>
              <button type="button" role="menuitem" data-testid="register-menu-pdf-landscape" onClick={() => run(() => buildAndOpen("landscape"))} className={itemCls}>
                <FileText className="h-3.5 w-3.5 rotate-90" /> {t(lang, "report.pdf_landscape", "Download PDF - Landscape")}
              </button>
              {hideExcel ? null : (
                <button type="button" role="menuitem" data-testid="register-menu-excel" onClick={() => run(exportCsv)} className={itemCls}>
                  <Download className="h-3.5 w-3.5" /> {t(lang, "report.export_excel", "Export Excel")}
                </button>
              )}
            </div>
          </>
        ) : null}
      </div>
    );
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handlePrint}
      data-testid="print-action"
      disabled={loading}
      className={`gap-1.5 font-bold shadow-xs ${className}`}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
      ) : (
        <Printer className="h-4 w-4 text-blue-600" />
      )}
      <span>{loading ? t(lang, "common.loading", "Loading...") : t(lang, "report.print", "Print Report")}</span>
    </Button>
  );
}
