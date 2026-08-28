"use client";

import React, { useMemo, useState, useEffect } from "react";
import {
  Check, ChevronLeft, Package, Search, Ship,
  Globe2, FileText, ArrowLeft, Anchor, ShieldCheck,
  Link2, Printer, Plus, MoreVertical, Layers, RefreshCcw
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Th } from "@/components/ui/translated-th";
import { derivePurchaseStockLifecycle, normalizePurchaseStockDestination, purchaseStockDestinationLabel } from "@/lib/services/purchase-stock-lifecycle";
import { t } from "@/lib/i18n/ui";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { LoadingBatchPanel } from "./loading-batch-panel";

const CONTAINER_TYPES = ["20 FT", "40 FT", "20 FT Reefer", "40 FT Reefer", "Reefer Container", "Non Reefer", "Open Top", "Flat Rack", "LCL / Bulk"];

export function PurchaseLoadingFormView() {
  const lang = useActiveLanguage();
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);
  const tt = (key: string, fallback: string) => t(lang, key as never, fallback);
  const [orders, setOrders] = useState<any[]>([]);
  const [loadingRecords, setLoadingRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [filterTab, setFilterTab] = useState<"all" | "pending" | "loaded">("all");
  const [selectedPO, setSelectedPO] = useState<any | null>(null);

  const [activeTab, setActiveTab] = useState<"bill" | "parties" | "goods" | "load">("bill");
  const [nextDestination, setNextDestination] = useState<"warehouse" | "in-transit" | "export" | "re-export" | "local-sale">("warehouse");
  
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
    const refresh = () => void loadData();
    window.addEventListener("erp:purchase-loading-saved", refresh);
    return () => {
      window.removeEventListener("erp:purchase-loading-saved", refresh);
    };
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

  const dashboardOrders = useMemo(() => {
    return orders.filter(row => {
      const form = row.form_data?.form || {};
      const goods = row.form_data?.goodsEntries || [];
      const totalQty = goods.reduce((sum: number, g: any) => sum + Number(g.qtyNo || g.quantity || 0), 0) || Number(form.qtyNo || 0);
      const poRecords = loadingRecords.filter(r => r.purchase_order_no === row.purchase_order_no && r.loading_status === "loaded");
      const loadedQty = poRecords.reduce((sum, r) => sum + Number(r.report_payload?.loadedQuantity || r.report_payload?.loadingQuantity || r.loadedQuantity || 0), 0);

      if (filterTab === "pending" && loadedQty >= totalQty && totalQty > 0) return false;
      if (filterTab === "loaded" && loadedQty === 0) return false;

      if (!query) return true;
      const q = query.toLowerCase();
      const blNumbers = poRecords.map(r => r.report_payload?.blNumber || "").join(" ").toLowerCase();
      const containerNumbers = poRecords.map(r => r.container_number || "").join(" ").toLowerCase();
      return row.purchase_order_no?.toLowerCase().includes(q) || 
             row.supplierName?.toLowerCase().includes(q) || 
             form.salesAccountName?.toLowerCase().includes(q) ||
             blNumbers.includes(q) ||
             containerNumbers.includes(q);
    });
  }, [orders, loadingRecords, query, filterTab]);

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
            sourceModule: "purchase-loading-wizard",
            lifecycleStage: "remaining",
            stockStage: "Remaining Stock",
            stockStatus: "RED"
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
      setNextDestination("warehouse");
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
  const stockLifecycle = selectedPO ? derivePurchaseStockLifecycle(selectedPO, poRecords) : null;

  async function handleMoveLoadingStage(action: "land" | "forward") {
    if (!selectedPO || !poRecords.length) return;
    const targetRecord = [...poRecords].sort((a: any, b: any) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime())[0];
    if (!targetRecord?.id) return;
    if (action === "forward" && !normalizePurchaseStockDestination(nextDestination)) {
      alert("Select a destination first.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/erp/purchases/loading-records/${targetRecord.id}/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          destination: action === "forward" ? nextDestination : undefined
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error?.message || payload.error || "Stage transfer failed.");
      }
      await loadData();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Error transferring loading stage.");
    } finally {
      setSaving(false);
    }
  }

  if (!selectedPO) {
    return (
      <div className="mx-auto w-full max-w-[1600px] px-4 py-5 space-y-5" dir={isRtl ? "rtl" : "ltr"}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-black tracking-tight text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Ship className="h-5 w-5 text-blue-600" />
              {tt("plrf.dashboard_title", "Loading & Dispatch Dashboard")}
            </h1>
            <p className="mt-0.5 text-xs text-slate-500 font-semibold">{tt("plrf.dashboard_subtitle", "View loaded container bills, multi-entry shipments, and remaining payment transfers.")}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
              <button onClick={() => setFilterTab("all")} className={`px-3 py-1 text-xs font-bold rounded-md transition ${filterTab === "all" ? "bg-white text-blue-600 shadow-xs dark:bg-slate-900 dark:text-blue-400" : "text-slate-600 dark:text-slate-400"}`}>
                {tt("plrf.tab_all_bills", "All Bills")} ({orders.length})
              </button>
              <button onClick={() => setFilterTab("loaded")} className={`px-3 py-1 text-xs font-bold rounded-md transition ${filterTab === "loaded" ? "bg-white text-emerald-600 shadow-xs dark:bg-slate-900 dark:text-emerald-400" : "text-slate-600 dark:text-slate-400"}`}>
                {tt("plrf.tab_loaded", "Loaded / Multi-Entry")}
              </button>
              <button onClick={() => setFilterTab("pending")} className={`px-3 py-1 text-xs font-bold rounded-md transition ${filterTab === "pending" ? "bg-white text-amber-600 shadow-xs dark:bg-slate-900 dark:text-amber-400" : "text-slate-600 dark:text-slate-400"}`}>
                {tt("plrf.tab_pending", "Pending Loading")}
              </button>
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={tt("plrf.search_ph", "Search PO / BL / Container...")}
                className="h-9 w-64 rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-xs shadow-xs outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>

            <Button onClick={() => void loadData()} variant="outline" size="sm" className="h-9 font-bold text-xs">
              <RefreshCcw className={`h-3.5 w-3.5 mr-1 text-slate-500 ${loading ? "animate-spin" : ""}`} />
              {tt("common.refresh", "Refresh")}
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden dark:border-slate-800 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:bg-slate-900/60 dark:border-slate-800">
                <tr>
                  <Th className="px-4 py-3">{tt("plrf.col_po_bill", "PO / Bill Serial")}</Th>
                  <Th className="px-4 py-3">{tt("plrf.col_bl_vessel", "B/L & Vessel")}</Th>
                  <Th className="px-4 py-3">{tt("plrf.col_ports", "Loading & Receiving Ports")}</Th>
                  <Th className="px-4 py-3 text-right">{tt("cpb.contract_qty", "Contract Qty")}</Th>
                  <Th className="px-4 py-3 text-right">{tt("cpb.loaded_qty", "Loaded Qty")}</Th>
                  <Th className="px-4 py-3 text-right">{tt("plrf.col_balance_qty", "Balance Qty")}</Th>
                  <Th className="px-4 py-3 text-right">{tt("plrf.col_gross_net", "Gross Wt / Net Wt")}</Th>
                  <Th className="px-4 py-3 text-right">{tt("cpb.purchase_amount", "Purchase Amount")}</Th>
                  <Th className="px-4 py-3 text-right">{tt("plrf.col_advance_paid", "Advance Paid")}</Th>
                  <Th className="px-4 py-3 text-right">{tt("cpb.remaining_balance", "Balance Remaining")}</Th>
                  <Th className="px-4 py-3 text-center">{tt("common.actions", "Actions")}</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {dashboardOrders.map((row) => {
                  const form = row.form_data?.form || {};
                  const goods = row.form_data?.goodsEntries || [];
                  const unitLabel = String(form.qtyName || goods?.[0]?.qtyName || "Bags");

                  const poRecords = loadingRecords.filter(r => r.purchase_order_no === row.purchase_order_no && r.loading_status === "loaded");
                  const loadedQty = poRecords.reduce((sum: number, r: any) => sum + Number(r.report_payload?.loadedQuantity || r.report_payload?.loadingQuantity || r.loadedQuantity || 0), 0);
                  const totalContractQty = goods.reduce((sum: number, g: any) => sum + Number(g.qtyNo || g.quantity || 0), 0) || Number(form.quantity || form.qtyNo || 0);
                  const balanceQty = Math.max(0, totalContractQty - loadedQty);

                  const grossWt = poRecords.length > 0 
                    ? poRecords.reduce((s: number, r: any) => s + Number(r.report_payload?.grossWeight || 0), 0)
                    : goods.reduce((s: number, g: any) => s + Number(g.grossWeight || 0), 0) || Number(form.grossWeight || 0);

                  const netWt = poRecords.length > 0 
                    ? poRecords.reduce((s: number, r: any) => s + Number(r.report_payload?.netWeight || 0), 0)
                    : goods.reduce((s: number, g: any) => s + Number(g.netWeight || 0), 0) || Number(form.netWeight || 0);

                  const poTotalUSD = goods.reduce((sum: number, g: any) => sum + Number(g.finalAmount || g.totalAmount || 0), 0) || Number(form.totalAmount || form.finalAmount || 0);
                  const exRate = Number(poRecords[0]?.report_payload?.exchangeRatePKR || form.exchangeRate || row.exchange_rate || 1);

                  const rawAdvance = Number(row.advance_paid || form.advanceAmount || 0);
                  const poTotalLocal = poTotalUSD * exRate;
                  const advanceLocal = Math.min(poTotalLocal, rawAdvance * exRate);
                  const remainingLocal = Math.max(0, poTotalLocal - advanceLocal);

                  const blNumbers = Array.from(new Set(poRecords.map(r => r.report_payload?.blNumber).filter(Boolean))).join(", ") || "-";
                  const vesselName = poRecords[0]?.report_payload?.vesselName || poRecords[0]?.carrier_name || "-";
                  const loadingPort = poRecords[0]?.report_payload?.loadingPort || form.loadingPort || form.exitPort || "-";
                  const receivingPort = poRecords[0]?.report_payload?.receivingPort || form.receivedPort || form.destinationPort || "-";

                  return (
                    <tr key={row.id} className="hover:bg-slate-50/80 transition-colors dark:hover:bg-slate-800/50">
                      <td className="px-4 py-3">
                        <div className="font-mono font-black text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                          {row.purchase_order_no}
                          {poRecords.length > 0 && (
                            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-black uppercase text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:ring-emerald-800">
                              {poRecords.length} {poRecords.length === 1 ? "Entry" : "Entries"}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 font-semibold mt-0.5">{form.salesAccountName || form.supplierName || tt("common.supplier", "Supplier")}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-mono font-bold text-slate-800 dark:text-slate-200">BL: {blNumbers}</div>
                        <div className="text-[10px] font-semibold text-slate-500">Vessel: {vesselName}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-700 dark:text-slate-300">{loadingPort} &rarr; {receivingPort}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{new Date(row.created_at).toLocaleDateString("en-GB")}</div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-700 dark:text-slate-200">{totalContractQty.toLocaleString()} {unitLabel}</td>
                      <td className="px-4 py-3 text-right font-mono font-black text-emerald-600 dark:text-emerald-400">{loadedQty.toLocaleString()} {unitLabel}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-rose-600 dark:text-rose-400">{balanceQty.toLocaleString()} {unitLabel}</td>
                      <td className="px-4 py-3 text-right font-mono text-[11px] text-slate-600 dark:text-slate-300">
                        <div><span className="text-slate-400">Gross:</span> {grossWt.toLocaleString()} kg</div>
                        <div><span className="text-slate-400">Net:</span> {netWt.toLocaleString()} kg</div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-black text-slate-800 dark:text-slate-100">
                        <div>{poTotalUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</div>
                        <div className="text-[9.5px] font-semibold text-blue-600">@ {exRate.toFixed(2)}</div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-black text-emerald-600 dark:text-emerald-400">
                        {advanceLocal > 0 ? `${advanceLocal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AED` : "-"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-black text-rose-600 dark:text-rose-400">
                        {remainingLocal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AED
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="inline-flex items-center gap-1.5">
                          {poRecords.length > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                const queryParams = new URLSearchParams({
                                  purchaseOrderNo: row.purchase_order_no,
                                  fromLoading: "true",
                                  loadingRecordId: poRecords[0]?.id || "",
                                  blNumber: blNumbers,
                                  loadedQty: String(loadedQty),
                                  grossWeight: String(grossWt),
                                  netWeight: String(netWt),
                                  purchaseAmount: String(poTotalUSD),
                                  finalAmount: String(poTotalLocal),
                                  advanceApplied: String(rawAdvance),
                                  advanceAppliedLocal: String(advanceLocal),
                                  remainingBalance: String(poTotalUSD - rawAdvance),
                                  remainingBalanceLocal: String(remainingLocal),
                                  amount: String(poTotalUSD - rawAdvance),
                                  exchangeRate: String(exRate),
                                  currency: form.currency || "USD",
                                  amountPKR: String(remainingLocal)
                                }).toString();
                                window.open(`/dashboard/journal/purchase-order-payment/remaining?${queryParams}`, "_self");
                              }}
                              className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1 text-[10px] font-black uppercase text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 transition shadow-2xs"
                              title="Transfer Remaining Balance to Journal"
                            >
                              <Link2 className="h-3 w-3 text-emerald-600" />
                              {tt("plrf.transfer_remaining", "Transfer Remaining")}
                            </button>
                          )}

                          <Button
                            onClick={() => setSelectedPO(row)}
                            size="sm"
                            className="h-7 bg-blue-600 hover:bg-blue-700 text-[10px] font-bold uppercase tracking-wider px-2.5 rounded-md"
                          >
                            {tt("plrf.open_workflow", "Open Workflow")}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {dashboardOrders.length === 0 && (
                  <tr>
                    <td colSpan={11} className="px-6 py-12 text-center text-muted-foreground">
                      <Package className="h-10 w-10 mx-auto text-slate-300 mb-3" />
                      <p className="font-bold text-slate-700">{tt("plrf.no_bills", "No Bills Found")}</p>
                      <p className="text-xs">{tt("plrf.no_bills_desc", "No matching purchase order records available.")}</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1600px] p-2 sm:p-4" dir={isRtl ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="mb-4 flex items-center justify-between bg-white border border-slate-200 p-3 rounded-xl shadow-sm">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => setSelectedPO(null)} className="h-8">
            <ArrowLeft className="h-4 w-4 mr-1" /> {tt("plrf.back_to_dashboard", "Dashboard")}
          </Button>
          <div>
            <h1 className="text-sm font-black flex items-center gap-2">
              <Ship className="h-4 w-4 text-blue-600" />
              {tt("plrf.workflow_title", "Loading Workflow:")} <span className="font-mono text-blue-700">{selectedPO.purchase_order_no}</span>
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
              { id: "bill", label: tt("plrf.tab_bill_entry", "Bill Entry") },
              { id: "parties", label: tt("plrf.tab_parties", "Parties") },
              { id: "goods", label: tt("plrf.tab_goods_entry", "Goods Entry") },
              { id: "load", label: tt("plrf.tab_new_loading", "New Loading") }
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
                {activeTab === "bill" && <><FileText className="h-4 w-4 text-blue-600"/> {tt("plrf.panel_bill_ro", "Bill Details (Read Only)")}</>}
                {activeTab === "parties" && <><Globe2 className="h-4 w-4 text-emerald-600"/> {tt("plrf.panel_parties_ro", "Parties (Read Only)")}</>}
                {activeTab === "goods" && <><Package className="h-4 w-4 text-amber-600"/> {tt("plrf.panel_goods_ro", "Goods Details (Read Only)")}</>}
                {activeTab === "load" && <><Anchor className="h-4 w-4 text-indigo-600"/> {tt("plrf.panel_new_loading", "New Loading Entry")}</>}
              </h3>
            </div>

            <div className="p-5">
              {activeTab === "bill" && (
                <div className="space-y-4 text-xs font-mono">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="block text-[10px] text-slate-500 font-sans font-bold mb-1">{tt("plrf.issue_date", "Issue Date")}</span>
                      <div className="font-black">{new Date(selectedPOForm.purchaseDate || selectedPO.created_at).toLocaleDateString("en-GB")}</div>
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-500 font-sans font-bold mb-1">{tt("plrf.bill_ref_no", "Bill / Ref No")}</span>
                      <div className="font-black">{selectedPOForm.billNo || "-"}</div>
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-500 font-sans font-bold mb-1">{tt("common.supplier", "Supplier")}</span>
                      <div className="font-black">{selectedPOForm.salesAccountName || "-"}</div>
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-500 font-sans font-bold mb-1">{tt("plrf.shipping_mode", "Shipping Mode")}</span>
                      <div className="font-black">{selectedPOForm.shippingMode || "By Sea"}</div>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-slate-100 flex justify-end">
                    <Button onClick={() => setActiveTab("parties")} className="h-8 text-[10px] uppercase font-bold tracking-wider">{tt("plrf.next_parties", "Next: Parties")}</Button>
                  </div>
                </div>
              )}

              {activeTab === "parties" && (
                <div className="space-y-4 text-xs font-mono">
                  <div>
                    <span className="block text-[10px] text-slate-500 font-sans font-bold mb-1">{tt("plrf.notify_party", "Notify Party")}</span>
                    <div className="font-black">{selectedPOForm.notifyPartyName || "Same as Consignee"}</div>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-500 font-sans font-bold mb-1">{tt("plrf.importer", "Importer / Consignee")}</span>
                    <div className="font-black">{selectedPOForm.importerName || "-"}</div>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-500 font-sans font-bold mb-1">{tt("plrf.exporter", "Exporter / Shipper")}</span>
                    <div className="font-black">{selectedPOForm.exporterName || "-"}</div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between">
                    <Button variant="outline" onClick={() => setActiveTab("bill")} className="h-8 text-[10px] uppercase font-bold tracking-wider text-slate-600">{tt("common.back", "Back")}</Button>
                    <Button onClick={() => setActiveTab("goods")} className="h-8 text-[10px] uppercase font-bold tracking-wider">{tt("plrf.next_goods", "Next: Goods")}</Button>
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
                    <Button variant="outline" onClick={() => setActiveTab("parties")} className="h-8 text-[10px] uppercase font-bold tracking-wider text-slate-600">{tt("common.back", "Back")}</Button>
                    <Button onClick={() => setActiveTab("load")} className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] uppercase font-bold tracking-wider">{tt("plrf.next_loading", "Next: New Loading")}</Button>
                  </div>
                </div>
              )}

              {activeTab === "load" && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-300">
                  <LoadingBatchPanel
                    purchaseOrderId={selectedPO?.id}
                    loadedContainerNos={poRecords.map((r: any) => r.container_number).filter(Boolean)}
                    onPickContainer={(c) => setLoadForm(f => ({ ...f, containerNumber: c }))}
                    lang={lang}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] text-slate-500 font-bold mb-1">{tt("plrf.container_no_req", "Container Number *")}</label>
                      <input
                        value={loadForm.containerNumber}
                        onChange={e => setLoadForm(f => ({ ...f, containerNumber: e.target.value.toUpperCase() }))}
                        placeholder="e.g. MSKU-1234567"
                        className="w-full h-8 border border-slate-300 rounded px-2 text-xs font-mono font-bold outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 font-bold mb-1">{tt("plr.divide_type", "Container Type")}</label>
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
                      <label className="block text-[10px] text-slate-500 font-bold mb-1">{tt("plrf.loading_qty_req", "Loading Quantity *")}</label>
                      <input
                        type="number"
                        value={loadForm.loadingQuantity}
                        onChange={e => setLoadForm(f => ({ ...f, loadingQuantity: e.target.value }))}
                        placeholder={`Max: ${poTotalQty - poAlreadyLoadedQty}`}
                        className="w-full h-8 border border-slate-300 rounded px-2 text-xs font-mono font-black text-blue-700 outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 font-bold mb-1">{tt("plr.loading_date", "Loading Date")}</label>
                      <input
                        type="date"
                        value={loadForm.loadingDate}
                        onChange={e => setLoadForm(f => ({ ...f, loadingDate: e.target.value }))}
                        className="w-full h-8 border border-slate-300 rounded px-2 text-xs font-mono outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-500 font-bold mb-1">{tt("plrf.loading_notes", "Loading Notes")}</label>
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
                      <div className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">{tt("plrf.total_qty", "Total Qty")}</div>
                      <div className="text-sm font-mono font-black text-white">{poTotalQty.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">{tt("plrf.loaded", "Loaded")}</div>
                      <div className="text-sm font-mono font-black text-emerald-400">{(poAlreadyLoadedQty + currentLoadingQty).toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">{tt("plrf.balance", "Balance")}</div>
                      <div className={`text-sm font-mono font-black ${liveBalance < 0 ? "text-rose-400" : "text-amber-400"}`}>
                        {liveBalance.toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {stockLifecycle ? (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span>
                          Stock Stage: <b className="text-slate-900">{stockLifecycle.lifecycleStage.replace(/-/g, " ").toUpperCase()}</b>
                        </span>
                        <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black ${stockLifecycle.visualStatus === "black" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}>
                          {stockLifecycle.statusLabel}
                        </span>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] font-semibold uppercase tracking-normal text-slate-500 sm:grid-cols-4">
                        <div className="rounded-md bg-white px-2 py-1">Loaded: <b className="text-slate-900">{stockLifecycle.totalLoadedQuantity.toLocaleString()}</b></div>
                        <div className="rounded-md bg-white px-2 py-1">Remaining: <b className="text-slate-900">{stockLifecycle.remainingQuantity.toLocaleString()}</b></div>
                        <div className="rounded-md bg-white px-2 py-1">Payment: <b className="text-slate-900">{stockLifecycle.paymentProofComplete ? "Complete" : "Pending"}</b></div>
                        <div className="rounded-md bg-white px-2 py-1">Next: <b className="text-slate-900">{purchaseStockDestinationLabel(nextDestination)}</b></div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 text-[10px] font-black uppercase tracking-wider"
                          disabled={!stockLifecycle.paymentProofComplete || stockLifecycle.lifecycleStage === "land" || stockLifecycle.visualStatus === "black"}
                          onClick={() => void handleMoveLoadingStage("land")}
                        >
                          {tt("plrf.move_to_land", "Move to Land Stock")}
                        </Button>
                        <select
                          value={nextDestination}
                          onChange={(event) => setNextDestination(event.target.value as typeof nextDestination)}
                          className="h-8 rounded-md border border-slate-300 bg-white px-2 text-[10px] font-bold uppercase tracking-wider text-slate-700 outline-none"
                        >
                          <option value="warehouse">{tt("plrf.warehouse", "Warehouse")}</option>
                          <option value="in-transit">{tt("plrf.in_transit", "In Transit")}</option>
                          <option value="re-export">{tt("plrf.re_export", "Re-export")}</option>
                          <option value="local-sale">{tt("plrf.local_sale", "Local Sale")}</option>
                        </select>
                        <Button
                          type="button"
                          size="sm"
                          className="h-8 bg-indigo-600 text-[10px] font-black uppercase tracking-wider text-white hover:bg-indigo-700"
                          disabled={!stockLifecycle.paymentProofComplete || stockLifecycle.lifecycleStage !== "land" || saving}
                          onClick={() => void handleMoveLoadingStage("forward")}
                        >
                          {tt("plrf.forward_dest", "Forward Destination")}
                        </Button>
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between">
                    <Button variant="outline" onClick={() => setActiveTab("goods")} className="h-8 text-[10px] uppercase font-bold tracking-wider text-slate-600">{tt("common.back", "Back")}</Button>
                    <Button onClick={handleSaveLoading} disabled={saving} className="h-8 bg-blue-600 hover:bg-blue-700 text-white text-[10px] uppercase font-bold tracking-wider px-6">
                      {saving ? tt("plrf.saving", "Saving...") : tt("plrf.save_loading", "Save Loading")}
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
                <ShieldCheck className="h-4 w-4 text-emerald-400" /> {tt("plrf.live_bl_report", "LIVE BL REPORT")}
              </h2>
            </div>
            <div className="p-4 grid grid-cols-2 gap-y-4 gap-x-2 text-xs font-mono">
              <div>
                <span className="text-[9px] text-slate-400 uppercase font-sans font-bold block mb-0.5">{tt("plrf.issue_date", "Issue Date")}</span>
                <span className="font-black">{new Date(selectedPOForm.purchaseDate || selectedPO.created_at).toLocaleDateString("en-GB")}</span>
              </div>
              <div>
                <span className="text-[9px] text-slate-400 uppercase font-sans font-bold block mb-0.5">{tt("plrf.bill_ref_no", "Bill / Ref No")}</span>
                <span className="font-black">{selectedPOForm.billNo || "-"}</span>
              </div>
              <div className="col-span-2">
                <span className="text-[9px] text-slate-400 uppercase font-sans font-bold block mb-0.5">{tt("plrf.notify_party", "Notify Party")}</span>
                <span className="font-black">{selectedPOForm.notifyPartyName || "Same as Consignee"}</span>
              </div>
              <div className="col-span-2">
                <span className="text-[9px] text-slate-400 uppercase font-sans font-bold block mb-0.5">{tt("plrf.importer", "Importer")}</span>
                <span className="font-black">{selectedPOForm.importerName || "-"}</span>
              </div>
              <div className="col-span-2">
                <span className="text-[9px] text-slate-400 uppercase font-sans font-bold block mb-0.5">{tt("plrf.exporter", "Exporter")}</span>
                <span className="font-black">{selectedPOForm.exporterName || "-"}</span>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col h-full">
            <div className="bg-blue-600 p-3 flex justify-between items-center">
              <h2 className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-2">
                <Anchor className="h-4 w-4 text-blue-200" /> {tt("plrf.goods_container", "GOODS & CONTAINER REPORT")}
              </h2>
              <span className="bg-blue-800 text-white text-[9px] px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                LIVE INVENTORY
              </span>
            </div>
            
            <div className="flex-1 overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <Th className="px-4 py-2 font-bold uppercase tracking-wider text-slate-500 text-[10px]">{tt("common.date", "Date")}</Th>
                    <Th className="px-4 py-2 font-bold uppercase tracking-wider text-slate-500 text-[10px]">{tt("plrf.col_container", "Container")}</Th>
                    <Th className="px-4 py-2 font-bold uppercase tracking-wider text-slate-500 text-[10px] text-right">{tt("cpb.loaded_qty", "Loaded Qty")}</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {poRecords.length === 0 && (
                    <tr><td colSpan={3} className="px-4 py-4 text-center text-slate-400 font-mono">{tt("plrf.no_loading_yet", "No Loading Records Yet")}</td></tr>
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
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{tt("plrf.total_kgs", "Total KGs:")}</span>
                  <span className="font-mono font-black text-slate-700">{poTotalQty.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{tt("plrf.net_weight", "Net Weight:")}</span>
                  <span className="font-mono font-black text-slate-700">{poTotalNetWeight.toLocaleString()} KGs</span>
                </div>
                <div className="col-span-2 pt-2 border-t border-slate-200 flex justify-between items-center">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{tt("plrf.grand_amount", "Grand Final Amount:")}</span>
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
