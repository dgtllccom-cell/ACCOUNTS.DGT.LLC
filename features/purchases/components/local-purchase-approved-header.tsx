"use client";

/**
 * Page top of the Local Purchase main page, in the approved Purchase Booking layout: title + Super Admin badge + breadcrumb,
 * one toolbar (Reports, Filter with count, search, Reset, Refresh, Apply, actions menu), a reports panel and the three cards
 * (Summary, Booking Status, Country Wise) rendered by PurchasePageTop. The filter panel is the same 3D modal the Purchase
 * Booking page uses. Every filter and action is the one the view already owns: this component only presents them.
 */

import { useEffect, useMemo, useState } from "react";
import { FileSpreadsheet, FileText, Plus, Printer, X } from "lucide-react";
import { PurchasePageTop, type PurchaseReportLink } from "@/components/purchase-ui/purchase-page-top";
import { PapMenu } from "@/components/purchase-ui/purchase-approved-header";
import type { PayRow } from "@/features/purchases/components/purchase-payments-approved-header";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { translateHeader } from "@/lib/i18n/table-headers";
import { countryLabel } from "@/lib/purchase-ui/country-name";

const COMPLETED_STATUSES = ["posted", "accepted", "transferred", "completed"];
const num = (v: unknown): number => {
  const x = Number(v ?? 0);
  return Number.isFinite(x) ? x : 0;
};
const costOf = (r: any): number => num(r.final_cost || r.finalCost || r.purchase_cost || r.purchaseCost);
const currencyOf = (r: any): string =>
  String(r.purchase_currency || r.purchaseCurrency || r.local_currency || r.localCurrency || "AED").toUpperCase();

/**
 * Registry rows in the shape PurchasePageTop reads (computePayTotals). The paid and balance figures are the ones this page has
 * always shown: the paid part of a bill goes in `advance` (local purchases have no separate remaining / credit split here) and
 * `due` is the bill cost minus that paid part. Nothing is posted, fetched or converted here.
 */
export function localPurchasesToPayRows(rows: readonly any[]): PayRow[] {
  return rows.map((r) => {
    const total = costOf(r);
    const st = String(r.status || r.bill_status || "").toLowerCase();
    const pMode = String(r.payment_mode || r.paymentMode || "").toLowerCase();
    const advanceAmount = num(r.advance_amount || r.advanceAmount);
    const completed = COMPLETED_STATUSES.includes(st);
    const paid =
      r.paid_amount !== undefined && r.paid_amount !== null ? Math.min(total, Math.max(0, num(r.paid_amount)))
      : pMode.includes("credit") ? 0
      : pMode.includes("advance") || pMode.includes("invoice") || pMode.includes("final") || pMode.includes("remaining") ? advanceAmount
      : completed || pMode === "cash" ? total
      : advanceAmount;
    return {
      country: String(r.country_name || r.countryName || "—"),
      currency: currencyOf(r),
      total,
      advance: paid,
      remainingPaid: 0,
      credit: 0,
      due: Math.max(0, total - paid),
      settled: completed,
    };
  });
}

type StageKey = "all" | "draft" | "pending" | "posted" | "accepted";
const STAGE_KEYS: StageKey[] = ["all", "draft", "pending", "posted", "accepted"];
const STAGE_LABEL: Record<StageKey, string> = { all: "All", draft: "Draft", pending: "Pending", posted: "Posted", accepted: "Accepted" };

/** Same stage rules the registry filter applies in local-purchase-view (registryFilter). */
function inStage(p: any, stage: StageKey): boolean {
  if (stage === "all") return true;
  const st = String(p.status || p.bill_status || "draft").toLowerCase();
  const transferred = st === "posted" || st === "transferred" || Boolean(p.transferred_at) || Boolean(p.roznamcha_entry_id);
  if (stage === "draft") return st === "draft";
  if (stage === "accepted") return st === "accepted";
  if (stage === "posted") return st === "posted" || transferred;
  return !(st === "posted" || transferred);
}

const FIELD_LABEL = "text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400";
const FIELD_CONTROL =
  "h-9 w-full rounded border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100";
const FOOTER_BUTTON = "h-8 px-3 inline-flex items-center rounded-lg text-xs font-bold cursor-pointer";

export interface LocalPurchaseApprovedHeaderProps {
  purchases: any[];
  filteredPurchases: any[];
  activeBranch?: any;
  session: any;
  scopeCountryName?: string;
  scopeBranchName?: string;
  usdRates: Record<string, number>;
  // Filter states & setters
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedSupplier: string;
  onSupplierChange: (s: string) => void;
  selectedGoodsId: string;
  onGoodsChange: (g: string) => void;
  selectedCountryId: string;
  onCountryChange: (c: string) => void;
  selectedBranchId: string;
  onBranchChange: (b: string) => void;
  selectedStatus: string;
  onStatusChange: (st: string) => void;
  selectedPaymentMode: string;
  onPaymentModeChange: (pm: string) => void;
  dateFrom: string;
  onDateFromChange: (d: string) => void;
  dateTo: string;
  onDateToChange: (d: string) => void;
  onResetFilters: () => void;
  // Options
  goodsList: any[];
  countryOptions: any[];
  countryBranches: any[];
  // Actions
  onNewPurchase: () => void;
  onPrint: () => void;
  onExportCsv: () => void;
  onExportPdf: () => void;
  // Reload the registry (same loader the view uses on mount)
  loading?: boolean;
  onRefresh?: () => void;
}

