/**
 * Purchase Booking — two-page A4 contract document (owner design, 22 Nov 2026):
 *   Page 1  PURCHASE CONTRACT            company header · Seller / Exporter · Buyer / Consignee · Contract Details ·
 *                                         Goods Details (with the bill's own FX operator) · Commercial Terms
 *   Page 2  CONTRACT REPORT & ANNEXURE   summary strip · Step 1 Loading & Shipping · Step 2 Goods Summary ·
 *                                         Step 3 Payment & Settlement · Step 4 Journal Narration ·
 *                                         Declaration & Acceptance · signatures
 *
 * Pure: (BookingReportData + company branding + language) → one self-contained HTML document. The same string is
 * shown in the View (iframe) and handed to the shared print modal, so screen and print are identical.
 *
 * Nothing is invented: the company header comes from the branding profile (country / branch), every other value from
 * the saved bill. A missing value prints "—"; a terms row or header line with no saved value is left out.
 * Labels go through the central dictionary (pbdoc.*) in the active language; html carries lang + dir.
 */
import { t } from "../i18n/ui";
import type { BookingReportData } from "./booking-report";

export type ContractBranding = {
  entityName?: string | null;
  legalName?: string | null;
  logoUrl?: string | null;
  stampUrl?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
};

const RTL = new Set(["ur", "ar", "fa", "ps"]);
const DASH = "—";

const esc = (v: unknown) =>
  String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const val = (v: unknown) => (v === null || v === undefined || String(v).trim() === "" ? DASH : esc(v));
const money = (n: number | null | undefined, digits = 2) =>
  n === null || n === undefined || !Number.isFinite(Number(n))
    ? DASH
    : Number(n).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const qty = (n: number | null | undefined) => (n === null || n === undefined ? DASH : Number(n).toLocaleString("en-US", { maximumFractionDigits: 3 }));
/** a business value (number, code, currency, date) always reads left-to-right, also inside an RTL page */
const ltr = (html: string) => `<bdi dir="ltr">${html}</bdi>`;

/* small inline icons (no external assets) */
const ICON = {
  pin: '<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></svg>',
  phone: '<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.6a1 1 0 0 1-.25 1z"/></svg>',
  mail: '<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 4-8 5-8-5V6l8 5 8-5z"/></svg>',
  building: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="3" width="16" height="18" rx="1"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2M10 21v-3h4v3"/></svg>',
  user: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0z"/></svg>',
  doc: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5M8 13h8M8 17h8M8 9h3"/></svg>',
  box: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/></svg>',
};

