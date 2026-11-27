"use client";

/**
 * P/S Journal — Purchase & Sales (Issue #263: /dashboard/stock/ps-journal)
 *
 * Inside the existing Stock menu:
 *   - Single "Search & Filter" dropdown button in header opening the reusable Advanced Search popup modal
 *   - Three upper summary cards: Purchase (P) [Green], Sales (S) [Red], Balance / Remaining Stock [Blue]
 *   - Country / Branch Summary table (with Country Wise / Branch Wise toggle)
 *   - Lot Wise Stock Register (every Lot Name clickable to open its Purchased Items & Sold Items report)
 *   - Enforces role-based permissions server-side on both register and lot detail views
 */

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Boxes,
  Building2,
  ChevronDown,
  Globe2,
  Loader2,
  Search,
  ShoppingCart,
  X,
} from "lucide-react";
import { apiGet } from "@/lib/api/client";
import { SavedText } from "@/components/i18n/saved-text";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { UniversalPrintActionButton } from "@/components/reports/universal-print-action-button";
import {
  StockAdvancedSearchModal,
  countActivePsFilters,
  defaultPsFilters,
} from "@/features/stock/components/stock-advanced-search-modal";
import type { PsFilterOptionSet } from "@/lib/services/ps-stock-journal-service";
import {
  formatUnitQty,
  hasNegativeUnit,
  type PsAdvancedFilters,
  type PsCardSummary,
  type PsLotDetailView,
  type PsLotRow,
  type PsPlaceSummaryRow,
  type StockRoleTier,
} from "@/lib/stock/ps-journal-model";

interface PsJournalListResponse {
  mode: "ps_journal";
  role: StockRoleTier;
  cards: {
    purchase: PsCardSummary;
    sales: PsCardSummary;
    balance: PsCardSummary;
  };
  countrySummary: PsPlaceSummaryRow[];
  branchSummary: PsPlaceSummaryRow[];
  lots: PsLotRow[];
  pagination: {
    page: number;
    limit: number;
    totalRecords: number;
    totalPages: number;
  };
  filterOptions: PsFilterOptionSet;
}

interface PsLotDetailResponse {
  mode: "lot_detail";
  role: StockRoleTier;
  detail: PsLotDetailView;
  filterOptions: PsFilterOptionSet;
}

const fmtNum = (v: number, digits = 2) =>
  v.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });

const fmtQtyPlain = (qty: number, unit: string) => {
  const formatted = qty.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return !unit || unit === "UNIT" ? formatted : `${formatted} ${unit}`;
};

