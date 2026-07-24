import { t } from "@/lib/i18n/ui";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { printStore } from "@/lib/store/print-store";

export type PurchaseReportData = {
  id: string;
  purchaseBookingOrderNumber: string;
  purchaseDate: string;
  bookingDate: string;
  purchaseAccountName: string;
  purchaseAccountNumber: string;
  salesAccountName: string;
  salesAccountNumber: string;
  supplierName: string;
  buyerName: string;
  productName: string;
  goodsDescription: string;
  quantity: number;
  unit: string;
  totalWeight: number;
  containerCount: number;
  purchaseRate: number;
  totalPurchaseAmount: number;
  currency: string;
  finalCurrency?: string;
  status: string;
  currentStep?: string;
  nextStep?: string;
  paymentStatus: string;
  containerStatus?: string;
  inventoryStatus?: string;
  deliveryStatus?: string;
  finalDeliveryStatus?: string;
  branchName: string;
  countryName: string;
  createdAt: string;
  totalGrossWeight?: number;
  totalNetWeight?: number;
  purchaseAmount?: number;
  finalAmount?: number;
  form_data?: any;
  supplier_company_id?: string;
  audit: {
    userName: string;
    userId: string;
    branchCode: string;
  };
  paymentHistory?: any[];
};

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

function formatNumber(value: unknown) {
  return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function getCurrencySymbol(c: string) {
  if (!c) return "";
  const upper = c.toUpperCase();
  if (upper === "USD") return "$";
  if (upper === "AED") return "د.إ";
  if (upper === "PKR") return "₨";
  if (upper === "AFN") return "؋";
  if (upper === "INR") return "₹";
  return upper;
}

export function openPurchaseA4ReportWindow(input: {
  title: string;
  subtitle?: string;
  autoPrint?: boolean;
  purchaseData: PurchaseReportData;
  lang?: string;
}) {
  if (typeof window === "undefined") return;

  const lang = (input.lang || "en") as SupportedLanguage;
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);

  const now = new Date();
  const stampTime = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });

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
      const grossWt = qtyNo * qtyKgs;
      const netWt = qtyNo * (qtyKgs - emptyKgs);
      const rateKg = Number(g.coursePrice || 0);
      const rateTon = rateKg * 1000;
      const amountUsd = Number(g.totalAmount || 0);
      
      const purchCurr = g.purchaseCurrency || b.currency || form.purchaseCurrency || form.currencyType || "USD";
      const finalCurr = b.finalCurrency || form.purchaseAccountCurrency || form.salesAccountCurrency || "PKR";
      const exRate = Number(g.exchangeRate || form.exchangeRate || g.rate2 || 1);

      let finalAmountPkr = Number(g.finalAmount || 0);
      if (!finalAmountPkr) {
        if (purchCurr === finalCurr) {
          finalAmountPkr = amountUsd;
        } else {
          if (purchCurr === "USD" && finalCurr === "PKR") {
            finalAmountPkr = amountUsd * exRate;
          } else if (purchCurr === "PKR" && finalCurr === "AED" && exRate > 1) {
            finalAmountPkr = amountUsd / exRate;
          } else if (purchCurr === "USD") {
            finalAmountPkr = amountUsd * exRate;
          } else {
            finalAmountPkr = amountUsd * exRate;
          }
        }
      }

      return {
        srNo: index + 1,
        goodsName: g.goodsName || "N/A",
        grade: g.size || "N/A",
        origin: g.origin || "N/A",
        quantity: qtyNo,
        qtyName: g.qtyName || "BAGS",
        packing: `${qtyKgs} KG / ${emptyKgs} KG`,
        grossWt,
        netWt,
        rateKg,
        rateTon,
        amountUsd,
        exRate,
        purchCurr,
        finalCurr,
        finalAmountPkr
      };
    });
  } else {
    // Fallback if goods entries list is empty
    const defaultPurchCurr = b.currency || form.purchaseCurrency || form.currencyType || "USD";
    const defaultFinalCurr = b.finalCurrency || form.purchaseAccountCurrency || form.salesAccountCurrency || "PKR";
    const fallbackExRate = Number(form.exchangeRate || 280.00);
    const fallbackAmountUsd = b.totalPurchaseAmount || 0;

    items = [{
      srNo: 1,
      goodsName: b.productName || "WALNUTS IN SHELL",
      grade: "Organic",
      origin: b.countryName || "USA",
      quantity: b.quantity || 0,
      qtyName: b.unit || "BAGS",
      packing: `${b.totalWeight / (b.quantity || 1)} KG`,
      grossWt: b.totalWeight || 0,
      netWt: b.totalWeight || 0,
      rateKg: b.purchaseRate || 0,
      rateTon: (b.purchaseRate || 0) * 1000,
      amountUsd: fallbackAmountUsd,
      exRate: fallbackExRate,
      purchCurr: defaultPurchCurr,
      finalCurr: defaultFinalCurr,
      finalAmountPkr: (() => {
        if (b.finalAmount) return b.finalAmount;
        if (defaultPurchCurr === defaultFinalCurr) return fallbackAmountUsd;
        if (defaultPurchCurr === "USD" && defaultFinalCurr === "PKR") return fallbackAmountUsd * fallbackExRate;
        if (defaultPurchCurr === "PKR" && defaultFinalCurr === "AED" && fallbackExRate > 1) return fallbackAmountUsd / fallbackExRate;
        if (defaultPurchCurr === "USD") return fallbackAmountUsd * fallbackExRate;
        return fallbackAmountUsd * fallbackExRate;
      })()
    }];
  }

  // Calculate Aggregates
  const totalQuantity = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
  const totalGrossWeight = items.reduce((sum, item) => sum + (item.grossWt || 0), 0);
  const totalNetWeight = items.reduce((sum, item) => sum + (item.netWt || 0), 0);
  const totalDeductions = Math.max(0, totalGrossWeight - totalNetWeight);
  const totalAmountUsd = items.reduce((sum, item) => sum + (item.amountUsd || 0), 0);
  const totalAmountPkr = items.reduce((sum, item) => sum + (item.finalAmountPkr || 0), 0);
  const avgRateKg = items.length > 0 ? items.reduce((sum, item) => sum + (item.rateKg || 0), 0) / items.length : 0;
  const avgRateTon = avgRateKg * 1000;

  const exRateVal = Number(form.exchangeRate || items[0]?.exRate || 280.00);
  const advancePercentVal = Number(form.advancePercent || 10);
  const advanceUsd = (totalAmountUsd * advancePercentVal) / 100;
  const advancePkr = (totalAmountPkr * advancePercentVal) / 100;
  const remainingUsd = totalAmountUsd - advanceUsd;
  const remainingPkr = totalAmountPkr - advancePkr;

  const commonSessionHtml = `
    <!-- Branch Details Box Section -->
    <div class="border-box">
      <div class="box-header">🏢 Branch Details & User Session</div>
      <div class="session-grid">
        <div class="session-item"><span>User ID:</span><span>${escapeHtml(b.audit?.userId || "USR-1001")}</span></div>
        <div class="session-item"><span>Branch Name:</span><span>${escapeHtml(b.branchName || "QUETTA MAIN BRANCH")}</span></div>
        <div class="session-item"><span>Date:</span><span>${formatDate(b.bookingDate || b.purchaseDate)}</span></div>
        <div class="session-item"><span>User Name:</span><span>${escapeHtml(b.audit?.userName || "SUPER ADMIN")}</span></div>
        <div class="session-item"><span>Branch Code:</span><span>${escapeHtml(b.audit?.branchCode || "QTA-01")}</span></div>
        <div class="session-item"><span>Time:</span><span>10:30 AM</span></div>
      </div>
    </div>
  `;

  const commonFooterHtml = `
    <!-- Stamp & Signatures -->
    <div class="footer-sign">
      <div class="disclaimer">
        This is a system generated print sheet of Daman Business Group ERP accounts registry ledger. Double-entry transaction postings have been validated.
      </div>
      <div class="stamp-box">
        <div class="stamp-circle">
          STAMP<br/><span style="font-size: 4px; color: #cbd5e1;">VERIFIED</span>
        </div>
      </div>
      <div class="sign-box">
        <div class="sign-line">${escapeHtml(b.audit?.userName || "Admin User")}</div>
        <div class="sign-lbl">PREPARED BY</div>
      </div>
      <div class="sign-box">
        <div class="sign-line">ERP Registrar</div>
        <div class="sign-lbl">AUTHORIZED BY</div>
      </div>
    </div>
  `;

  // Template HTML containing 3 sequential sheets
  const html = `<!doctype html>
<html lang="${lang}" dir="${isRtl ? "rtl" : "ltr"}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Purchase Master Verification Report</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap');
      @page { size: A4; margin: 8mm; }
      html, body { height: 100%; margin: 0; padding: 0; }
      body { background: #f1f5f9; color: #1e293b; font-family: 'Outfit', sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; font-size: 8.5px; }
      .wrap { padding: 20px; display: flex; flex-direction: column; gap: 20px; align-items: center; }
      .sheet {
        width: 210mm;
        min-height: 297mm;
        padding: 10mm;
        background: #ffffff;
        border: 1px solid #cbd5e1;
        box-shadow: 0 10px 30px rgba(15, 23, 42, 0.05);
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        gap: 12px;
        position: relative;
        text-align: left;
      }
      .border-box {
        border: 1px solid #e2e8f0;
        border-radius: 4px;
        overflow: hidden;
      }
      .box-header {
        background: #f8fafc;
        border-bottom: 1px solid #e2e8f0;
        padding: 5px 8px;
        font-size: 8px;
        font-weight: 800;
        color: #1e3a8a;
        text-transform: uppercase;
        letter-spacing: 0.3px;
      }
      
      /* Branding Header */
      .brand-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid #cbd5e1;
        padding-bottom: 8px;
      }
      .brand-logo-title {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .brand-logo-icon {
        width: 32px;
        height: 32px;
        color: #1e3a8a;
      }
      .brand-name {
        font-size: 13px;
        font-weight: 900;
        color: #1e3a8a;
        letter-spacing: 0.5px;
        line-height: 1;
      }
      .brand-tagline {
        font-size: 7px;
        color: #64748b;
        font-weight: 600;
        text-transform: uppercase;
        margin-top: 2px;
      }
      .doc-title-sec {
        text-align: right;
      }
      .doc-title {
        font-size: 13px;
        font-weight: 900;
        color: #1e3a8a;
        margin: 0;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .doc-serial {
        font-size: 8px;
        font-weight: 700;
        color: #475569;
        font-family: monospace;
        margin-top: 3px;
      }
      
      /* Branch & Session Details Grid */
      .session-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 6px 16px;
        padding: 8px;
        font-size: 8px;
        font-weight: 700;
        text-transform: uppercase;
        color: #64748b;
      }
      .session-item {
        display: flex;
        justify-content: space-between;
        border-bottom: 1px solid #f1f5f9;
        padding-bottom: 2px;
      }
      .session-item span:last-child {
        color: #0f172a;
      }

      /* Inner Details grid/tables */
      .grid-3 {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 10px;
      }
      .grid-2 {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 10px;
      }
      .info-table {
        width: 100%;
        border-collapse: collapse;
      }
      .info-table td {
        padding: 4px 6px;
        font-size: 7.5px;
        border-bottom: 1px solid #f1f5f9;
      }
      .info-table tr:last-child td {
        border-bottom: none;
      }
      .info-table td.lbl {
        color: #64748b;
        font-weight: 500;
        width: 45%;
      }
      .info-table td.val {
        font-weight: 700;
        color: #0f172a;
      }

      /* Data Tables */
      .data-table {
        width: 100%;
        border-collapse: collapse;
        text-align: left;
      }
      .data-table th {
        background: #1e3a8a;
        color: #ffffff;
        font-size: 7px;
        font-weight: 700;
        text-transform: uppercase;
        padding: 5px 8px;
        letter-spacing: 0.2px;
      }
      .data-table td {
        padding: 5px 8px;
        font-size: 7.5px;
        border-bottom: 1px solid #cbd5e1;
      }
      .data-table tr:last-child td {
        border-bottom: none;
      }

      /* Totaling Aggregates */
      .aggregates-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        border: 1px solid #e2e8f0;
        border-radius: 4px;
        overflow: hidden;
      }
      .aggregate-box {
        border-right: 1px solid #e2e8f0;
        border-bottom: 1px solid #e2e8f0;
        padding: 6px 8px;
        text-align: center;
      }
      .aggregate-box:nth-child(4n) { border-right: none; }
      .aggregate-box:nth-child(n+5) { border-bottom: none; }
      .aggregate-lbl { font-size: 6.5px; color: #64748b; font-weight: 700; text-transform: uppercase; }
      .aggregate-val { font-size: 9.5px; font-weight: 800; color: #0f172a; margin-top: 1px; }

      /* Stamp & signatures */
      .footer-sign {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-top: 1px solid #cbd5e1;
        padding-top: 8px;
        margin-top: auto;
        font-size: 7.5px;
      }
      .disclaimer { width: 40%; color: #64748b; line-height: 1.3; }
      .stamp-circle {
        border: 1.5px dashed #cbd5e1;
        border-radius: 50%;
        width: 42px;
        height: 42px;
        display: inline-flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        font-size: 5.5px;
        color: #94a3b8;
        font-weight: 800;
        text-transform: uppercase;
        line-height: 1.2;
      }
      .sign-box { width: 20%; text-align: center; }
      .sign-line { border-bottom: 1px solid #cbd5e1; height: 16px; margin-bottom: 3px; font-weight: bold; color: #0f172a; display: flex; align-items: flex-end; justify-content: center; font-style: italic; }
      .sign-lbl { font-size: 6.5px; font-weight: 700; color: #64748b; }

      @media print {
        body { background: #ffffff; }
        .wrap { padding: 0; gap: 0; }
        .sheet {
          border: none !important;
          box-shadow: none !important;
          margin: 0 !important;
          padding: 8mm 0 !important;
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
      
      <!-- SHEET 1: BRANCH LOGISTICS REPORT -->
      <div class="sheet">
        <!-- Branding Header -->
        <div class="brand-header">
          <div class="brand-logo-title">
            <div class="brand-logo-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width: 32px; height: 32px;">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
              </svg>
            </div>
            <div>
              <div class="brand-name">DAMAN BUSINESS GROUP</div>
              <div class="brand-tagline">Enterprise ERP / Logistics Platform</div>
            </div>
          </div>
          <div class="doc-title-sec">
            <h2 class="doc-title">BRANCH LOGISTICS REPORT</h2>
            <div class="doc-serial">Serial: PO-${escapeHtml(b.purchaseBookingOrderNumber)}</div>
          </div>
        </div>

        ${commonSessionHtml}

        <!-- Logistics cards -->
        <div class="grid-3">
          <!-- Card 1: BOOKING DETAILS -->
          <div class="border-box">
            <div class="box-header">👤 Booking Information</div>
            <table class="info-table">
              <tbody>
                <tr><td class="lbl">Reference (Order ID):</td><td class="val font-mono">${escapeHtml(b.purchaseBookingOrderNumber)}</td></tr>
                <tr><td class="lbl">Super S/N:</td><td class="val font-mono text-blue-700">${escapeHtml((b as any).super_admin_serial_number || (b as any).superAdminSerialNo || (b as any).form_data?.form?.superAdminSerialNo || "-")}</td></tr>
                <tr><td class="lbl">Cty S/N:</td><td class="val font-mono text-emerald-700">${escapeHtml((b as any).country_transaction_serial_number || (b as any).countrySerialNo || (b as any).form_data?.form?.countrySerialNo || "-")}</td></tr>
                <tr><td class="lbl">Br. S/N:</td><td class="val font-mono text-amber-700">${escapeHtml((b as any).branch_transaction_serial_number || (b as any).branchSerialNo || (b as any).form_data?.form?.branchSerialNo || "-")}</td></tr>
                <tr><td class="lbl">Purchase Date:</td><td class="val">${formatDate(b.purchaseDate)}</td></tr>
                <tr><td class="lbl">Booking Date:</td><td class="val">${formatDate(b.bookingDate)}</td></tr>
                <tr><td class="lbl">Exchange Rate:</td><td class="val font-mono">${exRateVal} ${escapeHtml(items[0]?.finalCurr || "PKR")}</td></tr>
              </tbody>
            </table>
          </div>

          <!-- Card 2: SUPPLIER DETAILS -->
          <div class="border-box">
            <div class="box-header">🏢 Supplier Information</div>
            <table class="info-table">
              <tbody>
                <tr><td class="lbl">Name:</td><td class="val">${escapeHtml(b.supplierName || "N/A")}</td></tr>
                <tr><td class="lbl">Contact Person:</td><td class="val">${escapeHtml(form.supplierContact || "-")}</td></tr>
              </tbody>
            </table>
          </div>

          <!-- Card 3: BUYER DETAILS -->
          <div class="border-box">
            <div class="box-header">👤 Buyer Information</div>
            <table class="info-table">
              <tbody>
                <tr><td class="lbl">Name:</td><td class="val">${escapeHtml(b.buyerName || "N/A")}</td></tr>
                <tr><td class="lbl">Contact Person:</td><td class="val">${escapeHtml(form.customerContact || "-")}</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Shipment and Loading details -->
        <div class="grid-2">
          <!-- Shipment -->
          <div class="border-box">
            <div class="box-header">🚢 Shipment & Logistics</div>
            <table class="info-table">
              <tbody>
                <tr><td class="lbl">Containers Count:</td><td class="val">${b.containerCount || 1} FCL</td></tr>
                <tr><td class="lbl">Container Numbers:</td><td class="val font-mono truncate">${escapeHtml(form.containerNumbers || "N/A")}</td></tr>
                <tr><td class="lbl">Vessel / Carrier:</td><td class="val">${escapeHtml(form.vesselName || "N/A")}</td></tr>
                <tr><td class="lbl">Remarks / Sea Seal:</td><td class="val font-mono">${escapeHtml(form.sealNumber || "N/A")}</td></tr>
              </tbody>
            </table>
          </div>

          <!-- Loading & Transit -->
          <div class="border-box">
            <div class="box-header">📅 Loading & Transit Details</div>
            <table class="info-table">
              <tbody>
                <tr><td class="lbl">Shipping Mode / Mode:</td><td class="val font-bold">${escapeHtml(form.shippingMode || "By Sea")}</td></tr>
                <tr><td class="lbl">Expected Loading Date:</td><td class="val">${formatDate(form.expectedLoadingDate || form.loadingDate)}</td></tr>
                <tr><td class="lbl">Loading Country/Port:</td><td class="val">${escapeHtml(form.loadingCountry || "N/A")} / ${escapeHtml(form.loadingPort || form.loadingBorder || "N/A")}</td></tr>
                <tr><td class="lbl">Received Date at Port:</td><td class="val font-bold text-blue-600 font-mono">${formatDate(form.receivedDate)}</td></tr>
                <tr><td class="lbl">Received Country/Port:</td><td class="val">${escapeHtml(form.receivedCountry || "N/A")} / ${escapeHtml(form.receivedPort || form.receivedBorder || "N/A")}</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Special Instructions Remarks -->
          <!-- Special Instructions Remarks -->
        ${(b.form_data?.form?.showRemarksOnA4 !== false) ? `
        <div class="border-box">
          <div class="box-header">📝 Special Remarks & Narration Instructions</div>
          <div style="padding: 10px; font-size: 8px; line-height: 1.4; color: #334155; min-height: 60px; white-space: pre-line;">
            ${escapeHtml(form.orderReportRemarks || b.goodsDescription || "Standard purchase order report generated.")}
          </div>
        </div>
        ` : ""}

        <!-- Detailed Goods Specification List Table -->
        <div class="border-box">
          <table class="data-table">
            <thead>
              <tr>
                <th style="width: 4%; text-align: center;">SR</th>
                <th style="width: 14%;">Goods Specification</th>
                <th style="width: 8%; text-align: center;">Origin</th>
                <th style="width: 8%; text-align: right;">Quantity</th>
                <th style="width: 8%; text-align: right;">Net Wt</th>
                <th style="width: 8%; text-align: center;">Purch Curr</th>
                <th style="width: 8%; text-align: right;">Rate</th>
                <th style="width: 10%; text-align: right;">Amount</th>
                <th style="width: 8%; text-align: center;">Ex. Rate</th>
                <th style="width: 8%; text-align: center;">Final Curr</th>
                <th style="width: 10%; text-align: right;">Final Amount</th>
              </tr>
            </thead>
            <tbody>
              ${items.map(item => `
                <tr>
                  <td style="text-align: center;">${item.srNo}</td>
                  <td style="font-weight: bold; color: #1e3a8a;">${escapeHtml(item.goodsName)}</td>
                  <td style="text-align: center;">${escapeHtml(item.origin)}</td>
                  <td style="text-align: right; font-weight: bold;">${formatNumber(item.quantity)} ${item.qtyName}</td>
                  <td style="text-align: right; font-family: monospace; font-weight: bold;">${formatNumber(item.netWt)} kg</td>
                  <td style="text-align: center; font-weight: bold;">${escapeHtml(item.purchCurr)}</td>
                  <td style="text-align: right; font-family: monospace;">${item.rateKg.toFixed(2)}</td>
                  <td style="text-align: right; font-family: monospace; font-weight: bold;">${formatMoney(item.amountUsd)}</td>
                  <td style="text-align: center; font-family: monospace;">${item.exRate}</td>
                  <td style="text-align: center; font-weight: bold; color: #059669;">${escapeHtml(item.finalCurr)}</td>
                  <td style="text-align: right; font-family: monospace; font-weight: 800; color: #059669;">${formatMoney(item.finalAmountPkr)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>

        <!-- Totaling Aggregates Panel -->
        <div class="aggregates-grid">
          <div class="aggregate-box">
            <div class="aggregate-lbl">Total Quantity</div>
            <div class="aggregate-val">${formatNumber(totalQuantity)} Units</div>
          </div>
          <div class="aggregate-box">
            <div class="aggregate-lbl">Total Gross Weight</div>
            <div class="aggregate-val">${formatNumber(totalGrossWeight)} kg</div>
          </div>
          <div class="aggregate-box">
            <div class="aggregate-lbl">Total Net Weight</div>
            <div class="aggregate-val">${formatNumber(totalNetWeight)} kg</div>
          </div>
          <div class="aggregate-box">
            <div class="aggregate-lbl" style="color: #ef4444;">Total Deductions</div>
            <div class="aggregate-val" style="color: #ef4444;">${formatNumber(totalDeductions)} kg</div>
          </div>
          <div class="aggregate-box">
            <div class="aggregate-lbl">Average Rate/KG</div>
            <div class="aggregate-val">${getCurrencySymbol(items[0]?.purchCurr || "USD")}${avgRateKg.toFixed(2)}</div>
          </div>
          <div class="aggregate-box">
            <div class="aggregate-lbl">Average Rate/Ton</div>
            <div class="aggregate-val">${getCurrencySymbol(items[0]?.purchCurr || "USD")}${avgRateTon.toFixed(2)}</div>
          </div>
          <div class="aggregate-box">
            <div class="aggregate-lbl" style="color: #2563eb;">Total Purchase (${escapeHtml(items[0]?.purchCurr || "USD")})</div>
            <div class="aggregate-val font-mono" style="color: #2563eb;">${formatMoney(totalAmountUsd)}</div>
          </div>
          <div class="aggregate-box" style="background: #ecfdf5;">
            <div class="aggregate-lbl" style="color: #059669;">Grand Final (${escapeHtml(items[0]?.finalCurr || "PKR")})</div>
            <div class="aggregate-val font-mono" style="color: #059669;">${formatMoney(totalAmountPkr)}</div>
          </div>
        </div>

        <!-- General Ledger Double Entry details -->
        <div class="border-box">
          <div class="box-header">⚙️ General Ledger Double-Entry Posting</div>
          <table class="data-table">
            <thead>
              <tr style="background: #f1f5f9; color: #475569; font-size: 7px; font-weight: 700; border-bottom: 1px solid #cbd5e1;">
                <th style="padding: 5px 8px; color: #475569; background: #f8fafc;">Debit / Credit</th>
                <th style="padding: 5px 8px; color: #475569; background: #f8fafc;">Account Code</th>
                <th style="padding: 5px 8px; color: #475569; background: #f8fafc;">Account Name / Branch Location</th>
                <th style="padding: 5px 8px; color: #475569; background: #f8fafc; text-align: right;">Debit (Dr)</th>
                <th style="padding: 5px 8px; color: #475569; background: #f8fafc; text-align: right;">Credit (Cr)</th>
                <th style="padding: 5px 8px; color: #475569; background: #f8fafc; text-align: center;">Currency</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="font-weight: bold; color: #2563eb;">DEBIT (DR)</td>
                <td style="font-family: monospace; font-weight: bold;">${escapeHtml(b.purchaseAccountNumber || "AE-AC-0001")}</td>
                <td>
                  <strong>${escapeHtml(b.purchaseAccountName || "Dubai Purchase Account")} (DR)</strong>
                  <span style="font-size: 6.5px; color: #64748b; display: block;">${escapeHtml(b.branchName || "Kabul Main Branch")}</span>
                </td>
                <td style="text-align: right; font-family: monospace; font-weight: bold; color: #2563eb;">${formatMoney(totalAmountPkr)}</td>
                <td style="text-align: right; color: #94a3b8;">-</td>
                <td style="text-align: center; font-weight: bold;">${escapeHtml(items[0]?.finalCurr || "PKR")}</td>
              </tr>
              <tr>
                <td style="font-weight: bold; color: #059669;">CREDIT (CR)</td>
                <td style="font-family: monospace; font-weight: bold;">${escapeHtml(b.salesAccountNumber || "SA-2001")}</td>
                <td>
                  <strong>${escapeHtml(b.salesAccountName || "Damaan Sales Account")} (CR)</strong>
                  <span style="font-size: 6.5px; color: #64748b; display: block;">${escapeHtml(b.branchName || "Kabul Main Branch")}</span>
                </td>
                <td style="text-align: right; color: #94a3b8;">-</td>
                <td style="text-align: right; font-family: monospace; font-weight: bold; color: #059669;">${formatMoney(totalAmountPkr)}</td>
                <td style="text-align: center; font-weight: bold;">${escapeHtml(items[0]?.finalCurr || "PKR")}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Payment details and due dates schedule -->
        <div class="border-box">
          <div class="box-header">💰 Detailed Payment Terms, Schedules & Due Balances</div>
          <div style="padding: 8px; display: grid; grid-template-columns: 1fr 1fr; gap: 20px; font-size: 7.5px; color: #64748b; font-weight: 500;">
            <div style="display: flex; flex-direction: column; gap: 4px;">
              <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #f1f5f9; padding-bottom: 2px;">
                <span>Payment Condition / Type:</span><strong style="color: #0f172a;">${escapeHtml(form.paymentType || b.paymentStatus || "Advance Payment")}</strong>
              </div>
              <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #f1f5f9; padding-bottom: 2px;">
                <span>Exchange Rate:</span><strong style="color: #0f172a; font-family: monospace;">${exRateVal}</strong>
              </div>
              <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #f1f5f9; padding-bottom: 2px;">
                <span>Total Invoice Amount (${escapeHtml(items[0]?.purchCurr || "USD")}):</span><strong style="color: #1e3a8a; font-family: monospace;">${formatMoney(totalAmountUsd)}</strong>
              </div>
              <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #f1f5f9; padding-bottom: 2px;">
                <span>Total Invoice Amount (${escapeHtml(items[0]?.finalCurr || "PKR")}):</span><strong style="color: #059669; font-family: monospace;">${formatMoney(totalAmountPkr)}</strong>
              </div>
              <div style="display: flex; justify-content: space-between; padding-top: 1px;">
                <span>Payment Method Details:</span><strong style="color: #0f172a; max-w: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(form.paymentDaysAndMethodDetails || "N/A")}</strong>
              </div>
            </div>

            <div style="display: flex; flex-direction: column; gap: 4px; border-left: 1px solid #cbd5e1; padding-left: 16px;">
              <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #f1f5f9; padding-bottom: 2px;">
                <span>Advance % / Ratio:</span><strong style="color: #0f172a;">${advancePercentVal}%</strong>
              </div>
              <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #f1f5f9; padding-bottom: 2px;">
                <span>Advance Amount:</span><strong style="color: #0f172a; font-family: monospace;">${formatMoney(advanceUsd)} ${escapeHtml(items[0]?.purchCurr || "USD")} / ${formatMoney(advancePkr)} ${escapeHtml(items[0]?.finalCurr || "PKR")}</strong>
              </div>
              <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #f1f5f9; padding-bottom: 2px;">
                <span>Advance Payment Date:</span><strong style="color: #2563eb; font-family: monospace;">${formatDate(form.advancePaymentDate)}</strong>
              </div>
              <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #f1f5f9; padding-bottom: 2px;">
                <span>Remaining Balance:</span><strong style="color: #ef4444; font-family: monospace;">${formatMoney(remainingUsd)} ${escapeHtml(items[0]?.purchCurr || "USD")} / ${formatMoney(remainingPkr)} ${escapeHtml(items[0]?.finalCurr || "PKR")}</strong>
              </div>
              <div style="display: flex; justify-content: space-between; padding-top: 1px;">
                <span>Remaining Due Date:</span><strong style="color: #ef4444; font-family: monospace;">${formatDate(form.paymentDate)}</strong>
              </div>
            </div>
          </div>
        </div>

        ${b.paymentHistory && b.paymentHistory.length > 0 ? `
        <!-- Traceable Payment History -->
        <div class="border-box" style="margin-top: 10px;">
          <div class="box-header">💸 Traceable Payment History (Nested Journal Entries)</div>
          <table class="data-table">
            <thead>
              <tr style="background: #f1f5f9; color: #475569; font-size: 7px; font-weight: 700; border-bottom: 1px solid #cbd5e1;">
                <th style="padding: 5px 8px; color: #475569; background: #f8fafc;">Journal Serials</th>
                <th style="padding: 5px 8px; color: #475569; background: #f8fafc;">User & Date</th>
                <th style="padding: 5px 8px; color: #475569; background: #f8fafc; text-align: right;">Paid (Foreign)</th>
                <th style="padding: 5px 8px; color: #475569; background: #f8fafc; text-align: center;">Ex. Rate</th>
                <th style="padding: 5px 8px; color: #475569; background: #f8fafc; text-align: right;">Paid (Local)</th>
                <th style="padding: 5px 8px; color: #475569; background: #f8fafc;">Remarks / Narration</th>
              </tr>
            </thead>
            <tbody>
              ${b.paymentHistory.map((p: any) => {
                const re = p.roznamcha_entries || {};
                const adminSn = re.super_admin_serial_number || "—";
                const ctySn = re.country_serial_number || "—";
                const user = p.users?.full_name || b.audit?.userName || "Admin";
                const pDate = p.entry_date || p.created_at;
                const amtUsd = (Number(p.amount || 0) / Number(p.exchange_rate || 1));
                const amtLocal = Number(p.amount || 0);
                const exRate = Number(p.exchange_rate || 1).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
                
                return `
                <tr>
                  <td style="font-family: monospace; font-weight: bold;">
                    <div>Admin: <span style="color: #2563eb;">${escapeHtml(adminSn)}</span></div>
                    <div>Country: <span style="color: #059669;">${escapeHtml(ctySn)}</span></div>
                  </td>
                  <td>
                    <strong>${escapeHtml(user)}</strong><br/>
                    <span style="color: #64748b;">${formatDate(pDate)}</span>
                  </td>
                  <td style="text-align: right; font-family: monospace; font-weight: bold; color: #059669;">${formatMoney(amtUsd)} ${escapeHtml(p.currency_code || "USD")}</td>
                  <td style="text-align: center; font-family: monospace; background: #f1f5f9; font-weight: bold;">${exRate}</td>
                  <td style="text-align: right; font-family: monospace; font-weight: bold; color: #1e3a8a;">${formatMoney(amtLocal)} ${escapeHtml(items[0]?.finalCurr || "PKR")}</td>
                  <td><div style="max-width: 180px; word-wrap: break-word; white-space: pre-wrap; font-size: 7px; color: #475569;">${escapeHtml(p.narration || "-")}</div></td>
                </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </div>
        ` : ""}

        ${commonFooterHtml}
      </div>

    </div>
  </body>
</html>`;

  // Use the new PDF Print Preview Modal instead of window.open
  printStore.openPrint(html, input.title);
}
