import { describe, expect, it } from "vitest";
import { configuredSalesReceipt, salesReceiptBalances } from "@/lib/sales/payment-settlement";

describe("Sales receipt accounting", () => {
  it("converts paid advances in the sales currency exactly once to the final currency", () => {
    expect(configuredSalesReceipt({
      amount: 20, currency: "USD", salesCurrency: "USD", finalCurrency: "AED", rate: 3.6725, operator: "*",
    })).toEqual({ originalAmount: 20, finalAmount: 73.45, finalCurrency: "AED" });
    expect(salesReceiptBalances(100, 20, 10, "remaining", 20)).toEqual({ paid: 30, remaining: 70, status: "partial" });
  });

  it("posts receipts submitted in the final currency without applying FX again", () => {
    expect(configuredSalesReceipt({
      amount: 25, currency: "AED", salesCurrency: "PKR", finalCurrency: "AED", rate: 75, operator: "/",
    })).toEqual({ originalAmount: 1875, finalAmount: 25, finalCurrency: "AED" });
    expect(salesReceiptBalances(2000, 125, 1875, "remaining", 0)).toEqual({ paid: 2000, remaining: 0, status: "completed" });
  });

  it.each([[3.67254, 367.25], [3.67256, 367.26]])("closes an exact final-currency receipt across FX rounding: %s", (rate, booked) => {
    const receipt = configuredSalesReceipt({ amount: booked, currency: "AED", salesCurrency: "USD", finalCurrency: "AED", rate, operator: "*" });
    const final = { booked, received: receipt.finalAmount, rate, operator: "*" as const };
    expect(salesReceiptBalances(100, 0, receipt.originalAmount, "remaining", 0, final)).toEqual({ paid: 100, remaining: 0, status: "completed" });
    expect(() => salesReceiptBalances(100, 0, receipt.originalAmount, "remaining", 0, { ...final, received: booked + 0.01 })).toThrow(/receivable/);
  });

  it("uses exact posted receipts instead of the rounded original-currency snapshot", () => {
    // 2.99 PKR already received at 300 PKR/USD is stored as 0.01 USD; exactly 27.01 PKR remains.
    const final = { booked: 30, received: 27.01, rate: 300, operator: "*" as const, previouslyReceived: 2.99 };
    expect(salesReceiptBalances(0.1, 0.01, 0.09, "remaining", 0, final)).toEqual({ paid: 0.1, remaining: 0, status: "completed" });
    expect(() => salesReceiptBalances(0.1, 0.01, 0.09, "remaining", 0, { ...final, received: 27.02 })).toThrow(/receivable/);
  });

  it("rejects unapproved currency, excess advance, duplicate or excessive final receipts", () => {
    expect(() => configuredSalesReceipt({
      amount: 20, currency: "EUR", salesCurrency: "USD", finalCurrency: "AED", rate: 3.6725, operator: "*",
    })).toThrow(/original or final/);
    expect(() => salesReceiptBalances(100, 30, 21, "advance", 50)).toThrow(/advance/);
    expect(() => salesReceiptBalances(100, 99, 1.01, "credit", 0)).toThrow(/receivable/);
    expect(() => salesReceiptBalances(100, 100, 1, "remaining", 0)).toThrow(/receivable/);
  });
});
