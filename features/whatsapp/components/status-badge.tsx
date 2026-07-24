"use client";

import type { ConversationStatus } from "../types";

type Props = {
  status: ConversationStatus;
  tiny?: boolean;
};

const CONFIG: Record<ConversationStatus, { label: string; cls: string }> = {
  open:     { label: "Open",     cls: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400" },
  assigned: { label: "Assigned", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  resolved: { label: "Resolved", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  spam:     { label: "Spam",     cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" }
};

export function StatusBadge({ status, tiny }: Props) {
  const cfg = CONFIG[status] ?? CONFIG.open;
  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${tiny ? "px-1.5 py-px text-[9px]" : "px-2 py-0.5 text-[10px]"} ${cfg.cls}`}
    >
      {cfg.label}
    </span>
  );
}
