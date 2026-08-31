import { generateReportHtml, escapeHtml, formatMoney, formatDate, type ERPCompanyInfo } from "./erp-report-template-builder";

/**
 * Cash Entry Print System — four professional print formats in ONE helper,
 * all built on the shared ERP report template (logo, QR, branded header/footer,
 * Print / PDF / Excel / Email / WhatsApp, 5-language RTL). No duplication:
 *   - "cash"     Cash Entry Print       — cash transactions only
 *   - "bank"     Bank Entry Print       — bank transactions only
 *   - "business" Business Roznamcha     — business journal transactions only
 *   - "invoice"  Invoice Print          — invoice-related transactions only
 *
 * Filtering is done here so the caller can pass the full roznamcha/journal set
 * and get the correct subset per format.
 */
export type EntryPrintMode = "cash" | "bank" | "business" | "invoice";

export type EntryLine = {
  id: string;
  voucherNo: string;
  entryDate: string;
  accountCode?: string;
  accountTitle?: string;
  debit: number;
  credit: number;
  currency: string;
  narration?: string;
  user?: string;
  branch?: string;
  // Optional, used by specific modes:
  entryType?: string;      // "cash" | "bank" | "business" | "invoice" | ...
  bankName?: string;       // bank mode
  instrumentNo?: string;   // cheque / transfer ref (bank mode)
  invoiceNo?: string;      // invoice mode
  party?: string;          // invoice / business counterparty
};

const MODE_META: Record<EntryPrintMode, { title: string; typeKeys: string[] }> = {
  cash: { title: "CASH ENTRY PRINT", typeKeys: ["cash"] },
  bank: { title: "BANK ENTRY PRINT", typeKeys: ["bank"] },
  business: { title: "BUSINESS ROZNAMCHA PRINT", typeKeys: ["business", "journal", "business_journal"] },
  invoice: { title: "INVOICE PRINT", typeKeys: ["invoice", "sales_invoice", "purchase_invoice"] },
};

function headerCols(mode: EntryPrintMode): string {
  const common = `<th style="width:25px;">SR#</th><th>Voucher No</th><th>Date</th><th>Branch</th>`;
  const money = `<th>Debit (DR)</th><th>Credit (CR)</th><th>Currency</th><th>Narration / Particulars</th><th>User</th>`;
  if (mode === "bank") return `${common}<th>Bank</th><th>Instrument #</th><th>Account</th>${money}`;
  if (mode === "invoice") return `${common}<th>Invoice #</th><th>Party</th><th>Account</th>${money}`;
  if (mode === "business") return `${common}<th>Party</th><th>Account Code</th><th>Account Title</th>${money}`;
  return `${common}<th>Account Code</th><th>Account Title / Description</th>${money}`; // cash
}

function rowCells(mode: EntryPrintMode, e: EntryLine, i: number): string {
  const base = `
    <td style="text-align:center;font-weight:800;">${i + 1}</td>
    <td style="font-family:monospace;font-weight:900;color:#1e3a8a;text-align:center;">${escapeHtml(e.voucherNo)}</td>
    <td style="text-align:center;">${formatDate(e.entryDate)}</td>
    <td style="text-align:center;font-weight:700;">${escapeHtml(e.branch || "-")}</td>`;
  const money = `
    <td style="text-align:right;font-family:monospace;font-weight:800;color:${e.debit > 0 ? "#2563eb" : "#94a3b8"};">${e.debit > 0 ? formatMoney(e.debit, e.currency) : "-"}</td>
    <td style="text-align:right;font-family:monospace;font-weight:800;color:${e.credit > 0 ? "#059669" : "#94a3b8"};">${e.credit > 0 ? formatMoney(e.credit, e.currency) : "-"}</td>
    <td style="text-align:center;font-weight:800;">${escapeHtml(e.currency)}</td>
    <td style="font-size:7px;max-width:140px;">${escapeHtml(e.narration || "")}</td>
    <td style="text-align:center;font-size:7px;">${escapeHtml(e.user || "")}</td>`;
  let mid = "";
  if (mode === "bank") {
    mid = `<td style="font-weight:700;">${escapeHtml(e.bankName || "-")}</td>
           <td style="font-family:monospace;text-align:center;">${escapeHtml(e.instrumentNo || "-")}</td>
           <td style="font-weight:700;">${escapeHtml(e.accountTitle || e.accountCode || "-")}</td>`;
  } else if (mode === "invoice") {
    mid = `<td style="font-family:monospace;font-weight:800;text-align:center;">${escapeHtml(e.invoiceNo || "-")}</td>
           <td style="font-weight:700;">${escapeHtml(e.party || "-")}</td>
           <td style="font-weight:700;">${escapeHtml(e.accountTitle || "-")}</td>`;
  } else if (mode === "business") {
    mid = `<td style="font-weight:700;">${escapeHtml(e.party || "-")}</td>
           <td style="font-family:monospace;font-weight:800;text-align:center;">${escapeHtml(e.accountCode || "-")}</td>
           <td style="font-weight:700;">${escapeHtml(e.accountTitle || "-")}</td>`;
  } else {
    mid = `<td style="font-family:monospace;font-weight:800;text-align:center;">${escapeHtml(e.accountCode || "-")}</td>
           <td style="font-weight:700;">${escapeHtml(e.accountTitle || "-")}</td>`;
  }
  return `<tr>${base}${mid}${money}</tr>`;
}

