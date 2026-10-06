"use client";

import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";

/**
 * Shared "New Entry — Users — <kind>" page header. All 5 user-entry pages
 * (agent/staff/branch/country/super-admin) render the identical eyebrow +
 * title + description block — one translated component instead of 5
 * hard-coded copies (CLAUDE.md shared-solution rule).
 */
export function NewEntryUserHeader({
  titleKey,
  titleFallback,
  descKey,
  descFallback,
}: {
  titleKey: string;
  titleFallback: string;
  descKey: string;
  descFallback: string;
}) {
  const lang = useActiveLanguage();
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">{t(lang, "neu.new_entry", "New Entry")}</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">{t(lang, titleKey as never, titleFallback)}</h1>
      <p className="text-sm text-muted-foreground">{t(lang, descKey as never, descFallback)}</p>
    </div>
  );
}
