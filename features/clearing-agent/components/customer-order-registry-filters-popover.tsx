"use client";

import React, { useEffect, useRef } from "react";
import { Filter, X, RotateCcw, Check } from "lucide-react";
import { t } from "@/lib/i18n/ui";
import type { SupportedLanguage } from "@/lib/i18n/languages";

export interface CustomerOrderFilterValues {
  status: string;
  movementType: string;
  countryId: string;
  branchId: string;
  fromDate?: string;
  toDate?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  lang: SupportedLanguage;
  values: CustomerOrderFilterValues;
  onChange: (vals: CustomerOrderFilterValues) => void;
  onReset: () => void;
  countries: { id: string; name: string }[];
  branches: { id: string; name: string }[];
}

export function CustomerOrderRegistryFiltersPopover({
  open,
  onClose,
  lang,
  values,
  onChange,
  onReset,
  countries,
  branches
}: Props) {
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);
  const tt = (key: string, fb: string) => t(lang, ("com." + key) as never, fb);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open, onClose]);

  if (!open) return null;

  const selectClass =
    "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";

  return (
    <div
      ref={popoverRef}
      dir={isRtl ? "rtl" : "ltr"}
      className="absolute right-0 top-full mt-2 z-50 w-[340px] sm:w-[380px] rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-800 dark:bg-slate-900 animate-in fade-in zoom-in-95 duration-150"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
            <Filter className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
              {tt("filter_orders_title", "Filter Orders")}
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {tt("filter_orders_subtitle", "Refine the list of customer orders")}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition"
          aria-label={tt("close", "Close")}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Filter Fields Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-3 text-xs">
        {/* Order Status */}
        <div>
          <label className="block text-[10.5px] font-bold uppercase text-slate-600 dark:text-slate-400 mb-1">
            {tt("order_status", "Order Status")}
          </label>
          <select
            value={values.status}
            onChange={(e) => onChange({ ...values, status: e.target.value })}
            className={selectClass}
          >
            <option value="all">{tt("all_statuses", "All Statuses")}</option>
            <option value="draft">{tt("status_draft", "Draft")}</option>
            <option value="booking_confirmed">{tt("status_confirmed", "Active / In Progress")}</option>
            <option value="pending_review">{tt("status_pending_review", "Pending Review")}</option>
            <option value="completed">{tt("status_completed", "Completed")}</option>
            <option value="pending_approval">{tt("status_pending_approval", "Pending Approval")}</option>
          </select>
        </div>

        {/* Movement Type */}
        <div>
          <label className="block text-[10.5px] font-bold uppercase text-slate-600 dark:text-slate-400 mb-1">
            {tt("movement_type", "Movement Type")}
          </label>
          <select
            value={values.movementType}
            onChange={(e) => onChange({ ...values, movementType: e.target.value })}
            className={selectClass}
          >
            <option value="all">{tt("all_movement_types", "All Movement Types")}</option>
            <option value="import">{tt("mov_import", "Import")}</option>
            <option value="export">{tt("mov_export", "Export")}</option>
            <option value="transit">{tt("mov_transit", "Transit")}</option>
            <option value="re_export">{tt("mov_re_export", "Re-Export")}</option>
          </select>
        </div>

        {/* Country */}
        <div>
          <label className="block text-[10.5px] font-bold uppercase text-slate-600 dark:text-slate-400 mb-1">
            {tt("country", "Country")}
          </label>
          <select
            value={values.countryId}
            onChange={(e) => onChange({ ...values, countryId: e.target.value })}
            className={selectClass}
          >
            <option value="all">{tt("all_countries", "All Countries")}</option>
            {countries.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Branch */}
        <div>
          <label className="block text-[10.5px] font-bold uppercase text-slate-600 dark:text-slate-400 mb-1">
            {tt("branch", "Branch")}
          </label>
          <select
            value={values.branchId}
            onChange={(e) => onChange({ ...values, branchId: e.target.value })}
            className={selectClass}
          >
            <option value="all">{tt("all_branches", "All Branches")}</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        {/* From Date */}
        <div>
          <label className="block text-[10.5px] font-bold uppercase text-slate-600 dark:text-slate-400 mb-1">
            {tt("from_date", "From Date")}
          </label>
          <input
            type="date"
            value={values.fromDate || ""}
            onChange={(e) => onChange({ ...values, fromDate: e.target.value })}
            className={selectClass}
          />
        </div>

        {/* To Date */}
        <div>
          <label className="block text-[10.5px] font-bold uppercase text-slate-600 dark:text-slate-400 mb-1">
            {tt("to_date", "To Date")}
          </label>
          <input
            type="date"
            value={values.toDate || ""}
            onChange={(e) => onChange({ ...values, toDate: e.target.value })}
            className={selectClass}
          />
        </div>
      </div>

      {/* Footer Actions */}
      <div className="flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 transition"
        >
          <RotateCcw className="h-3 w-3" />
          <span>{tt("reset", "Reset")}</span>
        </button>

        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-1.5 text-xs font-bold text-white shadow-sm shadow-blue-600/30 hover:bg-blue-700 transition"
        >
          <Check className="h-3.5 w-3.5" />
          <span>{tt("apply_filters", "Apply Filters")}</span>
        </button>
      </div>
    </div>
  );
}
