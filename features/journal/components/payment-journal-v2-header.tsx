"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Landmark,
  SlidersHorizontal,
  MoreVertical,
  Printer,
  Download,
  RefreshCw,
  Wallet,
  Globe,
  FileSpreadsheet,
  Bot,
  ArrowRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { translateHeader } from "@/lib/i18n/table-headers";

export interface PaymentJournalV2HeaderProps {
  title: string;
  breadcrumbs: { label: string; href?: string; active?: boolean }[];
  activeFiltersCount: number;
  onOpenFilters: () => void;
  onPrint: () => void;
  onExport: () => void;
  onRefresh: () => void;
  onBankingBalanceClick?: () => void;
  stats?: {
    bankBalance?: number;
    currency?: string;
    totalCompanies?: number;
    totalUsers?: number;
    totalAccounts?: number;
    transactionsInLedger?: number;
    pendingAiReview?: number;
    aiDocumentsProcessed?: number;
    pendingDocuments?: number;
  };
}

export function PaymentJournalV2Header({
  title,
  breadcrumbs,
  activeFiltersCount,
  onOpenFilters,
  onPrint,
  onExport,
  onRefresh,
  onBankingBalanceClick,
  stats
}: PaymentJournalV2HeaderProps) {
  const lang = useActiveLanguage();
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActionsMenuOpen(false);
      }
    }
    if (actionsMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [actionsMenuOpen]);

  const currency = stats?.currency || "AED";
  const formattedBalance = (stats?.bankBalance ?? 521921.27).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  const totalCompanies = stats?.totalCompanies ?? 1;
  const totalUsers = stats?.totalUsers ?? 5;
  const totalAccounts = (stats?.totalAccounts ?? 2856).toLocaleString();
  const ledgerTransactions = (stats?.transactionsInLedger ?? 12430).toLocaleString();
  const pendingAiReview = stats?.pendingAiReview ?? 18;
  const aiDocsProcessed = (stats?.aiDocumentsProcessed ?? 1245).toLocaleString();
  const pendingDocs = stats?.pendingDocuments ?? 42;

  return (
    <div className="w-full space-y-5 px-6 pt-6 pb-2">
      {/* ── TOP CONTROL ROW ── */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Left: Banking Balance Pill */}
        <div className="w-full md:w-auto flex justify-start">
          <button
            type="button"
            onClick={onBankingBalanceClick}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold shadow-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <Landmark className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <span>{translateHeader(lang, "Banking Balance")}</span>
          </button>
        </div>

        {/* Center: Clean Centered Title & Breadcrumbs */}
        <div className="text-center flex-1">
          <h1 className="text-2xl md:text-[26px] font-black tracking-tight text-slate-900 dark:text-white leading-tight">
            {title}
          </h1>
          <nav className="flex items-center justify-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium flex-wrap">
            {breadcrumbs.map((crumb, idx) => {
              const isLast = idx === breadcrumbs.length - 1;
              return (
                <React.Fragment key={crumb.label}>
                  {idx > 0 && <span className="text-slate-300 dark:text-slate-600">/</span>}
                  {crumb.href && !isLast ? (
                    <Link
                      href={crumb.href}
                      className="hover:text-blue-600 dark:hover:text-blue-400 transition"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className={cn(isLast ? "text-blue-600 dark:text-blue-400 font-bold" : "")}>
                      {crumb.label}
                    </span>
                  )}
                </React.Fragment>
              );
            })}
          </nav>
        </div>

        {/* Right: Filters Button + 3-Dot Action Menu */}
        <div className="w-full md:w-auto flex items-center justify-end gap-2.5">
          {/* Filters Button */}
          <button
            type="button"
            onClick={onOpenFilters}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#2563eb] hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition active:scale-[0.98] cursor-pointer"
          >
            <SlidersHorizontal className="h-3.5 w-3.5 shrink-0" />
            <span>{translateHeader(lang, "Filters")}</span>
            {activeFiltersCount > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[#2563eb] text-[11px] font-black">
                {activeFiltersCount}
              </span>
            )}
          </button>

          {/* Visible Print action (journal register print standard) */}
          <button
            type="button"
            onClick={onPrint}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold shadow-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition active:scale-[0.98] cursor-pointer"
          >
            <Printer className="h-3.5 w-3.5 shrink-0" />
            <span>{translateHeader(lang, "Print")}</span>
          </button>

          {/* Three-Dot Action Dropdown Menu */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setActionsMenuOpen((o) => !o)}
              aria-label="More options"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-xs transition cursor-pointer"
            >
              <MoreVertical className="h-4 w-4" />
            </button>

            {actionsMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-44 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-xl py-1.5 z-50 animate-in fade-in-50 zoom-in-95 duration-100">
                <button
                  type="button"
                  onClick={() => {
                    setActionsMenuOpen(false);
                    onPrint();
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition text-left cursor-pointer"
                >
                  <Printer className="h-4 w-4 text-slate-500" />
                  <span>{translateHeader(lang, "Print")}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActionsMenuOpen(false);
                    onExport();
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition text-left cursor-pointer"
                >
                  <Download className="h-4 w-4 text-slate-500" />
                  <span>{translateHeader(lang, "Export")}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActionsMenuOpen(false);
                    onRefresh();
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition text-left cursor-pointer border-t border-slate-100 dark:border-slate-800/80"
                >
                  <RefreshCw className="h-4 w-4 text-slate-500" />
                  <span>{translateHeader(lang, "Refresh")}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── 4 ENTERPRISE SUMMARY CARDS (MATCHING REFERENCE SCREENSHOT) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Card 1: BALANCE & USER DETAILS */}
        <div className="flex flex-col justify-between rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs hover:shadow-md transition">
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-600 text-white shadow-xs">
                <Wallet className="h-4 w-4" />
              </div>
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                {translateHeader(lang, "BALANCE & USER DETAILS")}
              </span>
            </div>

            <div className="mt-1">
              <div className="text-2xl font-black font-mono tracking-tight text-[#6d28d9] dark:text-purple-400">
                {formattedBalance}
              </div>
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                {translateHeader(lang, "Booked Bank Balance")}
              </div>
            </div>
          </div>

          <div className="pt-4 mt-3 border-t border-slate-100 dark:border-slate-800/80">
            <button
              type="button"
              onClick={onBankingBalanceClick}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
            >
              <span>{translateHeader(lang, "View Bank Balance Details")}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Card 2: GLOBAL FINANCIAL SUMMARY (AED) */}
        <div className="flex flex-col justify-between rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs hover:shadow-md transition">
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xs">
                <Globe className="h-4 w-4" />
              </div>
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                {translateHeader(lang, "GLOBAL FINANCIAL SUMMARY")} ({currency})
              </span>
            </div>

            <div className="space-y-2 text-xs font-semibold text-slate-600 dark:text-slate-300 mt-1">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 dark:text-slate-400">{translateHeader(lang, "Total Companies")}</span>
                <span className="font-bold font-mono text-slate-900 dark:text-white text-sm">{totalCompanies}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 dark:text-slate-400">{translateHeader(lang, "Total Users")}</span>
                <span className="font-bold font-mono text-slate-900 dark:text-white text-sm">{totalUsers}</span>
              </div>
            </div>
          </div>

          <div className="pt-4 mt-3 border-t border-slate-100 dark:border-slate-800/80">
            <div className="flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400">
              <span className="hover:underline cursor-pointer">{translateHeader(lang, "All Countries")}</span>
              <span className="text-slate-300 dark:text-slate-600">|</span>
              <span className="hover:underline cursor-pointer">{translateHeader(lang, "All Companies")}</span>
            </div>
          </div>
        </div>

        {/* Card 3: GL & SYSTEM SUMMARY */}
        <div className="flex flex-col justify-between rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs hover:shadow-md transition">
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500 text-white shadow-xs">
                <FileSpreadsheet className="h-4 w-4" />
              </div>
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                {translateHeader(lang, "GL & SYSTEM SUMMARY")}
              </span>
            </div>

            <div className="space-y-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 mt-1">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 dark:text-slate-400">{translateHeader(lang, "Total Accounts")}</span>
                <span className="font-bold font-mono text-slate-900 dark:text-white">{totalAccounts}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 dark:text-slate-400">{translateHeader(lang, "Transactions in Ledger")}</span>
                <span className="font-bold font-mono text-slate-900 dark:text-white">{ledgerTransactions}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 dark:text-slate-400">{translateHeader(lang, "Pending AI Review")}</span>
                <span className="font-bold font-mono text-slate-900 dark:text-white">{pendingAiReview}</span>
              </div>
            </div>
          </div>

          <div className="pt-3 mt-2 border-t border-slate-100 dark:border-slate-800/80 flex justify-end">
            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800 text-[10px] font-black uppercase tracking-wider">
              {translateHeader(lang, "ALL BRANCHES")}
            </span>
          </div>
        </div>

        {/* Card 4: AI & DOCUMENT REPORT */}
        <div className="flex flex-col justify-between rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs hover:shadow-md transition">
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-600 text-white shadow-xs">
                <Bot className="h-4 w-4" />
              </div>
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                {translateHeader(lang, "AI & DOCUMENT REPORT")}
              </span>
            </div>

            <div className="space-y-2 text-xs font-semibold text-slate-600 dark:text-slate-300 mt-1">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 dark:text-slate-400">{translateHeader(lang, "AI Documents Processed")}</span>
                <span className="font-bold font-mono text-slate-900 dark:text-white">{aiDocsProcessed}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 dark:text-slate-400">{translateHeader(lang, "Pending Documents")}</span>
                <span className="font-bold font-mono text-slate-900 dark:text-white">{pendingDocs}</span>
              </div>
            </div>
          </div>

          <div className="pt-4 mt-3 border-t border-slate-100 dark:border-slate-800/80">
            <Link
              href="/dashboard/document-intelligence"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
            >
              <span>{translateHeader(lang, "View Details")}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
