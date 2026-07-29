"use client";

import { useState, useMemo } from "react";
import { Search, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { t, type UiKey } from "@/lib/i18n/ui";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { cn } from "@/lib/utils";

type SortDirection = "asc" | "desc" | null;

type Column = {
  key: string;
  label: string;
  sortable?: boolean;
  align?: "left" | "right" | "center";
  format?: "date" | "currency" | "number" | "status" | "text";
  currency?: string;
  width?: string;
};

type Props = {
  lang: SupportedLanguage;
  columns: Column[];
  rows: Record<string, any>[];
  isLoading?: boolean;
  hasError?: boolean;
  currency?: string;
  searchable?: boolean;
  pageSize?: number;
  stripedRows?: boolean;
};

const STATUS_COLORS: Record<string, string> = {
  posted: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400",
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400",
  approved: "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400",
  rejected: "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400",
  cancelled: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400",
  confirmed: "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400",
  draft: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  logged: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-400"
};

function formatCell(value: any, format?: string, currency?: string): React.ReactNode {
  if (value === null || value === undefined || value === "—") {
    return <span className="text-slate-400">—</span>;
  }

  if (format === "date") {
    if (!value) return <span className="text-slate-400">—</span>;
    try {
      const d = new Date(value);
      return (
        <span className="text-xs font-mono text-slate-700 dark:text-slate-300">
          {d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
        </span>
      );
    } catch {
      return value;
    }
  }

  if (format === "currency" || format === "number") {
    const num = Number(value);
    if (isNaN(num)) return <span className="text-slate-400">—</span>;
    const formatted = new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(num);
    const isNeg = num < 0;
    return (
      <span className={cn(
        "font-mono text-sm font-bold tabular-nums",
        isNeg ? "text-rose-600 dark:text-rose-400" : "text-slate-800 dark:text-slate-200"
      )}>
        {currency && <span className="text-xs text-slate-400 mr-0.5">{currency}</span>}
        {formatted}
      </span>
    );
  }

  if (format === "status") {
    const statusKey = String(value).toLowerCase();
    const colorClass = STATUS_COLORS[statusKey] ?? "bg-slate-100 text-slate-600";
    return (
      <span className={cn("text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider", colorClass)}>
        {value}
      </span>
    );
  }

  return <span className="text-xs text-slate-700 dark:text-slate-300">{String(value)}</span>;
}

export function ReportDataTable({
  lang,
  columns,
  rows,
  isLoading,
  hasError,
  currency,
  searchable = true,
  pageSize = 50,
  stripedRows = true
}: Props) {
  const _ = (key: UiKey, fallback?: string) => t(lang, key, fallback);
  const isRTL = ["ar", "ur", "fa", "ps"].includes(lang);

  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>(null);
  const [page, setPage] = useState(1);

  const handleSort = (colKey: string) => {
    if (sortKey !== colKey) {
      setSortKey(colKey);
      setSortDir("asc");
    } else if (sortDir === "asc") {
      setSortDir("desc");
    } else {
      setSortKey(null);
      setSortDir(null);
    }
    setPage(1);
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter((row) =>
      Object.values(row).some((v) => v !== null && v !== undefined && String(v).toLowerCase().includes(q))
    );
  }, [rows, search]);

  const sorted = useMemo(() => {
    if (!sortKey || !sortDir) return filtered;
    return [...filtered].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      const cmp = typeof av === "number" && typeof bv === "number"
        ? av - bv
        : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const paged = sorted.slice((page - 1) * pageSize, page * pageSize);

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-pulse">
        <div className="h-12 bg-slate-100 dark:bg-slate-800" />
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className={cn("h-10", i % 2 === 0 ? "bg-slate-50 dark:bg-slate-900" : "bg-white dark:bg-slate-950")} />
        ))}
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="rounded-2xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/20 p-8 text-center">
        <p className="text-sm font-bold text-rose-600 dark:text-rose-400">{_("report.error")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3" dir={isRTL ? "rtl" : "ltr"}>
      {/* Search */}
      {searchable && (
        <div className="relative">
          <Search className={cn("absolute top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400", isRTL ? "right-3" : "left-3")} />
          <input
            type="text"
            placeholder={_("report.search_placeholder")}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className={cn(
              "w-full text-sm rounded-xl border border-slate-200 bg-white dark:bg-slate-950 dark:border-slate-800",
              "py-2.5 outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-200",
              "placeholder:text-slate-400",
              isRTL ? "pr-10 pl-4 text-right" : "pl-10 pr-4"
            )}
          />
        </div>
      )}

      {/* Table */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-auto shadow-sm">
        {paged.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm font-semibold text-slate-400 dark:text-slate-500">{_("report.no_data")}</p>
          </div>
        ) : (
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-900 dark:bg-slate-950">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={cn(
                      "px-4 py-3 font-black uppercase tracking-wider text-slate-100 whitespace-nowrap select-none",
                      col.sortable && "cursor-pointer hover:bg-slate-800 transition-colors",
                      col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left",
                      col.width
                    )}
                    onClick={() => col.sortable && handleSort(col.key)}
                    style={{ letterSpacing: "0.05em", fontSize: "10px" }}
                  >
                    <div className="flex items-center gap-1.5">
                      {col.label}
                      {col.sortable && (
                        <span className="text-slate-400">
                          {sortKey === col.key
                            ? sortDir === "asc"
                              ? <ChevronUp className="h-3 w-3 text-indigo-400" />
                              : <ChevronDown className="h-3 w-3 text-indigo-400" />
                            : <ChevronsUpDown className="h-3 w-3 opacity-40" />}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paged.map((row, rowIdx) => (
                <tr
                  key={rowIdx}
                  className={cn(
                    "border-b border-slate-100 dark:border-slate-800 transition-colors hover:bg-indigo-50/40 dark:hover:bg-indigo-950/10",
                    stripedRows && rowIdx % 2 === 0
                      ? "bg-white dark:bg-slate-950"
                      : "bg-slate-50/50 dark:bg-slate-900/50"
                  )}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        "px-4 py-2.5",
                        col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"
                      )}
                    >
                      {formatCell(row[col.key], col.format, col.currency ?? currency)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className={cn("flex items-center justify-between text-xs", isRTL && "flex-row-reverse")}>
          <span className="text-slate-500 dark:text-slate-400">
            {sorted.length.toLocaleString()} records — Page {page} / {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="rounded-lg border border-slate-200 px-3 py-1.5 font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              {_("ledger.prev", "Prev")}
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const p = page <= 3 ? i + 1 : page + i - 2;
              if (p < 1 || p > totalPages) return null;
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 font-bold transition-colors",
                    p === page
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800"
                  )}
                >
                  {p}
                </button>
              );
            })}
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="rounded-lg border border-slate-200 px-3 py-1.5 font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              {_("ledger.next", "Next")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Build columns from report type for automatic column inference
 */
