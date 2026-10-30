"use client";

import React, { useCallback, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Edit3, Package, PackageSearch, Trash2, XCircle } from "lucide-react";
import { t as tUi } from "@/lib/i18n/ui";
import { SearchSelect } from "@/components/ui/search-select";
import type { AvailableLot } from "@/lib/sales/available-lots";
import { calcSalesLine, salesLineProblems, stockBalance, type LineProblem } from "@/lib/sales/sales-goods-model";
import { SalesStockPanel, type StockGroupId } from "./sales-stock-panel";

/**
 * Sales Booking — Step 2, Goods Entry. Same field set and the same line formula as the Purchase Booking Goods Entry
 * (see lib/sales/sales-goods-model.ts), with the Sales-specific stock selection: "Select Stock" opens a real selection panel
 * (source → lots → lot details → confirm); the chosen lot is shown above the editable sales fields with its remaining balance, and a line
 * can never exceed it. A line without a stock link is allowed but clearly marked as not checked against inventory.
 */
type Snapshot = {
  source: string;
  group: StockGroupId;
  lotNo: string;
  stockRef: string;
  lotId: string;
  goodsName: string;
  qtyName: string;
  totalQty: number;
  soldQty: number;
  remaining: number;
  totalWeight: number;
  warehouseName: string;
  location: string;
  branchName: string;
  status: string;
  containerNo: string;
};

type Props = {
  form: Record<string, any>;
  setForm: (updater: (prev: Record<string, any>) => Record<string, any>) => void;
  goodsEntries: any[];
  setGoodsEntries: (updater: (prev: any[]) => any[]) => void;
  lang?: string;
  onBack: () => void;
  onNext: () => void;
  dbGoods?: any[];
  countries?: any[];
  excludeOrderId?: string | null;
  /** edit a table row (moves it into the form, same as the other steps) */
  onEditItem?: (index: number) => void;
};

const QTY_TYPES = ["BAGS", "CARTONS", "Loose", "KGS", "Ton", "PCS", "Dozen", "Box", "Pallet"];
const num = (v: unknown) => {
  const n = Number(String(v ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
};
const fmt = (n: number, d = 2) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });

