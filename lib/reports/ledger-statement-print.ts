/**
 * Account Ledger Statement — print / PDF layouts for the EXISTING Detailed Ledger (features/reports/ledger-report).
 *
 * Two independently designed A4 layouts (not one table rotated):
 *   portrait  — 8 columns (Customer Ledger Print):
 *               Date | Entry No. | Rzn. No. | Rzn. Name | Details | DR | CR | Balance
 *               Internal user and branch columns are removed for customer-facing privacy,
 *               allocating maximum practical width to the Details column.
 *
 *   landscape — 10 columns (Detailed Internal Ledger):
 *               Date | Entry No. | Rzn. No. | Rzn. Name | User | Branch | Details | DR | CR | Balance
 *               Dedicated short user and branch code columns with maximum practical width for Details.
 *
 * Both layouts:
 *   - Page 1 only: Compact bank-statement style Account Details (17 sequential fields) and integrated
 *     Financial Summary (Total Debit | Total Credit | Grand Balance | Starting Date | Last Date | Total Entries).
 *   - Repeating column headers on every page (<thead> = table-header-group).
 *   - Table rows never break across page boundaries (break-inside: avoid).
 *   - Multi-page page counter Page X of Y in @page margins.
 *   - Five languages (en, ur, ar, fa, ps) with robust RTL support and LTR data isolation (<bdi dir="ltr">).
 */

import { t } from "@/lib/i18n/ui";
import { printStore } from "@/lib/store/print-store";
import type { ERPCompanyInfo } from "@/lib/reports/erp-report-template-builder";

export type LedgerPrintOrientation = "portrait" | "landscape";

export type LedgerPrintLine = {
  date: string | null;
  serial: string | null;
  manualRef: string | null;
  source: "ledger_posting_batches" | "roznamcha_entries" | string | null;
  branch: string | null;
  user: string | null;
  description: string | null;
  /** currency of the original posting; differs from the ledger currency for foreign-currency entries */
  currency: string | null;
  usdRate?: number | null;
  usdAmount?: number | null;
  debit: number;
  credit: number;
  /** running balance on the account's NORMAL side (positive = normal side) */
  balance: number;
  /** Specific columns requested */
  entryNo?: string | null;
  rznNo?: string | null;
  rznName?: string | null;
  userCode?: string | null;
  branchCode?: string | null;
};

export type LedgerPrintData = {
  company: ERPCompanyInfo;
  account: {
    name: string;
    code: string;
    customerNumber?: string | null;
    manualReference?: string | null;
    kind?: string | null;
    category?: string | null;
    currency: string;
    openedDate?: string | null;
    branchName?: string | null;
    branchCode?: string | null;
    countryCode?: string | null;
    country?: string | null;
    stateProvince?: string | null;
    city?: string | null;
    finalAddress?: string | null;
    address?: string | null;
    phone?: string | null;
    whatsapp?: string | null;
    email?: string | null;
    branch?: string | null;
    company?: string | null;
  };
  normalBalance: "debit" | "credit";
  fromDate: string;
  toDate: string;
  openingBalance: number;
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
  lines: LedgerPrintLine[];
  printedBy?: string | null;
  printedAt?: string | null;
  /** set when the on-screen statement was narrowed by a user / branch filter */
  filterNote?: string | null;
};

const RTL = new Set(["ur", "ar", "fa", "ps"]);

