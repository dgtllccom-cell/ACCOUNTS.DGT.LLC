/**
 * Sales Tax Invoice, laid out to match the Damaan sample: "SALES TAX INVOICE / ORIGINAL FOR RECIPIENT", Shipper, invoice
 * numbers and dates, Consignee (Notify Party), a goods table (HS code, cartons, per-carton and total gross/net weight,
 * rate, amount, VAT %, VAT, final), pricing basis, totals, other details, bank details, notes and the authorised signature.
 * Presentation only: every value comes from TradeDocumentInput. A value the source record does not carry prints as a dash;
 * VAT % and VAT amounts are shown only when the source line carries a tax amount.
 */
import type { SupportedLanguage } from "@/lib/i18n/languages";
import type { TradeDocumentInput, TradeLineItem } from "@/lib/reports/trade-documents/types";
import type { InvoiceTemplateFlags } from "./types";
import { esc, prepareInvoiceData, documentShell, money, num, isReal } from "./shared";

const dash = (v: unknown) => (isReal(v) ? esc(String(v)) : "—");
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
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
const vatPctOf = (li: TradeLineItem): string => {
  if (li.taxAmount == null) return "—";
  const amt = Number(li.amount);
  const tax = Number(li.taxAmount);
  if (!Number.isFinite(amt) || amt <= 0 || !Number.isFinite(tax)) return "—";
  return `${((tax / amt) * 100).toFixed(2)}%`;
};

