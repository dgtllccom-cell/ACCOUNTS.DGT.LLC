"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Search, Loader2, X, Ship, Truck, FileText, CheckCircle, RefreshCcw, Save, ShieldCheck, DollarSign } from "lucide-react";
import { t } from "@/lib/i18n/ui";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { getLanguageDirection } from "@/lib/i18n/languages";
import { LocationHierarchySelect } from "@/features/locations/components/location-hierarchy-select";
import { ReportActions } from "@/components/ui/report-actions";
import { TruckAttachments } from "@/features/clearing-agent/components/truck-attachments";
import { cn } from "@/lib/utils";
import { Th } from "@/components/ui/translated-th";

type Loading = {
  id: string;
  loading_date: string | null;
  loading_serial: string | null;
  truck_id: string | null;
  truck_number: string | null;
  driver_name: string | null;
  driver_mobile_1: string | null;
  vehicle_type: string | null;
  goods_name: string | null;
  quantity: number | null;
  unit: string | null;
  net_weight: number | null;
  gross_weight: number | null;
  destination: string | null;
  remarks: string | null;
};

type TruckOpt = {
  id: string;
  truck_number: string;
  vehicle_type?: string | null;
  truck_type?: string | null;
  driver_name: string | null;
  driver_mobile: string | null;
  owner_name: string | null;
};

const EMPTY: any = {
  id: "",
  loading_type: "local",
  truck_id: "",
  loading_date: new Date().toISOString().slice(0, 10),
  truck_number: "",
  driver_name: "",
  driver_mobile_1: "",
  vehicle_type: "Truck Trailer",
  goods_name: "",
  quantity: "",
  unit: "BAGS",
  net_weight: "",
  gross_weight: "",
  destination: "",
  customs_agent_name: "",
  border_port_name: "",
  declaration_no: "",
  transit_country: "",
  remarks: "",
  customerAccountNo: "",
  shippingType: "By Sea",
  shipmentType: "Import",
  importer: "",
  exporter: "",
  notifyParty: "",
  bookingNo: "",
  bookingCompanyType: "Shipping Line",
  bookingCompanyName: "",
  bookingName: "",
  bookingDate: new Date().toISOString().slice(0, 10),
  vesselName: "",
  issueDate: new Date().toISOString().slice(0, 10),
  issueSerial: "",
  blType: "New BL",
  blNo: "",
  routeCountry: "PK / UAE",
  loadCountry: "Pakistan",
  loadPlace: "Karachi Port",
  receiveCountry: "UAE",
  receivePlace: "Jebel Ali Port",
  loadDate: new Date().toISOString().slice(0, 10),
  receiveDate: new Date().toISOString().slice(0, 10),
  goodsSize: "Large",
  goodsBrand: "",
  goodsOrigin: "",
  hsCode: "",
  allotName: "",
  warehouse: "",
  emptyPerBag: "",
  divideName: "Ton",
  divideNumber: "1000",
  carrierType: "container",
  carrierSubType: "Dry Container 20FT",
  carrierName: "Container Line",
  sealNumber: "SEAL-7788",
  dest_country_id: null,
  dest_state_province_id: null,
  dest_district_id: null,
  dest_city_id: null
};

