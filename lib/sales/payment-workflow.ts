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
  const form = row.form_data?.form;
  const selected = salesWorkflowPayment(row.form_data?.workflow?.paymentKind) ?? salesWorkflowPayment(form?.paymentType || form?.paymentCondition);
  return posted && !settled && selected === queue;
}

/** Reviewed bookings keep receivable balances in original bill currency; receipts post in approved final currency. */
export function planSalesWorkflowReceipt(settlement: { finalCurrency?: unknown; originalAmount?: unknown; finalAmount?: unknown } | undefined,
  receipt: { currency: unknown; amount: number; paidOriginal: number; remainingOriginal: number }) {
  const currency = String(settlement?.finalCurrency ?? "").trim().toUpperCase();
  const original = Number(settlement?.originalAmount);
  const final = Number(settlement?.finalAmount);
  if (!currency || currency !== String(receipt.currency).trim().toUpperCase()
    || ![original, final, receipt.amount].every(n => Number.isFinite(n) && n > 0)
    || ![receipt.paidOriginal, receipt.remainingOriginal].every(n => Number.isFinite(n) && n >= 0)) return null;
  const tolerance = 0.01;
  if (Math.abs(receipt.paidOriginal + receipt.remainingOriginal - original) > tolerance) return null;
  const due = receipt.remainingOriginal * final / original;
  if (due <= tolerance || receipt.amount > due + tolerance) return null;
  const originalReceipt = Math.min(receipt.remainingOriginal, Math.round(receipt.amount * original / final * 10000) / 10000);
  if (originalReceipt <= 0) return null;
  return {
    currency, postingAmount: receipt.amount,
    paid: Math.round((receipt.paidOriginal + originalReceipt) * 10000) / 10000,
    remaining: Math.round(Math.max(0, receipt.remainingOriginal - originalReceipt) * 10000) / 10000,
  };
}
