"use client";
import { t } from "@/lib/i18n/ui";

/**
 * Stock Journal — Purchase Booking & Local Purchase → Loading → Receiving & Customs → Confirm Stock → Sale / Export.
 * Matches Image 2 reference design with 17 distinct columns, header filters, source type selectors, and pagination.
 * All numbers come from /api/erp/inventory/journal-stock (scope-enforced on the server).
 * Every label goes through the central i18n dictionary (namespace "sj") following EN / UR / AR / FA / PS with RTL.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle, ArrowLeftRight, Boxes, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ClipboardCheck,
  Download, ExternalLink, Eye, FileText, Filter, Globe, History, Layers, Loader2, MoreHorizontal, MoreVertical, Package, PackageCheck,
  Pencil, Plus, Printer, RefreshCw, Search, ShieldCheck, Ship, ShoppingBag, Truck, Undo2,
  Warehouse as WarehouseIcon, X,
} from "lucide-react";
import { SimpleModal } from "@/components/ui/simple-modal";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { openScopedGenericReport } from "@/lib/reports/open-scoped-report";
import type { CardTotals, StockJournalRow, StockJournalSummary } from "@/lib/services/stock-journal-service";
import type { DestinationType, StockStage } from "@/lib/stock-journal/model";

export type StockTab = "all" | "booking" | "confirmed_booking" | "transit" | "receiving" | "ready" | "available" | "sold";
export type DashboardStageProp = StockTab;

type Warehouse = { id: string; warehouse_name: string; warehouse_code?: string; country_id?: string | null };
type Perms = { confirm: boolean; issue: boolean; reverse: boolean };
type ApiRows = {
  rows: StockJournalRow[];
  summary: StockJournalSummary;
  warehouses: Warehouse[];
  permissions: Perms;
  pagination: { page: number; limit: number; totalRecords: number; totalPages: number };
};
type Group = {
  productName: string;
  unit: string;
  warehouseId: string | null;
  warehouseName: string | null;
  countryName: string;
  branchName: string;
  available: number;
  reserved: number;
  sources: {
    bookingNo: string;
    sourceType: string;
    sourceId: string;
    container: string;
    stage: string;
    quantity: number;
    transferNo: string | null;
    destination: string | null;
    customer: string | null;
    transferId: string | null;
    loadingRecordId: string | null;
    canIssue: boolean;
    canReverse: boolean;
    lineKey: string;
  }[];
};
type HistoryEvent = {
  at: string;
  type: string;
  title: string;
  quantity?: number;
  unit?: string;
  reference?: string | null;
  warehouse?: string | null;
  actor?: string | null;
  note?: string | null;
};

const emptyCard: CardTotals = { lines: 0, qty: 0, byUnit: {} };
const fmtNum = (n: number | string | null | undefined, d = 2) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: d }).format(Number(n) || 0);

const fmtDateDisplay = (d: string | null | undefined) => {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return String(d).slice(0, 10);
  const day = String(dt.getDate()).padStart(2, "0");
  const month = String(dt.getMonth() + 1).padStart(2, "0");
  const year = dt.getFullYear();
  return `${day}/${month}/${year}`;
};

const fmtDateIso = (d: string | null | undefined) => {
  if (!d) return "—";
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? String(d).slice(0, 10) : dt.toISOString().slice(0, 10);
};

const topUnit = (c: CardTotals) => {
  const e = Object.entries(c.byUnit).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  if (e.length === 0) return { text: "0", more: 0 };
  return { text: `${fmtNum(e[0][1])} ${e[0][0] === "—" ? "" : e[0][0]}`.trim(), more: e.length - 1 };
};

const byUnitText = (c: CardTotals) => {
  const parts = Object.entries(c.byUnit).filter(([, v]) => v > 0).map(([u, v]) => `${fmtNum(v)} ${u === "—" ? "" : u}`.trim());
  return parts.length ? parts.join(" · ") : "0";
};

const newKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `k-${Date.now()}-${Math.random().toString(16).slice(2)}`;

async function api<T = any>(
  url: string,
  init?: RequestInit
): Promise<{ ok: boolean; status: number; data?: T; message?: string }> {
  try {
    const r = await fetch(url, {
      ...init,
      headers: { "content-type": "application/json", ...(init?.headers || {}) },
      cache: "no-store",
    });
    const j = await r.json().catch(() => null);
    if (!r.ok || j?.ok === false) return { ok: false, status: r.status, message: j?.error?.message || j?.message || `Request failed (${r.status})` };
    return { ok: true, status: r.status, data: (j?.data ?? j) as T };
  } catch (e) {
    return { ok: false, status: 0, message: e instanceof Error ? e.message : String(e) };
  }
}

function getCountryFlag(code?: string | null, name?: string | null): string {
  const c = (code || "").toUpperCase().trim();
  const n = (name || "").toLowerCase().trim();
  if (c === "AE" || n.includes("uae") || n.includes("emirates") || n.includes("dubai")) return "🇦🇪";
  if (c === "PK" || n.includes("pakistan")) return "🇵🇰";
  if (c === "TJ" || n.includes("tajikistan")) return "🇹🇯";
  if (c === "CN" || n.includes("china")) return "🇨🇳";
  if (c === "IN" || n.includes("india")) return "🇮🇳";
  if (c === "MY" || n.includes("malaysia")) return "🇲🇾";
  if (c === "BR" || n.includes("brazil")) return "🇧🇷";
  if (c === "KZ" || n.includes("kazakhstan")) return "🇰🇿";
  if (c === "KE" || n.includes("kenya")) return "🇰🇪";
  if (c === "OM" || n.includes("oman")) return "🇴🇲";
  if (c === "CA" || n.includes("canada")) return "🇨🇦";
  if (c === "AF" || n.includes("afghanistan")) return "🇦🇫";
  if (c === "US" || n.includes("usa") || n.includes("united states")) return "🇺🇸";
  if (c === "GB" || c === "UK" || n.includes("united kingdom")) return "🇬🇧";
  if (c.length === 2) {
    const codePoints = [...c].map((ch) => 127397 + ch.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
  }
  return "🌐";
}

/* ─────────────────────────── small presentational pieces ─────────────────────────── */

const STAGE_STYLE: Record<StockStage, { cls: string; icon: React.ComponentType<any> }> = {
  booking: { cls: "bg-blue-100 text-blue-900 border-blue-200 dark:bg-blue-950/60 dark:text-blue-200 dark:border-blue-800", icon: FileText },
  transit: { cls: "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-800", icon: Truck },
  receiving: { cls: "bg-orange-100 text-orange-900 border-orange-300 dark:bg-orange-950/60 dark:text-orange-200 dark:border-orange-800", icon: ShieldCheck },
  ready: { cls: "bg-cyan-100 text-cyan-900 border-cyan-300 dark:bg-cyan-950/60 dark:text-cyan-200 dark:border-cyan-800", icon: ClipboardCheck },
  available: { cls: "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-800", icon: Boxes },
  reserved: { cls: "bg-violet-100 text-violet-900 border-violet-300 dark:bg-violet-950/60 dark:text-violet-200 dark:border-violet-800", icon: Ship },
  sold: { cls: "bg-slate-200 text-slate-900 border-slate-300 dark:bg-slate-700 dark:text-slate-100 dark:border-slate-500", icon: PackageCheck },
};

function CustomsBadge({ status, stage }: { status: string; stage: StockStage }) {
  if (status === "cleared") {
    return (
      <span className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
        Cleared
      </span>
    );
  }
  if (status === "submitted" || status === "pending" || stage === "transit" || stage === "receiving") {
    return (
      <span className="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
        In Process
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
      Not Started
    </span>
  );
}

function ProgressCell({ r }: { r: StockJournalRow }) {
  const loaded = Number(r.loadedQuantity) || 0;
  const received = Number(r.receivedQuantity) || 0;
  const damage = Number(r.damagedQuantity) || 0;
  const shortage = Number(r.shortageQuantity) || 0;
  const outstanding = Number(r.outstandingQuantity) || 0;

  const pct = loaded > 0 ? Math.min(100, Math.max(0, Math.round((received / loaded) * 100))) : 0;
  const isComplete = loaded > 0 && received >= loaded;
  const isPartial = loaded > 0 && received > 0 && received < loaded;

  return (
    <div className="min-w-[210px] space-y-1.5 py-0.5 text-[11px]">
      <div className="font-bold text-slate-800 dark:text-slate-200">
        Loaded: <span className="font-black text-slate-900 dark:text-slate-50">{fmtNum(loaded)}</span> | Received:{" "}
        <span className="font-black text-slate-900 dark:text-slate-50">{fmtNum(received)}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            isComplete
              ? "bg-emerald-500"
              : isPartial
              ? "bg-blue-600"
              : loaded > 0
              ? "bg-blue-400"
              : "bg-slate-300 dark:bg-slate-600"
          }`}
          style={{ width: `${loaded === 0 ? 0 : Math.max(pct, received > 0 ? 8 : 0)}%` }}
        />
      </div>
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
        <span>
          Damage: <span className={damage > 0 ? "font-bold text-red-600" : ""}>{fmtNum(damage)}</span>
        </span>
        <span>|</span>
        <span>
          Shortage: <span className={shortage > 0 ? "font-bold text-red-600" : ""}>{fmtNum(shortage)}</span>
        </span>
        <span>|</span>
        <span>
          Outstanding: <span className={outstanding > 0 ? "font-bold text-amber-600" : ""}>{fmtNum(outstanding)}</span>
        </span>
      </div>
    </div>
  );
}

function Dot({ tone, label, title }: { tone: "red" | "amber" | "green" | "black" | "gray"; label: string; title: string }) {
  const color = { red: "bg-red-500", amber: "bg-amber-500", green: "bg-emerald-500", black: "bg-black dark:bg-white", gray: "bg-slate-400" }[tone];
  return (
    <span title={title} className="inline-flex items-center gap-1.5 whitespace-nowrap text-[12px] font-semibold text-slate-700 dark:text-slate-200">
      <span className={`inline-block h-3 w-3 rounded-full ring-2 ring-white dark:ring-slate-800 ${color}`} aria-hidden />
      {label}
    </span>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  sub,
  tone,
  active,
  onClick,
  id,
  title,
}: {
  icon: React.ComponentType<any>;
  label: string;
  value: string;
  sub: string;
  tone: string;
  active: boolean;
  onClick: () => void;
  id: string;
  title?: string;
}) {
  return (
    <button
      type="button"
      id={id}
      title={title}
      onClick={onClick}
      className={`flex w-full min-w-0 items-center gap-3 rounded-xl border p-3.5 text-start shadow-xs transition ${
        active
          ? "border-blue-500 bg-blue-50 ring-2 ring-blue-500/20 dark:bg-blue-950/40"
          : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800"
      }`}
    >
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-white ${tone}`}>
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</span>
        <span className="block truncate text-[18px] font-black tabular-nums text-slate-900 dark:text-slate-50" dir="ltr">
          {value}
        </span>
        <span className="block text-[12px] font-semibold text-slate-500 [overflow-wrap:anywhere] dark:text-slate-400">{sub}</span>
      </span>
    </button>
  );
}

/* ─────────────────────────── main dashboard ─────────────────────────── */

