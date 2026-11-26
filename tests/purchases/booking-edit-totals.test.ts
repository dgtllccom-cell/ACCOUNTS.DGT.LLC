import { describe, expect, it } from "vitest";
import { bookingAdjustmentLines, calculateBookingEditTotals } from "@/lib/purchases/booking-edit-totals";
import { verifiedPaid } from "@/lib/purchases/loaded-payable";
import { resolvePurchaseAmounts } from "@/lib/services/purchase-calculation-service";

describe("purchase booking corrections", () => {
  const goods = { goodsName: "Black Mafta", qtyNo: 160, qtyKgs: 50.25, emptyKgs: 0.25,
    divideWeight: 40, coursePrice: 7500 };

  it("reconciles a 160-bag fixture using the recorded PKR-per-AED convention", () => {
    const { totals, multiplier } = calculateBookingEditTotals([goods], 77.2, "/");
    expect(totals).toEqual({
      totalQty: 160, totalGross: 8040, totalNet: 8000, totalDeductions: 40,
      grandPrimaryFinal: 1_500_000, grandFinal: 19_430.0518,
    });
    const payment = { kind: "advance", status: "posted", currency_code: "AED", amount: 1000,
      posted_to_journal: true, roznamcha_entry_id: "advance-journal", debit_ledger_id: "dr", credit_ledger_id: "cr" };
    const booking = { ...payment, kind: "booking", amount: totals.grandFinal };
    expect(verifiedPaid([payment, booking], "PKR", multiplier).settledFC).toBe(77_200);
    expect(totals.grandPrimaryFinal - verifiedPaid([payment, booking], "PKR", multiplier).settledFC).toBe(1_422_800);
  });

  it("uses the same FX and remaining balance for loading after the edit", () => {
    const { lines, totals } = calculateBookingEditTotals([goods], 77.2, "/");
    const amounts = resolvePurchaseAmounts({
      currency_code: "PKR", payment_currency: "AED", exchange_rate: 77.2,
      advance_paid: 77_200, remaining_paid: 10_000, credit_amount: 1_000,
      form_data: { form: { operator: "/" }, goodsEntries: lines, totals },
    });
    expect(amounts.totalPurchaseLC).toBeCloseTo(19_430.0518, 4);
    expect(amounts.remainingPurchaseFC).toBe(1_411_800);
    expect(amounts.totalQuantity).toBe(160);
  });

  it("posts only the balanced increase or decrease and skips a zero difference", () => {
    expect(bookingAdjustmentLines(100, 150, "purchase", "payable")).toEqual({
      delta: 50, amount: 50, debitLedger: "purchase", creditLedger: "payable",
    });
    expect(bookingAdjustmentLines(150, 100, "purchase", "payable")).toEqual({
      delta: -50, amount: 50, debitLedger: "payable", creditLedger: "purchase",
    });
    expect(bookingAdjustmentLines(100, 100, "purchase", "payable")).toBeNull();
  });

  it("recomputes the converted amount on a rate change and validates quantity and weights", () => {
    const [line] = calculateBookingEditTotals([{ ...goods, finalAmount: 19_430.0518 }], 80, "/").lines;
    expect(line.finalAmount).toBe(18_750);
    expect(() => calculateBookingEditTotals([{ ...goods, qtyNo: -1 }], 80, "/")).toThrow();
    expect(() => calculateBookingEditTotals([{ ...goods, netWeight: 9000 }], 80, "/")).toThrow();
    expect(() => calculateBookingEditTotals([goods], 0, "/")).toThrow();
  });
});
