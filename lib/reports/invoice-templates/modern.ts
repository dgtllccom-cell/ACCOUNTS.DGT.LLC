/**
 * Modern template — clean sans-serif design with a single accent color,
 * card-style sections (no heavy borders), pill-badge meta strip.
 */

import { t } from "@/lib/i18n/ui";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import type { TradeDocumentInput } from "@/lib/reports/trade-documents/types";
import type { InvoiceTemplateFlags } from "./types";
import { esc, prepareInvoiceData, qrPlaceholderSvg, documentShell } from "./shared";

const ACCENT = "#4f46e5";

export function renderModernInvoice(input: TradeDocumentInput, flags: InvoiceTemplateFlags): string {
  const d = prepareInvoiceData(input, flags);
  const lang = (input.lang || "en") as SupportedLanguage;
  const tt = (key: string, fallback: string) => t(lang, key as never, fallback);
  const orientation = input.orientation || "portrait";

  const chip = (label: string, value: string) => value ? `<div class="chip"><span class="k">${esc(label)}</span><span class="v">${esc(value)}</span></div>` : "";
  const metaChips = d.metaRows.map((r) => chip(r.label, r.value)).join("");

  const partyCard = (p: typeof d.seller, roleClass: string) => p ? `
    <div class="pcard ${roleClass}">
      <div class="pcard-title">${esc(p.title)}</div>
      <div class="pcard-name">${esc(p.name)}</div>
      ${p.rows.map((r) => `<div class="prow">${r.label ? `<span class="k">${esc(r.label)}:</span> ` : ""}${esc(r.value)}</div>`).join("")}
    </div>` : "";

  const infoBlock = (title: string, rows: typeof d.deliveryRows) => rows.length ? `
    <div class="info-card">
      <div class="info-title">${esc(title)}</div>
      ${rows.map((r) => `<div class="info-row"><span class="k">${esc(r.label)}</span><span class="v">${esc(r.value)}</span></div>`).join("")}
    </div>` : "";

  const goodsHead = d.goodsColumns.map((c) => `<th class="a-${c.align}">${esc(c.label)}</th>`).join("");
  const goodsBody = d.goodsRows.length
    ? d.goodsRows.map((row) => `<tr>${row.map((v, i) => `<td class="a-${d.goodsColumns[i].align}">${i === 0 ? `<strong>${esc(v)}</strong>` : esc(v)}</td>`).join("")}</tr>`).join("")
    : `<tr><td colspan="${d.goodsColumns.length}" class="a-c empty">${esc(tt("tdoc.no_goods", "No goods lines on this transaction."))}</td></tr>`;
  const totalsRow = d.totalsRowCells.map((v, i) => `<td class="a-${d.goodsColumns[i].align}"><strong>${esc(v)}</strong></td>`).join("");

  const style = `
    body { background: #f8fafc; color: #0f172a; font-family: 'Inter', 'Noto Naskh Arabic', Arial, sans-serif; font-size: 8.6pt; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .wrap { padding: 18px; display: flex; justify-content: center; }
    .page { width: ${orientation === "landscape" ? "297mm" : "210mm"}; background: #fff; border-radius: 10px; overflow: hidden; box-shadow: 0 10px 30px rgba(15,23,42,0.08); }
    .accent-bar { height: 6px; background: linear-gradient(90deg, ${ACCENT}, #818cf8); }
    .inner { padding: 14mm 12mm; }
    .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 10px; }
    .brand { display: flex; gap: 10px; align-items: center; }
    .brand img { width: 46px; height: 46px; object-fit: contain; border-radius: 8px; }
    .brand-name { font-size: 13pt; font-weight: 800; color: #0f172a; }
    .brand-lines { font-size: 7pt; color: #64748b; line-height: 1.4; }
    .doc-title { text-align: ${d.isRtl ? "left" : "right"}; }
    .doc-title h1 { margin: 0 0 2px; font-size: 16pt; font-weight: 800; color: ${ACCENT}; }
    .doc-title .scope { font-size: 7.5pt; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.4px; }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
    .chip { background: #eef2ff; border-radius: 999px; padding: 4px 10px; font-size: 7.4pt; display: flex; gap: 4px; }
    .chip .k { color: #6366f1; font-weight: 700; }
    .chip .v { color: #1e1b4b; font-weight: 700; }
    .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; }
    .pcard { background: #f8fafc; border-radius: 8px; padding: 9px 11px; border-inline-start: 3px solid ${ACCENT}; font-size: 7.8pt; color: #475569; line-height: 1.5; break-inside: avoid; }
    .pcard.buyer { border-inline-start-color: #0ea5e9; }
    .pcard-title { font-size: 6.8pt; font-weight: 800; text-transform: uppercase; color: #64748b; letter-spacing: 0.4px; }
    .pcard-name { font-size: 9.4pt; font-weight: 800; color: #0f172a; margin: 2px 0 3px; }
    .prow .k { color: #94a3b8; font-weight: 700; }
    .info-card { background: #f1f5f9; border-radius: 8px; padding: 8px 11px; margin-bottom: 10px; break-inside: avoid; }
    .info-title { font-size: 6.8pt; font-weight: 800; text-transform: uppercase; color: ${ACCENT}; margin-bottom: 4px; letter-spacing: 0.4px; }
    .info-row { display: flex; justify-content: space-between; font-size: 7.6pt; padding: 2px 0; border-bottom: 1px dashed #e2e8f0; }
    .info-row .k { color: #64748b; font-weight: 600; }
    .info-row .v { color: #0f172a; font-weight: 700; }
    table.goods { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
    table.goods th { background: ${ACCENT}; color: #fff; font-size: 6.8pt; font-weight: 700; text-transform: uppercase; padding: 6px 6px; letter-spacing: 0.3px; }
    table.goods th:first-child { border-start-start-radius: 6px; }
    table.goods th:last-child { border-start-end-radius: 6px; }
    table.goods td { padding: 5px 6px; font-size: 7.8pt; border-bottom: 1px solid #eef2f7; }
    table.goods tbody tr:nth-child(even) { background: #f8fafc; }
    table.goods .empty { padding: 14px; color: #94a3b8; }
    table.goods tfoot td { background: #eef2ff; font-weight: 800; padding: 6px; border-top: 2px solid ${ACCENT}; }
    .a-l { text-align: start; } .a-r { text-align: end; } .a-c { text-align: center; }
    .summary-wrap { display: flex; justify-content: flex-end; margin-bottom: 10px; }
    .summary { width: 60%; min-width: 220px; }
    .summary .row { display: flex; justify-content: space-between; font-size: 7.8pt; padding: 3px 0; color: #475569; }
    .summary .grand { display: flex; justify-content: space-between; background: ${ACCENT}; color: #fff; border-radius: 8px; padding: 8px 12px; margin-top: 6px; font-size: 10.5pt; font-weight: 800; }
    .words { font-size: 7.4pt; color: #64748b; margin-top: 4px; text-align: end; }
    .bottom-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; align-items: start; }
    .notes-card { background: #fffbeb; border-radius: 8px; padding: 8px 11px; font-size: 7.6pt; color: #78350f; margin-bottom: 10px; }
    .sign-row { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 20px; gap: 14px; }
    .sign { flex: 1; border-top: 1.5px solid #cbd5e1; padding-top: 4px; font-size: 7.4pt; text-align: center; color: #64748b; font-weight: 700; }
    .qr-box { text-align: center; font-size: 6.4pt; color: #94a3b8; }
    .foot { margin-top: 14px; border-top: 1px solid #eef2f7; padding-top: 6px; font-size: 6.8pt; color: #94a3b8; display: flex; justify-content: space-between; }
    tr, .pcard, .info-card { page-break-inside: avoid; }
  `;

  const body = `<div class="wrap"><div class="page">
    <div class="accent-bar"></div>
    <div class="inner">
      <div class="head">
        <div class="brand">
          ${d.logoUrl ? `<img src="${esc(d.logoUrl)}" alt="" />` : ""}
          <div>
            <div class="brand-name">${esc(d.brandName)}</div>
            <div class="brand-lines">${d.brandLines.map(esc).join("<br/>")}</div>
          </div>
        </div>
        <div class="doc-title">
          <h1>${esc(d.docTitle)}</h1>
          <div class="scope">${esc(input.txnKind === "sales" ? tt("tdoc.kind_sales", "Sales") : tt("tdoc.kind_purchase", "Purchase"))} · ${esc(d.scopeLabel)}</div>
        </div>
      </div>
      <div class="chips">${metaChips}</div>
      <div class="grid2">
        ${partyCard(d.seller, "seller")}
        ${partyCard(d.buyer, "buyer")}
      </div>
      ${d.notify ? partyCard(d.notify, "notify") : ""}
      ${infoBlock(tt("tdoc.sec_delivery", "Delivery & Terms"), d.deliveryRows)}
      ${infoBlock(tt("tdoc.sec_delivery", "Delivery & Terms") + " — " + tt("tdoc.transport_mode", "Transport Mode"), d.transportRows)}
      <table class="goods">
        <thead><tr>${goodsHead}</tr></thead>
        <tbody>${goodsBody}</tbody>
        <tfoot><tr>${totalsRow}</tr></tfoot>
      </table>
      ${d.showPrices ? `<div class="summary-wrap"><div class="summary">
        ${d.financialRows.map((r) => `<div class="row"><span>${esc(r.label)}</span><span>${esc(r.value)}</span></div>`).join("")}
        <div class="grand"><span>${esc(d.grandTotalLabel)}</span><span>${esc(d.grandTotalValue)}</span></div>
        ${d.amountInWords ? `<div class="words">${esc(d.amountInWords)}</div>` : ""}
      </div></div>` : ""}
      <div class="bottom-grid">
        ${d.showBank && d.bankRows.length ? infoBlock(tt("tdoc.sec_bank", "Payment / Bank Details"), d.bankRows) : "<div></div>"}
        ${d.notes ? `<div class="notes-card"><strong>${esc(tt("tdoc.notes", "Notes / Remarks"))}:</strong> ${esc(d.notes)}</div>` : "<div></div>"}
      </div>
      ${flags.showSignature ? `<div class="sign-row">
        <div class="sign">${esc(d.preparedByLabel)}</div>
        <div class="sign">${esc(d.signatureName)}</div>
        ${flags.showQr ? `<div class="qr-box">${qrPlaceholderSvg(48)}<div>${esc(d.qrLabel)}</div></div>` : ""}
      </div>` : ""}
      ${flags.showHeaderFooter ? `<div class="foot"><span>${esc(d.brandName)} · ${esc(d.docTitle)} · ${esc(d.docNo)}</span><span>${esc(tt("tdoc.system_generated", "System-generated document"))} · ${esc(d.stamp)}</span></div>` : ""}
    </div>
  </div></div>`;

  return documentShell({
    lang, dir: d.dir, title: d.docTitle, docNo: d.docNo, docTitle: d.docTitle, brandName: d.brandName, stamp: d.stamp,
    orientation, style, body, autoPrint: input.autoPrint, pageLabel: d.pageLabel, ofLabel: d.ofLabel,
  });
}
