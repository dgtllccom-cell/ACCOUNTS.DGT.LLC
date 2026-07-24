"use client";

import { useEffect, useMemo, useState } from "react";
import { 
  Anchor, 
  Calendar, 
  CheckCircle, 
  Clock, 
  Download, 
  Edit3, 
  FileText, 
  MapPin, 
  Printer, 
  RefreshCcw, 
  Search, 
  Ship, 
  Truck 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchSelect, type SearchSelectOption } from "@/components/ui/search-select";
import { cn } from "@/lib/utils";

type ShippingLineStagePageProps = {
  title: string;
  eyebrow: string;
  description: string;
  activeStage: "shipment" | "report";
};

type ShippingRecord = {
  id: string;
  shipping_line_name: string;
  bl_number: string;
  container_number: string | null;
  vessel_name: string | null;
  voyage_number: string | null;
  loading_port: string | null;
  discharge_port: string | null;
  eta: string | null;
  etd: string | null;
  shipment_status: string;
  account_number: string | null;
  debit: number | string;
  credit: number | string;
  currency_code: string;
  created_at: string;
  countries?: { name: string } | null;
  country_branches?: { name: string } | null;
  city_branches?: { name: string; city_name: string | null } | null;
  report_payload?: {
    carrierRemarks?: string | null;
  } | null;
};

const shipmentStatuses = [
  { value: "draft", label: "Draft", color: "bg-slate-900 text-slate-400 border-slate-800" },
  { value: "booked", label: "Booked", color: "bg-indigo-950 text-indigo-400 border-indigo-900" },
  { value: "in_transit", label: "In Transit", color: "bg-blue-950 text-blue-400 border-blue-900" },
  { value: "arrived", label: "Arrived", color: "bg-amber-950 text-amber-400 border-amber-900" },
  { value: "cleared", label: "Cleared", color: "bg-cyan-950 text-cyan-400 border-cyan-900" },
  { value: "delivered", label: "Delivered", color: "bg-emerald-950 text-emerald-400 border-emerald-900" },
  { value: "cancelled", label: "Cancelled", color: "bg-red-950 text-red-400 border-red-900" }
];

