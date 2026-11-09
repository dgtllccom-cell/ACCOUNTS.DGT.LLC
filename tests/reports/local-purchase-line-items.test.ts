import { describe, expect, it } from "vitest";
import {
  localPurchaseToTradeInput,
  type MapOptions,
} from "@/lib/reports/trade-documents/from-transaction";
import { buildTradeDocumentHtml } from "@/lib/reports/trade-documents/build-trade-document";

/**
 * Local Purchase trade documents print the saved goods lines (`local_purchases.line_items`), not one
 * combined row. Fixture shape copied from DEV record 3f7c20ad (two lines, PKR 310,000).
 */

const brand = (over: Record<string, unknown> = {}) => ({
  entityName: null, legalName: null, logoUrl: null, stampUrl: null, address: null, phone: null,
  email: null, website: null, registrationNumber: null, taxNumber: null, countryName: null, branchName: null,
  ...over,
}) as any;

const opts = (over: Partial<MapOptions> = {}): MapOptions => ({
  docType: "purchase_invoice",
  lang: "en",
  branding: brand({ entityName: "DGT Trading LLC", countryName: "Pakistan" }),
  ...over,
});

const twoLineRec = {
  id: "3f7c20ad-910e-4c90-9ae1-307619ddc658",
  supplier_name: "E2E Supplier Tz8jp1a",
  goods_name: "Pistachio In-Shell + Walnut In-Shell",
  quantity_kgs: 140,
  quantity_name: "Bags",
  numbers: 140,
  net_weight: 7000,
  total_gross_weight: 7000,
  purchase_cost: 310000,
  final_cost: 310000,
  purchase_rate: 44.2857,
  purchase_currency: "PKR",
  local_currency: "PKR",
  exchange_rate: 1,
  purchase_account_no: "1002",
  manual_bill_no: null,
  created_at: "2026-10-16T00:00:00Z",
  line_items: [
    {
      id: "l1-Tz8jp1a", size: "-", brand: "-", amount: 250000, origin: "Local", goodsId: "g1",
      numbers: 100, finalCost: 250000, goodsName: "Pistachio In-Shell", netWeight: 5000,
      quantityName: "Bags", quantityCount: 100, totalGrossWeight: 5000,
    },
    {
      id: "l2-Tz8jp1a", size: "-", brand: "-", amount: 60000, origin: "Local", goodsId: "g2",
      numbers: 40, finalCost: 60000, goodsName: "Walnut In-Shell", netWeight: 2000,
      quantityName: "Bags", quantityCount: 40, totalGrossWeight: 2000,
    },
  ],
};

describe("Local Purchase — goods lines", () => {
  it("prints one row per saved line with that line's own goods, quantity and amount", () => {
    const input = localPurchaseToTradeInput(twoLineRec, opts());
    expect(input.goods).toHaveLength(2);
    expect(input.goods[0]).toMatchObject({ description: "Pistachio In-Shell", quantity: 100, unit: "Bags", netWeight: 5000, grossWeight: 5000, amount: 250000 });
    expect(input.goods[1]).toMatchObject({ description: "Walnut In-Shell", quantity: 40, unit: "Bags", netWeight: 2000, grossWeight: 2000, amount: 60000 });
  });

  it("derives the unit price from the line's own amount and count, in the line's unit", () => {
    const input = localPurchaseToTradeInput(twoLineRec, opts());
    expect(input.goods[0].unitPrice).toBe(2500);
    expect(input.goods[1].unitPrice).toBe(1500);
  });

  it("keeps the record total as the grand total and sums the lines for the subtotal", () => {
    const input = localPurchaseToTradeInput(twoLineRec, opts());
    expect(input.totals?.subTotal).toBe(310000);
    expect(input.totals?.grandTotal).toBe(310000);
  });

  it("does not print the '-' placeholder for an empty size or brand", () => {
    const input = localPurchaseToTradeInput(twoLineRec, opts());
    expect(input.goods[0].size).toBeUndefined();
    expect(input.goods[0].brand).toBeUndefined();
  });

  it("prints the goods lines in the rendered document, and the combined goods name is not used", () => {
    const html = buildTradeDocumentHtml({ ...localPurchaseToTradeInput(twoLineRec, opts()), docType: "purchase_invoice" });
    expect(html).toContain("Pistachio In-Shell");
    expect(html).toContain("Walnut In-Shell");
    expect(html).not.toContain("Pistachio In-Shell + Walnut In-Shell");
  });

  it("falls back to one legacy row when the record has no line_items", () => {
    const { line_items: _omit, ...legacy } = twoLineRec;
    const input = localPurchaseToTradeInput({ ...legacy, goods_name: "Cashew nuts W320" }, opts());
    expect(input.goods).toHaveLength(1);
    expect(input.goods[0].description).toBe("Cashew nuts W320");
    expect(input.totals?.subTotal).toBe(310000);
  });

  it("accepts line_items stored as a JSON string", () => {
    const input = localPurchaseToTradeInput({ ...twoLineRec, line_items: JSON.stringify(twoLineRec.line_items) }, opts());
    expect(input.goods).toHaveLength(2);
  });

  it("does not list Goods as missing when the lines carry the goods", () => {
    const { goods_name: _g, ...noTopGoods } = twoLineRec;
    const input = localPurchaseToTradeInput(noTopGoods, opts());
    expect(input.missingFields?.some((m) => m === "Goods")).toBe(false);
  });
});

describe("Local Purchase — invoice reference", () => {
  it("does not print the ledger code as the invoice number", () => {
    const input = localPurchaseToTradeInput(twoLineRec, opts());
    expect(input.referenceNos?.invoice).toBeUndefined();
    const html = buildTradeDocumentHtml({ ...input, docType: "purchase_invoice" });
    expect(html).not.toContain("1002");
  });

  it("prints the saved bill number when the record has one", () => {
    const input = localPurchaseToTradeInput({ ...twoLineRec, manual_bill_no: "SUP-88" }, opts());
    expect(input.referenceNos?.invoice).toBe("SUP-88");
  });
});
