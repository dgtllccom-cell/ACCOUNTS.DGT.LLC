"use client";

import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";
import type { ReactNode } from "react";

/**
 * Shared eyebrow + title + description header used by many simple dashboard
 * pages. One translated component instead of each server page hard-coding
 * its own English copy (CLAUDE.md shared-solution rule).
 */
export function DashboardPageHeader({
  eyebrowKey,
  eyebrowFallback,
  titleKey,
  titleFallback,
  descKey,
  descFallback,
  icon,
}: {
  eyebrowKey?: string;
  eyebrowFallback?: string;
  titleKey: string;
  titleFallback: string;
  descKey?: string;
  descFallback?: string;
  icon?: ReactNode;
}) {
  const lang = useActiveLanguage();
  return (
    <div>
      {eyebrowKey && eyebrowFallback ? (
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">{t(lang, eyebrowKey as never, eyebrowFallback)}</p>
      ) : null}
      <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold tracking-tight">
        {icon}
        {t(lang, titleKey as never, titleFallback)}
      </h1>
      {descKey && descFallback ? (
        <p className="text-sm text-muted-foreground mt-1">{t(lang, descKey as never, descFallback)}</p>
      ) : null}
    </div>
  );
}
