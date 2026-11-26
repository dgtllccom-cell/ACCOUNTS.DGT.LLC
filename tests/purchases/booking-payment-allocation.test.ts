import { describe, expect, it } from "vitest";
import { exactBookingPaymentQuote } from "@/lib/purchases/booking-payment-allocation";

const quote = { applied: 100, billCurrency: "USD", baseCurrency: "AED", rateToBase: 3.7 };

describe("manual Purchase Booking payment allocation", () => {
  it("keeps the original dollars when booking and payment rates differ, for either tender representation", () => {
    for (const representation of [{ tender: 100, tenderCurrency: "USD" }, { tender: 370, tenderCurrency: "AED" }]) {
      expect(exactBookingPaymentQuote({ ...quote, ...representation }))
        .toEqual({ applied: 100, baseAmount: 370, baseCurrency: "AED", rateToBase: 3.7 });
    }
  });

  it("applies the manual quote to the chosen branch currency without fixed UAE or USD assumptions", () => {
    expect(exactBookingPaymentQuote({ applied: 28.1234, tender: 67.4962, billCurrency: "GBP", tenderCurrency: "KWD",
      baseCurrency: "KWD", rateToBase: 2.4 })).toEqual({ applied: 28.1234, baseAmount: 67.4962, baseCurrency: "KWD", rateToBase: 2.4 });
  });

  it("rejects wrong tender, unsupported currency, unrecordable amount or invalid rate", () => {
    expect(exactBookingPaymentQuote({ ...quote, tender: 367, tenderCurrency: "AED" })).toBeNull();
    expect(exactBookingPaymentQuote({ ...quote, tender: 370, tenderCurrency: "EUR" })).toBeNull();
    expect(exactBookingPaymentQuote({ ...quote, tender: 90, tenderCurrency: "USD" })).toBeNull();
    expect(exactBookingPaymentQuote({ ...quote, applied: 100.00001, tender: 100.00001, tenderCurrency: "USD" })).toBeNull();
    expect(exactBookingPaymentQuote({ ...quote, rateToBase: 0, tender: 100, tenderCurrency: "USD" })).toBeNull();
  });
});
