import { escapeHtml, formatMoney, formatDate, type ERPCompanyInfo } from "./erp-report-template-builder";
import { numberToWords } from "@/lib/utils/number-to-words";
import { t } from "@/lib/i18n/ui";
import type { SupportedLanguage } from "@/lib/i18n/languages";

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
  /** payment method name as recorded on the entry ("Cash", "Cheque", "Bank Transfer", ...). Unset = no box ticked. */
  paymentMethodName?: string | null;
  /** trade licence of the party, when the entry carries it. Shown as "—" when absent. */
  tradeLicenseNo?: string | null;
  // Shown only when the Roznamcha entry carries them. Nothing is fabricated.
  chequeNo?: string | null;
  chequeDate?: string | null;
  bankName?: string | null;
  bankBranchName?: string | null;
  referenceNo?: string | null;
  /**
   * DR / CR legs of the entry, read directly from its stored lines. A one-sided cash entry has one side only;
   * a two-leg posting has both. The voucher never adds a counter-leg the entry does not have.
   * The legacy single-leg fields are kept for existing callers.
   */
  drAccountCode?: string | null;
  drAccountName?: string | null;
  crAccountCode?: string | null;
  crAccountName?: string | null;
  drLines?: Array<{ code?: string | null; name?: string | null; amount: number; narration?: string | null }>;
  crLines?: Array<{ code?: string | null; name?: string | null; amount: number; narration?: string | null }>;
  /** Party identification - only shown when the caller has resolved authorization. */
  partyIdLabel?: string | null;
  partyIdNumber?: string | null;
  partyIdImageUrl?: string | null;
  /** cheque status shown next to the cheque number */
  chequeStatus?: "issued" | "received" | "cleared" | "pending" | null;
};

type Leg = { code?: string | null; name?: string | null; amount: number; narration?: string | null };

const SAFE_IMAGE = /^(https?:\/\/|data:image\/|\/)/;

/**
 * Pure builder: the complete voucher as an HTML string (A4 landscape, two portrait copies side by side:
 * Company Copy and Customer Copy, as on the reference receipt). No window access, so it is unit-testable.
 */
