/**
 * Local Purchase payment condition routing: ONE table that decides which payment workflow a saved condition opens.
 *
 * The Transfer register (Payment Option column, filter, Payment action), the Payment journal deep link and the loading gate
 * all read this file, so they cannot disagree about what a bill's condition is.
 *
 * Accounting rules this module encodes:
 *  - Opening a payment workflow posts nothing. Only that workflow's own Confirm & Post creates a payment.
 *  - The purchase booking transfer (Transfer & Post, DR purchase / CR supplier payable, roznamcha_entry_id) is NEVER a paid amount.
 *  - Paid = ledger-verified POSTED payments only (the same rule as the Payment journal and the loading gate).
 */

export type LocalPurchaseConditionCategory = "advance" | "invoice" | "final" | "credit" | "cash" | "bank" | "hawala";

export const LOCAL_PURCHASE_CONDITION_CATEGORIES: readonly LocalPurchaseConditionCategory[] = [
  "advance",
  "invoice",
  "final",
  "credit",
  "cash",
  "bank",
  "hawala",
];

/** Stored payment_mode strings are "Cash (...)", "Bank Transfer (...)", "Advance (...)", "Credit (Due: ...)" or legacy labels. */
export function classifyLocalPurchaseCondition(paymentMode: unknown): LocalPurchaseConditionCategory | "unknown" {
  const full = String(paymentMode ?? "").trim().toLowerCase();
  if (!full) return "unknown";
  const base = full.split("(")[0].trim();
  const matchers: Array<[string, LocalPurchaseConditionCategory]> = [
    ["advance", "advance"],
    ["invoice", "invoice"],
    ["final", "final"],
    ["remaining", "final"],
    ["credit", "credit"],
    ["bank", "bank"],
    ["hawala", "hawala"],
    ["cash", "cash"],
  ];
  // The base label decides first ("Cash (Bank on ...)" is cash). Only when the base names nothing is the whole text read.
  for (const [needle, category] of matchers) {
    if (base.includes(needle)) return category;
  }
  for (const [needle, category] of matchers) {
    if (full.includes(needle)) return category;
  }
  return "unknown";
}

export type LocalPurchasePaymentWorkflow =
  | "advance_payment"
  | "invoice_payment"
  | "final_payment"
  | "credit_payment"
  | "cash_roznamcha"
  | "bank_roznamcha"
  | "hawala_roznamcha";

export type LocalPurchasePaymentRoute = {
  category: LocalPurchaseConditionCategory;
  workflow: LocalPurchasePaymentWorkflow;
  /** Payment journal page that records this condition's payment. */
  path: string;
  /** purchase_order_payments.kind written by that page (the Advance page writes 'advance', the Credit page 'credit', the Remaining page 'remaining'). */
  paymentKind: "advance" | "remaining" | "credit";
  /** Source preset for the Remaining page (Cash / Bank / Invoice), so the payment posts to the matching roznamcha. */
  paymentType: "cash" | "bank" | "invoice" | "transfer" | null;
  /** i18n key + English fallback for the option name shown in the register. */
  optionKey: string;
  optionFallback: string;
  /** i18n key + English fallback for the workflow the Payment action opens. */
  destinationKey: string;
  destinationFallback: string;
};

const JOURNAL = "/dashboard/journal/purchase-order-payment";

