"use client";

import { UserCheck, LayoutDashboard } from "lucide-react";
import { RouteErrorBoundary } from "@/components/errors/route-error-boundary";

export default function NewEntryError({
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
      scopeKey="new_entry"
      icon={UserCheck}
      accent="indigo"
      titleKey="routeerr.new_entry_title"
      titleFallback="New Entry & Journal Report Recovery Notice"
      messageKey="routeerr.new_entry_message"
      messageFallback="This entry form or report module encountered a temporary chunk loading delay. Click below to reload fresh assets."
      secondaryIcon={LayoutDashboard}
      maxAutoReloads={3}
      autoReloadWindowMs={15000}
    />
  );
}
