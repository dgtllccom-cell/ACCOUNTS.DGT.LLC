/**
 * Local-sales tax layout: a proforma / tax invoice with the customer block, a per-line VAT table, a totals row,
 * amount in words, bank details, a tax summary, terms and the authorised signatory.
 *
 * Presentation only. Every value comes from the source transaction through TradeDocumentInput. A value the
 * record does not carry (company TRN, VAT %, VAT amount, bank, terms) prints as a dash and is listed in the
 * missing-field notice; nothing is invented.
 */
import { t } from "@/lib/i18n/ui";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { documentAmountInWords } from "@/lib/utils/number-to-words-i18n";
import { brandLinesFor } from "@/lib/reports/resolve-document-branding";
import type { TradeDocumentInput, TradeLineItem } from "./types";

function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
const isReal = (v: unknown) => {
  const s = String(v ?? "").trim();
  return s !== "" && !/^(n\/?a|none|null|undefined|-+)$/i.test(s);
};
const money = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—";
};
const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: 3 }) : "—";
};
const fmtDate = (v: string | null | undefined) => {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};
/** Company name for the header: never the bare country name that branding falls back to. */
function companyName(b: TradeDocumentInput["branding"], fallback: string): string {
  const name = (b.entityName || "").trim();
  if (name && !(b.countryName && name.toLowerCase() === b.countryName.trim().toLowerCase())) return name;
  return (b.legalName || "").trim() || fallback;
}
const vatPercent = (li: TradeLineItem): number | null => {
  const amt = Number(li.amount), tax = Number(li.taxAmount);
  return Number.isFinite(amt) && amt > 0 && Number.isFinite(tax) && tax > 0 ? Math.round((tax / amt) * 10000) / 100 : null;
};
/** A value the record actually carries (a number, including 0). null/undefined/"" are not carried and print as a dash. */
const carried = (v: unknown): number | null => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
const moneyOrDash = (v: number | null) => (v === null ? "—" : money(v));

