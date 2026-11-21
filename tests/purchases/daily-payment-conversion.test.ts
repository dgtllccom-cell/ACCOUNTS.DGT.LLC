import { describe, expect, it } from "vitest";
import { resolveDailyPaymentConversion } from "@/lib/purchases/daily-payment-conversion";

describe("daily payment conversion follows the booking's operator", () => {
  it("'/' booking (PKR per AED): PKR 20,250,000 at 77.2 converts to AED 262,305.70 by dividing", () => {
    const r = resolveDailyPaymentConversion({ amount: 20250000, currencyCode: "PKR", baseCurrency: "AED", exchangeRate: 77.2, operator: "/" });
    expect(r.isSameCurrency).toBe(false);
    expect(r.baseCurrencyAmount).toBeCloseTo(262305.6995, 3);
    expect(r.effectiveExchangeRate).toBeCloseTo(1 / 77.2, 10);
  });

  it("'*' booking (AED per USD): USD 230,000 at 3.675 converts to AED 845,250 by multiplying", () => {
    const r = resolveDailyPaymentConversion({ amount: 230000, currencyCode: "USD", baseCurrency: "AED", exchangeRate: 3.675, operator: "*" });
    expect(r.baseCurrencyAmount).toBe(845250);
    expect(r.effectiveExchangeRate).toBe(3.675);
  });

  it("the same currency as the country base is never converted", () => {
    const r = resolveDailyPaymentConversion({ amount: 1500, currencyCode: "AED", baseCurrency: "aed", exchangeRate: 77.2, operator: "/" });
    expect(r.isSameCurrency).toBe(true);
    expect(r.baseCurrencyAmount).toBe(1500);
    expect(r.effectiveExchangeRate).toBe(1);
  });

  it("an invalid rate falls back to 1 instead of dividing by zero", () => {
    const r = resolveDailyPaymentConversion({ amount: 100, currencyCode: "PKR", baseCurrency: "AED", exchangeRate: 0, operator: "/" });
    expect(Number.isFinite(r.baseCurrencyAmount)).toBe(true);
    expect(r.baseCurrencyAmount).toBe(100);
  });

  it("the '/' result would be refused by the old multiply rule (proves the defect the production log showed)", () => {
    const wrongOld = Math.round(20250000 * 77.2 * 10000) / 10000;
    const fixed = resolveDailyPaymentConversion({ amount: 20250000, currencyCode: "PKR", baseCurrency: "AED", exchangeRate: 77.2, operator: "/" });
    expect(wrongOld).not.toBeCloseTo(fixed.baseCurrencyAmount, 0);
  });
});
