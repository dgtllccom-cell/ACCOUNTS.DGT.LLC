type BookingEditState = {
  sales_status?: string | null;
  ledger_posting_status?: string | null;
  payment_status?: string | null;
  paid_amount?: number | string | null;
  is_transferred?: boolean | null;
  workflow_state?: Record<string, unknown> | null;
  form_data?: {
    form?: Record<string, unknown>;
    workflow?: Record<string, unknown>;
    lastPaymentTrace?: Record<string, unknown>;
  } | null;
};

export function isSalesBookingEditLocked(order: BookingEditState) {
  const data = order.form_data;
  const workflow = data?.workflow;
  const status = [order.sales_status, order.ledger_posting_status, workflow?.transferStatus]
    .map(value => String(value ?? "").trim().toLowerCase());
  const payment = String(order.payment_status ?? "").trim().toLowerCase();
  return [data?.form, workflow, order.workflow_state].some(state => state?.isTransferred === true || Boolean(state?.transferredAt))
    || order.is_transferred === true
    || status.some(value => ["transferred", "finalized", "completed", "posted", "cancelled", "canceled"].includes(value))
    || ["paid", "partial", "partially_paid", "completed", "posted"].includes(payment)
    || Number(order.paid_amount) > 0
    || Boolean(workflow?.transferClaimAt || workflow?.transferPostedPaymentId || workflow?.lastRoznamchaEntryId
      || data?.lastPaymentTrace?.paymentId || data?.lastPaymentTrace?.roznamchaEntryId);
}

/** Fields that may still change on a posted / paid booking (status moves only); everything else is business content. */
export const SALES_BOOKING_STATUS_ONLY_FIELDS = new Set(["salesStatus", "deliveryStatus", "workflowState", "translations", "originalLanguage"]);

export function changesSalesBookingContent(body: Record<string, unknown>) {
  return Object.keys(body).some((key) => body[key] !== undefined && !SALES_BOOKING_STATUS_ONLY_FIELDS.has(key));
}
