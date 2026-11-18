/**
 * Damaan "SALES INVOICE" layout, matched to the owner's sample PDF (Damaan_Sales_Invoice_No_Duplicate_Delivery.pdf).
 * The same layout is used for purchase and sales documents. Every value comes from TradeDocumentInput. A value the source
 * record does not carry prints as a dash, except bank fields: the bank labels stay and the values fill in from the bank
 * that is chosen on the invoice, so a missing bank value prints blank. The company header is the creating branch's company.
 */
import type { SupportedLanguage } from "@/lib/i18n/languages";
import type { TradeDocumentInput, TradeLineItem } from "@/lib/reports/trade-documents/types";
import type { InvoiceTemplateFlags } from "./types";
import { esc, prepareInvoiceData, documentShell, money, num, isReal, invoiceQrSvg } from "./shared";

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const dash = (v: unknown) => (isReal(v) ? esc(String(v)) : "—");
const val = (v: unknown) => (isReal(v) ? esc(String(v)) : "");
const dmy = (v: string | null | undefined) => {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
};
const dmyUpper = (v: string | null | undefined) => {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return `${String(d.getUTCDate()).padStart(2, "0")}-${MONTHS[d.getUTCMonth()]}-${d.getUTCFullYear()}`;
};
const perPack = (total: number | null | undefined, packs: number | null | undefined): number | null => {
  if (total == null || packs == null) return null;
  const t = Number(total);
  const p = Number(packs);
  return Number.isFinite(t) && Number.isFinite(p) && p > 0 ? t / p : null;
};
const w3 = (v: number | null | undefined) =>
  v == null || !Number.isFinite(Number(v))
    ? "—"
    : Number(v).toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const vatPctText = (li: TradeLineItem): string => {
  if (li.taxAmount == null) return "—";
  const amt = Number(li.amount);
  const tax = Number(li.taxAmount);
  if (!Number.isFinite(amt) || amt <= 0 || !Number.isFinite(tax)) return "—";
  const pct = (tax / amt) * 100;
  return Number.isInteger(Math.round(pct * 100) / 100) ? `${Math.round(pct)}%` : `${pct.toFixed(2)}%`;
};

const STANDARD_NOTES = [
  "ALL GOODS ARE PACKED IN GOOD ORDER & CONDITION AND MARKED AS PER INVOICE.",
  "WEIGHT & MEASUREMENT ARE ACCORDING TO SHIPPER'S DECLARATION.",
];

