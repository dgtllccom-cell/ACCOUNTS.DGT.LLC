/**
 * Local Purchase Loading — pure validation rules.
 *
 * These helpers intentionally do not post accounting or stock movements.
 * Eligibility must also be checked on the server against current posted
 * payments under a DB transaction before saving a physical loading entry.
 */
import { classifyLocalPurchaseCondition } from "@/lib/purchases/local-purchase-payment-routing";

export type LocalPurchasePaymentMode = "advance" | "cash" | "credit" | "invoice" | "final" | "unknown";

/** Loading gate class of a saved condition. Cash, Bank and Hawala are all paid in cash, so they share one gate. */
export function classifyLocalPurchasePaymentMode(mode: string | null | undefined): LocalPurchasePaymentMode {
  const category = classifyLocalPurchaseCondition(mode);
  if (category === "advance") return "advance";
  if (category === "cash" || category === "bank" || category === "hawala") return "cash";
  if (category === "credit") return "credit";
  if (category === "invoice") return "invoice";
  if (category === "final") return "final";
  return "unknown";
}

export type LoadingPaymentEligibility = {
  purchaseStatus: string;
  mode: string | null | undefined;
  /** Advance required before loading (the booked advance, not the advance paid so far). */
  requiredAdvance: number;
  /** Ledger-verified advance actually paid (posted advance payments only). */
  postedAdvance: number;
  /** Cash / Bank: at least one ledger-verified posted payment exists. The booking transfer never counts. */
  cashPaymentPosted?: boolean;
  creditApproved?: boolean;
  /** Invoice: the bill's total payable and the verified total paid. Invoice bills pay in full before they load. */
  totalPayable?: number;
  verifiedPaidTotal?: number;
};

export type LoadingEligibilityResult = {
  allowed: boolean;
  reason: "READY" | "NOT_POSTED" | "ADVANCE_PENDING" | "CASH_PENDING" | "CREDIT_NOT_APPROVED" | "INVOICE_PENDING" | "UNKNOWN_MODE";
  advanceOutstanding: number;
};

/**
 * Credit approval for loading. The approval record is the Transfer & Post review: it posts the purchase booking (status posted, with a
 * posted Roznamcha entry). No credit-limit or credit-approval table exists for purchases, so a missing booking means not approved.
 * A bill that is already loading is never failed retroactively by this check (its first entry was allowed under the same rule).
 */
export function isCreditApprovedForLoading(input: { purchaseStatus: string; bookingPosted: boolean; alreadyLoading: boolean }): boolean {
  if (input.alreadyLoading) return true;
  return input.purchaseStatus.trim().toLowerCase() === "posted" && input.bookingPosted;
}

const validMoney = (n: number) => Number.isFinite(n) && n >= 0;

/**
 * Only posted bills qualify. Never infer actual paid money from a GL purchase
 * posting or a user-entered advance amount: postedAdvance is the amount of
 * individually posted supplier payments in the SAME purchase currency.
 *
 * Gate by condition: Credit loads without an advance; Final loads straight away (its payment settles after loading);
 * Advance loads only once the booked advance is fully paid; Invoice loads only once the bill is paid in full;
 * Cash / Bank / Hawala load once a ledger-verified payment exists. Unknown conditions fail closed.
 */
export function checkLocalPurchaseLoadingEligibility(input: LoadingPaymentEligibility): LoadingEligibilityResult {
  const required = validMoney(input.requiredAdvance) ? input.requiredAdvance : Infinity;
  const paid = validMoney(input.postedAdvance) ? input.postedAdvance : 0;
  const advanceOutstanding = Number.isFinite(required) ? Math.max(0, Math.round((required - paid) * 100) / 100) : Infinity;
  if (input.purchaseStatus.trim().toLowerCase() !== "posted") {
    return { allowed: false, reason: "NOT_POSTED", advanceOutstanding };
  }
  switch (classifyLocalPurchasePaymentMode(input.mode)) {
    case "advance":
      return advanceOutstanding <= 0
        ? { allowed: true, reason: "READY", advanceOutstanding: 0 }
        : { allowed: false, reason: "ADVANCE_PENDING", advanceOutstanding };
    case "cash":
      return { allowed: Boolean(input.cashPaymentPosted), reason: input.cashPaymentPosted ? "READY" : "CASH_PENDING", advanceOutstanding };
    case "credit":
      return { allowed: Boolean(input.creditApproved), reason: input.creditApproved ? "READY" : "CREDIT_NOT_APPROVED", advanceOutstanding };
    case "invoice": {
      const total = validMoney(input.totalPayable ?? NaN) ? Number(input.totalPayable) : Infinity;
      const verified = validMoney(input.verifiedPaidTotal ?? NaN) ? Number(input.verifiedPaidTotal) : 0;
      const ready = Number.isFinite(total) && verified + 0.01 >= total;
      return { allowed: ready, reason: ready ? "READY" : "INVOICE_PENDING", advanceOutstanding };
    }
    case "final":
      return { allowed: true, reason: "READY", advanceOutstanding };
    default:
      return { allowed: false, reason: "UNKNOWN_MODE", advanceOutstanding };
  }
}

export type LocalPurchaseLoadingLine = {
  lineId: string;
  bookedQuantity: number;
  previouslyLoadedQuantity: number;
  newLoadingQuantity: number;
  bookedGrossWeightKg: number;
  bookedNetWeightKg: number;
  newGrossWeightKg: number;
  newNetWeightKg: number;
};

export type LoadingLineError = "INVALID_QUANTITY" | "OVERLOADING" | "INVALID_WEIGHT" | "OVERWEIGHT";

export function loadingLineErrors(row: LocalPurchaseLoadingLine): LoadingLineError[] {
  const errors: LoadingLineError[] = [];
  const q = [row.bookedQuantity, row.previouslyLoadedQuantity, row.newLoadingQuantity];
  if (!row.lineId || q.some((value) => !validMoney(value)) || row.newLoadingQuantity <= 0) {
    errors.push("INVALID_QUANTITY");
  } else if (row.previouslyLoadedQuantity + row.newLoadingQuantity > row.bookedQuantity + 1e-8) {
    errors.push("OVERLOADING");
  }
  const weights = [row.bookedGrossWeightKg, row.bookedNetWeightKg, row.newGrossWeightKg, row.newNetWeightKg];
  if (weights.some((value) => !validMoney(value)) || row.newNetWeightKg > row.newGrossWeightKg) {
    errors.push("INVALID_WEIGHT");
  } else if (row.newGrossWeightKg > row.bookedGrossWeightKg + 1e-8 ||
             row.newNetWeightKg > row.bookedNetWeightKg + 1e-8) {
    errors.push("OVERWEIGHT");
  }
  return errors;
}

export function remainingLocalPurchaseQuantity(booked: number, loaded: number): number {
  if (!validMoney(booked) || !validMoney(loaded)) return 0;
  return Math.max(0, Math.round((booked - loaded) * 10000) / 10000);
}
