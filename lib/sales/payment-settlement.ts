/** A receipt moves cash and receivables; the full booking transfer is not a receipt. */
export function configuredSalesReceipt(input: {
  amount: number;
  currency: string;
  salesCurrency: string;
  finalCurrency: string;
  rate: number;
  operator: "*" | "/";
}) {
  const { amount, currency, salesCurrency, finalCurrency, rate, operator } = input;
  const factor = salesCurrency === finalCurrency ? 1 : operator === "/" ? 1 / rate : rate;
  if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(factor) || factor <= 0 || !salesCurrency || !finalCurrency) {
    throw new Error("The receipt amount or approved Sales Booking exchange rate is invalid.");
  }
  if (currency !== salesCurrency && currency !== finalCurrency) {
    throw new Error("Use the original or final Sales Booking currency for this receipt.");
  }
  const finalAmount = Math.round((currency === finalCurrency ? amount : amount * factor) * 100) / 100;
  if (finalAmount <= 0) throw new Error("The receipt is below the minimum final-currency amount.");
  const originalAmount = Math.round((finalAmount / factor) * 10_000) / 10_000;
  return { originalAmount, finalAmount, finalCurrency };
}

export function salesReceiptBalances(
  total: number, paid: number, amount: number, kind: string, requiredAdvance: number,
  final?: { booked: number; received: number; rate: number; operator: "*" | "/"; previouslyReceived?: number },
) {
  if (![total, paid, amount, requiredAdvance].every(Number.isFinite) || total <= 0 || paid < 0 || amount <= 0 || requiredAdvance < 0) {
    throw new Error("The stored sales receipt balance or payment amount is invalid.");
  }
  const snap = (value: number) => Math.round(value * 10_000) / 10_000;
  if (final) {
    const minor = (value: number) => Math.round(value * 100);
    const factor = final.operator === "/" ? 1 / final.rate : final.rate;
    const paidMinor = minor(final.previouslyReceived ?? paid * factor);
    const remainingMinor = minor(final.booked) - paidMinor;
    const receiptMinor = minor(final.received);
    if (!Number.isFinite(factor) || factor <= 0 || !Number.isFinite(final.booked) || !Number.isFinite(final.received)
      || !Number.isFinite(paidMinor) || paidMinor < 0 || remainingMinor <= 0 || receiptMinor <= 0 || receiptMinor > remainingMinor) {
      throw new Error("Receipt amount exceeds the remaining sales receivable.");
    }
    const advanceMinor = Math.max(0, minor(requiredAdvance * factor) - paidMinor);
    if (kind === "advance" && requiredAdvance > 0 && receiptMinor > advanceMinor) {
      throw new Error("Receipt amount exceeds the remaining sales advance.");
    }
    const settles = receiptMinor === remainingMinor;
    const nextPaid = settles ? total : snap((paidMinor + receiptMinor) / 100 / factor);
    return { paid: nextPaid, remaining: settles ? 0 : Math.max(0, snap(total - nextPaid)), status: settles ? "completed" : "partial" };
  }
  const remaining = Math.max(0, snap(total - paid));
  if (remaining === 0 || snap(amount) > remaining) throw new Error("Receipt amount exceeds the remaining sales receivable.");
  const remainingAdvance = Math.max(0, snap(requiredAdvance - paid));
  if (kind === "advance" && requiredAdvance > 0 && snap(amount) > remainingAdvance) {
    throw new Error("Receipt amount exceeds the remaining sales advance.");
  }
  const nextPaid = snap(paid + amount);
  const nextRemaining = Math.max(0, snap(total - nextPaid));
  return { paid: nextPaid, remaining: nextRemaining, status: nextRemaining === 0 ? "completed" : "partial" };
}
