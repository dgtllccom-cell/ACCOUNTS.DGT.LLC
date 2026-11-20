/**
 * Renders an Office / Other Expenses Bill in the owner's sample layout: branch company header and bank, title box,
 * reference box, M/S block, goods table with HS code and VAT columns, totals, amount in words, summary and terms.
 * Every value comes from the TradeDocumentInput; a value the bill does not carry prints as a dash. No value is invented.
 * Every printed label goes through the translation dictionary, so the bill prints in the chosen language.
 */
import type { TradeDocumentInput, TradeLineItem } from "@/lib/reports/trade-documents/types";
import { t } from "@/lib/i18n/ui";

const esc = (v: unknown): string =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const RTL = new Set(["ur", "ar", "fa", "ps"]);
const has = (v: unknown): boolean => v != null && String(v).trim() !== "";
const dash = (v: unknown): string => (has(v) ? esc(v) : "—");
const money = (v: number | null | undefined): string =>
  v == null || !Number.isFinite(Number(v))
    ? "—"
    : Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const dmy = (v: string | null | undefined): string => {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return `${String(d.getUTCDate()).padStart(2, "0")}-${MONTHS[d.getUTCMonth()]}-${d.getUTCFullYear()}`;
};

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve",
  "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

/** Whole-number words (English) for amount in words, e.g. 3812 -> "Three Thousand Eight Hundred Twelve". */
export function wordsUnder1000(n: number): string {
  const parts: string[] = [];
  const h = Math.floor(n / 100);
  const r = n % 100;
  if (h) parts.push(`${ONES[h]} Hundred`);
  if (r) {
    if (r < 20) parts.push(ONES[r]);
    else parts.push(`${TENS[Math.floor(r / 10)]}${r % 10 ? ` ${ONES[r % 10]}` : ""}`);
  }
  return parts.join(" ");
}
export function integerToWords(n: number): string {
  if (n === 0) return "Zero";
  const scales: [number, string][] = [[1_000_000_000, "Billion"], [1_000_000, "Million"], [1000, "Thousand"]];
  let rest = Math.floor(n);
  const out: string[] = [];
  for (const [val, name] of scales) {
    if (rest >= val) {
      out.push(`${wordsUnder1000(Math.floor(rest / val))} ${name}`);
      rest %= val;
    }
  }
  if (rest) out.push(wordsUnder1000(rest));
  return out.join(" ");
}

/** Currency names for the words line; an unknown code prints its own code, never a guessed name. */
const CURRENCY_NAMES: Record<string, [string, string]> = {
  AED: ["Dirhams", "Fils"],
  USD: ["Dollars", "Cents"],
  PKR: ["Rupees", "Paisa"],
  INR: ["Rupees", "Paise"],
  EUR: ["Euros", "Cents"],
  GBP: ["Pounds", "Pence"],
};

export function amountInWords(amount: number, currency: string): string {
  const code = (currency || "").toUpperCase();
  const [main, minor] = CURRENCY_NAMES[code] ?? [code, "Cents"];
  const cents = Math.round(Math.abs(amount) * 100);
  const whole = Math.floor(cents / 100);
  const fils = cents % 100;
  const base = `${integerToWords(whole)} ${main}`;
  return `${base}${fils ? ` and ${integerToWords(fils)} ${minor}` : ""} Only`;
}

/** The title for the bill: its own category name when it is an expenses bill, otherwise the plain title. */
export function expensesBillTitle(billTitle: string | null | undefined): string {
  const t0 = (billTitle ?? "").trim();
  return /expense/i.test(t0) ? t0 : "";
}

export type ExpensesBillRenderOptions = {
  /** the bill's own category name ("Office Expenses Bill" / "Other Expenses Bill"); empty uses the translated "Expenses Bill" */
  title?: string;
};

