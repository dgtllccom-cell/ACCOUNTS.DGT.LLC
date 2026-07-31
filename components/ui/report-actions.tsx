"use client";

import { Printer, FileDown, FileSpreadsheet } from "lucide-react";

/**
 * Universal report actions — Print, PDF (print-to-PDF), Excel (CSV) — drop into
 * ANY list/report view. No heavy libraries: PDF uses the browser print dialog
 * (Save as PDF), Excel exports a CSV that opens in Excel. One consistent
 * layout/toolbar for the whole ERP.
 *
 *   <ReportActions title="Truck Loading" rows={rows}
 *      columns={[{ key: "truck_number", label: "Truck #" }, ...]} />
 */
export type ReportColumn = { key: string; label: string };

function cell(v: any): string {
  if (v == null) return "";
  return String(v);
}

export function ReportActions({
  title,
  rows,
  columns,
  filename,
  subtitle,
}: {
  title: string;
  rows: Record<string, any>[];
  columns: ReportColumn[];
  filename?: string;
  subtitle?: string;
}) {
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

  function printDoc() {
    const now = new Date();
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const head = columns.map((c) => `<th>${esc(c.label)}</th>`).join("");
    const body = rows.map((r) => `<tr>${columns.map((c) => `<td>${esc(cell(r[c.key]))}</td>`).join("")}</tr>`).join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
      <style>
        @page { size: A4 landscape; margin: 14mm; }
        body { font-family: Arial, Helvetica, sans-serif; color: #111; }
        .hdr { display:flex; justify-content:space-between; align-items:flex-end; border-bottom:2px solid #1e3a8a; padding-bottom:6px; margin-bottom:10px; }
        .hdr h1 { font-size:18px; margin:0; color:#1e3a8a; }
        .hdr .brand { font-size:12px; font-weight:bold; }
        .meta { font-size:10px; color:#555; }
        table { width:100%; border-collapse:collapse; font-size:11px; }
        th,td { border:1px solid #cbd5e1; padding:5px 7px; text-align:left; }
        thead th { background:#eef2ff; }
        tbody tr:nth-child(even){ background:#f8fafc; }
        .ftr { margin-top:14px; font-size:9px; color:#888; text-align:center; }
        .watermark { position:fixed; inset:0; display:flex; align-items:center; justify-content:center; opacity:0.05; font-size:120px; font-weight:900; color:#1e3a8a; z-index:-1; }
      </style></head><body>
      <div class="watermark">DIGITAL DOCK ERP</div>
      <div class="hdr">
        <div><h1>${esc(title)}</h1>${subtitle ? `<div class="meta">${esc(subtitle)}</div>` : ""}</div>
        <div class="brand">Digital Dock ERP<div class="meta">Printed: ${now.toLocaleString()}</div><div class="meta">Rows: ${rows.length}</div></div>
      </div>
      <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
      <div class="ftr">Digital Dock ERP — ${esc(title)} — Page 1</div>
      <script>window.onload=function(){window.print();}</script>
      </body></html>`;
    const w = window.open("", "_blank", "width=1000,height=700");
    if (!w) return;
    w.document.open(); w.document.write(html); w.document.close();
  }

  const btn = "inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={printDoc} className={btn} title="Print"><Printer className="h-4 w-4" /> Print</button>
      <button type="button" onClick={printDoc} className={btn} title="Save as PDF"><FileDown className="h-4 w-4" /> PDF</button>
      <button type="button" onClick={exportCsv} className={btn} title="Export Excel (CSV)"><FileSpreadsheet className="h-4 w-4" /> Excel</button>
    </div>
  );
}