export function renderTaxInvoice(input: TradeDocumentInput, flags: InvoiceTemplateFlags): string {
  const d = prepareInvoiceData(input, flags);
  const lang = (input.lang || "en") as SupportedLanguage;
  const orientation = input.orientation || "portrait";
  const cur = d.currency || input.currency || "AED";
  const goods: TradeLineItem[] = input.goods || [];
  const totals = input.totals || {};
  const bank = input.bank || null;
  const br = input.branding;
  const totalPacks = totals.totalPackages ?? goods.reduce((s, g) => s + (Number(g.packages) || 0), 0);
  const totalNet = totals.totalNetWeight ?? goods.reduce((s, g) => s + (Number(g.netWeight) || 0), 0);
  const netPerCarton = perPack(totalNet, totalPacks);
  const firstRate = goods.find((g) => g.unitPrice != null)?.unitPrice;
  const unitWord = goods[0]?.unit || "";
  const unitLabel = (unitWord || "UNIT").toUpperCase();
  // The rate is quoted per KG when a source line's amount equals net KG x rate; otherwise it is quoted per the line's unit.
  const pricedLine = goods.find((g) => g.unitPrice != null && g.amount != null && Number(g.netWeight) > 0);
  const rateOnKg = !!pricedLine
    && Math.abs(Number(pricedLine.netWeight) * Number(pricedLine.unitPrice) - Number(pricedLine.amount))
      <= Math.max(1, Math.abs(Number(pricedLine.amount)) * 0.005);
  const rateLabel = rateOnKg ? "KG" : unitLabel;
  // Sales and tax invoices carry the sample's headline; other document types keep their own title on this layout.
  const headline = input.docType === "tax_invoice" || input.docType === "sales_invoice"
    ? "SALES TAX INVOICE"
    : (d.docTitle || "INVOICE").toUpperCase();

  const partyBox = (title: string, p: typeof d.seller) => `
    <div class="box">
      <div class="k">${esc(title)}</div>
      <div class="pname">${p ? esc(p.name) : "—"}</div>
      ${p ? p.rows.map((r) => `<div class="pl">${esc(r.value)}</div>`).join("") : ""}
    </div>`;

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
      <td>${dash([li.brand, li.size].filter(isReal).join(" / ") || null)}</td>
      <td class="c">${dash(li.hsCode)}</td>
      <td class="c">${isReal(packs) ? esc(num(packs)) : "—"}<br/>${dash(li.unit)}</td>
      <td class="r">${gPer !== null ? `${w3(gPer)} KG Gross` : "—"}<br/>${nPer !== null ? `${w3(nPer)} KG Net` : "—"}</td>
      <td class="r">${li.grossWeight != null ? `${w3(li.grossWeight)} KG Gross` : "—"}<br/>${li.netWeight != null ? `${w3(li.netWeight)} KG Net` : "—"}</td>
      <td class="r">${li.unitPrice != null ? esc(money(li.unitPrice)) : "—"}</td>
      <td class="r">${li.amount != null ? esc(money(li.amount)) : "—"}</td>
      <td class="c">${vatPctOf(li)}</td>
      <td class="r">${Number.isFinite(vat) ? esc(money(vat)) : "—"}</td>
      <td class="r b">${li.amount != null ? esc(money(finalAmt)) : "—"}</td>
    </tr>`;
      }).join("")
    : `<tr><td colspan="12" class="c">No goods lines on this transaction.</td></tr>`;

  const pricing = [
    totalPacks && netPerCarton !== null ? `${num(totalPacks)} ${unitWord} × ${w3(netPerCarton)} KG NET` : null,
    firstRate != null ? `${cur} ${money(firstRate)} PER ${rateLabel}` : null,
  ].filter(Boolean) as string[];

  const style = `
    body { background: #f4f4f5; color: #111827; font-family: Arial, 'Inter', Helvetica, sans-serif; font-size: 8pt; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .wrap { display: flex; justify-content: center; padding: 8px; }
    .page { width: ${orientation === "landscape" ? "297mm" : "210mm"}; background: #fff; }
    .col { padding: 6mm; }
    .hdr { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 1.5px solid #111827; padding-bottom: 3px; }
    .title { font-size: 14pt; font-weight: 900; letter-spacing: .3px; }
    .orig { font-size: 7pt; font-weight: 800; text-align: right; line-height: 1.2; }
    .row2 { display: flex; gap: 6px; margin-top: 6px; }
    .row2 > .box { flex: 1; min-width: 0; }
    .box { border: 1px solid #111827; padding: 4px 6px; min-width: 0; }
    .k { font-size: 6.4pt; font-weight: 800; text-transform: uppercase; color: #374151; }
    .pname { font-size: 9pt; font-weight: 900; margin-top: 2px; }
    .pl { font-size: 7.4pt; line-height: 1.35; overflow-wrap: anywhere; }
    .meta { width: 100%; border-collapse: collapse; font-size: 7.4pt; }
    .meta td { border-bottom: 1px solid #d1d5db; padding: 3px 5px; }
    .meta td.mk { width: 46%; font-weight: 700; color: #374151; }
    .meta td.mv { font-weight: 800; overflow-wrap: anywhere; }
    table.goods { width: 100%; border-collapse: collapse; table-layout: fixed; margin-top: 6px; font-size: 6.9pt; }
    table.goods th, table.goods td { border: 1px solid #111827; padding: 3px; vertical-align: top; overflow-wrap: anywhere; word-break: break-word; }
    table.goods th { background: #f3f4f6; font-size: 6.2pt; font-weight: 800; text-transform: uppercase; text-align: center; }
    table.goods td.r { text-align: right; } table.goods td.c { text-align: center; } table.goods td.b { font-weight: 800; }
    .sum { display: flex; gap: 6px; margin-top: 6px; }
    .sum > .box { min-width: 0; }
    .sum .l { flex: 1; } .sum .r { width: 40%; }
    .tr { display: flex; justify-content: space-between; border-bottom: 1px dotted #9ca3af; padding: 2px 0; font-size: 7.4pt; }
    .tr:last-child { border-bottom: none; }
    .fin { font-weight: 900; font-size: 8.6pt; }
    .sign { margin-top: 12px; border: 1px solid #111827; height: 64px; display: flex; align-items: flex-end; justify-content: center; font-size: 7pt; font-weight: 700; }
    .foot { margin-top: 6px; font-size: 6.6pt; color: #374151; display: flex; justify-content: space-between; gap: 8px; border-top: 1px solid #111827; padding-top: 3px; }
  `;

  const body = `
    <div class="wrap"><div class="page"><div class="col">
      <div class="hdr">
        <div class="title">${esc(headline)}</div>
        <div class="orig">ORIGINAL FOR<br/>RECIPIENT</div>
      </div>

      <div class="row2">
        ${partyBox("Shipper:", d.seller)}
        <div class="box" style="flex:1">
          <table class="meta">
            <tr><td class="mk">Tax Invoice No:</td><td class="mv">${esc(input.docNo)}</td></tr>
            <tr><td class="mk">Date:</td><td class="mv">${dmy(input.docDate)}</td></tr>
            <tr><td class="mk">Invoice No:</td><td class="mv">${dash(input.referenceNos?.invoice)}</td></tr>
            <tr><td class="mk">Invoice Date:</td><td class="mv">${dmy(input.docDate)}</td></tr>
            <tr><td class="mk">Place of Delivery:</td><td class="mv">${dash(input.transport?.placeOfDelivery)}</td></tr>
          </table>
        </div>
      </div>
      <div class="row2">
        ${partyBox("Consignee (Notify Party):", d.buyer)}
        ${d.notify ? partyBox("Notify Party:", d.notify) : ""}
      </div>

      <table class="goods">
        <thead><tr>
          <th style="width:3.5%">S#</th>
          <th style="width:12%">GOODS NAME</th>
          <th style="width:10%">BRAND / SIZE</th>
          <th style="width:7.5%">HS CODE</th>
          <th style="width:8%">QUANTITY UNIT</th>
          <th style="width:10%">PER CARTON GROSS / NET</th>
          <th style="width:10.5%">TOTAL WEIGHT GROSS / NET</th>
          <th style="width:7.5%">RATE ${esc(cur)}/${esc(rateLabel)}</th>
          <th style="width:9%">AMOUNT ${esc(cur)}</th>
          <th style="width:5%">VAT %</th>
          <th style="width:7.5%">VAT ${esc(cur)}</th>
          <th style="width:9.5%">FINAL ${esc(cur)}</th>
        </tr></thead>
        <tbody>${goodsRows}</tbody>
      </table>

      <div class="sum">
        <div class="box l">
          <div class="k">PRICING BASIS:</div>
          ${pricing.length ? pricing.map((p) => `<div class="pl">${esc(p)}</div>`).join("") : `<div class="pl">—</div>`}
        </div>
        <div class="box r">
          <div class="tr"><span>TOTAL AMOUNT (BEFORE VAT)</span><span>${esc(cur)} ${totals.subTotal != null ? esc(money(totals.subTotal)) : "—"}</span></div>
          <div class="tr"><span>TOTAL VAT</span><span>${esc(cur)} ${totals.taxAmount != null ? esc(money(totals.taxAmount)) : "—"}</span></div>
          <div class="tr fin"><span>FINAL TOTAL (INCL. VAT)</span><span>${esc(cur)} ${totals.grandTotal != null ? esc(money(totals.grandTotal)) : "—"}</span></div>
        </div>
      </div>

      <div class="sum">
        <div class="box l">
          <div class="k">OTHER DETAILS:</div>
          <div class="pl">PAYMENT TERMS: ${dash(input.delivery?.paymentTerms)}</div>
          <div class="pl" style="margin-top:3px">ALL GOODS ARE PACKED IN GOOD ORDER &amp; CONDITION.</div>
        </div>
        <div class="box r">
          <div class="k">DELIVERED ON:</div>
          <div class="pl">${dmyUpper(input.docDate)}</div>
          <div class="k" style="margin-top:4px">DELIVERY TERMS:</div>
          <div class="pl">${dash(input.delivery?.deliveryTerms)}</div>
          <div class="k" style="margin-top:4px">NUMBER &amp; KIND OF PACKAGES:</div>
          <div class="pl">${isReal(totalPacks) ? `${esc(num(totalPacks))} ${esc(unitWord)}` : "—"}</div>
        </div>
      </div>

      <div class="sum">
        <div class="box l">
          <div class="k">BANK DETAILS:</div>
          <div class="pl">BANK: ${dash(bank?.bankName)}</div>
          <div class="pl">BENEFICIARY NAME: ${dash(bank?.accountTitle || br.legalName)}</div>
          <div class="pl">BENEFICIARY ADDRESS: ${dash(bank?.address || br.address)}</div>
          <div class="pl">ACCOUNT NO: ${dash(bank?.accountNumber)}</div>
          <div class="pl">IBAN NO: ${dash(bank?.iban)}</div>
          <div class="pl">SWIFT CODE: ${dash(bank?.swift)}</div>
          <div class="pl">BANK CHARGES: REMITTER</div>
        </div>
        <div class="box r">
          <div class="k">NOTES:</div>
          <div class="pl">${dash(input.notes)}</div>
        </div>
      </div>

      <div class="sign">AUTHORIZED SIGNATURE &amp; STAMP</div>
      <div class="foot">
        ${[br.address, br.phone, br.email, br.website].filter(isReal).map((v) => `<span>${esc(v)}</span>`).join("")}
      </div>
    </div></div></div>
  `;

  return documentShell({
    lang, dir: d.dir, title: headline, docNo: input.docNo, docTitle: headline,
    brandName: d.brandName, stamp: d.stamp, orientation, style, body, autoPrint: input.autoPrint,
    pageLabel: d.pageLabel, ofLabel: d.ofLabel,
  });
}
