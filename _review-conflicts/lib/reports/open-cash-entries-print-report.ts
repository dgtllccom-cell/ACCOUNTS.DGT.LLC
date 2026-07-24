import { generateReportHtml, escapeHtml, formatMoney, formatDate, type ERPCompanyInfo } from "./erp-report-template-builder";

export type CashEntryLine = {
  id: string;
  voucherNo: string;
  entryDate: string;
  accountCode: string;
  accountTitle: string;
  debit: number;
  credit: number;
  currency: string;
  narration: string;
  user: string;
  branch: string;
};

export function openRecentCashEntriesPrintReport(input: {
  entries: CashEntryLine[];
  companyInfo?: ERPCompanyInfo;
  reportDate?: string;
  lang?: string;
}) {
  if (typeof window === "undefined") return;

  const { entries, companyInfo = {}, reportDate = formatDate(new Date().toISOString()), lang = "en" } = input;

  const totalDebit = entries.reduce((sum, e) => sum + (e.debit || 0), 0);
  const totalCredit = entries.reduce((sum, e) => sum + (e.credit || 0), 0);
  const currency = entries[0]?.currency || companyInfo.currency || "AED";

  const mainTableHtml = `
    <table class="data-table">
      <thead>
        <tr>
          <th style="width: 25px;">SR#</th>
          <th>Voucher No</th>
          <th>Date</th>
          <th>Branch</th>
          <th>Account Code</th>
          <th>Account Title / Description</th>
          <th>Debit (DR)</th>
          <th>Credit (CR)</th>
          <th>Currency</th>
          <th>Narration / Particulars</th>
          <th>User</th>
        </tr>
      </thead>
      <tbody>
        ${entries.map((e, i) => `
          <tr>
            <td style="text-align: center; font-weight: 800;">${i + 1}</td>
            <td style="font-family: monospace; font-weight: 900; color: #1e3a8a; text-align: center;">${escapeHtml(e.voucherNo)}</td>
            <td style="text-align: center;">${formatDate(e.entryDate)}</td>
            <td style="text-align: center; font-weight: 700;">${escapeHtml(e.branch)}</td>
            <td style="font-family: monospace; font-weight: 800; text-align: center;">${escapeHtml(e.accountCode)}</td>
            <td style="font-weight: 700;">${escapeHtml(e.accountTitle)}</td>
            <td style="text-align: right; font-family: monospace; font-weight: 800; color: ${e.debit > 0 ? "#2563eb" : "#94a3b8"};">
              ${e.debit > 0 ? formatMoney(e.debit, e.currency) : "-"}
            </td>
            <td style="text-align: right; font-family: monospace; font-weight: 800; color: ${e.credit > 0 ? "#059669" : "#94a3b8"};">
              ${e.credit > 0 ? formatMoney(e.credit, e.currency) : "-"}
            </td>
            <td style="text-align: center; font-weight: 800;">${escapeHtml(e.currency)}</td>
            <td style="font-size: 7px; max-width: 140px;">${escapeHtml(e.narration)}</td>
            <td style="text-align: center; font-size: 7px;">${escapeHtml(e.user)}</td>
          </tr>
        `).join("")}

        <!-- Total Row -->
        <tr class="total-row">
          <td colspan="6" style="text-align: center;">TOTAL CASH ENTRIES (${entries.length})</td>
          <td style="text-align: right; color: #2563eb;">${formatMoney(totalDebit, currency)}</td>
          <td style="text-align: right; color: #059669;">${formatMoney(totalCredit, currency)}</td>
          <td style="text-align: center;">${currency}</td>
          <td colspan="2">NET BALANCED: ${totalDebit === totalCredit ? "✅ YES (BALANCED)" : "❌ UNBALANCED"}</td>
        </tr>
      </tbody>
    </table>
  `;

  const kpis = [
    { label: "TOTAL CASH ENTRIES", value: `${entries.length} Entries`, color: "blue" as const },
    { label: "TOTAL DEBIT (DR)", value: `${formatMoney(totalDebit, currency)}`, color: "blue" as const },
    { label: "TOTAL CREDIT (CR)", value: `${formatMoney(totalCredit, currency)}`, color: "green" as const },
    { label: "NET BALANCE STATUS", value: totalDebit === totalCredit ? "BALANCED ✅" : "UNBALANCED ⚠️", color: totalDebit === totalCredit ? ("green" as const) : ("red" as const) }
  ];

  // CSV Data for Export
  const csvHeaders = ["SR", "Voucher No", "Date", "Branch", "Account Code", "Account Title", "Debit", "Credit", "Currency", "Narration", "User"];
  const csvRows = entries.map((e, i) => [
    i + 1, e.voucherNo, e.entryDate, e.branch, e.accountCode, e.accountTitle, e.debit, e.credit, e.currency, e.narration, e.user
  ]);
  const csvData = [csvHeaders.join(","), ...csvRows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))].join("\n");

  const html = generateReportHtml({
    title: "RECENT CASH ENTRIES (ROZNAMCHA REPORT)",
    orientation: "portrait",
    companyInfo,
    filters: [
      { label: "Country", value: companyInfo.country || "All Countries" },
      { label: "Branch", value: companyInfo.branch || "All Branches" },
      { label: "Report Date", value: reportDate },
      { label: "Currency", value: currency }
    ],
    kpis,
    mainTableHtml,
    csvData,
    lang
  });

  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  }
}
