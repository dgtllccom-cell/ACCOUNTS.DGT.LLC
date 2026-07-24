"use client";

import React, { useMemo, useState, useEffect } from "react";
import {
  Check, ChevronLeft, Package, Search, Ship,
  Globe2, FileText, ArrowLeft, Anchor, ShieldCheck
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const CONTAINER_TYPES = ["20 FT", "40 FT", "20 FT Reefer", "40 FT Reefer", "Reefer Container", "Non Reefer", "Open Top", "Flat Rack", "LCL / Bulk"];

export function PurchaseLoadingFormView() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loadingRecords, setLoadingRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedPO, setSelectedPO] = useState<any | null>(null);

  const [activeTab, setActiveTab] = useState<"bill" | "parties" | "goods" | "load">("bill");
  
  const [loadForm, setLoadForm] = useState({
    containerNumber: "",
    containerType: "40 FT",
    loadingQuantity: "",
    loadingDate: "",
    loadingNote: "",
  });

  async function loadData() {
    setLoading(true);
    try {
      const [poRes, lrRes] = await Promise.all([
        fetch("/api/erp/purchases/orders?limit=500", { cache: "no-store" }),
        fetch("/api/erp/purchases/loading-records?limit=500", { cache: "no-store" })
      ]);
      const poPayload = await poRes.json().catch(() => ({}));
      const lrPayload = await lrRes.json().catch(() => ({}));

      const allOrders = Array.isArray(poPayload.data) ? poPayload.data : (poPayload.data?.orders || poPayload.orders || []);
      const allLoadingRecords = lrPayload.data?.records || [];

      setOrders(allOrders);
      setLoadingRecords(allLoadingRecords);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    if (orders.length > 0 && !selectedPO) {
      const searchParams = new URLSearchParams(window.location.search);
      const poNo = searchParams.get("purchaseOrderNo");
      if (poNo) {
        const match = orders.find(o => o.purchase_order_no === poNo);
        if (match) {
          setSelectedPO(match);
          setActiveTab("load");
        }
      }
    }
  }, [orders, selectedPO]);

  const pendingLoadingOrders = useMemo(() => {
    const loadedPONumbers = new Set(loadingRecords.map(r => r.purchase_order_no).filter(Boolean));

    return orders.filter(row => {
      const status = (row.payment_status || "").toLowerCase();
      const isAdvancePaid = status.includes("advance paid") || status.includes("paid") || status.includes("clear");
      
      const form = row.form_data?.form || {};
      const advancePercent = Number(form.advancePercent || 0);
      const paidAdvance = Number(row.advance_paid || 0);
      
      const hasMetAdvanceReq = advancePercent > 0 
        ? (paidAdvance > 0 || isAdvancePaid || status.includes("partial") || status.includes("advance paid"))
        : true;

      if (!hasMetAdvanceReq) return false;
      if (row.ledger_posting_status !== "Posted" && row.ledger_posting_status !== "posted") return false;

      const goods = row.form_data?.goodsEntries || [];
      const totalQty = goods.reduce((sum: number, g: any) => sum + Number(g.qtyNo || 0), 0) || Number(form.qtyNo || 0);
      
      const poRecords = loadingRecords.filter(r => r.purchase_order_no === row.purchase_order_no);
      const loadedQty = poRecords.reduce((sum, r) => sum + Number(r.report_payload?.loadingQuantity || r.report_payload?.loadedQuantity || r.loadedQuantity || 0), 0);

      if (loadedQty >= totalQty && !query) return false;

      if (!query) return true;
      const q = query.toLowerCase();
      return row.purchase_order_no?.toLowerCase().includes(q) || 
             row.supplierName?.toLowerCase().includes(q) || 
             form.salesAccountName?.toLowerCase().includes(q);
    });
  }, [orders, loadingRecords, query]);

  async function handleSaveLoading() {
    if (!selectedPO) return;
    if (!loadForm.containerNumber || !loadForm.loadingQuantity) {
      alert("Container Number and Loading Quantity are required.");
      return;
    }
    
    setSaving(true);
    try {
      const formDetails = selectedPO.form_data?.form || {};
      const response = await fetch("/api/erp/purchases/loading-records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purchaseOrderNo: selectedPO.purchase_order_no,
          containerNumber: loadForm.containerNumber,
          containerType: loadForm.containerType,
          loadingStatus: "loaded",
          loadedAt: loadForm.loadingDate ? new Date(loadForm.loadingDate).toISOString() : new Date().toISOString(),
          loadingLocation: formDetails.loadingLocation || formDetails.originCountry || "",
          receivingLocation: formDetails.destinationCountry || "",
          shipmentStatus: "transit",
          remarks: loadForm.loadingNote,
          reportPayload: {
            loadingQuantity: Number(loadForm.loadingQuantity),
            loadedQuantity: Number(loadForm.loadingQuantity),
            loadingDate: loadForm.loadingDate,
            loadingNote: loadForm.loadingNote,
            standalone: false,
            explicitPurchaseOrderLink: true,
            sourceModule: "purchase-loading-wizard"
          }
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error?.message || payload.error || "Failed to save loading record.");
      }
      
      alert(`Successfully saved loading for ${selectedPO.purchase_order_no}`);
      setLoadForm({ containerNumber: "", containerType: "40 FT", loadingQuantity: "", loadingDate: "", loadingNote: "" });
      setSelectedPO(null);
      setActiveTab("bill");
      await loadData();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Error saving loading record.");
    } finally {
      setSaving(false);
    }
  }

  const selectedPOForm = selectedPO?.form_data?.form || {};
  const selectedPOGoods = selectedPO?.form_data?.goodsEntries || [];
  
  const poTotalQty = selectedPOGoods.reduce((sum: number, g: any) => sum + Number(g.qtyNo || 0), 0) || Number(selectedPOForm.qtyNo || 0);
  const poTotalNetWeight = selectedPOGoods.reduce((sum: number, g: any) => sum + Number(g.netWeight || 0), 0) || Number(selectedPOForm.netWeight || 0);
  const poTotalAmount = selectedPOGoods.reduce((sum: number, g: any) => sum + Number(g.finalAmount || 0), 0) || Number(selectedPOForm.grandFinal || 0);
  
  const poRecords = selectedPO ? loadingRecords.filter(r => r.purchase_order_no === selectedPO.purchase_order_no) : [];
  const poAlreadyLoadedQty = poRecords.reduce((sum: number, r: any) => sum + Number(r.report_payload?.loadingQuantity || r.report_payload?.loadedQuantity || r.loadedQuantity || 0), 0);
  
  const currentLoadingQty = Number(loadForm.loadingQuantity || 0);
  const liveBalance = poTotalQty - poAlreadyLoadedQty - currentLoadingQty;

  if (!selectedPO) {
    return (
      <div className="mx-auto w-full max-w-[1500px] px-5 py-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight">Pending Loading Dashboard</h1>
            <p className="mt-1 text-sm text-muted-foreground">Select a purchase order to start the loading workflow.</p>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search PO Number..."
              className="h-10 w-72 rounded-md border border-slate-200 bg-white pl-10 pr-4 text-sm shadow-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 font-bold uppercase tracking-wider text-slate-500 text-[10px]">PO Number</th>
                <th className="px-6 py-4 font-bold uppercase tracking-wider text-slate-500 text-[10px]">Date</th>
                <th className="px-6 py-4 font-bold uppercase tracking-wider text-slate-500 text-[10px]">Supplier</th>
                <th className="px-6 py-4 font-bold uppercase tracking-wider text-slate-500 text-[10px]">Total Qty</th>
                <th className="px-6 py-4 font-bold uppercase tracking-wider text-slate-500 text-[10px]">Loaded</th>
                <th className="px-6 py-4 font-bold uppercase tracking-wider text-slate-500 text-[10px]">Balance</th>
                <th className="px-6 py-4 font-bold uppercase tracking-wider text-slate-500 text-[10px] text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pendingLoadingOrders.map((row) => {
                const form = row.form_data?.form || {};
                const goods = row.form_data?.goodsEntries || [];
                const rowTotalQty = goods.reduce((sum: number, g: any) => sum + Number(g.qtyNo || 0), 0) || Number(form.qtyNo || 0);
                const rowRecords = loadingRecords.filter(r => r.purchase_order_no === row.purchase_order_no);
                const rowLoadedQty = rowRecords.reduce((sum: number, r: any) => sum + Number(r.report_payload?.loadingQuantity || 0), 0);
                const rowBalance = rowTotalQty - rowLoadedQty;

                return (
                  <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-mono font-bold text-blue-600">{row.purchase_order_no}</td>
                    <td className="px-6 py-4">{new Date(row.created_at).toLocaleDateString("en-GB")}</td>
                    <td className="px-6 py-4 font-semibold">{form.salesAccountName || "Unknown"}</td>
                    <td className="px-6 py-4 font-mono">{rowTotalQty.toLocaleString()}</td>
                    <td className="px-6 py-4 font-mono text-emerald-600">{rowLoadedQty.toLocaleString()}</td>
                    <td className="px-6 py-4 font-mono font-bold text-rose-600">{rowBalance.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right">
                      <Button onClick={() => setSelectedPO(row)} className="h-8 bg-blue-600 hover:bg-blue-700 text-[10px] font-bold uppercase tracking-wider">
                        Open Loading Workflow
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {pendingLoadingOrders.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                    <Package className="h-10 w-10 mx-auto text-slate-300 mb-3" />
                    <p className="font-bold text-slate-700">No Pending Orders</p>
                    <p className="text-xs">All cleared orders have been loaded.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1600px] p-2 sm:p-4">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between bg-white border border-slate-200 p-3 rounded-xl shadow-sm">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => setSelectedPO(null)} className="h-8">
            <ArrowLeft className="h-4 w-4 mr-1" /> Dashboard
          </Button>
          <div>
            <h1 className="text-sm font-black flex items-center gap-2">
              <Ship className="h-4 w-4 text-blue-600" />
              Loading Workflow: <span className="font-mono text-blue-700">{selectedPO.purchase_order_no}</span>
            </h1>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[450px_1fr] gap-4 items-start">
        {/* LEFT PANEL: ENTRY WORKFLOW */}
        <div className="flex flex-col gap-3">
          {/* TABS */}
          <div className="flex gap-1 p-1 bg-white border border-slate-200 rounded-lg shadow-sm">
            {[
              { id: "bill", label: "Bill Entry" },
              { id: "parties", label: "Parties" },
              { id: "goods", label: "Goods Entry" },
              { id: "load", label: "New Loading" }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded transition-colors ${
                  activeTab === tab.id 
                    ? "bg-slate-900 text-white" 
                    : "text-slate-500 hover:bg-slate-100"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* TAB CONTENTS (Read Only for Bill, Parties, Goods) */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50">
              <h3 className="text-xs font-black uppercase tracking-wider flex items-center gap-2 text-slate-800">
                {activeTab === "bill" && <><FileText className="h-4 w-4 text-blue-600"/> Bill Details (Read Only)</>}
                {activeTab === "parties" && <><Globe2 className="h-4 w-4 text-emerald-600"/> Parties (Read Only)</>}
                {activeTab === "goods" && <><Package className="h-4 w-4 text-amber-600"/> Goods Details (Read Only)</>}
                {activeTab === "load" && <><Anchor className="h-4 w-4 text-indigo-600"/> New Loading Entry</>}
              </h3>
            </div>

            <div className="p-5">
              {activeTab === "bill" && (
                <div className="space-y-4 text-xs font-mono">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="block text-[10px] text-slate-500 font-sans font-bold mb-1">Issue Date</span>
                      <div className="font-black">{new Date(selectedPOForm.purchaseDate || selectedPO.created_at).toLocaleDateString("en-GB")}</div>
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-500 font-sans font-bold mb-1">Bill / Ref No</span>
                      <div className="font-black">{selectedPOForm.billNo || "-"}</div>
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-500 font-sans font-bold mb-1">Supplier</span>
                      <div className="font-black">{selectedPOForm.salesAccountName || "-"}</div>
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-500 font-sans font-bold mb-1">Shipping Mode</span>
                      <div className="font-black">{selectedPOForm.shippingMode || "By Sea"}</div>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-slate-100 flex justify-end">
                    <Button onClick={() => setActiveTab("parties")} className="h-8 text-[10px] uppercase font-bold tracking-wider">Next: Parties</Button>
                  </div>
                </div>
              )}

              {activeTab === "parties" && (
                <div className="space-y-4 text-xs font-mono">
                  <div>
                    <span className="block text-[10px] text-slate-500 font-sans font-bold mb-1">Notify Party</span>
                    <div className="font-black">{selectedPOForm.notifyPartyName || "Same as Consignee"}</div>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-500 font-sans font-bold mb-1">Importer / Consignee</span>
                    <div className="font-black">{selectedPOForm.importerName || "-"}</div>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-500 font-sans font-bold mb-1">Exporter / Shipper</span>
                    <div className="font-black">{selectedPOForm.exporterName || "-"}</div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between">
                    <Button variant="outline" onClick={() => setActiveTab("bill")} className="h-8 text-[10px] uppercase font-bold tracking-wider text-slate-600">Back</Button>
                    <Button onClick={() => setActiveTab("goods")} className="h-8 text-[10px] uppercase font-bold tracking-wider">Next: Goods</Button>
                  </div>
                </div>
              )}

              {activeTab === "goods" && (
                <div className="space-y-4">
                  {selectedPOGoods.length === 0 ? (
                    <div className="text-xs font-mono font-black">
                      {selectedPOForm.goodsName} - {selectedPOForm.qtyNo} {selectedPOForm.qtyName}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {selectedPOGoods.map((g: any, i: number) => (
                        <div key={i} className="border border-slate-200 rounded p-2 text-xs font-mono font-black bg-slate-50">
                          {g.goodsName} - {g.qtyNo} {g.qtyName} (Net: {g.netWeight} KGs)
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between">
                    <Button variant="outline" onClick={() => setActiveTab("parties")} className="h-8 text-[10px] uppercase font-bold tracking-wider text-slate-600">Back</Button>
                    <Button onClick={() => setActiveTab("load")} className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] uppercase font-bold tracking-wider">Next: New Loading</Button>
                  </div>
                </div>
              )}

              {activeTab === "load" && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-300">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] text-slate-500 font-bold mb-1">Container Number *</label>
                      <input
                        value={loadForm.containerNumber}
                        onChange={e => setLoadForm(f => ({ ...f, containerNumber: e.target.value.toUpperCase() }))}
                        placeholder="e.g. MSKU-1234567"
                        className="w-full h-8 border border-slate-300 rounded px-2 text-xs font-mono font-bold outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 font-bold mb-1">Container Type</label>
                      <select
                        value={loadForm.containerType}
                        onChange={e => setLoadForm(f => ({ ...f, containerType: e.target.value }))}
                        className="w-full h-8 border border-slate-300 rounded px-2 text-xs font-mono outline-none focus:border-blue-500"
                      >
                        {CONTAINER_TYPES.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] text-slate-500 font-bold mb-1">Loading Quantity *</label>
                      <input
                        type="number"
                        value={loadForm.loadingQuantity}
                        onChange={e => setLoadForm(f => ({ ...f, loadingQuantity: e.target.value }))}
                        placeholder={`Max: ${poTotalQty - poAlreadyLoadedQty}`}
                        className="w-full h-8 border border-slate-300 rounded px-2 text-xs font-mono font-black text-blue-700 outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 font-bold mb-1">Loading Date</label>
                      <input
                        type="date"
                        value={loadForm.loadingDate}
                        onChange={e => setLoadForm(f => ({ ...f, loadingDate: e.target.value }))}
                        className="w-full h-8 border border-slate-300 rounded px-2 text-xs font-mono outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-500 font-bold mb-1">Loading Notes</label>
                    <textarea
                      value={loadForm.loadingNote}
                      onChange={e => setLoadForm(f => ({ ...f, loadingNote: e.target.value }))}
                      rows={2}
                      className="w-full border border-slate-300 rounded px-2 py-1 text-xs outline-none focus:border-blue-500 resize-none"
                    />
                  </div>

                  {/* LIVE BALANCE SECTION */}
                  <div className="bg-slate-900 text-white rounded-lg p-3 grid grid-cols-3 gap-2 mt-4 text-center divide-x divide-slate-700">
                    <div>
                      <div className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Total Qty</div>
                      <div className="text-sm font-mono font-black text-white">{poTotalQty.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Loaded</div>
                      <div className="text-sm font-mono font-black text-emerald-400">{(poAlreadyLoadedQty + currentLoadingQty).toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Balance</div>
                      <div className={`text-sm font-mono font-black ${liveBalance < 0 ? "text-rose-400" : "text-amber-400"}`}>
                        {liveBalance.toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between">
                    <Button variant="outline" onClick={() => setActiveTab("goods")} className="h-8 text-[10px] uppercase font-bold tracking-wider text-slate-600">Back</Button>
                    <Button onClick={handleSaveLoading} disabled={saving} className="h-8 bg-blue-600 hover:bg-blue-700 text-white text-[10px] uppercase font-bold tracking-wider px-6">
                      {saving ? "Saving..." : "Save Loading"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: LIVE REPORTS */}
        <div className="flex flex-col gap-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="bg-slate-900 p-3 flex justify-between items-center">
              <h2 className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-400" /> LIVE BL REPORT
              </h2>
            </div>
            <div className="p-4 grid grid-cols-2 gap-y-4 gap-x-2 text-xs font-mono">
              <div>
                <span className="text-[9px] text-slate-400 uppercase font-sans font-bold block mb-0.5">Issue Date</span>
                <span className="font-black">{new Date(selectedPOForm.purchaseDate || selectedPO.created_at).toLocaleDateString("en-GB")}</span>
              </div>
              <div>
                <span className="text-[9px] text-slate-400 uppercase font-sans font-bold block mb-0.5">Bill / Ref No</span>
                <span className="font-black">{selectedPOForm.billNo || "-"}</span>
              </div>
              <div className="col-span-2">
                <span className="text-[9px] text-slate-400 uppercase font-sans font-bold block mb-0.5">Notify Party</span>
                <span className="font-black">{selectedPOForm.notifyPartyName || "Same as Consignee"}</span>
              </div>
              <div className="col-span-2">
                <span className="text-[9px] text-slate-400 uppercase font-sans font-bold block mb-0.5">Importer</span>
                <span className="font-black">{selectedPOForm.importerName || "-"}</span>
              </div>
              <div className="col-span-2">
                <span className="text-[9px] text-slate-400 uppercase font-sans font-bold block mb-0.5">Exporter</span>
                <span className="font-black">{selectedPOForm.exporterName || "-"}</span>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col h-full">
            <div className="bg-blue-600 p-3 flex justify-between items-center">
              <h2 className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-2">
                <Anchor className="h-4 w-4 text-blue-200" /> GOODS & CONTAINER REPORT
              </h2>
              <span className="bg-blue-800 text-white text-[9px] px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                LIVE INVENTORY
              </span>
            </div>
            
            <div className="flex-1 overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2 font-bold uppercase tracking-wider text-slate-500 text-[10px]">Date</th>
                    <th className="px-4 py-2 font-bold uppercase tracking-wider text-slate-500 text-[10px]">Container</th>
                    <th className="px-4 py-2 font-bold uppercase tracking-wider text-slate-500 text-[10px] text-right">Loaded Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {poRecords.length === 0 && (
                    <tr><td colSpan={3} className="px-4 py-4 text-center text-slate-400 font-mono">No Loading Records Yet</td></tr>
                  )}
                  {poRecords.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="px-4 py-2 font-mono text-[10px]">{new Date(r.report_payload?.loadingDate || r.loaded_at).toLocaleDateString("en-GB")}</td>
                      <td className="px-4 py-2 font-mono font-bold text-blue-600 text-[11px]">{r.container_number}</td>
                      <td className="px-4 py-2 font-mono font-black text-right text-emerald-600">{Number(r.report_payload?.loadingQuantity || 0).toLocaleString()}</td>
                    </tr>
                  ))}
                  {/* Current Active Form Live Preview */}
                  {currentLoadingQty > 0 && (
                    <tr className="bg-amber-50">
                      <td className="px-4 py-2 font-mono text-[10px] text-amber-600 border-l-2 border-amber-400">
                        {loadForm.loadingDate ? new Date(loadForm.loadingDate).toLocaleDateString("en-GB") : "Pending"}
                      </td>
                      <td className="px-4 py-2 font-mono font-bold text-amber-700 text-[11px]">
                        {loadForm.containerNumber || "UNASSIGNED"}
                      </td>
                      <td className="px-4 py-2 font-mono font-black text-right text-amber-600">
                        +{currentLoadingQty.toLocaleString()}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="bg-slate-50 border-t border-slate-200 p-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Total KGs:</span>
                  <span className="font-mono font-black text-slate-700">{poTotalQty.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Net Weight:</span>
                  <span className="font-mono font-black text-slate-700">{poTotalNetWeight.toLocaleString()} KGs</span>
                </div>
                <div className="col-span-2 pt-2 border-t border-slate-200 flex justify-between items-center">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Grand Final Amount:</span>
                  <span className="text-base font-mono font-black text-emerald-600">
                    <span className="text-[10px] mr-1 text-emerald-500">{selectedPO.currency_code || selectedPOForm.currencyType || "USD"}</span>
                    {poTotalAmount.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
