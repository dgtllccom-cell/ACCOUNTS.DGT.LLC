"use client";

import { cn } from "@/lib/utils";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { translateHeader } from "@/lib/i18n/table-headers";

export type StatusDefinition = {
  label: string;
  color: string;
  dotColor?: string;
  textColor?: string;
};

// Standard ERP-wide status definitions
export const ERP_STATUS_COLORS: Record<string, { bg: string; text: string; border: string; dot: string; label: string }> = {
  Draft: {
    bg: "bg-slate-100 dark:bg-slate-800",
    text: "text-slate-700 dark:text-slate-300",
    border: "border-slate-200 dark:border-slate-700",
    dot: "bg-slate-400",
    label: "Draft"
  },
  Accepted: {
    bg: "bg-amber-100 dark:bg-amber-950/50",
    text: "text-amber-800 dark:text-amber-300",
    border: "border-amber-200 dark:border-amber-800",
    dot: "bg-amber-500",
    label: "Accepted (Not Transferred)"
  },
  Transferred: {
    bg: "bg-slate-900 dark:bg-slate-700",
    text: "text-white",
    border: "border-slate-800",
    dot: "bg-slate-900",
    label: "Transferred"
  },
  Completed: {
    bg: "bg-emerald-100 dark:bg-emerald-950/50",
    text: "text-emerald-800 dark:text-emerald-300",
    border: "border-emerald-200 dark:border-emerald-800",
    dot: "bg-emerald-500",
    label: "Completed"
  },
  Cancelled: {
    bg: "bg-red-100 dark:bg-red-950/50",
    text: "text-red-800 dark:text-red-300",
    border: "border-red-200 dark:border-red-800",
    dot: "bg-red-500",
    label: "Cancelled"
  },
  Pending: {
    bg: "bg-yellow-100 dark:bg-yellow-950/50",
    text: "text-yellow-800 dark:text-yellow-300",
    border: "border-yellow-200 dark:border-yellow-800",
    dot: "bg-yellow-500",
    label: "Pending"
  },
  Posted: {
    bg: "bg-emerald-100 dark:bg-emerald-950/50",
    text: "text-emerald-800 dark:text-emerald-300",
    border: "border-emerald-200 dark:border-emerald-800",
    dot: "bg-emerald-600",
    label: "Posted"
  },
  Active: {
    bg: "bg-emerald-100 dark:bg-emerald-950/50",
    text: "text-emerald-800 dark:text-emerald-300",
    border: "border-emerald-200 dark:border-emerald-800",
    dot: "bg-emerald-500",
    label: "Active"
  },
  Inactive: {
    bg: "bg-slate-100 dark:bg-slate-800",
    text: "text-slate-500 dark:text-slate-400",
    border: "border-slate-200 dark:border-slate-700",
    dot: "bg-slate-400",
    label: "Inactive"
  },
  "On Leave": {
    bg: "bg-blue-100 dark:bg-blue-950/50",
    text: "text-blue-800 dark:text-blue-300",
    border: "border-blue-200 dark:border-blue-800",
    dot: "bg-blue-500",
    label: "On Leave"
  },
  Suspended: {
    bg: "bg-orange-100 dark:bg-orange-950/50",
    text: "text-orange-800 dark:text-orange-300",
    border: "border-orange-200 dark:border-orange-800",
    dot: "bg-orange-500",
    label: "Suspended"
  },
  Approved: {
    bg: "bg-emerald-100 dark:bg-emerald-950/50",
    text: "text-emerald-800 dark:text-emerald-300",
    border: "border-emerald-200 dark:border-emerald-800",
    dot: "bg-emerald-500",
    label: "Approved"
  },
  Rejected: {
    bg: "bg-red-100 dark:bg-red-950/50",
    text: "text-red-800 dark:text-red-300",
    border: "border-red-200 dark:border-red-800",
    dot: "bg-red-500",
    label: "Rejected"
  },
  Expired: {
    bg: "bg-orange-100 dark:bg-orange-950/50",
    text: "text-orange-800 dark:text-orange-300",
    border: "border-orange-200 dark:border-orange-800",
    dot: "bg-orange-500",
    label: "Expired"
  }
};

/**
 * Returns a status badge className string for inline use in table cells.
 */
export function getStatusBadgeClass(status: string): string {
  const cfg = ERP_STATUS_COLORS[status];
  if (!cfg) return "px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";
  return cn(
    "px-2.5 py-0.5 rounded-full text-[10px] font-bold border",
    cfg.bg, cfg.text, cfg.border
  );
}

/**
 * StatusBadge — inline colored badge for a single status value.
 */
export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const cfg = ERP_STATUS_COLORS[status] ?? ERP_STATUS_COLORS["Draft"];
  return (
    <span className={cn(
      "inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap",
      cfg.bg, cfg.text, cfg.border,
      className
    )}>
      {status}
    </span>
  );
}

type ReportStatusLegendProps = {
  lang?: SupportedLanguage;
  statuses?: Array<keyof typeof ERP_STATUS_COLORS>;
  notes?: string[];
  className?: string;
};

const DEFAULT_PURCHASE_STATUSES: Array<keyof typeof ERP_STATUS_COLORS> = [
  "Draft", "Accepted", "Transferred", "Completed"
];

/**
 * ReportStatusLegend — footer section showing status color key + notes.
 */
export function ReportStatusLegend({
  lang = "en",
  statuses = DEFAULT_PURCHASE_STATUSES,
  notes,
  className
}: ReportStatusLegendProps) {
  const tr = (label: string) => translateHeader(lang, label);
  return (
    <div className={cn(
      "flex flex-col sm:flex-row gap-4 sm:gap-8 print:flex-row",
      "rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 px-5 py-4 text-[11px]",
      className
    )}>
      {/* Status Legend */}
      <div className="flex-1">
        <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
          {tr("STATUS LEGEND")}
        </p>
        <div className="flex flex-wrap gap-x-5 gap-y-1.5">
          {statuses.map((status) => {
            const cfg = ERP_STATUS_COLORS[status as string];
            if (!cfg) return null;
            return (
              <div key={status as string} className="flex items-center gap-1.5">
                <span className={cn("h-2.5 w-2.5 rounded-full flex-shrink-0", cfg.dot)} />
                <span className="text-slate-600 dark:text-slate-400 font-medium">
                  {tr(cfg.label)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Notes */}
      {notes && notes.length > 0 && (
        <div className="sm:max-w-sm">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
            {tr("NOTE")}
          </p>
          <ul className="space-y-1">
            {notes.map((note, i) => (
              <li key={i} className="text-slate-600 dark:text-slate-400 font-medium leading-snug">
                {note}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
