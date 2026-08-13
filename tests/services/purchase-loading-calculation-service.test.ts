import { describe, expect, it } from "vitest";
import {
  resolvePurchaseLoadingSummary,
  validatePurchaseLoadingEntries
} from "@/lib/services/purchase-calculation-service";

describe("purchase loading calculation service", () => {
  const order = {
    order_total: 1200,
    advance_paid: 300,
    remaining_due: 900,
    currency_code: "USD",
    exchange_rate: 4,
    form_data: {
      goodsEntries: [
        { qtyNo: 100, totalAmount: 800 },
        { qtyNo: 50, totalAmount: 400 }
      ],
      totals: { totalQuantity: 150 },
      workflow: { totalQuantity: 150 }
    }
  };

  it("summarizes loading quantity and payment balance from the existing order data", () => {
    const summary = resolvePurchaseLoadingSummary(order, 40, 20);

    expect(summary.totalQuantity).toBe(150);
    expect(summary.previousLoadedQuantity).toBe(40);
    expect(summary.currentLoadedQuantity).toBe(20);
    expect(summary.remainingQuantity).toBe(90);
    expect(summary.totalPurchaseFC).toBe(1200);
    expect(summary.paidAmountFC).toBe(300);
    expect(summary.remainingAmountFC).toBe(900);
    expect(summary.remainingAmountLC).toBe(3600);
  });

  it("accepts one or two matching loading entries and rejects invalid counts", () => {
    const result = validatePurchaseLoadingEntries({
      entryCount: 2,
      totalQuantity: 150,
      previousLoadedQuantity: 40,
      entries: [
        { goodsName: "Rice", quantityNo: 30 },
        { goodsName: "Sugar", quantityNo: 20 }
      ]
    });

    expect(result.loadedQuantity).toBe(50);
    expect(result.remainingQuantity).toBe(60);

    expect(() =>
      validatePurchaseLoadingEntries({
        entryCount: 1,
        totalQuantity: 150,
        previousLoadedQuantity: 0,
        entries: [{ goodsName: "Rice", quantityNo: 10 }, { goodsName: "Sugar", quantityNo: 10 }]
      })
    ).toThrow(/exactly 1 goods entry/i);
  });

  it("rejects overloading beyond the remaining quantity", () => {
    expect(() =>
      validatePurchaseLoadingEntries({
        entryCount: 1,
        totalQuantity: 150,
        previousLoadedQuantity: 140,
        entries: [{ goodsName: "Rice", quantityNo: 20 }]
      })
    ).toThrow(/exceeds the remaining purchase quantity/i);
  });
});
