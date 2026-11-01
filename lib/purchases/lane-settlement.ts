import { loadingPaymentStates } from "@/lib/purchases/loaded-payable";
import { finalCurrencyAmount } from "@/lib/purchases/final-currency";

/** All sources share the same value-based allocation; receipts/payments remain in their original ledgers. */
export function laneSettlement(input: { total: number; quantity: number; currency: string; finalCurrency: string; rate: number; advance: number; paid: number; loadings: { id: string; quantity: number; value?: number }[] }) {
  const { total, quantity, advance, paid } = input;
  if ([total, quantity, advance, paid].some(n => !Number.isFinite(n) || n < 0) || advance > paid + 0.01 || paid > total + 0.01) return null;
  if (finalCurrencyAmount(total, input.currency, input.finalCurrency, input.rate) == null) return null;
  const outstanding = Math.max(0, total - paid);
  const states = loadingPaymentStates({ orderTotalFC: total, advancePaidFC: advance, totalQuantity: quantity,
    loadings: input.loadings.map(l => ({ id: l.id, quantity: l.quantity, reportedValueFC: l.value })),
    remainingPayments: [{ amountFC: Math.max(0, paid - advance), loadingId: null }], orderRemainingDueFC: outstanding });
  return { outstanding, states };
}
