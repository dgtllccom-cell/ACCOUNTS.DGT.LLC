/**
 * Centralized Payment Due Tracking and Status Calculation Service
 *
 * Implements strict rules:
 * - Uses actual agreed due date. If none exists, returns null / "Due Date Not Set" (never invents one).
 * - Accurately calculates days remaining, due today, and overdue days.
 * - Determines status: Upcoming | Due Today | Overdue | Partially Paid | Fully Paid | Due Date Not Set.
 * - Categorizes purchase payments (advance, endorsement, credit, remaining, final)
 *   and sales payments (advance, credit, remaining, final).
 */

export type PaymentTrackingStatus =
  | "Upcoming"
  | "Due Today"
  | "Overdue"
  | "Partially Paid"
  | "Fully Paid"
  | "Due Date Not Set";

export interface PaymentDueTrackingResult {
  supplierOrCustomerName: string;
  billOrInvoiceNumber: string;
  totalPaymentAmount: number;
  amountPaid: number;
  outstandingBalance: number;
  agreedDueDate: string | null; // YYYY-MM-DD
  daysRemaining: number | null;
  isDueToday: boolean;
  overdueDays: number | null;
  isOverdue: boolean;
  isUpcoming: boolean;
  isFullyPaid: boolean;
  isPartiallyPaid: boolean;
  paymentStatus: PaymentTrackingStatus;
  statusBadgeVariant: "emerald" | "amber" | "rose" | "blue" | "slate";
  currency: string;
  category: "advance" | "endorsement" | "credit" | "remaining" | "final";
}

/**
 * Normalizes any date value to an ISO YYYY-MM-DD string using local calendar components.
 * Returns null if the value is empty, invalid, or absent.
 */
