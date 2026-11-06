"use client";

/**
 * P/S General Transfer — The Central Register for Purchase & Sales Business.
 *
 * After Loading, all four bill types pass through this register before moving to the next stage:
 *   1. Purchase Booking (purchase_booking)
 *   2. Local Purchase (local_purchase)
 *   3. Sales Booking (sales_booking)
 *   4. Local Sales (local_sales)
 *
 * From this register, authorized users can route/transfer selected bills to their applicable
 * destinations (General Purchase/Sales Expenses, Remaining Payment, JC, PC, Branch, or Agent)
 * with a center-screen responsive confirmation popup and full audit history.
 *
 * Strict Accounting Integrity:
 *   - No duplicate bills, stock movements, payments, or accounting entries are created.
 *   - Advance, Credit, and Remaining Payment validation rules are strictly preserved.
 *   - Shipping Lane Transfer remains completely separate.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import {
  ArrowRightLeft,
  Check,
  ChevronRight,
  ClipboardList,
  Clock,
  ExternalLink,
  FileBarChart,
  FileSpreadsheet,
  Globe,
  History,
  Layers,
  Loader2,
  PackageCheck,
  Receipt,
  RefreshCw,
  Search,
  ShoppingCart,
  TrendingUp,
  Truck,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { apiGet, apiPatch, apiPost } from "@/lib/api/client";
import {
  destinationRoute,
  defaultLaneTransferDestination,
  isModuleDestination,
  LANE_STATUSES,
  LANE_STATUS_LABEL,
  MODULE_DESTINATIONS,
  PS_TRANSFER_DESTINATIONS,
  RESPONSIBILITIES,
  SOURCE_TYPES,
  SOURCE_TYPE_LABEL,
  TRANSFER_TYPES,
  allowedNextStatuses,
  canChooseDisposition,
  transferProblems,
  type Disposition,
  type LaneStatus,
  type SourceType,
  type TransferRequest,
  type TransferType,
} from "@/lib/purchases/lane-rules";
import { Th } from "@/components/ui/translated-th";
import { LanePaymentPreview } from "./lane-payment-preview";
import { loadingJournalLinks } from "@/lib/purchases/loading-journal";

type Row = Record<string, any>;
type Detail = { load: Row; events: Row[]; expenses: Row[]; canAct: boolean };

const STATUS_TONE: Record<string, string> = {
  loaded: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  in_transit: "bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200",
  arrived: "bg-teal-100 text-teal-800 dark:bg-teal-950/50 dark:text-teal-200",
  transfer_pending: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200",
  assigned: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-200",
  customs_pending: "bg-orange-100 text-orange-800 dark:bg-orange-950/50 dark:text-orange-200",
  under_clearance: "bg-violet-100 text-violet-800 dark:bg-violet-950/50 dark:text-violet-200",
  customs_cleared: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200",
  final_disposition_pending: "bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-200",
  completed: "bg-emerald-200 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-100",
};

const SOURCE_TONE: Record<string, string> = {
  purchase_booking: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300",
  local_purchase: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300",
  sales_booking: "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300",
  local_sales: "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300",
};

const inputCls =
  "min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";
const btnCls =
  "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition disabled:opacity-50";

export function PurchaseTransitLaneView({
  lang,
  source,
}: {
  lang?: string;
  source?: "purchase_booking" | "local_purchase" | "sales_booking" | "local_sales" | null;
}) {
  const s = useErpScreen("plane", lang);
  const T = useCallback((k: string, fb: string) => s.t(k, fb), [s]);
  const stLabel = (st: string) =>
    T(LANE_STATUS_LABEL[st as LaneStatus]?.key ?? st, LANE_STATUS_LABEL[st as LaneStatus]?.en ?? st);

  const [rows, setRows] = useState<Row[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [laneStock, setLaneStock] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [routedUrl, setRoutedUrl] = useState<string | null>(null);
  const [linkedLoads, setLinkedLoads] = useState<Row[]>([]);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [sourceType, setSourceType] = useState<string>(source ?? "");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<Detail | null>(null);
  const [transferTargetLoads, setTransferTargetLoads] = useState<Row[] | null>(null);
  const [historyLoad, setHistoryLoad] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);

  // Deep links from other modules: ?po=<id>&laneIds=a,b&action=transfer&focus=<id>
  const [deep] = useState(() => {
    if (typeof window === "undefined")
      return { po: "", sourceId: "", laneIds: [] as string[], action: "", focus: "" };
    const p = new URLSearchParams(window.location.search);
    return {
      po: p.get("po") ?? "",
      sourceId: p.get("sourceId") ?? "",
      laneIds: (p.get("laneIds") ?? "").split(",").filter(Boolean),
      action: p.get("action") ?? "",
      focus: p.get("focus") ?? "",
    };
  });
  const [deepDone, setDeepDone] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (status) qs.set("status", status);
      if (q.trim()) qs.set("q", q.trim());
      if (sourceType) qs.set("sourceType", sourceType);
      if (deep.po) qs.set("purchaseOrderId", deep.po);
      if (deep.sourceId) qs.set("sourceId", deep.sourceId);
      const d = await apiGet<{ rows: Row[]; summary: Record<string, number>; laneStockQty: number }>(
        `/api/erp/purchases/lane?${qs.toString()}`
      );
      setRows(d.rows ?? []);
      setSummary(d.summary ?? {});
      setLaneStock(d.laneStockQty ?? 0);
      setSelected(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [status, q, sourceType, deep.po, deep.sourceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const openDetail = useCallback(async (id: string) => {
    setError(null);
    try {
      setDetail(await apiGet<Detail>(`/api/erp/purchases/lane/${id}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const openHistory = useCallback(async (r: Row) => {
    setHistoryLoad(r);
  }, []);

  useEffect(() => {
    if (deepDone || loading) return;
    setDeepDone(true);
    const present = rows.filter((r) => deep.laneIds.includes(r.id));
    if (deep.action === "transfer" && present.length) {
      setSelected(new Set(present.map((x) => x.id)));
      setTransferTargetLoads(present);
    } else if (deep.focus) {
      void openDetail(deep.focus);
    }
  }, [deepDone, loading, deep, rows, openDetail]);

  const refreshAll = useCallback(
    async (id?: string) => {
      await load();
      if (id) await openDetail(id);
    },
    [load, openDetail]
  );

  const act = async (id: string, body: Record<string, unknown>, ok: string) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await apiPatch(`/api/erp/purchases/lane/${id}`, body);
      setNotice(ok);
      await refreshAll(detail?.load.id === id ? id : undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const untransferred = useMemo(
    () => rows.filter((r) => r.lane_status === "loaded" && (r.owner_type === "branch" || !r.transfer_destination)),
    [rows]
  );

  const toggle = (id: string) =>
    setSelected((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const nextAction = (r: Row) => {
    if (r.lane_status === "transfer_pending")
      return {
        label: T("act_accept", "Accept transfer"),
        run: () => act(r.id, { action: "accept" }, T("done_accepted", "Transfer accepted.")),
      };
    if (canChooseDisposition(r.lane_status))
      return {
        label: T("act_dispose", "Choose final disposition"),
        run: () => openDetail(r.id),
      };
    const nx = allowedNextStatuses(r.lane_status)[0];
    if (nx)
      return {
        label: `${T("act_mark", "Mark")} ${stLabel(nx)}`,
        run: () => act(r.id, { action: "status", to: nx }, T("done_status", "Status updated.")),
      };
    return null;
  };

  const actionMenu = (r: Row, na: ReturnType<typeof nextAction>) => <select
    value="" disabled={busy} aria-label={s.tGlobal("common.actions", "Actions")} data-testid="lane-actions"
    className={`${inputCls} min-h-11 min-w-[170px] !w-auto`}
    onChange={(e) => { const action = e.target.value; if (action === "transfer") setTransferTargetLoads([r]); else if (action === "history") void openHistory(r); else if (action === "details") void openDetail(r.id); else if (action === "next" && na) void na.run(); }}>
      <option value="" disabled>{s.tGlobal("common.actions", "Actions")}</option>
      {r.lane_status !== "completed" && <option value="transfer">{T("act_transfer_load", "Transfer Load")}</option>}
      <option value="history">{T("col_transfer_history", "Transfer History")} ({r.history_count || 0})</option>
      {na && <option value="next">{na.label}</option>}
      <option value="details">{T("act_details", "Details")}</option>
    </select>;

  const billTypeLabel = (st: string) => {
    switch (st) {
      case "purchase_booking":
        return T("src_booking", "Purchase Booking");
      case "local_purchase":
        return T("src_local", "Local Purchase");
      case "sales_booking":
        return T("src_sales_booking", "Sales Booking");
      case "local_sales":
        return T("src_local_sales", "Local Sales");
      default:
        return st;
    }
  };

  return (
    <section
      dir={s.dir}
      className="min-h-screen bg-slate-50 pb-16 text-slate-900 dark:bg-slate-950 dark:text-slate-50"
      data-testid="plane-general-transfer"
    >
      <div className="mx-auto max-w-[1550px] space-y-3 px-3 py-4 sm:px-6">
        {/* Header */}
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200/80 pb-3 dark:border-slate-800">
          <div>
            <h1 className="flex items-center gap-2 text-lg font-black tracking-tight text-slate-900 dark:text-white">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm shadow-blue-500/30">
                <ArrowRightLeft className="h-4 w-4" />
              </span>
              {T("title", "P/S General Transfer")}
            </h1>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {T(
                "subtitle",
                "Central register for Purchase Booking, Local Purchase, Sales Booking, and Local Sales after loading. Route bills to General Expenses, Remaining Payment, JC, PC, or branches with audit history."
              )}
            </p>
          </div>

          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <select
              value={sourceType}
              onChange={(e) => setSourceType(e.target.value)}
              className={`${inputCls} !w-auto min-w-0 max-w-full flex-1 sm:flex-none font-bold`}
              aria-label={T("source", "Source")}
              data-testid="lane-source"
            >
              <option value="">{T("src_all", "All 4 Bill Types")}</option>
              <option value="purchase_booking">{T("src_booking", "Purchase Booking")}</option>
              <option value="local_purchase">{T("src_local", "Local Purchase")}</option>
              <option value="sales_booking">{T("src_sales_booking", "Sales Booking")}</option>
              <option value="local_sales">{T("src_local_sales", "Local Sales")}</option>
            </select>

            <button
              type="button"
              onClick={() => void load()}
              className={`${btnCls} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 shadow-sm`}
              data-testid="lane-refresh"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {T("refresh", "Refresh")}
            </button>
          </div>
        </header>

        {/* Status Chips */}
        <div className="flex flex-wrap gap-1.5" data-testid="lane-chips">
          <button
            type="button"
            onClick={() => setStatus("")}
            className={`${btnCls} ${
              status === ""
                ? "bg-blue-600 text-white shadow-sm shadow-blue-500/30"
                : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            }`}
          >
            {T("all", "All")} ({rows.length})
          </button>
          {LANE_STATUSES.map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatus(status === st ? "" : st)}
              data-testid={`chip-${st}`}
              className={`${btnCls} ${
                status === st
                  ? "bg-blue-600 text-white shadow-sm shadow-blue-500/30"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
              }`}
            >
              {stLabel(st)}{" "}
              <span className="rounded-full bg-black/10 px-1.5 text-[11px] font-mono font-bold dark:bg-white/10">
                {summary[st] ?? 0}
              </span>
            </button>
          ))}
        </div>

        {/* Search & Bulk Transfer Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-[240px] flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <Search className="h-3.5 w-3.5 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void load()}
              placeholder={T("search_ph", "Search bill no., container, BL, supplier, goods…")}
              className="w-full bg-transparent py-1.5 text-xs font-semibold outline-none"
              data-testid="lane-search"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold text-slate-600 dark:text-slate-300">
            <span
              className="rounded-lg bg-blue-50 px-2.5 py-1 text-blue-900 border border-blue-200/60 dark:bg-blue-950/40 dark:text-blue-200 dark:border-blue-900"
              data-testid="lane-stock"
            >
              {T("lane_stock", "Quantity in lane")}: <b>{laneStock.toLocaleString()}</b>
            </span>

            <button
              type="button"
              disabled={selected.size === 0}
              onClick={() => {
                const targets = rows.filter((r) => selected.has(r.id));
                setTransferTargetLoads(targets);
              }}
              className={`${btnCls} bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm shadow-indigo-500/20`}
              data-testid="bulk-selected"
            >
              <ArrowRightLeft className="h-3.5 w-3.5" />
              {T("act_transfer_selected", "Transfer Selected Containers")} ({selected.size})
            </button>

            <button
              type="button"
              disabled={untransferred.length === 0}
              onClick={() => setTransferTargetLoads(untransferred)}
              className={`${btnCls} border border-indigo-300 bg-white text-indigo-700 hover:bg-indigo-50 dark:bg-slate-900 dark:border-indigo-800 dark:text-indigo-300 shadow-sm`}
              data-testid="bulk-all"
            >
              <ArrowRightLeft className="h-3.5 w-3.5" />
              {T("act_transfer_all", "Transfer All Untransferred Loads")} ({untransferred.length})
            </button>
          </div>
        </div>

        {/* Status Alerts */}
        {error && (
          <div
            className="flex items-center justify-between rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 dark:border-rose-900 dark:bg-rose-950/30"
            role="alert"
            data-testid="lane-error"
          >
            <span>{error}</span>
            <button type="button" onClick={() => setError(null)}>
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {notice && (
          <div
            className="flex items-center justify-between rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30"
            data-testid="lane-notice"
          >
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>{notice}</span>
              {routedUrl && (
                <Link
                  href={routedUrl as any}
                  className="ms-2 inline-flex items-center gap-1 rounded bg-emerald-600 px-2 py-0.5 text-[11px] font-bold text-white hover:bg-emerald-700"
                >
                  <ExternalLink className="h-3 w-3" />
                  {T("open_destination", "Open in Destination Module")}
                </Link>
              )}
            </div>
            <button type="button" onClick={() => { setNotice(null); setRoutedUrl(null); setLinkedLoads([]); }}>
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {linkedLoads.length > 0 && <div className="grid gap-2 rounded-xl border bg-white p-3 text-sm sm:grid-cols-2 dark:bg-slate-900">
          {linkedLoads.map((r) => { const links = loadingJournalLinks(r.id, r.purchase_order_id, r.local_purchase_id); return <div key={r.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
            <span className="font-mono font-bold">{r.purchase_ref_no} · {r.loading_record_no || r.container_number}</span>
            <Link className="text-blue-700 underline dark:text-blue-300" href={links.expenses}>{s.tGlobal("utask.mod_journal", "Journal")} · {s.tGlobal("expenses", "Expenses")}</Link>
            <Link className="text-blue-700 underline dark:text-blue-300" href={links.tracking}>{s.tGlobal("log.seg_tracking", "Tracking")}</Link>
          </div>; })}
        </div>}

        {/* Content Body */}
        {loading ? (
          <div className="flex justify-center rounded-2xl border border-slate-200 bg-white p-12 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : rows.length === 0 ? (
          <div
            className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-xs font-semibold text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-900"
            data-testid="lane-empty"
          >
            {T("empty", "No loads in the register for your scope. A load enters the register when its loading is saved.")}
          </div>
        ) : (
          <>
            {/* Main Table */}
            <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm md:block dark:border-slate-800 dark:bg-slate-900">
              <table className="w-full min-w-[1200px] text-start text-xs" data-testid="lane-table">
                <thead className="border-b border-slate-200/80 bg-slate-50 text-[11px] font-black uppercase tracking-wider text-slate-600 dark:border-slate-800 dark:bg-slate-800/80 dark:text-slate-300">
                  <tr>
                    <Th className="p-2.5 w-8" />
                    <Th className="p-2.5 text-start">{T("col_bill_no", "Bill No. / Ref")}</Th>
                    <Th className="p-2.5 text-start">{T("col_bill_type", "Bill Type")}</Th>
                    <Th className="p-2.5 text-start">{T("col_party", "Party (Supplier/Customer)")}</Th>
                    <Th className="p-2.5 text-start">{T("col_goods", "Goods")}</Th>
                    <Th className="p-2.5 text-start">{T("col_container", "BL / Container")}</Th>
                    <Th className="p-2.5 text-end">{T("col_qty", "Loaded Qty")}</Th>
                    <Th className="p-2.5 text-end">{T("col_remaining_qty", "Remaining Qty")}</Th>
                    <Th className="p-2.5 text-start">{T("col_status", "Transfer Status")}</Th>
                    <Th className="p-2.5 text-start">{T("col_location", "Location / Assigned")}</Th>
                    <Th className="p-2.5 text-end">{T("col_next", "Action / Routing")}</Th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {rows.map((r) => {
                    const na = nextAction(r);
                    return (
                      <tr
                        key={r.id}
                        className="hover:bg-slate-50/70 transition-colors dark:hover:bg-slate-800/40"
                        data-testid={`lane-row-${r.container_number || r.id}`}
                      >
                        {/* Checkbox */}
                        <td className="p-2.5">
                          <input
                            type="checkbox"
                            checked={selected.has(r.id)}
                            disabled={r.lane_status === "completed"}
                            onChange={() => toggle(r.id)}
                            aria-label={T("select", "Select")}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                        </td>

                        {/* Bill No. / Ref */}
                        <td className="p-2.5 font-mono font-bold text-blue-700 dark:text-blue-400" dir="ltr">
                          {r.purchase_ref_no || "—"}
                          {r.loading_record_no && (
                            <div className="text-[10px] text-slate-400 font-normal">
                              LR: {r.loading_record_no}
                            </div>
                          )}
                        </td>

                        {/* Bill Type Badge */}
                        <td className="p-2.5">
                          <span
                            className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                              SOURCE_TONE[r.source_type] || "bg-slate-100 text-slate-700 border-slate-200"
                            }`}
                          >
                            {billTypeLabel(r.source_type)}
                          </span>
                        </td>

                        {/* Party */}
                        <td className="p-2.5 font-semibold text-slate-800 dark:text-slate-100" dir="auto">
                          {r.supplier_name || "—"}
                        </td>

                        {/* Goods */}
                        <td className="p-2.5" dir="auto">
                          <span className="font-medium text-slate-700 dark:text-slate-200">{r.goods_name || "—"}</span>
                        </td>

                        {/* BL / Container */}
                        <td className="p-2.5 font-mono text-[11px]" dir="ltr">
                          <div>
                            <span className="text-slate-400">BL:</span> {r.bl_number || "—"}
                          </div>
                          <div className="font-bold text-slate-700 dark:text-slate-300">
                            <span className="text-slate-400 font-normal">CTN:</span> {r.container_number || "—"}
                          </div>
                        </td>

                        {/* Loaded Qty */}
                        <td className="p-2.5 text-end font-mono font-bold text-slate-900 dark:text-white">
                          {Number(r.loaded_quantity || 0).toLocaleString()} <span className="text-[10px] font-normal text-slate-400">{r.unit || ""}</span>
                        </td>

                        {/* Remaining Qty */}
                        <td className="p-2.5 text-end font-mono font-bold text-amber-700 dark:text-amber-400">
                          {Number(r.remaining_quantity || 0).toLocaleString()} <span className="text-[10px] font-normal text-slate-400">{r.unit || ""}</span>
                        </td>

                        {/* Transfer Status */}
                        <td className="p-2.5">
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${
                              STATUS_TONE[r.lane_status] ?? ""
                            }`}
                            data-testid="lane-status"
                          >
                            {stLabel(r.lane_status)}
                          </span>
                          {r.transfer_destination && (
                            <div className="mt-0.5 text-[10px] font-semibold text-indigo-600 dark:text-indigo-400">
                              → {destinationName(r.transfer_destination, T)}
                            </div>
                          )}
                          {r.leg_no > 1 && (
                            <span className="ms-1 text-[10px] text-slate-400 font-normal">
                              ({T("leg", "leg")} {r.leg_no})
                            </span>
                          )}
                        </td>

                        {/* Location / Assigned */}
                        <td className="p-2.5 text-[11px]" dir="auto">
                          <div className="font-semibold text-slate-700 dark:text-slate-200">
                            {r.current_location || r.expected_location || "—"}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {ownerLabel(r, T)}
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="p-2.5 text-end">
                          {actionMenu(r, na)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="space-y-2 md:hidden" data-testid="lane-cards">
              {rows.map((r) => {
                const na = nextAction(r);
                return (
                  <div
                    key={r.id}
                    className="rounded-xl border border-slate-200 bg-white p-3.5 text-xs shadow-sm dark:border-slate-800 dark:bg-slate-900"
                  >
                    <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2 dark:border-slate-800">
                      <div>
                        <div className="flex items-center gap-1.5 font-mono font-black text-blue-700 dark:text-blue-400" dir="ltr">
                          {r.purchase_ref_no || "—"}
                          <span
                            className={`rounded px-1.5 py-0.2 text-[9px] font-bold uppercase ${
                              SOURCE_TONE[r.source_type] || "bg-slate-100"
                            }`}
                          >
                            {billTypeLabel(r.source_type)}
                          </span>
                        </div>
                        <div className="font-semibold text-slate-800 dark:text-slate-100" dir="auto">
                          {r.supplier_name || "—"} · {r.goods_name || "—"}
                        </div>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_TONE[r.lane_status] ?? ""}`}>
                        {stLabel(r.lane_status)}
                      </span>
                    </div>

                    <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-slate-600 dark:text-slate-300">
                      <span>
                        {T("col_container", "Container")}: <b dir="ltr">{r.container_number || "—"}</b>
                      </span>
                      <span>
                        {T("col_bl", "BL no.")}: <b dir="ltr">{r.bl_number || "—"}</b>
                      </span>
                      <span>
                        {T("col_qty", "Loaded Qty")}:{" "}
                        <b className="font-mono text-slate-900 dark:text-white">
                          {Number(r.loaded_quantity || 0).toLocaleString()} {r.unit || ""}
                        </b>
                      </span>
                      <span>
                        {T("col_remaining_qty", "Remaining Qty")}:{" "}
                        <b className="font-mono text-amber-700 dark:text-amber-400">
                          {Number(r.remaining_quantity || 0).toLocaleString()} {r.unit || ""}
                        </b>
                      </span>
                      <span className="col-span-2">
                        {T("col_location", "Location / Assigned")}: <b dir="auto">{r.current_location || ownerLabel(r, T)}</b>
                      </span>
                    </div>

                    <div className="mt-3 border-t pt-3">{actionMenu(r, na)}</div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Center-Screen Responsive Transfer Confirmation Popup */}
      {transferTargetLoads && (
        <CenterTransferConfirmationModal
          T={T}
          s={s}
          loads={transferTargetLoads}
          onClose={() => setTransferTargetLoads(null)}
          onDone={async (msg, targetUrl) => {
            setLinkedLoads(transferTargetLoads || []);
            setTransferTargetLoads(null);
            setNotice(msg);
            setRoutedUrl(targetUrl ?? null);
            await refreshAll(detail?.load.id);
          }}
          setError={setError}
        />
      )}

      {/* Transfer History Modal */}
      {historyLoad && (
        <TransferHistoryModal
          T={T}
          s={s}
          load={historyLoad}
          stLabel={stLabel}
          onClose={() => setHistoryLoad(null)}
        />
      )}

      {/* Centered Load Details */}
      {detail && (
        <DetailDialog
          T={T}
          s={s}
          stLabel={stLabel}
          detail={detail}
          busy={busy}
          onClose={() => setDetail(null)}
          onAct={act}
          onTransfer={() => setTransferTargetLoads([detail.load])}
          onChanged={() => refreshAll(detail.load.id)}
          setError={setError}
          setNotice={setNotice}
        />
      )}
    </section>
  );
}

function ownerLabel(r: Row, T: (k: string, fb: string) => string) {
  if (r.owner_type === "module") return `${destinationName(r.transfer_destination, T)}`;
  if (r.owner_type === "external_agent") return `${T("own_ext_agent", "External agent")}: ${r.owner_agent_name || "—"}`;
  if (r.owner_type === "internal_agent") return `${T("own_int_agent", "Internal agent")}: ${r.owner_agent_name || "—"}`;
  if (r.owner_type === "user" || r.owner_type === "self") return `${r.owner_user_name || "—"}`;
  return [r.owner_country_branch_name, r.owner_city_branch_name].filter(Boolean).join(" / ") || T("own_origin", "Loading branch");
}

function destinationName(dest: string, T: (k: string, fb: string) => string): string {
  switch (dest) {
    case "general_purchase_expenses":
      return T("dest_expenses_p", "General Purchase Expenses");
    case "general_sales_expenses":
      return T("dest_expenses_s", "General Sales Expenses");
    case "remaining_payment":
      return T("dest_payment", "Remaining Payment");
    case "jc_journal_voucher":
      return T("dest_jc", "JC (Journal Clearing / Voucher)");
    case "pc_petty_cash":
      return T("dest_pc", "PC (Petty Cash / Payment Certificate)");
    case "own_branch":
      return T("tt_own_branch", "Own branch");
    case "other_branch":
      return T("tt_other_branch", "Another country or city branch");
    case "internal_agent":
      return T("tt_internal_agent", "Internal clearing agent");
    case "external_agent":
      return T("tt_external_agent", "External clearing agent / logistics partner");
    case "other_user":
      return T("tt_other_user", "Another authorised user");
    case "self_managed":
      return T("tt_self", "Self-managed clearance");
    default:
      return dest;
  }
}

// ───────────────────────────────── Center-Screen Responsive Transfer Modal ─────────────────────────────────

function CenterTransferConfirmationModal({
  T,
  s,
  loads,
  onClose,
  onDone,
  setError,
}: {
  T: (k: string, fb: string) => string;
  s: any;
  loads: Row[];
  onClose: () => void;
  onDone: (msg: string, targetUrl?: string) => Promise<void>;
  setError: (m: string | null) => void;
}) {
  const ids = useMemo(() => loads.map((l) => l.id), [loads]);
  const primarySource = loads[0]?.source_type || "purchase_booking";
  const defaultDest = defaultLaneTransferDestination(primarySource);

  const [type, setType] = useState<TransferType>(defaultDest);
  const [afterView, setAfterView] = useState("destination");
  const [paymentReviewReady, setPaymentReviewReady] = useState(false);
  const [countryId, setCountryId] = useState("");
  const [countryBranchId, setCountryBranchId] = useState("");
  const [cityBranchId, setCityBranchId] = useState("");
  const [agentId, setAgentId] = useState("");
  const [agentName, setAgentName] = useState("");
  const [userId, setUserId] = useState("");
  const [expectedLocation, setExpectedLocation] = useState("");
  const [responsibility, setResponsibility] = useState("custody");
  const [note, setNote] = useState("");
  const [countries, setCountries] = useState<Row[]>([]);
  const [mains, setMains] = useState<Row[]>([]);
  const [cities, setCities] = useState<Row[]>([]);
  const [agents, setAgents] = useState<Row[]>([]);
  const [users, setUsers] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);

  useEffect(() => {
    apiGet<{ countries: Row[] }>("/api/branch-management/countries")
      .then((r) => setCountries(r.countries ?? []))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    setMains([]);
    setCountryBranchId("");
    setCities([]);
    setCityBranchId("");
    if (countryId) {
      apiGet<{ countryBranches: Row[] }>(`/api/branch-management/country-branches?countryId=${countryId}`)
        .then((r) => setMains(r.countryBranches ?? []))
        .catch(() => undefined);
    }
  }, [countryId]);

  useEffect(() => {
    setCities([]);
    setCityBranchId("");
    if (countryBranchId) {
      apiGet<{ cityBranches: Row[] }>(`/api/branch-management/city-branches?countryBranchId=${countryBranchId}`)
        .then((r) => setCities(r.cityBranches ?? []))
        .catch(() => undefined);
    }
  }, [countryBranchId]);

  useEffect(() => {
    if (type === "internal_agent" || type === "external_agent") {
      apiGet<{ clearingAgents: Row[] }>("/api/erp/clearing-agents?limit=200")
        .then((r) => setAgents(r.clearingAgents ?? []))
        .catch(() => undefined);
    }
    if (type === "other_user") {
      apiGet<{ users: Row[] }>("/api/erp/users/eligible-assignees")
        .then((r) => setUsers(r.users ?? []))
        .catch(() => undefined);
    }
  }, [type]);

  const req: TransferRequest = {
    type,
    countryId: countryId || null,
    countryBranchId: countryBranchId || null,
    cityBranchId: cityBranchId || null,
    agentId: agentId || null,
    agentName: agentName || null,
    userId: userId || null,
    expectedLocation: expectedLocation || null,
    responsibility: responsibility || "custody",
    note: note || null,
  };

  const submit = async () => {
    if (type === "remaining_payment" && loads.every(l => l.source_type === "purchase_booking") && !paymentReviewReady) return;
    const p = transferProblems(req);
    setProblems(p);
    if (p.length) return;
    setBusy(true);
    setError(null);
    try {
      await apiPost("/api/erp/purchases/lane", { action: "transfer", ids, transfer: req });
      const commonPurchaseId = loads.every((l) => l.purchase_order_id === loads[0]?.purchase_order_id) ? loads[0]?.purchase_order_id : null;
      const links = loadingJournalLinks(ids.length === 1 ? ids[0] : "", commonPurchaseId, loads.length === 1 ? loads[0]?.local_purchase_id : null);
      const targetUrl = afterView === "expenses" ? links.expenses : afterView === "tracking" ? links.tracking : destinationRoute(type, primarySource, loads.every((l) => l.purchase_ref_no === loads[0]?.purchase_ref_no) ? loads[0]?.purchase_ref_no : undefined, loads.length === 1 && primarySource === "purchase_booking" ? loads[0]?.source_id : undefined);
      await onDone(`${T("done_transferred", "Transferred")} (${ids.length})`, targetUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const bad = (k: string) => problems.includes(k);
  const lbl = (t: string) => (
    <label className="mb-1 block text-[11px] font-bold text-slate-700 dark:text-slate-300">{t}</label>
  );

  const isMod = isModuleDestination(type);

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm overflow-y-auto"
      role="dialog"
      aria-modal="true"
      dir={s.dir}
      data-testid="transfer-modal"
    >
      <div className="relative w-full max-w-[1600px] h-[94vh] flex flex-col rounded-2xl bg-white shadow-2xl border border-slate-200 dark:bg-slate-900 dark:border-slate-800 animate-in fade-in-50 zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm shadow-indigo-500/30">
              <ArrowRightLeft className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                {T("confirm_popup_title", "Transfer Bill & Workflow Routing")} ({loads.length})
              </h3>
              <p className="text-[11px] text-slate-500">
                {T("confirm_review_summary", "Review bill details and select applicable destination before confirming.")}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={T("close", "Close")}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_minmax(360px,440px)] lg:overflow-hidden" dir="ltr">
          <div className="overflow-y-auto bg-slate-100 p-3 sm:p-5 dark:bg-slate-950" dir={s.dir}>
            <LanePaymentPreview loads={loads.map(l => ({ id: String(l.id), source_id: l.source_id, source_type: l.source_type, purchase_ref_no: l.purchase_ref_no }))} lang={s.lang} onReady={setPaymentReviewReady} />
          </div>
          <div className="flex min-h-0 flex-col border-l border-slate-200 dark:border-slate-800" dir={s.dir}>
        {/* Scrollable controls remain on the physical right in every language. */}
        <div className="overflow-y-auto px-5 py-4 space-y-4 text-xs">
          {/* Review Selected Bills Card */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
            <p className="mb-2 text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {T("confirm_review_summary", "Selected Bill Details")}
            </p>
            <div className="max-h-36 overflow-y-auto space-y-2 pe-1">
              {loads.map((l) => (
                <div
                  key={l.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white p-2.5 border border-slate-200/80 shadow-xs dark:bg-slate-900 dark:border-slate-800"
                >
                  <div>
                    <div className="font-mono font-black text-blue-700 dark:text-blue-400" dir="ltr">
                      {l.purchase_ref_no || "—"}
                    </div>
                    <div className="font-semibold text-slate-700 dark:text-slate-300" dir="auto">
                      {l.supplier_name || "—"} · {l.goods_name || "—"}
                    </div>
                  </div>
                  <div className="text-end font-mono text-[11px]">
                    <div>
                      {T("col_qty", "Loaded Qty")}: <b>{Number(l.loaded_quantity || 0).toLocaleString()}</b> {l.unit || ""}
                    </div>
                    <div className="text-amber-700 dark:text-amber-400">
                      {T("col_remaining_qty", "Remaining")}: <b>{Number(l.remaining_quantity || 0).toLocaleString()}</b> {l.unit || ""}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Destination Selector */}
          <div>
            {lbl(T("confirm_destination_select", "Select Applicable Destination") + " *")}
            <select
              value={type}
              onChange={(e) => setType(e.target.value as TransferType)}
              className={`${inputCls} font-bold text-indigo-700 dark:text-indigo-400`}
              data-testid="tr-type"
            >
              <optgroup label={T("group_erp_modules", "ERP Business Modules")}>
                <option value="general_purchase_expenses">{s.tGlobal("utask.mod_journal", "Journal")} · {T("dest_expenses_p", "General Purchase Expenses")}</option>
                <option value="general_sales_expenses">{T("dest_expenses_s", "General Sales Expenses")}</option>
                <option value="remaining_payment">{T("dest_payment", "Remaining Payment")}</option>
                <option value="jc_journal_voucher">{T("dest_jc", "JC (Journal Clearing / Voucher)")}</option>
                <option value="pc_petty_cash">{T("dest_pc", "PC (Petty Cash / Payment Certificate)")}</option>
              </optgroup>
              <optgroup label={T("group_logistics_handover", "Branch & Logistics Hand-over")}>
                <option value="other_branch">{T("tt_other_branch", "Another country or city branch")}</option>
                <option value="own_branch">{T("tt_own_branch", "Own branch")}</option>
                <option value="internal_agent">{T("tt_internal_agent", "Internal clearing agent")}</option>
                <option value="external_agent">{T("tt_external_agent", "External clearing agent / logistics partner")}</option>
                <option value="other_user">{T("tt_other_user", "Another authorised user")}</option>
                <option value="self_managed">{T("tt_self", "Self-managed clearance")}</option>
              </optgroup>
            </select>
          </div>

          <div>
            {lbl(T("col_next", "Action / Routing"))}
            <select value={afterView} onChange={(e) => setAfterView(e.target.value)} className={inputCls} data-testid="tr-after-view">
              <option value="destination">{T("open_destination", "Open in Destination Module")}</option>
              <option value="expenses">{s.tGlobal("utask.mod_journal", "Journal")} · {s.tGlobal("expenses", "Expenses")}</option>
              <option value="tracking">{s.tGlobal("log.seg_tracking", "Tracking")}</option>
            </select>
          </div>

          {/* Conditional Branch Hand-over Fields */}
          {(type === "own_branch" || type === "other_branch") && (
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              <div>
                {lbl(T("country", "Country"))}
                <select
                  value={countryId}
                  onChange={(e) => setCountryId(e.target.value)}
                  className={`${inputCls} ${bad("country") ? "!border-rose-400" : ""}`}
                  data-testid="tr-country"
                >
                  <option value="">—</option>
                  {countries.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                {lbl(T("main_branch", "Main branch"))}
                <select
                  value={countryBranchId}
                  onChange={(e) => setCountryBranchId(e.target.value)}
                  className={`${inputCls} ${bad("branch") ? "!border-rose-400" : ""}`}
                  disabled={!countryId}
                  data-testid="tr-main"
                >
                  <option value="">—</option>
                  {mains.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                {lbl(T("city_branch", "City branch"))}
                <select
                  value={cityBranchId}
                  onChange={(e) => setCityBranchId(e.target.value)}
                  className={inputCls}
                  disabled={!countryBranchId}
                  data-testid="tr-city"
                >
                  <option value="">—</option>
                  {cities.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Conditional Agent Fields */}
          {(type === "internal_agent" || type === "external_agent") && (
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <div>
                {lbl(T("agent", "Agent"))}
                <select
                  value={agentId}
                  onChange={(e) => setAgentId(e.target.value)}
                  className={`${inputCls} ${bad("agent") && !agentName ? "!border-rose-400" : ""}`}
                  data-testid="tr-agent"
                >
                  <option value="">—</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
              {type === "external_agent" && (
                <div>
                  {lbl(T("agent_name", "Or type the partner's name"))}
                  <input
                    value={agentName}
                    onChange={(e) => setAgentName(e.target.value)}
                    className={inputCls}
                    data-testid="tr-agent-name"
                  />
                </div>
              )}
            </div>
          )}

          {/* Conditional User Fields */}
          {type === "other_user" && (
            <div>
              {lbl(T("user", "User"))}
              <select
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className={`${inputCls} ${bad("user") ? "!border-rose-400" : ""}`}
                data-testid="tr-user"
              >
                <option value="">—</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                    {u.role ? ` · ${u.role}` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Location & Responsibility */}
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <div>
              {lbl(
                T("expected_location", "Expected location") +
                  (isMod || type === "self_managed" ? "" : " *")
              )}
              <input
                value={expectedLocation}
                onChange={(e) => setExpectedLocation(e.target.value)}
                placeholder={isMod ? destinationName(type, T) : ""}
                className={`${inputCls} ${bad("expectedLocation") ? "!border-rose-400" : ""}`}
                data-testid="tr-location"
                dir="auto"
              />
            </div>
            <div>
              {lbl(T("responsibility", "Responsibility"))}
              <select
                value={responsibility}
                onChange={(e) => setResponsibility(e.target.value)}
                className={`${inputCls} ${bad("responsibility") ? "!border-rose-400" : ""}`}
                data-testid="tr-resp"
              >
                {RESPONSIBILITIES.map((r) => (
                  <option key={r} value={r}>
                    {r === "custody"
                      ? T("resp_custody", "Custody of the load")
                      : r === "transport"
                      ? T("resp_transport", "Transport")
                      : r === "customs_clearance"
                      ? T("resp_customs", "Customs clearance")
                      : T("resp_full", "Full handling")}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            {lbl(T("note", "Note / Hand-over Remarks"))}
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className={inputCls}
              placeholder={T("ph_routing_notes", "Operational routing notes...")}
            />
          </div>

          {/* Accounting & Integrity Notice */}
          <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-3 text-[11px] font-medium text-indigo-900 dark:border-indigo-900/60 dark:bg-indigo-950/30 dark:text-indigo-200">
            <p className="flex items-start gap-1.5">
              <Check className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400 mt-0.5" />
              <span>
                {T(
                  "confirm_accounting_notice",
                  "Transfer routes the bill to the selected destination and writes an immutable audit log. Bills, stock movements, and accounting entries are never duplicated. Existing Advance, Credit, and Remaining Payment validation rules remain strictly preserved."
                )}
              </span>
            </p>
          </div>

          {problems.length > 0 && (
            <p className="text-[11px] font-bold text-rose-600" data-testid="tr-problems">
              {T("fill_required", "Complete the required fields")}: {problems.join(", ")}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3.5 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className={`${btnCls} border border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300`}
          >
            {T("cancel", "Cancel")}
          </button>
          <button
            type="button"
            disabled={busy || (type === "remaining_payment" && loads.every(l => l.source_type === "purchase_booking") && !paymentReviewReady)}
            onClick={() => void submit()}
            className={`${btnCls} bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm shadow-indigo-500/20`}
            data-testid="tr-submit"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRightLeft className="h-3.5 w-3.5" />}
            {T("confirm_transfer", "Confirm Transfer")}
          </button>
        </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ───────────────────────────────── Transfer History Modal ─────────────────────────────────

function TransferHistoryModal({
  T,
  s,
  load,
  stLabel,
  onClose,
}: {
  T: (k: string, fb: string) => string;
  s: any;
  load: Row;
  stLabel: (st: string) => string;
  onClose: () => void;
}) {
  const [events, setEvents] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiGet<Detail>(`/api/erp/purchases/lane/${load.id}`)
      .then((d) => setEvents(d.events || []))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [load.id]);

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm overflow-y-auto"
      role="dialog"
      aria-modal="true"
      dir={s.dir}
    >
      <div className="relative w-full max-w-[1400px] max-h-[90dvh] flex flex-col rounded-2xl bg-white shadow-2xl border border-slate-200 dark:bg-slate-900 dark:border-slate-800 animate-in fade-in-50 zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm shadow-blue-500/30">
              <History className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                {T("history_title", "Transfer & Audit History")}
              </h3>
              <p className="text-sm font-mono text-blue-700 dark:text-blue-400 font-bold" dir="ltr">
                {load.purchase_ref_no || "—"} · {load.container_number || load.bl_number || "—"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={T("close", "Close")}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 overflow-y-auto px-5 py-4 text-sm">
          {/* Quick Stats Header */}
          <div className="mb-4 grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-800 dark:bg-slate-800/40">
            <div>
              <span className="text-slate-500">{T("col_qty", "Loaded Qty")}:</span>{" "}
              <b>{Number(load.loaded_quantity || 0).toLocaleString()} {load.unit || ""}</b>
            </div>
            <div>
              <span className="text-slate-500">{T("col_remaining_qty", "Remaining Qty")}:</span>{" "}
              <b className="text-amber-700 dark:text-amber-400">{Number(load.remaining_quantity || 0).toLocaleString()} {load.unit || ""}</b>
            </div>
            <div className="col-span-2">
              <span className="text-slate-500">{T("col_status", "Current Status")}:</span>{" "}
              <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_TONE[load.lane_status] ?? ""}`}>
                {stLabel(load.lane_status)}
              </span>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            </div>
          ) : events.length === 0 ? (
            <p className="py-6 text-center text-slate-400">{T("history_empty", "No transfer history recorded yet.")}</p>
          ) : (
            <ol className="relative space-y-4 border-s-2 border-slate-200 ps-4 dark:border-slate-800 my-2">
              {events.map((ev) => (
                <li key={ev.id} className="relative">
                  <div className="absolute -start-[21px] top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-blue-600 dark:border-slate-900" />
                  <div className="flex flex-wrap items-center justify-between gap-1 text-sm">
                    <span className="font-bold text-slate-900 dark:text-white">
                      {T("ev_" + ev.event_type, ev.event_type)}
                    </span>
                    <span className="text-xs font-mono text-slate-400" dir="ltr">
                      {new Date(ev.created_at).toLocaleString()}
                    </span>
                  </div>

                  {(ev.from_status || ev.to_status) && (
                    <div className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">
                      {ev.from_status ? stLabel(ev.from_status) : "—"} →{" "}
                      <b className="text-indigo-600 dark:text-indigo-400">{ev.to_status ? stLabel(ev.to_status) : "—"}</b>
                    </div>
                  )}

                  {ev.detail?.destination && (
                    <div className="mt-1 rounded bg-indigo-50 px-2 py-1 text-sm font-semibold text-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-200">
                      Destination: {destinationName(ev.detail.destination, T)}
                    </div>
                  )}

                  {ev.detail?.note && (
                    <div className="mt-1 rounded bg-slate-100 p-1.5 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200" dir="auto">
                      "{ev.detail.note}"
                    </div>
                  )}

                  <div className="mt-1 text-xs text-slate-400">
                    By: <b>{ev.actor_name || "System"}</b>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="flex justify-end border-t border-slate-200 px-5 py-3 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className={`${btnCls} border border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300`}
          >
            {T("close", "Close")}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ───────────────────────────────── Centered Details Dialog ─────────────────────────────────

function DetailDialog({
  T,
  s,
  stLabel,
  detail,
  busy,
  onClose,
  onAct,
  onTransfer,
  onChanged,
  setError,
  setNotice,
}: {
  T: (k: string, fb: string) => string;
  s: any;
  stLabel: (st: string) => string;
  detail: Detail;
  busy: boolean;
  onClose: () => void;
  onAct: (id: string, body: Record<string, unknown>, ok: string) => Promise<void>;
  onTransfer: () => void;
  onChanged: () => Promise<void>;
  setError: (m: string | null) => void;
  setNotice: (m: string | null) => void;
}) {
  const l = detail.load;
  const disposed = Boolean(l.disposition_final);
  const [kind, setKind] = useState<Disposition>("warehouse");
  const [warehouseId, setWarehouseId] = useState("");
  const [goodsId, setGoodsId] = useState("");
  const [needGoods, setNeedGoods] = useState(false);
  const [nextDestination, setNextDestination] = useState("");
  const [note, setNote] = useState("");
  const [warehouses, setWarehouses] = useState<Row[]>([]);
  const [goods, setGoods] = useState<Row[]>([]);
  const [local, setLocal] = useState(false);
  const canDispose = detail.canAct && canChooseDisposition(l.lane_status) && !disposed;

  useEffect(() => {
    if (canDispose) {
      apiGet<{ warehouses: Row[] }>("/api/erp/warehouses?limit=500")
        .then((r) => setWarehouses(r.warehouses ?? []))
        .catch(() => undefined);
    }
  }, [canDispose]);

  useEffect(() => {
    if (needGoods) {
      apiGet<{ goods: Row[] }>("/api/erp/goods?limit=300")
        .then((r) => setGoods(r.goods ?? []))
        .catch(() => undefined);
    }
  }, [needGoods]);

  const dispose = async () => {
    setLocal(true);
    setError(null);
    try {
      await apiPatch(`/api/erp/purchases/lane/${l.id}`, {
        action: "disposition",
        kind,
        warehouseId: warehouseId || null,
        goodsId: goodsId || null,
        nextDestination: nextDestination || null,
        note: note || null,
      });
      setNotice(T("done_disposed", "Final disposition confirmed."));
      await onChanged();
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      if (/goods item/i.test(m)) setNeedGoods(true);
      setError(m);
    } finally {
      setLocal(false);
    }
  };

  // expenses
  const [exType, setExType] = useState("customs");
  const [exAmount, setExAmount] = useState("");
  const [exCur, setExCur] = useState("USD");
  const [exDesc, setExDesc] = useState("");
  const [exPayee, setExPayee] = useState("external_agent");
  const [exName, setExName] = useState("");

  const addExpense = async () => {
    setLocal(true);
    setError(null);
    try {
      await apiPost(`/api/erp/purchases/lane/${l.id}/expenses`, {
        expenseType: exType,
        amount: Number(exAmount),
        currency: exCur,
        description: exDesc || null,
        payeeType: exPayee,
        payeeName: exName || null,
      });
      setExAmount("");
      setExDesc("");
      setNotice(T("done_expense_added", "Expense added as a draft."));
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLocal(false);
    }
  };

  const advance = async (expenseId: string, action: "review" | "confirm" | "cancel") => {
    setLocal(true);
    setError(null);
    try {
      const res = await apiPatch<{
        result?: { settlement?: string; billExpenseLineId?: string | null; registerMissing?: boolean };
      }>(`/api/erp/purchases/lane/${l.id}/expenses`, { expenseId, action });
      const r = res?.result;
      if (action === "confirm" && r?.settlement === "agent_payable") {
        setNotice(
          r.billExpenseLineId
            ? T("done_confirm_line", "Confirmed. An unposted agent bill line was added to Bill Expenses.")
            : T(
                "done_confirm_noregister",
                "Confirmed. This booking has no Bill Expenses register yet, so no bill line was created — add the agent bill there."
              )
        );
      }
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLocal(false);
    }
  };

  const kv = (k: string, v: React.ReactNode) => (
    <div>
      <dt className="text-[11px] font-bold uppercase text-slate-400">{k}</dt>
      <dd className="break-words font-semibold" dir="auto">
        {v ?? "—"}
      </dd>
    </div>
  );

  const dispLabel: Record<string, string> = {
    warehouse: T("disp_warehouse", "Send to Warehouse"),
    re_export: T("disp_re_export", "Re-export"),
    sale_delivery: T("disp_sale", "Sell / Deliver"),
    continue_transit: T("disp_continue", "Continue Transit"),
    hold: T("disp_hold", "Hold at Current Location"),
  };
  const exTypes = ["transport", "port", "customs", "clearing", "detention", "handling", "other"];

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lane-detail-title"
      dir={s.dir}
      data-testid="lane-detail"
    >
      <div className="flex max-h-[calc(100dvh_-_1.5rem)] w-full max-w-[1600px] min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 sm:max-h-[calc(100dvh_-_3rem)]">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800 sm:px-6 sm:py-4">
          <div className="min-w-0">
            <h3 id="lane-detail-title" className="break-words text-base font-black sm:text-lg">
              {l.purchase_ref_no} · <span dir="ltr">{l.container_number || l.bl_number || "—"}</span>
            </h3>
            <span
              className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${
                STATUS_TONE[l.lane_status] ?? ""
              }`}
              data-testid="detail-status"
            >
              {stLabel(l.lane_status)}
            </span>
          </div>
          <button type="button" onClick={onClose} aria-label={T("close", "Close")} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 dark:border-slate-700 dark:hover:bg-slate-800">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6">
          <dl className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm min-[400px]:grid-cols-2 lg:grid-cols-4 dark:border-slate-700 dark:bg-slate-800/40">
            {kv(T("col_supplier", "Supplier"), l.supplier_name)}
            {kv(T("col_goods", "Goods"), l.goods_name)}
            {kv(T("col_bl", "BL no."), <span dir="ltr">{l.bl_number}</span>)}
            {kv(T("col_container", "Container"), <span dir="ltr">{l.container_number}</span>)}
            {kv(
              T("col_qty", "Loaded qty"),
              `${Number(l.loaded_quantity || 0).toLocaleString()} ${l.unit || ""}`
            )}
            {kv(
              T("col_remaining_qty", "Remaining qty"),
              `${Number(l.remaining_quantity || 0).toLocaleString()} ${l.unit || ""}`
            )}
            {kv(
              T("lane_stock_one", "Quantity in lane"),
              Number(l.lane_stock_qty || 0).toLocaleString()
            )}
            {kv(
              T("col_weight", "Gross / Net"),
              `${l.gross_weight ?? "—"} / ${l.net_weight ?? "—"}`
            )}
            {kv(
              T("route", "Origin → Destination"),
              `${l.origin_text || "—"} → ${l.destination_text || "—"}`
            )}
            {kv(T("col_location", "Location"), l.current_location)}
            {kv(T("expected_location", "Expected location"), l.expected_location ? destinationName(l.expected_location, T) : "—")}
            {kv(T("col_assigned", "Assigned to"), ownerLabel(l, T))}
            {kv(T("responsibility", "Responsibility"), l.responsibility)}
            {l.disposition &&
              kv(T("final_disposition", "Final disposition"), dispLabel[l.disposition] ?? l.disposition)}
          </dl>

          {!detail.canAct && (
            <p
              className="mt-3 rounded-lg bg-slate-100 p-2 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300"
              data-testid="readonly-note"
            >
              {T("read_only", "You can view this load but you are not its current holder, so you cannot change it.")}
            </p>
          )}

          {detail.canAct && l.lane_status !== "completed" && (
            <div className="mt-4 flex flex-wrap gap-1.5" data-testid="detail-actions">
              {l.lane_status === "transfer_pending" && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void onAct(l.id, { action: "accept" }, T("done_accepted", "Transfer accepted."))}
                  className={`${btnCls} bg-emerald-600 text-white`}
                  data-testid="d-accept"
                >
                  <Check className="h-3.5 w-3.5" />
                  {T("act_accept", "Accept transfer")}
                </button>
              )}
              {allowedNextStatuses(l.lane_status).map((nx) => (
                <button
                  key={nx}
                  type="button"
                  disabled={busy}
                  onClick={() => void onAct(l.id, { action: "status", to: nx }, T("done_status", "Status updated."))}
                  className={`${btnCls} bg-blue-600 text-white`}
                  data-testid={`d-to-${nx}`}
                >
                  {T("act_mark", "Mark")} {stLabel(nx)}
                </button>
              ))}
              <button
                type="button"
                onClick={onTransfer}
                className={`${btnCls} border border-indigo-300 text-indigo-700`}
                data-testid="d-transfer"
              >
                <ArrowRightLeft className="h-3.5 w-3.5" />
                {T("act_transfer_load", "Transfer Load")}
              </button>
            </div>
          )}

          {canDispose && (
            <div
              className="mt-4 rounded-xl border border-rose-200 bg-rose-50/50 p-3 dark:border-rose-900 dark:bg-rose-950/20"
              data-testid="disposition-panel"
            >
              <p className="mb-2 flex items-center gap-1.5 text-xs font-black">
                <PackageCheck className="h-4 w-4 text-rose-600" />
                {T("disp_title", "Customs cleared — what happens to this load?")}
              </p>
              <div className="space-y-1.5">
                {(["warehouse", "re_export", "sale_delivery", "continue_transit", "hold"] as Disposition[]).map(
                  (d) => (
                    <label key={d} className="flex items-center gap-2 text-xs font-semibold">
                      <input
                        type="radio"
                        name="disp"
                        checked={kind === d}
                        onChange={() => setKind(d)}
                        data-testid={`disp-${d}`}
                      />
                      {dispLabel[d]}
                    </label>
                  )
                )}
              </div>
              {kind === "warehouse" && (
                <div className="mt-2 space-y-2">
                  <select
                    value={warehouseId}
                    onChange={(e) => setWarehouseId(e.target.value)}
                    className={inputCls}
                    data-testid="disp-warehouse-select"
                  >
                    <option value="">{T("pick_warehouse", "— Select warehouse —")}</option>
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                        {w.code ? ` (${w.code})` : ""}
                      </option>
                    ))}
                  </select>
                  {needGoods && (
                    <select
                      value={goodsId}
                      onChange={(e) => setGoodsId(e.target.value)}
                      className={inputCls}
                      data-testid="disp-goods-select"
                    >
                      <option value="">{T("pick_goods", "— Select the goods item —")}</option>
                      {goods.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.goods_name ?? g.name}
                        </option>
                      ))}
                    </select>
                  )}
                  <p className="text-[11px] text-slate-500">
                    {T(
                      "disp_warehouse_hint",
                      "Lane stock is reduced and the selected warehouse stock is increased — once."
                    )}
                  </p>
                </div>
              )}
              {kind === "continue_transit" && (
                <input
                  value={nextDestination}
                  onChange={(e) => setNextDestination(e.target.value)}
                  placeholder={T("next_destination", "Next destination of the new route leg")}
                  className={`${inputCls} mt-2`}
                  data-testid="disp-next"
                  dir="auto"
                />
              )}
              {kind === "sale_delivery" && (
                <p className="mt-2 text-[11px] text-slate-500">
                  {T(
                    "disp_sale_hint",
                    "The load leaves the lane. No revenue is created here — the sale completes in Sales / Delivery."
                  )}
                </p>
              )}
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={T("note", "Note")}
                className={`${inputCls} mt-2`}
              />
              <button
                type="button"
                disabled={local || busy}
                onClick={() => void dispose()}
                className={`${btnCls} mt-2 bg-rose-600 text-white hover:bg-rose-700`}
                data-testid="disp-confirm"
              >
                {local ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                {T("disp_confirm", "Confirm final disposition")}
              </button>
            </div>
          )}

          {/* Expenses */}
          <div className="mt-5" data-testid="expenses">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-black">
              <ClipboardList className="h-4 w-4 text-blue-600" />
              {T("expenses", "Expenses on this load")}
            </p>
            <p className="mb-2 text-[11px] text-slate-500">
              {T(
                "expenses_hint",
                "Linked to Purchase → Loading → BL → Container → Lane → Agent/Branch. An internal branch is settled between branches (not a sale); an agent's payable bill line is created only after you review and confirm."
              )}
            </p>
            {detail.expenses.length === 0 ? (
              <p className="text-[11px] text-slate-400">{T("no_expenses", "No expenses yet.")}</p>
            ) : (
              <ul className="space-y-1.5">
                {detail.expenses.map((e) => (
                  <li
                    key={e.id}
                    className="rounded-lg border border-slate-200 p-2 text-[11px] dark:border-slate-700"
                    data-testid={`expense-${e.status}`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-1">
                      <span className="font-bold">
                        {T("ex_" + e.expense_type, e.expense_type)} ·{" "}
                        <span dir="ltr">
                          {Number(e.amount).toLocaleString()} {e.currency}
                        </span>
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold dark:bg-slate-800 whitespace-nowrap">
                        {T("exs_" + e.status, e.status)}
                      </span>
                    </div>
                    <div className="text-slate-500" dir="auto">
                      {e.payee_name || e.payee_type} ·{" "}
                      {e.settlement === "inter_branch"
                        ? T("settle_inter", "inter-branch settlement")
                        : e.settlement === "agent_payable"
                        ? T("settle_agent", "agent payable")
                        : T("settle_none", "no settlement")}
                      {e.bill_expense_line_id ? ` · ${T("bill_line", "bill line created (unposted)")}` : ""}
                    </div>
                    {detail.canAct && (
                      <div className="mt-1 flex gap-1.5">
                        {e.status === "draft" && (
                          <button
                            type="button"
                            disabled={local}
                            onClick={() => void advance(e.id, "review")}
                            className={`${btnCls} border border-slate-300`}
                            data-testid="ex-review"
                          >
                            {T("ex_review", "Review")}
                          </button>
                        )}
                        {e.status === "reviewed" && (
                          <button
                            type="button"
                            disabled={local}
                            onClick={() => void advance(e.id, "confirm")}
                            className={`${btnCls} bg-emerald-600 text-white`}
                            data-testid="ex-confirm"
                          >
                            {T("ex_confirm", "Confirm")}
                          </button>
                        )}
                        {(e.status === "draft" || e.status === "reviewed") && (
                          <button
                            type="button"
                            disabled={local}
                            onClick={() => void advance(e.id, "cancel")}
                            className={`${btnCls} border border-rose-300 text-rose-700`}
                          >
                            {T("cancel", "Cancel")}
                          </button>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {detail.canAct && l.lane_status !== "completed" && (
              <div
                className="mt-2 grid grid-cols-2 gap-2 rounded-lg border border-dashed border-slate-300 p-2 dark:border-slate-700"
                data-testid="expense-form"
              >
                <select
                  value={exType}
                  onChange={(e) => setExType(e.target.value)}
                  className={inputCls}
                  data-testid="ex-type"
                >
                  {exTypes.map((t) => (
                    <option key={t} value={t}>
                      {T("ex_" + t, t)}
                    </option>
                  ))}
                </select>
                <select
                  value={exPayee}
                  onChange={(e) => setExPayee(e.target.value)}
                  className={inputCls}
                  data-testid="ex-payee"
                >
                  <option value="external_agent">
                    {T("tt_external_agent", "External clearing agent / logistics partner")}
                  </option>
                  <option value="internal_agent">{T("tt_internal_agent", "Internal clearing agent")}</option>
                  <option value="internal_branch">
                    {T("payee_branch", "Internal branch (inter-branch settlement)")}
                  </option>
                  <option value="other">{T("payee_other", "Other")}</option>
                </select>
                <input
                  value={exAmount}
                  onChange={(e) => setExAmount(e.target.value)}
                  inputMode="decimal"
                  placeholder={T("amount", "Amount")}
                  className={inputCls}
                  data-testid="ex-amount"
                  dir="ltr"
                />
                <input
                  value={exCur}
                  onChange={(e) => setExCur(e.target.value.toUpperCase().slice(0, 3))}
                  placeholder="USD"
                  className={inputCls}
                  data-testid="ex-cur"
                  dir="ltr"
                />
                <input
                  value={exName}
                  onChange={(e) => setExName(e.target.value)}
                  placeholder={T("payee_name", "Payee name")}
                  className={inputCls}
                  data-testid="ex-name"
                  dir="auto"
                />
                <input
                  value={exDesc}
                  onChange={(e) => setExDesc(e.target.value)}
                  placeholder={T("description", "Description")}
                  className={inputCls}
                  dir="auto"
                />
                <button
                  type="button"
                  disabled={local || !exAmount}
                  onClick={() => void addExpense()}
                  className={`${btnCls} col-span-2 justify-center bg-blue-600 text-white`}
                  data-testid="ex-add"
                >
                  {T("add_expense", "Add expense (draft)")}
                </button>
              </div>
            )}
          </div>

          {/* Audit History */}
          <div className="mt-5" data-testid="history">
            <p className="mb-2 text-xs font-black">{T("history", "Audit history")}</p>
            <ol className="space-y-1.5 border-s border-slate-200 ps-3 dark:border-slate-700">
              {detail.events.map((ev) => (
                <li key={ev.id} className="text-[11px]" data-testid="history-item">
                  <b>{T("ev_" + ev.event_type, ev.event_type)}</b>
                  {ev.from_status || ev.to_status
                    ? ` · ${ev.from_status ? stLabel(ev.from_status) : "—"} → ${
                        ev.to_status ? stLabel(ev.to_status) : "—"
                      }`
                    : ""}
                  <div className="text-slate-400">
                    <span dir="ltr">{new Date(ev.created_at).toLocaleString()}</span> · {ev.actor_name || "—"}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
