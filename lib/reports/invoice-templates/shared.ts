/**
 * Shared data-preparation layer for the 4 hand-built invoice templates
 * (modern / professional / compact / premium). "Classic" deliberately reuses
 * the existing `buildTradeDocumentHtml` engine as-is (see classic.ts) rather
 * than going through this normalizer.
 *
 * This module turns a `TradeDocumentInput` (+ display flags) into plain,
 * pre-formatted ROW DATA — never HTML. Each template then arranges that data
 * into its own markup/CSS, so five templates can look genuinely different
 * while sharing one source of truth for what the numbers/labels ARE.
 */

import { t } from "@/lib/i18n/ui";
import { numberToWords } from "@/lib/utils/number-to-words";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import type { TradeDocumentInput, TradeParty, TradeLineItem } from "@/lib/reports/trade-documents/types";
import { docTitleKeyFor } from "@/lib/reports/trade-documents/build-trade-document";
import type { InvoiceTemplateFlags } from "./types";

export function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export const isReal = (v: unknown) => {
  const s = String(v ?? "").trim();
  return s !== "" && !/^(n\/?a|none|null|undefined|-+)$/i.test(s);
};

export function money(v: unknown, opts: { dp?: number } = {}): string {
  const num = Number(v);
  return Number.isFinite(num)
    ? num.toLocaleString(undefined, { minimumFractionDigits: opts.dp ?? 2, maximumFractionDigits: opts.dp ?? 2 })
    : "";
}

export function num(v: unknown): string {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: 3 }) : "";
}

