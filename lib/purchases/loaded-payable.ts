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

/**
 * One value per loading, in order: the loading's own exact value (priced from its real goods, quantity and weight at the contract price —
 * see lib/purchases/loading-value.ts) when it is known, otherwise its quantity share of the bill. Never more than the bill in total; and when
 * the loadings together carry the whole booked quantity the last one takes whatever is left of the bill, so the parts add up exactly.
 */
export function loadingValues(totalFC: number, totalQuantity: number, loadings: LoadingShare[]): number[] {
  const total = Math.max(0, num(totalFC));
  const qty = Math.max(0, num(totalQuantity));
  const share = (q: number) => (qty > 0 ? Math.min(1, Math.max(0, num(q)) / qty) : 0);
  const out: number[] = [];
  let used = 0;
  let loadedQ = 0;
  (loadings || []).forEach((l, i, all) => {
    loadedQ += Math.max(0, num(l.quantity));
    const left = Math.max(0, total - used);
    const exact = num(l.reportedValueFC);
    let v = Math.min(exact > 0 ? exact : total * share(l.quantity), left);
    if (i === all.length - 1 && qty > 0 && loadedQ >= qty - 1e-6) v = left;
    v = round4(v);
    out.push(v);
    used += v;
  });
  return out;
}

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
 * q out of Q booked owes  value(q) − advance × q/Q  (value(q) = the loading's own value priced from its real goods, or its share of the total when that
 * is unknown), less what was already paid as Remaining against it. Nothing is payable for goods still in the Booking stock.
 */
export function loadedPayable(i: LoadedPayableInput): LoadedPayable {
  const total = Math.max(0, num(i.orderTotalFC));
  const advance = Math.min(total, Math.max(0, num(i.advancePaidFC)));
  const loadings = i.loadings || [];
  const values = loadingValues(total, num(i.totalQuantity), loadings);
  // the advance paid belongs to the bill's value, so a loading carries the advance in proportion to its VALUE
  const advanceOn = (v: number) => (total > 0 ? advance * (v / total) : 0);
  const loadedQuantity = loadings.reduce((s, l) => s + Math.max(0, num(l.quantity)), 0);
  const loadedValue = Math.min(total, values.reduce((s, v) => s + v, 0));
  const loadedOutstandingFC = Math.max(0, round4(loadedValue - advanceOn(loadedValue) - Math.max(0, num(i.remainingPaidAllFC))));

  const at = i.loadingId ? loadings.findIndex((l) => l.id === i.loadingId) : -1;
  const loadingOutstandingFC = at >= 0 ? Math.max(0, round4(values[at] - advanceOn(values[at]) - Math.max(0, num(i.remainingPaidThisLoadingFC)))) : null;
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
  const billSettled = input.orderRemainingDueFC != null && num(input.orderRemainingDueFC) <= tol;
  const values = loadingValues(total, num(input.totalQuantity), input.loadings || []);

  const states: LoadingPaymentState[] = (input.loadings || []).map((l, idx) => {
    const valueFC = values[idx];
    const advanceAllocFC = round4(total > 0 ? advance * (valueFC / total) : 0);
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
