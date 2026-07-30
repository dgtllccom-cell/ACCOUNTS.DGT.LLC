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
  { value: "draft", label: "Draft", color: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-900/60 dark:text-slate-400 dark:border-slate-800" },
  { value: "booked", label: "Booked", color: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800/60" },
  { value: "in_transit", label: "In Transit", color: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800/60" },
  { value: "arrived", label: "Arrived", color: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/60" },
  { value: "cleared", label: "Cleared", color: "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/60 dark:text-cyan-300 dark:border-cyan-800/60" },
  { value: "delivered", label: "Delivered", color: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60" },
  { value: "cancelled", label: "Cancelled", color: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800/60" }
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
    <div className="mx-auto max-w-[1680px] space-y-6 text-foreground p-4 lg:p-6">
      
      {/* Header bar */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between border-b border-border/60 pb-5 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-cyan-500 animate-pulse" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-600 dark:text-cyan-400">{eyebrow}</p>
          </div>
          <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-foreground mt-1.5">{title}</h1>
          <p className="text-xs text-muted-foreground mt-1 max-w-2xl">{description}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative w-64 md:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void loadRecords(query);
              }}
              placeholder="Search B/L, vessel, container..."
              className="w-full bg-card/80 border border-border/80 rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 text-foreground placeholder:text-muted-foreground shadow-sm transition-all"
            />
          </div>
          <Button
            onClick={() => void loadRecords(query)}
            disabled={loading}
            variant="outline"
            className="border-border/80 bg-card hover:bg-muted text-foreground h-9 px-3 rounded-xl shadow-sm"
          >
            <RefreshCcw className={cn("h-4 w-4", loading ? "animate-spin text-cyan-600" : "")} />
          </Button>
          {activeStage === "report" && (
            <>
              <Button
                onClick={() => window.print()}
                variant="outline"
                className="border-border/80 bg-card hover:bg-muted text-foreground h-9 rounded-xl shadow-sm"
              >
                <Printer className="h-4 w-4 mr-2 text-muted-foreground" /> Print
              </Button>
              <Button
                onClick={exportCsv}
                disabled={records.length === 0}
                variant="outline"
                className="border-border/80 bg-card hover:bg-muted text-foreground h-9 rounded-xl shadow-sm"
              >
                <Download className="h-4 w-4 mr-2 text-muted-foreground" /> Export
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Aggregate metrics grid - Sleek cards with gradient top border */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="relative overflow-hidden bg-card text-card-foreground p-4 rounded-2xl border border-border/60 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 to-blue-500" />
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Total Shipments</span>
              <span className="text-2xl font-black text-foreground mt-1 block">{stats.total}</span>
            </div>
            <div className="h-10 w-10 rounded-xl bg-cyan-500/10 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
              <FileText className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden bg-card text-card-foreground p-4 rounded-2xl border border-border/60 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-500" />
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">In Transit</span>
              <span className="text-2xl font-black text-foreground mt-1 block">{stats.inTransit}</span>
            </div>
            <div className="h-10 w-10 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Truck className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden bg-card text-card-foreground p-4 rounded-2xl border border-border/60 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-orange-500" />
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Arrived at Port</span>
              <span className="text-2xl font-black text-foreground mt-1 block">{stats.arrived}</span>
            </div>
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Clock className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden bg-card text-card-foreground p-4 rounded-2xl border border-border/60 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Delivered</span>
              <span className="text-2xl font-black text-foreground mt-1 block">{stats.delivered}</span>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <CheckCircle className="h-5 w-5" />
            </div>
          </div>
        </div>
      </div>

      {activeStage === "shipment" ? (
        /* STAGE: SHIPMENT DETAILS INPUT */
        <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          
          {/* Left panel: B/L selection list */}
          <Card className="bg-card text-card-foreground border-border/60 shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="border-b border-border/60 bg-muted/30 px-5 py-4">
              <CardTitle className="text-sm font-bold tracking-tight text-foreground flex items-center gap-2">
                <Ship className="h-4 w-4 text-cyan-600 dark:text-cyan-400" /> Select Shipment B/L
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">Choose a Bill of Lading record to edit tracking matrix.</CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
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

              <div className="pt-2">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Available Registry</span>
                  <span className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400">{records.length} records</span>
                </div>
                <div className="space-y-2 max-h-[440px] overflow-y-auto pr-1">
                  {records.map((r) => {
                    const isSelected = selectedRecord?.id === r.id;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setSelectedRecord(r)}
                        className={cn(
                          "w-full text-left p-3 rounded-xl border text-xs transition-all relative overflow-hidden group",
                          isSelected
                            ? "bg-cyan-500/10 border-cyan-500/40 text-foreground font-semibold shadow-sm"
                            : "bg-card hover:bg-muted/50 border-border/60 text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {isSelected && (
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-cyan-500" />
                        )}
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-foreground text-xs">{r.bl_number}</span>
                          <span className={cn(
                            "px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border",
                            shipmentStatuses.find(st => st.value === r.shipment_status)?.color
                          )}>
                            {r.shipment_status.replace(/_/g, " ")}
                          </span>
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-1.5 flex items-center justify-between">
                          <span className="truncate max-w-[190px]">{r.shipping_line_name}</span>
                          {r.vessel_name && <span className="font-medium text-foreground/80 shrink-0">{r.vessel_name}</span>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Right panel: Tracking inputs form */}
          <Card className="bg-card text-card-foreground border-border/60 shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="border-b border-border/60 bg-muted/30 px-6 py-4 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold tracking-tight text-foreground flex items-center gap-2">
                  <Edit3 className="h-4 w-4 text-cyan-600 dark:text-cyan-400" /> Shipment Details & Tracking Matrix
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground mt-0.5">
                  Update logistics parameters, port schedules, vessel details and carrier notes.
                </CardDescription>
              </div>
              {selectedRecord && (
                <div className="px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-700 dark:text-cyan-300 font-mono text-xs font-bold">
                  B/L: {selectedRecord.bl_number}
                </div>
              )}
            </CardHeader>
            <CardContent className="p-6">
              {selectedRecord ? (
                <form onSubmit={handleUpdateTracking} className="space-y-6">
                  {message && (
                    <div className={cn(
                      "px-4 py-3 rounded-xl text-xs font-semibold border flex items-center gap-2",
                      message.startsWith("✅")
                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                        : "bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-300"
                    )}>
                      {message}
                    </div>
                  )}

                  {/* Section 1: Carrier & Document */}
                  <div className="space-y-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border/40 pb-1">
                      1. Carrier & Identification
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs font-semibold text-foreground">Shipping Line Name</Label>
                        <Input
                          value={shippingLineName}
                          onChange={(e) => setShippingLineName(e.target.value)}
                          placeholder="e.g. MAERSK / MSC / COSCO"
                          className="bg-background border-border/80 text-foreground mt-1.5 h-10 rounded-xl focus:border-cyan-500 text-xs"
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-semibold text-foreground">Bill of Lading (B/L) Number</Label>
                        <Input
                          value={blNumber}
                          onChange={(e) => setBlNumber(e.target.value)}
                          className="bg-background border-border/80 text-foreground mt-1.5 h-10 font-mono font-bold rounded-xl focus:border-cyan-500 text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Vessel & Container */}
                  <div className="space-y-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border/40 pb-1">
                      2. Vessel & Equipment Details
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label className="text-xs font-semibold text-foreground">Vessel Name</Label>
                        <Input
                          value={vesselName}
                          onChange={(e) => setVesselName(e.target.value)}
                          placeholder="e.g. MSC DUBAI"
                          className="bg-background border-border/80 text-foreground mt-1.5 h-10 rounded-xl focus:border-cyan-500 text-xs"
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-semibold text-foreground">Voyage Number</Label>
                        <Input
                          value={voyageNumber}
                          onChange={(e) => setVoyageNumber(e.target.value)}
                          placeholder="e.g. V-7890"
                          className="bg-background border-border/80 text-foreground mt-1.5 h-10 rounded-xl focus:border-cyan-500 text-xs"
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-semibold text-foreground">Container Number</Label>
                        <Input
                          value={containerNumber}
                          onChange={(e) => setContainerNumber(e.target.value)}
                          placeholder="e.g. MSCO-4455"
                          className="bg-background border-border/80 text-foreground mt-1.5 h-10 font-mono rounded-xl focus:border-cyan-500 text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Section 3: Ports & Dates */}
                  <div className="space-y-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border/40 pb-1">
                      3. Route & Schedule Matrix
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" /> Loading Port (POL)
                        </Label>
                        <Input
                          value={loadingPort}
                          onChange={(e) => setLoadingPort(e.target.value)}
                          placeholder="e.g. Karachi Port (PK)"
                          className="bg-background border-border/80 text-foreground mt-1.5 h-10 rounded-xl focus:border-cyan-500 text-xs"
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" /> Discharge Port (POD)
                        </Label>
                        <Input
                          value={dischargePort}
                          onChange={(e) => setDischargePort(e.target.value)}
                          placeholder="e.g. Jebel Ali Port (AE)"
                          className="bg-background border-border/80 text-foreground mt-1.5 h-10 rounded-xl focus:border-cyan-500 text-xs"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                      <div>
                        <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" /> ETD Date
                        </Label>
                        <Input
                          type="date"
                          value={etd}
                          onChange={(e) => setEtd(e.target.value)}
                          className="bg-background border-border/80 text-foreground mt-1.5 h-10 rounded-xl focus:border-cyan-500 text-xs"
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" /> ETA Date
                        </Label>
                        <Input
                          type="date"
                          value={eta}
                          onChange={(e) => setEta(e.target.value)}
                          className="bg-background border-border/80 text-foreground mt-1.5 h-10 rounded-xl focus:border-cyan-500 text-xs"
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                          <Anchor className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" /> Shipment Status
                        </Label>
                        <select
                          value={shipmentStatus}
                          onChange={(e) => setShipmentStatus(e.target.value)}
                          className="w-full bg-background border border-border/80 rounded-xl px-3 py-2.5 mt-1.5 h-10 text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 font-semibold"
                        >
                          {shipmentStatuses.map((st) => (
                            <option key={st.value} value={st.value}>{st.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Section 4: Carrier Remarks */}
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-foreground">Carrier Remarks & Transshipment Info</Label>
                    <textarea
                      rows={3}
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      placeholder="Enter carrier remarks, transshipment details, container loading notes..."
                      className="w-full bg-background border border-border/80 rounded-xl px-4 py-2.5 text-foreground text-xs placeholder:text-muted-foreground mt-1 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/60">
                    <Button
                      type="submit"
                      disabled={saving}
                      className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold px-8 h-11 rounded-xl shadow-md transition-all hover:shadow-lg"
                    >
                      {saving ? "Saving Tracking Details..." : "Update Tracking Matrix"}
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="text-center py-24 px-4">
                  <div className="mx-auto h-12 w-12 rounded-2xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center mb-3">
                    <Ship className="h-6 w-6" />
                  </div>
                  <h3 className="text-sm font-bold text-foreground">No B/L Record Selected</h3>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                    Select a Shipment B/L record from the left panel to edit its tracking stages, dates, and port details.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        /* STAGE: SHIPMENT DETAILS REPORT */
        <Card className="bg-card text-card-foreground border-border/60 shadow-sm rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs text-left text-foreground">
              <thead className="bg-muted/40 text-muted-foreground uppercase text-[10px] font-bold tracking-wider border-b border-border/60">
                <tr>
                  <th className="px-5 py-4">B/L Number</th>
                  <th className="px-5 py-4">Shipping Line</th>
                  <th className="px-5 py-4">Vessel / Voyage</th>
                  <th className="px-5 py-4">Container No</th>
                  <th className="px-5 py-4">Loading Port</th>
                  <th className="px-5 py-4">Discharge Port</th>
                  <th className="px-5 py-4">ETD</th>
                  <th className="px-5 py-4">ETA</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {loading ? (
                  <tr>
                    <td colSpan={10} className="px-6 py-12 text-center text-muted-foreground font-medium">Loading shipment report...</td>
                  </tr>
                ) : records.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-6 py-12 text-center text-muted-foreground">No shipment tracking records found.</td>
                  </tr>
                ) : (
                  records.map((r) => {
                    const statusObj = shipmentStatuses.find(st => st.value === r.shipment_status);
                    return (
                      <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-5 py-3.5 font-mono font-bold text-cyan-600 dark:text-cyan-400">{r.bl_number}</td>
                        <td className="px-5 py-3.5 font-medium text-foreground">{r.shipping_line_name}</td>
                        <td className="px-5 py-3.5">
                          <div className="font-semibold text-foreground">{r.vessel_name ?? "-"}</div>
                          <div className="text-[10px] text-muted-foreground">{r.voyage_number ? `Voyage: ${r.voyage_number}` : ""}</div>
                        </td>
                        <td className="px-5 py-3.5 font-mono text-muted-foreground">{r.container_number ?? "-"}</td>
                        <td className="px-5 py-3.5 text-muted-foreground">{r.loading_port ?? "-"}</td>
                        <td className="px-5 py-3.5 text-muted-foreground">{r.discharge_port ?? "-"}</td>
                        <td className="px-5 py-3.5 text-muted-foreground">{r.etd ?? "-"}</td>
                        <td className="px-5 py-3.5 text-muted-foreground">{r.eta ?? "-"}</td>
                        <td className="px-5 py-3.5">
                          <span className={cn("px-2.5 py-0.5 rounded-full text-[10px] font-bold border", statusObj?.color)}>
                            {statusObj?.label ?? r.shipment_status}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-[11px] text-muted-foreground max-w-xs truncate" title={r.report_payload?.carrierRemarks || ""}>
                          {r.report_payload?.carrierRemarks || "-"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

    </div>
  );
}
