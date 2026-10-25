/**
 * Money is never added across currencies. These helpers total a list of amounts PER currency, so a report can show
 * "AED 1,000.00 · PKR 5,000.00" instead of one meaningless number.
 */
export type CurrencyTotal = { currency: string; total: number; count: number };

export function sumByCurrency<T>(rows: readonly T[], currencyOf: (row: T) => string | null | undefined, amountOf: (row: T) => number | null | undefined): CurrencyTotal[] {
  const map = new Map<string, CurrencyTotal>();
  for (const row of rows) {
    const currency = String(currencyOf(row) || "—").trim().toUpperCase() || "—";
    const amount = Number(amountOf(row) || 0);
    const hit = map.get(currency) ?? { currency, total: 0, count: 0 };
    hit.total += Number.isFinite(amount) ? amount : 0;
    hit.count += 1;
    map.set(currency, hit);
  }
  return [...map.values()]
    .map((x) => ({ ...x, total: Math.round(x.total * 100) / 100 }))
    .sort((a, b) => b.count - a.count || a.currency.localeCompare(b.currency));
}

/** "AED 1,000.00 · PKR 5,000.00" — empty list renders as an em dash. */
export function formatCurrencyTotals(totals: readonly CurrencyTotal[] | null | undefined, locale = "en-US"): string {
  if (!totals || totals.length === 0) return "—";
  return totals
    .map((t) => `${t.currency} ${t.total.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
    .join(" · ");
}

/** The single currency of a total list, or null when it is empty or mixed (callers must then show per-currency figures). */
export function singleCurrency(totals: readonly CurrencyTotal[] | null | undefined): string | null {
  return totals && totals.length === 1 ? totals[0].currency : null;
}
