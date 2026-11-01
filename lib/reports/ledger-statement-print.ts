// File: lib/reports/ledger-statement-print.ts
/**
 * Detailed Account Ledger Statement — A4 Portrait & Landscape Printing Engine
 *
 * Implements the approved compact ledger layout:
 * - Three small information panels at the top (Branch Details, Customer / Account Details, Ledger / Balance Summary)
 * - Original yellow/amber ledger table underneath with right-aligned monetary values
 * - 8 columns in Portrait (Customer statement)
 * - 10 columns in Landscape (Internal detailed statement)
 * - Clean multi-page continuation and 5-language RTL support
 * - No SAMPLE DATA watermarks on real business reports
 */

import { t } from "@/lib/i18n/ui";

export type LedgerPrintOrientation = "portrait" | "landscape";

export type ERPCompanyInfo = {
  name?: string | null;
  legalName?: string | null;
  taxNo?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  address?: string | null;
  logoUrl?: string | null;
};

export type LedgerPrintLine = {
  date: string;
  serial?: string | null;
  manualRef?: string | null;
  source: string;
  branch?: string | null;
  user?: string | null;
  description?: string | null;
  currency?: string | null;
  usdRate?: number | null;
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
  const amt = (n: number) => (n ? ltr(money(n)) : `<span class="dash">-</span>`);

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
    { key: "debit", label: L("col_debit", "Debit (Dr)"), w: 9, cls: "num" },
    { key: "credit", label: L("col_credit", "Credit (Cr)"), w: 9, cls: "num" },
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
    { key: "debit", label: L("col_debit", "Debit (Dr)"), w: 7, cls: "num" },
    { key: "credit", label: L("col_credit", "Credit (Cr)"), w: 7, cls: "num" },
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

  const footLeft = esc(`${c.name || "DGT ERP"} — ${L("title", "Account Ledger Statement")}`);
  const footRight = `${L("page", "Page")} counter(page) ${L("of", "of")} counter(pages)`;
  const fontFamily = isRtl
    ? "'Noto Naskh Arabic', 'Segoe UI', Tahoma, Arial, sans-serif"
    : "'Inter', 'Segoe UI', Roboto, Arial, sans-serif";
  const base = portrait ? 7.6 : 7.4;

  const contact = [c.phone, c.email, c.address].filter(Boolean).map(esc).join(" · ");

  return `<!doctype html>
<html lang="${esc(lang)}" dir="${isRtl ? "rtl" : "ltr"}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(L("title", "Account Ledger Statement"))} — ${esc(a.name)}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&family=Noto+Naskh+Arabic:wght@400;600;700;800&display=swap');
  @page {
    size: A4 ${portrait ? "portrait" : "landscape"};
    margin: ${portrait ? "10mm 9mm 12mm 9mm" : "8mm 8mm 11mm 8mm"};
    @bottom-left { content: "${isRtl ? footRight : footLeft}"; font: 7pt ${fontFamily}; color: #64748b; }
    @bottom-right { content: "${isRtl ? footLeft : footRight}"; font: 700 7.5pt ${fontFamily}; color: #0f172a; }
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; color: #0f172a; }
  body { font-family: ${fontFamily}; font-size: ${base}pt; line-height: ${isRtl ? 1.45 : 1.25}; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .doc { width: 100%; max-width: ${portrait ? "192mm" : "281mm"}; margin: 0 auto; padding: 4mm 0; }
  bdi { unicode-bidi: isolate; }
  .no-print-toolbar { position: sticky; top: 0; z-index: 5; display: flex; gap: 8px; justify-content: flex-end; padding: 8px 0; background: #fff; }
  .no-print-toolbar button { font: 600 12px ${fontFamily}; padding: 6px 14px; border-radius: 6px; border: 1px solid #d97706; background: #f59e0b; color: #0f172a; cursor: pointer; }
  @media print { .no-print-toolbar { display: none; } .doc { padding: 0; max-width: none; } }

  /* Company Letterhead */
  .lh { display: flex; justify-content: space-between; align-items: flex-start; gap: 5mm; padding-bottom: 2mm; margin-bottom: 2mm; border-bottom: 1.5px solid #e2e8f0; }
  .lh .brand { display: flex; gap: 3.5mm; align-items: center; }
  .lh .brand img { width: 13mm; height: 13mm; object-fit: contain; }
  .lh .co { font-size: 11pt; font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; }
  .lh .co-sub { font-size: 7.2pt; color: #64748b; margin-top: 0.3mm; }
  .lh .title { text-align: end; }
  .lh .title h1 { margin: 0; font-size: 13pt; font-weight: 900; color: #78350f; text-transform: uppercase; letter-spacing: 0.5px; }
  .lh .title .meta { font-size: 7.2pt; color: #64748b; margin-top: 0.5mm; font-weight: 600; }

  /* Three Compact Information Panels (Page 1 Only) */
  .panels-row {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 2.5mm;
    margin: 2mm 0 3mm;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .info-card {
    border: 1px solid #cbd5e1;
    border-radius: 1.5mm;
    background: #ffffff;
    overflow: hidden;
  }
  .card-hdr {
    background: #f1f5f9;
    color: #1e293b;
    font-size: 7.2pt;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    padding: 1.4mm 2.5mm;
    border-bottom: 1px solid #cbd5e1;
  }
  .card-body {
    padding: 1.8mm 2.5mm;
    display: flex;
    flex-direction: column;
    gap: 0.9mm;
    font-size: 6.8pt;
  }
  .kv {
    display: flex;
    justify-content: space-between;
    gap: 1.5mm;
    align-items: baseline;
  }
  .kv .k {
    color: #64748b;
    font-weight: 600;
    white-space: nowrap;
    text-transform: ${isRtl ? "none" : "capitalize"};
  }
  .kv .v {
    color: #0f172a;
    font-weight: 600;
    text-align: end;
    overflow-wrap: anywhere;
  }
  .font-bold { font-weight: 800 !important; }
  .text-debit { color: #be123c !important; font-weight: 700; }
  .text-credit { color: #047857 !important; font-weight: 700; }

  /* Ledger Table with Original Yellow / Amber Header */
  table.data-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  thead { display: table-header-group; }
  tfoot { display: table-row-group; }
  thead tr.run th {
    background: #ffffff;
    color: #1e293b;
    font-weight: 700;
    font-size: 7.2pt;
    text-align: start;
    padding: 0 0 1.5mm;
    border: 0;
  }
  .cont-head { padding-bottom: 1.5mm; }
  .cont-top {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    font-size: 9pt;
    font-weight: 800;
    color: #1e293b;
    border-bottom: 1px solid #e2e8f0;
    padding-bottom: 1mm;
    margin-bottom: 1mm;
  }
  .cont-title {
    font-size: 8pt;
    font-weight: 800;
    color: #78350f;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  thead tr.cols th {
    background: #fef08a; /* Original Yellow/Amber */
    color: #713f12;
    font-weight: 800;
    font-size: 7.2pt;
    padding: 1.4mm 1.2mm;
    text-align: start;
    border: 1px solid #eab308;
    vertical-align: middle;
    overflow-wrap: break-word;
    word-break: normal;
  }
  thead tr.cols th.num { text-align: end; }
  thead tr.cols th.c { text-align: center; }

  tbody td {
    padding: 1mm 1.2mm;
    border-bottom: 1px solid #eef2f7;
    vertical-align: top;
    overflow-wrap: break-word;
    word-break: normal;
    font-size: 7.2pt;
  }
  tbody tr { break-inside: avoid; page-break-inside: avoid; }
  tbody tr:nth-child(even) td { background: #fefce8; /* Subtle yellow alternating tint */ }
  td.num { text-align: end; white-space: nowrap; font-variant-numeric: tabular-nums; font-feature-settings: "tnum"; font-weight: 600; }
  td.c { text-align: center; color: #64748b; }
  td.nw { white-space: nowrap; }
  td .desc { white-space: pre-wrap; font-size: 7.2pt; }
  td .sub { color: #64748b; font-size: 6.5pt; margin-top: 0.2mm; line-height: 1.2; }
  td .dash { color: #94a3b8; font-weight: 400; }
  .dc { font-size: 6.5pt; font-weight: 700; color: #475569; margin-inline-start: 0.5mm; }
  tr.opening td { background: #fef9c3 !important; font-style: italic; border-bottom: 1px solid #fde047; }
  td.lbl { text-align: end; padding-inline-end: 2mm; font-weight: 700; }
  td.empty { text-align: center; color: #64748b; padding: 6mm; }

  /* Totals row & signatures block */
  tr.total-row { break-before: avoid; page-break-before: avoid; }
  tr.total-row.totals td { background: #fef9c3 !important; font-weight: 800; border-top: 2px solid #eab308; border-bottom: 1px solid #eab308; }
  tr.total-row.end td { background: #fff !important; color: #0f172a; border: 0; padding: 3mm 0 0; font-weight: 400; }
  .note { color: #64748b; font-size: 6.8pt; }
  .sign { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: ${portrait ? "8mm" : "16mm"}; margin-top: ${portrait ? "10mm" : "8mm"}; }
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
        <div class="co">${esc(c.name || "DAMAAN GENERAL TRADING L.L.C")}</div>
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

  <!-- Page 1 Only: Three Small Information Panels at the Top -->
  <section class="panels-row">
    <!-- Panel 1: Branch Details -->
    <div class="info-card">
      <div class="card-hdr">${esc(L("branch_details", "Branch Details"))}</div>
      <div class="card-body">
        <div class="kv"><span class="k">${esc(L("branch_name", "Branch Name"))}:</span><span class="v">${esc(a.branchName || a.branch || "—")}</span></div>
        <div class="kv"><span class="k">${esc(L("branch_code", "Branch Code"))}:</span><span class="v">${ltr(a.branchCode || "—")}</span></div>
        <div class="kv"><span class="k">${esc(L("country", "Country"))}:</span><span class="v">${esc(a.country || "—")}</span></div>
        <div class="kv"><span class="k">${esc(L("state_province", "State / Province"))}:</span><span class="v">${esc(a.stateProvince || "—")}</span></div>
        <div class="kv"><span class="k">${esc(L("city", "City"))}:</span><span class="v">${esc(a.city || "—")}</span></div>
        <div class="kv"><span class="k">${esc(L("final_address", "Address"))}:</span><span class="v">${esc(a.address || [a.city, a.country].filter(Boolean).join(", ") || "—")}</span></div>
      </div>
    </div>

    <!-- Panel 2: Customer / Account Details -->
    <div class="info-card">
      <div class="card-hdr">${esc(L("customer_account_details", "Customer / Account Details"))}</div>
      <div class="card-body">
        <div class="kv"><span class="k">${esc(L("account_code", "Account No."))}:</span><span class="v font-bold">${ltr(a.code || "—")}</span></div>
        <div class="kv"><span class="k">${esc(L("customer_no", "Customer No."))}:</span><span class="v">${ltr(a.customerNumber || "—")}</span></div>
        <div class="kv"><span class="k">${esc(L("account", "Account Name"))}:</span><span class="v font-bold">${esc(a.name || "—")}</span></div>
        <div class="kv"><span class="k">${esc(L("account_type", "Account Type"))}:</span><span class="v">${esc(a.kind || a.category || "—")}</span></div>
        <div class="kv"><span class="k">${esc(L("category", "Category"))}:</span><span class="v">${esc(a.category || a.kind || "—")}</span></div>
        <div class="kv"><span class="k">${esc(L("currency", "Currency"))}:</span><span class="v font-bold">${ltr(a.currency || "—")}</span></div>
        <div class="kv"><span class="k">${esc(L("phone", "Phone"))}:</span><span class="v">${ltr(a.phone || "—")}</span></div>
        <div class="kv"><span class="k">${esc(L("whatsapp", "WhatsApp"))}:</span><span class="v">${ltr(a.whatsapp || "—")}</span></div>
        <div class="kv"><span class="k">${esc(L("email", "Email"))}:</span><span class="v">${ltr(a.email || "—")}</span></div>
        <div class="kv"><span class="k">${esc(L("final_address", "Final Address"))}:</span><span class="v">${esc(a.finalAddress || a.address || "—")}</span></div>
      </div>
    </div>

    <!-- Panel 3: Ledger / Balance Summary -->
    <div class="info-card">
      <div class="card-hdr">${esc(L("ledger_balance_summary", "Ledger / Balance Summary"))}</div>
      <div class="card-body">
        <div class="kv"><span class="k">${esc(L("total_debit", "Total Debit"))}:</span><span class="v text-debit">${ltr(money(data.totalDebit))} ${esc(a.currency)}</span></div>
        <div class="kv"><span class="k">${esc(L("total_credit", "Total Credit"))}:</span><span class="v text-credit">${ltr(money(data.totalCredit))} ${esc(a.currency)}</span></div>
        <div class="kv"><span class="k">${esc(L("grand_balance", "Grand Balance"))}:</span><span class="v font-bold">${bal(data.closingBalance)} ${esc(a.currency)}</span></div>
        <div class="kv"><span class="k">${esc(L("starting_date", "Starting Date"))}:</span><span class="v">${ltr(data.fromDate)}</span></div>
        <div class="kv"><span class="k">${esc(L("last_date", "Last Date"))}:</span><span class="v">${ltr(data.toDate)}</span></div>
        <div class="kv"><span class="k">${esc(L("total_entries", "Total Entries"))}:</span><span class="v font-bold">${ltr(data.lines.length)}</span></div>
      </div>
    </div>
  </section>

  ${data.filterNote ? `<div class="filter-note">${esc(data.filterNote)}</div>` : ""}

  <!-- Ledger Table with Yellow / Amber Header -->
  <table class="data-table">
    <colgroup>
      ${cols.map((k) => `<col style="width:${k.w}%" />`).join("")}
    </colgroup>
    <thead>
      <tr class="run">
        <th colspan="${span}">
          <div class="cont-head">
            <div class="cont-top">
              <span>${esc(c.name || "DAMAAN GENERAL TRADING L.L.C")}</span>
              <span>${esc(a.name)} (${ltr(a.code)})</span>
            </div>
            <div class="cont-title">${esc(L("title", "Account Ledger Statement"))} · ${ltr(data.fromDate)} — ${ltr(data.toDate)}</div>
          </div>
        </th>
      </tr>
      <tr class="cols">
        ${cols.map((k) => `<th class="${k.cls ?? ""}">${esc(k.label)}</th>`).join("")}
      </tr>
    </thead>
    <tbody>
      ${
        data.openingBalance
          ? labelRow(L("opening_row", "Opening balance brought forward"), "opening", "", "", bal(data.openingBalance))
          : ""
      }
      ${bodyRows}
    </tbody>
    <tfoot>
      ${labelRow(
        L("totals_row", "Totals for the period"),
        "total-row totals",
        ltr(money(data.totalDebit)),
        ltr(money(data.totalCredit)),
        bal(data.closingBalance)
      )}
      <tr class="total-row end">
        <td colspan="${span}">
          <div class="note">${esc(L("note", "Balances shown on account normal side. Dr = Debit, Cr = Credit. This is a computer-generated statement."))}</div>
          <div class="sign">
            <div>${esc(L("prepared_by", "Prepared by"))}</div>
            <div>${esc(L("checked_by", "Checked by"))}</div>
            <div>${esc(L("approved_by", "Approved by"))}</div>
          </div>
        </td>
      </tr>
    </tfoot>
  </table>
</div>
</body>
</html>`;
}

export function openLedgerStatementPrint(data: LedgerPrintData, opts: { lang: string; orientation: LedgerPrintOrientation }): void {
  if (typeof window === "undefined") return;
  const html = buildLedgerStatementPrintHtml(data, opts);
  const w = window.open("", "_blank");
  if (!w) {
    alert("Popup blocked. Please allow popups to view the print statement.");
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}
