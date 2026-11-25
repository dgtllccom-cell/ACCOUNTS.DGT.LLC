import { t } from "@/lib/i18n/ui";
import { translateHeader } from "@/lib/i18n/table-headers";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { escapeReportHtml as e, renderA4Document } from "@/lib/reports/report-shell";
import type { SalesPaymentReceipt } from "@/lib/sales/payment-receipt";

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
    [tr("rvp.payment_method", "Payment Method"), method],
    [h("Reference"), receipt.reference],
  ];
  const bodyHtml = `<div class="overview-banner">
    <div class="overview-top"><div><div class="overview-title">${e(tr("rvp.amount", "Amount"))}</div>
    <div class="overview-name"><bdi>${e(receipt.currency)} ${e(amount)}</bdi></div></div>
    <span class="overview-status">${e(h("Posted"))}</span></div></div>
    <div class="section-card"><div class="section-header">${e(tr("rvp.customer_copy", "Customer Copy"))}</div>
    <table class="info-table">${fields.map(([label, value]) => `<tr><td class="label">${e(label)}</td><td class="value"><bdi>${e(value || "—")}</bdi></td></tr>`).join("")}</table></div>`;
  renderA4Document({ lang, autoPrint, title, subtitle: source, reportType: title, bodyHtml, reportId: receipt.number,
    notesText: tr("common.system_generated_document", "This is a system-generated document."),
    signatures: [tr("rvp.authorized_by", "Authorized by")] });
}
