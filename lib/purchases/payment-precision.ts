// The purchase posting and loading balance routines retain four decimals.
function purchaseUnits(amount: number) {
  const units = Math.round(amount * 10_000);
  return Number.isSafeInteger(units) ? units : NaN;
}

/** Same-currency bill or container limit; do not use for FX quotes. */
export function comparePurchasePaymentToLimit(amount: number, outstanding: number) {
  const payment = purchaseUnits(amount);
  const due = purchaseUnits(outstanding);
  if (!Number.isFinite(payment) || payment <= 0 || payment / 10_000 !== amount || !Number.isFinite(due)) return "invalid";
  if (due <= 0) return "settled";
  return payment > due ? "exceeds" : "allowed";
}

export function isPurchaseBalanceCleared(outstanding: number) {
  const units = purchaseUnits(outstanding);
  return Number.isFinite(units) && units <= 0;
}
