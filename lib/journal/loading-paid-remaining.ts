/**
 * Paid and outstanding figures for one purchase-booking loading on the Remaining Payment register.
 *
 * The loading's paid total is its advance share PLUS the remaining payments made against it. The outstanding figure
 * is the server's own figure (the same one the payment API enforces) when it is present; otherwise it is derived from
 * the value less the paid total. The earlier register code used only the remaining payments as "paid", so the advance
 * share was dropped and a fully advance-covered balance was shown as the full value.
 */
const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

export function loadingPaidTotal(advanceAllocated: unknown, remainingPayments: unknown): number {
  return Math.max(0, num(advanceAllocated)) + Math.max(0, num(remainingPayments));
}

export function loadingOutstanding(value: unknown, paidTotal: number, serverOutstanding: unknown): number {
  if (serverOutstanding !== null && serverOutstanding !== undefined && serverOutstanding !== "" && Number.isFinite(Number(serverOutstanding))) {
    return Math.max(0, Number(serverOutstanding));
  }
  return Math.max(0, num(value) - paidTotal);
}
