"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  ClipboardList,
  BadgeDollarSign,
  Building2,
  Calendar,
  Info,
  Search,
  Printer,
  RotateCcw,
  Plus,
  MoreVertical
} from "lucide-react";
import { t } from "@/lib/i18n/ui";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";

export interface UnifiedRegisterKpiData {
  totalRecords: number;
  draftCount: number;
  acceptedCount: number;
  transferredCount: number;
  completedCount: number;
  currency: string;
  totalAmount: number;
  acceptedAmount?: number;
  transferredAmount?: number;
  completedAmount?: number;
  totalBranches: number;
  activeBranches: number;
  inactiveBranches: number;
  thisMonthCreated: number;
  thisMonthAmount: number;
  thisMonthTransferred?: number;
  thisMonthCompleted?: number;
  quickInfo?: {
    currency?: string;
    exchangeRate?: string;
    company?: string;
    financialYear?: string;
    userName?: string;
    branchName?: string;
  };
}

export interface UnifiedErpRegisterBarProps {
  title: string;
  subtitle?: string;
  countries?: (string | { id: string; name: string })[];
  branches?: (string | { id: string; name: string })[];
  selectedCountry: string;
  selectedBranch: string;
  selectedStatus: string;
  onCountryChange: (val: string) => void;
  onBranchChange: (val: string) => void;
  onStatusChange: (val: string) => void;
  searchText: string;
  onSearchChange: (val: string) => void;
  searchPlaceholder?: string;
  onPrint?: () => void;
  onResetRefresh?: () => void;
  primaryAction?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };
  extraActions?: Array<{
    label: string;
    onClick: () => void;
  }>;
  kpiSummary: UnifiedRegisterKpiData;
  lockedCountry?: string;
  lockedBranch?: string;
  recordTypeName?: string; // e.g. "Bills", "Orders", "Entries"
}

