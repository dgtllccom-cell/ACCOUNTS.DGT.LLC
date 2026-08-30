"use client";

import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Shared, accessible empty-state for data tables / panels. Use inside a
 * full-width `<td colSpan={n}>` or a panel body. Provides consistent vertical
 * rhythm, a muted icon, a primary line and an optional secondary hint so an
 * empty result never looks like a broken or still-loading view.
 */
export function DataEmptyState({
  title = "No records found",
  hint,
  icon: Icon = Inbox,
  className,
  compact = false,
}: {
  title?: string;
  hint?: string;
  icon?: React.ElementType;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      role="status"
      className={cn(
        "flex w-full flex-col items-center justify-center gap-2 text-center",
        compact ? "py-8" : "py-12",
        className,
      )}
    >
      <span className="grid h-11 w-11 place-items-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">{title}</p>
      {hint ? <p className="max-w-xs text-xs text-slate-400 dark:text-slate-500">{hint}</p> : null}
    </div>
  );
}
