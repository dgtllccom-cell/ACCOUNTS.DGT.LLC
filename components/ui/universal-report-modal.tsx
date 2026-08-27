"use client";

import React, { useState, useRef } from "react";
import {
  Printer,
  Download,
  FileSpreadsheet,
  FileText,
  X,
  Eye,
  Building2,
  Calendar,
  User,
  Globe,
  MapPin,
  Filter,
  CheckCircle,
  Clock
} from "lucide-react";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t as uiText } from "@/lib/i18n/ui";
import { rtlLanguages } from "@/lib/i18n/languages";
import { translateHeader } from "@/lib/i18n/table-headers";
import { translateValue } from "@/lib/i18n/table-values";
import { openUniversalPrintReport } from "@/lib/reports/universal-print-engine";

export interface ReportColumn<T = any> {
  key: string;
  label: string;
  align?: "left" | "center" | "right";
  format?: (value: any, row: T) => React.ReactNode;
  isNumeric?: boolean;
  /** Numeric column holds a monetary amount — totals row appends a currency code. Plain counts/quantities should leave this unset. */
  isCurrency?: boolean;
}

export interface ReportFilter {
  label: string;
  value: string;
}

export interface UniversalReportModalProps<T = any> {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  companyName?: string;
  countryName?: string;
  branchName?: string;
  userName?: string;
  projectName?: string;
  fromDate?: string;
  toDate?: string;
  currency?: string;
  filters?: ReportFilter[];
  columns: ReportColumn<T>[];
  data: T[];
  debitTotal?: number;
  creditTotal?: number;
  balanceTotal?: number;
  grandTotal?: number;
  showTotals?: boolean;
  exportFileName?: string;
}

