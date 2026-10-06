"use client";

import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";

/**
 * Simple bordered note/callout section with a translated body -- same visual
 * treatment as PlaceholderScreenNotice but without its fixed "Placeholder
 * screen" prefix, for pages whose note text stands alone.
 */
export function TranslatedNoteSection({
  textKey,
  textFallback,
}: {
  textKey: string;
  textFallback: string;
}) {
  const lang = useActiveLanguage();
  return (
    <section className="rounded-lg border bg-card p-5 text-sm text-muted-foreground">
      {t(lang, textKey as never, textFallback)}
    </section>
  );
}