export function openEntryTypePrintReport(input: {
  mode: EntryPrintMode;
  entries: EntryLine[];
  companyInfo?: ERPCompanyInfo;
  reportDate?: string;
  lang?: string;
  /** If false, entries are assumed pre-filtered by the caller. Default true. */
  filterByType?: boolean;
}) {
  if (typeof window === "undefined") return;
  const { mode, companyInfo = {}, reportDate = formatDate(new Date().toISOString()), lang = "en", filterByType = true } = input;
  const meta = MODE_META[mode];

  const entries = filterByType
    ? input.entries.filter((e) => !e.entryType || meta.typeKeys.includes(String(e.entryType).toLowerCase()))
    : input.entries;

  const totalDebit = entries.reduce((s, e) => s + (e.debit || 0), 0);
  const totalCredit = entries.reduce((s, e) => s + (e.credit || 0), 0);
  const currency = entries[0]?.currency || companyInfo.currency || "AED";
  const spanBeforeMoney = mode === "cash" ? 6 : 7; // columns before Debit

  const mainTableHtml = `
    <table class="data-table">
      <thead><tr>${headerCols(mode)}</tr></thead>
      <tbody>
        ${entries.map((e, i) => rowCells(mode, e, i)).join("")}
        <tr class="total-row">
          <td colspan="${spanBeforeMoney}" style="text-align:center;">TOTAL ${escapeHtml(meta.title)} (${entries.length})</td>
          <td style="text-align:right;color:#2563eb;">${formatMoney(totalDebit, currency)}</td>
          <td style="text-align:right;color:#059669;">${formatMoney(totalCredit, currency)}</td>
          <td style="text-align:center;">${currency}</td>
          <td colspan="2">NET: ${totalDebit === totalCredit ? "✅ BALANCED" : "⚠️ UNBALANCED"}</td>
        </tr>
      </tbody>
    </table>`;

  const kpis = [
    { label: "TOTAL ENTRIES", value: `${entries.length}`, color: "blue" as const },
    { label: "TOTAL DEBIT (DR)", value: formatMoney(totalDebit, currency), color: "blue" as const },
    { label: "TOTAL CREDIT (CR)", value: formatMoney(totalCredit, currency), color: "green" as const },
    { label: "STATUS", value: totalDebit === totalCredit ? "BALANCED ✅" : "UNBALANCED ⚠️", color: totalDebit === totalCredit ? ("green" as const) : ("red" as const) },
  ];

  const csvHeaders = ["SR", "Voucher No", "Date", "Branch", "Account", "Debit", "Credit", "Currency", "Narration", "User"];
  const csvRows = entries.map((e, i) => [i + 1, e.voucherNo, e.entryDate, e.branch || "", e.accountTitle || e.accountCode || "", e.debit, e.credit, e.currency, e.narration || "", e.user || ""]);
  const csvData = [csvHeaders.join(","), ...csvRows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");

  const html = generateReportHtml({
    reportKind: "accounting",
    title: meta.title,
    orientation: mode === "cash" ? "portrait" : "landscape",
    companyInfo,
    filters: [
      { label: "Country", value: companyInfo.country || "All Countries" },
      { label: "Branch", value: companyInfo.branch || "All Branches" },
      { label: "Report Date", value: reportDate },
      { label: "Currency", value: currency },
    ],
    kpis,
    mainTableHtml,
    csvData,
    lang,
  });

  const w = window.open("", "_blank");
  if (w) {
    w.document.open();
    w.document.write(html);
    w.document.close();
  }
}
