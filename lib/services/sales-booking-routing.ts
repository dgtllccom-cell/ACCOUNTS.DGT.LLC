export type SalesBookingPaymentKind = "advance" | "remaining" | "credit" | "cash" | "invoice";

export type SalesBookingTransferRoute = {
  paymentKind: SalesBookingPaymentKind;
  paymentLabel: string;
  path: string;
};

function normalize(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

export function resolveSalesBookingPaymentRoute(paymentType: unknown): SalesBookingTransferRoute {
  const normalized = normalize(paymentType);

  if (normalized.includes("credit")) {
    return { paymentKind: "credit", paymentLabel: "Credit", path: "/dashboard/journal/sales-order-payment/charges" };
  }

  if (normalized.includes("final") || normalized.includes("remaining")) {
    return { paymentKind: "remaining", paymentLabel: "Final Payment", path: "/dashboard/journal/sales-order-payment/remaining" };
  }

  if (normalized.includes("cash")) {
    return { paymentKind: "cash", paymentLabel: "Cash", path: "/dashboard/journal/sales-order-payment/advance" };
  }

  if (normalized.includes("invoice")) {
    return { paymentKind: "invoice", paymentLabel: "Invoice", path: "/dashboard/journal/sales-order-payment/advance" };
  }

  return { paymentKind: "advance", paymentLabel: "Advance Payment", path: "/dashboard/journal/sales-order-payment/advance" };
}

