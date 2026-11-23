import { describe, expect, it } from "vitest";
import { convertedSalesAmount, getBookingCurrencies } from "@/lib/sales/booking-currencies";
import { assertConfiguredSalesSettlement } from "@/lib/sales/booking-rules";

describe("Sales Booking currency controls", () => {
  it("keeps the purchase currency separate from the sale and settlement", () => {
    const form = { purchaseCurrency: "PKR", salesCurrency: "USD", currencyType: "PKR", secondaryCurrency: "AED", exchangeRate: 3.673 };
    const values = getBookingCurrencies(form);
    expect(values).toMatchObject({ purchase: "PKR", sales: "USD", final: "AED" });
    expect(convertedSalesAmount(400, values.rate)).toBeCloseTo(1469.2);
    expect(convertedSalesAmount(400, getBookingCurrencies({ ...form, purchaseCurrency: "EUR" }).rate)).toBeCloseTo(1469.2);
  });
  it("uses division and refuses a missing or zero cross-currency rate", () => {
    const form = { salesCurrency: "PKR", secondaryCurrency: "AED", exchangeRate: 77.2, operator: "/" };
    expect(convertedSalesAmount(77200, getBookingCurrencies(form).rate)).toBe(1000);
    expect(convertedSalesAmount(77200, getBookingCurrencies({ ...form, exchangeRate: 0 }).rate)).toBeNull();
  });
  it("uses a rate of one in the same currency", () => {
    expect(convertedSalesAmount(400, getBookingCurrencies({
      salesCurrency: "AED", secondaryCurrency: "AED", exchangeRate: 77.2, operator: "/",
    }).rate)).toBe(400);
  });
  it("prevents newly configured settlements from reaching a mismatched ledger currency", () => {
    const form = { salesCurrency: "USD", secondaryCurrency: "AED", exchangeRate: 3.673, bookingCurrencyConfigured: true };
    expect(() => assertConfiguredSalesSettlement({ form }, "AED")).not.toThrow();
    expect(() => assertConfiguredSalesSettlement({ form }, "PKR")).toThrow(/Final Currency must match/);
    expect(() => assertConfiguredSalesSettlement({ form: { ...form, bookingCurrencyConfigured: false } }, "PKR")).not.toThrow();
  });
});
