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
    return { paymentKind: "credit", paymentLabel: "Credit", path: "/dashboard/journal/sales-order-payment/credit" };
  }

  if (normalized.includes("final")) {
    return { paymentKind: "remaining", paymentLabel: "Final Payment", path: "/dashboard/journal/sales-order-payment/final" };
  }

  if (normalized.includes("remaining")) {
    return { paymentKind: "remaining", paymentLabel: "Final Payment", path: "/dashboard/journal/sales-order-payment/remaining" };
  }

  if (normalized.includes("cash")) {
    return { paymentKind: "cash", paymentLabel: "Cash", path: "/dashboard/journal/sales-order-payment/advance" };
  }

  if (normalized.includes("invoice")) {
    return { paymentKind: "invoice", paymentLabel: "Invoice", path: "/dashboard/business-edit-invoice" };
  }

  return { paymentKind: "advance", paymentLabel: "Advance Payment", path: "/dashboard/journal/sales-order-payment/advance" };
}


export function buildSalesBookingPaymentUrl(route: SalesBookingTransferRoute, billNo: string) {
  if (!billNo.trim()) return route.path;
  const key = route.paymentKind === "invoice" ? "billNo" : "salesOrderNo";
  return `${route.path}?${new URLSearchParams({ [key]: billNo })}`;
}

type SalesLoadingInput = {
  paymentType: unknown;
  ledgerStatus?: unknown;
  workflow?: Record<string, unknown> | null;
  invoiceFinalized?: boolean;
  paidAmount?: unknown;
  billAmount?: unknown;
  advancePercent?: unknown;
  needsPurchaseLot?: boolean;
};

export function salesBookingLoadingStatus(input: SalesLoadingInput) {
  const kind = resolveSalesBookingPaymentRoute(input.paymentType).paymentKind;
  const workflow = input.workflow ?? {};
  const transferred = normalize(workflow.transferStatus) === "transferred" ||
    ["posted", "transferred"].includes(normalize(input.ledgerStatus));
  if (!transferred) return "awaiting_transfer";
  if (kind === "invoice" && !input.invoiceFinalized) return "awaiting_invoice";
  if (kind === "advance" || kind === "cash") {
    const total = Number(input.billAmount);
    const paid = Number(input.paidAmount);
    const percent = kind === "cash" ? 100 : Number(input.advancePercent);
    const required = Math.round(total * percent) / 100;
    if (!(total > 0) || !(paid > 0) || (required > 0 && paid + 0.005 < required)) return "awaiting_advance";
  }
  if (input.needsPurchaseLot) return "awaiting_lot";
  return "ready";
}
