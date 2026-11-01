import { describe, expect, it } from "vitest";
import { finalCurrencyAmount } from "@/lib/purchases/final-currency";

describe("country final currency", () => {
  it.each(["EUR","SAR","KES","THB","AFN","GBP"])("uses configured %s currency without a country-specific branch", countryCurrency => {
    expect(finalCurrencyAmount(250, "USD", countryCurrency, 2)).toBe(500);
    expect(finalCurrencyAmount(250, countryCurrency, countryCurrency, 2)).toBe(250);
  });
  it("converts the selected loading's unpaid share at the historical bill rate", () => {
    expect(finalCurrencyAmount(104287.5, "USD", "AED", 3.67)).toBe(382735.13);
    expect(finalCurrencyAmount(100, "EUR", "PKR", 310)).toBe(31000);
  });
  it("does not convert twice for a domestic bill", () => {
    expect(finalCurrencyAmount(100, "AED", "AED", 3.67)).toBe(100);
  });
  it("leaves missing country currency or cross-currency rates unresolved", () => {
    expect(finalCurrencyAmount(100, "USD", null, 3.67)).toBeNull();
    expect(finalCurrencyAmount(100, "USD", "AED", 0)).toBeNull();
    expect(finalCurrencyAmount(100, "USD", "AED", NaN)).toBeNull();
  });
});