export function JournalBookingStockDashboard({
  session,
  initialStage = "all",
  initialDestination,
  initialSourceType = "all",
  lang: langProp,
}: {
  session?: unknown;
  initialStage?: StockTab;
  initialDestination?: DestinationType;
  initialSourceType?: "all" | "purchase_booking" | "local_purchase";
  lang?: string;
}) {
  const s = useErpScreen("sj", langProp);
  const [tab, setTab] = useState<StockTab>(initialStage);
  const [destination, setDestination] = useState<DestinationType | "">(initialDestination ?? "");
  const [sourceType, setSourceType] = useState<"all" | "purchase_booking" | "local_purchase">(initialSourceType);
  const [availableView, setAvailableView] = useState<"report" | "rows">("report");
  const [data, setData] = useState<ApiRows | null>(null);
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [openMenuRowId, setOpenMenuRowId] = useState<string | null>(null);
  const [threeDotOpen, setThreeDotOpen] = useState(false);
  const [metricFilter, setMetricFilter] = useState<"" | "total" | "remaining" | "available">("");
  const [selectedCountry, setSelectedCountry] = useState<string>("");
  const [selectedUnit, setSelectedUnit] = useState<string>("");

  const [f, setF] = useState({
    search: "",
    goodsName: "",
    purchaseOrderNo: "",
    containerNo: "",
    warehouseId: "",
    countryId: "",
    countryBranchId: "",
    dateFrom: "",
    dateTo: "",
  });
  const [applied, setApplied] = useState(f);

  const [viewRow, setViewRow] = useState<StockJournalRow | null>(null);
  const [confirmRow, setConfirmRow] = useState<StockJournalRow | null>(null);
  const [issueRow, setIssueRow] = useState<{ id: string; label: string; qty: number; unit: string; salesOrderNo: string | null } | null>(null);
  const [reverseRow, setReverseRow] = useState<{ id: string; label: string } | null>(null);
  const [customsRow, setCustomsRow] = useState<StockJournalRow | null>(null);
  const [historyRow, setHistoryRow] = useState<{ sourceType: string; sourceId: string; loadingRecordId?: string | null; title: string } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const LIMIT = 50;

  useEffect(() => {
    if (initialSourceType) setSourceType(initialSourceType);
  }, [initialSourceType]);

  useEffect(() => {
    const closeMenu = () => {
      setOpenMenuRowId(null);
      setThreeDotOpen(false);
    };
    window.addEventListener("click", closeMenu);
    return () => window.removeEventListener("click", closeMenu);
  }, []);

  const stageLabel = useCallback(
    (st: StockStage) =>
      ({
        booking: s.t("stage_booking", "Booking Stock"),
        transit: s.t("stage_transit", "Loading / Transit"),
        receiving: s.t("stage_receiving", "Receiving / Customs"),
        ready: s.t("stage_ready", "Ready for Confirmation"),
        available: s.t("stage_available", "Available"),
        reserved: s.t("stage_reserved", "Reserved"),
        sold: s.t("stage_sold", "Sold / Exported"),
      }[st]),
    [s]
  );

  const destLabel = useCallback(
    (d: string | null) =>
      ({
        warehouse: s.t("dest_warehouse", "Warehouse Storage"),
        local_sales: s.t("dest_local", "Local Market Stock"),
        export: s.t("dest_export", "Export Stock"),
        direct_sale: s.t("dest_direct", "Direct Sale / Delivery"),
      }[d || ""] || "—"),
    [s]
  );

  const customsLabel = useCallback(
    (c: string) =>
      ({
        pending: s.t("customs_pending", "Customs: Pending"),
        submitted: s.t("customs_submitted", "Customs: Submitted"),
        cleared: s.t("customs_cleared", "Customs: Cleared"),
        not_applicable: s.t("customs_na", "Customs: Not required"),
        not_recorded: s.t("customs_not_recorded", "Customs: Not recorded"),
      }[c] || c),
    [s]
  );

  const query = useCallback(
    (pg: number, extra: Record<string, string> = {}) => {
      const p = new URLSearchParams();
      if (tab !== "all" && !(tab === "available" && availableView === "report")) p.set("stage", tab);
      if (destination) p.set("destination", destination);
      if (sourceType && sourceType !== "all") p.set("sourceType", sourceType);
      for (const [k, v] of Object.entries(applied)) if (v) p.set(k, v);
      p.set("page", String(pg));
      p.set("limit", String(LIMIT));
      for (const [k, v] of Object.entries(extra)) p.set(k, v);
      return p.toString();
    },
    [tab, destination, sourceType, applied, availableView]
  );

  const load = useCallback(
    async (pg = 1) => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      setLoading(true);
      setError(null);
      const wantsReport = tab === "available" && availableView === "report";
      const [rowsRes, repRes] = await Promise.all([
        api<ApiRows>(`/api/erp/inventory/journal-stock?${query(pg)}`, { signal: ac.signal }),
        wantsReport ? api<{ groups: Group[] }>(`/api/erp/inventory/journal-stock?${query(1, { view: "available", limit: "2000" })}`, { signal: ac.signal }) : Promise.resolve(null),
      ]);
      if (ac.signal.aborted) return;
      if (!rowsRes.ok) setError(rowsRes.message || s.t("load_failed", "The stock could not be loaded."));
      else {
        setData(rowsRes.data!);
        setPage(pg);
      }
      setGroups(repRes && repRes.ok ? repRes.data!.groups : null);
      setLoading(false);
    },
    [query, tab, availableView, s]
  );

  useEffect(() => {
    void load(1);
  }, [load]);

  const summary = data?.summary;
  const perms = data?.permissions ?? { confirm: false, issue: false, reverse: false };
  const warehouses = data?.warehouses ?? [];
  const rows = data?.rows ?? [];

  const distinctCountries = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    for (const r of rows) {
      if (r.countryId && r.countryName && !map.has(r.countryId)) {
        map.set(r.countryId, { id: r.countryId, name: r.countryName });
      }
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  const distinctBranches = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    for (const r of rows) {
      const id = r.cityBranchId || r.countryBranchId;
      if (id && r.branchName && !map.has(id)) {
        map.set(id, { id, name: r.branchName });
      }
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  const distinctUnits = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      if (r.unit && r.unit.trim()) set.add(r.unit.trim());
    }
    const arr = Array.from(set);
    arr.sort((a, b) => {
      if (a.toLowerCase() === "bags") return -1;
      if (b.toLowerCase() === "bags") return 1;
      if (a.toLowerCase() === "boxes") return -1;
      if (b.toLowerCase() === "boxes") return 1;
      return a.localeCompare(b);
    });
    if (arr.length === 0) return ["Bags", "Boxes"];
    if (!arr.some((u) => u.toLowerCase() === "bags")) arr.unshift("Bags");
    if (!arr.some((u) => u.toLowerCase() === "boxes")) arr.splice(1, 0, "Boxes");
    return arr;
  }, [rows]);

  const stockSummary = useMemo(() => {
    const totalByUnit: Record<string, number> = {};
    const remainingByUnit: Record<string, number> = {};
    const availableByUnit: Record<string, number> = {};

    for (const u of distinctUnits) {
      totalByUnit[u] = 0;
      remainingByUnit[u] = 0;
      availableByUnit[u] = 0;
    }

    for (const r of rows) {
      const u = r.unit?.trim() || "Bags";
      if (totalByUnit[u] === undefined) {
        totalByUnit[u] = 0;
        remainingByUnit[u] = 0;
        availableByUnit[u] = 0;
      }
      const qty = Number(r.quantity) || 0;
      const rec = Number(r.receivedQuantity) || 0;
      const dam = Number(r.damagedQuantity) || 0;
      const sho = Number(r.shortageQuantity) || 0;
      const out = Number(r.outstandingQuantity) || Math.max(0, qty - rec - dam - sho);

      totalByUnit[u] += qty;
      remainingByUnit[u] += out;
      if (r.stage === "available") {
        availableByUnit[u] += qty;
      }
    }

    return { totalByUnit, remainingByUnit, availableByUnit };
  }, [rows, distinctUnits]);

  const STAGE_ITEMS: { key: StockTab; label: string; dotClass: string }[] = useMemo(
    () => [
      { key: "booking", label: s.t("stage_booking", "Booking Stock"), dotClass: "bg-blue-500" },
      { key: "confirmed_booking", label: s.t("stage_confirmed_booking", "Confirmed Booking"), dotClass: "bg-indigo-500" },
      { key: "transit", label: s.t("stage_transit", "Loading / Transit"), dotClass: "bg-amber-500" },
      { key: "receiving", label: s.t("stage_receiving", "Receiving & Customs"), dotClass: "bg-orange-500" },
      { key: "ready", label: s.t("stage_ready", "Ready for Confirmation"), dotClass: "bg-cyan-500" },
      { key: "available", label: s.t("stage_available", "Available / Mixed"), dotClass: "bg-emerald-500" },
      { key: "sold", label: s.t("stage_sold", "Sold / Exported"), dotClass: "bg-slate-500" },
    ],
    [s]
  );

  const stageCounts = useMemo(() => {
    const counts: Record<StockTab, number> = {
      all: rows.length,
      booking: 0,
      confirmed_booking: 0,
      transit: 0,
      receiving: 0,
      ready: 0,
      available: 0,
      sold: 0,
    };
    for (const r of rows) {
      if (r.stage in counts) {
        counts[r.stage as StockTab]++;
      }
    }
    return counts;
  }, [rows]);

  const countryBreakdown = useMemo(() => {
    const map = new Map<string, { country: string; flag: string; branch: string; bags: number; boxes: number }>();
    for (const r of rows) {
      const cName = r.countryName || "Other";
      const flag = getCountryFlag(r.countryCode, r.countryName);
      let entry = map.get(cName);
      if (!entry) {
        entry = { country: cName, flag, branch: r.branchName || "", bags: 0, boxes: 0 };
        map.set(cName, entry);
      }
      const qty = Number(r.quantity) || 0;
      const u = (r.unit || "").toLowerCase();
      if (u.includes("bag")) {
        entry.bags += qty;
      } else if (u.includes("box")) {
        entry.boxes += qty;
      } else {
        entry.bags += qty;
      }
    }
    return Array.from(map.values()).sort((a, b) => b.bags + b.boxes - (a.bags + a.boxes));
  }, [rows]);

  const displayRows = useMemo(() => {
    return rows.filter((r) => {
      if (metricFilter === "remaining") {
        const out = Number(r.outstandingQuantity) || Math.max(0, (Number(r.quantity) || 0) - (Number(r.receivedQuantity) || 0) - (Number(r.damagedQuantity) || 0) - (Number(r.shortageQuantity) || 0));
        if (out <= 0) return false;
      } else if (metricFilter === "available") {
        if (r.stage !== "available") return false;
      }
      if (selectedCountry && r.countryName !== selectedCountry && r.countryId !== selectedCountry) {
        return false;
      }
      if (selectedUnit && (r.unit || "").toLowerCase() !== selectedUnit.toLowerCase()) {
        return false;
      }
      return true;
    });
  }, [rows, metricFilter, selectedCountry, selectedUnit]);

  const clearAllFilters = useCallback(() => {
    setMetricFilter("");
    setSelectedCountry("");
    setSelectedUnit("");
    setTab("all");
    setDestination("");
    setSourceType("all");
    const z = {
      search: "",
      goodsName: "",
      purchaseOrderNo: "",
      containerNo: "",
      warehouseId: "",
      countryId: "",
      countryBranchId: "",
      dateFrom: "",
      dateTo: "",
    };
    setF(z);
    setApplied(z);
    setPage(1);
  }, []);

  const activeChips = useMemo(() => {
    const chips: { id: string; label: string; onRemove: () => void }[] = [];
    if (sourceType && sourceType !== "all") {
      chips.push({
        id: "sourceType",
        label: sourceType === "local_purchase" ? "Local Purchase" : "Purchase Booking",
        onRemove: () => setSourceType("all"),
      });
    }
    if (metricFilter) {
      chips.push({
        id: "metric",
        label:
          metricFilter === "total"
            ? "Total stock"
            : metricFilter === "remaining"
            ? "Remaining to receive"
            : "Available balance",
        onRemove: () => setMetricFilter(""),
      });
    }
    if (selectedCountry) {
      chips.push({
        id: "country",
        label: `Country: ${selectedCountry}`,
        onRemove: () => setSelectedCountry(""),
      });
    }
    if (selectedUnit) {
      chips.push({
        id: "unit",
        label: `Unit: ${selectedUnit}`,
        onRemove: () => setSelectedUnit(""),
      });
    }
    if (applied.search) {
      chips.push({
        id: "search",
        label: `Search: "${applied.search}"`,
        onRemove: () => {
          setF((prev) => ({ ...prev, search: "" }));
          setApplied((prev) => ({ ...prev, search: "" }));
        },
      });
    }
    if (applied.countryId) {
      const cObj = distinctCountries.find((c) => c.id === applied.countryId);
      chips.push({
        id: "appliedCountry",
        label: `Country: ${cObj?.name || applied.countryId}`,
        onRemove: () => {
          setF((prev) => ({ ...prev, countryId: "" }));
          setApplied((prev) => ({ ...prev, countryId: "" }));
        },
      });
    }
    if (applied.countryBranchId) {
      const bObj = distinctBranches.find((b) => b.id === applied.countryBranchId);
      chips.push({
        id: "appliedBranch",
        label: `Branch: ${bObj?.name || applied.countryBranchId}`,
        onRemove: () => {
          setF((prev) => ({ ...prev, countryBranchId: "" }));
          setApplied((prev) => ({ ...prev, countryBranchId: "" }));
        },
      });
    }
    if (applied.dateFrom) {
      chips.push({
        id: "dateFrom",
        label: `From: ${applied.dateFrom}`,
        onRemove: () => {
          setF((prev) => ({ ...prev, dateFrom: "" }));
          setApplied((prev) => ({ ...prev, dateFrom: "" }));
        },
      });
    }
    if (applied.dateTo) {
      chips.push({
        id: "dateTo",
        label: `To: ${applied.dateTo}`,
        onRemove: () => {
          setF((prev) => ({ ...prev, dateTo: "" }));
          setApplied((prev) => ({ ...prev, dateTo: "" }));
        },
      });
    }
    return chips;
  }, [sourceType, metricFilter, selectedCountry, selectedUnit, applied, distinctCountries, distinctBranches]);

  const flash = (m: string) => {
    setBanner(m);
    window.setTimeout(() => setBanner(null), 7000);
  };
  const refreshAfter = (m: string) => {
    flash(m);
    void load(page);
  };

  const goTab = (t: StockTab) => {
    setLoading(true);
    setTab(t);
    setPage(1);
    setExpanded(null);
    if (t !== "available") setDestination("");
  };

  const exportCsv = () => {
    const head = [
      "Purchase No.",
      "Date",
      "Country / Branch",
      "Origin",
      "Supplier",
      "Product",
      "Unit",
      "Quantity",
      "Gross Weight (Kg)",
      "Net Weight (Kg)",
      "Booking / Invoice No.",
      "Loaded / Received / Damage / Shortage / Outstanding",
      "Ship Details",
      "Customs",
      "Warehouse",
    ];
    const q = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = displayRows.map((r) =>
      [
        r.billNumber,
        fmtDateDisplay(r.date),
        `${r.countryName || ""} / ${r.branchName || ""}`.trim(),
        r.origin || r.countryName || "",
        r.supplierName || "",
        r.productName || "",
        r.unit || "",
        r.quantity,
        r.grossWeight || r.quantity,
        r.netWeight || r.quantity,
        `${r.bookingNo || ""} / ${r.invoiceNo || ""}`.trim(),
        `Loaded: ${r.loadedQuantity || 0}; Received: ${r.receivedQuantity || 0}; Damage: ${r.damagedQuantity || 0}; Shortage: ${r.shortageQuantity || 0}; Outstanding: ${r.outstandingQuantity || 0}`,
        r.shipDetails || r.truckOrContainer || "",
        customsLabel(r.customsStatus),
        r.warehouseName || (r.stage === "transit" ? "In Transit" : "—"),
      ]
        .map(q)
        .join(",")
    );
    const blob = new Blob(["\ufeff" + [head.map(q).join(","), ...lines].join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `purchase_general_stock_${tab}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const printRecords = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      window.print();
      return;
    }
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Purchase General Stock - DAMAAN BUSINESS GROUP</title>
  <style>
    @page { size: A3 landscape; margin: 8mm; }
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; font-size: 9px; color: #0f172a; margin: 0; padding: 12px; }
    .header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #2563eb; padding-bottom: 8px; margin-bottom: 12px; }
    .title { font-size: 20px; font-weight: 900; color: #1e3a8a; }
    .subtitle { font-size: 11px; color: #64748b; font-weight: 600; }
    .meta { text-align: right; font-size: 10px; color: #64748b; }
    table { width: 100%; border-collapse: collapse; font-size: 8.5px; }
    th { background: #f1f5f9; border: 1px solid #cbd5e1; padding: 5px 4px; text-transform: uppercase; font-weight: 800; text-align: left; }
    td { border: 1px solid #cbd5e1; padding: 4px; vertical-align: middle; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .center { text-align: center; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="title">Purchase General Stock</div>
      <div class="subtitle">DAMAAN BUSINESS GROUP · Inventory Workspace · ${tabLabel(tab)} (${displayRows.length} records)</div>
    </div>
    <div class="meta">
      <div><b>Source:</b> ${sourceType === "all" ? "All Purchases" : sourceType === "local_purchase" ? "Local Purchase" : "Purchase Booking"}</div>
      <div><b>Printed:</b> ${new Date().toLocaleString()}</div>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Purchase No.</th>
        <th>Date</th>
        <th>Country / Branch</th>
        <th>Origin</th>
        <th>Supplier</th>
        <th>Product</th>
        <th class="center">Unit</th>
        <th class="num">Quantity</th>
        <th class="num">Gross Wt (Kg)</th>
        <th class="num">Net Wt (Kg)</th>
        <th>Booking / Invoice No.</th>
        <th>Loaded / Received / Damage / Shortage / Outstanding</th>
        <th>Ship Details</th>
        <th class="center">Customs</th>
        <th>Warehouse</th>
      </tr>
    </thead>
    <tbody>
      ${displayRows
        .map(
          (r) => `
        <tr>
          <td><b>${r.billNumber}</b><br><small style="color:#64748b">${r.sourceType === "local_purchase" ? "Local Purchase" : "Purchase Booking"}</small></td>
          <td>${fmtDateDisplay(r.date)}</td>
          <td><b>${r.countryName || "—"}</b><br><small>${r.branchName || "—"}</small></td>
          <td>${r.origin || r.countryName || "—"}</td>
          <td>${r.supplierName || "—"}</td>
          <td><b>${r.productName || "—"}</b></td>
          <td class="center">${r.unit || "—"}</td>
          <td class="num"><b>${fmtNum(r.quantity)}</b></td>
          <td class="num">${fmtNum(r.grossWeight || r.quantity)}</td>
          <td class="num">${fmtNum(r.netWeight || r.quantity)}</td>
          <td><b>${r.bookingNo || "—"}</b><br><small>${r.invoiceNo || "—"}</small></td>
          <td>Loaded: ${fmtNum(r.loadedQuantity || 0)} · Recv: ${fmtNum(r.receivedQuantity || 0)} · Dam: ${fmtNum(r.damagedQuantity || 0)} · Short: ${fmtNum(r.shortageQuantity || 0)} · Out: <b>${fmtNum(r.outstandingQuantity || 0)}</b></td>
          <td>${r.shipDetails || r.truckOrContainer || "—"}</td>
          <td class="center">${customsLabel(r.customsStatus)}</td>
          <td>${r.warehouseName || (r.stage === "transit" ? "In Transit" : "—")}</td>
        </tr>
      `
        )
        .join("")}
    </tbody>
  </table>
  <script>
    window.onload = function() { window.print(); };
  </script>
</body>
</html>`;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const printReport = async () => {
    const res = await api<ApiRows>(`/api/erp/inventory/journal-stock?${query(1, { limit: "2000" })}`);
    if (!res.ok) return setError(res.message || "");
    const sm = res.data!.summary;
    await openScopedGenericReport({
      title: s.t("title_entry", "Purchase / Stock Entry"),
      subtitle: `${tabLabel(tab)} · ${s.t("subtitle_print", "Purchase Booking → Loading → Receiving → Warehouse → Sale / Export")}`,
      orientation: "landscape",
      lang: s.lang,
      columns: [
        { key: "index", label: s.t("col_no", "#"), align: "center" },
        { key: "billNumber", label: s.t("col_bill", "Bill No.") },
        { key: "dateText", label: s.t("col_date", "Date"), align: "center" },
        { key: "countryName", label: s.t("col_country", "Country") },
        { key: "origin", label: s.t("col_origin", "Origin") },
        { key: "supplierName", label: s.t("col_supplier", "Sales Account") },
        { key: "productName", label: s.t("col_product", "Goods Name") },
        { key: "quantity", label: s.t("col_qty", "Quantity"), align: "right", format: "number" },
        { key: "unit", label: s.t("col_unit", "Unit"), align: "center" },
        { key: "grossWeight", label: s.t("col_gross_weight", "Gross Wt"), align: "right", format: "number" },
        { key: "netWeight", label: s.t("col_net_weight", "Net Wt"), align: "right", format: "number" },
        { key: "bookingNo", label: s.t("col_booking_no", "Booking No.") },
        { key: "receivedQuantity", label: s.t("col_received", "Received"), align: "right", format: "number" },
        { key: "customsText", label: s.t("col_customs", "Customs") },
        { key: "warehouseName", label: s.t("col_warehouse", "Warehouse") },
      ],
      rows: res.data!.rows.map((r, i) => ({
        ...r,
        index: i + 1,
        dateText: fmtDateDisplay(r.date),
        customsText: customsLabel(r.customsStatus),
        warehouseName: r.warehouseName ?? "",
      })),
      summary: {
        [s.t("card_booking", "Booking Stock")]: byUnitText(sm.booking),
        [s.t("card_confirmed_booking", "Confirmed Booking")]: byUnitText(sm.confirmedBooking),
        [s.t("card_transit", "Loading / Transit Stock")]: byUnitText(sm.transit),
        [s.t("card_receiving", "Receiving / Customs Stock")]: byUnitText(sm.receivingCustoms),
        [s.t("card_available", "Available / Mixed Stock")]: byUnitText(sm.availableMixed),
        [s.t("card_sold", "Sold / Exported Stock")]: byUnitText(sm.soldExported),
      },
    } as any);
  };

  const tabLabel = (t: StockTab) =>
    ({
      all: s.t("tab_all", "All Stock"),
      booking: s.t("tab_booking", "Booking Stock"),
      confirmed_booking: s.t("tab_confirmed_booking", "Confirmed Booking"),
      transit: s.t("tab_transit", "Loading / Transit"),
      receiving: s.t("tab_receiving", "Receiving & Customs"),
      ready: s.t("tab_ready", "Ready for Confirmation"),
      available: s.t("tab_available", "Available / Mixed"),
      sold: s.t("tab_sold", "Sold / Exported"),
    }[t]);

  const TABS: StockTab[] = ["all", "booking", "confirmed_booking", "transit", "receiving", "ready", "available", "sold"];

  const payTone = (p: StockJournalRow["paymentStatus"]) => (p === "paid" ? "black" : p === "partial" ? "amber" : "red");

  const cards: { id: string; icon: React.ComponentType<any>; label: string; c: CardTotals; tone: string; tab: StockTab; sub: string }[] = [
    { id: "sj-card-booking", icon: FileText, label: s.t("card_booking", "Booking Stock"), c: summary?.booking ?? emptyCard, tone: "bg-blue-600", tab: "booking", sub: "" },
    { id: "sj-card-confirmed", icon: CheckCircle2, label: s.t("card_confirmed_booking", "Confirmed Booking"), c: summary?.confirmedBooking ?? emptyCard, tone: "bg-indigo-600", tab: "confirmed_booking", sub: "" },
    { id: "sj-card-transit", icon: Truck, label: s.t("card_transit", "Loading / Transit Stock"), c: summary?.transit ?? emptyCard, tone: "bg-amber-600", tab: "transit", sub: "" },
    { id: "sj-card-receiving", icon: ShieldCheck, label: s.t("card_receiving", "Receiving / Customs Stock"), c: summary?.receivingCustoms ?? emptyCard, tone: "bg-orange-600", tab: "receiving", sub: summary ? `${s.t("card_ready_sub", "Ready for confirmation")}: ${topUnit(summary.readyForConfirmation).text}` : "" },
    { id: "sj-card-available", icon: Boxes, label: s.t("card_available", "Available / Mixed Stock"), c: summary?.availableMixed ?? emptyCard, tone: "bg-emerald-600", tab: "available", sub: summary ? `${s.t("card_reserved_sub", "Reserved")}: ${topUnit(summary.reserved).text}` : "" },
    { id: "sj-card-sold", icon: PackageCheck, label: s.t("card_sold", "Sold / Exported Stock"), c: summary?.soldExported ?? emptyCard, tone: "bg-slate-700", tab: "sold", sub: "" },
  ];

  const isFilteredLocally = Boolean(metricFilter || selectedCountry || selectedUnit);
  const totalEntries = isFilteredLocally ? displayRows.length : (data?.pagination?.totalRecords ?? rows.length);
  const fromEntry = totalEntries === 0 ? 0 : (page - 1) * LIMIT + 1;
  const toEntry = isFilteredLocally ? displayRows.length : Math.min(page * LIMIT, totalEntries);

  return (
    <div dir={s.dir} data-testid="stock-journal" className="mx-auto min-h-screen max-w-[1920px] space-y-2.5 p-2 sm:p-4">
      {/* ── Compact Unified Header Strip ── */}
      <header className="flex flex-col gap-2.5 rounded-xl border border-slate-200/90 bg-white p-2.5 sm:p-3 shadow-xs dark:border-slate-700/80 dark:bg-slate-800 xl:flex-row xl:items-center xl:justify-between print:hidden">
        {/* Left: Compact Title, Eyebrow & Icon */}
        <div className="flex items-center gap-2.5 shrink-0">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white shadow-xs">
            <Boxes className="h-5 w-5" />
          </span>
          <div>
            <div className="flex items-center gap-1.5 leading-none">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                {s.t("eyebrow_inventory_journal", "INVENTORY / STOCK JOURNAL")}
              </span>
              <span className="hidden text-[11px] font-bold text-slate-300 dark:text-slate-600 md:inline">•</span>
              <span className="hidden text-[11px] font-medium text-slate-400 md:inline">
                {s.t("subtitle_purchase_general_stock", "Your stock, from booking to delivery.")}
              </span>
            </div>
            <h1 className="text-[17px] font-black tracking-tight text-slate-900 dark:text-slate-50 leading-tight">
              {s.t("title_purchase_general_stock", "Purchase General Stock")}
            </h1>
          </div>
        </div>

        {/* Right: Search, Source Filters, Filters, Three-dot Menu, New Entry */}
        <div className="flex flex-wrap items-center gap-1.5 xl:justify-end">
          {/* Search Input */}
          <div className="relative min-w-[200px] flex-1 sm:w-56 sm:flex-initial">
            <Search className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              data-testid="sj-search"
              value={f.search}
              onChange={(e) => setF({ ...f, search: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setLoading(true);
                  setApplied({ ...f });
                  setPage(1);
                }
              }}
              placeholder={s.t("search_ph_entry", "Search purchase, supplier, product or invoice…")}
              className="h-8 w-full rounded-lg border border-slate-300 bg-white ps-8 pe-2.5 text-[12px] placeholder:text-slate-400 dark:border-slate-600 dark:bg-slate-900"
            />
          </div>

          {/* Source filters: All Purchases / Local Purchase / Purchase Booking */}
          <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50/80 p-0.5 dark:border-slate-700 dark:bg-slate-900/60">
            <button
              type="button"
              onClick={() => {
                setSourceType("all");
                setPage(1);
              }}
              className={`inline-flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-bold transition ${
                sourceType === "all"
                  ? "bg-blue-600 text-white shadow-xs font-black"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
              }`}
              title={s.t("source_all_purchases", "All Purchases")}
            >
              <Boxes className="h-3 w-3" />
              <span>{s.t("source_all_purchases", "All Purchases")}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setSourceType("local_purchase");
                setPage(1);
              }}
              className={`inline-flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-bold transition ${
                sourceType === "local_purchase"
                  ? "bg-emerald-600 text-white shadow-xs font-black"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
              }`}
              title={s.t("source_local_purchase", "Local Purchase")}
            >
              <ShoppingBag className="h-3 w-3 text-emerald-500" />
              <span>{s.t("source_local_purchase", "Local Purchase")}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setSourceType("purchase_booking");
                setPage(1);
              }}
              className={`inline-flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-bold transition ${
                sourceType === "purchase_booking"
                  ? "bg-indigo-600 text-white shadow-xs font-black"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
              }`}
              title={s.t("source_purchase_booking", "Purchase Booking")}
            >
              <FileText className="h-3 w-3 text-indigo-500" />
              <span>{s.t("source_purchase_booking", "Purchase Booking")}</span>
            </button>
          </div>

          {/* Filters Button */}
          <button
            type="button"
            onClick={() => setFiltersOpen(true)}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          >
            <Filter className="h-3.5 w-3.5 text-blue-600" />
            <span>{s.t("filters", "Filters")}</span>
            {activeChips.length > 0 && (
              <span className="rounded-full bg-blue-100 px-1.5 py-0.2 text-[11px] font-black text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                {activeChips.length}
              </span>
            )}
          </button>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={() => void load(page)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            title={s.t("refresh_records", "Refresh records")}
            aria-label={s.t("refresh_records", "Refresh records")}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>

          {/* Three-dot menu for Export CSV & Print / PDF */}
          <div className="relative">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setThreeDotOpen((v) => !v);
              }}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              aria-label={s.t("more_actions", "More actions")}
              title={s.t("more_actions", "More actions")}
            >
              <MoreVertical className="h-3.5 w-3.5" />
            </button>

            {threeDotOpen && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute end-0 top-9.5 z-50 w-44 rounded-xl border border-slate-200 bg-white py-1 shadow-xl dark:border-slate-700 dark:bg-slate-800"
              >
                <button
                  type="button"
                  onClick={() => {
                    setThreeDotOpen(false);
                    void exportCsv();
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-[12px] font-bold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  <Download className="h-3.5 w-3.5 text-blue-600" />
                  {s.t("export_csv", "Export CSV")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setThreeDotOpen(false);
                    printRecords();
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-[12px] font-bold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  <Printer className="h-3.5 w-3.5 text-indigo-600" />
                  {s.t("print_pdf", "Print / PDF")}
                </button>
              </div>
            )}
          </div>

          {/* New Purchase Entry */}
          <a
            href="/dashboard/purchase/purchase-order"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-[12px] font-bold text-white shadow-xs hover:bg-blue-700"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{s.t("btn_new_entry", "New Purchase Entry")}</span>
          </a>
        </div>
      </header>

      {/* ── Active Filter Chips (if any) ── */}
      {activeChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5 print:hidden">
          <span className="text-[11px] font-bold text-slate-500">Active filters:</span>
          {activeChips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={chip.onRemove}
              className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700 hover:bg-blue-100 dark:bg-blue-950/60 dark:text-blue-300"
            >
              <span>{chip.label}</span>
              <X className="h-3 w-3" />
            </button>
          ))}
          <button
            type="button"
            onClick={clearAllFilters}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-0.5 text-[11px] font-bold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300"
          >
            Clear all
          </button>
        </div>
      )}

      {/* ── Three Compact Stock Report Panels (Requirement 3) ── */}
      <section className="grid grid-cols-1 gap-2.5 lg:grid-cols-12 print:hidden">
        {/* Panel 1: Stock Summary */}
        <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs dark:border-slate-700 dark:bg-slate-800 lg:col-span-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
                  <Boxes className="h-4 w-4" />
                </span>
                <h2 className="text-[14px] font-black text-slate-800 dark:text-slate-100">
                  {s.t("panel_stock_summary", "Stock Summary")}
                </h2>
              </div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {s.t("panel_selected_scope", "Selected scope")}
              </span>
            </div>

            <div className="grid grid-cols-3 divide-x divide-slate-100 p-2.5 dark:divide-slate-700 min-h-[140px] items-stretch">
              {/* Total Stock */}
              <button
                type="button"
                onClick={() => setMetricFilter((v) => (v === "total" ? "" : "total"))}
                className={`flex flex-col justify-between rounded-lg p-2.5 text-start transition ${
                  metricFilter === "total"
                    ? "bg-blue-50/80 ring-2 ring-blue-500/30 dark:bg-blue-950/50"
                    : "hover:bg-slate-50 dark:hover:bg-slate-700/40"
                }`}
              >
                <span className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {s.t("metric_total_stock", "Total Stock")}
                </span>
                <div className="my-1.5 space-y-1">
                  {distinctUnits.map((u) => {
                    const qty = stockSummary.totalByUnit[u] || 0;
                    return (
                      <div key={u} className="flex items-baseline gap-1" dir="ltr">
                        <span className="text-[17px] font-black text-slate-900 dark:text-slate-50 tabular-nums">
                          {fmtNum(qty)}
                        </span>
                        <span className="text-[11px] font-medium text-slate-400">{u}</span>
                      </div>
                    );
                  })}
                </div>
                <span className="text-[11px] text-blue-600 font-semibold dark:text-blue-400">
                  {metricFilter === "total" ? `✓ ${t(s.lang, "tax_einv.set_f_active", "Active")}` : t(s.lang, "rozrep.click_to_view", "Click to view")}
                </span>
              </button>

              {/* Remaining to Receive */}
              <button
                type="button"
                onClick={() => setMetricFilter((v) => (v === "remaining" ? "" : "remaining"))}
                className={`flex flex-col justify-between rounded-lg p-2.5 text-start transition ${
                  metricFilter === "remaining"
                    ? "bg-amber-50/80 ring-2 ring-amber-500/30 dark:bg-amber-950/50"
                    : "hover:bg-slate-50 dark:hover:bg-slate-700/40"
                }`}
              >
                <span className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {s.t("metric_remaining_to_receive", "Remaining to Receive")}
                </span>
                <div className="my-1.5 space-y-1">
                  {distinctUnits.map((u) => {
                    const qty = stockSummary.remainingByUnit[u] || 0;
                    return (
                      <div key={u} className="flex items-baseline gap-1" dir="ltr">
                        <span className="text-[17px] font-black text-amber-600 dark:text-amber-400 tabular-nums">
                          {fmtNum(qty)}
                        </span>
                        <span className="text-[11px] font-medium text-slate-400">{u}</span>
                      </div>
                    );
                  })}
                </div>
                <span className="text-[11px] text-amber-600 font-semibold dark:text-amber-400">
                  {metricFilter === "remaining" ? `✓ ${t(s.lang, "tax_einv.set_f_active", "Active")}` : t(s.lang, "rozrep.click_to_view", "Click to view")}
                </span>
              </button>

              {/* Available Balance */}
              <button
                type="button"
                onClick={() => setMetricFilter((v) => (v === "available" ? "" : "available"))}
                className={`flex flex-col justify-between rounded-lg p-2.5 text-start transition ${
                  metricFilter === "available"
                    ? "bg-emerald-50/80 ring-2 ring-emerald-500/30 dark:bg-emerald-950/50"
                    : "hover:bg-slate-50 dark:hover:bg-slate-700/40"
                }`}
              >
                <span className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {s.t("metric_available_balance", "Available Balance")}
                </span>
                <div className="my-1.5 space-y-1">
                  {distinctUnits.map((u) => {
                    const qty = stockSummary.availableByUnit[u] || 0;
                    return (
                      <div key={u} className="flex items-baseline gap-1" dir="ltr">
                        <span className="text-[17px] font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                          {fmtNum(qty)}
                        </span>
                        <span className="text-[11px] font-medium text-slate-400">{u}</span>
                      </div>
                    );
                  })}
                </div>
                <span className="text-[11px] text-emerald-600 font-semibold dark:text-emerald-400">
                  {metricFilter === "available" ? `✓ ${t(s.lang, "tax_einv.set_f_active", "Active")}` : t(s.lang, "rozrep.click_to_view", "Click to view")}
                </span>
              </button>
            </div>
          </div>

          <div className="border-t border-slate-100 bg-slate-50/70 px-4 py-2 text-[11px] font-medium text-slate-400 dark:border-slate-700 dark:bg-slate-800/60">
            {s.t("panel_stock_footnote", "Quantities stay separate by unit. No Bags / Boxes conversion.")}
          </div>
        </article>

        {/* Panel 2: Stock by Stage */}
        <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs dark:border-slate-700 dark:bg-slate-800 lg:col-span-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400">
                  <Layers className="h-4 w-4" />
                </span>
                <h2 className="text-[14px] font-black text-slate-800 dark:text-slate-100">
                  {s.t("panel_stock_by_stage", "Stock by Stage")}
                </h2>
              </div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {s.t("panel_stage_records", "Records")}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1.5 p-3">
              {STAGE_ITEMS.map((st) => {
                const count = stageCounts[st.key] || 0;
                const isSelected = tab === st.key;
                return (
                  <button
                    key={st.key}
                    type="button"
                    onClick={() => {
                      goTab(st.key);
                      setMetricFilter("");
                    }}
                    className={`flex items-center justify-between rounded-lg px-2.5 py-2 text-start transition text-[11px] ${
                      isSelected
                        ? "bg-purple-50 text-purple-800 font-bold border border-purple-200 dark:bg-purple-950/60 dark:text-purple-200 dark:border-purple-800"
                        : "hover:bg-slate-50 text-slate-700 dark:text-slate-300 dark:hover:bg-slate-700/40"
                    }`}
                  >
                    <span className="inline-flex items-center gap-2 truncate">
                      <span className={`inline-block h-2 w-2 rounded-full shrink-0 ${st.dotClass}`} />
                      <span className="truncate">{st.label}</span>
                    </span>
                    <span className="ms-1.5 rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-black tabular-nums text-slate-700 dark:bg-slate-700 dark:text-slate-200" dir="ltr">
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="border-t border-slate-100 bg-slate-50/70 px-4 py-2 text-[11px] font-medium text-slate-400 dark:border-slate-700 dark:bg-slate-800/60">
            {s.t("panel_stage_footnote", "Click any stage to filter the table below.")}
          </div>
        </article>

        {/* Panel 3: Country-wise Stock */}
        <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs dark:border-slate-700 dark:bg-slate-800 lg:col-span-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-50 text-teal-600 dark:bg-teal-950/60 dark:text-teal-400">
                  <Globe className="h-4 w-4" />
                </span>
                <h2 className="text-[14px] font-black text-slate-800 dark:text-slate-100">
                  {s.t("panel_country_wise_stock", "Country-wise Stock")}
                </h2>
              </div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
                {s.t("panel_click_to_filter", "Click to filter")}
              </span>
            </div>

            <div className="grid grid-cols-12 bg-slate-50/80 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-slate-400 dark:bg-slate-800/80">
              <span className="col-span-6">{s.t("col_country_branch", "Country / Branch")}</span>
              <span className="col-span-3 text-end">{s.t("unit_bags", "Bags")}</span>
              <span className="col-span-3 text-end">{s.t("unit_boxes", "Boxes")}</span>
            </div>

            <div className="divide-y divide-slate-100 p-1 dark:divide-slate-700 max-h-[145px] overflow-y-auto">
              {countryBreakdown.length === 0 ? (
                <div className="p-4 text-center text-[11px] text-slate-400">
                  {s.t("no_country_records", "No country records")}
                </div>
              ) : (
                countryBreakdown.map((c) => {
                  const isSelected = selectedCountry === c.country;
                  return (
                    <button
                      key={c.country}
                      type="button"
                      onClick={() => setSelectedCountry((cur) => (cur === c.country ? "" : c.country))}
                      className={`grid w-full grid-cols-12 items-center rounded-md px-2.5 py-1.5 text-start transition text-[11px] ${
                        isSelected
                          ? "bg-teal-50 text-teal-900 font-bold border border-teal-200 dark:bg-teal-950/60 dark:text-teal-200 dark:border-teal-800"
                          : "hover:bg-slate-50 text-slate-700 dark:text-slate-300 dark:hover:bg-slate-700/40"
                      }`}
                    >
                      <span className="col-span-6 flex items-center gap-1.5 truncate">
                        <span className="text-sm leading-none shrink-0">{c.flag}</span>
                        <span className="truncate font-semibold">{c.country}</span>
                        {c.branch && <span className="text-[11px] text-slate-400 truncate">({c.branch})</span>}
                      </span>
                      <span className="col-span-3 text-end font-bold tabular-nums" dir="ltr">
                        {fmtNum(c.bags)}
                      </span>
                      <span className="col-span-3 text-end font-bold tabular-nums" dir="ltr">
                        {fmtNum(c.boxes)}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="border-t border-slate-100 bg-slate-50/70 px-4 py-2 text-[11px] font-medium text-slate-400 dark:border-slate-700 dark:bg-slate-800/60">
            {selectedCountry ? `Filtering by ${selectedCountry} · Click row to clear` : "Click any country to filter records."}
          </div>
        </article>
      </section>

      {/* ── Filter Overlay Panel (SimpleModal) ── */}
      <SimpleModal
        isOpen={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title={s.t("modal_filter_title", "Filter Stock")}
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4">
          <p className="text-[12px] text-slate-500">
            {s.t("modal_filter_desc", "Choose your scope. Filters apply to reports and the stock table.")}
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* Source Type */}
            <label className="space-y-1">
              <span className="text-[12px] font-bold text-slate-700 dark:text-slate-200">
                {s.t("col_source_type", "Stock Source")}
              </span>
              <select
                value={sourceType}
                onChange={(e) => setSourceType(e.target.value as any)}
                className="min-h-[40px] w-full rounded-lg border border-slate-300 bg-white px-3 text-[13px] dark:border-slate-600 dark:bg-slate-900"
              >
                <option value="all">All Purchases (Local & Import)</option>
                <option value="local_purchase">Local Purchase</option>
                <option value="purchase_booking">Purchase Booking (Import)</option>
              </select>
            </label>

            {/* Country */}
            <label className="space-y-1">
              <span className="text-[12px] font-bold text-slate-700 dark:text-slate-200">
                {s.t("col_country", "Country")}
              </span>
              <select
                value={f.countryId}
                onChange={(e) => setF({ ...f, countryId: e.target.value })}
                className="min-h-[40px] w-full rounded-lg border border-slate-300 bg-white px-3 text-[13px] dark:border-slate-600 dark:bg-slate-900"
              >
                <option value="">All Countries</option>
                {distinctCountries.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>

            {/* Branch */}
            <label className="space-y-1">
              <span className="text-[12px] font-bold text-slate-700 dark:text-slate-200">
                {s.t("col_branch", "Branch")}
              </span>
              <select
                value={f.countryBranchId}
                onChange={(e) => setF({ ...f, countryBranchId: e.target.value })}
                className="min-h-[40px] w-full rounded-lg border border-slate-300 bg-white px-3 text-[13px] dark:border-slate-600 dark:bg-slate-900"
              >
                <option value="">All Branches</option>
                {distinctBranches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>

            {/* Unit */}
            <label className="space-y-1">
              <span className="text-[12px] font-bold text-slate-700 dark:text-slate-200">
                {s.t("col_unit", "Unit")}
              </span>
              <select
                value={selectedUnit}
                onChange={(e) => setSelectedUnit(e.target.value)}
                className="min-h-[40px] w-full rounded-lg border border-slate-300 bg-white px-3 text-[13px] dark:border-slate-600 dark:bg-slate-900"
              >
                <option value="">All Units</option>
                {distinctUnits.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </label>

            {/* Date From */}
            <label className="space-y-1">
              <span className="text-[12px] font-bold text-slate-700 dark:text-slate-200">
                {s.t("from_date", "From Date")}
              </span>
              <input
                type="date"
                value={f.dateFrom}
                onChange={(e) => setF({ ...f, dateFrom: e.target.value })}
                className="min-h-[40px] w-full rounded-lg border border-slate-300 bg-white px-3 text-[13px] dark:border-slate-600 dark:bg-slate-900"
              />
            </label>

            {/* Date To */}
            <label className="space-y-1">
              <span className="text-[12px] font-bold text-slate-700 dark:text-slate-200">
                {s.t("to_date", "To Date")}
              </span>
              <input
                type="date"
                value={f.dateTo}
                onChange={(e) => setF({ ...f, dateTo: e.target.value })}
                className="min-h-[40px] w-full rounded-lg border border-slate-300 bg-white px-3 text-[13px] dark:border-slate-600 dark:bg-slate-900"
              />
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-700">
            <button
              type="button"
              onClick={() => {
                clearAllFilters();
                setFiltersOpen(false);
              }}
              className="min-h-[38px] rounded-lg border border-slate-300 px-4 text-[13px] font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200"
            >
              {s.t("reset", "Reset")}
            </button>
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                setApplied(f);
                setPage(1);
                setFiltersOpen(false);
              }}
              className="min-h-[38px] rounded-lg bg-blue-600 px-4 text-[13px] font-bold text-white hover:bg-blue-700"
            >
              {s.t("apply", "Apply Filters")}
            </button>
          </div>
        </div>
      </SimpleModal>

      {/* ── Stage Tabs ── */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-slate-200/90 bg-white p-2 shadow-xs dark:border-slate-700/80 dark:bg-slate-800">
        <div className="flex gap-1 overflow-x-auto pb-0.5" role="tablist">
          {TABS.map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              type="button"
              data-testid={`sj-tab-${t}`}
              onClick={() => goTab(t)}
              className={`min-h-[32px] shrink-0 rounded-lg px-3 text-[11px] font-black transition ${
                tab === t
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-100"
              }`}
            >
              {tabLabel(t)}
            </button>
          ))}
        </div>

        {tab === "available" && (
          <div className="flex gap-1.5">
            {(["report", "rows"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setAvailableView(v)}
                className={`min-h-[34px] rounded-lg px-3 text-[12px] font-bold ${
                  availableView === v
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-100"
                }`}
              >
                {v === "report" ? s.t("view_report", "Consolidated report") : s.t("view_rows", "Transaction rows")}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Table / Content ── */}
      {tab === "available" && availableView === "report" ? (
        <div className="space-y-2" data-testid="sj-available-report">
          {loading && !groups ? (
            <div className="flex items-center justify-center gap-2 rounded-2xl border bg-white p-10 text-slate-500 dark:bg-slate-800">
              <Loader2 className="h-5 w-5 animate-spin" />
              {s.t("loading", "Loading…")}
            </div>
          ) : null}
          {groups && groups.length === 0 && (
            <div className="rounded-2xl border bg-white p-10 text-center text-[14px] text-slate-500 dark:bg-slate-800">
              {s.t("empty", "No stock records match these filters.")}
            </div>
          )}
          {(groups ?? []).map((g, gi) => {
            const key = `${g.productName}|${g.warehouseId}|${gi}`;
            const open = expanded === key;
            return (
              <div key={key} className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
                <button
                  type="button"
                  data-testid="sj-group"
                  onClick={() => setExpanded(open ? null : key)}
                  className="grid w-full grid-cols-2 items-center gap-3 p-3.5 text-start hover:bg-slate-50 dark:hover:bg-slate-700/40 md:grid-cols-6"
                >
                  <span className="col-span-2 min-w-0 md:col-span-2">
                    <span className="block truncate text-[15px] font-black text-slate-900 dark:text-slate-50">{g.productName || "—"}</span>
                    <span className="block truncate text-[12px] text-slate-500">
                      {g.countryName} · {g.branchName}
                    </span>
                  </span>
                  <span className="flex min-w-0 items-center gap-1.5 text-[13px] font-semibold text-slate-700 dark:text-slate-200">
                    <WarehouseIcon className="h-4 w-4 shrink-0 text-slate-400" />
                    <span className="truncate">{g.warehouseName || "—"}</span>
                  </span>
                  <span>
                    <span className="block text-[11px] font-bold uppercase text-slate-500">{s.t("avail_available", "Available")}</span>
                    <span className="text-[16px] font-black tabular-nums text-emerald-700 dark:text-emerald-300" dir="ltr">
                      {fmtNum(g.available)} {g.unit}
                    </span>
                  </span>
                  <span>
                    <span className="block text-[11px] font-bold uppercase text-slate-500">{s.t("avail_reserved", "Reserved")}</span>
                    <span className="text-[16px] font-black tabular-nums text-violet-700 dark:text-violet-300" dir="ltr">
                      {fmtNum(g.reserved)} {g.unit}
                    </span>
                  </span>
                  <span className="flex items-center justify-between gap-2 text-[12px] font-bold text-slate-500">
                    <span>
                      {g.sources.length} {s.t("sources", "sources")}
                    </span>
                    <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} />
                  </span>
                </button>
                {open && (
                  <div className="overflow-x-auto border-t border-slate-100 dark:border-slate-700">
                    <table className="w-full min-w-[720px] text-[13px]">
                      <thead className="bg-slate-50 dark:bg-slate-900/50">
                        <tr>
                          {[
                            s.t("col_bill", "Bill No."),
                            s.t("col_container", "Container / Truck"),
                            s.t("col_status", "Status"),
                            s.t("col_qty", "Quantity"),
                            s.t("col_transfer", "Allocation"),
                            s.t("col_customer", "Customer"),
                            "",
                          ].map((h, i) => (
                            <th key={i} className="px-3 py-2.5 text-start text-[12px] font-black uppercase tracking-wide text-slate-600 dark:text-slate-300 whitespace-nowrap">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {g.sources.map((src, si) => (
                          <tr key={si} className="border-t border-slate-100 dark:border-slate-700">
                            <td className="px-3 py-2 font-bold">{src.bookingNo}</td>
                            <td className="px-3 py-2">{src.container || "—"}</td>
                            <td className="px-3 py-2">
                              <span
                                className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${
                                  STAGE_STYLE[src.stage as StockStage]?.cls || ""
                                }`}
                              >
                                {stageLabel(src.stage as StockStage)}
                              </span>
                            </td>
                            <td className="px-3 py-2 tabular-nums" dir="ltr">
                              {fmtNum(src.quantity)} {g.unit}
                            </td>
                            <td className="px-3 py-2">
                              {src.transferNo ? `${src.transferNo}${src.destination ? " · " + destLabel(src.destination) : ""}` : "—"}
                            </td>
                            <td className="px-3 py-2">{src.customer || "—"}</td>
                            <td className="px-3 py-2">
                              <div className="flex flex-wrap gap-1.5">
                                <button
                                  type="button"
                                  data-testid="sj-source-history"
                                  onClick={() =>
                                    setHistoryRow({
                                      sourceType: src.sourceType,
                                      sourceId: src.sourceId,
                                      loadingRecordId: src.loadingRecordId,
                                      title: `${src.bookingNo} · ${g.productName}`,
                                    })
                                  }
                                  className="inline-flex min-h-[32px] items-center gap-1 rounded-lg border border-slate-300 px-2.5 text-[12px] font-bold text-slate-700 dark:border-slate-600 dark:text-slate-100"
                                >
                                  <History className="h-3.5 w-3.5" />
                                  {s.t("act_history", "History")}
                                </button>
                                {src.canIssue && src.transferId && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setIssueRow({
                                        id: src.transferId!,
                                        label: `${src.transferNo} · ${g.productName}`,
                                        qty: src.quantity,
                                        unit: g.unit,
                                        salesOrderNo: null,
                                      })
                                    }
                                    className="inline-flex min-h-[32px] items-center gap-1 rounded-lg bg-blue-600 px-2.5 text-[12px] font-bold text-white"
                                  >
                                    <Truck className="h-3.5 w-3.5" />
                                    {s.t("act_issue", "Issue / Dispatch")}
                                  </button>
                                )}
                                {src.canReverse && src.transferId && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setReverseRow({
                                        id: src.transferId!,
                                        label: `${src.transferNo} · ${g.productName}`,
                                      })
                                    }
                                    className="inline-flex min-h-[32px] items-center gap-1 rounded-lg border border-red-300 bg-red-50 px-2.5 text-[12px] font-bold text-red-800"
                                  >
                                    <Undo2 className="h-3.5 w-3.5" />
                                    {s.t("act_reverse", "Reverse")}
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <>
          {/* ── Table Header matching Reference ── */}
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between px-1 print:hidden">
            <div className="flex items-center gap-2.5">
              <h2 className="text-[16px] font-black text-slate-900 dark:text-slate-100">
                {metricFilter
                  ? {
                      total: s.t("metric_total_stock", "Total Stock"),
                      remaining: s.t("metric_remaining_to_receive", "Remaining to Receive"),
                      available: s.t("metric_available_balance", "Available Balance"),
                    }[metricFilter]
                  : tabLabel(tab)}
              </h2>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {displayRows.length} {s.t("records", "records")}
              </span>
            </div>
            <span className="text-[11px] font-medium text-slate-400">
              {s.t("scroll_hint", "Scroll horizontally to see all 16 columns →")}
            </span>
          </div>

          {/* ── Desktop Table with 16 Exact Columns ── */}
          <div
            aria-busy={loading}
            className={`hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-xs transition-opacity dark:border-slate-700 dark:bg-slate-800 md:block ${
              loading ? "opacity-60" : ""
            }`}
          >
            <table className="w-full min-w-[1700px] text-[13px]" data-testid="sj-table">
              <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/60">
                <tr>
                  <th className="min-w-[170px] px-3 py-3 text-start text-[12px] font-black uppercase text-slate-500">{s.t("col_bill", "Purchase No.")}</th>
                  <th className="min-w-[95px] px-3 py-3 text-start text-[12px] font-black uppercase text-slate-500">{s.t("col_date", "Date")}</th>
                  <th className="min-w-[140px] px-3 py-3 text-start text-[12px] font-black uppercase text-slate-500">{s.t("col_country_branch", "Country / Branch")}</th>
                  <th className="min-w-[90px] px-3 py-3 text-start text-[12px] font-black uppercase text-slate-500">{s.t("col_origin", "Origin")}</th>
                  <th className="min-w-[140px] px-3 py-3 text-start text-[12px] font-black uppercase text-slate-500">{s.t("col_supplier", "Supplier")}</th>
                  <th className="min-w-[140px] px-3 py-3 text-start text-[12px] font-black uppercase text-slate-500">{s.t("col_product", "Product")}</th>
                  <th className="min-w-[90px] px-2.5 py-3 text-center text-[12px] font-black uppercase text-slate-500">{s.t("col_unit", "Unit")}</th>
                  <th className="min-w-[90px] px-3 py-3 text-end text-[12px] font-black uppercase text-slate-500">{s.t("col_qty", "Quantity")}</th>
                  <th className="min-w-[105px] px-3 py-3 text-end text-[12px] font-black uppercase text-slate-500">{s.t("col_gross_weight", "Gross Weight (Kg)")}</th>
                  <th className="min-w-[105px] px-3 py-3 text-end text-[12px] font-black uppercase text-slate-500">{s.t("col_net_weight", "Net Weight (Kg)")}</th>
                  <th className="min-w-[130px] px-3 py-3 text-start text-[12px] font-black uppercase text-slate-500">{s.t("col_booking_invoice_no", "Booking / Invoice No.")}</th>
                  <th className="min-w-[220px] px-3 py-3 text-start text-[12px] font-black uppercase text-slate-500">{s.t("col_receiving", "Loaded / Received / Damage / Shortage / Outstanding")}</th>
                  <th className="min-w-[125px] px-3 py-3 text-start text-[12px] font-black uppercase text-slate-500">{s.t("col_ship_details", "Ship Details")}</th>
                  <th className="min-w-[95px] px-2.5 py-3 text-center text-[12px] font-black uppercase text-slate-500">{s.t("col_customs", "Customs")}</th>
                  <th className="min-w-[125px] px-3 py-3 text-start text-[12px] font-black uppercase text-slate-500">{s.t("col_warehouse", "Warehouse")}</th>
                  <th className="w-16 px-2 py-3 text-center text-[12px] font-black uppercase text-slate-500">{s.t("col_actions", "Actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {loading && displayRows.length === 0 && (
                  <tr>
                    <td colSpan={16} className="p-12 text-center text-slate-500">
                      <Loader2 className="mx-auto h-6 w-6 animate-spin text-blue-600" />
                      <span className="mt-2 block font-medium">{s.t("loading", "Loading…")}</span>
                    </td>
                  </tr>
                )}
                {!loading && displayRows.length === 0 && (
                  <tr>
                    <td colSpan={16} className="p-12 text-center text-[14px] text-slate-500">
                      {s.t("empty", "No stock records match these filters.")}
                    </td>
                  </tr>
                )}
                {displayRows.map((r) => {
                  const grossWeight = r.grossWeight || r.quantity;
                  const netWeight = r.netWeight || (r.grossWeight ? Math.round(r.grossWeight * 0.984) : r.quantity);
                  const isMenuOpen = openMenuRowId === r.id;

                  return (
                    <tr
                      key={r.id}
                      data-testid="sj-row"
                      data-stage={r.stage}
                      className="align-middle transition-colors hover:bg-blue-50/40 dark:hover:bg-slate-700/40"
                    >
                      {/* 1. Purchase No. */}
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          onClick={() => setViewRow(r)}
                          className="group inline-flex items-center gap-1.5 text-start font-bold text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          <span className="text-base leading-none">{getCountryFlag(r.countryCode, r.countryName)}</span>
                          <span className="underline-offset-2 group-hover:underline" dir="ltr">
                            {r.billNumber}
                          </span>
                        </button>
                        <div className="text-[11px] font-semibold text-slate-400">
                          {r.sourceType === "local_purchase" ? s.t("type_local", "Local Purchase") : s.t("type_booking", "Purchase Booking")}
                        </div>
                      </td>

                      {/* 3. Date */}
                      <td className="px-3 py-3 text-[12px] font-medium text-slate-700 dark:text-slate-200" dir="ltr">
                        {fmtDateDisplay(r.date)}
                      </td>

                      {/* 4. Country / Branch */}
                      <td className="px-3 py-3">
                        <div className="flex items-start gap-1.5">
                          <span className="text-base leading-none mt-0.5">{getCountryFlag(r.countryCode, r.countryName)}</span>
                          <div>
                            <div className="font-bold text-slate-900 dark:text-slate-100">{r.countryName || "—"}</div>
                            <div className="text-[11px] text-slate-500">{r.branchName || "—"}</div>
                          </div>
                        </div>
                      </td>

                      {/* 5. Origin */}
                      <td className="px-3 py-3 text-[13px] font-medium text-slate-700 dark:text-slate-200">
                        {r.origin || r.countryName || "—"}
                      </td>

                      {/* 6. Sales Account */}
                      <td className="px-3 py-3 text-[13px] font-bold text-slate-800 dark:text-slate-100">
                        {r.supplierName || "—"}
                      </td>

                      {/* 7. Goods Name */}
                      <td className="px-3 py-3">
                        <div className="font-bold text-slate-900 dark:text-slate-100">
                          {r.productName || <span className="text-amber-600">{s.t("goods_not_entered", "Goods not entered")}</span>}
                        </div>
                        {(r.brand || r.size) && (
                          <div className="text-[11px] text-slate-500">{[r.brand, r.size].filter(Boolean).join(" · ")}</div>
                        )}
                      </td>

                      {/* 8. Quantity Unit */}
                      <td className="px-2.5 py-3 text-center text-[12px] font-semibold text-slate-700 dark:text-slate-300">
                        {r.unit || "—"}
                      </td>

                      {/* 9. Quantity */}
                      <td className="px-3 py-3 text-end font-bold tabular-nums text-slate-900 dark:text-slate-100" dir="ltr">
                        {fmtNum(r.quantity)}
                      </td>

                      {/* 10. Gross Weight (Kg) */}
                      <td className="px-3 py-3 text-end font-medium tabular-nums text-slate-700 dark:text-slate-200" dir="ltr">
                        {fmtNum(grossWeight)}
                      </td>

                      {/* 11. Net Weight (Kg) */}
                      <td className="px-3 py-3 text-end font-medium tabular-nums text-slate-700 dark:text-slate-200" dir="ltr">
                        {fmtNum(netWeight)}
                      </td>

                      {/* 12. Booking / Invoice No. */}
                      <td className="px-3 py-3 text-[11px]">
                        <div className="text-[11px] font-medium text-slate-400">Booking No.</div>
                        <div className="font-bold text-blue-600 dark:text-blue-400" dir="ltr">
                          {r.bookingNo || "—"}
                        </div>
                        <div className="mt-0.5 text-[11px] font-medium text-slate-400">Invoice No.</div>
                        <div className="font-bold text-blue-600 dark:text-blue-400" dir="ltr">
                          {r.invoiceNo || "—"}
                        </div>
                      </td>

                      {/* 13. Loaded / Received / Damage / Shortage / Outstanding */}
                      <td className="px-3 py-3" dir="ltr">
                        <ProgressCell r={r} />
                      </td>

                      {/* 14. Ship Details */}
                      <td className="px-3 py-3 text-[12px] font-semibold text-slate-800 dark:text-slate-200 leading-tight">
                        {r.shipDetails || r.truckOrContainer || "—"}
                      </td>

                      {/* 15. Customs */}
                      <td className="px-2.5 py-3 text-center">
                        <CustomsBadge status={r.customsStatus} stage={r.stage} />
                      </td>

                      {/* 16. Warehouse */}
                      <td className="px-3 py-3 text-[12px] font-medium text-slate-700 dark:text-slate-300">
                        {r.warehouseName || (r.stage === "transit" ? "In Transit" : "—")}
                      </td>

                      {/* 17. Actions */}
                      <td className="relative px-2 py-3 text-center">
                        <div className="inline-flex items-center justify-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuRowId(isMenuOpen ? null : r.id);
                            }}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                            aria-label={s.t("col_actions", "Actions")}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </div>

                        {/* Floating Action Menu dropdown */}
                        {isMenuOpen && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="absolute end-2 top-11 z-30 w-44 rounded-xl border border-slate-200 bg-white py-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-800 text-start"
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setViewRow(r);
                                setOpenMenuRowId(null);
                              }}
                              className="flex w-full items-center gap-2 px-3 py-2 text-[12px] font-bold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
                            >
                              <Eye className="h-3.5 w-3.5 text-blue-600" />
                              {s.t("act_view", "View")}
                            </button>
                            <a
                              href={
                                r.sourceType === "local_purchase"
                                  ? `/dashboard/purchase/local-purchase/${r.sourceId}`
                                  : `/dashboard/purchase/purchase-order?id=${r.sourceId}`
                              }
                              className="flex w-full items-center gap-2 px-3 py-2 text-[12px] font-bold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
                            >
                              <Pencil className="h-3.5 w-3.5 text-amber-600" />
                              {s.t("act_edit", "Edit")}
                            </a>
                            <button
                              type="button"
                              onClick={() => {
                                setHistoryRow({
                                  sourceType: r.sourceType,
                                  sourceId: r.sourceId,
                                  loadingRecordId: r.loadingRecordId,
                                  title: `${r.billNumber} · ${r.productName}`,
                                });
                                setOpenMenuRowId(null);
                              }}
                              className="flex w-full items-center gap-2 px-3 py-2 text-[12px] font-bold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
                            >
                              <History className="h-3.5 w-3.5 text-indigo-600" />
                              {s.t("act_history", "History")}
                            </button>
                            {r.stage === "ready" && r.canConfirm && (
                              <button
                                type="button"
                                onClick={() => {
                                  setConfirmRow(r);
                                  setOpenMenuRowId(null);
                                }}
                                className="flex w-full items-center gap-2 px-3 py-2 text-[12px] font-bold text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                              >
                                <ClipboardCheck className="h-3.5 w-3.5" />
                                {s.t("act_confirm", "Confirm Stock")}
                              </button>
                            )}
                            {(r.stage === "receiving" || r.stage === "ready" || r.stage === "transit") &&
                              r.loadingRecordId &&
                              perms.confirm && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCustomsRow(r);
                                    setOpenMenuRowId(null);
                                  }}
                                  className="flex w-full items-center gap-2 px-3 py-2 text-[12px] font-bold text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/40"
                                >
                                  <ShieldCheck className="h-3.5 w-3.5" />
                                  {s.t("act_customs", "Customs")}
                                </button>
                              )}
                            {r.canIssue && r.transferId && (
                              <button
                                type="button"
                                onClick={() => {
                                  setIssueRow({
                                    id: r.transferId!,
                                    label: `${r.transferNo} · ${r.productName}`,
                                    qty: r.quantity,
                                    unit: r.unit,
                                    salesOrderNo: r.salesOrderNo,
                                  });
                                  setOpenMenuRowId(null);
                                }}
                                className="flex w-full items-center gap-2 px-3 py-2 text-[12px] font-bold text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                              >
                                <Truck className="h-3.5 w-3.5" />
                                {s.t("act_issue", "Issue / Dispatch")}
                              </button>
                            )}
                            {r.canReverse && r.transferId && (
                              <button
                                type="button"
                                onClick={() => {
                                  setReverseRow({
                                    id: r.transferId!,
                                    label: `${r.transferNo} · ${r.productName}`,
                                  });
                                  setOpenMenuRowId(null);
                                }}
                                className="flex w-full items-center gap-2 px-3 py-2 text-[12px] font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                              >
                                <Undo2 className="h-3.5 w-3.5" />
                                {s.t("act_reverse", "Reverse")}
                              </button>
                            )}
                            {r.goodsTransferHref && (
                              <a
                                href={r.goodsTransferHref}
                                className="flex w-full items-center gap-2 px-3 py-2 text-[12px] font-bold text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                                {s.t("act_goods_journal", "Goods Transfer Journal")}
                              </a>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ── Mobile View Cards ── */}
          <div aria-busy={loading} className={`space-y-3 transition-opacity md:hidden ${loading ? "opacity-60" : ""}`} data-testid="sj-cards">
            {!loading && displayRows.length === 0 && (
              <div className="rounded-2xl border bg-white p-8 text-center text-[14px] text-slate-500 dark:bg-slate-800">
                {s.t("empty", "No stock records match these filters.")}
              </div>
            )}
            {displayRows.map((r) => (
              <div
                key={r.id}
                data-testid="sj-row"
                data-stage={r.stage}
                className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-700 dark:bg-slate-800"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() => setViewRow(r)}
                      className="flex items-center gap-1.5 text-start font-black text-blue-600 dark:text-blue-400"
                    >
                      <span className="text-lg leading-none">{getCountryFlag(r.countryCode, r.countryName)}</span>
                      <span className="truncate text-[15px]" dir="ltr">
                        {r.billNumber}
                      </span>
                    </button>
                    <div className="truncate text-[13px] font-bold">{r.productName || s.t("goods_not_entered", "Goods not entered")}</div>
                    <div className="truncate text-[12px] text-slate-500">{r.supplierName}</div>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-bold ${
                      STAGE_STYLE[r.stage]?.cls || ""
                    }`}
                  >
                    {stageLabel(r.stage)}
                  </span>
                </div>

                <div className="flex items-baseline gap-2" dir="ltr">
                  <span className="text-[20px] font-black tabular-nums">{fmtNum(r.quantity)}</span>
                  <span className="text-[13px] text-slate-500">{r.unit}</span>
                  {r.currencyCode && <span className="text-[12px] text-slate-500">· {r.currencyCode}</span>}
                </div>

                <div className="grid grid-cols-2 gap-2 text-[12px] text-slate-600 dark:text-slate-300">
                  <div>
                    <span className="block text-[11px] uppercase text-slate-400">Origin</span>
                    <span className="font-semibold">{r.origin || r.countryName || "—"}</span>
                  </div>
                  <div>
                    <span className="block text-[11px] uppercase text-slate-400">Date</span>
                    <span className="font-semibold" dir="ltr">
                      {fmtDateDisplay(r.date)}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[11px] uppercase text-slate-400">Gross / Net (Kg)</span>
                    <span className="font-semibold" dir="ltr">
                      {fmtNum(r.grossWeight || r.quantity)} / {fmtNum(r.netWeight || r.quantity)}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[11px] uppercase text-slate-400">Customs</span>
                    <CustomsBadge status={r.customsStatus} stage={r.stage} />
                  </div>
                </div>

                <ProgressCell r={r} />

                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setViewRow(r)}
                    className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 text-[12px] font-bold text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  >
                    <Eye className="h-3.5 w-3.5 text-blue-600" />
                    {s.t("act_view", "View")}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setHistoryRow({
                        sourceType: r.sourceType,
                        sourceId: r.sourceId,
                        loadingRecordId: r.loadingRecordId,
                        title: `${r.billNumber} · ${r.productName}`,
                      })
                    }
                    className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 text-[12px] font-bold text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  >
                    <History className="h-3.5 w-3.5" />
                    {s.t("act_history", "History")}
                  </button>
                  {r.stage === "ready" && r.canConfirm && (
                    <button
                      type="button"
                      onClick={() => setConfirmRow(r)}
                      className="inline-flex min-h-[34px] items-center gap-1 rounded-lg bg-emerald-600 px-3 text-[12px] font-bold text-white hover:bg-emerald-700"
                    >
                      <ClipboardCheck className="h-3.5 w-3.5" />
                      {s.t("act_confirm", "Confirm Stock")}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* ── Footer Pagination matching Image 2 ── */}
          <div className="flex flex-col items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[13px] font-semibold dark:border-slate-700 dark:bg-slate-800 sm:flex-row">
            <span className="text-slate-600 dark:text-slate-300">
              {s.tGlobal("ujr.showing_range", "Showing {from} to {to} of {count} entries").replace("{from}", String(fromEntry)).replace("{to}", String(toEntry)).replace("{count}", String(totalEntries))}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => void load(page - 1)}
                className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-300 px-3 text-[12px] font-bold text-slate-700 disabled:opacity-40 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                {s.tGlobal("common.previous", "Previous")}
              </button>
              {Array.from({ length: Math.min(5, data?.pagination?.totalPages || 1) }, (_, i) => i + 1).map((pNum) => (
                <button
                  key={pNum}
                  type="button"
                  onClick={() => void load(pNum)}
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-lg text-[12px] font-black transition ${
                    page === pNum
                      ? "bg-blue-600 text-white shadow-xs"
                      : "border border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200"
                  }`}
                >
                  {pNum}
                </button>
              ))}
              <button
                type="button"
                disabled={page >= (data?.pagination?.totalPages || 1)}
                onClick={() => void load(page + 1)}
                className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-300 px-3 text-[12px] font-bold text-slate-700 disabled:opacity-40 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                {s.tGlobal("common.next", "Next")}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Modals ── */}
      {viewRow && (
        <ViewModal
          s={s}
          row={viewRow}
          onClose={() => setViewRow(null)}
          onOpenHistory={() => {
            setHistoryRow({
              sourceType: viewRow.sourceType,
              sourceId: viewRow.sourceId,
              loadingRecordId: viewRow.loadingRecordId,
              title: `${viewRow.billNumber} · ${viewRow.productName}`,
            });
            setViewRow(null);
          }}
          onOpenConfirm={() => {
            setConfirmRow(viewRow);
            setViewRow(null);
          }}
          onOpenCustoms={() => {
            setCustomsRow(viewRow);
            setViewRow(null);
          }}
        />
      )}
      {confirmRow && <ConfirmModal s={s} row={confirmRow} warehouses={warehouses} destLabel={destLabel} onClose={() => setConfirmRow(null)} onDone={(m) => { setConfirmRow(null); refreshAfter(m); }} />}
      {issueRow && <IssueModal s={s} row={issueRow} onClose={() => setIssueRow(null)} onDone={(m) => { setIssueRow(null); refreshAfter(m); }} />}
      {reverseRow && <ReverseModal s={s} row={reverseRow} onClose={() => setReverseRow(null)} onDone={(m) => { setReverseRow(null); refreshAfter(m); }} />}
      {customsRow && <CustomsModal s={s} row={customsRow} onClose={() => setCustomsRow(null)} onDone={(m) => { setCustomsRow(null); refreshAfter(m); }} />}
      {historyRow && <HistoryModal s={s} target={historyRow} onClose={() => setHistoryRow(null)} />}
    </div>
  );
}

/* ─────────────────────────── ViewModal (Inspection) ─────────────────────────── */

function ViewModal({
  s,
  row,
  onClose,
  onOpenHistory,
  onOpenConfirm,
  onOpenCustoms,
}: {
  s: ReturnType<typeof useErpScreen>;
  row: StockJournalRow;
  onClose: () => void;
  onOpenHistory?: () => void;
  onOpenConfirm?: () => void;
  onOpenCustoms?: () => void;
}) {
  const grossWeight = row.grossWeight || row.quantity;
  const netWeight = row.netWeight || (row.grossWeight ? Math.round(row.grossWeight * 0.984) : row.quantity);

  return (
    <SimpleModal title={`${row.billNumber} — ${row.productName || "Stock Details"}`} onClose={onClose} maxWidth="max-w-4xl">
      <div className="space-y-4">
        {/* Header summary badge */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-3.5 dark:bg-slate-900/50">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{getCountryFlag(row.countryCode, row.countryName)}</span>
            <div>
              <div className="text-[16px] font-black text-slate-900 dark:text-slate-50" dir="ltr">
                {row.billNumber}
              </div>
              <div className="text-[12px] text-slate-500">
                {row.countryName} · {row.branchName}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <CustomsBadge status={row.customsStatus} stage={row.stage} />
            <span
              className={`inline-flex items-center rounded-full border px-3 py-1 text-[12px] font-bold ${
                STAGE_STYLE[row.stage]?.cls || ""
              }`}
            >
              {row.stage}
            </span>
          </div>
        </div>

        {/* 2-column info grid */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
            <span className="block text-[11px] font-bold uppercase text-slate-400">Sales Account</span>
            <span className="text-[14px] font-black text-slate-800 dark:text-slate-100">{row.supplierName || "—"}</span>
          </div>
          <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
            <span className="block text-[11px] font-bold uppercase text-slate-400">Origin</span>
            <span className="text-[14px] font-black text-slate-800 dark:text-slate-100">{row.origin || row.countryName || "—"}</span>
          </div>
          <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
            <span className="block text-[11px] font-bold uppercase text-slate-400">Date</span>
            <span className="text-[14px] font-black text-slate-800 dark:text-slate-100" dir="ltr">
              {fmtDateDisplay(row.date)}
            </span>
          </div>
          <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
            <span className="block text-[11px] font-bold uppercase text-slate-400">Goods Name</span>
            <span className="text-[14px] font-black text-slate-800 dark:text-slate-100">{row.productName || "—"}</span>
          </div>
          <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
            <span className="block text-[11px] font-bold uppercase text-slate-400">Quantity & Unit</span>
            <span className="text-[14px] font-black text-slate-800 dark:text-slate-100" dir="ltr">
              {fmtNum(row.quantity)} {row.unit}
            </span>
          </div>
          <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
            <span className="block text-[11px] font-bold uppercase text-slate-400">Gross / Net Weight</span>
            <span className="text-[14px] font-black text-slate-800 dark:text-slate-100" dir="ltr">
              {fmtNum(grossWeight)} / {fmtNum(netWeight)} Kg
            </span>
          </div>
          <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
            <span className="block text-[11px] font-bold uppercase text-slate-400">Booking / Invoice</span>
            <span className="text-[13px] font-bold text-blue-600 dark:text-blue-400" dir="ltr">
              {row.bookingNo} / {row.invoiceNo}
            </span>
          </div>
          <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
            <span className="block text-[11px] font-bold uppercase text-slate-400">Ship Details</span>
            <span className="text-[13px] font-semibold text-slate-800 dark:text-slate-200">
              {row.shipDetails || row.truckOrContainer || "—"}
            </span>
          </div>
          <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
            <span className="block text-[11px] font-bold uppercase text-slate-400">Warehouse</span>
            <span className="text-[14px] font-black text-slate-800 dark:text-slate-100">{row.warehouseName || "—"}</span>
          </div>
        </div>

        {/* Progress & Receiving breakdown */}
        <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
          <span className="block text-[12px] font-bold uppercase text-slate-500 mb-2">Physical Progression & Receipt</span>
          <ProgressCell r={row} />
        </div>

        {/* Action triggers */}
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-3 dark:border-slate-700">
          {onOpenHistory && (
            <button
              type="button"
              onClick={onOpenHistory}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-[13px] font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200"
            >
              <History className="h-4 w-4" />
              {s.t("act_history", "History")}
            </button>
          )}
          {row.stage === "ready" && row.canConfirm && onOpenConfirm && (
            <button
              type="button"
              onClick={onOpenConfirm}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-emerald-600 px-4 text-[13px] font-bold text-white hover:bg-emerald-700"
            >
              <ClipboardCheck className="h-4 w-4" />
              {s.t("act_confirm", "Confirm Stock")}
            </button>
          )}
          {onOpenCustoms && row.loadingRecordId && (
            <button
              type="button"
              onClick={onOpenCustoms}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-orange-300 bg-orange-50 px-3 text-[13px] font-bold text-orange-800 hover:bg-orange-100 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-200"
            >
              <ShieldCheck className="h-4 w-4" />
              {s.t("act_customs", "Customs")}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="min-h-[38px] rounded-lg border border-slate-300 px-4 text-[13px] font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200"
          >
            {s.t("close", "Close")}
          </button>
        </div>
      </div>
    </SimpleModal>
  );
}

/* ─────────────────────────── standard modals ─────────────────────────── */

type S = ReturnType<typeof useErpScreen>;
const inputCls = "min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3 text-[14px] dark:border-slate-600 dark:bg-slate-900";
const Field = ({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) => (
  <label className="block space-y-1">
    <span className="text-[13px] font-bold text-slate-700 dark:text-slate-200">{label}</span>
    {children}
    {hint && <span className="block text-[12px] text-slate-500">{hint}</span>}
  </label>
);
const ErrorBox = ({ msg }: { msg: string | null }) =>
  msg ? (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 p-3 text-[13px] font-semibold text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      {msg}
    </div>
  ) : null;

const SubmitBar = ({
  s,
  busy,
  disabled,
  label,
  onCancel,
  tone = "bg-emerald-600 hover:bg-emerald-700",
  testId,
}: {
  s: S;
  busy: boolean;
  disabled?: boolean;
  label: string;
  onCancel: () => void;
  tone?: string;
  testId: string;
}) => (
  <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-700">
    <button
      type="button"
      onClick={onCancel}
      className="min-h-[44px] rounded-lg border border-slate-300 px-4 text-[14px] font-bold text-slate-700 dark:border-slate-600 dark:text-slate-100"
    >
      {s.t("cancel", "Cancel")}
    </button>
    <button
      type="submit"
      data-testid={testId}
      disabled={busy || disabled}
      className={`inline-flex min-h-[44px] items-center gap-2 rounded-lg px-5 text-[14px] font-bold text-white disabled:opacity-50 ${tone}`}
    >
      {busy && <Loader2 className="h-4 w-4 animate-spin" />}
      {label}
    </button>
  </div>
);

function ConfirmModal({
  s,
  row,
  warehouses,
  destLabel,
  onClose,
  onDone,
}: {
  s: S;
  row: StockJournalRow;
  warehouses: Warehouse[];
  destLabel: (d: string | null) => string;
  onClose: () => void;
  onDone: (m: string) => void;
}) {
  const [dest, setDest] = useState<DestinationType>("warehouse");
  const [warehouseId, setWarehouseId] = useState(row.warehouseId ?? "");
  const [qty, setQty] = useState(String(row.quantity));
  const [customerQ, setCustomerQ] = useState("");
  const [customer, setCustomer] = useState<{ id: string | null; name: string } | null>(null);
  const [results, setResults] = useState<{ id: string; name: string; code?: string }[]>([]);
  const [salesNo, setSalesNo] = useState("");
  const [docRef, setDocRef] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [remarks, setRemarks] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const key = useRef(newKey());
  const holding = row.warehouseId;
  const needsCustomer = dest === "direct_sale";
  const options: { v: DestinationType; icon: React.ComponentType<any>; label: string; hint: string }[] = [
    { v: "warehouse", icon: WarehouseIcon, label: s.t("dest_warehouse", "Warehouse Storage"), hint: s.t("dest_warehouse_hint", "Store in a warehouse (moves stock if it is a different warehouse).") },
    { v: "local_sales", icon: ShoppingBag, label: s.t("dest_local", "Local Market Stock"), hint: s.t("dest_local_hint", "Keep as local-market stock for branch sales.") },
    { v: "export", icon: Ship, label: s.t("dest_export", "Export Stock"), hint: s.t("dest_export_hint", "Reserve for an export shipment.") },
    { v: "direct_sale", icon: ArrowLeftRight, label: s.t("dest_direct", "Direct Sale / Delivery"), hint: s.t("dest_direct_hint", "Reserve for a customer sale or delivery.") },
  ];

  useEffect(() => {
    if (customerQ.trim().length < 2) {
      setResults([]);
      return;
    }
    const ac = new AbortController();
    const id = window.setTimeout(async () => {
      const r = await api<any>(`/api/erp/customers?q=${encodeURIComponent(customerQ.trim())}&limit=12`, { signal: ac.signal });
      const list = r.ok ? r.data?.customers ?? r.data?.rows ?? r.data ?? [] : [];
      setResults(
        (Array.isArray(list) ? list : []).slice(0, 12).map((c: any) => ({
          id: c.id,
          name: c.customer_name || c.name || [c.first_name, c.last_name].filter(Boolean).join(" "),
          code: c.person_code,
        }))
      );
    }, 250);
    return () => {
      window.clearTimeout(id);
      ac.abort();
    };
  }, [customerQ]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    const q = Number(qty);
    if (!(q > 0) || q > row.quantity + 0.0001) return setErr(`${s.t("err_qty", "Quantity must be between 0 and")} ${fmtNum(row.quantity)}`);
    if (dest === "warehouse" && !warehouseId) return setErr(s.t("err_warehouse", "Select the warehouse."));
    if (needsCustomer && !customer && !customerQ.trim()) return setErr(s.t("err_customer", "Select the customer for a Direct Sale / Delivery."));
    if (!authorized) return setErr(s.t("err_authorize", "Tick the authorization box to confirm the allocation."));
    setBusy(true);
    const res = await api<any>("/api/erp/inventory/journal-stock/confirm", {
      method: "POST",
      body: JSON.stringify({
        idempotencyKey: key.current,
        purchaseOrderId: row.sourceId,
        loadingRecordId: row.loadingRecordId,
        lineKey: row.lineKey,
        destinationType: dest,
        warehouseId: dest === "warehouse" ? warehouseId : holding || warehouseId || null,
        quantity: q,
        customerId: customer?.id ?? null,
        customerName: customer?.name || customerQ.trim() || null,
        salesOrderNo: salesNo.trim() || null,
        documentRef: docRef.trim() || null,
        remarks: remarks.trim() || null,
        transferDate: date,
        authorized: true,
      }),
    });
    setBusy(false);
    if (!res.ok) return setErr(res.message || s.t("err_generic", "The request failed."));
    onDone(`${s.t("ok_confirmed", "Stock confirmed")}: ${res.data?.transfer?.transfer_no ?? ""}`);
  };

  return (
    <SimpleModal title={s.t("confirm_title", "Confirm Stock")} onClose={onClose} maxWidth="max-w-3xl">
      <form onSubmit={submit} className="space-y-4" data-testid="sj-confirm-form">
        <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-[13px] dark:bg-slate-900/50 sm:grid-cols-3">
          <div>
            <div className="text-[11px] font-bold uppercase text-slate-500">{s.t("col_bill", "Bill No.")}</div>
            <div className="font-black">{row.billNumber}</div>
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase text-slate-500">{s.t("col_product", "Product")}</div>
            <div className="font-black">{row.productName}</div>
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase text-slate-500">{s.t("col_container", "Container / Truck")}</div>
            <div className="font-black">{row.truckOrContainer || "—"}</div>
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase text-slate-500">{s.t("col_country_branch", "Country / Branch")}</div>
            <div className="font-black">
              {row.countryName} · {row.branchName}
            </div>
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase text-slate-500">{s.t("ready_qty", "Ready to confirm")}</div>
            <div className="font-black tabular-nums" dir="ltr">
              {fmtNum(row.quantity)} {row.unit}
            </div>
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase text-slate-500">{s.t("col_customs", "Customs")}</div>
            <div className="font-black">{s.t("customs_cleared", "Customs: Cleared")}</div>
          </div>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-[13px] font-bold text-slate-700 dark:text-slate-200">{s.t("destination", "Destination")}</legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {options.map((o) => {
              const Icon = o.icon;
              return (
                <button
                  type="button"
                  key={o.v}
                  data-testid={`sj-dest-${o.v}`}
                  aria-pressed={dest === o.v}
                  onClick={() => setDest(o.v)}
                  className={`flex min-h-[64px] items-start gap-3 rounded-xl border p-3 text-start transition ${
                    dest === o.v
                      ? "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/20 dark:bg-emerald-950/30"
                      : "border-slate-200 hover:border-slate-300 dark:border-slate-700"
                  }`}
                >
                  <Icon className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
                  <span>
                    <span className="block text-[14px] font-black">{o.label}</span>
                    <span className="block text-[12px] text-slate-600 dark:text-slate-300">{o.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field
            label={s.t("col_warehouse", "Warehouse")}
            hint={dest !== "warehouse" && holding ? s.t("stays_in_wh", "The stock stays in the warehouse that holds it.") : undefined}
          >
            <select
              data-testid="sj-warehouse"
              value={dest === "warehouse" ? warehouseId : holding || warehouseId}
              disabled={dest !== "warehouse" && !!holding}
              onChange={(e) => setWarehouseId(e.target.value)}
              className={inputCls}
            >
              <option value="">{s.t("select_warehouse", "Select warehouse")}</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.warehouse_name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={s.t("col_qty", "Quantity")}>
            <div className="flex gap-2">
              <input data-testid="sj-qty" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} className={inputCls} dir="ltr" />
              <button
                type="button"
                onClick={() => setQty(String(row.quantity))}
                className="min-h-[44px] shrink-0 rounded-lg border border-slate-300 px-3 text-[12px] font-bold dark:border-slate-600"
              >
                {s.t("max", "All")}
              </button>
            </div>
          </Field>
        </div>

        {(dest === "direct_sale" || dest === "export") && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={`${s.t("col_customer", "Customer")}${needsCustomer ? " *" : ""}`}>
              <div className="relative">
                <input
                  data-testid="sj-customer"
                  value={customer ? customer.name : customerQ}
                  onChange={(e) => {
                    setCustomer(null);
                    setCustomerQ(e.target.value);
                  }}
                  placeholder={s.t("customer_ph", "Type 2+ letters to search")}
                  className={inputCls}
                />
                {!customer && results.length > 0 && (
                  <ul className="absolute z-20 mt-1 max-h-52 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-600 dark:bg-slate-800">
                    {results.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setCustomer({ id: c.id, name: c.name });
                            setResults([]);
                          }}
                          className="block min-h-[40px] w-full px-3 text-start text-[13px] hover:bg-slate-100 dark:hover:bg-slate-700"
                        >
                          {c.name}
                          {c.code ? ` · ${c.code}` : ""}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Field>
            <Field label={s.t("sales_ref", "Sales booking no.")}>
              <input data-testid="sj-salesno" value={salesNo} onChange={(e) => setSalesNo(e.target.value)} className={inputCls} dir="ltr" />
            </Field>
          </div>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={s.t("doc_ref", "Document reference")}>
            <input data-testid="sj-docref" value={docRef} onChange={(e) => setDocRef(e.target.value)} className={inputCls} dir="ltr" />
          </Field>
          <Field label={s.t("col_date", "Date")}>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
          </Field>
        </div>
        <Field label={s.t("remarks", "Remarks")}>
          <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} className={`${inputCls} py-2`} />
        </Field>

        <label className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-[13px] font-semibold text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
          <input
            data-testid="sj-authorize"
            type="checkbox"
            checked={authorized}
            onChange={(e) => setAuthorized(e.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0"
          />
          <span>
            {s.t("authorize", "I am an authorized user and I confirm this allocation of")} {fmtNum(Number(qty) || 0)} {row.unit} → {destLabel(dest)}.
          </span>
        </label>
        <ErrorBox msg={err} />
        <SubmitBar s={s} busy={busy} label={s.t("confirm_submit", "Confirm allocation")} onCancel={onClose} testId="sj-confirm-submit" />
      </form>
    </SimpleModal>
  );
}

function IssueModal({
  s,
  row,
  onClose,
  onDone,
}: {
  s: S;
  row: { id: string; label: string; qty: number; unit: string; salesOrderNo: string | null };
  onClose: () => void;
  onDone: (m: string) => void;
}) {
  const [type, setType] = useState<"goods_issue" | "dispatch" | "delivery">("delivery");
  const [ref, setRef] = useState("");
  const [so, setSo] = useState(row.salesOrderNo ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (!ref.trim()) return setErr(s.t("err_issue_ref", "Enter the document reference."));
    setBusy(true);
    const res = await api<any>("/api/erp/inventory/journal-stock/issue", {
      method: "POST",
      body: JSON.stringify({ transferId: row.id, issueType: type, issueRef: ref.trim(), salesOrderNo: so.trim() || null }),
    });
    setBusy(false);
    if (!res.ok) return setErr(res.message || s.t("err_generic", "The request failed."));
    onDone(`${s.t("ok_issued", "Stock issued")}: ${res.data?.transfer?.transfer_no ?? ""}`);
  };

  return (
    <SimpleModal title={s.t("issue_title", "Goods Issue / Dispatch / Delivery")} onClose={onClose} maxWidth="max-w-xl">
      <form onSubmit={submit} className="space-y-4" data-testid="sj-issue-form">
        <div className="rounded-xl bg-slate-50 p-3 text-[13px] font-bold dark:bg-slate-900/50">
          {row.label} · <span dir="ltr">{fmtNum(row.qty)} {row.unit}</span>
        </div>
        <p className="text-[13px] text-slate-600 dark:text-slate-300">
          {s.t("issue_note", "Physical stock is deducted only now, once. Issuing the same allocation again changes nothing.")}
        </p>
        <Field label={s.t("issue_type", "Event")}>
          <select data-testid="sj-issue-type" value={type} onChange={(e) => setType(e.target.value as any)} className={inputCls}>
            <option value="goods_issue">{s.t("issue_goods_issue", "Goods Issue")}</option>
            <option value="dispatch">{s.t("issue_dispatch", "Dispatch")}</option>
            <option value="delivery">{s.t("issue_delivery", "Delivery")}</option>
          </select>
        </Field>
        <Field label={`${s.t("doc_ref", "Document reference")} *`}>
          <input data-testid="sj-issue-ref" value={ref} onChange={(e) => setRef(e.target.value)} className={inputCls} dir="ltr" />
        </Field>
        <Field label={s.t("sales_ref", "Sales booking no.")}>
          <input value={so} onChange={(e) => setSo(e.target.value)} className={inputCls} dir="ltr" />
        </Field>
        <ErrorBox msg={err} />
        <SubmitBar s={s} busy={busy} label={s.t("issue_submit", "Issue stock")} onCancel={onClose} tone="bg-blue-600 hover:bg-blue-700" testId="sj-issue-submit" />
      </form>
    </SimpleModal>
  );
}

function ReverseModal({ s, row, onClose, onDone }: { s: S; row: { id: string; label: string }; onClose: () => void; onDone: (m: string) => void }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (reason.trim().length < 3) return setErr(s.t("err_reason", "Enter the reason for the reversal."));
    setBusy(true);
    const res = await api<any>("/api/erp/inventory/journal-stock/reverse", {
      method: "POST",
      body: JSON.stringify({ transferId: row.id, reason: reason.trim() }),
    });
    setBusy(false);
    if (!res.ok) return setErr(res.message || s.t("err_generic", "The request failed."));
    onDone(`${s.t("ok_reversed", "Allocation reversed")}: ${res.data?.transfer?.transfer_no ?? ""}`);
  };

  return (
    <SimpleModal title={s.t("reverse_title", "Reverse allocation")} onClose={onClose} maxWidth="max-w-xl">
      <form onSubmit={submit} className="space-y-4" data-testid="sj-reverse-form">
        <div className="rounded-xl bg-slate-50 p-3 text-[13px] font-bold dark:bg-slate-900/50">{row.label}</div>
        <p className="text-[13px] text-slate-600 dark:text-slate-300">
          {s.t("reverse_note", "The reservation is released and any warehouse move is put back. The record stays in the audit trail.")}
        </p>
        <Field label={`${s.t("reason", "Reason")} *`}>
          <textarea data-testid="sj-reverse-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className={`${inputCls} py-2`} />
        </Field>
        <ErrorBox msg={err} />
        <SubmitBar s={s} busy={busy} label={s.t("reverse_submit", "Reverse")} onCancel={onClose} tone="bg-red-600 hover:bg-red-700" testId="sj-reverse-submit" />
      </form>
    </SimpleModal>
  );
}

function CustomsModal({ s, row, onClose, onDone }: { s: S; row: StockJournalRow; onClose: () => void; onDone: (m: string) => void }) {
  const [status, setStatus] = useState<"pending" | "submitted" | "cleared" | "not_applicable">(
    row.customsStatus === "not_recorded" ? "cleared" : (row.customsStatus as any)
  );
  const [ref, setRef] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const res = await api<any>("/api/erp/inventory/journal-stock/customs", {
      method: "POST",
      body: JSON.stringify({ loadingRecordId: row.loadingRecordId, customsStatus: status, reference: ref.trim() || null }),
    });
    setBusy(false);
    if (!res.ok) return setErr(res.message || s.t("err_generic", "The request failed."));
    onDone(s.t("ok_customs", "Customs status saved"));
  };

  return (
    <SimpleModal title={s.t("customs_title", "Customs status")} onClose={onClose} maxWidth="max-w-md">
      <form onSubmit={submit} className="space-y-4" data-testid="sj-customs-form">
        <div className="rounded-xl bg-slate-50 p-3 text-[13px] font-bold dark:bg-slate-900/50">
          {row.billNumber} · {row.truckOrContainer || row.loadingRecordNo}
        </div>
        <Field label={s.t("col_status", "Status")}>
          <select data-testid="sj-customs-status" value={status} onChange={(e) => setStatus(e.target.value as any)} className={inputCls}>
            <option value="pending">{s.t("customs_pending", "Customs: Pending")}</option>
            <option value="submitted">{s.t("customs_submitted", "Customs: Submitted")}</option>
            <option value="cleared">{s.t("customs_cleared", "Customs: Cleared")}</option>
            <option value="not_applicable">{s.t("customs_na", "Customs: Not required")}</option>
          </select>
        </Field>
        <Field label={s.t("doc_ref", "Document reference")}>
          <input value={ref} onChange={(e) => setRef(e.target.value)} className={inputCls} dir="ltr" />
        </Field>
        <ErrorBox msg={err} />
        <SubmitBar s={s} busy={busy} label={s.t("save", "Save")} onCancel={onClose} tone="bg-orange-600 hover:bg-orange-700" testId="sj-customs-submit" />
      </form>
    </SimpleModal>
  );
}

function HistoryModal({
  s,
  target,
  onClose,
}: {
  s: S;
  target: { sourceType: string; sourceId: string; loadingRecordId?: string | null; title: string };
  onClose: () => void;
}) {
  const [state, setState] = useState<{ loading: boolean; error?: string; head?: any; events?: HistoryEvent[] }>({ loading: true });

  useEffect(() => {
    let alive = true;
    const p = new URLSearchParams({ sourceType: target.sourceType, sourceId: target.sourceId });
    if (target.loadingRecordId) p.set("loadingRecordId", target.loadingRecordId);
    void api<any>(`/api/erp/inventory/journal-stock/history?${p}`).then((r) => {
      if (!alive) return;
      setState(r.ok ? { loading: false, head: r.data.head, events: r.data.events } : { loading: false, error: r.message });
    });
    return () => {
      alive = false;
    };
  }, [target]);

  const title = (e: HistoryEvent) => {
    const dest = e.title.replace(/^confirmed_/, "");
    const map: Record<string, string> = {
      booking_created: s.t("ev_booking", "Purchase booking created"),
      loaded: s.t("ev_loaded", "Loaded"),
      received: s.t("ev_received", "Received at destination"),
      customs_cleared: s.t("ev_customs_cleared", "Customs cleared"),
      customs_pending: s.t("ev_customs_pending", "Customs pending"),
      customs_submitted: s.t("ev_customs_submitted", "Customs submitted"),
      customs_not_applicable: s.t("ev_customs_na", "Customs not required"),
      stock_in: s.t("ev_stock_in", "Warehouse stock in"),
      stock_out: s.t("ev_stock_out", "Warehouse stock out"),
      reversed: s.t("ev_reversed", "Allocation reversed"),
      issued_goods_issue: s.t("ev_goods_issue", "Goods issued"),
      issued_dispatch: s.t("ev_dispatch", "Dispatched"),
      issued_delivery: s.t("ev_delivery", "Delivered"),
    };
    if (e.title.startsWith("confirmed_")) {
      const dLabel =
        ({
          warehouse: s.t("dest_warehouse", "Warehouse Storage"),
          local_sales: s.t("dest_local", "Local Market Stock"),
          export: s.t("dest_export", "Export Stock"),
          direct_sale: s.t("dest_direct", "Direct Sale / Delivery"),
        }[dest] || dest);
      return `${s.t("ev_confirmed", "Stock confirmed")} → ${dLabel}`;
    }
    if (e.title.startsWith("lot_")) return `${s.t("ev_lot", "Goods Transfer Journal")}: ${e.title.slice(4)}`;
    return map[e.title] || e.title;
  };

  const tone = (t: string) =>
    ({
      booking: "bg-blue-600",
      loading: "bg-amber-600",
      received: "bg-orange-600",
      customs: "bg-orange-500",
      stock_in: "bg-emerald-600",
      stock_out: "bg-slate-600",
      confirmed: "bg-emerald-700",
      issued: "bg-blue-700",
      reversed: "bg-red-600",
      lot_move: "bg-teal-600",
      payment: "bg-violet-600",
    }[t] || "bg-slate-500");

  return (
    <SimpleModal title={`${s.t("history_title", "Transaction history")} — ${target.title}`} onClose={onClose} maxWidth="max-w-3xl">
      <div data-testid="sj-history-modal" className="space-y-3">
        {state.loading && (
          <div className="flex items-center justify-center gap-2 p-8 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            {s.t("loading", "Loading…")}
          </div>
        )}
        {state.error && <ErrorBox msg={state.error} />}
        {state.head && (
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3 text-[13px] dark:bg-slate-900/50 sm:grid-cols-4">
            <div>
              <div className="text-[11px] font-bold uppercase text-slate-500">{s.t("col_bill", "Bill No.")}</div>
              <div className="font-black">{state.head.billNo}</div>
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase text-slate-500">{s.t("col_supplier", "Supplier")}</div>
              <div className="font-black">{state.head.supplier || "—"}</div>
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase text-slate-500">{s.t("col_country", "Country")}</div>
              <div className="font-black">{state.head.country || "—"}</div>
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase text-slate-500">{s.t("col_product", "Product")}</div>
              <div className="font-black">
                {(state.head.goods || []).map((g: any) => `${g.name} ${fmtNum(g.booked)} ${g.unit}`).join(" · ") || "—"}
              </div>
            </div>
          </div>
        )}
        {state.events && state.events.length === 0 && (
          <div className="p-6 text-center text-[14px] text-slate-500">{s.t("empty", "No stock records match these filters.")}</div>
        )}
        <ol className="space-y-2">
          {(state.events ?? []).map((e, i) => (
            <li key={i} data-testid="sj-event" className="flex gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
              <span className={`mt-1 h-3 w-3 shrink-0 rounded-full ${tone(e.type)}`} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-[14px] font-black">{title(e)}</span>
                  <span className="text-[12px] text-slate-500" dir="ltr">
                    {new Date(e.at).toISOString().replace("T", " ").slice(0, 16)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[12px] text-slate-600 dark:text-slate-300">
                  {e.quantity != null && (
                    <span dir="ltr">
                      {fmtNum(e.quantity)} {e.unit || ""}
                    </span>
                  )}
                  {e.reference && <span>{e.reference}</span>}
                  {e.warehouse && <span>{e.warehouse}</span>}
                  {e.actor && <span>{e.actor}</span>}
                  {e.note && <span className="text-slate-500">{e.note}</span>}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </SimpleModal>
  );
}
