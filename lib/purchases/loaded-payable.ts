/**
 * Purchase payments ↔ loading: the figures the Loading gate and the Remaining Payment screen must agree on.
 *
 * Pure functions (no database), so the same rules are unit-tested and used by the Loading route, the payments route and the
 * Remaining Payment form. All amounts here are in the order's PURCHASE currency.
 *
 * Why this exists: `purchase_order_payments.amount` is stored in the PAYMENT currency (e.g. AED) — not the order's purchase currency
 * (e.g. USD). The Loading gate used to add up every payment row's `amount` (of every kind, cancelled or not, ledger-posted or not)
 * and compare the sum with a purchase-currency requirement, so an AED advance of 27 % of the requirement unlocked Loading.
 * The database's own `recalc_purchase_order_payment_totals` converts correctly; this mirrors it.
 */

export type PaymentRowLike = {
  kind?: string | null;
  status?: string | null;
  amount?: number | string | null;
  currency_code?: string | null;
  exchange_rate?: number | string | null;
  base_currency_amount?: number | string | null;
  posted_to_journal?: boolean | null;
  roznamcha_entry_id?: string | null;
  debit_ledger_id?: string | null;
  credit_ledger_id?: string | null;
  loading_record_id?: string | null;
};

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const round4 = (n: number) => Math.round(n * 10000) / 10000;

/**
 * One payment row expressed in the order's purchase currency — the same rule as the database function:
 * same currency → the amount as stored; otherwise the base-currency amount divided by the order's rate to base.
 */
export function paymentInPurchaseCurrency(
  row: Pick<PaymentRowLike, "amount" | "currency_code" | "exchange_rate" | "base_currency_amount">,
  purchaseCurrency: string,
  orderRateToBase: number
): number {
  const orderCcy = String(purchaseCurrency || "").trim().toUpperCase();
  const payCcy = String(row.currency_code || orderCcy).trim().toUpperCase();
  const amount = num(row.amount);
  if (payCcy === orderCcy) return amount;
  const rate = num(row.exchange_rate) > 0 ? num(row.exchange_rate) : 1;
  const base = row.base_currency_amount != null && row.base_currency_amount !== "" ? num(row.base_currency_amount) : amount * rate;
  const divisor = orderRateToBase > 0 ? orderRateToBase : 1;
  return round4(base / divisor);
}

/** A posted payment counts only when it is really in the ledger: journal flag, Roznamcha entry and both ledgers are set. */
export function isLedgerPosted(row: PaymentRowLike): boolean {
  return (
    String(row.status || "").toLowerCase() === "posted" &&
    row.posted_to_journal === true &&
    !!row.roznamcha_entry_id &&
    !!row.debit_ledger_id &&
    !!row.credit_ledger_id
  );
}

export type VerifiedPaid = {
  /** posted + ledger-verified ADVANCE payments */
  advanceFC: number;
  /** posted + ledger-verified advance + remaining + credit payments (a "booking" row is the accrual posting, never a payment) */
  settledFC: number;
  /** posted payment rows that are NOT fully in the ledger (not counted) */
  ledgerGaps: number;
};

export function verifiedPaid(rows: PaymentRowLike[], purchaseCurrency: string, orderRateToBase: number): VerifiedPaid {
  let advanceFC = 0;
  let settledFC = 0;
  let ledgerGaps = 0;
  for (const row of rows || []) {
    const kind = String(row.kind || "").toLowerCase();
    if (String(row.status || "").toLowerCase() !== "posted") continue;
    if (kind !== "advance" && kind !== "remaining" && kind !== "credit") continue;
    if (!isLedgerPosted(row)) {
      ledgerGaps += 1;
      continue;
    }
    const amt = paymentInPurchaseCurrency(row, purchaseCurrency, orderRateToBase);
    settledFC += amt;
    if (kind === "advance") advanceFC += amt;
  }
  return { advanceFC: round4(advanceFC), settledFC: round4(settledFC), ledgerGaps };
}

/** The paid figure the Loading gate compares with its requirement, for a given payment condition. */
export function paidForLoadingGate(condition: string, paid: VerifiedPaid): number {
  return condition === "advance" || condition === "endorsement" ? paid.advanceFC : paid.settledFC;
}

export type LoadingShare = {
  id?: string | null;
  /** quantity loaded in this loading */
  quantity: number;
  /** the loading's own recorded purchase value, when it has one (weight-priced goods are not exactly quantity-proportional) */
  reportedValueFC?: number | null;
};

export type LoadedPayableInput = {
  /** order total, purchase currency */
  orderTotalFC: number;
  /** posted advance, purchase currency */
  advancePaidFC: number;
  /** total booked quantity of the order */
  totalQuantity: number;
  /** every (non-deleted) loading of the order */
  loadings: LoadingShare[];
  /** remaining payments already posted against the whole order */
  remainingPaidAllFC: number;
  /** when a specific loading is paid: which one, and the remaining payments already posted against it */
  loadingId?: string | null;
  remainingPaidThisLoadingFC?: number;
};

export type LoadedPayable = {
  loadedQuantity: number;
  /** what is still payable for everything loaded so far */
  loadedOutstandingFC: number;
  /** what is still payable for the chosen loading (null when no loading was chosen / found) */
  loadingOutstandingFC: number | null;
};

/**
 * Remaining payable on the LOADED quantity only. The advance already paid is spread over the whole booked quantity, so a loading of
 * q out of Q booked owes  value(q) − advance × q/Q  (value(q) = the loading's share of the total, or its own recorded value when that
 * is higher), less what was already paid as Remaining against it. Nothing is payable for goods still in the Booking stock.
 */
