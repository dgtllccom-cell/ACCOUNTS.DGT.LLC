"use client";

import { LayoutGrid, List } from "lucide-react";
import { useViewMode } from "@/components/layout/view-mode-store";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";
import { cn } from "@/lib/utils";

/**
 * THE Grid / List toggle (one shared component — never re-implement it per page). It renders only when the current page has a table that can be
 * shown as cards, uses logical spacing (RTL-safe) and is hidden on print.
 */
export function ViewModeToggle({ className }: { className?: string }) {
  const { mode, eligible, setMode } = useViewMode();
  const lang = useActiveLanguage();
  if (!eligible) return null;
  const grid = t(lang, "vm.grid", "Grid view");
  const list = t(lang, "vm.list", "List view");
  const btn = (active: boolean) => cn(
    "inline-flex h-7 w-8 items-center justify-center transition-colors focus-visible:outline-2 focus-visible:outline-blue-600",
    active ? "bg-blue-600 text-white" : "bg-white text-slate-500 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
  );
  return (
    <div role="group" aria-label={t(lang, "vm.switch", "Switch view")} data-testid="view-mode-toggle" className={cn("no-print inline-flex overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700", className)}>
      <button type="button" data-testid="view-grid" aria-pressed={mode === "grid"} title={grid} aria-label={grid} onClick={() => setMode("grid")} className={btn(mode === "grid")}>
        <LayoutGrid className="h-3.5 w-3.5" aria-hidden />
      </button>
      <button type="button" data-testid="view-list" aria-pressed={mode === "list"} title={list} aria-label={list} onClick={() => setMode("list")} className={cn(btn(mode === "list"), "border-s border-slate-200 dark:border-slate-700")}>
        <List className="h-3.5 w-3.5" aria-hidden />
      </button>
    </div>
  );
}
