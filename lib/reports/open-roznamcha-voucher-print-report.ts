import { escapeHtml, formatMoney, formatDate, type ERPCompanyInfo } from "./erp-report-template-builder";
import { numberToWords } from "@/lib/utils/number-to-words";

export type RoznamchaVoucherData = {
  receiptNo: string;
  voucherNo?: string;
  date: string;
  accountNo: string;
  accountName: string;
  paidBy?: string;
  amount: number;
  currency: string;
  narration: string;
  mobileNumber?: string;
  type: "payment" | "receipt" | "expenses" | "exchange";
  branchName?: string;
  countryName?: string;
  createdByName?: string;
  // 2026-11 additions (cheque / bank / DR+CR / party ID): shown only when present on the Roznamcha entry.
  // Nothing is fabricated - a missing field is omitted entirely from the printed page.
  chequeNo?: string | null;
  chequeDate?: string | null;
  bankName?: string | null;
  bankBranchName?: string | null;
  referenceNo?: string | null;
  /** DR / CR accounting legs for this entry (double-entry display, read-only, derived directly from the entry's own `roznamcha_lines`).
   *  The entry's own split pattern (1 DR → many CR, 1 CR → many DR, or a flat journal with many of each) is preserved verbatim.
   *  Legacy single-leg fields are kept for compatibility with existing callers. */
  drAccountCode?: string | null;
  drAccountName?: string | null;
  crAccountCode?: string | null;
  crAccountName?: string | null;
  /** full DR / CR line list from the entry (preferred - carries the entry's own split pattern). */
  drLines?: Array<{ code?: string | null; name?: string | null; amount: number; narration?: string | null }>;
  crLines?: Array<{ code?: string | null; name?: string | null; amount: number; narration?: string | null }>;
  /** Party (payer / payee) ID fields - only shown when authorized (caller already resolved authorization). */
  partyIdLabel?: string | null;
  partyIdNumber?: string | null;
  partyIdImageUrl?: string | null;
  /** issued / received marker shown next to the cheque status badge */
  chequeStatus?: "issued" | "received" | "cleared" | "pending" | null;
};

/**
 * Pure builder: the complete A4 voucher document as an HTML string. No window access, so it is unit-testable.
 * The on-screen / print behaviour lives in openRoznamchaVoucherPrintReport below.
 */
