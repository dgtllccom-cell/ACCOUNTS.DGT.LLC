import { comparePurchasePaymentToLimit } from "@/lib/purchases/payment-precision";

export function purchaseBaseUnits(amount: number) {
  const units = Math.round(amount * 10_000);
  return Number.isSafeInteger(units) && units > 0 ? units : null;
}

/** Keep the manually entered bill amount and the branch-currency money movement distinct. */
export function exactBookingPaymentQuote(input: {
  applied: number;
  tender: number;
  billCurrency: string;
  tenderCurrency: string;
  baseCurrency: string;
  rateToBase: number;
}) {
  const { applied, tender, billCurrency, tenderCurrency, baseCurrency, rateToBase } = input;
  if (!baseCurrency || baseCurrency === billCurrency || !Number.isFinite(rateToBase) || rateToBase <= 0) return null;
  if (comparePurchasePaymentToLimit(applied, applied) !== "allowed") return null;
  const units = purchaseBaseUnits(applied * rateToBase);
  if (units === null) return null;
  const baseAmount = units / 10_000;
  if (tenderCurrency === billCurrency ? tender !== applied : tenderCurrency !== baseCurrency || tender !== baseAmount) {
    return null;
  }
  return { applied, baseAmount, baseCurrency, rateToBase };
}