function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function money(n: number): string {
  const v = Number.isFinite(n) ? Math.abs(n) : 0;
  return v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** an LTR island for data inside RTL text (numbers, dates, codes) */
function ltr(v: unknown): string {
  return `<bdi dir="ltr">${esc(v)}</bdi>`;
}

export function buildLedgerStatementPrintHtml(data: LedgerPrintData, opts: { lang: string; orientation: LedgerPrintOrientation }): string {
  const lang = opts.lang || "en";
  const isRtl = RTL.has(lang);
  const portrait = opts.orientation === "portrait";
  const L = (key: string, fallback: string) => t(lang as never, `lprint.${key}` as never, fallback);

  const dr = L("dr", "Dr");
  const cr = L("cr", "Cr");

  // a positive balance sits on the account's normal side; negative is overdrawn
  const side = (bal: number) => ((bal >= 0) === (data.normalBalance === "debit") ? dr : cr);
  const bal = (n: number) => `${ltr(money(n))} <span class="dc">${esc(side(n))}</span>`;
  const amt = (n: number) => (n ? ltr(money(n)) : "");

  const src = (s: LedgerPrintLine["source"]) =>
    s === "roznamcha_entries"
      ? L("src_roznamcha", "Roznamcha")
      : s === "ledger_posting_batches"
      ? L("src_journal", "Journal")
      : esc(s || "");

  const dateOf = (d: string | null) => (d ? ltr(String(d).slice(0, 10)) : "");
  const c = data.company || {};
  const a = data.account;
  const printedAt = data.printedAt || new Date().toISOString().slice(0, 16).replace("T", " ");

  const foreign = (l: LedgerPrintLine) => Boolean(l.currency && a.currency && l.currency !== a.currency);
  const rateText = (l: LedgerPrintLine) =>
    foreign(l) ? `${esc(l.currency)}${l.usdRate && l.usdRate !== 1 ? ` @ ${ltr(l.usdRate)}` : ""}` : esc(l.currency || a.currency);

  // ── Column Sets Designed Exactly to Specification ──────────────────────────────────────────
  type Col = { key: string; label: string; w: number; cls?: string };

  // Portrait (8 columns): Date | Entry No. | Rzn. No. | Rzn. Name | Details | DR | CR | Balance
  const portraitCols: Col[] = [
    { key: "date", label: L("col_date", "Date"), w: 10, cls: "nw" },
    { key: "entryNo", label: L("col_entry_no", "Entry No."), w: 9, cls: "nw" },
    { key: "rznNo", label: L("col_rzn_no", "Rzn. No."), w: 9, cls: "nw" },
    { key: "rznName", label: L("col_rzn_name", "Rzn. Name"), w: 11 },
    { key: "details", label: L("col_details", "Details"), w: 34 },
    { key: "debit", label: L("col_debit", "DR"), w: 9, cls: "num" },
    { key: "credit", label: L("col_credit", "CR"), w: 9, cls: "num" },
    { key: "balance", label: L("col_balance", "Balance"), w: 9, cls: "num" },
  ];

  // Landscape (10 columns): Date | Entry No. | Rzn. No. | Rzn. Name | User | Branch | Details | DR | CR | Balance
  const landscapeCols: Col[] = [
    { key: "date", label: L("col_date", "Date"), w: 7, cls: "nw" },
    { key: "entryNo", label: L("col_entry_no", "Entry No."), w: 8, cls: "nw" },
    { key: "rznNo", label: L("col_rzn_no", "Rzn. No."), w: 8, cls: "nw" },
    { key: "rznName", label: L("col_rzn_name", "Rzn. Name"), w: 9 },
    { key: "user", label: L("col_user", "User"), w: 7 },
    { key: "branch", label: L("col_branch", "Branch"), w: 7 },
    { key: "details", label: L("col_details", "Details"), w: 32 },
    { key: "debit", label: L("col_debit", "DR"), w: 7, cls: "num" },
    { key: "credit", label: L("col_credit", "CR"), w: 7, cls: "num" },
    { key: "balance", label: L("col_balance", "Balance"), w: 8, cls: "num" },
  ];

  const cols = portrait ? portraitCols : landscapeCols;
  const span = cols.length;
  const amountStart = cols.findIndex((k) => k.key === "debit");

  const cell = (l: LedgerPrintLine, key: string): string => {
    switch (key) {
      case "date":
        return dateOf(l.date);
      case "entryNo":
        return ltr(l.entryNo || l.serial || "—");
      case "rznNo":
        return ltr(l.rznNo || l.manualRef || "—");
      case "rznName":
        return esc(l.rznName || src(l.source) || "—");
      case "user":
        return esc(l.userCode || l.user || "—");
      case "branch":
        return esc(l.branchCode || l.branch || "—");
      case "details": {
        const main = `<div class="desc">${esc(l.description || "—")}</div>`;
        const rateInfo = foreign(l) ? `<div class="sub">${rateText(l)}</div>` : "";
        return main + rateInfo;
      }
      case "debit":
        return amt(l.debit);
      case "credit":
        return amt(l.credit);
      case "balance":
        return bal(l.balance);
      default:
        return "";
    }
  };

  const labelRow = (label: string, cls: string, debit: string, credit: string, balance: string) =>
    `<tr class="${cls}"><td colspan="${amountStart}" class="lbl">${esc(label)}</td><td class="num">${debit}</td><td class="num">${credit}</td><td class="num">${balance}</td></tr>`;

  const bodyRows = data.lines.length
    ? data.lines
        .map((l) => `<tr>${cols.map((k) => `<td class="${k.cls ?? ""}">${cell(l, k.key)}</td>`).join("")}</tr>`)
        .join("\n")
    : `<tr><td colspan="${span}" class="empty">${esc(L("no_entries", "No entries in this period."))}</td></tr>`;

  // ── Exact 17 Sequential Fields for Bank-Statement Account Details (Page 1 Only) ──
  const accountFields: Array<{ key: string; label: string; value: string; prominentClass?: string }> = [
    // 1. Account Number
    { key: "account_number", label: L("account_number", "Account Number"), value: ltr(a.code || "—") },
    // 2. Customer Number
    { key: "customer_number", label: L("customer_number", "Customer Number"), value: ltr(a.customerNumber || "—") },
    // 3. Account Name (prominent)
    {
      key: "account_name",
      label: L("account_name", "Account Name"),
      value: `<span class="prominent-val">${esc(a.name || "—")}</span>`,
      prominentClass: "prominent-name",
    },
    // 4. Account Type
    { key: "account_type", label: L("account_type", "Account Type"), value: esc(a.kind || "—") },
    // 5. Category
    { key: "category", label: L("category", "Category"), value: esc(a.category || a.kind || "—") },
    // 6. Currency
    { key: "currency", label: L("currency", "Currency"), value: ltr(a.currency || "—") },
    // 7. Opened Date
    { key: "opened_date", label: L("opened_date", "Opened Date"), value: ltr(a.openedDate || "—") },
    // 8. Branch Name
    { key: "branch_name", label: L("branch_name", "Branch Name"), value: esc(a.branchName || a.branch || "—") },
    // 9. Branch Code
    { key: "branch_code", label: L("branch_code", "Branch Code"), value: ltr(a.branchCode || "—") },
    // 10. Country Code
    { key: "country_code", label: L("country_code", "Country Code"), value: ltr(a.countryCode || "—") },
    // 11. Country
    { key: "country", label: L("country", "Country"), value: esc(a.country || "—") },
    // 12. State/Province
    { key: "state_province", label: L("state_province", "State / Province"), value: esc(a.stateProvince || "—") },
    // 13. City
    { key: "city", label: L("city", "City"), value: esc(a.city || "—") },
    // 14. Final Address (prominent)
    {
      key: "final_address",
      label: L("final_address", "Final Address"),
      value: `<span class="prominent-val">${esc(a.finalAddress || a.address || "—")}</span>`,
      prominentClass: "prominent-addr",
    },
    // 15. Phone
    { key: "phone", label: L("phone", "Phone"), value: ltr(a.phone || "—") },
    // 16. WhatsApp
    { key: "whatsapp", label: L("whatsapp", "WhatsApp"), value: ltr(a.whatsapp || "—") },
    // 17. Email
    { key: "email", label: L("email", "Email"), value: ltr(a.email || "—") },
  ];

  // ── Integrated Financial Summary (Page 1 Only) ──
  const summaryItems = [
    { label: L("total_debit", "Total Debit"), value: ltr(money(data.totalDebit)), cls: "debit" },
    { label: L("total_credit", "Total Credit"), value: ltr(money(data.totalCredit)), cls: "credit" },
    { label: L("grand_balance", "Grand Balance"), value: bal(data.closingBalance), cls: "grand-balance" },
    { label: L("starting_date", "Starting Date"), value: ltr(data.fromDate), cls: "date" },
    { label: L("last_date", "Last Date"), value: ltr(data.toDate), cls: "date" },
    { label: L("total_entries", "Total Entries"), value: ltr(data.lines.length), cls: "entries" },
  ];

  const contact = [c.address, c.phone, c.email, c.website].filter(Boolean).map((x) => esc(x)).join(" · ");
  const footLeft = `${c.name ? `${c.name} · ` : ""}${a.code || ""}`.replace(/"/g, "'");
  const footRight = `${L("printed_by", "Printed by")}: ${data.printedBy || "—"} · ${printedAt}`.replace(/"/g, "'");
  const pageWord = L("page", "Page").replace(/"/g, "'");
  const ofWord = L("of", "of").replace(/"/g, "'");
  const fontFamily = isRtl
    ? "'Noto Naskh Arabic', 'Segoe UI', Tahoma, Arial, sans-serif"
    : "'Inter', 'Segoe UI', Roboto, Arial, sans-serif";
  const base = portrait ? 7.6 : 7.4;

  return `<!doctype html>
<html lang="${esc(lang)}" dir="${isRtl ? "rtl" : "ltr"}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(L("title", "Account Ledger Statement"))} — ${esc(a.name)}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&family=Noto+Naskh+Arabic:wght@400;600;700;800&display=swap');
  @page {
    size: A4 ${portrait ? "portrait" : "landscape"};
    margin: ${portrait ? "10mm 9mm 12mm 9mm" : "8mm 8mm 11mm 8mm"};
    @bottom-left { content: "${isRtl ? footRight : footLeft}"; font: 7pt ${fontFamily}; color: #64748b; }
    @bottom-center { content: "${pageWord} " counter(page) " ${ofWord} " counter(pages); font: 700 7.5pt ${fontFamily}; color: #0f172a; }
    @bottom-right { content: "${isRtl ? footLeft : footRight}"; font: 7pt ${fontFamily}; color: #64748b; }
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; color: #0f172a; }
  body { font-family: ${fontFamily}; font-size: ${base}pt; line-height: ${isRtl ? 1.45 : 1.25}; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .doc { width: 100%; max-width: ${portrait ? "192mm" : "281mm"}; margin: 0 auto; padding: 5mm 0; }
  bdi { unicode-bidi: isolate; }
  .no-print-toolbar { position: sticky; top: 0; z-index: 5; display: flex; gap: 8px; justify-content: flex-end; padding: 8px 0; background: #fff; }
  .no-print-toolbar button { font: 600 12px ${fontFamily}; padding: 6px 14px; border-radius: 6px; border: 1px solid #0f172a; background: #0f172a; color: #fff; cursor: pointer; }
  @media print { .no-print-toolbar { display: none; } .doc { padding: 0; max-width: none; } }

  /* letterhead */
  .lh { display: flex; justify-content: space-between; align-items: flex-start; gap: 5mm; border-bottom: 2px solid #0f172a; padding-bottom: 2.2mm; }
  .lh .brand { display: flex; gap: 3mm; align-items: center; min-width: 0; }
  .lh img { max-height: ${portrait ? "14mm" : "12mm"}; max-width: 32mm; object-fit: contain; }
  .lh .co { font-size: ${portrait ? 11.5 : 12}pt; font-weight: 800; letter-spacing: .2px; }
  .lh .co-sub { color: #475569; font-size: 7.2pt; margin-top: .4mm; overflow-wrap: anywhere; }
  .lh .title { text-align: end; flex-shrink: 0; }
  .lh .title h1 { margin: 0; font-size: ${portrait ? 12.5 : 13.5}pt; font-weight: 800; color: #0f172a; text-transform: ${isRtl ? "none" : "uppercase"}; letter-spacing: ${isRtl ? 0 : ".5px"}; }
  .lh .title .meta { color: #334155; font-size: 7.4pt; margin-top: .6mm; }

  /* Page 1 Compact Bank-Statement Account Panel & Integrated Summary */
  .panel {
    border: 1px solid #cbd5e1;
    border-radius: 1.5mm;
    background: #ffffff;
    margin: 2.5mm 0 2mm;
    break-inside: avoid;
    page-break-inside: avoid;
    overflow: hidden;
  }
  .acct-grid {
    display: grid;
    grid-template-columns: ${portrait ? "repeat(2, minmax(0, 1fr))" : "repeat(4, minmax(0, 1fr))"};
    gap: 1.2mm 3.5mm;
    padding: 2mm 3mm;
    background: #ffffff;
  }
  .acct-item { display: flex; flex-direction: column; min-width: 0; }
  .acct-item .k {
    color: #64748b;
    font-size: 6.6pt;
    font-weight: 600;
    text-transform: ${isRtl ? "none" : "uppercase"};
    letter-spacing: ${isRtl ? 0 : ".3px"};
    margin-bottom: 0.2mm;
  }
  .acct-item .v { font-weight: 700; font-size: 7.6pt; color: #0f172a; overflow-wrap: anywhere; }
  .acct-item.prominent-name { grid-column: ${portrait ? "1 / -1" : "span 2"}; }
  .acct-item.prominent-name .prominent-val { font-size: 9pt; font-weight: 800; color: #047857; }
  .acct-item.prominent-addr { grid-column: 1 / -1; }
  .acct-item.prominent-addr .prominent-val { font-size: 7.6pt; font-weight: 700; color: #1e293b; }

  /* Integrated Financial Summary Bar */
  .fin-summary {
    display: grid;
    grid-template-columns: ${portrait ? "repeat(3, minmax(0, 1fr))" : "repeat(6, minmax(0, 1fr))"};
    background: #f8fafc;
    border-top: 1px solid #cbd5e1;
    padding: 1.8mm 3mm;
    gap: 1.5mm 3mm;
  }
  .fin-item { display: flex; flex-direction: column; min-width: 0; }
  .fin-item .k {
    color: #475569;
    font-size: 6.5pt;
    font-weight: 600;
    text-transform: ${isRtl ? "none" : "uppercase"};
    margin-bottom: 0.2mm;
  }
  .fin-item .v {
    font-weight: 800;
    font-size: 8.2pt;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    color: #0f172a;
  }
  .fin-item.grand-balance {
    background: #0f172a;
    color: #ffffff;
    padding: 0.8mm 2mm;
    border-radius: 1mm;
    margin: -0.5mm 0;
  }
  .fin-item.grand-balance .k { color: #94a3b8; }
  .fin-item.grand-balance .v { color: #ffffff; }
  .fin-item.grand-balance .dc { color: #38bdf8; font-weight: 800; margin-inline-start: 1mm; }

  .filter-note { margin: 0 0 2mm; padding: 1.2mm 2mm; background: #fffbeb; border: 1px solid #fcd34d; border-radius: 1mm; font-size: 7.2pt; color: #92400e; }

  /* Ledger Table */
  table.data-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  thead { display: table-header-group; }
  tfoot { display: table-row-group; }
  thead tr.run th { background: #fff; color: #334155; font-weight: 600; font-size: 7pt; text-align: start; padding: 0 0 1mm; border: 0; }
  thead tr.run th .acc { font-weight: 800; color: #0f172a; }
  thead tr.cols th {
    background: #0f172a;
    color: #fff;
    font-weight: 700;
    font-size: 7pt;
    padding: 1.2mm 1mm;
    text-align: start;
    border: 1px solid #0f172a;
    vertical-align: bottom;
    overflow-wrap: break-word;
    word-break: normal;
  }
  thead tr.cols th.num { text-align: end; }
  thead tr.cols th.c { text-align: center; }
  tbody td {
    padding: 0.8mm 1mm;
    border-bottom: 1px solid #e2e8f0;
    vertical-align: top;
    overflow-wrap: break-word;
    word-break: normal;
  }
  tbody tr { break-inside: avoid; page-break-inside: avoid; }
  tbody tr:nth-child(even) td { background: #f8fafc; }
  td.num { text-align: end; white-space: nowrap; font-variant-numeric: tabular-nums; font-feature-settings: "tnum"; }
  td.c { text-align: center; color: #64748b; }
  td.nw { white-space: nowrap; }
  td .desc { white-space: pre-wrap; font-size: 7.4pt; }
  td .sub { color: #64748b; font-size: 6.5pt; margin-top: 0.2mm; line-height: 1.2; }
  .dc { font-size: 6.5pt; font-weight: 700; color: #475569; margin-inline-start: 0.5mm; }
  tr.opening td { background: #eff6ff !important; font-style: italic; border-bottom: 1px solid #93c5fd; }
  td.lbl { text-align: end; padding-inline-end: 2mm; font-weight: 700; }
  td.empty { text-align: center; color: #64748b; padding: 6mm; }

  /* End of statement & signatures block (kept together on last page) */
  tr.total-row { break-before: avoid; page-break-before: avoid; }
  tr.total-row.end td { background: #fff !important; color: #0f172a; border: 0; padding: 3mm 0 0; font-weight: 400; }
  .note { color: #64748b; font-size: 6.8pt; }
  .sign { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: ${portrait ? "8mm" : "16mm"}; margin-top: ${portrait ? "12mm" : "10mm"}; }
  .sign div { border-top: 1px solid #0f172a; padding-top: 1mm; text-align: center; font-size: 7.2pt; font-weight: 700; }
</style>
</head>
<body>
<div class="doc" data-layout="${portrait ? "portrait" : "landscape"}">
  <div class="no-print-toolbar"><button type="button" onclick="window.print()">${esc(L("print", "Print"))}</button></div>

  <!-- Letterhead -->
  <header class="lh">
    <div class="brand">
      ${c.logoUrl ? `<img src="${esc(c.logoUrl)}" alt="" />` : ""}
      <div>
        ${c.name ? `<div class="co">${esc(c.name)}</div>` : ""}
        ${contact ? `<div class="co-sub">${contact}</div>` : ""}
        ${c.taxNo ? `<div class="co-sub">${esc(L("tax_no", "TRN / Tax No."))}: ${ltr(c.taxNo)}</div>` : ""}
      </div>
    </div>
    <div class="title">
      <h1>${esc(L("title", "Account Ledger Statement"))}</h1>
      <div class="meta">${esc(L("period", "Period"))}: ${ltr(data.fromDate)} — ${ltr(data.toDate)}</div>
      <div class="meta">${esc(L("printed_at", "Printed"))}: ${ltr(printedAt)}${data.printedBy ? ` · ${esc(data.printedBy)}` : ""}</div>
    </div>
  </header>

  <!-- Page 1 Only: Compact Bank-Statement Account Details & Financial Summary -->
  <section class="panel">
    <div class="acct-grid">
      ${accountFields
        .map(
          (f) => `
        <div class="acct-item ${f.prominentClass ?? ""}">
          <div class="k">${esc(f.label)}</div>
          <div class="v">${f.value}</div>
        </div>`
        )
        .join("")}
    </div>
    <div class="fin-summary">
      ${summaryItems
        .map(
          (s) => `
        <div class="fin-item ${s.cls}">
          <div class="k">${esc(s.label)}</div>
          <div class="v">${s.value}</div>
        </div>`
        )
        .join("")}
    </div>
  </section>

  ${data.filterNote ? `<div class="filter-note">${esc(L("filtered", "Filtered view"))}: ${esc(data.filterNote)}</div>` : ""}

  <!-- Ledger Transaction Table -->
  <table class="data-table">
    <colgroup>${cols.map((k) => `<col style="width:${k.w}%" />`).join("")}</colgroup>
    <thead>
      <tr class="run"><th colspan="${span}"><span class="acc">${esc(a.name)}</span> · ${ltr(a.code || "")} · ${ltr(a.currency)} · ${ltr(data.fromDate)} — ${ltr(data.toDate)}</th></tr>
      <tr class="cols">${cols.map((k) => `<th class="${k.cls ?? ""}">${esc(k.label)}${k.cls === "num" ? ` <bdi dir="ltr">(${esc(a.currency)})</bdi>` : ""}</th>`).join("")}</tr>
    </thead>
    <tbody>
      ${labelRow(L("opening_row", "Opening balance brought forward"), "opening", "", "", bal(data.openingBalance))}
      ${bodyRows}
      <tr class="total-row end"><td colspan="${span}">
        <div class="note">${esc(L("note", "Balances are shown on the account's normal side; Dr = debit, Cr = credit. This is a computer-generated statement."))}</div>
        <div class="sign">
          <div>${esc(L("prepared_by", "Prepared by"))}</div>
          <div>${esc(L("checked_by", "Checked by"))}</div>
          <div>${esc(L("approved_by", "Approved by"))}</div>
        </div>
      </td></tr>
    </tbody>
  </table>
</div>
</body>
</html>`;
}

/**
 * Opens the statement in the shared PDF/print preview. The preview's orientation and language switches REBUILD the document
 * from source (portrait and landscape are different layouts), never just rotate the page.
 */
export function openLedgerStatementPrint(data: LedgerPrintData, opts: { lang: string; orientation: LedgerPrintOrientation }) {
  if (typeof window === "undefined") return;
  const title = `${t(opts.lang as never, "lprint.title" as never, "Account Ledger Statement")} — ${data.account.name}`;
  const html = buildLedgerStatementPrintHtml(data, opts);
  try {
    printStore.openPrint(html, title, {
      lang: opts.lang,
      rebuild: ({ lang, orientation }) => buildLedgerStatementPrintHtml(data, { lang, orientation }),
    });
  } catch {
    const w = window.open("", "_blank");
    if (w) {
      w.document.open();
      w.document.write(html);
      w.document.close();
    }
  }
}