export function SalesBookingStep2({ form, setForm, goodsEntries = [], setGoodsEntries, lang = "en", onBack, onNext, dbGoods = [], countries = [], excludeOrderId = null, onEditItem }: Props) {
  const tt = useCallback((k: string, fb: string) => tUi(lang, `sales.ge_${k}`, fb), [lang]);
  const tp = useCallback((k: string, fb: string) => tUi(lang, `purchase.${k}`, fb), [lang]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [problems, setProblems] = useState<LineProblem[]>([]);
  const [tableError, setTableError] = useState("");

  const invoice = String(form.currencyType || "").toUpperCase();
  const settlement = String(form.secondaryCurrency || "").toUpperCase();
  const stock: Snapshot | null = form.stockSnapshot && form.stockSnapshot.lotNo ? form.stockSnapshot : null;
  const set = (key: string, value: unknown) => setForm((p) => ({ ...p, [key]: value }));
  const setAmountsDirty = (key: string, value: unknown) => setForm((p) => ({ ...p, [key]: value, manualTotalAmount: "", manualFinalAmount: "" }));

  // quantity of this lot already in the table (the line being edited has been moved back into the form, so it is not counted twice)
  const alreadyInTable = useMemo(
    () => (stock ? goodsEntries.filter((g) => g.stockLotNo === stock.lotNo && g.stockSource === stock.source).reduce((s, g) => s + num(g.qtyNo), 0) : 0),
    [goodsEntries, stock]
  );
  const effectiveRemaining = stock ? Math.max(0, stock.remaining - alreadyInTable) : null;
  const qty = num(form.qtyNo);
  const balance = stock ? stockBalance({ availableQty: effectiveRemaining ?? 0, requestedQty: qty }) : null;

  const lineInput = {
    qtyNo: form.qtyNo, qtyKgs: form.qtyKgs, emptyKgs: form.emptyKgs, netWeight: form.netWeight, divideWeight: form.divideWeight,
    coursePrice: form.coursePrice, exchangeRate: form.exchangeRate, operator: form.operator, invoiceCurrency: invoice, settlementCurrency: settlement,
    manualTotalAmount: form.manualTotalAmount, manualFinalAmount: form.manualFinalAmount
  };
  const totals = calcSalesLine(lineInput);

  const handleStockConfirmed = (lot: AvailableLot, group: StockGroupId) => {
    const managed = Boolean(lot.lotId);
    const remaining = lot.remainingQty ?? lot.availableQty;
    const snapshot: Snapshot = {
      source: lot.source, group, lotNo: lot.lotNo, stockRef: lot.stockRef || lot.lotNo, lotId: String(lot.id ?? ""), goodsName: lot.goodsName, qtyName: lot.qtyName,
      totalQty: lot.totalQty ?? lot.availableQty, soldQty: lot.soldQty ?? 0, remaining, totalWeight: lot.totalWeight ?? 0,
      warehouseName: lot.warehouseName || "", location: lot.location || "", branchName: lot.branchName || "", status: lot.status || "", containerNo: lot.containerNo || ""
    };
    setForm((p) => ({
      ...p,
      stockSnapshot: snapshot,
      stockSource: lot.source,
      saleType: "stock",
      saleSource: lot.source,
      stockLotNo: lot.lotNo,
      allotName: lot.lotNo,
      selectedLotId: lot.id || "",
      sourceStockRef: lot.stockRef || lot.lotNo,
      goodsId: lot.goodsId || "",
      goodsName: lot.goodsName || "",
      hsCode: lot.hsCode || "",
      brand: lot.brand || "",
      size: lot.size || "",
      origin: lot.origin || p.origin || "",
      qtyName: lot.qtyName || p.qtyName || "BAGS",
      qtyKgs: lot.qtyKgs > 0 ? lot.qtyKgs : p.qtyKgs,
      emptyKgs: lot.emptyKgs > 0 ? lot.emptyKgs : p.emptyKgs,
      netWeight: "",
      qtyNo: "",
      // the sale price, currency and rate are entered by the user — never inherited from the lot's PURCHASE price
      coursePrice: "",
      warehouseId: lot.warehouseId || "",
      warehouseName: lot.warehouseName || "",
      // managed lots keep their reservation fields
      managedLotId: managed ? lot.lotId : "",
      managedWarehouseId: managed ? lot.warehouseId || "" : "",
      managedRack: managed ? lot.rackBin || "" : "",
      managedLabel: managed ? lot.placeLabel || "" : "",
      lotRef: lot.lotRef || "",
      lotAvailableQty: managed ? remaining : 0,
      lotUnitCost: managed ? Number(lot.unitCost || 0) : 0,
      lotCostCurrency: managed ? lot.costCurrency || "" : "",
      lotPurchaseId: lot.purchaseId || "",
      manualTotalAmount: "",
      manualFinalAmount: ""
    }));
    setProblems([]);
    setPanelOpen(false);
  };

  const clearStock = () =>
    setForm((p) => ({
      ...p, stockSnapshot: null, stockSource: "", stockLotNo: "", allotName: "", selectedLotId: "", sourceStockRef: "", managedLotId: "", managedWarehouseId: "", managedRack: "",
      managedLabel: "", lotRef: "", lotAvailableQty: 0, lotUnitCost: 0, lotCostCurrency: "", lotPurchaseId: "", goodsId: "", warehouseId: "", warehouseName: ""
    }));

  const resetItemFields = () =>
    setForm((p) => ({
      ...p, stockSnapshot: null, stockSource: "", stockLotNo: "", allotName: "", selectedLotId: "", sourceStockRef: "", managedLotId: "", managedWarehouseId: "", managedRack: "",
      managedLabel: "", lotRef: "", lotAvailableQty: 0, lotUnitCost: 0, lotCostCurrency: "", lotPurchaseId: "", goodsId: "", warehouseId: "", warehouseName: "",
      goodsName: "", hsCode: "", brand: "", size: "", variety: "", qualityExtra: "", qtyNo: "", qtyKgs: "", emptyKgs: "", netWeight: "", coursePrice: "", qualityReport: "",
      manualTotalAmount: "", manualFinalAmount: ""
    }));

  const handleAdd = () => {
    const found = salesLineProblems({ ...lineInput, goodsName: form.goodsName, stockLinked: !!stock, stockRemaining: effectiveRemaining });
    setProblems(found);
    if (found.length) return;
    const rate = totals.rate.ok ? totals.rate : null;
    const entry = {
      goodsName: String(form.goodsName).trim(), productName: String(form.goodsName).trim(), goodsId: form.goodsId || undefined, hsCode: form.hsCode || "",
      itemId: form.stockLotNo || form.allotName || "", allotName: form.allotName || form.stockLotNo || "",
      brand: form.brand || "", size: form.size || "", variety: form.variety || "", quality: form.qualityExtra || "", qualityReport: form.qualityReport || "",
      origin: form.origin || "", originCountry: form.origin || "",
      qtyName: form.qtyName || "", unit: form.qtyName || "", qtyNo: num(form.qtyNo), quantity: num(form.qtyNo),
      qtyKgs: num(form.qtyKgs), emptyKgs: num(form.emptyKgs), netWeight: totals.netWeight, grossWeight: totals.grossWeight,
      divideType: form.divideType || "D/KGs", divideWeight: num(form.divideWeight) || 1, priceType: form.priceType || "P/KGs",
      coursePrice: num(form.coursePrice), unitPrice: num(form.coursePrice),
      currencyType: invoice, salesCurrency: invoice, invoiceCurrency: invoice, settlementCurrency: settlement,
      exchangeRate: rate ? rate.rate : 1, op: rate ? rate.operator : "*", operator: rate ? rate.operator : "*",
      totalAmount: totals.totalAmount, finalAmount: totals.finalAmount,
      // stock link (checked again on the server when the booking is saved)
      stockLinked: !!stock, stockSource: stock?.source || "", stockLotNo: stock?.lotNo || "", stockRef: stock?.stockRef || "", selectedLotId: stock?.lotId || "",
      stockRemainingAtEntry: stock ? effectiveRemaining : null,
      warehouse: form.warehouseName || "", warehouseId: form.warehouseId || "",
      managedLotId: form.managedLotId || "", managedWarehouseId: form.managedWarehouseId || "", managedRack: form.managedRack || "", managedLabel: form.managedLabel || "",
      lotRef: form.lotRef || "", lotPurchaseId: form.lotPurchaseId || "", lotUnitCost: Number(form.lotUnitCost || 0), lotCostCurrency: form.lotCostCurrency || ""
    };
    setGoodsEntries((prev) => [...prev, entry]);
    setTableError("");
    resetItemFields();
  };

  const removeRow = (idx: number) => setGoodsEntries((prev) => prev.filter((_, i) => i !== idx));
  const grand = goodsEntries.reduce((a, g) => ({ qty: a.qty + num(g.qtyNo), net: a.net + num(g.netWeight), amount: a.amount + num(g.totalAmount), final: a.final + num(g.finalAmount) }), { qty: 0, net: 0, amount: 0, final: 0 });

  const problemText: Record<LineProblem, string> = {
    goods_name: tt("err_goods", "Select or enter the goods name."),
    quantity: tt("err_qty", "Enter a quantity greater than zero."),
    price: tt("err_price", "Enter the selling price rate."),
    currency: tt("err_currency", "Select the invoice and settlement currencies in Step 1."),
    rate: tt("err_rate", "An exchange rate is required — go back to Step 1 and enter it (or use the daily rate)."),
    over_stock: tt("err_over", "The quantity is more than the stock remaining in this lot."),
    stock_without_balance: tt("err_nobalance", "The remaining balance of this stock is unknown. Select the stock again.")
  };

  const inputCls = "h-8 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] text-slate-900 outline-none focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:disabled:bg-slate-800";
  const lab = "mb-1 block text-[11px] font-bold text-slate-700 dark:text-slate-300";
  const locked = !!stock; // the stock's identity (goods, lot, origin, brand, size, unit) is fixed once a lot is chosen
  const goodsOptions = dbGoods.map((g: any) => ({ label: String(g.goods_name || g.goodsName || ""), value: String(g.goods_name || g.goodsName || "") })).filter((o: any) => o.value);
  const countryOptions = countries.map((c: any) => ({ label: String(c.name || c.country_name || c), value: String(c.name || c.country_name || c) })).filter((o: any) => o.value);

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900" data-testid="sales-step2">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 dark:border-slate-800">
        <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-900 dark:text-slate-100">
          <Package className="h-4 w-4 text-blue-600" />
          {tp("goods_entry_title", "GOODS ENTRY")}
        </h3>
        <button type="button" onClick={onBack} className="text-[11px] font-bold text-slate-500 underline hover:text-slate-800">
          {tp("back_to_booking", "← Back to Booking")}
        </button>
      </div>

      {/* ── stock: select / selected-lot details (above the editable fields) ── */}
      <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3 dark:border-blue-900 dark:bg-blue-950/20" data-testid="selected-stock-box">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-[11px] font-black uppercase tracking-wide text-blue-800 dark:text-blue-300">{tUi(lang, "sales.stk_selected_title", "Selected stock")}</div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setPanelOpen(true)} data-testid="select-stock-btn" className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-[11px] font-black text-white hover:bg-blue-700">
              <PackageSearch className="h-4 w-4" />
              {stock ? tUi(lang, "sales.stk_change", "Change Stock") : tUi(lang, "sales.stk_select_stock", "Select Stock")}
            </button>
            {stock && (
              <button type="button" onClick={clearStock} className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-300 px-3 text-[11px] font-bold text-slate-700 dark:border-slate-700 dark:text-slate-200" data-testid="clear-stock-btn">
                <XCircle className="h-4 w-4" />
                {tUi(lang, "sales.stk_clear", "Clear")}
              </button>
            )}
          </div>
        </div>
        {stock ? (
          <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px] sm:grid-cols-4" data-testid="selected-stock-details">
            {[
              [tUi(lang, "sales.stk_col_goods", "Goods Name"), stock.goodsName],
              [tUi(lang, "sales.stk_col_lot", "Lot Number"), stock.lotNo],
              [tUi(lang, "sales.stk_d_location", "Location / Warehouse"), stock.warehouseName || stock.location || "—"],
              [tUi(lang, "sales.stk_col_qty", "Quantity"), `${fmt(stock.totalQty, 3)} ${stock.qtyName}`],
              [tUi(lang, "sales.stk_col_weight", "Total Weight"), stock.totalWeight ? `${fmt(stock.totalWeight)} KG` : "—"],
              [tUi(lang, "sales.stk_col_sold", "Sold Quantity"), fmt(stock.soldQty + alreadyInTable, 3)],
              [tUi(lang, "sales.stk_col_remaining", "Remaining Balance"), `${fmt(effectiveRemaining ?? 0, 3)} ${stock.qtyName}`],
              [tUi(lang, "sales.stk_remaining_after", "Remaining after this sale"), balance ? `${fmt(Math.max(0, balance.after), 3)} ${stock.qtyName}` : "—"]
            ].map(([k, v], i) => (
              <div key={String(k)} className={i === 6 || i === 7 ? "font-black" : ""}>
                <div className="text-[10px] font-bold uppercase text-slate-500">{k}</div>
                <div className={`break-words ${i === 6 ? "text-emerald-700 dark:text-emerald-400" : i === 7 && balance?.over ? "text-red-600" : "text-slate-900 dark:text-slate-100"}`}>{v}</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-[11px] text-slate-600 dark:text-slate-400" data-testid="no-stock-note">
            {tUi(lang, "sales.stk_not_linked_note", "No stock selected — goods entered without stock are not checked against inventory. Use Select Stock to sell from a lot.")}
          </p>
        )}
        {balance?.over && (
          <p className="mt-2 rounded-lg bg-red-50 p-2 text-[11px] font-bold text-red-700 dark:bg-red-950/30" role="alert" data-testid="over-stock-alert">
            {tUi(lang, "sales.stk_err_over", "The quantity is more than the stock remaining in this lot.")} ({fmt(balance.overBy, 3)})
          </p>
        )}
      </div>

      {/* ── editable goods fields (same set as the Purchase Booking Goods Entry) ── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" data-testid="goods-fields">
        <div>
          <label className={lab}>{tp("net_kgs_weight", "Net KGs (Weight)")}</label>
          <input type="number" min="0" step="any" value={form.netWeight ?? ""} onChange={(e) => setAmountsDirty("netWeight", e.target.value)} className={inputCls} placeholder={totals.netWeight ? String(totals.netWeight) : ""} data-testid="f-net" />
        </div>
        <div>
          <label className={lab}>{tp("f_origin_country", "Origin Country")}</label>
          {locked ? (
            <input value={form.origin || ""} disabled className={inputCls} />
          ) : (
            <SearchSelect value={form.origin || ""} onValueChange={(v: string) => set("origin", v)} options={countryOptions} placeholder={tp("select_origin", "Select Origin")} />
          )}
        </div>
        <div>
          <label className={lab}>{tp("goods_name_star", "Goods Name*")}</label>
          {locked ? (
            <input value={form.goodsName || ""} disabled className={inputCls} data-testid="f-goods" />
          ) : (
            <SearchSelect
              value={form.goodsName || ""}
              onValueChange={(v: string) => {
                const g = dbGoods.find((x: any) => String(x.goods_name || x.goodsName || "") === v);
                setForm((p) => ({ ...p, goodsName: v, hsCode: g?.chs_code || g?.hs_code || g?.hsCode || p.hsCode || "" }));
              }}
              options={goodsOptions}
              placeholder={tp("select_goods_name", "Select Goods")}
            />
          )}
        </div>
        <div>
          <label className={lab}>{tp("th_hs_code", "HS Code")}</label>
          <input value={form.hsCode || ""} onChange={(e) => set("hsCode", e.target.value)} disabled={locked} className={inputCls} />
        </div>
        <div>
          <label className={lab}>{tUi(lang, "sales.ge_lot_number", "Lot Number")}</label>
          <input value={form.allotName || ""} onChange={(e) => set("allotName", e.target.value)} disabled={locked} className={`${inputCls} font-mono`} data-testid="f-lot" />
        </div>
        <div>
          <label className={lab}>{tp("brand_label", "Brand")}</label>
          <input value={form.brand || ""} onChange={(e) => set("brand", e.target.value)} disabled={locked} className={inputCls} />
        </div>
        <div>
          <label className={lab}>{tp("size_label", "Size")}</label>
          <input value={form.size || ""} onChange={(e) => set("size", e.target.value)} disabled={locked} className={inputCls} />
        </div>
        <div>
          <label className={lab}>{tp("variety_label", "Variety")}</label>
          <input value={form.variety || ""} onChange={(e) => set("variety", e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={lab}>{tp("extra_details_label", "Quality / Extra Details")}</label>
          <input value={form.qualityExtra || ""} onChange={(e) => set("qualityExtra", e.target.value)} placeholder={tp("extra_details_placeholder", "e.g. Soft Shell / Light Color")} className={inputCls} />
        </div>
        <div>
          <label className={lab}>{tp("qty_name_label", "Qty Name")}</label>
          <select value={form.qtyName || ""} onChange={(e) => set("qtyName", e.target.value)} disabled={locked} className={inputCls}>
            {!QTY_TYPES.includes(form.qtyName || "") && form.qtyName ? <option value={form.qtyName}>{form.qtyName}</option> : null}
            <option value="">{tp("select_qty_name", "Select Qty Name")}</option>
            {QTY_TYPES.map((q) => <option key={q} value={q}>{q}</option>)}
          </select>
        </div>
        <div>
          <label className={lab}>{tp("quantity_no", "Quantity No")}</label>
          <input type="number" min="0" step="any" value={form.qtyNo ?? ""} onChange={(e) => setAmountsDirty("qtyNo", e.target.value)} className={`${inputCls} ${balance?.over ? "border-red-500" : ""}`} data-testid="f-qty" aria-invalid={!!balance?.over} />
        </div>
        <div>
          <label className={lab}>{tp("qty_kgs_1", "1 Qty KGS")}</label>
          <input type="number" min="0" step="any" value={form.qtyKgs ?? ""} onChange={(e) => setAmountsDirty("qtyKgs", e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={lab}>{tp("empty_kgs_1", "1 Empty KGS")}</label>
          <input type="number" min="0" step="any" value={form.emptyKgs ?? ""} onChange={(e) => setAmountsDirty("emptyKgs", e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={lab}>{tp("divide_type", "Divide Type")}</label>
          <select value={form.divideType || "D/KGs"} onChange={(e) => set("divideType", e.target.value)} className={inputCls}>
            <option value="D/KGs">{tp("opt_divide_per_kg", "Divide / Kg")}</option>
            <option value="D/LBs">{tp("opt_divide_per_lb", "Divide / Lb")}</option>
          </select>
        </div>
        <div>
          <label className={lab}>{tp("divide_weight_value", "Divide Weight / Value")}</label>
          <input type="number" min="0" step="any" value={form.divideWeight ?? ""} onChange={(e) => setAmountsDirty("divideWeight", e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={lab}>{tp("price_type", "Price Type")}</label>
          <select value={form.priceType || "P/KGs"} onChange={(e) => set("priceType", e.target.value)} className={inputCls}>
            <option value="P/KGs">{tp("opt_price_per_kg", "Price / Kg")}</option>
            <option value="P/LBs">{tp("opt_price_per_lb", "Price / Lb")}</option>
          </select>
        </div>
        <div>
          <label className={lab}>{tp("price_rate_c1", "Price Rate (C1)")}</label>
          <input type="number" min="0" step="any" value={form.coursePrice ?? ""} onChange={(e) => setAmountsDirty("coursePrice", e.target.value)} className={inputCls} data-testid="f-price" />
        </div>
        <div>
          <label className={lab}>{tp("quality_report_reference", "Quality Report Reference")}</label>
          <input value={form.qualityReport || ""} onChange={(e) => set("qualityReport", e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={lab}>{tUi(lang, "sales.ge_invoice_currency", "Invoice Currency")}</label>
          <input value={invoice || "—"} disabled className={`${inputCls} font-bold`} data-testid="f-invoice-ccy" />
        </div>
        <div>
          <label className={lab}>{tUi(lang, "sales.ge_exchange_rate", "Exchange Rate")} ({invoice || "—"} → {settlement || "—"})</label>
          <input value={totals.rate.ok ? `${totals.rate.operator === "/" ? "÷" : "×"} ${totals.rate.rate}` : tUi(lang, "sales.ge_rate_missing", "Missing — set in Step 1")} disabled className={`${inputCls} font-mono ${totals.rate.ok ? "" : "border-red-400 text-red-600"}`} data-testid="f-rate" />
        </div>
        <div>
          <label className={lab}>{tp("th_amount", "Amount")} ({invoice || "—"})</label>
          <input type="number" step="any" value={form.manualTotalAmount !== "" && form.manualTotalAmount != null ? form.manualTotalAmount : totals.totalAmount} onChange={(e) => set("manualTotalAmount", e.target.value)} className={`${inputCls} font-mono font-bold`} data-testid="f-amount" />
        </div>
        <div>
          <label className={lab}>{tp("th_final", "Final")} ({settlement || "—"})</label>
          <input type="number" step="any" value={form.manualFinalAmount !== "" && form.manualFinalAmount != null ? form.manualFinalAmount : totals.finalAmount} onChange={(e) => set("manualFinalAmount", e.target.value)} className={`${inputCls} font-mono font-bold`} data-testid="f-final" />
        </div>
      </div>

      {problems.length > 0 && (
        <ul className="list-disc space-y-0.5 rounded-lg bg-red-50 p-3 ps-6 text-[11px] font-bold text-red-700 dark:bg-red-950/30" role="alert" data-testid="line-problems">
          {problems.map((p) => <li key={p}>{problemText[p]}</li>)}
        </ul>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={handleAdd} data-testid="add-goods-btn" className="h-9 rounded-lg bg-emerald-600 px-4 text-[11px] font-black uppercase tracking-wide text-white hover:bg-emerald-700">
          + {tUi(lang, "sales.ge_add_goods", "Add Goods to Table")}
        </button>
      </div>

      {/* ── goods table ── */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
        <table className="w-full min-w-[760px] border-collapse text-[11px]" data-testid="goods-table">
          <thead>
            <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-wide text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
              <th className="px-2 py-2 text-start">#</th>
              <th className="px-2 py-2 text-start">{tp("goods_name_star", "Goods Name*").replace("*", "")}</th>
              <th className="px-2 py-2 text-start">{tUi(lang, "sales.ge_lot_number", "Lot Number")}</th>
              <th className="px-2 py-2 text-end">{tp("quantity_no", "Quantity No")}</th>
              <th className="px-2 py-2 text-end">{tp("net_kgs_weight", "Net KGs (Weight)")}</th>
              <th className="px-2 py-2 text-end">{tp("price_rate_c1", "Price Rate (C1)")}</th>
              <th className="px-2 py-2 text-end">{tp("th_amount", "Amount")}</th>
              <th className="px-2 py-2 text-end">{tp("th_final", "Final")}</th>
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {goodsEntries.length === 0 ? (
              <tr><td colSpan={9} className="px-3 py-6 text-center text-slate-500" data-testid="goods-empty">{tUi(lang, "sales.ge_empty_table", "No goods added yet.")}</td></tr>
            ) : (
              goodsEntries.map((g, i) => (
                <tr key={`${g.goodsName}-${g.stockLotNo}-${i}`} className="border-t border-slate-100 dark:border-slate-800" data-testid="goods-row">
                  <td className="px-2 py-2">{i + 1}</td>
                  <td className="px-2 py-2 font-bold">{g.goodsName}{!g.stockLinked && <span className="ms-1 rounded bg-amber-100 px-1 text-[9px] font-bold text-amber-800">{tUi(lang, "sales.ge_no_stock_tag", "no stock link")}</span>}</td>
                  <td className="px-2 py-2 font-mono">{g.stockLotNo || g.allotName || "—"}</td>
                  <td className="px-2 py-2 text-end tabular-nums">{fmt(num(g.qtyNo), 3)} {g.qtyName}</td>
                  <td className="px-2 py-2 text-end tabular-nums">{fmt(num(g.netWeight))}</td>
                  <td className="px-2 py-2 text-end tabular-nums">{fmt(num(g.coursePrice))} {g.invoiceCurrency || g.currencyType}</td>
                  <td className="px-2 py-2 text-end font-bold tabular-nums">{fmt(num(g.totalAmount))} {g.invoiceCurrency || g.currencyType}</td>
                  <td className="px-2 py-2 text-end font-bold tabular-nums">{fmt(num(g.finalAmount))} {g.settlementCurrency || ""}</td>
                  <td className="px-2 py-2 text-end">
                    <button type="button" onClick={() => onEditItem?.(i)} className="p-1 text-blue-600" aria-label="edit"><Edit3 className="h-3.5 w-3.5" /></button>
                    <button type="button" onClick={() => removeRow(i)} className="p-1 text-red-600" aria-label="delete"><Trash2 className="h-3.5 w-3.5" /></button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {goodsEntries.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50 font-black dark:border-slate-700 dark:bg-slate-800/60" data-testid="goods-total">
                <td colSpan={3} className="px-2 py-2 text-end">{tUi(lang, "sales.ge_total", "Total")}</td>
                <td className="px-2 py-2 text-end tabular-nums">{fmt(grand.qty, 3)}</td>
                <td className="px-2 py-2 text-end tabular-nums">{fmt(grand.net)}</td>
                <td />
                <td className="px-2 py-2 text-end tabular-nums">{fmt(grand.amount)} {invoice}</td>
                <td className="px-2 py-2 text-end tabular-nums">{fmt(grand.final)} {settlement}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {tableError && <p className="text-[11px] font-bold text-red-600" role="alert">{tableError}</p>}
      <div className="flex justify-between gap-2 pt-1">
        <button type="button" onClick={onBack} className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-300 px-4 text-xs font-bold text-slate-700 dark:border-slate-700 dark:text-slate-200">
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          {tp("back_to_booking", "← Back to Booking").replace("←", "").trim()}
        </button>
        <button
          type="button"
          onClick={() => {
            if (goodsEntries.length === 0) return setTableError(tUi(lang, "sales.ge_err_no_goods", "Add at least one goods line before continuing."));
            setTableError("");
            onNext();
          }}
          data-testid="step2-next"
          className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-5 text-xs font-black uppercase tracking-wide text-white"
        >
          {tUi(lang, "sales.ge_next_shipping", "Next: Shipping & Payment")}
          <ArrowRight className="h-4 w-4 rtl:rotate-180" />
        </button>
      </div>

      <SalesStockPanel open={panelOpen} onClose={() => setPanelOpen(false)} onConfirm={handleStockConfirmed} lang={lang} excludeOrderId={excludeOrderId} initialGroup={(stock?.group as StockGroupId) || "warehouse"} />
    </section>
  );
}
