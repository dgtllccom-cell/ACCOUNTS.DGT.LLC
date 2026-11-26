export type SalesWorkflowPayment = "invoice" | "credit" | "cash" | "account-transfer";
export type SalesReceiptQueue = "cash" | "account-transfer";

export function salesWorkflowPayment(value: unknown): SalesWorkflowPayment | null {
  const name = String(value ?? "").trim().toLowerCase().replace(/[_-]/g, " ").replace(/\s+/g, " ");
  if (name === "invoice" || name === "invoice payment") return "invoice";
  if (name === "credit" || name === "credit payment") return "credit";
  if (name === "cash" || name === "cash payment") return "cash";
  if (["account transfer", "bank transfer", "transfer account", "transfer payment", "transfer"].includes(name)) return "account-transfer";
  return null;
}

export function salesReceiptQueue(value: unknown): SalesReceiptQueue | undefined {
  return value === "cash" || value === "account-transfer" ? value : undefined;
}

export function salesWorkflowDestination(paymentType: unknown, context: { billNo?: string | null; orderId?: string | null; local?: boolean }) {
  const payment = salesWorkflowPayment(paymentType);
  if (!payment) return null;
  const params = new URLSearchParams();
  if (payment === "invoice") {
    if (!context.orderId) return null;
    params.set("sourceId", context.orderId);
    params.set("module", context.local ? "local_sales" : "sales_booking");
    if (context.billNo) params.set("billNo", context.billNo);
    return { payment, label: "Invoice Register", href: `/dashboard/business-edit-invoice?${params}` };
  }
  if (payment === "cash" || payment === "account-transfer") params.set("payment", payment);
  if (context.billNo) params.set("salesOrderNo", context.billNo);
  const path = payment === "credit" ? "/dashboard/journal/sales-order-payment/charges" : "/dashboard/journal/sales-order-payment/advance";
  const label = payment === "credit" ? "Credit Payment / Receipt" : payment === "cash" ? "Cash Payment" : "Account Transfer";
  return { payment, label, href: params.size ? `${path}?${params}` : path };
}

export function matchesSalesReceiptQueue(row: {
  ledger_posting_status?: unknown;
  payment_status?: unknown;
  form_data?: { form?: { paymentType?: unknown; paymentCondition?: unknown }; workflow?: { paymentKind?: unknown } } | null;
}, queue: SalesReceiptQueue) {
  const posted = /^(posted|transferred)$/i.test(String(row.ledger_posting_status ?? ""));
  const settled = /^(completed|paid)$/i.test(String(row.payment_status ?? ""));
  const selected = salesReceiptPaymentKind(row);
  return posted && !settled && selected === queue;
}

type ReviewedSalesSettlement = {
  finalCurrency?: unknown; originalCurrency?: unknown; originalAmount?: unknown; finalAmount?: unknown;
  exchangeRate?: unknown; operator?: unknown;
};

export function reviewedSalesSettlement(settlement: ReviewedSalesSettlement | null | undefined) {
  const currency = String(settlement?.finalCurrency ?? "").trim().toUpperCase();
  const original = Number(settlement?.originalAmount);
  const final = Number(settlement?.finalAmount);
  if (!/^[A-Z]{3}$/.test(currency) || ![original, final].every(n => Number.isFinite(n) && n > 0)) return null;
  return { currency, original, final };
}

/** Only offer a foreign currency with a verifiable rate from the original posted bill. */
export function reviewedSalesReceiptCurrencies(settlement: ReviewedSalesSettlement | null | undefined) {
  const approved = reviewedSalesSettlement(settlement);
  if (!approved) return null;
  const original = String(settlement?.originalCurrency ?? "").trim().toUpperCase();
  const rate = Number(settlement?.exchangeRate);
  const operator = settlement?.operator === "/" ? "/" : settlement?.operator === "*" ? "*" : null;
  const originalConverted = operator === "/" ? approved.original / rate : approved.original * rate;
  const foreign: { currency: string; rate: number; operator: "*" | "/" } | null = /^[A-Z]{3}$/.test(original) && original !== approved.currency && operator &&
    Number.isFinite(rate) && rate > 0 && Math.abs(originalConverted - approved.final) <= 0.010001
    ? { currency: original, rate, operator } : null;
  return { local: approved.currency, foreign };
}

// Sales voucher amounts are stored and displayed at two decimal places.
function receiptMinorUnits(amount: number) {
  const scaled = amount * 100;
  const units = Math.round(scaled + Number.EPSILON * Math.abs(scaled));
  return Number.isSafeInteger(units) ? units : NaN;
}

export function convertReviewedSalesReceipt(settlement: ReviewedSalesSettlement | null | undefined,
  input: { currency: string; amount: number }) {
  const options = reviewedSalesReceiptCurrencies(settlement);
  if (!options || !Number.isFinite(input.amount) || input.amount <= 0) return null;
  const currency = input.currency.trim().toUpperCase();
  const rate = currency === options.local ? 1 : currency === options.foreign?.currency ? options.foreign.rate : null;
  if (rate === null) return null;
  const operator = currency === options.foreign?.currency ? options.foreign.operator : "*";
  const amount = receiptMinorUnits(operator === "/" ? input.amount / rate : input.amount * rate) / 100;
  return Number.isFinite(amount) && amount >= 0.01
    ? { amount, currency: options.local, inputAmount: input.amount, inputCurrency: currency, rate, operator } : null;
}

