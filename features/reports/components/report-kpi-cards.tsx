"use client";

import { Activity, Banknote, BookOpen, CheckCircle2, ClipboardList } from "lucide-react";
import { t, type UiKey } from "@/lib/i18n/ui";
import type { SupportedLanguage } from "@/lib/i18n/languages";

type Props = {
  lang: SupportedLanguage;
  summary: Record<string, any>;
  reportType: string;
  currency?: string;
  isLoading?: boolean;
};

function number(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function format(value: number, monetary: boolean) {
  return value.toLocaleString("en-US", { minimumFractionDigits: monetary ? 2 : 0, maximumFractionDigits: monetary ? 2 : 0 });
}

export function ReportKpiCards({ lang, summary, reportType, currency = "USD", isLoading }: Props) {
  const _ = (key: UiKey, fallback?: string) => t(lang, key, fallback);
  if (isLoading) return <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">{[1, 2, 3, 4, 5].map((item) => <div key={item} className="h-24 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />)}</div>;

  const isLedger = reportType === "ledger" || reportType === "payments";
  const cards = isLedger
    ? [
        { label: _("report.kpi_total_records"), value: number(summary.records), monetary: false, icon: ClipboardList, color: "text-indigo-600" },
        { label: _("report.col_opening" as UiKey, "Opening"), value: number(summary.openingBalance), monetary: true, icon: BookOpen, color: "text-slate-600" },
        { label: _("report.kpi_total_debit"), value: number(summary.totalDebit), monetary: true, icon: Banknote, color: "text-rose-600" },
        { label: _("report.kpi_total_credit"), value: number(summary.totalCredit), monetary: true, icon: Banknote, color: "text-emerald-600" },
        { label: _("report.col_closing" as UiKey, "Closing"), value: number(summary.closingBalance), monetary: true, icon: Activity, color: "text-blue-600" }
      ]
    : [
        { label: _("report.kpi_total_records"), value: number(summary.records), monetary: false, icon: ClipboardList, color: "text-indigo-600" },
        { label: _("report.col_amount"), value: number(summary.totalAmount), monetary: true, icon: Banknote, color: "text-blue-600" },
        { label: _("report.col_paid" as UiKey, "Paid"), value: number(summary.totalPaid), monetary: true, icon: CheckCircle2, color: "text-emerald-600" },
        { label: _("report.col_outstanding" as UiKey, "Outstanding"), value: number(summary.totalOutstanding), monetary: true, icon: Activity, color: "text-amber-600" },
        { label: _("report.col_posting_status" as UiKey, "Posted / Pending"), value: number(summary.posted), suffix: ` / ${number(summary.pending)}`, monetary: false, icon: BookOpen, color: "text-violet-600" }
      ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div key={card.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-center gap-2"><Icon className={`h-4 w-4 ${card.color}`} /><span className="text-[10px] font-black uppercase tracking-wide text-slate-400">{card.label}</span></div>
            <div className={`mt-2 text-lg font-black tabular-nums ${card.color}`}>{card.monetary ? `${currency} ` : ""}{format(card.value, card.monetary)}{card.suffix || ""}</div>
          </div>
        );
      })}
    </div>
  );
}
