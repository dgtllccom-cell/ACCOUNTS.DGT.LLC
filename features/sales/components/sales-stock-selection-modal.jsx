"use client";
import React, { useState, useMemo } from "react";
import {
  Building2,
  FileText,
  Plane,
  Truck,
  Search,
  X,
  Package,
  Layers,
  CheckCircle2,
  ArrowRight
} from "lucide-react";
import { t as tUi } from "@/lib/i18n/ui";
import { Button } from "@/components/ui/button";

const STOCK_TABS = [
  { id: "warehouse", label: "Warehouse", icon: Building2, color: "text-blue-600" },
  { id: "booking", label: "Booking", icon: FileText, color: "text-slate-600" },
  { id: "export", label: "Export", icon: Plane, color: "text-sky-600" },
  { id: "transit", label: "Transit", icon: Truck, color: "text-indigo-600" }
];

export const DEMO_STOCK_LOTS = [
  { id: "stk-01", lotNo: "LOT-ALM-2026", productName: "Almond Kernel", goodsName: "Almond Kernel", hsCode: "080212", warehouse: "Dubai Main WH", warehouseName: "Dubai Main WH", availableQty: 5000.000, totalStock: 6500.000, soldQty: 1500.000, unit: "MT", qtyName: "MT", location: "A-01-01", brand: "Al Baraka", size: "Standard", origin: "USA", category: "warehouse" },
  { id: "stk-02", lotNo: "LOT-PIS-2026", productName: "Pistachio", goodsName: "Pistachio", hsCode: "080252", warehouse: "Al Ras WH", warehouseName: "Al Ras WH", availableQty: 3200.000, totalStock: 4000.000, soldQty: 800.000, unit: "MT", qtyName: "MT", location: "B-02-03", brand: "Al Baraka", size: "Standard", origin: "USA", category: "warehouse" },
  { id: "stk-03", lotNo: "LOT-RAI-2026", productName: "Raisins", goodsName: "Raisins", hsCode: "080620", warehouse: "Quetta WH", warehouseName: "Quetta WH", availableQty: 2800.000, totalStock: 3500.000, soldQty: 700.000, unit: "MT", qtyName: "MT", location: "C-01-05", brand: "Golden", size: "Standard", origin: "Iran", category: "warehouse" },
  { id: "stk-04", lotNo: "LOT-CSH-2026", productName: "Cashew Nut", goodsName: "Cashew Nut", hsCode: "080131", warehouse: "Chaman WH", warehouseName: "Chaman WH", availableQty: 1500.000, totalStock: 2000.000, soldQty: 500.000, unit: "MT", qtyName: "MT", location: "A-03-02", brand: "Standard", size: "Medium", origin: "Vietnam", category: "warehouse" },
  { id: "stk-05", lotNo: "LOT-DAT-2026", productName: "Dates", goodsName: "Dates", hsCode: "080410", warehouse: "Dubai Main WH", warehouseName: "Dubai Main WH", availableQty: 4000.000, totalStock: 5000.000, soldQty: 1000.000, unit: "MT", qtyName: "MT", location: "B-01-01", brand: "Royal", size: "Large", origin: "Saudi Arabia", category: "warehouse" },
  { id: "stk-06", lotNo: "LOT-WAL-2026", productName: "Walnuts", goodsName: "Walnuts", hsCode: "080232", warehouse: "Al Ras WH", warehouseName: "Al Ras WH", availableQty: 2200.000, totalStock: 3000.000, soldQty: 800.000, unit: "MT", qtyName: "MT", location: "C-02-04", brand: "Diamond", size: "Extra Light", origin: "USA", category: "warehouse" },
  { id: "stk-07", lotNo: "LOT-APR-2026", productName: "Dried Apricot", goodsName: "Dried Apricot", hsCode: "080930", warehouse: "Quetta WH", warehouseName: "Quetta WH", availableQty: 1800.000, totalStock: 2500.000, soldQty: 700.000, unit: "MT", qtyName: "MT", location: "A-02-06", brand: "Fresh", size: "Standard", origin: "Turkey", category: "warehouse" },
  { id: "stk-08", lotNo: "LOT-FIG-2026", productName: "Figs", goodsName: "Figs", hsCode: "080420", warehouse: "Chaman WH", warehouseName: "Chaman WH", availableQty: 1200.000, totalStock: 1800.000, soldQty: 600.000, unit: "MT", qtyName: "MT", location: "B-03-01", brand: "Organic", size: "Standard", origin: "Iran", category: "warehouse" },
  // Booking lots
  { id: "bk-01", lotNo: "BK-LOT-01", productName: "Basmati Rice 1121", goodsName: "Rice 1121 Steam", hsCode: "1006.30.90", warehouse: "Karachi Port WH", warehouseName: "Karachi Port WH", availableQty: 3000.000, totalStock: 3000.000, soldQty: 0, unit: "Bags", qtyName: "Bags", location: "D-01-01", brand: "Al Baraka", size: "5% Broken", origin: "Pakistan", category: "booking" },
  { id: "bk-02", lotNo: "BK-LOT-02", productName: "White Sesame", goodsName: "White Sesame", hsCode: "1207.40.90", warehouse: "Dubai Port WH", warehouseName: "Dubai Port WH", availableQty: 1500.000, totalStock: 2000.000, soldQty: 500.000, unit: "MT", qtyName: "MT", location: "D-02-01", brand: "Pure", size: "Standard", origin: "Sudan", category: "booking" },
  // Export lots
  { id: "ex-01", lotNo: "EX-LOT-01", productName: "Rice 1121 Steam", goodsName: "Rice 1121 Steam", hsCode: "1006.30.90", warehouse: "Jebel Ali Port", warehouseName: "Jebel Ali Port", availableQty: 2500.000, totalStock: 3000.000, soldQty: 500.000, unit: "Bags", qtyName: "Bags", location: "E-01-02", brand: "Al Baraka", size: "5% Broken", origin: "United Arab Emirates", category: "export" },
  // Transit lots
  { id: "tr-01", lotNo: "TR-LOT-01", productName: "Chickpeas (Kabuli)", goodsName: "Chickpeas", hsCode: "0713.20.00", warehouse: "In-Transit Vessel MSC", warehouseName: "In-Transit Vessel", availableQty: 1800.000, totalStock: 2000.000, soldQty: 200.000, unit: "MT", qtyName: "MT", location: "Sea-Route", brand: "Harvest", size: "9mm", origin: "Canada", category: "transit" }
];

