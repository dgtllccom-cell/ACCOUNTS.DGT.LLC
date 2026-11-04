import { describe, expect, it } from "vitest";
import { payableRemainingLoadings, remainingLoadingEntry } from "@/lib/journal/remaining-loading-entry";
import { buildPaymentEntryModel } from "@/lib/journal/purchase-payment-entry-model";

const due = {
  id: "bill-one", currency: "USD", exchangeRate: 3.67,
  loadings: [
    { id: "load-1", loadingNo: "LD-1", quantity: 2250, grossWeightKg: 22725, netWeightKg: 22500, value: 115875, advanceAllocated: 11587.5, paid: 0, outstanding: 104287.5 },
    { id: "load-2", loadingNo: "LD-2", quantity: 2250, netWeightKg: 22500, value: 115875, advanceAllocated: 11587.5, paid: 104287.5, outstanding: 0, complete: true },
  ]
};

describe("Journal Remaining Payment must open saved loading share", () => {
  it("offers only genuinely payable saved loading records", () => {
    expect(payableRemainingLoadings(due).map((entry) => entry.id)).toEqual(["load-1"]);
    expect(remainingLoadingEntry(due, "load-2")).toBeNull();
    expect(remainingLoadingEntry(due, "not-saved")).toBeNull();
    expect(remainingLoadingEntry(null, "load-1")).toBeNull();
  });

  it("shows batch value and batch remaining, never the full 22500-unit contract", () => {
    const entry = remainingLoadingEntry(due, "load-1");
    expect(entry).not.toBeNull();
    expect(entry).toMatchObject({
      quantity: 2250, netWeightKg: 22500, value: 115875, advanceAllocated: 11587.5,
      remainingPaid: 0, outstanding: 104287.5, currency: "USD"
    });
    const paid = entry!.advanceAllocated + entry!.remainingPaid;
    const model = buildPaymentEntryModel({
      mode: "remaining", contractTotal: entry!.value, contractTotalLocal: entry!.value * 3.67,
      rate: 3.67, percent: 10, endorsementOrder: false,
      goods: [{ name: "WALNUT KERNELS", hsCode: "123", qty: entry!.quantity, netKg: entry!.netWeightKg!, amount: entry!.value, finalAmount: entry!.value * 3.67 }],
      payments: [{ id: "__allocation__", kind: "advance", amountPurchase: entry!.advanceAllocated, amountLocal: entry!.advanceAllocated * 3.67, date: "0000-00-00" }],
      totalPaid: paid, balance: entry!.outstanding
    });
    expect(model.contractTotal).toBe(115875);
    expect(model.advancePaid).toBe(11587.5);
    expect(model.balance).toBe(104287.5);
    expect(model.goodsTotals.qty).toBe(2250);
    expect(model.goodsTotals.stageAmount).toBe(104287.5);
  });

  it("does not create payable amounts when API data is absent", () => {
    expect(payableRemainingLoadings({ id: "bill-empty", loadings: [] })).toHaveLength(0);
    expect(payableRemainingLoadings({ id: "bill-empty", loadings: [{ id: "L3", value: 1000, outstanding: 0, complete: true }] })).toHaveLength(0);
  });
});
