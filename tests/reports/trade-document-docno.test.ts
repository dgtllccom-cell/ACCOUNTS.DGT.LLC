import { describe, expect, it } from "vitest";
import { purchaseOrderToTradeInput, type MapOptions } from "@/lib/reports/trade-documents/from-transaction";

/** Each document type has its own number prefix; a Purchase Invoice is never numbered as a proforma. */
const rec = {
  id: "po-doc-1",
  currency_code: "USD",
  created_at: "2026-10-16T00:00:00Z",
  form_data: { supplierName: "Supplier Y", goodsEntries: [{ goodsName: "Pistachio", netWeight: 100, qtyNo: 2, qtyName: "Bags", coursePrice: 10 }] },
};

const opts = (docType: MapOptions["docType"]): MapOptions => ({
  docType,
  lang: "en",
  branding: { entityName: "DGT Trading LLC", legalName: null, countryName: "Pakistan" } as any,
});

describe("trade document numbers carry their own type prefix", () => {
  const cases: Array<[MapOptions["docType"], string]> = [
    ["purchase_invoice", "PI-"],
    ["tax_invoice", "TI-"],
    ["proforma_invoice", "PFI-"],
    ["commercial_invoice", "CI-"],
    ["packing_list", "PL-"],
    ["contract", "CT-"],
    ["purchase_order", "PO-"],
  ];
  for (const [docType, prefix] of cases) {
    it(`${docType} -> ${prefix}`, () => {
      expect(purchaseOrderToTradeInput(rec, opts(docType)).docNo.startsWith(prefix)).toBe(true);
    });
  }
});
