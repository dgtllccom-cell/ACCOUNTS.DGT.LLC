import { describe, expect, it } from "vitest";
import { assertBalancedPostedLines, assertDistinctBookingLedgers } from "@/lib/services/posting-verification";

describe("posting verification service", () => {
  it("asserts distinct booking ledgers correctly", () => {
    expect(() => assertDistinctBookingLedgers("dr-1", "cr-2", "Test")).not.toThrow();
    expect(() => assertDistinctBookingLedgers("dr-1", "dr-1", "Test")).toThrow("distinct");
  });

  it("accepts balanced lines in 1:1 currency", () => {
    const lines = [
      { ledger_id: "dr-1", debit: 500, credit: 0 },
      { ledger_id: "cr-1", debit: 0, credit: 500 }
    ];

    expect(() =>
      assertBalancedPostedLines({
        label: "Business Roznamcha",
        lines,
        expectedDebitLedgerId: "dr-1",
        expectedCreditLedgerId: "cr-1",
        expectedAmount: 500
      })
    ).not.toThrow();
  });

  it("accepts balanced lines with exchange rate conversion (e.g. AED 3.67)", () => {
    const amount = 1000;
    const exchangeRate = 3.67;
    const baseAmount = 3670;

    const lines = [
      { ledger_id: "dr-1", debit: baseAmount, credit: 0 },
      { ledger_id: "cr-1", debit: 0, credit: baseAmount }
    ];

    expect(() =>
      assertBalancedPostedLines({
        label: "Business Roznamcha",
        lines,
        expectedDebitLedgerId: "dr-1",
        expectedCreditLedgerId: "cr-1",
        expectedAmount: amount,
        expectedExchangeRate: exchangeRate
      })
    ).not.toThrow();
  });

  it("accepts a multi-currency purchase payment: USD 220,500 @ 3.675 posted as AED 810,337.50", () => {
    // post_purchase_order_payment posts the roznamcha lines in the BASE currency
    // (see 20261001_multicurrency_purchase_payment_fix). The verifier must accept
    // debit/credit == base amount == original amount x frozen rate.
    const originalAmount = 220_500;      // USD, on the payment row
    const frozenRate = 3.675;            // base (AED) per USD, frozen at posting
    const baseAmount = 810_337.5;        // AED, the roznamcha line amount

    const lines = [
      { ledger_id: "dr-purchase", debit: baseAmount, credit: 0 },
      { ledger_id: "cr-supplier", debit: 0, credit: baseAmount }
    ];

    expect(() =>
      assertBalancedPostedLines({
        label: "Purchase payment",
        lines,
        expectedDebitLedgerId: "dr-purchase",
        expectedCreditLedgerId: "cr-supplier",
        expectedAmount: originalAmount,
        expectedExchangeRate: frozenRate,
        expectedBaseAmount: baseAmount
      })
    ).not.toThrow();
  });

  it("throws when lines are unbalanced", () => {
    const lines = [
      { ledger_id: "dr-1", debit: 1000, credit: 0 },
      { ledger_id: "cr-1", debit: 0, credit: 900 }
    ];

    expect(() =>
      assertBalancedPostedLines({
        label: "Business Roznamcha",
        lines,
        expectedDebitLedgerId: "dr-1",
        expectedCreditLedgerId: "cr-1",
        expectedAmount: 1000
      })
    ).toThrow();
  });
});
