import { describe, expect, it } from "vitest";
import { calculateExpenseLine, currencyDecimals, ExpenseCalcError, roundMoney, sumGrand } from "@/lib/finance/expense-line-calculator";

const base = { baseCurrency: "PKR" };

describe("expense line calculator", () => {
  it("same currency: no conversion, rate 1", () => {
    const r = calculateExpenseLine({ ...base, currency: "PKR", qty: 4, unitPrice: 250, taxMode: "exempt" });
    expect(r.originalAmount).toBe(1000);
    expect(r.exchangeRate).toBe(1);
    expect(r.operation).toBe("");
    expect(r.convertedAmount).toBe(1000);
    expect(r.grandAmount).toBe(1000);
  });

  it("each row uses its OWN currency and rate; the bill total is in the base currency", () => {
    const rows = [
      calculateExpenseLine({ ...base, currency: "AED", amount: 100, exchangeRate: 75.8, operation: "*", taxMode: "exempt" }),
      calculateExpenseLine({ ...base, currency: "USD", amount: 50, exchangeRate: 278.25, operation: "*", taxMode: "exempt" }),
      calculateExpenseLine({ ...base, currency: "PKR", amount: 1000, taxMode: "exempt" })
    ];
    expect(rows.map((r) => r.convertedAmount)).toEqual([7580, 13912.5, 1000]);
    expect(sumGrand(rows)).toEqual({ total: 22492.5, baseCurrency: "PKR" });
  });

  it("division quotation (base per foreign inverted)", () => {
    const r = calculateExpenseLine({ ...base, currency: "USD", amount: 278.25, exchangeRate: 278.25, operation: "/", taxMode: "exempt" });
    expect(r.convertedAmount).toBe(1);
  });

  it("tax exclusive: tax on the converted amount, added on top", () => {
    const r = calculateExpenseLine({ baseCurrency: "AED", currency: "USD", amount: 100, exchangeRate: 3.6725, operation: "*", taxMode: "exclusive", taxPct: 5 });
    expect(r.convertedAmount).toBe(367.25);
    expect(r.taxBase).toBe(367.25);
    expect(r.taxAmount).toBe(18.36); // 367.25 * 5% = 18.3625
    expect(r.grandAmount).toBe(385.61);
  });

  it("tax inclusive: the typed price already contains the tax", () => {
    const r = calculateExpenseLine({ baseCurrency: "AED", currency: "AED", amount: 105, taxMode: "inclusive", taxPct: 5 });
    expect(r.taxBase).toBe(100);
    expect(r.taxAmount).toBe(5);
    expect(r.grandAmount).toBe(105);
  });

  it("tax exempt: rate ignored, no tax", () => {
    const r = calculateExpenseLine({ baseCurrency: "AED", currency: "AED", amount: 200, taxMode: "exempt", taxPct: 5 });
    expect(r.taxPct).toBe(0);
    expect(r.taxAmount).toBe(0);
    expect(r.grandAmount).toBe(200);
  });

  it("statutory conversion rate: tax is taken on the ORIGINAL amount at the prescribed rate", () => {
    const r = calculateExpenseLine({ baseCurrency: "PKR", currency: "USD", amount: 100, exchangeRate: 280, operation: "*", taxMode: "exclusive", taxPct: 18, statutoryRate: 275 });
    expect(r.convertedAmount).toBe(28000);
    expect(r.taxAmount).toBe(4950); // 100 * 18% * 275
    expect(r.grandAmount).toBe(32950);
  });

  it("rounds to the minor unit of the BASE currency", () => {
    expect(currencyDecimals("KWD")).toBe(3);
    expect(currencyDecimals("JPY")).toBe(0);
    expect(currencyDecimals("AED")).toBe(2);
    expect(roundMoney(1.005, "AED")).toBe(1.01);
    expect(roundMoney(0.0005, "KWD")).toBe(0.001);
    expect(roundMoney(2.5, "JPY")).toBe(3);
    const k = calculateExpenseLine({ baseCurrency: "KWD", currency: "USD", amount: 10, exchangeRate: 0.30712, operation: "*", taxMode: "exempt" });
    expect(k.convertedAmount).toBe(3.071);
  });

  it("refuses a foreign-currency row without a rate, a zero amount, a bad tax rate or no base currency", () => {
    const code = (fn: () => unknown) => { try { fn(); return "none"; } catch (e) { return (e as ExpenseCalcError).code; } };
    expect(code(() => calculateExpenseLine({ ...base, currency: "USD", amount: 10, taxMode: "exempt" }))).toBe("NO_RATE");
    expect(code(() => calculateExpenseLine({ ...base, currency: "PKR", amount: 0, taxMode: "exempt" }))).toBe("ZERO_AMOUNT");
    expect(code(() => calculateExpenseLine({ ...base, currency: "PKR", amount: 10, taxMode: "exclusive", taxPct: 140 }))).toBe("BAD_TAX_RATE");
    expect(code(() => calculateExpenseLine({ baseCurrency: "", currency: "PKR", amount: 10, taxMode: "exempt" }))).toBe("NO_BASE_CURRENCY");
  });

  it("a historical rate is a stored input: changing the 'current' rate later cannot change an already calculated row", () => {
    const first = calculateExpenseLine({ ...base, currency: "USD", amount: 10, exchangeRate: 278, operation: "*", taxMode: "exempt" });
    const later = calculateExpenseLine({ ...base, currency: "USD", amount: 10, exchangeRate: 290, operation: "*", taxMode: "exempt" });
    expect(first.convertedAmount).toBe(2780);
    expect(later.convertedAmount).toBe(2900);
    expect(first.exchangeRate).toBe(278); // the row keeps the rate it was calculated with
  });
});
