import { t } from "@/lib/i18n/ui";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import type { PurchaseReportData } from "./open-purchase-a4-report-window";
import { printStore } from "@/lib/store/print-store";

function escapeHtml(value: string) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatMoney(value: unknown) {
  return Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function openProformaInvoiceWindow(input: {
  purchaseData: PurchaseReportData;
  lang?: string;
}) {
  if (typeof window === "undefined") return;

  const lang = (input.lang || "en") as SupportedLanguage;
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);

  const b = input.purchaseData;
  const form = b.form_data?.form || {};
  const goods = b.form_data?.goodsEntries || [];

  // Parse items from goodsEntries list
  let items: any[] = [];
  if (goods.length > 0) {
    items = goods.map((g: any, index: number) => {
      const qtyNo = Number(g.qtyNo || 0);
      const qtyKgs = Number(g.qtyKgs || 0);
      const emptyKgs = Number(g.emptyKgs || 0);
      const netWt = qtyNo * (qtyKgs - emptyKgs);
      const rateKg = Number(g.coursePrice || 0);
      const amountUsd = Number(g.totalAmount || 0);
      
      return {
        srNo: index + 1,
        goodsName: g.goodsName || "-",
        origin: g.origin || "-",
        quantity: qtyNo,
        qtyName: g.qtyName || "BAGS",
        netWt,
        rateKg,
        amountUsd,
        hsCode: g.hsCode || form.hsCode || "-"
      };
    });
  } else {
    items = [{
      srNo: 1,
      goodsName: b.productName || "-",
      origin: b.countryName || "-",
      quantity: b.quantity || 0,
      qtyName: b.unit || "BAGS",
      netWt: b.totalNetWeight || 0,
      rateKg: b.purchaseRate || 0,
      amountUsd: b.totalPurchaseAmount || 0,
      hsCode: form.hsCode || "-"
    }];
  }

  // Calculate Aggregates
  const totalQuantity = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
  const totalNetWeight = items.reduce((sum, item) => sum + (item.netWt || 0), 0);
  const totalAmountUsd = items.reduce((sum, item) => sum + (item.amountUsd || 0), 0);
  const totalGrossWeight = b.totalGrossWeight || totalNetWeight; // Fallback to net if not provided globally

  const currency = form.purchaseCurrency || form.currencyType || b.currency || "USD";
  const sellerName = b.supplierName || "-";
  const consigneeName = b.buyerName || "-";
  const notifyParty = form.notifyParty || "-";

  // Costs
  const freightCosts = Number(form.freightCharges || 0);
  const handlingCosts = Number(form.handlingCharges || 0);
  const insuranceCosts = Number(form.insurance || 0);
  const dutiesAndTaxes = Number(form.dutiesAndTaxes || 0);
  const otherCosts = Number(form.otherCharges || 0);
  const totalInvoiceValue = totalAmountUsd + freightCosts + handlingCosts + insuranceCosts + dutiesAndTaxes + otherCosts;

  const html = `<!doctype html>
<html lang="${lang}" dir="${isRtl ? "rtl" : "ltr"}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Proforma Invoice</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700;900&display=swap');
      @page { size: A4; margin: 8mm; }
      html, body { height: 100%; margin: 0; padding: 0; }
      body { background: #f1f5f9; color: #000; font-family: 'Roboto', sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; font-size: 10px; }
      .wrap { padding: 20px; display: flex; flex-direction: column; gap: 20px; align-items: center; }
      .sheet {
        width: 210mm;
        min-height: 297mm;
        padding: 8mm;
        background: #ffffff;
        border: 1px solid #cbd5e1;
        box-shadow: 0 10px 30px rgba(15, 23, 42, 0.05);
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        position: relative;
        text-align: left;
      }
      .pi-header {
        text-align: center;
        background-color: #e5e5e5;
        border: 1px solid #000;
        border-bottom: none;
        padding: 5px;
        font-size: 16px;
        font-weight: 900;
        text-transform: uppercase;
      }
      .grid-layout {
        display: flex;
        flex-direction: column;
        border: 1px solid #000;
      }
      .row-flex {
        display: flex;
        border-bottom: 1px solid #000;
      }
      .row-flex:last-child {
        border-bottom: none;
      }
      .col-left {
        flex: 1;
        border-right: 1px solid #000;
        padding: 4px 6px;
        display: flex;
        flex-direction: column;
      }
      .col-right {
        flex: 1;
        display: flex;
        flex-direction: column;
      }
      .cell {
        padding: 4px 6px;
        border-bottom: 1px solid #000;
      }
      .cell:last-child {
        border-bottom: none;
      }
      .cell-title {
        font-size: 8px;
        color: #333;
        margin-bottom: 2px;
      }
      .cell-val {
        font-size: 10px;
        font-weight: 700;
      }
      .inner-row {
        display: flex;
        border-bottom: 1px solid #000;
      }
      .inner-row:last-child {
        border-bottom: none;
      }
      .inner-col {
        flex: 1;
        padding: 4px 6px;
        border-right: 1px solid #000;
      }
      .inner-col:last-child {
        border-right: none;
      }

      .table-goods {
        width: 100%;
        border-collapse: collapse;
      }
      .table-goods th {
        border-right: 1px solid #000;
        border-bottom: 1px solid #000;
        padding: 6px;
        font-size: 9px;
        text-align: center;
        font-weight: 700;
      }
      .table-goods th:last-child {
        border-right: none;
      }
      .table-goods td {
        border-right: 1px solid #000;
        padding: 6px;
        font-size: 10px;
        text-align: center;
        vertical-align: top;
      }
      .table-goods td:last-child {
        border-right: none;
      }
      
      .main-body {
        flex-grow: 1;
        border-bottom: 1px solid #000;
      }

      .footer-grid {
        display: flex;
      }
      .footer-left {
        flex: 1;
        border-right: 1px solid #000;
        padding: 8px;
        font-size: 9px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
      }
      .footer-right {
        width: 40%;
        display: flex;
        flex-direction: column;
      }
      .cost-row {
        display: flex;
        border-bottom: 1px solid #000;
      }
      .cost-lbl {
        flex: 1;
        padding: 4px 6px;
        border-right: 1px solid #000;
        font-size: 9px;
      }
      .cost-val {
        width: 40%;
        padding: 4px 6px;
        text-align: right;
        font-size: 10px;
        font-weight: 700;
      }
      .total-row {
        background-color: #f0f0f0;
      }
      .total-row .cost-lbl, .total-row .cost-val {
        font-weight: 900;
      }

      .sign-area {
        margin-top: 20px;
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
      }
      .sign-line-box {
        width: 45%;
      }
      .sign-line {
        border-bottom: 1px solid #000;
        height: 20px;
        margin-bottom: 4px;
      }
      .sign-lbl {
        font-size: 8px;
        text-align: center;
      }

      @media print {
        body { background: #ffffff; }
        .wrap { padding: 0; gap: 0; }
        .sheet {
          border: none !important;
          box-shadow: none !important;
          margin: 0 !important;
          padding: 8mm !important;
          page-break-after: always;
          min-height: 100vh !important;
          height: auto !important;
        }
        .sheet:last-child {
          page-break-after: avoid;
        }
      }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="sheet">
        <div class="pi-header">Proforma Invoice</div>
        
        <div class="grid-layout">
          <div class="row-flex">
            <div class="col-left">
              <div class="cell-title">SELLER / SHIPPER (Name, Full Address, Country)</div>
              <div class="cell-val">${escapeHtml(sellerName)}</div>
              <div style="font-size: 9px; margin-top: 4px; white-space: pre-wrap;">${escapeHtml(form.supplierAddress || "")}</div>
            </div>
            <div class="col-right">
              <div class="inner-row">
                <div class="inner-col">
                  <div class="cell-title">Invoice Date</div>
                  <div class="cell-val">${formatDate(form.invoiceDate || b.bookingDate)}</div>
                </div>
                <div class="inner-col">
                  <div class="cell-title">Invoice Number</div>
                  <div class="cell-val">${escapeHtml(form.invoiceNumber || b.purchaseBookingOrderNumber)}</div>
                </div>
              </div>
              <div class="cell">
                <div class="cell-title">Customer Order Number</div>
                <div class="cell-val">${escapeHtml(form.salesOrderNo || "-")}</div>
              </div>
              <div class="cell">
                <div class="cell-title">Bill of Lading / Air Waybill Number</div>
                <div class="cell-val">${escapeHtml(form.blNumber || form.blNo || "-")}</div>
              </div>
            </div>
          </div>

          <div class="row-flex">
            <div class="col-left">
              <div class="cell-title">CONSIGNEE (Name, Full Address, Country)</div>
              <div class="cell-val">${escapeHtml(consigneeName)}</div>
              <div style="font-size: 9px; margin-top: 4px; white-space: pre-wrap;">${escapeHtml(form.buyerAddress || form.receivedCountry || "")}</div>
            </div>
            <div class="col-right">
              <div class="inner-row">
                <div class="inner-col">
                  <div class="cell-title">Port of Embarkation</div>
                  <div class="cell-val">${escapeHtml(form.loadingPort || "-")}</div>
                </div>
                <div class="inner-col">
                  <div class="cell-title">Final Destination</div>
                  <div class="cell-val">${escapeHtml(form.receivedPort || "-")}</div>
                </div>
              </div>
              <div class="inner-row">
                <div class="inner-col">
                  <div class="cell-title">Marks and Numbers</div>
                  <div class="cell-val">${escapeHtml(form.marksAndNumbers || "-")}</div>
                </div>
                <div class="inner-col">
                  <div class="cell-title">Exporting Carrier</div>
                  <div class="cell-val">${escapeHtml(form.carrier || form.shippingLine || "-")}</div>
                </div>
              </div>
            </div>
          </div>

          <div class="row-flex">
            <div class="col-left">
              <div class="cell-title">Notify Party (Intermediate Consignee)</div>
              <div class="cell-val">${escapeHtml(notifyParty)}</div>
            </div>
            <div class="col-right">
              <div class="cell">
                <div class="cell-title">Date of Export</div>
                <div class="cell-val">${formatDate(form.loadingDate || b.bookingDate)}</div>
              </div>
              <div class="cell">
                <div class="cell-title">Terms and Conditions of Delivery and Payment (Incoterms)</div>
                <div class="cell-val">${escapeHtml(form.deliveryTerms || form.paymentTerms || "-")}</div>
              </div>
            </div>
          </div>

          <div class="row-flex">
            <div class="col-left" style="flex: 0.33; text-align: center;">
              <div class="cell-title">Currency of Sale</div>
              <div class="cell-val">${escapeHtml(currency)}</div>
            </div>
            <div class="col-left" style="flex: 0.33; text-align: center;">
              <div class="cell-title">Total Number of Packages</div>
              <div class="cell-val">${formatMoney(totalQuantity)}</div>
            </div>
            <div class="col-left" style="flex: 0.34; border-right: none; text-align: center;">
              <div class="cell-title">Total Gross Weight (kg)</div>
              <div class="cell-val">${formatMoney(totalGrossWeight)}</div>
            </div>
          </div>

          <div class="main-body">
            <table class="table-goods">
              <thead>
                <tr>
                  <th style="width: 40%; text-align: left;">Complete And Accurate Commodity Description,<br/>Country of Manufacture, and HS Code</th>
                  <th style="width: 15%;">Net Weight</th>
                  <th style="width: 15%;">Quantity / Unit</th>
                  <th style="width: 15%;">Unit Price</th>
                  <th style="width: 15%;">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${items.map(item => `
                  <tr>
                    <td style="text-align: left;">
                      <b>${escapeHtml(item.goodsName)}</b><br/>
                      <span style="font-size: 8px; color: #555;">Origin: ${escapeHtml(item.origin)} | HS: ${escapeHtml(item.hsCode)}</span>
                    </td>
                    <td>${formatMoney(item.netWt)} KG</td>
                    <td>${formatMoney(item.quantity)} ${escapeHtml(item.qtyName)}</td>
                    <td>${formatMoney(item.rateKg)}</td>
                    <td>${formatMoney(item.amountUsd)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <div class="footer-grid">
            <div class="footer-left">
              <div>
                <p>These commodities, technology, or software were exported in accordance with the Export Administration Regulations. Diversion contrary to law is prohibited.</p>
                <p style="margin-top: 10px;">It is hereby certified that this invoice shows the actual price of the goods described, that no other invoice has been or will be issued, and that all particulars are true and correct.</p>
              </div>
              <div class="sign-area">
                <div class="sign-line-box">
                  <div class="sign-line"></div>
                  <div class="sign-lbl">Signature and Status of Authorized Person</div>
                </div>
                <div class="sign-line-box">
                  <div class="sign-line"></div>
                  <div class="sign-lbl">Date &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Place</div>
                </div>
              </div>
              <div style="margin-top: 20px; text-align: center; font-size: 10px; font-weight: 700;">Page 1 of 1</div>
            </div>
            <div class="footer-right">
              <div class="cost-row">
                <div class="cost-lbl">Packing Costs</div>
                <div class="cost-val">-</div>
              </div>
              <div class="cost-row">
                <div class="cost-lbl">Freight Costs</div>
                <div class="cost-val">${formatMoney(freightCosts)}</div>
              </div>
              <div class="cost-row">
                <div class="cost-lbl">Other Transportation Costs</div>
                <div class="cost-val">-</div>
              </div>
              <div class="cost-row">
                <div class="cost-lbl">Handling</div>
                <div class="cost-val">${formatMoney(handlingCosts)}</div>
              </div>
              <div class="cost-row">
                <div class="cost-lbl">Insurance Costs</div>
                <div class="cost-val">${formatMoney(insuranceCosts)}</div>
              </div>
              <div class="cost-row">
                <div class="cost-lbl">Assists</div>
                <div class="cost-val">-</div>
              </div>
              <div class="cost-row">
                <div class="cost-lbl">Additional Fees</div>
                <div class="cost-val">${formatMoney(otherCosts)}</div>
              </div>
              <div class="cost-row">
                <div class="cost-lbl">Duties and Taxes</div>
                <div class="cost-val">${formatMoney(dutiesAndTaxes)}</div>
              </div>
              <div class="cost-row total-row">
                <div class="cost-lbl">Total Invoice Value</div>
                <div class="cost-val">${escapeHtml(currency)} ${formatMoney(totalInvoiceValue)}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <script>
      window.onload = function() { window.print(); window.close(); }
    </script>
  </body>
</html>`;

  printStore.openPrint(html, "PROFORMA INVOICE");
}
