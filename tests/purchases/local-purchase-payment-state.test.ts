import { describe, expect, it } from "vitest";
import { localPurchasePaymentState } from "@/lib/purchases/local-purchase-payment-state";

describe("Local Purchase Paid / Partial / Pending", () => {
  it("a posted bill with nothing paid is Pending, not Paid (LP-JRN-00000001)", () => {
    expect(localPurchasePaymentState({ status: "posted", final_cost: 357000, posted_paid_amount: 0 })).toBe("Pending");
    expect(localPurchasePaymentState({ status: "accepted", final_cost: 357000 })).toBe("Pending");
  });
  it("partial and full payments", () => {
    expect(localPurchasePaymentState({ status: "posted", final_cost: 357000, posted_paid_amount: 100000 })).toBe("Partial");
    expect(localPurchasePaymentState({ status: "posted", final_cost: 357000, posted_paid_amount: 357000 })).toBe("Paid");
  });
});
