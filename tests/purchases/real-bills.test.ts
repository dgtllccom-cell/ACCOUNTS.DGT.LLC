import { describe, expect, it } from "vitest";
import { buildBillPayment, loadingPaymentOk } from "@/lib/services/purchase-loading-payment-service";
import { resolveLoadingEligibility } from "@/lib/services/purchase-calculation-service";
import { paidForLoadingGate, verifiedPaid } from "@/lib/purchases/loaded-payable";

/**
 * The four REAL bills that exist on Production (numbers read read-only on 2026-10-30; no names, nothing written). All are USD bills in an AED
 * branch @ 3.67, Payment Type "Advance Payment"; `order_total` is the AED figure. These tests pin what the workflow must say about them.
 */
const posted = { posted_to_journal: true, roznamcha_entry_id: "r", debit_ledger_id: "d", credit_ledger_id: "c", status: "posted", currency_code: "AED", exchange_rate: 3.67 };
const bill = (o: Record<string, unknown>, qty: number, goodsTotal: number, pct: number) => ({
  currency_code: "USD", purchase_currency: "USD", exchange_rate: 3.67, base_currency: "AED", credit_amount: 0, remaining_paid: 0,
  form_data: { form: { paymentType: "Advance Payment", advancePercent: pct }, goodsEntries: [{ qtyNo: qty, totalAmount: goodsTotal }], totals: { totalQuantity: qty }, workflow: { totalQuantity: qty, transferStatus: "transferred" } },
  ...o
});

const AE0004 = bill({ order_total: 426637.5, total_goods_original: 116250, advance_paid: 22000, remaining_due: 94250 }, 2500, 116250, 20);
const AE0005 = bill({ order_total: 709686.25, total_goods_original: 193375, advance_paid: 19618, remaining_due: 173757 }, 1300, 193375, 10);
const AE0006 = bill({ order_total: 464255, total_goods_original: 126500, advance_paid: 30000, remaining_due: 96500 }, 2300, 126500, 100);
const AE0007 = bill({ order_total: 4252612.5, total_goods_original: 1158750, advance_paid: 115875, remaining_due: 1042875 }, 22500, 1158750, 10);

// payments as stored: `amount` in AED (payment currency), base_currency_amount AED
const adv = (usd: number) => ({ kind: "advance", amount: usd * 3.67, base_currency_amount: usd * 3.67, ...posted });

describe("real Production bills", () => {
  it("AE-001-0004: advance 20 % of USD 116,250 = 23,250; 22,000 paid → NOT complete, still in the Advance screen's scope; Loading blocked", () => {
    const b = buildBillPayment(AE0004 as any, [], []);
    expect(b).toMatchObject({ advanceRequired: 23250, advancePaid: 22000, gated: true, totalQuantity: 2500, loadedQuantity: 0, balanceQuantity: 2500 });
    const paid = paidForLoadingGate("advance", verifiedPaid([adv(22000)], "USD", 3.67));
    expect(resolveLoadingEligibility({ ...(AE0004 as any), form_data: AE0004.form_data } as any, paid).eligible).toBe(false);
  });
  it("AE-001-0005: advance 10 % = 19,337.50, 19,618 paid → complete; Loading eligible; its 1,300 loaded cartons owe 173,757", () => {
    const loadings = [{ id: "L1", loaded_quantity: 1300, created_at: "2026-10-28T15:22:08Z" }];
    const b = buildBillPayment(AE0005 as any, loadings, []);
    expect(b.advanceRequired).toBe(19337.5);
    const paid = paidForLoadingGate("advance", verifiedPaid([adv(19618)], "USD", 3.67));
    expect(resolveLoadingEligibility(AE0005 as any, paid).eligible).toBe(true);
    const st = b.byLoading.get("L1")!;
    expect(st.valueFC).toBe(193375);
    expect(st.advanceAllocFC).toBeCloseTo(19618, 2);
    expect(st.outstandingFC).toBeCloseTo(173757, 2);
    expect(st.complete).toBe(false);
    // its stock cannot be confirmed until that Remaining Payment is posted
    expect(loadingPaymentOk(b, "L1")).toBe(false);
  });
  it("AE-001-0005 after its Remaining Payment of 173,757 is posted against the loading → eligible for Confirmed Stock", () => {
    const loadings = [{ id: "L1", loaded_quantity: 1300, created_at: "2026-10-28T15:22:08Z" }];
    const payments = [{ amount: 173757 * 3.67, currency_code: "AED", exchange_rate: 3.67, base_currency_amount: 173757 * 3.67, loading_record_id: "L1" }];
    const b = buildBillPayment({ ...AE0005, remaining_paid: 173757, remaining_due: 0 } as any, loadings, payments);
    expect(loadingPaymentOk(b, "L1")).toBe(true);
    expect(b.totalPaid).toBeCloseTo(193375, 2);
    expect(b.outstanding).toBe(0);
  });
  it("AE-001-0006: 100 % advance of 126,500, 30,000 paid → 96,500 still required", () => {
    const b = buildBillPayment(AE0006 as any, [], []);
    expect(b.advanceRequired).toBe(126500);
    expect(b.advanceRequired - b.advancePaid).toBe(96500);
  });
  it("AE-001-0007: 10 % of USD 1,158,750 = 115,875 paid in full → advance complete; nothing loaded yet; Loading eligible", () => {
    const b = buildBillPayment(AE0007 as any, [], []);
    expect(b).toMatchObject({ advanceRequired: 115875, advancePaid: 115875, totalQuantity: 22500, loadedQuantity: 0, balanceQuantity: 22500 });
    const paid = paidForLoadingGate("advance", verifiedPaid([adv(115875)], "USD", 3.67));
    expect(resolveLoadingEligibility(AE0007 as any, paid).eligible).toBe(true);
  });
  it("a Credit bill is never held by the payment rule", () => {
    const credit = { ...AE0007, form_data: { ...AE0007.form_data, form: { paymentType: "Credit", advancePercent: 0 } } };
    const b = buildBillPayment(credit as any, [{ id: "L", loaded_quantity: 500, created_at: "2026-10-30" }], []);
    expect(b.gated).toBe(false);
    expect(loadingPaymentOk(b, "L")).toBe(true);
  });
});
