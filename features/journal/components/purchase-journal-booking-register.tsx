"use client";

/**
 * Journal Booking Stock (/dashboard/purchase/journal-booking-stock)
 *
 * Updated inside the existing Stock menu (no duplicate module):
 *   - Single "Search & Filter" dropdown button in the header opening the reusable Advanced Search modal
 *   - Three upper summary cards: Purchase Booking (green), Sales Booking (red), Remaining Stock (blue)
 *   - Compact side-by-side table showing Purchase Booking, corresponding Sales Booking & Remaining Stock
 *   - Supports partial sales and multiple sales against the same purchase without duplicate stock calculations
 */

import { Fragment, useCallback, useEffect, useState } from "react";
import { Boxes, ChevronDown, ChevronRight, Loader2, Search, ShoppingCart, X } from "lucide-react";
import { apiGet } from "@/lib/api/client";
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
  type BookingStockSideBySideRow,
  type PsAdvancedFilters,
  type PsCardSummary,
  type StockRoleTier,
} from "@/lib/stock/ps-journal-model";

interface BookingStockApiResponse {
  mode: "booking_stock";
  role: StockRoleTier;
  cards: {
    purchase: PsCardSummary;
    sales: PsCardSummary;
    remaining: PsCardSummary;
  };
  rows: BookingStockSideBySideRow[];
  pagination: {
    page: number;
    limit: number;
    totalRecords: number;
    totalPages: number;
  };
  filterOptions: PsFilterOptionSet;
}

const fmtNum = (v: number, digits = 2) =>
  v.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });

const fmtQtyPlain = (qty: number, unit: string) => {
  const formatted = qty.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return !unit || unit === "UNIT" ? formatted : `${formatted} ${unit}`;
};

