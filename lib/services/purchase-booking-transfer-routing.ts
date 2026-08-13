export type PurchaseBookingPaymentFlow = "advance" | "remaining" | "credit";

export type PurchaseBookingTransferDestination = {
  flow: PurchaseBookingPaymentFlow;
  path: string;
  currentStep: string;
  currentStepName: string;
};

/**
 * Keep the stored payment option authoritative while routing into the existing
 * Purchase Payment journals. Unknown/legacy ordinary values fail safely into
 * the remaining-payment journal rather than being misclassified as Advance.
 */
export function resolvePurchaseBookingTransferDestination(
  paymentType: unknown
): PurchaseBookingTransferDestination {
  const normalized = String(paymentType ?? "").trim().toLowerCase();

  if (normalized === "advance" || normalized === "advance payment") {
    return {
      flow: "advance",
      path: "/dashboard/journal/purchase-order-payment/advance",
      currentStep: "purchase_advance_payment",
      currentStepName: "Purchase Advance Payment"
    };
  }

  if (normalized === "credit" || normalized === "credit payment") {
    return {
      flow: "credit",
      path: "/dashboard/journal/purchase-order-payment/charges",
      currentStep: "purchase_credit_payment",
      currentStepName: "Purchase Credit Payment"
    };
  }

  return {
    flow: "remaining",
    path: "/dashboard/journal/purchase-order-payment/remaining",
    currentStep: "purchase_remaining_payment",
    currentStepName: "Purchase Payment"
  };
}

export function buildPurchaseBookingTransferUrl(
  paymentType: unknown,
  purchaseOrderNo?: string | null
): string {
  const { path } = resolvePurchaseBookingTransferDestination(paymentType);
  const orderNo = String(purchaseOrderNo ?? "").trim();
  return orderNo ? `${path}?purchaseOrderNo=${encodeURIComponent(orderNo)}` : path;
}

export function canEditTransferredPurchaseBooking(session: {
  isSuperAdmin?: boolean | null;
  roles?: string[] | null;
}): boolean {
  const roles = session.roles || [];
  return Boolean(
    session.isSuperAdmin
    || roles.includes("super_admin")
    || roles.includes("admin")
    || roles.includes("country_admin")
  );
}

export function isPurchaseBookingTransferLocked(order: {
  ledger_posting_status?: string | null;
  is_edited_since_transfer?: boolean | null;
}): boolean {
  return order.ledger_posting_status === "posted" && !order.is_edited_since_transfer;
}
