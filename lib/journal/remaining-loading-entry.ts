/**
 * Read-only projection of the authoritative Remaining Due API. Do not calculate
 * a loading's payable amount from the whole purchase contract or from a
 * fabricated proportional price. The payment POST route uses these same
 * saved loadings and `loadedPayable` limits.
 */
export type RemainingDueLoading = {
  id: string;
  loadingNo?: string | null;
  container?: string | null;
  quantity?: number | string | null;
  grossWeightKg?: number | string | null;
  netWeightKg?: number | string | null;
  value?: number | string | null;
  advanceAllocated?: number | string | null;
  paid?: number | string | null;
  outstanding?: number | string | null;
  complete?: boolean;
};

export type RemainingDueBill = {
  id: string;
  currency?: string | null;
  exchangeRate?: number | string | null;
  loadings?: RemainingDueLoading[];
};

const number = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

/** Settled loadings must not be offered for another Remaining payment. */
export function payableRemainingLoadings(bill?: RemainingDueBill | null) {
  return (bill?.loadings ?? []).filter(
    (row) => !!row.id && !row.complete && number(row.outstanding) > 0.05
  );
}

export function remainingLoadingEntry(bill: RemainingDueBill | null | undefined, loadingId: string | null | undefined) {
  if (!loadingId || !bill) return null;
  const row = payableRemainingLoadings(bill).find((item) => String(item.id) === String(loadingId));
  if (!row) return null;
  return {
    id: String(row.id),
    loadingNo: String(row.loadingNo || row.container || row.id),
    quantity: Math.max(0, number(row.quantity)),
    grossWeightKg: row.grossWeightKg == null ? null : Math.max(0, number(row.grossWeightKg)),
    netWeightKg: row.netWeightKg == null ? null : Math.max(0, number(row.netWeightKg)),
    value: Math.max(0, number(row.value)),
    advanceAllocated: Math.max(0, number(row.advanceAllocated)),
    remainingPaid: Math.max(0, number(row.paid)),
    outstanding: Math.max(0, number(row.outstanding)),
    currency: String(bill.currency || "").toUpperCase(),
    exchangeRate: number(bill.exchangeRate) > 0 ? number(bill.exchangeRate) : null,
  };
}
