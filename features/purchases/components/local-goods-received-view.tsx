"use client";

import React, { useMemo, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { fetchWarehouses } from "@/features/warehouses/warehouse-api";
import {
  Package, Search, Coins, Loader2, Truck, Globe, Pencil, CheckCircle2, X, ChevronDown, Building2, FileText, Send, Eye, MoreVertical, Edit3, ArrowRight, ArrowLeft, Calendar
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type LocalGoodsReceiptType = "warehouse" | "loading" | "export";

function localGoodsReceiptTypeFromShipment(value: unknown): LocalGoodsReceiptType {
  const normalized = String(value || "").toLowerCase();
  if (normalized.includes("warehouse")) return "warehouse";
  if (normalized.includes("export")) return "export";
  return "loading";
}

function localGoodsReceiptCompletedStatus(type: LocalGoodsReceiptType) {
  if (type === "warehouse") return "Warehouse Received";
  if (type === "export") return "Export Completed";
  return "Loading Completed";
}

function localGoodsReceiptLabel(type: LocalGoodsReceiptType) {
  if (type === "warehouse") return "Warehouse";
  if (type === "export") return "Export";
  return "Loading";
}

function money(value: unknown, currency?: string) {
  const amount = Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return currency ? `${amount} ${currency}` : amount;
}

interface LocalGoodsReceivedViewProps {
  session: any;
  countryBranches: any[];
  cityBranches: any[];
}

export function LocalGoodsReceivedView({
  session,
  countryBranches,
  cityBranches,
}: LocalGoodsReceivedViewProps) {
  const [purchases, setPurchases] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [goodsReceivedTab, setGoodsReceivedTab] = useState<LocalGoodsReceiptType>("warehouse");
  const [activeGoodsReceipt, setActiveGoodsReceipt] = useState<{ type: LocalGoodsReceiptType; row: any } | null>(null);
  const [savingGoodsReceipt, setSavingGoodsReceipt] = useState(false);

  // Scoping location select states
  const [selectedCountryId, setSelectedCountryId] = useState("");
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [selectedCityBranchId, setSelectedCityBranchId] = useState("");
  
  // Date filter states
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Warehouse list states
  const [warehousesList, setWarehousesList] = useState<any[]>([]);
  const [loadingWarehouses, setLoadingWarehouses] = useState(false);

  // Header Portal Slots
  const [titleSlot, setTitleSlot] = useState<HTMLElement | null>(null);
  const [actionsSlot, setActionsSlot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setTitleSlot(document.getElementById("erp-page-title-slot"));
    setActionsSlot(document.getElementById("erp-page-actions-slot"));
  }, []);

  // Fetch warehouses on mount
  useEffect(() => {
    async function loadWarehouses() {
      try {
        setLoadingWarehouses(true);
        const data = await fetchWarehouses();
        setWarehousesList(data);
      } catch (err) {
        console.error("Failed to load warehouses:", err);
      } finally {
        setLoadingWarehouses(false);
      }
    }
    loadWarehouses();
  }, []);

  // Derived Country options from branches list
  const countryOptions = useMemo(() => {
    const map = new Map<string, string>();
    countryBranches.forEach(b => {
      const cId = b.countryId || b.country_id;
      const cName = b.countryName || b.country_name || b.name;
      if (cId && !map.has(cId)) {
        map.set(cId, cName);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [countryBranches]);

  // Filtered country branches based on selected country
  const filteredCountryBranches = useMemo(() => {
    if (!selectedCountryId) return countryBranches;
    return countryBranches.filter(b => (b.countryId || b.country_id) === selectedCountryId);
  }, [countryBranches, selectedCountryId]);

  // Selected Active Branch object
  const activeBranch = useMemo(() => {
    return countryBranches.find(b => b.id === selectedBranchId) || filteredCountryBranches[0] || countryBranches[0];
  }, [countryBranches, filteredCountryBranches, selectedBranchId]);

  // Selected Active City Branches
  const activeCityBranches = useMemo(() => {
    if (!selectedBranchId) return [];
    return cityBranches.filter(c => c.countryBranchId === selectedBranchId || c.country_branch_id === selectedBranchId);
  }, [cityBranches, selectedBranchId]);

  const localCurrency = useMemo(() => {
    return activeBranch?.localCurrency || activeBranch?.local_currency || activeBranch?.currency || "PKR";
  }, [activeBranch]);

  // On mount or location change, load registry logs
  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      let query = "/api/erp/purchases/local-purchase";
      const params = new URLSearchParams();
      if (selectedCountryId) params.append("countryId", selectedCountryId);
      if (selectedBranchId) params.append("countryBranchId", selectedBranchId);
      if (selectedCityBranchId) params.append("cityBranchId", selectedCityBranchId);
      if (dateFrom) params.append("dateFrom", dateFrom);
      if (dateTo) params.append("dateTo", dateTo);
      if (params.toString()) query += `?${params.toString()}`;

      const res = await fetch(query);
      const payload = await res.json();
      if (payload.ok && payload.data?.purchases) {
        setPurchases(payload.data.purchases);
      }
    } catch (err) {
      console.error("Failed to load local purchases:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (countryBranches.length > 0) {
      const match = countryBranches[0];
      setSelectedCountryId(match.countryId || match.country_id || "");
      setSelectedBranchId(match.id || "");
    }
  }, [countryBranches]);

  useEffect(() => {
    void loadHistory();
  }, [selectedCountryId, selectedBranchId, selectedCityBranchId, dateFrom, dateTo]);

  // Filter purchases by text search and date range
  const filteredPurchases = useMemo(() => {
    return purchases.filter(p => {
      const q = searchQuery.toLowerCase();
      const matchSearch = !q || (
        (p.goodsName || p.goods_name || "").toLowerCase().includes(q) ||
        (p.supplierName || p.supplier_name || "").toLowerCase().includes(q) ||
        (p.paymentMode || p.payment_mode || "").toLowerCase().includes(q) ||
        (p.shippingMode || p.shipping_mode || "").toLowerCase().includes(q) ||
        (p.truckNo || p.truck_no || "").toLowerCase().includes(q) ||
        (p.driverName || p.driver_name || "").toLowerCase().includes(q)
      );

      const pDate = p.entryDate || p.entry_date || p.createdAt || p.created_at || "";
      const matchDateFrom = !dateFrom || pDate >= dateFrom;
      const matchDateTo = !dateTo || pDate <= dateTo;

      return matchSearch && matchDateFrom && matchDateTo;
    });
  }, [purchases, searchQuery, dateFrom, dateTo]);

  // Group filtered purchases into tabs for local goods receipt
  const localGoodsReceivedDashboard = useMemo(() => {
    const empty = { warehouse: [] as any[], loading: [] as any[], export: [] as any[] };
    filteredPurchases.forEach((row: any) => {
      const status = String(row.status || row.bill_status || "draft").toLowerCase();
      // Route only accepted or transferred bills (routed by shipment type into one receiving process)
      const isEligible = ["accepted", "transferred", "posted", "paid"].includes(status) || row.transferred_at || row.transferredAt;
      if (!isEligible) return;
      const type = localGoodsReceiptTypeFromShipment(row.shipping_mode || row.shippingMode || row.shipment_type || row.shipmentType);
      empty[type].push(row);
    });
    return empty;
  }, [filteredPurchases]);

  const activeGoodsReceivedRows = localGoodsReceivedDashboard[goodsReceivedTab] || [];

  // Handle Goods Receipt submission
  async function saveLocalGoodsReceipt(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeGoodsReceipt?.row?.id) return;
    const formData = new FormData(event.currentTarget);
    const details = Object.fromEntries(Array.from(formData.entries()).map(([key, value]) => [key, String(value)]));
    const status = localGoodsReceiptCompletedStatus(activeGoodsReceipt.type);

    try {
      setSavingGoodsReceipt(true);
      const res = await fetch("/api/erp/purchases/local-purchase", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purchaseId: activeGoodsReceipt.row.id,
          receiptType: activeGoodsReceipt.type,
          status,
          details,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error?.message || "Failed to save local goods receipt.");
      setPurchases((prev: any[]) => prev.map((row: any) => row.id === activeGoodsReceipt.row.id ? data.data.purchase : row));
      setActiveGoodsReceipt(null);
    } catch (err: any) {
      alert(err.message || "Failed to save local goods receipt.");
    } finally {
      setSavingGoodsReceipt(false);
    }
  }

  return (
    <div className="w-full px-3 sm:px-6 py-4 space-y-4">
      
      {/* ── ERP Top Header Title Portal ── */}
      {titleSlot && createPortal(
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          <h1 className="text-sm font-black uppercase tracking-tight text-slate-900 dark:text-white">
            Local Goods Received
          </h1>
        </div>,
        titleSlot
      )}

      {/* ── ERP Top Header Controls Portal ── */}
      {actionsSlot && createPortal(
        <div className="flex flex-wrap items-center gap-2">
          
          {/* 1. Country Dropdown */}
          {countryOptions.length > 0 && (
            <select
              value={selectedCountryId}
              onChange={e => setSelectedCountryId(e.target.value)}
              className="h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-[11px] font-bold outline-none uppercase"
            >
              <option value="">1. ALL COUNTRIES</option>
              {countryOptions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}

          {/* 2. Country Branch Dropdown */}
          <select
            value={selectedBranchId}
            onChange={e => setSelectedBranchId(e.target.value)}
            className="h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-[11px] font-bold outline-none uppercase max-w-[160px]"
          >
            <option value="">2. ALL BRANCHES</option>
            {filteredCountryBranches.map(b => (
              <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
            ))}
          </select>

          {/* 3. City Branch Dropdown */}
          <select
            value={selectedCityBranchId}
            onChange={e => setSelectedCityBranchId(e.target.value)}
            className="h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-[11px] font-bold outline-none uppercase max-w-[150px]"
          >
            <option value="">3. ALL CITIES</option>
            {activeCityBranches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          {/* 4. Date From */}
          <input
            type="date"
            placeholder="Date From"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="h-8 text-[10px] font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2"
          />

          {/* 5. Process Type Dropdown */}
          <select
            value={goodsReceivedTab}
            onChange={e => setGoodsReceivedTab(e.target.value as LocalGoodsReceiptType)}
            className="h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 px-2 text-[11px] font-black outline-none uppercase"
          >
            <option value="warehouse">WAREHOUSE ({localGoodsReceivedDashboard.warehouse?.length || 0})</option>
            <option value="export">EXPORT ({localGoodsReceivedDashboard.export?.length || 0})</option>
            <option value="loading">LOADING ({localGoodsReceivedDashboard.loading?.length || 0})</option>
          </select>

          {/* 6. Search Input */}
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search registry..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="h-8 w-36 sm:w-44 pl-8 pr-2 text-[11px] font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-blue-500"
            />
          </div>
        </div>,
        actionsSlot
      )}

      {/* Main Receiving Module Dashboard Card */}
      <Card className="border border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 py-3.5 px-4 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
              <Package className="h-4 w-4 text-emerald-600" />
              LOCAL GOODS RECEIVED
            </CardTitle>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
              Accepted / transferred local purchase bills are routed by shipment type into one receiving process only.
            </p>
          </div>

          {/* 3 Receiving Sub-Tabs */}
          <div className="flex items-center gap-1.5 bg-slate-200/70 dark:bg-slate-800 p-1 rounded-xl">
            {(["warehouse", "export", "loading"] as LocalGoodsReceiptType[]).map(tab => {
              const count = localGoodsReceivedDashboard[tab]?.length || 0;
              const isActive = goodsReceivedTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => setGoodsReceivedTab(tab)}
                  className={`px-3 py-1 text-[11px] font-black uppercase rounded-lg transition-all ${
                    isActive
                      ? "bg-slate-900 text-white dark:bg-emerald-600 shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  {localGoodsReceiptLabel(tab)} ({count})
                </button>
              );
            })}
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loadingHistory ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
              <span className="text-xs font-bold uppercase tracking-wider">Loading receiving registry...</span>
            </div>
          ) : activeGoodsReceivedRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-2">
              <Package className="h-10 w-10 text-slate-300 dark:text-slate-700" />
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase">
                No {localGoodsReceiptLabel(goodsReceivedTab)} Receipts Pending
              </p>
              <p className="text-xs text-slate-400 max-w-sm">
                No accepted local purchase bills matching "{goodsReceivedTab}" shipment type found for the selected branch.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 font-black uppercase text-[9px] border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">
                    <th className="py-2.5 px-3">PURCHASE BILL</th>
                    <th className="py-2.5 px-3">SUPPLIER</th>
                    <th className="py-2.5 px-3">GOODS / ITEM</th>
                    <th className="py-2.5 px-3 text-right">QUANTITY</th>
                    <th className="py-2.5 px-3 text-right">TOTAL AMOUNT</th>
                    <th className="py-2.5 px-3">SHIPMENT / TRUCK</th>
                    <th className="py-2.5 px-3 text-center">STATUS</th>
                    <th className="py-2.5 px-3 text-center">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 dark:divide-slate-800 font-semibold text-slate-800 dark:text-slate-200">
                  {activeGoodsReceivedRows.map(row => {
                    const status = String(row.status || row.bill_status || "Pending");
                    const isDone = status.toLowerCase().includes("completed") || status.toLowerCase().includes("received");

                    return (
                      <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-850 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900 dark:text-white">
                          {row.serialNo || row.serial_no || `#PO-${row.id.slice(0, 6)}`}
                        </td>
                        <td className="py-2.5 px-3 font-bold">
                          {row.supplierName || row.supplier_name || "Local Vendor"}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-700 dark:text-slate-300">
                          {row.goodsName || row.goods_name || "General Goods"}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold">
                          {row.quantity || row.qty || 0} {row.unit || "Bag"}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-extrabold text-emerald-600 dark:text-emerald-400">
                          {money(row.totalAmount || row.total_amount, row.currency || localCurrency)}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[10px] text-slate-500">
                          {row.truckNo || row.truck_no ? `Truck #${row.truckNo || row.truck_no}` : (row.shippingMode || row.shipping_mode || "Direct")}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`inline-flex items-center gap-1 text-[9px] font-black uppercase px-2 py-0.5 rounded-md border ${
                            isDone
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800"
                              : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800"
                          }`}>
                            {isDone && <CheckCircle2 className="h-3 w-3 text-emerald-600" />}
                            {status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <Button
                            size="sm"
                            onClick={() => setActiveGoodsReceipt({ type: goodsReceivedTab, row })}
                            disabled={isDone}
                            className={`h-7 px-3 text-[10px] font-black uppercase rounded-lg shadow-xs ${
                              isDone
                                ? "bg-slate-100 text-slate-400 dark:bg-slate-800"
                                : "bg-emerald-600 hover:bg-emerald-700 text-white"
                            }`}
                          >
                            {isDone ? "Completed" : `Process ${localGoodsReceiptLabel(goodsReceivedTab)}`}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Process Goods Receipt Modal */}
      {activeGoodsReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-150 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-emerald-600" />
                <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 dark:text-white">
                  Process {localGoodsReceiptLabel(activeGoodsReceipt.type)} Receipt
                </h3>
              </div>
              <button
                onClick={() => setActiveGoodsReceipt(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={saveLocalGoodsReceipt} className="space-y-4">
              <div className="bg-slate-50 dark:bg-slate-850 p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-xs space-y-1 font-semibold">
                <p><span className="text-slate-400 uppercase">Bill No:</span> {activeGoodsReceipt.row.serialNo || activeGoodsReceipt.row.serial_no || `#PO-${activeGoodsReceipt.row.id.slice(0, 6)}`}</p>
                <p><span className="text-slate-400 uppercase">Supplier:</span> {activeGoodsReceipt.row.supplierName || activeGoodsReceipt.row.supplier_name}</p>
                <p><span className="text-slate-400 uppercase">Item:</span> {activeGoodsReceipt.row.goodsName || activeGoodsReceipt.row.goods_name} ({activeGoodsReceipt.row.quantity} {activeGoodsReceipt.row.unit || "Bag"})</p>
              </div>

              {activeGoodsReceipt.type === "warehouse" && (
                <div className="space-y-1">
                  <label className="text-[11px] font-black uppercase text-slate-600 dark:text-slate-400">
                    Select Target Warehouse
                  </label>
                  <select
                    name="warehouseId"
                    required
                    className="w-full h-9 px-2 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none"
                  >
                    <option value="">Choose Warehouse...</option>
                    {warehousesList.map(w => (
                      <option key={w.id} value={w.id}>{w.name} ({w.code || w.city || "Main"})</option>
                    ))}
                  </select>
                </div>
              )}

              {activeGoodsReceipt.type === "loading" && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-black uppercase text-slate-600 dark:text-slate-400">Truck No</label>
                    <input
                      name="truckNo"
                      type="text"
                      required
                      placeholder="e.g. KBL-7892"
                      defaultValue={activeGoodsReceipt.row.truckNo || activeGoodsReceipt.row.truck_no || ""}
                      className="w-full h-9 px-3 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-black uppercase text-slate-600 dark:text-slate-400">Driver Name</label>
                    <input
                      name="driverName"
                      type="text"
                      required
                      placeholder="Driver Name"
                      defaultValue={activeGoodsReceipt.row.driverName || activeGoodsReceipt.row.driver_name || ""}
                      className="w-full h-9 px-3 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850"
                    />
                  </div>
                </div>
              )}

              {activeGoodsReceipt.type === "export" && (
                <div className="space-y-1">
                  <label className="text-[11px] font-black uppercase text-slate-600 dark:text-slate-400">Export Customs Reference / Declaration No</label>
                  <input
                    name="exportRef"
                    type="text"
                    required
                    placeholder="e.g. EXP-2026-9901"
                    className="w-full h-9 px-3 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850"
                  />
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[11px] font-black uppercase text-slate-600 dark:text-slate-400">Receiving Remarks / Notes</label>
                <textarea
                  name="remarks"
                  rows={2}
                  placeholder="Verification notes, weight check, condition..."
                  className="w-full p-2.5 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-150 dark:border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setActiveGoodsReceipt(null)}
                  className="h-9 px-4 text-xs font-bold rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={savingGoodsReceipt}
                  className="h-9 px-5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md"
                >
                  {savingGoodsReceipt ? "Saving..." : "Confirm & Complete Receipt"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