export function normalizeIsoDate(val: unknown): string | null {
  if (!val) return null;
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (!trimmed || trimmed === "—" || trimmed === "null" || trimmed === "undefined") return null;
    const match = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (match) {
      const y = match[1];
      const m = match[2].padStart(2, "0");
      const d = match[3].padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
  }
  const d = new Date(val as any);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Resolves the agreed payment due date from order record and form data.
 * Checks agreedDueDate, dueDate, paymentDueDate, advDueDate, remainingDueDate in order.
 * NEVER invents a date (no +30 days fallback).
 */
export function resolveAgreedDueDate(record: any, preferredKind?: "advance" | "remaining" | "credit" | "endorsement" | "final"): string | null {
  if (!record) return null;
  const form = record.form_data?.form || record.form || record;

  if (preferredKind === "advance") {
    const adv = normalizeIsoDate(
      form.advDueDate ||
      form.advancePaymentDueDate ||
      form.advancePaymentDate ||
      record.adv_payment_due_date ||
      form.agreedDueDate ||
      form.dueDate ||
      form.paymentDueDate
    );
    if (adv) return adv;
  }

  if (preferredKind === "remaining") {
    const rem = normalizeIsoDate(
      form.remainingDueDate ||
      form.remainingPaymentDueDate ||
      record.remaining_payment_due_date ||
      form.agreedDueDate ||
      form.dueDate ||
      form.paymentDueDate
    );
    if (rem) return rem;
  }

  // General resolution: agreedDueDate > paymentDueDate > dueDate > advDueDate / remainingDueDate
  const general = normalizeIsoDate(
    form.agreedDueDate ||
    form.agreedPaymentDueDate ||
    form.paymentDueDate ||
    form.dueDate ||
    record.due_date ||
    record.agreed_due_date ||
    form.advDueDate ||
    form.advancePaymentDueDate ||
    record.adv_payment_due_date ||
    form.remainingDueDate ||
    form.remainingPaymentDueDate ||
    record.remaining_payment_due_date
  );
  return general;
}

/**
 * Calculates due date metrics and status for an order or payment record.
 */
export function calculatePaymentDueTracking(params: {
  module: "purchase" | "sales";
  record: any;
  referenceDate?: string | Date;
  preferredKind?: "advance" | "remaining" | "credit" | "final";
}): PaymentDueTrackingResult {
  const { module, record, preferredKind } = params;
  const form = record?.form_data?.form || record?.form || record || {};

  // Reference date (today) in YYYY-MM-DD
  const refDateStr = normalizeIsoDate(params.referenceDate || new Date()) || new Date().toISOString().slice(0, 10);
  const refDateObj = new Date(`${refDateStr}T00:00:00Z`);

  // 1. Supplier or Customer Name
  const supplierOrCustomerName = module === "purchase"
    ? String(
        form.supplierName ||
        form.salesAccountName ||
        form.salesCompanyName ||
        form.partyName ||
        record.supplier_name ||
        record.vendor_name ||
        "Supplier"
      ).trim()
    : String(
        form.customerName ||
        form.buyerName ||
        record.customer_name ||
        form.salesAccountName ||
        "Customer"
      ).trim();

  // 2. Bill or Invoice Number
  const billOrInvoiceNumber = module === "purchase"
    ? String(
        record.purchase_order_no ? `P#${record.purchase_order_no}` :
        form.manualBillNo ||
        form.manual_bill_no ||
        form.contractNo ||
        record.manual_bill_no ||
        record.contract_no ||
        `P#${record.id ? String(record.id).slice(0, 8) : "—"}`
      ).trim()
    : String(
        record.sales_order_no ? `S#${record.sales_order_no}` :
        form.salesOrderNo ||
        form.invoiceNo ||
        form.manualReferenceNumber ||
        record.manual_reference_number ||
        `S#${record.id ? String(record.id).slice(0, 8) : "—"}`
      ).trim();

  // 3. Currency & Amounts
  const currency = String(
    record.currency_code ||
    record.currency ||
    form.currency ||
    record.purchase_currency ||
    "USD"
  ).toUpperCase();

  const totalPaymentAmount = Math.max(0, Number(
    record.order_total ??
    record.final_cost ??
    form.orderTotal ??
    form.finalCost ??
    form.totalAmount ??
    0
  ));

  const amountPaid = Math.max(0, Number(
    record.paid_amount ??
    record.advance_paid ??
    form.paidAmount ??
    form.advancePaid ??
    0
  ));

  const outstandingBalance = Math.max(0, Number(
    record.remaining_due ??
    record.remaining_amount ??
    record.remaining_balance ??
    (totalPaymentAmount - amountPaid)
  ));

  // 4. Category Classification
  const paymentTypeStr = String(
    form.paymentType ||
    form.paymentCondition ||
    record.payment_mode ||
    record.payment_kind ||
    ""
  ).toLowerCase();

  const advancePercent = Number(form.advancePercent || record.advance_percentage || 0);

  let category: "advance" | "endorsement" | "credit" | "remaining" | "final" = "advance";
  if (paymentTypeStr.includes("endorsement")) {
    category = "endorsement";
  } else if (paymentTypeStr.includes("credit")) {
    category = "credit";
  } else if (outstandingBalance <= 0.01) {
    category = "final";
  } else if (amountPaid > 0 && outstandingBalance > 0) {
    category = "remaining";
  } else if (preferredKind) {
    category = preferredKind;
  } else if (advancePercent > 0) {
    category = "advance";
  }

  // 5. Agreed Due Date Calculation
  const agreedDueDate = resolveAgreedDueDate(record, preferredKind || category);

  // 6. Days Remaining / Overdue Days / Due Today
  let daysRemaining: number | null = null;
  let overdueDays: number | null = null;
  let isDueToday = false;
  let isOverdue = false;
  let isUpcoming = false;

  if (agreedDueDate) {
    const dueObj = new Date(`${agreedDueDate}T00:00:00Z`);
    const diffTime = dueObj.getTime() - refDateObj.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      isDueToday = true;
      daysRemaining = 0;
      overdueDays = 0;
    } else if (diffDays > 0) {
      isUpcoming = true;
      daysRemaining = diffDays;
      overdueDays = 0;
    } else {
      isOverdue = true;
      overdueDays = Math.abs(diffDays);
      daysRemaining = 0;
    }
  }

  // 7. Payment Status Determination
  const isFullyPaid = outstandingBalance <= 0.01 && totalPaymentAmount > 0;
  const isPartiallyPaid = amountPaid > 0.01 && outstandingBalance > 0.01;

  let paymentStatus: PaymentTrackingStatus = "Due Date Not Set";
  let statusBadgeVariant: "emerald" | "amber" | "rose" | "blue" | "slate" = "slate";

  if (isFullyPaid) {
    paymentStatus = "Fully Paid";
    statusBadgeVariant = "emerald";
  } else if (isDueToday) {
    paymentStatus = "Due Today";
    statusBadgeVariant = "amber";
  } else if (isOverdue) {
    paymentStatus = "Overdue";
    statusBadgeVariant = "rose";
  } else if (isPartiallyPaid) {
    paymentStatus = "Partially Paid";
    statusBadgeVariant = "blue";
  } else if (isUpcoming) {
    paymentStatus = "Upcoming";
    statusBadgeVariant = "blue";
  } else {
    paymentStatus = "Due Date Not Set";
    statusBadgeVariant = "slate";
  }

  return {
    supplierOrCustomerName,
    billOrInvoiceNumber,
    totalPaymentAmount,
    amountPaid,
    outstandingBalance,
    agreedDueDate,
    daysRemaining,
    isDueToday,
    overdueDays,
    isOverdue,
    isUpcoming,
    isFullyPaid,
    isPartiallyPaid,
    paymentStatus,
    statusBadgeVariant,
    currency,
    category
  };
}
