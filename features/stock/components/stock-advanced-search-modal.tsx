"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Calendar, ChevronDown, Lock, RotateCcw, Search, X } from "lucide-react";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import type { PsFilterOptionSet } from "@/lib/services/ps-stock-journal-service";
import type { PsAdvancedFilters, PsStockStatusFilter } from "@/lib/stock/ps-journal-model";

interface SearchableOption {
  value: string;
  label: string;
  subLabel?: string;
}

function SearchableDropdown({
  label,
  value,
  allLabel,
  searchPlaceholder,
  noMatchLabel,
  options,
  locked,
  allowFreeText,
  onChange,
  testId,
}: {
  label: string;
  value: string;
  allLabel: string;
  searchPlaceholder: string;
  noMatchLabel: string;
  options: SearchableOption[];
  locked?: boolean;
  allowFreeText?: boolean;
  onChange: (next: string) => void;
  testId: string;
}) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, [open]);

  const selectedLabel = useMemo(() => {
    if (!value) return allLabel;
    const found = options.find((o) => o.value === value);
    return found ? found.label : value;
  }, [value, options, allLabel]);

  const filtered = useMemo(() => {
    const q = term.trim().toLowerCase();
    if (!q) return options.slice(0, 120);
    return options
      .filter(
        (o) =>
          o.label.toLowerCase().includes(q) ||
          (o.subLabel ? o.subLabel.toLowerCase().includes(q) : false),
      )
      .slice(0, 120);
  }, [options, term]);

  return (
    <div ref={rootRef} className="relative">
      <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-200">{label}</label>
      <button
        type="button"
        data-testid={testId}
        disabled={locked}
        onClick={() => {
          if (!locked) {
            setTerm("");
            setOpen((prev) => !prev);
          }
        }}
        className={`flex h-9 w-full items-center justify-between gap-2 rounded-lg border px-3 text-start text-xs font-medium transition ${
          locked
            ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300"
            : "cursor-pointer border-slate-300 bg-white text-slate-900 hover:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        }`}
      >
        <span className="truncate">{selectedLabel}</span>
        {locked ? (
          <Lock className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />
        )}
      </button>

      {open && !locked && (
        <div className="absolute start-0 top-full z-50 mt-1 w-full min-w-[220px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
          <div className="border-b border-slate-100 p-2 dark:border-slate-800">
            <div className="relative">
              <Search className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" aria-hidden />
              <input
                type="text"
                autoFocus
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder={searchPlaceholder}
                className="h-8 w-full rounded-md border border-slate-200 bg-slate-50 pe-2 ps-8 text-xs outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
          </div>
          <div className="max-h-52 overflow-y-auto py-1 text-xs">
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between px-3 py-1.5 text-start font-semibold hover:bg-blue-50 dark:hover:bg-slate-800 ${
                !value ? "bg-blue-50/70 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300" : "text-slate-700 dark:text-slate-200"
              }`}
            >
              <span>{allLabel}</span>
            </button>
            {allowFreeText && term.trim() && !options.some((o) => o.label.toLowerCase() === term.trim().toLowerCase()) && (
              <button
                type="button"
                onClick={() => {
                  onChange(term.trim());
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between px-3 py-1.5 text-start font-semibold text-blue-700 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-slate-800"
              >
                <span className="truncate">&ldquo;{term.trim()}&rdquo;</span>
              </button>
            )}
            {filtered.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-2 px-3 py-1.5 text-start hover:bg-blue-50 dark:hover:bg-slate-800 ${
                  value === opt.value
                    ? "bg-blue-50 font-bold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                    : "text-slate-700 dark:text-slate-200"
                }`}
              >
                <span className="truncate">{opt.label}</span>
                {opt.subLabel ? (
                  <span className="shrink-0 font-mono text-[10px] text-slate-400" dir="ltr">
                    {opt.subLabel}
                  </span>
                ) : null}
              </button>
            ))}
            {filtered.length === 0 && !allowFreeText && (
              <div className="px-3 py-2 text-slate-400">{noMatchLabel}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function countActivePsFilters(
  filters: PsAdvancedFilters,
  options?: PsFilterOptionSet | null,
): number {
  let n = 0;
  if (filters.countryId && filters.countryId !== options?.lockedCountryId) n += 1;
  if (filters.branchId && filters.branchId !== options?.lockedBranchId) n += 1;
  if (filters.warehouseId) n += 1;
  if (filters.goods) n += 1;
  if (filters.origin) n += 1;
  if (filters.lot) n += 1;
  if (filters.purchaseBill) n += 1;
  if (filters.salesBill) n += 1;
  if (filters.blNo) n += 1;
  if (filters.containerNo) n += 1;
  if (filters.stockStatus) n += 1;
  if (filters.dateFrom) n += 1;
  if (filters.dateTo) n += 1;
  return n;
}

export function defaultPsFilters(options?: PsFilterOptionSet | null): PsAdvancedFilters {
  return {
    countryId: options?.lockedCountryId ?? "",
    branchId: options?.lockedBranchId ?? "",
    warehouseId: "",
    goods: "",
    origin: "",
    lot: "",
    purchaseBill: "",
    salesBill: "",
    blNo: "",
    containerNo: "",
    stockStatus: "",
    dateFrom: "",
    dateTo: "",
  };
}

export function StockAdvancedSearchModal({
  open,
  lang,
  value,
  options,
  onApply,
  onReset,
  onClose,
}: {
  open: boolean;
  lang?: string;
  value: PsAdvancedFilters;
  options: PsFilterOptionSet | null;
  onApply: (next: PsAdvancedFilters) => void;
  onReset: (cleared: PsAdvancedFilters) => void;
  onClose: () => void;
}) {
  const s = useErpScreen("psj", lang);
  const [draft, setDraft] = useState<PsAdvancedFilters>(value);

  useEffect(() => {
    if (!open) return;
    setDraft({
      ...defaultPsFilters(options),
      ...value,
      countryId: options?.lockedCountryId || value.countryId || "",
      branchId: options?.lockedBranchId || value.branchId || "",
    });
  }, [open, value, options]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const countryLocked = Boolean(options?.lockedCountryId) || options?.role === "branch_admin";
  const branchLocked = Boolean(options?.lockedBranchId);

  const countryOpts: SearchableOption[] = (options?.countries ?? []).map((c) => ({
    value: c.id,
    label: c.name,
    subLabel: c.code || undefined,
  }));

  const branchOpts: SearchableOption[] = (options?.branches ?? [])
    .filter((b) => !draft.countryId || !b.countryId || b.countryId === draft.countryId)
    .map((b) => ({
      value: b.value,
      label: b.name,
      subLabel: b.code || undefined,
    }));

  const selectedCityBranchRaw = draft.branchId?.startsWith("city:") ? draft.branchId.slice(5) : "";
  const warehouseOpts: SearchableOption[] = (options?.warehouses ?? [])
    .filter((w) => (!draft.countryId || !w.countryId || w.countryId === draft.countryId))
    .filter((w) => (!selectedCityBranchRaw || !w.cityBranchId || w.cityBranchId === selectedCityBranchRaw))
    .map((w) => ({
      value: w.id,
      label: w.name,
    }));

  const goodsOpts: SearchableOption[] = (options?.goods ?? []).map((g) => ({ value: g, label: g }));
  const originOpts: SearchableOption[] = (options?.origins ?? []).map((o) => ({ value: o, label: o }));

  const statusOpts: SearchableOption[] = [
    { value: "available", label: s.t("st_available", "Available (In Stock)") },
    { value: "partial", label: s.t("st_partial", "Partially Sold") },
    { value: "sold_out", label: s.t("st_sold_out", "Sold Out (Zero Balance)") },
    { value: "negative", label: s.t("st_negative", "Negative / Over-Sold") },
    { value: "in_transit", label: s.t("st_in_transit", "In Transit") },
    { value: "not_loaded", label: s.t("st_not_loaded", "Not Loaded") },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onApply(draft);
    onClose();
  };

  const handleReset = () => {
    const cleared = defaultPsFilters(options);
    setDraft(cleared);
    onReset(cleared);
    onClose();
  };

  return (
    <div
      dir={s.dir}
      role="presentation"
      data-testid="stock-advanced-search-backdrop"
      onMouseDown={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-[1px] sm:p-5"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="stock-adv-search-title"
        data-testid="stock-advanced-search-modal"
        onMouseDown={(e) => e.stopPropagation()}
        className="w-full max-w-4xl overflow-visible rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
      >
        <header className="flex items-center justify-between gap-3 rounded-t-2xl bg-gradient-to-r from-[#0e2748] to-[#163b6d] px-5 py-3.5 text-white">
          <div className="flex items-center gap-2.5">
            <Search className="h-4 w-4 text-sky-300" aria-hidden />
            <h2 id="stock-adv-search-title" className="text-sm font-black tracking-wide sm:text-base">
              {s.t("adv_title", "Advanced Search & Filter")}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={s.t("btn_close", "Close")}
            className="grid h-7 w-7 cursor-pointer place-items-center rounded-lg text-white/80 transition hover:bg-white/15 hover:text-white"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4 p-4 sm:p-5">
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
            {/* 1. Country */}
            <SearchableDropdown
              testId="adv-country"
              label={s.t("f_country", "Country")}
              value={draft.countryId ?? ""}
              allLabel={s.t("all_countries", "All Countries")}
              searchPlaceholder={s.t("ph_search_country", "Search country...")}
              noMatchLabel={s.t("no_matches", "No matching options")}
              options={countryOpts}
              locked={countryLocked}
              onChange={(next) =>
                setDraft((d) => ({
                  ...d,
                  countryId: next,
                  branchId: options?.lockedBranchId || "",
                  warehouseId: "",
                }))
              }
            />

            {/* 2. Branch */}
            <SearchableDropdown
              testId="adv-branch"
              label={s.t("f_branch", "Branch")}
              value={draft.branchId ?? ""}
              allLabel={s.t("all_branches", "All Branches")}
              searchPlaceholder={s.t("ph_search_branch", "Search branch...")}
              noMatchLabel={s.t("no_matches", "No matching options")}
              options={branchOpts}
              locked={branchLocked}
              onChange={(next) => setDraft((d) => ({ ...d, branchId: next }))}
            />

            {/* 3. Warehouse */}
            <SearchableDropdown
              testId="adv-warehouse"
              label={s.t("f_warehouse", "Warehouse")}
              value={draft.warehouseId ?? ""}
              allLabel={s.t("all_warehouses", "All Warehouses")}
              searchPlaceholder={s.t("ph_search_warehouse", "Search warehouse...")}
              noMatchLabel={s.t("no_matches", "No matching options")}
              options={warehouseOpts}
              onChange={(next) => setDraft((d) => ({ ...d, warehouseId: next }))}
            />

            {/* 4. Goods */}
            <SearchableDropdown
              testId="adv-goods"
              label={s.t("f_goods", "Goods")}
              value={draft.goods ?? ""}
              allLabel={s.t("all_goods", "All Goods")}
              searchPlaceholder={s.t("ph_search_goods", "Search goods...")}
              noMatchLabel={s.t("no_matches", "No matching options")}
              options={goodsOpts}
              allowFreeText
              onChange={(next) => setDraft((d) => ({ ...d, goods: next }))}
            />

            {/* 5. Origin */}
            <SearchableDropdown
              testId="adv-origin"
              label={s.t("f_origin", "Origin")}
              value={draft.origin ?? ""}
              allLabel={s.t("all_origins", "All Origins")}
              searchPlaceholder={s.t("ph_search_origin", "Search origin...")}
              noMatchLabel={s.t("no_matches", "No matching options")}
              options={originOpts}
              allowFreeText
              onChange={(next) => setDraft((d) => ({ ...d, origin: next }))}
            />

            {/* 6. Lot Name */}
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-200">
                {s.t("f_lot_name", "Lot Name")}
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" aria-hidden />
                <input
                  type="text"
                  list="psj-lot-suggestions"
                  data-testid="adv-lot"
                  value={draft.lot ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, lot: e.target.value }))}
                  placeholder={s.t("ph_lot", "Search Lot ...")}
                  className="h-9 w-full rounded-lg border border-slate-300 bg-white pe-3 ps-8 text-xs text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
                <datalist id="psj-lot-suggestions">
                  {(options?.lots ?? []).slice(0, 150).map((lot) => (
                    <option key={lot} value={lot} />
                  ))}
                </datalist>
              </div>
            </div>

            {/* 7. Purchase Bill No. */}
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-200">
                {s.t("f_purchase_bill", "Purchase Bill No.")}
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" aria-hidden />
                <input
                  type="text"
                  data-testid="adv-purchase-bill"
                  value={draft.purchaseBill ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, purchaseBill: e.target.value }))}
                  placeholder={s.t("ph_purchase_bill", "Search P# ...")}
                  className="h-9 w-full rounded-lg border border-slate-300 bg-white pe-3 ps-8 text-xs text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            {/* 8. Sales Bill No. */}
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-200">
                {s.t("f_sales_bill", "Sales Bill No.")}
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" aria-hidden />
                <input
                  type="text"
                  data-testid="adv-sales-bill"
                  value={draft.salesBill ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, salesBill: e.target.value }))}
                  placeholder={s.t("ph_sales_bill", "Search S# ...")}
                  className="h-9 w-full rounded-lg border border-slate-300 bg-white pe-3 ps-8 text-xs text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            {/* 9. B/L No. */}
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-200">
                {s.t("f_bl_no", "B/L No.")}
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" aria-hidden />
                <input
                  type="text"
                  data-testid="adv-bl"
                  value={draft.blNo ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, blNo: e.target.value }))}
                  placeholder={s.t("ph_bl_no", "Search B/L ...")}
                  className="h-9 w-full rounded-lg border border-slate-300 bg-white pe-3 ps-8 text-xs text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            {/* 10. Container No. */}
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-200">
                {s.t("f_container_no", "Container No.")}
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" aria-hidden />
                <input
                  type="text"
                  data-testid="adv-container"
                  value={draft.containerNo ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, containerNo: e.target.value }))}
                  placeholder={s.t("ph_container_no", "Search Container ...")}
                  className="h-9 w-full rounded-lg border border-slate-300 bg-white pe-3 ps-8 text-xs text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            {/* 11. Stock Status */}
            <SearchableDropdown
              testId="adv-stock-status"
              label={s.t("f_stock_status", "Stock Status")}
              value={draft.stockStatus ?? ""}
              allLabel={s.t("all_lots", "All Lots")}
              searchPlaceholder={s.t("ph_search_status", "Search status...")}
              noMatchLabel={s.t("no_matches", "No matching options")}
              options={statusOpts}
              onChange={(next) => setDraft((d) => ({ ...d, stockStatus: next as PsStockStatusFilter }))}
            />

            {/* 12. Date From */}
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-200">
                {s.t("f_date_from", "Date From")}
              </label>
              <div className="relative">
                <Calendar className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" aria-hidden />
                <input
                  type="date"
                  data-testid="adv-date-from"
                  value={draft.dateFrom ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, dateFrom: e.target.value }))}
                  className="h-9 w-full rounded-lg border border-slate-300 bg-white pe-3 ps-8 text-xs text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            {/* 13. Date To */}
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-200">
                {s.t("f_date_to", "Date To")}
              </label>
              <div className="relative">
                <Calendar className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" aria-hidden />
                <input
                  type="date"
                  data-testid="adv-date-to"
                  value={draft.dateTo ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, dateTo: e.target.value }))}
                  className="h-9 w-full rounded-lg border border-slate-300 bg-white pe-3 ps-8 text-xs text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3.5 dark:border-slate-800">
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {options?.role === "super_admin"
                ? s.t("scope_note_super", "Scope: All authorized countries & branches")
                : options?.role === "country_admin"
                  ? s.t("scope_note_country", "Scope: Authorized country & branches")
                  : s.t("scope_note_branch", "Scope: Authorized branch only")}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="submit"
                data-testid="adv-btn-search"
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-blue-600 px-5 py-2 text-xs font-black text-white shadow-sm transition hover:bg-blue-700"
              >
                <Search className="h-3.5 w-3.5" aria-hidden />
                <span>{s.t("btn_search", "Search")}</span>
              </button>
              <button
                type="button"
                data-testid="adv-btn-reset"
                onClick={handleReset}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                <span>{s.t("btn_reset", "Reset")}</span>
              </button>
              <button
                type="button"
                data-testid="adv-btn-close"
                onClick={onClose}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
                <span>{s.t("btn_close", "Close")}</span>
              </button>
            </div>
          </div>
        </form>
      </section>
    </div>
  );
}