export function loadedPayable(i: LoadedPayableInput): LoadedPayable {
  const total = Math.max(0, num(i.orderTotalFC));
  const advance = Math.min(total, Math.max(0, num(i.advancePaidFC)));
  const qty = Math.max(0, num(i.totalQuantity));
  const share = (q: number) => (qty > 0 ? Math.min(1, Math.max(0, num(q)) / qty) : 0);
  const valueOf = (l: LoadingShare) => Math.min(total, Math.max(total * share(l.quantity), Math.max(0, num(l.reportedValueFC))));
  const owes = (l: LoadingShare) => valueOf(l) - advance * share(l.quantity);

  const loadings = i.loadings || [];
  const loadedQuantity = loadings.reduce((s, l) => s + Math.max(0, num(l.quantity)), 0);
  const loadedValue = Math.min(total, loadings.reduce((s, l) => s + valueOf(l), 0));
  const loadedOutstandingFC = Math.max(0, round4(loadedValue - advance * share(loadedQuantity) - Math.max(0, num(i.remainingPaidAllFC))));

  const mine = i.loadingId ? loadings.find((l) => l.id === i.loadingId) : undefined;
  const loadingOutstandingFC = mine ? Math.max(0, round4(owes(mine) - Math.max(0, num(i.remainingPaidThisLoadingFC)))) : null;
  return { loadedQuantity, loadedOutstandingFC, loadingOutstandingFC };
}

/**
 * Advance clearance for one bill, all in the PURCHASE currency (the currency of `advance_paid` / `remaining_due`).
 * The Advance / Remaining payment screens used to take the required advance from `order_total` — which is stored in the LOCAL currency —
 * and compare it with `advance_paid` (purchase currency): a USD bill of 1,158,750 with 10 % advance (USD 115,875, fully paid) looked like
 * "AED 425,261 required, USD 115,875 paid" and never left the Advance list.
 */
export function advanceClearance(input: { totalPurchaseFC: number; advancePercent: number; advancePaidFC: number; tolerance?: number }): {
  requiredFC: number;
  paidFC: number;
  remainingFC: number;
  cleared: boolean;
} {
  const total = Math.max(0, num(input.totalPurchaseFC));
  const pct = Math.max(0, num(input.advancePercent));
  const requiredFC = round4((total * pct) / 100);
  const paidFC = Math.max(0, num(input.advancePaidFC));
  const remainingFC = Math.max(0, round4(requiredFC - paidFC));
  const tol = input.tolerance ?? 0.01;
  return { requiredFC, paidFC, remainingFC, cleared: requiredFC > 0 ? remainingFC <= tol : paidFC > 0 };
}

export type LoadingPaymentState = {
  id: string;
  quantity: number;
  /** this loading's value, its share of the advance already paid, what was paid as Remaining against it, and what is still owed */
  valueFC: number;
  advanceAllocFC: number;
  paidFC: number;
  outstandingFC: number;
  /** the loading's Remaining Payment is complete (nothing outstanding) */
  complete: boolean;
};

/**
 * One state per loading of a bill. Remaining payments are tied to their loading (`loading_record_id`); payments made before that link
 * existed (loadingId null) are applied to the loadings oldest-first so a fully paid older bill is never blocked. When the whole bill has
 * nothing left to pay, every loading is complete.
 */
export function loadingPaymentStates(input: {
  orderTotalFC: number;
  advancePaidFC: number;
  totalQuantity: number;
  /** oldest first */
  loadings: LoadingShare[];
  remainingPayments: Array<{ amountFC: number; loadingId: string | null }>;
  orderRemainingDueFC?: number | null;
  tolerance?: number;
}): LoadingPaymentState[] {
  const tol = input.tolerance ?? 0.05;
  const total = Math.max(0, num(input.orderTotalFC));
  const advance = Math.min(total, Math.max(0, num(input.advancePaidFC)));
  const qty = Math.max(0, num(input.totalQuantity));
  const share = (q: number) => (qty > 0 ? Math.min(1, Math.max(0, num(q)) / qty) : 0);
  const valueOf = (l: LoadingShare) => Math.min(total, Math.max(total * share(l.quantity), Math.max(0, num(l.reportedValueFC))));
  const billSettled = input.orderRemainingDueFC != null && num(input.orderRemainingDueFC) <= tol;

  const states: LoadingPaymentState[] = (input.loadings || []).map((l) => {
    const valueFC = round4(valueOf(l));
    const advanceAllocFC = round4(advance * share(l.quantity));
    const paidFC = round4((input.remainingPayments || []).filter((p) => p.loadingId && p.loadingId === l.id).reduce((s, p) => s + Math.max(0, num(p.amountFC)), 0));
    return { id: String(l.id ?? ""), quantity: Math.max(0, num(l.quantity)), valueFC, advanceAllocFC, paidFC, outstandingFC: 0, complete: false };
  });
  let pool = (input.remainingPayments || []).filter((p) => !p.loadingId).reduce((s, p) => s + Math.max(0, num(p.amountFC)), 0);
  for (const st of states) {
    let owed = Math.max(0, round4(st.valueFC - st.advanceAllocFC - st.paidFC));
    if (owed > 0 && pool > 0) {
      const take = Math.min(owed, pool);
      pool -= take;
      st.paidFC = round4(st.paidFC + take);
      owed = Math.max(0, round4(owed - take));
    }
    st.outstandingFC = owed;
    st.complete = billSettled || owed <= tol;
  }
  return states;
}
