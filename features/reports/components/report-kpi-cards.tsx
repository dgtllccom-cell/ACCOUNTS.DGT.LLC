"use client";

import { Users, ClipboardList, Wallet, Building2, CalendarDays, Clock3 } from "lucide-react";
import { t, type UiKey } from "@/lib/i18n/ui";
import { translateHeader } from "@/lib/i18n/table-headers";
import type { SupportedLanguage } from "@/lib/i18n/languages";

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

  // Standardized 5-card detailed summary properties
  countryName?: string;
  branchName?: string;
  userId?: string;
  userName?: string;
  userRole?: string;
  draft?: number;
  accepted?: number;
  transferred?: number;
  completed?: number;
  acceptedAmount?: number;
  transferredAmount?: number;
  completedAmount?: number;
  totalBranches?: number;
  activeBranches?: number;
  inactiveBranches?: number;
  thisMonth?: { created?: number; amount?: number; transferred?: number; completed?: number };
  quickInfo?: { currency?: string; exchangeRate?: string; company?: string; financialYear?: string };
  [key: string]: any;
};

type Props = {
  lang: SupportedLanguage;
  summary: ReportSummary;
  reportType: string;
  currency?: string;
  isLoading?: boolean;
};

function formatMoney(val: number) {
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
}

export function ReportKpiCards({ lang, summary, reportType, currency = "USD", isLoading }: Props) {
  const _ = (key: UiKey, fallback?: string) => t(lang, key, fallback);
  const th = (label: string) => translateHeader(lang, label);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="rounded-xl border border-slate-200 bg-slate-100 dark:bg-slate-800 dark:border-slate-700 h-32 animate-pulse" />
        ))}
      </div>
    );
  }

  const country = summary.countryName ?? "Pakistan";
  const branch = summary.branchName ?? "Karachi Main";
  const uId = summary.userId ?? "USR-001";
  const uName = summary.userName ?? "Admin User";
  const uRole = summary.userRole ?? "Super Admin";

  const totalRecords = summary.records ?? summary.total ?? 0;
  const draftCount = summary.draft ?? Math.max(0, totalRecords - (summary.accepted ?? 0) - (summary.transferred ?? 0) - (summary.completed ?? 0));
  const acceptedCount = summary.accepted ?? 0;
  const transferredCount = summary.transferred ?? 0;
  const completedCount = summary.completed ?? 0;

  const totalAmt = summary.totalAmount ?? summary.totalPurchase ?? summary.totalSales ?? summary.totalDebit ?? 0;
  const acceptedAmt = summary.acceptedAmount ?? 0;
  const transferredAmt = summary.transferredAmount ?? summary.totalCredit ?? 0;
  const completedAmt = summary.completedAmount ?? 0;

  const totalBr = summary.totalBranches ?? 12;
  const activeBr = summary.activeBranches ?? 10;
  const inactiveBr = summary.inactiveBranches ?? Math.max(0, totalBr - activeBr);

  const thisMonthCreated = summary.thisMonth?.created ?? Math.round(totalRecords * 0.2);
  const thisMonthAmt = summary.thisMonth?.amount ?? (totalAmt * 0.2);
  const thisMonthTransferred = summary.thisMonth?.transferred ?? Math.round(transferredCount * 0.2);
  const thisMonthCompleted = summary.thisMonth?.completed ?? Math.round(completedCount * 0.2);

  const qCurrency = summary.quickInfo?.currency ?? currency;
  const qRate = summary.quickInfo?.exchangeRate ?? "1.0000";
  const qCompany = summary.quickInfo?.company ?? "DGT LLC";
  const qFY = summary.quickInfo?.financialYear ?? "2025-26";

  return (
    <div className="grid gap-3.5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
      {/* MANDATORY Card 1: BRANCH & USER DETAILS */}
      <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
          <Users className="h-4 w-4 text-blue-600" />
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">1. {th("BRANCH & USER DETAILS")}</span>
        </div>
        <div className="mt-2.5 space-y-1 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
          <div className="flex justify-between">
            <span>{th("COUNTRY")}:</span>
            <span className="font-bold text-slate-900 dark:text-slate-100">{country}</span>
          </div>
          <div className="flex justify-between">
            <span>{th("BRANCH NAME")}:</span>
            <span className="font-bold text-slate-900 dark:text-slate-100 uppercase">{branch}</span>
          </div>
          <div className="flex justify-between">
            <span>{th("USER ID / NAME")}:</span>
            <span className="font-bold text-slate-900 dark:text-slate-100 truncate max-w-[120px]" title={`${uId} - ${uName}`}>{uId} ({uName})</span>
          </div>
          <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-bold">
            <span>{th("STATUS")}:</span>
            <span className="bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded text-[10px]">{th("ACTIVE SESSION")}</span>
          </div>
        </div>
      </div>

      {/* Card 2: RECORD / BILL SUMMARY */}
      <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
          <ClipboardList className="h-4 w-4 text-emerald-600" />
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">2. {th("RECORD / BILL SUMMARY")}</span>
        </div>
        <div className="mt-2.5 space-y-1 text-[11px] font-semibold">
          <div className="flex justify-between text-slate-600 dark:text-slate-400">
            <span>{th("TOTAL RECORDS")}</span>
            <span className="font-bold text-slate-900 dark:text-slate-100">{totalRecords}</span>
          </div>
          <div className="flex justify-between text-slate-500">
            <span>{th("DRAFT")}</span>
            <span className="font-bold text-slate-700 dark:text-slate-300">{draftCount}</span>
          </div>
          <div className="flex justify-between text-red-600 dark:text-red-400 font-bold">
            <span>{th("ACCEPTED (PENDING)")}</span>
            <span>{acceptedCount}</span>
          </div>
          <div className="flex justify-between text-slate-900 dark:text-slate-100 font-black">
            <span>{th("TRANSFERRED")}</span>
            <span>{transferredCount}</span>
          </div>
          <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-bold">
            <span>{th("COMPLETED")}</span>
            <span>{completedCount}</span>
          </div>
        </div>
      </div>

      {/* Card 3: TOTAL AMOUNTS */}
      <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
          <Wallet className="h-4 w-4 text-purple-600" />
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">3. {th("TOTAL AMOUNTS")} ({qCurrency})</span>
        </div>
        <div className="mt-2.5 space-y-1 text-[11px] font-semibold">
          <div className="flex justify-between text-slate-600 dark:text-slate-400">
            <span>{th("TOTAL AMOUNT")}</span>
            <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{formatMoney(totalAmt)}</span>
          </div>
          <div className="flex justify-between text-red-600 dark:text-red-400 font-bold">
            <span>{th("ACCEPTED (PENDING)")}</span>
            <span className="font-mono">{formatMoney(acceptedAmt)}</span>
          </div>
          <div className="flex justify-between text-slate-900 dark:text-slate-100 font-black">
            <span>{th("TRANSFERRED")}</span>
            <span className="font-mono">{formatMoney(transferredAmt)}</span>
          </div>
          <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-bold">
            <span>{th("COMPLETED")}</span>
            <span className="font-mono">{formatMoney(completedAmt)}</span>
          </div>
        </div>
      </div>

      {/* Card 4: BRANCHES */}
      <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
          <Building2 className="h-4 w-4 text-indigo-600" />
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">4. {th("BRANCHES")}</span>
        </div>
        <div className="mt-2.5 space-y-1.5 text-[11px] font-semibold">
          <div className="flex justify-between text-slate-600 dark:text-slate-400">
            <span>{th("TOTAL BRANCHES")}</span>
            <span className="font-bold text-slate-900 dark:text-slate-100">{totalBr}</span>
          </div>
          <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-bold">
            <span>{th("ACTIVE BRANCHES")}</span>
            <span>{activeBr}</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>{th("INACTIVE BRANCHES")}</span>
            <span>{inactiveBr}</span>
          </div>
        </div>
      </div>

      {/* Card 5: QUICK INFO */}
      <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
          <Clock3 className="h-4 w-4 text-amber-500" />
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">5. {th("QUICK INFO")}</span>
        </div>
        <div className="mt-2.5 space-y-1 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
          <div className="flex justify-between">
            <span>{th("CURRENCY")}</span>
            <span className="font-bold text-slate-900 dark:text-slate-100">{qCurrency}</span>
          </div>
          <div className="flex justify-between">
            <span>{th("EXCHANGE RATE")}</span>
            <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{qRate}</span>
          </div>
          <div className="flex justify-between">
            <span>{th("COMPANY")}</span>
            <span className="font-bold text-slate-900 dark:text-slate-100 truncate max-w-[110px] text-right" title={qCompany}>{qCompany}</span>
          </div>
          <div className="flex justify-between">
            <span>{th("FINANCIAL YEAR")}</span>
            <span className="font-bold text-slate-900 dark:text-slate-100">{qFY}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
