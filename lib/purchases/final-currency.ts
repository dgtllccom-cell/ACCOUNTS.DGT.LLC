/** Historical bill rate to the booking country's functional currency. Never guess an FX rate. */
export function finalCurrencyAmount(amount: number, purchaseCurrency: string, countryCurrency: string | null | undefined, exchangeRate: number | null | undefined): number | null {
  if (!Number.isFinite(amount) || !purchaseCurrency?.trim() || !countryCurrency?.trim()) return null;
  const same = purchaseCurrency.trim().toUpperCase() === countryCurrency.trim().toUpperCase();
  if (!same && (!Number.isFinite(exchangeRate) || Number(exchangeRate) <= 0)) return null;
  return Math.round((amount * (same ? 1 : Number(exchangeRate)) + Number.EPSILON) * 100) / 100;
}