export function LocalPurchaseApprovedHeader({
  purchases,
  filteredPurchases,
  activeBranch,
  session,
  scopeCountryName,
  scopeBranchName,
  usdRates,
  searchQuery,
  onSearchChange,
  selectedSupplier,
  onSupplierChange,
  selectedGoodsId,
  onGoodsChange,
  selectedCountryId,
  onCountryChange,
  selectedBranchId,
  onBranchChange,
  selectedStatus,
  onStatusChange,
  selectedPaymentMode,
  onPaymentModeChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  onResetFilters,
  goodsList,
  countryOptions,
  countryBranches,
  onNewPurchase,
  onPrint,
  onExportCsv,
  onExportPdf,
  loading = false,
  onRefresh,
}: LocalPurchaseApprovedHeaderProps) {
  const s = useErpScreen("lp");
  const lang = s.lang;
  const tr = (label: string) => translateHeader(lang, label);

  const isSuperAdmin = Boolean(
    session?.isSuperAdmin ||
    session?.isSuperAdmin === true ||
    session?.scopes?.isSuperAdmin ||
    session?.isGlobalScope ||
    session?.roles?.some?.((r: string) => String(r).toLowerCase().includes("super_admin") || String(r).toLowerCase().includes("global")) ||
    String(session?.role || "").toLowerCase().includes("super_admin")
  );

  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    if (!filtersOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFiltersOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filtersOpen]);

  const rows = useMemo(() => localPurchasesToPayRows(filteredPurchases), [filteredPurchases]);

  // Toolbar badge: the filters that restrict the list. Search has its own box, so it is not counted.
  const activeFilterCount =
    [selectedSupplier, selectedGoodsId, selectedCountryId, selectedBranchId, dateFrom, dateTo].filter(Boolean).length +
    (selectedStatus && selectedStatus !== "all" ? 1 : 0);

  const uniqueSuppliers = useMemo(() => {
    const set = new Set<string>();
    purchases.forEach((p) => {
      const name = String(p.supplier_name || p.supplierName || "").trim();
      if (name) set.add(name);
    });
    return Array.from(set).sort();
  }, [purchases]);

  const stageOptions = useMemo(
    () => STAGE_KEYS.map((key) => ({ key, count: purchases.filter((p) => inStage(p, key)).length })),
    [purchases],
  );

  // Scope name for the title: a branch or country the view is filtered to (old header rule, same precedence).
  const scopeType: "branch" | "country" | "all" =
    selectedBranchId ? "branch"
    : selectedCountryId ? "country"
    : scopeBranchName && scopeBranchName !== "All Branches" ? "branch"
    : scopeCountryName && scopeCountryName !== "All Countries" ? "country"
    : "all";
  const scopeName =
    scopeType === "branch"
      ? countryBranches.find((b) => String(b.id) === String(selectedBranchId))?.name || scopeBranchName || activeBranch?.name || ""
      : scopeType === "country"
        ? countryOptions.find((c) => String(c.id) === String(selectedCountryId))?.name || scopeCountryName || ""
        : "";
  const pageTitle =
    scopeType === "all" || !scopeName
      ? tr("Local Purchase")
      : `${tr("Local Purchase")} - ${scopeType === "country" ? countryLabel(scopeName, s.t) : scopeName}`;

  const reportLinks: PurchaseReportLink[] = [
    { label: tr("Local Purchase Journal"), href: "/dashboard/purchase/local-purchase-journal-report" },
    { label: tr("Transfer & Payment"), href: "/dashboard/purchase/local-purchase-transfer-payment" },
    { label: tr("Local Purchase Loading"), href: "/dashboard/purchase/local-purchase-loading" },
    { label: tr("Local Purchase Export"), href: "/dashboard/purchase/local-purchase-export" },
  ];

  return (
    <>
      <PurchasePageTop
        lang={lang}
        title={pageTitle}
        superAdmin={isSuperAdmin}
        breadcrumb={[tr("Dashboard"), tr("Purchase & Trade"), tr("Local Purchase")]}
        rows={rows}
        rates={usdRates}
        reports={reportLinks}
        search={searchQuery}
        onSearch={onSearchChange}
        filterCount={activeFilterCount}
        onOpenFilters={() => setFiltersOpen(true)}
        onReset={onResetFilters}
        onRefresh={() => onRefresh?.()}
        onApply={() => setFiltersOpen(false)}
        loading={loading}
        menu={
          <PapMenu
            label={tr("Actions")}
            items={[
              { key: "new", label: tr("New Local Purchase"), icon: <Plus className="h-3.5 w-3.5" aria-hidden="true" />, onClick: onNewPurchase },
              { key: "csv", label: tr("Export CSV"), icon: <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden="true" />, onClick: onExportCsv },
              { key: "pdf", label: tr("Export PDF"), icon: <FileText className="h-3.5 w-3.5" aria-hidden="true" />, onClick: onExportPdf },
              { key: "print", label: tr("Print"), icon: <Printer className="h-3.5 w-3.5" aria-hidden="true" />, onClick: onPrint },
            ]}
          />
        }
      />

      {/* FILTER DIALOG (opened from the page toolbar): same 3D modal as the Purchase Booking page */}
      {filtersOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]"
          onClick={() => setFiltersOpen(false)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={tr("Filter")}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-5 shadow-[0_30px_60px_-20px_rgba(15,23,42,0.45),0_2px_0_0_#e2e8f0] dark:border-slate-800 dark:from-slate-950 dark:to-slate-900 animate-in fade-in duration-200"
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-black uppercase tracking-wide text-slate-800 dark:text-slate-100">{tr("Filter")}</span>
              <button
                type="button"
                onClick={() => setFiltersOpen(false)}
                aria-label={tr("Close")}
                className="h-8 w-8 inline-flex items-center justify-center rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 cursor-pointer dark:bg-slate-800 dark:text-slate-200"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <label className="space-y-1">
                <span className={FIELD_LABEL}>{tr("Select Stage")}</span>
                <select value={selectedStatus} onChange={(e) => onStatusChange(e.target.value)} aria-label={tr("Select Stage")} className={FIELD_CONTROL}>
                  {stageOptions.map((o) => (
                    <option key={o.key} value={o.key}>
                      {`${tr(STAGE_LABEL[o.key])} (${o.count})`}
                    </option>
                  ))}
                </select>
              </label>

              {isSuperAdmin ? (
                <label className="space-y-1">
                  <span className={FIELD_LABEL}>{tr("Country")}</span>
                  <select value={selectedCountryId} onChange={(e) => onCountryChange(e.target.value)} className={FIELD_CONTROL}>
                    <option value="">{tr("All Countries")}</option>
                    {countryOptions.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </label>
              ) : null}

              <label className="space-y-1">
                <span className={FIELD_LABEL}>{tr("Branch")}</span>
                <select value={selectedBranchId} onChange={(e) => onBranchChange(e.target.value)} className={FIELD_CONTROL}>
                  <option value="">{tr("All Branches")}</option>
                  {countryBranches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name || b.branchName || b.branch_name}</option>
                  ))}
                </select>
              </label>

              <label className="space-y-1">
                <span className={FIELD_LABEL}>{tr("Supplier")}</span>
                <select value={selectedSupplier} onChange={(e) => onSupplierChange(e.target.value)} className={FIELD_CONTROL}>
                  <option value="">{tr("All")}</option>
                  {uniqueSuppliers.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </label>

              <label className="space-y-1">
                <span className={FIELD_LABEL}>{tr("Goods")}</span>
                <select value={selectedGoodsId} onChange={(e) => onGoodsChange(e.target.value)} className={FIELD_CONTROL}>
                  <option value="">{tr("All")}</option>
                  {goodsList.map((g: any) => (
                    <option key={g.id} value={g.id}>{g.goods_name || g.goodsName || g.name}</option>
                  ))}
                </select>
              </label>

              <label className="space-y-1">
                <span className={FIELD_LABEL}>{tr("Payment Mode")}</span>
                <select value={selectedPaymentMode} onChange={(e) => onPaymentModeChange(e.target.value)} className={FIELD_CONTROL}>
                  <option value="all">{tr("All")}</option>
                  <option value="Cash">{tr("Cash")}</option>
                  <option value="Bank Transfer">{tr("Bank Transfer")}</option>
                  <option value="Advance">{tr("Advance")}</option>
                  <option value="Credit">{tr("Credit")}</option>
                </select>
              </label>

              <label className="space-y-1">
                <span className={FIELD_LABEL}>{tr("From Date")}</span>
                <input type="date" value={dateFrom} onChange={(e) => onDateFromChange(e.target.value)} className={FIELD_CONTROL} />
              </label>

              <label className="space-y-1">
                <span className={FIELD_LABEL}>{tr("To Date")}</span>
                <input type="date" value={dateTo} onChange={(e) => onDateToChange(e.target.value)} className={FIELD_CONTROL} />
              </label>
            </div>

            <div className="mt-3 flex justify-end gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
              <button
                type="button"
                onClick={onResetFilters}
                className={`${FOOTER_BUTTON} border border-slate-300 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200`}
              >
                {tr("Reset")}
              </button>
              <button
                type="button"
                onClick={() => setFiltersOpen(false)}
                className={`${FOOTER_BUTTON} bg-[#2563eb] text-white shadow-[0_3px_0_0_#1e40af]`}
              >
                {tr("Apply")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