export function buildRoznamchaVoucherHtml(input: {
  data: RoznamchaVoucherData;
  companyInfo?: ERPCompanyInfo;
  lang?: string;
}): string {
  const { data: d, companyInfo = {}, lang = "en" } = input;
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);
  const dir = isRtl ? "rtl" : "ltr";
  const tt = (key: string, fallback: string) => t(lang as SupportedLanguage, key as never, fallback);

  const compName = companyInfo.name || "DIGITAL DOCK ERP";
  const branchLine = [companyInfo.tagline, d.branchName || companyInfo.branch].filter(Boolean).join(" • ");
  const contactLine = [
    companyInfo.phone ? `${escapeHtml(companyInfo.phone)}` : "",
    companyInfo.email ? `${escapeHtml(companyInfo.email)}` : "",
    companyInfo.website ? `${escapeHtml(companyInfo.website)}` : "",
  ].filter(Boolean).join(" &nbsp;|&nbsp; ");
  const logo = companyInfo.logoUrl && SAFE_IMAGE.test(companyInfo.logoUrl)
    ? `<img class="logo" src="${escapeHtml(companyInfo.logoUrl)}" alt="" />`
    : "";

  const isPaymentLike = d.type === "payment" || d.type === "expenses";
  const voucherTitle = d.type === "payment" ? tt("rvp.title_payment", "CASH PAYMENT")
    : d.type === "expenses" ? tt("rvp.title_expense", "EXPENSE PAYMENT")
    : d.type === "exchange" ? tt("rvp.title_exchange", "MONEY EXCHANGE")
    : tt("rvp.title_receipt", "CASH RECEIPT");
  const currencySymbol = d.currency === "USD" ? "$" : d.currency === "AED" ? "AED" : d.currency === "PKR" ? "Rs" : d.currency || "AED";
  const amountInWords = numberToWords(d.amount);

  // Legs: the stored lines, one side per stored side. Legacy single DR/CR fields still apply.
  const drLegs: Leg[] = d.drLines && d.drLines.length ? d.drLines
    : (d.drAccountCode || d.drAccountName ? [{ code: d.drAccountCode, name: d.drAccountName, amount: 0, narration: null }] : []);
  const crLegs: Leg[] = d.crLines && d.crLines.length ? d.crLines
    : (d.crAccountCode || d.crAccountName ? [{ code: d.crAccountCode, name: d.crAccountName, amount: 0, narration: null }] : []);

  // Payment method: ticked only from the entry's own method, never guessed.
  const pm = (d.paymentMethodName || "").toLowerCase();
  const isCheque = /cheque|check/.test(pm) || Boolean(d.chequeNo);
  const isBank = !isCheque && (/bank|transfer|wire/.test(pm) || (!pm && Boolean(d.bankName)));
  const isCash = !isCheque && !isBank && /cash/.test(pm);
  const box = (on: boolean) => `<span class="box">${on ? "✓" : ""}</span>`;

  const cell = (v: unknown) => (v !== undefined && v !== null && String(v).trim() !== "" ? escapeHtml(v) : "—");
  const partyName = d.paidBy || d.accountName || "";
  const createdBy = d.createdByName || "";
  const photo = d.partyIdImageUrl && SAFE_IMAGE.test(d.partyIdImageUrl)
    ? `<img class="id-photo" src="${escapeHtml(d.partyIdImageUrl)}" alt="" />`
    : "";

  const kvRows: Array<[string, string]> = [
    [isPaymentLike ? tt("rvp.paid_to", "Paid To / Party") : tt("rvp.received_from", "Received From"), cell(partyName)],
    [tt("rvp.account_code", "Account Code"), cell(d.accountNo)],
    [tt("rvp.account_title", "Account Title"), cell(d.accountName)],
    [tt("rvp.contact", "Contact / WhatsApp"), cell(d.mobileNumber)],
    [tt("rvp.emirates_id", "UAE ID (Emirates ID)"), cell(d.partyIdNumber)],
    [tt("rvp.trade_license", "Trade License No."), cell(d.tradeLicenseNo)],
    [tt("rvp.reference", "Reference / Invoice No."), cell(d.referenceNo)],
  ];
  const kvHtml = kvRows.map(([label, value]) => `<tr><th>${escapeHtml(label)}</th><td>${value}</td></tr>`).join("");

  const legRow = (side: "DR" | "CR", l: Leg) => `
    <tr data-side="${side}">
      <td><span class="side ${side === "DR" ? "side-dr" : "side-cr"}">${escapeHtml(side === "DR" ? tt("rvp.dr", "DR") : tt("rvp.cr", "CR"))}</span></td>
      <td class="mono">${cell(l.code)}</td>
      <td>${cell(l.name)}</td>
      <td class="num">${l.amount > 0 ? `${escapeHtml(formatMoney(l.amount))} ${escapeHtml(d.currency || "")}` : "—"}</td>
      <td>${cell(l.narration)}</td>
    </tr>`;
  const legRows = [...drLegs.map((l) => legRow("DR", l)), ...crLegs.map((l) => legRow("CR", l))].join("");

  const copy = (copyKey: "rvp.company_copy" | "rvp.customer_copy", copyFallback: string) => `
  <section class="copy">
    <header class="hd">
      <div class="brand">
        ${logo}
        <div>
          <div class="co-name">${escapeHtml(compName)}</div>
          ${branchLine ? `<div class="co-sub">${escapeHtml(branchLine)}</div>` : ""}
          ${contactLine ? `<div class="co-sub">${contactLine}</div>` : ""}
        </div>
      </div>
      <div class="rno">
        <div class="rno-lbl">${escapeHtml(tt("rvp.receipt_no", "Receipt No."))}</div>
        <div class="rno-val mono">${cell(d.receiptNo || d.voucherNo)}</div>
        <div class="rno-lbl">${escapeHtml(tt("rvp.date", "Date"))}</div>
        <div class="rno-val">${escapeHtml(formatDate(d.date, lang))}</div>
      </div>
    </header>

    <div class="title">${escapeHtml(voucherTitle)}</div>

    <div class="sec-h">${escapeHtml(tt("rvp.party_details", "Party / Payee Details"))}</div>
    <div class="party-wrap">
      <table class="kv"><tbody>${kvHtml}</tbody></table>
      ${photo}
    </div>

    <div class="sec-h">${escapeHtml(tt("rvp.payment_method", "Payment Method"))}</div>
    <div class="pm-row">
      <span class="pm">${box(isCash)} ${escapeHtml(tt("rvp.cash", "Cash"))}</span>
      <span class="pm">${box(isCheque)} ${escapeHtml(tt("rvp.cheque", "Cheque"))}</span>
      <span class="pm">${box(isBank)} ${escapeHtml(tt("rvp.bank_transfer", "Bank Transfer"))}</span>
    </div>
    <div class="pm-meta">
      <span>${escapeHtml(tt("rvp.cheque_no", "Cheque No. (if any)"))}: <b class="mono">${cell(d.chequeNo)}</b></span>
      <span>${escapeHtml(tt("rvp.bank_branch", "Bank / Branch"))}: <b>${cell([d.bankName, d.bankBranchName].filter(Boolean).join(" / "))}</b></span>
    </div>

    <div class="amt-row">
      <div class="amt-box">
        <div class="amt-lbl">${escapeHtml(tt("rvp.amount", "Amount"))} (${escapeHtml(currencySymbol)})</div>
        <div class="amt-val">${escapeHtml(formatMoney(d.amount))}</div>
      </div>
      <div class="amt-words">
        <div class="amt-lbl">${escapeHtml(tt("rvp.amount_words", "Amount in Words"))}</div>
        <div>"${escapeHtml(amountInWords)} ${escapeHtml(d.currency || "")}"</div>
      </div>
    </div>

    <div class="sec-h">${escapeHtml(tt("rvp.remarks", "Remarks"))}</div>
    <div class="remarks">${cell(d.narration)}</div>

    ${legRows ? `
    <div class="sec-h">${escapeHtml(tt("rvp.account_details", "Account Details (DR / CR)"))}</div>
    <table class="legs">
      <thead><tr>
        <th>${escapeHtml(tt("rvp.side", "Side"))}</th>
        <th>${escapeHtml(tt("rvp.account_code", "Account Code"))}</th>
        <th>${escapeHtml(tt("rvp.account_title", "Account Title"))}</th>
        <th>${escapeHtml(tt("rvp.amount", "Amount"))}</th>
        <th>${escapeHtml(tt("rvp.narration", "Narration"))}</th>
      </tr></thead>
      <tbody>${legRows}</tbody>
    </table>` : ""}

    <div class="sigs">
      <div class="sig"><div class="sig-line"></div><div class="sig-lbl">${escapeHtml(tt("rvp.prepared_by", "Prepared By"))}${createdBy ? ` (${escapeHtml(createdBy)})` : ""}</div></div>
      <div class="sig"><div class="sig-line"></div><div class="sig-lbl">${escapeHtml(tt("rvp.checked_by", "Checked By"))}</div></div>
      <div class="sig"><div class="sig-line"></div><div class="sig-lbl">${escapeHtml(tt("rvp.authorized_by", "Authorized By"))}</div></div>
    </div>

    <footer class="ft">
      <span class="mono">${cell(d.receiptNo || d.voucherNo)}</span>
      <span class="copy-badge">${escapeHtml(tt(copyKey, copyFallback))}</span>
    </footer>
  </section>`;

  const html = `<!doctype html>
<html lang="${escapeHtml(lang)}" dir="${dir}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(voucherTitle)} - ${escapeHtml(d.receiptNo || d.voucherNo || "")}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800;900&family=Noto+Naskh+Arabic:wght@400;600;700&family=Noto+Nastaliq+Urdu:wght@400;600;700&display=swap');
    @page { size: A4 landscape; margin: 6mm; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      background: #e5e7eb; color: #0f172a;
      font-family: 'Outfit', 'Noto Naskh Arabic', Arial, sans-serif; font-size: 10px;
      -webkit-print-color-adjust: exact; print-color-adjust: exact;
    }
    html[lang="ur"] body { font-family: 'Noto Nastaliq Urdu', 'Noto Naskh Arabic', serif; }
    html[lang="ar"] body, html[lang="fa"] body, html[lang="ps"] body { font-family: 'Noto Naskh Arabic', 'Outfit', sans-serif; }
    .mono { font-family: 'Outfit', monospace; font-variant-numeric: tabular-nums; }

    .no-print-toolbar {
      position: sticky; top: 0; z-index: 100; background: #0f172a; color: #fff;
      padding: 8px 16px; display: flex; align-items: center; justify-content: space-between; font-size: 11px;
    }
    .btn-action { background: #1e293b; color: #fff; border: 1px solid #334155; padding: 5px 12px; border-radius: 6px; font-weight: 700; font-size: 11px; cursor: pointer; margin-inline-start: 6px; }
    .btn-primary { background: #2563eb; border-color: #2563eb; }

    .wrap { padding: 10px; display: flex; justify-content: center; }
    /* Two portrait copies side by side on one A4 landscape sheet, with the cut line between them */
    .sheet {
      width: 285mm; min-height: 198mm; background: #fff; border: 1px solid #cbd5e1; box-shadow: 0 8px 24px rgba(15,23,42,0.1);
      display: grid; grid-template-columns: 1fr 6mm 1fr; padding: 4mm;
    }
    .copy {
      display: flex; flex-direction: column; gap: 3px; padding: 3mm;
      border: 1.5px solid #0f172a; border-radius: 3mm; min-height: 186mm;
    }
    .cut { position: relative; }
    .cut::before { content: ""; position: absolute; top: 0; bottom: 0; left: 50%; border-inline-start: 1px dashed #64748b; }
    .cut span {
      position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(90deg);
      background: #fff; font-size: 7px; color: #475569; padding: 0 4px; white-space: nowrap;
    }

    .hd { display: flex; justify-content: space-between; align-items: flex-start; gap: 6px; border-bottom: 2px solid #0f172a; padding-bottom: 4px; }
    .brand { display: flex; gap: 6px; align-items: center; min-width: 0; }
    .logo { height: 13mm; max-width: 30mm; object-fit: contain; }
    .co-name { font-size: 14px; font-weight: 900; line-height: 1.1; }
    .co-sub { font-size: 8px; color: #334155; margin-top: 1px; }
    .rno { border: 1.5px solid #0f172a; border-radius: 3px; padding: 3px 6px; min-width: 38mm; text-align: center; }
    .rno-lbl { font-size: 6.5px; font-weight: 800; text-transform: uppercase; color: #475569; }
    .rno-val { font-size: 12px; font-weight: 900; }
    .title {
      margin-top: 2px; background: #e2e8f0; border-radius: 3px; text-align: center;
      font-size: 17px; font-weight: 900; letter-spacing: 0.5px; padding: 6px;
    }
    .sec-h {
      margin-top: 3px; background: #0f172a; color: #fff; font-size: 8px; font-weight: 800;
      padding: 3px 6px; text-transform: uppercase; border-radius: 2px; font-size: 9px;
    }
    .party-wrap { display: flex; gap: 6px; align-items: stretch; }
    table.kv { width: 100%; border-collapse: collapse; }
    table.kv th, table.kv td { border: 1px solid #cbd5e1; padding: 3px 5px; font-size: 10px; vertical-align: top; text-align: start; }
    table.kv th { width: 38%; background: #f8fafc; font-weight: 800; }
    table.kv td { font-weight: 700; }
    .id-photo { height: 24mm; width: 30mm; object-fit: cover; border: 1px solid #cbd5e1; border-radius: 2px; align-self: flex-start; }

    .pm-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; border: 1px solid #cbd5e1; padding: 4px 6px; font-size: 10px; font-weight: 700; }
    .pm { display: inline-flex; align-items: center; gap: 3px; }
    .box { display: inline-block; width: 10px; height: 10px; border: 1px solid #0f172a; text-align: center; font-size: 9px; line-height: 9px; font-weight: 900; }
    .pm-meta { display: flex; justify-content: space-between; gap: 6px; font-size: 9.5px; border: 1px solid #cbd5e1; border-top: none; padding: 3px 6px; }

    .amt-row { display: flex; gap: 6px; margin-top: 3px; }
    .amt-box { border: 2px solid #0f172a; padding: 3px 8px; min-width: 42mm; text-align: center; }
    .amt-lbl { font-size: 8px; font-weight: 800; text-transform: uppercase; color: #475569; }
    .amt-val { font-size: 19px; font-weight: 900; }
    .amt-words { flex: 1; border: 1px solid #cbd5e1; padding: 5px 6px; font-size: 10px; font-style: italic; }

    .remarks { border: 1px solid #cbd5e1; padding: 5px 6px; min-height: 9mm; font-size: 10px; font-weight: 700; }

    table.legs { width: 100%; border-collapse: collapse; }
    table.legs th, table.legs td { border: 1px solid #cbd5e1; padding: 3px 4px; font-size: 9px; text-align: start; vertical-align: top; }
    table.legs th { background: #f8fafc; font-weight: 800; }
    .side { font-weight: 900; padding: 0 4px; border-radius: 2px; }
    .side-dr { background: #fecaca; color: #991b1b; }
    .side-cr { background: #bbf7d0; color: #166534; }
    .num { text-align: end; font-weight: 700; }

    .sigs { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 4mm; margin-top: auto; padding-top: 8mm; }
    .sig-line { border-top: 1px solid #0f172a; margin-bottom: 2px; }
    .sig-lbl { text-align: center; font-size: 8.5px; font-weight: 800; color: #334155; }
    .ft { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #cbd5e1; padding-top: 4px; font-size: 9px; }
    .copy-badge { background: #0f172a; color: #fff; font-weight: 900; font-size: 8px; padding: 2px 8px; border-radius: 3px; }

    @media print {
      body { background: #fff; }
      .no-print-toolbar { display: none !important; }
      .wrap { padding: 0; }
      .sheet { width: 100% !important; box-shadow: none; border: none; }
    }
  </style>
</head>
<body>
  <div class="no-print-toolbar">
    <div>
      <strong>📄 ${escapeHtml(voucherTitle)} &bull; ${escapeHtml(d.receiptNo || d.voucherNo || "")}</strong>
    </div>
    <div>
      <button class="btn-action btn-primary" onclick="window.print()">🖨️ ${escapeHtml(tt("rvp.print_voucher", "Print Voucher"))}</button>
      <button class="btn-action btn-primary" onclick="window.print()">📄 ${escapeHtml(tt("rvp.save_pdf", "Save PDF"))}</button>
      <button class="btn-action" onclick="window.close()">✖ ${escapeHtml(tt("rvp.close", "Close"))}</button>
    </div>
  </div>

  <div class="wrap">
    <div class="sheet">
      ${copy("rvp.company_copy", "Company Copy")}
      <div class="cut"><span>✂ ${escapeHtml(tt("rvp.cut_here", "Cut here"))}</span></div>
      ${copy("rvp.customer_copy", "Customer Copy")}
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
