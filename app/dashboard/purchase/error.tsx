"use client";

import { ShoppingCart, LayoutDashboard } from "lucide-react";
import { RouteErrorBoundary } from "@/components/errors/route-error-boundary";

export default function PurchaseError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteErrorBoundary
      error={error}
      reset={reset}
      scopeKey="purchase"
      icon={ShoppingCart}
      accent="blue"
      titleKey="routeerr.purchase_title"
      titleFallback="Purchase Module Recovery Notice"
      messageKey="routeerr.purchase_message"
      messageFallback="The purchase order module encountered a temporary exception or asset loading delay. Click below to reload the order form."
      retryLabelKey="routeerr.reload_order_form"
      retryLabelFallback="Reload Order Form"
      secondaryIcon={LayoutDashboard}
    />
  );
}
