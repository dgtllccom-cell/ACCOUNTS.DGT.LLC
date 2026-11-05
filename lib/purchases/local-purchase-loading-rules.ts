/**
 * Local Purchase Loading — pure validation rules.
 *
 * These helpers intentionally do not post accounting or stock movements.
 * Eligibility must also be checked on the server against current posted
 * payments under a DB transaction before saving a physical loading entry.
 */
export type LocalPurchasePaymentMode = "advance" | "cash" | "credit" | "unknown";

export function classifyLocalPurchasePaymentMode(mode: string | null | undefined): LocalPurchasePaymentMode {
  const normalized = String(mode ?? "").trim().toLowerCase();
  if (normalized.includes("advance")) return "advance";
  if (normalized.includes("cash") || normalized.includes("bank") || normalized.includes("hawala")) return "cash";
  if (normalized.includes("credit")) return "credit";
  return "unknown";
}

export type LoadingPaymentEligibility = {
  purchaseStatus: string;
  mode: string | null | undefined;
  requiredAdvance: number;
  postedAdvance: number;
  cashPaymentPosted?: boolean;
  creditApproved?: boolean;
};

export type LoadingEligibilityResult = {
  allowed: boolean;
  reason: "READY" | "NOT_POSTED" | "ADVANCE_PENDING" | "CASH_PENDING" | "CREDIT_NOT_APPROVED" | "UNKNOWN_MODE";
  advanceOutstanding: number;
};

const validMoney = (n: number) => Number.isFinite(n) && n >= 0;

/**
 * Only posted bills qualify. Never infer actual paid money from a GL purchase
 * posting or a user-entered advance amount: postedAdvance is the amount of
 * individually posted supplier payments in the SAME purchase currency.
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
