/**
 * One bill's complete money-and-quantity picture, in its PURCHASE currency, for the stock screens and for the Confirmed Stock rule:
 *   original bill → total / loaded / balance quantity → advance required / paid → remaining payments → total paid → outstanding,
 * and, per loading, what that loading is worth, the advance allocated to it, what was paid as Remaining against it and what is still owed.
 * Pure (rows in, numbers out) — the callers fetch the rows they already hold. Built on lib/purchases/loaded-payable.ts so the Loading gate,
 * the payment routes and the stock journal can never disagree.
 */
import { parseJsonish } from "@/lib/stock-journal/model";
import { resolvePaymentCondition, resolvePurchaseAmounts } from "@/lib/services/purchase-calculation-service";
import { advanceClearance, loadingPaymentStates, paymentInPurchaseCurrency, type LoadingPaymentState } from "@/lib/purchases/loaded-payable";

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export type BillPayment = {
  currency: string;
  condition: string;
  /** Advance / Endorsement bills: a loading must be fully paid before its quantity can be confirmed (Credit / Final / Invoice / Cash are not gated here) */
  gated: boolean;
  billTotal: number;
  advancePercent: number;
  advanceRequired: number;
  advancePaid: number;
  remainingPaid: number;
  totalPaid: number;
  outstanding: number;
  totalQuantity: number;
  loadedQuantity: number;
  balanceQuantity: number;
  byLoading: Map<string, LoadingPaymentState>;
};

export type BillPaymentRow = {
  currency_code?: string | null;
  purchase_currency?: string | null;
  exchange_rate?: number | string | null;
  base_currency?: string | null;
  order_total?: number | string | null;
  total_goods_original?: number | string | null;
  advance_paid?: number | string | null;
  remaining_paid?: number | string | null;
  credit_amount?: number | string | null;
  remaining_due?: number | string | null;
  form_data?: unknown;
  payment_status?: string | null;
};
export type LoadingRow = { id: string; loaded_quantity?: number | string | null; report_payload?: unknown; created_at?: unknown };
export type RemainingPaymentRow = { amount?: number | string | null; currency_code?: string | null; exchange_rate?: number | string | null; base_currency_amount?: number | string | null; loading_record_id?: string | null };

export function buildBillPayment(po: BillPaymentRow, loadingRows: LoadingRow[], remainingRows: RemainingPaymentRow[]): BillPayment {
  const formData = parseJsonish(po.form_data) || {};
  const order = { ...po, form_data: formData } as any;
  const currency = String(po.purchase_currency || po.currency_code || "USD").toUpperCase();
  const baseCurrency = String(po.base_currency || currency).toUpperCase();
  const rate = num(po.exchange_rate) > 0 ? num(po.exchange_rate) : 1;
  const rateToBase = currency === baseCurrency ? 1 : rate;

  const amounts = resolvePurchaseAmounts(order);
  const billTotal = num(po.total_goods_original) > 0 ? num(po.total_goods_original) : amounts.totalPurchaseFC;
  const form = formData.form ?? {};
  const percent = Number(form.endorsementPercent ?? form.endorsement_percent ?? form.advancePercent ?? form.advance_percent ?? 0) || 0;
  const condition = resolvePaymentCondition(order);
  const gated = condition === "advance" || condition === "endorsement";

  const advancePaid = num(po.advance_paid);
  const clearance = advanceClearance({ totalPurchaseFC: billTotal, advancePercent: percent, advancePaidFC: advancePaid });

  const ordered = [...(loadingRows || [])].sort((a, b) => new Date(String(a.created_at ?? 0)).getTime() - new Date(String(b.created_at ?? 0)).getTime());
  const shares = ordered.map((l) => {
    const payload = parseJsonish(l.report_payload) || {};
    const reported = num(payload.totalPurchase ?? payload.purchaseAmount);
    return { id: String(l.id), quantity: num(l.loaded_quantity) || num(payload.loadedQuantity), reportedValueFC: reported };
  });
  const payments = (remainingRows || []).map((p) => ({
    amountFC: paymentInPurchaseCurrency(
      { amount: p.amount, currency_code: p.currency_code, exchange_rate: p.exchange_rate, base_currency_amount: p.base_currency_amount },
      currency,
      rateToBase
    ),
    loadingId: p.loading_record_id ? String(p.loading_record_id) : null
  }));
  const states = loadingPaymentStates({
    orderTotalFC: billTotal,
    advancePaidFC: advancePaid,
    totalQuantity: amounts.totalQuantity,
    loadings: shares,
    remainingPayments: payments,
    orderRemainingDueFC: po.remaining_due == null ? null : num(po.remaining_due)
  });
  const loadedQuantity = shares.reduce((s, l) => s + l.quantity, 0);
  const remainingPaid = num(po.remaining_paid);
  return {
    currency,
    condition,
    gated,
    billTotal,
    advancePercent: percent,
    advanceRequired: clearance.requiredFC,
    advancePaid,
    remainingPaid,
    totalPaid: advancePaid + remainingPaid + num(po.credit_amount),
    outstanding: po.remaining_due == null ? Math.max(0, billTotal - advancePaid - remainingPaid - num(po.credit_amount)) : num(po.remaining_due),
    totalQuantity: amounts.totalQuantity,
    loadedQuantity,
    balanceQuantity: Math.max(0, amounts.totalQuantity - loadedQuantity),
    byLoading: new Map(states.map((s) => [s.id, s]))
  };
}

/** Is this loading's quantity free to be confirmed as far as MONEY is concerned? Ungated bills (Credit / Final / Invoice / Cash) always are. */
export function loadingPaymentOk(bill: BillPayment, loadingId: string): boolean {
  if (!bill.gated) return true;
  const st = bill.byLoading.get(loadingId);
  return !!st && st.complete;
}
