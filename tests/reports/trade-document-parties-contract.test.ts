import { describe, expect, it } from "vitest";
import {
  localPurchaseToTradeInput,
  purchaseOrderToTradeInput,
  type MapOptions,
} from "@/lib/reports/trade-documents/from-transaction";
import { buildTradeDocumentHtml } from "@/lib/reports/trade-documents/build-trade-document";
import type { TradeDocumentInput } from "@/lib/reports/trade-documents/types";

/**
 * Trade-document print regressions:
 *  - a party box never prints the bare COUNTRY name as the company (branding falls back to it when no
 *    company name is configured) — the blank party is listed as missing instead;
 *  - gross weight is never estimated from net weight — it is blank unless the record carries it;
 *  - a contract prints as two pages: terms / parties / delivery on page 1, packing list, goods and
 *    values on page 2, with a seller and a buyer signature.
 */

const brand = (over: Record<string, unknown> = {}) => ({
  entityName: null, legalName: null, logoUrl: null, stampUrl: null, address: null, phone: null,
  email: null, website: null, registrationNumber: null, taxNumber: null, countryName: null, branchName: null,
  ...over,
}) as any;

const localRec = {
  id: "11111111-2222-3333-4444-555555555555",
  supplier_name: "Supplier X",
  goods_name: "Walnut In-Shell",
  net_weight: 7000,
  purchase_rate: 44.29,
  final_cost: 310000,
  quantity_name: "Bags",
  numbers: 140,
  purchase_currency: "PKR",
  local_currency: "PKR",
  exchange_rate: 1,
  created_at: "2026-10-16T00:00:00Z",
  form_data: {},
};

const opts = (over: Partial<MapOptions> = {}): MapOptions => ({
  docType: "purchase_invoice",
  lang: "en",
  branding: brand({ entityName: "Pakistan", countryName: "Pakistan" }),
  ...over,
});

describe("Buyer / Consignee — never the country name", () => {
  it("uses the company name when the branding carries one", () => {
    const input = localPurchaseToTradeInput(localRec, opts({ branding: brand({ entityName: "DGT Trading LLC", countryName: "Pakistan" }) }));
    expect(input.buyer?.name).toBe("DGT Trading LLC");
    expect(input.missingFields?.some((m) => m.startsWith("Buyer"))).toBe(false);
  });

  it("leaves the buyer blank and lists it as missing when only the country name is available", () => {
    const input = localPurchaseToTradeInput(localRec, opts());
    expect(input.buyer?.name).toBeFalsy();
    expect(input.missingFields?.some((m) => m.startsWith("Buyer"))).toBe(true);
    const html = buildTradeDocumentHtml({ ...input, docType: "purchase_invoice" });
    expect(html).not.toMatch(/class="party-name">Pakistan</);
  });

  it("keeps the legal name when the display name is only the country", () => {
    const input = localPurchaseToTradeInput(localRec, opts({ branding: brand({ entityName: "Pakistan", legalName: "DGT Legal LLC", countryName: "Pakistan" }) }));
    expect(input.buyer?.name).toBe("DGT Legal LLC");
  });
});

describe("Gross weight is never invented", () => {
  it("leaves gross weight blank when the record does not carry it", () => {
    const rec = {
      id: "po-1",
      currency_code: "USD",
      created_at: "2026-10-16T00:00:00Z",
      form_data: { supplierName: "Supplier Y", goodsEntries: [{ goodsName: "Pistachio", netWeight: 100, qtyNo: 2, qtyName: "Bags", coursePrice: 10 }] },
    };
    const input = purchaseOrderToTradeInput(rec, opts({ docType: "purchase_order", branding: brand({ entityName: "DGT Trading LLC", countryName: "Pakistan" }) }));
    expect(input.goods[0].netWeight).toBe(100);
    expect(input.goods[0].grossWeight).toBeUndefined();
  });
});

describe("Contract — two-page layout", () => {
  const base = (): TradeDocumentInput => localPurchaseToTradeInput(localRec, opts({
    docType: "contract",
    branding: brand({ entityName: "DGT Trading LLC", countryName: "Pakistan" }),
    overrides: { notes: "Payment within 30 days of shipment." },
  })) as TradeDocumentInput;

  it("breaks to a new page between the terms and the packing list / goods", () => {
    const html = buildTradeDocumentHtml({ ...base(), docType: "contract" });
    const brk = html.indexOf('<div class="page-break"></div>');
    expect(brk).toBeGreaterThan(-1);
    expect(html.indexOf("Contract Terms &amp; Conditions")).toBeGreaterThan(-1);
    expect(html.indexOf("Contract Terms &amp; Conditions")).toBeLessThan(brk);
    expect(html.indexOf("Packing List &amp; Goods Details")).toBeGreaterThan(brk);
  });

  it("prints the contract number and both authorised signatures", () => {
    const html = buildTradeDocumentHtml({ ...base(), docType: "contract", referenceNos: { contract: "CNT-2026-001" } });
    expect(html).toContain("CNT-2026-001");
    expect(html).toContain("Seller — Authorized Signatory");
    expect(html).toContain("Buyer — Authorized Signatory");
  });

  it("carries packing, weights, unit price and amount on the goods table", () => {
    const html = buildTradeDocumentHtml({ ...base(), docType: "contract" });
    for (const h of ["Packing", "Packages", "Net Wt (KG)", "Gross Wt (KG)", "Unit Price", "Amount"]) {
      expect(html).toContain(h);
    }
  });

  it("does not add a page break to other document types", () => {
    const html = buildTradeDocumentHtml({ ...base(), docType: "purchase_invoice" });
    expect(html).not.toContain('<div class="page-break"></div>');
  });
});