export function getColumnsForReportType(reportType: string, lang: SupportedLanguage, currency = "USD"): Column[] {
  const _ = (key: UiKey, fallback?: string) => t(lang, key, fallback);

  const common: Column[] = [
    { key: "serial", label: _("report.col_serial"), sortable: true, width: "w-24" },
    { key: "date", label: _("report.col_date"), format: "date", sortable: true, width: "w-28" }
  ];

  switch (reportType) {
    case "ledger":
      return [
        ...common,
        { key: "account", label: _("report.col_user", "Account") },
        { key: "description", label: _("report.col_description") },
        { key: "debit", label: _("report.col_debit"), format: "currency", align: "right", currency, sortable: true },
        { key: "credit", label: _("report.col_credit"), format: "currency", align: "right", currency, sortable: true },
        { key: "balance", label: _("report.col_balance"), format: "currency", align: "right", currency, sortable: true },
        { key: "status", label: _("report.col_status"), format: "status", align: "center" }
      ];

    case "roznamcha":
    case "cash":
    case "payment":
    case "journal":
      return [
        ...common,
        { key: "narration", label: _("report.col_description") },
        { key: "debit", label: _("report.col_debit"), format: "currency", align: "right", currency, sortable: true },
        { key: "credit", label: _("report.col_credit"), format: "currency", align: "right", currency, sortable: true },
        { key: "balance", label: _("report.col_balance"), format: "currency", align: "right", currency, sortable: true },
        { key: "status", label: _("report.col_status"), format: "status", align: "center" }
      ];

    case "purchase":
    case "purchase-booking":
      return [
        ...common,
        { key: "customer", label: _("report.col_user", "Customer") },
        { key: "country", label: _("report.col_country") },
        { key: "amount", label: _("report.col_amount"), format: "currency", align: "right", currency, sortable: true },
        { key: "advance", label: _("report.kpi_total_payment", "Advance"), format: "currency", align: "right", currency },
        { key: "remaining", label: _("report.col_balance", "Remaining"), format: "currency", align: "right", currency, sortable: true },
        { key: "status", label: _("report.col_status"), format: "status", align: "center" }
      ];

    case "sales":
      return [
        ...common,
        { key: "customer", label: _("report.col_user", "Customer") },
        { key: "country", label: _("report.col_country") },
        { key: "amount", label: _("report.col_amount"), format: "currency", align: "right", currency, sortable: true },
        { key: "status", label: _("report.col_status"), format: "status", align: "center" }
      ];

    case "transfer":
      return [
        ...common,
        { key: "narration", label: _("report.col_description") },
        { key: "amount", label: _("report.col_amount"), format: "currency", align: "right", currency, sortable: true },
        { key: "currency", label: _("report.col_currency"), align: "center" },
        { key: "status", label: _("report.col_status"), format: "status", align: "center" }
      ];

    case "remaining":
      return [
        ...common,
        { key: "customer", label: _("report.col_user", "Customer") },
        { key: "totalAmount", label: _("report.col_amount"), format: "currency", align: "right", currency },
        { key: "advancePaid", label: _("report.kpi_total_payment", "Paid"), format: "currency", align: "right", currency },
        { key: "remaining", label: _("report.kpi_total_remaining"), format: "currency", align: "right", currency, sortable: true },
        { key: "status", label: _("report.col_status"), format: "status", align: "center" }
      ];

    case "loading":
      return [
        ...common,
        { key: "customer", label: _("report.col_user", "Customer") },
        { key: "vessel", label: "Vessel" },
        { key: "container", label: "Container" },
        { key: "country", label: _("report.col_country") },
        { key: "status", label: _("report.col_status"), format: "status", align: "center" }
      ];

    case "exchange-rate":
      return [
        { key: "date", label: _("report.col_date"), format: "date", sortable: true, width: "w-28" },
        { key: "fromCurrency", label: "From", align: "center" },
        { key: "toCurrency", label: "To", align: "center" },
        { key: "buyRate", label: "Buy Rate", format: "number", align: "right", sortable: true },
        { key: "sellRate", label: "Sell Rate", format: "number", align: "right", sortable: true },
        { key: "midRate", label: "Mid Rate", format: "number", align: "right", sortable: true }
      ];

    default:
      return [
        ...common,
        { key: "description", label: _("report.col_description") },
        { key: "amount", label: _("report.col_amount"), format: "currency", align: "right", currency, sortable: true },
        { key: "status", label: _("report.col_status"), format: "status", align: "center" }
      ];
  }
}
