/**
 * Read-only preview of a purchase booking's Ledger Transfer (the Roznamcha DR/CR posting), shown to the user BEFORE
 * anything is posted. Pure: it only shapes what the transfer already resolved. It never writes.
 *
 * Ledger Transfer is a separate step from Booking Save and from Loading Transfer. A booking that is already posted
 * (a live booking payment with its Roznamcha entry) can never be posted again: `canPost` is false and the reason says so.
 */

export type PreviewLedger = { id: string; code: string | null; name: string | null };

export type LedgerTransferPreviewInput = {
  billNo: string;
  paymentType: string | null;
  currency: string;
  operator: "*" | "/";
  rate: number;
  /** the original-currency amount the bill carries (for example PKR 20,250,000) */
  originalAmount: number;
  /** the base-currency amount the posting computes from originalAmount and the rate */
  baseAmount: number;
  /** the base-currency total the booking saved; null when nothing was saved to compare */
  savedBase: number | null;
  debitAccount: PreviewLedger | null;
  creditAccount: PreviewLedger | null;
  existingPayment: { id: string; roznamchaEntryId: string | null } | null;
};

export type LedgerTransferPreview = {
  billNo: string;
  paymentType: string | null;
  currency: string;
  operator: "*" | "/";
  rate: number;
  originalAmount: number;
  baseAmount: number;
  savedBase: number | null;
  debit: PreviewLedger | null;
  credit: PreviewLedger | null;
  alreadyPosted: boolean;
  postedEntryId: string | null;
  canPost: boolean;
  blockers: string[];
};

const money2 = (n: number) => Math.round(n * 100) / 100;

export function buildLedgerTransferPreview(input: LedgerTransferPreviewInput): LedgerTransferPreview {
  const blockers: string[] = [];
  const alreadyPosted = Boolean(input.existingPayment);

  if (alreadyPosted) {
    blockers.push("This booking is already posted to the ledger. It cannot be posted again.");
  }
  if (!input.debitAccount || !input.creditAccount) {
    blockers.push("The Purchase (DR) or Sales/Payable (CR) ledger is not linked. Set it up on the Account Setup screen first.");
  } else if (input.debitAccount.id === input.creditAccount.id) {
    blockers.push("The DR and CR ledgers are the same. Choose two different accounts.");
  }
  if (!(input.rate > 0)) {
    blockers.push("The exchange rate is missing or zero.");
  }
  if (input.savedBase != null && Math.abs(money2(input.baseAmount) - money2(input.savedBase)) > Math.max(0.05, input.savedBase * 0.005)) {
    blockers.push("The computed base amount does not match the saved bill total. Correct the rate or amount first.");
  }

  return {
    billNo: input.billNo,
    paymentType: input.paymentType,
    currency: input.currency,
    operator: input.operator,
    rate: input.rate,
    originalAmount: money2(input.originalAmount),
    baseAmount: money2(input.baseAmount),
    savedBase: input.savedBase == null ? null : money2(input.savedBase),
    debit: input.debitAccount,
    credit: input.creditAccount,
    alreadyPosted,
    postedEntryId: input.existingPayment?.roznamchaEntryId ?? null,
    canPost: blockers.length === 0,
    blockers,
  };
}
