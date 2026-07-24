import { generateReportHtml, escapeHtml, formatMoney, formatDate, type ERPCompanyInfo } from "./erp-report-template-builder";

export type CustomerLedgerRow = {
  srNo: number;
  date: string;
  branchEntryNo: string;
  userName: string;
  branchName: string;
  roznamachaNameAndNo: string;
  remarks: string;
  credit?: number;
  debit?: number;
  balance: number;
  dcType: "Dr" | "Cr";
};

export type CustomerLedgerReportData = {
  customerName: string;
  customerCode: string;
  taxNo?: string;
  phone?: string;
  address?: string;

  openingBalance: number;
  openingDcType: "Dr" | "Cr";
  totalCredit: number;
  totalDebit: number;
  closingBalance: number;
  closingDcType: "Dr" | "Cr";

  country: string;
  branch: string;
  currency: string;
  exchangeRateType?: string;

  salesAccount: string;
  customerAccount: string;
  roznamachaName: string;
  roznamachaNo: string;

  rows: CustomerLedgerRow[];
};

export function openCustomerLedgerPrintReport(input: {
  report: CustomerLedgerReportData;
  companyInfo?: ERPCompanyInfo;
  lang?: string;
}) {
  if (typeof window === "undefined") return;

  const { report: r, companyInfo = {}, lang = "en" } = input;
  const curr = r.currency || "AED";

  const mainTableHtml = `
    <!-- Top 4 Summary Cards Grid -->
    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 12px;">
      
      <!-- Card 1: CUSTOMER DETAILS -->
      <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px; background: #ffffff;">
        <div style="font-size: 7.5px; font-weight: 900; color: #1e3a8a; text-transform: uppercase; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 6px; display: flex; align-items: center; gap: 4px;">
          👤 CUSTOMER DETAILS
        </div>
        <table style="width: 100%; font-size: 7.5px; line-height: 1.5;">
          <tr><td style="color: #64748b; width: 45%;">Customer Name:</td><td style="font-weight: 800; color: #0f172a;">${escapeHtml(r.customerName)}</td></tr>
          <tr><td style="color: #64748b;">Customer Code:</td><td style="font-family: monospace; font-weight: 800; color: #1e3a8a;">${escapeHtml(r.customerCode)}</td></tr>
          <tr><td style="color: #64748b;">NTN / Tax No.:</td><td>${escapeHtml(r.taxNo || "-")}</td></tr>
          <tr><td style="color: #64748b;">Phone / Mobile:</td><td style="font-weight: 700;">${escapeHtml(r.phone || "-")}</td></tr>
          <tr><td style="color: #64748b;">Address:</td><td style="font-size: 7px;">${escapeHtml(r.address || "-")}</td></tr>
        </table>
      </div>

      <!-- Card 2: ACCOUNT SUMMARY -->
      <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px; background: #ffffff;">
        <div style="font-size: 7.5px; font-weight: 900; color: #1e3a8a; text-transform: uppercase; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 6px; display: flex; align-items: center; gap: 4px;">
          📊 ACCOUNT SUMMARY (${curr})
        </div>
        <table style="width: 100%; font-size: 7.5px; line-height: 1.5;">
          <tr><td style="color: #64748b;">Opening Balance:</td><td style="text-align: right; font-family: monospace; font-weight: 800;">${formatMoney(r.openingBalance)} <span style="color: ${r.openingDcType === "Dr" ? "#dc2626" : "#16a34a"};">${r.openingDcType}</span></td></tr>
          <tr><td style="color: #64748b;">Total Credit (Sales):</td><td style="text-align: right; font-family: monospace; font-weight: 800; color: #16a34a;">${formatMoney(r.totalCredit)}</td></tr>
          <tr><td style="color: #64748b;">Total Debit (Receipts):</td><td style="text-align: right; font-family: monospace; font-weight: 800; color: #dc2626;">${formatMoney(r.totalDebit)}</td></tr>
          <tr style="border-top: 1px solid #e2e8f0;"><td style="font-weight: 900; color: #0f172a;">Closing Balance:</td><td style="text-align: right; font-family: monospace; font-weight: 900; color: ${r.closingDcType === "Dr" ? "#dc2626" : "#16a34a"};">${formatMoney(r.closingBalance)} ${r.closingDcType}</td></tr>
        </table>
      </div>

      <!-- Card 3: FILTERS -->
      <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px; background: #ffffff;">
        <div style="font-size: 7.5px; font-weight: 900; color: #1e3a8a; text-transform: uppercase; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 6px; display: flex; align-items: center; gap: 4px;">
          🌪️ FILTERS
        </div>
        <table style="width: 100%; font-size: 7.5px; line-height: 1.5;">
          <tr><td style="color: #64748b;">Country:</td><td style="font-weight: 800;">${escapeHtml(r.country)}</td></tr>
          <tr><td style="color: #64748b;">Branch:</td><td style="font-weight: 800;">${escapeHtml(r.branch)}</td></tr>
          <tr><td style="color: #64748b;">Currency:</td><td style="font-weight: 800;">${escapeHtml(r.currency)}</td></tr>
          <tr><td style="color: #64748b;">Ex. Rate Type:</td><td>${escapeHtml(r.exchangeRateType || "Daily Rate")}</td></tr>
        </table>
      </div>

      <!-- Card 4: OTHER INFORMATION -->
      <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px; background: #ffffff;">
        <div style="font-size: 7.5px; font-weight: 900; color: #1e3a8a; text-transform: uppercase; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 6px; display: flex; align-items: center; gap: 4px;">
          ℹ️ OTHER INFORMATION
        </div>
        <table style="width: 100%; font-size: 7.5px; line-height: 1.5;">
          <tr><td style="color: #64748b;">Sales Account:</td><td style="font-family: monospace; font-weight: 800;">${escapeHtml(r.salesAccount)}</td></tr>
          <tr><td style="color: #64748b;">Customer Account:</td><td style="font-family: monospace; font-weight: 800;">${escapeHtml(r.customerAccount)}</td></tr>
          <tr><td style="color: #64748b;">Roznamacha Name:</td><td style="font-weight: 700;">${escapeHtml(r.roznamachaName)}</td></tr>
          <tr><td style="color: #64748b;">Roznamacha No.:</td><td style="font-family: monospace; font-weight: 800; color: #1e3a8a;">${escapeHtml(r.roznamachaNo)}</td></tr>
        </table>
      </div>

    </div>

    <!-- Main Data Table -->
    <table class="data-table">
      <thead>
        <tr>
          <th style="width: 25px;">SR#</th>
          <th style="width: 65px;">Date</th>
          <th style="width: 70px;">Branch Entry No.</th>
          <th style="width: 60px;">User Name</th>
          <th style="width: 60px;">Branch Name</th>
          <th style="width: 100px;">Roznamacha Name & No.</th>
          <th>Remarks</th>
          <th style="width: 80px;">Credit (${curr})</th>
          <th style="width: 80px;">Debit (${curr})</th>
          <th style="width: 85px;">Balance (${curr})</th>
          <th style="width: 35px;">Dr / Cr</th>
        </tr>
      </thead>
      <tbody>
        ${r.rows.map((row) => `
          <tr>
            <td style="text-align: center; font-weight: 800;">${row.srNo}</td>
            <td style="text-align: center;">${formatDate(row.date)}</td>
            <td style="font-family: monospace; font-weight: 800; text-align: center;">${escapeHtml(row.branchEntryNo)}</td>
            <td style="text-align: center; font-size: 7px;">${escapeHtml(row.userName)}</td>
            <td style="text-align: center; font-weight: 700;">${escapeHtml(row.branchName)}</td>
            <td style="font-weight: 800; color: #1e3a8a;">${escapeHtml(row.roznamachaNameAndNo)}</td>
            <td style="font-size: 7px; color: #334155;">${escapeHtml(row.remarks)}</td>
            <td style="text-align: right; font-family: monospace; font-weight: 900; color: #16a34a;">
              ${row.credit ? formatMoney(row.credit) : "-"}
            </td>
            <td style="text-align: right; font-family: monospace; font-weight: 900; color: #dc2626;">
              ${row.debit ? formatMoney(row.debit) : "-"}
            </td>
            <td style="text-align: right; font-family: monospace; font-weight: 900;">
              ${formatMoney(row.balance)} <span style="font-size: 6.5px; color: ${row.dcType === "Dr" ? "#dc2626" : "#16a34a"};">${row.dcType}</span>
            </td>
            <td style="text-align: center; font-weight: 900; color: ${row.dcType === "Dr" ? "#dc2626" : "#16a34a"};">
              ${row.dcType}
            </td>
          </tr>
        `).join("")}

        <!-- Total Row -->
        <tr class="total-row">
          <td colspan="7" style="text-align: center;">TOTAL</td>
          <td style="text-align: right; color: #16a34a; font-family: monospace; font-weight: 900;">${formatMoney(r.totalCredit)}</td>
          <td style="text-align: right; color: #dc2626; font-family: monospace; font-weight: 900;">${formatMoney(r.totalDebit)}</td>
          <td style="text-align: right; font-family: monospace; font-weight: 900;">CLOSING BALANCE</td>
          <td style="text-align: center; font-weight: 900; color: ${r.closingDcType === "Dr" ? "#dc2626" : "#16a34a"}; white-space: nowrap;">
            ${formatMoney(r.closingBalance)} ${r.closingDcType}
          </td>
        </tr>
      </tbody>
    </table>
  `;

  const legendHtml = `
    <b>LEGEND:</b><br />
    <span style="color: #dc2626; font-weight: 800;">Dr (in red):</span> Debit Balance<br />
    <span style="color: #16a34a; font-weight: 800;">Cr (in green):</span> Credit Balance<br />
    Page 1 of 1
  `;

  const footerNotesHtml = `
    <b>NOTE:</b><br />
    &bull; Dr = Debit Balance (Company Receivable from Customer)<br />
    &bull; Cr = Credit Balance (Company Payable to Customer)<br />
    &bull; All amounts are in ${curr}<br />
    &bull; This is a computer generated report.
  `;

  // CSV Export Data
  const csvHeaders = ["SR", "Date", "Branch Entry No", "User Name", "Branch Name", "Roznamacha Name & No", "Remarks", "Credit", "Debit", "Balance", "Dr/Cr"];
  const csvRows = r.rows.map((row) => [
    row.srNo, row.date, row.branchEntryNo, row.userName, row.branchName, row.roznamachaNameAndNo, row.remarks, row.credit || 0, row.debit || 0, row.balance, row.dcType
  ]);
  const csvData = [csvHeaders.join(","), ...csvRows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))].join("\n");

  const html = generateReportHtml({
    title: "CUSTOMER LEDGER REPORT",
    subtitle: "ROZNAMACHA / ACCOUNT STATEMENT",
    orientation: "landscape",
    companyInfo,
    mainTableHtml,
    footerNotesHtml,
    legendHtml,
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