function formatMoney(amount: number) {
  return Number(amount || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

export function UnifiedErpRegisterBar({
  title,
  subtitle,
  countries = [],
  branches = [],
  selectedCountry,
  selectedBranch,
  selectedStatus,
  onCountryChange,
  onBranchChange,
  onStatusChange,
  searchText,
  onSearchChange,
  searchPlaceholder,
  onPrint,
  onResetRefresh,
  primaryAction,
  extraActions,
  kpiSummary,
  lockedCountry,
  lockedBranch,
  recordTypeName
}: UnifiedErpRegisterBarProps) {
  const activeLang = useActiveLanguage();
  const [mounted, setMounted] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [titleSlot, setTitleSlot] = useState<HTMLElement | null>(null);
  const [actionsSlot, setActionsSlot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setMounted(true);
    setTitleSlot(document.getElementById("erp-page-title-slot"));
    setActionsSlot(document.getElementById("erp-page-actions-slot"));
  }, []);

  const headerTitleNode = (
    <div className="flex flex-col justify-center leading-tight">
      <h1 className="text-xs font-black tracking-tight text-slate-900 dark:text-slate-100 sm:text-sm">
        {title}
      </h1>
      {subtitle && (
        <p className="hidden truncate text-[9.5px] font-medium text-slate-400 sm:block">
          {subtitle}
        </p>
      )}
    </div>
  );

  const countryList = countries.map((c) =>
    typeof c === "string" ? { id: c, name: c } : c
  );
  const branchList = branches.map((b) =>
    typeof b === "string" ? { id: b, name: b } : b
  );

  const headerControlsNode = (
    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
      {/* Country Filter */}
      <select
        disabled={!!lockedCountry}
        value={selectedCountry}
        onChange={(e) => onCountryChange(e.target.value)}
        className="h-8 min-w-[125px] rounded-lg border border-slate-200 bg-white px-2.5 text-[10px] font-semibold text-slate-700 outline-none focus:border-blue-500 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
      >
        <option value="">{t(activeLang, "pb_register.select_country_all", "Select Country (All)")}</option>
        {countryList.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>

      {/* Branch Filter */}
      <select
        disabled={!!lockedBranch}
        value={selectedBranch}
        onChange={(e) => onBranchChange(e.target.value)}
        className="h-8 min-w-[125px] rounded-lg border border-slate-200 bg-white px-2.5 text-[10px] font-semibold text-slate-700 outline-none focus:border-blue-500 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
      >
        <option value="">{t(activeLang, "pb_register.select_branch_all", "Select Branch (All)")}</option>
        {branchList.map((b) => (
          <option key={b.id} value={b.id}>{b.name}</option>
        ))}
      </select>

      {/* Status Filter */}
      <select
        value={selectedStatus}
        onChange={(e) => onStatusChange(e.target.value)}
        className="h-8 min-w-[115px] rounded-lg border border-slate-200 bg-white px-2.5 text-[10px] font-semibold text-slate-700 outline-none focus:border-blue-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
      >
        <option value="">{t(activeLang, "pb_register.select_status_all", "Select Status (All)")}</option>
        <option value="Draft">{t(activeLang, "pb_register.status_draft", "Draft")}</option>
        <option value="Accepted">{t(activeLang, "pb_register.status_accepted", "Accepted")}</option>
        <option value="Transferred">{t(activeLang, "pb_register.status_transferred", "Transferred")}</option>
        <option value="Completed">{t(activeLang, "pb_register.status_completed", "Completed")}</option>
      </select>

      {/* Search Input */}
      <div className="relative min-w-[170px] sm:min-w-[210px]">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        <input
          value={searchText}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder || t(activeLang, "pb_register.search_placeholder", "Search booking, supplier, branch...")}
          className="h-8 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-2.5 text-[10px] font-semibold text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
        />
      </div>

      {/* Print */}
      {onPrint && (
        <button
          type="button"
          onClick={onPrint}
          className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[10px] font-bold text-slate-700 shadow-2xs hover:bg-slate-50 transition dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
        >
          <Printer className="h-3.5 w-3.5 text-slate-500" />
          <span>{t(activeLang, "common.print", "Print")}</span>
        </button>
      )}

      {/* Reset & Refresh */}
      {onResetRefresh && (
        <button
          type="button"
          onClick={onResetRefresh}
          className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[10px] font-bold text-slate-700 shadow-2xs hover:bg-slate-50 transition dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
        >
          <RotateCcw className="h-3.5 w-3.5 text-slate-500" />
          <span>{t(activeLang, "pb_register.reset_refresh", "Reset & Refresh")}</span>
        </button>
      )}

      {/* Extra Actions Menu */}
      {extraActions && extraActions.length > 0 && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowMore((prev) => !prev)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
          >
            <MoreVertical className="h-3.5 w-3.5" />
          </button>
          {showMore && (
            <div className="absolute right-0 top-full mt-1 z-50 w-44 rounded-xl border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-800 dark:bg-slate-900">
              {extraActions.map((act, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setShowMore(false);
                    act.onClick();
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  {act.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Primary Action Button */}
      {primaryAction && (
        <button
          type="button"
          onClick={primaryAction.onClick}
          className="flex h-8 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-[10px] font-bold text-white shadow-sm hover:bg-blue-700 transition"
        >
          {primaryAction.icon || <Plus className="h-3.5 w-3.5" />}
          <span>{primaryAction.label}</span>
        </button>
      )}
    </div>
  );

  return (
    <div className="space-y-3.5 mb-4">
      {/* Portaled Header or Fallback Inline Header */}
      {mounted && titleSlot ? createPortal(headerTitleNode, titleSlot) : null}
      {mounted && actionsSlot ? createPortal(headerControlsNode, actionsSlot) : null}

      {!titleSlot && (
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
          {headerTitleNode}
          {headerControlsNode}
        </div>
      )}

      {/* ── 5 Unified Top Summary KPI Cards Grid ── */}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
        {/* Card 1: BILL / RECORD SUMMARY */}
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <ClipboardList className="h-4 w-4 text-blue-600" />
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              {t(activeLang, "pb_register.card_bill_summary", "BILL SUMMARY")}
            </span>
          </div>
          <div className="mt-2.5 space-y-1 text-[11px] font-semibold">
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>{recordTypeName || t(activeLang, "pb_register.total_bills", "Total Bills")}</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">{kpiSummary.totalRecords}</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>{t(activeLang, "pb_register.status_draft", "Draft")}</span>
              <span className="font-bold text-slate-700 dark:text-slate-300">{kpiSummary.draftCount}</span>
            </div>
            <div className="flex justify-between text-red-600 dark:text-red-400 font-bold">
              <span>{t(activeLang, "pb_register.accepted_not_transferred", "Accepted (Not Transferred)")}</span>
              <span>{kpiSummary.acceptedCount}</span>
            </div>
            <div className="flex justify-between text-slate-900 dark:text-slate-100 font-black">
              <span>{t(activeLang, "pb_register.status_transferred", "Transferred")}</span>
              <span>{kpiSummary.transferredCount}</span>
            </div>
            <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-bold">
              <span>{t(activeLang, "pb_register.status_completed", "Completed")}</span>
              <span>{kpiSummary.completedCount}</span>
            </div>
          </div>
        </div>

        {/* Card 2: TOTAL AMOUNTS */}
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <BadgeDollarSign className="h-4 w-4 text-emerald-600" />
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              {t(activeLang, "pb_register.card_total_amounts", "TOTAL AMOUNTS")} ({kpiSummary.currency || "AED"})
            </span>
          </div>
          <div className="mt-2.5 space-y-1 text-[11px] font-semibold">
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>{t(activeLang, "pb_register.total_purchase_amount", "Total Purchase Amount")}</span>
              <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                {formatMoney(kpiSummary.totalAmount)}
              </span>
            </div>
            <div className="flex justify-between text-red-600 dark:text-red-400 font-bold">
              <span>{t(activeLang, "pb_register.accepted_not_transferred", "Accepted (Not Transferred)")}</span>
              <span className="font-mono">
                {formatMoney(kpiSummary.acceptedAmount ?? 0)}
              </span>
            </div>
            <div className="flex justify-between text-slate-900 dark:text-slate-100 font-black">
              <span>{t(activeLang, "pb_register.status_transferred", "Transferred")}</span>
              <span className="font-mono">
                {formatMoney(kpiSummary.transferredAmount ?? 0)}
              </span>
            </div>
            <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-bold">
              <span>{t(activeLang, "pb_register.status_completed", "Completed")}</span>
              <span className="font-mono">
                {formatMoney(kpiSummary.completedAmount ?? 0)}
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: BRANCHES */}
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <Building2 className="h-4 w-4 text-purple-600" />
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              {t(activeLang, "pb_register.card_branches", "BRANCHES")}
            </span>
          </div>
          <div className="mt-2.5 space-y-1 text-[11px] font-semibold">
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>{t(activeLang, "pb_register.total_branches", "Total Branches")}</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">{kpiSummary.totalBranches}</span>
            </div>
            <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-bold">
              <span>{t(activeLang, "pb_register.active_branches", "Active Branches")}</span>
              <span>{kpiSummary.activeBranches}</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>{t(activeLang, "pb_register.inactive_branches", "Inactive Branches")}</span>
              <span className="font-bold text-slate-700 dark:text-slate-300">{kpiSummary.inactiveBranches}</span>
            </div>
          </div>
        </div>

        {/* Card 4: THIS MONTH */}
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <Calendar className="h-4 w-4 text-orange-600" />
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              {t(activeLang, "pb_register.card_this_month", "THIS MONTH")}
            </span>
          </div>
          <div className="mt-2.5 space-y-1 text-[11px] font-semibold">
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>{t(activeLang, "pb_register.bills_created", "Bills Created")}</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">{kpiSummary.thisMonthCreated}</span>
            </div>
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>{t(activeLang, "pb_register.amount_label", "Amount")} ({kpiSummary.currency || "AED"})</span>
              <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                {formatMoney(kpiSummary.thisMonthAmount)}
              </span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>{t(activeLang, "pb_register.status_transferred", "Transferred")}</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">{kpiSummary.thisMonthTransferred ?? 0}</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>{t(activeLang, "pb_register.status_completed", "Completed")}</span>
              <span className="font-bold text-slate-700 dark:text-slate-300">{kpiSummary.thisMonthCompleted ?? 0}</span>
            </div>
          </div>
        </div>

        {/* Card 5: QUICK INFO */}
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <Info className="h-4 w-4 text-amber-600" />
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              {t(activeLang, "pb_register.card_quick_info", "QUICK INFO")}
            </span>
          </div>
          <div className="mt-2.5 space-y-1 text-[11px] font-semibold">
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>{t(activeLang, "pb_register.currency", "Currency")}</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">{kpiSummary.quickInfo?.currency || kpiSummary.currency || "AED"}</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>{t(activeLang, "pb_register.exchange_rate_avg", "Exchange Rate (Avg.)")}</span>
              <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{kpiSummary.quickInfo?.exchangeRate || "3.6725"}</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>{t(activeLang, "pb_register.company", "Company")}</span>
              <span className="font-bold text-slate-700 dark:text-slate-300 truncate max-w-[120px]" title={kpiSummary.quickInfo?.company || "DGT LLC"}>
                {kpiSummary.quickInfo?.company || "DGT LLC"}
              </span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>{t(activeLang, "pb_register.financial_year", "Financial Year")}</span>
              <span className="font-bold text-slate-700 dark:text-slate-300">{kpiSummary.quickInfo?.financialYear || "2026"}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
