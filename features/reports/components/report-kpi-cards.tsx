"use client";

import { TrendingUp, TrendingDown, Minus, DollarSign, BarChart3, CreditCard, Wallet } from "lucide-react";
import { t, type UiKey } from "@/lib/i18n/ui";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { cn } from "@/lib/utils";

type KpiCardProps = {
  label: string;
  value: number;
  currency?: string;
  trend?: "up" | "down" | "neutral";
  icon: React.ReactNode;
  colorClass: string;
  bgClass: string;
  borderClass: string;
  format?: "currency" | "number" | "percent";
};

function KpiCard({ label, value, currency, trend, icon, colorClass, bgClass, borderClass, format = "currency" }: KpiCardProps) {
  const formatted = format === "currency"
    ? new Intl.NumberFormat("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value)
    : format === "number"
    ? new Intl.NumberFormat("en-US").format(value)
    : `${value.toFixed(1)}%`;

  return (
    <div className={cn(
      "relative overflow-hidden rounded-2xl border p-5 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5",
      bgClass, borderClass
    )}>
      {/* Background gradient orb */}
      <div className={cn("absolute -top-4 -right-4 h-20 w-20 rounded-full opacity-20 blur-2xl", bgClass)} />

      <div className="relative flex items-start justify-between">
        <div className={cn("rounded-xl p-2.5", bgClass, borderClass, "border")}>
          <div className={colorClass}>{icon}</div>
        </div>
        {trend && (
          <span className={cn(
            "text-[10px] font-black rounded-full px-2 py-0.5",
            trend === "up" ? "text-emerald-700 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-950/50" :
            trend === "down" ? "text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-950/50" :
            "text-slate-600 bg-slate-100 dark:text-slate-400 dark:bg-slate-800"
          )}>
            {trend === "up" ? "▲" : trend === "down" ? "▼" : "—"}
          </span>
        )}
      </div>

      <div className="mt-4">
        <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
          {label}
        </p>
        <div className="flex items-baseline gap-1.5">
          {currency && (
            <span className={cn("text-sm font-black", colorClass)}>{currency}</span>
          )}
          <span className={cn("text-2xl font-black tabular-nums tracking-tight", colorClass)}>
            {formatted}
          </span>
        </div>
      </div>
    </div>
  );
}

type ReportSummary = {
  records?: number;
  totalDebit?: number;
  totalCredit?: number;
  netBalance?: number;
  totalPurchase?: number;
  totalSales?: number;
  totalPayment?: number;
  totalRemaining?: number;
  totalAmount?: number;
  totalAdvance?: number;
  [key: string]: number | undefined;
};

type Props = {
  lang: SupportedLanguage;
  summary: ReportSummary;
  reportType: string;
  currency?: string;
  isLoading?: boolean;
};

export function ReportKpiCards({ lang, summary, reportType, currency = "USD", isLoading }: Props) {
  const _ = (key: UiKey, fallback?: string) => t(lang, key, fallback);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-2xl border border-slate-200 bg-slate-100 dark:bg-slate-800 dark:border-slate-700 h-32 animate-pulse" />
        ))}
      </div>
    );
  }

  // Build cards based on report type
  const cards: KpiCardProps[] = [];

  // Total Records — always shown
  cards.push({
    label: _("report.kpi_total_records"),
    value: summary.records ?? 0,
    icon: <BarChart3 className="h-4 w-4" />,
    colorClass: "text-indigo-600 dark:text-indigo-400",
    bgClass: "bg-indigo-50 dark:bg-indigo-950/40",
    borderClass: "border-indigo-200 dark:border-indigo-900",
    format: "number"
  });

  // Report-type specific cards
  if (["ledger", "roznamcha", "journal", "cash", "payment", "cash-entry", "payments"].includes(reportType)) {
    cards.push({
      label: _("report.kpi_total_debit"),
      value: summary.totalDebit ?? 0,
      currency,
      icon: <TrendingDown className="h-4 w-4" />,
      colorClass: "text-rose-600 dark:text-rose-400",
      bgClass: "bg-rose-50 dark:bg-rose-950/40",
      borderClass: "border-rose-200 dark:border-rose-900",
      trend: "down"
    });
    cards.push({
      label: _("report.kpi_total_credit"),
      value: summary.totalCredit ?? 0,
      currency,
      icon: <TrendingUp className="h-4 w-4" />,
      colorClass: "text-emerald-600 dark:text-emerald-400",
      bgClass: "bg-emerald-50 dark:bg-emerald-950/40",
      borderClass: "border-emerald-200 dark:border-emerald-900",
      trend: "up"
    });
    cards.push({
      label: _("report.kpi_net_balance"),
      value: Math.abs(summary.netBalance ?? 0),
      currency,
      icon: <Wallet className="h-4 w-4" />,
      colorClass: (summary.netBalance ?? 0) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400",
      bgClass: (summary.netBalance ?? 0) >= 0 ? "bg-emerald-50 dark:bg-emerald-950/40" : "bg-rose-50 dark:bg-rose-950/40",
      borderClass: (summary.netBalance ?? 0) >= 0 ? "border-emerald-200 dark:border-emerald-900" : "border-rose-200 dark:border-rose-900",
      trend: (summary.netBalance ?? 0) >= 0 ? "up" : "down"
    });
  } else if (["purchase", "purchase-booking"].includes(reportType)) {
    cards.push({
      label: _("report.kpi_total_purchase"),
      value: summary.totalAmount ?? summary.totalPurchase ?? 0,
      currency,
      icon: <CreditCard className="h-4 w-4" />,
      colorClass: "text-blue-600 dark:text-blue-400",
      bgClass: "bg-blue-50 dark:bg-blue-950/40",
      borderClass: "border-blue-200 dark:border-blue-900",
      trend: "neutral"
    });
    if (summary.totalAdvance !== undefined) {
      cards.push({
        label: _("report.kpi_total_payment"),
        value: summary.totalAdvance ?? 0,
        currency,
        icon: <TrendingUp className="h-4 w-4" />,
        colorClass: "text-emerald-600 dark:text-emerald-400",
        bgClass: "bg-emerald-50 dark:bg-emerald-950/40",
        borderClass: "border-emerald-200 dark:border-emerald-900",
        trend: "up"
      });
    }
    if (summary.totalRemaining !== undefined) {
      cards.push({
        label: _("report.kpi_total_remaining"),
        value: summary.totalRemaining ?? 0,
        currency,
        icon: <Minus className="h-4 w-4" />,
        colorClass: "text-amber-600 dark:text-amber-400",
        bgClass: "bg-amber-50 dark:bg-amber-950/40",
        borderClass: "border-amber-200 dark:border-amber-900",
        trend: "down"
      });
    }
  } else if (reportType === "sales") {
    cards.push({
      label: _("report.kpi_total_sales"),
      value: summary.totalAmount ?? summary.totalSales ?? 0,
      currency,
      icon: <DollarSign className="h-4 w-4" />,
      colorClass: "text-emerald-600 dark:text-emerald-400",
      bgClass: "bg-emerald-50 dark:bg-emerald-950/40",
      borderClass: "border-emerald-200 dark:border-emerald-900",
      trend: "up"
    });
  } else if (reportType === "remaining") {
    cards.push({
      label: _("report.kpi_total_remaining"),
      value: summary.totalRemaining ?? 0,
      currency,
      icon: <TrendingDown className="h-4 w-4" />,
      colorClass: "text-amber-600 dark:text-amber-400",
      bgClass: "bg-amber-50 dark:bg-amber-950/40",
      borderClass: "border-amber-200 dark:border-amber-900",
      trend: "down"
    });
  } else if (reportType === "financial-summaries") {
    cards.push(
      {
        label: _("report.kpi_total_purchase"),
        value: summary.totalPurchase ?? 0,
        currency,
        icon: <CreditCard className="h-4 w-4" />,
        colorClass: "text-blue-600 dark:text-blue-400",
        bgClass: "bg-blue-50 dark:bg-blue-950/40",
        borderClass: "border-blue-200 dark:border-blue-900",
      },
      {
        label: _("report.kpi_total_sales"),
        value: summary.totalSales ?? 0,
        currency,
        icon: <DollarSign className="h-4 w-4" />,
        colorClass: "text-emerald-600 dark:text-emerald-400",
        bgClass: "bg-emerald-50 dark:bg-emerald-950/40",
        borderClass: "border-emerald-200 dark:border-emerald-900",
        trend: "up"
      },
      {
        label: _("report.kpi_net_balance"),
        value: Math.abs(summary.netBalance ?? 0),
        currency,
        icon: <Wallet className="h-4 w-4" />,
        colorClass: (summary.netBalance ?? 0) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400",
        bgClass: (summary.netBalance ?? 0) >= 0 ? "bg-emerald-50 dark:bg-emerald-950/40" : "bg-rose-50 dark:bg-rose-950/40",
        borderClass: (summary.netBalance ?? 0) >= 0 ? "border-emerald-200 dark:border-emerald-900" : "border-rose-200 dark:border-rose-900",
      }
    );
  } else {
    // Generic fallback
    if (summary.totalAmount !== undefined) {
      cards.push({
        label: _("report.kpi_total_payment"),
        value: summary.totalAmount ?? 0,
        currency,
        icon: <DollarSign className="h-4 w-4" />,
        colorClass: "text-blue-600 dark:text-blue-400",
        bgClass: "bg-blue-50 dark:bg-blue-950/40",
        borderClass: "border-blue-200 dark:border-blue-900",
      });
    }
  }

  // Always show max 4 cards
  const visibleCards = cards.slice(0, 4);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {visibleCards.map((card, i) => (
        <KpiCard key={i} {...card} />
      ))}
    </div>
  );
}
