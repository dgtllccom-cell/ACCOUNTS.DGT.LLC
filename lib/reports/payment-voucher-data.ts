export type PaymentVoucherSide = { name: string; code?: string; amount: number; currency: string };
export type PostedVoucherLine = {
  ledger_id?: unknown; debit?: unknown; credit?: unknown; currency?: unknown; ledger_name?: unknown; ledger_code?: unknown;
};

/** Accept a verified pair only. Never derive one accounting side from the other or invent a currency. */
export function postedPaymentVoucherSides(lines: readonly PostedVoucherLine[] | null | undefined) {
  if (!Array.isArray(lines) || lines.length !== 2) return undefined;
  const debit = lines.find(line => Number(line.debit) > 0 && Number(line.credit) === 0);
  const credit = lines.find(line => Number(line.credit) > 0 && Number(line.debit) === 0);
  if (!debit || !credit || !debit.ledger_id || !credit.ledger_id || debit.ledger_id === credit.ledger_id) return undefined;
  const side = (line: PostedVoucherLine, amount: number): PaymentVoucherSide | undefined => {
    const name = typeof line.ledger_name === "string" ? line.ledger_name.trim() : "";
    const code = typeof line.ledger_code === "string" ? line.ledger_code.trim() : "";
    const currency = typeof line.currency === "string" ? line.currency.trim().toUpperCase() : "";
    return name && /^[A-Z]{3}$/.test(currency) && Number.isFinite(amount) && amount > 0 ? { name, code, amount, currency } : undefined;
  };
  const dr = side(debit, Number(debit.debit));
  const cr = side(credit, Number(credit.credit));
  return dr && cr && dr.currency === cr.currency && dr.amount === cr.amount ? { debit: dr, credit: cr } : undefined;
}
