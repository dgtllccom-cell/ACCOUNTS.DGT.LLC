"use client";

import type { ConversationStatus } from "../types";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";

type Props = {
  status: ConversationStatus;
  tiny?: boolean;
};

const CONFIG: Record<ConversationStatus, { labelKey: string; labelFallback: string; cls: string }> = {
  open:     { labelKey: "wa.open",     labelFallback: "Open",     cls: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400" },
  assigned: { labelKey: "wa.assigned", labelFallback: "Assigned", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  resolved: { labelKey: "wa.resolved", labelFallback: "Resolved", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  spam:     { labelKey: "wa.spam",     labelFallback: "Spam",     cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" }
};

export function StatusBadge({ status, tiny }: Props) {
  const lang = useActiveLanguage();
  const cfg = CONFIG[status] ?? CONFIG.open;
  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${tiny ? "px-1.5 py-px text-[9px]" : "px-2 py-0.5 text-[10px]"} ${cfg.cls}`}
    >
      {t(lang, cfg.labelKey as never, cfg.labelFallback)}
    </span>
  );
}