function css(isRtl: boolean, lang: string) {
  const body =
    lang === "ur"
      ? "'Noto Nastaliq Urdu', 'Noto Naskh Arabic', Georgia, serif"
      : isRtl
        ? "'Noto Naskh Arabic', Tahoma, Georgia, serif"
        : "Georgia, 'Times New Roman', serif";
  return `
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@600;700;800&family=Noto+Naskh+Arabic:wght@400;600;700&family=Noto+Nastaliq+Urdu:wght@400;600;700&display=swap');
@page { size: A4 portrait; margin: 0; }
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:#e9edf3;-webkit-text-size-adjust:100%;text-size-adjust:100%}
body{font-family:${body};color:#14213d;-webkit-print-color-adjust:exact;print-color-adjust:exact;font-size:12.5px;line-height:${lang === "ur" ? 1.9 : 1.35}}
.page{position:relative;width:210mm;min-height:297mm;margin:0 auto 14px;background:#fff;padding:11mm 9mm 9mm;overflow:hidden;page-break-after:always;break-after:page}
.page:last-child{page-break-after:auto;break-after:auto;margin-bottom:0}
.corner{position:absolute;width:150px;height:150px;pointer-events:none}
.corner::before,.corner::after{content:"";position:absolute;inset:0}
.corner::before{background:linear-gradient(135deg,#0d2c5a 0 34%,transparent 34%)}
.corner::after{background:linear-gradient(135deg,transparent 0 37%,#c9a227 37% 41%,transparent 41%)}
.c-tl{top:0;left:0}.c-tr{top:0;right:0;transform:scaleX(-1)}.c-bl{bottom:0;left:0;transform:scaleY(-1)}.c-br{bottom:0;right:0;transform:scale(-1,-1)}
.wm{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:0}
.wm img{width:62%;opacity:.07}
.z{position:relative;z-index:1}
.hdr{display:flex;align-items:center;gap:16px;padding:0 6mm 8px}
.logo{width:118px;height:118px;flex:0 0 auto;border-radius:50%;object-fit:contain}
.hdr-txt{flex:1;text-align:center;min-width:0}
.co{font-family:Poppins,Arial,sans-serif;font-weight:800;font-size:30px;letter-spacing:-.5px;color:#0d2c5a;line-height:1.1;text-transform:uppercase}
.sub{display:flex;align-items:center;gap:10px;justify-content:center;margin:4px 0 6px;font-family:Poppins,Arial,sans-serif;font-weight:700;font-size:20px;color:#0d2c5a}
.sub::before,.sub::after{content:"";height:2px;width:110px;background:#c9a227}
.contact{display:flex;flex-wrap:wrap;justify-content:center;gap:4px 12px;font-family:Arial,sans-serif;font-size:12px;color:#14213d}
.contact span{display:inline-flex;align-items:center;gap:5px}.contact svg{color:#c9a227}
.contact .sep{color:#c9a227}
.title{display:flex;align-items:center;gap:16px;background:#0d2c5a;border:2px solid #c9a227;border-radius:10px;padding:8px 20px;margin:4px 0 9px;color:#fff}
.title h1{flex:1;margin:0;text-align:center;font-family:Georgia,'Times New Roman',serif;font-size:38px;white-space:nowrap;letter-spacing:1px;font-weight:700;line-height:1.15}
.title .pg{border-inline-start:2px solid rgba(255,255,255,.7);padding-inline-start:16px;text-align:center;font-size:12px;font-weight:700;line-height:1.35;text-transform:uppercase}
.title .pg b{display:block;color:#e2b93b}
.grid2{display:grid;grid-template-columns:1.45fr 1fr;gap:10px}
.g2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.box{border:1.5px solid #e2b93b;border-radius:8px;background:rgba(255,255,255,.92);overflow:hidden;margin-bottom:8px;break-inside:avoid}
.bh{display:flex;align-items:stretch;background:#0d2c5a;color:#fff;font-weight:700;font-size:14px;letter-spacing:.3px;text-transform:uppercase}
.bh .ic{display:flex;align-items:center;justify-content:center;width:46px;background:#c9a227;color:#fff;font-size:24px;font-weight:800;font-family:Poppins,Arial,sans-serif}
.bh .tx{padding:7px 14px;align-self:center}
.bb{padding:8px 14px;font-size:13px}
.party b{font-size:14.5px;color:#0d2c5a;text-transform:uppercase}
.party div{line-height:1.45}
.party .k{color:#0d2c5a;font-weight:700}
table{border-collapse:collapse;width:100%}
.kv td{padding:4px 10px;border-bottom:1px solid #eee3c1;font-size:13px;vertical-align:top}
.kv td.c{width:14px;padding:5px 0;text-align:center}
.kv tr:last-child td{border-bottom:0}
.kv.lines td:first-child{border-inline-end:1px solid #eee3c1}
.goods th{background:#f7ecc8;color:#14213d;font-weight:700;font-size:12.5px;padding:7px 6px;border:1px solid #e2b93b;text-align:center}
.goods td{border:1px solid #e2b93b;padding:8px;font-size:12.5px;vertical-align:middle;text-align:center}
.goods td.spec{text-align:start;vertical-align:top}
.goods td.spec b{color:#0d2c5a;text-transform:uppercase;display:block;margin-bottom:3px}
.goods .amt{font-weight:700;white-space:nowrap}
.goods tfoot td{background:#eef3fa;font-weight:800;font-size:14px}
.goods tfoot .lbl{text-align:start;font-size:16px;color:#0d2c5a}
.goods .fx td{background:#fff;font-size:12.5px;font-weight:700}
.terms .row{display:flex;align-items:flex-start;gap:12px;padding:5px 0}
.terms .n{flex:0 0 26px;height:26px;border-radius:50%;background:#c9a227;color:#fff;font-weight:800;display:flex;align-items:center;justify-content:center;font-family:Poppins,Arial,sans-serif}
.terms .k{flex:0 0 190px;font-weight:700;color:#0d2c5a}
.terms .c{flex:0 0 12px}
.terms .v{flex:1}
.strip{display:grid;grid-template-columns:repeat(5,1fr);border:1.5px solid #e2b93b;border-radius:8px;background:#eef3fa;margin-bottom:10px;padding:6px 0}
.strip div{text-align:center;border-inline-end:1.5px solid #9fb0c8;padding:2px 4px}
.strip div:last-child{border-inline-end:0}
.strip small{display:block;font-weight:700;color:#0d2c5a;font-size:13px}
.strip span{font-size:15px}
.rem{margin:8px 10px 10px;border:1px solid #d8e0ec;border-radius:6px;overflow:hidden}
.rem h4{margin:0;padding:4px 10px;background:#e8eef7;color:#0d2c5a;font-size:13.5px}
.rem p{margin:0;padding:5px 10px;min-height:38px;white-space:pre-wrap;font-size:12.5px}
.narr p{min-height:120px;padding:12px}
.decl{padding:8px 14px;font-size:12.5px}
.sig td{padding:3px 8px;font-size:12px}
.sig .ln{border-bottom:1px solid #8a96a8;width:100%;display:inline-block;min-height:16px}
.stampbox{width:120px;height:90px;border:1px solid #8a96a8;display:flex;align-items:center;justify-content:center}
.stampbox img{max-width:110px;max-height:84px;object-fit:contain}
.num{font-family:Arial,sans-serif}
.p2 .bh{font-size:12.5px;letter-spacing:0}.p2 .bh .ic{width:38px;font-size:20px}.p2 .bh .tx{padding:6px 10px}
.p2 .kv td{padding:3px 10px;font-size:12px}.p2 .hdr .logo{width:90px;height:90px}.p2 .co{font-size:26px}
.p2 .title h1{font-size:32px}
${lang === "ur" ? ".p2 .kv td,.p2 .sig td{line-height:1.5;padding-top:2px;padding-bottom:2px}.p2 .rem h4{font-size:12px;padding:1px 10px;line-height:1.7}.p2 .rem p{min-height:30px;padding:3px 10px}.p2 .narr p{min-height:80px}.p2 .decl{line-height:1.75;padding:4px 14px}.p2 .strip small{line-height:1.6}.p2 .title{padding:4px 20px}" : ""}
@media print{html,body{background:#fff}.page{margin:0}}
@media screen and (max-width:820px){html,body{background:#fff}}
`;
}