export function renderExpensesProformaHtml(input: TradeDocumentInput, opts: ExpensesBillRenderOptions = {}): string {
  const lang = String(input.lang || "en");
  const L = (key: string, fallback: string): string => esc(t(lang, key, fallback));
  const goods = input.goods ?? [];
  const currency = input.currency || "AED";
  const totalQty = input.totals?.totalQuantity ?? goods.reduce((s, g) => s + Number(g.quantity ?? 0), 0);
  const taxable = input.totals?.subTotal ?? goods.reduce((s, g) => s + Number(g.amount ?? 0), 0);
  const vat = input.totals?.taxAmount ?? goods.reduce((s, g) => s + Number(g.taxAmount ?? 0), 0);
  const grand = input.totals?.grandTotal ?? taxable + vat;
  const b = input.branding;
  const seller = input.seller;
  const buyer = input.buyer;
  const bank = input.bank;
  // The rate is VAT over the VAT-able lines only, so a 0%-rated line such as import duty does not dilute it.
  const vatableBase = goods.filter((g) => Number(g.taxAmount ?? 0) > 0).reduce((s, g) => s + Number(g.amount ?? 0), 0);
  const vatPctText = vatableBase > 0 ? `${((vat / vatableBase) * 100).toFixed(0)}%` : "—";
  const title = has(opts.title) ? esc(opts.title) : L("expbill.title", "Expenses Bill");
  const logo = b.logoUrl
    ? `<img src="${esc(b.logoUrl)}" alt="" class="logo" />`
    : `<div class="logo-mark">${esc((seller.name || "D").slice(0, 1).toUpperCase())}</div>`;

  const lineRows = goods.length === 0
    ? `<tr><td colspan="9" class="center muted">—</td></tr>`
    : goods.map((g: TradeLineItem, i: number) => {
        const lineTaxable = Number(g.amount ?? 0);
        const lineVat = Number(g.taxAmount ?? 0);
        const linePct = lineTaxable > 0 && g.taxAmount != null ? `${((lineVat / lineTaxable) * 100).toFixed(0)}%` : "—";
        return `<tr>
        <td class="center">${i + 1}</td>
        <td>${dash(g.description)}</td>
        <td class="center">${g.hsCode ? esc(g.hsCode) : "—"}</td>
        <td class="right">${money(g.quantity ?? null)}</td>
        <td class="right">${money(g.unitPrice ?? null)}</td>
        <td class="right">${money(g.amount ?? null)}</td>
        <td class="center">${linePct}</td>
        <td class="right">${money(g.taxAmount ?? null)}</td>
        <td class="right b">${money(g.amount == null ? null : lineTaxable + lineVat)}</td>
      </tr>`;
      }).join("");

  const rtl = RTL.has(lang) ? "rtl" : "ltr";

  return `<!doctype html>
<html lang="${esc(lang)}" dir="${rtl}">
<head>
<meta charset="utf-8" />
<title>${title} — ${esc(input.docNo)}</title>
<style>
  @page { size: A4; margin: 10mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #111; font-size: 11px; background: #fff; }
  .page { width: 190mm; min-height: 277mm; margin: 0 auto; }
  .muted { color: #64748b; }
  .b { font-weight: 700; }
  .center { text-align: center; }
  .right { text-align: right; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 6px; border-bottom: 2px solid #1e3a8a; }
  .co-name { font-size: 22px; font-weight: 800; color: #1e3a8a; letter-spacing: -0.2px; }
  .co-sub { font-size: 10px; margin-top: 4px; line-height: 1.5; }
  .logo { height: 46px; }
  .logo-mark { width: 46px; height: 46px; border-radius: 50%; background: #1e3a8a; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 20px; }
  .title-row { display: flex; gap: 8px; margin-top: 8px; }
  .title-box { flex: 1; background: #dbeafe; border-radius: 6px; padding: 8px 10px; text-align: center; }
  .title-box h2 { margin: 0; font-size: 22px; color: #1e3a8a; font-weight: 800; }
  .refs { flex: 1.2; border: 1px solid #94a3b8; border-radius: 6px; padding: 6px 8px; background: #f8fafc; }
  .refs div { display: flex; justify-content: space-between; font-size: 10.5px; padding: 1px 0; }
  .party { display: flex; gap: 8px; margin-top: 8px; }
  .party > div { flex: 1; border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 8px; }
  .label { font-size: 9.5px; color: #475569; text-transform: uppercase; letter-spacing: .3px; }
  .name { font-weight: 800; font-size: 12px; margin-top: 2px; }
  table.items { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 10.5px; }
  table.items th { background: #1e3a8a; color: #fff; padding: 5px 4px; font-weight: 700; border: 1px solid #1e3a8a; text-align: center; }
  table.items td { border: 1px solid #cbd5e1; padding: 5px 4px; vertical-align: top; }
  table.items tr.totals td { font-weight: 800; background: #f1f5f9; }
  .bottom { display: flex; gap: 8px; margin-top: 8px; }
  .box { border: 1px solid #94a3b8; border-radius: 6px; padding: 6px 8px; }
  .box h4 { margin: 0 0 4px; font-size: 11px; color: #1e3a8a; }
  .kv { display: flex; justify-content: space-between; padding: 2px 0; font-size: 10.5px; }
  .words { margin-top: 8px; background: #dbeafe; border-radius: 6px; padding: 6px 8px; font-style: italic; font-weight: 700; font-size: 11px; }
  .terms { margin-top: 8px; font-size: 10px; line-height: 1.5; }
  .sign { margin-top: 14px; display: flex; justify-content: space-between; align-items: flex-end; font-size: 11px; }
  .sign .line { border-top: 1px solid #111; width: 160px; text-align: center; padding-top: 3px; }
  .footer { margin-top: 10px; border-top: 1px solid #cbd5e1; padding-top: 4px; font-size: 9.5px; color: #475569; display: flex; justify-content: space-between; }
</style>
</head>
<body>
<div class="page">
  <div class="head">
    <div>
      <div class="co-name">${esc(seller.name || b.entityName || "—")}</div>
      <div class="co-sub">
        ${has(seller.address) ? `${esc(seller.address)}<br/>` : ""}
        ${has(seller.phone) ? `${L("cbs.phone_word", "Phone")}: ${esc(seller.phone)}<br/>` : ""}
        ${has(b.website) ? `Web: ${esc(b.website)}<br/>` : ""}
        ${has(seller.email) ? `Email: ${esc(seller.email)}<br/>` : ""}
        ${has(seller.taxId) ? `${L("uae.trn", "TRN")}: ${esc(seller.taxId)}` : ""}
      </div>
    </div>
    <div>${logo}</div>
  </div>

  <div class="title-row">
    <div class="title-box"><h2>${title}</h2></div>
    <div class="refs">
      <div><span>${L("creports.bill_no", "Bill No.")}</span><span class="b">${dash(input.docNo)}</span></div>
      <div><span>${L("pdfui.eip_bill_date", "Bill Date")}</span><span>${dmy(input.docDate)}</span></div>
      <div><span>${L("uae.reference_no", "Reference No.")}</span><span>${dash(input.referenceNos?.po)}</span></div>
      <div><span>${L("uae.ship_mode", "Ship Mode")}</span><span>—</span></div>
      <div><span>${L("uae.import_export", "Import / Export")}</span><span>—</span></div>
      <div><span>${L("uae.awb", "AWB / B/L No.")}</span><span>—</span></div>
    </div>
  </div>

  <div class="party">
    <div>
      <div class="label">${L("uae.ms", "M/S")}</div>
      <div class="name">${dash(buyer.name)}</div>
      <div class="kv"><span class="muted">${L("cbs.phone_word", "Phone")}</span><span>${dash(buyer.phone)}</span></div>
      <div class="kv"><span class="muted">${L("uae.trn", "TRN")}</span><span>${dash(buyer.taxId)}</span></div>
      <div class="kv"><span class="muted">${L("uae.place_of_supply", "Place of Supply")}</span><span>${dash(seller.country)}</span></div>
    </div>
    <div>
      <div class="label">${L("uae.loading_country", "Loading Country")}</div>
      <div class="name">—</div>
      <div class="label" style="margin-top:6px">${L("uae.receiving_country", "Receiving Country")}</div>
      <div class="name">${dash(seller.country)}</div>
    </div>
  </div>

  <table class="items">
    <thead>
      <tr>
        <th style="width:5%">${L("uae.sr", "Sr.")} No.</th>
        <th style="width:30%">${L("uae.product_service", "Name of Product / Service")}</th>
        <th style="width:9%">${L("uae.hs_code", "HS Code")}</th>
        <th style="width:7%">${L("uae.qty", "Qty")}</th>
        <th style="width:10%">${L("uae.rate", "Rate")} (${esc(currency)})</th>
        <th style="width:11%">${L("uae.taxable_value", "Taxable Value")} (${esc(currency)})</th>
        <th style="width:7%">${L("uae.vat_pct", "VAT %")}</th>
        <th style="width:9%">${L("uae.vat_amount", "VAT Amount")} (${esc(currency)})</th>
        <th style="width:12%">${L("uae.total_col", "Total")} (${esc(currency)})</th>
      </tr>
    </thead>
    <tbody>
      ${lineRows}
      <tr class="totals">
        <td colspan="3" class="right">${L("uae.total_qty", "Total Qty")}</td>
        <td class="right">${money(totalQty)}</td>
        <td colspan="2" class="right">${L("uae.taxable_value", "Total Taxable Value")}</td>
        <td class="right">${money(taxable)}</td>
        <td class="right">${money(vat)}</td>
        <td class="right">${money(grand)}</td>
      </tr>
    </tbody>
  </table>

  <div class="bottom">
    <div class="box" style="flex:1">
      <h4>${L("expbill.pricing_basis", "Pricing basis")}</h4>
      <div class="muted" style="font-size:10px">${L("expbill.item_vat_note", "Item-level VAT is shown in the goods table.")}</div>
      <h4 style="margin-top:8px">${L("expbill.other_details", "Other details")}</h4>
      <div class="kv"><span>${L("sales.quot_delivery_label", "Delivery")}</span><span>—</span></div>
      <div class="kv"><span>${L("dintake.x_f_payment", "Payment terms")}</span><span>—</span></div>
    </div>
    <div class="box" style="flex:1">
      <div class="kv"><span>${L("uae.summary_taxable", "Taxable Amount")}</span><span class="b">${esc(currency)} ${money(taxable)}</span></div>
      <div class="kv"><span>${L("uae.total_tax", "Total Tax")}</span><span class="b">${esc(currency)} ${money(vat)}</span></div>
      <div class="kv"><span>${L("uae.total_after_tax", "Total Amount After Tax")}</span><span class="b">${esc(currency)} ${money(grand)}</span></div>
    </div>
  </div>

  <div class="words"><span>${L("rvp.amount_words", "Amount in Words")}:</span> ${esc(amountInWords(grand, currency))}</div>

  <div class="bottom">
    <div class="box" style="flex:1">
      <h4>${L("expbill.bank_details", "Bank details")}</h4>
      <div class="kv"><span>${L("bdash.bank", "Bank")}</span><span>${dash(bank?.bankName)}</span></div>
      <div class="kv"><span>${L("crm.th_branch", "Branch")}</span><span>${dash(bank?.branchName)}</span></div>
      <div class="kv"><span>${L("expbill.beneficiary_name", "Beneficiary name")}</span><span>${dash(bank?.accountTitle)}</span></div>
      <div class="kv"><span>${L("dintake.x_bank_account", "Account no.")}</span><span>${dash(bank?.accountNumber)}</span></div>
      <div class="kv"><span>${L("bank.iban_label", "IBAN")}</span><span>${dash(bank?.iban)}</span></div>
      <div class="kv"><span>${L("pdoc.swift", "SWIFT")}</span><span>${dash(bank?.swift)}</span></div>
    </div>
    <div class="box" style="flex:1">
      <div class="kv"><span>${L("uae.summary_taxable", "Taxable Amount")}</span><span class="b">${esc(currency)} ${money(taxable)}</span></div>
      <div class="kv"><span>${L("uae.add_vat", "Add: VAT")} (${vatPctText})</span><span class="b">${esc(currency)} ${money(vat)}</span></div>
      <div class="kv"><span>${L("uae.total_tax", "Total Tax")}</span><span class="b">${esc(currency)} ${money(vat)}</span></div>
      <div class="kv" style="margin-top:6px;border-top:1px solid #94a3b8;padding-top:4px"><span class="b">${L("uae.total_after_tax", "Total Amount After Tax")}</span><span class="b">${esc(currency)} ${money(grand)}</span></div>
    </div>
  </div>

  <div class="terms">
    <div class="b">${L("uae.terms", "Terms & Conditions")}</div>
    1. ${L("expbill.terms_1", "The charges are for the services listed above only.")}<br/>
    2. ${L("expbill.terms_2", "Government duties, taxes and third-party charges are on actual basis.")}
  </div>

  <div class="sign">
    <div class="muted" style="font-size:10px">${L("extform.issued", "Issued")} ${dmy(input.docDate)}</div>
    <div class="line">${L("uae.authorised_signatory", "Authorised Signatory")}</div>
  </div>

  <div class="footer">
    <span>${dash(seller.address)}</span>
    <span>${dash(seller.phone)}</span>
    <span>${dash(seller.email)}</span>
  </div>
</div>
</body>
</html>`;
}
