import { describe, expect, it } from "vitest";
import { purchaseOrderPaymentPostSchema } from "@/lib/api/erp-validation";
import { exactPurchaseAllocation, supportsExactPurchaseAllocation } from "@/lib/purchases/payment-request";

const pair = { bookingSettlement: true, billCurrency: "USD", calculatorCurrency: "USD", localCurrency: "AED", tenderCurrency: "AED" };
const bill = { ...pair, amount: "73.4123", manualRate: "3.65", operator: "mul" as const };
describe("Purchase Booking manual FX submission", () => {
  it("sends the independently entered bill amount and rounded local tender for multiply or divide", () => {
    expect(exactPurchaseAllocation(bill)).toEqual({
      purchaseAppliedAmount: 73.4123, amount: 267.9549, amountLocal: 267.9549, exchangeRate: 3.65,
    });
    expect(exactPurchaseAllocation({ ...bill, amount: "100", manualRate: "0.25", operator: "div" })).toEqual({
      purchaseAppliedAmount: 100, amount: 400, amountLocal: 400, exchangeRate: 4,
    });
  });

  it("keeps original-currency tender in its original units; a branch rate does not change allocation", () => {
    expect(exactPurchaseAllocation({ ...bill, tenderCurrency: "USD" })).toEqual({
      purchaseAppliedAmount: 73.4123, amount: 73.4123, amountLocal: 267.9549, exchangeRate: 3.65,
    });
  });

  it("does not infer rate, use a third currency, round away original precision, or change Local Purchase", () => {
    expect(exactPurchaseAllocation({ ...bill, manualRate: "" })).toBeNull();
    expect(exactPurchaseAllocation({ ...bill, amount: "1.00001" })).toBeNull();
    expect(supportsExactPurchaseAllocation(pair)).toBe(true);
    expect(supportsExactPurchaseAllocation({ ...pair, bookingSettlement: false })).toBe(false);
    expect(supportsExactPurchaseAllocation({ ...pair, tenderCurrency: "PKR" })).toBe(false);
    expect(supportsExactPurchaseAllocation({ ...pair, calculatorCurrency: "PKR" })).toBe(false);
    expect(supportsExactPurchaseAllocation({ ...pair, billCurrency: "AED", calculatorCurrency: "AED" })).toBe(false);
  });

  it("keeps the schema field optional, preserves exact numeric magnitude, and rejects coercion and excess precision", () => {
    const p = {
      entryDate: "2026-11-26",
      kind: "remaining",
      amount: 400, currencyCode: "AED", exchangeRate: 4,
      debitLedgerId: "910a8996-b73f-4fb1-b04a-daa073119221",
      creditLedgerId: "a01a8996-b73f-4fb1-b04a-daa073119221",
    };
    expect(purchaseOrderPaymentPostSchema.parse(p).purchaseAppliedAmount).toBeUndefined();
    expect(purchaseOrderPaymentPostSchema.parse({ ...p, purchaseAppliedAmount: 73.4123 }).purchaseAppliedAmount).toBe(73.4123);
    for (const invalid of [null, "", true, "73.4123", 1.00001, 0, -10, Infinity]) {
      expect(purchaseOrderPaymentPostSchema.safeParse({ ...p, purchaseAppliedAmount: invalid }).success).toBe(false);
    }
  });
});
