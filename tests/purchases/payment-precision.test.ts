import { describe, expect, it } from "vitest";
import { comparePurchasePaymentToLimit, isPurchaseBalanceCleared } from "@/lib/purchases/payment-precision";
import { loadedPayable } from "@/lib/purchases/loaded-payable";

describe("same-currency purchase settlement precision", () => {
  it.each(["Purchase Booking", "Local Purchase"])("keeps %s payments within the available amount", () => {
    expect(comparePurchasePaymentToLimit(10, 10)).toBe("allowed");
    expect(comparePurchasePaymentToLimit(10.01, 10)).toBe("exceeds");
    expect(comparePurchasePaymentToLimit(9.99, 10)).toBe("allowed");
    expect(comparePurchasePaymentToLimit(0.01, 10 - 9.99)).toBe("allowed");
    expect(comparePurchasePaymentToLimit(0.01, 0)).toBe("settled");
    expect(isPurchaseBalanceCleared(10 - 9.99)).toBe(false);
    expect(isPurchaseBalanceCleared(0.1 + 0.2 - 0.3)).toBe(true);
    expect(comparePurchasePaymentToLimit(0.00001, 0.01)).toBe("invalid");
  });
  it("does not borrow from another container to round an allocation up", () => {
    const payable = loadedPayable({
      orderTotalFC: 20, advancePaidFC: 0, totalQuantity: 2,
      loadings: [
        { id: "A", quantity: 1, reportedValueFC: 10 },
        { id: "B", quantity: 1, reportedValueFC: 10 },
      ],
      remainingPaidAllFC: 9.99, loadingId: "A", remainingPaidThisLoadingFC: 9.99,
    });
    expect(payable.loadedOutstandingFC).toBe(10.01);
    expect(comparePurchasePaymentToLimit(0.01, payable.loadingOutstandingFC!)).toBe("allowed");
    expect(comparePurchasePaymentToLimit(0.02, payable.loadingOutstandingFC!)).toBe("exceeds");
  });
});
