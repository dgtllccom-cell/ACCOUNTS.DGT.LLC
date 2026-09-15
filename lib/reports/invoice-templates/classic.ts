/**
 * Classic template — the traditional bordered-table A4 layout. This is
 * intentionally a thin wrapper around the EXISTING `buildTradeDocumentHtml`
 * engine (lib/reports/trade-documents/build-trade-document.ts): that engine
 * already IS a "Classic" design, so Classic reuses it verbatim instead of
 * duplicating its business-field layout logic.
 *
 * Show/Hide flags are respected by pruning the input before handing it to the
 * engine — the engine already omits any section whose data is empty, so
 * hiding logo/bank/terms this way is safe and requires no changes to the
 * engine itself.
 */

import { buildTradeDocumentHtml } from "@/lib/reports/trade-documents/build-trade-document";
import type { TradeDocumentInput } from "@/lib/reports/trade-documents/types";
import type { InvoiceTemplateFlags } from "./types";

export function applyVisibilityFlags(input: TradeDocumentInput, flags: InvoiceTemplateFlags): TradeDocumentInput {
  const out: TradeDocumentInput = { ...input };
  if (!flags.showLogo) out.branding = { ...input.branding, logoUrl: null };
  if (!flags.showBankDetails) out.bank = null;
  if (!flags.showTerms) {
    out.delivery = { ...input.delivery, incoterms: null, paymentTerms: null, deliveryTerms: null };
    out.validity = null;
  }
  if (!flags.showTax) {
    out.totals = { ...input.totals, taxAmount: null };
    out.goods = input.goods.map((g) => ({ ...g, taxAmount: null }));
  }
  if (!flags.showDiscount) out.goods = (out.goods ?? input.goods).map((g) => ({ ...g, discount: null }));
  return out;
}

export function renderClassicInvoice(input: TradeDocumentInput, flags: InvoiceTemplateFlags): string {
  return buildTradeDocumentHtml(applyVisibilityFlags(input, flags));
}
