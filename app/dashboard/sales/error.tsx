"use client";

import { CircleDollarSign, LayoutDashboard } from "lucide-react";
import { RouteErrorBoundary } from "@/components/errors/route-error-boundary";

export default function SalesError({
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
      scopeKey="sales"
      icon={CircleDollarSign}
      accent="emerald"
      titleKey="routeerr.sales_title"
      titleFallback="Sales Module Recovery Notice"
      messageKey="routeerr.sales_message"
      messageFallback="The sales booking module encountered a temporary exception. Click below to reload the sales form."
      retryLabelKey="routeerr.reload_sales_module"
      retryLabelFallback="Reload Sales Module"
      secondaryIcon={LayoutDashboard}
    />
  );
}