export function fmtDate(v: string | null | undefined): string {
  if (!v) return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export type Row = { label: string; value: string };

export type PreparedParty = { title: string; name: string; rows: Row[] } | null;

export type GoodsColumn = { key: string; label: string; align: "l" | "r" | "c" };

export type PreparedInvoice = {
  lang: SupportedLanguage;
  dir: "rtl" | "ltr";
  isRtl: boolean;
  docTitle: string;
  scopeLabel: string;
  brandName: string;
  brandLines: string[];
  logoUrl: string | null;
  docNo: string;
  docDate: string;
  metaRows: Row[];
  seller: PreparedParty;
  buyer: PreparedParty;
  notify: PreparedParty;
  deliveryRows: Row[];
  transportRows: Row[];
  isPacking: boolean;
  showPrices: boolean;
  goodsColumns: GoodsColumn[];
  goodsRows: string[][];
  totalsRowCells: string[];
  financialRows: Row[];
  grandTotalLabel: string;
  grandTotalValue: string;
  amountInWords: string | null;
  showBank: boolean;
  bankRows: Row[];
  notes: string | null;
  signatureName: string;
  preparedByLabel: string;
  currency: string;
  stamp: string;
  qrLabel: string;
  pageLabel: string;
  ofLabel: string;
  flags: InvoiceTemplateFlags;
};

function partyRows(p: TradeParty | null | undefined, tt: (k: string, f: string) => string): Row[] {
  if (!p) return [];
  const rows: Row[] = [];
  if (isReal(p.address)) rows.push({ label: "", value: String(p.address) });
  if (!isReal(p.address) && isReal(p.country)) rows.push({ label: "", value: String(p.country) });
  if (isReal(p.phone)) rows.push({ label: tt("tdoc.phone", "Phone"), value: String(p.phone) });
  if (isReal(p.email)) rows.push({ label: tt("tdoc.email", "Email"), value: String(p.email) });
  if (isReal(p.taxId)) rows.push({ label: tt("tdoc.tax_id", "Tax / TRN"), value: String(p.taxId) });
  return rows;
}

function cellFor(li: TradeLineItem, key: string, tt: (k: string, f: string) => string): string {
  switch (key) {
    case "description": {
      const bits = [li.description, li.brand ? `${tt("tdoc.brand", "Brand")}: ${li.brand}` : "", li.size ? `${tt("tdoc.size", "Size")}: ${li.size}` : ""].filter(isReal);
      return bits.join(" — ");
    }
    case "hs": return String(li.hsCode || "");
    case "packing": return String(li.packing || "");
    case "packages": return num(li.packages);
    case "qty": return `${num(li.quantity)}${isReal(li.unit) ? ` ${li.unit}` : ""}`;
    case "netWt": return num(li.netWeight);
    case "grossWt": return num(li.grossWeight);
    case "unitPrice": return money(li.unitPrice);
    case "discount": return money(li.discount);
    case "tax": return money(li.taxAmount);
    case "amount": return money(li.amount);
    default: return "";
  }
}

/** Prepare normalized, pre-formatted row data for the 4 hand-built templates. */
export function prepareInvoiceData(input: TradeDocumentInput, flags: InvoiceTemplateFlags): PreparedInvoice {
  const lang = (input.lang || "en") as SupportedLanguage;
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);
  const tt = (key: string, fallback: string) => t(lang, key as never, fallback);
  const dir = isRtl ? "rtl" : "ltr";

  const b = input.branding;
  const brandName = isReal(b.entityName) ? b.entityName! : tt("tdoc.brand_fallback", "Digital Dock ERP");
  const brandLines = [b.address, [b.phone, b.email, b.website].filter(Boolean).join("  •  ") || null,
    [b.registrationNumber ? `Reg: ${b.registrationNumber}` : null, b.taxNumber ? `Tax/TRN: ${b.taxNumber}` : null].filter(Boolean).join("   ") || null]
    .filter((x): x is string => Boolean(x));

  const isPacking = input.docType === "packing_list";
  const isContract = input.docType === "contract";
  const isProforma = input.docType === "proforma_invoice" || isContract;
  const showPrices = !isPacking;

  const [titleKey, titleFb] = docTitleKeyFor(input);
  const docTitle = tt(titleKey, titleFb);
  const scopeLabel = input.tradeScope === "local" ? tt("tdoc.scope_local", "Local") : tt("tdoc.scope_international", "International");

  const refs = input.referenceNos || {};
  const metaRows: Row[] = [
    { label: tt("tdoc.doc_no", "Document No."), value: input.docNo },
    { label: tt("tdoc.doc_date", "Date"), value: fmtDate(input.docDate) },
    ...(isReal(refs.contract) ? [{ label: tt("tdoc.contract_no", "Contract No."), value: String(refs.contract) }] : []),
    ...(isReal(input.txnKind === "sales" ? refs.so : refs.po) ? [{
      label: tt(input.txnKind === "sales" ? "tdoc.so_no" : "tdoc.po_no", input.txnKind === "sales" ? "Sales Order No." : "Purchase Order No."),
      value: String(input.txnKind === "sales" ? refs.so : refs.po),
    }] : []),
    ...(isReal(refs.invoice) ? [{ label: tt("tdoc.invoice_no", "Invoice No."), value: String(refs.invoice) }] : []),
    ...(isProforma && isReal(refs.quotation) ? [{ label: tt("tdoc.quotation_no", "Quotation No."), value: String(refs.quotation) }] : []),
    { label: tt("tdoc.currency", "Currency"), value: input.currency },
  ];

  const sellerLabel = isPacking ? ["tdoc.shipper", "Shipper / Exporter"] : ["tdoc.seller", "Seller / Shipper"];
  const buyerLabel = isPacking ? ["tdoc.consignee", "Consignee"] : ["tdoc.buyer", "Buyer / Consignee"];

  const mkParty = (labelKey: string, labelFb: string, p: TradeParty | null | undefined): PreparedParty =>
    p && isReal(p.name) ? { title: tt(labelKey, labelFb), name: String(p.name), rows: partyRows(p, tt) } : null;

  const seller = mkParty(sellerLabel[0], sellerLabel[1], input.seller);
  const buyer = mkParty(buyerLabel[0], buyerLabel[1], input.buyer);
  const notify = mkParty("tdoc.notify_party", "Notify Party", input.notifyParty);

  const d = input.delivery || {};
  const deliveryRows: Row[] = flags.showTerms ? [
    ...(isReal(d.incoterms) ? [{ label: tt("tdoc.incoterms", "Incoterms"), value: String(d.incoterms) }] : []),
    ...(isReal(d.deliveryTerms) ? [{ label: tt("tdoc.delivery_terms", "Delivery Terms"), value: String(d.deliveryTerms) }] : []),
    ...(isReal(d.paymentTerms) ? [{ label: tt("tdoc.payment_terms", "Payment Terms"), value: String(d.paymentTerms) }] : []),
    ...(isProforma && isReal(input.validity) ? [{ label: tt("tdoc.validity", "Validity"), value: String(input.validity) }] : []),
  ] : [];

  const tr = input.transport;
  const showTransport = input.tradeScope === "international" && !!tr && Object.values(tr).some((v) => Array.isArray(v) ? v.length : isReal(v));
  const transportRows: Row[] = showTransport && tr ? [
    ...(isReal(tr.mode) ? [{ label: tt("tdoc.transport_mode", "Transport Mode"), value: String(tr.mode) }] : []),
    ...(isReal(tr.vessel) ? [{ label: tt("tdoc.vessel", "Vessel / Vehicle"), value: String(tr.vessel) }] : []),
    ...(isReal(tr.portOfLoading) ? [{ label: tt("tdoc.port_loading", "Port of Loading"), value: `${tr.portOfLoading}${isReal(tr.loadingCountry) ? `, ${tr.loadingCountry}` : ""}` }] : []),
    ...(isReal(tr.portOfDischarge) ? [{ label: tt("tdoc.port_discharge", "Port of Discharge"), value: `${tr.portOfDischarge}${isReal(tr.dischargeCountry) ? `, ${tr.dischargeCountry}` : ""}` }] : []),
    ...(isReal(tr.shippingLine) ? [{ label: tt("tdoc.shipping_line", "Shipping Line"), value: String(tr.shippingLine) }] : []),
    ...(isReal(tr.blNumber) ? [{ label: tt("tdoc.bl_no", "B/L No."), value: String(tr.blNumber) }] : []),
    ...((tr.containers && tr.containers.length) ? [{ label: tt("tdoc.containers", "Container(s)"), value: tr.containers.join(", ") }] : []),
  ] : [];

  const hasDiscount = flags.showDiscount && input.goods.some((g) => isReal(g.discount));
  const hasLineTax = flags.showTax && input.goods.some((g) => isReal(g.taxAmount));

  const goodsColumns: GoodsColumn[] = [{ key: "description", label: tt("tdoc.col_description", "Description of Goods"), align: "l" }];
  if (isPacking) {
    goodsColumns.push(
      { key: "packing", label: tt("tdoc.col_packing", "Packing"), align: "l" },
      { key: "packages", label: tt("tdoc.col_packages", "Packages"), align: "r" },
      { key: "qty", label: tt("tdoc.col_qty", "Quantity"), align: "r" },
      { key: "netWt", label: tt("tdoc.col_net_wt", "Net Wt (KG)"), align: "r" },
      { key: "grossWt", label: tt("tdoc.col_gross_wt", "Gross Wt (KG)"), align: "r" },
    );
  } else {
    goodsColumns.push(
      { key: "qty", label: tt("tdoc.col_qty", "Quantity"), align: "r" },
      { key: "unitPrice", label: tt("tdoc.col_unit_price", "Unit Price"), align: "r" },
    );
    if (hasDiscount) goodsColumns.push({ key: "discount", label: tt("invtpl.col_discount", "Discount"), align: "r" });
    if (hasLineTax) goodsColumns.push({ key: "tax", label: tt("tdoc.tax", "Tax / VAT"), align: "r" });
    goodsColumns.push({ key: "amount", label: tt("tdoc.col_amount", "Amount"), align: "r" });
  }

  const goodsRows = input.goods.map((li) => goodsColumns.map((c) => cellFor(li, c.key, tt)));

  const totals = input.totals || {};
  const grand = Number(totals.grandTotal ?? totals.subTotal ?? input.goods.reduce((s, g) => s + (Number(g.amount) || 0), 0));

  const totalsRowCells = goodsColumns.map((c) => {
    if (c.key === "description") return tt("tdoc.totals", "TOTALS");
    if (c.key === "packages") return num(totals.totalPackages);
    if (c.key === "qty") return num(totals.totalQuantity);
    if (c.key === "netWt") return num(totals.totalNetWeight);
    if (c.key === "grossWt") return num(totals.totalGrossWeight);
    if (c.key === "amount") return `${money(grand)} ${input.currency}`;
    return "";
  });

  const fxLine: Row[] = (isReal(input.exchangeRate) && Number(input.exchangeRate) !== 1 && isReal(input.functionalCurrency) && input.functionalCurrency !== input.currency)
    ? [
        { label: tt("tdoc.exchange_rate", "Exchange Rate (frozen)"), value: `1 ${input.currency} = ${num(input.exchangeRate)} ${input.functionalCurrency}` },
        { label: tt("tdoc.functional_total", "Total in Functional Currency"), value: `${money(grand * Number(input.exchangeRate))} ${input.functionalCurrency}` },
      ]
    : [];

  const financialRows: Row[] = !isPacking ? [
    ...(isReal(totals.subTotal) ? [{ label: tt("tdoc.subtotal", "Subtotal"), value: `${money(totals.subTotal)} ${input.currency}` }] : []),
    ...(isReal(totals.freight) ? [{ label: tt("tdoc.freight", "Freight"), value: `${money(totals.freight)} ${input.currency}` }] : []),
    ...(isReal(totals.insurance) ? [{ label: tt("tdoc.insurance", "Insurance"), value: `${money(totals.insurance)} ${input.currency}` }] : []),
    ...(flags.showTax && isReal(totals.taxAmount) ? [{ label: tt("tdoc.tax", "Tax / VAT"), value: `${money(totals.taxAmount)} ${input.currency}` }] : []),
    ...(isReal(totals.advanceAmount) ? [{ label: tt("tdoc.advance", "Advance"), value: `${money(totals.advanceAmount)} ${input.currency}` }] : []),
    ...(isReal(totals.balanceAmount) ? [{ label: tt("tdoc.balance", "Balance Due"), value: `${money(totals.balanceAmount)} ${input.currency}` }] : []),
    ...fxLine,
  ] : [];

  const showBank = flags.showBankDetails && !isPacking && !!input.bank && (isReal(input.bank.bankName) || isReal(input.bank.iban) || isReal(input.bank.accountNumber));
  const bankRows: Row[] = showBank && input.bank ? [
    ...(isReal(input.bank.bankName) ? [{ label: tt("tdoc.bank_name", "Bank Name"), value: String(input.bank.bankName) }] : []),
    ...(isReal(input.bank.branchName) ? [{ label: tt("tdoc.bank_branch", "Branch"), value: String(input.bank.branchName) }] : []),
    ...(isReal(input.bank.accountTitle) ? [{ label: tt("tdoc.account_title", "Account Title"), value: String(input.bank.accountTitle) }] : []),
    ...(isReal(input.bank.accountNumber) ? [{ label: tt("tdoc.account_number", "Account No."), value: String(input.bank.accountNumber) }] : []),
    ...(isReal(input.bank.iban) ? [{ label: tt("tdoc.iban", "IBAN"), value: String(input.bank.iban) }] : []),
    ...(isReal(input.bank.swift) ? [{ label: tt("tdoc.swift", "SWIFT / BIC"), value: String(input.bank.swift) }] : []),
  ] : [];

  const now = new Date();
  const stamp = `${now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} ${now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;

  return {
    lang, dir, isRtl,
    docTitle, scopeLabel,
    brandName, brandLines,
    logoUrl: flags.showLogo && isReal(b.logoUrl) && /^(https?:\/\/|data:|\/)/.test(String(b.logoUrl)) ? b.logoUrl : null,
    docNo: input.docNo,
    docDate: fmtDate(input.docDate),
    metaRows,
    seller, buyer, notify,
    deliveryRows, transportRows,
    isPacking, showPrices,
    goodsColumns, goodsRows, totalsRowCells,
    financialRows,
    grandTotalLabel: tt("tdoc.grand_total", "Grand Total"),
    grandTotalValue: `${money(grand)} ${input.currency}`,
    amountInWords: !isPacking ? `${tt("tdoc.amount_in_words", "Amount in words")}: ${numberToWords(Math.round(grand))} ${input.currency}` : null,
    showBank, bankRows,
    notes: isReal(input.notes) ? String(input.notes) : null,
    signatureName: input.signatureName || tt("tdoc.sign_authorized", "Authorized Signature & Stamp"),
    preparedByLabel: tt("tdoc.sign_prepared", "Prepared By"),
    currency: input.currency,
    stamp,
    qrLabel: tt("invtpl.qr_placeholder", "Scan to verify"),
    pageLabel: tt("tdoc.page", "Page"),
    ofLabel: tt("tdoc.of", "of"),
    flags,
  };
}

/** Shared inline-SVG QR-code PLACEHOLDER (no external asset, no network call). */
export function qrPlaceholderSvg(size = 60): string {
  const cells = [
    "1110101","1000110","1011101","1011001","1000010","1110111","0000000",
  ];
  const cell = size / 9;
  let rects = "";
  cells.forEach((row, y) => {
    row.split("").forEach((v, x) => {
      if (v === "1") rects += `<rect x="${(x + 1) * cell}" y="${(y + 1) * cell}" width="${cell}" height="${cell}" fill="#0f172a"/>`;
    });
  });
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg"><rect width="${size}" height="${size}" fill="#fff"/>${rects}<rect x="0.5" y="0.5" width="${size - 1}" height="${size - 1}" fill="none" stroke="#cbd5e1"/></svg>`;
}