export function renderTaxInvoice(input: TradeDocumentInput, flags: InvoiceTemplateFlags): string {
  const d = prepareInvoiceData(input, flags);
  const lang = (input.lang || "en") as SupportedLanguage;
  const landscape = input.orientation === "landscape";
  const cur = d.currency || input.currency || "";
  const goods: TradeLineItem[] = input.goods || [];
  const totals = input.totals || {};
  const bank = input.bank || null;
  const br = input.branding;
  const seller = input.seller || {};
  const buyer = input.buyer || {};
  const transport = input.transport || null;
  const totalPacks = totals.totalPackages ?? goods.reduce((s, g) => s + (Number(g.packages) || 0), 0);
  const unitWord = goods[0]?.unit || "";
  const unitLabel = (unitWord || "UNIT").toUpperCase();
  // The rate is quoted per KG when a source line's amount equals net KG x rate; otherwise per the line's unit.
  const pricedLine = goods.find((g) => g.unitPrice != null && g.amount != null && Number(g.netWeight) > 0);
  const rateOnKg = !!pricedLine
    && Math.abs(Number(pricedLine.netWeight) * Number(pricedLine.unitPrice) - Number(pricedLine.amount))
      <= Math.max(1, Math.abs(Number(pricedLine.amount)) * 0.005);
  const rateLabel = rateOnKg ? "KG" : unitLabel;
  // Sales and tax invoices carry the sample's headline; other document types keep their own title on the same layout.
  const headline = input.docType === "tax_invoice" || input.docType === "sales_invoice"
    ? "SALES INVOICE"
    : (d.docTitle || "INVOICE").toUpperCase();
  const netPerCarton = perPack(totals.totalNetWeight ?? goods.reduce((s, g) => s + (Number(g.netWeight) || 0), 0), totalPacks);
  const firstRate = goods.find((g) => g.unitPrice != null)?.unitPrice;
  const zeroVatSingle = goods.length === 1 && (goods[0].taxAmount == null || Number(goods[0].taxAmount) === 0);
  const vatTotalLabel = zeroVatSingle ? "TOTAL VAT (0% ON THIS ITEM)" : "TOTAL VAT";

  const goodsRows = goods.length
    ? goods.map((li, i) => {
        const packs = li.packages;
        const gPer = perPack(li.grossWeight, packs);
        const nPer = perPack(li.netWeight, packs);
        const vat = li.taxAmount == null ? NaN : Number(li.taxAmount);
        const finalAmt = (Number(li.amount) || 0) + (Number.isFinite(vat) ? vat : 0);
        return `<tr>
          <td class="c">${i + 1}</td>
          <td class="b">${dash(li.description)}</td>
          <td class="c"><div class="lbl">BRAND</div><div>${dash(li.brand)}</div><div class="lbl">SIZE</div><div>${dash(li.size)}</div></td>
          <td class="c">${dash(li.hsCode)}</td>
          <td class="c">${isReal(packs) ? esc(num(packs)) : "—"}<br/>${dash(li.unit)}</td>
          <td class="c"><div class="lbl">GROSS</div>${gPer !== null ? `${w3(gPer)} KG` : "—"}<div class="lbl">NET</div>${nPer !== null ? `${w3(nPer)} KG` : "—"}</td>
          <td class="c"><div class="lbl">GROSS</div>${li.grossWeight != null ? `${w3(li.grossWeight)} KG` : "—"}<div class="lbl">NET</div>${li.netWeight != null ? `${w3(li.netWeight)} KG` : "—"}</td>
          <td class="r">${li.unitPrice != null ? esc(money(li.unitPrice)) : "—"}</td>
          <td class="r">${li.amount != null ? esc(money(li.amount)) : "—"}</td>
          <td class="c">${vatPctText(li)}<div class="sm">${Number.isFinite(vat) ? `${esc(cur)} ${esc(money(vat))}` : "—"}</div></td>
          <td class="r">${Number.isFinite(vat) ? esc(money(vat)) : "—"}</td>
          <td class="r b">${li.amount != null ? esc(money(finalAmt)) : "—"}</td>
        </tr>`;
      }).join("")
    : `<tr><td colspan="12" class="c">No goods lines on this transaction.</td></tr>`;

  const pricing = [
    totalPacks && netPerCarton !== null ? `${num(totalPacks)} ${unitWord} × ${w3(netPerCarton)} KG NET` : null,
    firstRate != null ? `${cur} ${money(firstRate)} PER ${rateLabel}` : null,
  ].filter(Boolean) as string[];

  // Company header: the creating branch's company (logo space on the left, company details on the right).
  const logo = isReal(br.logoUrl) ? String(br.logoUrl) : "/images/damaan-logo.png";
  const companyName = br.legalName || br.entityName;
  const companyLines = [br.address, br.phone ? `TEL: ${br.phone}` : null, br.email, br.website, br.taxNumber ? `TRN: ${br.taxNumber}` : null]
    .filter(isReal).map((x) => `<div>${esc(String(x))}</div>`).join("");
  const stamp = isReal(br.stampUrl) ? `<img class="stamp" src="${esc(br.stampUrl)}" alt="" />` : `<div class="stamp-empty">COMPANY STAMP</div>`;
  const shipperName = seller.name || companyName;
  const shipperAddress = seller.address || br.address;
  const shipperEmail = seller.email || br.email;

  const pageH = landscape ? "210mm" : "297mm";
  const pageW = landscape ? "297mm" : "210mm";
  const style = `
    body { background: #fff; color: #000; font-family: 'Times New Roman', Georgia, serif; font-size: 9pt; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page { width: ${pageW}; height: ${pageH}; margin: 0 auto; padding: 6mm 8mm; box-sizing: border-box; display: flex; flex-direction: column; }
    .companyhead { display: flex; align-items: flex-start; gap: 8px; min-height: 30mm; }
    .logocell { width: 40%; min-height: 28mm; display: flex; align-items: center; justify-content: flex-start; gap: 8px; }
    .logo { max-height: 28mm; max-width: 60%; }
    .qr { text-align: center; font-family: Arial, Helvetica, sans-serif; font-size: 6.5pt; font-weight: 700; }
    .qr svg { width: 24mm; height: 24mm; display: block; }
    .companydetails { width: 60%; text-align: right; font-size: 8.5pt; line-height: 1.35; }
    .companydetails .cname { font-family: Arial, Helvetica, sans-serif; font-size: 11pt; font-weight: 700; }
    table.frame { width: 100%; border-collapse: collapse; }
    table.frame td { border: 1px solid #000; padding: 4px 6px; vertical-align: top; }
    .title { font-family: Arial, Helvetica, sans-serif; font-size: 17pt; font-weight: 700; text-align: center; letter-spacing: .3px; }
    .orig { font-size: 8pt; font-weight: 700; text-align: center; }
    .v { font-size: 9pt; }
    .meta td { border: none; border-bottom: 1px solid #000; padding: 4px 6px; }
    .meta td.mk { font-size: 8pt; font-weight: 700; }
    .meta td.mv { font-size: 9pt; text-align: left; }
    .sec { font-weight: 700; font-size: 8pt; text-transform: uppercase; }
    .goods-wrap { flex: 1 1 auto; display: flex; flex-direction: column; margin-top: 4px; min-height: 0; }
    table.goods { width: 100%; height: 100%; border-collapse: collapse; font-size: 8pt; }
    table.goods th, table.goods td { border: 1px solid #000; padding: 3px 3px; vertical-align: middle; }
    table.goods th { font-size: 6.8pt; font-weight: 700; text-align: center; text-transform: uppercase; }
    table.goods td.r { text-align: right; } table.goods td.c { text-align: center; } table.goods td.b { font-weight: 700; }
    .lbl { font-size: 6.5pt; font-weight: 700; }
    .sm { font-size: 7pt; font-weight: 700; }
    table.tot { border-collapse: collapse; width: 100%; font-size: 8.5pt; }
    table.tot td { padding: 3px 6px; border: none; }
    table.tot td.n { text-align: left; font-weight: 700; }
    table.tot td.v { text-align: right; font-weight: 700; }
    table.tot tr.fin td { font-size: 9pt; border-top: 1px solid #000; }
    .bank p { margin: 2px 0; font-size: 8.3pt; line-height: 1.3; min-height: 1.3em; }
    .stamp { display: block; margin: 4px auto 0; max-height: 120px; max-width: 170px; }
    .stamp-empty { height: 110px; border: 1px dashed #666; text-align: center; line-height: 110px; font-size: 7pt; color: #666; margin-top: 4px; }
    .foot { margin-top: 4px; font-size: 7.5pt; display: flex; justify-content: space-between; gap: 6px; border-top: 1px solid #aaa; padding-top: 3px; }
    .notes { font-size: 8pt; margin-top: 4px; }
    .bottom { flex: 0 0 auto; }
  `;

  const body = `
    <div class="page">
      <div class="companyhead">
        <div class="logocell">
          <img class="logo" src="${esc(logo)}" alt="" />
          ${isReal(input.publicUrl) ? `<div class="qr">${invoiceQrSvg(String(input.publicUrl), 90)}<div>SCAN TO VIEW</div></div>` : ""}
        </div>
        <div class="companydetails">
          ${companyName ? `<div class="cname">${esc(String(companyName))}</div>` : ""}
          ${companyLines}
        </div>
      </div>

      <table class="frame" style="margin-top:4px">
        <tr>
          <td colspan="2" style="width:74%"><div class="title">${esc(headline)}</div></td>
          <td style="width:26%"><div class="orig">ORIGINAL FOR<br/>RECIPIENT</div></td>
        </tr>
        <tr>
          <td style="width:50%">
            <div class="sec">Shipper:</div>
            <div class="v"><b>${dash(shipperName)}</b></div>
            <div class="v">${dash(shipperAddress)}</div>
            <div class="v">${isReal(shipperEmail) ? `EMAIL: ${esc(shipperEmail)}` : "—"}</div>
          </td>
          <td colspan="2" style="padding:0">
            <table class="meta" style="width:100%;border-collapse:collapse">
              <tr><td class="mk" style="width:50%">Tax Invoice No:</td><td class="mv">${dash(input.docNo)}</td><td class="mk">Date:</td><td class="mv">${dmy(input.docDate)}</td></tr>
              <tr><td class="mk">Invoice No:</td><td class="mv">${dash(input.referenceNos?.invoice)}</td><td class="mk">Invoice Date:</td><td class="mv">${dmy(input.docDate)}</td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="width:50%">
            <div class="sec">Consignee (Notify Party):</div>
            <div class="v"><b>${dash(buyer.name)}</b></div>
            <div class="v">${dash(buyer.address)}</div>
            <div class="v">${isReal(buyer.phone) ? `TEL: ${esc(buyer.phone)}` : "—"}</div>
            <div class="v">${isReal(buyer.email) ? `EMAIL: ${esc(buyer.email)}` : "—"}</div>
            <div class="v">${isReal(buyer.taxId) ? `TRN NO: ${esc(buyer.taxId)}` : "—"}</div>
          </td>
          <td style="width:25%">
            <div class="sec">Place of Delivery:</div>
            <div class="v">${dash(transport?.placeOfDelivery || input.delivery?.deliveryTerms)}</div>
          </td>
          <td style="width:25%">
            <div class="sec">FINAL DESTINATION:</div>
            <div class="v">${dash(transport?.finalDestination)}</div>
          </td>
        </tr>
      </table>

      <div class="goods-wrap">
        <table class="goods">
          <thead><tr>
            <th style="width:4%">S#</th>
            <th style="width:12%">GOODS NAME</th>
            <th style="width:12%">BRAND / SIZE</th>
            <th style="width:8%">HSCODE</th>
            <th style="width:8%">QUANTITY<br/>UNIT</th>
            <th style="width:11%">PER CARTON<br/>GROSS / NET</th>
            <th style="width:12%">TOTAL WEIGHT<br/>GROSS / NET</th>
            <th style="width:7%">RATE<br/>${esc(cur)}/${esc(rateLabel)}</th>
            <th style="width:8%">AMOUNT<br/>${esc(cur)}</th>
            <th style="width:6%">VAT %</th>
            <th style="width:6%">VAT<br/>${esc(cur)}</th>
            <th style="width:8%">FINAL<br/>${esc(cur)}</th>
          </tr></thead>
          <tbody>${goodsRows}</tbody>
        </table>
      </div>

      <div class="bottom">
        <table class="frame" style="margin-top:4px">
          <tr>
            <td style="width:50%">
              <div class="sec">Pricing basis:</div>
              ${pricing.length ? pricing.map((p) => `<div class="v">${esc(p)}</div>`).join("") : `<div class="v">—</div>`}
              <div class="v" style="margin-top:3px">Item-level VAT is shown in the goods table.</div>
            </td>
            <td style="width:50%;padding:0">
              <table class="tot">
                <tr><td class="n">TOTAL AMOUNT (BEFORE VAT)</td><td class="v">${esc(cur)} ${totals.subTotal != null ? esc(money(totals.subTotal)) : "—"}</td></tr>
                <tr><td class="n">${esc(vatTotalLabel)}</td><td class="v">${esc(cur)} ${totals.taxAmount != null ? esc(money(totals.taxAmount)) : "—"}</td></tr>
                <tr class="fin"><td class="n">FINAL TOTAL (INCL. VAT)</td><td class="v">${esc(cur)} ${totals.grandTotal != null ? esc(money(totals.grandTotal)) : "—"}</td></tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="width:50%">
              <div class="sec">Other details:</div>
              <div class="v">DELIVERY: ${dash(transport?.placeOfDelivery || input.delivery?.deliveryTerms)}${isReal(transport?.finalDestination) ? `, ${esc(transport?.finalDestination)}` : ""}</div>
              <div class="v">PAYMENT TERMS: ${dash(input.delivery?.paymentTerms)}</div>
              <div class="v">ALL GOODS ARE PACKED IN GOOD ORDER &amp; CONDITION.</div>
            </td>
            <td style="width:50%;padding:0">
              <table class="meta" style="width:100%;border-collapse:collapse">
                <tr><td class="mk" style="width:45%">Delivered on:</td><td class="mv">${dmyUpper(input.docDate)}</td></tr>
                <tr><td class="mk">Delivery terms:</td><td class="mv">${dash(input.delivery?.deliveryTerms)}</td></tr>
                <tr><td class="mk">Number &amp; kind of packages:</td><td class="mv">${isReal(totalPacks) ? `${esc(num(totalPacks))} ${esc(unitWord)}` : "—"}</td></tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="width:50%" class="bank">
              <div class="sec">Bank details:</div>
              <p><b>${val(bank?.accountTitle)}</b></p>
              <p><b>BANK:</b> ${val(bank?.bankName)}</p>
              <p><b>BENEFICIARY BANK ADDRESS:</b> ${val(bank?.bankAddress || bank?.branchName)}</p>
              <p><b>BENEFICIARY NAME:</b> ${val(bank?.accountTitle)}</p>
              <p><b>BENEFICIARY ADDRESS:</b> ${val(bank?.address)}</p>
              <p><b>ACCOUNT NO:</b> ${val(bank?.accountNumber)}</p>
              <p><b>IBAN NO:</b> ${val(bank?.iban)}</p>
              <p><b>SWIFT CODE:</b> ${val(bank?.swift)}</p>
              <p><b>BANK CHARGES:</b> REMITTER</p>
            </td>
            <td style="width:50%">
              <div class="sec">Company stamp (design)</div>
              ${stamp}
            </td>
          </tr>
          <tr>
            <td colspan="2">
              <div class="notes"><b>NOTES:</b> ${(isReal(input.notes) ? [esc(String(input.notes))] : STANDARD_NOTES.map(esc)).join("<br/>")}</div>
            </td>
          </tr>
        </table>

        <div class="foot">
          ${[br.address, br.phone, br.email, br.website].filter(isReal).map((v) => `<span>${esc(String(v))}</span>`).join("")}
        </div>
      </div>
    </div>
  `;

  return documentShell({
    lang, dir: d.dir, title: headline, docNo: input.docNo, docTitle: headline,
    brandName: d.brandName, stamp: d.stamp, orientation: landscape ? "landscape" : "portrait", style, body,
    autoPrint: input.autoPrint, pageLabel: d.pageLabel, ofLabel: d.ofLabel,
  });
}
