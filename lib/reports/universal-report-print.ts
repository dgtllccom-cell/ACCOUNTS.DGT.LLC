/**
 * universal-report-print — turns a report screen's data (the SAME data the
 * <UniversalReportShell> renders) into an A4 print/PDF document whose layout
 * mirrors the screen: full Branch & User Details block, the four report cards,
 * the applied-filter chips, then the detailed table with a repeating header,
 * page-break-safe rows and a totals row.
 *
 * Pure `buildUniversalReportHtml()` is safe server-side / in tests.
 * `openUniversalReport()` (client) hands it to the shared PdfPreviewModal via
 * printStore — which already provides preview, real PDF download (html2pdf),
 * print, and the language / portrait-landscape switch through the `rebuild` cb.
 */

import { escapeReportHtml, A4_SHARED_CSS } from "./report-shell";
import { printStore } from "@/lib/store/print-store";

export type UrpTone = "default" | "positive" | "negative" | "muted" | "strong";

export type UrpCardRow = { label: string; value: string | number; tone?: UrpTone; mono?: boolean };
export type UrpCard = {
  title: string;
  subtitle?: string;
  rows: UrpCardRow[];
  footer?: { label: string; value: string | number; tone?: UrpTone };
};
export type UrpColumn = { key: string; label: string; align?: "start" | "center" | "end"; format?: "text" | "number" | "currency" | "date" };
export type UrpBranchUser = {
  country: string; state: string; city: string;
  branchName: string; branchCode: string;
  userId: string; userName: string; role: string;
  accessScope: string; dateTime: string; online: boolean;
};

export type UniversalReportInput = {
  lang?: string;
  orientation?: "portrait" | "landscape";
  title: string;
  subtitle?: string;
  /** bill / manual bill / document number shown in the header meta */
  documentNo?: string;
  manualNo?: string;
  company?: { name?: string; tagline?: string; logoUrl?: string; address?: string; taxNo?: string };
  /** applied filter chips: [{label, value}] */
  appliedFilters?: Array<{ label: string; value: string }>;
  branchUser: UrpBranchUser;
  /** all four cards, in order (Branch & User Details is rendered separately, pass cards 2–4) */
  cards: UrpCard[];
  table: { title?: string; columns: UrpColumn[]; rows: Array<Record<string, unknown>>; totals?: Record<string, string | number> };
  /** i18n'd labels (caller passes translated strings so this stays pure) */
  labels: {
    branchUser: string;
    status: string; online: string; offline: string;
    country: string; state: string; city: string; branchName: string; branchCode: string;
    userId: string; userName: string; role: string; accessScope: string; dateTime: string;
    generatedOn: string; filtersApplied: string; page: string; of: string;
    billNo: string; manualBillNo: string; noData: string; total: string;
  };
  fileSlug?: string;
};

const RTL = new Set(["ur", "ar", "fa", "ps"]);

function toneColor(tone?: UrpTone) {
  switch (tone) {
    case "positive": return "#059669";
    case "negative": return "#e11d48";
    case "muted": return "#94a3b8";
    case "strong": return "#0f172a";
    default: return "#1e293b";
  }
}

