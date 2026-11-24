"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Package,
  Search,
  ChevronLeft,
  ChevronRight,
  Plus,
  AlertTriangle,
  Building2,
  CheckCircle2,
  Layers
} from "lucide-react";
import { createPortal } from "react-dom";
import { convertedSalesAmount, getBookingCurrencies } from "@/lib/sales/booking-currencies";
import { t as tUi } from "@/lib/i18n/ui";
import { Button } from "@/components/ui/button";
import { translateHeader } from "@/lib/i18n/table-headers";
import { SalesBookingGoodsReport } from "./sales-booking-goods-report";
import { SalesStockPanel } from "./sales-stock-panel";

// Stock sources a sale can take goods from (the same groups as the Select Stock panel, /api/erp/sales/available-lots):
//   warehouse = Goods Transfer Journal lots + warehouse balances (Receiving / Confirm Stock) + Local Purchase
//   booking   = Purchase Booking lines not yet loaded
//   export    = Loading Booking goods on the way (in transit) + endorsed stock
const STOCK_GROUPS = [
  { id: "warehouse", sources: ["warehouse_all"], icon: Building2 },
  { id: "booking", sources: ["booking"], icon: Package },
  { id: "export", sources: ["export_all"], icon: Layers }
];

export function SalesBookingStep2({
  form,
  setForm,
  goodsEntries = [],
  setGoodsEntries,
  lang = "en",
  onNext,
  onBack
}) {
  const [stockModalOpen, setStockModalOpen] = useState(false);
  const [stockGroup, setStockGroup] = useState(() => (["warehouse", "booking", "export"].includes(form.stockGroup) ? form.stockGroup : "warehouse"));
  const [groupLots, setGroupLots] = useState({}); // { [group]: { status: "loading" | "ok" | "error", lots: [] } }
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [stockError, setStockError] = useState("");
  const [editingIndex, setEditingIndex] = useState(null);

  // Active item inputs in form
  const productName = form.goodsName || "";
  const hsCode = form.hsCode || "";
  const itemId = form.stockLotNo || form.allotName || "";
  const brand = form.brand || "";
  const size = form.size || "";
  const grade = form.grade || "";
  const quality = form.qualityReport || "";
  const qtyName = form.qtyName || "";
  const qtyNo = Number(form.qtyNo || 0);
  const qtyKgs = Number(form.qtyKgs) || 0;
  const emptyKgs = Number(form.emptyKgs) || 0;
  const calculatedGross = qtyNo * qtyKgs;
  const calculatedNet = Math.max(0, calculatedGross - qtyNo * emptyKgs);
  const unitPrice = Number(form.coursePrice || 0);
  const freightIca = Number(form.freightIca || 0);
  const itemType = form.itemType || "";
  const stackWeight = form.stackWeight || "";
  const packType = form.packType || "";
  const totalBoxes = Number(form.totalBoxes || 0);
  const availableQty = Number(form.lotAvailableQty || 0);
  const selectedLotRef = form.stockLotNo || "";
  const currencies = getBookingCurrencies(form);

  // Validate stock: check if quantity exceeds available balance
  const isOverStock = selectedLotRef && availableQty > 0 && qtyNo > availableQty;

  // Real stock records of one source group (loaded once per group; no demo rows)
  const loadGroup = useCallback(async (group) => {
    const def = STOCK_GROUPS.find((g) => g.id === group);
    if (!def) return;
    setGroupLots((p) => ({ ...p, [group]: { status: "loading", lots: [] } }));
    try {
      const results = await Promise.all(
        def.sources.map(async (src) => {
          const qs = new URLSearchParams({ source: src, limit: "300", lang });
          const res = await fetch(`/api/erp/sales/available-lots?${qs.toString()}`, { credentials: "same-origin" });
          const json = await res.json().catch(() => null);
          if (!res.ok) throw new Error("load failed");
          return json?.data?.lots ?? [];
        })
      );
      setGroupLots((p) => ({ ...p, [group]: { status: "ok", lots: results.flat() } }));
    } catch {
      setGroupLots((p) => ({ ...p, [group]: { status: "error", lots: [] } }));
    }
  }, [lang]);

  useEffect(() => {
    if (!groupLots[stockGroup]) void loadGroup(stockGroup);
  }, [stockGroup, groupLots, loadGroup]);

  const groupState = groupLots[stockGroup] || { status: "loading", lots: [] };
  const suggestions = useMemo(() => {
    const q = productName.trim().toLowerCase();
    const lots = groupState.lots || [];
    const hits = q
      ? lots.filter((l) => [l.goodsName, l.lotNo, l.stockRef, l.brand, l.origin, l.hsCode, l.warehouseName].filter(Boolean).join(" ").toLowerCase().includes(q))
      : lots;
    return hits.slice(0, 30);
  }, [groupState, productName]);

  const chooseGroup = (group) => {
    setStockGroup(group);
    setForm((p) => ({ ...p, stockGroup: group }));
    setSuggestOpen(true);
  };

  const handleOpenStockModal = () => {
    setSuggestOpen(false);
    setStockModalOpen(true);
  };

  // Fill the goods entry from the chosen stock record (AvailableLot from /api/erp/sales/available-lots)
  const handleStockSelected = (lot, group = stockGroup) => {
    if (!lot) return;
    const remaining = Number(lot.remainingQty ?? lot.availableQty ?? 0);
    setForm((prev) => ({
      ...prev,
      stockGroup: group,
      saleSource: lot.source || group,
      goodsId: lot.goodsId || "",
      goodsName: lot.goodsName || "",
      hsCode: lot.hsCode || "",
      stockLotNo: lot.lotNo || "",
      allotName: lot.lotNo || "",
      selectedLotId: lot.id || "",
      journalTransferId: lot.source === "journal" ? (lot.id || "") : "",
      stockSource: lot.source || group,
      managedLotId: lot.lotId || "",
      managedWarehouseId: lot.warehouseId || "",
      managedRack: lot.rackBin || "",
      managedLabel: lot.placeLabel || "",
      lotRef: lot.lotRef || lot.stockRef || "",
      lotPurchaseId: lot.purchaseId || "",
      lotPurchaseAccountName: lot.purchaseAccountName || "",
      lotPurchaseAccountNo: lot.purchaseAccountNo || "",
      lotUnitCost: Number(lot.landedUnitCost ?? lot.unitCost ?? 0),
      lotCostCurrency: lot.costCurrency || lot.currencyType || "",
      brand: lot.brand || "",
      size: lot.size || "",
      origin: lot.origin || "",
      qtyName: lot.qtyName || prev.qtyName || "",
      qtyKgs: Number(lot.qtyKgs || 0),
      emptyKgs: Number(lot.emptyKgs || 0),
      qtyNo: prev.qtyNo > 0 && prev.qtyNo <= remaining ? prev.qtyNo : 0,
      warehouseId: lot.warehouseId || "",
      warehouseName: lot.warehouseName || lot.location || "",
      lotAvailableQty: remaining
    }));
    setSuggestOpen(false);
    setStockError("");
  };

  // Add or update item in Goods Entries table
  const handleAddOrUpdateItem = () => {
    if (!productName.trim()) {
      setStockError(tUi(lang, "sales.s2_err_pick_item", "Select a stock source, then search and pick the item."));
      return;
    }
    if (!(qtyNo > 0)) {
      setStockError(tUi(lang, "sales.s2_err_qty", "Enter the quantity."));
      return;
    }
    if (isOverStock) {
      setStockError(tUi(lang, "sales.stk_err_over", "Quantity exceeds the remaining stock of this lot."));
      return;
    }
    // the same stock lot may appear only once in the table (edit that line instead of adding it again)
    const sameLot = selectedLotRef
      ? goodsEntries.findIndex((it, i) => i !== editingIndex && (it.lotNo || "") === selectedLotRef)
      : goodsEntries.findIndex((it, i) => i !== editingIndex && !it.lotNo && String(it.goodsName || "").trim().toLowerCase() === productName.trim().toLowerCase());
    if (sameLot >= 0) {
      setStockError(tUi(lang, "sales.s2_err_duplicate", "This item is already in the table. Edit that line instead of adding it again."));
      return;
    }

    const calculatedAmount = qtyNo * unitPrice;
    const finalAmt = convertedSalesAmount(calculatedAmount, currencies.rate);
    if (finalAmt === null && currencies.sales && currencies.final) {
      setStockError(tUi(lang, "purchase.exchange_rate", "Exchange Rate"));
      return;
    }

    const newItem = {
      goodsId: form.goodsId || null,
      goodsName: productName,
      productName: productName,
      hsCode: hsCode,
      itemId: itemId,
      brand: brand,
      size: size,
      grade: grade,
      quality: quality,
      qtyName: qtyName,
      unit: qtyName,
      qtyNo: qtyNo,
      quantity: qtyNo,
      qtyKgs,
      emptyKgs,
      unitPrice: unitPrice,
      coursePrice: unitPrice,
      freightIca: freightIca,
      itemType: itemType,
      stackWeight: stackWeight,
      packType: packType,
      totalBoxes: totalBoxes,
      totalAmount: calculatedAmount,
      finalAmount: finalAmt ?? calculatedAmount,
      exchangeRate: currencies.rate.ok ? currencies.rate.rate : 1,
      op: currencies.rate.operator,
      purchaseCurrency: form.goodsPurchaseCurrency || currencies.purchase,
      currencyType: currencies.sales,
      salesCurrency: currencies.sales,
      secondaryCurrency: currencies.final,
      grossWeight: calculatedGross,
      netWeight: calculatedNet,
      origin: form.origin || "",
      lotNo: selectedLotRef,
      purchaseAccountName: selectedLotRef ? form.lotPurchaseAccountName || "" : "",
      purchaseAccountNo: selectedLotRef ? form.lotPurchaseAccountNo || "" : "",
      lotId: form.managedLotId || "",
      saleSource: form.saleSource || stockGroup,
      journalTransferId: form.journalTransferId || "",
      stockGroup,
      lotAvailableQty: availableQty,
      warehouse: form.warehouseName || "",
      warehouseId: form.warehouseId || ""
    };

    if (editingIndex !== null) {
      setGoodsEntries((prev) => {
        const copy = [...prev];
        copy[editingIndex] = newItem;
        return copy;
      });
    } else {
      setGoodsEntries((prev) => [...prev, newItem]);
    }

    clearEntry();
  };

  const clearEntry = () => {
    setEditingIndex(null);
    setSuggestOpen(false);
    setForm((p) => ({
      ...p,
      goodsId: "", goodsName: "", hsCode: "", stockLotNo: "", allotName: "", selectedLotId: "", managedLotId: "", journalTransferId: "",
      brand: "", size: "", grade: "", qualityReport: "", origin: "", qtyNo: 0, coursePrice: 0, freightIca: 0,
      qtyKgs: 0, emptyKgs: 0, totalBoxes: 0, packType: "", itemType: "", stackWeight: "", lotAvailableQty: 0,
      warehouseId: "", warehouseName: "", goodsPurchaseCurrency: "", lotPurchaseAccountName: "", lotPurchaseAccountNo: ""
    }));
    setStockError("");
  };

  const handleEditEntry = (idx) => {
    const item = goodsEntries[idx];
    if (!item) return;
    setEditingIndex(idx);
    setForm((prev) => ({
      ...prev,
      goodsName: item.goodsName || item.productName,
      hsCode: item.hsCode,
      stockLotNo: item.itemId || item.lotNo,
      lotPurchaseAccountName: item.purchaseAccountName || "",
      lotPurchaseAccountNo: item.purchaseAccountNo || "",
      goodsPurchaseCurrency: item.purchaseCurrency || "",
      journalTransferId: item.journalTransferId || "",
      brand: item.brand,
      size: item.size,
      grade: item.grade,
      qualityReport: item.quality,
      qtyName: item.qtyName || item.unit,
      qtyNo: item.qtyNo || item.quantity,
      coursePrice: item.coursePrice || item.unitPrice,
      freightIca: item.freightIca,
      itemType: item.itemType,
      stackWeight: item.stackWeight,
      packType: item.packType,
      totalBoxes: item.totalBoxes,
      lotAvailableQty: item.lotAvailableQty || 0,
      qtyKgs: item.qtyKgs || 0,
      emptyKgs: item.emptyKgs || 0,
      origin: item.origin || "",
      warehouseName: item.warehouse || ""
    }));
  };

  const tr = label => translateHeader(lang, label);
  const number = (value, digits = 3) => value == null || value === "" || !Number.isFinite(Number(value))
    ? "—"
    : Number(value).toLocaleString(lang, { maximumFractionDigits: digits });
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(300px,1fr)_minmax(0,2.2fr)] gap-3 items-start animate-in fade-in duration-200">
      {/* LEFT COLUMN: GOODS ENTRY DETAILS FORM */}
      <div className="min-w-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-2 rounded-lg bg-blue-900 px-3 py-2 text-white">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <Package className="w-4 h-4" />
            {tr("Goods Entry Details")}
          </h3>
          {selectedLotRef && (
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 font-mono whitespace-nowrap">
              Lot: {selectedLotRef}
            </span>
          )}
        </div>

        {/* 1. STOCK SOURCE * — first choose where the goods come from */}
        <div className="space-y-1" data-testid="sales-stock-source">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase text-slate-700 dark:text-slate-300">
              {tUi(lang, "sales.s2_stock_source", "Stock")} <span className="text-red-500">*</span>
            </span>
            <Button type="button" onClick={handleOpenStockModal} className="h-8 bg-blue-600 px-2 text-xs text-white">
              <Search className="h-3.5 w-3.5" aria-hidden="true" />
              {tr("Open Stock")}
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {STOCK_GROUPS.map((g) => {
              const Icon = g.icon;
              const active = stockGroup === g.id;
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => chooseGroup(g.id)}
                  aria-pressed={active}
                  className={`h-9 px-2 rounded-lg border text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors ${active ? "bg-emerald-600 border-emerald-600 text-white" : "bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:border-emerald-400"}`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{tUi(lang, `sales.stk_source_${g.id}`, g.id)}</span>
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-slate-500 dark:text-slate-400">{tUi(lang, `sales.stk_source_${stockGroup}_hint`, "")}</p>
        </div>

        {/* 2. ITEM NAME * — search the chosen stock (e.g. "walnut"); picking a record fills the line */}
        <div className="space-y-1">
          <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
            {tUi(lang, "sales.s2_item_name", "Item Name")} <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              type="text"
              value={productName}
              onChange={(e) => {
                const v = e.target.value;
                // typing a new name drops the previously picked stock record
                setForm((p) => ({ ...p, goodsName: v, stockLotNo: "", allotName: "", selectedLotId: "", managedLotId: "", lotAvailableQty: 0 }));
                setSuggestOpen(true);
              }}
              onFocus={() => setSuggestOpen(true)}
              onBlur={() => setTimeout(() => setSuggestOpen(false), 150)}
              placeholder={tUi(lang, "sales.s2_item_search_ph", "Search item in this stock (e.g. walnut)...")}
              className="w-full h-9 ps-3 pe-8 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-blue-500 font-semibold"
              data-testid="sales-item-search"
            />
            {suggestOpen && (
              <div className="absolute start-0 top-10 w-full max-h-64 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl z-50 p-1" data-testid="sales-item-suggestions">
                {groupState.status === "loading" ? (
                  <p className="px-3 py-2 text-[11px] text-slate-500">{tUi(lang, "sales.stk_loading", "Loading stock...")}</p>
                ) : groupState.status === "error" ? (
                  <p className="px-3 py-2 text-[11px] text-rose-600">{tUi(lang, "sales.stk_load_error", "Could not load stock.")}</p>
                ) : suggestions.length === 0 ? (
                  <p className="px-3 py-2 text-[11px] text-slate-500">{tUi(lang, "sales.stk_empty", "No stock found.")}</p>
                ) : (
                  suggestions.map((lot, i) => (
                    <button
                      key={`${lot.source}|${lot.lotNo}|${lot.id ?? i}`}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleStockSelected(lot)}
                      className="w-full text-start px-3 py-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/40"
                    >
                      <span className="block text-xs font-bold text-slate-800 dark:text-slate-100">{lot.goodsName}</span>
                      <span className="block text-[10px] text-slate-500 font-mono">
                        {lot.lotNo} · {Number(lot.remainingQty ?? lot.availableQty ?? 0).toLocaleString(undefined, { maximumFractionDigits: 3 })} {lot.qtyName} · {lot.warehouseName || lot.location || ""}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          {availableQty > 0 && selectedLotRef && (
            <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
              {tUi(lang, "sales.stk_col_remaining", "Remaining")}: {availableQty.toLocaleString(undefined, { maximumFractionDigits: 3 })} {qtyName}
            </p>
          )}
        </div>

        {/* HS Code & Item Name / ID */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="space-y-1">
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
              HS Code
            </label>
            <input
              type="text"
              value={hsCode}
              onChange={(e) => setForm((p) => ({ ...p, hsCode: e.target.value }))}
              
              className="w-full h-8 px-2.5 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-blue-500 font-mono"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
              {tUi(lang, "sales.s2_lot_id", "Lot / Item ID")}
            </label>
            <input
              type="text"
              value={itemId}
              onChange={(e) => setForm((p) => ({ ...p, stockLotNo: e.target.value }))}
              readOnly
              className="w-full h-8 px-2.5 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-blue-500 font-mono"
            />
          </div>
        </div>

        {/* Brand & Size / Specification */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="space-y-1">
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Brand
            </label>
            <input
              type="text"
              value={brand}
              onChange={(e) => setForm((p) => ({ ...p, brand: e.target.value }))}
              className="w-full h-8 px-2.5 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-blue-500 font-semibold"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Size / Specification
            </label>
            <input
              type="text"
              value={size}
              onChange={(e) => setForm((p) => ({ ...p, size: e.target.value }))}
              className="w-full h-8 px-2.5 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-blue-500 font-semibold"
            />
          </div>
        </div>

        {/* Grade & Quality / Stock Status */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="space-y-1">
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Grade
            </label>
            <select
              value={grade}
              onChange={(e) => setForm((p) => ({ ...p, grade: e.target.value }))}
              className="w-full h-8 px-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-blue-500 font-semibold"
            >
              <option value="">Select Grade</option>
              <option value="A-Grade">A-Grade</option>
              <option value="B-Grade">B-Grade</option>
              <option value="Premium">Premium</option>
              <option value="Commercial">Commercial</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Quality / Stock Status
            </label>
            <select
              value={quality}
              onChange={(e) => setForm((p) => ({ ...p, qualityReport: e.target.value }))}
              className="w-full h-8 px-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-blue-500 font-semibold"
            >
              <option value="">e.g. A-Grade (Original)</option>
              <option value="A-Grade (Original)">A-Grade (Original)</option>
              <option value="Export Quality">Export Quality</option>
              <option value="Passed">Passed Inspection</option>
              <option value="Fresh Arrival">Fresh Arrival</option>
            </select>
          </div>
        </div>

        {/* Qty per Unit & Quantity (No.) */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="space-y-1">
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Qty per Unit
            </label>
            <select
              value={qtyName}
              onChange={(e) => setForm((p) => ({ ...p, qtyName: e.target.value }))}
              className="w-full h-8 px-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-blue-500 font-semibold"
            >
              <option value="Bag">Bag</option>
              <option value="MT">MT</option>
              <option value="KG">KG</option>
              <option value="Carton">Carton</option>
              <option value="Box">Box</option>
              <option value="Ton">Ton</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Quantity (No.)
            </label>
            <input
              type="number"
              value={qtyNo}
              onChange={(e) => setForm((p) => ({ ...p, qtyNo: Number(e.target.value) }))}
              className={`w-full h-8 px-2.5 text-xs bg-white dark:bg-slate-950 border rounded-lg outline-none font-bold ${
                isOverStock ? "border-red-500 bg-red-50 text-red-700" : "border-slate-200 dark:border-slate-800 focus:border-blue-500"
              }`}
            />
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-2 text-xs">
          {[["Total Net Weight", calculatedNet], ["Total Gross Weight", calculatedGross]].map(([label, value]) => (
            <div key={label} className="rounded-lg bg-blue-50 p-2 text-blue-950 dark:bg-blue-950 dark:text-blue-100">
              <dt>{tr(label)}</dt>
              <dd className="font-bold"><bdi>{number(value)} kg</bdi></dd>
            </div>
          ))}
        </dl>

        {/* Unit Price & Freight / ICA */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="space-y-1">
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Unit Price
            </label>
            <input
              type="number"
              step="0.01"
              value={unitPrice}
              onChange={(e) => setForm((p) => ({ ...p, coursePrice: Number(e.target.value) }))}
              className="w-full h-8 px-2.5 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-blue-500 font-bold"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Freight / ICA
            </label>
            <input
              type="number"
              step="0.01"
              value={freightIca}
              onChange={(e) => setForm((p) => ({ ...p, freightIca: Number(e.target.value) }))}
              className="w-full h-8 px-2.5 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-blue-500 font-semibold"
            />
          </div>
        </div>

        {/* Item Type & Stack / Weight / CBM */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="space-y-1">
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Item Type
            </label>
            <select
              value={itemType}
              onChange={(e) => setForm((p) => ({ ...p, itemType: e.target.value }))}
              className="w-full h-8 px-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-blue-500 font-semibold"
            >
              <option value="">Select Type</option>
              <option value="Dry Food">Dry Food</option>
              <option value="Grains">Grains</option>
              <option value="Pulses">Pulses</option>
              <option value="Spices">Spices</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Stack / Weight / CBM
            </label>
            <input
              type="text"
              value={stackWeight}
              onChange={(e) => setForm((p) => ({ ...p, stackWeight: e.target.value }))}
              placeholder="e.g. 25kg / 1.5 CBM"
              className="w-full h-8 px-2.5 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-blue-500 font-semibold"
            />
          </div>
        </div>

        {/* Pack Type & Total Boxes / Ctn */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="space-y-1">
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Pack Type
            </label>
            <select
              value={packType}
              onChange={(e) => setForm((p) => ({ ...p, packType: e.target.value }))}
              className="w-full h-8 px-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-blue-500 font-semibold"
            >
              <option value="">Select Type</option>
              <option value="Jute Bags">Jute Bags</option>
              <option value="PP Bags">PP Bags</option>
              <option value="Cartons">Cartons</option>
              <option value="Wooden Crates">Wooden Crates</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Total Boxes / Ctn
            </label>
            <input
              type="number"
              value={totalBoxes}
              onChange={(e) => setForm((p) => ({ ...p, totalBoxes: Number(e.target.value) }))}
              className="w-full h-8 px-2.5 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-blue-500 font-semibold"
            />
          </div>
        </div>

        {/* Stock Validation / Warning Banner */}
        {isOverStock && (
          <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 flex items-center gap-2 text-[11px] font-bold">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              Cannot sell more than available stock! Max available: <b>{availableQty.toLocaleString()} {qtyName}</b>.
            </span>
          </div>
        )}

        {stockError && !isOverStock && (
          <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 text-amber-800 text-[11px] font-bold">
            {stockError}
          </div>
        )}

        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={clearEntry} className="h-9 text-xs">
            {tr("Clear")}
          </Button>
          <Button type="button" disabled={isOverStock} onClick={handleAddOrUpdateItem}
            className="flex-1 h-9 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs">
            <Plus className="w-4 h-4" />
            {editingIndex !== null ? tr("Update Goods Item") : tr("Add Goods Item to Table")}
          </Button>
        </div>

        {/* Bottom Back / Next Buttons */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <Button
            type="button"
            variant="outline"
            onClick={onBack}
            className="flex-1 h-9 border-slate-300 text-slate-700 dark:text-slate-200 text-xs font-bold"
          >
            <ChevronLeft className="w-4 h-4 rtl:rotate-180 mr-1" />
            {tr("Back")}
          </Button>
          <Button
            type="button"
            onClick={onNext}
            className="flex-1 h-9 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-md uppercase tracking-wider"
          >
            {tr("Next")}
            <ChevronRight className="w-4 h-4 rtl:rotate-180 ml-1" />
          </Button>
        </div>
      </div>

      <SalesBookingGoodsReport
        form={form}
        goodsEntries={goodsEntries}
        lang={lang}
        hideRate
        onEdit={handleEditEntry}
        onDelete={index => {
          setGoodsEntries(previous => previous.filter((_, i) => i !== index));
          if (editingIndex === index) clearEntry();
          else if (editingIndex != null && editingIndex > index) setEditingIndex(editingIndex - 1);
        }}
      />

      {/* Stock Selection Modal */}
      {stockModalOpen && createPortal(<SalesStockPanel
        open={stockModalOpen}
        onClose={() => setStockModalOpen(false)}
        onConfirm={(lot, group) => {
          setStockGroup(group);
          handleStockSelected(lot, group);
          setStockModalOpen(false);
        }}
        initialGroup={stockGroup}
        lang={lang}
      />, document.body)}
    </div>
  );
}
