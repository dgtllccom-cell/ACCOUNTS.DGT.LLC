"use client";

import { useState } from "react";
import { Globe2, Building2, Users, Calendar, RefreshCw, Filter, X, ChevronDown, ChevronUp, Check, SlidersHorizontal } from "lucide-react";
import { t, type UiKey } from "@/lib/i18n/ui";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { cn } from "@/lib/utils";

export type ReportFilterValues = {
  countryId: string;
  mainBranchId: string;
  branchId: string;
  fromDate: string;
  toDate: string;
  currency: string;
  userId: string;
  reportType: string;
};

export type ReportMetaItem = {
  id: string;
  name: string;
  code?: string;
  country_id?: string;
  country_branch_id?: string;
};

type Props = {
  lang: SupportedLanguage;
  filters: ReportFilterValues;
  onFilterChange: (key: keyof ReportFilterValues, value: string) => void;
  onReset: () => void;
  onApply?: () => void;

  // Options
  countries: ReportMetaItem[];
  mainBranches: ReportMetaItem[];
  cityBranches: ReportMetaItem[];
  users: { id: string; name: string }[];
  currencies: { code: string; name: string }[];
  reportTypes: { key: string; icon: string }[];

  // Scope lock — non-editable if locked
  lockedCountryId?: string | null;
  lockedBranchId?: string | null;
  lockedCountryName?: string;
  lockedBranchName?: string;

  // What fields to show
  showCountryFilter?: boolean;
  showBranchFilter?: boolean;
  showUserFilter?: boolean;
  showCurrencyFilter?: boolean;
  showReportTypeFilter?: boolean;

  defaultOpen?: boolean;
};