export function buildUaeTaxInvoiceHtml(input: TradeDocumentInput): string {
  const lang = (input.lang || "en") as SupportedLanguage;
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);
  const tt = (key: string, fallback: string) => t(lang, key as never, fallback);
  const b = input.branding;
  const brandName = companyName(b, tt("tdoc.brand_fallback", "Digital Dock ERP"));
  const isTax = input.docType === "tax_invoice";
  const docTitle = tt(isTax ? "tdoc.t_tax_invoice" : "tdoc.t_sales_invoice", isTax ? "Tax Invoice" : "Sales Invoice");
  const orientation = input.orientation || "portrait";
  const refs = input.referenceNos || {};
  const tr = input.transport || {};
  const totals = input.totals || {};
  const currency = input.currency || "";
  // Amounts are printed only when the record carries them. A record with no lines has no taxable value, and a record
  // with no total has no grand total: both print as a dash, never as 0.00.
  const subTotal = carried(totals.subTotal) ?? (input.goods.some((g) => carried(g.amount) !== null)
    ? input.goods.reduce((s, g) => s + (carried(g.amount) ?? 0), 0) : null);
  const grand = carried(totals.grandTotal) ?? subTotal;
  const vatTotal = carried(totals.taxAmount);
  const lineVatCell = (g: TradeLineItem) => (isReal(g.taxAmount) ? money(g.taxAmount) : "—");
  // Exchange rate and functional-currency total, as on the standard layout: shown only when the sale is in a foreign currency.
  const fxRate = carried(input.exchangeRate);
  const fxLines = fxRate !== null && fxRate !== 1 && isReal(input.functionalCurrency) && input.functionalCurrency !== input.currency
    ? `<tr><td>${esc(tt("tdoc.exchange_rate", "Exchange Rate (frozen)"))}</td><td>1 ${esc(input.currency)} = ${num(fxRate)} ${esc(input.functionalCurrency)}</td></tr>
        <tr><td>${esc(tt("tdoc.functional_total", "Total in Functional Currency"))}</td><td>${grand !== null ? money(grand * fxRate) : "—"} ${esc(input.functionalCurrency)}</td></tr>`
    : "";
  const brandLines = brandLinesFor(b);
  const trnSeller = isReal(b.taxNumber) ? b.taxNumber! : null;

  const kv = (label: string, value: string) => `<tr><th>${esc(label)}</th><td>${value}</td></tr>`;
  const headerKv = [
    kv(tt("tdoc.invoice_no", "Invoice No."), esc(input.docNo)),
    kv(tt("tdoc.doc_date", "Date"), esc(fmtDate(input.docDate))),
    kv(tt("uae.reference_no", "Reference No."), isReal(refs.so || refs.po || refs.contract) ? esc(refs.so || refs.po || refs.contract) : "—"),
    kv(tt("uae.ship_mode", "Ship Mode"), isReal(tr.mode) ? esc(tr.mode) : "—"),
    kv(tt("uae.transport", "Transport"), isReal(tr.vessel) ? esc(tr.vessel) : "—"),
    // A domestic sale is not an export: it prints as a local sale, never as "Export".
    kv(tt("uae.import_export", "Import / Export"), input.txnKind === "sales"
      ? esc(input.tradeScope === "local" ? tt("uae.local_sale", "Local Sale") : tt("uae.export", "Export"))
      : esc(tt("uae.import", "Import"))),
    kv(tt("uae.awb", "AWB / B/L No."), isReal(tr.blNumber) ? esc(tr.blNumber) : "—"),
    kv(tt("uae.loading_country", "Loading Country"), isReal(tr.loadingCountry) ? esc(tr.loadingCountry) : "—"),
    kv(tt("uae.receiving_country", "Receiving Country"), isReal(tr.dischargeCountry) ? esc(tr.dischargeCountry) : "—"),
  ].join("");

  const cust = input.buyer || {};
  const customerKv = [
    kv(tt("uae.ms", "M/S"), isReal(cust.name) ? esc(cust.name) : "—"),
    kv(tt("uae.address", "Address"), isReal(cust.address) ? esc(cust.address) : "—"),
    kv(tt("tdoc.phone", "Phone"), isReal(cust.phone) ? esc(cust.phone) : "—"),
    kv(tt("uae.trn", "TRN"), isReal(cust.taxId) ? esc(cust.taxId) : "—"),
    kv(tt("uae.place_of_supply", "Place of Supply"), isReal(cust.country) ? esc(cust.country) : "—"),
  ].join("");

  const lineRows = input.goods.length
    ? input.goods.map((g, i) => {
        const pct = vatPercent(g);
        const amount = carried(g.amount);
        const total = amount === null ? null : amount + (carried(g.taxAmount) ?? 0);
        return `<tr>
          <td class="c">${i + 1}</td>
          <td><strong>${esc(g.description || "—")}</strong></td>
          <td class="c">${isReal(g.hsCode) ? esc(g.hsCode) : "—"}</td>
          <td class="r">${num(g.quantity)}${isReal(g.unit) ? ` ${esc(g.unit)}` : ""}</td>
          <td class="r">${moneyOrDash(carried(g.unitPrice))}</td>
          <td class="r">${moneyOrDash(amount)}</td>
          <td class="r">${pct !== null ? `${num(pct)}%` : "—"}</td>
          <td class="r">${lineVatCell(g)}</td>
          <td class="r">${moneyOrDash(total)}</td>
        </tr>`;
      }).join("")
    : `<tr><td class="c" colspan="9">${esc(tt("tdoc.no_goods", "No goods lines on this transaction."))}</td></tr>`;

  const totalQty = input.goods.length ? input.goods.reduce((s, g) => s + (Number(g.quantity) || 0), 0) : null;
  const taxableAmount = subTotal;
  const totalTax = vatTotal;
  const totalAfterTax = grand;
  const bank = input.bank || null;
  const bankKv = bank ? [
    [tt("tdoc.bank_name", "Bank Name"), bank.bankName],
    [tt("tdoc.bank_branch", "Branch Name"), bank.branchName],
    [tt("tdoc.account_number", "Account No."), bank.accountNumber],
    [tt("tdoc.iban", "IBAN"), bank.iban],
    [tt("tdoc.swift", "SWIFT / BIC"), bank.swift],
  ].map(([l, v]) => `<tr><th>${esc(l)}</th><td>${isReal(v) ? esc(v) : "—"}</td></tr>`).join("") : "";

  const terms = [
    input.delivery?.deliveryTerms,
    input.delivery?.paymentTerms ? `${tt("tdoc.payment_terms", "Payment Terms")}: ${input.delivery.paymentTerms}` : null,
    input.validity ? `${tt("uae.due_date", "Due Date")}: ${input.validity}` : null,
    input.notes,
  ].filter((v) => isReal(v)).map((v, i) => `<li>${esc(v)}</li>`).join("");

  const missingHtml = (input.missingFields && input.missingFields.length)
    ? `<div class="missing no-print">${esc(tt("tdoc.missing_notice", "Some fields are not on the source transaction and are blank on this document:"))} ${input.missingFields.map(esc).join(", ")}</div>`
    : "";

  return `<!doctype html>
<html lang="${esc(lang)}" dir="${isRtl ? "rtl" : "ltr"}">
<head>
<meta charset="utf-8" />
<meta name="erp-page-count" content="1" />
<title>${esc(docTitle)} — ${esc(input.docNo)}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&family=Noto+Naskh+Arabic:wght@400;600;700&family=Noto+Nastaliq+Urdu:wght@400;600;700&display=swap');
  @page { size: A4 ${orientation}; margin: 10mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #e5e7eb; }
  body { color: #0f172a; font-family: 'Inter', 'Noto Naskh Arabic', Arial, sans-serif; font-size: 9.5px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html[lang="ur"] body { font-family: 'Noto Nastaliq Urdu', 'Noto Naskh Arabic', serif; }
  html[lang="ar"] body, html[lang="fa"] body, html[lang="ps"] body { font-family: 'Noto Naskh Arabic', 'Inter', sans-serif; }
  /* The sheet is captured as one image when saved as PDF: no outer margin, and a tighter padding in landscape so the sheet stays on one page. */
  .page { width: ${orientation === "landscape" ? "277mm" : "190mm"}; margin: 0 auto; background: #fff; padding: ${orientation === "landscape" ? "6mm" : "9mm"}; border: 1px solid #cbd5e1; }
  .top { display: flex; justify-content: space-between; gap: 10px; align-items: flex-start; border-bottom: 2px solid #1e3a8a; padding-bottom: 6px; }
  .brand-name { font-size: 17px; font-weight: 900; color: #1e3a8a; }
  .brand-sub { font-size: 9px; font-weight: 800; color: #0f172a; text-transform: uppercase; }
  .brand-lines { font-size: 8.5px; color: #334155; line-height: 1.45; margin-top: 3px; }
  .logo { max-height: 40px; max-width: 110px; object-fit: contain; }
  .row2 { display: grid; grid-template-columns: 1fr 1.1fr; gap: 8px; margin-top: 6px; }
  .trn { font-weight: 800; font-size: 10px; }
  .doc-title { text-align: center; margin: 4px 0; }
  .doc-title span { display: inline-block; background: #dbeafe; color: #1e3a8a; font-weight: 900; font-size: 15px; padding: 4px 16px; border-radius: 4px; }
  table.kv { width: 100%; border-collapse: collapse; }
  table.kv th, table.kv td { border: 1px solid #cbd5e1; padding: 3px 5px; font-size: 9px; text-align: start; vertical-align: top; }
  table.kv th { width: 40%; background: #f8fafc; font-weight: 800; }
  table.kv td { font-weight: 700; }
  .meta-box { border: 1px solid #94a3b8; border-radius: 4px; background: #eff6ff; }
  .items { width: 100%; border-collapse: collapse; margin-top: 8px; }
  .items th { background: #1e3a8a; color: #fff; font-size: 8.5px; font-weight: 800; padding: 4px 3px; border: 1px solid #1e3a8a; text-align: center; }
  .items td { border: 1px solid #94a3b8; padding: 4px 4px; font-size: 9px; vertical-align: top; }
  .items tfoot td { font-weight: 900; background: #eff6ff; }
  .c { text-align: center; } .r { text-align: end; white-space: nowrap; }
  .totals-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 6px; }
  .words { border: 1px dashed #64748b; padding: 5px 7px; font-size: 9.5px; font-style: italic; margin-top: 6px; background: #f8fafc; }
  .lower { display: grid; grid-template-columns: 1.1fr 1fr; gap: 8px; margin-top: 8px; }
  .summary table { width: 100%; border-collapse: collapse; }
  .summary td { padding: 3px 6px; border-bottom: 1px solid #e2e8f0; font-size: 9.5px; }
  .summary td:last-child { text-align: end; font-weight: 800; }
  .summary tr.grand td { font-size: 11px; font-weight: 900; color: #1e3a8a; border-top: 2px solid #1e3a8a; }
  .terms { margin-top: 8px; font-size: 9px; }
  .terms h4 { margin: 0 0 3px; font-size: 10px; color: #1e3a8a; }
  .terms ol { margin: 0; padding-inline-start: 16px; }
  .sign { margin-top: 16px; display: flex; justify-content: flex-end; }
  .sign-box { width: 210px; border-top: 1px solid #0f172a; text-align: center; padding-top: 3px; font-size: 9px; font-weight: 800; }
  .missing { background: #fffbeb; border: 1px solid #fde68a; color: #92400e; font-size: 8.5px; padding: 5px 8px; border-radius: 4px; margin-bottom: 6px; }
  @media print { body { background: #fff; } .no-print { display: none !important; } .page { border: none; margin: 0; width: 100%; padding: 0; } }
</style>
</head>
<body>
<div class="page">
  ${missingHtml}
  <div class="top">
    <div>
      <div class="brand-name">${esc(brandName)}</div>
      <div class="brand-sub">${esc(tt("uae.tagline", "Clearing, Forwarding & Logistics Services"))}</div>
      <div class="brand-lines">${brandLines.map(esc).join("<br/>")}</div>
    </div>
    ${isReal(b.logoUrl) && /^(https?:\/\/|data:|\/)/.test(String(b.logoUrl)) ? `<img class="logo" src="${esc(b.logoUrl)}" alt="" />` : ""}
  </div>

  <div class="row2">
    <div>
      <div class="trn">${esc(tt("uae.trn", "TRN"))}: ${trnSeller ? esc(trnSeller) : "—"}</div>
      <table class="kv" style="margin-top:6px"><tbody>${customerKv}</tbody></table>
    </div>
    <div>
      <div class="doc-title"><span>${esc(docTitle)}</span></div>
      <table class="kv meta-box"><tbody>${headerKv}</tbody></table>
    </div>
  </div>

  <table class="items data-table">
    <thead><tr>
      <th style="width:4%">${esc(tt("uae.sr", "Sr."))}</th>
      <th style="width:26%">${esc(tt("uae.product_service", "Name of Product / Service"))}</th>
      <th style="width:9%">${esc(tt("uae.hs_code", "HS Code"))}</th>
      <th style="width:10%">${esc(tt("uae.qty", "Qty"))}</th>
      <th style="width:9%">${esc(tt("uae.rate", "Rate"))}</th>
      <th style="width:11%">${esc(tt("uae.taxable_value", "Taxable Value"))}</th>
      <th style="width:7%">${esc(tt("uae.vat_pct", "VAT %"))}</th>
      <th style="width:10%">${esc(tt("uae.vat_amount", "VAT Amount"))}</th>
      <th style="width:12%">${esc(tt("uae.total_col", "Total"))}</th>
    </tr></thead>
    <tbody>${lineRows}</tbody>
    <tfoot><tr>
      <td colspan="3" class="r">${esc(tt("uae.total_qty", "Total Qty"))}</td>
      <td class="r">${totalQty === null ? "—" : num(totalQty)}</td>
      <td></td>
      <td class="r">${moneyOrDash(taxableAmount)}</td>
      <td></td>
      <td class="r">${moneyOrDash(vatTotal)}</td>
      <td class="r">${moneyOrDash(grand)}</td>
    </tr></tfoot>
  </table>

  <div class="words"><strong>${esc(tt("tdoc.amount_in_words", "Amount in words"))}:</strong> ${grand !== null ? esc(documentAmountInWords(Number(grand.toFixed(2)), currency, lang)) : "—"}</div>

  <div class="lower">
    <div>
      ${bankKv ? `<div class="sec">${esc(tt("tdoc.sec_bank", "Beneficiary Bank Details"))}</div><table class="kv"><tbody>${bankKv}</tbody></table>` : ""}
      ${terms ? `<div class="terms"><h4>${esc(tt("uae.terms", "Terms & Conditions"))}</h4><ol>${terms}</ol></div>` : ""}
    </div>
    <div class="summary">
      <table>
        <tr><td>${esc(tt("uae.summary_taxable", "Taxable Amount"))}</td><td>${taxableAmount !== null ? `${money(taxableAmount)} ${esc(currency)}` : "—"}</td></tr>
        <tr><td>${esc(tt("uae.add_vat", "Add: VAT"))}</td><td>${totalTax !== null ? `${money(totalTax)} ${esc(currency)}` : "—"}</td></tr>
        <tr><td>${esc(tt("uae.total_tax", "Total Tax"))}</td><td>${totalTax !== null ? `${money(totalTax)} ${esc(currency)}` : "—"}</td></tr>
        ${fxLines}
        <tr class="grand"><td>${esc(tt("uae.total_after_tax", "Total Amount After Tax"))}</td><td>${totalAfterTax !== null ? `${money(totalAfterTax)} ${esc(currency)}` : "—"}</td></tr>
      </table>
    </div>
  </div>

  <div class="sign"><div class="sign-box">${esc(input.signatureName || tt("uae.authorised_signatory", "Authorised Signatory"))}</div></div>
</div>
${input.autoPrint ? `<script>window.addEventListener('load',function(){setTimeout(function(){window.print();},400);});</script>` : ""}
</body>
</html>`;
}
