/**
 * Professional template — formal letterhead style: centered header, serif
 * typography, double-rule dividers, restrained near-monochrome palette.
 */

import { t } from "@/lib/i18n/ui";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import type { TradeDocumentInput } from "@/lib/reports/trade-documents/types";
import type { InvoiceTemplateFlags } from "./types";
import { esc, prepareInvoiceData, qrPlaceholderSvg, documentShell } from "./shared";

export function renderProfessionalInvoice(input: TradeDocumentInput, flags: InvoiceTemplateFlags): string {
  const d = prepareInvoiceData(input, flags);
  const lang = (input.lang || "en") as SupportedLanguage;
  const tt = (key: string, fallback: string) => t(lang, key as never, fallback);
  const orientation = input.orientation || "portrait";

  const metaTable = `<table class="meta"><tbody>
    ${d.metaRows.map((r) => `<tr><td class="k">${esc(r.label)}</td><td class="v">${esc(r.value)}</td></tr>`).join("")}
  </tbody></table>`;

  const partyBlock = (p: typeof d.seller) => p ? `
    <td class="party">
      <div class="party-h">${esc(p.title)}</div>
      <div class="party-name">${esc(p.name)}</div>
      ${p.rows.map((r) => `<div class="prow">${r.label ? `${esc(r.label)}: ` : ""}${esc(r.value)}</div>`).join("")}
    </td>` : `<td class="party"></td>`;

  const infoTable = (title: string, rows: typeof d.deliveryRows) => rows.length ? `
    <div class="section">
      <div class="section-h">${esc(title)}</div>
      <table class="kv"><tbody>${rows.map((r) => `<tr><td class="k">${esc(r.label)}</td><td class="v">${esc(r.value)}</td></tr>`).join("")}</tbody></table>
    </div>` : "";

  const goodsHead = d.goodsColumns.map((c) => `<th class="a-${c.align}">${esc(c.label)}</th>`).join("");
  const goodsBody = d.goodsRows.length
    ? d.goodsRows.map((row, ri) => `<tr><td class="a-c sr">${ri + 1}</td>${row.map((v, i) => `<td class="a-${d.goodsColumns[i].align}">${esc(v)}</td>`).join("")}</tr>`).join("")
    : `<tr><td colspan="${d.goodsColumns.length + 1}" class="a-c empty">${esc(tt("tdoc.no_goods", "No goods lines on this transaction."))}</td></tr>`;
  const totalsRow = d.totalsRowCells.map((v, i) => `<td class="a-${d.goodsColumns[i].align}"><strong>${esc(v)}</strong></td>`).join("");

  const style = `
    body { background: #ffffff; color: #1a1a1a; font-family: Georgia, 'Noto Naskh Arabic', 'Times New Roman', serif; font-size: 8.6pt; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .wrap { padding: 18px; display: flex; justify-content: center; }
    .page { width: ${orientation === "landscape" ? "297mm" : "210mm"}; background: #fff; padding: 14mm 13mm; border: 1px solid #d4d4d4; }
    .letterhead { text-align: center; margin-bottom: 8px; }
    .letterhead img { width: 52px; height: 52px; object-fit: contain; margin-bottom: 4px; }
    .letterhead .brand-name { font-size: 15pt; font-weight: 700; letter-spacing: 0.6px; text-transform: uppercase; }
    .letterhead .brand-lines { font-size: 7.2pt; color: #444; margin-top: 2px; }
    .rule { border: none; border-top: 2px solid #1a1a1a; margin: 6px 0 2px; }
    .rule.thin { border-top: 1px solid #1a1a1a; margin: 2px 0 10px; }
    .doc-title { text-align: center; margin: 10px 0 12px; }
    .doc-title h1 { margin: 0; font-size: 14pt; font-weight: 700; text-transform: uppercase; letter-spacing: 1.4px; }
    .doc-title .scope { font-size: 7.4pt; color: #555; text-transform: uppercase; letter-spacing: 0.6px; margin-top: 2px; }
    table.meta { width: 100%; border-collapse: collapse; margin-bottom: 10px; border-top: 1px solid #ddd; border-bottom: 1px solid #ddd; }
    table.meta td { padding: 3px 4px; font-size: 7.8pt; }
    table.meta .k { color: #555; font-weight: 700; width: 30%; }
    table.parties { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
    .party { width: 50%; vertical-align: top; padding: 8px 10px; border: 1px solid #ddd; font-size: 7.8pt; line-height: 1.5; }
    .party-h { font-size: 7pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #ccc; padding-bottom: 3px; margin-bottom: 4px; }
    .party-name { font-size: 9.2pt; font-weight: 700; margin-bottom: 3px; }
    .section { margin-top: 8px; }
    .section-h { font-size: 7.4pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #1a1a1a; padding-bottom: 2px; margin-bottom: 3px; }
    table.kv { width: 100%; border-collapse: collapse; }
    table.kv td { padding: 2px 4px; font-size: 7.8pt; }
    table.kv .k { color: #555; font-weight: 700; width: 40%; }
    table.goods { width: 100%; border-collapse: collapse; margin-top: 10px; }
    table.goods th { border: 1px solid #1a1a1a; background: #f2f2f2; font-size: 6.8pt; font-weight: 700; text-transform: uppercase; padding: 5px 5px; }
    table.goods td { border: 1px solid #ccc; padding: 4px 5px; font-size: 7.8pt; }
    table.goods .sr { width: 22px; color: #777; }
    table.goods .empty { padding: 14px; color: #999; }
    table.goods tfoot td { border: 1px solid #1a1a1a; background: #f2f2f2; font-weight: 700; }
    .a-l { text-align: start; } .a-r { text-align: end; } .a-c { text-align: center; }
    .summary-wrap { display: flex; justify-content: flex-end; margin-top: 8px; }
    .summary { width: 55%; min-width: 220px; border-top: 1px solid #1a1a1a; padding-top: 4px; }
    .summary .row { display: flex; justify-content: space-between; font-size: 7.8pt; padding: 2px 0; }
    .summary .grand { display: flex; justify-content: space-between; border-top: 2px solid #1a1a1a; margin-top: 4px; padding-top: 4px; font-size: 10pt; font-weight: 700; }
    .words { font-size: 7.4pt; color: #444; margin-top: 4px; font-style: italic; }
    .notes { border-top: 1px solid #ccc; margin-top: 10px; padding-top: 6px; font-size: 7.6pt; }
    .sign-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 30px; }
    .sign { border-top: 1px solid #1a1a1a; padding-top: 4px; font-size: 7.6pt; text-align: center; }
    .qr-row { display: flex; justify-content: center; margin-top: 14px; }
    .qr-row .qr-box { text-align: center; font-size: 6.4pt; color: #777; }
    .foot { margin-top: 16px; border-top: 1px solid #ddd; padding-top: 5px; font-size: 6.6pt; color: #888; display: flex; justify-content: space-between; }
    tr, .party, .section { page-break-inside: avoid; }
  `;

  const body = `<div class="wrap"><div class="page">
    ${flags.showHeaderFooter ? `<div class="letterhead">
      ${d.logoUrl ? `<img src="${esc(d.logoUrl)}" alt="" />` : ""}
      <div class="brand-name">${esc(d.brandName)}</div>
      <div class="brand-lines">${d.brandLines.join(" · ")}</div>
    </div>
    <hr class="rule" /><hr class="rule thin" />` : ""}
    <div class="doc-title">
      <h1>${esc(d.docTitle)}</h1>
      <div class="scope">${esc(input.txnKind === "sales" ? tt("tdoc.kind_sales", "Sales") : tt("tdoc.kind_purchase", "Purchase"))} · ${esc(d.scopeLabel)}</div>
    </div>
    ${metaTable}
    <table class="parties"><tbody><tr>${partyBlock(d.seller)}${partyBlock(d.buyer)}</tr>${d.notify ? `<tr>${partyBlock(d.notify)}<td class="party"></td></tr>` : ""}</tbody></table>
    ${infoTable(tt("tdoc.sec_delivery", "Delivery & Terms"), d.deliveryRows)}
    ${infoTable(tt("tdoc.transport_mode", "Transport Mode"), d.transportRows)}
    <div class="section">
      <div class="section-h">${esc(d.isPacking ? tt("tdoc.sec_packing", "Packing Details") : tt("tdoc.sec_goods", "Description & Value of Goods"))}</div>
      <table class="goods">
        <thead><tr><th class="a-c">${esc(tt("tdoc.col_sr", "S/N"))}</th>${goodsHead}</tr></thead>
        <tbody>${goodsBody}</tbody>
        <tfoot><tr><td></td>${totalsRow}</tr></tfoot>
      </table>
    </div>
    ${d.showPrices ? `<div class="summary-wrap"><div class="summary">
      ${d.financialRows.map((r) => `<div class="row"><span>${esc(r.label)}</span><span>${esc(r.value)}</span></div>`).join("")}
      <div class="grand"><span>${esc(d.grandTotalLabel)}</span><span>${esc(d.grandTotalValue)}</span></div>
      ${d.amountInWords ? `<div class="words">${esc(d.amountInWords)}</div>` : ""}
    </div></div>` : ""}
    ${d.showBank && d.bankRows.length ? infoTable(tt("tdoc.sec_bank", "Beneficiary Bank Details"), d.bankRows) : ""}
    ${d.notes ? `<div class="notes"><strong>${esc(tt("tdoc.notes", "Notes / Remarks"))}:</strong> ${esc(d.notes)}</div>` : ""}
    ${flags.showQr ? `<div class="qr-row"><div class="qr-box">${qrPlaceholderSvg(52)}<div>${esc(d.qrLabel)}</div></div></div>` : ""}
    ${flags.showSignature ? `<div class="sign-grid">
      <div class="sign">${esc(d.preparedByLabel)}</div>
      <div class="sign">${esc(tt("invtpl.sign_for", "For"))} ${esc(d.brandName)}<br/>${esc(d.signatureName)}</div>
    </div>` : ""}
    ${flags.showHeaderFooter ? `<div class="foot"><span>${esc(d.brandName)} · ${esc(d.docTitle)} · ${esc(d.docNo)}</span><span>${esc(tt("tdoc.system_generated", "System-generated document"))} · ${esc(d.stamp)}</span></div>` : ""}
  </div></div>`;

  return documentShell({
    lang, dir: d.dir, title: d.docTitle, docNo: d.docNo, docTitle: d.docTitle, brandName: d.brandName, stamp: d.stamp,
    orientation, style, body, autoPrint: input.autoPrint, pageLabel: d.pageLabel, ofLabel: d.ofLabel,
  });
}
