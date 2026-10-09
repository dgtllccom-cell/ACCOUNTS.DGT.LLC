"use client";

/**
 * Shipment & Container Tracking — the ONE tracking workspace behind every tracking menu
 * (Shipping Line → Container & Vessel Tracking, Business cargo tracking, the portal).
 *
 *  - searches Shipment No, BL No, Container No, Vessel, Voyage, Customer and Shipping Line (plus truck / flight / AWB / wagon),
 *    on any one field or on all, ignoring case, spaces and hyphens
 *  - multi-leg journeys: Sea, Road, Air and Train legs, each with its own references, dates and milestones
 *  - status / mode filters, filtered CSV export, A4 print
 *  - five languages + RTL, phone / tablet / desktop layouts
 *
 * Data comes only from the session-protected /api/erp/tracking/* endpoints (country / branch scope + role checks
 * are enforced on the server). Nothing here creates a second shipment, BL, container or history record.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Search, Ship, Truck, Train, Plane, Anchor, MapPin, CircleDot, Boxes, Plus, RefreshCw, ChevronRight, ChevronLeft,
  FileText, AlertCircle, Building2, Layers, X, Eye, Filter, Navigation, Activity, ArrowRight, Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { pl } from "@/lib/reports/print-label";
import { JournalPrintButton } from "@/components/reports/journal-print-button";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import {
  TRACKING_EVENT_CODES,
  TRACKING_EVENT_LABELS,
  type TrackingEventCode,
  type CanonicalTrackingPayload,
} from "@/lib/types/shipment-tracking";

// ── Types ────────────────────────────────────────────────────────────────────
interface TrackingSummary {
  branchUser: { roleKey?: string | null; branchName: string; branchCode: string; countryName: string; cityName: string | null; userName: string; roleLabel: string; isSuperAdmin: boolean };
  shipmentSummary: { totalShipments: number; totalContainers: number; inTransit: number; arrived: number; delivered: number; pending: number };
  movementByMode: { byRoad: number; bySea: number; byAir: number; byRail: number };
  trackingStatus: { bookingConfirmed: number; loadedGateIn: number; vesselDeparted: number; inTransit: number; arrivedAtDestination: number; delivered: number; delayedPending: number };
  canRecord?: boolean;
}

interface TrackingListRow {
  id: string;
  orderNo: string;
  customerName: string;
  currentStage: string;
  blNumber: string;
  containerNumber: string;
  truckNumber: string;
  truckDriverName: string | null;
  shippingLine: string;
  vesselName: string;
  voyageNumber: string;
  vesselVoyage: string;
  flightNumber: string | null;
  airwayBillNo: string | null;
  wagonNumber: string | null;
  from: string;
  to: string;
  transportMode: string;
  legCount: number;
  legModes: string[];
  currentLocation: string;
  eta: string | null;
  etd: string | null;
  legId: string | null;
  legNo: number;
  legStatus: string | null;
  latestEventTime: string | null;
}

interface CanonicalShipmentTrackingViewProps {
  domain: "business" | "shipping" | "both";
  initialShipmentId?: string | null;
  initialStatus?: string;
  initialTab?: "all" | "containers" | "shipments" | "trucks";
  initialQuery?: string;
  title?: string;
  description?: string;
}

const DASH = "—";
const SEARCH_FIELDS = ["all", "shipment", "bl", "container", "vessel", "voyage", "customer", "carrier", "truck", "transport"] as const;
type SearchField = (typeof SEARCH_FIELDS)[number];
const MODES = ["by_sea", "by_road", "by_air", "by_rail"] as const;
const STATUSES = ["booking", "loading", "shipment_bl", "destination_review", "completed", "delayed"] as const;
const PAGE_SIZE = 10;

// ── Pure helpers ─────────────────────────────────────────────────────────────
function modeIcon(mode: string, className = "h-3.5 w-3.5") {
  switch (mode) {
    case "by_road": return <Truck className={className} />;
    case "by_rail": return <Train className={className} />;
    case "by_air": return <Plane className={className} />;
    default: return <Ship className={className} />;
  }
}

function modeBadgeClass(mode: string) {
  switch (mode) {
    case "by_road": return "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30";
    case "by_rail": return "bg-violet-500/15 text-violet-700 dark:text-violet-400 border-violet-500/30";
    case "by_air": return "bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/30";
    default: return "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30";
  }
}

function statusBadgeClass(stage: string) {
  switch (stage) {
    case "completed": return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30";
    case "destination_review": return "bg-teal-500/15 text-teal-700 dark:text-teal-400 border-teal-500/30";
    case "shipment_bl":
    case "customs_clearing":
    case "handover": return "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30";
    case "loading":
    case "truck_assignment":
    case "goods_verification": return "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30";
    case "booking": return "bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-500/30";
    case "delayed": return "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30";
    default: return "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30";
  }
}

// Dates are business data: always the same numerals/format, whatever the UI language.
function formatDate(d: string | null | undefined) {
  if (!d) return DASH;
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? DASH : dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" });
}
function formatDateTime(d: string | null | undefined) {
  if (!d) return DASH;
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? DASH : dt.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

const isReal = (v: unknown) => typeof v === "string" && v.trim() !== "" && v !== DASH;

// ── Main component ───────────────────────────────────────────────────────────
export function CanonicalShipmentTrackingView({
  domain,
  initialShipmentId,
  initialStatus = "all",
  initialTab = "all",
  initialQuery = "",
  title,
  description,
}: CanonicalShipmentTrackingViewProps) {
  const s = useErpScreen("shtrk");

  const modeLabel = (m: string) => s.t(`mode_${m}`, m === "by_rail" ? "Train" : m === "by_road" ? "Road" : m === "by_air" ? "Air" : "Sea");
  const statusLabel = (st: string) => s.t(`st_${st}`, st.replace(/_/g, " "));
  const legStatusLabel = (st: string | null | undefined) => (st ? s.t(`legst_${st}`, st.replace(/_/g, " ")) : s.t("legst_pending", "Pending"));
  const eventLabel = (code: string, fallback: string) => s.t(`ev_${code}`, fallback);

  // summary
  const [summary, setSummary] = useState<TrackingSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  // list
  const [listRows, setListRows] = useState<TrackingListRow[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // search + filters
  const [searchQuery, setSearchQuery] = useState(initialQuery || "");
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery || "");
  const [searchField, setSearchField] = useState<SearchField>("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [modeFilter, setModeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState(initialStatus || "all");
  const [viewTab, setViewTab] = useState<"all" | "containers" | "shipments" | "trucks">(initialTab || "all");

  // detail
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(initialShipmentId || null);
  const [trackingData, setTrackingData] = useState<CanonicalTrackingPayload | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<"location" | "journey" | "documents">("location");

  // add event
  const [isAddEventOpen, setIsAddEventOpen] = useState(false);
  const [newEventCode, setNewEventCode] = useState<TrackingEventCode>("vessel_departed");
  const [newLegId, setNewLegId] = useState("");
  const [newLocationName, setNewLocationName] = useState("");
  const [newVesselName, setNewVesselName] = useState("");
  const [newVoyageNumber, setNewVoyageNumber] = useState("");
  const [newContainerNumber, setNewContainerNumber] = useState("");
  const [newEta, setNewEta] = useState("");
  const [newRemarks, setNewRemarks] = useState("");
  const [isSavingEvent, setIsSavingEvent] = useState(false);
  const [eventError, setEventError] = useState("");
  const saveLock = useRef(false);

  const [isCompact, setIsCompact] = useState(false);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const on = () => setIsCompact(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const h = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(h);
  }, [toast]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);
  useEffect(() => { setCurrentPage(1); }, [debouncedQuery, searchField, modeFilter, statusFilter, viewTab]);

  const baseParams = useCallback(() => {
    const p = new URLSearchParams({ q: debouncedQuery, domain, field: searchField, view: viewTab });
    if (modeFilter !== "all") p.set("mode", modeFilter);
    if (statusFilter !== "all") p.set("status", statusFilter);
    return p;
  }, [debouncedQuery, domain, searchField, viewTab, modeFilter, statusFilter]);

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const res = await fetch(`/api/erp/tracking/summary?domain=${domain}`);
      const json = await res.json();
      if (json.ok) setSummary(json.data);
    } catch (e) {
      console.error("Summary load error:", e);
    } finally {
      setSummaryLoading(false);
    }
  }, [domain]);

  const loadList = useCallback(async () => {
    setListLoading(true);
    setListError("");
    try {
      const params = baseParams();
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String((currentPage - 1) * PAGE_SIZE));
      const res = await fetch(`/api/erp/tracking/list?${params}`);
      const json = await res.json();
      if (json.ok) {
        setListRows(json.data.rows || []);
        setTotalRows(json.data.total || 0);
      } else {
        setListRows([]);
        setTotalRows(0);
        setListError(json?.error?.message || s.t("err_load_list", "Could not load tracking records."));
      }
    } catch (e: any) {
      setListError(e?.message || s.t("err_load_list", "Could not load tracking records."));
    } finally {
      setListLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseParams, currentPage]);

  // Every record matching the applied search / filters (server-paged, 100 per request) — for CSV and print.
  const fetchAllTrackingRows = useCallback(async (): Promise<TrackingListRow[]> => {
    const all: TrackingListRow[] = [];
    const size = 100;
    for (let offset = 0; offset < 50000; offset += size) {
      const params = baseParams();
      params.set("limit", String(size));
      params.set("offset", String(offset));
      const res = await fetch(`/api/erp/tracking/list?${params}`);
      const json = await res.json();
      if (!json.ok) break;
      const batch: TrackingListRow[] = json.data.rows || [];
      all.push(...batch);
      if (batch.length < size || all.length >= (json.data.total || 0)) break;
    }
    return all;
  }, [baseParams]);

  const loadDetail = useCallback(
    async (id: string) => {
      setDetailLoading(true);
      setDetailError(null);
      try {
        const res = await fetch(`/api/erp/tracking/${encodeURIComponent(id)}?domain=${domain}`);
        const json = await res.json();
        if (!res.ok || !json.ok) throw new Error(json?.error?.message || s.t("err_load_detail", "Could not load the shipment."));
        setTrackingData(json.data);
        const k = json.data.kpis;
        if (k) {
          if (isReal(k.vesselName)) setNewVesselName(k.vesselName);
          if (isReal(k.voyageNumber)) setNewVoyageNumber(k.voyageNumber);
          if (isReal(k.containerNumber)) setNewContainerNumber(k.containerNumber);
        }
        setNewLegId(json.data.activeLeg?.id || "");
      } catch (e: any) {
        setTrackingData(null);
        setDetailError(e.message);
      } finally {
        setDetailLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [domain]
  );

  useEffect(() => { void loadSummary(); }, [loadSummary]);
  useEffect(() => { void loadList(); }, [loadList]);
  useEffect(() => {
    if (selectedOrderId) {
      void loadDetail(selectedOrderId);
      setDetailTab("location");
    } else {
      setTrackingData(null);
    }
  }, [selectedOrderId, loadDetail]);

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderId || saveLock.current) return; // double-submit guard
    saveLock.current = true;
    setIsSavingEvent(true);
    setEventError("");
    try {
      const res = await fetch(`/api/erp/tracking/${selectedOrderId}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventCode: newEventCode,
          legId: newLegId || undefined,
          locationName: newLocationName || undefined,
          vesselName: newVesselName || undefined,
          voyageNumber: newVoyageNumber || undefined,
          containerNumber: newContainerNumber || undefined,
          eta: newEta || undefined,
          remarks: newRemarks || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json?.error?.message || s.t("err_record_event", "Could not record the milestone."));
      setIsAddEventOpen(false);
      setNewLocationName("");
      setNewRemarks("");
      setToast({ kind: "ok", text: s.t("event_saved", "Milestone recorded.") });
      await Promise.all([loadDetail(selectedOrderId), loadSummary(), loadList()]);
    } catch (err: any) {
      setEventError(err.message || s.t("err_record_event", "Could not record the milestone."));
    } finally {
      saveLock.current = false;
      setIsSavingEvent(false);
    }
  };

  const exportCsv = async () => {
    try {
      const rows = await fetchAllTrackingRows();
      const head = [
        s.t("col_shipment_no", "Shipment No"), s.t("col_bl_no", "BL No"), s.t("col_container_no", "Container No"), s.t("col_transport_ref", "Truck / Flight / Wagon"),
        s.t("col_shipping_line", "Shipping Line"), s.t("col_vessel_voyage", "Vessel / Voyage"), s.t("col_customer", "Customer"), s.t("col_from", "From"), s.t("col_to", "To"),
        s.t("col_mode", "Mode"), s.t("col_current_location", "Current Location"), s.t("col_eta", "ETA"), s.t("col_status", "Status"),
      ];
      const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      const lines = [head.map(esc).join(",")];
      for (const r of rows) {
        lines.push(
          [
            r.orderNo, r.blNumber, r.containerNumber, transportRef(r), r.shippingLine, r.vesselVoyage, r.customerName, r.from, r.to,
            (r.legModes?.length ? r.legModes : [r.transportMode]).map(modeLabel).join(" + "), r.currentLocation, r.eta ? new Date(r.eta).toISOString().slice(0, 10) : "", statusLabel(r.currentStage),
          ].map(esc).join(",")
        );
      }
      // BOM so Excel opens Urdu / Arabic / Persian / Pashto text correctly
      const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `shipment-tracking-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setToast({ kind: "ok", text: `${s.t("export_done", "Exported records")}: ${rows.length}` });
    } catch (e: any) {
      setToast({ kind: "err", text: e?.message || s.t("err_export", "Export failed.") });
    }
  };

  const transportRef = (r: TrackingListRow) => {
    if (isReal(r.truckNumber)) return r.truckNumber;
    if (r.flightNumber || r.airwayBillNo) return [r.flightNumber, r.airwayBillNo].filter(Boolean).join(" / ");
    if (r.wagonNumber) return r.wagonNumber;
    return DASH;
  };

  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));
  const pageNumbers = useMemo(() => {
    const pages: (number | "...")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push("...");
      for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  }, [totalPages, currentPage]);

  const openDetail = (id: string, tab: "location" | "journey" | "documents" = "location") => {
    setSelectedOrderId(id);
    setDetailTab(tab);
  };
  const closeDetail = () => {
    setSelectedOrderId(null);
    setTrackingData(null);
  };
  const activeFilterCount = (modeFilter !== "all" ? 1 : 0) + (statusFilter !== "all" ? 1 : 0);
  const canRecord = summary?.canRecord !== false;
  const ArrowIcon = ({ className = "h-3 w-3" }: { className?: string }) => <ArrowRight className={cn(className, s.isRtl && "rotate-180")} />;

  // ── small presentational pieces ─────────────────────────────────────────────
  const SummaryCard = ({ title: cardTitle, icon, iconClass, children }: { title: string; icon: React.ReactNode; iconClass: string; children: React.ReactNode }) => (
    <div className="bg-card border border-border/70 rounded-xl p-3.5 shadow-sm min-w-0">
      <div className="flex items-center gap-2 mb-2.5 pb-2 border-b border-border/50">
        <div className={cn("p-1.5 rounded-lg", iconClass)}>{icon}</div>
        <span className="text-[10px] font-black uppercase tracking-wider text-foreground">{cardTitle}</span>
      </div>
      {summaryLoading ? (
        <div className="h-16 flex items-center justify-center"><RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" /></div>
      ) : children}
    </div>
  );

  const StatRow = ({ label, value, accent, onClick }: { label: string; value: number | string; accent?: string; onClick?: () => void }) => {
    const inner = (
      <>
        <span className="text-muted-foreground">{label}</span>
        <span className={cn("font-black font-mono tabular-nums", accent || "text-foreground")}>{value}</span>
      </>
    );
    return onClick ? (
      <button type="button" onClick={onClick} className="flex w-full items-center justify-between text-[11px] leading-5 hover:bg-muted/40 rounded px-0.5">{inner}</button>
    ) : (
      <div className="flex items-center justify-between text-[11px] leading-5">{inner}</div>
    );
  };

  const ModeBadges = ({ row }: { row: TrackingListRow }) => (
    <span className="inline-flex flex-wrap items-center justify-center gap-1">
      {(row.legModes?.length ? row.legModes : [row.transportMode]).map((m) => (
        <span key={m} className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[10px] font-bold", modeBadgeClass(m))}>
          {modeIcon(m, "h-3 w-3")}
          {modeLabel(m)}
        </span>
      ))}
      {row.legCount > 1 ? <span className="text-[9px] font-bold text-muted-foreground">{row.legCount} {s.t("legs_short", "legs")}</span> : null}
    </span>
  );

  // The detail content is shared by the side panel (desktop) and the full-screen sheet (phone / tablet).
  const detailBody = (
    <>
      {detailLoading ? (
        <div className="flex-1 flex items-center justify-center p-12">
          <div className="text-center">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
            <p className="text-xs text-muted-foreground">{s.t("loading_journey", "Loading shipment journey...")}</p>
          </div>
        </div>
      ) : detailError ? (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <AlertCircle className="h-6 w-6 mx-auto mb-2 text-destructive" />
            <p className="text-xs font-bold text-destructive">{detailError}</p>
          </div>
        </div>
      ) : trackingData ? (
        <DetailContent />
      ) : null}
    </>
  );

  function DetailContent() {
    const td = trackingData!;
    const tabs = ["location", "journey", "documents"] as const;
    const onTabKey = (e: React.KeyboardEvent, i: number) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      const dir = (e.key === "ArrowRight" ? 1 : -1) * (s.isRtl ? -1 : 1);
      const next = tabs[(i + dir + tabs.length) % tabs.length];
      setDetailTab(next);
      document.getElementById(`trk-tab-${next}`)?.focus();
    };
    const eventsByLeg = (legId: string) => td.events.filter((ev) => ev.leg_id === legId);

    return (
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-3 border-b border-border/60">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className={cn("px-2 py-0.5 rounded-md text-[10px] font-black border", statusBadgeClass(td.shipment.current_stage))}>{statusLabel(td.shipment.current_stage)}</span>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-black border border-primary/30 text-primary bg-primary/5">{s.t("live_tracking", "Live Tracking")}</span>
          </div>
          <div className="font-mono font-black text-lg text-foreground leading-tight break-all" dir="ltr">{td.kpis.containerNumber}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">{td.shipment.goods_name || s.t("cargo_container", "Cargo Container")}</div>
        </div>

        <div className="px-4 py-3 border-b border-border/60 space-y-1.5">
          {[
            { label: s.t("col_shipment_no", "Shipment No"), value: td.shipment.order_no, mono: true, link: true },
            { label: s.t("col_bl_no", "BL Number"), value: td.kpis.blNumber, mono: true, link: true },
            { label: s.t("col_customer", "Customer"), value: td.shipment.customer_name || DASH },
            { label: s.t("col_shipping_line", "Shipping Line"), value: td.kpis.shippingLine },
            { label: s.t("col_vessel_voyage", "Vessel / Voyage"), value: `${td.kpis.vesselName}${isReal(td.kpis.voyageNumber) ? ` / ${td.kpis.voyageNumber}` : ""}`, mono: true },
            { label: s.t("lbl_truck", "Truck Number"), value: td.activeLeg?.truck_number || td.activeLeg?.master_truck_number || DASH, mono: true },
            { label: s.t("lbl_route", "Route"), value: `${td.kpis.pol} → ${td.kpis.pod}` },
            { label: s.t("col_mode", "Mode"), value: `${modeLabel(td.activeLeg?.transport_mode || td.shipment.transport_mode)} (${td.legs.length > 1 ? s.t("multi_leg", "Multi-Leg") : s.t("direct", "Direct")})` },
            { label: s.t("lbl_etd", "ETD"), value: formatDate(td.kpis.etd) },
            { label: s.t("col_eta", "ETA"), value: formatDate(td.kpis.eta) },
          ].map(({ label, value, mono, link }) => (
            <div key={label} className="flex items-start justify-between gap-3 text-[11px]">
              <span className="text-muted-foreground shrink-0">{label}</span>
              <span dir={mono ? "ltr" : undefined} className={cn("text-end break-words max-w-[60%]", mono ? "font-mono" : "", link && value !== DASH ? "text-primary font-bold" : "text-foreground font-semibold")}>{value}</span>
            </div>
          ))}
        </div>

        <div role="tablist" aria-label={s.t("detail_tabs", "Shipment details")} className="flex border-b border-border/60">
          {tabs.map((tab, i) => (
            <button
              key={tab}
              id={`trk-tab-${tab}`}
              role="tab"
              aria-selected={detailTab === tab}
              tabIndex={detailTab === tab ? 0 : -1}
              onClick={() => setDetailTab(tab)}
              onKeyDown={(e) => onTabKey(e, i)}
              className={cn("flex-1 py-2.5 text-[11px] font-bold transition-all border-b-2", detailTab === tab ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}
            >
              {tab === "location" ? s.t("tab_location", "Current Location") : tab === "journey" ? s.t("tab_journey", "Journey") : s.t("tab_documents", "Documents")}
            </button>
          ))}
        </div>

        {detailTab === "location" && (
          <div role="tabpanel" className="px-4 py-4">
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-3.5 mb-4">
              <div className="flex items-center gap-2 mb-1">
                <MapPin className="h-4 w-4 text-primary" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-primary">{s.t("tab_location", "Current Location")}</span>
                <span className={cn("ms-auto px-2 py-0.5 rounded-md text-[9px] font-black border", statusBadgeClass(td.shipment.current_stage))}>{statusLabel(td.shipment.current_stage)}</span>
              </div>
              <p className="text-sm font-black text-foreground">{td.kpis.currentLocation}</p>
              {td.events[0] && <p className="text-[10px] text-muted-foreground mt-1 font-mono" dir="ltr">{formatDateTime(td.events[0].event_time)}</p>}
            </div>

            {td.legs.length > 1 && (
              <div className="mb-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">{s.t("journey_route", "Journey Route")} ({td.legs.length} {s.t("legs_short", "legs")})</p>
                <div className="flex items-center gap-1 flex-wrap">
                  {td.legs.map((leg, i) => {
                    const isActive = leg.id === td.activeLeg?.id;
                    return (
                      <div key={leg.id || i} className="flex items-center gap-1">
                        <div className={cn("flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border", isActive ? "bg-primary text-primary-foreground border-primary" : leg.status === "completed" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30" : "bg-muted text-muted-foreground border-border/60")}>
                          {modeIcon(leg.transport_mode, "h-3 w-3")}
                          {modeLabel(leg.transport_mode)}
                          {isActive && <CircleDot className="h-2.5 w-2.5 animate-pulse" />}
                        </div>
                        {i < td.legs.length - 1 && <ArrowIcon className="h-3 w-3 text-muted-foreground" />}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">{s.t("timeline_title", "Complete Journey Timeline")}</p>
            {td.events.length === 0 ? (
              <div className="text-center py-6 border border-dashed rounded-xl bg-muted/20"><p className="text-[11px] text-muted-foreground">{s.t("no_events", "No events logged yet.")}</p></div>
            ) : (
              <ol className="relative ps-5 space-y-3 before:absolute before:start-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-border/80">
                {td.events.map((ev, idx) => {
                  const isLatest = idx === 0;
                  const leg = td.legs.find((l) => l.id === ev.leg_id);
                  return (
                    <li key={ev.id || idx} className="relative">
                      <div className={cn("absolute -start-5 top-1 h-4 w-4 rounded-full border-2 flex items-center justify-center", isLatest ? "bg-primary border-primary text-primary-foreground shadow-sm shadow-primary/30" : ev.status === "completed" ? "bg-emerald-500 border-emerald-500 text-white" : "bg-background border-muted-foreground/50")}>
                        {isLatest ? <CircleDot className="h-2.5 w-2.5 animate-pulse" /> : <div className="h-1.5 w-1.5 rounded-full bg-current" />}
                      </div>
                      <div className="text-[11px]">
                        <div className="flex items-center justify-between gap-2">
                          <span className={cn("font-bold", isLatest ? "text-primary" : "text-foreground")}>{eventLabel(ev.event_code, ev.event_name)}</span>
                          {leg && <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9px] font-bold", modeBadgeClass(leg.transport_mode))}>{modeIcon(leg.transport_mode, "h-2.5 w-2.5")}#{leg.leg_no}</span>}
                        </div>
                        <p className="text-[10px] font-mono text-muted-foreground leading-tight" dir="ltr">{formatDateTime(ev.event_time)}</p>
                        {ev.location_name && <p className="text-[10px] text-foreground/70 flex items-center gap-1 mt-0.5"><MapPin className="h-2.5 w-2.5 text-primary" />{ev.location_name}</p>}
                        {ev.remarks && <p className="text-[10px] text-muted-foreground italic mt-0.5">{ev.remarks}</p>}
                      </div>
                    </li>
                  );
                })}
                {td.kpis.eta && (
                  <li className="relative opacity-60">
                    <div className="absolute -start-5 top-1 h-4 w-4 rounded-full border-2 border-dashed border-muted-foreground/50 bg-background flex items-center justify-center"><div className="h-1.5 w-1.5 rounded-full bg-muted-foreground" /></div>
                    <div className="text-[11px]">
                      <span className="font-bold text-muted-foreground">{s.t("expected_arrival", "Expected Arrival")}</span>
                      <p className="text-[10px] font-mono text-muted-foreground" dir="ltr">{formatDate(td.kpis.eta)}</p>
                      <p className="text-[10px] text-muted-foreground/70 flex items-center gap-1 mt-0.5"><MapPin className="h-2.5 w-2.5" />{td.kpis.pod}</p>
                    </div>
                  </li>
                )}
              </ol>
            )}
          </div>
        )}

        {detailTab === "journey" && (
          <div role="tabpanel" className="px-4 py-4 space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{s.t("multi_leg_title", "Multi-Leg Movement Sequence")} ({td.legs.length})</p>

            <div className="bg-muted/30 border border-border/60 rounded-xl p-3 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[9px] font-bold uppercase text-muted-foreground">{s.t("col_from", "From")}</p>
                <p className="text-xs font-black text-foreground break-words">{td.kpis.pol}</p>
                {td.kpis.etd && <p className="text-[10px] font-mono text-muted-foreground" dir="ltr">{s.t("lbl_etd", "ETD")}: {formatDate(td.kpis.etd)}</p>}
              </div>
              <ArrowIcon className="h-4 w-4 text-primary shrink-0" />
              <div className="text-end min-w-0">
                <p className="text-[9px] font-bold uppercase text-muted-foreground">{s.t("col_to", "To")}</p>
                <p className="text-xs font-black text-foreground break-words">{td.kpis.pod}</p>
                {td.kpis.eta && <p className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400" dir="ltr">{s.t("col_eta", "ETA")}: {formatDate(td.kpis.eta)}</p>}
              </div>
            </div>

            {td.legs.map((leg, idx) => {
              const isActive = leg.id === td.activeLeg?.id;
              const legEvents = eventsByLeg(leg.id);
              const kv = (label: string, value: unknown, mono = true) =>
                value ? (
                  <div className="flex justify-between gap-2"><span>{label}</span><strong dir={mono ? "ltr" : undefined} className={cn("text-foreground text-end", mono && "font-mono")}>{String(value)}</strong></div>
                ) : null;
              return (
                <div key={leg.id || idx} className={cn("border rounded-xl p-3 space-y-2 transition-all", isActive ? "border-primary bg-primary/5 shadow-sm" : leg.status === "completed" ? "border-emerald-500/30 bg-emerald-500/5" : "border-border/60 bg-card")}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-[10px] font-black uppercase">{modeIcon(leg.transport_mode, "h-3.5 w-3.5")}{s.t("leg", "Leg")} #{leg.leg_no}: {modeLabel(leg.transport_mode)}</span>
                    <span className={cn("px-1.5 py-0.5 rounded text-[9px] font-black border", isActive ? "bg-primary text-primary-foreground border-primary" : leg.status === "completed" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30" : "bg-muted text-muted-foreground border-border/60")}>
                      {isActive ? s.t("leg_active", "Active") : legStatusLabel(leg.status)}
                    </span>
                  </div>
                  <p className="text-[11px] font-bold text-foreground">
                    {leg.from_location_text || leg.port_of_loading || leg.from_country_name || s.t("origin", "Origin")} → {leg.to_location_text || leg.port_of_discharge || leg.to_country_name || s.t("destination", "Destination")}
                  </p>
                  <div className="text-[10.5px] text-muted-foreground space-y-0.5">
                    {leg.transport_mode === "by_road" && (
                      <>
                        {kv(s.t("lbl_truck", "Truck Number"), leg.truck_number || leg.master_truck_number || s.t("to_be_assigned", "To be assigned"))}
                        {kv(s.t("lbl_driver", "Driver"), leg.truck_driver_name, false)}
                        {kv(s.t("lbl_driver_mobile", "Driver mobile"), leg.truck_driver_mobile)}
                      </>
                    )}
                    {leg.transport_mode === "by_sea" && (
                      <>
                        {kv(s.t("lbl_vessel", "Vessel"), leg.vessel_name || s.t("pending", "Pending"), false)}
                        {kv(s.t("lbl_voyage", "Voyage"), leg.voyage_number)}
                        {kv(s.t("lbl_container", "Container"), leg.container_number)}
                        {kv(s.t("lbl_seal", "Seal"), leg.seal_number)}
                        {kv(s.t("col_bl_no", "BL Number"), leg.bl_number)}
                        {kv(s.t("col_shipping_line", "Shipping Line"), leg.shipping_line_name, false)}
                      </>
                    )}
                    {leg.transport_mode === "by_air" && (
                      <>
                        {kv(s.t("lbl_airline", "Airline"), leg.airline_name, false)}
                        {kv(s.t("lbl_flight", "Flight"), leg.flight_number)}
                        {kv(s.t("lbl_awb", "Air Waybill"), leg.airway_bill_no)}
                      </>
                    )}
                    {leg.transport_mode === "by_rail" && (
                      <>
                        {kv(s.t("lbl_rail_operator", "Railway operator"), leg.railway_operator, false)}
                        {kv(s.t("lbl_wagon", "Wagon"), leg.wagon_number)}
                        {kv(s.t("lbl_container", "Container"), leg.rail_container_number)}
                      </>
                    )}
                    {kv(s.t("lbl_etd", "ETD"), leg.etd ? formatDate(leg.etd) : null)}
                    {kv(s.t("col_eta", "ETA"), leg.eta ? formatDate(leg.eta) : null)}
                    {kv(s.t("lbl_customs", "Customs"), leg.customs_point_text, false)}
                    {kv(s.t("lbl_customs_ref", "Customs receipt"), leg.customs_receipt_ref)}
                  </div>
                  {legEvents.length > 0 && (
                    <ul className="border-t border-border/50 pt-2 space-y-1">
                      {legEvents.slice(0, 6).map((ev) => (
                        <li key={ev.id} className="flex items-start justify-between gap-2 text-[10px]">
                          <span className="font-semibold text-foreground">{eventLabel(ev.event_code, ev.event_name)}{ev.location_name ? ` · ${ev.location_name}` : ""}</span>
                          <span className="font-mono text-muted-foreground shrink-0" dir="ltr">{formatDateTime(ev.event_time)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {detailTab === "documents" && (
          <div role="tabpanel" className="px-4 py-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">{s.t("linked_documents", "Linked Documents")}</p>
            <div className="space-y-2">
              {td.blRecord && (
                <div className="flex items-center gap-3 p-3 border border-border/60 rounded-xl">
                  <div className="p-2 rounded-lg bg-blue-500/10"><FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold text-foreground">{s.t("doc_bl", "Bill of Lading")}</p>
                    <p className="text-[10px] font-mono text-muted-foreground truncate" dir="ltr">{td.kpis.blNumber}</p>
                  </div>
                </div>
              )}
              {td.handover && (
                <div className="flex items-center gap-3 p-3 border border-border/60 rounded-xl">
                  <div className="p-2 rounded-lg bg-emerald-500/10"><Layers className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold text-foreground">{s.t("doc_handover", "Business Handover")}</p>
                    <p className="text-[10px] font-mono text-muted-foreground truncate" dir="ltr">#{td.handover.handover_no}</p>
                  </div>
                </div>
              )}
              {td.legs.filter((l) => l.customs_receipt_ref || l.bill_of_entry_no || l.declaration_reference).map((l) => (
                <div key={`c-${l.id}`} className="flex items-center gap-3 p-3 border border-border/60 rounded-xl">
                  <div className="p-2 rounded-lg bg-amber-500/10"><FileText className="h-4 w-4 text-amber-600" /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold text-foreground">{s.t("doc_customs", "Customs")} · {s.t("leg", "Leg")} #{l.leg_no}</p>
                    <p className="text-[10px] font-mono text-muted-foreground truncate" dir="ltr">{[l.customs_receipt_ref, l.bill_of_entry_no, l.declaration_reference].filter(Boolean).join(" · ")}</p>
                  </div>
                </div>
              ))}
              {!td.blRecord && !td.handover && !td.legs.some((l) => l.customs_receipt_ref || l.bill_of_entry_no || l.declaration_reference) && (
                <div className="text-center py-6 border border-dashed rounded-xl bg-muted/20">
                  <FileText className="h-6 w-6 mx-auto mb-2 text-muted-foreground/40" />
                  <p className="text-[11px] text-muted-foreground">{s.t("no_documents", "No linked documents yet.")}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  const detailHeader = (
    <div className="px-4 py-3 border-b border-border/60 bg-muted/30 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <Ship className="h-4 w-4 text-primary shrink-0" />
        <span className="text-[11px] font-black uppercase tracking-wider text-foreground truncate">{s.t("detail_title", "Container Details")}</span>
      </div>
      <div className="flex items-center gap-1">
        {canRecord && trackingData && (
          <Button size="sm" onClick={() => setIsAddEventOpen(true)} className="h-7 gap-1 text-[11px] rounded-lg"><Plus className="h-3 w-3" />{s.t("add_event", "Add Event")}</Button>
        )}
        <button onClick={closeDetail} aria-label={s.t("close", "Close")} className="p-1 rounded-md hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"><X className="h-4 w-4" /></button>
      </div>
    </div>
  );

  // ── Render ───────────────────────────────────────────────────────────────────
  const detailOpen = Boolean(selectedOrderId);
  // the Add Event dialog (z-50) must not sit under the full-screen sheet, so the sheet steps aside while it is open
  const showSheet = detailOpen && isCompact && !isAddEventOpen && typeof document !== "undefined";

  return (
    <div className="space-y-4" dir={s.dir}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-black text-foreground tracking-tight flex items-center gap-2">
            <Anchor className="h-5 w-5 text-primary" />
            {title || s.t("title", "Container & Vessel Tracking")}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">{description || s.t("subtitle", "Track shipments, containers and vessels in real-time with complete journey details.")}</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => { void loadSummary(); void loadList(); if (selectedOrderId) void loadDetail(selectedOrderId); }} className="gap-1.5 h-8 text-xs">
          <RefreshCw className="h-3.5 w-3.5" />
          {s.t("refresh", "Refresh")}
        </Button>
      </div>

      {toast && (
        <div role="status" className={cn("rounded-lg border px-3 py-2 text-xs font-semibold", toast.kind === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-700")}>{toast.text}</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <SummaryCard title={s.t("card_branch", "Branch & User Details")} icon={<Building2 className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />} iconClass="bg-blue-500/10">
          <div className="space-y-0.5 text-[11px]">
            <StatRow label={s.t("lbl_branch", "Branch")} value={summary?.branchUser.isSuperAdmin ? s.t("all_branches", "All Branches (Global)") : summary?.branchUser.branchName || DASH} />
            <StatRow label={s.t("lbl_branch_code", "Branch Code")} value={summary?.branchUser.branchCode || DASH} />
            <StatRow label={s.t("lbl_country", "Country")} value={summary?.branchUser.isSuperAdmin ? s.t("all_countries", "All Countries") : summary?.branchUser.countryName || DASH} />
            <StatRow label={s.t("lbl_user", "User")} value={summary?.branchUser.userName || DASH} />
            <StatRow label={s.t("lbl_role", "Role")} value={summary?.branchUser.roleKey ? s.tGlobal(`role.${summary.branchUser.roleKey}`, summary.branchUser.roleLabel) : summary?.branchUser.roleLabel || DASH} />
          </div>
        </SummaryCard>

        <SummaryCard title={s.t("card_summary", "Shipment & Container Summary")} icon={<Boxes className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />} iconClass="bg-emerald-500/10">
          <div className="space-y-0.5 text-[11px]">
            <StatRow label={s.t("lbl_total_shipments", "Total Shipments")} value={summary?.shipmentSummary.totalShipments ?? 0} />
            <StatRow label={s.t("lbl_total_containers", "Total Containers")} value={summary?.shipmentSummary.totalContainers ?? 0} />
            <StatRow label={s.t("lbl_in_transit", "In Transit")} value={summary?.shipmentSummary.inTransit ?? 0} accent="text-blue-600 dark:text-blue-400" />
            <StatRow label={s.t("st_destination_review", "Arrived")} value={summary?.shipmentSummary.arrived ?? 0} accent="text-teal-600 dark:text-teal-400" onClick={() => setStatusFilter("destination_review")} />
            <StatRow label={s.t("st_completed", "Delivered")} value={summary?.shipmentSummary.delivered ?? 0} accent="text-emerald-600 dark:text-emerald-400" onClick={() => setStatusFilter("completed")} />
            <StatRow label={s.t("lbl_pending", "Pending")} value={summary?.shipmentSummary.pending ?? 0} accent="text-orange-600 dark:text-orange-400" onClick={() => setStatusFilter("booking")} />
          </div>
        </SummaryCard>

        <SummaryCard title={s.t("card_movement", "Current Movement (By Mode)")} icon={<Navigation className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />} iconClass="bg-violet-500/10">
          <div className="space-y-0.5 text-[11px]">
            {([
              ["by_road", summary?.movementByMode.byRoad, "text-amber-500"],
              ["by_sea", summary?.movementByMode.bySea, "text-blue-500"],
              ["by_air", summary?.movementByMode.byAir, "text-sky-500"],
              ["by_rail", summary?.movementByMode.byRail, "text-violet-500"],
            ] as const).map(([m, n, c]) => (
              <button key={m} type="button" onClick={() => { setModeFilter(m); setFiltersOpen(true); }} className="flex w-full items-center justify-between leading-5 hover:bg-muted/40 rounded px-0.5">
                <span className="flex items-center gap-1.5 text-muted-foreground">{modeIcon(m, cn("h-3 w-3", c))} {s.t(`by_${m.slice(3)}`, `By ${modeLabel(m)}`)}</span>
                <span className="font-black font-mono text-foreground">{n ?? 0}</span>
              </button>
            ))}
          </div>
        </SummaryCard>

        <SummaryCard title={s.t("card_status", "Tracking Status Summary")} icon={<Activity className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />} iconClass="bg-rose-500/10">
          <div className="space-y-0.5 text-[11px]">
            <StatRow label={s.t("lbl_booking_confirmed", "Booking Confirmed")} value={summary?.trackingStatus.bookingConfirmed ?? 0} />
            <StatRow label={s.t("lbl_loaded_gate_in", "Loaded / Gate In")} value={summary?.trackingStatus.loadedGateIn ?? 0} />
            <StatRow label={s.t("lbl_in_transit", "In Transit")} value={summary?.trackingStatus.inTransit ?? 0} accent="text-blue-600 dark:text-blue-400" />
            <StatRow label={s.t("lbl_arrived_dest", "Arrived at Destination")} value={summary?.trackingStatus.arrivedAtDestination ?? 0} accent="text-teal-600 dark:text-teal-400" />
            <StatRow label={s.t("st_completed", "Delivered")} value={summary?.trackingStatus.delivered ?? 0} accent="text-emerald-600 dark:text-emerald-400" />
            <StatRow label={s.t("lbl_delayed", "Delayed / Pending")} value={summary?.trackingStatus.delayedPending ?? 0} accent="text-rose-600 dark:text-rose-400" onClick={() => setStatusFilter("delayed")} />
          </div>
        </SummaryCard>
      </div>

      <div className={cn("flex gap-3", detailOpen && !isCompact ? "items-start" : "")}>
        <div className="flex flex-col gap-3 min-w-0 flex-1">
          <div className="bg-card border border-border/70 rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-border/60 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 min-w-[240px] flex-1">
                <Ship className="h-4 w-4 text-primary shrink-0" />
                <div>
                  <span className="text-sm font-black text-foreground">{s.t("list_title", "Shipment & Container Tracking List")}</span>
                  <p className="text-[10px] text-muted-foreground leading-tight">{s.t("list_desc", "All shipments, containers and vessels with current status and location.")}</p>
                </div>
              </div>
              <div role="tablist" aria-label={s.t("list_views", "List views")} className="flex items-center bg-muted/50 rounded-lg p-0.5 text-[11px] gap-0.5 shrink-0">
                {(["all", "containers", "shipments", "trucks"] as const).map((tab) => (
                  <button key={tab} role="tab" aria-selected={viewTab === tab} onClick={() => setViewTab(tab)} className={cn("px-2.5 py-1 rounded-md font-semibold transition-all", viewTab === tab ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>
                    {s.t(`view_${tab}`, tab === "all" ? "All" : tab.charAt(0).toUpperCase() + tab.slice(1))}
                  </button>
                ))}
              </div>
              <span className="text-[10px] text-muted-foreground font-mono shrink-0">{s.t("total_records", "Total Records")}: {totalRows}</span>
            </div>

            <div className="px-4 py-2.5 border-b border-border/60 flex flex-wrap items-center gap-2">
              <select
                aria-label={s.t("search_field", "Search in")}
                value={searchField}
                onChange={(e) => setSearchField(e.target.value as SearchField)}
                className="h-8 rounded-lg border border-border/70 bg-muted/30 px-2 text-xs font-semibold"
              >
                {SEARCH_FIELDS.map((f) => (
                  <option key={f} value={f}>{s.t(`field_${f}`, f === "all" ? "All fields" : f)}</option>
                ))}
              </select>
              <div className="relative flex-1 min-w-[160px]">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={s.t("search_ph", "Search by Shipment No, BL, Container, Vessel, Voyage, Customer, Shipping Line...")}
                  className="ps-9 h-8 text-xs bg-muted/30 border-border/70 rounded-lg"
                />
              </div>
              <Button size="sm" variant={filtersOpen ? "default" : "outline"} onClick={() => setFiltersOpen(!filtersOpen)} className="h-8 gap-1.5 text-xs rounded-lg">
                <Filter className="h-3.5 w-3.5" />
                {s.t("filters", "Filters")}
                {activeFilterCount > 0 && <Badge className="h-4 w-4 p-0 text-[9px] flex items-center justify-center ms-0.5 rounded-full">{activeFilterCount}</Badge>}
              </Button>
              <div className="flex items-center gap-1 border border-border/70 rounded-lg p-0.5">
                <JournalPrintButton
                  title={title || s.t("title", "Container & Vessel Tracking")}
                  columns={[
                    { key: "orderNo", label: pl("Shipment No") },
                    { key: "blNumber", label: pl("BL No") },
                    { key: "containerNumber", label: pl("Container No") },
                    { key: (r) => transportRef(r as unknown as TrackingListRow), label: s.t("col_transport_ref", "Truck / Flight / Wagon") },
                    { key: "shippingLine", label: pl("Shipping Line") },
                    { key: "vesselVoyage", label: pl("Vessel / Voyage") },
                    { key: "from", label: pl("From") },
                    { key: "to", label: s.t("col_to", "To") },
                    { key: (r) => ((r as any).legModes?.length ? (r as any).legModes : [(r as any).transportMode]).map(modeLabel).join(" + "), label: pl("Mode"), align: "center" },
                    { key: "currentLocation", label: pl("Current Location") },
                    { key: (r) => formatDate((r as any).eta), label: s.t("col_eta", "ETA") },
                    { key: (r) => statusLabel(String((r as any).currentStage ?? "")), label: pl("Status"), align: "center", format: "status" },
                  ]}
                  rows={listRows as unknown as Record<string, unknown>[]}
                  fetchFullData={fetchAllTrackingRows as unknown as () => Promise<Record<string, unknown>[]>}
                  filters={[
                    ...(debouncedQuery.trim() ? [{ label: pl("Search"), value: debouncedQuery.trim() }] : []),
                    ...(modeFilter !== "all" ? [{ label: pl("Mode"), value: modeLabel(modeFilter) }] : []),
                    ...(statusFilter !== "all" ? [{ label: pl("Status"), value: statusLabel(statusFilter) }] : []),
                  ]}
                  orientation="landscape"
                  variant="ghost"
                  className="h-7 px-2"
                />
                <button type="button" onClick={() => void exportCsv()} className="p-1.5 rounded-md hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors" title={s.t("export_csv", "Export CSV")} aria-label={s.t("export_csv", "Export CSV")}>
                  <Download className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {filtersOpen && (
              <div className="px-4 py-3 border-b border-border/60 bg-muted/20 flex flex-wrap gap-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <Label className="text-[11px] font-semibold shrink-0">{s.t("col_mode", "Mode")}:</Label>
                  <div className="flex gap-1 flex-wrap">
                    {(["all", ...MODES] as const).map((v) => (
                      <button key={v} onClick={() => setModeFilter(v)} className={cn("px-2.5 py-0.5 rounded-full text-[10px] font-semibold border transition-all", modeFilter === v ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border/70 text-muted-foreground hover:text-foreground")}>
                        {v === "all" ? s.t("all", "All") : modeLabel(v)}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Label className="text-[11px] font-semibold shrink-0">{s.t("col_status", "Status")}:</Label>
                  <div className="flex gap-1 flex-wrap">
                    {(["all", ...STATUSES] as const).map((v) => (
                      <button key={v} onClick={() => setStatusFilter(v)} className={cn("px-2.5 py-0.5 rounded-full text-[10px] font-semibold border transition-all", statusFilter === v ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border/70 text-muted-foreground hover:text-foreground")}>
                        {v === "all" ? s.t("all", "All") : statusLabel(v)}
                      </button>
                    ))}
                  </div>
                </div>
                {activeFilterCount > 0 && (
                  <button onClick={() => { setModeFilter("all"); setStatusFilter("all"); }} className="text-[10px] text-muted-foreground hover:text-destructive font-semibold flex items-center gap-1 ms-auto">
                    <X className="h-3 w-3" /> {s.t("clear_filters", "Clear filters")}
                  </button>
                )}
              </div>
            )}

            {/* phone / small tablet: cards */}
            <ul className="divide-y divide-border/40 md:hidden">
              {listLoading ? (
                <li className="py-12 text-center"><RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-primary" /><p className="text-xs text-muted-foreground">{s.t("loading_records", "Loading records...")}</p></li>
              ) : listError ? (
                <li className="py-10 text-center text-xs font-semibold text-destructive px-4">{listError}</li>
              ) : listRows.length === 0 ? (
                <li className="py-12 text-center px-4"><Ship className="h-8 w-8 mx-auto mb-3 text-muted-foreground/40" /><p className="text-xs font-semibold text-muted-foreground">{s.t("no_records", "No tracking records found.")}</p></li>
              ) : (
                listRows.map((row) => (
                  <li key={row.id} className={cn("p-3 space-y-1.5", selectedOrderId === row.id && "bg-primary/5")}>
                    <div className="flex items-start justify-between gap-2">
                      <button type="button" onClick={() => openDetail(row.id)} className="font-mono font-black text-primary text-sm text-start" dir="ltr">{row.orderNo}</button>
                      <span className={cn("inline-block px-1.5 py-0.5 rounded-md border text-[10px] font-bold whitespace-nowrap", statusBadgeClass(row.currentStage))}>{statusLabel(row.currentStage)}</span>
                    </div>
                    <ModeBadges row={row} />
                    <div className="text-[11px] text-muted-foreground">{row.customerName}</div>
                    <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                      <div><dt className="text-[9px] uppercase font-bold text-muted-foreground">{s.t("col_bl_no", "BL No")}</dt><dd className="font-mono break-all" dir="ltr">{row.blNumber}</dd></div>
                      <div><dt className="text-[9px] uppercase font-bold text-muted-foreground">{s.t("col_container_no", "Container No")}</dt><dd className="font-mono break-all" dir="ltr">{row.containerNumber}</dd></div>
                      <div><dt className="text-[9px] uppercase font-bold text-muted-foreground">{s.t("col_vessel_voyage", "Vessel / Voyage")}</dt><dd className="break-words" dir="ltr">{row.vesselVoyage}</dd></div>
                      <div><dt className="text-[9px] uppercase font-bold text-muted-foreground">{s.t("col_transport_ref", "Truck / Flight / Wagon")}</dt><dd className="font-mono break-all" dir="ltr">{transportRef(row)}</dd></div>
                      <div className="col-span-2 flex items-center gap-1 flex-wrap"><MapPin className="h-3 w-3 text-primary shrink-0" /><span>{row.from}</span><ArrowIcon className="h-3 w-3 text-muted-foreground" /><span>{row.to}</span></div>
                      <div><dt className="text-[9px] uppercase font-bold text-muted-foreground">{s.t("col_current_location", "Current Location")}</dt><dd>{row.currentLocation}</dd></div>
                      <div><dt className="text-[9px] uppercase font-bold text-muted-foreground">{s.t("col_eta", "ETA")}</dt><dd className="font-mono" dir="ltr">{formatDate(row.eta)}</dd></div>
                    </dl>
                    <div className="flex gap-2 pt-1">
                      <Button size="sm" variant="outline" onClick={() => openDetail(row.id)} className="h-8 text-xs gap-1"><Eye className="h-3.5 w-3.5" />{s.t("view_details", "View Details")}</Button>
                      <Button size="sm" variant="outline" onClick={() => openDetail(row.id, "journey")} className="h-8 text-xs gap-1"><MapPin className="h-3.5 w-3.5" />{s.t("tab_journey", "Journey")}</Button>
                    </div>
                  </li>
                ))
              )}
            </ul>

            {/* tablet / desktop: table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/30">
                    {[
                      ["#", "w-8 text-center"], [s.t("col_shipment_no", "Shipment No"), ""], [s.t("col_bl_no", "BL No"), ""], [s.t("col_container_no", "Container No"), ""],
                      [s.t("col_transport_ref", "Truck / Flight / Wagon"), ""], [s.t("col_shipping_line", "Shipping Line"), ""], [s.t("col_vessel_voyage", "Vessel / Voyage"), ""],
                      [s.t("col_from", "From"), ""], [s.t("col_to", "To"), ""], [s.t("col_mode", "Mode"), "text-center"], [s.t("col_current_location", "Current Location"), ""],
                      [s.t("col_eta", "ETA"), ""], [s.t("col_status", "Status"), "text-center"], [s.t("col_actions", "Actions"), "text-center"],
                    ].map(([label, cls], i) => (
                      <th key={i} scope="col" className={cn("px-3 py-2.5 font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap", cls || s.textStart)}>{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {listLoading ? (
                    <tr><td colSpan={14} className="py-12 text-center"><RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-primary" /><p className="text-xs text-muted-foreground">{s.t("loading_records", "Loading records...")}</p></td></tr>
                  ) : listError ? (
                    <tr><td colSpan={14} className="py-10 text-center text-xs font-semibold text-destructive">{listError}</td></tr>
                  ) : listRows.length === 0 ? (
                    <tr>
                      <td colSpan={14} className="py-16 text-center">
                        <Ship className="h-8 w-8 mx-auto mb-3 text-muted-foreground/40" />
                        <p className="text-xs font-semibold text-muted-foreground">{s.t("no_records", "No tracking records found.")}</p>
                        {(searchQuery || activeFilterCount > 0) && <p className="text-[10px] text-muted-foreground mt-1">{s.t("adjust_filters", "Try adjusting your search or filters.")}</p>}
                      </td>
                    </tr>
                  ) : (
                    listRows.map((row, idx) => {
                      const isSelected = selectedOrderId === row.id;
                      const rowNum = (currentPage - 1) * PAGE_SIZE + idx + 1;
                      return (
                        <tr key={row.id} className={cn("hover:bg-muted/30 transition-colors cursor-pointer", isSelected && "bg-primary/5 border-s-2 border-s-primary")} onClick={() => (isSelected ? closeDetail() : openDetail(row.id))}>
                          <td className="px-3 py-2.5 text-center text-muted-foreground font-mono">{rowNum}</td>
                          <td className="px-3 py-2.5"><button type="button" onClick={(e) => { e.stopPropagation(); openDetail(row.id); }} className="font-mono font-black text-primary hover:underline whitespace-nowrap" dir="ltr">{row.orderNo}</button></td>
                          <td className="px-3 py-2.5 font-mono" dir="ltr"><span className={row.blNumber !== DASH ? "text-primary" : "text-muted-foreground"}>{row.blNumber}</span></td>
                          <td className="px-3 py-2.5 font-mono font-bold" dir="ltr"><span className={row.containerNumber !== DASH ? "text-primary" : "text-muted-foreground"}>{row.containerNumber}</span></td>
                          <td className="px-3 py-2.5 font-mono" dir="ltr"><span className={transportRef(row) !== DASH ? "text-amber-600 dark:text-amber-400 font-bold" : "text-muted-foreground"}>{transportRef(row)}</span></td>
                          <td className="px-3 py-2.5 text-foreground/80 max-w-[110px]"><span className="truncate block" title={row.shippingLine}>{row.shippingLine}</span></td>
                          <td className="px-3 py-2.5 max-w-[120px]"><span className="truncate block text-foreground/80 font-mono" title={row.vesselVoyage} dir="ltr">{row.vesselVoyage}</span></td>
                          <td className="px-3 py-2.5 text-foreground/70 max-w-[90px]"><span className="truncate block" title={row.from}>{row.from}</span></td>
                          <td className="px-3 py-2.5 text-foreground/70 max-w-[90px]"><span className="truncate block" title={row.to}>{row.to}</span></td>
                          <td className="px-3 py-2.5 text-center"><ModeBadges row={row} /></td>
                          <td className="px-3 py-2.5 max-w-[120px]"><span className="flex items-center gap-1 text-foreground/80" title={row.currentLocation}><MapPin className="h-3 w-3 text-primary shrink-0" /><span className="truncate">{row.currentLocation}</span></span></td>
                          <td className="px-3 py-2.5 font-mono text-foreground/70 whitespace-nowrap" dir="ltr">{formatDate(row.eta)}</td>
                          <td className="px-3 py-2.5 text-center"><span className={cn("inline-block px-1.5 py-0.5 rounded-md border text-[10px] font-bold whitespace-nowrap", statusBadgeClass(row.currentStage))}>{statusLabel(row.currentStage)}</span></td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-1 justify-center">
                              <button onClick={(e) => { e.stopPropagation(); openDetail(row.id); }} title={s.t("view_details", "View Details")} aria-label={s.t("view_details", "View Details")} className="p-1.5 rounded-md bg-muted hover:bg-primary/10 hover:text-primary transition-colors"><Eye className="h-3.5 w-3.5" /></button>
                              <button onClick={(e) => { e.stopPropagation(); openDetail(row.id, "journey"); }} title={s.t("tab_journey", "Journey")} aria-label={s.t("tab_journey", "Journey")} className="p-1.5 rounded-md bg-muted hover:bg-primary/10 hover:text-primary transition-colors"><MapPin className="h-3.5 w-3.5" /></button>
                              <button onClick={(e) => { e.stopPropagation(); openDetail(row.id); }} title={s.t("open_full", "Open Full Tracking")} aria-label={s.t("open_full", "Open Full Tracking")} className="p-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"><ChevronRight className={cn("h-3.5 w-3.5", s.isRtl && "rotate-180")} /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {!listLoading && totalRows > 0 && (
              <div className="px-4 py-3 border-t border-border/60 flex items-center justify-between gap-3 flex-wrap">
                <span className="text-[11px] text-muted-foreground">
                  {s.t("showing", "Showing")} {Math.min((currentPage - 1) * PAGE_SIZE + 1, totalRows)} {s.t("to", "to")} {Math.min(currentPage * PAGE_SIZE, totalRows)} {s.t("of", "of")} {totalRows} {s.t("entries", "entries")}
                </span>
                <div className="flex items-center gap-1">
                  <button disabled={currentPage === 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} aria-label={s.t("prev", "Previous")} className="p-1.5 rounded-md border border-border/60 hover:bg-muted/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"><ChevronLeft className={cn("h-3.5 w-3.5", s.isRtl && "rotate-180")} /></button>
                  {pageNumbers.map((p, i) =>
                    p === "..." ? (
                      <span key={`e-${i}`} className="px-1.5 text-[11px] text-muted-foreground">...</span>
                    ) : (
                      <button key={p} onClick={() => setCurrentPage(p as number)} className={cn("h-7 w-7 rounded-md text-[11px] font-bold border transition-all", currentPage === p ? "bg-primary text-primary-foreground border-primary" : "border-border/60 hover:bg-muted/50 text-foreground")}>{p}</button>
                    )
                  )}
                  <button disabled={currentPage === totalPages} onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} aria-label={s.t("next", "Next")} className="p-1.5 rounded-md border border-border/60 hover:bg-muted/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"><ChevronRight className={cn("h-3.5 w-3.5", s.isRtl && "rotate-180")} /></button>
                </div>
              </div>
            )}
          </div>
        </div>

        {detailOpen && !isCompact && (
          <div className="w-80 xl:w-96 shrink-0 bg-card border border-border/70 rounded-xl shadow-sm overflow-hidden flex flex-col max-h-[calc(100vh-6rem)] sticky top-4">
            {detailHeader}
            {detailBody}
          </div>
        )}
      </div>

      {showSheet &&
        createPortal(
          <div role="dialog" aria-modal="true" dir={s.dir} className="fixed inset-0 z-[70] flex flex-col bg-background">
            {detailHeader}
            {detailBody}
          </div>,
          document.body
        )}

      <Dialog open={isAddEventOpen} onOpenChange={setIsAddEventOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto overflow-x-hidden grid-cols-[minmax(0,1fr)] [&>*]:min-w-0" dir={s.dir}>
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2"><Plus className="h-4 w-4 text-primary" />{s.t("event_title", "Record Journey Event & Milestone")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveEvent} className="space-y-4 text-xs [&_input]:min-w-0 [&_select]:min-w-0 [&_div]:min-w-0">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">{s.t("event_code", "Milestone Event")} *</Label>
              <select value={newEventCode} onChange={(e) => setNewEventCode(e.target.value as TrackingEventCode)} className="w-full h-9 rounded-xl border border-border bg-background px-3 font-semibold text-xs">
                {TRACKING_EVENT_CODES.map((code) => (<option key={code} value={code}>{eventLabel(code, TRACKING_EVENT_LABELS[code])}</option>))}
              </select>
            </div>
            {trackingData && trackingData.legs.length > 1 && (
              <div className="space-y-1">
                <Label className="text-xs font-semibold">{s.t("event_leg", "Transport leg")}</Label>
                <select value={newLegId} onChange={(e) => setNewLegId(e.target.value)} className="w-full h-9 rounded-xl border border-border bg-background px-3 font-semibold text-xs">
                  {trackingData.legs.map((l) => (<option key={l.id} value={l.id}>{s.t("leg", "Leg")} #{l.leg_no} — {modeLabel(l.transport_mode)}</option>))}
                </select>
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-xs font-semibold">{s.t("event_location", "Location / Current Port")}</Label>
              <Input value={newLocationName} onChange={(e) => setNewLocationName(e.target.value)} placeholder={s.t("event_location_ph", "e.g. Jebel Ali Port, Karachi Port, or Chaman Border")} className="h-9 text-xs rounded-xl" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-xs font-semibold">{s.t("lbl_vessel", "Vessel")}</Label><Input value={newVesselName} onChange={(e) => setNewVesselName(e.target.value)} className="h-9 text-xs rounded-xl" /></div>
              <div className="space-y-1"><Label className="text-xs font-semibold">{s.t("lbl_voyage", "Voyage")}</Label><Input value={newVoyageNumber} onChange={(e) => setNewVoyageNumber(e.target.value)} className="h-9 text-xs rounded-xl" dir="ltr" /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-xs font-semibold">{s.t("lbl_container", "Container")}</Label><Input value={newContainerNumber} onChange={(e) => setNewContainerNumber(e.target.value)} className="h-9 text-xs font-mono rounded-xl" dir="ltr" /></div>
              <div className="space-y-1"><Label className="text-xs font-semibold">{s.t("event_eta", "Revised ETA")}</Label><Input type="date" value={newEta} onChange={(e) => setNewEta(e.target.value)} className="h-9 text-xs rounded-xl" /></div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">{s.t("event_remarks", "Event Remarks / Notes")}</Label>
              <Input value={newRemarks} onChange={(e) => setNewRemarks(e.target.value)} placeholder={s.t("event_remarks_ph", "Notes on departure, transshipment, customs clearance...")} className="h-9 text-xs rounded-xl" />
            </div>
            {eventError && <p role="alert" className="text-[11px] font-semibold text-destructive">{eventError}</p>}
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsAddEventOpen(false)} className="rounded-xl text-xs font-bold">{s.t("cancel", "Cancel")}</Button>
              <Button type="submit" disabled={isSavingEvent} size="sm" className="rounded-xl text-xs font-bold">{isSavingEvent ? s.t("saving", "Saving...") : s.t("record_milestone", "Record Milestone")}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