export function PsJournalPurchaseSalesView({ lang: langProp }: { lang?: string }) {
  const s = useErpScreen("psj", langProp);
  const [data, setData] = useState<PsJournalListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<PsAdvancedFilters>({});
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Lot Detail Drilldown state
  const [activeLotKey, setActiveLotKey] = useState<string | null>(null);
  const [lotDetail, setLotDetail] = useState<PsLotDetailView | null>(null);
  const [lotLoading, setLotLoading] = useState(false);
  const [lotError, setLotError] = useState<string | null>(null);
  const [lotSearch, setLotSearch] = useState("");
  const [lotDateFrom, setLotDateFrom] = useState("");
  const [lotDateTo, setLotDateTo] = useState("");

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({
        mode: "ps_journal",
        page: String(page),
        limit: String(pageSize),
        lang: s.lang,
      });
      if (filters.countryId) qs.set("countryId", filters.countryId);
      if (filters.branchId) qs.set("branchId", filters.branchId);
      if (filters.warehouseId) qs.set("warehouseId", filters.warehouseId);
      if (filters.goods) qs.set("goods", filters.goods);
      if (filters.origin) qs.set("origin", filters.origin);
      if (filters.lot) qs.set("lot", filters.lot);
      if (filters.purchaseBill) qs.set("purchaseBill", filters.purchaseBill);
      if (filters.salesBill) qs.set("salesBill", filters.salesBill);
      if (filters.blNo) qs.set("blNo", filters.blNo);
      if (filters.containerNo) qs.set("containerNo", filters.containerNo);
      if (filters.stockStatus) qs.set("stockStatus", filters.stockStatus);
      if (filters.dateFrom) qs.set("dateFrom", filters.dateFrom);
      if (filters.dateTo) qs.set("dateTo", filters.dateTo);

      const res = await apiGet<PsJournalListResponse>(`/api/erp/stock/ps-journal?${qs.toString()}`);
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [filters, page, pageSize, s.lang]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const loadDetail = useCallback(async () => {
    if (!activeLotKey) return;
    setLotLoading(true);
    setLotError(null);
    try {
      const qs = new URLSearchParams({
        lotKey: activeLotKey,
        lang: s.lang,
      });
      if (filters.countryId) qs.set("countryId", filters.countryId);
      if (filters.branchId) qs.set("branchId", filters.branchId);
      if (lotSearch.trim()) qs.set("lotSearch", lotSearch.trim());
      if (lotDateFrom) qs.set("lotDateFrom", lotDateFrom);
      if (lotDateTo) qs.set("lotDateTo", lotDateTo);

      const res = await apiGet<PsLotDetailResponse>(`/api/erp/stock/ps-journal?${qs.toString()}`);
      setLotDetail(res.detail);
    } catch (e) {
      setLotError(e instanceof Error ? e.message : String(e));
    } finally {
      setLotLoading(false);
    }
  }, [activeLotKey, filters.countryId, filters.branchId, lotSearch, lotDateFrom, lotDateTo, s.lang]);

  useEffect(() => {
    if (activeLotKey) {
      void loadDetail();
    }
  }, [activeLotKey, loadDetail]);

  const cards = data?.cards;
  const roleTier = data?.role ?? "super_admin";
  const showPlaceCard = roleTier === "super_admin" || roleTier === "country_admin";
  const isCountryCard = roleTier === "super_admin";
  const placeCardRows = isCountryCard ? (data?.countrySummary ?? []) : (data?.branchSummary ?? []);
  const lots = data?.lots ?? [];
  const activeCount = countActivePsFilters(filters, data?.filterOptions);

  const registerPrintConfig = () => ({
    moduleType: "register" as const,
    reportType: "register" as const,
    title: s.t("psj_title", "P/S Journal — Purchase & Sales"),
    subtitle: s.t("psj_lot_table_title", "Lot Wise Stock Register"),
    lang: s.lang,
    orientation: "landscape" as const,
    kpis: cards
      ? [
          {
            label: `${s.t("card_purchase_bills", "Total Purchase Bills")}: ${cards.purchase.bills}`,
            value: `${formatUnitQty(cards.purchase.qtyByUnit)} · ${fmtNum(cards.purchase.netKg)} kg`,
            color: "emerald" as const,
          },
          {
            label: `${s.t("card_sales_bills", "Total Sales Bills")}: ${cards.sales.bills}`,
            value: `${formatUnitQty(cards.sales.qtyByUnit)} · ${fmtNum(cards.sales.netKg)} kg`,
            color: "red" as const,
          },
          {
            label: `${s.t("card_remaining_stock", "Remaining Stock")} (${s.t("lbl_lots", "Lots")}: ${cards.balance.lots})`,
            value: `${formatUnitQty(cards.balance.qtyByUnit)} · ${fmtNum(cards.balance.netKg)} kg`,
            color: "blue" as const,
          },
        ]
      : [],
    columns: [
      { key: "lotName", label: s.t("col_lot_name", "Lot Name") },
      { key: "goodsName", label: s.t("col_goods_name", "Goods Name") },
      { key: "origin", label: s.t("col_origin", "Origin") },
      { key: "pQty", label: s.t("col_p_qty", "P Qty"), align: "right" as const },
      { key: "pGross", label: s.t("col_p_gross", "P Gross (Kg)"), align: "right" as const },
      { key: "pNet", label: s.t("col_p_net", "P Net (Kg)"), align: "right" as const },
      { key: "sQty", label: s.t("col_s_qty", "S Qty"), align: "right" as const },
      { key: "sGross", label: s.t("col_s_gross", "S Gross (Kg)"), align: "right" as const },
      { key: "sNet", label: s.t("col_s_net", "S Net (Kg)"), align: "right" as const },
      { key: "balQty", label: s.t("col_bal_qty", "Bal Qty"), align: "right" as const },
      { key: "balGross", label: s.t("col_bal_gross", "Bal Gross (Kg)"), align: "right" as const },
      { key: "balNet", label: s.t("col_bal_net", "Bal Net (Kg)"), align: "right" as const },
    ],
    rows: lots.map((l) => ({
      lotName: l.lotName,
      goodsName: l.goodsName,
      origin: l.origin,
      pQty: formatUnitQty(l.pQtyByUnit),
      pGross: fmtNum(l.pGrossKg),
      pNet: fmtNum(l.pNetKg),
      sQty: formatUnitQty(l.sQtyByUnit),
      sGross: fmtNum(l.sGrossKg),
      sNet: fmtNum(l.sNetKg),
      balQty: formatUnitQty(l.balQtyByUnit),
      balGross: fmtNum(l.balGrossKg),
      balNet: fmtNum(l.balNetKg),
    })),
  });

  const lotDetailPrintConfig = () => {
    const d = lotDetail;
    return {
      moduleType: "register" as const,
      reportType: "register" as const,
      title: `${s.t("lot_detail_title", "Lot Stock Report")} — ${d?.lot.lotName ?? ""}`,
      subtitle: [d?.lot.goodsName, d?.lot.countryName, d?.lot.branchName].filter(Boolean).join(" · "),
      lang: s.lang,
      orientation: "landscape" as const,
      kpis: d
        ? [
            { label: s.t("band_purchase", "Purchase (P)"), value: `${formatUnitQty(d.lot.pQtyByUnit)} · ${fmtNum(d.lot.pNetKg)} kg`, color: "emerald" as const },
            { label: s.t("band_sales", "Sales (S)"), value: `${formatUnitQty(d.lot.sQtyByUnit)} · ${fmtNum(d.lot.sNetKg)} kg`, color: "red" as const },
            { label: s.t("band_balance", "Balance"), value: `${formatUnitQty(d.lot.balQtyByUnit)} · ${fmtNum(d.lot.balNetKg)} kg`, color: "blue" as const },
          ]
        : [],
      columns: [
        { key: "side", label: s.t("col_entry_type", "Type") },
        { key: "ref", label: s.t("col_entry_ref", "Entry Reference") },
        { key: "date", label: s.t("col_date", "Date") },
        { key: "account", label: s.t("col_account", "Account No. / Name") },
        { key: "goods", label: s.t("col_goods_name", "Goods Name") },
        { key: "size", label: s.t("col_size", "Size") },
        { key: "brand", label: s.t("col_brand", "Brand") },
        { key: "origin", label: s.t("col_origin", "Origin") },
        { key: "qty", label: s.t("lbl_qty", "Qty"), align: "right" as const },
        { key: "gross", label: s.t("lbl_gross_wt_kg", "Gross Wt (Kg)"), align: "right" as const },
        { key: "net", label: s.t("lbl_net_wt_kg", "Net Wt (Kg)"), align: "right" as const },
      ],
      rows: [
        ...(d?.purchasedItems ?? []).map((p) => ({
          side: `[P] ${p.entryType}`,
          ref: p.entryRef,
          date: p.date ?? "—",
          account: [p.accountNo, p.accountName].filter((x) => x && x !== "—").join(" · ") || "—",
          goods: p.goodsName,
          size: p.size,
          brand: p.brand,
          origin: p.origin,
          qty: fmtQtyPlain(p.qty, p.unit),
          gross: fmtNum(p.grossKg),
          net: fmtNum(p.netKg),
        })),
        ...(d?.soldItems ?? []).map((si) => ({
          side: `[S] ${si.saleType}`,
          ref: si.salesBillNo,
          date: si.date ?? "—",
          account: [si.accountNo, si.accountName].filter((x) => x && x !== "—").join(" · ") || "—",
          goods: si.goodsName,
          size: si.size || "—",
          brand: si.brand || "—",
          origin: si.origin || "—",
          qty: fmtQtyPlain(si.qty, si.unit),
          gross: fmtNum(si.grossKg),
          net: fmtNum(si.netKg),
        })),
      ],
    };
  };

  // ── LOT DETAIL DRILLDOWN VIEW (Summary on Left, Purchased Items above Sold Items on Right) ──
  if (activeLotKey) {
    const lot = lotDetail?.lot;
    return (
      <div
        dir={s.dir}
        data-page-chrome="true"
        data-testid="psj-lot-detail"
        className="mx-auto max-w-[1920px] space-y-4 p-2.5 text-slate-800 sm:p-4 dark:text-slate-100"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              data-testid="psj-lot-back"
              onClick={() => {
                setActiveLotKey(null);
                setLotDetail(null);
                setLotSearch("");
                setLotDateFrom("");
                setLotDateTo("");
              }}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-black text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <ArrowLeft className={`h-3.5 w-3.5 ${s.isRtl ? "rotate-180" : ""}`} aria-hidden />
              <span>{s.t("btn_back", "Back")}</span>
            </button>
            <div>
              <div className="text-[11px] font-semibold text-slate-500">
                {s.t("psj_title", "P/S Journal — Purchase & Sales")} › {s.t("lot_detail_title", "Lot Stock Report")}
              </div>
              <h1 className="font-mono text-lg font-black text-blue-800 dark:text-blue-300" dir="ltr">
                {lot?.lotName ?? activeLotKey}
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" aria-hidden />
              <input
                type="text"
                data-testid="psj-lot-search"
                value={lotSearch}
                onChange={(e) => setLotSearch(e.target.value)}
                placeholder={s.t("ph_lot_detail_search", "Search bill, account, B/L...")}
                className="h-8 w-48 rounded-lg border border-slate-300 bg-white pe-2.5 ps-8 text-xs outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <input
              type="date"
              aria-label={s.t("f_date_from", "Date From")}
              value={lotDateFrom}
              onChange={(e) => setLotDateFrom(e.target.value)}
              className="h-8 rounded-lg border border-slate-300 bg-white px-2.5 text-xs dark:border-slate-700 dark:bg-slate-800"
            />
            <input
              type="date"
              aria-label={s.t("f_date_to", "Date To")}
              value={lotDateTo}
              onChange={(e) => setLotDateTo(e.target.value)}
              className="h-8 rounded-lg border border-slate-300 bg-white px-2.5 text-xs dark:border-slate-700 dark:bg-slate-800"
            />
            <UniversalPrintActionButton variant="menu" reportConfig={lotDetailPrintConfig} />
          </div>
        </div>

        {lotError ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
            {lotError}
          </div>
        ) : null}

        {lotLoading && !lotDetail ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : lot ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
            {/* LEFT: Lot Summary Panel */}
            <aside className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <div className="border-b border-slate-100 pb-2.5 dark:border-slate-800">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  {s.t("lot_summary_heading", "Lot Summary")}
                </span>
                <div className="mt-0.5 font-mono text-base font-black text-slate-950 dark:text-white" dir="ltr">
                  {lot.lotName}
                </div>
                <div className="mt-1 text-xs font-semibold text-slate-600 dark:text-slate-300">{lot.goodsName}</div>
              </div>

              <dl className="space-y-1.5 text-xs">
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">{s.t("f_country", "Country")}</dt>
                  <dd className="font-bold">{lot.countryName}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">{s.t("f_branch", "Branch")}</dt>
                  <dd className="font-bold">{lot.branchName}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">{s.t("f_warehouse", "Warehouse")}</dt>
                  <dd className="font-bold">{lot.warehouseName || "—"}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">{s.t("col_origin", "Origin")}</dt>
                  <dd className="font-bold">{lot.origin}</dd>
                </div>
                {(lot.brand || lot.size) && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-500">
                      {s.t("col_brand", "Brand")} / {s.t("col_size", "Size")}
                    </dt>
                    <dd className="font-bold">{[lot.brand, lot.size].filter(Boolean).join(" · ")}</dd>
                  </div>
                )}
              </dl>

              {/* Green Purchase Summary */}
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 dark:border-emerald-900/60 dark:bg-emerald-950/30">
                <div className="flex items-center justify-between text-xs font-black text-emerald-800 dark:text-emerald-300">
                  <span>{s.t("band_purchase", "Purchase (P)")}</span>
                  <span>
                    {lotDetail?.purchasedItems.length ?? 0} {s.t("lbl_entries", "entries")}
                  </span>
                </div>
                <div className="mt-1.5 font-mono text-sm font-black text-emerald-700 dark:text-emerald-200" dir="ltr">
                  {formatUnitQty(lot.pQtyByUnit)}
                </div>
                <div className="mt-1 flex justify-between text-[11px] font-semibold text-emerald-800/80 dark:text-emerald-300/80" dir="ltr">
                  <span>G: {fmtNum(lot.pGrossKg)} kg</span>
                  <span>N: {fmtNum(lot.pNetKg)} kg</span>
                </div>
              </div>

              {/* Red Sales Summary */}
              <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-3 dark:border-rose-900/60 dark:bg-rose-950/30">
                <div className="flex items-center justify-between text-xs font-black text-rose-800 dark:text-rose-300">
                  <span>{s.t("band_sales", "Sales (S)")}</span>
                  <span>
                    {lotDetail?.soldItems.length ?? 0} {s.t("lbl_entries", "entries")}
                  </span>
                </div>
                <div className="mt-1.5 font-mono text-sm font-black text-rose-700 dark:text-rose-200" dir="ltr">
                  {formatUnitQty(lot.sQtyByUnit)}
                </div>
                <div className="mt-1 flex justify-between text-[11px] font-semibold text-rose-800/80 dark:text-rose-300/80" dir="ltr">
                  <span>G: {fmtNum(lot.sGrossKg)} kg</span>
                  <span>N: {fmtNum(lot.sNetKg)} kg</span>
                </div>
              </div>

              {/* Transfers / Adjustments if non-zero */}
              {(Object.keys(lot.transferredQtyByUnit).length > 0 || Object.keys(lot.adjustedQtyByUnit).length > 0) && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs dark:border-amber-900/60 dark:bg-amber-950/30">
                  <div className="font-black text-amber-800 dark:text-amber-300">
                    {s.t("lbl_transfers_adjustments", "Transfers & Adjustments")}
                  </div>
                  {Object.keys(lot.transferredQtyByUnit).length > 0 && (
                    <div className="mt-1 flex justify-between">
                      <span>{s.t("lbl_transferred_out", "Branch Transfer Out")}</span>
                      <span className="font-mono font-bold" dir="ltr">
                        {formatUnitQty(lot.transferredQtyByUnit)}
                      </span>
                    </div>
                  )}
                  {Object.keys(lot.adjustedQtyByUnit).length > 0 && (
                    <div className="mt-1 flex justify-between">
                      <span>{s.t("lbl_damage_loss", "Damage / Loss")}</span>
                      <span className="font-mono font-bold" dir="ltr">
                        {formatUnitQty(lot.adjustedQtyByUnit)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Blue Balance Summary */}
              <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3 dark:border-blue-900/60 dark:bg-blue-950/30">
                <div className="text-xs font-black text-blue-800 dark:text-blue-300">
                  {s.t("band_balance", "Balance")} ({s.t("card_remaining_stock", "Remaining Stock")})
                </div>
                <div
                  className={`mt-1.5 font-mono text-sm font-black ${
                    lot.hasNegativeBalance ? "text-rose-600 dark:text-rose-400" : "text-blue-800 dark:text-blue-200"
                  }`}
                  dir="ltr"
                >
                  {formatUnitQty(lot.balQtyByUnit)}
                </div>
                <div className="mt-1 flex justify-between text-[11px] font-semibold text-blue-800/80 dark:text-blue-300/80" dir="ltr">
                  <span>G: {fmtNum(lot.balGrossKg)} kg</span>
                  <span>N: {fmtNum(lot.balNetKg)} kg</span>
                </div>
              </div>

              {lot.hasNegativeBalance && (
                <div className="flex items-start gap-2 rounded-xl border border-rose-300 bg-rose-50 p-3 text-[11px] font-semibold text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" aria-hidden />
                  <span>
                    {s.t(
                      "neg_balance_explain",
                      "Negative balance preserved: recorded sales or issues exceed the recorded purchased/loaded quantity on this lot.",
                    )}
                  </span>
                </div>
              )}
            </aside>

            {/* RIGHT: Purchased Items ABOVE Sold Items */}
            <div className="min-w-0 space-y-4">
              {/* 1. Purchased Items Table (Green) */}
              <section className="overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-xs dark:border-emerald-900/60 dark:bg-slate-900">
                <div className="flex items-center justify-between bg-emerald-700 px-4 py-2.5 text-white">
                  <h2 className="text-xs font-black uppercase tracking-wider">
                    {s.t("sec_purchased_items", "Purchased Items")}
                  </h2>
                  <span className="text-[11px] font-bold">
                    {lotDetail?.purchasedItems.length ?? 0} {s.t("lbl_records", "records")}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[980px] border-collapse text-xs" data-testid="psj-lot-purchased-table">
                    <thead className="border-b border-emerald-200 bg-emerald-50/80 text-[11px] font-black text-emerald-950 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
                      <tr className="divide-x divide-emerald-200/80 dark:divide-emerald-900/50">
                        <th className="px-2.5 py-2 text-start">{s.t("col_entry_ref", "Entry Reference")}</th>
                        <th className="px-2.5 py-2 text-start">{s.t("col_entry_type", "Type")}</th>
                        <th className="px-2.5 py-2 text-start">{s.t("col_date", "Date")}</th>
                        <th className="px-2.5 py-2 text-start">{s.t("col_account", "Account No. / Name")}</th>
                        <th className="px-2.5 py-2 text-start">{s.t("col_bl_container", "B/L · Container")}</th>
                        <th className="px-2.5 py-2 text-start">{s.t("col_goods_name", "Goods Name")}</th>
                        <th className="px-2.5 py-2 text-start">{s.t("col_size", "Size")}</th>
                        <th className="px-2.5 py-2 text-start">{s.t("col_brand", "Brand")}</th>
                        <th className="px-2.5 py-2 text-start">{s.t("col_origin", "Origin")}</th>
                        <th className="px-2.5 py-2 text-end">{s.t("lbl_qty", "Qty")}</th>
                        <th className="px-2.5 py-2 text-end">{s.t("lbl_gross_wt_kg", "Gross Wt (Kg)")}</th>
                        <th className="px-2.5 py-2 text-end">{s.t("lbl_net_wt_kg", "Net Wt (Kg)")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {(lotDetail?.purchasedItems ?? []).length === 0 ? (
                        <tr>
                          <td colSpan={12} className="p-6 text-center text-slate-400">
                            {s.t("no_purchased_items", "No purchased item entries recorded on this lot.")}
                          </td>
                        </tr>
                      ) : (
                        (lotDetail?.purchasedItems ?? []).map((p) => (
                          <tr key={p.chunkId} className="divide-x divide-slate-200 hover:bg-emerald-50/30 dark:divide-slate-800 dark:hover:bg-slate-800/40">
                            <td className="whitespace-nowrap px-2.5 py-2 font-mono font-bold text-emerald-800 dark:text-emerald-300" dir="ltr">
                              {p.entryRef}
                            </td>
                            <td className="whitespace-nowrap px-2.5 py-2 text-[11px] font-semibold">{p.entryType}</td>
                            <td className="whitespace-nowrap px-2.5 py-2 font-mono text-[11px]" dir="ltr">
                              {p.date ?? "—"}
                            </td>
                            <td className="px-2.5 py-2">
                              <div className="font-semibold text-slate-900 dark:text-slate-100">
                                <SavedText value={p.accountName} lang={s.lang} kind="name" fallback="—" />
                              </div>
                              {p.accountNo && p.accountNo !== "—" ? (
                                <div className="font-mono text-[10px] text-slate-500" dir="ltr">
                                  {p.accountNo}
                                </div>
                              ) : null}
                            </td>
                            <td className="whitespace-nowrap px-2.5 py-2 font-mono text-[11px]" dir="ltr">
                              {[p.blNo !== "—" ? p.blNo : "", p.containerNo !== "—" ? p.containerNo : ""]
                                .filter(Boolean)
                                .join(" · ") || "—"}
                            </td>
                            <td className="px-2.5 py-2 font-bold">{p.goodsName}</td>
                            <td className="px-2.5 py-2">{p.size}</td>
                            <td className="px-2.5 py-2">{p.brand}</td>
                            <td className="px-2.5 py-2">{p.origin}</td>
                            <td className="whitespace-nowrap px-2.5 py-2 text-end font-mono font-black text-emerald-700 dark:text-emerald-300" dir="ltr">
                              {fmtQtyPlain(p.qty, p.unit)}
                            </td>
                            <td className="whitespace-nowrap px-2.5 py-2 text-end font-mono" dir="ltr">
                              {fmtNum(p.grossKg)}
                            </td>
                            <td className="whitespace-nowrap px-2.5 py-2 text-end font-mono" dir="ltr">
                              {fmtNum(p.netKg)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* 2. Sold Items Table (Red) */}
              <section className="overflow-hidden rounded-2xl border border-rose-200 bg-white shadow-xs dark:border-rose-900/60 dark:bg-slate-900">
                <div className="flex items-center justify-between bg-rose-700 px-4 py-2.5 text-white">
                  <h2 className="text-xs font-black uppercase tracking-wider">
                    {s.t("sec_sold_items", "Sold Items")}
                  </h2>
                  <span className="text-[11px] font-bold">
                    {lotDetail?.soldItems.length ?? 0} {s.t("lbl_records", "records")}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[980px] border-collapse text-xs" data-testid="psj-lot-sold-table">
                    <thead className="border-b border-rose-200 bg-rose-50/80 text-[11px] font-black text-rose-950 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200">
                      <tr className="divide-x divide-rose-200/80 dark:divide-rose-900/50">
                        <th className="px-2.5 py-2 text-start">{s.t("col_entry_ref", "Entry Reference")}</th>
                        <th className="px-2.5 py-2 text-start">{s.t("col_entry_type", "Type")}</th>
                        <th className="px-2.5 py-2 text-start">{s.t("col_date", "Date")}</th>
                        <th className="px-2.5 py-2 text-start">{s.t("col_account", "Account No. / Name")}</th>
                        <th className="px-2.5 py-2 text-start">{s.t("col_bl_container", "B/L · Container")}</th>
                        <th className="px-2.5 py-2 text-start">{s.t("col_goods_name", "Goods Name")}</th>
                        <th className="px-2.5 py-2 text-start">{s.t("col_size", "Size")}</th>
                        <th className="px-2.5 py-2 text-start">{s.t("col_brand", "Brand")}</th>
                        <th className="px-2.5 py-2 text-start">{s.t("col_origin", "Origin")}</th>
                        <th className="px-2.5 py-2 text-end">{s.t("lbl_qty", "Qty")}</th>
                        <th className="px-2.5 py-2 text-end">{s.t("lbl_gross_wt_kg", "Gross Wt (Kg)")}</th>
                        <th className="px-2.5 py-2 text-end">{s.t("lbl_net_wt_kg", "Net Wt (Kg)")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {(lotDetail?.soldItems ?? []).length === 0 ? (
                        <tr>
                          <td colSpan={12} className="p-6 text-center text-slate-400">
                            {s.t("no_sold_items", "No sales recorded against this lot yet.")}
                          </td>
                        </tr>
                      ) : (
                        (lotDetail?.soldItems ?? []).map((si) => (
                          <tr key={si.id} className="divide-x divide-slate-200 hover:bg-rose-50/30 dark:divide-slate-800 dark:hover:bg-slate-800/40">
                            <td className="whitespace-nowrap px-2.5 py-2 font-mono font-bold text-rose-700 dark:text-rose-300" dir="ltr">
                              {si.salesBillNo}
                            </td>
                            <td className="whitespace-nowrap px-2.5 py-2 text-[11px] font-semibold">{si.saleType}</td>
                            <td className="whitespace-nowrap px-2.5 py-2 font-mono text-[11px]" dir="ltr">
                              {si.date ?? "—"}
                            </td>
                            <td className="px-2.5 py-2">
                              <div className="font-semibold text-slate-900 dark:text-slate-100">
                                <SavedText value={si.accountName} lang={s.lang} kind="name" fallback="—" />
                              </div>
                              {si.accountNo && si.accountNo !== "—" ? (
                                <div className="font-mono text-[10px] text-slate-500" dir="ltr">
                                  {si.accountNo}
                                </div>
                              ) : null}
                            </td>
                            <td className="whitespace-nowrap px-2.5 py-2 font-mono text-[11px]" dir="ltr">
                              {[si.blNo, si.containerNo].filter(Boolean).join(" · ") || "—"}
                            </td>
                            <td className="px-2.5 py-2 font-bold">{si.goodsName}</td>
                            <td className="px-2.5 py-2">{si.size || "—"}</td>
                            <td className="px-2.5 py-2">{si.brand || "—"}</td>
                            <td className="px-2.5 py-2">{si.origin || "—"}</td>
                            <td className="whitespace-nowrap px-2.5 py-2 text-end font-mono font-black text-rose-700 dark:text-rose-300" dir="ltr">
                              {fmtQtyPlain(si.qty, si.unit)}
                            </td>
                            <td className="whitespace-nowrap px-2.5 py-2 text-end font-mono" dir="ltr">
                              {fmtNum(si.grossKg)}
                            </td>
                            <td className="whitespace-nowrap px-2.5 py-2 text-end font-mono" dir="ltr">
                              {fmtNum(si.netKg)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  const pagination = data?.pagination;
  const startIdx = pagination && pagination.totalRecords > 0 ? (pagination.page - 1) * pagination.limit + 1 : 0;
  const endIdx = pagination ? Math.min(pagination.totalRecords, pagination.page * pagination.limit) : 0;

  return (
    <div
      dir={s.dir}
      data-page-chrome="true"
      data-testid="psj-dashboard"
      className="mx-auto max-w-[1920px] space-y-3.5 p-2.5 text-slate-800 sm:p-4 dark:text-slate-100"
    >
      {/* Header — Single Search & Filter Dropdown Button */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            <span>{s.t("crumb_stock", "Stock / Warehouse")}</span>
            <span>›</span>
            <span>{s.t("crumb_stock_reports", "Stock Reports")}</span>
            <span>›</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">
              {s.t("psj_title", "P/S Journal — Purchase & Sales")}
            </span>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2.5">
            <h1 className="text-lg font-black tracking-tight text-slate-950 sm:text-xl dark:text-white">
              {s.t("psj_title", "P/S Journal — Purchase & Sales")}
            </h1>
            {activeCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  setFilters(defaultPsFilters(data?.filterOptions));
                  setPage(1);
                }}
                className="inline-flex cursor-pointer items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-blue-700 hover:bg-blue-100 dark:bg-blue-950/50 dark:text-blue-300"
              >
                <span>
                  {activeCount} {s.t("active_filters", "active filters")}
                </span>
                <X className="h-3 w-3" aria-hidden />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            data-testid="psj-search-filter-btn"
            onClick={() => setSearchModalOpen(true)}
            className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#164e9e] px-4 py-2 text-xs font-black text-white shadow-sm transition hover:bg-[#123f80]"
          >
            <Search className="h-3.5 w-3.5" aria-hidden />
            <span>{s.t("btn_search_filter", "Search & Filter")}</span>
            {activeCount > 0 ? (
              <span className="rounded-full bg-white/20 px-1.5 py-0.2 text-[10px] font-black">{activeCount}</span>
            ) : null}
            <ChevronDown className="h-3.5 w-3.5 opacity-85" aria-hidden />
          </button>
          <UniversalPrintActionButton variant="menu" reportConfig={registerPrintConfig} />
        </div>
      </div>

      {/* Compact Upper Summary Cards: Green Purchase | Red Sales | Blue Balance | Clickable Country/Branch Stock Card */}
      <div
        className={`grid grid-cols-1 gap-2.5 ${showPlaceCard ? "md:grid-cols-2 xl:grid-cols-4" : "md:grid-cols-3"}`}
        data-testid="psj-summary-cards"
      >
        {/* Card 1: Total Purchase Bills (Green) */}
        <section className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50/90 via-white to-emerald-50/50 p-2.5 shadow-xs dark:border-emerald-900/60 dark:from-emerald-950/30 dark:via-slate-900 dark:to-slate-900">
          <div className="flex items-center justify-between gap-2 border-b border-emerald-200/70 pb-1.5 dark:border-emerald-900/50">
            <div className="flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300">
              <ShoppingCart className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <h2 className="text-xs font-black">{s.t("card_purchase_bills", "Total Purchase Bills")}</h2>
            </div>
            <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[11px] font-black text-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-200">
              {s.t("lbl_bills", "Bills")}: {cards?.purchase.bills ?? 0}
            </span>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
            <div>
              <span className="block text-[9.5px] font-bold uppercase text-slate-500">{s.t("lbl_qty", "Qty")}</span>
              <span className="mt-0.5 block font-mono text-xs font-black text-emerald-700 sm:text-sm dark:text-emerald-300" dir="ltr">
                {formatUnitQty(cards?.purchase.qtyByUnit)}
              </span>
            </div>
            <div>
              <span className="block text-[9.5px] font-bold uppercase text-slate-500">
                {s.t("lbl_gross_wt_kg", "Gross Wt (Kg)")}
              </span>
              <span className="mt-0.5 block font-mono text-xs font-black text-emerald-800 sm:text-sm dark:text-emerald-200" dir="ltr">
                {fmtNum(cards?.purchase.grossKg ?? 0)}
              </span>
            </div>
            <div>
              <span className="block text-[9.5px] font-bold uppercase text-slate-500">
                {s.t("lbl_net_wt_kg", "Net Wt (Kg)")}
              </span>
              <span className="mt-0.5 block font-mono text-xs font-black text-emerald-800 sm:text-sm dark:text-emerald-200" dir="ltr">
                {fmtNum(cards?.purchase.netKg ?? 0)}
              </span>
            </div>
          </div>
        </section>

        {/* Card 2: Total Sales Bills (Red) */}
        <section className="rounded-xl border border-rose-200 bg-gradient-to-br from-rose-50/90 via-white to-rose-50/50 p-2.5 shadow-xs dark:border-rose-900/60 dark:from-rose-950/30 dark:via-slate-900 dark:to-slate-900">
          <div className="flex items-center justify-between gap-2 border-b border-rose-200/70 pb-1.5 dark:border-rose-900/50">
            <div className="flex items-center gap-1.5 text-rose-700 dark:text-rose-300">
              <ShoppingCart className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <h2 className="text-xs font-black">{s.t("card_sales_bills", "Total Sales Bills")}</h2>
            </div>
            <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[11px] font-black text-rose-900 dark:bg-rose-900/60 dark:text-rose-200">
              {s.t("lbl_bills", "Bills")}: {cards?.sales.bills ?? 0}
            </span>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
            <div>
              <span className="block text-[9.5px] font-bold uppercase text-slate-500">{s.t("lbl_qty", "Qty")}</span>
              <span className="mt-0.5 block font-mono text-xs font-black text-rose-700 sm:text-sm dark:text-rose-300" dir="ltr">
                {formatUnitQty(cards?.sales.qtyByUnit)}
              </span>
            </div>
            <div>
              <span className="block text-[9.5px] font-bold uppercase text-slate-500">
                {s.t("lbl_gross_wt_kg", "Gross Wt (Kg)")}
              </span>
              <span className="mt-0.5 block font-mono text-xs font-black text-rose-800 sm:text-sm dark:text-rose-200" dir="ltr">
                {fmtNum(cards?.sales.grossKg ?? 0)}
              </span>
            </div>
            <div>
              <span className="block text-[9.5px] font-bold uppercase text-slate-500">
                {s.t("lbl_net_wt_kg", "Net Wt (Kg)")}
              </span>
              <span className="mt-0.5 block font-mono text-xs font-black text-rose-800 sm:text-sm dark:text-rose-200" dir="ltr">
                {fmtNum(cards?.sales.netKg ?? 0)}
              </span>
            </div>
          </div>
        </section>

        {/* Card 3: Remaining Stock / Balance (Blue) */}
        <section className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50/90 via-white to-blue-50/50 p-2.5 shadow-xs dark:border-blue-900/60 dark:from-blue-950/30 dark:via-slate-900 dark:to-slate-900">
          <div className="flex items-center justify-between gap-2 border-b border-blue-200/70 pb-1.5 dark:border-blue-900/50">
            <div className="flex items-center gap-1.5 text-blue-800 dark:text-blue-300">
              <Boxes className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <h2 className="text-xs font-black">{s.t("card_remaining_stock", "Remaining Stock")}</h2>
            </div>
            <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[11px] font-black text-blue-900 dark:bg-blue-900/60 dark:text-blue-200">
              {s.t("lbl_lots", "Lots")}: {cards?.balance.lots ?? 0}
            </span>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
            <div>
              <span className="block text-[9.5px] font-bold uppercase text-slate-500">{s.t("lbl_qty", "Qty")}</span>
              <span
                className={`mt-0.5 block font-mono text-xs font-black sm:text-sm ${
                  hasNegativeUnit(cards?.balance.qtyByUnit)
                    ? "text-rose-600 dark:text-rose-400"
                    : "text-blue-800 dark:text-blue-300"
                }`}
                dir="ltr"
              >
                {formatUnitQty(cards?.balance.qtyByUnit)}
              </span>
            </div>
            <div>
              <span className="block text-[9.5px] font-bold uppercase text-slate-500">
                {s.t("lbl_gross_wt_kg", "Gross Wt (Kg)")}
              </span>
              <span
                className={`mt-0.5 block font-mono text-xs font-black sm:text-sm ${
                  (cards?.balance.grossKg ?? 0) < 0
                    ? "text-rose-600 dark:text-rose-400"
                    : "text-blue-900 dark:text-blue-200"
                }`}
                dir="ltr"
              >
                {fmtNum(cards?.balance.grossKg ?? 0)}
              </span>
            </div>
            <div>
              <span className="block text-[9.5px] font-bold uppercase text-slate-500">
                {s.t("lbl_net_wt_kg", "Net Wt (Kg)")}
              </span>
              <span
                className={`mt-0.5 block font-mono text-xs font-black sm:text-sm ${
                  (cards?.balance.netKg ?? 0) < 0
                    ? "text-rose-600 dark:text-rose-400"
                    : "text-blue-900 dark:text-blue-200"
                }`}
                dir="ltr"
              >
                {fmtNum(cards?.balance.netKg ?? 0)}
              </span>
            </div>
          </div>
        </section>

        {/* Card 4: Clickable Country Stock Report (Super Admin) / Branch Stock Report (Country Admin) */}
        {showPlaceCard && (
          <section
            className="flex flex-col rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50/80 via-white to-slate-50/60 p-2.5 shadow-xs dark:border-indigo-900/60 dark:from-indigo-950/30 dark:via-slate-900 dark:to-slate-900"
            data-testid="psj-country-stock-card"
          >
            <div className="flex items-center justify-between gap-1.5 border-b border-indigo-200/70 pb-1.5 dark:border-indigo-900/50">
              <div className="flex items-center gap-1.5 text-indigo-900 dark:text-indigo-300">
                {isCountryCard ? (
                  <Globe2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                ) : (
                  <Building2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                )}
                <h2 className="text-xs font-black">
                  {isCountryCard
                    ? s.t("btn_country_wise", "Country Wise")
                    : s.t("btn_branch_wise", "Branch Wise")}
                </h2>
              </div>
              <button
                type="button"
                data-testid="psj-country-reset"
                onClick={() => {
                  setFilters((prev) =>
                    isCountryCard
                      ? { ...prev, countryId: undefined, branchId: undefined }
                      : { ...prev, branchId: undefined },
                  );
                  setPage(1);
                }}
                className={`cursor-pointer rounded px-1.5 py-0.5 text-[10px] font-black transition ${
                  (isCountryCard ? !filters.countryId : !filters.branchId)
                    ? "bg-indigo-700 text-white"
                    : "bg-indigo-100 text-indigo-800 hover:bg-indigo-200 dark:bg-indigo-900/60 dark:text-indigo-200"
                }`}
              >
                {isCountryCard
                  ? s.t("all_countries", "All Countries")
                  : s.t("all_branches", "All Branches")}
              </button>
            </div>

            <div className="mt-1.5 max-h-[96px] overflow-y-auto">
              <table className="w-full border-collapse text-[10px]">
                <thead>
                  <tr className="divide-x divide-slate-200 border-b border-slate-200 bg-slate-100/90 text-[9px] font-black uppercase text-slate-600 dark:divide-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    <th className="px-1.5 py-1 text-start">
                      {isCountryCard ? s.t("f_country", "Country") : s.t("f_branch", "Branch")}
                    </th>
                    <th className="px-1.5 py-1 text-end text-emerald-800 dark:text-emerald-300">
                      {s.t("col_p_qty", "P Qty")}
                    </th>
                    <th className="px-1.5 py-1 text-end text-rose-800 dark:text-rose-300">
                      {s.t("col_s_qty", "S Qty")}
                    </th>
                    <th className="px-1.5 py-1 text-end text-blue-800 dark:text-blue-300">
                      {s.t("col_bal_qty", "Bal Qty")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {placeCardRows.map((r) => {
                    const selected = isCountryCard
                      ? Boolean(r.countryId && filters.countryId === r.countryId)
                      : Boolean(r.branchId && filters.branchId?.replace(/^(city:|main:)/, "") === r.branchId);
                    return (
                      <tr
                        key={r.key}
                        data-testid="psj-country-card-row"
                        onClick={() => {
                          if (isCountryCard) {
                            if (!r.countryId) return;
                            setFilters((prev) => ({
                              ...prev,
                              countryId: prev.countryId === r.countryId ? undefined : (r.countryId ?? undefined),
                              branchId: undefined,
                            }));
                          } else {
                            if (!r.branchId) return;
                            const nextVal = `city:${r.branchId}`;
                            setFilters((prev) => ({
                              ...prev,
                              branchId:
                                prev.branchId?.replace(/^(city:|main:)/, "") === r.branchId ? undefined : nextVal,
                            }));
                          }
                          setPage(1);
                        }}
                        className={`cursor-pointer divide-x divide-slate-200 transition dark:divide-slate-800 ${
                          selected
                            ? "bg-indigo-100/90 font-black text-indigo-950 dark:bg-indigo-900/50 dark:text-white"
                            : "hover:bg-indigo-50/60 dark:hover:bg-slate-800/60"
                        }`}
                      >
                        <td className="max-w-[110px] truncate px-1.5 py-1 font-bold">
                          {isCountryCard ? r.countryName : r.branchName}
                        </td>
                        <td className="whitespace-nowrap px-1.5 py-1 text-end font-mono font-bold text-emerald-700 dark:text-emerald-300" dir="ltr">
                          {formatUnitQty(r.pQtyByUnit)}
                        </td>
                        <td className="whitespace-nowrap px-1.5 py-1 text-end font-mono font-bold text-rose-700 dark:text-rose-300" dir="ltr">
                          {formatUnitQty(r.sQtyByUnit)}
                        </td>
                        <td
                          className={`whitespace-nowrap px-1.5 py-1 text-end font-mono font-black ${
                            hasNegativeUnit(r.balQtyByUnit)
                              ? "text-rose-600 dark:text-rose-400"
                              : "text-blue-700 dark:text-blue-300"
                          }`}
                          dir="ltr"
                        >
                          {formatUnitQty(r.balQtyByUnit)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-semibold text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
          {error}
        </div>
      ) : null}

      {/* Single Main Register: Lot Wise Stock Register (Every Lot Name Clickable) */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-blue-50/40 px-4 py-2.5 dark:border-slate-800 dark:from-slate-900 dark:to-slate-900">
          <div className="flex items-center gap-2">
            <Boxes className="h-4 w-4 text-blue-700 dark:text-blue-400" aria-hidden />
            <h2 className="text-sm font-black text-slate-900 dark:text-white">
              {s.t("psj_lot_table_title", "Lot Wise Stock Register")}
            </h2>
          </div>
          <span className="text-xs font-bold text-slate-500">
            {pagination?.totalRecords ?? 0} {s.t("lbl_lots", "Lots")}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] border-collapse text-xs" data-testid="psj-lot-table">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100 text-[11px] font-black dark:border-slate-700 dark:bg-slate-800">
                <th rowSpan={2} className="w-10 border-e border-slate-200 px-2 py-2 text-center dark:border-slate-700">
                  #
                </th>
                <th rowSpan={2} className="border-e border-slate-200 px-3 py-2 text-start dark:border-slate-700">
                  {s.t("col_lot_name", "Lot Name")}
                </th>
                <th rowSpan={2} className="border-e border-slate-200 px-3 py-2 text-start dark:border-slate-700">
                  {s.t("col_goods_name", "Goods Name")}
                </th>
                <th rowSpan={2} className="border-e border-slate-200 px-3 py-2 text-start dark:border-slate-700">
                  {s.t("col_origin", "Origin")}
                </th>
                <th
                  colSpan={3}
                  className="border-e border-emerald-200 bg-emerald-100/90 px-3 py-1.5 text-center text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300"
                >
                  {s.t("band_purchase", "Purchase (P)")}
                </th>
                <th
                  colSpan={3}
                  className="border-e border-rose-200 bg-rose-100/80 px-3 py-1.5 text-center text-rose-900 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-300"
                >
                  {s.t("band_sales", "Sales (S)")}
                </th>
                <th
                  colSpan={3}
                  className="bg-blue-100/90 px-3 py-1.5 text-center text-blue-900 dark:bg-blue-950/60 dark:text-blue-300"
                >
                  {s.t("band_balance", "Balance")}
                </th>
              </tr>
              <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-black uppercase text-slate-600 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300">
                <th className="border-e border-emerald-200/70 bg-emerald-50/70 px-2.5 py-1.5 text-end text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
                  {s.t("lbl_qty", "Qty")}
                </th>
                <th className="border-e border-emerald-200/70 bg-emerald-50/70 px-2.5 py-1.5 text-end text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
                  {s.t("col_gross_kg_short", "Gross (Kg)")}
                </th>
                <th className="border-e border-emerald-200 bg-emerald-50/70 px-2.5 py-1.5 text-end text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
                  {s.t("col_net_kg_short", "Net (Kg)")}
                </th>
                <th className="border-e border-rose-200/70 bg-rose-50/70 px-2.5 py-1.5 text-end text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300">
                  {s.t("lbl_qty", "Qty")}
                </th>
                <th className="border-e border-rose-200/70 bg-rose-50/70 px-2.5 py-1.5 text-end text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300">
                  {s.t("col_gross_kg_short", "Gross (Kg)")}
                </th>
                <th className="border-e border-rose-200 bg-rose-50/70 px-2.5 py-1.5 text-end text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300">
                  {s.t("col_net_kg_short", "Net (Kg)")}
                </th>
                <th className="border-e border-blue-200/70 bg-blue-50/70 px-2.5 py-1.5 text-end text-blue-800 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300">
                  {s.t("lbl_qty", "Qty")}
                </th>
                <th className="border-e border-blue-200/70 bg-blue-50/70 px-2.5 py-1.5 text-end text-blue-800 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300">
                  {s.t("col_gross_kg_short", "Gross (Kg)")}
                </th>
                <th className="bg-blue-50/70 px-2.5 py-1.5 text-end text-blue-800 dark:bg-blue-950/30 dark:text-blue-300">
                  {s.t("col_net_kg_short", "Net (Kg)")}
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {loading && lots.length === 0 ? (
                <tr>
                  <td colSpan={13} className="p-10 text-center text-slate-400">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </td>
                </tr>
              ) : lots.length === 0 ? (
                <tr>
                  <td colSpan={13} className="p-10 text-center font-medium text-slate-400" data-testid="psj-empty">
                    {s.t("empty_records", "No stock records match the selected filters in your authorized scope.")}
                  </td>
                </tr>
              ) : (
                lots.map((l, idx) => (
                  <tr key={l.lotKey} className="divide-x divide-slate-200 hover:bg-slate-50/80 dark:divide-slate-800 dark:hover:bg-slate-800/40">
                    <td className="px-2 py-2 text-center font-mono text-slate-500">{startIdx + idx}</td>
                    <td className="whitespace-nowrap px-3 py-2">
                      <button
                        type="button"
                        data-testid="psj-lot-link"
                        onClick={() => setActiveLotKey(l.lotKey)}
                        className="cursor-pointer font-mono font-black text-blue-700 underline decoration-blue-400 underline-offset-2 hover:text-blue-900 dark:text-blue-300 dark:hover:text-blue-200"
                        dir="ltr"
                      >
                        {l.lotName}
                      </button>
                      <div className="text-[10px] text-slate-400">
                        {l.countryName} · {l.branchName}
                      </div>
                    </td>
                    <td className="px-3 py-2 font-bold text-slate-900 dark:text-slate-100">
                      <div>{l.goodsName}</div>
                      {(l.brand || l.size) && (
                        <div className="text-[10px] font-normal text-slate-400">
                          {[l.brand, l.size].filter(Boolean).join(" · ")}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{l.origin}</td>
                    <td className="whitespace-nowrap bg-emerald-50/35 px-2.5 py-2 text-end font-mono font-black text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300" dir="ltr">
                      {formatUnitQty(l.pQtyByUnit)}
                    </td>
                    <td className="whitespace-nowrap bg-emerald-50/35 px-2.5 py-2 text-end font-mono tabular-nums dark:bg-emerald-950/20" dir="ltr">
                      {fmtNum(l.pGrossKg)}
                    </td>
                    <td className="whitespace-nowrap bg-emerald-50/35 px-2.5 py-2 text-end font-mono tabular-nums dark:bg-emerald-950/20" dir="ltr">
                      {fmtNum(l.pNetKg)}
                    </td>
                    <td className="whitespace-nowrap bg-rose-50/35 px-2.5 py-2 text-end font-mono font-black text-rose-700 dark:bg-rose-950/20 dark:text-rose-300" dir="ltr">
                      {formatUnitQty(l.sQtyByUnit)}
                    </td>
                    <td className="whitespace-nowrap bg-rose-50/35 px-2.5 py-2 text-end font-mono tabular-nums dark:bg-rose-950/20" dir="ltr">
                      {fmtNum(l.sGrossKg)}
                    </td>
                    <td className="whitespace-nowrap bg-rose-50/35 px-2.5 py-2 text-end font-mono tabular-nums dark:bg-rose-950/20" dir="ltr">
                      {fmtNum(l.sNetKg)}
                    </td>
                    <td
                      className={`whitespace-nowrap bg-blue-50/35 px-2.5 py-2 text-end font-mono font-black dark:bg-blue-950/20 ${
                        l.hasNegativeBalance ? "text-rose-600 dark:text-rose-400" : "text-blue-700 dark:text-blue-300"
                      }`}
                      dir="ltr"
                    >
                      {formatUnitQty(l.balQtyByUnit)}
                    </td>
                    <td
                      className={`whitespace-nowrap bg-blue-50/35 px-2.5 py-2 text-end font-mono font-bold tabular-nums dark:bg-blue-950/20 ${
                        l.balGrossKg < 0 ? "text-rose-600 dark:text-rose-400" : "text-blue-800 dark:text-blue-200"
                      }`}
                      dir="ltr"
                    >
                      {fmtNum(l.balGrossKg)}
                    </td>
                    <td
                      className={`whitespace-nowrap bg-blue-50/35 px-2.5 py-2 text-end font-mono font-bold tabular-nums dark:bg-blue-950/20 ${
                        l.balNetKg < 0 ? "text-rose-600 dark:text-rose-400" : "text-blue-800 dark:text-blue-200"
                      }`}
                      dir="ltr"
                    >
                      {fmtNum(l.balNetKg)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-2.5 text-xs text-slate-600 dark:border-slate-800 dark:text-slate-300">
          <div>
            {s.t("lbl_showing", "Showing")} <strong>{startIdx}</strong> {s.t("lbl_to", "to")} <strong>{endIdx}</strong>{" "}
            {s.t("lbl_of", "of")} <strong>{pagination?.totalRecords ?? 0}</strong> {s.t("lbl_records", "records")}
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5">
              <span>{s.t("lbl_rows_per_page", "Rows per page:")}</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-bold dark:border-slate-700 dark:bg-slate-800"
              >
                {[25, 50, 100].map((sz) => (
                  <option key={sz} value={sz}>
                    {sz}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-md border border-slate-300 px-2.5 py-1 font-bold disabled:opacity-40 dark:border-slate-700"
              >
                ‹
              </button>
              <span className="rounded-md bg-blue-600 px-2.5 py-1 font-mono font-black text-white">{page}</span>
              <button
                type="button"
                disabled={!pagination || page >= pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-md border border-slate-300 px-2.5 py-1 font-bold disabled:opacity-40 dark:border-slate-700"
              >
                ›
              </button>
            </div>
          </div>
        </div>
      </section>

      <StockAdvancedSearchModal
        open={searchModalOpen}
        lang={s.lang}
        value={filters}
        options={data?.filterOptions ?? null}
        onApply={(next) => {
          setFilters(next);
          setPage(1);
        }}
        onReset={(cleared) => {
          setFilters(cleared);
          setPage(1);
        }}
        onClose={() => setSearchModalOpen(false)}
      />
    </div>
  );
}