export function TruckLoadingManagementView({ lang }: { lang: SupportedLanguage }) {
  const dir = getLanguageDirection(lang);
  const [rows, setRows] = useState<Loading[]>([]);
  const [trucks, setTrucks] = useState<TruckOpt[]>([]);
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<any>(EMPTY);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"parties" | "bl" | "goods" | "carrier">("parties");
  const [transportModeFilter, setTransportModeFilter] = useState<string>("all");
  const [movementTypeFilter, setMovementTypeFilter] = useState<string>("all");

  async function load() {
    setLoading(true); setError(null);
    try {
      const [r1, r2, r3] = await Promise.all([
        fetch("/api/erp/clearing-agent/truck-loading"),
        fetch("/api/erp/master-data/trucks?selectable=true"),
        fetch("/api/erp/clearing-agent/customer-order?status=pending"),
      ]);
      const j1 = await r1.json(); const j2 = await r2.json(); const j3 = await r3.json();
      if (!r1.ok) throw new Error(j1.error || "Failed to load");
      setRows(j1.records || []);
      setTrucks(r2.ok ? (j2.trucks || []) : []);
      if (j3.success) setPendingOrders(j3.data || []);
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    let result = rows;
    if (transportModeFilter !== "all") {
      result = result.filter((r: any) => (r.shippingType || "").toLowerCase().replace(/\s+/g, "_") === transportModeFilter || (r.transport_mode || "").toLowerCase() === transportModeFilter);
    }
    if (movementTypeFilter !== "all") {
      result = result.filter((r: any) => (r.shipmentType || "").toLowerCase() === movementTypeFilter || (r.movement_type || "").toLowerCase() === movementTypeFilter);
    }
    const q = query.trim().toLowerCase();
    if (!q) return result;
    return result.filter((r) => [r.truck_number, r.driver_name, r.goods_name, r.loading_serial].some((v) => (v || "").toLowerCase().includes(q)));
  }, [rows, query, transportModeFilter, movementTypeFilter]);

  function startAdd() { setForm(EMPTY); setActiveTab("parties"); setEditing(true); }
  function startEdit(r: Loading) { setForm({ ...EMPTY, ...r, quantity: r.quantity ?? "", net_weight: r.net_weight ?? "", gross_weight: r.gross_weight ?? "", loading_date: r.loading_date ?? "" }); setActiveTab("parties"); setEditing(true); }

  function onSelectTruck(truckId: string) {
    const tr = trucks.find((x) => x.id === truckId);
    setForm((f: any) => ({
      ...f,
      truck_id: truckId,
      truck_number: tr?.truck_number ?? "",
      driver_name: tr?.driver_name ?? "",
      driver_mobile_1: tr?.driver_mobile ?? "",
      vehicle_type: tr?.vehicle_type ?? tr?.truck_type ?? "Truck",
    }));
  }

  async function save() {
    if (!form.truck_id && !String(form.truck_number).trim()) { setError("Select a truck"); return; }
    setSaving(true); setError(null);
    try {
      const payload = { ...form }; delete payload.id;
      const res = form.id
        ? await fetch(`/api/erp/clearing-agent/truck-loading/${form.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        : await fetch("/api/erp/clearing-agent/truck-loading", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save");
      setEditing(false); setForm(EMPTY); await load();
    } catch (e: any) { setError(e.message); } finally { setSaving(false); }
  }

  async function remove(id: string) {
    if (!confirm(t(lang, "tl.delete") + "?")) return;
    try {
      const res = await fetch(`/api/erp/clearing-agent/truck-loading/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to delete");
      await load();
    } catch (e: any) { setError(e.message); }
  }

  // Calculated weights & divide
  const grossKg = Number(form.gross_weight || 0);
  const emptyBagKg = Number(form.emptyPerBag || 0);
  const qtyNo = Number(form.quantity || 0);
  const totalEmptyKg = qtyNo * emptyBagKg;
  const computedNetKg = Math.max(0, grossKg - totalEmptyKg);

  return (
    <div dir={dir} className="space-y-4">
      {/* Header Strip */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Truck className="h-6 w-6 text-blue-600" />
            Truck Loading & Clearing Booking
          </h1>
          <p className="text-xs font-medium text-slate-500">
            Create complete truck loading entry with live mini journal report and inventory breakdown
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ReportActions title="Truck Loading Report" rows={filtered} columns={[{ key: "loading_serial", label: "Serial" }, { key: "loading_date", label: "Date" }, { key: "truck_number", label: "Truck" }, { key: "driver_name", label: "Driver" }, { key: "goods_name", label: "Goods" }, { key: "quantity", label: "Qty" }, { key: "destination", label: "Destination" }]} lang={lang} />
          <button onClick={startAdd} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-800 shadow-md transition">
            <Plus className="h-4 w-4" /> New Loading Entry
          </button>
        </div>
      </div>

      {/* Workflow Selection: Transport Mode & Movement Type */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
          <span className="text-xs font-bold uppercase text-slate-500">1. Transport Mode:</span>
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { key: "all", label: "All Modes" },
              { key: "by_sea", label: "By Sea" },
              { key: "by_road", label: "By Road" },
              { key: "by_truck", label: "By Truck" },
              { key: "by_air", label: "By Air" },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setTransportModeFilter(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  transportModeFilter === key
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <span className="text-xs font-bold uppercase text-slate-500">2. Movement Type:</span>
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { key: "all", label: "All Types" },
              { key: "import", label: "Import Loading" },
              { key: "transit", label: "Transit Loading" },
              { key: "export", label: "Export Loading" },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setMovementTypeFilter(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  movementTypeFilter === key
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Pending Customer Orders Ribbon */}
      {pendingOrders.length > 0 && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-amber-500 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Pending Customer Orders Ready for Loading ({pendingOrders.length})
            </span>
            <span className="text-[11px] text-amber-400">Click to autofill loading entry</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {pendingOrders.map((ord) => (
              <button
                key={ord.id}
                onClick={() => {
                  setForm({
                    ...EMPTY,
                    customerAccountNo: ord.customer_name,
                    importer: ord.customer_name,
                    shippingType: ord.transport_mode === "by_sea" ? "By Sea" : ord.transport_mode === "by_air" ? "By Air" : "By Road",
                    shipmentType: ord.movement_type === "import" ? "Import" : ord.movement_type === "transit" ? "Transit" : "Export",
                    loadCountry: ord.loading_country_name || "",
                    loadPlace: ord.loading_port_name || "",
                    receiveCountry: ord.receiving_country_name || "",
                    receivePlace: ord.destination_port_name || "",
                    routeCountry: ord.route_name || "",
                    remarks: ord.cargo_details ? `Cargo: ${ord.cargo_details}` : "",
                  });
                  setActiveTab("parties");
                  setEditing(true);
                }}
                className="text-left p-3 rounded-xl bg-white dark:bg-slate-900 border border-amber-500/20 hover:border-amber-500/50 transition-all text-xs space-y-1 shadow-sm"
              >
                <div className="flex items-center justify-between font-bold">
                  <span className="text-indigo-400 font-mono">{ord.order_no}</span>
                  <span className="capitalize text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-300">
                    {ord.transport_mode?.replace("_", " ")}
                  </span>
                </div>
                <div className="text-slate-900 dark:text-white font-medium truncate">{ord.customer_name}</div>
                <div className="text-[11px] text-slate-400 truncate">{ord.route_name || `${ord.loading_country_name || "-"} → ${ord.receiving_country_name || "-"}`}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search Bar */}
      <div className="relative">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search loading serial, truck number, driver name, goods..." className="w-full rounded-xl border border-slate-200 bg-white py-2.5 ps-9 pe-3 text-sm dark:border-slate-800 dark:bg-slate-950 shadow-sm" />
      </div>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">{error}</div> : null}

      {/* List Table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 shadow-sm">
        <table className="w-full text-start text-sm">
          <thead className="bg-slate-50 text-[11px] font-black uppercase tracking-wide text-slate-500 dark:bg-slate-950/60">
            <tr>
              <Th className="px-4 py-3 text-start">Serial #</Th>
              <Th className="px-4 py-3 text-start">Loading Date</Th>
              <Th className="px-4 py-3 text-start">Truck #</Th>
              <Th className="px-4 py-3 text-start">Driver</Th>
              <Th className="px-4 py-3 text-start">Goods</Th>
              <Th className="px-4 py-3 text-start">Qty</Th>
              <Th className="px-4 py-3 text-start">Destination</Th>
              <Th className="px-4 py-3 text-end">Actions</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400">No loading entries found. Click "+ New Loading Entry" to create one.</td></tr>
            ) : filtered.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-950/40 transition">
                <td className="px-4 py-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">{r.loading_serial || "-"}</td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{r.loading_date || "-"}</td>
                <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{r.truck_number || "-"}</td>
                <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{r.driver_name || "-"}</td>
                <td className="px-4 py-3 text-slate-700 dark:text-slate-300 font-semibold">{r.goods_name || "-"}</td>
                <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{r.quantity ?? "-"} {r.unit || ""}</td>
                <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{r.destination || "-"}</td>
                <td className="px-4 py-3 text-end">
                  <div className="flex items-center justify-end gap-1.5">
                    <button onClick={() => startEdit(r)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-blue-600 dark:hover:bg-slate-800" title="Edit Entry"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => remove(r.id)} className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40" title="Delete Entry"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* FULL 2-COLUMN SPLIT ENTRY MODAL / DRAWER (Matching User HTML Design) */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
          <div className="w-full max-w-[1600px] max-h-[92vh] overflow-y-auto rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-5 space-y-4">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b pb-3 border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-cyan-500" />
                <h2 className="text-lg font-black uppercase text-slate-900 dark:text-slate-100">
                  {form.id ? "Edit Truck Loading & BL Entry" : "New Truck Loading & Customer Account Booking"}
                </h2>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={save}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 px-5 py-2 text-xs font-black text-white shadow-md transition"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save Loading Record
                </button>

                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="rounded-xl border border-slate-200 p-2 text-slate-400 hover:bg-slate-100 dark:border-slate-800 dark:hover:bg-slate-800"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* 2-COLUMN SPLIT GRID (LEFT FORM + RIGHT LIVE MINI JOURNAL & GOODS TABLE) */}
            <div className="grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-5 items-start">
              
              {/* LEFT COLUMN: Step-by-Step Form Controls */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950 space-y-4">
                
                {/* Module Loading Category Selector */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-500">Loading Category / Shipment Type</label>
                  <select
                    value={form.loading_type ?? "local"}
                    onChange={(e) => setForm({ ...form, loading_type: e.target.value })}
                    className="w-full rounded-xl border border-indigo-200 bg-white px-3 py-2 text-xs font-bold text-indigo-900 dark:border-indigo-900 dark:bg-slate-900 dark:text-indigo-300 outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="local">🚛 Local Truck Loading (داخلی بارگیری)</option>
                    <option value="import">🛃 Import Loading (امپورٹ بارگیری / Customs Clearing)</option>
                    <option value="transit">🌐 Transit Loading (ٹرانزٹ بارگیری / Border Transit)</option>
                  </select>
                </div>

                {/* 4 Step Tabs */}
                <div className="grid grid-cols-4 gap-1">
                  {[
                    { id: "parties", label: "1) Parties" },
                    { id: "bl", label: "2) BL Entry" },
                    { id: "goods", label: "3) Goods" },
                    { id: "carrier", label: "4) Carrier" }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id as any)}
                      className={cn(
                        "h-8 rounded-lg text-[9px] font-black transition border",
                        activeTab === tab.id
                          ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                          : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-100"
                      )}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* TAB 1: PARTIES & BOOKING */}
                {activeTab === "parties" && (
                  <div className="space-y-3 animate-in fade-in duration-150">
                    <div className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-400">SR#: 1 - Parties & Booking</div>
                    
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-500">Customer Account No *</label>
                      <input
                        type="text"
                        value={form.customerAccountNo || "CUST-1001"}
                        onChange={e => setForm({ ...form, customerAccountNo: e.target.value })}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold dark:border-slate-800 dark:bg-slate-900"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-500">Shipping Type *</label>
                        <select
                          value={form.shippingType || "By Sea"}
                          onChange={e => setForm({ ...form, shippingType: e.target.value })}
                          className="w-full rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs font-semibold dark:border-slate-800 dark:bg-slate-900"
                        >
                          <option value="By Sea">By Sea</option>
                          <option value="By Road">By Road</option>
                          <option value="By Air">By Air</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-500">Shipment Type *</label>
                        <select
                          value={form.shipmentType || "Import"}
                          onChange={e => setForm({ ...form, shipmentType: e.target.value })}
                          className="w-full rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs font-semibold dark:border-slate-800 dark:bg-slate-900"
                        >
                          <option value="Import">Import</option>
                          <option value="Export">Export</option>
                          <option value="Transit">Transit</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-500">Importer Name *</label>
                      <input
                        type="text"
                        value={form.importer || ""}
                        onChange={e => setForm({ ...form, importer: e.target.value })}
                        placeholder="Importer Name"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold dark:border-slate-800 dark:bg-slate-900"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-500">Exporter Name *</label>
                      <input
                        type="text"
                        value={form.exporter || ""}
                        onChange={e => setForm({ ...form, exporter: e.target.value })}
                        placeholder="Exporter Name"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold dark:border-slate-800 dark:bg-slate-900"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-500">Booking No *</label>
                        <input
                          type="text"
                          value={form.bookingNo || "BK-2026-001"}
                          onChange={e => setForm({ ...form, bookingNo: e.target.value })}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold dark:border-slate-800 dark:bg-slate-900 font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-500">Company Name *</label>
                        <input
                          type="text"
                          value={form.bookingCompanyName || "DGT Logistics"}
                          onChange={e => setForm({ ...form, bookingCompanyName: e.target.value })}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold dark:border-slate-800 dark:bg-slate-900"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end pt-2">
                      <button
                        type="button"
                        onClick={() => setActiveTab("bl")}
                        className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-black text-white hover:bg-blue-700"
                      >
                        Next: BL Entry →
                      </button>
                    </div>
                  </div>
                )}

                {/* TAB 2: BL & ROUTE DETAILS */}
                {activeTab === "bl" && (
                  <div className="space-y-3 animate-in fade-in duration-150">
                    <div className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-400">SR#: 2 - Transport & Route Details</div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-500">Issue Date *</label>
                        <input
                          type="date"
                          value={form.issueDate || ""}
                          onChange={e => setForm({ ...form, issueDate: e.target.value })}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold dark:border-slate-800 dark:bg-slate-900"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-500">Issue Serial *</label>
                        <input
                          type="text"
                          value={form.issueSerial || "ISS-671867"}
                          onChange={e => setForm({ ...form, issueSerial: e.target.value })}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold dark:border-slate-800 dark:bg-slate-900 font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-500">BL Type</label>
                        <select
                          value={form.blType || "New BL"}
                          onChange={e => setForm({ ...form, blType: e.target.value })}
                          className="w-full rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs font-semibold dark:border-slate-800 dark:bg-slate-900"
                        >
                          <option value="New BL">New BL</option>
                          <option value="Old BL">Old BL</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-500">BL No</label>
                        <input
                          type="text"
                          value={form.blNo || "BL-671867"}
                          onChange={e => setForm({ ...form, blNo: e.target.value })}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold dark:border-slate-800 dark:bg-slate-900 font-mono"
                        />
                      </div>
                    </div>

                    <div className="rounded-xl border border-cyan-200 bg-cyan-50/50 p-3 dark:border-cyan-900/40 dark:bg-slate-900 space-y-2">
                      <p className="text-[10px] font-black uppercase text-cyan-700 dark:text-cyan-300">Loading & Receiving Borders</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[9px] font-bold text-slate-500">Loading Country</label>
                          <input
                            type="text"
                            value={form.loadCountry || "Pakistan"}
                            onChange={e => setForm({ ...form, loadCountry: e.target.value })}
                            className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs dark:border-slate-800 dark:bg-slate-950"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-bold text-slate-500">Loading Border/Port</label>
                          <input
                            type="text"
                            value={form.loadPlace || "Karachi Port"}
                            onChange={e => setForm({ ...form, loadPlace: e.target.value })}
                            className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs dark:border-slate-800 dark:bg-slate-950"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-bold text-slate-500">Receiving Country</label>
                          <input
                            type="text"
                            value={form.receiveCountry || "UAE"}
                            onChange={e => setForm({ ...form, receiveCountry: e.target.value })}
                            className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs dark:border-slate-800 dark:bg-slate-950"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-bold text-slate-500">Receiving Border/Port</label>
                          <input
                            type="text"
                            value={form.receivePlace || "Dubai Border"}
                            onChange={e => setForm({ ...form, receivePlace: e.target.value })}
                            className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs dark:border-slate-800 dark:bg-slate-950"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end pt-2">
                      <button
                        type="button"
                        onClick={() => setActiveTab("goods")}
                        className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-black text-white hover:bg-blue-700"
                      >
                        Next: Goods Entry →
                      </button>
                    </div>
                  </div>
                )}

                {/* TAB 3: GOODS ENTRY */}
                {activeTab === "goods" && (
                  <div className="space-y-3 animate-in fade-in duration-150">
                    <div className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-400">SR#: 3 - Goods & Inventory Entry</div>

                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-500">Select Registered Truck *</label>
                      <select
                        value={form.truck_id ?? ""}
                        onChange={(e) => onSelectTruck(e.target.value)}
                        className="w-full rounded-xl border border-blue-200 bg-blue-50/50 px-3 py-2 text-xs font-bold text-blue-900 dark:border-blue-900 dark:bg-slate-900 dark:text-blue-300"
                      >
                        <option value="">Select registered truck from DB...</option>
                        {trucks.map((tr) => (
                          <option key={tr.id} value={tr.id}>
                            {tr.truck_number} {tr.driver_name ? `(${tr.driver_name})` : ""}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-500">Goods Name *</label>
                      <input
                        type="text"
                        value={form.goods_name || "PISTACHIOS KERNEL"}
                        onChange={e => setForm({ ...form, goods_name: e.target.value })}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold dark:border-slate-800 dark:bg-slate-900"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[9px] font-bold text-slate-500">Size</label>
                        <input
                          type="text"
                          value={form.goodsSize || "Large"}
                          onChange={e => setForm({ ...form, goodsSize: e.target.value })}
                          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs dark:border-slate-800 dark:bg-slate-950"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-slate-500">Brand</label>
                        <input
                          type="text"
                          value={form.goodsBrand || "Premium"}
                          onChange={e => setForm({ ...form, goodsBrand: e.target.value })}
                          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs dark:border-slate-800 dark:bg-slate-950"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-slate-500">Quantity (Bags)</label>
                        <input
                          type="number"
                          value={form.quantity || "100"}
                          onChange={e => setForm({ ...form, quantity: e.target.value })}
                          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-bold dark:border-slate-800 dark:bg-slate-950"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-slate-500">Gross Weight (KG)</label>
                        <input
                          type="number"
                          value={form.gross_weight || "5000"}
                          onChange={e => setForm({ ...form, gross_weight: e.target.value })}
                          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-bold dark:border-slate-800 dark:bg-slate-950"
                        />
                      </div>
                    </div>

                    {/* Weight summary box */}
                    <div className="rounded-xl border border-slate-200 bg-white p-2 text-[10px] space-y-1 dark:border-slate-800 dark:bg-slate-950">
                      <div className="flex justify-between text-slate-500">
                        <span>Total Empty Wt:</span>
                        <span className="font-bold">{totalEmptyKg} KG</span>
                      </div>
                      <div className="flex justify-between text-amber-600 font-bold">
                        <span>Net Weight:</span>
                        <span>{computedNetKg} KG</span>
                      </div>
                    </div>

                    <div className="flex justify-end pt-2">
                      <button
                        type="button"
                        onClick={() => setActiveTab("carrier")}
                        className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-black text-white hover:bg-blue-700"
                      >
                        Next: Carrier Details →
                      </button>
                    </div>
                  </div>
                )}

                {/* TAB 4: CARRIER & CONTAINER DETAILS */}
                {activeTab === "carrier" && (
                  <div className="space-y-3 animate-in fade-in duration-150">
                    <div className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-400">SR#: 4 - Carrier / Container Details</div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-500">Carrier Type</label>
                        <select
                          value={form.carrierType || "container"}
                          onChange={e => setForm({ ...form, carrierType: e.target.value })}
                          className="w-full rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs font-semibold dark:border-slate-800 dark:bg-slate-900"
                        >
                          <option value="container">Container</option>
                          <option value="truck">Truck Trailer</option>
                          <option value="air">Air Cargo</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-500">Container / Sub Type</label>
                        <input
                          type="text"
                          value={form.carrierSubType || "Dry Container 20FT"}
                          onChange={e => setForm({ ...form, carrierSubType: e.target.value })}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold dark:border-slate-800 dark:bg-slate-900"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-500">Container / Truck No *</label>
                        <input
                          type="text"
                          value={form.truck_number || "CONT-123456"}
                          onChange={e => setForm({ ...form, truck_number: e.target.value })}
                          placeholder="e.g. CONT-123456"
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold dark:border-slate-800 dark:bg-slate-900 font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-500">Seal Number</label>
                        <input
                          type="text"
                          value={form.sealNumber || "SEAL-7788"}
                          onChange={e => setForm({ ...form, sealNumber: e.target.value })}
                          placeholder="SEAL-7788"
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold dark:border-slate-800 dark:bg-slate-900 font-mono"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-500">Driver Name</label>
                      <input
                        type="text"
                        value={form.driver_name || ""}
                        onChange={e => setForm({ ...form, driver_name: e.target.value })}
                        placeholder="Driver Name"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold dark:border-slate-800 dark:bg-slate-900"
                      />
                    </div>

                    {/* Dynamic Import/Transit fields */}
                    {(form.loading_type === "import" || form.loading_type === "transit") && (
                      <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 p-2.5 space-y-2">
                        <p className="text-[10px] font-black text-amber-800 dark:text-amber-300 uppercase">Customs & Transit Details</p>
                        <input
                          type="text"
                          placeholder="Clearing Agent Name"
                          value={form.customs_agent_name || ""}
                          onChange={e => setForm({ ...form, customs_agent_name: e.target.value })}
                          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs dark:border-slate-800 dark:bg-slate-950"
                        />
                        <input
                          type="text"
                          placeholder="Declaration / GD Number"
                          value={form.declaration_no || ""}
                          onChange={e => setForm({ ...form, declaration_no: e.target.value })}
                          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs dark:border-slate-800 dark:bg-slate-950"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* RIGHT COLUMN: Real-Time Live Mini Journal Report & Goods Inventory Table */}
              <div className="space-y-4 min-w-0">
                
                {/* Card A: Board / BL / Loading Report (Live Mini Journal) */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-3">
                  <div className="flex items-center justify-between border-b pb-3 border-slate-100 dark:border-slate-800">
                    <div>
                      <h3 className="text-sm font-black uppercase text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <FileText className="h-4 w-4 text-blue-600" />
                        Board / BL / Loading Report
                      </h3>
                      <p className="text-[10px] font-medium text-slate-400">One Page Live Mini Journal Summary</p>
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
                      ● LIVE UPDATING
                    </span>
                  </div>

                  {/* Grid details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-[11px] font-medium">
                    <div className="col-span-full font-black text-blue-600 dark:text-blue-400 uppercase text-[9.5px] tracking-wider pt-1 border-b border-slate-100 dark:border-slate-800 pb-1">
                      1. BL Basic / Board & Route Details
                    </div>
                    
                    <div className="flex justify-between border-b border-dotted pb-1">
                      <span className="text-slate-400 font-bold uppercase text-[9px]">Mode:</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">{form.blType || "New BL"}</span>
                    </div>
                    <div className="flex justify-between border-b border-dotted pb-1">
                      <span className="text-slate-400 font-bold uppercase text-[9px]">Issue Date:</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">{form.issueDate}</span>
                    </div>
                    <div className="flex justify-between border-b border-dotted pb-1">
                      <span className="text-slate-400 font-bold uppercase text-[9px]">Issue Serial:</span>
                      <span className="font-bold text-indigo-600 dark:text-indigo-400 font-mono">{form.issueSerial}</span>
                    </div>
                    <div className="flex justify-between border-b border-dotted pb-1">
                      <span className="text-slate-400 font-bold uppercase text-[9px]">BL / Loading No:</span>
                      <span className="font-bold text-indigo-600 dark:text-indigo-400 font-mono">{form.blNo}</span>
                    </div>

                    <div className="col-span-full flex justify-between border-b border-dotted pb-1">
                      <span className="text-slate-400 font-bold uppercase text-[9px]">Full Route:</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100 text-right truncate">
                        {form.shippingType} | {form.routeCountry} | L: {form.loadCountry} / {form.loadPlace} → R: {form.receiveCountry} / {form.receivePlace}
                      </span>
                    </div>

                    <div className="col-span-full font-black text-blue-600 dark:text-blue-400 uppercase text-[9.5px] tracking-wider pt-2 border-b border-slate-100 dark:border-slate-800 pb-1">
                      2. Booking & Carrier Details
                    </div>

                    <div className="flex justify-between border-b border-dotted pb-1">
                      <span className="text-slate-400 font-bold uppercase text-[9px]">Shipping / Category:</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100 capitalize">{form.loading_type} / {form.shippingType}</span>
                    </div>
                    <div className="flex justify-between border-b border-dotted pb-1">
                      <span className="text-slate-400 font-bold uppercase text-[9px]">Booking Company:</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">{form.bookingCompanyName}</span>
                    </div>
                    <div className="flex justify-between border-b border-dotted pb-1">
                      <span className="text-slate-400 font-bold uppercase text-[9px]">Truck / Vehicle No:</span>
                      <span className="font-mono font-black text-blue-600 dark:text-blue-400">{form.truck_number || "CONT-123456"}</span>
                    </div>
                    <div className="flex justify-between border-b border-dotted pb-1">
                      <span className="text-slate-400 font-bold uppercase text-[9px]">Seal Number:</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{form.sealNumber || "SEAL-7788"}</span>
                    </div>
                  </div>
                </div>

                {/* Card B: Live Goods Loading Inventory Table */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-black uppercase text-slate-900 dark:text-slate-100">
                        Goods Loading Report
                      </h3>
                      <p className="text-[10px] font-medium text-slate-400">Live Inventory Breakdown</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700">
                        Live Inventory
                      </span>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                    <table className="w-full text-left text-xs whitespace-nowrap">
                      <thead className="bg-slate-900 text-white font-black text-[10px] uppercase tracking-wider dark:bg-slate-950">
                        <tr>
                          <Th className="p-2.5">SR#</Th>
                          <Th className="p-2.5">Goods Name</Th>
                          <Th className="p-2.5">Size</Th>
                          <Th className="p-2.5">Brand</Th>
                          <Th className="p-2.5">Origin</Th>
                          <Th className="p-2.5">HS Code</Th>
                          <Th className="p-2.5">Warehouse</Th>
                          <Th className="p-2.5">Qty (Bags)</Th>
                          <Th className="p-2.5">Gross KG</Th>
                          <Th className="p-2.5">Empty KG</Th>
                          <Th className="p-2.5 text-right">Net Weight KG</Th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                        <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-950/40">
                          <td className="p-2.5 font-bold text-slate-400">01</td>
                          <td className="p-2.5 font-bold text-blue-600 dark:text-blue-400">{form.goods_name || "PISTACHIOS KERNEL"}</td>
                          <td className="p-2.5 text-slate-600 dark:text-slate-300">{form.goodsSize || "Large"}</td>
                          <td className="p-2.5 text-slate-600 dark:text-slate-300">{form.goodsBrand || "Premium"}</td>
                          <td className="p-2.5 text-slate-600 dark:text-slate-300">{form.goodsOrigin || "IRAN"}</td>
                          <td className="p-2.5 font-mono text-slate-500">{form.hsCode || "0802.51"}</td>
                          <td className="p-2.5 text-slate-600 dark:text-slate-300">{form.warehouse || "MAIN WH-A"}</td>
                          <td className="p-2.5 font-bold text-slate-900 dark:text-white">{qtyNo}</td>
                          <td className="p-2.5 font-mono font-bold text-slate-900 dark:text-white">{grossKg.toLocaleString()}</td>
                          <td className="p-2.5 font-mono text-slate-500">{totalEmptyKg}</td>
                          <td className="p-2.5 font-mono font-black text-amber-600 dark:text-amber-400 text-right">{computedNetKg.toLocaleString()}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Totals strip */}
                  <div className="flex justify-end items-center gap-8 rounded-xl bg-slate-50 dark:bg-slate-950 p-3 border border-slate-200 dark:border-slate-800 text-right">
                    <div>
                      <span className="block text-[9px] font-black uppercase text-slate-400">Total Gross Weight</span>
                      <span className="text-base font-black text-slate-900 dark:text-slate-100 font-mono">{grossKg.toLocaleString()} KG</span>
                    </div>
                    <div>
                      <span className="block text-[9px] font-black uppercase text-slate-400">Total Net Weight</span>
                      <span className="text-base font-black text-amber-600 dark:text-amber-400 font-mono">{computedNetKg.toLocaleString()} KG</span>
                    </div>
                  </div>
                </div>

              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
