import { describe, expect, it } from "vitest";
import { purchaseOrderToTradeInput, type MapOptions } from "@/lib/reports/trade-documents/from-transaction";
import { buildTradeDocumentHtml } from "@/lib/reports/trade-documents/build-trade-document";
import { renderPremiumInvoice } from "@/lib/reports/invoice-templates/premium";
import { DEFAULT_TEMPLATE_FLAGS } from "@/lib/reports/invoice-templates/types";

/**
 * The preview counts pages from the document's own `erp-page-count` meta, so a one-sheet invoice is shown as
 * one page (not split by row count), and a two-sheet contract as two.
 */
const rec = {
  id: "po-pc-1",
  currency_code: "USD",
  created_at: "2026-10-16T00:00:00Z",
  form_data: { supplierName: "Supplier Y", goodsEntries: [{ goodsName: "Pistachio", netWeight: 100, qtyNo: 2, qtyName: "Bags", coursePrice: 10, totalAmount: 20, finalAmount: 20 }] },
};
const opts = (docType: MapOptions["docType"], orientation: "portrait" | "landscape" = "portrait"): MapOptions => ({
  docType,
  lang: "en",
  orientation,
  branding: { entityName: "DGT Trading LLC", countryName: "Pakistan" } as any,
});
const metaCount = (html: string) => (html.match(/<meta name="erp-page-count" content="(\d+)"/) || [])[1];

describe("preview page count comes from the document", () => {
  it("a purchase invoice is one page, portrait or landscape", () => {
    expect(metaCount(buildTradeDocumentHtml({ ...purchaseOrderToTradeInput(rec, opts("purchase_invoice")), docType: "purchase_invoice" }))).toBe("1");
    expect(metaCount(buildTradeDocumentHtml({ ...purchaseOrderToTradeInput(rec, opts("purchase_invoice", "landscape")), docType: "purchase_invoice" }))).toBe("1");
  });

  it("a contract with two sheets is two pages", () => {
    expect(metaCount(buildTradeDocumentHtml({ ...purchaseOrderToTradeInput(rec, opts("contract")), docType: "contract" }))).toBe("2");
  });

  it("a shared-shell design (Premium) declares its page count too", () => {
    const input = purchaseOrderToTradeInput(rec, opts("purchase_invoice"));
    expect(metaCount(renderPremiumInvoice({ ...input, docType: "purchase_invoice" }, DEFAULT_TEMPLATE_FLAGS))).toBe("1");
  });
});
