/**
 * Compact template — dense, minimal layout for short / single-line invoices
 * (e.g. a Local Purchase docket). Narrow content column, small type, no
 * decorative sections — everything the data actually has, nothing more.
 */

import { t } from "@/lib/i18n/ui";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import type { TradeDocumentInput } from "@/lib/reports/trade-documents/types";
import type { InvoiceTemplateFlags } from "./types";
import { esc, prepareInvoiceData, documentShell } from "./shared";

export function renderCompactInvoice(input: TradeDocumentInput, flags: InvoiceTemplateFlags): string {
  const d = prepareInvoiceData(input, flags);
  const lang = (input.lang || "en") as SupportedLanguage;
  const tt = (key: string, fallback: string) => t(lang, key as never, fallback);
  const orientation = input.orientation || "portrait";

  const partyLine = (p: typeof d.seller) => p ? `
    <div class="pblock">
      <span class="ptitle">${esc(p.title)}:</span> <strong>${esc(p.name)}</strong>
      ${p.rows.length ? `<span class="pmeta">${p.rows.map((r) => esc(r.value)).join(" · ")}</span>` : ""}
    </div>` : "";

  const infoLine = (rows: typeof d.deliveryRows) => rows.length
    ? `<div class="infoline">${rows.map((r) => `<span><span class="k">${esc(r.label)}:</span> ${esc(r.value)}</span>`).join(" &nbsp;·&nbsp; ")}</div>`
    : "";

  const goodsHead = d.goodsColumns.map((c) => `<th class="a-${c.align}">${esc(c.label)}</th>`).join("");
  const goodsBody = d.goodsRows.length
    ? d.goodsRows.map((row) => `<tr>${row.map((v, i) => `<td class="a-${d.goodsColumns[i].align}">${esc(v)}</td>`).join("")}</tr>`).join("")
    : `<tr><td colspan="${d.goodsColumns.length}" class="a-c empty">${esc(tt("tdoc.no_goods", "No goods lines on this transaction."))}</td></tr>`;
  const totalsRow = d.totalsRowCells.map((v, i) => `<td class="a-${d.goodsColumns[i].align}">${esc(v)}</td>`).join("");

  const style = `
    body { background: #f4f4f5; color: #18181b; font-family: 'Inter', 'Noto Naskh Arabic', Arial, sans-serif; font-size: 7.4pt; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .wrap { padding: 14px; display: flex; justify-content: center; }
    .page { width: ${orientation === "landscape" ? "297mm" : "210mm"}; background: #fff; }
    .col { max-width: 128mm; margin: 0 auto; padding: 9mm 7mm; }
    .head { display: flex; justify-content: space-between; align-items: center; border-bottom: 1.5px solid #18181b; padding-bottom: 4px; margin-bottom: 5px; }
    .brand { display: flex; gap: 6px; align-items: center; }
    .brand img { width: 26px; height: 26px; object-fit: contain; }
    .brand-name { font-size: 9pt; font-weight: 800; }
    .doc-title { text-align: end; }
    .doc-title .t { font-size: 9.5pt; font-weight: 800; text-transform: uppercase; }
    .doc-title .n { font-size: 6.8pt; color: #52525b; }
    .metarow { display: flex; justify-content: space-between; font-size: 6.8pt; color: #52525b; margin-bottom: 5px; }
    .pblock { font-size: 7.2pt; margin-bottom: 2px; line-height: 1.4; }
    .ptitle { color: #71717a; font-weight: 700; }
    .pmeta { color: #71717a; margin-inline-start: 4px; }
    .infoline { font-size: 6.6pt; color: #52525b; margin: 4px 0; padding: 3px 0; border-top: 1px dotted #d4d4d8; border-bottom: 1px dotted #d4d4d8; }
    .infoline .k { color: #a1a1aa; font-weight: 700; }
    table.goods { width: 100%; border-collapse: collapse; margin: 6px 0; }
    table.goods th { border-bottom: 1.5px solid #18181b; font-size: 6.2pt; font-weight: 800; text-transform: uppercase; padding: 3px 3px; text-align: start; }
    table.goods td { border-bottom: 1px solid #e4e4e7; padding: 3px 3px; font-size: 7pt; }
    table.goods .empty { padding: 8px; color: #a1a1aa; }
    table.goods tfoot td { border-top: 1.5px solid #18181b; border-bottom: none; font-weight: 800; padding-top: 4px; }
    .a-l { text-align: start; } .a-r { text-align: end; } .a-c { text-align: center; }
    .summary { margin-top: 4px; }
    .summary .row { display: flex; justify-content: space-between; font-size: 7pt; padding: 1px 0; color: #52525b; }
    .summary .grand { display: flex; justify-content: space-between; font-size: 9.5pt; font-weight: 800; border-top: 1.5px solid #18181b; margin-top: 3px; padding-top: 3px; }
    .words { font-size: 6.4pt; color: #71717a; margin-top: 2px; }
    .mini-card { font-size: 6.8pt; color: #3f3f46; background: #f4f4f5; border-radius: 4px; padding: 4px 6px; margin-top: 5px; }
    .mini-card .h { font-weight: 800; color: #71717a; text-transform: uppercase; font-size: 6pt; margin-bottom: 1px; }
    .sign-row { display: flex; justify-content: space-between; margin-top: 16px; gap: 10px; }
    .sign { flex: 1; border-top: 1px solid #52525b; padding-top: 2px; font-size: 6.4pt; text-align: center; color: #71717a; }
    .foot { margin-top: 8px; border-top: 1px dotted #d4d4d8; padding-top: 3px; font-size: 6pt; color: #a1a1aa; display: flex; justify-content: space-between; }
    tr, .pblock { page-break-inside: avoid; }
  `;

  const body = `<div class="wrap"><div class="page"><div class="col">
    <div class="head">
      <div class="brand">${d.logoUrl ? `<img src="${esc(d.logoUrl)}" alt="" />` : ""}<div class="brand-name">${esc(d.brandName)}</div></div>
      <div class="doc-title"><div class="t">${esc(d.docTitle)}</div><div class="n">${esc(d.docNo)}</div></div>
    </div>
    <div class="metarow"><span>${esc(d.docDate)}</span><span>${esc(input.currency)} · ${esc(d.scopeLabel)}</span></div>
    ${partyLine(d.seller)}
    ${partyLine(d.buyer)}
    ${infoLine(d.deliveryRows)}
    <table class="goods">
      <thead><tr>${goodsHead}</tr></thead>
      <tbody>${goodsBody}</tbody>
      <tfoot><tr>${totalsRow}</tr></tfoot>
    </table>
    ${d.showPrices ? `<div class="summary">
      ${d.financialRows.map((r) => `<div class="row"><span>${esc(r.label)}</span><span>${esc(r.value)}</span></div>`).join("")}
      <div class="grand"><span>${esc(d.grandTotalLabel)}</span><span>${esc(d.grandTotalValue)}</span></div>
      ${d.amountInWords ? `<div class="words">${esc(d.amountInWords)}</div>` : ""}
    </div>` : ""}
    ${d.showBank && d.bankRows.length ? `<div class="mini-card"><div class="h">${esc(tt("tdoc.sec_bank", "Bank Details"))}</div>${d.bankRows.map((r) => `${esc(r.label)}: ${esc(r.value)}`).join(" · ")}</div>` : ""}
    ${d.notes ? `<div class="mini-card"><div class="h">${esc(tt("tdoc.notes", "Notes"))}</div>${esc(d.notes)}</div>` : ""}
    ${flags.showSignature ? `<div class="sign-row"><div class="sign">${esc(d.preparedByLabel)}</div><div class="sign">${esc(d.signatureName)}</div></div>` : ""}
    ${flags.showHeaderFooter ? `<div class="foot"><span>${esc(d.brandName)}</span><span>${esc(d.stamp)}</span></div>` : ""}
  </div></div></div>`;

  return documentShell({
    lang, dir: d.dir, title: d.docTitle, docNo: d.docNo, docTitle: d.docTitle, brandName: d.brandName, stamp: d.stamp,
    orientation, style, body, autoPrint: input.autoPrint, pageLabel: d.pageLabel, ofLabel: d.ofLabel,
  });
}
