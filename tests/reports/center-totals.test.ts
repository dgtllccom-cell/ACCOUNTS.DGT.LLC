import { describe, expect, it } from "vitest";
import { CENTER_TYPES, centerTypesOf, countsByType, grandTotalsByCurrency, purchaseTotalInOrderCurrency, totalsByCurrency } from "@/lib/reports/center-totals";

const row = (type: string, currency: string, amount: number | null, balance: number | null = null, counted = true) => ({ type, currency, amount, balance, counted });

describe("Reports Center totals are currency-safe", () => {
  const rows = [
    row("purchase_booking", "USD", 116250, 91750.15),
    row("purchase_booking", "USD", 20000, 0),
    row("purchase_booking", "AED", 426637.5, 0),
    row("advance_payment", "AED", 85327.5, null),
    row("advance_payment", "USD", 23250, null),
    row("shipping_order", "", null)
  ];
  it("groups by currency and never adds USD to AED", () => {
    const grand = grandTotalsByCurrency(rows);
    expect(grand).toEqual([
      { currency: "AED", count: 2, amount: 511965, balance: 0 },
      { currency: "USD", count: 3, amount: 159500, balance: 91750.15 }
    ]);
    // nothing in the result is a cross-currency sum
    expect(grand.reduce((s, g) => s + g.amount, 0)).not.toBe(116250 + 20000 + 426637.5 + 85327.5 + 23250 - 1);
  });
  it("groups per report type and currency", () => {
    const t = totalsByCurrency(rows);
    expect(t.find((x) => x.type === "purchase_booking" && x.currency === "USD")).toMatchObject({ count: 2, amount: 136250 });
    expect(t.find((x) => x.type === "advance_payment" && x.currency === "AED")).toMatchObject({ count: 1, amount: 85327.5 });
    expect(t.every((x) => x.currency !== "")).toBe(true);
  });
  it("a row with no amount or no currency is counted by type but never summed; a cancelled voucher is not summed", () => {
    expect(countsByType(rows).shipping_order).toBe(1);
    expect(grandTotalsByCurrency([row("cash_entry", "AED", 500, null, false), row("cash_entry", "AED", 100)])).toEqual([{ currency: "AED", count: 1, amount: 100, balance: 0 }]);
  });
  it("an empty selection gives empty totals - no placeholder figures", () => {
    expect(grandTotalsByCurrency([])).toEqual([]);
    expect(totalsByCurrency([])).toEqual([]);
  });
});

describe("the bill total is the purchase-currency total, never the local-currency order_total labelled with the purchase currency", () => {
  it("AE-001-0004: USD 116,250 (order_total is AED 426,637.50)", () => {
    expect(purchaseTotalInOrderCurrency({ total_goods_original: 116250, order_total: 426637.5, exchange_rate: 3.67, currency_code: "USD" })).toBe(116250);
  });
  it("falls back to total_goods_usd for a USD bill, then to order_total / rate", () => {
    expect(purchaseTotalInOrderCurrency({ total_goods_usd: 20000, order_total: 73400, exchange_rate: 3.67, currency_code: "USD" })).toBe(20000);
    expect(purchaseTotalInOrderCurrency({ order_total: 73400, exchange_rate: 3.67, currency_code: "USD" })).toBeCloseTo(20000, 6);
    expect(purchaseTotalInOrderCurrency({ order_total: 5000, exchange_rate: 1, currency_code: "AED" })).toBe(5000);
  });
});

describe("report types", () => {
  it("Business and Shipping types never mix", () => {
    expect(centerTypesOf("business").every((t) => t.domain === "business")).toBe(true);
    expect(centerTypesOf("shipping").every((t) => t.domain === "shipping")).toBe(true);
    expect(CENTER_TYPES.length).toBe(centerTypesOf("business").length + centerTypesOf("shipping").length);
    expect(new Set(CENTER_TYPES.map((t) => t.key)).size).toBe(CENTER_TYPES.length);
  });
});
