import { t } from "@/lib/i18n/ui";
import { translateHeader } from "@/lib/i18n/table-headers";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { escapeReportHtml as e, renderA4Document } from "@/lib/reports/report-shell";
import type { SalesPaymentReceipt } from "@/lib/sales/payment-receipt";
import { printPaymentVoucherCopies } from "@/lib/reports/payment-voucher-copies";

/** Keep the goods report as View Details; the Print Receipt action issues the detachable pair. */
export function printSalesReceiptCopies(receipt: SalesPaymentReceipt, lang: SupportedLanguage) {
  if (!receipt.sides) return printSalesPaymentReceipt(receipt, lang);
  return printPaymentVoucherCopies({ ...receipt.sides, number: receipt.number, date: receipt.date, bill: receipt.bill,
    party: receipt.customer, reference: receipt.reference, source: translateHeader(lang, receipt.local ? "Local Sales" : "Sales Booking") }, lang);
}

export function printSalesPaymentReceipt(receipt: SalesPaymentReceipt, lang: SupportedLanguage, autoPrint = false) {
  const tr = (key: Parameters<typeof t>[1], fallback: string) => t(lang, key, fallback);
  const h = (label: string) => translateHeader(lang, label);
  const source = h(receipt.local ? "Local Sales" : "Sales Booking");
  const title = tr("sopj_payment_receipt", "Payment Receipt");
  const method = receipt.method === "cash" ? tr("rvp.cash", "Cash") :
    receipt.method === "bank" ? `${h("Bank")} / ${tr("rvp.cheque", "Cheque")}` : "";
  const amount = new Intl.NumberFormat(lang, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(receipt.amount);
  const fields = [
    [tr("rvp.receipt_no", "Receipt No."), receipt.number],
    [tr("rvp.date", "Date"), receipt.date],
    [tr("rvp.received_from", "Received from"), receipt.customer],
    [h("Sales Order No"), receipt.bill],
    ...(receipt.manualBill ? [[tr("purchase.f_manual_bill_no", "Manual Bill No."), receipt.manualBill]] : []),
    [tr("rvp.payment_method", "Payment Method"), method],
    [h("Reference"), receipt.reference],
  ];
  const quantityFormat = new Intl.NumberFormat(lang, { maximumFractionDigits: 6 });
  const measure = (value: number | null, unit = "") => value == null ? "" : [quantityFormat.format(value), unit].filter(Boolean).join(" ");
  const money = (value: number | null, currency: string) => value == null ? "" : [currency, quantityFormat.format(value)].filter(Boolean).join(" ");
  const goods = receipt.goods ?? [];
  const prices = goods.some(line => line.price != null || line.amount != null);
  const cell = (...parts: string[]) => parts.filter(Boolean).map(part => `<bdi>${e(part)}</bdi>`).join("<br>") || "—";
  const goodsHtml = goods.length ? `<div class="section-header">${e(tr("purchase.goods_details_title", "Goods Details"))}</div>
  <table class="data-table"><thead><tr>${["#", "Goods Name", "Lot Name / Lot No", "Quantity", "Gross Wt (kg)", "Net Wt (kg)", ...(prices ? ["Unit Price", "Total Sales Amount"] : [])].map(label =>
    `<th scope="col">${e(label === "Lot Name / Lot No" ? `${h("Lot Name")} / ${tr("sales.lot_no_label", "Lot No")}` : h(label))}</th>`).join("")}</tr></thead>
    <tbody>${goods.map((line, index) => `<tr><td>${index + 1}</td><td>${cell(line.name, line.brand, line.size, line.hsCode, line.origin)}</td>
    <td>${cell(line.lotName, line.lotNo === line.lotName ? "" : line.lotNo)}</td>
    <td>${cell(measure(line.quantity, line.unit))}</td><td>${cell(measure(line.gross))}</td><td>${cell(measure(line.net))}</td>
    ${prices ? `<td>${cell(money(line.price, line.currency))}</td><td>${cell(money(line.amount, line.currency))}</td>` : ""}</tr>`).join("")}</tbody></table>` : "";
  const bodyHtml = `<div class="overview-banner">
    <div class="overview-top"><div><div class="overview-title">${e(tr("rvp.amount", "Amount"))}</div>
    <div class="overview-name"><bdi>${e(receipt.currency)} ${e(amount)}</bdi></div></div>
    <span class="overview-status">${e(h("Posted"))}</span></div></div>
    <div class="section-card"><div class="section-header">${e(tr("rvp.customer_copy", "Customer Copy"))}</div>
    <table class="info-table">${fields.map(([label, value]) => `<tr><td class="label">${e(label)}</td><td class="value"><bdi>${e(value || "—")}</bdi></td></tr>`).join("")}</table></div>${goodsHtml}`;
  renderA4Document({ lang, autoPrint, title, subtitle: source, reportType: title, bodyHtml, reportId: receipt.number,
    scrollPreview: goods.length > 0,
    notesText: tr("common.system_generated_document", "This is a system-generated document."),
    signatures: [tr("rvp.authorized_by", "Authorized by")] });
}
