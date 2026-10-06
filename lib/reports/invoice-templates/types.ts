/**
 * Invoice & Print Templates engine — shared types.
 *
 * The template layer sits ON TOP of the existing trade-document data pipeline
 * (`lib/reports/trade-documents`): the SAME `TradeDocumentInput` produced by
 * `purchaseOrderToTradeInput` / `salesOrderToTradeInput` / `localPurchaseToTradeInput`
 * feeds every template. A template never re-derives business data from the
 * source transaction — it only chooses how to lay that data out visually.
 */

import type { TradeDocumentInput, TradeDocType } from "@/lib/reports/trade-documents/types";

export type InvoiceTemplateId = "classic" | "modern" | "professional" | "compact" | "premium";

/**
 * Show/Hide controls threaded into every template's render call. A template
 * MUST respect these booleans where the corresponding section is meaningful
 * for its document type — it may simply have nothing to hide (e.g. a Packing
 * List never shows bank details regardless of `showBankDetails`).
 */
export type InvoiceTemplateFlags = {
  showLogo: boolean;
  showQr: boolean;
  showTax: boolean;
  showDiscount: boolean;
  showBankDetails: boolean;
  showTerms: boolean;
  showSignature: boolean;
  showHeaderFooter: boolean;
};

export const DEFAULT_TEMPLATE_FLAGS: InvoiceTemplateFlags = {
  showLogo: true,
  showQr: true,
  showTax: true,
  showDiscount: true,
  showBankDetails: true,
  showTerms: true,
  showSignature: true,
  showHeaderFooter: true,
};

export type InvoiceTemplateRenderer = (input: TradeDocumentInput, flags: InvoiceTemplateFlags) => string;

export type InvoiceTemplateDefinition = {
  id: InvoiceTemplateId;
  /** i18n key + English fallback for the display name shown in the picker */
  nameKey: string;
  nameFallback: string;
  descKey: string;
  descFallback: string;
  /** which document types this template may render; "all" = every TradeDocType */
  supports: TradeDocType[] | "all";
  /** small inline SVG (no external assets) used as the picker thumbnail */
  thumbnail: string;
  render: InvoiceTemplateRenderer;
};

export function templateSupportsDocType(def: InvoiceTemplateDefinition, docType: TradeDocType): boolean {
  return def.supports === "all" || def.supports.includes(docType);
}

export type { TradeDocumentInput };
