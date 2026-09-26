"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
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
  Boxes,
  Plus,
  RefreshCw,
  ChevronRight,
  FileText,
  AlertCircle,
  Building2,
  Layers,
  History,
  X,
  Eye,
  SlidersHorizontal,
  Download,
  Columns3,
  Filter,
  Navigation,
  Activity,
  TrendingUp,
  User,
  Globe,
  ArrowRight,
  ChevronLeft,
  ChevronDown,
  MoreHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { JournalPrintButton } from "@/components/reports/journal-print-button";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";
import {
  TRACKING_EVENT_CODES,
  TRACKING_EVENT_LABELS,
  type TrackingEventCode,
  type CanonicalTrackingPayload,
} from "@/lib/types/shipment-tracking";

// ── Types ────────────────────────────────────────────────────────────────────
interface TrackingSummary {
  branchUser: {
    branchName: string;
    branchCode: string;
    countryName: string;
    cityName: string | null;
    userName: string;
    roleLabel: string;
    isSuperAdmin: boolean;
  };
  shipmentSummary: {
    totalShipments: number;
    totalContainers: number;
    inTransit: number;
    arrived: number;
    delivered: number;
    pending: number;
  };
  movementByMode: {
    byRoad: number;
    bySea: number;
    byAir: number;
    byRail: number;
  };
  trackingStatus: {
    bookingConfirmed: number;
    loadedGateIn: number;
    vesselDeparted: number;
    inTransit: number;
    arrivedAtDestination: number;
    delivered: number;
    delayedPending: number;
  };
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
  from: string;
  to: string;
  transportMode: string;
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
  title?: string;
  description?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function modeIcon(mode: string, className = "h-3.5 w-3.5") {
  switch (mode) {
    case "by_road":
      return <Truck className={className} />;
    case "by_rail":
      return <Train className={className} />;
    case "by_air":
      return <Plane className={className} />;
    default:
      return <Ship className={className} />;
  }
}

function modeLabel(mode: string) {
  switch (mode) {
    case "by_road":
      return "Road";
    case "by_rail":
      return "Train";
    case "by_air":
      return "Air";
    case "by_sea":
      return "Sea";
    default:
      return mode?.replace("by_", "").replace(/_/g, " ") || "Sea";
  }
}

function modeBadgeClass(mode: string) {
  switch (mode) {
    case "by_road":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30";
    case "by_rail":
      return "bg-violet-500/15 text-violet-700 dark:text-violet-400 border-violet-500/30";
    case "by_air":
      return "bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/30";
    default:
      return "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30";
  }
}

function statusBadgeClass(stage: string) {
  switch (stage) {
    case "completed":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30";
    case "destination_review":
      return "bg-teal-500/15 text-teal-700 dark:text-teal-400 border-teal-500/30";
    case "shipment_bl":
    case "customs_clearing":
    case "handover":
      return "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30";
    case "loading":
    case "goods_verification":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30";
    case "booking":
      return "bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-500/30";
    default:
      return "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30";
  }
}

function statusLabel(stage: string) {
  const map: Record<string, string> = {
    booking: "Booking",
    truck_assignment: "Truck Assigned",
    goods_verification: "Goods Verify",
    loading: "Loading",
    customs_clearing: "Customs",
    shipment_bl: "BL / Shipment",
    handover: "Handover",
    destination_review: "Arrived",
    completed: "Delivered",
  };
  return map[stage] || stage?.replace(/_/g, " ") || "Pending";
}

function formatDate(d: string | null | undefined) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "2-digit",
    });
  } catch {
    return "—";
  }
}

function formatDateTime(d: string | null | undefined) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

const PAGE_SIZE = 10;

