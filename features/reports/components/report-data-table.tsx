"use client";

import { useState, useMemo, useEffect } from "react";
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
  render?: (row: Record<string, any>, lang: SupportedLanguage, openRow?: (row: Record<string, any>) => void) => React.ReactNode;
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
  searchQuery?: string;
  onSearchQueryChange?: (value: string) => void;
  density?: "compact" | "comfortable";
  onRowClick?: (row: Record<string, any>) => void;
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
  stripedRows = true,
  searchQuery,
  onSearchQueryChange,
  density = "comfortable",
  onRowClick
}: Props) {
  const _ = (key: UiKey, fallback?: string) => t(lang, key, fallback);
  const isRTL = ["ar", "ur", "fa", "ps"].includes(lang);

  const [internalSearch, setInternalSearch] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>(null);
  const [page, setPage] = useState(1);
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const search = searchQuery ?? internalSearch;

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
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (q && !Object.values(row).some((v) => v !== null && v !== undefined && String(v).toLowerCase().includes(q))) return false;
      return Object.entries(columnFilters).every(([key, value]) => !value.trim() || String(row[key] ?? "").toLowerCase().includes(value.trim().toLowerCase()));
    });
  }, [rows, search, columnFilters]);

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

  useEffect(() => setPage(1), [rows, columns, columnFilters]);

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
            onChange={(e) => {
              const nextValue = e.target.value;
              if (onSearchQueryChange) {
                onSearchQueryChange(nextValue);
              } else {
                setInternalSearch(nextValue);
              }
              setPage(1);
            }}
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
              <tr className="bg-slate-100/90 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-700">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={cn(
                      "px-4 py-2.5 font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 whitespace-nowrap select-none",
                      col.sortable && "cursor-pointer hover:bg-slate-200/80 dark:hover:bg-slate-700 transition-colors",
                      col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left",
                      col.width
                    )}
                    onClick={() => col.sortable && handleSort(col.key)}
                    style={{ letterSpacing: "0.04em", fontSize: "10px" }}
                  >
                    <div className="flex items-center gap-1.5">
                      {col.label}
                      {col.sortable && (
                        <span className="text-slate-400 dark:text-slate-500">
                          {sortKey === col.key
                            ? sortDir === "asc"
                              ? <ChevronUp className="h-3 w-3 text-indigo-600 dark:text-indigo-400" />
                              : <ChevronDown className="h-3 w-3 text-indigo-600 dark:text-indigo-400" />
                            : <ChevronsUpDown className="h-3 w-3 opacity-40" />}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
              <tr className="bg-slate-50/90 dark:bg-slate-850/80 border-b border-slate-200 dark:border-slate-700">
                {columns.map((column) => (
                  <th key={`${column.key}-filter`} className="px-2 py-1.5">
                    <input
                      value={columnFilters[column.key] ?? ""}
                      onChange={(event) => setColumnFilters((current) => ({ ...current, [column.key]: event.target.value }))}
                      onClick={(event) => event.stopPropagation()}
                      placeholder={_("report.search", "Filter")}
                      aria-label={`${_("report.search", "Filter")} ${column.label}`}
                      className="w-full min-w-[70px] rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-[10px] font-medium text-slate-800 dark:text-slate-200 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 shadow-2xs transition-all"
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paged.map((row, rowIdx) => (
                <tr
                  key={String(row.id ?? row.serial ?? rowIdx)}
                  onClick={() => onRowClick?.(row)}
                  tabIndex={onRowClick ? 0 : undefined}
                  onKeyDown={(event) => {
                    if (onRowClick && (event.key === "Enter" || event.key === " ")) onRowClick(row);
                  }}
                  className={cn(
                    "border-b border-slate-100 dark:border-slate-800 transition-colors hover:bg-indigo-50/40 dark:hover:bg-indigo-950/10",
                    onRowClick && "cursor-pointer focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500",
                    stripedRows && rowIdx % 2 === 0
                      ? "bg-white dark:bg-slate-950"
                      : "bg-slate-50/50 dark:bg-slate-900/50"
                  )}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        density === "compact" ? "px-3 py-1.5" : "px-4 py-2.5",
                        col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"
                      )}
                    >
                      {col.render ? col.render(row, lang, onRowClick) : formatCell(row[col.key], col.format, col.currency ?? currency)}
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
        { key: "reference", label: _("report.col_reference"), sortable: true },
        { key: "date", label: _("report.col_date"), format: "date", sortable: true },
        { key: "accountNumber", label: _("report.col_serial", "Account No.") },
        { key: "account", label: _("report.col_user", "Account / Ledger") },
        { key: "description", label: _("report.col_description") },
        { key: "opening", label: _("report.col_opening" as UiKey, "Opening"), format: "currency", align: "right", currency },
        { key: "debit", label: _("report.col_debit"), format: "currency", align: "right", currency, sortable: true },
        { key: "credit", label: _("report.col_credit"), format: "currency", align: "right", currency, sortable: true },
        { key: "closing", label: _("report.col_closing" as UiKey, "Closing"), format: "currency", align: "right", currency, sortable: true },
        { key: "branch", label: _("report.col_branch") },
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

    case "bills":
      return [
        { key: "recordType", label: _("report.col_type" as UiKey, "Type") },
        { key: "reference", label: _("report.col_reference"), sortable: true },
        { key: "date", label: _("report.col_date"), format: "date", sortable: true },
        { key: "party", label: _("report.col_party" as UiKey, "Party") },
        { key: "project", label: _("report.filter_project" as UiKey, "Project") },
        { key: "amount", label: _("report.col_amount"), format: "currency", align: "right", currency, sortable: true },
        { key: "paid", label: _("report.col_paid" as UiKey, "Paid"), format: "currency", align: "right", currency },
        { key: "outstanding", label: _("report.col_outstanding" as UiKey, "Outstanding"), format: "currency", align: "right", currency, sortable: true },
        { key: "postingStatus", label: _("report.col_posting_status" as UiKey, "Posting") , format: "status", align: "center" },
        { key: "status", label: _("report.col_status"), format: "status", align: "center" }
      ];

    case "payments":
      return [
        { key: "recordType", label: _("report.col_type" as UiKey, "Source") },
        { key: "reference", label: _("report.col_reference"), sortable: true },
        { key: "date", label: _("report.col_date"), format: "date", sortable: true },
        { key: "paymentType", label: _("report.col_payment_type" as UiKey, "Payment Type") },
        { key: "description", label: _("report.col_description") },
        { key: "debit", label: _("report.col_debit"), format: "currency", align: "right", currency },
        { key: "credit", label: _("report.col_credit"), format: "currency", align: "right", currency },
        { key: "amount", label: _("report.col_amount"), format: "currency", align: "right", currency, sortable: true },
        { key: "postingStatus", label: _("report.col_posting_status" as UiKey, "Journal / Roznamcha"), format: "status", align: "center" },
        { key: "status", label: _("report.col_status"), format: "status", align: "center" }
      ];

    case "purchase":
    case "purchase-booking":
      return [
        { key: "reference", label: _("report.col_reference"), sortable: true },
        { key: "date", label: _("report.col_date"), format: "date", sortable: true },
        { key: "party", label: _("report.col_party" as UiKey, "Supplier") },
        { key: "project", label: _("report.filter_project" as UiKey, "Project") },
        { key: "amount", label: _("report.col_amount"), format: "currency", align: "right", currency, sortable: true },
        { key: "paid", label: _("report.col_paid" as UiKey, "Advance / Paid"), format: "currency", align: "right", currency },
        { key: "outstanding", label: _("report.col_outstanding" as UiKey, "Outstanding"), format: "currency", align: "right", currency, sortable: true },
        { key: "postingStatus", label: _("report.col_posting_status" as UiKey, "Posting"), format: "status", align: "center" },
        { key: "status", label: _("report.col_status"), format: "status", align: "center" }
      ];

    case "sales":
      return [
        { key: "reference", label: _("report.col_reference"), sortable: true },
        { key: "date", label: _("report.col_date"), format: "date", sortable: true },
        { key: "party", label: _("report.col_party" as UiKey, "Customer") },
        { key: "project", label: _("report.filter_project" as UiKey, "Project") },
        { key: "amount", label: _("report.col_amount"), format: "currency", align: "right", currency, sortable: true },
        { key: "paid", label: _("report.col_paid" as UiKey, "Paid"), format: "currency", align: "right", currency },
        { key: "outstanding", label: _("report.col_outstanding" as UiKey, "Outstanding"), format: "currency", align: "right", currency, sortable: true },
        { key: "postingStatus", label: _("report.col_posting_status" as UiKey, "Posting"), format: "status", align: "center" },
        { key: "status", label: _("report.col_status"), format: "status", align: "center" }
      ];

    case "user-activity":
      return [
        { key: "date", label: _("report.col_date"), format: "date", sortable: true },
        { key: "user", label: _("report.col_user") },
        { key: "action", label: _("report.col_action" as UiKey, "Action") },
        { key: "resource", label: _("report.col_resource" as UiKey, "Resource") },
        { key: "reference", label: _("report.col_reference") },
        { key: "description", label: _("report.col_description") },
        { key: "ip", label: _("report.col_ip" as UiKey, "IP Address") },
        { key: "status", label: _("report.col_status"), format: "status", align: "center" }
      ];

    case "employee":
      return [
        { key: "reference", label: _("report.col_serial", "Employee Code") },
        { key: "employee", label: _("report.employee" as UiKey, "Employee") },
        { key: "department", label: _("report.col_department" as UiKey, "Department") },
        { key: "designation", label: _("report.col_designation" as UiKey, "Designation") },
        { key: "employmentType", label: _("report.col_type" as UiKey, "Employment Type") },
        { key: "joiningDate", label: _("report.col_joining_date" as UiKey, "Joining Date"), format: "date" },
        { key: "basicSalary", label: _("report.col_basic_salary" as UiKey, "Basic Salary"), format: "currency", align: "right", currency },
        { key: "allowance", label: _("report.col_allowance" as UiKey, "Allowance"), format: "currency", align: "right", currency },
        { key: "deduction", label: _("report.col_deduction" as UiKey, "Deduction"), format: "currency", align: "right", currency },
        { key: "netSalary", label: _("report.col_net_salary" as UiKey, "Net Salary"), format: "currency", align: "right", currency },
        { key: "status", label: _("report.col_status"), format: "status", align: "center" }
      ];

    case "branch":
      return [
        { key: "reference", label: _("report.col_serial", "Branch Code") },
        { key: "branch", label: _("report.col_branch") },
        { key: "branchType", label: _("report.col_type" as UiKey, "Branch Type") },
        { key: "country", label: _("report.col_country") },
        { key: "city", label: _("report.col_city" as UiKey, "City") },
        { key: "currency", label: _("report.col_currency") },
        { key: "createdAt", label: _("report.col_created" as UiKey, "Created"), format: "date" },
        { key: "status", label: _("report.col_status"), format: "status", align: "center" }
      ];

    case "project":
      return [
        { key: "project", label: _("report.project" as UiKey, "Project") },
        { key: "records", label: _("report.kpi_total_records"), format: "number", align: "right" },
        { key: "purchase", label: _("report.purchase"), format: "currency", align: "right", currency },
        { key: "sales", label: _("report.sales"), format: "currency", align: "right", currency },
        { key: "paid", label: _("report.col_paid" as UiKey, "Paid"), format: "currency", align: "right", currency },
        { key: "outstanding", label: _("report.col_outstanding" as UiKey, "Outstanding"), format: "currency", align: "right", currency },
        { key: "currency", label: _("report.col_currency") },
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

    case "edit-history":
      return [
        { key: "module", label: _("report.col_module" as UiKey, "Module"), sortable: true },
        { key: "reference", label: _("report.col_entry_reference" as UiKey, "Entry No. / Reference"), sortable: true },
        { key: "country", label: _("report.col_country") },
        { key: "mainBranch", label: _("report.col_main_branch" as UiKey, "Main Branch") },
        { key: "cityBranch", label: _("report.col_city_branch" as UiKey, "City Branch") },
        { key: "user", label: _("report.col_user") },
        { key: "editCount", label: _("report.col_edit_count" as UiKey, "Edit Count"), format: "number", align: "right", sortable: true },
        { key: "lastEdited", label: _("report.col_last_edited" as UiKey, "Last Edited"), format: "date", sortable: true },
        {
          key: "history",
          label: _("report.col_history" as UiKey, "History [+]"),
          align: "center",
          render: (row, _lang, openRow) => (
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-indigo-700 hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-300"
              onClick={(event) => {
                event.stopPropagation();
                openRow?.(row);
              }}
            >
              History +{String(row.editCount ?? 0)}
            </button>
          )
        }
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

    case "receipts":
      return [
        ...common,
        { key: "voucherNo", label: _("report.col_reference", "Voucher No.") },
        { key: "narration", label: _("report.col_description") },
        { key: "amount", label: _("report.col_amount"), format: "currency", align: "right", currency, sortable: true },
        { key: "currency", label: _("report.col_currency"), align: "center" },
        { key: "status", label: _("report.col_status"), format: "status", align: "center" }
      ];

    case "customer-accounts":
      return [
        { key: "serial", label: _("report.col_serial", "Code"), sortable: true },
        { key: "customer", label: _("report.col_party" as UiKey, "Customer / Account Name"), sortable: true },
        { key: "contactPerson", label: _("report.col_user", "Contact Person") },
        { key: "phone", label: "Phone" },
        { key: "email", label: "Email" },
        { key: "country", label: _("report.col_country") },
        { key: "date", label: _("report.col_created" as UiKey, "Registered"), format: "date", sortable: true },
        { key: "status", label: _("report.col_status"), format: "status", align: "center" }
      ];

    case "customer-companies":
      return [
        { key: "serial", label: _("report.col_serial", "Reg No."), sortable: true },
        { key: "company", label: "Company Name", sortable: true },
        { key: "regNo", label: "Registration No." },
        { key: "taxNo", label: "Tax / NTN No." },
        { key: "country", label: _("report.col_country") },
        { key: "date", label: _("report.col_created" as UiKey, "Registered"), format: "date", sortable: true },
        { key: "status", label: _("report.col_status"), format: "status", align: "center" }
      ];

    case "branch-transactions":
      return [
        { key: "serial", label: _("report.col_serial", "Journal No."), sortable: true },
        { key: "date", label: _("report.col_date"), format: "date", sortable: true },
        { key: "voucherNo", label: "Voucher No." },
        { key: "type", label: _("report.col_type" as UiKey, "Type"), align: "center" },
        { key: "narration", label: _("report.col_description") },
        { key: "debit", label: _("report.col_debit"), format: "currency", align: "right", currency },
        { key: "credit", label: _("report.col_credit"), format: "currency", align: "right", currency },
        { key: "amount", label: _("report.col_amount"), format: "currency", align: "right", currency, sortable: true },
        { key: "currency", label: _("report.col_currency"), align: "center" },
        { key: "status", label: _("report.col_status"), format: "status", align: "center" }
      ];

    case "audit-logs":
      return [
        { key: "date", label: _("report.col_date"), format: "date", sortable: true },
        { key: "userId", label: _("report.col_user", "User / Actor") },
        { key: "action", label: _("report.col_action" as UiKey, "Action") },
        { key: "resource", label: _("report.col_resource" as UiKey, "Resource / Table") },
        { key: "reference", label: _("report.col_reference", "Record ID") },
        { key: "ip", label: _("report.col_ip" as UiKey, "IP Address") },
        { key: "status", label: _("report.col_status"), format: "status", align: "center" }
      ];

    case "approval-workflows":
      return [
        { key: "date", label: _("report.col_date"), format: "date", sortable: true },
        { key: "entityType", label: _("report.col_type" as UiKey, "Entity Type") },
        { key: "entityId", label: _("report.col_reference", "Entity ID") },
        { key: "requestedBy", label: "Requested By" },
        { key: "approvedBy", label: "Approved By" },
        { key: "status", label: _("report.col_status"), format: "status", align: "center" }
      ];

    case "expenses":
      return [
        ...common,
        { key: "voucherNo", label: "Voucher No." },
        { key: "narration", label: _("report.col_description") },
        { key: "amount", label: _("report.col_amount"), format: "currency", align: "right", currency, sortable: true },
        { key: "currency", label: _("report.col_currency"), align: "center" },
        { key: "status", label: _("report.col_status"), format: "status", align: "center" }
      ];

    case "financial-summaries":
      return [
        { key: "serial", label: _("report.col_serial", "Ref"), sortable: true, width: "w-20" },
        { key: "metric", label: "Financial Statement Metric / Line", sortable: true },
        { key: "type", label: _("report.col_type" as UiKey, "Classification"), align: "center" },
        { key: "amount", label: _("report.col_amount"), format: "currency", align: "right", currency, sortable: true },
        { key: "status", label: _("report.col_status"), format: "status", align: "center" }
      ];

    case "daily-comprehensive":
      return [
        ...common,
        { key: "type", label: _("report.col_type" as UiKey, "Type"), align: "center" },
        { key: "narration", label: _("report.col_description") },
        { key: "debit", label: _("report.col_debit"), format: "currency", align: "right", currency },
        { key: "credit", label: _("report.col_credit"), format: "currency", align: "right", currency },
        { key: "amount", label: _("report.col_amount"), format: "currency", align: "right", currency, sortable: true },
        { key: "currency", label: _("report.col_currency"), align: "center" },
        { key: "status", label: _("report.col_status"), format: "status", align: "center" }
      ];

    case "inventory":
      return [
        ...common,
        { key: "product", label: "Product / Stock Item", sortable: true },
        { key: "quantity", label: "Quantity", format: "number", align: "right", sortable: true },
        { key: "unit", label: "Unit", align: "center" },
        { key: "warehouse", label: "Warehouse", sortable: true },
        { key: "status", label: _("report.col_status"), format: "status", align: "center" }
      ];

    case "purchase-booking-register":
      return [
        { key: "serial", label: _("report.col_serial"), sortable: true },
        { key: "date", label: _("report.col_date"), format: "date", sortable: true },
        { key: "party", label: _("report.col_party" as UiKey, "Supplier / Customer"), sortable: true },
        { key: "amount", label: _("report.col_amount"), format: "currency", align: "right", currency, sortable: true },
        { key: "paid", label: _("report.col_paid" as UiKey, "Paid"), format: "currency", align: "right", currency },
        { key: "outstanding", label: _("report.col_outstanding" as UiKey, "Outstanding"), format: "currency", align: "right", currency, sortable: true },
        { key: "currency", label: _("report.col_currency"), align: "center" },
        { key: "status", label: _("report.col_status"), format: "status", align: "center" }
      ];

    case "cash-entry":
      return [
        ...common,
        { key: "narration", label: _("report.col_description") },
        { key: "debit", label: _("report.col_debit"), format: "currency", align: "right", currency, sortable: true },
        { key: "credit", label: _("report.col_credit"), format: "currency", align: "right", currency, sortable: true },
        { key: "balance", label: _("report.col_balance"), format: "currency", align: "right", currency, sortable: true },
        { key: "status", label: _("report.col_status"), format: "status", align: "center" }
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
