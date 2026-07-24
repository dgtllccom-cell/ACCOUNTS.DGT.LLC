import { generateReportHtml, escapeHtml, formatMoney, formatNumber, formatDate, type ERPCompanyInfo, type ERPFilterPill, type ERPKpiCard } from "./erp-report-template-builder";

export type FinalizedPORow = {
  id: string;
  poNumber: string;
  soNumber?: string;
  manualBillNo?: string;
  country: string;
  branch: string;
  supplier: string;
  purchaseAccount?: string;
  salesAccount?: string;
  goods: string;
  contractQty: number;
  grossWeight: number;
  tareWeight?: number;
  netWeight: number;
  purchaseRate: number;
  totalPurchaseFc: number;
  advanceFc: number;
  remainingFc: number;
  currencyFc: string;
  exchangeRate: number;
  finalAmountLc: number;
  finalAdvanceLc: number;
  finalRemainingLc: number;
  currencyLc: string;
  status: string;
  createdAt?: string;
};

export function openFinalizedPOPrintReport(input: {
  rows: FinalizedPORow[];
  companyInfo?: ERPCompanyInfo;
  filters?: ERPFilterPill[];
  lang?: string;
}) {
  if (typeof window === "undefined") return;

  const { rows, companyInfo = {}, filters = [], lang = "en" } = input;

  // Calculate totals
  const totalContractQty = rows.reduce((sum, r) => sum + (r.contractQty || 0), 0);
  const totalGrossWt = rows.reduce((sum, r) => sum + (r.grossWeight || 0), 0);
  const totalTareWt = rows.reduce((sum, r) => sum + (r.tareWeight || 0), 0);
  const totalNetWt = rows.reduce((sum, r) => sum + (r.netWeight || 0), 0);
  const totalFcAmount = rows.reduce((sum, r) => sum + (r.totalPurchaseFc || 0), 0);
  const totalFcAdvance = rows.reduce((sum, r) => sum + (r.advanceFc || 0), 0);
  const totalFcRemaining = rows.reduce((sum, r) => sum + (r.remainingFc || 0), 0);
  const totalLcAmount = rows.reduce((sum, r) => sum + (r.finalAmountLc || 0), 0);
  const totalLcAdvance = rows.reduce((sum, r) => sum + (r.finalAdvanceLc || 0), 0);
  const totalLcRemaining = rows.reduce((sum, r) => sum + (r.finalRemainingLc || 0), 0);

  const mainTableHtml = `
    <table class="data-table">
      <thead>
        <tr>
          <th style="width: 25px;">SR#</th>
          <th>Country</th>
          <th>Branch</th>
          <th>PO / Bill No.</th>
          <th>Purchase Acct (DR)</th>
          <th>Sales Acct (CR)</th>
          <th>Goods Item</th>
          <th>Qty</th>
          <th>Gross Wt</th>
          <th>Net Wt</th>
          <th>Rate</th>
          <th>Total Purchase (FC)</th>
          <th>Advance (FC)</th>
          <th>Remaining (FC)</th>
          <th>Ex. Rate</th>
          <th>Final Amount (LC)</th>
          <th>Final Advance (LC)</th>
          <th>Final Remaining (LC)</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((r, i) => `
          <tr class="${r.status.toLowerCase().includes("completed") || r.status.toLowerCase().includes("final") ? "bg-highlight-green" : ""}">
            <td style="text-align: center; font-weight: 800;">${i + 1}</td>
            <td style="text-align: center;">${escapeHtml(r.country)}</td>
            <td style="text-align: center; font-weight: 700;">${escapeHtml(r.branch)}</td>
            <td style="font-family: monospace; font-weight: 900; color: #1e3a8a;">${escapeHtml(r.poNumber)}</td>
            <td>${escapeHtml(r.purchaseAccount || "DR Account")}</td>
            <td>${escapeHtml(r.salesAccount || "CR Account")}</td>
            <td style="font-weight: 700;">${escapeHtml(r.goods)}</td>
            <td style="text-align: right; font-weight: 800;">${formatNumber(r.contractQty)}</td>
            <td style="text-align: right;">${formatNumber(r.grossWeight)} kg</td>
            <td style="text-align: right; font-weight: 800;">${formatNumber(r.netWeight)} kg</td>
            <td style="text-align: right; font-family: monospace;">${r.purchaseRate.toFixed(2)}</td>
            <td style="text-align: right; font-family: monospace; font-weight: 800; color: #2563eb;">${formatMoney(r.totalPurchaseFc, r.currencyFc)}</td>
            <td style="text-align: right; font-family: monospace; color: #059669;">${formatMoney(r.advanceFc, r.currencyFc)}</td>
            <td style="text-align: right; font-family: monospace; color: #dc2626; font-weight: 800;">${formatMoney(r.remainingFc, r.currencyFc)}</td>
            <td style="text-align: center; font-family: monospace;">${r.exchangeRate}</td>
            <td style="text-align: right; font-family: monospace; font-weight: 900; color: #059669;">${formatMoney(r.finalAmountLc, r.currencyLc)}</td>
            <td style="text-align: right; font-family: monospace;">${formatMoney(r.finalAdvanceLc, r.currencyLc)}</td>
            <td style="text-align: right; font-family: monospace; color: #dc2626; font-weight: 900;">${formatMoney(r.finalRemainingLc, r.currencyLc)}</td>
            <td style="text-align: center;">
              <span class="badge ${r.status.toLowerCase().includes("completed") || r.status.toLowerCase().includes("final") ? "badge-green" : "badge-blue"}">
                ${escapeHtml(r.status)}
              </span>
            </td>
          </tr>
        `).join("")}

        <!-- Total Row -->
        <tr class="total-row">
          <td colspan="7" style="text-align: center;">TOTAL FINALIZED ORDERS (${rows.length})</td>
          <td style="text-align: right;">${formatNumber(totalContractQty)}</td>
          <td style="text-align: right;">${formatNumber(totalGrossWt)} KG</td>
          <td style="text-align: right;">${formatNumber(totalNetWt)} KG</td>
          <td></td>
          <td style="text-align: right; color: #2563eb;">${formatMoney(totalFcAmount)} USD</td>
          <td style="text-align: right; color: #059669;">${formatMoney(totalFcAdvance)} USD</td>
          <td style="text-align: right; color: #dc2626;">${formatMoney(totalFcRemaining)} USD</td>
          <td></td>
          <td style="text-align: right; color: #059669;">${formatMoney(totalLcAmount)} AED</td>
          <td style="text-align: right;">${formatMoney(totalLcAdvance)} AED</td>
          <td style="text-align: right; color: #dc2626;">${formatMoney(totalLcRemaining)} AED</td>
          <td></td>
        </tr>
      </tbody>
    </table>
  `;

  const kpis: ERPKpiCard[] = [
    { label: "TOTAL ORDERS", value: `${rows.length} POs`, color: "blue" },
    { label: "TOTAL PURCHASE (FC)", value: `${formatMoney(totalFcAmount)} USD`, color: "blue" },
    { label: "TOTAL ADVANCE (FC)", value: `${formatMoney(totalFcAdvance)} USD`, color: "green" },
    { label: "TOTAL REMAINING (FC)", value: `${formatMoney(totalFcRemaining)} USD`, color: "red" },
    { label: "TOTAL PURCHASE (LC)", value: `${formatMoney(totalLcAmount)} AED`, color: "blue" },
    { label: "TOTAL ADVANCE (LC)", value: `${formatMoney(totalLcAdvance)} AED`, color: "green" },
    { label: "TOTAL REMAINING (LC)", value: `${formatMoney(totalLcRemaining)} AED`, color: "red" },
    { label: "TOTAL WEIGHT", value: `${formatNumber(totalNetWt)} KG`, color: "amber" }
  ];

  // CSV Data for Export
  const csvHeaders = ["SR", "Country", "Branch", "PO Number", "Purchase Account", "Sales Account", "Goods", "Qty", "Gross Wt", "Net Wt", "Rate", "Total Purchase FC", "Advance FC", "Remaining FC", "Ex Rate", "Total Purchase LC", "Advance LC", "Remaining LC", "Status"];
  const csvRows = rows.map((r, i) => [
    i + 1, r.country, r.branch, r.poNumber, r.purchaseAccount || "", r.salesAccount || "", r.goods, r.contractQty, r.grossWeight, r.netWeight, r.purchaseRate, r.totalPurchaseFc, r.advanceFc, r.remainingFc, r.exchangeRate, r.finalAmountLc, r.finalAdvanceLc, r.finalRemainingLc, r.status
  ]);
  const csvData = [csvHeaders.join(","), ...csvRows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))].join("\n");

  const html = generateReportHtml({
    title: "FINALIZED PURCHASE ORDERS REPORT",
    orientation: "landscape",
    companyInfo,
    filters: [
      { label: "Country", value: companyInfo.country || "All Countries" },
      { label: "Branch", value: companyInfo.branch || "All Branches" },
      { label: "Status", value: "Finalized / Completed" },
      { label: "Currency (FC)", value: "USD" },
      { label: "Local Currency (LC)", value: "AED" },
      { label: "Exchange Rate Type", value: "Daily Rate" }
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
