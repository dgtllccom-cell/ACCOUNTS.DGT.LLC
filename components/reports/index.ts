/* Central export barrel for ERP print components */

export * from "./full-purchase-booking-report";
export * from "./compact-purchase-booking-order";
export { QuotationView } from "../quotation-view";

/*
 * Legacy hard-coded trade-document components (commercial-invoice-report,
 * packing-list-report, shipping-invoice-report) were removed — superseded by the
 * dynamic, branded, 5-language engine in `lib/reports/trade-documents/`
 * (`buildTradeDocumentHtml` / `openTradeDocument` + `TradeDocumentCenter`).
 */
