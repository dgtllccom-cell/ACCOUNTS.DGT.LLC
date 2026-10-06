"use client";

import { AlertTriangle, SlidersHorizontal } from "lucide-react";
import { RouteErrorBoundary } from "@/components/errors/route-error-boundary";

export default function SettingsError({
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
      scopeKey="settings"
      icon={AlertTriangle}
      accent="amber"
      titleKey="routeerr.settings_title"
      titleFallback="Settings Module Recovery Notice"
      messageKey="routeerr.settings_message"
      messageFallback="The settings management module encountered a temporary server or client rendering exception. Click below to refresh the parameters."
      secondaryHref="/dashboard/settings"
      secondaryIcon={SlidersHorizontal}
      secondaryLabelKey="routeerr.all_settings"
      secondaryLabelFallback="All Settings"
    />
  );
}