export function SalesStockSelectionModal({
  isOpen,
  onClose,
  onSelectStock,
  lang = "en",
  initialCategory = "warehouse",
  availableLots = []
}) {
  const [activeCategory, setActiveCategory] = useState(initialCategory || "warehouse");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLotId, setSelectedLotId] = useState("");

  // Merge real lots with demo fallback lots so UI never displays an empty screen
  const combinedLots = useMemo(() => {
    if (availableLots && availableLots.length > 0) {
      return availableLots.map((l, idx) => ({
        id: l.id || `lot-${idx}`,
        lotNo: l.lotNo || l.stockRef || `LOT-${idx + 1}`,
        productName: l.goodsName || l.productName || "Stock Item",
        goodsName: l.goodsName || l.productName || "Stock Item",
        hsCode: l.hsCode || "080212",
        warehouse: l.warehouseName || l.location || "Main Warehouse",
        warehouseName: l.warehouseName || l.location || "Main Warehouse",
        availableQty: Number(l.availableQty || 100),
        totalStock: Number(l.totalStock || l.availableQty || 100),
        soldQty: Number(l.soldQty || 0),
        unit: l.qtyName || l.unit || "MT",
        qtyName: l.qtyName || l.unit || "MT",
        location: l.location || "A-01-01",
        brand: l.brand || "Standard",
        size: l.size || "Standard",
        origin: l.origin || "United Arab Emirates",
        category: (l.source === "local" ? "warehouse" : l.source) || "warehouse"
      }));
    }
    return DEMO_STOCK_LOTS;
  }, [availableLots]);

  const filteredLots = useMemo(() => {
    let list = combinedLots.filter((lot) => {
      if (activeCategory === "warehouse") return lot.category === "warehouse" || !lot.category;
      return lot.category === activeCategory;
    });

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(
        (lot) =>
          lot.productName.toLowerCase().includes(q) ||
          lot.hsCode.toLowerCase().includes(q) ||
          lot.warehouse.toLowerCase().includes(q) ||
          lot.location.toLowerCase().includes(q)
      );
    }
    return list;
  }, [combinedLots, activeCategory, searchTerm]);

  const selectedLot = useMemo(() => {
    return combinedLots.find((l) => l.id === selectedLotId) || null;
  }, [combinedLots, selectedLotId]);

  if (!isOpen) return null;

  const currentTabObj = STOCK_TABS.find((t) => t.id === activeCategory) || STOCK_TABS[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                {tUi(lang, "sales.select_stock_title", "Select Stock")} - {currentTabObj.label}
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                {tUi(lang, "sales.select_stock_subtitle", "Choose stock lot to auto-fill goods and prevent selling above available quantity.")}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: Left Category Tabs + Right Stock Table */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Category Sidebar */}
          <div className="w-44 border-r border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 p-2 space-y-1 shrink-0">
            {STOCK_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeCategory === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveCategory(tab.id);
                    setSelectedLotId("");
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-left ${
                    isActive
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800/60"
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-white" : tab.color}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Right Table View */}
          <div className="flex-1 flex flex-col p-4 overflow-hidden">
            {/* Top Toolbar: Heading, Total Records, Search */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 mb-3">
              <div>
                <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide">
                  Available Stock - {currentTabObj.label}
                </h4>
                <span className="text-[11px] text-slate-500 font-semibold">
                  Total Records: {filteredLots.length}
                </span>
              </div>
              <div className="relative w-full sm:w-64">
                <input
                  type="text"
                  placeholder="Search product, batch, or location..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full h-8 pl-8 pr-3 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-blue-500 font-medium"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
              </div>
            </div>

            {/* Table Area */}
            <div className="flex-1 overflow-auto border border-slate-200 dark:border-slate-800 rounded-xl">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 text-[11px] font-bold uppercase tracking-wider sticky top-0 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-2.5 w-10 text-center"></th>
                    <th className="p-2.5 w-10 text-center">#</th>
                    <th className="p-2.5">Product Name</th>
                    <th className="p-2.5">HS Code</th>
                    <th className="p-2.5">Warehouse</th>
                    <th className="p-2.5 text-right">Available Qty</th>
                    <th className="p-2.5 text-center">Unit</th>
                    <th className="p-2.5">Location</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredLots.map((lot, idx) => {
                    const isSelected = selectedLotId === lot.id;
                    return (
                      <tr
                        key={lot.id}
                        onClick={() => setSelectedLotId(lot.id)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100 font-semibold"
                            : "hover:bg-slate-50/80 dark:hover:bg-slate-800/40 text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        <td className="p-2.5 text-center">
                          <input
                            type="radio"
                            name="selectedStock"
                            checked={isSelected}
                            onChange={() => setSelectedLotId(lot.id)}
                            className="cursor-pointer text-blue-600 focus:ring-blue-500"
                          />
                        </td>
                        <td className="p-2.5 text-center font-mono text-[11px] text-slate-400">{idx + 1}</td>
                        <td className="p-2.5 font-bold text-slate-900 dark:text-slate-100">{lot.productName}</td>
                        <td className="p-2.5 font-mono text-[11px] text-slate-500">{lot.hsCode}</td>
                        <td className="p-2.5 truncate max-w-[120px]">{lot.warehouse}</td>
                        <td className="p-2.5 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                          {Number(lot.availableQty).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                        </td>
                        <td className="p-2.5 text-center font-semibold text-slate-600 dark:text-slate-400">{lot.unit}</td>
                        <td className="p-2.5 font-mono text-[11px] text-slate-500">{lot.location}</td>
                      </tr>
                    );
                  })}
                  {filteredLots.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400 text-xs italic">
                        No stock records found matching your search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Selected Lot Stock Breakdown Bar (Total Stock, Sold Qty, Remaining Balance) */}
            {selectedLot && (
              <div className="mt-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    Selected: <span className="text-blue-600 dark:text-blue-400">{selectedLot.productName}</span> ({selectedLot.lotNo})
                  </span>
                </div>
                <div className="flex items-center gap-4 text-[11px]">
                  <div>
                    <span className="text-slate-500 font-medium">Total Stock: </span>
                    <span className="font-bold font-mono text-slate-800 dark:text-slate-200">
                      {Number(selectedLot.totalStock || selectedLot.availableQty).toLocaleString()} {selectedLot.unit}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium">Sold Qty: </span>
                    <span className="font-bold font-mono text-red-600">
                      {Number(selectedLot.soldQty || 0).toLocaleString()} {selectedLot.unit}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium">Remaining Balance: </span>
                    <span className="font-black font-mono text-emerald-600 dark:text-emerald-400">
                      {Number(selectedLot.availableQty).toLocaleString()} {selectedLot.unit}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 flex items-center justify-end gap-2.5">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="h-9 px-5 text-xs font-bold border-slate-300 text-slate-700 hover:bg-slate-100"
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!selectedLot}
            onClick={() => {
              if (selectedLot) {
                onSelectStock(selectedLot);
                onClose();
              }
            }}
            className="h-9 px-6 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md disabled:opacity-50"
          >
            Select Stock
          </Button>
        </div>
      </div>
    </div>
  );
}