/** Common `@page`/print doctype wrapper every hand-built template shares. */
export function documentShell(opts: {
  lang: string; dir: "rtl" | "ltr"; title: string; docNo: string; docTitle: string; brandName: string; stamp: string;
  orientation: "portrait" | "landscape"; style: string; body: string; autoPrint?: boolean; pageLabel: string; ofLabel: string;
}): string {
  const { lang, dir, title, docNo, docTitle, brandName, stamp, orientation, style, body, autoPrint, pageLabel, ofLabel } = opts;
  return `<!doctype html>
<html lang="${esc(lang)}" dir="${dir}">
<head>
<meta charset="utf-8" />
<title>${esc(title)} — ${esc(docNo)}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Poppins:wght@400;500;600;700;800&family=Georgia&family=Noto+Naskh+Arabic:wght@400;600;700&family=Noto+Nastaliq+Urdu:wght@400;600;700&display=swap');
  @page {
    size: A4 ${orientation};
    margin: 12mm 10mm 14mm 10mm;
    @bottom-right { content: "${esc(pageLabel)} " counter(page) " ${esc(ofLabel)} " counter(pages); font-size: 7pt; color: #64748b; font-weight: 700; }
    @bottom-left { content: "${esc(docNo)}"; font-size: 7pt; color: #94a3b8; font-weight: 700; }
    @top-right { content: "${esc(brandName)} — ${esc(docTitle)}"; font-size: 7pt; color: #94a3b8; }
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  html[lang="ur"] body { font-family: 'Noto Nastaliq Urdu', 'Noto Naskh Arabic', 'Inter', serif; }
  html[lang="ar"] body, html[lang="fa"] body, html[lang="ps"] body { font-family: 'Noto Naskh Arabic', 'Inter', sans-serif; }
  ${style}
  @media print { body { background: #fff; } .wrap { padding: 0; } .page { border: none !important; box-shadow: none !important; border-radius: 0 !important; padding: 0 !important; width: 100% !important; } .no-print { display: none !important; } }
</style>
</head>
<body>
${body}
${autoPrint ? `<script>window.addEventListener('load',function(){setTimeout(function(){window.print();},400);});</script>` : ""}
</body>
</html>`;
}
