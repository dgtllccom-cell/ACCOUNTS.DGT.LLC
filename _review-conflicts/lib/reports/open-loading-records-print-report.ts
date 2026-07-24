import { generateReportHtml, escapeHtml, formatMoney, formatNumber, formatDate, type ERPCompanyInfo, type ERPFilterPill, type ERPKpiCard } from "./erp-report-template-builder";

export type PurchaseLoadingReportRow = {
  id: string;
  country: string;
  branch: string;
  purchaseBookingNo: string;
  salesAccount: string;
  purchaseAccount: string;
  goods: string;
  contractQty: number;
  grossWeight: number;
  tareWeight: number;
  netWeight: number;
  purchasePriceRate: number;
  totalPurchaseFc: number;
  advanceFc: number;
  remainingFc: number;
  currencyFc?: string;
  exchangeRate: number;
  finalAmountLc: number;
  finalAdvanceLc: number;
  finalRemainingLc: number;
  currencyLc?: string;
  loadedQty: number;
  remainingToLoad: number;
  loadingStatus: "Completed" | "Almost Complete" | "Partially Loaded" | "Not Loaded" | string;
};

export function openLoadingRecordsPrintReport(input: {
  rows: PurchaseLoadingReportRow[];
  companyInfo?: ERPCompanyInfo;
  filters?: ERPFilterPill[];
  lang?: string;
}) {
  if (typeof window === "undefined") return;

  const { rows, companyInfo = {}, filters = [], lang = "en" } = input;

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
  const totalLoadedQty = rows.reduce((sum, r) => sum + (r.loadedQty || 0), 0);
  const totalRemainingToLoad = rows.reduce((sum, r) => sum + (r.remainingToLoad || 0), 0);

  function getStatusBadge(status: string) {
    const s = status.toLowerCase();
    if (s.includes("completed") || s.includes("100%")) {
      return `<span class="badge badge-green">Completed</span>`;
    }
    if (s.includes("almost") || s.includes("99%")) {
      return `<span class="badge badge-green" style="background:#e0f2fe; color:#0369a1; border-color:#7dd3fc;">Almost Complete</span>`;
    }
    if (s.includes("partial") || s.includes("loaded")) {
      return `<span class="badge badge-amber">Partially Loaded</span>`;
    }
    return `<span class="badge badge-red">Not Loaded</span>`;
  }

  const mainTableHtml = `
    <table class="data-table">
      <thead>
        <tr>
          <th style="width: 15px;">+</th>
          <th style="width: 20px;">SR#</th>
          <th>Country</th>
          <th>Branch</th>
          <th>Purchase Booking No.</th>
          <th>Sales Account</th>
          <th>Purchase Account</th>
          <th>Goods</th>
          <th>Contract Qty</th>
          <th>Gross Wt</th>
          <th>Tare Wt (Empty)</th>
          <th>Net Wt</th>
          <th>Purchase Price Rate</th>
          <th>Total Purchase Amount (FC)</th>
          <th>Purchase Advance (FC)</th>
          <th>Purchase Remaining (FC)</th>
          <th>Ex. Rate</th>
          <th>Final Amount (LC)</th>
          <th>Final Advance (LC)</th>
          <th>Final Remaining (LC)</th>
          <th>Loaded Qty</th>
          <th>Remaining to Load</th>
          <th>Loading Status</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((r, i) => `
          <tr>
            <td style="text-align: center; font-weight: 900; color: #64748b;">+</td>
            <td style="text-align: center; font-weight: 800;">${i + 1}</td>
            <td style="text-align: center;">${escapeHtml(r.country)}</td>
            <td style="text-align: center; font-weight: 700;">${escapeHtml(r.branch)}</td>
            <td style="font-family: monospace; font-weight: 900; color: #1e3a8a;">${escapeHtml(r.purchaseBookingNo)}</td>
            <td style="font-size: 7px;">${escapeHtml(r.salesAccount)}</td>
            <td style="font-size: 7px;">${escapeHtml(r.purchaseAccount)}</td>
            <td style="font-weight: 700; max-width: 90px;">${escapeHtml(r.goods)}</td>
            <td style="text-align: right; font-weight: 800;">${formatNumber(r.contractQty)} KG</td>
            <td style="text-align: right;">${formatNumber(r.grossWeight)} KG</td>
            <td style="text-align: right;">${formatNumber(r.tareWeight)} KG</td>
            <td style="text-align: right; font-weight: 800;">${formatNumber(r.netWeight)} KG</td>
            <td style="text-align: right; font-family: monospace;">${r.purchasePriceRate.toFixed(2)} USD</td>
            <td style="text-align: right; font-family: monospace; font-weight: 800; color: #2563eb;">${formatMoney(r.totalPurchaseFc, "USD")}</td>
            <td style="text-align: right; font-family: monospace; color: #059669;">${formatMoney(r.advanceFc, "USD")}</td>
            <td style="text-align: right; font-family: monospace; color: #dc2626; font-weight: 800;">${formatMoney(r.remainingFc, "USD")}</td>
            <td style="text-align: center; font-family: monospace;">${r.exchangeRate}</td>
            <td style="text-align: right; font-family: monospace; font-weight: 900; color: #059669;">${formatMoney(r.finalAmountLc, "AED")}</td>
            <td style="text-align: right; font-family: monospace;">${formatMoney(r.finalAdvanceLc, "AED")}</td>
            <td style="text-align: right; font-family: monospace; color: #dc2626; font-weight: 900;">${formatMoney(r.finalRemainingLc, "AED")}</td>
            <td style="text-align: right; font-weight: 900; color: #059669;">${formatNumber(r.loadedQty)} KG</td>
            <td style="text-align: right; font-weight: 900; color: #dc2626;">${formatNumber(r.remainingToLoad)} KG</td>
            <td style="text-align: center;">${getStatusBadge(r.loadingStatus)}</td>
          </tr>
        `).join("")}

        <!-- Total Row -->
        <tr class="total-row">
          <td colspan="8" style="text-align: center;">TOTAL (${rows.length} RECORDED BILLS)</td>
          <td style="text-align: right;">${formatNumber(totalContractQty)} KG</td>
          <td style="text-align: right;">${formatNumber(totalGrossWt)} KG</td>
          <td style="text-align: right;">${formatNumber(totalTareWt)} KG</td>
          <td style="text-align: right;">${formatNumber(totalNetWt)} KG</td>
          <td></td>
          <td style="text-align: right; color: #2563eb;">${formatMoney(totalFcAmount)} USD</td>
          <td style="text-align: right; color: #059669;">${formatMoney(totalFcAdvance)} USD</td>
          <td style="text-align: right; color: #dc2626;">${formatMoney(totalFcRemaining)} USD</td>
          <td></td>
          <td style="text-align: right; color: #059669;">${formatMoney(totalLcAmount)} AED</td>
          <td style="text-align: right;">${formatMoney(totalLcAdvance)} AED</td>
          <td style="text-align: right; color: #dc2626;">${formatMoney(totalLcRemaining)} AED</td>
          <td style="text-align: right; color: #059669;">${formatNumber(totalLoadedQty)} KG</td>
          <td style="text-align: right; color: #dc2626;">${formatNumber(totalRemainingToLoad)} KG</td>
          <td></td>
        </tr>
      </tbody>
    </table>
  `;

  const kpis: ERPKpiCard[] = [
    { label: "TOTAL PURCHASE (FC)", value: `${formatMoney(totalFcAmount)} USD`, color: "blue" },
    { label: "TOTAL ADVANCE (FC)", value: `${formatMoney(totalFcAdvance)} USD`, color: "green" },
    { label: "TOTAL REMAINING (FC)", value: `${formatMoney(totalFcRemaining)} USD`, color: "red" },
    { label: "TOTAL PURCHASE (LC)", value: `${formatMoney(totalLcAmount)} AED`, color: "blue" },
    { label: "TOTAL ADVANCE (LC)", value: `${formatMoney(totalLcAdvance)} AED`, color: "green" },
    { label: "TOTAL REMAINING (LC)", value: `${formatMoney(totalLcRemaining)} AED`, color: "red" },
    { label: "TOTAL LOADED QTY", value: `${formatNumber(totalLoadedQty)} KG`, color: "green" },
    { label: "REMAINING TO LOAD", value: `${formatNumber(totalRemainingToLoad)} KG`, color: "amber" }
  ];

  const legendHtml = `
    <b>LOADING STATUS LEGEND:</b><br />
    🟢 Completed (100% Loaded)<br />
    🔵 Almost Complete (75% - 99%)<br />
    🟡 Partially Loaded (1% - 74%)<br />
    🔴 Not Loaded (0%)
  `;

  // CSV Data for Export
  const csvHeaders = ["SR", "Country", "Branch", "Purchase Booking No", "Sales Account", "Purchase Account", "Goods", "Contract Qty", "Gross Wt", "Tare Wt", "Net Wt", "Rate", "Total Purchase FC", "Advance FC", "Remaining FC", "Ex Rate", "Total Purchase LC", "Advance LC", "Remaining LC", "Loaded Qty", "Remaining to Load", "Loading Status"];
  const csvRows = rows.map((r, i) => [
    i + 1, r.country, r.branch, r.purchaseBookingNo, r.salesAccount, r.purchaseAccount, r.goods, r.contractQty, r.grossWeight, r.tareWeight, r.netWeight, r.purchasePriceRate, r.totalPurchaseFc, r.advanceFc, r.remainingFc, r.exchangeRate, r.finalAmountLc, r.finalAdvanceLc, r.finalRemainingLc, r.loadedQty, r.remainingToLoad, r.loadingStatus
  ]);
  const csvData = [csvHeaders.join(","), ...csvRows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))].join("\n");

  const html = generateReportHtml({
    title: "PURCHASE LOADING RECORDS REPORT",
    orientation: "landscape",
    companyInfo,
    filters: [
      { label: "Country", value: companyInfo.country || "All Countries" },
      { label: "Branch", value: companyInfo.branch || "All Branches" },
      { label: "Status", value: "All Status" },
      { label: "Currency (FC)", value: "USD" },
      { label: "Local Currency (LC)", value: "AED" },
      { label: "Exchange Rate Type", value: "Daily Rate" }
    ],
    kpis,
    mainTableHtml,
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
