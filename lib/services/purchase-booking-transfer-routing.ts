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

  if (normalized.includes("endorsement")) {
    return {
      flow: "advance",
      path: "/dashboard/journal/purchase-order-payment/advance",
      currentStep: "purchase_endorsement_payment",
      currentStepName: "Purchase Endorsement Payment"
    };
  }

  if (normalized.includes("invoice")) {
    return {
      flow: "remaining",
      path: "/dashboard/purchase/purchase-loading-form",
      currentStep: "purchase_invoice_payment",
      currentStepName: "Purchase Invoice Payment"
    };
  }

  if (normalized === "advance" || normalized === "advance payment" || normalized.includes("advance")) {
    return {
      flow: "advance",
      path: "/dashboard/journal/purchase-order-payment/advance",
      currentStep: "purchase_advance_payment",
      currentStepName: "Purchase Advance Payment"
    };
  }

  if (normalized === "credit" || normalized === "credit payment" || normalized.includes("credit")) {
    return {
      flow: "credit",
      path: "/dashboard/journal/purchase-order-payment/charges",
      currentStep: "purchase_credit_payment",
      currentStepName: "Purchase Credit Payment"
    };
  }

  if (normalized.includes("cash")) {
    return {
      flow: "remaining",
      path: "/dashboard/journal/purchase-order-payment/remaining",
      currentStep: "purchase_cash_payment",
      currentStepName: "Purchase Cash Payment"
    };
  }

  return {
    flow: "remaining",
    path: "/dashboard/journal/purchase-order-payment/remaining",
    currentStep: "purchase_remaining_payment",
    currentStepName: "Purchase Final Payment"
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
