import { describe, expect, it } from "vitest";
import { calcSalesLine, resolveBookingRate, salesLineProblems, stockBalance, suggestDailyRate } from "@/lib/sales/sales-goods-model";

const line = (extra: Record<string, unknown> = {}) => ({
  qtyNo: 100, qtyKgs: 50, emptyKgs: 1, divideWeight: 1, coursePrice: 2, exchangeRate: 3.6725, operator: "*",
  invoiceCurrency: "USD", settlementCurrency: "AED", ...extra
});

describe("resolveBookingRate — a rate is never invented", () => {
  it("same currency is exactly 1 (stated, not defaulted)", () => {
    expect(resolveBookingRate({ invoiceCurrency: "usd", settlementCurrency: "USD", exchangeRate: 0 })).toMatchObject({ ok: true, rate: 1, sameCurrency: true });
  });
  it("different currencies need a positive rate", () => {
    for (const bad of [undefined, null, "", 0, -3, "abc"]) {
      expect(resolveBookingRate({ invoiceCurrency: "USD", settlementCurrency: "AED", exchangeRate: bad as any })).toMatchObject({ ok: false, reason: "missing_rate" });
    }
    expect(resolveBookingRate({ invoiceCurrency: "USD", settlementCurrency: "AED", exchangeRate: "3.6725" })).toMatchObject({ ok: true, rate: 3.6725 });
  });
  it("a missing currency is reported, not guessed", () => {
    expect(resolveBookingRate({ invoiceCurrency: "", settlementCurrency: "AED", exchangeRate: 3 })).toMatchObject({ ok: false, reason: "missing_currency" });
  });
});

describe("calcSalesLine — same formula as the Purchase Booking", () => {
  it("net = qty × KG − qty × empty; amount = net ÷ divide × price; final = amount × rate", () => {
    const t = calcSalesLine(line());
    expect(t.grossWeight).toBe(5000);
    expect(t.netWeight).toBe(4900);
    expect(t.totalAmount).toBe(9800);
    expect(t.finalAmount).toBe(Math.round(9800 * 3.6725 * 100) / 100);
  });
  it("a typed Net KG replaces the calculated one", () => {
    expect(calcSalesLine(line({ netWeight: 4000 })).netWeight).toBe(4000);
    expect(calcSalesLine(line({ netWeight: 4000 })).totalAmount).toBe(8000);
  });
  it("divide weight (e.g. per lb) divides the net weight", () => {
    expect(calcSalesLine(line({ divideWeight: 2 })).totalAmount).toBe(4900);
  });
  it("operator / divides by the rate", () => {
    expect(calcSalesLine(line({ operator: "/", exchangeRate: 2 })).finalAmount).toBe(4900);
  });
  it("same currency: final equals amount", () => {
    const t = calcSalesLine(line({ settlementCurrency: "USD", exchangeRate: 99 }));
    expect(t.finalAmount).toBe(t.totalAmount);
  });
  it("a missing rate yields no converted figure instead of the unconverted one", () => {
    const t = calcSalesLine(line({ exchangeRate: "" }));
    expect(t.rate.ok).toBe(false);
    expect(t.finalAmount).toBe(0);
  });
  it("a figure the user typed over the calculated one is kept", () => {
    expect(calcSalesLine(line({ manualTotalAmount: 9000, manualFinalAmount: 33000 }))).toMatchObject({ totalAmount: 9000, finalAmount: 33000 });
  });
});

describe("stockBalance — selling more than is available is refused", () => {
  it("remaining = available − sold", () => {
    expect(stockBalance({ availableQty: 500, soldQty: 120, requestedQty: 100 })).toEqual({ remaining: 380, after: 280, over: false, overBy: 0 });
  });
  it("exactly the remaining quantity is allowed; one more is not", () => {
    expect(stockBalance({ availableQty: 500, soldQty: 120, requestedQty: 380 }).over).toBe(false);
    expect(stockBalance({ availableQty: 500, soldQty: 120, requestedQty: 381 })).toMatchObject({ over: true, overBy: 1 });
  });
  it("never negative", () => {
    expect(stockBalance({ availableQty: 10, soldQty: 50, requestedQty: 1 })).toMatchObject({ remaining: 0, over: true });
  });
});

describe("salesLineProblems", () => {
  const ok = { ...line(), goodsName: "Rice", stockLinked: true, stockRemaining: 380 };
  it("a complete stock-linked line has no problems", () => expect(salesLineProblems(ok)).toEqual([]));
  it("reports every blocker", () => {
    expect(salesLineProblems({ ...ok, goodsName: "", qtyNo: 0, coursePrice: 0, exchangeRate: 0 }).sort()).toEqual(["goods_name", "price", "quantity", "rate"].sort());
  });
  it("over-stock and a stock line without a known balance are blockers", () => {
    expect(salesLineProblems({ ...ok, qtyNo: 381 })).toEqual(["over_stock"]);
    expect(salesLineProblems({ ...ok, stockRemaining: null })).toEqual(["stock_without_balance"]);
  });
  it("a line not linked to stock is not stock-checked", () => {
    expect(salesLineProblems({ ...ok, stockLinked: false, stockRemaining: null, qtyNo: 99999 })).toEqual([]);
  });
});

describe("suggestDailyRate — USD ↔ branch currency only", () => {
  const daily = { buyRate: 3.6725, sellRate: 3.675, effectiveDate: "2026-10-30", source: "daily_usd_rates" };
  it("USD → local multiplies", () => expect(suggestDailyRate(daily, "USD", "AED", "AED")).toEqual({ rate: 3.6725, operator: "*", effectiveDate: "2026-10-30" }));
  it("local → USD divides", () => expect(suggestDailyRate(daily, "AED", "USD", "AED")).toEqual({ rate: 3.6725, operator: "/", effectiveDate: "2026-10-30" }));
  it("any other pair has no suggestion", () => {
    expect(suggestDailyRate(daily, "EUR", "AED", "AED")).toBeNull();
    expect(suggestDailyRate(daily, "USD", "PKR", "AED")).toBeNull();
  });
  it("no daily rate, or the endpoint's 'default' placeholder, gives no suggestion (never a made-up rate)", () => {
    expect(suggestDailyRate(null, "USD", "AED", "AED")).toBeNull();
    expect(suggestDailyRate({ buyRate: 1, source: "default" }, "USD", "AED", "AED")).toBeNull();
  });
});
