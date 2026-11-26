import { comparePurchasePaymentToLimit } from "./payment-precision";

export function isExactPurchaseAppliedAmount(amount: number) {
  return comparePurchasePaymentToLimit(amount, amount) === "allowed";
}

const currencyCode = (value: unknown) => String(value ?? "").trim().toUpperCase();

export function supportsExactPurchaseAllocation(input: {
  bookingSettlement: boolean;
  billCurrency: unknown;
  calculatorCurrency: unknown;
  tenderCurrency: unknown;
  localCurrency: unknown;
}) {
  const bill = currencyCode(input.billCurrency);
  const tender = currencyCode(input.tenderCurrency);
  const local = currencyCode(input.localCurrency);
  return input.bookingSettlement && /^[A-Z]{3}$/.test(bill) && /^[A-Z]{3}$/.test(local)
    && bill !== local && currencyCode(input.calculatorCurrency) === bill && (tender === bill || tender === local);
}

/** The calculator's bill amount is the allocation; converted tender is a separate quantity. */
export function exactPurchaseAllocation(input: {
  amount: string;
  manualRate: string;
  operator: "mul" | "div";
  billCurrency: unknown;
  tenderCurrency: unknown;
}) {
  const applied = Number(input.amount);
  const enteredRate = Number(input.manualRate);
  if (!isExactPurchaseAppliedAmount(applied) || !Number.isFinite(enteredRate) || enteredRate <= 0) return null;
  // The API always receives branch-local units per one unit of bill currency.
  const exchangeRate = input.operator === "div" ? 1 / enteredRate : enteredRate;
  const baseUnits = Math.round(applied * exchangeRate * 10_000);
  if (!Number.isFinite(exchangeRate) || exchangeRate <= 0 || !Number.isSafeInteger(baseUnits) || baseUnits <= 0) return null;
  const amountLocal = baseUnits / 10_000;
  return {
    purchaseAppliedAmount: applied,
    amount: currencyCode(input.tenderCurrency) === currencyCode(input.billCurrency) ? applied : amountLocal,
    amountLocal,
    exchangeRate,
  };
}
