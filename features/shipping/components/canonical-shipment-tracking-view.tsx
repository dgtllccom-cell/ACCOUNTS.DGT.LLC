"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  Search,
  Ship,
  Truck,
  Train,
  Plane,
  Anchor,
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  CircleDot,
  ArrowRight,
  ArrowRightLeft,
  Boxes,
  Plus,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  FileText,
  AlertCircle,
  Building2,
  Layers,
  History,
  Timer
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";
import {
  TRACKING_EVENT_CODES,
  TRACKING_EVENT_LABELS,
  type TrackingEventCode,
  type CanonicalTrackingPayload
} from "@/lib/types/shipment-tracking";

interface CanonicalShipmentTrackingViewProps {
  domain: "business" | "shipping" | "both";
  initialShipmentId?: string | null;
  title?: string;
  description?: string;
}

export function CanonicalShipmentTrackingView({
  domain,
  initialShipmentId,
  title,
  description,
}: CanonicalShipmentTrackingViewProps) {
  const lang = useActiveLanguage();
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedShipmentId, setSelectedShipmentId] = useState<string | null>(initialShipmentId || null);
  const [trackingData, setTrackingData] = useState<CanonicalTrackingPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New Event Modal
  const [isAddEventOpen, setIsAddEventOpen] = useState(false);
  const [newEventCode, setNewEventCode] = useState<TrackingEventCode>("vessel_departed");
  const [newLocationName, setNewLocationName] = useState("");
  const [newVesselName, setNewVesselName] = useState("");
  const [newVoyageNumber, setNewVoyageNumber] = useState("");
  const [newContainerNumber, setNewContainerNumber] = useState("");
  const [newEta, setNewEta] = useState("");
  const [newRemarks, setNewRemarks] = useState("");
  const [isSavingEvent, setIsSavingEvent] = useState(false);

  // Perform search
  const handleSearch = useCallback(async (q: string) => {
    setIsSearching(true);
    try {
      const res = await fetch(`/api/erp/tracking/search?q=${encodeURIComponent(q)}&domain=${domain}&limit=30`);
      const json = await res.json();
      if (json.ok) {
        setSearchResults(json.data.results || []);
      }
    } catch (e: any) {
      console.error(e);
    } finally {
      setIsSearching(false);
    }
  }, [domain]);

  // Load tracking details
  const loadTrackingDetails = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/erp/tracking/${encodeURIComponent(id)}?domain=${domain}`);
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json?.error?.message || "Failed to load tracking data");
      }
      setTrackingData(json.data);
      // Pre-fill modal state
      if (json.data.kpis) {
        setNewVesselName(json.data.kpis.vesselName !== "—" ? json.data.kpis.vesselName : "");
        setNewVoyageNumber(json.data.kpis.voyageNumber !== "—" ? json.data.kpis.voyageNumber : "");
        setNewContainerNumber(json.data.kpis.containerNumber !== "—" ? json.data.kpis.containerNumber : "");
      }
    } catch (e: any) {
      setError(e.message || "Unable to load shipment details");
    } finally {
      setLoading(false);
    }
  }, [domain]);

  // Initial load
  useEffect(() => {
    handleSearch("");
  }, [handleSearch]);

  useEffect(() => {
    if (selectedShipmentId) {
      loadTrackingDetails(selectedShipmentId);
    }
  }, [selectedShipmentId, loadTrackingDetails]);

  // Handle Event Save
  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShipmentId) return;
    setIsSavingEvent(true);
    try {
      const res = await fetch(`/api/erp/tracking/${selectedShipmentId}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventCode: newEventCode,
          locationName: newLocationName || undefined,
          vesselName: newVesselName || undefined,
          voyageNumber: newVoyageNumber || undefined,
          containerNumber: newContainerNumber || undefined,
          eta: newEta || undefined,
          remarks: newRemarks || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json?.error?.message || "Failed to record event");
      }
      setIsAddEventOpen(false);
      setNewLocationName("");
      setNewRemarks("");
      await loadTrackingDetails(selectedShipmentId);
    } catch (err: any) {
      alert(err.message || "Failed to record tracking event");
    } finally {
      setIsSavingEvent(false);
    }
  };

  const modeIcon = (mode: string) => {
    switch (mode) {
      case "by_road":
        return <Truck className="h-4 w-4" />;
      case "by_rail":
        return <Train className="h-4 w-4" />;
      case "by_air":
        return <Plane className="h-4 w-4" />;
      default:
        return <Ship className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card border border-border/70 p-6 rounded-2xl shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-primary mb-1">
            <Anchor className="h-4 w-4" />
            <span>{domain === "business" ? "Business / Trading Cargo Tracking" : "Canonical Shipment & Container Tracking"}</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">
            {title || "Live Shipment & Container Auto-Tracker"}
          </h1>
          <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
            {description || "Unified multi-modal tracking: Search by Shipment No, BL, Container, Vessel, Voyage, Customer or Shipping Line."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {selectedShipmentId && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadTrackingDetails(selectedShipmentId)}
              className="gap-1.5 text-xs font-bold rounded-xl"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
              <span>Refresh</span>
            </Button>
          )}

          {selectedShipmentId && (
            <Button
              size="sm"
              onClick={() => setIsAddEventOpen(true)}
              className="gap-1.5 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl shadow-sm"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Journey Event</span>
            </Button>
          )}
        </div>
      </div>

      {/* Main Layout: Search / List on Left, Canonical Tracker on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Search & Registry (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <Card className="rounded-2xl border-border/70 shadow-sm overflow-hidden">
            <CardHeader className="bg-muted/40 border-b border-border/60 p-4">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                <span>Shipment Registry</span>
                <span className="text-[10px] text-primary font-mono font-bold">{searchResults.length} Records</span>
              </CardTitle>
              {/* Universal Search Input */}
              <div className="relative mt-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    handleSearch(e.target.value);
                  }}
                  placeholder="Search Shipment, BL, Container, Vessel, Customer..."
                  className="pl-9 text-xs h-9 bg-background rounded-xl border-border/80"
                />
              </div>
            </CardHeader>

            <CardContent className="p-2 space-y-1.5 max-h-[640px] overflow-y-auto">
              {isSearching ? (
                <div className="p-6 text-center text-xs text-muted-foreground font-medium">Searching shipments...</div>
              ) : searchResults.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">No matching shipments found.</div>
              ) : (
                searchResults.map((item) => {
                  const isSelected = selectedShipmentId === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedShipmentId(item.id)}
                      className={cn(
                        "w-full text-left p-3 rounded-xl border text-xs transition-all relative overflow-hidden",
                        isSelected
                          ? "bg-primary/10 border-primary/50 text-foreground font-semibold shadow-xs"
                          : "bg-card hover:bg-muted/50 border-border/60 text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {isSelected && <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />}
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-black text-foreground text-xs">{item.orderNo}</span>
                        <Badge variant="outline" className="text-[9px] uppercase font-bold px-1.5 py-0">
                          {item.currentStage?.replace(/_/g, " ") || "BOOKING"}
                        </Badge>
                      </div>

                      <div className="mt-1 text-[11px] text-foreground font-medium truncate">
                        {item.customerName}
                      </div>

                      <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                        <span className="truncate max-w-[140px]">Container: {item.containerNumber}</span>
                        <span>BL: {item.blNumber}</span>
                      </div>

                      {(item.vesselName !== "—" || item.voyageNumber !== "—") && (
                        <div className="mt-1 text-[9.5px] text-primary/80 truncate flex items-center gap-1">
                          <Ship className="h-3 w-3 inline shrink-0" />
                          <span>{item.vesselName} {item.voyageNumber !== "—" ? `(${item.voyageNumber})` : ""}</span>
                        </div>
                      )}
                    </button>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Complete Canonical Tracking Experience (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {loading ? (
            <Card className="p-12 text-center rounded-2xl border-border/70 text-muted-foreground">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
              <p className="text-xs font-semibold">Loading shipment journey...</p>
            </Card>
          ) : error ? (
            <Card className="p-8 text-center rounded-2xl border-destructive/40 bg-destructive/5 text-destructive text-xs">
              <AlertCircle className="h-6 w-6 mx-auto mb-2" />
              <p className="font-bold">{error}</p>
            </Card>
          ) : trackingData ? (
            <>
              {/* Top KPI Status Matrix */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-card border border-border/70 p-3.5 rounded-2xl shadow-2xs">
                  <span className="text-[9.5px] font-bold uppercase tracking-wider text-muted-foreground block">Shipment Status</span>
                  <div className="flex items-center gap-1.5 mt-1">
                    <CircleDot className="h-3.5 w-3.5 text-emerald-500 animate-pulse" />
                    <span className="text-sm font-black text-foreground uppercase truncate">
                      {trackingData.kpis.currentStatus}
                    </span>
                  </div>
                </div>

                <div className="bg-card border border-border/70 p-3.5 rounded-2xl shadow-2xs">
                  <span className="text-[9.5px] font-bold uppercase tracking-wider text-muted-foreground block">Current Location</span>
                  <div className="flex items-center gap-1 mt-1 text-sm font-black text-foreground truncate">
                    <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="truncate">{trackingData.kpis.currentLocation}</span>
                  </div>
                </div>

                <div className="bg-card border border-border/70 p-3.5 rounded-2xl shadow-2xs">
                  <span className="text-[9.5px] font-bold uppercase tracking-wider text-muted-foreground block">Container Number</span>
                  <span className="text-sm font-black font-mono text-primary mt-1 block truncate">
                    {trackingData.kpis.containerNumber}
                  </span>
                </div>

                <div className="bg-card border border-border/70 p-3.5 rounded-2xl shadow-2xs">
                  <span className="text-[9.5px] font-bold uppercase tracking-wider text-muted-foreground block">Estimated Arrival (ETA)</span>
                  <div className="flex items-center gap-1 mt-1 text-sm font-black text-foreground font-mono truncate">
                    <Calendar className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                    <span>{trackingData.kpis.eta ? new Date(trackingData.kpis.eta).toLocaleDateString() : "Pending"}</span>
                  </div>
                </div>
              </div>

              {/* Comprehensive Vessel & Route Details Card */}
              <Card className="rounded-2xl border-border/70 shadow-sm overflow-hidden">
                <CardHeader className="bg-muted/30 border-b border-border/60 px-6 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <CardTitle className="text-base font-black text-foreground flex items-center gap-2">
                        <Ship className="h-5 w-5 text-primary" />
                        <span>{trackingData.shipment.order_no}</span>
                        <span className="text-xs font-normal text-muted-foreground">• {trackingData.shipment.customer_name}</span>
                      </CardTitle>
                      <CardDescription className="text-xs text-muted-foreground mt-0.5">
                        Shipping Line: <strong className="text-foreground">{trackingData.kpis.shippingLine}</strong> • B/L: <strong className="text-foreground font-mono">{trackingData.kpis.blNumber}</strong>
                      </CardDescription>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="font-mono text-xs px-2.5 py-1 font-bold">
                        Leg {trackingData.kpis.activeLegNo} of {trackingData.kpis.totalLegs}
                      </Badge>
                      {trackingData.handover && (
                        <Badge variant="outline" className="text-xs border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 font-bold">
                          Business Handover #{trackingData.handover.handover_no}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-6 space-y-6">
                  {/* Route Bar (POL -> POD) */}
                  <div className="p-4 rounded-xl border border-border/80 bg-muted/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Port of Loading (POL)</span>
                      <div className="text-sm font-black text-foreground flex items-center gap-1.5">
                        <Anchor className="h-4 w-4 text-primary" />
                        <span>{trackingData.kpis.pol}</span>
                      </div>
                      {trackingData.kpis.etd && (
                        <span className="text-[11px] text-muted-foreground font-mono block">
                          ETD: {new Date(trackingData.kpis.etd).toLocaleDateString()}
                        </span>
                      )}
                    </div>

                    <div className="hidden sm:flex flex-col items-center justify-center px-4">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase mb-1">
                        {trackingData.kpis.vesselName !== "—" ? `${trackingData.kpis.vesselName} (${trackingData.kpis.voyageNumber})` : "Direct Transit"}
                      </span>
                      <div className="flex items-center gap-2 text-primary">
                        <div className="h-[2px] w-16 bg-primary/40" />
                        <Ship className="h-4 w-4" />
                        <div className="h-[2px] w-16 bg-primary/40" />
                      </div>
                    </div>

                    <div className="space-y-1 sm:text-right">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Port of Discharge (POD)</span>
                      <div className="text-sm font-black text-foreground flex items-center sm:justify-end gap-1.5">
                        <MapPin className="h-4 w-4 text-emerald-500" />
                        <span>{trackingData.kpis.pod}</span>
                      </div>
                      {trackingData.kpis.eta && (
                        <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono font-semibold block">
                          ETA: {new Date(trackingData.kpis.eta).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Multi-Leg Segment Visualizer (Road -> Sea -> Rail -> Road) */}
                  <div className="space-y-2.5">
                    <h3 className="text-xs font-black uppercase tracking-wider text-foreground flex items-center gap-1.5">
                      <Layers className="h-4 w-4 text-primary" />
                      <span>Multi-Leg Movement Sequence ({trackingData.legs.length} Transport Legs)</span>
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                      {trackingData.legs.map((leg, idx) => {
                        const isActive = leg.id === trackingData.activeLeg?.id;
                        return (
                          <div
                            key={leg.id || idx}
                            className={cn(
                              "p-3.5 rounded-xl border transition-all relative",
                              isActive
                                ? "border-primary bg-primary/5 shadow-xs"
                                : "border-border/70 bg-card"
                            )}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                {modeIcon(leg.transport_mode)}
                                <span>Leg #{leg.leg_no}: {leg.transport_mode?.replace("by_", "").toUpperCase()}</span>
                              </span>
                              {isActive ? (
                                <Badge className="bg-primary text-primary-foreground text-[9px] px-1.5 py-0 font-bold uppercase">
                                  Active
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[9px] uppercase px-1.5 py-0">
                                  {leg.status || "Pending"}
                                </Badge>
                              )}
                            </div>

                            <div className="text-xs font-bold text-foreground">
                              {leg.from_location_text || leg.from_country_name || "Origin"} → {leg.to_location_text || leg.to_country_name || "Destination"}
                            </div>

                            <div className="mt-2 text-[10.5px] text-muted-foreground space-y-0.5 font-mono">
                              {leg.transport_mode === "by_road" ? (
                                <>
                                  <div>Truck: <strong className="text-foreground">{leg.truck_number || "To be assigned"}</strong></div>
                                  <div>Driver: <span>{leg.truck_driver_name || "—"}</span></div>
                                </>
                              ) : (
                                <>
                                  <div>Vessel: <strong className="text-foreground">{leg.vessel_name || "Pending"}</strong></div>
                                  <div>Voyage: <span>{leg.voyage_number || "—"}</span></div>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 12-Milestone Event Timeline */}
                  <div className="space-y-4 pt-2">
                    <div className="flex items-center justify-between border-b border-border/60 pb-2">
                      <h3 className="text-xs font-black uppercase tracking-wider text-foreground flex items-center gap-2">
                        <History className="h-4 w-4 text-primary" />
                        <span>Complete Journey Event Timeline (Milestones & Vessel Changes)</span>
                      </h3>
                      <span className="text-[10px] font-mono text-muted-foreground">{trackingData.events.length} Events Recorded</span>
                    </div>

                    {trackingData.events.length === 0 ? (
                      <div className="p-8 text-center border border-dashed rounded-xl bg-muted/20 text-xs text-muted-foreground">
                        No events logged yet. Click &quot;Add Journey Event&quot; to start recording shipment progress.
                      </div>
                    ) : (
                      <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border/80">
                        {trackingData.events.map((ev, idx) => {
                          const isLatest = idx === 0;
                          return (
                            <div key={ev.id || idx} className="relative group">
                              <div
                                className={cn(
                                  "absolute -left-6 top-1 h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all",
                                  isLatest
                                    ? "bg-primary border-primary text-primary-foreground shadow-xs shadow-primary/30"
                                    : "bg-background border-muted-foreground/50 text-muted-foreground"
                                )}
                              >
                                {isLatest ? <CheckCircle2 className="h-3 w-3" /> : <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />}
                              </div>

                              <div className="bg-card border border-border/70 p-3.5 rounded-xl shadow-2xs space-y-1.5">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-black text-foreground">{ev.event_name}</span>
                                    <Badge variant="outline" className="text-[9px] uppercase font-mono px-1.5 py-0">
                                      {ev.status}
                                    </Badge>
                                    {ev.vessel_name && (
                                      <span className="text-[10px] font-semibold text-primary flex items-center gap-1">
                                        <Ship className="h-3 w-3 inline" />
                                        {ev.vessel_name} {ev.voyage_number ? `(${ev.voyage_number})` : ""}
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-1 text-[10.5px] font-mono text-muted-foreground">
                                    <Clock className="h-3 w-3" />
                                    <span>{new Date(ev.event_time).toLocaleString()}</span>
                                  </div>
                                </div>

                                <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1">
                                  {ev.location_name && (
                                    <span className="flex items-center gap-1 text-foreground font-medium">
                                      <MapPin className="h-3 w-3 text-primary shrink-0" />
                                      {ev.location_name}
                                    </span>
                                  )}
                                  {ev.container_number && (
                                    <span>Container: <strong className="font-mono text-foreground">{ev.container_number}</strong></span>
                                  )}
                                  {ev.eta && (
                                    <span className="text-amber-600 dark:text-amber-400 font-medium">
                                      Revised ETA: {new Date(ev.eta).toLocaleDateString()}
                                    </span>
                                  )}
                                </div>

                                {ev.remarks && (
                                  <p className="text-[11px] text-foreground/80 bg-muted/40 p-2 rounded-lg mt-1 italic">
                                    &quot;{ev.remarks}&quot;
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="p-16 text-center rounded-2xl border-border/70">
              <Ship className="h-10 w-10 mx-auto mb-3 text-primary/40" />
              <h3 className="text-sm font-bold text-foreground">Select a Shipment to Track</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                Search or select any shipment or customer order from the left registry to see its live container location, vessel route, and full 12-milestone history.
              </p>
            </Card>
          )}
        </div>
      </div>

      {/* Add Journey Event / Milestone Modal */}
      <Dialog open={isAddEventOpen} onOpenChange={setIsAddEventOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" />
              <span>Record Journey Event & Milestone</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveEvent} className="space-y-4 text-xs">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Milestone Event *</Label>
              <select
                value={newEventCode}
                onChange={(e) => setNewEventCode(e.target.value as TrackingEventCode)}
                className="w-full h-9 rounded-xl border border-border bg-background px-3 font-semibold text-xs"
              >
                {TRACKING_EVENT_CODES.map((code) => (
                  <option key={code} value={code}>
                    {TRACKING_EVENT_LABELS[code]}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Location / Current Port</Label>
              <Input
                value={newLocationName}
                onChange={(e) => setNewLocationName(e.target.value)}
                placeholder="e.g. Jebel Ali Port, Karachi Port, or Chaman Border"
                className="h-9 text-xs rounded-xl"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Vessel Name</Label>
                <Input
                  value={newVesselName}
                  onChange={(e) => setNewVesselName(e.target.value)}
                  placeholder="e.g. MSC LAUREN"
                  className="h-9 text-xs rounded-xl"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Voyage Number</Label>
                <Input
                  value={newVoyageNumber}
                  onChange={(e) => setNewVoyageNumber(e.target.value)}
                  placeholder="e.g. V-2026A"
                  className="h-9 text-xs rounded-xl"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Container Number</Label>
                <Input
                  value={newContainerNumber}
                  onChange={(e) => setNewContainerNumber(e.target.value)}
                  placeholder="e.g. MSCU-7890123"
                  className="h-9 text-xs font-mono rounded-xl"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Revised ETA</Label>
                <Input
                  type="date"
                  value={newEta}
                  onChange={(e) => setNewEta(e.target.value)}
                  className="h-9 text-xs rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Event Remarks / Operational Notes</Label>
              <Input
                value={newRemarks}
                onChange={(e) => setNewRemarks(e.target.value)}
                placeholder="Notes on departure, transshipment, customs clearance or inspection..."
                className="h-9 text-xs rounded-xl"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsAddEventOpen(false)}
                className="rounded-xl text-xs font-bold"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSavingEvent}
                size="sm"
                className="rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {isSavingEvent ? "Saving Event..." : "Record Milestone"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
