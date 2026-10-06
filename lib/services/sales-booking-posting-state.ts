type SalesBookingLike = {
  ledger_posting_status?: string | null;
  payment_status?: string | null;
  payment_id?: string | null;
  roznamcha_entry_id?: string | null;
  super_admin_serial_number?: string | null;
  country_transaction_serial_number?: string | null;
  branch_transaction_serial_number?: string | null;
  form_data?: {
    workflow?: Record<string, unknown> | null;
    lastPaymentTrace?: Record<string, unknown> | null;
  } | null;
};

export type SalesBookingPostingState = {
  isComplete: boolean;
  visualStatus: "red" | "black";
  label: "RED" | "BLACK";
  reason: string;
};

function normalize(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function hasValue(value: unknown): boolean {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

export function deriveSalesBookingPostingState(row: SalesBookingLike): SalesBookingPostingState {
  const workflow = row.form_data?.workflow ?? {};
  const trace = row.form_data?.lastPaymentTrace ?? {};

  const status = normalize(row.ledger_posting_status);
  const paymentStatus = normalize(row.payment_status ?? workflow.paymentStatus);

  const paymentId = row.payment_id ?? trace.paymentId ?? workflow.lastPaymentId;
  const roznamchaEntryId = row.roznamcha_entry_id ?? trace.roznamchaEntryId ?? workflow.lastRoznamchaEntryId;
  const superAdminSerialNumber = row.super_admin_serial_number ?? trace.superAdminSerialNumber;
  const countryTransactionSerialNumber = row.country_transaction_serial_number ?? trace.countryTransactionSerialNumber;
  const branchTransactionSerialNumber = row.branch_transaction_serial_number ?? trace.branchTransactionSerialNumber;

  const hasProof = Boolean(
    hasValue(paymentId) &&
    hasValue(roznamchaEntryId) &&
    hasValue(superAdminSerialNumber) &&
    hasValue(countryTransactionSerialNumber) &&
    hasValue(branchTransactionSerialNumber)
  );

  const complete = status === "posted" && (paymentStatus === "completed" || paymentStatus === "posted") && hasProof;

  if (complete) {
    return {
      isComplete: true,
      visualStatus: "black",
      label: "BLACK",
      reason: "Canonical payment, Roznamcha, and serial proof is complete."
    };
  }

  const reason =
    status !== "posted" ? `Ledger posting status is '${row.ledger_posting_status || "pending"}'.` :
    !hasValue(paymentId) ? "Linked payment record is missing." :
    !hasValue(roznamchaEntryId) ? "Linked Roznamcha entry is missing." :
    !hasValue(superAdminSerialNumber) || !hasValue(countryTransactionSerialNumber) || !hasValue(branchTransactionSerialNumber)
      ? "One or more authoritative serials are missing."
      : "Accounting proof is incomplete.";

  return {
    isComplete: false,
    visualStatus: "red",
    label: "RED",
    reason
  };
}