// ── Main Component ────────────────────────────────────────────────────────────
export function CanonicalShipmentTrackingView({
  domain,
  initialShipmentId,
  title,
  description,
}: CanonicalShipmentTrackingViewProps) {
  const lang = useActiveLanguage();
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);
  const _ = (key: Parameters<typeof t>[1], fallback: string) =>
    t(lang, key, fallback);

  // ── Summary cards state ──────────────────────────────────────────────────
  const [summary, setSummary] = useState<TrackingSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  // ── List state ────────────────────────────────────────────────────────────
  const [listRows, setListRows] = useState<TrackingListRow[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [listLoading, setListLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  // ── Search & filter state ─────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [modeFilter, setModeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewTab, setViewTab] = useState<"all" | "containers" | "shipments" | "trucks">("all");

  // ── Detail panel state ────────────────────────────────────────────────────
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(
    initialShipmentId || null
  );
  const [trackingData, setTrackingData] = useState<CanonicalTrackingPayload | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<"location" | "journey" | "documents">("location");

  // ── Add Event modal ───────────────────────────────────────────────────────
  const [isAddEventOpen, setIsAddEventOpen] = useState(false);
  const [newEventCode, setNewEventCode] = useState<TrackingEventCode>("vessel_departed");
  const [newLocationName, setNewLocationName] = useState("");
  const [newVesselName, setNewVesselName] = useState("");
  const [newVoyageNumber, setNewVoyageNumber] = useState("");
  const [newContainerNumber, setNewContainerNumber] = useState("");
  const [newEta, setNewEta] = useState("");
  const [newRemarks, setNewRemarks] = useState("");
  const [isSavingEvent, setIsSavingEvent] = useState(false);

  // ── Debounce search ───────────────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedQuery, modeFilter, statusFilter, viewTab]);

  // ── Load summary ──────────────────────────────────────────────────────────
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

  // ── Load tracking list ────────────────────────────────────────────────────
  const loadList = useCallback(async () => {
    setListLoading(true);
    try {
      const params = new URLSearchParams({
        q: debouncedQuery,
        domain,
        limit: String(PAGE_SIZE),
        offset: String((currentPage - 1) * PAGE_SIZE),
      });
      if (modeFilter !== "all") params.set("mode", modeFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);

      const res = await fetch(`/api/erp/tracking/list?${params}`);
      const json = await res.json();
      if (json.ok) {
        setListRows(json.data.rows || []);
        setTotalRows(json.data.total || 0);
      }
    } catch (e) {
      console.error("List load error:", e);
    } finally {
      setListLoading(false);
    }
  }, [debouncedQuery, domain, currentPage, modeFilter, statusFilter]);

  // Print every record matching the applied search/mode/status filters. The list API is
  // server-paged (max 100 per request), so page through it with the same params.
  const fetchAllTrackingRows = useCallback(async (): Promise<Record<string, unknown>[]> => {
    const all: TrackingListRow[] = [];
    const size = 100;
    for (let offset = 0; offset < 50000; offset += size) {
      const params = new URLSearchParams({ q: debouncedQuery, domain, limit: String(size), offset: String(offset) });
      if (modeFilter !== "all") params.set("mode", modeFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/erp/tracking/list?${params}`);
      const json = await res.json();
      if (!json.ok) break;
      const batch: TrackingListRow[] = json.data.rows || [];
      all.push(...batch);
      if (batch.length < size || all.length >= (json.data.total || 0)) break;
    }
    return all as unknown as Record<string, unknown>[];
  }, [debouncedQuery, domain, modeFilter, statusFilter]);

  // ── Load detail panel ─────────────────────────────────────────────────────
  const loadDetail = useCallback(
    async (id: string) => {
      setDetailLoading(true);
      setDetailError(null);
      try {
        const res = await fetch(`/api/erp/tracking/${encodeURIComponent(id)}?domain=${domain}`);
        const json = await res.json();
        if (!res.ok || !json.ok) {
          throw new Error(json?.error?.message || "Failed to load tracking data");
        }
        setTrackingData(json.data);
        if (json.data.kpis) {
          if (json.data.kpis.vesselName !== "—") setNewVesselName(json.data.kpis.vesselName);
          if (json.data.kpis.voyageNumber !== "—") setNewVoyageNumber(json.data.kpis.voyageNumber);
          if (json.data.kpis.containerNumber !== "—") setNewContainerNumber(json.data.kpis.containerNumber);
        }
      } catch (e: any) {
        setDetailError(e.message);
      } finally {
        setDetailLoading(false);
      }
    },
    [domain]
  );

  // ── Initial loads ─────────────────────────────────────────────────────────
  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    if (selectedOrderId) {
      loadDetail(selectedOrderId);
      setDetailTab("location");
    } else {
      setTrackingData(null);
    }
  }, [selectedOrderId, loadDetail]);

  // ── Handle add event ──────────────────────────────────────────────────────
  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderId) return;
    setIsSavingEvent(true);
    try {
      const res = await fetch(`/api/erp/tracking/${selectedOrderId}/events`, {
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
      if (!res.ok || !json.ok) throw new Error(json?.error?.message || "Failed to record event");
      setIsAddEventOpen(false);
      setNewLocationName("");
      setNewRemarks("");
      await loadDetail(selectedOrderId);
      await loadSummary();
      await loadList();
    } catch (err: any) {
      alert(err.message || "Failed to record tracking event");
    } finally {
      setIsSavingEvent(false);
    }
  };

  // ── Pagination ────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));

  const pageNumbers = useMemo(() => {
    const pages: (number | "...")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push("...");
      for (
        let i = Math.max(2, currentPage - 1);
        i <= Math.min(totalPages - 1, currentPage + 1);
        i++
      )
        pages.push(i);
      if (currentPage < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  }, [totalPages, currentPage]);

  // ── Render helpers ────────────────────────────────────────────────────────
  const SummaryCard = ({
    title: cardTitle,
    icon,
    iconClass,
    children,
    loading,
  }: {
    title: string;
    icon: React.ReactNode;
    iconClass: string;
    children: React.ReactNode;
    loading?: boolean;
  }) => (
    <div className="bg-card border border-border/70 rounded-xl p-3.5 shadow-sm flex-1 min-w-0">
      <div className="flex items-center gap-2 mb-2.5 pb-2 border-b border-border/50">
        <div className={cn("p-1.5 rounded-lg", iconClass)}>{icon}</div>
        <span className="text-[10px] font-black uppercase tracking-wider text-foreground">
          {cardTitle}
        </span>
      </div>
      {loading ? (
        <div className="h-16 flex items-center justify-center">
          <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : (
        children
      )}
    </div>
  );

  const StatRow = ({
    label,
    value,
    accent,
  }: {
    label: string;
    value: number | string;
    accent?: string;
  }) => (
    <div className="flex items-center justify-between text-[11px] leading-5">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-black font-mono tabular-nums", accent || "text-foreground")}>
        {value}
      </span>
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4" dir={isRtl ? "rtl" : "ltr"}>
      {/* ── Page Header ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-black text-foreground tracking-tight flex items-center gap-2">
            <Anchor className="h-5 w-5 text-primary" />
            {title || "Container & Vessel Tracking"}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {description ||
              "Track shipments, containers and vessels in real-time with complete journey details."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedOrderId && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => { loadSummary(); loadList(); if (selectedOrderId) loadDetail(selectedOrderId); }}
              className="gap-1.5 h-8 text-xs"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </Button>
          )}
        </div>
      </div>

      {/* ── 4 Summary Cards ─────────────────────────────────────────── */}
      <div className="flex gap-3 flex-wrap md:flex-nowrap">
        {/* Card 1: Branch & User */}
        <SummaryCard
          title="Branch & User Details"
          icon={<Building2 className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />}
          iconClass="bg-blue-500/10"
          loading={summaryLoading}
        >
          <div className="space-y-0.5 text-[11px]">
            <StatRow label="Branch" value={summary?.branchUser.branchName || "—"} />
            <StatRow label="Branch Code" value={summary?.branchUser.branchCode || "—"} />
            <StatRow label="Country" value={summary?.branchUser.countryName || "—"} />
            <StatRow label="User" value={summary?.branchUser.userName || "—"} />
            <StatRow label="Role" value={summary?.branchUser.roleLabel || "—"} />
          </div>
        </SummaryCard>

        {/* Card 2: Shipment & Container Summary */}
        <SummaryCard
          title="Shipment & Container Summary"
          icon={<Boxes className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />}
          iconClass="bg-emerald-500/10"
          loading={summaryLoading}
        >
          <div className="space-y-0.5 text-[11px]">
            <StatRow label="Total Shipments" value={summary?.shipmentSummary.totalShipments ?? 0} />
            <StatRow label="Total Containers" value={summary?.shipmentSummary.totalContainers ?? 0} />
            <StatRow
              label="In Transit"
              value={summary?.shipmentSummary.inTransit ?? 0}
              accent="text-blue-600 dark:text-blue-400"
            />
            <StatRow
              label="Arrived"
              value={summary?.shipmentSummary.arrived ?? 0}
              accent="text-teal-600 dark:text-teal-400"
            />
            <StatRow
              label="Delivered"
              value={summary?.shipmentSummary.delivered ?? 0}
              accent="text-emerald-600 dark:text-emerald-400"
            />
            <StatRow
              label="Pending"
              value={summary?.shipmentSummary.pending ?? 0}
              accent="text-orange-600 dark:text-orange-400"
            />
          </div>
        </SummaryCard>

        {/* Card 3: Movement By Mode */}
        <SummaryCard
          title="Current Movement (By Mode)"
          icon={<Navigation className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />}
          iconClass="bg-violet-500/10"
          loading={summaryLoading}
        >
          <div className="space-y-0.5 text-[11px]">
            <div className="flex items-center justify-between leading-5">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Truck className="h-3 w-3 text-amber-500" /> By Road
              </span>
              <span className="font-black font-mono text-foreground">{summary?.movementByMode.byRoad ?? 0}</span>
            </div>
            <div className="flex items-center justify-between leading-5">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Ship className="h-3 w-3 text-blue-500" /> By Sea
              </span>
              <span className="font-black font-mono text-foreground">{summary?.movementByMode.bySea ?? 0}</span>
            </div>
            <div className="flex items-center justify-between leading-5">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Plane className="h-3 w-3 text-sky-500" /> By Air
              </span>
              <span className="font-black font-mono text-foreground">{summary?.movementByMode.byAir ?? 0}</span>
            </div>
            <div className="flex items-center justify-between leading-5">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Train className="h-3 w-3 text-violet-500" /> By Train
              </span>
              <span className="font-black font-mono text-foreground">{summary?.movementByMode.byRail ?? 0}</span>
            </div>
          </div>
        </SummaryCard>

        {/* Card 4: Tracking Status */}
        <SummaryCard
          title="Tracking Status Summary"
          icon={<Activity className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />}
          iconClass="bg-rose-500/10"
          loading={summaryLoading}
        >
          <div className="space-y-0.5 text-[11px]">
            <StatRow label="Booking Confirmed" value={summary?.trackingStatus.bookingConfirmed ?? 0} />
            <StatRow label="Loaded / Gate In" value={summary?.trackingStatus.loadedGateIn ?? 0} />
            <StatRow label="In Transit" value={summary?.trackingStatus.inTransit ?? 0} accent="text-blue-600 dark:text-blue-400" />
            <StatRow label="Arrived at Destination" value={summary?.trackingStatus.arrivedAtDestination ?? 0} accent="text-teal-600 dark:text-teal-400" />
            <StatRow label="Delivered" value={summary?.trackingStatus.delivered ?? 0} accent="text-emerald-600 dark:text-emerald-400" />
            <StatRow label="Delayed / Pending" value={summary?.trackingStatus.delayedPending ?? 0} accent="text-rose-600 dark:text-rose-400" />
          </div>
        </SummaryCard>
      </div>

      {/* ── Tracking Table + Detail Panel ─────────────────────────── */}
      <div className={cn("flex gap-3", selectedOrderId ? "items-start" : "")}>
        {/* Left: Tracking List */}
        <div className={cn("flex flex-col gap-3 min-w-0 flex-1 transition-all duration-300")}>
          {/* Table Header / Toolbar */}
          <div className="bg-card border border-border/70 rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-border/60 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <Ship className="h-4 w-4 text-primary shrink-0" />
                <div>
                  <span className="text-sm font-black text-foreground">
                    Shipment & Container Tracking List
                  </span>
                  <p className="text-[10px] text-muted-foreground leading-tight">
                    All shipments, containers and vessels with current status and location.
                  </p>
                </div>
              </div>

              {/* View toggle */}
              <div className="flex items-center bg-muted/50 rounded-lg p-0.5 text-[11px] gap-0.5 shrink-0">
                {(["all", "containers", "shipments", "trucks"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setViewTab(tab)}
                    className={cn(
                      "px-2.5 py-1 rounded-md font-semibold capitalize transition-all",
                      viewTab === tab
                        ? "bg-background shadow-sm text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {tab === "all" ? "All" : tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>

              <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                Total Records: {totalRows}
              </span>
            </div>

            {/* Search + Filters + Table Actions row */}
            <div className="px-4 py-2.5 border-b border-border/60 flex flex-wrap items-center gap-2">
              {/* Main Search */}
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by Shipment No, BL, Container, Truck, Vessel, Customer..."
                  className="pl-9 h-8 text-xs bg-muted/30 border-border/70 rounded-lg"
                />
              </div>

              {/* Filters Button */}
              <Button
                size="sm"
                variant={filtersOpen ? "default" : "outline"}
                onClick={() => setFiltersOpen(!filtersOpen)}
                className="h-8 gap-1.5 text-xs rounded-lg"
              >
                <Filter className="h-3.5 w-3.5" />
                Filters
                {(modeFilter !== "all" || statusFilter !== "all") && (
                  <Badge className="h-4 w-4 p-0 text-[9px] flex items-center justify-center ml-0.5 rounded-full">
                    {(modeFilter !== "all" ? 1 : 0) + (statusFilter !== "all" ? 1 : 0)}
                  </Badge>
                )}
              </Button>

              {/* Table Actions */}
              <div className="flex items-center gap-1 border border-border/70 rounded-lg p-0.5">
                <JournalPrintButton
                  title={title || "Container & Vessel Tracking"}
                  columns={[
                    { key: "orderNo", label: "Shipment No" },
                    { key: "blNumber", label: "BL No" },
                    { key: "containerNumber", label: "Container No" },
                    { key: "truckNumber", label: "Truck No" },
                    { key: "shippingLine", label: "Shipping Line" },
                    { key: "vesselVoyage", label: "Vessel / Voyage" },
                    { key: "from", label: "From" },
                    { key: "to", label: "To" },
                    { key: (r) => modeLabel(String((r as any).transportMode ?? "")), label: "Mode", align: "center" },
                    { key: "currentLocation", label: "Current Location" },
                    { key: (r) => formatDate((r as any).eta), label: "ETA" },
                    { key: (r) => statusLabel(String((r as any).currentStage ?? "")), label: "Status", align: "center", format: "status" },
                  ]}
                  rows={listRows as unknown as Record<string, unknown>[]}
                  fetchFullData={fetchAllTrackingRows}
                  filters={[
                    ...(debouncedQuery.trim() ? [{ label: "Search", value: debouncedQuery.trim() }] : []),
                    ...(modeFilter !== "all" ? [{ label: "Mode", value: modeLabel(modeFilter) }] : []),
                    ...(statusFilter !== "all" ? [{ label: "Status", value: statusLabel(statusFilter) }] : []),
                  ]}
                  orientation="landscape"
                  variant="ghost"
                  className="h-7 px-2"
                />
                <button
                  className="p-1.5 rounded-md hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
                  title="Export"
                >
                  <Download className="h-3.5 w-3.5" />
                </button>
                <button
                  className="p-1.5 rounded-md hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
                  title="Columns"
                >
                  <Columns3 className="h-3.5 w-3.5" />
                </button>
              </div>

              {selectedOrderId && (
                <Button
                  size="sm"
                  onClick={() => setIsAddEventOpen(true)}
                  className="h-8 gap-1.5 text-xs rounded-lg"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Event
                </Button>
              )}
            </div>

            {/* Filters Panel (collapsible) */}
            {filtersOpen && (
              <div className="px-4 py-3 border-b border-border/60 bg-muted/20 flex flex-wrap gap-4">
                <div className="flex items-center gap-2">
                  <Label className="text-[11px] font-semibold shrink-0">Mode:</Label>
                  <div className="flex gap-1 flex-wrap">
                    {[
                      { v: "all", label: "All" },
                      { v: "by_sea", label: "Sea" },
                      { v: "by_road", label: "Road" },
                      { v: "by_air", label: "Air" },
                      { v: "by_rail", label: "Rail" },
                    ].map(({ v, label }) => (
                      <button
                        key={v}
                        onClick={() => setModeFilter(v)}
                        className={cn(
                          "px-2.5 py-0.5 rounded-full text-[10px] font-semibold border transition-all",
                          modeFilter === v
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background border-border/70 text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-[11px] font-semibold shrink-0">Status:</Label>
                  <div className="flex gap-1 flex-wrap">
                    {[
                      { v: "all", label: "All" },
                      { v: "booking", label: "Booking" },
                      { v: "loading", label: "Loading" },
                      { v: "shipment_bl", label: "In Transit" },
                      { v: "destination_review", label: "Arrived" },
                      { v: "completed", label: "Delivered" },
                    ].map(({ v, label }) => (
                      <button
                        key={v}
                        onClick={() => setStatusFilter(v)}
                        className={cn(
                          "px-2.5 py-0.5 rounded-full text-[10px] font-semibold border transition-all",
                          statusFilter === v
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background border-border/70 text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                {(modeFilter !== "all" || statusFilter !== "all") && (
                  <button
                    onClick={() => { setModeFilter("all"); setStatusFilter("all"); }}
                    className="text-[10px] text-muted-foreground hover:text-destructive font-semibold flex items-center gap-1 ml-auto"
                  >
                    <X className="h-3 w-3" /> Clear filters
                  </button>
                )}
              </div>
            )}

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/30">
                    <th className="w-8 px-3 py-2.5 text-center font-bold text-muted-foreground">#</th>
                    <th className="px-3 py-2.5 text-left font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Shipment No</th>
                    <th className="px-3 py-2.5 text-left font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">BL No</th>
                    <th className="px-3 py-2.5 text-left font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Container No</th>
                    <th className="px-3 py-2.5 text-left font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Truck No</th>
                    <th className="px-3 py-2.5 text-left font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Shipping Line</th>
                    <th className="px-3 py-2.5 text-left font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Vessel / Voyage</th>
                    <th className="px-3 py-2.5 text-left font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">From</th>
                    <th className="px-3 py-2.5 text-left font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">To</th>
                    <th className="px-3 py-2.5 text-center font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Mode</th>
                    <th className="px-3 py-2.5 text-left font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Current Location</th>
                    <th className="px-3 py-2.5 text-left font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">ETA</th>
                    <th className="px-3 py-2.5 text-center font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Status</th>
                    <th className="px-3 py-2.5 text-center font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {listLoading ? (
                    <tr>
                      <td colSpan={14} className="py-12 text-center">
                        <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-primary" />
                        <p className="text-xs text-muted-foreground">Loading records...</p>
                      </td>
                    </tr>
                  ) : listRows.length === 0 ? (
                    <tr>
                      <td colSpan={14} className="py-16 text-center">
                        <Ship className="h-8 w-8 mx-auto mb-3 text-muted-foreground/40" />
                        <p className="text-xs font-semibold text-muted-foreground">No tracking records found.</p>
                        {(searchQuery || modeFilter !== "all" || statusFilter !== "all") && (
                          <p className="text-[10px] text-muted-foreground mt-1">Try adjusting your search or filters.</p>
                        )}
                      </td>
                    </tr>
                  ) : (
                    listRows.map((row, idx) => {
                      const isSelected = selectedOrderId === row.id;
                      const rowNum = (currentPage - 1) * PAGE_SIZE + idx + 1;
                      return (
                        <tr
                          key={row.id}
                          className={cn(
                            "hover:bg-muted/30 transition-colors cursor-pointer",
                            isSelected && "bg-primary/5 border-l-2 border-l-primary"
                          )}
                          onClick={() => setSelectedOrderId(isSelected ? null : row.id)}
                        >
                          <td className="px-3 py-2.5 text-center text-muted-foreground font-mono">{rowNum}</td>

                          {/* Shipment No */}
                          <td className="px-3 py-2.5">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedOrderId(row.id);
                              }}
                              className="font-mono font-black text-primary hover:underline"
                            >
                              {row.orderNo}
                            </button>
                          </td>

                          {/* BL No */}
                          <td className="px-3 py-2.5">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedOrderId(row.id);
                              }}
                              className={cn(
                                "font-mono",
                                row.blNumber !== "—"
                                  ? "text-primary hover:underline"
                                  : "text-muted-foreground"
                              )}
                            >
                              {row.blNumber}
                            </button>
                          </td>

                          {/* Container No */}
                          <td className="px-3 py-2.5">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedOrderId(row.id);
                                setDetailTab("location");
                              }}
                              className={cn(
                                "font-mono font-bold",
                                row.containerNumber !== "—"
                                  ? "text-primary hover:underline"
                                  : "text-muted-foreground"
                              )}
                            >
                              {row.containerNumber}
                            </button>
                          </td>

                          {/* Truck No */}
                          <td className="px-3 py-2.5">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedOrderId(row.id);
                                setDetailTab("journey");
                              }}
                              className={cn(
                                "font-mono",
                                row.truckNumber !== "—"
                                  ? "text-amber-600 dark:text-amber-400 hover:underline font-bold"
                                  : "text-muted-foreground"
                              )}
                            >
                              {row.truckNumber}
                            </button>
                          </td>

                          {/* Shipping Line */}
                          <td className="px-3 py-2.5 text-foreground/80 max-w-[100px]">
                            <span className="truncate block" title={row.shippingLine}>
                              {row.shippingLine}
                            </span>
                          </td>

                          {/* Vessel / Voyage */}
                          <td className="px-3 py-2.5 max-w-[110px]">
                            <span
                              className="truncate block text-foreground/80 font-mono"
                              title={row.vesselVoyage}
                            >
                              {row.vesselVoyage}
                            </span>
                          </td>

                          {/* From */}
                          <td className="px-3 py-2.5 text-foreground/70 max-w-[80px]">
                            <span className="truncate block" title={row.from}>
                              {row.from}
                            </span>
                          </td>

                          {/* To */}
                          <td className="px-3 py-2.5 text-foreground/70 max-w-[80px]">
                            <span className="truncate block" title={row.to}>
                              {row.to}
                            </span>
                          </td>

                          {/* Mode */}
                          <td className="px-3 py-2.5 text-center">
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[10px] font-bold",
                                modeBadgeClass(row.transportMode)
                              )}
                            >
                              {modeIcon(row.transportMode, "h-3 w-3")}
                              {modeLabel(row.transportMode)}
                            </span>
                          </td>

                          {/* Current Location */}
                          <td className="px-3 py-2.5 max-w-[110px]">
                            <span
                              className="flex items-center gap-1 text-foreground/80 truncate"
                              title={row.currentLocation}
                            >
                              <MapPin className="h-3 w-3 text-primary shrink-0" />
                              <span className="truncate">{row.currentLocation}</span>
                            </span>
                          </td>

                          {/* ETA */}
                          <td className="px-3 py-2.5 font-mono text-foreground/70 whitespace-nowrap">
                            {formatDate(row.eta)}
                          </td>

                          {/* Status */}
                          <td className="px-3 py-2.5 text-center">
                            <span
                              className={cn(
                                "inline-block px-1.5 py-0.5 rounded-md border text-[10px] font-bold whitespace-nowrap",
                                statusBadgeClass(row.currentStage)
                              )}
                            >
                              {statusLabel(row.currentStage)}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-1 justify-center">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedOrderId(row.id);
                                  setDetailTab("location");
                                }}
                                title="View Details"
                                className="p-1.5 rounded-md bg-muted hover:bg-primary/10 hover:text-primary transition-colors"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedOrderId(row.id);
                                  setDetailTab("journey");
                                }}
                                title="Journey Timeline"
                                className="p-1.5 rounded-md bg-muted hover:bg-primary/10 hover:text-primary transition-colors"
                              >
                                <MapPin className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedOrderId(row.id);
                                  setDetailTab("location");
                                }}
                                title="Open Full Tracking"
                                className="p-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                              >
                                <ChevronRight className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {!listLoading && totalRows > 0 && (
              <div className="px-4 py-3 border-t border-border/60 flex items-center justify-between gap-3 flex-wrap">
                <span className="text-[11px] text-muted-foreground">
                  Showing {Math.min((currentPage - 1) * PAGE_SIZE + 1, totalRows)} to{" "}
                  {Math.min(currentPage * PAGE_SIZE, totalRows)} of {totalRows} entries
                </span>
                <div className="flex items-center gap-1">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="p-1.5 rounded-md border border-border/60 hover:bg-muted/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  {pageNumbers.map((p, i) =>
                    p === "..." ? (
                      <span key={`ellipsis-${i}`} className="px-1.5 text-[11px] text-muted-foreground">
                        ...
                      </span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => setCurrentPage(p as number)}
                        className={cn(
                          "h-7 w-7 rounded-md text-[11px] font-bold border transition-all",
                          currentPage === p
                            ? "bg-primary text-primary-foreground border-primary"
                            : "border-border/60 hover:bg-muted/50 text-foreground"
                        )}
                      >
                        {p}
                      </button>
                    )
                  )}
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="p-1.5 rounded-md border border-border/60 hover:bg-muted/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Right: Detail Panel ──────────────────────────────── */}
        {selectedOrderId && (
          <div className="w-80 xl:w-96 shrink-0 bg-card border border-border/70 rounded-xl shadow-sm overflow-hidden flex flex-col">
            {/* Panel Header */}
            <div className="px-4 py-3 border-b border-border/60 bg-muted/30 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Ship className="h-4 w-4 text-primary shrink-0" />
                <span className="text-[11px] font-black uppercase tracking-wider text-foreground truncate">
                  Container Details
                </span>
              </div>
              <button
                onClick={() => { setSelectedOrderId(null); setTrackingData(null); }}
                className="p-1 rounded-md hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {detailLoading ? (
              <div className="flex-1 flex items-center justify-center p-12">
                <div className="text-center">
                  <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
                  <p className="text-xs text-muted-foreground">Loading shipment journey...</p>
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
              <div className="flex-1 overflow-y-auto">
                {/* Status badge + Container ID */}
                <div className="px-4 py-3 border-b border-border/60">
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded-md text-[10px] font-black border",
                        statusBadgeClass(trackingData.shipment.current_stage)
                      )}
                    >
                      {statusLabel(trackingData.shipment.current_stage)}
                    </span>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black border border-primary/30 text-primary bg-primary/5">
                      Live Tracking
                    </span>
                  </div>
                  <div className="font-mono font-black text-lg text-foreground leading-tight">
                    {trackingData.kpis.containerNumber}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {trackingData.shipment.goods_name || "Cargo Container"}
                  </div>
                </div>

                {/* Key details grid */}
                <div className="px-4 py-3 border-b border-border/60 space-y-1.5">
                  {[
                    { label: "Shipment No", value: trackingData.shipment.order_no, mono: true, isLink: true },
                    { label: "BL Number", value: trackingData.kpis.blNumber, mono: true, isLink: true },
                    { label: "Shipping Line", value: trackingData.kpis.shippingLine },
                    { label: "Vessel / Voyage", value: `${trackingData.kpis.vesselName}${trackingData.kpis.voyageNumber !== "—" ? ` / ${trackingData.kpis.voyageNumber}` : ""}`, mono: true },
                    { label: "Truck Number", value: trackingData.activeLeg?.truck_number || trackingData.activeLeg?.master_truck_number || "—", mono: true },
                    {
                      label: "Route",
                      value: `${trackingData.kpis.pol} → ${trackingData.kpis.pod}`,
                    },
                    { label: "Mode", value: `${modeLabel(trackingData.activeLeg?.transport_mode || trackingData.shipment.transport_mode)} (${trackingData.legs.length > 1 ? "Multi-Leg" : "Direct"})` },
                    { label: "ETD", value: formatDate(trackingData.kpis.etd) },
                    { label: "ETA", value: formatDate(trackingData.kpis.eta) },
                  ].map(({ label, value, mono, isLink }) => (
                    <div key={label} className="flex items-start justify-between gap-3 text-[11px]">
                      <span className="text-muted-foreground shrink-0">{label}</span>
                      <span
                        className={cn(
                          "text-right truncate max-w-[55%]",
                          mono ? "font-mono" : "",
                          isLink && value !== "—" ? "text-primary font-bold" : "text-foreground font-semibold"
                        )}
                        title={value}
                      >
                        {value}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Tabs */}
                <div className="flex border-b border-border/60">
                  {(["location", "journey", "documents"] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setDetailTab(tab)}
                      className={cn(
                        "flex-1 py-2.5 text-[11px] font-bold capitalize transition-all border-b-2",
                        detailTab === tab
                          ? "border-primary text-primary"
                          : "border-transparent text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {tab === "location" ? "Current Location" : tab === "journey" ? "Journey" : "Documents"}
                    </button>
                  ))}
                </div>

                {/* Tab: Current Location */}
                {detailTab === "location" && (
                  <div className="px-4 py-4">
                    {/* Current Location highlight */}
                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-3.5 mb-4">
                      <div className="flex items-center gap-2 mb-1">
                        <MapPin className="h-4 w-4 text-primary" />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                          Current Location
                        </span>
                        <span className={cn(
                          "ml-auto px-2 py-0.5 rounded-md text-[9px] font-black border",
                          statusBadgeClass(trackingData.shipment.current_stage)
                        )}>
                          {statusLabel(trackingData.shipment.current_stage)}
                        </span>
                      </div>
                      <p className="text-sm font-black text-foreground">
                        {trackingData.kpis.currentLocation}
                      </p>
                      {trackingData.events[0] && (
                        <p className="text-[10px] text-muted-foreground mt-1 font-mono">
                          {formatDateTime(trackingData.events[0].event_time)}
                        </p>
                      )}
                    </div>

                    {/* Multi-leg overview */}
                    {trackingData.legs.length > 1 && (
                      <div className="mb-4">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                          Journey Route ({trackingData.legs.length} Legs)
                        </p>
                        <div className="flex items-center gap-1 flex-wrap">
                          {trackingData.legs.map((leg, i) => {
                            const isActive = leg.id === trackingData.activeLeg?.id;
                            return (
                              <div key={leg.id || i} className="flex items-center gap-1">
                                <div
                                  className={cn(
                                    "flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border",
                                    isActive
                                      ? "bg-primary text-primary-foreground border-primary"
                                      : leg.status === "completed"
                                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                                      : "bg-muted text-muted-foreground border-border/60"
                                  )}
                                >
                                  {modeIcon(leg.transport_mode, "h-3 w-3")}
                                  {modeLabel(leg.transport_mode)}
                                  {isActive && (
                                    <CircleDot className="h-2.5 w-2.5 animate-pulse" />
                                  )}
                                </div>
                                {i < trackingData.legs.length - 1 && (
                                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Key milestones */}
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                        Complete Journey Timeline
                      </p>
                      {trackingData.events.length === 0 ? (
                        <div className="text-center py-6 border border-dashed rounded-xl bg-muted/20">
                          <p className="text-[11px] text-muted-foreground">
                            No events logged yet.
                          </p>
                        </div>
                      ) : (
                        <div className="relative pl-5 space-y-3 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-border/80">
                          {trackingData.events.map((ev, idx) => {
                            const isLatest = idx === 0;
                            return (
                              <div key={ev.id || idx} className="relative">
                                <div
                                  className={cn(
                                    "absolute -left-5 top-1 h-4 w-4 rounded-full border-2 flex items-center justify-center",
                                    isLatest
                                      ? "bg-primary border-primary text-primary-foreground shadow-sm shadow-primary/30"
                                      : ev.status === "completed"
                                      ? "bg-emerald-500 border-emerald-500 text-white"
                                      : "bg-background border-muted-foreground/50"
                                  )}
                                >
                                  {isLatest ? (
                                    <CircleDot className="h-2.5 w-2.5 animate-pulse" />
                                  ) : (
                                    <div className="h-1.5 w-1.5 rounded-full bg-current" />
                                  )}
                                </div>
                                <div className="text-[11px]">
                                  <div className="flex items-center justify-between gap-2">
                                    <span
                                      className={cn(
                                        "font-bold",
                                        isLatest ? "text-primary" : "text-foreground"
                                      )}
                                    >
                                      {ev.event_name}
                                    </span>
                                    {isLatest && (
                                      <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-primary/10 text-primary border border-primary/20 whitespace-nowrap">
                                        {statusLabel(trackingData.shipment.current_stage)}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[10px] font-mono text-muted-foreground leading-tight">
                                    {formatDateTime(ev.event_time)}
                                  </p>
                                  {ev.location_name && (
                                    <p className="text-[10px] text-foreground/70 flex items-center gap-1 mt-0.5">
                                      <MapPin className="h-2.5 w-2.5 text-primary" />
                                      {ev.location_name}
                                    </p>
                                  )}
                                  {ev.remarks && (
                                    <p className="text-[10px] text-muted-foreground italic mt-0.5">
                                      {ev.remarks}
                                    </p>
                                  )}
                                </div>
                              </div>
                            );
                          })}

                          {/* Expected Arrival (future) */}
                          {trackingData.kpis.eta && (
                            <div className="relative opacity-50">
                              <div className="absolute -left-5 top-1 h-4 w-4 rounded-full border-2 border-dashed border-muted-foreground/50 bg-background flex items-center justify-center">
                                <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                              </div>
                              <div className="text-[11px]">
                                <span className="font-bold text-muted-foreground">Expected Arrival</span>
                                <p className="text-[10px] font-mono text-muted-foreground">
                                  {formatDate(trackingData.kpis.eta)}
                                </p>
                                <p className="text-[10px] text-muted-foreground/70 flex items-center gap-1 mt-0.5">
                                  <MapPin className="h-2.5 w-2.5" />
                                  {trackingData.kpis.pod}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Tab: Journey (Legs) */}
                {detailTab === "journey" && (
                  <div className="px-4 py-4 space-y-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Multi-Leg Movement Sequence ({trackingData.legs.length} Transport Legs)
                    </p>

                    {/* Route bar */}
                    <div className="bg-muted/30 border border-border/60 rounded-xl p-3 flex items-center justify-between gap-2">
                      <div>
                        <p className="text-[9px] font-bold uppercase text-muted-foreground">From</p>
                        <p className="text-xs font-black text-foreground">{trackingData.kpis.pol}</p>
                        {trackingData.kpis.etd && (
                          <p className="text-[10px] font-mono text-muted-foreground">
                            ETD: {formatDate(trackingData.kpis.etd)}
                          </p>
                        )}
                      </div>
                      <div className="flex-1 flex items-center justify-center">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <div className="h-px flex-1 bg-border" style={{ minWidth: 16 }} />
                          <ArrowRight className="h-4 w-4 text-primary" />
                          <div className="h-px flex-1 bg-border" style={{ minWidth: 16 }} />
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] font-bold uppercase text-muted-foreground">To</p>
                        <p className="text-xs font-black text-foreground">{trackingData.kpis.pod}</p>
                        {trackingData.kpis.eta && (
                          <p className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400">
                            ETA: {formatDate(trackingData.kpis.eta)}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Legs */}
                    {trackingData.legs.map((leg, idx) => {
                      const isActive = leg.id === trackingData.activeLeg?.id;
                      return (
                        <div
                          key={leg.id || idx}
                          className={cn(
                            "border rounded-xl p-3 space-y-2 transition-all",
                            isActive
                              ? "border-primary bg-primary/5 shadow-sm"
                              : leg.status === "completed"
                              ? "border-emerald-500/30 bg-emerald-500/5"
                              : "border-border/60 bg-card"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5 text-[10px] font-black uppercase">
                              {modeIcon(leg.transport_mode, "h-3.5 w-3.5")}
                              Leg #{leg.leg_no}: {modeLabel(leg.transport_mode)}
                            </span>
                            <span
                              className={cn(
                                "px-1.5 py-0.5 rounded text-[9px] font-black border",
                                isActive
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : leg.status === "completed"
                                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                                  : "bg-muted text-muted-foreground border-border/60"
                              )}
                            >
                              {isActive ? "Active" : leg.status || "Pending"}
                            </span>
                          </div>

                          <p className="text-[11px] font-bold text-foreground">
                            {leg.from_location_text || leg.from_country_name || "Origin"} →{" "}
                            {leg.to_location_text || leg.to_country_name || "Destination"}
                          </p>

                          <div className="text-[10.5px] text-muted-foreground space-y-0.5 font-mono">
                            {leg.transport_mode === "by_road" ? (
                              <>
                                <div>
                                  Truck:{" "}
                                  <strong className="text-foreground">
                                    {leg.truck_number || leg.master_truck_number || "To be assigned"}
                                  </strong>
                                </div>
                                {leg.truck_driver_name && (
                                  <div>Driver: <span>{leg.truck_driver_name}</span></div>
                                )}
                              </>
                            ) : (
                              <>
                                <div>
                                  Vessel:{" "}
                                  <strong className="text-foreground">
                                    {leg.vessel_name || "Pending"}
                                  </strong>
                                </div>
                                {leg.voyage_number && (
                                  <div>Voyage: <span>{leg.voyage_number}</span></div>
                                )}
                                {leg.container_number && (
                                  <div>Container: <strong className="text-foreground">{leg.container_number}</strong></div>
                                )}
                              </>
                            )}
                            {leg.etd && <div>ETD: {formatDate(leg.etd)}</div>}
                            {leg.eta && <div>ETA: {formatDate(leg.eta)}</div>}
                          </div>
                        </div>
                      );
                    })}

                    {/* Truck info if road order */}
                    {trackingData.activeLeg?.truck_number && (
                      <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-2 flex items-center gap-1.5">
                          <Truck className="h-3.5 w-3.5" /> Assigned Truck
                        </p>
                        <div className="text-[11px] space-y-0.5 font-mono">
                          <StatRow
                            label="Truck No"
                            value={trackingData.activeLeg.truck_number || trackingData.activeLeg.master_truck_number || "—"}
                          />
                          {trackingData.activeLeg.truck_driver_name && (
                            <StatRow label="Driver" value={trackingData.activeLeg.truck_driver_name} />
                          )}
                          {trackingData.activeLeg.from_location_text && (
                            <StatRow label="Loading Point" value={trackingData.activeLeg.from_location_text} />
                          )}
                          {trackingData.activeLeg.to_location_text && (
                            <StatRow label="Destination" value={trackingData.activeLeg.to_location_text} />
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Tab: Documents */}
                {detailTab === "documents" && (
                  <div className="px-4 py-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">
                      Linked Documents
                    </p>
                    <div className="space-y-2">
                      {trackingData.blRecord && (
                        <div className="flex items-center gap-3 p-3 border border-border/60 rounded-xl hover:bg-muted/30 transition-colors">
                          <div className="p-2 rounded-lg bg-blue-500/10">
                            <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-bold text-foreground">Bill of Lading</p>
                            <p className="text-[10px] font-mono text-muted-foreground truncate">
                              {trackingData.kpis.blNumber}
                            </p>
                          </div>
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                      )}
                      {trackingData.handover && (
                        <div className="flex items-center gap-3 p-3 border border-border/60 rounded-xl hover:bg-muted/30 transition-colors">
                          <div className="p-2 rounded-lg bg-emerald-500/10">
                            <Layers className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-bold text-foreground">Business Handover</p>
                            <p className="text-[10px] font-mono text-muted-foreground truncate">
                              #{trackingData.handover.handover_no}
                            </p>
                          </div>
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                      )}
                      {!trackingData.blRecord && !trackingData.handover && (
                        <div className="text-center py-6 border border-dashed rounded-xl bg-muted/20">
                          <FileText className="h-6 w-6 mx-auto mb-2 text-muted-foreground/40" />
                          <p className="text-[11px] text-muted-foreground">No linked documents yet.</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* ── Add Journey Event Modal ──────────────────────────────── */}
      <Dialog open={isAddEventOpen} onOpenChange={setIsAddEventOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" />
              Record Journey Event & Milestone
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
              <Label className="text-xs font-semibold">Event Remarks / Notes</Label>
              <Input
                value={newRemarks}
                onChange={(e) => setNewRemarks(e.target.value)}
                placeholder="Notes on departure, transshipment, customs clearance..."
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
                className="rounded-xl text-xs font-bold"
              >
                {isSavingEvent ? "Saving..." : "Record Milestone"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
