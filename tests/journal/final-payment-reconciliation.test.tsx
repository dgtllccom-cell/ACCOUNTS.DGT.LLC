import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { finalPaymentReconciliation } from "@/lib/journal/final-payment-reconciliation";
import { FinalPaymentReconciliation } from "@/features/journal/components/final-payment-reconciliation";

const bill = { id: "B1", order_type: "purchase_booking", purchase_order_no: "BILL-1", purchase_currency: "USD", base_currency: "AED", exchange_rate: 3.67, total_goods_original: 10000, order_total: 36700, advance_paid: 2000, remaining_paid: 1500, remaining_due: 6500 };
const due = { id: "B1", currency: "USD", billTotal: 10000, advancePaid: 2000, remainingPaid: 1500, totalPaid: 3500, outstanding: 6500, loadings: [
  { id: "L1", loadingNo: "LOAD-1", container: "CONTAINER-1", value: 1000, advanceAllocated: 200, paid: 800, outstanding: 0, complete: true },
  { id: "L2", loadingNo: "LOAD-2", container: "CONTAINER-2", value: 1000, advanceAllocated: 200, paid: 400, outstanding: 400, complete: false },
] };
beforeEach(() => vi.stubGlobal("React", React));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("Final purchase payment reconciliation", () => {
  it("keeps original purchase currency and separates advance, installments and balance", () => {
    expect(finalPaymentReconciliation(bill)).toMatchObject({ currency: "USD", total: 10000, advancePaid: 2000, afterAdvance: 8000, remainingPaid: 1500, totalPaid: 3500, outstanding: 6500 });
    expect(finalPaymentReconciliation({ ...bill, remaining_paid: 2500, remaining_due: 5500 })).toMatchObject({ remainingPaid: 2500, totalPaid: 4500, outstanding: 5500 });
  });
  it("groups only authoritative paid loadings without completing the whole purchase", () => {
    const original = JSON.stringify([bill, due]);
    const result = finalPaymentReconciliation(bill, due);
    expect(result.completed.map(row => row.id)).toEqual(["L1"]);
    expect(result.outstanding).toBe(6500);
    expect(JSON.stringify([bill, due])).toBe(original);
    expect(finalPaymentReconciliation(bill).completed).toEqual([]);
    expect(finalPaymentReconciliation(bill, { ...due, loadings: [...due.loadings, { ...due.loadings[0] }, { id: "BAD", complete: true, value: 1000, outstanding: 200 }] }).completed).toHaveLength(1);
  });
  it("uses Local Purchase posted aggregates, never its normalized credit allocation or promised advance", () => {
    const local = { id: "LP1", order_type: "local_purchase", local_currency: "AED", currency_code: "USD", final_cost: 36700, paid_amount: 10000, balance_amount: 26700, advance_amount: 5000, remaining_paid: 10000, credit_amount: 36700, remaining_due: 0 };
    expect(finalPaymentReconciliation(local)).toMatchObject({ currency: "AED", total: 36700, advancePaid: 5000, remainingPaid: 5000, totalPaid: 10000, outstanding: 26700 });
    expect(finalPaymentReconciliation({ ...local, advance_amount: 9000, payment_entries: [
      { kind: "advance", amount: 2000, status: "posted" },
      { kind: "remaining", amount: 5000, status: "posted" },
      { kind: "credit", amount: 3000, status: "posted" },
      { kind: "advance", amount: 7000, status: "draft" },
    ] })).toMatchObject({ advancePaid: 2000, remainingPaid: 5000, totalPaid: 10000, outstanding: 26700 });
    expect(finalPaymentReconciliation({ ...local, paid_amount: 0, balance_amount: 36700 })).toMatchObject({ advancePaid: 0, totalPaid: 0, outstanding: 36700 });
  });
  it("opens the original bill and print handler, with no payment action in Final", () => {
    const open = vi.fn(), print = vi.fn(), source = vi.fn();
    render(<FinalPaymentReconciliation rows={[bill]} dueBills={[due]} ready sourceFilter="all" onSourceChange={source} lang="en" onOpenFullBill={open} onPrintStatement={print} />);
    expect(screen.getByText("CONTAINER-1")).toBeTruthy();
    expect(screen.queryByText("CONTAINER-2")).toBeNull();
    expect(screen.getByText("Partially Paid")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "BILL-1" }));
    expect(open).toHaveBeenCalledWith(bill);
    fireEvent.click(screen.getByRole("button", { name: "Print / PDF" }));
    expect(print).toHaveBeenCalledWith(bill);
    expect(screen.queryByRole("button", { name: /pay now|save|post/i })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Local Purchase" }));
    expect(source).toHaveBeenCalledWith("local_purchase");
  });
  it("keeps currency rows separate and source-filtered without exposing absent rows", () => {
    render(<FinalPaymentReconciliation rows={[bill, { id: "LP1", order_type: "local_purchase", purchase_order_no: "LOCAL-ONLY", local_currency: "AED", final_cost: 100, paid_amount: 0, balance_amount: 100 }]} dueBills={[due]} ready sourceFilter="local_purchase" onSourceChange={vi.fn()} lang="ur" onOpenFullBill={vi.fn()} onPrintStatement={vi.fn()} />);
    expect(screen.getByText("LOCAL-ONLY")).toBeTruthy();
    expect(screen.queryByText("BILL-1")).toBeNull();
    expect(screen.queryByText("USD")).toBeNull();
  });
  it("shows a lookup failure instead of claiming there are zero completed loadings", () => {
    render(<FinalPaymentReconciliation rows={[bill]} dueBills={[]} ready error="Permission denied" sourceFilter="all" onSourceChange={vi.fn()} lang="en" onOpenFullBill={vi.fn()} onPrintStatement={vi.fn()} />);
    expect(screen.getByRole("alert").textContent).toBe("Permission denied");
    expect(within(screen.getByRole("alert")).queryByText(/0/)).toBeNull();
  });
});
