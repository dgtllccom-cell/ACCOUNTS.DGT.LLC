"use client";

import React, { useEffect, useState } from "react";
import { 
  ArrowDownLeft, 
  ArrowUpRight, 
  Boxes, 
  CheckCircle2, 
  Eye, 
  Filter, 
  Package, 
  Pencil, 
  Plus, 
  Printer,
  RefreshCw, 
  Search, 
  TrendingDown, 
  TrendingUp, 
  Warehouse, 
  X 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SimpleModal } from "@/components/ui/simple-modal";
import { UniversalReportModal } from "@/components/ui/universal-report-modal";
import { Th } from "@/components/ui/translated-th";
import { apiGet, apiPost, apiPut } from "@/lib/api/client";
import { listGoods, type GoodsListRow } from "@/features/inventory/goods-api";
import { rtlLanguages, normalizeSupportedLanguage } from "@/lib/i18n/languages";
import { translateValue } from "@/lib/i18n/table-values";
import { translateHeader } from "@/lib/i18n/table-headers";

type InventoryBalance = {
  id: string;
  goods_id: string;
  warehouse_id: string;
  country_id: string | null;
  quantity_on_hand: number;
  quantity_reserved: number;
  quantity_available: number;
  updated_at: string;
  goods_name: string;
  chs_code: string;
  warehouse_name: string;
  warehouse_code: string;
  country_name: string | null;
};

type StockMovement = {
  id: string;
  movement_type: "STOCK_IN" | "STOCK_OUT" | "ADJUSTMENT" | "TRANSFER";
  goods_id: string;
  goods_variation_id: string | null;
  warehouse_id: string;
  country_id: string | null;
  quantity: number;
  unit_cost: number;
  total_amount: number;
  reference_no: string | null;
  notes: string | null;
  movement_date: string;
  created_at: string;
  goods_name: string;
  chs_code: string;
  variation_size?: string;
  variation_brand?: string;
  warehouse_name: string;
  warehouse_code: string;
  country_name: string | null;
};

type WarehouseOption = {
  id: string;
  warehouse_name?: string;
  name?: string;
  warehouse_code?: string;
  code?: string;
};

