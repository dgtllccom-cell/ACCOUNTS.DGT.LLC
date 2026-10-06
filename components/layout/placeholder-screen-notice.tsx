"use client";

import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";

/**
 * Shared "not built yet" notice used by a handful of New Entry stub pages
 * (Clearing Agent, Sales & Purchase, Shipping Line) that only have their
 * header live so far. One translated component instead of 3 hard-coded
 * copies (CLAUDE.md shared-solution rule).
 */
export function PlaceholderScreenNotice({
  noteKey,
  noteFallback,
}: {
  noteKey?: string;
  noteFallback?: string;
}) {
  const lang = useActiveLanguage();
  return (
    <section className="rounded-lg border bg-card p-5 text-sm text-muted-foreground">
      {t(lang, "dph.placeholder_screen", "Placeholder screen (UI foundation).")}{" "}
      {noteKey && noteFallback ? t(lang, noteKey as never, noteFallback) : null}
    </section>
  );
}
