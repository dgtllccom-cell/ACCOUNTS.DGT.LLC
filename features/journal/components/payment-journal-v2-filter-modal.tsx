"use client";

import React, { useState } from "react";
import {
  X,
  SlidersHorizontal,
  Search,
  Calendar,
  Building,
  MapPin,
  Users,
  Bookmark,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Check
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { translateHeader } from "@/lib/i18n/table-headers";
import { ErpDatePicker } from "@/components/ui/erp-date-picker";

export interface PaymentJournalV2FilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  country: string;
  onCountryChange: (val: string) => void;
  countryOptions: { label: string; value: string }[];
  branch: string;
  onBranchChange: (val: string) => void;
  branchOptions: { label: string; value: string }[];
  city: string;
  onCityChange: (val: string) => void;
  cityOptions?: { label: string; value: string }[];
  status: string;
  onStatusChange: (val: string) => void;
  dateRange: { from?: string | null; to?: string | null };
  onDateRangeChange: (from: string, to: string) => void;
  searchQuery: string;
  onSearchQueryChange: (val: string) => void;
  partyLabel: string; // "Supplier" or "Customer"
  partyValue: string;
  onPartyValueChange: (val: string) => void;
  partyOptions?: { label: string; value: string }[];
  onReset: () => void;
  onApply: () => void;
  onSaveFilter?: () => void;
}

export function PaymentJournalV2FilterModal({
  isOpen,
  onClose,
  country,
  onCountryChange,
  countryOptions,
  branch,
  onBranchChange,
  branchOptions,
  city,
  onCityChange,
  cityOptions = [],
  status,
  onStatusChange,
  dateRange,
  onDateRangeChange,
  searchQuery,
  onSearchQueryChange,
  partyLabel,
  partyValue,
  onPartyValueChange,
  partyOptions = [],
  onReset,
  onApply,
  onSaveFilter
}: PaymentJournalV2FilterModalProps) {
  const lang = useActiveLanguage();
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const quickStatuses = [
    { label: "All", value: "", bgActive: "bg-blue-600 text-white shadow-sm", bgInactive: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300" },
    { label: "Paid", value: "paid", bgActive: "bg-emerald-600 text-white shadow-sm", bgInactive: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800" },
    { label: "Partial", value: "partial", bgActive: "bg-amber-600 text-white shadow-sm", bgInactive: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200/80 dark:border-amber-800" },
    { label: "Pending", value: "pending", bgActive: "bg-sky-600 text-white shadow-sm", bgInactive: "bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-400 border border-sky-200/80 dark:border-sky-800" },
    { label: "Overdue", value: "overdue", bgActive: "bg-rose-600 text-white shadow-sm", bgInactive: "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200/80 dark:border-rose-800" },
  ];

  const handleSave = () => {
    try {
      const filterPreset = { country, branch, city, status, dateRange, partyValue, searchQuery };
      localStorage.setItem("dgt_erp_payment_journal_filter_preset", JSON.stringify(filterPreset));
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2000);
      onSaveFilter?.();
    } catch {}
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in-50 duration-150">
      <div
        className="w-full max-w-xl rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xl p-6 relative animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── HEADER ── */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-950 text-[#2563eb]">
              <SlidersHorizontal className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                {translateHeader(lang, "Search & Filters")}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {translateHeader(lang, "Set filters to view specific records")}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── 2-COLUMN GRID FORM ── */}
        <div className="py-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Country */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                {translateHeader(lang, "Country")}
              </label>
              <div className="relative">
                <select
                  value={country}
                  onChange={(e) => onCountryChange(e.target.value)}
                  className="w-full h-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                >
                  <option value="">{translateHeader(lang, "All Countries")}</option>
                  {countryOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Status */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                {translateHeader(lang, "Status")}
              </label>
              <select
                value={status}
                onChange={(e) => onStatusChange(e.target.value)}
                className="w-full h-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              >
                <option value="">{translateHeader(lang, "All")}</option>
                <option value="paid">{translateHeader(lang, "Paid")}</option>
                <option value="partial">{translateHeader(lang, "Partial")}</option>
                <option value="pending">{translateHeader(lang, "Pending")}</option>
                <option value="overdue">{translateHeader(lang, "Overdue")}</option>
              </select>
            </div>

            {/* Branch */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                {translateHeader(lang, "Branch")}
              </label>
              <select
                value={branch}
                onChange={(e) => onBranchChange(e.target.value)}
                className="w-full h-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              >
                <option value="">{translateHeader(lang, "All Branches")}</option>
                {branchOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Range */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                {translateHeader(lang, "Date Range")}
              </label>
              <div className="w-full">
                <ErpDatePicker
                  mode="range"
                  lang={lang}
                  size="sm"
                  value={{ from: dateRange.from || null, to: dateRange.to || null }}
                  onApply={(v) => onDateRangeChange(v.from ?? "", v.to ?? "")}
                />
              </div>
            </div>

            {/* City */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                {translateHeader(lang, "City")}
              </label>
              <select
                value={city}
                onChange={(e) => onCityChange(e.target.value)}
                className="w-full h-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              >
                <option value="">{translateHeader(lang, "All Cities")}</option>
                {cityOptions.length > 0 ? (
                  cityOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))
                ) : (
                  <>
                    <option value="Dubai">Dubai</option>
                    <option value="Lahore">Lahore</option>
                    <option value="Karachi">Karachi</option>
                    <option value="Kabul">Kabul</option>
                  </>
                )}
              </select>
            </div>

            {/* Search */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                {translateHeader(lang, "Search")}
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => onSearchQueryChange(e.target.value)}
                  placeholder={translateHeader(lang, "PO No, Invoice, Supplier, Reference...")}
                  className="w-full h-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 pl-9 pr-3 text-xs font-semibold text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>
            </div>

            {/* Supplier / Customer */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                {translateHeader(lang, partyLabel)}
              </label>
              <select
                value={partyValue}
                onChange={(e) => onPartyValueChange(e.target.value)}
                className="w-full h-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              >
                <option value="">{translateHeader(lang, `All ${partyLabel}s`)}</option>
                {partyOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quick Status Pills */}
          <div className="pt-2">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
              {translateHeader(lang, "Quick Status")}
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              {quickStatuses.map((qs) => {
                const isActive = (qs.value === "" && !status) || (qs.value && status === qs.value);
                return (
                  <button
                    key={qs.label}
                    type="button"
                    onClick={() => onStatusChange(qs.value)}
                    className={cn(
                      "px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer active:scale-95",
                      isActive ? qs.bgActive : qs.bgInactive
                    )}
                  >
                    {translateHeader(lang, qs.label)}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── FOOTER ACTIONS ── */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
          {/* Save Filter */}
          <button
            type="button"
            onClick={handleSave}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold transition cursor-pointer"
          >
            {savedSuccess ? <Check className="h-4 w-4 text-emerald-600" /> : <Bookmark className="h-4 w-4 text-blue-600" />}
            <span>{savedSuccess ? translateHeader(lang, "Saved!") : translateHeader(lang, "Save Filter")}</span>
          </button>

          {/* Reset & Apply */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold transition cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>{translateHeader(lang, "Reset")}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onApply();
                onClose();
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#2563eb] hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition active:scale-[0.98] cursor-pointer"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>{translateHeader(lang, "Apply Filters")}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
