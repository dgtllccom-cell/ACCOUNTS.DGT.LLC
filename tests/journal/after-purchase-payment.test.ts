import { afterEach, describe, expect, it, vi } from "vitest";
import { afterPurchasePayment, purchasePaymentRegisterUrl } from "@/lib/journal/after-purchase-payment";
import { remainingLoadingEntry, payableRemainingLoadings } from "@/lib/journal/remaining-loading-entry";

afterEach(() => vi.useRealTimers());
describe("Remaining installment success stays in Remaining", () => {
  it.each([false, true])("refreshes partial payment history and saved batch balance even with fromLoading=%s", async fromLoading => {
    vi.useFakeTimers();
    let due = { id: "P1", currency: "USD", loadings: [{ id: "L1", value: 1000, advanceAllocated: 200, paid: 0, outstanding: 800, complete: false }] };
    const navigate = vi.fn(), returnToRegister = vi.fn();
    const refresh = vi.fn(async () => { due = { ...due, loadings: [{ ...due.loadings[0], paid: 300, outstanding: 500 }] }; });
    await afterPurchasePayment({ mode: "remaining", fromLoading, hasOrder: true, refresh, navigate, returnToRegister });
    await vi.runAllTimersAsync();
    expect(refresh).toHaveBeenCalledOnce();
    expect(navigate).not.toHaveBeenCalled();
    expect(returnToRegister).toHaveBeenCalledOnce();
    expect(returnToRegister.mock.invocationCallOrder[0]).toBeLessThan(refresh.mock.invocationCallOrder[0]);
    expect(remainingLoadingEntry(due, "L1")).toMatchObject({ remainingPaid: 300, outstanding: 500 });
    expect(payableRemainingLoadings(due).map(row => row.id)).toEqual(["L1"]);
  });
  it("reloads a fully settled batch and no longer offers it for another installment", async () => {
    vi.useFakeTimers();
    const navigate = vi.fn(), returnToRegister = vi.fn();
    let due = { id: "P1", loadings: [{ id: "L1", value: 1000, advanceAllocated: 200, paid: 300, outstanding: 500, complete: false }] };
    await afterPurchasePayment({ mode: "remaining", fromLoading: true, hasOrder: true, navigate, returnToRegister, refresh: async () => { due = { ...due, loadings: [{ ...due.loadings[0], paid: 800, outstanding: 0, complete: true }] }; } });
    await vi.runAllTimersAsync();
    expect(navigate).not.toHaveBeenCalled();
    expect(returnToRegister).toHaveBeenCalledOnce();
    expect(payableRemainingLoadings(due)).toEqual([]);
    expect(remainingLoadingEntry(due, "L1")).toBeNull();
  });
  it("retains the existing advance navigation and delay", async () => {
    vi.useFakeTimers();
    const navigate = vi.fn(), refresh = vi.fn(), returnToRegister = vi.fn();
    await afterPurchasePayment({ mode: "advance", fromLoading: false, hasOrder: true, navigate, refresh, returnToRegister });
    expect(navigate).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1200);
    expect(navigate).toHaveBeenCalledWith("/dashboard/purchase/purchase-loading-records");
    expect(refresh).not.toHaveBeenCalled();
    expect(returnToRegister).not.toHaveBeenCalled();
  });
  it("refreshes a normal credit payment without redirecting", async () => {
    const navigate = vi.fn(), refresh = vi.fn(async () => {}), returnToRegister = vi.fn();
    await afterPurchasePayment({ mode: "credit", fromLoading: false, hasOrder: true, navigate, refresh, returnToRegister });
    expect(refresh).toHaveBeenCalledOnce();
    expect(navigate).not.toHaveBeenCalled();
  });
});

it("cleans saved-entry hints without dropping the register route, filters or language", () => {
  expect(purchasePaymentRegisterUrl("https://example.test/dashboard/journal/purchase-order-payment/remaining?purchaseOrderNo=P1&fromLoading=true&loadingRecordId=L1&lang=ur&branch=B1#register"))
    .toBe("/dashboard/journal/purchase-order-payment/remaining?lang=ur&branch=B1#register");
});
