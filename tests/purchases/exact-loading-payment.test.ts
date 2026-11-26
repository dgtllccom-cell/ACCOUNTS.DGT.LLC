import { expect, it } from "vitest";
import { buildBillPayment, loadingPaymentOk } from "@/lib/services/purchase-loading-payment-service";

const order = { currency_code: "USD", purchase_currency: "USD", base_currency: "AED", exchange_rate: 3.6725, order_total: 3672.5,
  total_goods_original: 1000, advance_paid: 200, remaining_paid: 200, remaining_due: 600,
  form_data: { form: { paymentType: "Advance", advancePercent: 20, totalAmount: 1000, currency: "USD" },
    goodsEntries: [{ qtyNo: 100, totalAmount: 1000 }], totals: { totalQuantity: 100, totalAmount: 1000 } } };
const loadings = [{ id: "LC-1", loaded_quantity: 50, report_payload: { totalPurchase: 500 } }];
const row = { amount: 700, base_currency_amount: 700, currency_code: "AED", loading_record_id: "LC-1", applied_purchase_amount: "200.0000" };

it("uses exact purchase-currency settlement for the specific loaded container without altering the stored tender amount", () => {
  const bill = buildBillPayment(order, loadings, [row]);
  expect(bill.byLoading.get("LC-1")).toMatchObject({ valueFC: 500, advanceAllocFC: 100, paidFC: 200, outstandingFC: 200, complete: false });
  expect(loadingPaymentOk(bill, "LC-1")).toBe(false);
  expect(row.amount).toBe(700);
  const old = buildBillPayment(order, loadings, [{ ...row, applied_purchase_amount: null }]);
  expect(old.byLoading.get("LC-1")?.paidFC).toBeCloseTo(700 / 3.6725, 4);
});