export function ReportFilterBar({
  lang,
  filters,
  onFilterChange,
  onReset,
  onApply,
  countries,
  mainBranches,
  cityBranches,
  users,
  currencies,
  reportTypes,
  lockedCountryId,
  lockedBranchId,
  lockedCountryName,
  lockedBranchName,
  showCountryFilter = true,
  showBranchFilter = true,
  showUserFilter = false,
  showCurrencyFilter = false,
  showReportTypeFilter = true,
  defaultOpen = false
}: Props) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const _ = (key: UiKey, fallback?: string) => t(lang, key, fallback);

  const isCountryLocked = Boolean(lockedCountryId);
  const isBranchLocked = Boolean(lockedBranchId);

  // Filter branches based on selected country
  const filteredMainBranches = (mainBranches || []).filter(
    (mb) => !filters.countryId || filters.countryId === "all" || mb.country_id === filters.countryId
  );
  const filteredCityBranches = (cityBranches || []).filter((cb) => {
    if (filters.countryId && filters.countryId !== "all" && cb.country_id !== filters.countryId) return false;
    if (filters.mainBranchId && filters.mainBranchId !== "all" && cb.country_branch_id !== filters.mainBranchId) return false;
    return true;
  });

  const isRTL = ["ar", "ur", "fa", "ps"].includes(lang);

  // Active filter count
  let activeFilterCount = 0;
  if (filters.countryId && filters.countryId !== "all") activeFilterCount++;
  if (filters.mainBranchId && filters.mainBranchId !== "all") activeFilterCount++;
  if (filters.branchId && filters.branchId !== "all") activeFilterCount++;
  if (filters.fromDate) activeFilterCount++;
  if (filters.toDate) activeFilterCount++;
  if (filters.currency && filters.currency !== "all") activeFilterCount++;
  if (filters.userId && filters.userId !== "all") activeFilterCount++;

  // Label lookups for active chips
  const selectedReportTypeName = (reportTypes || []).find(rt => rt.key === filters.reportType)?.key || filters.reportType;
  const selectedCountryName = (countries || []).find(c => c.id === filters.countryId)?.name || "All Countries";
  const selectedBranchName = (cityBranches || []).find(b => b.id === filters.branchId)?.name || "All Branches";

  const handleApplyClick = () => {
    if (onApply) onApply();
    setIsOpen(false);
  };

  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200 bg-white/90 backdrop-blur-md shadow-sm dark:bg-slate-900/90 dark:border-slate-800 transition-all",
        "print:hidden"
      )}
      dir={isRTL ? "rtl" : "ltr"}
    >
      {/* Top Toggle Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 sm:px-5">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => setIsOpen(prev => !prev)}
            className="flex items-center gap-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800/60 px-3.5 py-2 text-xs font-black text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 transition-all shadow-sm"
          >
            <SlidersHorizontal className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <span>Filter Parameters</span>
            {activeFilterCount > 0 && (
              <span className="h-5 w-5 rounded-full bg-indigo-600 text-white text-[10px] font-black flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
            {isOpen ? <ChevronUp className="h-3.5 w-3.5 ml-1" /> : <ChevronDown className="h-3.5 w-3.5 ml-1" />}
          </button>

          {/* Quick Active Chips when collapsed */}
          {!isOpen && (
            <div className="hidden md:flex items-center gap-2 overflow-x-auto text-[11px] font-semibold text-slate-600 dark:text-slate-400">
              <span className="rounded-lg bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                Type: <strong className="text-indigo-600 dark:text-indigo-400 capitalize">{selectedReportTypeName.replace(/-/g, " ")}</strong>
              </span>
              <span className="rounded-lg bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                Country: <strong className="text-slate-900 dark:text-slate-100">{selectedCountryName}</strong>
              </span>
              <span className="rounded-lg bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                Branch: <strong className="text-slate-900 dark:text-slate-100">{selectedBranchName}</strong>
              </span>
              {filters.currency && (
                <span className="rounded-lg bg-slate-100 dark:bg-slate-800 px-2 py-1 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  Currency: <strong className="text-emerald-600 dark:text-emerald-400">{filters.currency}</strong>
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={onReset}
              className="flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-rose-600 px-2 py-1 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
              {_("report.filter_reset", "Reset")}
            </button>
          )}

          {onApply && (
            <button
              type="button"
              onClick={handleApplyClick}
              className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-black text-white hover:bg-indigo-700 shadow-sm transition-all"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {_("report.filter_apply", "Apply")}
            </button>
          )}
        </div>
      </div>

      {/* Collapsible Dropdown Curtain (پردہ / Popover Panel) */}
      {isOpen && (
        <div className="border-t border-slate-200 dark:border-slate-800 p-5 space-y-4 animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-indigo-500" />
              <span className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">
                {_("report.filter_report_type", "Select Parameters")}
              </span>
            </div>
            <p className="text-[11px] font-medium text-slate-400">
              Configure parameters and click Apply to refresh reports
            </p>
          </div>

          {/* Filter Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">

            {/* Report Type */}
            {showReportTypeFilter && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-500 flex items-center gap-1">
                  <Filter className="h-3 w-3 text-indigo-500" />
                  {_("report.filter_report_type")}
                </label>
                <select
                  value={filters.reportType}
                  onChange={(e) => onFilterChange("reportType", e.target.value)}
                  className="w-full text-xs font-semibold rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none dark:bg-slate-950 dark:border-slate-800 focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-200 shadow-sm"
                >
                  {reportTypes.map((rt) => (
                    <option key={rt.key} value={rt.key}>
                      {t(lang, `report.${rt.key.replace(/-/g, "_")}` as UiKey, rt.key)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Country */}
            {showCountryFilter && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-500 flex items-center gap-1">
                  <Globe2 className="h-3 w-3 text-emerald-500" />
                  {_("report.filter_country")}
                </label>
                {isCountryLocked ? (
                  <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 dark:bg-emerald-950/30 dark:border-emerald-900">
                    <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 truncate">
                      {lockedCountryName || _("report.filter_country")}
                    </span>
                    <span className="ml-auto text-[9px] font-black text-emerald-500 bg-emerald-100 px-1.5 py-0.5 rounded-full">LOCKED</span>
                  </div>
                ) : (
                  <select
                    value={filters.countryId}
                    onChange={(e) => {
                      onFilterChange("countryId", e.target.value);
                      onFilterChange("mainBranchId", "all");
                      onFilterChange("branchId", "all");
                    }}
                    className="w-full text-xs font-semibold rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none dark:bg-slate-950 dark:border-slate-800 focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-200 shadow-sm"
                  >
                    <option value="all">{_("report.filter_all_countries")}</option>
                    {countries.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {/* Main Branch */}
            {showBranchFilter && !isBranchLocked && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-500 flex items-center gap-1">
                  <Building2 className="h-3 w-3 text-blue-500" />
                  {_("report.filter_main_branch")}
                </label>
                <select
                  value={filters.mainBranchId}
                  onChange={(e) => {
                    onFilterChange("mainBranchId", e.target.value);
                    onFilterChange("branchId", "all");
                  }}
                  className="w-full text-xs font-semibold rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none dark:bg-slate-950 dark:border-slate-800 focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-200 shadow-sm"
                >
                  <option value="all">{_("report.filter_all_branches")}</option>
                  {filteredMainBranches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name} {b.code ? `(${b.code})` : ""}</option>
                  ))}
                </select>
              </div>
            )}

            {/* City Branch */}
            {showBranchFilter && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-500 flex items-center gap-1">
                  <Building2 className="h-3 w-3 text-violet-500" />
                  {_("report.filter_branch")}
                </label>
                {isBranchLocked ? (
                  <div className="flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2.5 dark:bg-violet-950/30 dark:border-violet-900">
                    <span className="text-xs font-bold text-violet-700 dark:text-violet-400 truncate">
                      {lockedBranchName || _("report.filter_branch")}
                    </span>
                    <span className="ml-auto text-[9px] font-black text-violet-500 bg-violet-100 px-1.5 py-0.5 rounded-full">LOCKED</span>
                  </div>
                ) : (
                  <select
                    value={filters.branchId}
                    onChange={(e) => onFilterChange("branchId", e.target.value)}
                    className="w-full text-xs font-semibold rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none dark:bg-slate-950 dark:border-slate-800 focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-200 shadow-sm"
                  >
                    <option value="all">{_("report.filter_all_branches")}</option>
                    {filteredCityBranches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name} {b.code ? `(${b.code})` : ""}</option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {/* Date From */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-slate-500 flex items-center gap-1">
                <Calendar className="h-3 w-3 text-orange-500" />
                {_("report.filter_date_from")}
              </label>
              <input
                type="date"
                value={filters.fromDate}
                onChange={(e) => onFilterChange("fromDate", e.target.value)}
                className="w-full text-xs font-semibold rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none dark:bg-slate-950 dark:border-slate-800 focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-200 shadow-sm"
              />
            </div>

            {/* Date To */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-slate-500 flex items-center gap-1">
                <Calendar className="h-3 w-3 text-rose-500" />
                {_("report.filter_date_to")}
              </label>
              <input
                type="date"
                value={filters.toDate}
                onChange={(e) => onFilterChange("toDate", e.target.value)}
                className="w-full text-xs font-semibold rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none dark:bg-slate-950 dark:border-slate-800 focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-200 shadow-sm"
              />
            </div>

            {/* Currency */}
            {showCurrencyFilter && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-500 flex items-center gap-1">
                  <span className="text-amber-500 font-black text-xs">$</span>
                  {_("report.filter_currency")}
                </label>
                <select
                  value={filters.currency}
                  onChange={(e) => onFilterChange("currency", e.target.value)}
                  className="w-full text-xs font-semibold rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none dark:bg-slate-950 dark:border-slate-800 focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-200 shadow-sm"
                >
                  <option value="all">{_("report.filter_all_currencies")}</option>
                  {currencies.map((c) => (
                    <option key={c.code} value={c.code}>{c.code} — {c.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* User Filter */}
            {showUserFilter && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-500 flex items-center gap-1">
                  <Users className="h-3 w-3 text-teal-500" />
                  {_("report.filter_user")}
                </label>
                <select
                  value={filters.userId}
                  onChange={(e) => onFilterChange("userId", e.target.value)}
                  className="w-full text-xs font-semibold rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none dark:bg-slate-950 dark:border-slate-800 focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-200 shadow-sm"
                >
                  <option value="all">{_("report.filter_all_users")}</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Action Row inside curtain */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onReset}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-rose-600 transition-colors"
            >
              <X className="h-4 w-4" />
              {_("report.filter_reset", "Reset All")}
            </button>

            <button
              type="button"
              onClick={handleApplyClick}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-5 py-2.5 text-xs font-black text-white shadow-md transition-all"
            >
              <Check className="h-4 w-4" />
              {_("report.filter_apply", "Apply & Refresh Reports")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
