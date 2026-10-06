"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Loader2, Database } from "lucide-react";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";

/**
 * Standard ERP Table Theme Tokens & Utility Classes
 */
export const ERP_TABLE_STYLES = {
  container: "w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 transition-colors",
  scrollWrapper: "w-full overflow-x-auto custom-scrollbar",
  table: "w-full min-w-[1200px] border-collapse text-xs text-slate-800 dark:text-slate-200",
  thead: "bg-slate-50 border-b border-slate-200 dark:bg-slate-950/60 dark:border-slate-800",
  th: "h-10 px-3 py-2 text-start text-[10.5px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap select-none",
  thRight: "h-10 px-3 py-2 text-end text-[10.5px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap select-none",
  thCenter: "h-10 px-3 py-2 text-center text-[10.5px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap select-none",
  tr: "h-11 border-b border-slate-100 hover:bg-slate-50/80 transition-colors dark:border-slate-800/80 dark:hover:bg-slate-800/50 cursor-pointer",
  trStatic: "h-11 border-b border-slate-100 dark:border-slate-800/80",
  trSelected: "bg-blue-50/70 hover:bg-blue-50 dark:bg-blue-950/40 dark:hover:bg-blue-950/50 ring-1 ring-inset ring-blue-500/30",
  td: "px-3 py-2.5 whitespace-nowrap",
  tdRight: "px-3 py-2.5 text-end font-mono whitespace-nowrap",
  tdCenter: "px-3 py-2.5 text-center whitespace-nowrap",
  
  // Semantic Currency & Movement
  debit: "font-mono font-bold text-rose-600 dark:text-rose-400",
  credit: "font-mono font-bold text-emerald-600 dark:text-emerald-400",
  neutral: "font-mono text-slate-900 dark:text-slate-100",

  // Action Buttons inside table rows
  actionButton: "h-8 inline-flex items-center justify-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 shadow-2xs transition-all",
  actionPrimary: "h-8 inline-flex items-center justify-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg bg-[#0F172A] hover:bg-slate-800 text-white dark:bg-blue-600 dark:hover:bg-blue-500 shadow-xs transition-all",
  
  // Filter Toolbar uniform layout
  filterToolbar: "flex flex-wrap items-end gap-2.5 rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs dark:border-slate-800 dark:bg-slate-900 transition-colors",
  filterInput: "h-9 w-full rounded-md border border-slate-300 bg-background px-3 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-slate-400 dark:border-slate-700",
  filterSelect: "h-9 w-full rounded-md border border-slate-300 bg-background px-2.5 text-xs font-semibold text-foreground outline-none focus:ring-1 focus:ring-slate-400 dark:border-slate-700",
  filterButton: "h-9 inline-flex items-center justify-center gap-1.5 px-3.5 text-xs font-bold rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 shadow-2xs transition-all",
  filterPrimaryButton: "h-9 inline-flex items-center justify-center gap-1.5 px-4 text-xs font-bold rounded-md bg-[#0F172A] hover:bg-slate-800 text-white dark:bg-blue-600 dark:hover:bg-blue-500 shadow-xs transition-all",

  // Pagination Footer
  paginationFooter: "flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-2.5 text-xs font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"
};

/**
 * Standard Status Badge Formatter
 */
export function formatStatusBadge(status: string | undefined | null) {
  const s = String(status || "").toLowerCase().trim();
  let colorClass = "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";

  if (s.includes("post") || s.includes("final") || s.includes("complete") || s.includes("active") || s.includes("transferred") || s.includes("paid")) {
    colorClass = "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/40";
  } else if (s.includes("pend") || s.includes("partial") || s.includes("draft") || s.includes("confirm")) {
    colorClass = "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/40";
  } else if (s.includes("void") || s.includes("cancel") || s.includes("inactive") || s.includes("unpaid") || s.includes("reject")) {
    colorClass = "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800/40";
  }

  return (
    <span className={cn("inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider min-w-[70px] text-center whitespace-nowrap", colorClass)}>
      {status || "—"}
    </span>
  );
}

/**
 * Standard Table Empty State
 */
export function EmptyTableState({ message, actionLabel, onAction }: { message?: string; actionLabel?: string; onAction?: () => void }) {
  const lang = useActiveLanguage();
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center">
      <div className="h-12 w-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
        <Database className="h-6 w-6" />
      </div>
      <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{message || t(lang, "edt.no_records", "No records found matching current scope or filters.")}</p>
      <p className="text-xs text-slate-400 mt-1 max-w-sm">{t(lang, "edt.adjust_filters_hint", "Adjust your filter options or add new entries to populate this table.")}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[#0F172A] hover:bg-slate-800 text-white dark:bg-blue-600 dark:hover:bg-blue-500 px-4 py-2 text-xs font-bold shadow-sm transition-all"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

/**
 * Standard Table Loading Skeleton
 */
export function TableLoadingSkeleton({ rows = 5 }: { rows?: number; cols?: number }) {
  const lang = useActiveLanguage();
  return (
    <div className="p-4 space-y-3 animate-pulse">
      <div className="flex items-center justify-center gap-2 py-4 text-xs font-semibold text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
        <span>{t(lang, "edt.loading_records", "Loading live ERP records...")}</span>
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-9 w-full rounded-md bg-slate-100 dark:bg-slate-800/60" />
      ))}
    </div>
  );
}
