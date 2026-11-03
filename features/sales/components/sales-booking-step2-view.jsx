"use client";
import React, { useState } from "react";
import {
  Package,
  Search,
  ChevronLeft,
  ChevronRight,
  Plus,
  Edit3,
  Trash2,
  AlertTriangle,
  Building2,
  CheckCircle2,
  Layers
} from "lucide-react";
import { t as tUi } from "@/lib/i18n/ui";
import { Button } from "@/components/ui/button";
import { SalesBookingUpperCards } from "./sales-booking-upper-cards";
import { SalesStockSelectionModal } from "./sales-stock-selection-modal";

export function SalesBookingStep2({
  form,
  setForm,
  goodsEntries = [],
  setGoodsEntries,
  lang = "en",
  onNext,
  onBack,
  availableLots = [],
  dbCompanies = [],
  dbAccounts = []
}) {
  const [stockModalOpen, setStockModalOpen] = useState(false);
  const [stockCategory, setStockCategory] = useState("warehouse");
  const [stockDropdownOpen, setStockDropdownOpen] = useState(false);
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
  const qtyName = form.qtyName || "Bag";
  const qtyNo = Number(form.qtyNo || 10);
  const unitPrice = Number(form.coursePrice || 2500);
  const freightIca = Number(form.freightIca || 150);
  const itemType = form.itemType || "";
  const stackWeight = form.stackWeight || "25kg / 1.5 CBM";
  const packType = form.packType || "";
  const totalBoxes = Number(form.totalBoxes || 0);
  const availableQty = Number(form.lotAvailableQty || 5000);
  const selectedLotRef = form.stockLotNo || "";

  // Validate stock: check if quantity exceeds available balance
  const isOverStock = selectedLotRef && availableQty > 0 && qtyNo > availableQty;

  const handleOpenStockModal = (cat) => {
    setStockCategory(cat || "warehouse");
    setStockDropdownOpen(false);
    setStockModalOpen(true);
  };

  const handleStockSelected = (lot) => {
    setForm((prev) => ({
      ...prev,
      goodsName: lot.productName || lot.goodsName,
      hsCode: lot.hsCode,
      stockLotNo: lot.lotNo,
      allotName: lot.lotNo,
      brand: lot.brand || prev.brand,
      size: lot.size || prev.size,
      origin: lot.origin || prev.origin,
      qtyName: lot.unit || prev.qtyName || "Bag",
      qtyNo: Math.min(prev.qtyNo > 0 ? prev.qtyNo : 10, lot.availableQty || 10),
      coursePrice: prev.coursePrice > 0 ? prev.coursePrice : (lot.unitPrice || 2500),
      warehouseName: lot.warehouse,
      lotAvailableQty: lot.availableQty,
      saleSource: lot.category || "warehouse"
    }));
    setStockError("");
  };

  // Add or update item in Goods Entries table
  const handleAddOrUpdateItem = () => {
    if (!productName.trim()) {
      setStockError("Please enter product name or select stock.");
      return;
    }
    if (isOverStock) {
      setStockError(`Quantity (${qtyNo}) exceeds available stock (${availableQty.toLocaleString()} ${qtyName}).`);
      return;
    }

    const calculatedGross = qtyNo * (Number(form.qtyKgs) || 1000);
    const calculatedNet = calculatedGross - (qtyNo * (Number(form.emptyKgs) || 10));
    const calculatedAmount = qtyNo * unitPrice;
    const exRate = Number(form.exchangeRate) || 1;
    const finalAmt = calculatedAmount * exRate;

    const newItem = {
      goodsName: productName,
      productName: productName,
      hsCode: hsCode || "080212",
      itemId: itemId || "ITEM-01",
      brand: brand || "Al Baraka",
      size: size || "Standard",
      grade: grade || "A-Grade",
      quality: quality || "Passed",
      qtyName: qtyName || "MT",
      unit: qtyName || "MT",
      qtyNo: qtyNo,
      quantity: qtyNo,
      unitPrice: unitPrice,
      coursePrice: unitPrice,
      freightIca: freightIca,
      itemType: itemType,
      stackWeight: stackWeight,
      packType: packType,
      totalBoxes: totalBoxes,
      totalAmount: calculatedAmount,
      finalAmount: finalAmt,
      exchangeRate: exRate,
      grossWeight: form.grossWeight || calculatedGross || (qtyNo * 1200),
      netWeight: form.netWeight || calculatedNet || (qtyNo * 1100),
      origin: form.origin || "United Arab Emirates",
      lotNo: selectedLotRef,
      warehouse: form.warehouseName || "Dubai Main WH"
    };

    if (editingIndex !== null) {
      setGoodsEntries((prev) => {
        const copy = [...prev];
        copy[editingIndex] = newItem;
        return copy;
      });
      setEditingIndex(null);
    } else {
      setGoodsEntries((prev) => [...prev, newItem]);
    }

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
      lotAvailableQty: item.lotAvailableQty || 5000
    }));
  };

  const totalAmount = goodsEntries.reduce((sum, item) => sum + (Number(item.totalAmount || item.finalAmount || 0)), 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start animate-in fade-in duration-200">
      {/* LEFT COLUMN: GOODS ENTRY DETAILS FORM */}
      <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Package className="w-4 h-4 text-blue-600" />
            {tUi(lang, "sales.goods_entry_details", "GOODS ENTRY DETAILS")}
          </h3>
          {selectedLotRef && (
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 font-mono whitespace-nowrap">
              Lot: {selectedLotRef}
            </span>
          )}
        </div>

        {/* Product Name * */}
        <div className="space-y-1">
          <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
            {tUi(lang, "sales.product_name", "Product Name")} <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              type="text"
              value={productName}
              onChange={(e) => setForm((p) => ({ ...p, goodsName: e.target.value }))}
              placeholder="Search or select product..."
              className="w-full h-9 pl-3 pr-8 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-blue-500 font-semibold"
            />
            <button
              type="button"
              onClick={() => handleOpenStockModal("warehouse")}
              className="absolute right-2 top-2 p-1 text-slate-400 hover:text-blue-600"
              title="Select from stock lots"
            >
              <Search className="w-3.5 h-3.5" />
            </button>
          </div>
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
              placeholder="e.g. 080212"
              className="w-full h-8 px-2.5 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-blue-500 font-mono"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Item Name / ID
            </label>
            <input
              type="text"
              value={itemId}
              onChange={(e) => setForm((p) => ({ ...p, stockLotNo: e.target.value }))}
              placeholder="e.g. ALM-001-2026"
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
            <select
              value={brand}
              onChange={(e) => setForm((p) => ({ ...p, brand: e.target.value }))}
              className="w-full h-8 px-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-blue-500 font-semibold"
            >
              <option value="">Select Brand</option>
              <option value="Al Baraka">Al Baraka</option>
              <option value="Golden">Golden</option>
              <option value="Diamond">Diamond</option>
              <option value="Royal">Royal</option>
              <option value="Fresh">Fresh</option>
              <option value="Organic">Organic</option>
              <option value="Standard">Standard</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Size / Specification
            </label>
            <select
              value={size}
              onChange={(e) => setForm((p) => ({ ...p, size: e.target.value }))}
              className="w-full h-8 px-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-blue-500 font-semibold"
            >
              <option value="">Select Size</option>
              <option value="Standard">Standard</option>
              <option value="5% Broken">5% Broken</option>
              <option value="Medium">Medium</option>
              <option value="Large">Large</option>
              <option value="Extra Light">Extra Light</option>
              <option value="9mm">9mm</option>
            </select>
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

        {/* STOCK * Dropdown (Warehouse, Booking, Export, Transit) */}
        <div className="space-y-1 relative">
          <label className="block text-[11px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
            STOCK <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setStockDropdownOpen(!stockDropdownOpen)}
              className="w-full h-9 px-3 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-300 dark:border-emerald-800 rounded-lg flex items-center justify-between text-xs font-bold text-emerald-900 dark:text-emerald-200 hover:bg-emerald-100/50 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                Select Stock Type ({form.saleSource || "Warehouse"})
              </span>
              <span className="text-[11px] text-emerald-600 font-black">▼</span>
            </button>

            {stockDropdownOpen && (
              <div className="absolute left-0 bottom-11 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl z-50 p-1.5 space-y-1">
                <button
                  type="button"
                  onClick={() => handleOpenStockModal("warehouse")}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/40 text-xs font-bold text-slate-800 dark:text-slate-200 transition-colors text-left"
                >
                  <Building2 className="w-4 h-4 text-blue-600" />
                  Warehouse Stock
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenStockModal("booking")}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 transition-colors text-left"
                >
                  <Package className="w-4 h-4 text-slate-600" />
                  Booking Stock
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenStockModal("export")}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-sky-50 dark:hover:bg-sky-950/40 text-xs font-bold text-slate-800 dark:text-slate-200 transition-colors text-left"
                >
                  <Layers className="w-4 h-4 text-sky-600" />
                  Export Stock
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenStockModal("transit")}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-xs font-bold text-slate-800 dark:text-slate-200 transition-colors text-left"
                >
                  <Building2 className="w-4 h-4 text-indigo-600" />
                  Transit Stock
                </button>
              </div>
            )}
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

        {/* Add Item Button */}
        <Button
          type="button"
          disabled={isOverStock}
          onClick={handleAddOrUpdateItem}
          className="w-full h-9 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs rounded-xl flex items-center justify-center gap-1.5 transition-all"
        >
          <Plus className="w-4 h-4" />
          {editingIndex !== null ? "Update Goods Item" : "Add Goods Item to Table"}
        </Button>

        {/* Bottom Back / Next Buttons */}
        <div className="flex items-center gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <Button
            type="button"
            variant="outline"
            onClick={onBack}
            className="flex-1 h-9 border-slate-300 text-slate-700 dark:text-slate-200 text-xs font-bold"
          >
            <ChevronLeft className="w-4 h-4 rtl:rotate-180 mr-1" />
            Back
          </Button>
          <Button
            type="button"
            onClick={onNext}
            className="flex-1 h-9 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-md uppercase tracking-wider"
          >
            Next
            <ChevronRight className="w-4 h-4 rtl:rotate-180 ml-1" />
          </Button>
        </div>
      </div>

      {/* RIGHT COLUMN: CUSTOMER ACCOUNT (DR) + GOODS ITEMS TABLE */}
      <div className="lg:col-span-7 space-y-4">
        {/* Customer Account (DR) & Company Details Card */}
        <SalesBookingUpperCards
          form={form}
          setForm={setForm}
          lang={lang}
          dbCompanies={dbCompanies}
          dbAccounts={dbAccounts}
          mode="customer"
          showBadges={false}
        />

        {/* Goods Items Table */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Package className="w-4 h-4 text-blue-600" />
              {tUi(lang, "sales.goods_items", "GOODS ITEMS")}
            </h3>
            <span className="text-[11px] font-bold text-slate-500 font-mono">
              {goodsEntries.length} Items Added
            </span>
          </div>

          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 text-[11px] font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-2.5 w-10 text-center">#</th>
                  <th className="p-2.5">Product Name</th>
                  <th className="p-2.5">HS Code</th>
                  <th className="p-2.5 text-center">Unit</th>
                  <th className="p-2.5 text-right">Quantity</th>
                  <th className="p-2.5 text-right">Unit Price</th>
                  <th className="p-2.5 text-right">Amount</th>
                  <th className="p-2.5 text-center w-20">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {goodsEntries.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="p-2.5 text-center font-mono text-[11px] text-slate-400">{idx + 1}</td>
                    <td className="p-2.5 font-bold text-slate-900 dark:text-slate-100">{item.goodsName || item.productName}</td>
                    <td className="p-2.5 font-mono text-slate-500">{item.hsCode}</td>
                    <td className="p-2.5 text-center font-semibold text-slate-600 dark:text-slate-400">{item.qtyName || item.unit}</td>
                    <td className="p-2.5 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                      {Number(item.qtyNo || item.quantity || 0).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                    </td>
                    <td className="p-2.5 text-right font-mono text-slate-600 dark:text-slate-400">
                      {Number(item.coursePrice || item.unitPrice || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="p-2.5 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                      {Number(item.totalAmount || item.finalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="p-2.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleEditEntry(idx)}
                          className="p-1 rounded-md bg-sky-50 hover:bg-sky-100 text-sky-700 transition-colors"
                          title="Edit"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setGoodsEntries(prev => prev.filter((_, i) => i !== idx))}
                          className="p-1 rounded-md bg-red-50 hover:bg-red-100 text-red-600 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {goodsEntries.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-slate-400 text-xs italic">
                      No goods added yet. Fill the Goods Entry form on the left or select stock.
                    </td>
                  </tr>
                )}
              </tbody>
              {goodsEntries.length > 0 && (
                <tfoot className="bg-slate-50 dark:bg-slate-950 font-black border-t-2 border-slate-200 dark:border-slate-800">
                  <tr>
                    <td colSpan={6} className="p-2.5 text-right text-xs uppercase tracking-wider text-slate-600 dark:text-slate-300">
                      Total
                    </td>
                    <td className="p-2.5 text-right font-mono text-sm text-blue-700 dark:text-blue-400">
                      {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>

      {/* Stock Selection Modal */}
      <SalesStockSelectionModal
        isOpen={stockModalOpen}
        onClose={() => setStockModalOpen(false)}
        onSelectStock={handleStockSelected}
        initialCategory={stockCategory}
        lang={lang}
        availableLots={availableLots}
      />
    </div>
  );
}