export const LOCAL_PURCHASE_PAYMENT_ROUTES: Record<LocalPurchaseConditionCategory, LocalPurchasePaymentRoute> = {
  advance: {
    category: "advance",
    workflow: "advance_payment",
    path: `${JOURNAL}/advance`,
    paymentKind: "advance",
    paymentType: null,
    optionKey: "lp.pay_opt_advance",
    optionFallback: "Advance Payment",
    destinationKey: "lp.pay_dest_advance",
    destinationFallback: "Advance Payment",
  },
  invoice: {
    category: "invoice",
    workflow: "invoice_payment",
    path: `${JOURNAL}/remaining`,
    paymentKind: "remaining",
    paymentType: "invoice",
    optionKey: "lp.pay_opt_invoice",
    optionFallback: "Invoice Payment",
    destinationKey: "lp.pay_dest_invoice",
    destinationFallback: "Invoice Payment",
  },
  final: {
    category: "final",
    workflow: "final_payment",
    path: `${JOURNAL}/remaining`,
    paymentKind: "remaining",
    paymentType: null,
    optionKey: "lp.pay_opt_final",
    optionFallback: "Final Payment",
    destinationKey: "lp.pay_dest_final",
    destinationFallback: "Final / Remaining Payment",
  },
  credit: {
    category: "credit",
    workflow: "credit_payment",
    // The Credit Payment screen is /charges (the sidebar entry). /credit is a redirect to Remaining in next.config.ts.
    path: `${JOURNAL}/charges`,
    paymentKind: "credit",
    paymentType: null,
    optionKey: "lp.pay_opt_credit",
    optionFallback: "Credit",
    destinationKey: "lp.pay_dest_credit",
    destinationFallback: "Credit Payment",
  },
  cash: {
    category: "cash",
    workflow: "cash_roznamcha",
    path: `${JOURNAL}/remaining`,
    paymentKind: "remaining",
    paymentType: "cash",
    optionKey: "lp.pay_opt_cash",
    optionFallback: "Cash",
    destinationKey: "lp.pay_dest_cash",
    destinationFallback: "Cash Roznamcha",
  },
  bank: {
    category: "bank",
    workflow: "bank_roznamcha",
    path: `${JOURNAL}/remaining`,
    paymentKind: "remaining",
    paymentType: "bank",
    optionKey: "lp.pay_opt_bank",
    optionFallback: "Bank Transfer",
    destinationKey: "lp.pay_dest_bank",
    destinationFallback: "Bank / Cheque Roznamcha",
  },
  hawala: {
    category: "hawala",
    workflow: "hawala_roznamcha",
    path: `${JOURNAL}/remaining`,
    paymentKind: "remaining",
    paymentType: "transfer",
    optionKey: "lp.pay_opt_hawala",
    optionFallback: "Hawala / Transfer",
    destinationKey: "lp.pay_dest_hawala",
    destinationFallback: "Hawala Roznamcha",
  },
};

/**
 * Payment kinds a saved condition may be paid with. The payment API refuses any other kind (an incorrect route).
 * Credit: credit page only. Advance: advance page, then the remaining balance. Invoice, Final, Cash, Bank, Hawala: remaining page.
 */
export function allowedPaymentKindsForCondition(paymentMode: unknown): Array<LocalPurchasePaymentRoute["paymentKind"]> {
  const category = classifyLocalPurchaseCondition(paymentMode);
  if (category === "credit") return ["credit"];
  if (category === "advance") return ["advance", "remaining"];
  // Unknown text reads as Cash everywhere (register, Payment action), so it is paid from the remaining page like Cash.
  return ["remaining"];
}

/** Route for a saved condition; unknown conditions read as Cash, the booking form's default (the same fallback the register always used). */
export function localPurchasePaymentRoute(paymentMode: unknown): LocalPurchasePaymentRoute {
  const category = classifyLocalPurchaseCondition(paymentMode);
  return LOCAL_PURCHASE_PAYMENT_ROUTES[category === "unknown" ? "cash" : category];
}

/** Payment journal link for one bill. The journal selects the row by its bill number (purchase_order_no), so pass that. */
export function localPurchasePaymentHref(route: LocalPurchasePaymentRoute, billNo: string): string {
  const params = new URLSearchParams();
  params.set("purchaseOrderNo", billNo);
  if (route.paymentType) params.set("paymentType", route.paymentType);
  return `${route.path}?${params.toString()}`;
}

export type VerifiedPaymentRow = {
  posted_advance_amount?: unknown;
  posted_other_amount?: unknown;
};

const money = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
};

/**
 * Ledger-verified posted payments on a bill, split the same way the Payment journal and the loading gate split them.
 * Missing columns count as zero: the booking transfer is never a payment.
 */
export function verifiedPaidOnBill(row: VerifiedPaymentRow | null | undefined): { advance: number; other: number; paid: number } {
  const advance = money(row?.posted_advance_amount);
  const other = money(row?.posted_other_amount);
  return { advance, other, paid: Math.round((advance + other) * 100) / 100 };
}

/** The advance a bill must have paid before it can load: the booked percentage of its total (advance_amount is mutated by payments). */
export function requiredAdvanceForBill(row: { final_cost?: unknown; purchase_cost?: unknown; advance_percentage?: unknown; advance_amount?: unknown }): number {
  const total = money(row.final_cost ?? row.purchase_cost);
  const pct = money(row.advance_percentage);
  if (pct > 0 && total > 0) return Math.round(total * pct) / 100;
  return money(row.advance_amount);
}

/** Total payable of a bill (final cost, falling back to purchase cost). */
export function totalPayableForBill(row: { final_cost?: unknown; purchase_cost?: unknown }): number {
  return money(row.final_cost ?? row.purchase_cost);
}
