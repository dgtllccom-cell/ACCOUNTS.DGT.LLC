"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { translateHeader } from "@/lib/i18n/table-headers";

type Props = {
  lang?: SupportedLanguage;
  totalCount: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions?: number[];
  className?: string;
};

const DEFAULT_PAGE_SIZES = [10, 25, 50, 100];

/**
 * ReportPagination — standard ERP report pagination footer.
 * Shows: "Showing X to Y of N entries" + Rows per page selector + page buttons.
 */
export function ReportPagination({
  lang = "en",
  totalCount,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = DEFAULT_PAGE_SIZES,
  className
}: Props) {
  const tr = (label: string) => translateHeader(lang, label);
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const from = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalCount);

  // Build visible page numbers: always show first, last, current ±1, with ellipsis
  function getPageNumbers(): (number | "...")[] {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | "...")[] = [];
    const addPage = (n: number) => { if (!pages.includes(n)) pages.push(n); };
    addPage(1);
    if (page > 3) pages.push("...");
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) addPage(i);
    if (page < totalPages - 2) pages.push("...");
    addPage(totalPages);
    return pages;
  }

  const pageNums = getPageNumbers();

  return (
    <div className={cn(
      "flex flex-col sm:flex-row items-center justify-between gap-3",
      "rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 px-5 py-3",
      className
    )}>
      {/* Entry count */}
      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap">
        {totalCount === 0
          ? tr("No entries found")
          : `${tr("Showing")} ${from} ${tr("to")} ${to} ${tr("of")} ${totalCount.toLocaleString()} ${tr("entries")}`}
      </p>

      <div className="flex items-center gap-3">
        {/* Rows per page */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap">{tr("Rows per page")}</span>
          <select
            value={pageSize}
            onChange={(e) => {
              onPageSizeChange(Number(e.target.value));
              onPageChange(1);
            }}
            className="text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 px-2 py-1 outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {pageSizeOptions.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Page buttons */}
        <div className="flex items-center gap-1">
          {/* Prev */}
          <button
            type="button"
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page <= 1}
            className={cn(
              "h-7 w-7 rounded-lg flex items-center justify-center border text-xs font-semibold transition-colors",
              page <= 1
                ? "border-slate-100 dark:border-slate-800 text-slate-300 dark:text-slate-600 cursor-not-allowed"
                : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 hover:border-indigo-300 dark:hover:border-indigo-700"
            )}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>

          {/* Page numbers */}
          {pageNums.map((p, idx) =>
            p === "..." ? (
              <span key={`ellipsis-${idx}`} className="h-7 w-7 flex items-center justify-center text-xs text-slate-400">…</span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange(p)}
                className={cn(
                  "h-7 w-7 rounded-lg flex items-center justify-center border text-xs font-semibold transition-colors",
                  p === page
                    ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                    : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 hover:border-indigo-300 dark:hover:border-indigo-700"
                )}
              >
                {p}
              </button>
            )
          )}

          {/* Next */}
          <button
            type="button"
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
            className={cn(
              "h-7 w-7 rounded-lg flex items-center justify-center border text-xs font-semibold transition-colors",
              page >= totalPages
                ? "border-slate-100 dark:border-slate-800 text-slate-300 dark:text-slate-600 cursor-not-allowed"
                : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 hover:border-indigo-300 dark:hover:border-indigo-700"
            )}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
