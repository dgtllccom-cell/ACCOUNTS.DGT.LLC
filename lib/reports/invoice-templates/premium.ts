/**
 * Premium template — elaborate design with heavier branding emphasis: a deep
 * navy ribbon header, gold accent rule, large logo/title treatment, and a
 * prominent QR + stamp/signature block.
 */

import { t } from "@/lib/i18n/ui";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import type { TradeDocumentInput } from "@/lib/reports/trade-documents/types";
import type { InvoiceTemplateFlags } from "./types";
import { esc, prepareInvoiceData, qrPlaceholderSvg, documentShell } from "./shared";

const NAVY = "#0b1120";
const GOLD = "#b8860b";

export function renderPremiumInvoice(input: TradeDocumentInput, flags: InvoiceTemplateFlags): string {
  const d = prepareInvoiceData(input, flags);
  const lang = (input.lang || "en") as SupportedLanguage;
  const tt = (key: string, fallback: string) => t(lang, key as never, fallback);
  const orientation = input.orientation || "portrait";

  const partyCard = (p: typeof d.seller, cls: string) => p ? `
    <div class="pcard ${cls}">
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
    ? d.goodsRows.map((row, ri) => `<tr><td class="a-c sr">${ri + 1}</td>${row.map((v, i) => `<td class="a-${d.goodsColumns[i].align}">${i === 0 ? `<strong>${esc(v)}</strong>` : esc(v)}</td>`).join("")}</tr>`).join("")
    : `<tr><td colspan="${d.goodsColumns.length + 1}" class="a-c empty">${esc(tt("tdoc.no_goods", "No goods lines on this transaction."))}</td></tr>`;
  const totalsRow = d.totalsRowCells.map((v, i) => `<td class="a-${d.goodsColumns[i].align}"><strong>${esc(v)}</strong></td>`).join("");

  const style = `
    body { background: #eef0f4; color: #0f172a; font-family: 'Poppins', 'Inter', 'Noto Naskh Arabic', Arial, sans-serif; font-size: 8.6pt; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .wrap { padding: 18px; display: flex; justify-content: center; }
    .page { width: ${orientation === "landscape" ? "297mm" : "210mm"}; background: #fff; box-shadow: 0 14px 34px rgba(11,17,32,0.14); position: relative; overflow: hidden; }
    .ribbon { background: ${NAVY}; color: #fff; padding: 14mm 12mm 16px; position: relative; }
    .ribbon::after { content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 4px; background: linear-gradient(90deg, ${GOLD}, #f5d78a, ${GOLD}); }
    .head { display: flex; justify-content: space-between; align-items: center; gap: 16px; }
    .brand { display: flex; gap: 12px; align-items: center; }
    .brand .logo-box { width: 56px; height: 56px; border-radius: 10px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.25); display: flex; align-items: center; justify-content: center; }
    .brand img { max-width: 48px; max-height: 48px; object-fit: contain; }
    .brand-name { font-size: 14pt; font-weight: 700; letter-spacing: 0.3px; }
    .brand-lines { font-size: 7pt; color: #cbd5e1; margin-top: 2px; }
    .doc-title { text-align: ${d.isRtl ? "left" : "right"}; }
    .doc-title h1 { margin: 0; font-size: 20pt; font-weight: 800; color: ${GOLD}; letter-spacing: 1.2px; text-transform: uppercase; }
    .doc-title .scope { font-size: 7.4pt; color: #cbd5e1; text-transform: uppercase; letter-spacing: 0.5px; }
    .inner { padding: 12mm 12mm 14mm; }
    .chips { display: flex; flex-wrap: wrap; gap: 8px; margin: -10px 0 14px; }
    .chip { background: #fff; border: 1px solid #e2e8f0; box-shadow: 0 2px 6px rgba(15,23,42,0.06); border-radius: 8px; padding: 5px 11px; font-size: 7.4pt; }
    .chip .k { color: #94a3b8; font-weight: 700; display: block; font-size: 6.4pt; text-transform: uppercase; }
    .chip .v { color: ${NAVY}; font-weight: 800; }
    .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
    .pcard { border: 1px solid #e2e8f0; border-top: 3px solid ${GOLD}; border-radius: 8px; padding: 10px 12px; font-size: 7.8pt; color: #475569; line-height: 1.5; break-inside: avoid; }
    .pcard.buyer { border-top-color: ${NAVY}; }
    .pcard-title { font-size: 6.8pt; font-weight: 800; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.4px; }
    .pcard-name { font-size: 9.6pt; font-weight: 800; color: ${NAVY}; margin: 2px 0 4px; }
    .prow .k { color: #94a3b8; font-weight: 700; }
    .info-card { background: #f8fafc; border-radius: 8px; padding: 9px 12px; margin-bottom: 10px; break-inside: avoid; }
    .info-title { font-size: 6.8pt; font-weight: 800; text-transform: uppercase; color: ${GOLD}; margin-bottom: 4px; letter-spacing: 0.4px; }
    .info-row { display: flex; justify-content: space-between; font-size: 7.6pt; padding: 2px 0; border-bottom: 1px dashed #e2e8f0; }
    .info-row .k { color: #64748b; font-weight: 600; }
    .info-row .v { color: ${NAVY}; font-weight: 700; }
    table.goods { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
    table.goods th { background: ${NAVY}; color: #fff; font-size: 6.8pt; font-weight: 700; text-transform: uppercase; padding: 6px; }
    table.goods .sr { width: 24px; color: #94a3b8; }
    table.goods td { padding: 5px 6px; font-size: 7.8pt; border-bottom: 1px solid #eef2f7; }
    table.goods tbody tr:nth-child(even) { background: #f8fafc; }
    table.goods .empty { padding: 14px; color: #94a3b8; }
    table.goods tfoot td { background: #fdf6e3; font-weight: 800; border-top: 2px solid ${GOLD}; padding: 6px; }
    .a-l { text-align: start; } .a-r { text-align: end; } .a-c { text-align: center; }
    .summary-wrap { display: flex; justify-content: flex-end; margin-bottom: 12px; }
    .summary { width: 60%; min-width: 230px; }
    .summary .row { display: flex; justify-content: space-between; font-size: 7.8pt; padding: 3px 0; color: #475569; }
    .summary .grand { display: flex; justify-content: space-between; background: ${NAVY}; color: #fff; border-radius: 8px; padding: 9px 14px; margin-top: 6px; font-size: 11pt; font-weight: 800; border: 1px solid ${GOLD}; }
    .words { font-size: 7.4pt; color: #64748b; margin-top: 4px; text-align: end; }
    .bottom-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .notes-card { background: #fdf6e3; border-radius: 8px; padding: 9px 12px; font-size: 7.6pt; color: #78350f; margin-bottom: 10px; }
    .stamp-row { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 22px; gap: 16px; }
    .stamp-box { width: 90px; height: 90px; border: 2px dashed ${GOLD}; border-radius: 50%; display: flex; align-items: center; justify-content: center; text-align: center; font-size: 6.4pt; color: #b8860b; font-weight: 700; text-transform: uppercase; }
    .sign { flex: 1; border-top: 1.5px solid #cbd5e1; padding-top: 4px; font-size: 7.4pt; text-align: center; color: #64748b; font-weight: 700; }
    .qr-box { text-align: center; font-size: 6.4pt; color: #94a3b8; }
    .foot { margin-top: 16px; border-top: 1px solid #eef2f7; padding-top: 6px; font-size: 6.8pt; color: #94a3b8; display: flex; justify-content: space-between; }
    tr, .pcard, .info-card { page-break-inside: avoid; }
  `;

  const body = `<div class="wrap"><div class="page">
    ${flags.showHeaderFooter ? `<div class="ribbon"><div class="head">
      <div class="brand">
        ${flags.showLogo ? `<div class="logo-box">${d.logoUrl ? `<img src="${esc(d.logoUrl)}" alt="" />` : `<span style="color:${GOLD};font-weight:800;font-size:16pt;">${esc(d.brandName.slice(0, 1))}</span>`}</div>` : ""}
        <div>
          <div class="brand-name">${esc(d.brandName)}</div>
          <div class="brand-lines">${d.brandLines.join(" · ")}</div>
        </div>
      </div>
      <div class="doc-title">
        <h1>${esc(d.docTitle)}</h1>
        <div class="scope">${esc(input.txnKind === "sales" ? tt("tdoc.kind_sales", "Sales") : tt("tdoc.kind_purchase", "Purchase"))} · ${esc(d.scopeLabel)}</div>
      </div>
    </div></div>` : ""}
    <div class="inner">
      <div class="chips">${d.metaRows.map((r) => `<div class="chip"><span class="k">${esc(r.label)}</span><span class="v">${esc(r.value)}</span></div>`).join("")}</div>
      <div class="grid2">${partyCard(d.seller, "seller")}${partyCard(d.buyer, "buyer")}</div>
      ${d.notify ? partyCard(d.notify, "notify") : ""}
      ${infoBlock(tt("tdoc.sec_delivery", "Delivery & Terms"), d.deliveryRows)}
      ${infoBlock(tt("tdoc.transport_mode", "Transport Mode"), d.transportRows)}
      <table class="goods">
        <thead><tr><th class="a-c">${esc(tt("tdoc.col_sr", "S/N"))}</th>${goodsHead}</tr></thead>
        <tbody>${goodsBody}</tbody>
        <tfoot><tr><td></td>${totalsRow}</tr></tfoot>
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
      ${flags.showSignature ? `<div class="stamp-row">
        <div class="sign">${esc(d.preparedByLabel)}</div>
        <div class="stamp-box">${esc(tt("invtpl.stamp_here", "Stamp & Seal"))}</div>
        <div class="sign">${esc(d.signatureName)}</div>
        ${flags.showQr ? `<div class="qr-box">${qrPlaceholderSvg(52)}<div>${esc(d.qrLabel)}</div></div>` : ""}
      </div>` : ""}
      ${flags.showHeaderFooter ? `<div class="foot"><span>${esc(d.brandName)} · ${esc(d.docTitle)} · ${esc(d.docNo)}</span><span>${esc(tt("tdoc.system_generated", "System-generated document"))} · ${esc(d.stamp)}</span></div>` : ""}
    </div>
  </div></div>`;

  return documentShell({
    lang, dir: d.dir, title: d.docTitle, docNo: d.docNo, docTitle: d.docTitle, brandName: d.brandName, stamp: d.stamp,
    orientation, style, body, autoPrint: input.autoPrint, pageLabel: d.pageLabel, ofLabel: d.ofLabel,
  });
}
