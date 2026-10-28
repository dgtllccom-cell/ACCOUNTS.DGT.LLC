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
import Link from "next/link";
import {
  Search, Ship, Truck, Train, Plane, Anchor, MapPin, CircleDot, Boxes, Plus, RefreshCw, ChevronRight, ChevronLeft,
  FileText, AlertCircle, Building2, Layers, X, Eye, Filter, Navigation, Activity, ArrowRight, Download, Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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

// Stage order of the ONE clearing / shipping pipeline; progress is derived from the real current_stage, never invented.
const STAGE_ORDER = ["booking", "loading", "truck_assignment", "goods_verification", "shipment_bl", "customs_clearing", "handover", "destination_review", "completed"] as const;
function stageProgress(stage: string) {
  if (stage === "completed") return 100;
  const i = STAGE_ORDER.indexOf(stage as (typeof STAGE_ORDER)[number]);
  if (i < 0) return 0;
  return Math.round(((i + 0.5) / STAGE_ORDER.length) * 100);
}
// An ETA in the past on a shipment that has not arrived is a real, actionable signal.
function isEtaOverdue(eta: string | null | undefined, stage: string) {
  if (!eta || stage === "completed" || stage === "destination_review") return false;
  const d = new Date(eta);
  if (Number.isNaN(d.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d.getTime() < today.getTime();
}

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
  const [drawerView, setDrawerView] = useState<"detail" | "event">("detail");
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

  const [isDesktop, setIsDesktop] = useState(false);
  const drawerRef = useRef<HTMLElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const on = () => setIsDesktop(mq.matches);
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
      setDrawerView("detail");
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
    setDrawerView("detail");
    setSelectedOrderId(id);
    setDetailTab(tab);
  };
  const closeDetail = () => {
    setSelectedOrderId(null);
    setTrackingData(null);
    setDrawerView("detail");
  };
  const drawerOpen = Boolean(selectedOrderId);

  // The detail drawer is a modal dialog: lock page scroll, move focus in, trap Tab, close on Escape, restore focus on close.
  useEffect(() => {
    if (!drawerOpen) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeBtnRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (drawerView === "event") setDrawerView("detail");
        else closeDetail();
        return;
      }
      if (e.key !== "Tab" || !drawerRef.current) return;
      const focusable = Array.from(
        drawerRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')
      ).filter((el) => el.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawerOpen, drawerView]);
  const activeFilterCount = (modeFilter !== "all" ? 1 : 0) + (statusFilter !== "all" ? 1 : 0);
  const canRecord = summary?.canRecord !== false;

  // ── presentational helpers (plain render functions, so nothing remounts on every state change) ──
  const ArrowIcon = ({ className = "h-3 w-3" }: { className?: string }) => <ArrowRight className={cn(className, s.isRtl && "rotate-180")} />;

  const modeBadges = (row: TrackingListRow) => (
    <span className="inline-flex flex-wrap items-center gap-1">
      {(row.legModes?.length ? row.legModes : [row.transportMode]).map((m) => (
        <span key={m} className={cn("inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-bold", modeBadgeClass(m))}>
          {modeIcon(m, "h-3 w-3")}
          {modeLabel(m)}
        </span>
      ))}
      {row.legCount > 1 ? <span className="text-[11px] font-bold text-muted-foreground">{row.legCount} {s.t("legs_short", "legs")}</span> : null}
    </span>
  );

  const statusPill = (stage: string, size: "sm" | "md" = "sm") => (
    <span className={cn("inline-flex items-center whitespace-nowrap rounded-full border font-bold", size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs", statusBadgeClass(stage))}>{statusLabel(stage)}</span>
  );

  const etaCell = (row: TrackingListRow) => (
    <div className="space-y-0.5">
      <div className="font-mono text-xs text-foreground/80 whitespace-nowrap" dir="ltr">{formatDate(row.eta)}</div>
      {isEtaOverdue(row.eta, row.currentStage) && (
        <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/10 px-1.5 py-0.5 text-[11px] font-bold text-rose-700 dark:text-rose-400">
          <Clock className="h-3 w-3" />{s.t("eta_overdue", "ETA passed")}
        </span>
      )}
    </div>
  );

  const kpiTile = (opts: { key: string; label: string; value: number | string; icon: React.ReactNode; tone: string; onClick?: () => void; active?: boolean; sub?: string }) => {
    const body = (
      <>
        <div className="flex items-center justify-between gap-2">
          <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-lg sm:h-8 sm:w-8", opts.tone)}>{opts.icon}</span>
          <span className="font-mono text-xl font-black leading-none sm:text-2xl tabular-nums text-foreground" dir="ltr">{summaryLoading && !summary ? <span className="inline-block h-6 w-10 animate-pulse rounded bg-muted" /> : opts.value}</span>
        </div>
        <div className="mt-2 min-w-0">
          <div className="text-xs font-bold leading-tight text-foreground">{opts.label}</div>
          {opts.sub ? <div className="mt-0.5 text-[11px] leading-tight text-muted-foreground">{opts.sub}</div> : null}
        </div>
      </>
    );
    const cls = cn(
      "block w-full min-w-0 rounded-xl border bg-card p-2.5 text-start shadow-sm transition-colors sm:p-3",
      opts.active ? "border-primary ring-1 ring-primary/40" : "border-border/70",
      opts.onClick && "hover:border-primary/50 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    );
    return opts.onClick ? (
      <button key={opts.key} type="button" onClick={opts.onClick} aria-pressed={opts.active} className={cls}>{body}</button>
    ) : (
      <div key={opts.key} className={cls}>{body}</div>
    );
  };

  const chip = (label: React.ReactNode, active: boolean, onClick: () => void, key: string, extra?: React.ReactNode) => (
    <button
      key={key}
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active ? "border-primary bg-primary text-primary-foreground" : "border-border/70 bg-background text-muted-foreground hover:text-foreground hover:bg-muted/40"
      )}
    >
      {label}
      {extra}
    </button>
  );

  const detailRow = (label: string, value: React.ReactNode, mono = false) => (
    <div key={label} className="min-w-0">
      <dt className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd dir={mono ? "ltr" : undefined} className={cn("mt-0.5 break-words text-sm font-semibold text-foreground", mono && "font-mono", mono && s.isRtl && "text-end")}>{value}</dd>
    </div>
  );

  // ── detail drawer ────────────────────────────────────────────────────────────
  const renderDetail = () => {
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
    const truck = td.activeLeg?.truck_number || td.activeLeg?.master_truck_number || null;
    const progress = stageProgress(td.shipment.current_stage);
    const sh = td.shipment;
    const facts: Array<[string, React.ReactNode, boolean?]> = [
      [s.t("col_customer", "Customer"), sh.customer_name || DASH],
      [s.t("col_shipping_line", "Shipping Line"), td.kpis.shippingLine],
      [s.t("col_vessel_voyage", "Vessel / Voyage"), `${td.kpis.vesselName}${isReal(td.kpis.voyageNumber) ? ` / ${td.kpis.voyageNumber}` : ""}`, true],
      [s.t("col_bl_no", "BL Number"), td.kpis.blNumber, true],
      [s.t("lbl_etd", "ETD"), formatDate(td.kpis.etd), true],
      [s.t("col_eta", "ETA"), formatDate(td.kpis.eta), true],
    ];
    if (truck) facts.push([s.t("lbl_truck", "Truck Number"), truck, true]);
    if (sh.goods_name) facts.push([s.t("lbl_goods", "Goods"), `${sh.goods_name}${sh.goods_quantity ? ` · ${sh.goods_quantity}${sh.goods_unit ? ` ${sh.goods_unit}` : ""}` : ""}`]);
    if (sh.goods_gross_weight) facts.push([s.t("lbl_weight", "Gross weight"), String(sh.goods_gross_weight), true]);
    if (isReal(td.kpis.lastUpdate)) facts.push([s.t("lbl_last_update", "Last update"), formatDateTime(td.kpis.lastUpdate), true]);

    return (
      <div className="flex-1 overflow-y-auto overscroll-contain">
        <div className="border-b border-border/60 bg-gradient-to-b from-primary/10 to-transparent px-4 pb-4 pt-4 sm:px-5">
          <div className="flex flex-wrap items-center gap-2">
            {statusPill(sh.current_stage, "md")}
            <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/5 px-2.5 py-1 text-xs font-bold text-primary"><Activity className="h-3 w-3" />{s.t("live_tracking", "Live Tracking")}</span>
            <span className="inline-flex flex-wrap gap-1">{(td.legs.length ? td.legs : [{ transport_mode: sh.transport_mode, id: "x" }]).map((l: any, i: number) => (
              <span key={l.id || i} className={cn("inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-bold", modeBadgeClass(l.transport_mode))}>{modeIcon(l.transport_mode, "h-3 w-3")}{modeLabel(l.transport_mode)}</span>
            ))}</span>
          </div>
          <div className="mt-3 break-all font-mono text-xl font-black leading-tight text-foreground" dir="ltr">{isReal(td.kpis.containerNumber) ? td.kpis.containerNumber : sh.order_no}</div>
          <div className="mt-0.5 font-mono text-xs text-muted-foreground" dir="ltr">{sh.order_no}</div>

          <div className="mt-4">
            <div className="flex items-center justify-between gap-3 text-sm font-bold text-foreground">
              <span className="min-w-0 break-words">{td.kpis.pol}</span>
              <ArrowIcon className="h-4 w-4 shrink-0 text-primary" />
              <span className="min-w-0 break-words text-end">{td.kpis.pod}</span>
            </div>
            <div
              role="progressbar"
              aria-label={s.t("progress", "Journey progress")}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
              className="mt-2 h-2 overflow-hidden rounded-full bg-muted"
            >
              <div className={cn("h-full rounded-full transition-all", sh.current_stage === "delayed" ? "bg-rose-500" : sh.current_stage === "completed" ? "bg-emerald-500" : "bg-primary")} style={{ width: `${progress}%`, marginInlineEnd: "auto" }} />
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>{s.t("progress", "Journey progress")}</span>
              <span className="font-mono font-bold" dir="ltr">{progress}%</span>
            </div>
          </div>

          <div className="mt-3 flex items-start gap-2 rounded-xl border border-primary/20 bg-card/80 p-3">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div className="min-w-0">
              <div className="text-[11px] font-bold uppercase tracking-wide text-primary">{s.t("tab_location", "Current Location")}</div>
              <div className="break-words text-sm font-black text-foreground">{td.kpis.currentLocation}</div>
              {td.events[0] && <div className="mt-0.5 font-mono text-[11px] text-muted-foreground" dir="ltr">{formatDateTime(td.events[0].event_time)}</div>}
            </div>
          </div>
        </div>

        <dl className="grid grid-cols-1 gap-x-4 gap-y-3 border-b border-border/60 px-4 py-4 min-[420px]:grid-cols-2 sm:px-5">
          {facts.map(([label, value, mono]) => detailRow(label, value, mono))}
        </dl>

        <div role="tablist" aria-label={s.t("detail_tabs", "Shipment details")} className="sticky top-0 z-10 flex border-b border-border/60 bg-card">
          {tabs.map((tab, i) => (
            <button
              key={tab}
              id={`trk-tab-${tab}`}
              role="tab"
              type="button"
              aria-selected={detailTab === tab}
              aria-controls={`trk-panel-${tab}`}
              tabIndex={detailTab === tab ? 0 : -1}
              onClick={() => setDetailTab(tab)}
              onKeyDown={(e) => onTabKey(e, i)}
              className={cn("min-h-11 flex-1 border-b-2 px-2 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring", detailTab === tab ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}
            >
              {tab === "location" ? s.t("timeline_short", "Timeline") : tab === "journey" ? s.t("tab_journey", "Journey") : s.t("tab_documents", "Documents")}
            </button>
          ))}
        </div>

        {detailTab === "location" && (
          <div role="tabpanel" id="trk-panel-location" aria-labelledby="trk-tab-location" className="px-4 py-4 sm:px-5">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{s.t("timeline_title", "Complete Journey Timeline")}</p>
            {td.events.length === 0 ? (
              <div className="rounded-xl border border-dashed bg-muted/20 py-8 text-center"><p className="text-xs text-muted-foreground">{s.t("no_events", "No events logged yet.")}</p></div>
            ) : (
              <ol className="relative space-y-4 ps-6 before:absolute before:start-[9px] before:top-2 before:bottom-2 before:w-0.5 before:bg-border/80">
                {td.events.map((ev, idx) => {
                  const isLatest = idx === 0;
                  const leg = td.legs.find((l) => l.id === ev.leg_id);
                  return (
                    <li key={ev.id || idx} className="relative">
                      <div className={cn("absolute -start-6 top-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2", isLatest ? "border-primary bg-primary text-primary-foreground" : ev.status === "completed" ? "border-emerald-500 bg-emerald-500 text-white" : "border-muted-foreground/50 bg-background")}>
                        {isLatest ? <CircleDot className="h-3 w-3" /> : <div className="h-1.5 w-1.5 rounded-full bg-current" />}
                      </div>
                      <div className="text-xs">
                        <div className="flex items-start justify-between gap-2">
                          <span className={cn("text-sm font-bold", isLatest ? "text-primary" : "text-foreground")}>{eventLabel(ev.event_code, ev.event_name)}</span>
                          {leg && <span className={cn("inline-flex shrink-0 items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-bold", modeBadgeClass(leg.transport_mode))}>{modeIcon(leg.transport_mode, "h-3 w-3")}#{leg.leg_no}</span>}
                        </div>
                        <p className="font-mono text-[11px] text-muted-foreground" dir="ltr">{formatDateTime(ev.event_time)}</p>
                        {ev.location_name && <p className="mt-0.5 flex items-center gap-1 text-foreground/80"><MapPin className="h-3 w-3 shrink-0 text-primary" />{ev.location_name}</p>}
                        {ev.remarks && <p className="mt-0.5 italic text-muted-foreground">{ev.remarks}</p>}
                      </div>
                    </li>
                  );
                })}
                {td.kpis.eta && (
                  <li className="relative opacity-70">
                    <div className="absolute -start-6 top-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/50 bg-background"><div className="h-1.5 w-1.5 rounded-full bg-muted-foreground" /></div>
                    <div className="text-xs">
                      <span className="text-sm font-bold text-muted-foreground">{s.t("expected_arrival", "Expected Arrival")}</span>
                      <p className="font-mono text-[11px] text-muted-foreground" dir="ltr">{formatDate(td.kpis.eta)}</p>
                      <p className="mt-0.5 flex items-center gap-1 text-muted-foreground"><MapPin className="h-3 w-3" />{td.kpis.pod}</p>
                    </div>
                  </li>
                )}
              </ol>
            )}
            <p className="mt-5 flex items-start gap-2 rounded-lg bg-muted/40 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {s.t("data_source_note", "Milestones are recorded by your team from carrier, port and driver updates. No automatic live feed is shown.")}
            </p>
          </div>
        )}

        {detailTab === "journey" && (
          <div role="tabpanel" id="trk-panel-journey" aria-labelledby="trk-tab-journey" className="space-y-3 px-4 py-4 sm:px-5">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{s.t("multi_leg_title", "Multi-Leg Movement Sequence")} ({td.legs.length})</p>
            {td.legs.map((leg, idx) => {
              const isActive = leg.id === td.activeLeg?.id;
              const legEvents = eventsByLeg(leg.id);
              const kv = (label: string, value: unknown, mono = true) =>
                value ? (
                  <div key={label} className="flex justify-between gap-3"><span className="text-muted-foreground">{label}</span><strong dir={mono ? "ltr" : undefined} className={cn("break-all text-end text-foreground", mono && "font-mono")}>{String(value)}</strong></div>
                ) : null;
              return (
                <div key={leg.id || idx} className={cn("space-y-2 rounded-xl border p-3", isActive ? "border-primary bg-primary/5" : leg.status === "completed" ? "border-emerald-500/30 bg-emerald-500/5" : "border-border/60 bg-card")}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-xs font-black uppercase">{modeIcon(leg.transport_mode, "h-4 w-4")}{s.t("leg", "Leg")} #{leg.leg_no}: {modeLabel(leg.transport_mode)}</span>
                    <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-bold", isActive ? "border-primary bg-primary text-primary-foreground" : leg.status === "completed" ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "border-border/60 bg-muted text-muted-foreground")}>
                      {isActive ? s.t("leg_active", "Active") : legStatusLabel(leg.status)}
                    </span>
                  </div>
                  <p className="flex flex-wrap items-center gap-1.5 text-sm font-bold text-foreground">
                    {leg.from_location_text || leg.port_of_loading || leg.from_country_name || s.t("origin", "Origin")} <ArrowIcon className="h-3.5 w-3.5 text-muted-foreground" /> {leg.to_location_text || leg.port_of_discharge || leg.to_country_name || s.t("destination", "Destination")}
                  </p>
                  <div className="space-y-1 text-xs">
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
                    <ul className="space-y-1 border-t border-border/50 pt-2">
                      {legEvents.slice(0, 6).map((ev) => (
                        <li key={ev.id} className="flex items-start justify-between gap-2 text-xs">
                          <span className="font-semibold text-foreground">{eventLabel(ev.event_code, ev.event_name)}{ev.location_name ? ` · ${ev.location_name}` : ""}</span>
                          <span className="shrink-0 font-mono text-[11px] text-muted-foreground" dir="ltr">{formatDateTime(ev.event_time)}</span>
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
          <div role="tabpanel" id="trk-panel-documents" aria-labelledby="trk-tab-documents" className="space-y-5 px-4 py-4 sm:px-5">
            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{s.t("linked_documents", "Linked Documents")}</p>
              <div className="space-y-2">
                {td.blRecord && (
                  <div className="flex items-center gap-3 rounded-xl border border-border/60 p-3">
                    <div className="rounded-lg bg-blue-500/10 p-2"><FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" /></div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-foreground">{s.t("doc_bl", "Bill of Lading")}</p>
                      <p className="truncate font-mono text-[11px] text-muted-foreground" dir="ltr">{td.kpis.blNumber}</p>
                    </div>
                  </div>
                )}
                {td.handover && (
                  <div className="flex items-center gap-3 rounded-xl border border-border/60 p-3">
                    <div className="rounded-lg bg-emerald-500/10 p-2"><Layers className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /></div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-foreground">{s.t("doc_handover", "Business Handover")}</p>
                      <p className="truncate font-mono text-[11px] text-muted-foreground" dir="ltr">#{td.handover.handover_no}</p>
                    </div>
                  </div>
                )}
                {td.legs.filter((l) => l.customs_receipt_ref || l.bill_of_entry_no || l.declaration_reference).map((l) => (
                  <div key={`c-${l.id}`} className="flex items-center gap-3 rounded-xl border border-border/60 p-3">
                    <div className="rounded-lg bg-amber-500/10 p-2"><FileText className="h-4 w-4 text-amber-600" /></div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-foreground">{s.t("doc_customs", "Customs")} · {s.t("leg", "Leg")} #{l.leg_no}</p>
                      <p className="truncate font-mono text-[11px] text-muted-foreground" dir="ltr">{[l.customs_receipt_ref, l.bill_of_entry_no, l.declaration_reference].filter(Boolean).join(" · ")}</p>
                    </div>
                  </div>
                ))}
                {!td.blRecord && !td.handover && !td.legs.some((l) => l.customs_receipt_ref || l.bill_of_entry_no || l.declaration_reference) && (
                  <div className="rounded-xl border border-dashed bg-muted/20 py-6 text-center">
                    <FileText className="mx-auto mb-2 h-6 w-6 text-muted-foreground/40" />
                    <p className="text-xs text-muted-foreground">{s.t("no_documents", "No linked documents yet.")}</p>
                  </div>
                )}
              </div>
            </div>

            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{s.t("connected_records", "Connected ERP records")}</p>
              <div className="grid gap-2">
                {[
                  { href: `/dashboard/clearing-agent/customer-order/${sh.id}/workflow`, label: s.t("open_customer_order", "Open customer order"), sub: sh.order_no, icon: <Layers className="h-4 w-4" />, show: true },
                  { href: "/dashboard/shipping-line/bl-entry", label: s.t("open_bl_entry", "Open BL entry"), sub: isReal(td.kpis.blNumber) ? td.kpis.blNumber : "", icon: <FileText className="h-4 w-4" />, show: Boolean(td.blRecord) || isReal(td.kpis.blNumber) },
                  { href: "/dashboard/clearing-agent/truck-registration", label: s.t("open_truck_register", "Open truck register"), sub: truck || "", icon: <Truck className="h-4 w-4" />, show: Boolean(truck) },
                ].filter((l) => l.show).map((l) => (
                  <Link key={l.href} href={l.href} className="flex min-h-12 items-center gap-3 rounded-xl border border-border/60 bg-card p-3 text-start transition-colors hover:border-primary/50 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">{l.icon}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-bold text-foreground">{l.label}</span>
                      {l.sub ? <span className="block truncate font-mono text-[11px] text-muted-foreground" dir="ltr">{l.sub}</span> : null}
                    </span>
                    <ChevronRight className={cn("h-4 w-4 shrink-0 text-muted-foreground", s.isRtl && "rotate-180")} />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderEventForm = () => (
    <form onSubmit={handleSaveEvent} className="flex min-h-0 flex-1 flex-col text-sm">
      <div className="flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
        <div className="space-y-1.5">
          <Label htmlFor="trk-ev-code" className="text-xs font-bold">{s.t("event_code", "Milestone Event")} *</Label>
          <select id="trk-ev-code" value={newEventCode} onChange={(e) => setNewEventCode(e.target.value as TrackingEventCode)} className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-semibold sm:h-10">
            {TRACKING_EVENT_CODES.map((code) => (<option key={code} value={code}>{eventLabel(code, TRACKING_EVENT_LABELS[code])}</option>))}
          </select>
        </div>
        {trackingData && trackingData.legs.length > 1 && (
          <div className="space-y-1.5">
            <Label htmlFor="trk-ev-leg" className="text-xs font-bold">{s.t("event_leg", "Transport leg")}</Label>
            <select id="trk-ev-leg" value={newLegId} onChange={(e) => setNewLegId(e.target.value)} className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-semibold sm:h-10">
              {trackingData.legs.map((l) => (<option key={l.id} value={l.id}>{s.t("leg", "Leg")} #{l.leg_no} — {modeLabel(l.transport_mode)}</option>))}
            </select>
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="trk-ev-loc" className="text-xs font-bold">{s.t("event_location", "Location / Current Port")}</Label>
          <Input id="trk-ev-loc" value={newLocationName} onChange={(e) => setNewLocationName(e.target.value)} placeholder={s.t("event_location_ph", "e.g. Jebel Ali Port, Karachi Port, or Chaman Border")} className="h-11 rounded-xl text-sm sm:h-10" />
        </div>
        <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
          <div className="space-y-1.5"><Label htmlFor="trk-ev-vessel" className="text-xs font-bold">{s.t("lbl_vessel", "Vessel")}</Label><Input id="trk-ev-vessel" value={newVesselName} onChange={(e) => setNewVesselName(e.target.value)} className="h-11 rounded-xl text-sm sm:h-10" /></div>
          <div className="space-y-1.5"><Label htmlFor="trk-ev-voyage" className="text-xs font-bold">{s.t("lbl_voyage", "Voyage")}</Label><Input id="trk-ev-voyage" value={newVoyageNumber} onChange={(e) => setNewVoyageNumber(e.target.value)} className="h-11 rounded-xl text-sm sm:h-10" dir="ltr" /></div>
          <div className="space-y-1.5"><Label htmlFor="trk-ev-cont" className="text-xs font-bold">{s.t("lbl_container", "Container")}</Label><Input id="trk-ev-cont" value={newContainerNumber} onChange={(e) => setNewContainerNumber(e.target.value)} className="h-11 rounded-xl font-mono text-sm sm:h-10" dir="ltr" /></div>
          <div className="space-y-1.5"><Label htmlFor="trk-ev-eta" className="text-xs font-bold">{s.t("event_eta", "Revised ETA")}</Label><Input id="trk-ev-eta" type="date" value={newEta} onChange={(e) => setNewEta(e.target.value)} className="h-11 rounded-xl text-sm sm:h-10" /></div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="trk-ev-remarks" className="text-xs font-bold">{s.t("event_remarks", "Event Remarks / Notes")}</Label>
          <Input id="trk-ev-remarks" value={newRemarks} onChange={(e) => setNewRemarks(e.target.value)} placeholder={s.t("event_remarks_ph", "Notes on departure, transshipment, customs clearance...")} className="h-11 rounded-xl text-sm sm:h-10" />
        </div>
        {eventError && <p role="alert" className="text-xs font-semibold text-destructive">{eventError}</p>}
      </div>
      <div className="flex gap-2 border-t border-border/60 bg-card px-4 py-3 sm:ps-5 sm:pe-20">
        <Button type="button" variant="outline" onClick={() => { setDrawerView("detail"); setEventError(""); }} className="h-11 flex-1 rounded-xl text-sm font-bold sm:h-10">{s.t("cancel", "Cancel")}</Button>
        <Button type="submit" disabled={isSavingEvent} className="h-11 flex-1 rounded-xl text-sm font-bold sm:h-10">{isSavingEvent ? s.t("saving", "Saving...") : s.t("record_milestone", "Record Milestone")}</Button>
      </div>
    </form>
  );

  const drawerTitle = drawerView === "event" ? s.t("event_title", "Record Journey Event & Milestone") : s.t("detail_title", "Container Details");

  const drawer =
    drawerOpen && typeof document !== "undefined"
      ? createPortal(
          <div className="fixed inset-0 z-[70]" dir={s.dir}>
            <div className="absolute inset-0 bg-black/50" onClick={closeDetail} aria-hidden="true" />
            <aside
              ref={drawerRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="trk-drawer-title"
              data-shtrk-detail
              className="absolute flex flex-col overflow-hidden bg-card shadow-2xl max-sm:inset-2 max-sm:rounded-2xl sm:inset-y-0 sm:end-0 sm:w-[34rem] sm:max-w-[92vw] sm:border-s sm:border-border"
            >
              <div className="flex items-center justify-between gap-2 border-b border-border/60 bg-muted/30 px-4 py-3 sm:px-5">
                <div className="flex min-w-0 items-center gap-2">
                  {drawerView === "event" ? (
                    <button type="button" onClick={() => setDrawerView("detail")} aria-label={s.t("back_to_list", "Back to list")} className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <ChevronLeft className={cn("h-5 w-5", s.isRtl && "rotate-180")} />
                    </button>
                  ) : (
                    <Ship className="h-5 w-5 shrink-0 text-primary" />
                  )}
                  <h2 id="trk-drawer-title" className="truncate text-sm font-black uppercase tracking-wide text-foreground">{drawerTitle}</h2>
                </div>
                <div className="flex items-center gap-1.5">
                  {drawerView === "detail" && canRecord && trackingData && (
                    <Button type="button" size="sm" data-shtrk-add-event onClick={() => { setEventError(""); setDrawerView("event"); }} className="h-10 gap-1.5 rounded-lg text-xs sm:h-9"><Plus className="h-3.5 w-3.5" />{s.t("add_event", "Add Event")}</Button>
                  )}
                  <button ref={closeBtnRef} type="button" data-shtrk-close onClick={closeDetail} aria-label={s.t("close", "Close")} className="grid h-10 w-10 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {drawerView === "event" && trackingData ? (
                renderEventForm()
              ) : detailLoading ? (
                <div className="flex flex-1 items-center justify-center p-12 text-center">
                  <div>
                    <RefreshCw className="mx-auto mb-2 h-6 w-6 animate-spin text-primary" />
                    <p className="text-xs text-muted-foreground">{s.t("loading_journey", "Loading shipment journey...")}</p>
                  </div>
                </div>
              ) : detailError ? (
                <div className="flex flex-1 items-center justify-center p-8 text-center">
                  <div>
                    <AlertCircle className="mx-auto mb-2 h-6 w-6 text-destructive" />
                    <p className="text-sm font-bold text-destructive">{detailError}</p>
                    <Button type="button" variant="outline" size="sm" className="mt-3 h-10" onClick={() => selectedOrderId && void loadDetail(selectedOrderId)}>{s.t("refresh", "Refresh")}</Button>
                  </div>
                </div>
              ) : trackingData ? (
                renderDetail()
              ) : null}
            </aside>
          </div>,
          document.body
        )
      : null;

  // ── list pieces ──────────────────────────────────────────────────────────────
  const skeletonRows = (
    <div className="divide-y divide-border/40" aria-hidden="true">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4">
          <div className="h-4 w-28 animate-pulse rounded bg-muted" />
          <div className="h-4 flex-1 animate-pulse rounded bg-muted/70" />
          <div className="hidden h-4 w-20 animate-pulse rounded bg-muted sm:block" />
          <div className="h-6 w-20 animate-pulse rounded-full bg-muted" />
        </div>
      ))}
    </div>
  );

  const emptyState = (
    <div data-shtrk-empty className="px-4 py-14 text-center">
      <span className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-muted"><Ship className="h-7 w-7 text-muted-foreground/60" /></span>
      <p className="text-sm font-bold text-foreground">{s.t("no_records", "No tracking records found.")}</p>
      {(searchQuery || activeFilterCount > 0) && (
        <>
          <p className="mt-1 text-xs text-muted-foreground">{s.t("adjust_filters", "Try adjusting your search or filters.")}</p>
          <Button type="button" variant="outline" size="sm" className="mt-3 h-10" onClick={() => { setSearchQuery(""); setModeFilter("all"); setStatusFilter("all"); setViewTab("all"); }}>{s.t("clear_filters", "Clear filters")}</Button>
        </>
      )}
    </div>
  );

  const refs = (row: TrackingListRow) =>
    [row.shippingLine, row.vesselVoyage, transportRef(row)].filter((v) => isReal(v));

  const tableView = (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/60 bg-muted/30">
            {[
              s.t("col_shipment_no", "Shipment No"),
              s.t("col_container_no", "Container No") + " / " + s.t("col_bl_no", "BL No"),
              s.t("col_shipping_line", "Shipping Line") + " · " + s.t("col_vessel_voyage", "Vessel / Voyage"),
              s.t("col_from", "From") + " → " + s.t("col_to", "To"),
              s.t("col_mode", "Mode"),
              s.t("col_eta", "ETA"),
              s.t("col_status", "Status"),
            ].map((label, i) => (
              <th key={i} scope="col" style={{ textAlign: "start" }} className="px-3 py-3 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{label}</th>
            ))}
            <th scope="col" className="w-10 px-2 py-3"><span className="sr-only">{s.t("col_actions", "Actions")}</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/40">
          {listRows.map((row) => {
            const isSelected = selectedOrderId === row.id;
            const rr = refs(row);
            return (
              <tr key={row.id} data-shtrk-row className={cn("cursor-pointer align-top transition-colors hover:bg-muted/30", isSelected && "bg-primary/5")} onClick={() => openDetail(row.id)}>
                <td className="px-3 py-3">
                  <button type="button" data-shtrk-open onClick={(e) => { e.stopPropagation(); openDetail(row.id); }} className="break-all text-start font-mono text-sm font-black text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" dir="ltr">{row.orderNo}</button>
                  <div className="mt-0.5 max-w-[14rem] break-words text-xs text-muted-foreground">{row.customerName}</div>
                </td>
                <td className="px-3 py-3 font-mono text-xs" dir="ltr">
                  <div className={cn("font-bold", isReal(row.containerNumber) ? "text-foreground" : "text-muted-foreground")}>{row.containerNumber}</div>
                  <div className="mt-0.5 text-muted-foreground">{row.blNumber}</div>
                </td>
                <td className="px-3 py-3 text-xs">
                  {rr.length ? rr.slice(0, 2).map((v, i) => <div key={i} className={cn("max-w-[13rem] break-words", i === 0 ? "font-semibold text-foreground" : "mt-0.5 font-mono text-muted-foreground")}>{v}</div>) : <span className="text-muted-foreground">{DASH}</span>}
                </td>
                <td className="px-3 py-3 text-xs">
                  <div className="flex max-w-[15rem] flex-wrap items-center gap-1 font-semibold text-foreground"><span className="break-words">{row.from}</span><ArrowIcon className="h-3 w-3 text-muted-foreground" /><span className="break-words">{row.to}</span></div>
                  {isReal(row.currentLocation) && <div className="mt-1 flex max-w-[15rem] items-center gap-1 text-muted-foreground"><MapPin className="h-3 w-3 shrink-0 text-primary" /><span className="break-words">{row.currentLocation}</span></div>}
                </td>
                <td className="px-3 py-3">{modeBadges(row)}</td>
                <td className="px-3 py-3">{etaCell(row)}</td>
                <td className="px-3 py-3">{statusPill(row.currentStage)}</td>
                <td className="px-2 py-3">
                  <button type="button" onClick={(e) => { e.stopPropagation(); openDetail(row.id); }} aria-label={s.t("view_details", "View Details")} title={s.t("view_details", "View Details")} className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <ChevronRight className={cn("h-4 w-4", s.isRtl && "rotate-180")} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const cardView = (
    <ul className="grid grid-cols-1 gap-3 p-3 md:grid-cols-2">
      {listRows.map((row) => {
        const rr = refs(row);
        return (
          <li key={row.id} data-shtrk-row onClick={() => openDetail(row.id)} className={cn("min-w-0 cursor-pointer space-y-2.5 rounded-xl border bg-card p-3.5 shadow-sm transition-colors hover:border-primary/40", selectedOrderId === row.id ? "border-primary bg-primary/5" : "border-border/70")}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <button type="button" data-shtrk-open onClick={(e) => { e.stopPropagation(); openDetail(row.id); }} className="break-all text-start font-mono text-base font-black text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" dir="ltr">{row.orderNo}</button>
                <div className="break-words text-xs text-muted-foreground">{row.customerName}</div>
              </div>
              {statusPill(row.currentStage)}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">{modeBadges(row)}{etaCell(row)}</div>
            <div className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-foreground"><MapPin className="h-3.5 w-3.5 shrink-0 text-primary" /><span className="break-words">{row.from}</span><ArrowIcon className="h-3.5 w-3.5 text-muted-foreground" /><span className="break-words">{row.to}</span></div>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
              <div className="min-w-0"><dt className="text-[11px] font-bold uppercase text-muted-foreground">{s.t("col_container_no", "Container No")}</dt><dd className="break-all font-mono" dir="ltr">{row.containerNumber}</dd></div>
              <div className="min-w-0"><dt className="text-[11px] font-bold uppercase text-muted-foreground">{s.t("col_bl_no", "BL No")}</dt><dd className="break-all font-mono" dir="ltr">{row.blNumber}</dd></div>
              {rr.length > 0 && <div className="col-span-2 min-w-0"><dt className="text-[11px] font-bold uppercase text-muted-foreground">{s.t("col_shipping_line", "Shipping Line")} · {s.t("col_vessel_voyage", "Vessel / Voyage")}</dt><dd className="break-words">{rr.join(" · ")}</dd></div>}
              {isReal(row.currentLocation) && <div className="col-span-2 min-w-0"><dt className="text-[11px] font-bold uppercase text-muted-foreground">{s.t("col_current_location", "Current Location")}</dt><dd className="break-words">{row.currentLocation}</dd></div>}
            </dl>
            <Button type="button" variant="outline" onClick={(e) => { e.stopPropagation(); openDetail(row.id); }} className="h-11 w-full gap-1.5 rounded-lg text-sm font-semibold"><Eye className="h-4 w-4" />{s.t("view_details", "View Details")}</Button>
          </li>
        );
      })}
    </ul>
  );

  // ── Render ───────────────────────────────────────────────────────────────────
  const sm = summary?.shipmentSummary;
  const bu = summary?.branchUser;
  const modeCounts: Record<string, number | undefined> = { by_sea: summary?.movementByMode.bySea, by_road: summary?.movementByMode.byRoad, by_air: summary?.movementByMode.byAir, by_rail: summary?.movementByMode.byRail };

  return (
    <div className="min-w-0 space-y-4" dir={s.dir} data-shtrk-root>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2.5 text-xl font-black tracking-tight text-foreground sm:text-2xl">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Anchor className="h-5 w-5" /></span>
            <span className="min-w-0">{title || s.t("title", "Container & Vessel Tracking")}</span>
          </h1>
          <p className="mt-1.5 max-w-3xl text-sm text-muted-foreground">{description || s.t("subtitle", "Track shipments, containers and vessels in real-time with complete journey details.")}</p>
          {bu && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1"><Building2 className="h-3 w-3" />{bu.isSuperAdmin ? s.t("all_branches", "All Branches (Global)") : bu.branchName || DASH}</span>
              {!bu.isSuperAdmin && bu.countryName ? <span className="rounded-full bg-muted px-2 py-1">{bu.countryName}</span> : null}
              <span className="rounded-full bg-muted px-2 py-1">{bu.userName} · {bu.roleKey ? s.tGlobal(`role.${bu.roleKey}`, bu.roleLabel) : bu.roleLabel}</span>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={() => { void loadSummary(); void loadList(); if (selectedOrderId) void loadDetail(selectedOrderId); }} className="h-10 gap-1.5 text-xs sm:h-9">
            <RefreshCw className={cn("h-3.5 w-3.5", (listLoading || summaryLoading) && "animate-spin")} />
            {s.t("refresh", "Refresh")}
          </Button>
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
            variant="outline"
            className="h-10 sm:h-9"
          />
          <Button type="button" variant="outline" onClick={() => void exportCsv()} className="h-10 gap-1.5 text-xs sm:h-9">
            <Download className="h-3.5 w-3.5" />
            {s.t("export_csv", "Export CSV")}
          </Button>
        </div>
      </header>

      {toast && (
        <div role="status" className={cn("rounded-lg border px-3 py-2 text-xs font-semibold", toast.kind === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-700")}>{toast.text}</div>
      )}

      <section aria-label={s.t("card_summary", "Shipment & Container Summary")}>
        <div className="grid grid-cols-3 gap-2 sm:gap-2.5 xl:grid-cols-6">
          {kpiTile({ key: "total", label: s.t("lbl_total_shipments", "Total Shipments"), value: sm?.totalShipments ?? 0, icon: <Boxes className="h-4 w-4 text-slate-600 dark:text-slate-300" />, tone: "bg-slate-500/10", onClick: () => { setStatusFilter("all"); setModeFilter("all"); setViewTab("all"); }, active: statusFilter === "all" && modeFilter === "all", sub: `${s.t("lbl_total_containers", "Total Containers")}: ${sm?.totalContainers ?? 0}` })}
          {kpiTile({ key: "transit", label: s.t("lbl_in_transit", "In Transit"), value: sm?.inTransit ?? 0, icon: <Navigation className="h-4 w-4 text-blue-600 dark:text-blue-400" />, tone: "bg-blue-500/10" })}
          {kpiTile({ key: "arrived", label: s.t("st_destination_review", "Arrived"), value: sm?.arrived ?? 0, icon: <Anchor className="h-4 w-4 text-teal-600 dark:text-teal-400" />, tone: "bg-teal-500/10", onClick: () => setStatusFilter("destination_review"), active: statusFilter === "destination_review" })}
          {kpiTile({ key: "delivered", label: s.t("st_completed", "Delivered"), value: sm?.delivered ?? 0, icon: <CircleDot className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />, tone: "bg-emerald-500/10", onClick: () => setStatusFilter("completed"), active: statusFilter === "completed" })}
          {kpiTile({ key: "pending", label: s.t("lbl_pending", "Pending"), value: sm?.pending ?? 0, icon: <Clock className="h-4 w-4 text-orange-600 dark:text-orange-400" />, tone: "bg-orange-500/10", onClick: () => setStatusFilter("booking"), active: statusFilter === "booking" })}
          {kpiTile({ key: "delayed", label: s.t("lbl_delayed", "Delayed / Pending"), value: summary?.trackingStatus.delayedPending ?? 0, icon: <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400" />, tone: "bg-rose-500/10", onClick: () => setStatusFilter("delayed"), active: statusFilter === "delayed" })}
        </div>
        <p className="mt-1.5 text-[11px] text-muted-foreground">{s.t("kpi_hint", "Tap a figure to filter the list.")}</p>
      </section>

      <section className="min-w-0 overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
        <div className="space-y-3 border-b border-border/60 p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <Ship className="h-4 w-4 shrink-0 text-primary" />
              <h2 className="text-sm font-black text-foreground">{s.t("list_title", "Shipment & Container Tracking List")}</h2>
              <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[11px] font-bold text-muted-foreground" dir="ltr" aria-label={s.t("total_records", "Total Records")}>{totalRows}</span>
            </div>
            <div role="tablist" aria-label={s.t("list_views", "List views")} className="flex items-center gap-0.5 rounded-lg bg-muted/50 p-0.5 text-xs">
              {(["all", "containers", "shipments", "trucks"] as const).map((tab) => (
                <button key={tab} type="button" role="tab" aria-selected={viewTab === tab} onClick={() => setViewTab(tab)} className={cn("min-h-9 rounded-md px-2.5 font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", viewTab === tab ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                  {s.t(`view_${tab}`, tab === "all" ? "All" : tab.charAt(0).toUpperCase() + tab.slice(1))}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select aria-label={s.t("search_field", "Search in")} value={searchField} onChange={(e) => setSearchField(e.target.value as SearchField)} className="h-11 rounded-xl border border-border/70 bg-background px-2.5 text-xs font-semibold sm:h-10">
              {SEARCH_FIELDS.map((f) => (<option key={f} value={f}>{s.t(`field_${f}`, f === "all" ? "All fields" : f)}</option>))}
            </select>
            <div className="relative min-w-[12rem] flex-1">
              <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label={s.t("search_field", "Search in")}
                placeholder={s.t("search_ph", "Search by Shipment No, BL, Container, Vessel, Voyage, Customer, Shipping Line...")}
                className="h-11 rounded-xl bg-background ps-9 pe-9 text-sm sm:h-10"
              />
              {searchQuery && (
                <button type="button" onClick={() => setSearchQuery("")} aria-label={s.t("clear_search", "Clear search")} className="absolute end-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <Button type="button" variant={filtersOpen ? "default" : "outline"} aria-expanded={filtersOpen} onClick={() => setFiltersOpen(!filtersOpen)} className="h-11 gap-1.5 rounded-xl text-xs sm:h-10 md:hidden">
              <Filter className="h-4 w-4" />
              {s.t("filters", "Filters")}
              {activeFilterCount > 0 && <Badge className="ms-0.5 flex h-4 w-4 items-center justify-center rounded-full p-0 text-[11px] leading-none">{activeFilterCount}</Badge>}
            </Button>
          </div>

          <div className={cn("space-y-2", filtersOpen ? "block" : "hidden", "md:block")}>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="me-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{s.t("col_mode", "Mode")}</span>
              {chip(s.t("all", "All"), modeFilter === "all", () => setModeFilter("all"), "mode-all")}
              {MODES.map((m) => chip(<>{modeIcon(m, "h-3.5 w-3.5")}{modeLabel(m)}</>, modeFilter === m, () => setModeFilter(m), `mode-${m}`, <span className="font-mono text-[11px] opacity-80" dir="ltr">{modeCounts[m] ?? 0}</span>))}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="me-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{s.t("col_status", "Status")}</span>
              {chip(s.t("all", "All"), statusFilter === "all", () => setStatusFilter("all"), "st-all")}
              {STATUSES.map((v) => chip(statusLabel(v), statusFilter === v, () => setStatusFilter(v), `st-${v}`))}
              {activeFilterCount > 0 && (
                <button type="button" onClick={() => { setModeFilter("all"); setStatusFilter("all"); }} className="ms-auto inline-flex min-h-9 items-center gap-1 px-2 text-xs font-semibold text-muted-foreground hover:text-destructive">
                  <X className="h-3.5 w-3.5" /> {s.t("clear_filters", "Clear filters")}
                </button>
              )}
            </div>
          </div>
        </div>

        <div aria-busy={listLoading}>
          {listLoading && listRows.length === 0 ? (
            <>
              <p className="sr-only" role="status">{s.t("loading_records", "Loading records...")}</p>
              {skeletonRows}
            </>
          ) : listError ? (
            <div className="px-4 py-12 text-center">
              <AlertCircle className="mx-auto mb-2 h-6 w-6 text-destructive" />
              <p className="text-sm font-semibold text-destructive">{listError}</p>
              <Button type="button" variant="outline" size="sm" className="mt-3 h-10" onClick={() => void loadList()}>{s.t("refresh", "Refresh")}</Button>
            </div>
          ) : listRows.length === 0 ? (
            emptyState
          ) : (
            <div className={cn("transition-opacity", listLoading && "opacity-60")}>{isDesktop ? tableView : cardView}</div>
          )}
        </div>

        {totalRows > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 px-3 py-3 sm:px-4">
            <span className="text-xs text-muted-foreground">
              {s.t("showing", "Showing")} <span dir="ltr" className="font-mono">{Math.min((currentPage - 1) * PAGE_SIZE + 1, totalRows)}</span> {s.t("to", "to")} <span dir="ltr" className="font-mono">{Math.min(currentPage * PAGE_SIZE, totalRows)}</span> {s.t("of", "of")} <span dir="ltr" className="font-mono">{totalRows}</span> {s.t("entries", "entries")}
            </span>
            <nav className="flex flex-wrap items-center gap-1" aria-label={s.t("entries", "entries")}>
              <button type="button" disabled={currentPage === 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} aria-label={s.t("prev", "Previous")} className="grid h-10 w-10 place-items-center rounded-lg border border-border/60 hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-40 sm:h-9 sm:w-9"><ChevronLeft className={cn("h-4 w-4", s.isRtl && "rotate-180")} /></button>
              {pageNumbers.map((p, i) =>
                p === "..." ? (
                  <span key={`e-${i}`} className="px-1.5 text-xs text-muted-foreground">...</span>
                ) : (
                  <button key={p} type="button" aria-current={currentPage === p ? "page" : undefined} onClick={() => setCurrentPage(p as number)} className={cn("h-10 min-w-10 rounded-lg border px-2 font-mono text-xs font-bold sm:h-9 sm:min-w-9", currentPage === p ? "border-primary bg-primary text-primary-foreground" : "border-border/60 text-foreground hover:bg-muted/50")}>{p}</button>
                )
              )}
              <button type="button" disabled={currentPage === totalPages} onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} aria-label={s.t("next", "Next")} className="grid h-10 w-10 place-items-center rounded-lg border border-border/60 hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-40 sm:h-9 sm:w-9"><ChevronRight className={cn("h-4 w-4", s.isRtl && "rotate-180")} /></button>
            </nav>
          </div>
        )}
      </section>

      {drawer}
    </div>
  );
}
