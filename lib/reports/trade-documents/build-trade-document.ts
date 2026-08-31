/**
 * Trade Document engine — ONE builder for Commercial Invoice, Packing List and
 * Proforma Invoice, for International or Local Purchase/Sales transactions.
 *
 * - Professional A4 (portrait/landscape), `@page` running header + real
 *   "Page X of Y" via `counter(page)`.
 * - Every label renders through the central i18n dict (`tdoc.*`) in the active
 *   language with correct RTL/LTR.
 * - Dynamic branding from `DocumentBranding` (no hardcoded company).
 * - Sections render CONDITIONALLY — a Local transaction (no transport) never
 *   shows empty shipping/port/BL blocks; Packing List shows no prices.
 * - Reads the source record's frozen exchange rate — never invents FX.
 */

import { t } from "@/lib/i18n/ui";
import { numberToWords } from "@/lib/utils/number-to-words";
import { printStore } from "@/lib/store/print-store";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { brandLinesFor } from "@/lib/reports/resolve-document-branding";
import type { TradeDocumentInput, TradeParty, TradeLineItem } from "./types";

export type { TradeDocumentInput } from "./types";

function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
const isReal = (v: unknown) => {
  const s = String(v ?? "").trim();
  return s !== "" && !/^(n\/?a|none|null|undefined|-+)$/i.test(s);
};
function money(v: unknown, opts: { dp?: number } = {}): string {
  const n = Number(v);
  return Number.isFinite(n)
    ? n.toLocaleString(undefined, { minimumFractionDigits: opts.dp ?? 2, maximumFractionDigits: opts.dp ?? 2 })
    : "";
}
function num(v: unknown): string {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: 3 }) : "";
}
function fmtDate(v: string | null | undefined): string {
  if (!v) return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

const DOC_TITLE_KEY: Record<Exclude<TradeDocumentInput["docType"], "contract">, [string, string]> = {
  commercial_invoice: ["tdoc.t_commercial_invoice", "Commercial Invoice"],
  export_invoice: ["tdoc.t_export_invoice", "Export Invoice"],
  packing_list: ["tdoc.t_packing_list", "Packing List"],
  proforma_invoice: ["tdoc.t_proforma_invoice", "Proforma Invoice"],
};

function docTitleKeyFor(input: TradeDocumentInput): [string, string] {
  if (input.docType === "contract") {
    return input.txnKind === "sales"
      ? ["tdoc.t_sales_contract", "Sales Contract"]
      : ["tdoc.t_purchase_contract", "Purchase Contract"];
  }
  return DOC_TITLE_KEY[input.docType];
}

export function buildTradeDocumentHtml(input: TradeDocumentInput): string {
  const lang = (input.lang || "en") as SupportedLanguage;
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);
  const tt = (key: string, fallback: string) => t(lang, key as never, fallback);
  const dir = isRtl ? "rtl" : "ltr";
  const orientation = input.orientation || "portrait";

  const b = input.branding;
  const brandName = isReal(b.entityName) ? b.entityName! : tt("tdoc.brand_fallback", "Digital Dock ERP");
  const brandLines = brandLinesFor(b);
  const isContract = input.docType === "contract";
  const isPacking = input.docType === "packing_list";
  // A contract shares the proforma layout (prices, payment/bank terms, validity,
  // dual signature) — only the heading differs.
  const isProforma = input.docType === "proforma_invoice" || isContract;
  const showTransport = input.tradeScope === "international" && input.transport
    && Object.values(input.transport).some((v) => Array.isArray(v) ? v.length : isReal(v));
  const showBank = !!input.bank && (isReal(input.bank.bankName) || isReal(input.bank.iban) || isReal(input.bank.accountNumber));

  const [titleKey, titleFb] = docTitleKeyFor(input);
  const docTitle = tt(titleKey, titleFb);
  const scopeLabel = input.tradeScope === "local"
    ? tt("tdoc.scope_local", "Local")
    : tt("tdoc.scope_international", "International");

  const totals = input.totals || {};
  const grand = Number(totals.grandTotal ?? totals.subTotal ?? input.goods.reduce((s, g) => s + (Number(g.amount) || 0), 0));

  // ---- party block -----------------------------------------------------------
  const party = (labelKey: string, labelFb: string, p: TradeParty | null | undefined) => {
    if (!p || !isReal(p.name)) return "";
    const rows = [
      isReal(p.address) ? `<div>${esc(p.address)}</div>` : "",
      isReal(p.country) && !isReal(p.address) ? `<div>${esc(p.country)}</div>` : "",
      isReal(p.phone) ? `<div><span class="k">${tt("tdoc.phone", "Phone")}:</span> ${esc(p.phone)}</div>` : "",
      isReal(p.email) ? `<div><span class="k">${tt("tdoc.email", "Email")}:</span> ${esc(p.email)}</div>` : "",
      isReal(p.taxId) ? `<div><span class="k">${tt("tdoc.tax_id", "Tax / TRN")}:</span> ${esc(p.taxId)}</div>` : "",
    ].filter(Boolean).join("");
    return `<div class="party">
      <div class="party-h">${esc(tt(labelKey, labelFb))}</div>
      <div class="party-name">${esc(p.name)}</div>
      ${rows}
    </div>`;
  };

  const sellerLabel = input.docType === "packing_list"
    ? ["tdoc.shipper", "Shipper / Exporter"]
    : ["tdoc.seller", "Seller / Shipper"];
  const buyerLabel = input.docType === "packing_list"
    ? ["tdoc.consignee", "Consignee"]
    : ["tdoc.buyer", "Buyer / Consignee"];

  const partiesHtml = `<div class="grid2">
    ${party(sellerLabel[0], sellerLabel[1], input.seller)}
    ${party(buyerLabel[0], buyerLabel[1], input.buyer)}
    ${party("tdoc.notify_party", "Notify Party", input.notifyParty)}
  </div>`;

  // ---- reference / meta bar -------------------------------------------------
  const refs = input.referenceNos || {};
  const metaCell = (labelKey: string, labelFb: string, val: unknown) =>
    isReal(val) ? `<div class="meta-c"><span class="k">${esc(tt(labelKey, labelFb))}</span><span class="v">${esc(val)}</span></div>` : "";
  const metaHtml = `<div class="meta-bar">
    ${metaCell("tdoc.doc_no", "Document No.", input.docNo)}
    ${metaCell("tdoc.doc_date", "Date", fmtDate(input.docDate))}
    ${metaCell("tdoc.contract_no", "Contract No.", refs.contract)}
    ${metaCell(input.txnKind === "sales" ? "tdoc.so_no" : "tdoc.po_no", input.txnKind === "sales" ? "Sales Order No." : "Purchase Order No.", input.txnKind === "sales" ? refs.so : refs.po)}
    ${metaCell("tdoc.invoice_no", "Invoice No.", refs.invoice)}
    ${isProforma ? metaCell("tdoc.quotation_no", "Quotation No.", refs.quotation) : ""}
    ${metaCell("tdoc.booking_no", "Booking Ref.", refs.booking)}
    ${metaCell("tdoc.currency", "Currency", input.currency)}
    ${input.tradeScope === "international" ? metaCell("tdoc.trade_scope", "Trade Scope", scopeLabel) : ""}
  </div>`;

  // ---- delivery / transport ----------------------------------------------
  const d = input.delivery || {};
  const deliveryHtml = (isReal(d.incoterms) || isReal(d.paymentTerms) || isReal(d.deliveryTerms) || showTransport)
    ? `<div class="section">
        <div class="section-h">${esc(tt("tdoc.sec_delivery", "Delivery & Terms"))}</div>
        <div class="grid2">
          <table class="kv">
            ${isReal(d.incoterms) ? `<tr><td>${tt("tdoc.incoterms", "Incoterms")}</td><td>${esc(d.incoterms)}</td></tr>` : ""}
            ${isReal(d.deliveryTerms) ? `<tr><td>${tt("tdoc.delivery_terms", "Delivery Terms")}</td><td>${esc(d.deliveryTerms)}</td></tr>` : ""}
            ${isReal(d.paymentTerms) ? `<tr><td>${tt("tdoc.payment_terms", "Payment Terms")}</td><td>${esc(d.paymentTerms)}</td></tr>` : ""}
            ${isReal(input.validity) && isProforma ? `<tr><td>${tt("tdoc.validity", "Validity")}</td><td>${esc(input.validity)}</td></tr>` : ""}
          </table>
          ${showTransport ? `<table class="kv">
            ${isReal(input.transport!.mode) ? `<tr><td>${tt("tdoc.transport_mode", "Transport Mode")}</td><td>${esc(input.transport!.mode)}</td></tr>` : ""}
            ${isReal(input.transport!.vessel) ? `<tr><td>${tt("tdoc.vessel", "Vessel / Vehicle")}</td><td>${esc(input.transport!.vessel)}</td></tr>` : ""}
            ${isReal(input.transport!.portOfLoading) ? `<tr><td>${tt("tdoc.port_loading", "Port of Loading")}</td><td>${esc(input.transport!.portOfLoading)}${isReal(input.transport!.loadingCountry) ? `, ${esc(input.transport!.loadingCountry)}` : ""}</td></tr>` : ""}
            ${isReal(input.transport!.portOfDischarge) ? `<tr><td>${tt("tdoc.port_discharge", "Port of Discharge")}</td><td>${esc(input.transport!.portOfDischarge)}${isReal(input.transport!.dischargeCountry) ? `, ${esc(input.transport!.dischargeCountry)}` : ""}</td></tr>` : ""}
            ${isReal(input.transport!.placeOfDelivery) ? `<tr><td>${tt("tdoc.place_delivery", "Place of Delivery")}</td><td>${esc(input.transport!.placeOfDelivery)}</td></tr>` : ""}
            ${isReal(input.transport!.finalDestination) ? `<tr><td>${tt("tdoc.final_destination", "Final Destination")}</td><td>${esc(input.transport!.finalDestination)}</td></tr>` : ""}
            ${isReal(input.transport!.shippingLine) ? `<tr><td>${tt("tdoc.shipping_line", "Shipping Line")}</td><td>${esc(input.transport!.shippingLine)}</td></tr>` : ""}
            ${isReal(input.transport!.blNumber) ? `<tr><td>${tt("tdoc.bl_no", "B/L No.")}</td><td>${esc(input.transport!.blNumber)}</td></tr>` : ""}
            ${(input.transport!.containers && input.transport!.containers.length) ? `<tr><td>${tt("tdoc.containers", "Container(s)")}</td><td>${esc(input.transport!.containers.join(", "))}${isReal(input.transport!.containerSize) ? ` (${esc(input.transport!.containerSize)})` : ""}</td></tr>` : ""}
            ${isReal(input.transport!.marks) ? `<tr><td>${tt("tdoc.marks", "Marks & Numbers")}</td><td>${esc(input.transport!.marks)}</td></tr>` : ""}
          </table>` : ""}
        </div>
      </div>`
    : "";

  // ---- goods table -------------------------------------------------------
  const showPrices = !isPacking;
  const cols: Array<[string, string, "l" | "r" | "c"]> = [
    ["tdoc.col_sr", "S/N", "c"],
    ["tdoc.col_description", "Description of Goods", "l"],
    ["tdoc.col_hs", "HS / PCT Code", "l"],
  ];
  if (isPacking) {
    cols.push(["tdoc.col_packing", "Packing", "l"], ["tdoc.col_packages", "Packages", "r"],
      ["tdoc.col_qty", "Quantity", "r"], ["tdoc.col_net_wt", "Net Wt (KG)", "r"], ["tdoc.col_gross_wt", "Gross Wt (KG)", "r"]);
  } else {
    cols.push(["tdoc.col_qty", "Quantity", "r"], ["tdoc.col_net_wt", "Net Wt (KG)", "r"],
      ["tdoc.col_unit_price", "Unit Price", "r"], ["tdoc.col_amount", "Amount", "r"]);
  }

  const cell = (li: TradeLineItem, key: string): string => {
    switch (key) {
      case "tdoc.col_description": {
        const bits = [li.description, li.brand ? `${tt("tdoc.brand", "Brand")}: ${li.brand}` : "", li.size ? `${tt("tdoc.size", "Size")}: ${li.size}` : ""].filter(isReal);
        return bits.map((x, i) => i === 0 ? `<strong>${esc(x)}</strong>` : `<span class="sub">${esc(x)}</span>`).join("<br/>");
      }
      case "tdoc.col_hs": return esc(li.hsCode || "");
      case "tdoc.col_packing": return esc(li.packing || "");
      case "tdoc.col_packages": return num(li.packages);
      case "tdoc.col_qty": return `${num(li.quantity)}${isReal(li.unit) ? ` ${esc(li.unit)}` : ""}`;
      case "tdoc.col_net_wt": return num(li.netWeight);
      case "tdoc.col_gross_wt": return num(li.grossWeight);
      case "tdoc.col_unit_price": return money(li.unitPrice);
      case "tdoc.col_amount": return money(li.amount);
      default: return "";
    }
  };

  const goodsRows = input.goods.length
    ? input.goods.map((li, i) => `<tr>${cols.map(([key, , al], ci) => {
        const v = ci === 0 ? String(i + 1) : cell(li, key);
        return `<td class="a-${al}">${v}</td>`;
      }).join("")}</tr>`).join("")
    : `<tr><td class="a-c" colspan="${cols.length}">${esc(tt("tdoc.no_goods", "No goods lines on this transaction."))}</td></tr>`;

  const totalsRowCells = cols.map(([key], ci) => {
    if (ci === 0) return `<td class="a-l"><strong>${esc(tt("tdoc.totals", "TOTALS"))}</strong></td>`;
    if (key === "tdoc.col_packages") return `<td class="a-r"><strong>${num(totals.totalPackages)}</strong></td>`;
    if (key === "tdoc.col_qty") return `<td class="a-r"><strong>${num(totals.totalQuantity)}</strong></td>`;
    if (key === "tdoc.col_net_wt") return `<td class="a-r"><strong>${num(totals.totalNetWeight)}</strong></td>`;
    if (key === "tdoc.col_gross_wt") return `<td class="a-r"><strong>${num(totals.totalGrossWeight)}</strong></td>`;
    if (key === "tdoc.col_amount") return `<td class="a-r"><strong>${money(grand)} ${esc(input.currency)}</strong></td>`;
    return `<td></td>`;
  }).join("");

  const goodsHtml = `<div class="section">
    <div class="section-h">${esc(isPacking ? tt("tdoc.sec_packing", "Packing Details") : tt("tdoc.sec_goods", "Description & Value of Goods"))}</div>
    <table class="goods">
      <thead><tr>${cols.map(([key, fb, al]) => `<th class="a-${al}">${esc(tt(key, fb))}</th>`).join("")}</tr></thead>
      <tbody>${goodsRows}</tbody>
      <tfoot><tr class="totals">${totalsRowCells}</tr></tfoot>
    </table>
  </div>`;

  // ---- financial summary (not for packing list) -------------------------
  let financialHtml = "";
  if (!isPacking) {
    const fxLine = (isReal(input.exchangeRate) && Number(input.exchangeRate) !== 1 && isReal(input.functionalCurrency) && input.functionalCurrency !== input.currency)
      ? `<tr><td>${tt("tdoc.exchange_rate", "Exchange Rate (frozen)")}</td><td>1 ${esc(input.currency)} = ${num(input.exchangeRate)} ${esc(input.functionalCurrency)}</td></tr>
         <tr><td>${tt("tdoc.functional_total", "Total in Functional Currency")}</td><td>${money(grand * Number(input.exchangeRate))} ${esc(input.functionalCurrency)}</td></tr>`
      : "";
    financialHtml = `<div class="section">
      <div class="section-h">${esc(tt("tdoc.sec_financial", "Financial Summary"))}</div>
      <table class="kv fin">
        ${isReal(totals.subTotal) ? `<tr><td>${tt("tdoc.subtotal", "Subtotal")}</td><td>${money(totals.subTotal)} ${esc(input.currency)}</td></tr>` : ""}
        ${isReal(totals.freight) ? `<tr><td>${tt("tdoc.freight", "Freight")}</td><td>${money(totals.freight)} ${esc(input.currency)}</td></tr>` : ""}
        ${isReal(totals.insurance) ? `<tr><td>${tt("tdoc.insurance", "Insurance")}</td><td>${money(totals.insurance)} ${esc(input.currency)}</td></tr>` : ""}
        ${isReal(totals.taxAmount) ? `<tr><td>${tt("tdoc.tax", "Tax / VAT")}</td><td>${money(totals.taxAmount)} ${esc(input.currency)}</td></tr>` : ""}
        <tr class="grand"><td>${tt("tdoc.grand_total", "Grand Total")}</td><td>${money(grand)} ${esc(input.currency)}</td></tr>
        ${isReal(totals.advanceAmount) ? `<tr><td>${tt("tdoc.advance", "Advance")}</td><td>${money(totals.advanceAmount)} ${esc(input.currency)}</td></tr>` : ""}
        ${isReal(totals.balanceAmount) ? `<tr><td>${tt("tdoc.balance", "Balance Due")}</td><td>${money(totals.balanceAmount)} ${esc(input.currency)}</td></tr>` : ""}
        ${fxLine}
      </table>
      <div class="in-words">${esc(tt("tdoc.amount_in_words", "Amount in words"))}: <strong>${esc(numberToWords(Math.round(grand)))} ${esc(input.currency)}</strong></div>
    </div>`;
  }

  // ---- bank -----------------------------------------------------------
  const bankHtml = showBank
    ? `<div class="section">
        <div class="section-h">${esc(tt("tdoc.sec_bank", isProforma ? "Payment / Bank Details" : "Beneficiary Bank Details"))}</div>
        <table class="kv">
          ${isReal(input.bank!.bankName) ? `<tr><td>${tt("tdoc.bank_name", "Bank Name")}</td><td>${esc(input.bank!.bankName)}</td></tr>` : ""}
          ${isReal(input.bank!.branchName) ? `<tr><td>${tt("tdoc.bank_branch", "Branch")}</td><td>${esc(input.bank!.branchName)}</td></tr>` : ""}
          ${isReal(input.bank!.accountTitle) ? `<tr><td>${tt("tdoc.account_title", "Account Title")}</td><td>${esc(input.bank!.accountTitle)}</td></tr>` : ""}
          ${isReal(input.bank!.accountNumber) ? `<tr><td>${tt("tdoc.account_number", "Account No.")}</td><td>${esc(input.bank!.accountNumber)}</td></tr>` : ""}
          ${isReal(input.bank!.iban) ? `<tr><td>${tt("tdoc.iban", "IBAN")}</td><td>${esc(input.bank!.iban)}</td></tr>` : ""}
          ${isReal(input.bank!.swift) ? `<tr><td>${tt("tdoc.swift", "SWIFT / BIC")}</td><td>${esc(input.bank!.swift)}</td></tr>` : ""}
          ${isReal(input.bank!.currency) ? `<tr><td>${tt("tdoc.account_currency", "Account Currency")}</td><td>${esc(input.bank!.currency)}</td></tr>` : ""}
        </table>
      </div>`
    : "";

  // ---- missing fields notice (screen only) ----------------------------
  const missingHtml = (input.missingFields && input.missingFields.length)
    ? `<div class="missing no-print">${esc(tt("tdoc.missing_notice", "Some fields are not on the source transaction and are blank on this document:"))} ${input.missingFields.map(esc).join(", ")}</div>`
    : "";

  const notesHtml = isReal(input.notes)
    ? `<div class="section notes"><div class="section-h">${esc(tt("tdoc.notes", "Notes / Remarks"))}</div><div>${esc(input.notes)}</div></div>`
    : "";

  const now = new Date();
  const stamp = `${now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} ${now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;

  return `<!doctype html>
<html lang="${esc(lang)}" dir="${dir}">
<head>
<meta charset="utf-8" />
<title>${esc(docTitle)} — ${esc(input.docNo)}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Noto+Naskh+Arabic:wght@400;600;700&family=Noto+Nastaliq+Urdu:wght@400;600;700&display=swap');
  @page {
    size: A4 ${orientation};
    margin: 12mm 10mm 14mm 10mm;
    @top-left { content: "${esc(brandName)} — ${esc(docTitle)}"; font-size: 7pt; color: #64748b; font-weight: 700; }
    @top-right { content: "${esc(stamp)}"; font-size: 7pt; color: #94a3b8; }
    @bottom-left { content: "${esc(input.docNo)}"; font-size: 7pt; color: #94a3b8; font-weight: 700; }
    @bottom-right { content: "${esc(tt("tdoc.page", "Page"))} " counter(page) " ${esc(tt("tdoc.of", "of"))} " counter(pages); font-size: 7pt; color: #64748b; font-weight: 700; }
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { background: #f1f5f9; color: #0f172a; font-family: 'Inter', 'Noto Naskh Arabic', Arial, sans-serif; font-size: 8.4pt; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html[lang="ur"] body { font-family: 'Noto Nastaliq Urdu', 'Noto Naskh Arabic', 'Inter', serif; }
  html[lang="ar"] body, html[lang="fa"] body, html[lang="ps"] body { font-family: 'Noto Naskh Arabic', 'Inter', sans-serif; }
  .wrap { padding: 20px; display: flex; justify-content: center; }
  .page { width: ${orientation === "landscape" ? "297mm" : "210mm"}; background: #fff; padding: 12mm; border: 1px solid #e2e8f0; box-shadow: 0 10px 30px rgba(15,23,42,0.08); border-radius: 8px; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 8px; gap: 16px; }
  .brand { display: flex; gap: 10px; align-items: flex-start; }
  .brand img { width: 42px; height: 42px; object-fit: contain; border: 1px solid #e2e8f0; border-radius: 6px; background: #fff; }
  .brand-name { font-size: 12pt; font-weight: 900; color: #0f172a; }
  .brand-lines { font-size: 7pt; color: #475569; line-height: 1.4; margin-top: 2px; }
  .doc-title { text-align: ${isRtl ? "left" : "right"}; }
  .doc-title h1 { margin: 0; font-size: 15pt; font-weight: 900; color: #1e3a8a; text-transform: uppercase; letter-spacing: 0.5px; }
  .doc-title .scope { font-size: 7.5pt; font-weight: 800; color: #64748b; text-transform: uppercase; }
  .meta-bar { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px 10px; border: 1px solid #cbd5e1; border-radius: 5px; padding: 6px 8px; margin-bottom: 8px; }
  .meta-c { font-size: 7.8pt; display: flex; flex-direction: column; }
  .meta-c .k { color: #64748b; font-weight: 700; text-transform: uppercase; font-size: 6.6pt; }
  .meta-c .v { font-weight: 800; color: #0f172a; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .party { border: 1px solid #e2e8f0; border-radius: 5px; padding: 7px 9px; font-size: 7.8pt; color: #475569; line-height: 1.45; background: #f8fafc; break-inside: avoid; }
  .party-h { font-size: 7pt; font-weight: 900; text-transform: uppercase; color: #1e3a8a; border-bottom: 1px solid #cbd5e1; padding-bottom: 2px; margin-bottom: 3px; }
  .party-name { font-size: 9pt; font-weight: 800; color: #0f172a; margin-bottom: 2px; }
  .party .k { color: #64748b; font-weight: 700; }
  .section { margin-top: 9px; break-inside: avoid; }
  .section-h { background: #1e3a8a; color: #fff; font-size: 7.6pt; font-weight: 800; text-transform: uppercase; letter-spacing: 0.4px; padding: 4px 8px; border-radius: 4px 4px 0 0; }
  table.kv { width: 100%; border-collapse: collapse; }
  table.kv td { padding: 3px 8px; font-size: 7.8pt; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
  table.kv td:first-child { color: #64748b; font-weight: 700; width: 42%; }
  table.kv td:last-child { font-weight: 700; color: #0f172a; }
  table.kv.fin tr.grand td { border-top: 1.5px solid #0f172a; font-size: 9pt; font-weight: 900; color: #1e3a8a; }
  .in-words { font-size: 7.6pt; color: #334155; padding: 5px 8px; border: 1px dashed #cbd5e1; border-radius: 4px; margin-top: 4px; }
  table.goods { width: 100%; border-collapse: collapse; }
  table.goods th { background: #0f172a; color: #fff; font-size: 6.8pt; font-weight: 800; text-transform: uppercase; letter-spacing: 0.3px; padding: 4px 5px; border: 1px solid #0f172a; }
  table.goods td { padding: 4px 5px; font-size: 7.6pt; border: 1px solid #cbd5e1; vertical-align: top; }
  table.goods td .sub { color: #64748b; font-size: 6.8pt; }
  table.goods tbody tr:nth-child(even) { background: #f8fafc; }
  table.goods tfoot tr.totals td { background: #e2e8f0; font-weight: 900; border: 1px solid #94a3b8; }
  .a-l { text-align: start; } .a-r { text-align: end; } .a-c { text-align: center; }
  thead { display: table-header-group; }
  tfoot { display: table-footer-group; }
  tr, .party, .section { page-break-inside: avoid; }
  .notes div { padding: 6px 8px; font-size: 7.6pt; border: 1px solid #e2e8f0; border-top: none; }
  .missing { background: #fffbeb; border: 1px solid #fde68a; color: #92400e; font-size: 7.8pt; padding: 6px 10px; border-radius: 5px; margin-bottom: 8px; }
  .sign-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-top: 24px; }
  .sign { border-top: 1px solid #475569; padding-top: 3px; font-size: 7.4pt; text-align: center; color: #64748b; font-weight: 700; }
  .foot { margin-top: 14px; border-top: 1px solid #e2e8f0; padding-top: 5px; font-size: 6.8pt; color: #94a3b8; display: flex; justify-content: space-between; }
  @media print {
    body { background: #fff; }
    .wrap { padding: 0; }
    .page { border: none; box-shadow: none; border-radius: 0; padding: 0; width: 100%; }
    .no-print { display: none !important; }
  }
</style>
</head>
<body>
<div class="wrap"><div class="page">
  ${missingHtml}
  <div class="head">
    <div class="brand">
      ${isReal(b.logoUrl) && /^(https?:\/\/|data:|\/)/.test(String(b.logoUrl)) ? `<img src="${esc(b.logoUrl)}" alt="" />` : ""}
      <div>
        <div class="brand-name">${esc(brandName)}</div>
        <div class="brand-lines">${brandLines.map(esc).join("<br/>")}</div>
      </div>
    </div>
    <div class="doc-title">
      <h1>${esc(docTitle)}</h1>
      <div class="scope">${esc(input.txnKind === "sales" ? tt("tdoc.kind_sales", "Sales") : tt("tdoc.kind_purchase", "Purchase"))} · ${esc(scopeLabel)}</div>
    </div>
  </div>
  ${metaHtml}
  <div class="section"><div class="section-h">${esc(tt("tdoc.sec_parties", "Trade Parties"))}</div></div>
  ${partiesHtml}
  ${deliveryHtml}
  ${goodsHtml}
  ${financialHtml}
  ${bankHtml}
  ${notesHtml}
  <div class="sign-grid">
    <div class="sign">${esc(tt("tdoc.sign_prepared", "Prepared By"))}</div>
    <div class="sign">${esc(input.signatureName || tt("tdoc.sign_authorized", "Authorized Signature & Stamp"))}</div>
  </div>
  <div class="foot">
    <span>${esc(brandName)} · ${esc(docTitle)} · ${esc(input.docNo)}</span>
    <span>${esc(tt("tdoc.system_generated", "System-generated document"))} · ${esc(stamp)}</span>
  </div>
</div></div>
${input.autoPrint ? `<script>window.addEventListener('load',function(){setTimeout(function(){window.print();},400);});</script>` : ""}
</body>
</html>`;
}

export function openTradeDocument(input: TradeDocumentInput): void {
  if (typeof window === "undefined") return;
  const [titleKey, titleFb] = docTitleKeyFor(input);
  const title = t((input.lang || "en") as SupportedLanguage, titleKey as never, titleFb);
  printStore.openPrint(buildTradeDocumentHtml(input), `${title} — ${input.docNo}`, {
    lang: input.lang || "en",
    // in-preview language / orientation switch rebuilds from the same source input
    rebuild: ({ lang, orientation }) =>
      buildTradeDocumentHtml({ ...input, lang: lang as SupportedLanguage, orientation }),
  });
}
