"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Coins } from "lucide-react";

export interface CurrencyTotalRow {
  currency: string;
  totalPurchase: number;
  advancePaid: number;
  remainingBalance: number;
}

export interface CurrencyTotalsGridProps {
  rows: CurrencyTotalRow[];
  localCurrency: string;
  totalLC: { totalPurchase: number; advancePaid: number; remainingBalance: number };
  formatMoney: (value: number, currency?: string) => React.ReactNode;
  title: React.ReactNode;
  noteLabel: React.ReactNode;
  colLabels: { total: React.ReactNode; advance: React.ReactNode; remaining: React.ReactNode };
  className?: string;
}

/**
 * "Currency wise total" grid — one box per distinct original currency in the current view,
 * plus a final box converted into the branch/country local currency. Never sums two different
 * currencies into one number; each box only ever totals amounts already in that one currency.
 */
export function CurrencyTotalsGrid({
  rows,
  localCurrency,
  totalLC,
  formatMoney,
  title,
  noteLabel,
  colLabels,
  className,
}: CurrencyTotalsGridProps) {
  if (!rows || rows.length === 0) return null;

  return (
    <div className={cn("rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden", className)}>
      <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-amber-50/50 dark:bg-amber-900/10 border-b border-amber-100 dark:border-amber-900/30">
        <div className="flex items-center gap-1.5 min-w-0">
          <Coins className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <h3 className="text-[10.5px] font-extrabold uppercase tracking-wider text-amber-800 dark:text-amber-400 truncate">
            {title}
          </h3>
        </div>
        <span className="shrink-0 text-[9px] font-semibold text-slate-400 dark:text-slate-500">{noteLabel}</span>
      </div>
      <div className="p-2.5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {rows.map((r) => (
          <div
            key={r.currency}
            className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 px-2.5 py-2"
          >
            <div className="text-[9.5px] font-extrabold text-slate-500 dark:text-slate-400 mb-1">{r.currency}</div>
            <div className="space-y-0.5">
              <div className="flex items-center justify-between text-[10.5px]">
                <span className="text-slate-400 dark:text-slate-500">{colLabels.total}</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 tabular-nums">
                  {formatMoney(r.totalPurchase, r.currency)}
                </span>
              </div>
              <div className="flex items-center justify-between text-[10.5px]">
                <span className="text-slate-400 dark:text-slate-500">{colLabels.advance}</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {formatMoney(r.advancePaid, r.currency)}
                </span>
              </div>
              <div className="flex items-center justify-between text-[10.5px]">
                <span className="text-slate-400 dark:text-slate-500">{colLabels.remaining}</span>
                <span className="font-semibold text-orange-600 dark:text-orange-400 tabular-nums">
                  {formatMoney(r.remainingBalance, r.currency)}
                </span>
              </div>
            </div>
          </div>
        ))}
        <div className="rounded-lg border border-blue-200 dark:border-blue-900/40 bg-blue-50/60 dark:bg-blue-900/10 px-2.5 py-2">
          <div className="text-[9.5px] font-extrabold text-blue-600 dark:text-blue-400 mb-1">{localCurrency}</div>
          <div className="space-y-0.5">
            <div className="flex items-center justify-between text-[10.5px]">
              <span className="text-slate-400 dark:text-slate-500">{colLabels.total}</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 tabular-nums">
                {formatMoney(totalLC.totalPurchase, localCurrency)}
              </span>
            </div>
            <div className="flex items-center justify-between text-[10.5px]">
              <span className="text-slate-400 dark:text-slate-500">{colLabels.advance}</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                {formatMoney(totalLC.advancePaid, localCurrency)}
              </span>
            </div>
            <div className="flex items-center justify-between text-[10.5px]">
              <span className="text-slate-400 dark:text-slate-500">{colLabels.remaining}</span>
              <span className="font-semibold text-orange-600 dark:text-orange-400 tabular-nums">
                {formatMoney(totalLC.remainingBalance, localCurrency)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
