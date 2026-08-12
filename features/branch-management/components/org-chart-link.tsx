"use client";

import Link from "next/link";
import { Workflow } from "lucide-react";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";

/**
 * Small translated entry-point button linking the (legacy, static-English)
 * Branch Management landing page to the new live Organization Chart.
 * Isolated as its own client component so this one link can stay reactive
 * to language switches without converting the whole legacy page to i18n.
 */
export function OrgChartLink() {
  const lang = useActiveLanguage();
  return (
    <Link
      href="/dashboard/branch-management/org-chart"
      className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
    >
      <Workflow className="h-4 w-4" aria-hidden />
      {t(lang, "nav.branch_org_chart", "Organization Chart")}
    </Link>
  );
}
