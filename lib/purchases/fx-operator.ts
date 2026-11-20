/**
 * A booking converts its original currency to the base (local) currency with ITS OWN operator:
 *   "*"  base = original × rate   (USD 230,000 × 3.675 = 845,250 AED — rate is AED per USD)
 *   "/"  base = original ÷ rate   (PKR 20,250,000 ÷ 77.2 = 262,305.70 AED — rate is PKR per AED)
 * The booking wizard saves the operator (form.operator, goods line `op`) and the converted total (order_total /
 * totals.grandFinal). Screens and posting must follow that operator; multiplying a "/" bill by its rate inflated
 * AE-001-0005 to 1,563,300,000 AED (20 Nov 2026).
 */

export type FxOperator = "*" | "/";

type AnyRec = Record<string, any>;

/** The operator the bill was saved with: the booking form's, else its first goods line's; "*" when none is saved. */
export function billFxOperator(formData: AnyRec | null | undefined): FxOperator {
  const fd = formData || {};
  const form = fd.form || {};
  const lines: AnyRec[] = Array.isArray(fd.goodsEntries) ? fd.goodsEntries : [];
  const raw = String(form.operator ?? lines[0]?.op ?? lines[0]?.operator ?? "*").trim();
  return raw === "/" ? "/" : "*";
}

/** The multiplier that turns the original amount into the base amount (1 / rate for a "/" bill). */
export function effectiveFxRate(rate: number, op: FxOperator): number {
  const r = Number(rate);
  if (!Number.isFinite(r) || r <= 0) return 1;
  return op === "/" ? 1 / r : r;
}

export function toBaseAmount(original: number, rate: number, op: FxOperator): number {
  return Number(original || 0) * effectiveFxRate(rate, op);
}

/**
 * Posting guard: the base amount about to be posted must equal the converted total the bill saved (within 0.5%).
 * A mismatch means the rate / operator / total disagree — the posting is stopped for reconciliation, never guessed.
 */
export function checkPostingAgainstSaved(input: {
  original: number;
  rate: number;
  op: FxOperator;
  savedBase: number | null | undefined;
  tolerance?: number;
}): { ok: boolean; computedBase: number; savedBase: number | null } {
  const computedBase = toBaseAmount(input.original, input.rate, input.op);
  const saved = Number(input.savedBase);
  if (!Number.isFinite(saved) || saved <= 0) return { ok: true, computedBase, savedBase: null }; // nothing saved to compare
  const tol = input.tolerance ?? 0.005;
  const ok = Math.abs(computedBase - saved) <= Math.max(0.05, saved * tol);
  return { ok, computedBase, savedBase: saved };
}