/** Reviewed bookings keep receivable balances in original bill currency; receipts post in approved final currency. */
export function planSalesWorkflowReceipt(settlement: ReviewedSalesSettlement | null | undefined,
  receipt: { currency: unknown; amount: number; paidOriginal: number; remainingOriginal: number }) {
  const approved = reviewedSalesSettlement(settlement);
  if (!approved || approved.currency !== String(receipt.currency).trim().toUpperCase()
    || !Number.isFinite(receipt.amount) || receipt.amount <= 0
    || ![receipt.paidOriginal, receipt.remainingOriginal].every(n => Number.isFinite(n) && n >= 0)) return null;
  const { currency, original, final } = approved;
  // Original bill balances retain their existing storage precision; compare the
  // payable amount and receipt in the posted currency's integer minor units.
  if (Math.abs(receipt.paidOriginal + receipt.remainingOriginal - original) > 0.01) return null;
  const dueUnits = receiptMinorUnits(receipt.remainingOriginal * final / original);
  const paymentUnits = receiptMinorUnits(receipt.amount);
  const postingAmount = paymentUnits / 100;
  if (!Number.isFinite(dueUnits) || dueUnits < 1 || paymentUnits < 1 || paymentUnits > dueUnits
      || postingAmount !== receipt.amount) return null;
  if (paymentUnits === dueUnits) return {
    currency, postingAmount,
    paid: Math.round((receipt.paidOriginal + receipt.remainingOriginal) * 10000) / 10000,
    remaining: 0,
  };
  const originalReceipt = Math.round(postingAmount * original / final * 10000) / 10000;
  if (originalReceipt <= 0 || originalReceipt >= receipt.remainingOriginal) return null;
  return {
    currency, postingAmount,
    paid: Math.round((receipt.paidOriginal + originalReceipt) * 10000) / 10000,
    remaining: Math.round((receipt.remainingOriginal - originalReceipt) * 10000) / 10000,
  };
}

type SalesReceiptOrder = {
  ledger_posting_status?: unknown;
  payment_status?: unknown;
  paid_amount?: unknown;
  remaining_amount?: unknown;
  form_data?: {
    form?: { paymentType?: unknown; paymentCondition?: unknown; advancePercent?: unknown };
    workflow?: { paymentKind?: unknown };
    transferTrace?: { settlement?: ReviewedSalesSettlement | null };
  } | null;
};

export function salesReceiptPaymentKind(order: SalesReceiptOrder) {
  const form = order.form_data?.form;
  return salesWorkflowPayment(order.form_data?.workflow?.paymentKind) ?? salesWorkflowPayment(form?.paymentType || form?.paymentCondition);
}

/** Advance already posted against this bill counts toward the target; it is never collected again. */
export function linkedSalesAdvanceReceipt(order: SalesReceiptOrder) {
  const payment = salesReceiptPaymentKind(order);
  if (payment || !/^(posted|transferred)$/i.test(String(order.ledger_posting_status ?? "")) ||
      /^(paid|completed)$/i.test(String(order.payment_status ?? ""))) return null;
  const approved = reviewedSalesSettlement(order.form_data?.transferTrace?.settlement);
  const percent = Number(order.form_data?.form?.advancePercent ?? 0);
  const paid = Number(order.paid_amount);
  const due = Number(order.remaining_amount);
  if (!approved || !Number.isFinite(percent) || percent <= 0 || percent > 100 ||
      !Number.isFinite(paid) || paid < 0 || !Number.isFinite(due) || due <= 0) return null;
  const outstandingOriginal = Math.min(due, approved.original * percent / 100 - paid);
  const limit = receiptMinorUnits(outstandingOriginal * approved.final / approved.original) / 100;
  return outstandingOriginal > 0 && limit >= 0.01 ? { kind: "advance", queue: undefined, limit } as const : null;
}

/** Final is a reconciliation page, not a second payment kind. */
export function linkedSalesBalanceReceipt(order: SalesReceiptOrder) {
  if (!/^(posted|transferred)$/i.test(String(order.ledger_posting_status ?? "")) ||
      /^(paid|completed)$/i.test(String(order.payment_status ?? ""))) return null;
  const due = Number(order.remaining_amount);
  if (!Number.isFinite(due) || due <= 0) return null;
  const payment = salesReceiptPaymentKind(order);
  if (payment === "cash" || payment === "account-transfer") return { kind: "remaining", queue: payment } as const;
  if (payment === "credit") return { kind: "credit", queue: undefined } as const;
  if (payment === "invoice") return { kind: "remaining", queue: undefined } as const;
  const approved = reviewedSalesSettlement(order.form_data?.transferTrace?.settlement);
  const advancePercent = Number(order.form_data?.form?.advancePercent ?? 0);
  const paid = Number(order.paid_amount ?? 0);
  if (!approved || !Number.isFinite(advancePercent) || advancePercent < 0 || advancePercent > 100 ||
      (advancePercent > 0 && (!Number.isFinite(paid) || paid + 0.01 < approved.original * advancePercent / 100))) return null;
  return { kind: "remaining", queue: undefined } as const;
}

export const SALES_RECEIPT_INVOICE_TYPES: readonly string[] = ["commercial_invoice", "export_invoice", "tax_invoice"];

export function salesInvoiceReceiptHref(invoice: { id: string; sourceId?: string; sourceTable?: string; sourceModule: string; status: string; docType: string; txnKind: string }) {
  if (invoice.txnKind !== "sales" || invoice.sourceTable !== "sales_orders" ||
      (invoice.sourceModule !== "sales_booking" && invoice.sourceModule !== "local_sales") ||
      invoice.status !== "finalized" || !SALES_RECEIPT_INVOICE_TYPES.includes(invoice.docType) ||
      !invoice.sourceId) return null;
  return `/dashboard/journal/sales-order-payment/remaining?${new URLSearchParams({
    orderId: invoice.sourceId, invoiceId: invoice.id,
  })}`;
}
