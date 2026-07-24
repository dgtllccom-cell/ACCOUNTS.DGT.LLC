import { generateReportHtml, escapeHtml, formatMoney, formatNumber, formatDate, type ERPCompanyInfo } from "./erp-report-template-builder";

export type PurchaseBookingGoodsItem = {
  srNo: number;
  goodsName: string;
  grade?: string;
  origin?: string;
  quantity: number;
  unit?: string;
  grossWeight: number;
  tareWeight?: number;
  netWeight: number;
  rateKg: number;
  amountFc: number;
  currencyFc: string;
  exchangeRate: number;
  amountLc: number;
  currencyLc: string;
};

export type PurchaseBookingOrderData = {
  id: string;
  systemBillNo: string;
  manualBillNo?: string;
  superAdminSerialNo?: string;
  countrySerialNo?: string;
  branchSerialNo?: string;
  bookingDate: string;
  purchaseDate?: string;
  supplierName: string;
  supplierContact?: string;
  buyerName?: string;
  purchaseAccountNo: string;
  purchaseAccountName: string;
  salesAccountNo: string;
  salesAccountName: string;
  countryName: string;
  branchName: string;
  shippingMode?: string;
  containerNumbers?: string;
  vesselName?: string;
  loadingCountryPort?: string;
  receivedCountryPort?: string;
  goodsItems: PurchaseBookingGoodsItem[];
  totalPurchaseFc: number;
  currencyFc: string;
  totalPurchaseLc: number;
  currencyLc: string;
  advancePercent?: number;
  advanceAmountFc?: number;
  advanceAmountLc?: number;
  remainingAmountFc?: number;
  remainingAmountLc?: number;
  advancePaymentDate?: string;
  remainingDueDate?: string;
  paymentType?: string;
  paymentMethodDetails?: string;
  status: string;
  remarks?: string;
  userName?: string;
};

