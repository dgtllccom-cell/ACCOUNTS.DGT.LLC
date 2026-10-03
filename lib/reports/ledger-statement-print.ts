/**
 * Account Ledger Statement — print / PDF layouts for the EXISTING Detailed Ledger (features/reports/ledger-report).
 *
 * Two independently designed A4 layouts (not one table rotated):
 *   portrait  — 7 columns. Voucher + manual ref stacked in one cell; source · branch · user · foreign-currency detail printed as a
 *               small second line under the particulars, so the money columns keep their full width.
 *   landscape — 12 columns. Every field in its own column, including currency / exchange rate, branch and user.
 *
 * Both: letterhead + account panel + period summary on page 1; a compact account line and the column header repeat on every
 * page (<thead> = table-header-group); rows never split across pages; opening / totals / closing rows; signatures kept together
 * on the last page; "Page x / N" + printed-by in the @page margin boxes; five languages with RTL for UR / AR / FA / PS.
 * Amounts, dates and codes are data — printed as-is in an LTR isolate so they never reorder inside RTL text.
 *
 * Pure: builds HTML only. The data it receives is whatever the scoped, permission-checked ledger API returned to this login
 * (assertFinancialAccess + hierarchy scope on /api/erp/accounting/reports/ledger/*) — printing cannot widen access.
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
};

export type LedgerPrintData = {
  company: ERPCompanyInfo;
  account: {
    name: string;
    code: string;
    customerNumber?: string | null;
    manualReference?: string | null;
    kind?: string | null;
    currency: string;
    country?: string | null;
    branch?: string | null;
    company?: string | null;
    address?: string | null;
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
  return String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
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
  // a positive running balance sits on the account's normal side
  const side = (bal: number) => (bal >= 0) === (data.normalBalance === "debit") ? dr : cr;
  const bal = (n: number) => `${ltr(money(n))} <span class="dc">${esc(side(n))}</span>`;
  const amt = (n: number) => (n ? ltr(money(n)) : "");
  const src = (s: LedgerPrintLine["source"]) =>
    s === "roznamcha_entries" ? L("src_roznamcha", "Roznamcha") : s === "ledger_posting_batches" ? L("src_journal", "Journal") : esc(s || "");
  const dateOf = (d: string | null) => (d ? ltr(String(d).slice(0, 10)) : "");
  const c = data.company || {};
  const a = data.account;
  const printedAt = data.printedAt || new Date().toISOString().slice(0, 16).replace("T", " ");
  const countryBranch = [a.country, a.branch].filter(Boolean).join(" · ");
  const foreign = (l: LedgerPrintLine) => Boolean(l.currency && a.currency && l.currency !== a.currency);
  const rateText = (l: LedgerPrintLine) =>
    foreign(l) ? `${esc(l.currency)}${l.usdRate && l.usdRate !== 1 ? ` @ ${ltr(l.usdRate)}` : ""}` : esc(l.currency || a.currency);

  // ── column sets: designed per orientation ─────────────────────────────────────────────────────────────────────────
  type Col = { key: string; label: string; w: number; cls?: string };
  const cols: Col[] = portrait
    ? [
        { key: "no", label: L("col_no", "No."), w: 4, cls: "c" },
        { key: "date", label: L("col_date", "Date"), w: 10, cls: "nw" },
        { key: "voucher", label: L("col_voucher", "Voucher / Ref."), w: 14 },
        { key: "particulars", label: L("col_particulars", "Particulars"), w: 32 },
        { key: "debit", label: L("col_debit", "Debit"), w: 12, cls: "num" },
        { key: "credit", label: L("col_credit", "Credit"), w: 12, cls: "num" },
        { key: "balance", label: L("col_balance", "Balance"), w: 16, cls: "num" },
      ]
    : [
        // Particulars gets the width the short columns (source, branch, user, rate) do not need
        { key: "no", label: L("col_no", "No."), w: 3, cls: "c" },
        { key: "date", label: L("col_date", "Date"), w: 6.5, cls: "nw" },
        { key: "serial", label: L("col_serial", "Voucher / Serial"), w: 7.5 },
        { key: "manualRef", label: L("col_manual_ref", "Manual Ref."), w: 11 },
        { key: "source", label: L("col_source", "Source"), w: 6.5 },
        { key: "branch", label: L("col_branch", "Branch"), w: 8 },
        { key: "user", label: L("col_user", "User"), w: 6 },
        { key: "particulars", label: L("col_particulars", "Particulars"), w: 21 },
        { key: "rate", label: L("col_currency_rate", "Currency / Rate"), w: 6 },
        { key: "debit", label: L("col_debit", "Debit"), w: 7.5, cls: "num" },
        { key: "credit", label: L("col_credit", "Credit"), w: 7.5, cls: "num" },
        { key: "balance", label: L("col_balance", "Balance"), w: 9.5, cls: "num" },
      ];
  const span = cols.length;
  const amountStart = cols.findIndex((k) => k.key === "debit");

  const cell = (l: LedgerPrintLine, i: number, key: string): string => {
    switch (key) {
      case "no": return String(i + 1);
      case "date": return dateOf(l.date);
      case "voucher":
        return `<div class="strong">${ltr(l.serial || "—")}</div>${l.manualRef ? `<div class="sub">${ltr(l.manualRef)}</div>` : ""}`;
      case "serial": return ltr(l.serial || "—");
      case "manualRef": return l.manualRef ? ltr(l.manualRef) : "";
      case "source": return src(l.source);
      case "branch": return esc(l.branch || "");
      case "user": return esc(l.user || "");
      case "rate": return rateText(l);
      case "particulars": {
        const main = `<div class="desc">${esc(l.description || "—")}</div>`;
        if (!portrait) return main;
        const meta = [src(l.source), l.branch ? esc(l.branch) : "", l.user ? esc(l.user) : "", foreign(l) ? rateText(l) : ""].filter(Boolean).join(" · ");
        return main + (meta ? `<div class="sub">${meta}</div>` : "");
      }
      case "debit": return amt(l.debit);
      case "credit": return amt(l.credit);
      case "balance": return bal(l.balance);
      default: return "";
    }
  };

  const labelRow = (label: string, cls: string, debit: string, credit: string, balance: string) =>
    `<tr class="${cls}"><td colspan="${amountStart}" class="lbl">${esc(label)}</td><td class="num">${debit}</td><td class="num">${credit}</td><td class="num">${balance}</td></tr>`;

  const bodyRows = data.lines.length
    ? data.lines.map((l, i) => `<tr>${cols.map((k) => `<td class="${k.cls ?? ""}">${cell(l, i, k.key)}</td>`).join("")}</tr>`).join("\n")
    : `<tr><td colspan="${span}" class="empty">${esc(L("no_entries", "No entries in this period."))}</td></tr>`;

  const accountFields: [string, string][] = [
    [L("account", "Account"), esc(a.name)],
    [L("account_code", "Account No."), ltr(a.code || "—")],
    ...(a.customerNumber ? [[L("customer_no", "Customer No."), ltr(a.customerNumber)] as [string, string]] : []),
    ...(a.manualReference ? [[L("manual_ref", "Manual Ref."), ltr(a.manualReference)] as [string, string]] : []),
    [L("currency", "Currency"), ltr(a.currency)],
    ...(countryBranch ? [[L("country_branch", "Country / Branch"), esc(countryBranch)] as [string, string]] : []),
    ...(a.company ? [[L("company", "Company"), esc(a.company)] as [string, string]] : []),
    ...(a.kind ? [[L("account_type", "Account Type"), esc(a.kind)] as [string, string]] : []),
    [L("normal_balance", "Normal Balance"), esc(data.normalBalance === "credit" ? L("normal_credit", "Credit (Cr)") : L("normal_debit", "Debit (Dr)"))],
  ];

  // portrait: one row of five; landscape: a 2×2 block (opening/closing, debit/credit) + a slim entries line
  const sOpen = [L("opening", "Opening Balance"), bal(data.openingBalance), "op"];
  const sDr = [L("total_debit", "Total Debit"), ltr(money(data.totalDebit)), "dr"];
  const sCr = [L("total_credit", "Total Credit"), ltr(money(data.totalCredit)), "cr"];
  const sClose = [L("closing", "Closing Balance"), bal(data.closingBalance), "cl"];
  const sEnt = [L("entries", "Entries"), ltr(data.lines.length), "en"];
  const summary = portrait ? [sOpen, sDr, sCr, sClose, sEnt] : [sOpen, sClose, sDr, sCr, sEnt];

  const contact = [c.address, c.phone, c.email, c.website].filter(Boolean).map((x) => esc(x)).join(" · ");
  const footLeft = `${c.name ? `${c.name} · ` : ""}${a.code || ""}`.replace(/"/g, "'");
  const footRight = `${L("printed_by", "Printed by")}: ${data.printedBy || "—"} · ${printedAt}`.replace(/"/g, "'");
  const pageWord = L("page", "Page").replace(/"/g, "'");
  const ofWord = L("of", "of").replace(/"/g, "'");
  const fontFamily = isRtl ? "'Noto Naskh Arabic', 'Segoe UI', Tahoma, Arial, sans-serif" : "'Inter', 'Segoe UI', Roboto, Arial, sans-serif";
  const base = portrait ? 7.8 : 7.6;

  return `<!doctype html>
<html lang="${esc(lang)}" dir="${isRtl ? "rtl" : "ltr"}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(L("title", "Account Ledger Statement"))} — ${esc(a.name)}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&family=Noto+Naskh+Arabic:wght@400;600;700&display=swap');
  @page {
    size: A4 ${portrait ? "portrait" : "landscape"};
    margin: ${portrait ? "11mm 10mm 14mm 10mm" : "9mm 9mm 13mm 9mm"};
    @bottom-left { content: "${isRtl ? footRight : footLeft}"; font: 7pt ${fontFamily}; color: #64748b; }
    @bottom-center { content: "${pageWord} " counter(page) " ${ofWord} " counter(pages); font: 700 7.5pt ${fontFamily}; color: #0f172a; }
    @bottom-right { content: "${isRtl ? footLeft : footRight}"; font: 7pt ${fontFamily}; color: #64748b; }
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; color: #0f172a; }
  body { font-family: ${fontFamily}; font-size: ${base}pt; line-height: ${isRtl ? 1.45 : 1.25}; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .doc { width: 100%; max-width: ${portrait ? "190mm" : "279mm"}; margin: 0 auto; padding: 6mm 0; }
  bdi { unicode-bidi: isolate; }
  .no-print-toolbar { position: sticky; top: 0; z-index: 5; display: flex; gap: 8px; justify-content: flex-end; padding: 8px 0; background: #fff; }
  .no-print-toolbar button { font: 600 12px ${fontFamily}; padding: 6px 14px; border-radius: 6px; border: 1px solid #0f172a; background: #0f172a; color: #fff; cursor: pointer; }
  @media print { .no-print-toolbar { display: none; } .doc { padding: 0; max-width: none; } }

  /* letterhead */
  .lh { display: flex; justify-content: space-between; align-items: flex-start; gap: 6mm; border-bottom: 2px solid #0f172a; padding-bottom: 2.5mm; }
  .lh .brand { display: flex; gap: 3mm; align-items: center; min-width: 0; }
  .lh img { max-height: ${portrait ? "15mm" : "13mm"}; max-width: 35mm; object-fit: contain; }
  .lh .co { font-size: ${portrait ? 12 : 12.5}pt; font-weight: 800; letter-spacing: .2px; }
  .lh .co-sub { color: #475569; font-size: 7.4pt; margin-top: .6mm; overflow-wrap: anywhere; }
  .lh .title { text-align: end; flex-shrink: 0; }
  .lh .title h1 { margin: 0; font-size: ${portrait ? 13 : 14}pt; font-weight: 800; color: #0f172a; text-transform: ${isRtl ? "none" : "uppercase"}; letter-spacing: ${isRtl ? 0 : ".6px"}; }
  .lh .title .meta { color: #334155; font-size: 7.6pt; margin-top: .8mm; }

  /* account panel + summary */
  .panel { display: grid; grid-template-columns: ${portrait ? "1fr" : "1.55fr 1fr"}; gap: 3mm; margin: 3mm 0 2.5mm; break-inside: avoid; }
  .acct { border: 1px solid #cbd5e1; border-radius: 1.5mm; padding: 2mm 2.5mm; display: grid; grid-template-columns: ${portrait ? "repeat(2, minmax(0, 1fr))" : "repeat(3, minmax(0, 1fr))"}; gap: 1.2mm 4mm; }
  .acct .f .k { color: #64748b; font-size: 6.8pt; text-transform: ${isRtl ? "none" : "uppercase"}; letter-spacing: ${isRtl ? 0 : ".3px"}; }
  .acct .f .v { font-weight: 700; font-size: 8pt; overflow-wrap: anywhere; }
  .acct .f.wide { grid-column: 1 / -1; }
  .sum { display: grid; grid-template-columns: repeat(${portrait ? 5 : 2}, minmax(0, 1fr)); gap: 1.5mm; align-content: start; }
  .sum .b { border: 1px solid #cbd5e1; border-radius: 1.5mm; padding: 1.6mm 2mm; background: #f8fafc; }
  .sum .b .k { color: #64748b; font-size: 6.6pt; }
  .sum .b .v { font-weight: 800; font-size: ${portrait ? 8.4 : 9}pt; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .sum .b.cl { background: #0f172a; color: #fff; border-color: #0f172a; } .sum .b.cl .k { color: #cbd5e1; }
  ${portrait ? "" : ".sum .b.en { grid-column: 1 / -1; padding: .8mm 2mm; display: flex; justify-content: space-between; align-items: baseline; }"}
  .filter-note { margin: 0 0 2mm; padding: 1.2mm 2mm; background: #fffbeb; border: 1px solid #fcd34d; border-radius: 1mm; font-size: 7.4pt; color: #92400e; }

  /* ledger table */
  table.data-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  thead { display: table-header-group; }
  tfoot { display: table-row-group; }
  thead tr.run th { background: #fff; color: #334155; font-weight: 600; font-size: 7pt; text-align: start; padding: 0 0 1mm; border: 0; }
  thead tr.run th .acc { font-weight: 800; color: #0f172a; }
  thead tr.cols th { background: #0f172a; color: #fff; font-weight: 700; font-size: 7.2pt; padding: 1.3mm 1.2mm; text-align: start; border: 1px solid #0f172a; vertical-align: bottom; overflow-wrap: break-word; word-break: normal; hyphens: manual; }
  thead tr.cols th.num { text-align: end; } thead tr.cols th.c { text-align: center; }
  tbody td { padding: .9mm 1.2mm; border-bottom: 1px solid #e2e8f0; vertical-align: top; overflow-wrap: break-word; word-break: normal; }
  tbody tr { break-inside: avoid; page-break-inside: avoid; }
  tbody tr:nth-child(even) td { background: #f8fafc; }
  td.num { text-align: end; white-space: nowrap; font-variant-numeric: tabular-nums; font-feature-settings: "tnum"; }
  td.c { text-align: center; color: #64748b; } td.nw { white-space: nowrap; }
  td .strong { font-weight: 700; } td .sub { color: #64748b; font-size: 6.6pt; margin-top: .2mm; line-height: 1.2; }
  td .desc { white-space: pre-wrap; }
  .dc { font-size: 6.6pt; font-weight: 700; color: #475569; margin-inline-start: .6mm; }
  tr.opening td { background: #eff6ff !important; font-style: italic; border-bottom: 1px solid #93c5fd; }
  tr.total-row td { font-weight: 800; background: #f1f5f9 !important; border-top: 1.5px solid #0f172a; border-bottom: 1px solid #0f172a; }
  tr.total-row.closing td { background: #0f172a !important; color: #fff; } tr.total-row.closing .dc { color: #cbd5e1; }
  td.lbl { text-align: end; padding-inline-end: 2.5mm; }
  td.empty { text-align: center; color: #64748b; padding: 6mm; }

  /* the end block (totals, closing, note, signatures) is chained to the last entries: it never starts a page on its own */
  tr.total-row { break-before: avoid; page-break-before: avoid; }
  tr.total-row.end td { background: #fff !important; color: #0f172a; border: 0; padding: 3mm 0 0; font-weight: 400; }
  .note { color: #64748b; font-size: 6.8pt; }
  .sign { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: ${portrait ? "8mm" : "16mm"}; margin-top: ${portrait ? "13mm" : "11mm"}; }
  .sign div { border-top: 1px solid #0f172a; padding-top: 1mm; text-align: center; font-size: 7.4pt; font-weight: 700; }
</style>
</head>
<body>
<div class="doc" data-layout="${portrait ? "portrait" : "landscape"}">
  <div class="no-print-toolbar"><button type="button" onclick="window.print()">${esc(L("print", "Print"))}</button></div>

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

  <section class="panel">
    <div class="acct">
      ${accountFields.map(([k, v], i) => `<div class="f${portrait && i === 0 ? " wide" : ""}"><div class="k">${esc(k)}</div><div class="v">${v}</div></div>`).join("")}
    </div>
    <div class="sum">
      ${summary.map(([k, v, cls]) => `<div class="b ${cls}"><div class="k">${esc(k)}</div><div class="v">${v}</div></div>`).join("")}
    </div>
  </section>
  ${data.filterNote ? `<div class="filter-note">${esc(L("filtered", "Filtered view"))}: ${esc(data.filterNote)}</div>` : ""}

  <table class="data-table">
    <colgroup>${cols.map((k) => `<col style="width:${k.w}%" />`).join("")}</colgroup>
    <thead>
      <tr class="run"><th colspan="${span}"><span class="acc">${esc(a.name)}</span> · ${ltr(a.code || "")} · ${ltr(a.currency)} · ${ltr(data.fromDate)} — ${ltr(data.toDate)}</th></tr>
      <tr class="cols">${cols.map((k) => `<th class="${k.cls ?? ""}">${esc(k.label)}${k.cls === "num" ? ` <bdi dir="ltr">(${esc(a.currency)})</bdi>` : ""}</th>`).join("")}</tr>
    </thead>
    <tbody>
      ${labelRow(L("opening_row", "Opening balance brought forward"), "opening", "", "", bal(data.openingBalance))}
      ${bodyRows}
      ${labelRow(L("totals_row", "Totals for the period"), "total-row", ltr(money(data.totalDebit)), ltr(money(data.totalCredit)), "")}
      ${labelRow(L("closing_row", "Closing balance carried forward"), "total-row closing", "", "", bal(data.closingBalance))}
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
    if (w) { w.document.open(); w.document.write(html); w.document.close(); }
  }
}
