/**
 * Settlement of one local purchase from LEDGER-VERIFIED payments only (the same posted-payment rule the transfer gate uses).
 * Advance and other payments are summed separately; the balance is never negative. The payment-mode label and the stored
 * remaining_balance column are not used: a bill is cleared only when its verified payments cover the total.
 */
const num = (v: unknown): number => {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? Math.max(0, x) : 0;
};

export function localPurchaseSettlement(total: unknown, verifiedAdvance: unknown, verifiedOther: unknown) {
  const t = num(total);
  const advancePaid = num(verifiedAdvance);
  const remainingPaid = num(verifiedOther);
  const remaining = Math.max(0, t - advancePaid - remainingPaid);
  return { total: t, advancePaid, remainingPaid, paid: advancePaid + remainingPaid, remaining, cleared: t > 0 && remaining <= 0.01 };
}