export function renderBookingContractHtml(data: BookingReportData, branding: ContractBranding | null, lang: string): string {
  const L = (key: string, fallback: string) => t(lang, `pbdoc.${key}`, fallback);
  const isRtl = RTL.has(lang);
  const b = branding || {};
  const cur = data.currency;
  const base = data.baseCurrency;
  const company = b.entityName || b.legalName || "";
  const subName = b.legalName && b.legalName !== company ? b.legalName : "";

  const corners = '<div class="corner c-tl"></div><div class="corner c-tr"></div><div class="corner c-bl"></div><div class="corner c-br"></div>';
  const watermark = b.logoUrl ? `<div class="wm"><img src="${esc(b.logoUrl)}" alt=""></div>` : "";
  const contact = [
    b.address ? `<span>${ICON.pin}${esc(b.address)}</span>` : "",
    b.phone ? `<span>${ICON.phone}${ltr(esc(b.phone))}</span>` : "",
    b.email ? `<span>${ICON.mail}${ltr(esc(b.email))}</span>` : "",
  ].filter(Boolean).join('<span class="sep">|</span>');
  const header = company || b.logoUrl || contact
    ? `<div class="hdr z">
        ${b.logoUrl ? `<img class="logo" src="${esc(b.logoUrl)}" alt="">` : ""}
        <div class="hdr-txt">
          ${company ? `<div class="co">${esc(company)}</div>` : ""}
          ${subName ? `<div class="sub">${esc(subName)}</div>` : ""}
          ${contact ? `<div class="contact">${contact}</div>` : ""}
        </div>
      </div>`
    : "";
  const titleBar = (title: string, page: number) => `
    <div class="title z">
      <h1>${esc(title)}</h1>
      <div class="pg">${esc(L("original_for_recipient", "Original for Recipient"))}<b>${esc(L("page_of", "Page {n} of {total}").replace("{n}", String(page)).replace("{total}", "2"))}</b></div>
    </div>`;
  const boxHead = (icon: string, text: string) => `<div class="bh"><span class="ic">${icon}</span><span class="tx">${esc(text)}</span></div>`;
  const kvRow = (k: string, v: string) => `<tr><td>${esc(k)}</td><td class="c">:</td><td>${v}</td></tr>`;

  /* ---------- page 1 ---------- */
  const sellerLines = [
    data.seller.company && data.seller.company !== data.seller.name ? esc(data.seller.company) : "",
    data.seller.address ? esc(data.seller.address) : "",
    data.seller.country ? esc(data.seller.country) : "",
    data.seller.phone ? `${esc(L("tel", "Tel"))}: ${ltr(esc(data.seller.phone))}` : "",
    data.seller.email ? `${esc(L("email", "Email"))}: ${ltr(esc(data.seller.email))}` : "",
    data.salesAccount.code ? `${esc(L("account_no", "Account No."))}: ${ltr(esc(data.salesAccount.code))}` : "",
  ].filter(Boolean);
  const buyerName = company || data.purchaseAccount.name;
  const buyerLines = [
    company ? (b.address ? esc(b.address) : "") : "",
    company && b.phone ? `${esc(L("tel", "Tel"))}: ${ltr(esc(b.phone))}` : "",
    company && b.email ? `${esc(L("email", "Email"))}: ${ltr(esc(b.email))}` : "",
    data.purchaseAccount.code ? `${esc(L("account_no", "Account No."))}: ${ltr(esc(data.purchaseAccount.code))}${company && data.purchaseAccount.name ? ` — ${esc(data.purchaseAccount.name)}` : ""}` : "",
  ].filter(Boolean);
  const party = (name: string, lines: string[], extra = "") =>
    `<div class="bb party"><b>${val(name)}</b>${lines.map((l) => `<div>${l}</div>`).join("")}${extra}</div>`;
  const delivery =
    `<div><span class="k">${esc(L("place_of_delivery", "Place of Delivery"))}:</span> ${val(data.receiving.toPort)}</div>` +
    `<div><span class="k">${esc(L("final_destination", "Final Destination"))}:</span> ${val(data.receiving.finalDestination)}</div>`;

  const goodsRows = data.lines.length
    ? data.lines
        .map((l) => {
          const spec = [
            l.size ? `${esc(L("size", "Size"))}: <bdi>${esc(l.size)}</bdi>` : "",
            l.brand ? `${esc(L("brand", "Brand"))}: <bdi>${esc(l.brand)}</bdi>` : "",
            l.origin ? `${esc(L("origin", "Origin"))}: <bdi>${esc(l.origin)}</bdi>` : "",
            l.hsCode ? `${esc(L("hs_code", "HS Code"))}: ${ltr(esc(l.hsCode))}` : "",
          ].filter(Boolean);
          const packing = [l.unit ? esc(l.unit) : "", l.packWeight ? `${ltr(qty(l.packWeight))} ${esc(L("kg_each", "kg each"))}` : ""].filter(Boolean).join("<br>");
          const terms = [data.loadingType ? esc(data.loadingType) : "", data.loading.fromPort ? esc(data.loading.fromPort) : ""].filter(Boolean).join(" · ");
          return `<tr>
            <td class="spec"><b>${val(l.goodsName)}</b>${spec.map((x) => `<div>${x}</div>`).join("")}</td>
            <td class="num">${ltr(`${qty(l.qty)} ${esc(l.unit)}`)}</td>
            <td>${packing || DASH}</td>
            <td>${terms ? `<div>${terms}</div>` : ""}<div class="amt num">${ltr(`${esc(cur)} ${money(l.price)}`)}</div></td>
            <td class="amt num">${ltr(`${esc(cur)} ${money(l.amount)}`)}</td>
          </tr>`;
        })
        .join("")
    : `<tr><td colspan="5">${esc(L("no_goods", "No goods saved on this booking."))}</td></tr>`;

  const termsRows: [string, string][] = [];
  const payTerms = [
    data.paymentType,
    data.payment.advancePercent !== null ? `${L("advance", "Advance")} ${data.payment.advancePercent}%` : "",
    data.payment.details,
  ].filter(Boolean);
  if (payTerms.length) termsRows.push([L("payment_terms", "Payment Terms"), payTerms.map((x) => `<bdi>${esc(x)}</bdi>`).join(" — ")]);
  const route = [data.loading.fromPort || data.loading.fromCountry, data.receiving.toPort || data.receiving.toCountry].filter(Boolean).join(" → ");
  const shipTerms = [data.shipType, data.loadingType, route].filter(Boolean);
  if (shipTerms.length) termsRows.push([L("shipment_terms", "Shipment Terms"), shipTerms.map((x) => `<bdi>${esc(x)}</bdi>`).join(" — ")]);
  if (data.qualityReport) termsRows.push([L("quality_packing", "Quality & Packing"), esc(data.qualityReport)]);

  const page1 = `
  <section class="page" data-page="1">${corners}${watermark}
    ${header}
    ${titleBar(L("title_contract", "Purchase Contract"), 1)}
    <div class="grid2 z">
      <div>
        <div class="box">${boxHead(ICON.building, L("seller", "Seller / Exporter"))}${party(data.seller.name, sellerLines)}</div>
        <div class="box">${boxHead(ICON.user, L("buyer", "Buyer / Consignee"))}${party(buyerName, buyerLines, delivery)}</div>
      </div>
      <div class="box">${boxHead(ICON.doc, L("contract_details", "Contract Details"))}
        <table class="kv lines">
          ${kvRow(L("contract_no", "Contract No."), ltr(val(data.contractNo)))}
          ${kvRow(L("date", "Date"), ltr(val(data.bookingDate)))}
          ${kvRow(L("invoice_no", "Invoice No."), ltr(val(data.billNo)))}
          ${kvRow(L("invoice_date", "Invoice Date"), ltr(val(data.invoiceDate || data.bookingDate)))}
          ${kvRow(L("booking_no", "Booking No."), ltr(val(data.bookingNo)))}
          ${kvRow(L("serial_no", "Serial No."), ltr(val(data.serialNo)))}
        </table>
      </div>
    </div>
    <div class="box z">${boxHead(ICON.box, L("goods_details", "Goods Details"))}
      <table class="goods">
        <thead><tr>
          <th>1. ${esc(L("col_commodity", "Commodity & Specification"))}</th>
          <th>2. ${esc(L("col_quantity", "Quantity"))}</th>
          <th>3. ${esc(L("col_packing", "Packing"))}</th>
          <th>4. ${esc(L("col_unit_price", "Unit Price & Terms"))}</th>
          <th>5. ${esc(L("col_amount", "Amount"))}</th>
        </tr></thead>
        <tbody>${goodsRows}</tbody>
        <tfoot>
          <tr><td class="lbl">${esc(L("total", "Total"))}</td><td class="num">${ltr(`${qty(data.totals.qty)} ${esc(data.totals.unit)}`)}</td><td></td><td></td><td class="num" data-total-amount>${ltr(`${esc(cur)} ${money(data.totals.amount)}`)}</td></tr>
          <tr class="fx"><td class="lbl" colspan="3">${esc(L("exchange_rate", "Exchange Rate"))}</td><td class="num" colspan="2" data-rate>${ltr(val(data.rateLabel))}</td></tr>
          <tr class="fx"><td class="lbl" colspan="3">${esc(L("final_amount", "Final Amount"))} ${ltr(`(${esc(base)})`)}</td><td class="num" colspan="2" data-final>${ltr(`${esc(base)} ${money(data.totals.finalAmount)}`)}</td></tr>
        </tfoot>
      </table>
    </div>
    ${termsRows.length ? `<div class="box z">${boxHead(ICON.doc, L("terms", "Commercial Terms & Conditions"))}
      <div class="bb terms">${termsRows.map(([k, v], i) => `<div class="row"><span class="n">${i + 1}</span><span class="k">${esc(k)}</span><span class="c">:</span><span class="v">${v}</span></div>`).join("")}</div>
    </div>` : ""}
  </section>`;

  /* ---------- page 2 ---------- */
  const step = (n: number, title: string, rows: [string, string][], remarkLabel: string, remark: string) => `
    <div class="box">${boxHead(String(n), title)}
      <table class="kv">${rows.map(([k, v]) => kvRow(k, v)).join("")}</table>
      <div class="rem"><h4>${esc(remarkLabel)}</h4><p>${remark ? esc(remark) : DASH}</p></div>
    </div>`;
  const remarksLabel = L("report_remarks", "Report / Remarks");
  const m = (n: number | null, c: string, d = 2) => (n === null ? DASH : ltr(`${esc(c)} ${money(n, d)}`));

  const page2 = `
  <section class="page p2" data-page="2">${corners}${watermark}
    ${header}
    ${titleBar(L("title_annexure", "Contract Report & Annexure"), 2)}
    <div class="strip z">
      <div><small>${esc(L("contract_no", "Contract No."))}</small><span>${ltr(val(data.contractNo))}</span></div>
      <div><small>${esc(L("invoice_no", "Invoice No."))}</small><span>${ltr(val(data.billNo))}</span></div>
      <div><small>${esc(L("booking_no", "Booking No."))}</small><span>${ltr(val(data.bookingNo))}</span></div>
      <div><small>${esc(L("serial_no", "Serial No."))}</small><span>${ltr(val(data.serialNo))}</span></div>
      <div><small>${esc(L("date", "Date"))}</small><span>${ltr(val(data.bookingDate))}</span></div>
    </div>
    <div class="g2 z">
      ${step(1, L("step1", "Step 1 — Loading & Shipping Report"), [
        [L("loading_country", "Loading Country"), val(data.loading.fromCountry)],
        [L("loading_port", "Loading Port"), val(data.loading.fromPort)],
        [L("loading_date", "Loading Date"), ltr(val(data.loading.date))],
        [L("receiving_port", "Receiving Port"), val(data.receiving.toPort)],
        [L("shipping_line", "Shipping Line"), val(data.loading.shippingLine)],
        [L("vessel_name", "Vessel Name"), val(data.loading.vesselName)],
        [L("voyage_no", "Voyage No."), ltr(val(data.loading.voyageNo))],
      ], remarksLabel, data.remarks.loading)}
      ${step(2, L("step2", "Step 2 — Goods Summary Report"), [
        [L("total_items", "Total Items"), ltr(String(data.totals.items))],
        [L("total_quantity", "Total Quantity"), ltr(`${qty(data.totals.qty)} ${esc(data.totals.unit)}`)],
        [L("total_gross", "Total Gross Weight"), ltr(`${money(data.totals.grossMt, 3)} MT`)],
        [L("total_net", "Total Net Weight"), ltr(`${money(data.totals.netMt, 3)} MT`)],
        [`${L("total_amount", "Total Amount")} (${cur || DASH})`, ltr(`<b>${money(data.totals.amount)}</b>`)],
        [L("exchange_rate", "Exchange Rate"), `<b>${ltr(val(data.rateLabel))}</b>`],
        [`${L("final_amount", "Final Amount")} (${base || DASH})`, ltr(`<b>${money(data.totals.finalAmount)}</b>`)],
      ], remarksLabel, data.remarks.quantity)}
      ${step(3, L("step3", "Step 3 — Payment & Settlement Report"), [
        [L("payment_type", "Payment Type"), val(data.paymentType)],
        [L("advance_percent", "Advance Percentage"), data.payment.advancePercent === null ? DASH : ltr(`${data.payment.advancePercent} %`)],
        [L("advance_amount", "Advance Amount"), m(data.payment.advanceFinal, base)],
        [L("advance_date", "Advance Date"), ltr(val(data.payment.advanceDate))],
        [L("final_payment_date", "Final Payment Date"), ltr(val(data.payment.finalPaymentDate))],
        [L("final_payment_amount", "Final Payment Amount"), m(data.payment.balanceFinal, base)],
        [L("settlement_currency", "Settlement Currency"), ltr(val(base))],
        [L("total_payment", "Total Payment"), `<b>${m(data.totals.finalAmount, base)}</b>`],
      ], remarksLabel, data.remarks.payment)}
      <div class="box">${boxHead("4", L("step4", "Final Report / Journal Narration"))}
        <div class="rem narr"><p>${data.remarks.journal ? esc(data.remarks.journal) : DASH}</p></div>
      </div>
    </div>
    <div class="box z">${boxHead(ICON.doc, L("declaration", "Declaration & Acceptance"))}
      <div class="decl">${esc(L("declaration_text", "We, the undersigned, hereby confirm that both parties have reviewed and accepted the above contract reports and annexure details in accordance with the terms and conditions of this purchase contract."))}</div>
    </div>
    <div class="g2 z">
      ${(["buyer_signature", "seller_signature"] as const).map((k) => `
      <div class="box">${boxHead(ICON.user, k === "buyer_signature" ? L("buyer_signature", "Buyer Signature & Stamp") : L("seller_signature", "Seller Signature & Stamp"))}
        <div style="display:flex;gap:10px;padding:6px 10px;align-items:center">
          <table class="sig" style="flex:1">
            ${[L("sig_name", "Name"), L("sig_designation", "Designation"), L("sig_date", "Date"), L("sig_stamp", "Stamp")].map((x) => `<tr><td style="width:90px">${esc(x)}</td><td style="width:10px">:</td><td><span class="ln"></span></td></tr>`).join("")}
          </table>
          <div class="stampbox">${k === "buyer_signature" && b.stampUrl ? `<img src="${esc(b.stampUrl)}" alt="">` : ""}</div>
        </div>
      </div>`).join("")}
    </div>
  </section>`;

  const title = `${L("title_contract", "Purchase Contract")}${data.bookingNo ? ` — ${data.bookingNo}` : ""}`;
  return `<!doctype html>
<html lang="${esc(lang)}" dir="${isRtl ? "rtl" : "ltr"}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title><style>${css(isRtl, lang)}</style></head>
<body>${page1}${page2}</body>
</html>`;
}
