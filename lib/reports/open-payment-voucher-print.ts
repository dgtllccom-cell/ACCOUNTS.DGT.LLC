import { escapeHtml, formatMoney, formatDate, type ERPCompanyInfo } from "./erp-report-template-builder";
import { numberToWords } from "@/lib/utils/number-to-words";

export type PaymentVoucherPrintData = {
  id: string;
  refNo: string;
  orderNo?: string;
  contractNo?: string | null;
  manualBillNo?: string | null;
  date: string | null;
  flow: "supplier_payment" | "customer_receipt";
  module?: "purchase" | "sales";
  country: string;
  branch: string;
  party: string;
  paymentKind: string;
  currency: string;
  amount: number;
  exchangeRate?: number;
  baseAmount?: number;
  debitLedgerName?: string;
  creditLedgerName?: string;
  narration?: string;
  superAdminSerial?: string | null;
  countrySerial?: string | null;
  branchSerial?: string | null;
  status: string;
  createdBy: string;
  createdAt?: string | null;
};

export function openPaymentVoucherPrintReport(input: {
  data: PaymentVoucherPrintData;
  companyInfo?: ERPCompanyInfo;
  lang?: string;
}) {
  if (typeof window === "undefined") return;

  const { data: d, companyInfo = {}, lang = "en" } = input;
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);

  const compName = companyInfo.name || "DIGITAL DOCK ERP";
  const compTagline = companyInfo.tagline || "Global Trade & Multi-Currency Financial Management";
  const compAddress = companyInfo.address || "";
  const compPhone = companyInfo.phone || "";
  const compEmail = companyInfo.email || "";
  const compWebsite = companyInfo.website || "";
  const branchName = d.branch && d.branch !== "—" ? d.branch : (companyInfo.branch || "Head Office");
  const countryName = d.country && d.country !== "—" ? d.country : "";
  const createdBy = d.createdBy && d.createdBy !== "—" ? d.createdBy : (companyInfo.printedBy || "Authorized User");

  const contactBits = [
    compAddress ? `📍 ${escapeHtml(compAddress)}` : "",
    countryName ? `🌐 ${escapeHtml(countryName)}` : "",
    compPhone ? `📞 ${escapeHtml(compPhone)}` : "",
    compEmail ? `✉️ ${escapeHtml(compEmail)}` : "",
    compWebsite ? `🌐 ${escapeHtml(compWebsite)}` : "",
  ].filter(Boolean).join(" | ");

  const isSupplier = d.flow === "supplier_payment";
  const voucherTitle = isSupplier ? "SUPPLIER PAYMENT VOUCHER" : "CUSTOMER RECEIPT VOUCHER";
  const voucherSubtitle = isSupplier
    ? "Official Disbursement / Purchase Payment Receipt"
    : "Official Cash & Bank Collection Receipt";

  // Friendly payment kind formatting
  const kindMap: Record<string, string> = {
    advance: "Advance Payment",
    remaining: "Remaining Settlement",
    booking: "Order Booking",
    credit: "Credit Settlement",
    receipt: "Collection / Receipt",
    payment: "Direct Payment",
  };
  const paymentKindFormatted = kindMap[d.paymentKind.toLowerCase()] || d.paymentKind.toUpperCase();

  const amountInWords = numberToWords(d.amount);
  const currencySymbol = d.currency === "USD" ? "$" : d.currency === "AED" ? "AED" : d.currency === "PKR" ? "Rs" : d.currency || "USD";

  function renderVoucherHalf(copyTitle: "OFFICE COPY" | "PARTY COPY") {
    return `
    <div class="voucher-half">
      <!-- Letterhead Header Bar -->
      <div class="lh-header">
        <div class="lh-left">
          <div class="lh-logo">⚓</div>
          <div>
            <div class="lh-company">${escapeHtml(compName)}</div>
            <div class="lh-tagline">${[escapeHtml(compTagline), escapeHtml(branchName)].filter(Boolean).join(" &bull; ")}</div>
            ${contactBits ? `<div class="lh-contact">${contactBits}</div>` : ""}
          </div>
        </div>

        <div class="lh-right">
          <div class="voucher-badge ${isSupplier ? "badge-supplier" : "badge-customer"}">${escapeHtml(voucherTitle)}</div>
          <div class="voucher-sub">${escapeHtml(voucherSubtitle)}</div>
          <div class="copy-badge">${copyTitle}</div>
        </div>
      </div>

      <!-- Voucher Metadata Grid -->
      <div class="meta-grid">
        <div class="meta-item">
          <span class="meta-lbl">Payment / Voucher #:</span>
          <span class="meta-val font-mono font-bold">${escapeHtml(d.refNo || "-")}</span>
        </div>
        <div class="meta-item">
          <span class="meta-lbl">Transaction Date:</span>
          <span class="meta-val font-bold">${d.date ? formatDate(d.date) : "—"}</span>
        </div>
        <div class="meta-item">
          <span class="meta-lbl">Linked Order #:</span>
          <span class="meta-val font-mono">${escapeHtml(d.orderNo || "Direct Transaction")}</span>
        </div>
        <div class="meta-item">
          <span class="meta-lbl">Payment Nature / Kind:</span>
          <span class="meta-val font-bold text-accent">${escapeHtml(paymentKindFormatted)}</span>
        </div>
      </div>

      <!-- Main Body Info -->
      <div class="body-grid">
        <div class="fields-col">
          <div class="field-row">
            <span class="f-lbl">${isSupplier ? "Paid To / Supplier:" : "Received From / Customer:"}</span>
            <span class="f-val font-bold" style="font-size: 11px;">${escapeHtml(d.party || "—")}</span>
          </div>

          ${d.contractNo || d.manualBillNo ? `
          <div class="field-row">
            <span class="f-lbl">Contract / Bill Ref:</span>
            <span class="f-val font-mono">${[d.contractNo ? `Contract: ${escapeHtml(d.contractNo)}` : null, d.manualBillNo ? `Bill No: ${escapeHtml(d.manualBillNo)}` : null].filter(Boolean).join(" | ")}</span>
          </div>` : ""}

          <div class="field-row">
            <span class="f-lbl">Debit Account:</span>
            <span class="f-val font-mono">${escapeHtml(d.debitLedgerName || (isSupplier ? "Supplier Ledger" : "Bank / Cash Account"))}</span>
          </div>

          <div class="field-row">
            <span class="f-lbl">Credit Account:</span>
            <span class="f-val font-mono">${escapeHtml(d.creditLedgerName || (isSupplier ? "Bank / Cash Account" : "Customer Receivables"))}</span>
          </div>

          <div class="field-row">
            <span class="f-lbl">Amount in Words:</span>
            <span class="f-val font-italic" style="color: #047857; font-weight: 700;">"${escapeHtml(amountInWords)} ${escapeHtml(d.currency)} ONLY"</span>
          </div>

          <div class="field-row">
            <span class="f-lbl">Particulars / Narration:</span>
            <span class="f-val">${escapeHtml(d.narration || `${paymentKindFormatted} for ${d.orderNo || d.refNo}`)}</span>
          </div>

          ${(d.superAdminSerial || d.countrySerial || d.branchSerial) ? `
          <div class="field-row serials-row">
            <span class="f-lbl">Audit Serials:</span>
            <span class="f-val font-mono" style="font-size: 8.5px; color: #64748b;">
              ${[
                d.superAdminSerial ? `SA: ${escapeHtml(d.superAdminSerial)}` : null,
                d.countrySerial ? `CT: ${escapeHtml(d.countrySerial)}` : null,
                d.branchSerial ? `BR: ${escapeHtml(d.branchSerial)}` : null,
              ].filter(Boolean).join(" &bull; ")}
            </span>
          </div>` : ""}
        </div>

        <div class="amount-box">
          <div class="amount-lbl">TOTAL VOUCHER AMOUNT</div>
          <div class="amount-val">${formatMoney(d.amount)} <span class="curr-lbl">${escapeHtml(currencySymbol)}</span></div>
          ${d.exchangeRate && d.exchangeRate !== 1 ? `
          <div class="amount-sub">
            Ex. Rate: ${Number(d.exchangeRate).toFixed(4)} | Base: $${formatMoney(d.baseAmount || d.amount)} USD
          </div>` : ""}
          <div class="status-pill status-${(d.status || "posted").toLowerCase()}">${escapeHtml((d.status || "POSTED").toUpperCase())}</div>
        </div>
      </div>

      <!-- Signature Strip Footer -->
      <div class="sign-strip">
        <div class="sign-col">
          <div class="sign-line"></div>
          <div class="sign-lbl">Prepared By: <strong>${escapeHtml(createdBy)}</strong></div>
        </div>
        <div class="sign-col">
          <div class="sign-line"></div>
          <div class="sign-lbl">Verified / Checked By</div>
        </div>
        <div class="sign-col">
          <div class="sign-line"></div>
          <div class="sign-lbl">Authorized Manager</div>
        </div>
        <div class="sign-col">
          <div class="sign-line"></div>
          <div class="sign-lbl">${isSupplier ? "Supplier / Receiver Signature" : "Customer Acknowledgement"}</div>
        </div>
      </div>
    </div>`;
  }

  const html = `<!doctype html>
<html lang="${lang}" dir="${isRtl ? "rtl" : "ltr"}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(voucherTitle)} - ${escapeHtml(d.refNo)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap');

    @page {
      size: A4 portrait;
      margin: 4mm;
    }

    * { box-sizing: border-box; }

    body {
      background: #e2e8f0;
      color: #0f172a;
      font-family: 'Outfit', -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 8.5px;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    /* Screen Toolbar */
    .no-print-toolbar {
      position: sticky;
      top: 0;
      z-index: 100;
      background: #0f172a;
      color: #ffffff;
      padding: 10px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      font-size: 12px;
    }

    .btn-action {
      background: #1e293b;
      color: #ffffff;
      border: 1px solid #334155;
      padding: 6px 14px;
      border-radius: 6px;
      font-weight: 700;
      font-size: 11px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .btn-action:hover { background: #334155; }
    .btn-primary { background: #2563eb; border-color: #2563eb; }
    .btn-primary:hover { background: #1d4ed8; }

    /* Report Sheet Container - EXACT A4 PORTRAIT 210mm x 297mm */
    .wrap {
      padding: 10px;
      display: flex;
      justify-content: center;
    }

    .page {
      background: #ffffff;
      width: 210mm;
      min-height: 297mm;
      padding: 6mm 8mm;
      box-shadow: 0 8px 30px rgba(0,0,0,0.12);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      position: relative;
    }

    /* Two identical halves for A4 split */
    .voucher-half {
      border: 1.5px solid #0f172a;
      border-radius: 6px;
      padding: 8px 12px;
      background: #ffffff;
      height: 48%;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }

    .cut-line {
      height: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      margin: 4px 0;
      color: #64748b;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 2px;
    }
    .cut-line::before {
      content: "";
      position: absolute;
      left: 0;
      right: 0;
      top: 50%;
      border-top: 1.5px dashed #94a3b8;
    }
    .cut-label {
      background: #ffffff;
      padding: 0 10px;
      position: relative;
      z-index: 2;
    }

    /* Letterhead */
    .lh-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 6px;
      margin-bottom: 6px;
    }
    .lh-left {
      display: flex;
      gap: 10px;
      align-items: center;
    }
    .lh-logo {
      width: 38px;
      height: 38px;
      background: linear-gradient(135deg, #0b1f3c, #1e3a8a);
      color: #ffffff;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      font-weight: 900;
      box-shadow: 0 2px 6px rgba(0,0,0,0.15);
    }
    .lh-company {
      font-size: 15px;
      font-weight: 900;
      color: #0b1f3c;
      letter-spacing: -0.5px;
      text-transform: uppercase;
    }
    .lh-tagline {
      font-size: 8.5px;
      font-weight: 600;
      color: #475569;
    }
    .lh-contact {
      font-size: 7.5px;
      color: #64748b;
      margin-top: 2px;
    }
    .lh-right {
      text-align: right;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 2px;
    }
    .voucher-badge {
      background: #0b1f3c;
      color: #ffffff;
      font-size: 10px;
      font-weight: 900;
      letter-spacing: 0.8px;
      padding: 3px 10px;
      border-radius: 4px;
      text-transform: uppercase;
    }
    .badge-supplier { background: #1e1b4b; border-left: 3px solid #6366f1; }
    .badge-customer { background: #064e3b; border-left: 3px solid #10b981; }
    .voucher-sub {
      font-size: 7.5px;
      color: #64748b;
      font-weight: 600;
    }
    .copy-badge {
      font-size: 8px;
      font-weight: 900;
      color: #b91c1c;
      letter-spacing: 1px;
      margin-top: 2px;
    }

    /* Metadata Grid */
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 6px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
      padding: 5px 8px;
      margin-bottom: 6px;
    }
    .meta-item {
      display: flex;
      flex-direction: column;
    }
    .meta-lbl {
      font-size: 7px;
      text-transform: uppercase;
      font-weight: 800;
      color: #64748b;
      letter-spacing: 0.3px;
    }
    .meta-val {
      font-size: 9.5px;
      color: #0f172a;
    }
    .text-accent {
      color: #2563eb;
    }

    /* Body Grid */
    .body-grid {
      display: flex;
      gap: 12px;
      margin-bottom: 6px;
    }
    .fields-col {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 3px;
    }
    .field-row {
      display: flex;
      border-bottom: 1px dotted #cbd5e1;
      padding-bottom: 2px;
    }
    .f-lbl {
      width: 125px;
      font-size: 8px;
      font-weight: 700;
      color: #475569;
      text-transform: uppercase;
      flex-shrink: 0;
    }
    .f-val {
      flex: 1;
      font-size: 9px;
      color: #0f172a;
    }

    /* Amount Box */
    .amount-box {
      width: 180px;
      background: #f1f5f9;
      border: 1.5px solid #cbd5e1;
      border-radius: 6px;
      padding: 8px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
    }
    .amount-lbl {
      font-size: 7.5px;
      font-weight: 800;
      color: #475569;
      letter-spacing: 0.5px;
      margin-bottom: 2px;
    }
    .amount-val {
      font-size: 16px;
      font-weight: 900;
      color: #0b1f3c;
      font-family: monospace;
    }
    .curr-lbl {
      font-size: 11px;
      font-weight: 800;
      color: #2563eb;
    }
    .amount-sub {
      font-size: 7.5px;
      color: #64748b;
      margin-top: 4px;
      font-weight: 600;
    }
    .status-pill {
      margin-top: 6px;
      font-size: 8px;
      font-weight: 900;
      letter-spacing: 0.6px;
      padding: 2px 8px;
      border-radius: 10px;
    }
    .status-posted { background: #dcfce7; color: #15803d; }
    .status-pending { background: #fef9c3; color: #a16207; }
    .status-draft { background: #f1f5f9; color: #475569; }
    .status-cancelled { background: #fee2e2; color: #b91c1c; }

    /* Signatures */
    .sign-strip {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      padding-top: 14px;
      margin-top: 4px;
    }
    .sign-col {
      text-align: center;
    }
    .sign-line {
      border-bottom: 1px solid #94a3b8;
      margin-bottom: 3px;
    }
    .sign-lbl {
      font-size: 7.5px;
      font-weight: 700;
      color: #475569;
      text-transform: uppercase;
    }

    @media print {
      body { background: #ffffff; }
      .no-print-toolbar { display: none !important; }
      .wrap { padding: 0 !important; }
      .page { box-shadow: none !important; padding: 4mm 6mm !important; }
    }
  </style>
</head>
<body>
  <div class="no-print-toolbar">
    <div style="display:flex; align-items:center; gap:8px;">
      <span style="font-size:16px;">⚓</span>
      <strong>${escapeHtml(compName)} — ${escapeHtml(voucherTitle)} (${escapeHtml(d.refNo)})</strong>
    </div>
    <div style="display:flex; gap:8px;">
      <button class="btn-action btn-primary" onclick="window.print()">
        <span>🖨️</span> Print Voucher (A4)
      </button>
      <button class="btn-action" onclick="window.close()">
        <span>✕</span> Close
      </button>
    </div>
  </div>

  <div class="wrap">
    <div class="page">
      ${renderVoucherHalf("OFFICE COPY")}
      <div class="cut-line">
        <span class="cut-label">✂ CUT HERE / علیحدہ کریں</span>
      </div>
      ${renderVoucherHalf("PARTY COPY")}
    </div>
  </div>

  <script>
    window.addEventListener('load', () => {
      // Small timeout for styles to finish rendering before print
      setTimeout(() => {
        try { window.focus(); } catch (e) {}
      }, 250);
    });
  </script>
</body>
</html>`;

  const win = window.open("", "_blank");
  if (!win) {
    alert("Please allow pop-ups to print payment voucher.");
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}