function fmt(value: unknown, format?: UrpColumn["format"]) {
  if (value === null || value === undefined || value === "") return "—";
  if (format === "number" && typeof value === "number") return value.toLocaleString("en-US");
  if (format === "currency" && (typeof value === "number" || !Number.isNaN(Number(value)))) {
    return Number(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return String(value);
}

const EXTRA_CSS = `
  .rp-meta-strip { display:flex; flex-wrap:wrap; gap:6px 14px; font-size:8.5px; font-weight:700; color:#334155; margin:6px 0 12px; }
  .rp-meta-strip .k { color:#64748b; font-weight:600; }
  .rp-cards { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin-bottom:14px; }
  .rp-card { border:1.4px solid #e2e8f0; border-radius:8px; overflow:hidden; break-inside:avoid; }
  .rp-card-h { background:#f8fafc; border-bottom:1px solid #e2e8f0; padding:6px 9px; font-size:8.5px; font-weight:900; text-transform:uppercase; letter-spacing:.4px; color:#1e293b; }
  .rp-card-h small { display:block; font-size:7px; font-weight:600; color:#94a3b8; text-transform:none; letter-spacing:0; margin-top:1px; }
  .rp-card-b { padding:7px 9px; }
  .rp-row { display:flex; justify-content:space-between; gap:8px; font-size:8.5px; padding:2px 0; border-bottom:1px solid #f1f5f9; }
  .rp-row:last-child { border-bottom:none; }
  .rp-row .l { color:#64748b; font-weight:600; }
  .rp-row .v { font-weight:800; text-align:end; word-break:break-word; }
  .rp-card-f { border-top:1.5px solid #1e3a8a; background:#eef2ff; padding:5px 9px; display:flex; justify-content:space-between; font-size:9px; font-weight:900; }
  .rp-table { width:100%; border-collapse:collapse; margin-top:2px; }
  .rp-table thead { display:table-header-group; }
  .rp-table tfoot { display:table-footer-group; }
  .rp-table th { background:#0f172a; color:#fff; font-size:8px; font-weight:800; text-transform:uppercase; padding:5px 5px; border:1px solid #1e293b; }
  .rp-table td { font-size:8.5px; padding:4px 5px; border:1px solid #e2e8f0; vertical-align:top; word-break:break-word; overflow-wrap:anywhere; }
  .rp-table tr { break-inside:avoid; }
  .rp-table tr:nth-child(even) td { background:#f8fafc; }
  .rp-table tfoot td { font-weight:900; background:#eef2ff; border-top:2px solid #1e3a8a; }
  .rp-end { text-align:end; font-variant-numeric:tabular-nums; white-space:nowrap; }
  .rp-center { text-align:center; }
  html[dir="rtl"] .rp-row .v, html[dir="rtl"] .rp-end { text-align:start; }
  @page { size: A4 __ORIENT__; margin: 12mm; }
  @media print { .rp-card { break-inside:avoid; } .rp-table tr { break-inside:avoid; } }
`;

/** Pure — no window access. */
export function buildUniversalReportHtml(input: UniversalReportInput): string {
  const lang = input.lang || "en";
  const isRtl = RTL.has(lang);
  const orient = input.orientation || "portrait";
  const e = escapeReportHtml;
  const L = input.labels;
  const bu = input.branchUser;
  const now = new Date();
  const stamp = `${now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} ${now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })}`;
  const co = input.company ?? {};

  const budRows: Array<[string, string]> = [
    [L.country, bu.country], [L.state, bu.state], [L.city, bu.city],
    [L.branchName, bu.branchName], [L.branchCode, bu.branchCode],
    [L.userId, bu.userId], [L.userName, bu.userName], [L.role, bu.role],
    [L.accessScope, bu.accessScope], [L.dateTime, bu.dateTime],
  ];

  const card1 = `
    <div class="rp-card">
      <div class="rp-card-h">${e(L.branchUser)}</div>
      <div class="rp-card-b">
        ${budRows.map(([k, v]) => `<div class="rp-row"><span class="l">${e(k)}</span><span class="v">${e(v || "—")}</span></div>`).join("")}
      </div>
      <div class="rp-card-f"><span>${e(L.status)}</span><span style="color:${bu.online ? "#059669" : "#94a3b8"}">${bu.online ? e(L.online) : e(L.offline)}</span></div>
    </div>`;

  const moduleCards = (input.cards || []).slice(0, 3).map((c) => `
    <div class="rp-card">
      <div class="rp-card-h">${e(c.title)}${c.subtitle ? `<small>${e(c.subtitle)}</small>` : ""}</div>
      <div class="rp-card-b">
        ${c.rows.map((r) => `<div class="rp-row"><span class="l">${e(r.label)}</span><span class="v" style="color:${toneColor(r.tone)}${r.mono ? ";font-variant-numeric:tabular-nums" : ""}">${typeof r.value === "number" ? r.value.toLocaleString("en-US") : e(String(r.value ?? "—"))}</span></div>`).join("")}
      </div>
      ${c.footer ? `<div class="rp-card-f"><span>${e(c.footer.label)}</span><span style="color:${toneColor(c.footer.tone ?? "strong")}">${typeof c.footer.value === "number" ? c.footer.value.toLocaleString("en-US") : e(String(c.footer.value))}</span></div>` : ""}
    </div>`).join("");

  const filterChips = (input.appliedFilters ?? []).filter((f) => f.value).map(
    (f) => `<span class="chip"><b>${e(f.label)}:</b> ${e(f.value)}</span>`,
  ).join("");

  const cols = input.table.columns;
  const alignClass = (a?: UrpColumn["align"]) => (a === "end" ? "rp-end" : a === "center" ? "rp-center" : "");
  const thead = `<tr>${cols.map((c) => `<th class="${alignClass(c.align)}">${e(c.label)}</th>`).join("")}</tr>`;
  const tbody = input.table.rows.length === 0
    ? `<tr><td colspan="${cols.length}" style="text-align:center;padding:24px;color:#94a3b8;font-weight:700;">${e(L.noData)}</td></tr>`
    : input.table.rows.map((row) => `<tr>${cols.map((c) => `<td class="${alignClass(c.align)}">${e(fmt(row[c.key], c.format))}</td>`).join("")}</tr>`).join("");
  const tfoot = input.table.totals
    ? `<tfoot><tr>${cols.map((c, i) => {
        const tv = input.table.totals![c.key];
        if (i === 0 && tv === undefined) return `<td>${e(L.total)}</td>`;
        return `<td class="${alignClass(c.align)}">${tv === undefined ? "" : e(fmt(tv, c.format))}</td>`;
      }).join("")}</tr></tfoot>`
    : "";

  const metaBits: string[] = [];
  if (input.documentNo) metaBits.push(`<span><span class="k">${e(L.billNo)}:</span> ${e(input.documentNo)}</span>`);
  if (input.manualNo) metaBits.push(`<span><span class="k">${e(L.manualBillNo)}:</span> ${e(input.manualNo)}</span>`);
  metaBits.push(`<span><span class="k">${e(L.generatedOn)}:</span> ${e(stamp)}</span>`);

  return `<!doctype html>
<html lang="${e(lang)}" dir="${isRtl ? "rtl" : "ltr"}">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${e(input.title)}</title>
<style>${A4_SHARED_CSS}${EXTRA_CSS.replace(/__ORIENT__/g, orient)}</style></head>
<body><div class="wrap"><div class="page">
  <table class="header-table"><tr>
    <td style="width:34%;"><div class="logo-title"><div class="logo-icon">🏢</div><div><div class="logo-text">${e(co.name || "ACCOUNTS.DGT.LLC")}</div><div class="logo-subtext">${e(co.tagline || "Enterprise ERP / FMS")}</div></div></div></td>
    <td style="width:32%;text-align:center;"><h1 class="report-title">${e(input.title)}</h1>${input.subtitle ? `<div class="subtitle-pill">${e(input.subtitle)}</div>` : ""}</td>
    <td style="width:34%;text-align:${isRtl ? "left" : "right"};"><div class="meta-box">
      ${co.address ? `<div><span class="meta-label">${e(co.address)}</span></div>` : ""}
      ${co.taxNo ? `<div><span class="meta-label">TRN:</span> ${e(co.taxNo)}</div>` : ""}
    </div></td>
  </tr></table>

  <div class="rp-meta-strip">${metaBits.join("")}</div>

  <div class="rp-cards">
    ${card1}
    ${moduleCards}
  </div>

  ${filterChips ? `<div class="chip-row"><span style="font-size:8px;font-weight:800;color:#64748b;text-transform:uppercase;align-self:center;">${e(L.filtersApplied)}:</span> ${filterChips}</div>` : ""}

  ${input.table.title ? `<div class="section-header" style="border:1.4px solid #e2e8f0;border-radius:8px 8px 0 0;margin-top:6px;">${e(input.table.title)}</div>` : ""}
  <table class="rp-table">
    <thead>${thead}</thead>
    ${tfoot}
    <tbody>${tbody}</tbody>
  </table>

  <div class="page-footer">
    <div>🏢 ${e(co.name || "ACCOUNTS.DGT.LLC")}</div>
    <div>${e(input.title)}</div>
    <div class="rp-pageno">${e(L.page)} <span class="rp-pn">1</span> ${e(L.of)} <span class="rp-pt">1</span></div>
  </div>
</div></div>
<script>
(function(){
  // best-effort page count for the footer (screen preview only; print uses @page)
  try {
    var pg = document.querySelector('.page');
    var h = pg ? pg.getBoundingClientRect().height : 0;
    var per = ${orient === "portrait" ? 1123 : 794};
    var n = Math.max(1, Math.ceil(h / per));
    document.querySelectorAll('.rp-pt').forEach(function(x){ x.textContent = String(n); });
  } catch(e){}
})();
</script>
</body></html>`;
}

/** Client-only: open in the shared PdfPreviewModal (preview + real PDF download + print + lang/orient switch). */
export function openUniversalReport(input: UniversalReportInput) {
  if (typeof window === "undefined") return;
  const html = buildUniversalReportHtml(input);
  printStore.openPrint(html, input.title, {
    lang: input.lang || "en",
    rebuild: ({ lang, orientation }) => buildUniversalReportHtml({ ...input, lang, orientation }),
  });
}

/** Filename slug like "payment-report-2026-09-07.pdf". */
export function reportFileName(input: Pick<UniversalReportInput, "title" | "fileSlug">) {
  const base = (input.fileSlug || input.title || "report")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `${base}-${new Date().toISOString().slice(0, 10)}.pdf`;
}