export function UniversalReportModal<T extends Record<string, any> = Record<string, any>>({
  isOpen,
  onClose,
  title,
  subtitle,
  companyName = "DGT INTERNATIONAL TRADING LLC",
  countryName = "United Arab Emirates",
  branchName = "Head Office - Dubai",
  userName = "Admin User",
  projectName = "ERP Enterprise",
  fromDate,
  toDate,
  currency = "AED",
  filters = [],
  columns,
  data,
  debitTotal,
  creditTotal,
  balanceTotal,
  grandTotal,
  showTotals = true,
  exportFileName = "erp-report"
}: UniversalReportModalProps<T>) {
  const currentLanguage = useActiveLanguage();
  const isRtl = rtlLanguages.includes(currentLanguage as any);
  const dir = isRtl ? "rtl" : "ltr";
  const th = (label: string) => translateHeader(currentLanguage, label);
  const tv = (value: unknown) => translateValue(currentLanguage, String(value ?? ""));
  const printRef = useRef<HTMLDivElement>(null);
  const [viewMode, setViewMode] = useState<"preview" | "print">("preview");

  if (!isOpen) return null;

  const nowString = new Date().toLocaleString(isRtl ? "ar-AE" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  });

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const headers = columns.map(c => `"${c.label.replace(/"/g, '""')}"`).join(",");
    const rows = data.map(row =>
      columns
        .map(c => {
          const val = row[c.key];
          return `"${String(val ?? "").replace(/"/g, '""')}"`;
        })
        .join(",")
    );
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers, ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${exportFileName}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportExcel = () => {
    // Generate styled HTML Table as XLS download
    let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">`;
    html += `<head><meta charset="utf-8"/><style>
      table { border-collapse: collapse; width: 100%; font-family: Arial; }
      th { background-color: #1e293b; color: #ffffff; font-weight: bold; border: 1px solid #334155; padding: 8px; }
      td { border: 1px solid #cbd5e1; padding: 6px; }
      .header-title { font-size: 18px; font-weight: bold; color: #0f172a; }
      .meta { color: #475569; font-size: 12px; }
      .num { text-align: right; }
    </style></head><body>`;

    html += `<div class="header-title">${companyName}</div>`;
    html += `<div class="header-title" style="font-size:14px; color:#2563eb;">${title}</div>`;
    html += `<div class="meta">${countryName} | ${branchName} | ${nowString}</div><br/>`;

    html += `<table><thead><tr>`;
    columns.forEach(c => {
      html += `<th>${c.label}</th>`;
    });
    html += `</tr></thead><tbody>`;

    data.forEach(row => {
      html += `<tr>`;
      columns.forEach(c => {
        const val = row[c.key] ?? "";
        const alignClass = c.align === "right" || c.isNumeric ? 'class="num"' : "";
        html += `<td ${alignClass}>${val}</td>`;
      });
      html += `</tr>`;
    });

    html += `</tbody></table></body></html>`;

    const blob = new Blob([html], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${exportFileName}_${new Date().toISOString().slice(0, 10)}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleExportPDF = () => {
    openUniversalPrintReport({
      title,
      subtitle,
      lang: currentLanguage,
      columns: columns.map(c => ({ key: c.key, label: c.label })),
      rows: data,
      autoPrint: true,
    });
  };


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto print:p-0 print:bg-white print:static">
      <div
        dir={dir}
        className="relative w-full max-w-6xl rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] print:max-h-none print:border-none print:shadow-none print:w-full print:bg-white print:text-slate-900"
      >
        {/* Top Control Bar (Hidden on Print) */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950/90 border-b border-slate-800 px-6 py-4 print:hidden">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 text-cyan-400 border border-cyan-500/30">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-10 text-white flex items-center gap-2">
                {title}
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-mono">
                  {data.length} {uiText(currentLanguage, "report.records")}
                </span>
              </h2>
              <p className="text-xs text-slate-400">{companyName} • {branchName}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 px-3.5 py-2 text-xs font-semibold text-slate-950 transition-colors shadow-lg shadow-cyan-500/20"
            >
              <Printer className="h-3.5 w-3.5" />
              {uiText(currentLanguage, "report.print")}
            </button>
            <button
              onClick={handleExportPDF}
              className="flex items-center gap-1.5 rounded-lg bg-rose-600/90 hover:bg-rose-500 px-3.5 py-2 text-xs font-semibold text-white transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              {uiText(currentLanguage, "report.export_pdf")}
            </button>
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600/90 hover:bg-emerald-500 px-3.5 py-2 text-xs font-semibold text-white transition-colors"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              {uiText(currentLanguage, "report.export_excel")}
            </button>
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 transition-colors border border-slate-700"
            >
              <FileText className="h-3.5 w-3.5 text-slate-400" />
              {uiText(currentLanguage, "report.export_csv")}
            </button>
            <button
              onClick={onClose}
              className="ml-2 flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Report Canvas Content (Printable area) */}
        <div ref={printRef} className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 print:p-0 print:overflow-visible">
          {/* Header Banner */}
          <div className="rounded-xl bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 p-6 border border-slate-800 print:bg-none print:border-b-2 print:border-slate-900 print:p-0 print:pb-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-cyan-400 print:text-slate-800" />
                  <span className="text-lg font-bold text-white tracking-wide uppercase print:text-slate-900">
                    {companyName}
                  </span>
                </div>
                <h1 className="text-xl font-extrabold text-cyan-400 print:text-slate-800">
                  {title}
                </h1>
                {subtitle && <p className="text-xs text-slate-400 print:text-slate-600">{subtitle}</p>}
              </div>

              {/* Scope & Metadata Details */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs bg-slate-900/80 p-3 rounded-lg border border-slate-800/80 print:bg-slate-50 print:border-slate-200 print:text-slate-800">
                <div className="flex items-center gap-1.5 text-slate-300 print:text-slate-700">
                  <Globe className="h-3.5 w-3.5 text-cyan-400 print:text-slate-600" />
                  <span>{countryName}</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-300 print:text-slate-700">
                  <MapPin className="h-3.5 w-3.5 text-cyan-400 print:text-slate-600" />
                  <span>{branchName}</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-300 print:text-slate-700">
                  <User className="h-3.5 w-3.5 text-cyan-400 print:text-slate-600" />
                  <span>{userName}</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-300 print:text-slate-700">
                  <Clock className="h-3.5 w-3.5 text-cyan-400 print:text-slate-600" />
                  <span>{nowString}</span>
                </div>
                {fromDate && (
                  <div className="flex items-center gap-1.5 text-slate-300 print:text-slate-700">
                    <Calendar className="h-3.5 w-3.5 text-cyan-400 print:text-slate-600" />
                    <span>From: {fromDate}</span>
                  </div>
                )}
                {toDate && (
                  <div className="flex items-center gap-1.5 text-slate-300 print:text-slate-700">
                    <Calendar className="h-3.5 w-3.5 text-cyan-400 print:text-slate-600" />
                    <span>To: {toDate}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Filter Badges */}
            {filters.length > 0 && (
              <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center gap-2 print:border-slate-300">
                <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1 print:text-slate-600">
                  <Filter className="h-3 w-3" /> {uiText(currentLanguage, "report.filters")}:
                </span>
                {filters.map((f, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-800 text-cyan-300 border border-slate-700 print:bg-slate-200 print:text-slate-800 print:border-slate-300"
                  >
                    <span className="text-slate-400">{th(f.label)}:</span>
                    <span className="font-semibold">{tv(f.value)}</span>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Main Data Table */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 overflow-hidden print:border-slate-300 print:bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs print:text-[11px]">
                <thead className="bg-slate-900/90 text-slate-200 uppercase font-semibold border-b border-slate-800 print:bg-slate-100 print:text-slate-900 print:border-slate-300">
                  <tr>
                    <th className="px-4 py-3 text-center w-12 border-r border-slate-800 print:border-slate-300">#</th>
                    {columns.map(col => (
                      <th
                        key={col.key}
                        className={`px-4 py-3 border-r border-slate-800 print:border-slate-300 last:border-r-0 ${
                          col.align === "right" || col.isNumeric ? "text-right" : col.align === "center" ? "text-center" : "text-left"
                        }`}
                      >
                        {th(col.label)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 print:divide-slate-200">
                  {data.length === 0 ? (
                    <tr>
                      <td colSpan={columns.length + 1} className="px-4 py-8 text-center text-slate-500 print:text-slate-400">
                        {uiText(currentLanguage, "report.no_records_selected_criteria")}
                      </td>
                    </tr>
                  ) : (
                    data.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-900/40 transition-colors print:hover:bg-transparent">
                        <td className="px-4 py-2.5 text-center font-mono text-slate-500 border-r border-slate-800/60 print:text-slate-600 print:border-slate-200">
                          {idx + 1}
                        </td>
                        {columns.map(col => (
                          <td
                            key={col.key}
                            className={`px-4 py-2.5 border-r border-slate-800/60 print:border-slate-200 last:border-r-0 text-slate-300 print:text-slate-900 ${
                              col.align === "right" || col.isNumeric ? "text-right font-mono" : col.align === "center" ? "text-center" : ""
                            }`}
                          >
                            {col.format ? col.format(row[col.key], row) : tv(row[col.key] ?? "-")}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
                {/* Financial Summary & Totals Footer */}
                {showTotals && data.length > 0 && (
                  <tfoot className="bg-slate-900 font-bold border-t-2 border-slate-700 text-white print:bg-slate-100 print:text-slate-900 print:border-slate-400">
                    <tr>
                      <td colSpan={2} className="px-4 py-3 uppercase text-xs tracking-wider text-cyan-400 print:text-slate-800">
                        {uiText(currentLanguage, "report.totals")} ({data.length} {uiText(currentLanguage, "report.items")})
                      </td>
                      {columns.slice(1).map(col => {
                        let totalVal: React.ReactNode = null;
                        let totalCurrency: string | null = null;
                        const isMoney = col.isCurrency || col.key === "debit" || col.key === "debit_amount" ||
                          col.key === "credit" || col.key === "credit_amount" ||
                          col.key === "balance" || col.key === "net_balance" ||
                          col.key === "amount" || col.key === "total_amount";
                        if (col.key === "debit" || col.key === "debit_amount") {
                          totalVal = debitTotal ?? data.reduce((acc, r) => acc + (Number(r[col.key]) || 0), 0);
                        } else if (col.key === "credit" || col.key === "credit_amount") {
                          totalVal = creditTotal ?? data.reduce((acc, r) => acc + (Number(r[col.key]) || 0), 0);
                        } else if (col.key === "balance" || col.key === "net_balance") {
                          totalVal = balanceTotal ?? grandTotal ?? 0;
                        } else if (col.isNumeric) {
                          // Sum any other numeric column so custom key names (e.g. order_total,
                          // advance_paid, remaining_due) still get a real total instead of rendering blank.
                          totalVal = data.reduce((acc, r) => acc + (Number(r[col.key]) || 0), 0);
                        }

                        if (totalVal !== null) {
                          totalVal = Number(totalVal).toLocaleString("en-US", { minimumFractionDigits: isMoney ? 2 : 0 });
                          if (isMoney) {
                            const rowCurrencies = new Set(data.map(r => r.currency_code || r.currency).filter(Boolean));
                            totalCurrency = rowCurrencies.size === 1 ? ([...rowCurrencies][0] as string) : currency;
                          }
                        }

                        return (
                          <td
                            key={col.key}
                            className={`px-4 py-3 font-mono text-xs ${
                              col.align === "right" || col.isNumeric ? "text-right" : "text-left"
                            }`}
                          >
                            {totalVal ? (totalCurrency ? `${totalVal} ${totalCurrency}` : `${totalVal}`) : ""}
                          </td>
                        );
                      })}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* Footer Metadata */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-4 border-t border-slate-800 text-[11px] text-slate-500 print:border-slate-300 print:text-slate-600">
            <div className="flex items-center gap-1.5">
              <CheckCircle className="h-3.5 w-3.5 text-emerald-500 print:text-slate-600" />
              <span>{uiText(currentLanguage, "report.official_system_verified_document")} • {projectName}</span>
            </div>
            <div>
              <span>{uiText(currentLanguage, "report.generated_by")} {userName} • {uiText(currentLanguage, "report.generated_at")} {nowString}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
