export type CustomerCurrencyBalance = {
  currency: string;
  totalReceivable: number;
  totalPayable: number;
  netPosition: number;
};

/** Original-currency balances stay separate. This is a report, never an FX posting. */
export function customerCurrencyBalances(
  sales: Array<{ currency_code?: string | null; remaining_amount?: unknown }>,
  purchases: Array<{ currency_code?: string | null; remaining_due?: unknown }>,
): CustomerCurrencyBalance[] {
  const balances = new Map<string, CustomerCurrencyBalance>();
  const row = (code?: string | null) => {
    const currency = code?.trim().toUpperCase() || "—";
    if (!balances.has(currency)) balances.set(currency, { currency, totalReceivable: 0, totalPayable: 0, netPosition: 0 });
    return balances.get(currency)!;
  };
  const amount = (value: unknown) => {
    const n = Number(value ?? 0);
    if (!Number.isFinite(n)) throw new Error("Invalid monetary balance");
    return n;
  };
  for (const sale of sales) row(sale.currency_code).totalReceivable += amount(sale.remaining_amount);
  for (const purchase of purchases) row(purchase.currency_code).totalPayable += amount(purchase.remaining_due);
  return [...balances.values()].sort((a, b) => a.currency.localeCompare(b.currency)).map((r) => ({
    ...r,
    totalReceivable: Math.round(r.totalReceivable * 10000) / 10000,
    totalPayable: Math.round(r.totalPayable * 10000) / 10000,
    netPosition: Math.round((r.totalReceivable - r.totalPayable) * 10000) / 10000,
  }));
}
