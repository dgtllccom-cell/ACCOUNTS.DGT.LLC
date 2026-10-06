"use client";

import { AlertCircle, LayoutDashboard } from "lucide-react";
import { RouteErrorBoundary } from "@/components/errors/route-error-boundary";

export default function DashboardError({
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
      scopeKey="dashboard_root"
      icon={AlertCircle}
      accent="rose"
      titleKey="routeerr.dashboard_title"
      titleFallback="Module Temporary Exception"
      messageKey="routeerr.dashboard_message"
      messageFallback="This dashboard module encountered a temporary chunk loading error during a live update. Click below to reload fresh assets."
      secondaryIcon={LayoutDashboard}
      maxAutoReloads={2}
      autoReloadWindowMs={30000}
    />
  );
}
