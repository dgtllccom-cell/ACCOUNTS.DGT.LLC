/**
 * What a Purchase Booking transfer posted (or would have posted), in the words the owner reads on the verification
 * screen: which account was debited, which was credited, how much (base and original currency with the bill's
 * ÷ / × rate), by whom, under which Roznamcha serial. Pure: built from the posted Roznamcha lines and the two ledgers.
 */
import type { FxOperator } from "./fx-operator";

type AnyRec = Record<string, unknown>;

export type PostingSide = {
  ledgerId: string;
  code: string;
  name: string;
  /** amount in the base (local) currency, as posted in the Roznamcha line */
  amount: number;
  /** the bill's amount in its own currency */
  originalAmount: number;
  currency: string;
};

export type PostingSummary = {
  status: "posted" | "not_posted";
  roznamchaSerialNo: string | null;
  entryDate: string | null;
  postedAt: string | null;
  postedBy: { id: string | null; name: string | null };
  baseCurrency: string;
  rate: number;
  op: FxOperator;
  debit: PostingSide;
  credit: PostingSide;
  balanced: boolean;
  adjustment?: { serial: string; delta: number; currency: string };
  /** why it was not posted (status "not_posted") */
  reason?: string;
};

const num = (v: unknown) => {
  const n = Number(String(v ?? 0).replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
};

export function fmtMoney(v: number) {
  return num(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function buildPostingSummary(input: {
  status?: "posted" | "not_posted";
  lines?: AnyRec[] | null;
  debitAccount: AnyRec | null | undefined;
  creditAccount: AnyRec | null | undefined;
  /** used when there are no posted lines (planned posting) */
  plannedBaseAmount?: number;
  originalAmount: number;
  currency: string;
  baseCurrency: string;
  rate: number;
  op: FxOperator;
  roznamchaSerialNo?: string | null;
  entryDate?: string | null;
  postedAt?: string | null;
  postedBy?: { id?: string | null; name?: string | null } | null;
  reason?: string;
}): PostingSummary {
  const lines = Array.isArray(input.lines) ? input.lines : [];
  const debitId = String(input.debitAccount?.id ?? "");
  const creditId = String(input.creditAccount?.id ?? "");
  const debitLine = lines.find((l) => String(l?.ledger_id) === debitId && num(l?.debit) > 0);
  const creditLine = lines.find((l) => String(l?.ledger_id) === creditId && num(l?.credit) > 0);
  const debitAmount = debitLine ? num(debitLine.debit) : num(input.plannedBaseAmount);
  const creditAmount = creditLine ? num(creditLine.credit) : num(input.plannedBaseAmount);
  const side = (acc: AnyRec | null | undefined, amount: number): PostingSide => ({
    ledgerId: String(acc?.id ?? ""),
    code: String(acc?.code ?? ""),
    name: String(acc?.name ?? ""),
    amount,
    originalAmount: num(input.originalAmount),
    currency: input.currency,
  });
  return {
    status: input.status ?? "posted",
    roznamchaSerialNo: input.roznamchaSerialNo ?? null,
    entryDate: input.entryDate ?? null,
    postedAt: input.postedAt ?? null,
    postedBy: { id: input.postedBy?.id ?? null, name: input.postedBy?.name ?? null },
    baseCurrency: input.baseCurrency,
    rate: num(input.rate),
    op: input.op,
    debit: side(input.debitAccount, debitAmount),
    credit: side(input.creditAccount, creditAmount),
    balanced: Math.abs(debitAmount - creditAmount) < 0.005 && debitAmount > 0,
    ...(input.reason ? { reason: input.reason } : {}),
  };
}

/** Plain-figures reason when the posting engine's amount differs from the bill's saved total (nothing is posted). */
export function describePostingMismatch(input: {
  postedBase: number;
  expectedBase: number;
  originalAmount: number;
  currency: string;
  baseCurrency: string;
  rate: number;
  op: FxOperator;
}) {
  const sign = input.op === "/" ? "÷" : "×";
  const base = input.baseCurrency ? ` ${input.baseCurrency}` : "";
  return (
    `Transfer stopped — nothing was posted. The bill's total is ${fmtMoney(input.expectedBase)}${base} ` +
    `(${fmtMoney(input.originalAmount)} ${input.currency} ${sign} ${input.rate}), ` +
    `but the posting engine produced ${fmtMoney(input.postedBase)}${base}.`
  );
}

/** Sum of posted debit lines (for the mismatch message). */
export function postedDebitTotal(lines: AnyRec[] | null | undefined) {
  return (Array.isArray(lines) ? lines : []).reduce((s, l) => s + num(l?.debit), 0);
}