export default function InventoryWorkspaceClient({ session }: { session: any }) {
  const [activeTab, setActiveTab] = useState<"balances" | "movements">("balances");
  const [showReport, setShowReport] = useState(false);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Data states
  const [balances, setBalances] = useState<InventoryBalance[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [goodsList, setGoodsList] = useState<GoodsListRow[]>([]);
  const [summary, setSummary] = useState({ total_items: 0, total_quantity_on_hand: 0, total_quantity_available: 0 });

  // Filters
  const [selectedWarehouseFilter, setSelectedWarehouseFilter] = useState("");
  const [selectedMovementTypeFilter, setSelectedMovementTypeFilter] = useState("");

  // Modals
  const [movementModalOpen, setMovementModalOpen] = useState(false);
  const [movementModalType, setMovementModalType] = useState<"STOCK_IN" | "STOCK_OUT">("STOCK_IN");
  const [viewMovement, setViewMovement] = useState<StockMovement | null>(null);
  const [editMovement, setEditMovement] = useState<StockMovement | null>(null);

  // Stock In / Out Form
  const [form, setForm] = useState({
    goodsId: "",
    goodsVariationId: "",
    warehouseId: "",
    quantity: "",
    unitCost: "",
    referenceNo: "",
    notes: ""
  });

  // Edit form
  const [editForm, setEditForm] = useState({
    quantity: "",
    unitCost: "",
    referenceNo: "",
    notes: ""
  });

  useEffect(() => {
    fetchWarehouses();
    fetchGoods();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (activeTab === "balances") {
        fetchBalances();
      } else {
        fetchMovements();
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [activeTab, q, selectedWarehouseFilter, selectedMovementTypeFilter]);

  async function fetchWarehouses() {
    try {
      const res = await apiGet<{ warehouses: WarehouseOption[] }>("/api/erp/warehouses?limit=500");
      setWarehouses(res.warehouses || []);
    } catch (e) {
      console.error("Failed to load warehouses:", e);
    }
  }

  async function fetchGoods() {
    try {
      const res = await listGoods({ limit: 500 });
      setGoodsList(res.goods || []);
    } catch (e) {
      console.error("Failed to load goods:", e);
    }
  }

  const activeLang = normalizeSupportedLanguage(session?.lang || (typeof document !== "undefined" ? document.documentElement.lang : "en"));
  const isRtl = rtlLanguages.includes(activeLang);
  const tv = (value: string | null | undefined) => translateValue(activeLang, value);
  const tr = (label: string) => translateHeader(activeLang, label);

  async function fetchBalances() {
    setBusy(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (selectedWarehouseFilter) params.set("warehouseId", selectedWarehouseFilter);
      params.set("lang", activeLang);
      const res = await apiGet<{ balances: InventoryBalance[]; summary: any }>(`/api/erp/inventory/balances?${params.toString()}`);
      setBalances(res.balances || []);
      if (res.summary) setSummary(res.summary);
    } catch (e: any) {
      setBanner({ type: "error", text: e?.message || "Failed to load inventory balances" });
    } finally {
      setBusy(false);
    }
  }

  async function fetchMovements() {
    setBusy(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (selectedWarehouseFilter) params.set("warehouseId", selectedWarehouseFilter);
      if (selectedMovementTypeFilter) params.set("movementType", selectedMovementTypeFilter);
      params.set("lang", activeLang);
      const res = await apiGet<{ movements: StockMovement[]; total: number }>(`/api/erp/inventory/stock-movements?${params.toString()}`);
      setMovements(res.movements || []);
    } catch (e: any) {
      setBanner({ type: "error", text: e?.message || "Failed to load stock movements" });
    } finally {
      setBusy(false);
    }
  }

  function handleOpenMovementModal(type: "STOCK_IN" | "STOCK_OUT") {
    setMovementModalType(type);
    setForm({
      goodsId: goodsList[0]?.id || "",
      goodsVariationId: "",
      warehouseId: warehouses[0]?.id || "",
      quantity: "1",
      unitCost: "0",
      referenceNo: "",
      notes: ""
    });
    setMovementModalOpen(true);
  }

  async function submitMovement() {
    if (!form.goodsId || !form.warehouseId || !form.quantity || Number(form.quantity) <= 0) {
      setBanner({ type: "error", text: "Please select Goods, Warehouse, and enter a valid positive quantity." });
      return;
    }

    setBusy(true);
    setBanner(null);
    try {
      await apiPost("/api/erp/inventory/stock-movements", {
        movementType: movementModalType,
        goodsId: form.goodsId,
        goodsVariationId: form.goodsVariationId || null,
        warehouseId: form.warehouseId,
        quantity: Number(form.quantity),
        unitCost: Number(form.unitCost || 0),
        referenceNo: form.referenceNo,
        notes: form.notes
      });

      setBanner({ 
        type: "success", 
        text: `Stock ${movementModalType === "STOCK_IN" ? "In" : "Out"} recorded successfully and inventory balance updated!` 
      });
      setMovementModalOpen(false);
      fetchBalances();
      if (activeTab === "movements") fetchMovements();
    } catch (e: any) {
      setBanner({ type: "error", text: e?.message || "Failed to record stock movement" });
    } finally {
      setBusy(false);
    }
  }

  function handleOpenEdit(m: StockMovement) {
    setEditMovement(m);
    setEditForm({
      quantity: String(m.quantity),
      unitCost: String(m.unit_cost),
      referenceNo: m.reference_no || "",
      notes: m.notes || ""
    });
  }

  async function submitEditMovement() {
    if (!editMovement) return;
    if (!editForm.quantity || Number(editForm.quantity) <= 0) {
      setBanner({ type: "error", text: "Quantity must be greater than zero." });
      return;
    }

    setBusy(true);
    setBanner(null);
    try {
      await apiPut(`/api/erp/inventory/stock-movements/${editMovement.id}`, {
        quantity: Number(editForm.quantity),
        unitCost: Number(editForm.unitCost || 0),
        referenceNo: editForm.referenceNo,
        notes: editForm.notes
      });

      setBanner({ type: "success", text: "Stock movement updated and balance recalculated successfully!" });
      setEditMovement(null);
      fetchBalances();
      fetchMovements();
    } catch (e: any) {
      setBanner({ type: "error", text: e?.message || "Failed to update stock movement" });
    } finally {
      setBusy(false);
    }
  }

  const selectedGoodsRecord = goodsList.find(g => g.id === form.goodsId);

  return (
    <div className="space-y-6" dir={isRtl ? "rtl" : "ltr"}>
      {/* Top Title & Header Actions */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Stock & Inventory Management</h1>
          <p className="text-sm text-muted-foreground">
            Track stock balances, record Stock In/Out movements, and monitor warehouse inventory across all branches.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button 
            onClick={() => handleOpenMovementModal("STOCK_IN")} 
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm"
          >
            <ArrowDownLeft className="mr-2 h-4 w-4" /> {tr("Stock In (Receiving)")}
          </Button>
          <Button 
            onClick={() => handleOpenMovementModal("STOCK_OUT")} 
            className="bg-rose-600 hover:bg-rose-700 text-white font-medium shadow-sm"
          >
            <ArrowUpRight className="mr-2 h-4 w-4" /> {tr("Stock Out (Issuance)")}
          </Button>
          <Button 
            variant="outline" 
            onClick={() => { fetchBalances(); fetchMovements(); }}
            disabled={busy}
          >
            <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Banner Notifications */}
      {banner && (
        <div 
          className={`p-4 rounded-md flex items-center justify-between text-sm ${
            banner.type === "success" 
              ? "bg-emerald-50 text-emerald-900 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800" 
              : "bg-rose-50 text-rose-900 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800"
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            <span>{banner.text}</span>
          </div>
          <button onClick={() => setBanner(null)} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border shadow-xs">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 bg-blue-50 dark:bg-blue-950/50 rounded-lg text-blue-600 dark:text-blue-400">
              <Boxes className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{tr("Unique Items in Stock")}</p>
              <h3 className="text-2xl font-bold">{summary.total_items}</h3>
            </div>
          </CardContent>
        </Card>
        <Card className="border shadow-xs">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 rounded-lg text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{tr("Total Quantity On Hand")}</p>
              <h3 className="text-2xl font-bold">{Number(summary.total_quantity_on_hand).toLocaleString()}</h3>
            </div>
          </CardContent>
        </Card>
        <Card className="border shadow-xs">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 bg-indigo-50 dark:bg-indigo-950/50 rounded-lg text-indigo-600 dark:text-indigo-400">
              <Package className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{tr("Total Available Quantity")}</p>
              <h3 className="text-2xl font-bold">{Number(summary.total_quantity_available).toLocaleString()}</h3>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Bar & Tabs Navigation */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b pb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("balances")}
            className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${
              activeTab === "balances"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            {tr("Inventory Balances")}
          </button>
          <button
            onClick={() => setActiveTab("movements")}
            className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${
              activeTab === "movements"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            {tr("Stock Movement History")}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search goods, CHS, warehouse..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <select
            value={selectedWarehouseFilter}
            onChange={(e) => setSelectedWarehouseFilter(e.target.value)}
            className="px-3 py-1.5 text-sm border rounded-md bg-background"
          >
            <option value="">{tr("All Warehouses")}</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.warehouse_name || w.name} ({w.warehouse_code || w.code})
              </option>
            ))}
          </select>

          {activeTab === "movements" && (
            <select
              value={selectedMovementTypeFilter}
              onChange={(e) => setSelectedMovementTypeFilter(e.target.value)}
              className="px-3 py-1.5 text-sm border rounded-md bg-background"
            >
              <option value="">All Types</option>
              <option value="STOCK_IN">Stock In</option>
              <option value="STOCK_OUT">Stock Out</option>
              <option value="ADJUSTMENT">Adjustment</option>
              <option value="TRANSFER">Transfer</option>
            </select>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowReport(true)}
            className="h-8 gap-1.5 rounded-md border-slate-700 bg-slate-900 px-3 text-xs font-bold text-cyan-400 hover:bg-slate-800"
          >
            <Printer className="h-3.5 w-3.5" />
            {tr("Print / Report")}
          </Button>
        </div>
      </div>

      {/* Tab Content 1: Inventory Balances Table */}
      {activeTab === "balances" && (
        <Card className="overflow-hidden border">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-muted/60 text-muted-foreground uppercase text-[11px] font-semibold border-b">
                <tr>
                  <Th className="py-3 px-4">Goods Name</Th>
                  <Th className="py-3 px-4">CHS Code</Th>
                  <Th className="py-3 px-4">Warehouse</Th>
                  <Th className="py-3 px-4">Country Scope</Th>
                  <Th className="py-3 px-4 text-right">On Hand Qty</Th>
                  <Th className="py-3 px-4 text-right">Available Qty</Th>
                  <Th className="py-3 px-4 text-right">Last Updated</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {balances.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-muted-foreground">
                      {busy ? "Loading inventory balances..." : "No inventory balance records found."}
                    </td>
                  </tr>
                ) : (
                  balances.map((b) => (
                    <tr key={b.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3.5 px-4 font-medium text-foreground">{b.goods_name || "—"}</td>
                      <td className="py-3.5 px-4 font-mono text-xs text-muted-foreground">{b.chs_code || "—"}</td>
                      <td className="py-3.5 px-4">{b.warehouse_name || "—"} ({b.warehouse_code})</td>
                      <td className="py-3.5 px-4 text-muted-foreground">{b.country_name || "Global Scope"}</td>
                      <td className="py-3.5 px-4 text-right font-bold text-foreground">
                        {Number(b.quantity_on_hand).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-emerald-600 dark:text-emerald-400">
                        {Number(b.quantity_available).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-right text-xs text-muted-foreground">
                        {b.updated_at ? new Date(b.updated_at).toLocaleString() : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Tab Content 2: Stock Movement History Table */}
      {activeTab === "movements" && (
        <Card className="overflow-hidden border">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-muted/60 text-muted-foreground uppercase text-[11px] font-semibold border-b">
                <tr>
                  <Th className="py-3 px-4">Date / Ref</Th>
                  <Th className="py-3 px-4">Type</Th>
                  <Th className="py-3 px-4">Goods Item</Th>
                  <Th className="py-3 px-4">Warehouse</Th>
                  <Th className="py-3 px-4 text-right">Quantity</Th>
                  <Th className="py-3 px-4 text-right">Unit Cost</Th>
                  <Th className="py-3 px-4 text-right">Total Amount</Th>
                  <Th className="py-3 px-4 text-center">Actions</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {movements.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-muted-foreground">
                      {busy ? "Loading stock movements..." : "No stock movement records found."}
                    </td>
                  </tr>
                ) : (
                  movements.map((m) => (
                    <tr key={m.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-foreground">
                          {new Date(m.movement_date || m.created_at).toLocaleDateString()}
                        </div>
                        <div className="text-xs font-mono text-muted-foreground">
                          Ref: {m.reference_no || m.id.slice(0, 8)}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            m.movement_type === "STOCK_IN"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : m.movement_type === "STOCK_OUT"
                              ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                              : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                          }`}
                        >
                          {m.movement_type === "STOCK_IN" && <ArrowDownLeft className="h-3 w-3" />}
                          {m.movement_type === "STOCK_OUT" && <ArrowUpRight className="h-3 w-3" />}
                          {tv(m.movement_type)}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-foreground">{m.goods_name || "—"}</div>
                        <div className="text-xs text-muted-foreground">
                          CHS: {m.chs_code || "—"}
                          {m.variation_size ? ` | Size: ${m.variation_size}` : ""}
                          {m.variation_brand ? ` | Brand: ${m.variation_brand}` : ""}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div>{m.warehouse_name || "—"}</div>
                        <div className="text-xs text-muted-foreground">{m.warehouse_code}</div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold">
                        {m.movement_type === "STOCK_IN" ? "+" : "-"}{Number(m.quantity).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-right text-muted-foreground">
                        ${Number(m.unit_cost || 0).toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-semibold">
                        ${Number(m.total_amount || 0).toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setViewMovement(m)}
                            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
                            title="View Details"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleOpenEdit(m)}
                            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
                            title="Edit Movement"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Modal 1: Stock In / Stock Out Entry Dialog */}
      <SimpleModal
        isOpen={movementModalOpen}
        onClose={() => setMovementModalOpen(false)}
        title={movementModalType === "STOCK_IN" ? "Record Stock In (Receiving)" : "Record Stock Out (Issuance)"}
      >
        <div className="space-y-4 pt-2">
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1">Select Goods Item *</label>
            <select
              value={form.goodsId}
              onChange={(e) => setForm({ ...form, goodsId: e.target.value, goodsVariationId: "" })}
              className="w-full px-3 py-2 text-sm border rounded-md bg-background"
            >
              {goodsList.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.goods_name} (CHS: {g.chs_code})
                </option>
              ))}
            </select>
          </div>

          {selectedGoodsRecord?.variations && selectedGoodsRecord.variations.length > 0 && (
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Select Size / Brand Variation</label>
              <select
                value={form.goodsVariationId}
                onChange={(e) => setForm({ ...form, goodsVariationId: e.target.value })}
                className="w-full px-3 py-2 text-sm border rounded-md bg-background"
              >
                <option value="">Default (No specific variation)</option>
                {selectedGoodsRecord.variations.map((v) => (
                  <option key={v.id} value={v.id}>
                    Size: {v.size || "Standard"} | Brand: {v.brand || "Standard"}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1">Destination Warehouse *</label>
            <select
              value={form.warehouseId}
              onChange={(e) => setForm({ ...form, warehouseId: e.target.value })}
              className="w-full px-3 py-2 text-sm border rounded-md bg-background"
            >
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.warehouse_name || w.name} ({w.warehouse_code || w.code})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Quantity *</label>
              <input
                type="number"
                min="0.01"
                step="any"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                placeholder="100"
                className="w-full px-3 py-2 text-sm border rounded-md bg-background"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Unit Cost ($)</label>
              <input
                type="number"
                min="0"
                step="any"
                value={form.unitCost}
                onChange={(e) => setForm({ ...form, unitCost: e.target.value })}
                placeholder="0.00"
                className="w-full px-3 py-2 text-sm border rounded-md bg-background"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1">Reference No / Bill No</label>
            <input
              type="text"
              value={form.referenceNo}
              onChange={(e) => setForm({ ...form, referenceNo: e.target.value })}
              placeholder="PO-2026-001 or INV-8891"
              className="w-full px-3 py-2 text-sm border rounded-md bg-background"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1">Notes / Description</label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Stock reception notes or delivery details..."
              className="w-full px-3 py-2 text-sm border rounded-md bg-background"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t">
            <Button variant="outline" onClick={() => setMovementModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={submitMovement}
              disabled={busy}
              className={movementModalType === "STOCK_IN" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-rose-600 hover:bg-rose-700 text-white"}
            >
              {busy ? "Saving..." : `Confirm ${movementModalType === "STOCK_IN" ? "Stock In" : "Stock Out"}`}
            </Button>
          </div>
        </div>
      </SimpleModal>

      {/* Modal 2: View Stock Movement Detail */}
      {viewMovement && (
        <SimpleModal
          isOpen={!!viewMovement}
          onClose={() => setViewMovement(null)}
          title="Stock Movement Details"
        >
          <div className="space-y-4 pt-2 text-sm">
            <div className="grid grid-cols-2 gap-4 bg-muted/40 p-3 rounded-md">
              <div>
                <span className="text-xs text-muted-foreground block">Movement ID</span>
                <span className="font-mono font-medium">{viewMovement.id}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Movement Type</span>
                <span className="font-bold">{tv(viewMovement.movement_type)}</span>
              </div>
            </div>

            <div className="space-y-2 border-t pt-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Goods Item:</span>
                <span className="font-medium">{viewMovement.goods_name} (CHS: {viewMovement.chs_code})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Warehouse:</span>
                <span className="font-medium">{viewMovement.warehouse_name} ({viewMovement.warehouse_code})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Country Scope:</span>
                <span>{viewMovement.country_name || "Global Scope"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Quantity:</span>
                <span className="font-bold">{viewMovement.quantity}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Unit Cost:</span>
                <span>${Number(viewMovement.unit_cost || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Amount:</span>
                <span className="font-bold text-foreground">${Number(viewMovement.total_amount || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Reference No:</span>
                <span>{viewMovement.reference_no || "N/A"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Date:</span>
                <span>{new Date(viewMovement.movement_date || viewMovement.created_at).toLocaleString()}</span>
              </div>
            </div>

            {viewMovement.notes && (
              <div className="border-t pt-2">
                <span className="text-xs text-muted-foreground block">Notes</span>
                <p className="text-sm bg-muted/30 p-2 rounded-md mt-1">{viewMovement.notes}</p>
              </div>
            )}

            <div className="flex justify-end pt-3 border-t">
              <Button variant="outline" onClick={() => setViewMovement(null)}>
                Close
              </Button>
            </div>
          </div>
        </SimpleModal>
      )}

      {/* Modal 3: Edit Stock Movement */}
      {editMovement && (
        <SimpleModal
          isOpen={!!editMovement}
          onClose={() => setEditMovement(null)}
          title="Edit Stock Movement"
        >
          <div className="space-y-4 pt-2">
            <div className="bg-muted/40 p-3 rounded-md text-xs space-y-1">
              <div><strong>Item:</strong> {editMovement.goods_name} (CHS: {editMovement.chs_code})</div>
              <div><strong>Warehouse:</strong> {editMovement.warehouse_name}</div>
              <div><strong>Type:</strong> {tv(editMovement.movement_type)}</div>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Quantity *</label>
              <input
                type="number"
                min="0.01"
                step="any"
                value={editForm.quantity}
                onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })}
                className="w-full px-3 py-2 text-sm border rounded-md bg-background"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Unit Cost ($)</label>
              <input
                type="number"
                min="0"
                step="any"
                value={editForm.unitCost}
                onChange={(e) => setEditForm({ ...editForm, unitCost: e.target.value })}
                className="w-full px-3 py-2 text-sm border rounded-md bg-background"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Reference No</label>
              <input
                type="text"
                value={editForm.referenceNo}
                onChange={(e) => setEditForm({ ...editForm, referenceNo: e.target.value })}
                className="w-full px-3 py-2 text-sm border rounded-md bg-background"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Notes</label>
              <textarea
                rows={2}
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                className="w-full px-3 py-2 text-sm border rounded-md bg-background"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t">
              <Button variant="outline" onClick={() => setEditMovement(null)}>
                Cancel
              </Button>
              <Button onClick={submitEditMovement} disabled={busy}>
                {busy ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </SimpleModal>
      )}

      <UniversalReportModal
        isOpen={showReport}
        onClose={() => setShowReport(false)}
        title={activeTab === "balances" ? "Inventory Balances Report" : "Stock Movement History Report"}
        subtitle="Real-Time Warehouse Stock Quantities, Movements, and Valuation"
        exportFileName={activeTab === "balances" ? "inventory_balances_report" : "stock_movements_report"}
        filters={[
          { label: "Active Tab", value: activeTab === "balances" ? "Inventory Balances" : "Stock Movements" },
          { label: "Search Query", value: q || "None" },
          { label: "Warehouse Filter", value: selectedWarehouseFilter || "All Warehouses" }
        ]}
        columns={
          activeTab === "balances"
            ? [
                { key: "goods_name", label: "Goods Name" },
                { key: "chs_code", label: "CHS Code" },
                { key: "warehouse_name", label: "Warehouse" },
                { key: "country_name", label: "Country Scope" },
                { key: "quantity_on_hand", label: "On Hand Qty", align: "right", isNumeric: true },
                { key: "quantity_available", label: "Available Qty", align: "right", isNumeric: true }
              ]
            : [
                { key: "created_at", label: "Date & Time" },
                { key: "movement_type", label: "Movement Type", align: "center" },
                { key: "goods_name", label: "Goods Item" },
                { key: "warehouse_name", label: "Warehouse" },
                { key: "quantity", label: "Quantity", align: "right", isNumeric: true },
                { key: "unit_cost", label: "Unit Cost", align: "right", isNumeric: true },
                { key: "reference_no", label: "Reference No" }
              ]
        }
        data={
          activeTab === "balances"
            ? balances.map(b => ({
                goods_name: b.goods_name,
                chs_code: b.chs_code || "-",
                warehouse_name: b.warehouse_name,
                country_name: b.country_name || "All",
                quantity_on_hand: b.quantity_on_hand,
                quantity_available: b.quantity_available
              }))
            : movements.map(m => ({
                created_at: new Date(m.created_at).toLocaleString(),
                movement_type: m.movement_type,
                goods_name: m.goods_name,
                warehouse_name: m.warehouse_name,
                quantity: m.quantity,
                unit_cost: m.unit_cost,
                reference_no: m.reference_no || "-"
              }))
        }
      />
    </div>
  );
}