export function buildRoznamchaVoucherHtml(input: {
  data: RoznamchaVoucherData;
  companyInfo?: ERPCompanyInfo;
  lang?: string;
}): string {
  const { data: d, companyInfo = {}, lang = "en" } = input;
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);

  const compName = companyInfo.name || "DIGITAL DOCK ERP";
  const compTagline = companyInfo.tagline || "";
  const compAddress = companyInfo.address || "";
  const compPhone = companyInfo.phone || "";
  const compEmail = companyInfo.email || "";
  const compWebsite = companyInfo.website || "";
  const branchName = d.branchName || companyInfo.branch || "";
  const createdBy = d.createdByName || companyInfo.printedBy || "";
  const contactBits = [
    compAddress ? `📍 ${escapeHtml(compAddress)}` : "",
    compPhone ? `📞 ${escapeHtml(compPhone)}` : "",
    compEmail ? `✉️ ${escapeHtml(compEmail)}` : "",
    compWebsite ? `🌐 ${escapeHtml(compWebsite)}` : "",
  ].filter(Boolean).join(" | ");

  const amountInWords = numberToWords(d.amount);
  const voucherTitle = d.type === "payment" ? "CASH PAYMENT VOUCHER" : d.type === "expenses" ? "EXPENSE PAYMENT VOUCHER" : d.type === "exchange" ? "MONEY EXCHANGE VOUCHER" : "CASH RECEIPT VOUCHER";
  const currencySymbol = d.currency === "USD" ? "$" : d.currency === "AED" ? "AED" : d.currency === "PKR" ? "Rs" : d.currency || "AED";

  function renderReceiptHalf(copyTitle: "OFFICE COPY" | "CUSTOMER COPY") {
    return `
    <div class="voucher-half">
      <!-- Letterhead Header Bar -->
      <div class="lh-header">
        <div class="lh-left">
          <div class="lh-logo">⚓</div>
          <div>
            <div class="lh-company">${escapeHtml(compName)}</div>
            ${(compTagline || branchName) ? `<div class="lh-tagline">${[escapeHtml(compTagline), escapeHtml(branchName)].filter(Boolean).join(" &bull; ")}</div>` : ""}
            ${contactBits ? `<div class="lh-contact">${contactBits}</div>` : ""}
          </div>
        </div>

        <div class="lh-right">
          <div class="voucher-badge">${escapeHtml(voucherTitle)}</div>
          <div class="copy-badge">${copyTitle}</div>
        </div>
      </div>

      <!-- Voucher Metadata Grid -->
      <div class="meta-grid">
        <div class="meta-item">
          <span class="meta-lbl">Voucher / Receipt #:</span>
          <span class="meta-val font-mono">${escapeHtml(d.receiptNo || d.voucherNo || "-")}</span>
        </div>
        <div class="meta-item">
          <span class="meta-lbl">Date & Time:</span>
          <span class="meta-val">${formatDate(d.date)}</span>
        </div>
        <div class="meta-item">
          <span class="meta-lbl">Account Code:</span>
          <span class="meta-val font-mono">${escapeHtml(d.accountNo || "-")}</span>
        </div>
        <div class="meta-item">
          <span class="meta-lbl">Account Title:</span>
          <span class="meta-val">${escapeHtml(d.accountName || "Cash Account")}</span>
        </div>
      </div>

      ${d.chequeNo || d.bankName ? `
      <!-- Cheque / Bank block (shown only when the entry carries cheque / bank data) -->
      <div class="cheque-block">
        <div class="cheque-header">${d.chequeStatus === "issued" || d.type === "payment" || d.type === "expenses" ? "CHEQUE PAYMENT" : "CHEQUE RECEIPT"}</div>
        <div class="cheque-grid">
          ${d.chequeNo ? `<div class="cq-item"><span class="cq-lbl">Cheque No.</span><span class="cq-val font-mono">${escapeHtml(d.chequeNo)}</span></div>` : ""}
          ${d.chequeDate ? `<div class="cq-item"><span class="cq-lbl">Cheque Date</span><span class="cq-val">${formatDate(d.chequeDate)}</span></div>` : ""}
          ${d.bankName ? `<div class="cq-item"><span class="cq-lbl">Bank Name</span><span class="cq-val">${escapeHtml(d.bankName)}</span></div>` : ""}
          ${d.bankBranchName ? `<div class="cq-item"><span class="cq-lbl">Branch</span><span class="cq-val">${escapeHtml(d.bankBranchName)}</span></div>` : ""}
          ${d.chequeStatus ? `<div class="cq-item"><span class="cq-lbl">Status</span><span class="cq-val cq-status cq-${escapeHtml(d.chequeStatus)}">${escapeHtml(d.chequeStatus.toUpperCase())}</span></div>` : ""}
          ${d.referenceNo ? `<div class="cq-item"><span class="cq-lbl">Reference</span><span class="cq-val font-mono">${escapeHtml(d.referenceNo)}</span></div>` : ""}
        </div>
      </div>
      ` : ""}

      ${(d.drLines?.length || d.crLines?.length || d.drAccountCode || d.drAccountName || d.crAccountCode || d.crAccountName) ? `
      <!-- Accounting / Account Details (DR / CR legs read-only, preserves the entry's own split pattern:
           1 DR vs many CR, 1 CR vs many DR, or a flat journal with many of each) -->
      <div class="accounting-block">
        <div class="acct-header">Accounting / Account Details</div>
        <div class="acct-grid">
          <div class="acct-col acct-dr">
            <div class="acct-badge">DR</div>
            <div class="acct-rows">
              ${(d.drLines && d.drLines.length ? d.drLines : [{ code: d.drAccountCode, name: d.drAccountName, amount: 0, narration: null }]).map((l) => `
                <div class="acct-leg">
                  <div class="acct-leg-code font-mono">${escapeHtml(l.code || "-")}</div>
                  <div class="acct-leg-name">${escapeHtml(l.name || "-")}</div>
                  ${l.amount > 0 ? `<div class="acct-leg-amt">${formatMoney(l.amount)} ${escapeHtml(d.currency || "")}</div>` : ""}
                </div>`).join("")}
            </div>
          </div>
          <div class="acct-col acct-cr">
            <div class="acct-badge">CR</div>
            <div class="acct-rows">
              ${(d.crLines && d.crLines.length ? d.crLines : [{ code: d.crAccountCode, name: d.crAccountName, amount: 0, narration: null }]).map((l) => `
                <div class="acct-leg">
                  <div class="acct-leg-code font-mono">${escapeHtml(l.code || "-")}</div>
                  <div class="acct-leg-name">${escapeHtml(l.name || "-")}</div>
                  ${l.amount > 0 ? `<div class="acct-leg-amt">${formatMoney(l.amount)} ${escapeHtml(d.currency || "")}</div>` : ""}
                </div>`).join("")}
            </div>
          </div>
        </div>
      </div>
      ` : ""}

      ${d.partyIdNumber || d.partyIdImageUrl ? `
      <!-- Party (payer / payee) identification - shown only when authorized -->
      <div class="party-id-block">
        <div class="party-id-header">${escapeHtml(d.partyIdLabel || "Party ID")}</div>
        <div class="party-id-content">
          ${d.partyIdImageUrl ? `<img src="${escapeHtml(d.partyIdImageUrl)}" alt="Party ID" class="party-id-img" />` : ""}
          ${d.partyIdNumber ? `<div class="party-id-no font-mono">${escapeHtml(d.partyIdNumber)}</div>` : ""}
        </div>
      </div>
      ` : ""}

      <!-- Main Body Info -->
      <div class="body-grid">
        <div class="fields-col">
          <div class="field-row">
            <span class="f-lbl">${d.type === "payment" || d.type === "expenses" ? "Paid To / Party:" : "Received From:"}</span>
            <span class="f-val">${escapeHtml(d.paidBy || d.accountName || "N/A")}</span>
          </div>

          <div class="field-row">
            <span class="f-lbl">Amount in Words:</span>
            <span class="f-val font-italic" style="color: #065f46;">"${escapeHtml(amountInWords)} ${escapeHtml(d.currency)} ONLY"</span>
          </div>

          <div class="field-row">
            <span class="f-lbl">Particulars / Narration:</span>
            <span class="f-val">${escapeHtml(d.narration || "Roznamcha cash transaction posting.")}</span>
          </div>

          <div class="field-row">
            <span class="f-lbl">Contact / Mobile:</span>
            <span class="f-val">${escapeHtml(d.mobileNumber || "-")}</span>
          </div>
        </div>

        <div class="amount-box">
          <div class="amount-lbl">TOTAL AMOUNT</div>
          <div class="amount-val">${formatMoney(d.amount)} <span class="curr-lbl">${escapeHtml(currencySymbol)}</span></div>
        </div>
      </div>

      <!-- Signature Strip Footer -->
      <div class="sign-strip">
        <div class="sign-col">
          <div class="sign-line"></div>
          <div class="sign-lbl">${createdBy ? `Prepared By (${escapeHtml(createdBy)})` : "Prepared By"}</div>
        </div>
        <div class="sign-col">
          <div class="sign-line"></div>
          <div class="sign-lbl">Received / Receiver Signature</div>
        </div>
        <div class="sign-col">
          <div class="sign-line"></div>
          <div class="sign-lbl">Authorized Manager</div>
        </div>
      </div>
    </div>`;
  }

  const html = `<!doctype html>
<html lang="${lang}" dir="${isRtl ? "rtl" : "ltr"}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(voucherTitle)} - ${escapeHtml(d.receiptNo || d.voucherNo || "")}</title>
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
      font-size: 8px;
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
      padding: 8px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      font-size: 11px;
    }

    .btn-action {
      background: #1e293b;
      color: #ffffff;
      border: 1px solid #334155;
      padding: 5px 12px;
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
    .btn-success { background: #059669; border-color: #059669; }

    /* Report Sheet Container - EXACT A4 PORTRAIT 210mm x 297mm */
    .wrap {
      padding: 12px;
      display: flex;
      justify-content: center;
    }

    .sheet {
      width: 200mm;
      max-width: 100%;
      height: 287mm; /* Perfectly contained on 1 single page! */
      background: #ffffff;
      border: 1px solid #cbd5e1;
      box-shadow: 0 8px 24px rgba(15, 23, 42, 0.1);
      padding: 6mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      position: relative;
      box-sizing: border-box;
      overflow: hidden;
    }

    /* Half Voucher Card */
    .voucher-half {
      height: 136mm; /* Exactly half of A4 */
      border: 1.5px solid #0f172a;
      border-radius: 6px;
      padding: 8px 12px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      background: #ffffff;
    }

    /* Letterhead Header */
    .lh-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 1.5px solid #0f172a;
      padding-bottom: 6px;
    }

    .lh-left {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .lh-logo {
      width: 32px;
      height: 32px;
      background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%);
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      font-weight: 900;
      font-size: 14px;
    }

    .lh-company {
      font-size: 14px;
      font-weight: 900;
      color: #0f172a;
      letter-spacing: 0.5px;
      line-height: 1;
    }

    .lh-tagline {
      font-size: 7.5px;
      font-weight: 700;
      color: #475569;
      text-transform: uppercase;
      margin-top: 1px;
    }

    .lh-contact {
      font-size: 6.5px;
      color: #64748b;
      margin-top: 1px;
    }

    .lh-right {
      text-align: right;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 3px;
    }

    .voucher-badge {
      background: #0f172a;
      color: #ffffff;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 9px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .copy-badge {
      background: #e2e8f0;
      color: #0f172a;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 7px;
      font-weight: 800;
      text-transform: uppercase;
    }

    /* Meta Grid */
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 4px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
      padding: 4px 8px;

    }

    .meta-item {
      display: flex;
      flex-direction: column;
    }

    .meta-lbl {
      font-size: 6px;
      font-weight: 800;
      color: #64748b;
      text-transform: uppercase;
    }

    .meta-val {
      font-size: 8px;
      font-weight: 800;
      color: #0f172a;
    }

    /* Body Grid */
    .body-grid {
      display: grid;
      grid-template-columns: 1fr 130px;
      gap: 10px;
      align-items: stretch;
    }

    .fields-col {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .field-row {
      display: flex;
      align-items: baseline;
      border-bottom: 1px dashed #cbd5e1;
      padding-bottom: 2px;
    }

    .f-lbl {
      width: 105px;
      font-size: 7.5px;
      font-weight: 800;
      color: #475569;
      flex-shrink: 0;
    }

    .f-val {
      font-size: 8px;
      font-weight: 800;
      color: #0f172a;
      flex-grow: 1;
    }

    .amount-box {
      border: 2px solid #059669;
      border-radius: 6px;
      background: #ecfdf5;
      padding: 8px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
    }

    .amount-lbl {
      font-size: 7px;
      font-weight: 900;
      color: #047857;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .amount-val {
      font-size: 16px;
      font-weight: 900;
      color: #047857;
      font-family: monospace;
      margin-top: 2px;
    }

    .curr-lbl {
      font-size: 9px;
      font-weight: 800;
    }

    /* Cut Line Divider */
    .cut-line-divider {
      height: 12mm;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
    }

    .cut-dashed {
      width: 100%;
      border-bottom: 1.5px dashed #94a3b8;
    }

    .cut-badge {
      position: absolute;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      padding: 2px 10px;
      border-radius: 12px;
      font-size: 7px;
      font-weight: 800;
      color: #64748b;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    /* Signature Strip */
    .sign-strip {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      border-top: 1px solid #e2e8f0;
      padding-top: 4px;
    }

    .sign-col {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
    }

    .sign-line {
      width: 110px;
      border-bottom: 1.5px solid #0f172a;
    }

    .sign-lbl {
      font-size: 7px;
      font-weight: 800;
      color: #475569;
    }

    @media print {
      body { background: #ffffff; }
      .no-print-toolbar { display: none !important; }
      .wrap { padding: 0; }
      .sheet {
        width: 100% !important;
        height: 297mm !important;
        border: none !important;
        box-shadow: none !important;
        padding: 0 !important;
      }
      @page { size: A4 portrait; margin: 4mm; }
    }

    /* 2026-11 additions: cheque / bank block, accounting DR+CR block, party ID */
    .cheque-block {
      border: 1px solid #cbd5e1; border-radius: 4px; padding: 4px 6px; margin-top: 4px; background: #f8fafc;
    }
    .cheque-header {
      font-weight: 800; font-size: 8px; letter-spacing: 0.4px; text-transform: uppercase;
      color: #1e40af; padding-bottom: 2px; margin-bottom: 3px; border-bottom: 1px dotted #cbd5e1;
    }
    .cheque-grid {
      display: grid; grid-template-columns: repeat(3, 1fr); gap: 2px 8px; font-size: 7.5px;
    }
    .cq-item { display: flex; justify-content: space-between; gap: 4px; }
    .cq-lbl { color: #64748b; font-weight: 600; }
    .cq-val { color: #0f172a; font-weight: 700; text-align: end; }
    .cq-status { padding: 0 4px; border-radius: 3px; font-weight: 800; font-size: 7px; }
    .cq-issued { background: #fee2e2; color: #991b1b; }
    .cq-received { background: #d1fae5; color: #065f46; }
    .cq-cleared { background: #dbeafe; color: #1e40af; }
    .cq-pending { background: #fef3c7; color: #92400e; }

    .accounting-block {
      border: 1px solid #cbd5e1; border-radius: 4px; padding: 4px 6px; margin-top: 4px; background: #f1f5f9;
    }
    .acct-header {
      font-weight: 800; font-size: 8px; letter-spacing: 0.4px; text-transform: uppercase;
      color: #0f172a; padding-bottom: 2px; margin-bottom: 3px; border-bottom: 1px dotted #cbd5e1;
    }
    .acct-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; }
    .acct-col {
      display: flex; gap: 6px; padding: 3px 5px; background: #fff; border: 1px solid #e2e8f0; border-radius: 3px;
    }
    .acct-badge {
      font-weight: 900; font-size: 9px; padding: 1px 6px; border-radius: 3px; min-width: 20px; text-align: center;
    }
    .acct-dr .acct-badge { background: #fecaca; color: #991b1b; }
    .acct-cr .acct-badge { background: #bbf7d0; color: #166534; }
    .acct-rows { flex: 1; display: flex; flex-direction: column; gap: 2px; font-size: 7.5px; }
    .acct-lbl { color: #64748b; font-weight: 600; }
    .acct-val { color: #0f172a; font-weight: 700; text-align: end; }
    .acct-leg {
      display: grid; grid-template-columns: auto 1fr auto; gap: 4px 6px; padding: 1px 0;
      border-bottom: 1px dotted #e2e8f0;
    }
    .acct-leg:last-child { border-bottom: none; }
    .acct-leg-code { font-weight: 800; color: #0f172a; font-size: 7px; }
    .acct-leg-name { color: #0f172a; font-weight: 600; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .acct-leg-amt { font-weight: 800; font-size: 7.5px; color: #0f172a; font-family: "Outfit", sans-serif; }

    .party-id-block {
      border: 1px solid #cbd5e1; border-radius: 4px; padding: 4px 6px; margin-top: 4px; background: #fffbeb;
    }
    .party-id-header {
      font-weight: 800; font-size: 8px; letter-spacing: 0.4px; text-transform: uppercase;
      color: #92400e; padding-bottom: 2px; margin-bottom: 3px; border-bottom: 1px dotted #fde68a;
    }
    .party-id-content { display: flex; gap: 6px; align-items: center; }
    .party-id-img {
      max-height: 28mm; max-width: 44mm; border: 1px solid #cbd5e1; border-radius: 3px; object-fit: contain; background: #fff;
    }
    .party-id-no { font-size: 8.5px; font-weight: 800; letter-spacing: 0.3px; color: #0f172a; }
  </style>
</head>
<body>

  <div class="no-print-toolbar">
    <div>
      <strong>📄 ${escapeHtml(voucherTitle)} &bull; ${escapeHtml(d.receiptNo || d.voucherNo || "")}</strong> &mdash; 1-Page Official Voucher Sheet
    </div>
    <div>
      <button class="btn-action btn-primary" onclick="window.print()">🖨️ Print Voucher</button>
      <button class="btn-action btn-primary" onclick="window.print()">📄 Save PDF</button>
      <button class="btn-action" onclick="window.close()">❌ Close</button>
    </div>
  </div>

  <div class="wrap">
    <div class="sheet">
      <!-- TOP HALF: OFFICE COPY -->
      ${renderReceiptHalf("OFFICE COPY")}

      <!-- CUT LINE DIVIDER -->
      <div class="cut-line-divider">
        <div class="cut-dashed"></div>
        <div class="cut-badge">✂️ TEAR / CUT HERE (OFFICE COPY / CUSTOMER COPY)</div>
      </div>

      <!-- BOTTOM HALF: CUSTOMER COPY -->
      ${renderReceiptHalf("CUSTOMER COPY")}
    </div>
  </div>

</body>
</html>`;

  return html;
}

export function openRoznamchaVoucherPrintReport(input: {
  data: RoznamchaVoucherData;
  companyInfo?: ERPCompanyInfo;
  lang?: string;
}) {
  if (typeof window === "undefined") return;
  const html = buildRoznamchaVoucherHtml(input);
  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  }
}
