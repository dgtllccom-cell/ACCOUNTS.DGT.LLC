"use client";

import React from "react";
import {
  Download, Printer, MoreHorizontal, Plus, RefreshCw, FileSpreadsheet,
  ClipboardList, BarChart3, Globe2, Building2, TrendingUp, TrendingDown,
  Calendar, Info, Wallet, Users, Clock
} from "lucide-react";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n/ui";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { ReportStatusLegend, StatusBadge, ERP_STATUS_COLORS } from "./report-status-legend";
import { ReportPagination } from "./report-pagination";

function useTt() {
  const lang = useActiveLanguage() || "en";
  return (key: string, fallback: string) => t(lang, key, fallback);
}

// ─────────────────────────────────────────────────────────────
// KPI Card Types & Component
// ─────────────────────────────────────────────────────────────

export type KpiCardDef = {
  label: string;
  value: string | number;
  subValue?: string;
  colorClass: string;
  bgClass: string;
  borderClass: string;
  icon: React.ReactNode;
  valueColorClass?: string;
};

function KpiCard({ label, value, subValue, colorClass, bgClass, borderClass, icon, valueColorClass }: KpiCardDef) {
  const display = typeof value === "number"
    ? value.toLocaleString("en-US")
    : value;
  return (
    <div className={cn(
      "relative overflow-hidden rounded-2xl border p-4 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5",
      bgClass, borderClass
    )}>
      <div className="absolute -top-4 -right-4 h-16 w-16 rounded-full opacity-20 blur-2xl" />
      <div className="flex items-start justify-between mb-3">
        <div className={cn("rounded-xl p-2 border", bgClass, borderClass)}>
          <div className={colorClass}>{icon}</div>
        </div>
      </div>
      <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">{label}</p>
      <div className={cn("text-2xl font-black tabular-nums tracking-tight", valueColorClass ?? colorClass)}>
        {display}
      </div>
      {subValue && (
        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">{subValue}</p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Standard KPI Groups
// ─────────────────────────────────────────────────────────────

export type BillSummaryKpi = {
  total: number;
  draft: number;
  accepted: number;
  transferred: number;
  completed: number;
  cancelled?: number;
};

export type AmountSummaryKpi = {
  label?: string;
  currency: string;
  totalAmount: number;
  acceptedAmount?: number;
  transferredAmount?: number;
  completedAmount?: number;
};

export type BranchSummaryKpi = {
  total: number;
  active: number;
  inactive: number;
};

export type ThisMonthKpi = {
  created: number;
  amount?: number;
  transferred?: number;
  completed?: number;
};

export type QuickInfoKpi = {
  currency?: string;
  exchangeRate?: string;
  company?: string;
  financialYear?: string;
  extraRows?: { label: string; value: string }[];
};

// ─────────────────────────────────────────────────────────────
// Bill Summary KPI Group — matches reference design card 1
// ─────────────────────────────────────────────────────────────
function BillSummaryCard({ data, title }: { data: BillSummaryKpi; title?: string }) {
  const tt = useTt();
  const heading = title ?? tt("ers.bill_summary", "BILL SUMMARY");
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm flex flex-col gap-1.5">
      <div className="flex items-center gap-2 mb-1">
        <div className="rounded-lg p-1.5 bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-900">
          <ClipboardList className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
        </div>
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">{heading}</span>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-600 dark:text-slate-400 font-medium">{tt("ers.total_bills", "Total Bills")}</span>
        <span className="font-black text-slate-900 dark:text-slate-100 tabular-nums">{data.total.toLocaleString()}</span>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-500 dark:text-slate-400 font-medium">{tt("ers.draft", "Draft")}</span>
        <span className="font-bold text-slate-600 dark:text-slate-300 tabular-nums">{data.draft.toLocaleString()}</span>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-500 dark:text-slate-400 font-medium">{tt("ers.accepted_not_transferred", "Accepted (Not Transferred)")}</span>
        <span className="font-black text-amber-600 dark:text-amber-400 tabular-nums">{data.accepted.toLocaleString()}</span>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-500 dark:text-slate-400 font-medium">{tt("ers.transferred", "Transferred")}</span>
        <span className="font-bold text-slate-900 dark:text-slate-100 tabular-nums">{data.transferred.toLocaleString()}</span>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-500 dark:text-slate-400 font-medium">{tt("ers.completed", "Completed")}</span>
        <span className="font-black text-emerald-600 dark:text-emerald-400 tabular-nums">{data.completed.toLocaleString()}</span>
      </div>
      {(data.cancelled ?? 0) > 0 && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500 dark:text-slate-400 font-medium">{tt("ers.cancelled", "Cancelled")}</span>
          <span className="font-bold text-red-600 dark:text-red-400 tabular-nums">{(data.cancelled ?? 0).toLocaleString()}</span>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Amount Summary KPI Group — card 2
// ─────────────────────────────────────────────────────────────
function AmountSummaryCard({ data }: { data: AmountSummaryKpi }) {
  const tt = useTt();
  const fmt = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (
    <div className="rounded-2xl border border-blue-200 dark:border-blue-900 bg-white dark:bg-slate-900 p-4 shadow-sm flex flex-col gap-1.5">
      <div className="flex items-center gap-2 mb-1">
        <div className="rounded-lg p-1.5 bg-blue-50 dark:bg-blue-950/50 border border-blue-100 dark:border-blue-900">
          <Wallet className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
        </div>
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {tt("ers.total_amounts", "Total Amounts")} ({data.currency})
        </span>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-600 dark:text-slate-400 font-medium">{data.label ?? tt("ers.total_purchase_amount", "Total Purchase Amount")}</span>
        <span className="font-black text-blue-700 dark:text-blue-300 tabular-nums">{fmt(data.totalAmount)}</span>
      </div>
      {data.acceptedAmount !== undefined && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500 dark:text-slate-400 font-medium">{tt("ers.accepted_not_transferred", "Accepted (Not Transferred)")}</span>
          <span className="font-black text-amber-600 dark:text-amber-400 tabular-nums">{fmt(data.acceptedAmount)}</span>
        </div>
      )}
      {data.transferredAmount !== undefined && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500 dark:text-slate-400 font-medium">{tt("ers.transferred", "Transferred")}</span>
          <span className="font-bold text-slate-700 dark:text-slate-200 tabular-nums">{fmt(data.transferredAmount)}</span>
        </div>
      )}
      {data.completedAmount !== undefined && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500 dark:text-slate-400 font-medium">{tt("ers.completed", "Completed")}</span>
          <span className="font-black text-emerald-600 dark:text-emerald-400 tabular-nums">{fmt(data.completedAmount)}</span>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Branches KPI Group — card 3
// ─────────────────────────────────────────────────────────────
function BranchesCard({ data }: { data: BranchSummaryKpi }) {
  const tt = useTt();
  return (
    <div className="rounded-2xl border border-violet-200 dark:border-violet-900 bg-white dark:bg-slate-900 p-4 shadow-sm flex flex-col gap-1.5">
      <div className="flex items-center gap-2 mb-1">
        <div className="rounded-lg p-1.5 bg-violet-50 dark:bg-violet-950/50 border border-violet-100 dark:border-violet-900">
          <Building2 className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
        </div>
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">BRANCHES</span>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-600 dark:text-slate-400 font-medium">Total Branches</span>
        <span className="font-black text-violet-700 dark:text-violet-300 tabular-nums">{data.total}</span>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-500 dark:text-slate-400 font-medium">Active Branches</span>
        <span className="font-black text-emerald-600 dark:text-emerald-400 tabular-nums">{data.active}</span>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-500 dark:text-slate-400 font-medium">Inactive Branches</span>
        <span className="font-bold text-red-500 dark:text-red-400 tabular-nums">{data.inactive}</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// This Month KPI Group — card 4
// ─────────────────────────────────────────────────────────────
function ThisMonthCard({ data }: { data: ThisMonthKpi }) {
  return (
    <div className="rounded-2xl border border-orange-200 dark:border-orange-900 bg-white dark:bg-slate-900 p-4 shadow-sm flex flex-col gap-1.5">
      <div className="flex items-center gap-2 mb-1">
        <div className="rounded-lg p-1.5 bg-orange-50 dark:bg-orange-950/50 border border-orange-100 dark:border-orange-900">
          <Calendar className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400" />
        </div>
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">THIS MONTH</span>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-600 dark:text-slate-400 font-medium">Bills Created</span>
        <span className="font-black text-orange-700 dark:text-orange-300 tabular-nums">{data.created.toLocaleString()}</span>
      </div>
      {data.amount !== undefined && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500 dark:text-slate-400 font-medium">Amount</span>
          <span className="font-bold text-slate-700 dark:text-slate-200 tabular-nums">{data.amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
      )}
      {data.transferred !== undefined && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500 dark:text-slate-400 font-medium">Transferred</span>
          <span className="font-bold text-slate-700 dark:text-slate-200 tabular-nums">{data.transferred.toLocaleString()}</span>
        </div>
      )}
      {data.completed !== undefined && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500 dark:text-slate-400 font-medium">Completed</span>
          <span className="font-black text-emerald-600 dark:text-emerald-400 tabular-nums">{data.completed.toLocaleString()}</span>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Quick Info KPI Group — card 5
// ─────────────────────────────────────────────────────────────
function QuickInfoCard({ data }: { data: QuickInfoKpi }) {
  return (
    <div className="rounded-2xl border border-teal-200 dark:border-teal-900 bg-white dark:bg-slate-900 p-4 shadow-sm flex flex-col gap-1.5">
      <div className="flex items-center gap-2 mb-1">
        <div className="rounded-lg p-1.5 bg-teal-50 dark:bg-teal-950/50 border border-teal-100 dark:border-teal-900">
          <Info className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
        </div>
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">QUICK INFO</span>
      </div>
      {data.currency && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500 dark:text-slate-400 font-medium">Currency</span>
          <span className="font-black text-teal-700 dark:text-teal-300">{data.currency}</span>
        </div>
      )}
      {data.exchangeRate && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500 dark:text-slate-400 font-medium">Exchange Rate (Avg.)</span>
          <span className="font-bold text-slate-700 dark:text-slate-200">{data.exchangeRate}</span>
        </div>
      )}
      {data.company && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500 dark:text-slate-400 font-medium">Company</span>
          <span className="font-bold text-slate-700 dark:text-slate-200 truncate max-w-[120px] text-right" title={data.company}>{data.company}</span>
        </div>
      )}
      {data.financialYear && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500 dark:text-slate-400 font-medium">Financial Year</span>
          <span className="font-black text-teal-700 dark:text-teal-300">{data.financialYear}</span>
        </div>
      )}
      {data.extraRows?.map((row, i) => (
        <div key={i} className="flex items-center justify-between text-xs">
          <span className="text-slate-500 dark:text-slate-400 font-medium">{row.label}</span>
          <span className="font-bold text-slate-700 dark:text-slate-200">{row.value}</span>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Full ERP Report Shell Props
// ─────────────────────────────────────────────────────────────

export type ErpReportShellProps = {
  // Header
  title: string;
  description?: string;
  icon?: React.ReactNode;
  /** Primary action button (e.g. "New Purchase Booking") */
  primaryAction?: { label: string; icon?: React.ReactNode; onClick: () => void };
  onExport?: () => void;
  onPrint?: () => void;
  onReport?: () => void;
  moreActions?: { label: string; icon?: React.ReactNode; onClick: () => void }[];

  // KPI Groups (all optional — show only the ones passed)
  billSummary?: BillSummaryKpi;
  billSummaryTitle?: string;
  amountSummary?: AmountSummaryKpi;
  branchSummary?: BranchSummaryKpi;
  thisMonth?: ThisMonthKpi;
  quickInfo?: QuickInfoKpi;
  /** Extra simple KPI cards (icon + label + value) */
  extraKpiCards?: KpiCardDef[];

  // Filter slot (pass your filter bar as children here)
  filterSlot?: React.ReactNode;

  // Table slot
  tableTitle?: string;
  tableTitleIcon?: React.ReactNode;
  tableSlot: React.ReactNode;

  // Pagination
  pagination?: {
    totalCount: number;
    page: number;
    pageSize: number;
    onPageChange: (p: number) => void;
    onPageSizeChange: (s: number) => void;
  };

  // Status legend
  statusLegend?: {
    statuses?: Array<keyof typeof ERP_STATUS_COLORS>;
    notes?: string[];
  };

  isLoading?: boolean;
  className?: string;
};

// ─────────────────────────────────────────────────────────────
// Main Shell Component
// ─────────────────────────────────────────────────────────────

export function ErpReportShell({
  title,
  description,
  icon,
  primaryAction,
  onExport,
  onPrint,
  onReport,
  moreActions,
  billSummary,
  billSummaryTitle,
  amountSummary,
  branchSummary,
  thisMonth,
  quickInfo,
  extraKpiCards,
  filterSlot,
  tableTitle,
  tableTitleIcon,
  tableSlot,
  pagination,
  statusLegend,
  isLoading,
  className
}: ErpReportShellProps) {
  const [showMoreActions, setShowMoreActions] = React.useState(false);

  // Count how many KPI group cards will show
  const kpiGroupCount = [billSummary, amountSummary, branchSummary, thisMonth, quickInfo].filter(Boolean).length;
  const hasKpiGroups = kpiGroupCount > 0 || (extraKpiCards && extraKpiCards.length > 0);

  return (
    <div className={cn("space-y-5", className)}>
      {/* ── HEADER ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          {icon && (
            <div className="mt-0.5 rounded-xl p-2.5 bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-900 text-indigo-600 dark:text-indigo-400 flex-shrink-0">
              {icon}
            </div>
          )}
          <div>
            <h1 className="text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight">{title}</h1>
            {description && (
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">{description}</p>
            )}
          </div>
        </div>

        {/* Action buttons — matches reference design */}
        <div className="flex items-center flex-wrap gap-2">
          {primaryAction && (
            <button
              type="button"
              onClick={primaryAction.onClick}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-sm transition-all hover:shadow-md"
            >
              {primaryAction.icon ?? <Plus className="h-3.5 w-3.5" />}
              {primaryAction.label}
            </button>
          )}

          {onExport && (
            <button
              type="button"
              onClick={onExport}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-xs font-bold shadow-sm hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-all"
            >
              <Download className="h-3.5 w-3.5" />
              Export
            </button>
          )}

          {onReport && (
            <button
              type="button"
              onClick={onReport}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400 text-xs font-bold shadow-sm hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-all"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Report
            </button>
          )}

          {onPrint && (
            <button
              type="button"
              onClick={onPrint}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
            >
              <Printer className="h-3.5 w-3.5" />
              Print
            </button>
          )}

          {moreActions && moreActions.length > 0 && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowMoreActions((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
                More
              </button>
              {showMoreActions && (
                <div className="absolute right-0 top-full mt-1 z-50 w-44 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl py-1.5">
                  {moreActions.map((action, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => { action.onClick(); setShowMoreActions(false); }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                      {action.icon}
                      {action.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── KPI CARDS ── */}
      {hasKpiGroups && (
        <div className={cn(
          "grid gap-4",
          kpiGroupCount <= 2 ? "grid-cols-1 sm:grid-cols-2" :
          kpiGroupCount === 3 ? "grid-cols-1 sm:grid-cols-3" :
          kpiGroupCount === 4 ? "grid-cols-2 lg:grid-cols-4" :
          "grid-cols-2 lg:grid-cols-5"
        )}>
          {isLoading ? (
            Array.from({ length: kpiGroupCount || 5 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 h-36 animate-pulse" />
            ))
          ) : (
            <>
              {billSummary && <BillSummaryCard data={billSummary} title={billSummaryTitle} />}
              {amountSummary && <AmountSummaryCard data={amountSummary} />}
              {branchSummary && <BranchesCard data={branchSummary} />}
              {thisMonth && <ThisMonthCard data={thisMonth} />}
              {quickInfo && <QuickInfoCard data={quickInfo} />}
              {extraKpiCards?.map((card, i) => <KpiCard key={i} {...card} />)}
            </>
          )}
        </div>
      )}

      {/* ── FILTERS ── */}
      {filterSlot && filterSlot}

      {/* ── TABLE ── */}
      <div className="space-y-0">
        {tableTitle && (
          <div className="flex items-center gap-2 px-1 mb-2">
            {tableTitleIcon ?? <BarChart3 className="h-4 w-4 text-indigo-500" />}
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">{tableTitle}</h2>
          </div>
        )}
        {tableSlot}
      </div>

      {/* ── PAGINATION ── */}
      {pagination && (
        <ReportPagination
          totalCount={pagination.totalCount}
          page={pagination.page}
          pageSize={pagination.pageSize}
          onPageChange={pagination.onPageChange}
          onPageSizeChange={pagination.onPageSizeChange}
        />
      )}

      {/* ── STATUS LEGEND ── */}
      {statusLegend && (
        <ReportStatusLegend
          statuses={statusLegend.statuses}
          notes={statusLegend.notes}
        />
      )}
    </div>
  );
}