export function openPurchaseBookingOrderPrintReport(input: {
  order: PurchaseBookingOrderData;
  companyInfo?: ERPCompanyInfo;
  lang?: string;
}) {
  if (typeof window === "undefined") return;

  const { order: o, companyInfo = {}, lang = "en" } = input;
  const items = o.goodsItems && o.goodsItems.length > 0 ? o.goodsItems : [];

  const totalQty = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
  const totalGrossWt = items.reduce((sum, item) => sum + (item.grossWeight || 0), 0);
  const totalNetWt = items.reduce((sum, item) => sum + (item.netWeight || 0), 0);
  const totalDeductions = Math.max(0, totalGrossWt - totalNetWt);

  const mainTableHtml = `
    <!-- Header Summary Box -->
    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 10px;">
      
      <!-- Card 1: Order Details -->
      <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px; background: #ffffff;">
        <div style="font-size: 7.5px; font-weight: 900; color: #1e3a8a; text-transform: uppercase; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 6px;">
          📋 Order & Reference Serials
        </div>
        <table style="width: 100%; font-size: 7.5px;">
          <tr><td style="color: #64748b;">System Bill No:</td><td style="font-family: monospace; font-weight: 900; color: #1e3a8a;">${escapeHtml(o.systemBillNo)}</td></tr>
          <tr><td style="color: #64748b;">Manual Bill No:</td><td style="font-family: monospace; font-weight: 800;">${escapeHtml(o.manualBillNo || "-")}</td></tr>
          <tr><td style="color: #64748b;">Super S/N:</td><td style="font-family: monospace; color: #0d9488;">${escapeHtml(o.superAdminSerialNo || "-")}</td></tr>
          <tr><td style="color: #64748b;">Country S/N:</td><td style="font-family: monospace; color: #d97706;">${escapeHtml(o.countrySerialNo || "-")}</td></tr>
          <tr><td style="color: #64748b;">Branch S/N:</td><td style="font-family: monospace; color: #0284c7;">${escapeHtml(o.branchSerialNo || "-")}</td></tr>
          <tr><td style="color: #64748b;">Booking Date:</td><td style="font-weight: 700;">${formatDate(o.bookingDate)}</td></tr>
        </table>
      </div>

      <!-- Card 2: Supplier & Counterparty -->
      <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px; background: #ffffff;">
        <div style="font-size: 7.5px; font-weight: 900; color: #1e3a8a; text-transform: uppercase; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 6px;">
          🏢 Supplier & Counterparty
        </div>
        <table style="width: 100%; font-size: 7.5px;">
          <tr><td style="color: #64748b;">Supplier Name:</td><td style="font-weight: 800;">${escapeHtml(o.supplierName)}</td></tr>
          <tr><td style="color: #64748b;">Contact:</td><td>${escapeHtml(o.supplierContact || "-")}</td></tr>
          <tr><td style="color: #64748b;">Buyer Name:</td><td style="font-weight: 700;">${escapeHtml(o.buyerName || companyInfo.name || "DGT LLC")}</td></tr>
          <tr><td style="color: #64748b;">Country / Branch:</td><td style="font-weight: 800;">${escapeHtml(o.countryName)} / ${escapeHtml(o.branchName)}</td></tr>
          <tr><td style="color: #64748b;">Order Status:</td><td><span class="badge badge-green">${escapeHtml(o.status)}</span></td></tr>
        </table>
      </div>

      <!-- Card 3: Logistics & Shipping -->
      <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px; background: #ffffff;">
        <div style="font-size: 7.5px; font-weight: 900; color: #1e3a8a; text-transform: uppercase; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 6px;">
          🚢 Logistics & Shipping Details
        </div>
        <table style="width: 100%; font-size: 7.5px;">
          <tr><td style="color: #64748b;">Shipping Mode:</td><td style="font-weight: 800;">${escapeHtml(o.shippingMode || "By Sea")}</td></tr>
          <tr><td style="color: #64748b;">Containers:</td><td>${escapeHtml(o.containerNumbers || "N/A")}</td></tr>
          <tr><td style="color: #64748b;">Vessel / Carrier:</td><td>${escapeHtml(o.vesselName || "N/A")}</td></tr>
          <tr><td style="color: #64748b;">Loading Port:</td><td>${escapeHtml(o.loadingCountryPort || "N/A")}</td></tr>
          <tr><td style="color: #64748b;">Received Port:</td><td>${escapeHtml(o.receivedCountryPort || "N/A")}</td></tr>
        </table>
      </div>

    </div>

    <!-- Goods Specification Items Table -->
    <div style="margin-bottom: 10px;">
      <h3 style="font-size: 8.5px; font-weight: 900; text-transform: uppercase; color: #0f172a; margin-bottom: 4px;">
        📦 GOODS SPECIFICATION & PRICING BREAKDOWN
      </h3>
      <table class="data-table">
        <thead>
          <tr>
            <th style="width: 20px;">SR</th>
            <th>Goods Specification</th>
            <th>Origin</th>
            <th>Quantity</th>
            <th>Gross Wt</th>
            <th>Net Wt</th>
            <th>Rate / KG</th>
            <th>Purchase Amt (FC)</th>
            <th>Ex. Rate</th>
            <th>Final Amt (LC)</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((item, index) => `
            <tr>
              <td style="text-align: center; font-weight: 800;">${index + 1}</td>
              <td style="font-weight: 800; color: #1e3a8a;">${escapeHtml(item.goodsName)}</td>
              <td style="text-align: center;">${escapeHtml(item.origin || "-")}</td>
              <td style="text-align: right; font-weight: 800;">${formatNumber(item.quantity)} ${escapeHtml(item.unit || "BAGS")}</td>
              <td style="text-align: right;">${formatNumber(item.grossWeight)} KG</td>
              <td style="text-align: right; font-weight: 800;">${formatNumber(item.netWeight)} KG</td>
              <td style="text-align: right; font-family: monospace;">${item.rateKg.toFixed(2)}</td>
              <td style="text-align: right; font-family: monospace; font-weight: 800; color: #2563eb;">${formatMoney(item.amountFc, item.currencyFc)}</td>
              <td style="text-align: center; font-family: monospace;">${item.exchangeRate}</td>
              <td style="text-align: right; font-family: monospace; font-weight: 900; color: #059669;">${formatMoney(item.amountLc, item.currencyLc)}</td>
            </tr>
          `).join("")}

          <!-- Totals Row -->
          <tr class="total-row">
            <td colspan="3" style="text-align: center;">GRAND TOTALS</td>
            <td style="text-align: right;">${formatNumber(totalQty)} Units</td>
            <td style="text-align: right;">${formatNumber(totalGrossWt)} KG</td>
            <td style="text-align: right;">${formatNumber(totalNetWt)} KG</td>
            <td></td>
            <td style="text-align: right; color: #2563eb;">${formatMoney(o.totalPurchaseFc, o.currencyFc)}</td>
            <td></td>
            <td style="text-align: right; color: #059669;">${formatMoney(o.totalPurchaseLc, o.currencyLc)}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- General Ledger & Payment Schedule Grid -->
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
      
      <!-- GL Double Entry -->
      <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px; background: #ffffff;">
        <div style="font-size: 7.5px; font-weight: 900; color: #1e3a8a; text-transform: uppercase; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 6px;">
          ⚙️ General Ledger Posting
        </div>
        <table style="width: 100%; font-size: 7.5px;">
          <tr>
            <td style="font-weight: 900; color: #2563eb;">DEBIT (DR):</td>
            <td style="font-family: monospace;">${escapeHtml(o.purchaseAccountNo)}</td>
            <td style="font-weight: 800;">${escapeHtml(o.purchaseAccountName)}</td>
          </tr>
          <tr>
            <td style="font-weight: 900; color: #059669;">CREDIT (CR):</td>
            <td style="font-family: monospace;">${escapeHtml(o.salesAccountNo)}</td>
            <td style="font-weight: 800;">${escapeHtml(o.salesAccountName)}</td>
          </tr>
        </table>
      </div>

      <!-- Payment Terms -->
      <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px; background: #ffffff;">
        <div style="font-size: 7.5px; font-weight: 900; color: #1e3a8a; text-transform: uppercase; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 6px;">
          💰 Payment Terms & Schedules
        </div>
        <table style="width: 100%; font-size: 7.5px;">
          <tr>
            <td style="color: #64748b;">Advance Ratio:</td>
            <td style="font-weight: 800;">${o.advancePercent || 0}%</td>
            <td style="color: #64748b;">Advance Date:</td>
            <td>${formatDate(o.advancePaymentDate)}</td>
          </tr>
          <tr>
            <td style="color: #64748b;">Advance Amt:</td>
            <td style="font-weight: 800; color: #059669;">${formatMoney(o.advanceAmountLc || 0, o.currencyLc)}</td>
            <td style="color: #64748b;">Remaining Due:</td>
            <td style="font-weight: 800; color: #dc2626;">${formatMoney(o.remainingAmountLc || 0, o.currencyLc)}</td>
          </tr>
        </table>
      </div>

    </div>
  `;

  const kpis = [
    { label: "TOTAL QUANTITY", value: `${formatNumber(totalQty)} Units`, color: "blue" as const },
    { label: "GROSS WEIGHT", value: `${formatNumber(totalGrossWt)} KG`, color: "blue" as const },
    { label: "NET WEIGHT", value: `${formatNumber(totalNetWt)} KG`, color: "green" as const },
    { label: "TOTAL PURCHASE (FC)", value: `${formatMoney(o.totalPurchaseFc, o.currencyFc)}`, color: "blue" as const },
    { label: "TOTAL PURCHASE (LC)", value: `${formatMoney(o.totalPurchaseLc, o.currencyLc)}`, color: "green" as const },
    { label: "ADVANCE PAID (LC)", value: `${formatMoney(o.advanceAmountLc || 0, o.currencyLc)}`, color: "green" as const },
    { label: "REMAINING DUE (LC)", value: `${formatMoney(o.remainingAmountLc || 0, o.currencyLc)}`, color: "red" as const },
    { label: "DEDUCTIONS", value: `${formatNumber(totalDeductions)} KG`, color: "amber" as const }
  ];

  const html = generateReportHtml({
    title: "PURCHASE BOOKING ORDER DOCUMENT",
    orientation: "portrait",
    companyInfo,
    filters: [
      { label: "Bill No", value: o.systemBillNo },
      { label: "Country", value: o.countryName },
      { label: "Branch", value: o.branchName },
      { label: "Booking Date", value: formatDate(o.bookingDate) },
      { label: "Status", value: o.status }
    ],
    kpis,
    mainTableHtml,
    footerNotesHtml: `
      <b>ORDER CONFIRMATION:</b><br />
      &bull; Official Purchase Booking Order generated.<br />
      &bull; Double-entry accounting postings assigned.<br />
      &bull; Subject to company standard terms & conditions.
    `,
    lang
  });

  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  }
}