export function PurchaseJournalBookingRegister({ lang: langProp }: { lang?: string }) {
  const s = useErpScreen("psj", langProp);
  const [data, setData] = useState<BookingStockApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<PsAdvancedFilters>({});
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({
        mode: "booking_stock",
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

      const res = await apiGet<BookingStockApiResponse>(`/api/erp/stock/ps-journal?${qs.toString()}`);
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [filters, page, pageSize, s.lang]);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = data?.rows ?? [];
  const cards = data?.cards;
  const activeCount = countActivePsFilters(filters, data?.filterOptions);

  const reportConfig = () => ({
    moduleType: "register" as const,
    reportType: "register" as const,
    title: s.t("jbs_title", "Journal Booking Stock"),
    subtitle: s.t("jbs_table_title", "Journal Booking Stock (Purchase, Sales & Remaining)"),
    lang: s.lang,
    orientation: "landscape" as const,
    kpis: cards
      ? [
          {
            label: `${s.t("jbs_card_purchase", "Purchase Booking")} (${s.t("lbl_bills", "Bills")}: ${cards.purchase.bills})`,
            value: `${formatUnitQty(cards.purchase.qtyByUnit)} · ${fmtNum(cards.purchase.netKg)} kg`,
            color: "emerald" as const,
          },
          {
            label: `${s.t("jbs_card_sales", "Sales Booking")} (${s.t("lbl_bills", "Bills")}: ${cards.sales.bills})`,
            value: `${formatUnitQty(cards.sales.qtyByUnit)} · ${fmtNum(cards.sales.netKg)} kg`,
            color: "red" as const,
          },
          {
            label: `${s.t("jbs_card_remaining", "Remaining Stock")} (${s.t("lbl_lots", "Lots")}: ${cards.remaining.lots})`,
            value: `${formatUnitQty(cards.remaining.qtyByUnit)} · ${fmtNum(cards.remaining.netKg)} kg`,
            color: "blue" as const,
          },
        ]
      : [],
    columns: [
      { key: "pBill", label: s.t("col_p_bill", "P. Bill No.") },
      { key: "blNo", label: s.t("col_bl_no", "B/L No.") },
      { key: "containerNo", label: s.t("col_container_no", "Container No.") },
      { key: "goodsName", label: s.t("col_goods_name", "Goods Name") },
      { key: "size", label: s.t("col_size", "Size") },
      { key: "origin", label: s.t("col_origin", "Origin") },
      { key: "pQty", label: s.t("col_p_qty", "P Qty"), align: "right" as const },
      { key: "pGross", label: s.t("col_p_gross", "P Gross"), align: "right" as const },
      { key: "pNet", label: s.t("col_p_net", "P Net"), align: "right" as const },
      { key: "sBill", label: s.t("col_s_bill", "S. Bill No.") },
      { key: "sQty", label: s.t("col_s_qty", "S Qty"), align: "right" as const },
      { key: "sGross", label: s.t("col_s_gross", "S Gross"), align: "right" as const },
      { key: "sNet", label: s.t("col_s_net", "S Net"), align: "right" as const },
      { key: "remQty", label: s.t("col_rem_qty", "Rem Qty"), align: "right" as const },
      { key: "remGross", label: s.t("col_rem_gross", "Rem Gross"), align: "right" as const },
      { key: "remNet", label: s.t("col_rem_net", "Rem Net"), align: "right" as const },
    ],
    rows: rows.map((r) => ({
      pBill: r.purchaseBillNo,
      blNo: r.blNo,
      containerNo: r.containerNo,
      goodsName: r.goodsName,
      size: r.size || "—",
      origin: r.origin,
      pQty: fmtQtyPlain(r.pQty, r.unit),
      pGross: fmtNum(r.pGrossKg),
      pNet: fmtNum(r.pNetKg),
      sBill: r.salesBillDisplay,
      sQty: fmtQtyPlain(r.sQty, r.unit),
      sGross: fmtNum(r.sGrossKg),
      sNet: fmtNum(r.sNetKg),
      remQty: fmtQtyPlain(r.remQty, r.unit),
      remGross: fmtNum(r.remGrossKg),
      remNet: fmtNum(r.remNetKg),
    })),
  });

  const pagination = data?.pagination;
  const startIdx = pagination && pagination.totalRecords > 0 ? (pagination.page - 1) * pagination.limit + 1 : 0;
  const endIdx = pagination ? Math.min(pagination.totalRecords, pagination.page * pagination.limit) : 0;

  return (
    <div
      dir={s.dir}
      data-page-chrome="true"
      data-testid="jbs-dashboard"
      className="mx-auto max-w-[1920px] space-y-3.5 p-2.5 text-slate-800 sm:p-4 dark:text-slate-100"
    >
      {/* Page Header — Single Search & Filter Dropdown Button */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            <span>{s.t("crumb_stock", "Stock / Warehouse")}</span>
            <span>›</span>
            <span>{s.t("crumb_stock_reports", "Stock Reports")}</span>
            <span>›</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">
              {s.t("jbs_title", "Journal Booking Stock")}
            </span>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2.5">
            <h1 className="text-lg font-black tracking-tight text-slate-950 sm:text-xl dark:text-white">
              {s.t("jbs_title", "Journal Booking Stock")}
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
            data-testid="jbs-search-filter-btn"
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
          <UniversalPrintActionButton variant="menu" reportConfig={reportConfig} />
        </div>
      </div>

      {/* Three Upper Summary Cards: Green Purchase Booking | Red Sales Booking | Blue Remaining Stock */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3" data-testid="jbs-summary-cards">
        {/* Card 1: Purchase Booking (Green) */}
        <section className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50/90 via-white to-emerald-50/50 p-3.5 shadow-xs dark:border-emerald-900/60 dark:from-emerald-950/30 dark:via-slate-900 dark:to-slate-900">
          <div className="flex items-center justify-between gap-2 border-b border-emerald-200/70 pb-2 dark:border-emerald-900/50">
            <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
              <ShoppingCart className="h-4 w-4 shrink-0" aria-hidden />
              <h2 className="text-sm font-black">{s.t("jbs_card_purchase", "Purchase Booking")}</h2>
            </div>
            <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-black text-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-200">
              {s.t("lbl_bills", "Bills")}: {cards?.purchase.bills ?? 0}
            </span>
          </div>
          <div className="mt-2.5 grid grid-cols-3 gap-2 text-center">
            <div>
              <span className="block text-[10px] font-bold uppercase text-slate-500">{s.t("lbl_qty", "Qty")}</span>
              <span className="mt-0.5 block font-mono text-sm font-black text-emerald-700 sm:text-base dark:text-emerald-300" dir="ltr">
                {formatUnitQty(cards?.purchase.qtyByUnit)}
              </span>
            </div>
            <div>
              <span className="block text-[10px] font-bold uppercase text-slate-500">
                {s.t("lbl_gross_wt_kg", "Gross Wt (Kg)")}
              </span>
              <span className="mt-0.5 block font-mono text-sm font-black text-emerald-800 sm:text-base dark:text-emerald-200" dir="ltr">
                {fmtNum(cards?.purchase.grossKg ?? 0)}
              </span>
            </div>
            <div>
              <span className="block text-[10px] font-bold uppercase text-slate-500">
                {s.t("lbl_net_wt_kg", "Net Wt (Kg)")}
              </span>
              <span className="mt-0.5 block font-mono text-sm font-black text-emerald-800 sm:text-base dark:text-emerald-200" dir="ltr">
                {fmtNum(cards?.purchase.netKg ?? 0)}
              </span>
            </div>
          </div>
        </section>

        {/* Card 2: Sales Booking (Red) */}
        <section className="rounded-xl border border-rose-200 bg-gradient-to-br from-rose-50/90 via-white to-rose-50/50 p-3.5 shadow-xs dark:border-rose-900/60 dark:from-rose-950/30 dark:via-slate-900 dark:to-slate-900">
          <div className="flex items-center justify-between gap-2 border-b border-rose-200/70 pb-2 dark:border-rose-900/50">
            <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300">
              <ShoppingCart className="h-4 w-4 shrink-0" aria-hidden />
              <h2 className="text-sm font-black">{s.t("jbs_card_sales", "Sales Booking")}</h2>
            </div>
            <span className="rounded-md bg-rose-100 px-2 py-0.5 text-xs font-black text-rose-900 dark:bg-rose-900/60 dark:text-rose-200">
              {s.t("lbl_bills", "Bills")}: {cards?.sales.bills ?? 0}
            </span>
          </div>
          <div className="mt-2.5 grid grid-cols-3 gap-2 text-center">
            <div>
              <span className="block text-[10px] font-bold uppercase text-slate-500">{s.t("lbl_qty", "Qty")}</span>
              <span className="mt-0.5 block font-mono text-sm font-black text-rose-700 sm:text-base dark:text-rose-300" dir="ltr">
                {formatUnitQty(cards?.sales.qtyByUnit)}
              </span>
            </div>
            <div>
              <span className="block text-[10px] font-bold uppercase text-slate-500">
                {s.t("lbl_gross_wt_kg", "Gross Wt (Kg)")}
              </span>
              <span className="mt-0.5 block font-mono text-sm font-black text-rose-800 sm:text-base dark:text-rose-200" dir="ltr">
                {fmtNum(cards?.sales.grossKg ?? 0)}
              </span>
            </div>
            <div>
              <span className="block text-[10px] font-bold uppercase text-slate-500">
                {s.t("lbl_net_wt_kg", "Net Wt (Kg)")}
              </span>
              <span className="mt-0.5 block font-mono text-sm font-black text-rose-800 sm:text-base dark:text-rose-200" dir="ltr">
                {fmtNum(cards?.sales.netKg ?? 0)}
              </span>
            </div>
          </div>
        </section>

        {/* Card 3: Remaining Stock (Blue) */}
        <section className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50/90 via-white to-blue-50/50 p-3.5 shadow-xs dark:border-blue-900/60 dark:from-blue-950/30 dark:via-slate-900 dark:to-slate-900">
          <div className="flex items-center justify-between gap-2 border-b border-blue-200/70 pb-2 dark:border-blue-900/50">
            <div className="flex items-center gap-2 text-blue-800 dark:text-blue-300">
              <Boxes className="h-4 w-4 shrink-0" aria-hidden />
              <h2 className="text-sm font-black">{s.t("jbs_card_remaining", "Remaining Stock")}</h2>
            </div>
            <span className="rounded-md bg-blue-100 px-2 py-0.5 text-xs font-black text-blue-900 dark:bg-blue-900/60 dark:text-blue-200">
              {s.t("lbl_lots", "Lots")}: {cards?.remaining.lots ?? 0}
            </span>
          </div>
          <div className="mt-2.5 grid grid-cols-3 gap-2 text-center">
            <div>
              <span className="block text-[10px] font-bold uppercase text-slate-500">{s.t("lbl_qty", "Qty")}</span>
              <span
                className={`mt-0.5 block font-mono text-sm font-black sm:text-base ${
                  hasNegativeUnit(cards?.remaining.qtyByUnit)
                    ? "text-rose-600 dark:text-rose-400"
                    : "text-blue-800 dark:text-blue-300"
                }`}
                dir="ltr"
              >
                {formatUnitQty(cards?.remaining.qtyByUnit)}
              </span>
            </div>
            <div>
              <span className="block text-[10px] font-bold uppercase text-slate-500">
                {s.t("lbl_gross_wt_kg", "Gross Wt (Kg)")}
              </span>
              <span
                className={`mt-0.5 block font-mono text-sm font-black sm:text-base ${
                  (cards?.remaining.grossKg ?? 0) < 0
                    ? "text-rose-600 dark:text-rose-400"
                    : "text-blue-900 dark:text-blue-200"
                }`}
                dir="ltr"
              >
                {fmtNum(cards?.remaining.grossKg ?? 0)}
              </span>
            </div>
            <div>
              <span className="block text-[10px] font-bold uppercase text-slate-500">
                {s.t("lbl_net_wt_kg", "Net Wt (Kg)")}
              </span>
              <span
                className={`mt-0.5 block font-mono text-sm font-black sm:text-base ${
                  (cards?.remaining.netKg ?? 0) < 0
                    ? "text-rose-600 dark:text-rose-400"
                    : "text-blue-900 dark:text-blue-200"
                }`}
                dir="ltr"
              >
                {fmtNum(cards?.remaining.netKg ?? 0)}
              </span>
            </div>
          </div>
        </section>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-semibold text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
          {error}
        </div>
      ) : null}

      {/* Compact Side-by-Side Register Card */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-blue-50/40 px-4 py-2.5 dark:border-slate-800 dark:from-slate-900 dark:to-slate-900">
          <div className="flex items-center gap-2">
            <Boxes className="h-4 w-4 text-blue-700 dark:text-blue-400" aria-hidden />
            <h2 className="text-sm font-black text-slate-900 dark:text-white">
              {s.t("jbs_table_title", "Journal Booking Stock (Purchase, Sales & Remaining)")}
            </h2>
          </div>
          <span className="text-xs font-bold text-slate-500">
            {pagination?.totalRecords ?? 0} {s.t("lbl_records", "records")}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1380px] border-collapse text-xs" data-testid="jbs-side-by-side-table">
            <thead>
              <tr className="divide-x divide-slate-200 border-b border-slate-200 bg-slate-100/90 text-[11px] font-black text-slate-700 dark:divide-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                <th className="px-2.5 py-2 text-center">#</th>
                <th className="px-2.5 py-2 text-start">{s.t("col_p_bill", "P. Bill No.")}</th>
                <th className="px-2.5 py-2 text-start">{s.t("col_bl_no", "B/L No.")}</th>
                <th className="px-2.5 py-2 text-start">{s.t("col_container_no", "Container No.")}</th>
                <th className="px-2.5 py-2 text-start">{s.t("col_goods_name", "Goods Name")}</th>
                <th className="px-2.5 py-2 text-start">{s.t("col_size", "Size")}</th>
                <th className="px-2.5 py-2 text-start">{s.t("col_origin", "Origin")}</th>
                <th className="bg-emerald-100/80 px-2.5 py-2 text-end text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300">
                  {s.t("col_p_qty", "P Qty")}
                </th>
                <th className="bg-emerald-100/80 px-2.5 py-2 text-end text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300">
                  {s.t("col_p_gross", "P Gross")}
                </th>
                <th className="bg-emerald-100/80 px-2.5 py-2 text-end text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300">
                  {s.t("col_p_net", "P Net")}
                </th>
                <th className="bg-rose-100/70 px-2.5 py-2 text-start text-rose-900 dark:bg-rose-950/50 dark:text-rose-300">
                  {s.t("col_s_bill", "S. Bill No.")}
                </th>
                <th className="bg-rose-100/70 px-2.5 py-2 text-end text-rose-900 dark:bg-rose-950/50 dark:text-rose-300">
                  {s.t("col_s_qty", "S Qty")}
                </th>
                <th className="bg-rose-100/70 px-2.5 py-2 text-end text-rose-900 dark:bg-rose-950/50 dark:text-rose-300">
                  {s.t("col_s_gross", "S Gross")}
                </th>
                <th className="bg-rose-100/70 px-2.5 py-2 text-end text-rose-900 dark:bg-rose-950/50 dark:text-rose-300">
                  {s.t("col_s_net", "S Net")}
                </th>
                <th className="bg-blue-100/80 px-2.5 py-2 text-end text-blue-900 dark:bg-blue-950/50 dark:text-blue-300">
                  {s.t("col_rem_qty", "Rem Qty")}
                </th>
                <th className="bg-blue-100/80 px-2.5 py-2 text-end text-blue-900 dark:bg-blue-950/50 dark:text-blue-300">
                  {s.t("col_rem_gross", "Rem Gross")}
                </th>
                <th className="bg-blue-100/80 px-2.5 py-2 text-end text-blue-900 dark:bg-blue-950/50 dark:text-blue-300">
                  {s.t("col_rem_net", "Rem Net")}
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={17} className="p-10 text-center text-slate-400">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={17} className="p-10 text-center font-medium text-slate-400" data-testid="jbs-empty">
                    {s.t("empty_records", "No stock records match the selected filters in your authorized scope.")}
                  </td>
                </tr>
              ) : (
                rows.map((r, idx) => {
                  const rowNum = startIdx + idx;
                  const multiSales = r.salesItems.length > 1;
                  const isOpen = Boolean(expandedRows[r.rowId]);
                  return (
                    <Fragment key={r.rowId}>
                      <tr className="divide-x divide-slate-200 hover:bg-slate-50/80 dark:divide-slate-800 dark:hover:bg-slate-800/40">
                        <td className="px-2.5 py-2 text-center font-mono text-[11px] text-slate-500">{rowNum}</td>
                        <td className="whitespace-nowrap px-2.5 py-2 font-mono font-bold text-slate-900 dark:text-white" dir="ltr">
                          <div>{r.purchaseBillNo}</div>
                          {r.lotName && r.lotName !== r.purchaseBillNo ? (
                            <div className="text-[10px] font-semibold text-slate-400">{r.lotName}</div>
                          ) : null}
                        </td>
                        <td className="whitespace-nowrap px-2.5 py-2 font-mono text-[11px] text-slate-700 dark:text-slate-300" dir="ltr">
                          {r.blNo || "—"}
                        </td>
                        <td className="whitespace-nowrap px-2.5 py-2 font-mono text-[11px] text-slate-700 dark:text-slate-300" dir="ltr">
                          {r.containerNo || "—"}
                        </td>
                        <td className="px-2.5 py-2 font-bold text-slate-900 dark:text-slate-100">
                          <div>{r.goodsName}</div>
                          {r.brand ? <div className="text-[10px] font-normal text-slate-400">{r.brand}</div> : null}
                        </td>
                        <td className="whitespace-nowrap px-2.5 py-2 text-[11px] text-slate-600 dark:text-slate-300">
                          {r.size || "—"}
                        </td>
                        <td className="whitespace-nowrap px-2.5 py-2 text-[11px] text-slate-600 dark:text-slate-300">
                          {r.origin || "—"}
                        </td>
                        <td className="whitespace-nowrap bg-emerald-50/35 px-2.5 py-2 text-end font-mono font-black text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300" dir="ltr">
                          {fmtQtyPlain(r.pQty, r.unit)}
                        </td>
                        <td className="whitespace-nowrap bg-emerald-50/35 px-2.5 py-2 text-end font-mono text-slate-800 dark:bg-emerald-950/20 dark:text-slate-200" dir="ltr">
                          {fmtNum(r.pGrossKg)}
                        </td>
                        <td className="whitespace-nowrap bg-emerald-50/35 px-2.5 py-2 text-end font-mono text-slate-800 dark:bg-emerald-950/20 dark:text-slate-200" dir="ltr">
                          {fmtNum(r.pNetKg)}
                        </td>
                        <td className="whitespace-nowrap bg-rose-50/35 px-2.5 py-2 font-mono font-bold text-slate-800 dark:bg-rose-950/20 dark:text-slate-200" dir="ltr">
                          {multiSales ? (
                            <button
                              type="button"
                              onClick={() => setExpandedRows((prev) => ({ ...prev, [r.rowId]: !prev[r.rowId] }))}
                              className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-rose-200 bg-white px-2 py-0.5 text-[11px] font-black text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:bg-slate-900 dark:text-rose-300"
                            >
                              {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                              <span>{r.salesBillDisplay}</span>
                            </button>
                          ) : (
                            <span>{r.salesBillDisplay}</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap bg-rose-50/35 px-2.5 py-2 text-end font-mono font-black text-rose-700 dark:bg-rose-950/20 dark:text-rose-300" dir="ltr">
                          {r.sQty > 0 ? fmtQtyPlain(r.sQty, r.unit) : "0"}
                        </td>
                        <td className="whitespace-nowrap bg-rose-50/35 px-2.5 py-2 text-end font-mono text-slate-800 dark:bg-rose-950/20 dark:text-slate-200" dir="ltr">
                          {fmtNum(r.sGrossKg)}
                        </td>
                        <td className="whitespace-nowrap bg-rose-50/35 px-2.5 py-2 text-end font-mono text-slate-800 dark:bg-rose-950/20 dark:text-slate-200" dir="ltr">
                          {fmtNum(r.sNetKg)}
                        </td>
                        <td
                          className={`whitespace-nowrap bg-blue-50/35 px-2.5 py-2 text-end font-mono font-black dark:bg-blue-950/20 ${
                            r.hasNegativeBalance ? "text-rose-600 dark:text-rose-400" : "text-blue-700 dark:text-blue-300"
                          }`}
                          dir="ltr"
                        >
                          {fmtQtyPlain(r.remQty, r.unit)}
                        </td>
                        <td
                          className={`whitespace-nowrap bg-blue-50/35 px-2.5 py-2 text-end font-mono font-bold dark:bg-blue-950/20 ${
                            r.remGrossKg < 0 ? "text-rose-600 dark:text-rose-400" : "text-blue-800 dark:text-blue-200"
                          }`}
                          dir="ltr"
                        >
                          {fmtNum(r.remGrossKg)}
                        </td>
                        <td
                          className={`whitespace-nowrap bg-blue-50/35 px-2.5 py-2 text-end font-mono font-bold dark:bg-blue-950/20 ${
                            r.remNetKg < 0 ? "text-rose-600 dark:text-rose-400" : "text-blue-800 dark:text-blue-200"
                          }`}
                          dir="ltr"
                        >
                          {fmtNum(r.remNetKg)}
                        </td>
                      </tr>

                      {/* Multiple sales breakdown sub-rows (does NOT duplicate purchase or remaining totals) */}
                      {multiSales && isOpen &&
                        r.salesItems.map((si) => (
                          <tr key={si.id} className="divide-x divide-slate-200 bg-rose-50/25 text-[11px] dark:divide-slate-800 dark:bg-rose-950/15">
                            <td colSpan={10} className="px-4 py-1.5 text-end font-semibold text-slate-500">
                              {s.t("multi_sale_split", "Partial / Linked Sale")} ({si.date || "—"} · {si.accountName})
                            </td>
                            <td className="px-2.5 py-1.5 font-mono font-bold text-rose-700 dark:text-rose-300" dir="ltr">
                              {si.salesBillNo}
                            </td>
                            <td className="px-2.5 py-1.5 text-end font-mono font-bold text-rose-700 dark:text-rose-300" dir="ltr">
                              {fmtQtyPlain(si.qty, si.unit)}
                            </td>
                            <td className="px-2.5 py-1.5 text-end font-mono text-rose-700 dark:text-rose-300" dir="ltr">
                              {fmtNum(si.grossKg)}
                            </td>
                            <td className="px-2.5 py-1.5 text-end font-mono text-rose-700 dark:text-rose-300" dir="ltr">
                              {fmtNum(si.netKg)}
                            </td>
                            <td colSpan={3} className="px-2.5 py-1.5 text-center text-[10px] text-slate-400">
                              —
                            </td>
                          </tr>
                        ))}
                    </Fragment>
                  );
                })
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
