export const roznamchaTypes = ["super_admin", "country", "branch"] as const;

export const paymentEntryTypes = [
  "cash_payment",
  "cash_receipt",
  "bank_cheque",
  "bank_deposit",
  "transfer",
  "debit",
  "credit"
] as const;

export const paymentMethods = [
  { code: "cash", name: "Cash", requiresBank: false, requiresReference: false },
  { code: "bank_cheque", name: "Bank Cheque", requiresBank: true, requiresReference: true },
  { code: "bank_deposit", name: "Bank Deposit", requiresBank: true, requiresReference: true },
  { code: "bank_transfer", name: "Bank Transfer", requiresBank: true, requiresReference: true },
  { code: "usd_cash", name: "USD Cash", requiresBank: false, requiresReference: false }
] as const;

export type RoznamchaType = (typeof roznamchaTypes)[number];
export type PaymentEntryType = (typeof paymentEntryTypes)[number];

export const roznamchaPostingSteps = [
  "Create draft Roznamcha entry",
  "Generate voucher number",
  "Add debit and credit lines",
  "Validate balanced totals",
  "Request approval when required",
  "Post journal entry",
  "Write ledger entries",
  "Update ledger balances",
  "Write audit history"
] as const;

