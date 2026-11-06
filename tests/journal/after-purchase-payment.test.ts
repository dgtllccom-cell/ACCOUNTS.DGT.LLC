import { afterEach, describe, expect, it, vi } from "vitest";
import { afterPurchasePayment } from "@/lib/journal/after-purchase-payment";
import { remainingLoadingEntry, payableRemainingLoadings } from "@/lib/journal/remaining-loading-entry";

afterEach(() => vi.useRealTimers());
describe("Remaining installment success stays in Remaining", () => {
  it.each([false, true])("refreshes partial payment history and saved batch balance even with fromLoading=%s", async fromLoading => {
    vi.useFakeTimers();
    let due = { id: "P1", currency: "USD", loadings: [{ id: "L1", value: 1000, advanceAllocated: 200, paid: 0, outstanding: 800, complete: false }] };
    const navigate = vi.fn();
    const refresh = vi.fn(async () => { due = { ...due, loadings: [{ ...due.loadings[0], paid: 300, outstanding: 500 }] }; });
    await afterPurchasePayment({ mode: "remaining", fromLoading, hasOrder: true, refresh, navigate });
    await vi.runAllTimersAsync();
    expect(refresh).toHaveBeenCalledOnce();
    expect(navigate).not.toHaveBeenCalled();
    expect(remainingLoadingEntry(due, "L1")).toMatchObject({ remainingPaid: 300, outstanding: 500 });
    expect(payableRemainingLoadings(due).map(row => row.id)).toEqual(["L1"]);
  });
  it("reloads a fully settled batch and no longer offers it for another installment", async () => {
    vi.useFakeTimers();
    const navigate = vi.fn();
    let due = { id: "P1", loadings: [{ id: "L1", value: 1000, advanceAllocated: 200, paid: 300, outstanding: 500, complete: false }] };
    await afterPurchasePayment({ mode: "remaining", fromLoading: true, hasOrder: true, navigate, refresh: async () => { due = { ...due, loadings: [{ ...due.loadings[0], paid: 800, outstanding: 0, complete: true }] }; } });
    await vi.runAllTimersAsync();
    expect(navigate).not.toHaveBeenCalled();
    expect(payableRemainingLoadings(due)).toEqual([]);
    expect(remainingLoadingEntry(due, "L1")).toBeNull();
  });
  it("retains the existing advance navigation and delay", async () => {
    vi.useFakeTimers();
    const navigate = vi.fn(), refresh = vi.fn();
    await afterPurchasePayment({ mode: "advance", fromLoading: false, hasOrder: true, navigate, refresh });
    expect(navigate).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1200);
    expect(navigate).toHaveBeenCalledWith("/dashboard/purchase/purchase-loading-records");
    expect(refresh).not.toHaveBeenCalled();
  });
  it("refreshes a normal credit payment without redirecting", async () => {
    const navigate = vi.fn(), refresh = vi.fn(async () => {});
    await afterPurchasePayment({ mode: "credit", fromLoading: false, hasOrder: true, navigate, refresh });
    expect(refresh).toHaveBeenCalledOnce();
    expect(navigate).not.toHaveBeenCalled();
  });
});
