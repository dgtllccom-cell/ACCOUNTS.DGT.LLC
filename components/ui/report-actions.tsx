"use client";

import React from "react";
import { Printer, FileDown, FileSpreadsheet } from "lucide-react";
import { fetchBranding, brandingFooter, brandingName, type Branding } from "@/lib/branding/client";
import { Th } from "@/components/ui/translated-th";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t as uiText } from "@/lib/i18n/ui";

/**
 * Universal report actions — Print, PDF (print-to-PDF), Excel (CSV) — drop into
 * ANY list/report view. No heavy libraries: PDF uses the browser print dialog
 * (Save as PDF), Excel exports a CSV that opens in Excel. One consistent
 * layout/toolbar for the whole ERP.
 *
 * Branding: pass `countryId` (and optionally `lang`) and the printed header,
 * logo, watermark and footer are pulled from that country/company's profile
 * via the shared /api/erp/branding resolver. No hardcoded company — one
 * company's branding can never appear on another's report.
 *
 *   <ReportActions title="Truck Loading" rows={rows} countryId={countryId}
 *      columns={[{ key: "truck_number", label: "Truck #" }, ...]} />
 */
export type ReportColumn = { key: string; label: string };

function cell(v: any): string {
  if (v == null) return "";
  return String(v);
}

const esc = (s: string) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const PRINT_STYLE = `
  @page { size: A4; margin: 16mm; }
  body { font-family: Arial, Helvetica, sans-serif; color:#111; }
  .hdr { display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #1e3a8a; padding-bottom:6px; margin-bottom:12px; }
  .hdr h1 { font-size:18px; margin:0; color:#1e3a8a; }
  .hdr .left { display:flex; align-items:center; gap:12px; }
  .hdr .logo { height:52px; width:auto; max-width:120px; object-fit:contain; }
  .brand { font-size:12px; font-weight:bold; text-align:right; }
  .meta { font-size:10px; color:#555; font-weight:normal; }
  table { width:100%; border-collapse:collapse; font-size:12px; }
  th,td { border:1px solid #cbd5e1; padding:6px 9px; text-align:left; vertical-align:top; }
  .kv th { background:#eef2ff; width:34%; }
  .ftr { margin-top:16px; font-size:9px; color:#888; text-align:center; border-top:1px solid #e2e8f0; padding-top:6px; }
  .watermark { position:fixed; inset:0; display:flex; align-items:center; justify-content:center; opacity:0.05; font-size:110px; font-weight:900; color:#1e3a8a; z-index:-1; }
`;

/** Header block built from branding (logo + company name + scope + optional report header). */
function brandHeader(b: Branding | null, title: string, lang: string, subtitle?: string, extraMeta?: string) {
  const now = new Date();
  const name = brandingName(b, lang) || "Report";
  const logo = b?.logoUrl ? `<img class="logo" src="${esc(b.logoUrl)}" alt="logo" />` : "";
  const scope = [b?.countryName, b?.reportHeader].filter(Boolean).map((x) => esc(String(x))).join(" — ");
  return `<div class="hdr">
      <div class="left">${logo}<div><h1>${esc(title)}</h1>${subtitle ? `<div class="meta">${esc(subtitle)}</div>` : ""}${scope ? `<div class="meta">${scope}</div>` : ""}</div></div>
      <div class="brand">${esc(name)}<div class="meta">${esc(uiText(lang, "report.generated_at"))}: ${now.toLocaleString()}</div>${extraMeta ? `<div class="meta">${esc(extraMeta)}</div>` : ""}</div>
    </div>`;
}

function watermarkOf(b: Branding | null, lang: string) {
  return esc(b?.watermarkText || brandingName(b, lang) || "REPORT");
}

function openWindow(html: string, title?: string) {
  try {
    const { printStore } = require("@/lib/store/print-store");
    printStore.openPrint(html, title || "ERP Document");
    return;
  } catch (e) {
    console.warn("Could not open in printStore, falling back to window.open", e);
  }

  const w = window.open("", "_blank", "width=1000,height=700");
  if (w) {
    w.document.open();
    w.document.write(html);
    w.document.close();
  }
}

function openPrint(title: string, inner: string, b: Branding | null, lang: string, subtitle?: string) {
  const footer = brandingFooter(b, lang) || watermarkOf(b, lang);
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);
  const html = `<!doctype html><html lang="${esc(lang)}" dir="${isRtl ? "rtl" : "ltr"}"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${PRINT_STYLE}</style></head><body>
    <div class="watermark">${watermarkOf(b, lang)}</div>
    ${brandHeader(b, title, lang, subtitle)}
    ${inner}
    <div class="ftr">${esc(footer)} — ${esc(title)}</div>
    <script>window.onload=function(){window.print();}</script></body></html>`;
  openWindow(html, title);
}

/**
 * Single-record print — a professional A4 key/value document for one record.
 * Pass opts.countryId to brand it for that record's country/company.
 */
export async function printRecord(
  title: string,
  record: Record<string, any>,
  columns: ReportColumn[],
  subtitle?: string,
  opts?: { countryId?: string | null; lang?: string }
) {
  const b = await fetchBranding(opts?.countryId);
  const lang = opts?.lang || "en";
  const rows = columns.map((c) => `<tr><th>${esc(c.label)}</th><td>${esc(cell(record[c.key]))}</td></tr>`).join("");
  openPrint(title, `<table class="kv"><tbody>${rows}</tbody></table>`, b, lang, subtitle);
}

export function ReportActions({
  title,
  rows,
  columns,
  filename,
  subtitle,
  countryId,
  lang,
}: {
  title: string;
  rows: Record<string, any>[];
  columns: ReportColumn[];
  filename?: string;
  subtitle?: string;
  countryId?: string | null;
  lang?: string;
}) {
  const activeLanguage = useActiveLanguage();
  const resolvedLang = lang ?? activeLanguage ?? "en";
  const base = (filename || title).replace(/[^a-zA-Z0-9]+/g, "_");

  function exportCsv() {
    const head = columns.map((c) => `"${c.label.replace(/"/g, '""')}"`).join(",");
    const body = rows.map((r) => columns.map((c) => `"${cell(r[c.key]).replace(/"/g, '""')}"`).join(",")).join("\n");
    const csv = "﻿" + head + "\n" + body; // BOM for Excel UTF-8
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${base}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function printDoc() {
    const { openGenericErpReport } = await import("@/lib/reports/open-generic-erp-report");
    openGenericErpReport({
      title,
      subtitle: subtitle || `Total ${rows.length} records`,
      lang: resolvedLang,
      columns: columns.map((c) => ({ key: c.key, label: c.label })),
      rows: rows as Record<string, unknown>[],
      summary: { TotalRecords: rows.length },
    });
  }

  const btn = "inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={printDoc} className={btn} title={uiText(resolvedLang, "report.print")}><Printer className="h-4 w-4" /> {uiText(resolvedLang, "report.print")}</button>
      <button type="button" onClick={printDoc} className={btn} title={uiText(resolvedLang, "report.export_pdf")}><FileDown className="h-4 w-4" /> {uiText(resolvedLang, "report.export_pdf")}</button>
      <button type="button" onClick={exportCsv} className={btn} title={uiText(resolvedLang, "report.export_excel")}><FileSpreadsheet className="h-4 w-4" /> {uiText(resolvedLang, "report.export_excel")}</button>
    </div>
  );
}