export function ShippingLineStagePage({
  title,
  eyebrow,
  description,
  activeStage
}: ShippingLineStagePageProps) {
  const [records, setRecords] = useState<ShippingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  
  // Selected record for details editing
  const [selectedRecord, setSelectedRecord] = useState<ShippingRecord | null>(null);

  // Form fields
  const [shippingLineName, setShippingLineName] = useState("");
  const [blNumber, setBlNumber] = useState("");
  const [containerNumber, setContainerNumber] = useState("");
  const [vesselName, setVesselName] = useState("");
  const [voyageNumber, setVoyageNumber] = useState("");
  const [loadingPort, setLoadingPort] = useState("");
  const [dischargePort, setDischargePort] = useState("");
  const [eta, setEta] = useState("");
  const [etd, setEtd] = useState("");
  const [shipmentStatus, setShipmentStatus] = useState("draft");
  const [remarks, setRemarks] = useState("");

  async function loadRecords(searchQuery = query) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "150" });
      if (searchQuery.trim()) params.set("q", searchQuery.trim());
      const res = await fetch(`/api/erp/shipping/bl-records?${params.toString()}`);
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json?.error?.message ?? "Unable to load shipment records");
      setRecords(json.data?.records || []);
    } catch (err: any) {
      console.error(err);
      setMessage(err.message || "Failed to load records");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRecords("").catch(() => null);
  }, []);

  // Update form fields when a B/L is selected
  useEffect(() => {
    if (!selectedRecord) {
      setShippingLineName("");
      setBlNumber("");
      setContainerNumber("");
      setVesselName("");
      setVoyageNumber("");
      setLoadingPort("");
      setDischargePort("");
      setEta("");
      setEtd("");
      setShipmentStatus("draft");
      setRemarks("");
      return;
    }
    setShippingLineName(selectedRecord.shipping_line_name || "");
    setBlNumber(selectedRecord.bl_number || "");
    setContainerNumber(selectedRecord.container_number || "");
    setVesselName(selectedRecord.vessel_name || "");
    setVoyageNumber(selectedRecord.voyage_number || "");
    setLoadingPort(selectedRecord.loading_port || "");
    setDischargePort(selectedRecord.discharge_port || "");
    setEta(selectedRecord.eta || "");
    setEtd(selectedRecord.etd || "");
    setShipmentStatus(selectedRecord.shipment_status || "draft");
    setRemarks(selectedRecord.report_payload?.carrierRemarks || "");
  }, [selectedRecord]);

  async function handleUpdateTracking(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedRecord) return;

    setSaving(true);
    setMessage("");

    try {
      const res = await fetch("/api/erp/shipping/bl-records", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedRecord.id,
          shippingLineName,
          blNumber,
          containerNumber,
          vesselName,
          voyageNumber,
          loadingPort,
          dischargePort,
          eta: eta || null,
          etd: etd || null,
          shipmentStatus,
          remarks
        })
      });

      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json?.error?.message ?? "Failed to update tracking details");
      }

      setMessage("✅ Tracking details updated successfully!");
      
      // Reload list and update selected record state
      const updatedRecord = json.data?.record;
      if (updatedRecord) {
        setSelectedRecord(updatedRecord);
      }
      await loadRecords();
    } catch (err: any) {
      setMessage("❌ " + err.message);
    } finally {
      setSaving(false);
    }
  }

  // Filter options for select list
  const blOptions: SearchSelectOption[] = useMemo(() => {
    return records.map((r) => ({
      value: r.id,
      label: `${r.bl_number} — ${r.shipping_line_name}`,
      keywords: `${r.bl_number} ${r.shipping_line_name} ${r.vessel_name || ""} ${r.container_number || ""}`
    }));
  }, [records]);

  // Aggregate stats
  const stats = useMemo(() => {
    return {
      total: records.length,
      inTransit: records.filter((r) => r.shipment_status === "in_transit").length,
      arrived: records.filter((r) => r.shipment_status === "arrived").length,
      delivered: records.filter((r) => r.shipment_status === "delivered").length
    };
  }, [records]);

  // Export CSV helper
  function exportCsv() {
    const headers = ["B/L Number", "Shipping Line", "Vessel Name", "Voyage No", "Container No", "Loading Port", "Discharge Port", "ETA", "ETD", "Status", "Carrier Remarks"];
    const rows = records.map((r) => [
      r.bl_number,
      r.shipping_line_name,
      r.vessel_name ?? "-",
      r.voyage_number ?? "-",
      r.container_number ?? "-",
      r.loading_port ?? "-",
      r.discharge_port ?? "-",
      r.eta ?? "-",
      r.etd ?? "-",
      r.shipment_status,
      r.report_payload?.carrierRemarks ?? "-"
    ]);

    const csvContent = [headers.join(","), ...rows.map((row) => row.map(c => `"${c.replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `shipment_tracking_report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="mx-auto max-w-[1680px] space-y-4 text-slate-100 p-3">
      
      {/* Header bar */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between border-b border-slate-800 pb-4 gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.35em] text-cyan-400">{eyebrow}</p>
          <h1 className="text-3xl font-black tracking-tight text-white mt-1">{title}</h1>
          <p className="text-xs text-slate-400 mt-1">{description}</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void loadRecords(query);
              }}
              placeholder="Search B/L, vessel, container..."
              className="w-full bg-slate-950 border border-slate-850 rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-cyan-500 text-white placeholder-slate-600"
            />
          </div>
          <Button
            onClick={() => void loadRecords(query)}
            disabled={loading}
            variant="outline"
            className="border-slate-850 bg-slate-900/60 hover:bg-slate-950 text-white h-9 px-3"
          >
            <RefreshCcw className={cn("h-4 w-4", loading ? "animate-spin" : "")} />
          </Button>
          {activeStage === "report" && (
            <>
              <Button
                onClick={() => window.print()}
                variant="outline"
                className="border-slate-850 bg-slate-900/60 hover:bg-slate-950 text-white h-9"
              >
                <Printer className="h-4 w-4 mr-2" /> Print
              </Button>
              <Button
                onClick={exportCsv}
                disabled={records.length === 0}
                variant="outline"
                className="border-slate-850 bg-slate-900/60 hover:bg-slate-950 text-white h-9"
              >
                <Download className="h-4 w-4 mr-2" /> Export
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Aggregate metrics grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-850 flex items-center space-x-3.5">
          <FileText className="h-8 w-8 text-cyan-400" />
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Shipments</span>
            <span className="text-lg font-black text-white">{stats.total}</span>
          </div>
        </div>
        <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-850 flex items-center space-x-3.5">
          <Truck className="h-8 w-8 text-blue-400" />
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-500 block">In Transit</span>
            <span className="text-lg font-black text-white">{stats.inTransit}</span>
          </div>
        </div>
        <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-850 flex items-center space-x-3.5">
          <Clock className="h-8 w-8 text-amber-400" />
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Arrived at Port</span>
            <span className="text-lg font-black text-white">{stats.arrived}</span>
          </div>
        </div>
        <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-850 flex items-center space-x-3.5">
          <CheckCircle className="h-8 w-8 text-emerald-400" />
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Delivered</span>
            <span className="text-lg font-black text-white">{stats.delivered}</span>
          </div>
        </div>
      </div>

      {activeStage === "shipment" ? (
        /* STAGE: SHIPMENT DETAILS INPUT */
        <div className="grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
          
          {/* Left panel: B/L selection list */}
          <Card className="bg-slate-900/40 border-slate-850">
            <CardHeader className="border-b border-slate-850/80 py-3.5">
              <CardTitle className="text-sm font-black uppercase text-cyan-400 flex items-center gap-2">
                <Ship className="h-4 w-4" /> Select Shipment B/L
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">Choose a Bill of Lading record to input details.</CardDescription>
            </CardHeader>
            <CardContent className="p-3 space-y-4">
              <SearchSelect
                label="Search B/L Registry"
                value={selectedRecord?.id || ""}
                placeholder="Search B/L number..."
                options={blOptions}
                onValueChange={(val) => {
                  const matched = records.find((r) => r.id === val);
                  setSelectedRecord(matched || null);
                }}
              />

              <div className="border-t border-slate-850/60 pt-3">
                <span className="text-[10px] font-bold text-slate-450 uppercase block mb-2">Available Shipments</span>
                <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-1">
                  {records.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setSelectedRecord(r)}
                      className={cn(
                        "w-full text-left p-2.5 rounded-xl border text-xs transition-all block",
                        selectedRecord?.id === r.id
                          ? "bg-cyan-950/40 border-cyan-700 text-white font-bold"
                          : "bg-slate-950/20 border-slate-850 text-slate-400 hover:border-slate-800 hover:text-slate-350"
                      )}
                    >
                      <div className="flex justify-between">
                        <span className="font-mono text-white">{r.bl_number}</span>
                        <span className="text-[10px] font-semibold text-slate-450 uppercase">{r.shipment_status}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1 truncate">
                        Line: {r.shipping_line_name} {r.vessel_name ? `• ${r.vessel_name}` : ""}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Right panel: Tracking inputs */}
          <Card className="bg-slate-900/40 border-slate-850">
            <CardHeader className="border-b border-slate-850/80 py-3.5">
              <CardTitle className="text-sm font-black uppercase text-cyan-400 flex items-center gap-2">
                <Edit3 className="h-4 w-4" /> Shipment Details & Tracking Matrix
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              {selectedRecord ? (
                <form onSubmit={handleUpdateTracking} className="space-y-6">
                  {message && (
                    <div className={cn(
                      "px-4 py-3 rounded-xl text-sm border font-medium",
                      message.startsWith("✅")
                        ? "bg-emerald-950/60 border-emerald-900 text-emerald-300"
                        : "bg-red-950/60 border-red-900 text-red-300"
                    )}>
                      {message}
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-slate-300">Shipping Line Name</Label>
                      <Input
                        value={shippingLineName}
                        onChange={(e) => setShippingLineName(e.target.value)}
                        className="bg-slate-950 border-slate-850 text-white mt-1.5 h-10"
                      />
                    </div>
                    <div>
                      <Label className="text-slate-300">Bill of Lading (B/L) Number</Label>
                      <Input
                        value={blNumber}
                        onChange={(e) => setBlNumber(e.target.value)}
                        className="bg-slate-950 border-slate-850 text-white mt-1.5 h-10 font-mono font-bold"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label className="text-slate-300">Vessel Name</Label>
                      <Input
                        value={vesselName}
                        onChange={(e) => setVesselName(e.target.value)}
                        placeholder="e.g. MSC DUBAI"
                        className="bg-slate-950 border-slate-850 text-white mt-1.5 h-10"
                      />
                    </div>
                    <div>
                      <Label className="text-slate-300">Voyage Number</Label>
                      <Input
                        value={voyageNumber}
                        onChange={(e) => setVoyageNumber(e.target.value)}
                        placeholder="e.g. V-7890"
                        className="bg-slate-950 border-slate-850 text-white mt-1.5 h-10"
                      />
                    </div>
                    <div>
                      <Label className="text-slate-300">Container Number</Label>
                      <Input
                        value={containerNumber}
                        onChange={(e) => setContainerNumber(e.target.value)}
                        placeholder="e.g. MSCO-4455"
                        className="bg-slate-950 border-slate-850 text-white mt-1.5 h-10 font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-slate-300 flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-cyan-400" /> Loading Port</Label>
                      <Input
                        value={loadingPort}
                        onChange={(e) => setLoadingPort(e.target.value)}
                        placeholder="e.g. Karachi Port (PK)"
                        className="bg-slate-950 border-slate-850 text-white mt-1.5 h-10"
                      />
                    </div>
                    <div>
                      <Label className="text-slate-300 flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-amber-400" /> Discharge Port</Label>
                      <Input
                        value={dischargePort}
                        onChange={(e) => setDischargePort(e.target.value)}
                        placeholder="e.g. Jebel Ali Port (AE)"
                        className="bg-slate-950 border-slate-850 text-white mt-1.5 h-10"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label className="text-slate-300 flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5 text-cyan-450" /> ETD Date</Label>
                      <Input
                        type="date"
                        value={etd}
                        onChange={(e) => setEtd(e.target.value)}
                        className="bg-slate-950 border-slate-850 text-white mt-1.5 h-10"
                      />
                    </div>
                    <div>
                      <Label className="text-slate-300 flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5 text-amber-450" /> ETA Date</Label>
                      <Input
                        type="date"
                        value={eta}
                        onChange={(e) => setEta(e.target.value)}
                        className="bg-slate-950 border-slate-850 text-white mt-1.5 h-10"
                      />
                    </div>
                    <div>
                      <Label className="text-slate-300 flex items-center gap-1.5"><Anchor className="h-3.5 w-3.5 text-indigo-400" /> Shipment Status</Label>
                      <select
                        value={shipmentStatus}
                        onChange={(e) => setShipmentStatus(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2.5 mt-1.5 h-10 text-white text-sm focus:outline-none focus:border-cyan-500"
                      >
                        {shipmentStatuses.map((st) => (
                          <option key={st.value} value={st.value}>{st.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <Label className="text-slate-300">Carrier Remarks / Transit Info</Label>
                    <textarea
                      rows={3}
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      placeholder="Enter carrier remarks, transshipment details, container loading notes..."
                      className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2 text-white text-sm placeholder-slate-650 mt-1.5 focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div className="flex justify-end pt-4 border-t border-slate-850/60">
                    <Button
                      type="submit"
                      disabled={saving}
                      className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold px-8 h-11 rounded-xl shadow-lg shadow-cyan-950 transition-all"
                    >
                      {saving ? "Saving Tracking Details..." : "Update Tracking Matrix"}
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="text-center py-20 text-slate-500 font-medium">
                  Select a Shipment B/L record from the left panel to update its tracking stages.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        /* STAGE: SHIPMENT DETAILS REPORT */
        <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/20">
          <table className="min-w-full text-sm text-left text-slate-300">
            <thead className="bg-slate-950 text-slate-450 uppercase text-xs font-semibold">
              <tr>
                <th className="px-6 py-4">B/L Number</th>
                <th className="px-6 py-4">Shipping Line</th>
                <th className="px-6 py-4">Vessel / Voyage</th>
                <th className="px-6 py-4">Container No</th>
                <th className="px-6 py-4">Loading Port</th>
                <th className="px-6 py-4">Discharge Port</th>
                <th className="px-6 py-4">ETD</th>
                <th className="px-6 py-4">ETA</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850">
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-slate-400 font-medium">Loading shipment report...</td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-slate-500">No shipment tracking records found.</td>
                </tr>
              ) : (
                records.map((r) => {
                  const statusObj = shipmentStatuses.find(st => st.value === r.shipment_status);
                  return (
                    <tr key={r.id} className="hover:bg-slate-900/30">
                      <td className="px-6 py-4 font-mono font-bold text-white">{r.bl_number}</td>
                      <td className="px-6 py-4 text-slate-200">{r.shipping_line_name}</td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-300">{r.vessel_name ?? "-"}</div>
                        <div className="text-xs text-slate-500">{r.voyage_number ? `Voyage: ${r.voyage_number}` : ""}</div>
                      </td>
                      <td className="px-6 py-4 font-mono text-slate-350">{r.container_number ?? "-"}</td>
                      <td className="px-6 py-4 text-slate-400">{r.loading_port ?? "-"}</td>
                      <td className="px-6 py-4 text-slate-400">{r.discharge_port ?? "-"}</td>
                      <td className="px-6 py-4 text-slate-400">{r.etd ?? "-"}</td>
                      <td className="px-6 py-4 text-slate-400">{r.eta ?? "-"}</td>
                      <td className="px-6 py-4">
                        <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-bold border", statusObj?.color)}>
                          {statusObj?.label ?? r.shipment_status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-450 max-w-xs truncate" title={r.report_payload?.carrierRemarks || ""}>
                        {r.report_payload?.carrierRemarks || "-"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
}
