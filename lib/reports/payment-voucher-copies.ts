import { t } from "@/lib/i18n/ui";
import { translateHeader } from "@/lib/i18n/table-headers";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { printStore } from "@/lib/store/print-store";
import { A4_SHARED_CSS, escapeReportHtml as e } from "@/lib/reports/report-shell";

import type { PaymentVoucherSide } from "@/lib/reports/payment-voucher-data";
export type PaymentVoucherCopies = {
  number: string; date: string; bill: string; party: string; source: string; reference?: string;
  documentKind: "sales" | "purchase"; goodsNames?: string[];
  debit: PaymentVoucherSide; credit: PaymentVoucherSide;
};

const BILL_LABELS: Record<PaymentVoucherCopies["documentKind"], Record<SupportedLanguage, string>> = {
  sales: { en: "Sales No.", ur: "سیلز نمبر", ar: "رقم البيع", fa: "شماره فروش", ps: "د پلور شمېره" },
  purchase: { en: "Purchase No.", ur: "پرچیز نمبر", ar: "رقم الشراء", fa: "شماره خرید", ps: "د پېرود شمېره" },
};

export function buildPaymentVoucherCopies(data: PaymentVoucherCopies, lang: SupportedLanguage): string {
  const tr = (key: Parameters<typeof t>[1], fallback: string) => t(lang, key, fallback);
  const h = (label: string) => translateHeader(lang, label);
  const title = tr("rvp.print_voucher", "Print Voucher");
  const rtl = ["ar", "fa", "ps", "ur"].includes(lang);
  const money = new Intl.NumberFormat(lang, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  const goods = [...new Set((data.goodsNames ?? []).map(name => name.trim()).filter(Boolean))];
  const billLabel = BILL_LABELS[data.documentKind][lang];
  const renderSide = (side: "DR" | "CR", entry: PaymentVoucherSide) => {
    const label = h(side === "DR" ? "Debit" : "Credit");
    const details = [
      [h("Voucher No"), data.number], [tr("rvp.date", "Date"), data.date],
      [billLabel, data.bill], [h("Party"), data.party],
      [h("Account Number"), entry.accountNumber || "—"],
      [h("Account Name"), entry.name],
      ...(!entry.accountNumber && entry.code ? [[tr("rvp.account_code", "Account Code"), entry.code]] : []),
      [h("Reference"), data.reference],
    ];
    return `<section class="payment-copy" data-side="${side}" aria-label="${side} ${e(label)}">
      <header class="payment-head"><div><strong>ACCOUNTS.DGT.LLC</strong><div>${e(data.source)}</div></div><h1><bdi>${side}</bdi> · ${e(label)}</h1></header>
      <div class="payment-amount"><span>${e(tr("rvp.amount", "Amount"))}</span><strong><bdi>${e(entry.currency)} ${e(money.format(entry.amount))}</bdi></strong></div>
      <dl>${details.filter(([, value]) => value).map(([key, value]) => `<dt>${e(key)}</dt><dd><bdi>${e(value)}</bdi></dd>`).join("")}</dl>
      ${goods.length ? `<div class="payment-goods"><span>${e(h("Goods Name"))}</span><strong>${goods.map(name => `<bdi>${e(name)}</bdi>`).join(" · ")}</strong></div>` : ""}
      <div class="payment-signature">${e(tr("rvp.authorized_by", "Authorized by"))}</div>
    </section>`;
  };
  return `<!doctype html><html lang="${lang}" dir="${rtl ? "rtl" : "ltr"}" data-voucher-portrait="true">
<head><meta charset="utf-8"><meta name="erp-page-count" content="1"><title>${e(title)}</title><style>
${A4_SHARED_CSS}
@page { size: A4 portrait; margin: 6mm; }
*, *::before, *::after { box-sizing: border-box; }
body { background:#fff; }
.payment-copy-sheet { background: #fff; color:#172339; margin:0 auto; width:100%; }
.payment-copy { min-height:133mm; padding:7mm 10mm; display:flex; flex-direction:column; break-inside:avoid; word-break:break-word; }
.payment-head { display:flex; align-items:flex-start; justify-content:space-between; gap:5mm; padding-bottom:4mm; border-bottom:2px solid #23436b; }
.payment-head strong { font-size:16pt; }
.payment-head div div { font-size:10pt; margin-top:1mm; color:#455971; }
.payment-head h1 { margin:0; background:#eef4ff; color:#183d73; border:1px solid #aac3e5; padding:2mm 4mm; border-radius:2mm; font-size:14pt; }
.payment-copy[data-side="CR"] h1 { background:#ebf7ef; color:#196443; border-color:#a7ceb7; }
.payment-amount { display:flex; align-items:center; justify-content:space-between; background:#f2f5f9; padding:2mm 3mm; margin-top:4mm; border-radius:1mm; font-size:11pt; }
.payment-amount strong { font-size:16pt; }
.payment-copy dl { display:grid; grid-template-columns: minmax(30mm,35%) minmax(0,1fr); margin:3mm 0; font-size:10pt; line-height:1.2; }
.payment-copy dt, .payment-copy dd { margin:0; padding:1.3mm 2mm; border-bottom:1px solid #dce4ef; }
.payment-copy dt { color:#43546b; }
.payment-copy dd { font-weight:700; overflow-wrap:anywhere; }
.payment-goods { background:#f2f5f9; padding:2mm 3mm; border-radius:1mm; margin:0 0 3mm; font-size:10pt; overflow-wrap:anywhere; }
.payment-goods span { font-weight:600; margin-inline-end:3mm; color:#43546b; }
.payment-signature { align-self:flex-end; width:46mm; padding-top:1.5mm; margin-top:auto; border-top:1px solid #67788f; font-size:9pt; text-align:center; }
.payment-cut { position:relative; height:8mm; display:grid; place-items:center; color:#53657b; font-weight:700; font-size:9pt; }
.payment-cut::before { content:""; position:absolute; inset-inline:0; top:50%; border-top:1.5px dashed #65758a; }
.payment-cut span { position:relative; background:#fff; padding:0 3mm; }
@media screen { body > [data-pdf-flow] { width:calc(100% - 12mm); margin:11.5mm auto 0; } }
</style></head><body><main data-pdf-flow><article class="pdf-block payment-copy-sheet">
${renderSide("DR", data.debit)}
<div class="payment-cut"><span>✂ ${e(tr("rvp.cut_here", "Cut here"))}</span></div>
${renderSide("CR", data.credit)}
</article></main></body></html>`;
}

export function printPaymentVoucherCopies(data: PaymentVoucherCopies, lang: SupportedLanguage) {
  printStore.openPrint(buildPaymentVoucherCopies(data, lang), `${t(lang, "rvp.print_voucher", "Print Voucher")} · ${data.number}`, { lang });
}
