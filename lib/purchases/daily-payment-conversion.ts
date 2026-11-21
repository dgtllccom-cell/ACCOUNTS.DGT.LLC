/**
 * Currency conversion for a daily payment, in one place. A payment converts the bill's currency to the country's base
 * currency ONCE, using the bill's own operator (lib/purchases/fx-operator.ts):
 *   "*"  base = amount × rate   (USD 230,000 × 3.675 = AED 845,250)
 *   "/"  base = amount ÷ rate   (PKR 20,250,000 ÷ 77.2 = AED 262,305.70)
 * The daily-payment posting used to multiply every purchase booking by its rate, so a "/" booking was posted wrong
 * and the balance check refused it. This helper is pure: it does not read or write anything.
 */
import { type FxOperator, effectiveFxRate } from "@/lib/purchases/fx-operator";

export function resolveDailyPaymentConversion(input: {
  amount: number;
  currencyCode: string;
  baseCurrency: string;
  exchangeRate: number;
  /** the bill's saved operator; only purchase bookings carry one. Other targets pass "*". */
  operator: FxOperator;
}): { isSameCurrency: boolean; effectiveExchangeRate: number; baseCurrencyAmount: number } {
  const isSameCurrency = input.currencyCode.toUpperCase() === input.baseCurrency.toUpperCase();
  if (isSameCurrency) {
    return { isSameCurrency: true, effectiveExchangeRate: 1, baseCurrencyAmount: input.amount };
  }
  const rate = Number(input.exchangeRate) > 0 ? Number(input.exchangeRate) : 1;
  const effectiveExchangeRate = effectiveFxRate(rate, input.operator);
  const baseCurrencyAmount = Math.round(input.amount * effectiveExchangeRate * 10000) / 10000;
  return { isSameCurrency: false, effectiveExchangeRate, baseCurrencyAmount };
}
