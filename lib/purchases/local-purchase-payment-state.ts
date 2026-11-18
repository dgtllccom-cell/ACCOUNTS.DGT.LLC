/**
 * Paid / Partial / Pending for a Local Purchase bill — from money only.
 * A posted / accepted / completed bill is a booked liability, not a paid one: it is "Paid" only when the posted payments
 * cover its final cost (LP-JRN-00000001 was posted with AED 0 of 357,000 paid and showed "Paid 100%").
 */
export type LocalPurchasePaymentState = "Paid" | "Partial" | "Pending";

export function localPurchasePaymentState(r: Record<string, unknown>): LocalPurchasePaymentState {
  const cost = Number(r.final_cost || r.purchase_cost || 0);
  const paid = Number(r.posted_paid_amount || r.paid_amount || r.advance_amount || 0);
  if (cost > 0 && paid >= cost - 0.05) return "Paid";
  if (paid > 0.05) return "Partial";
  return "Pending";
}
