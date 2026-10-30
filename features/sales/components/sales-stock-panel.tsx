"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, CheckCircle2, FileText, Loader2, Package, Plane, Search, X } from "lucide-react";
import { t as tUi } from "@/lib/i18n/ui";
import { rtlLanguages } from "@/lib/i18n/languages";
import type { AvailableLot, LotDeduction } from "@/lib/sales/available-lots";

/**
 * Select Stock — a real selection panel, not a dropdown:
 *   1. pick a stock source (Warehouse / Booking / Export stock),
 *   2. see the actual stock records and lots (goods, lot, origin, brand, size, quantity, weight, sold, remaining),
 *   3. click a lot to open its complete details (and which earlier bookings took stock from it),
 *   4. confirm — the caller fills the Goods Entry form from the chosen lot.
 * Data is the existing /api/erp/sales/available-lots resolver (real inventory, scoped to the caller). Nothing here is demo data.
 */
export type StockGroupId = "warehouse" | "booking" | "export";
const GROUPS: Array<{ id: StockGroupId; sources: string[]; icon: typeof Building2; accent: string }> = [
  { id: "warehouse", sources: ["warehouse", "lot", "local"], icon: Building2, accent: "text-blue-600" },
  { id: "booking", sources: ["booking"], icon: FileText, accent: "text-amber-600" },
  { id: "export", sources: ["in_transit", "endorse"], icon: Plane, accent: "text-sky-600" }
];

type GroupState = { status: "idle" | "loading" | "ok" | "denied" | "error"; lots: AvailableLot[] };
const keyOf = (l: AvailableLot) => `${l.source}|${l.lotNo}|${l.id ?? ""}`;
const fmt = (n: number | undefined | null, d = 3) => (n == null || !Number.isFinite(Number(n)) ? "—" : Number(n).toLocaleString(undefined, { maximumFractionDigits: d }));

export function SalesStockPanel({
  open,
  onClose,
  onConfirm,
  lang = "en",
  excludeOrderId = null,
  initialGroup = "warehouse"
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (lot: AvailableLot, group: StockGroupId) => void;
  lang?: string;
  excludeOrderId?: string | null;
  initialGroup?: StockGroupId;
}) {
  const tt = useCallback((k: string, fb: string) => tUi(lang, `sales.stk_${k}`, fb), [lang]);
  const isRtl = rtlLanguages.includes(lang as never);
  const [group, setGroup] = useState<StockGroupId>(initialGroup);
  const [state, setState] = useState<Record<StockGroupId, GroupState>>({
    warehouse: { status: "idle", lots: [] },
    booking: { status: "idle", lots: [] },
    export: { status: "idle", lots: [] }
  });
  const [search, setSearch] = useState("");
  const [selectedKey, setSelectedKey] = useState("");
  const [history, setHistory] = useState<Record<string, LotDeduction[] | "loading">>({});

  const load = useCallback(
    async (id: StockGroupId) => {
      const def = GROUPS.find((g) => g.id === id)!;
      setState((p) => ({ ...p, [id]: { status: "loading", lots: [] } }));
      try {
        const results = await Promise.all(
          def.sources.map(async (src) => {
            const qs = new URLSearchParams({ source: src, limit: "300", lang });
            if (excludeOrderId) qs.set("excludeOrderId", excludeOrderId);
            const res = await fetch(`/api/erp/sales/available-lots?${qs.toString()}`, { credentials: "same-origin" });
            if (res.status === 401 || res.status === 403) return { denied: true, lots: [] as AvailableLot[] };
            const json = await res.json().catch(() => null);
            if (!res.ok) throw new Error("load failed");
            return { denied: false, lots: (json?.data?.lots ?? []) as AvailableLot[] };
          })
        );
        const denied = results.every((r) => r.denied);
        setState((p) => ({ ...p, [id]: { status: denied ? "denied" : "ok", lots: results.flatMap((r) => r.lots) } }));
      } catch {
        setState((p) => ({ ...p, [id]: { status: "error", lots: [] } }));
      }
    },
    [lang, excludeOrderId]
  );

  // load every source when the panel opens so each shows how many records it holds
  useEffect(() => {
    if (!open) return;
    setGroup(initialGroup);
    setSearch("");
    setSelectedKey("");
    (["warehouse", "booking", "export"] as StockGroupId[]).forEach((g) => void load(g));
  }, [open, initialGroup, load]);

  const lots = state[group].lots;
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return lots;
    return lots.filter((l) => [l.goodsName, l.lotNo, l.origin, l.brand, l.size, l.warehouseName, l.location, l.stockRef, l.hsCode].filter(Boolean).join(" ").toLowerCase().includes(q));
  }, [lots, search]);

  const selected = useMemo(() => lots.find((l) => keyOf(l) === selectedKey) ?? null, [lots, selectedKey]);

  // earlier bookings from the opened lot
  useEffect(() => {
    if (!selected) return;
    const ref = selected.stockRef || selected.lotNo;
    if (!ref || history[keyOf(selected)]) return;
    const k = keyOf(selected);
    setHistory((p) => ({ ...p, [k]: "loading" }));
    fetch(`/api/erp/sales/available-lots?deductionsFor=${encodeURIComponent(selected.lotNo)}`, { credentials: "same-origin" })
      .then((r) => r.json())
      .then((j) => setHistory((p) => ({ ...p, [k]: (j?.data?.deductions ?? []) as LotDeduction[] })))
      .catch(() => setHistory((p) => ({ ...p, [k]: [] })));
  }, [selected, history]);

  if (!open) return null;
  const labelOf = (g: StockGroupId) => (g === "warehouse" ? tt("source_warehouse", "Warehouse Stock") : g === "booking" ? tt("source_booking", "Booking Stock") : tt("source_export", "Export Stock"));
  const hintOf = (g: StockGroupId) =>
    g === "warehouse"
      ? tt("source_warehouse_hint", "Goods in your warehouses, managed lots and local purchases")
      : g === "booking"
        ? tt("source_booking_hint", "Purchase-booked goods not yet loaded")
        : tt("source_export_hint", "Goods already loaded and on the way, and endorsed stock");
  const sel = selected;
  const selHistory = sel ? history[keyOf(sel)] : undefined;
  const soldOut = !!sel && (sel.remainingQty ?? sel.availableQty) <= 0;

  return (
    <div className="fixed inset-0 z-[70] flex items-stretch justify-center bg-black/55 p-0 sm:p-4" role="dialog" aria-modal="true" aria-label={tt("panel_title", "Select Stock to Sell")} dir={isRtl ? "rtl" : "ltr"} data-testid="stock-panel">
      <div className="flex w-full max-w-7xl flex-col overflow-hidden bg-white shadow-2xl dark:bg-slate-900 sm:rounded-2xl">
        {/* header */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-black uppercase tracking-wide text-slate-900 dark:text-slate-100">{tt("panel_title", "Select Stock to Sell")}</h3>
            <p className="truncate text-[11px] text-slate-500">{tt("panel_sub", "Choose a source, open a lot to inspect it, then confirm.")}</p>
          </div>
          <button type="button" onClick={onClose} aria-label={tt("cancel", "Cancel")} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" data-testid="stock-panel-close">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* body: sources | lots | details */}
        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[210px_minmax(0,1fr)_340px] lg:overflow-hidden">
          {/* 1. sources */}
          <div className="flex gap-2 overflow-x-auto border-b border-slate-200 p-3 dark:border-slate-800 lg:flex-col lg:overflow-y-auto lg:border-b-0 lg:border-e" data-testid="stock-sources">
            {GROUPS.map((g) => {
              const Icon = g.icon;
              const st = state[g.id];
              const active = group === g.id;
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => {
                    setGroup(g.id);
                    setSelectedKey("");
                  }}
                  aria-pressed={active}
                  data-testid={`stock-source-${g.id}`}
                  className={`min-w-[170px] rounded-xl border p-3 text-start transition lg:min-w-0 ${active ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30" : "border-slate-200 hover:border-slate-300 dark:border-slate-700"}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`flex items-center gap-1.5 text-xs font-black ${active ? "text-blue-700 dark:text-blue-300" : "text-slate-800 dark:text-slate-200"}`}>
                      <Icon className={`h-4 w-4 ${g.accent}`} />
                      {labelOf(g.id)}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {st.status === "loading" ? "…" : st.status === "ok" ? st.lots.length : "–"}
                    </span>
                  </div>
                  <p className="mt-1 text-[10px] leading-snug text-slate-500">{hintOf(g.id)}</p>
                </button>
              );
            })}
          </div>

          {/* 2. stock records */}
          <div className="flex min-h-[260px] min-w-0 flex-col lg:min-h-0">
            <div className="border-b border-slate-200 p-3 dark:border-slate-800">
              <div className="relative">
                <Search className="pointer-events-none absolute start-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={tt("search_ph", "Search goods, lot, origin, brand, warehouse…")}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white ps-8 pe-3 text-xs outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950"
                  data-testid="stock-search"
                />
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-3">
              {state[group].status === "loading" || state[group].status === "idle" ? (
                <div className="flex items-center gap-2 p-6 text-xs text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />{tt("loading", "Loading stock…")}</div>
              ) : state[group].status === "denied" ? (
                <p className="p-6 text-xs font-bold text-amber-700">{tt("denied", "Your role cannot see stock for this source.")}</p>
              ) : state[group].status === "error" ? (
                <p className="p-6 text-xs font-bold text-red-600">{tt("load_error", "Stock could not be loaded. Try again.")}</p>
              ) : filtered.length === 0 ? (
                <p className="p-6 text-xs text-slate-500" data-testid="stock-empty">{tt("empty", "No stock available in this source.")}</p>
              ) : (
                <table className="w-full min-w-[720px] border-collapse text-[11px]" data-testid="stock-lots">
                  <thead>
                    <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-wide text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
                      {["col_goods:Goods Name", "col_lot:Lot Number", "col_origin:Origin", "col_brand:Brand", "col_size:Size", "col_qty:Quantity", "col_weight:Total Weight", "col_sold:Sold Quantity", "col_remaining:Remaining Balance"].map((c) => {
                        const [k, fb] = c.split(":");
                        return <th key={k} className="px-2 py-2 text-start">{tt(k, fb)}</th>;
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((l) => {
                      const k = keyOf(l);
                      const remaining = l.remainingQty ?? l.availableQty;
                      return (
                        <tr
                          key={k}
                          onClick={() => setSelectedKey(k)}
                          tabIndex={0}
                          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setSelectedKey(k)}
                          aria-selected={k === selectedKey}
                          data-testid="stock-lot-row"
                          className={`cursor-pointer border-t border-slate-100 dark:border-slate-800 ${k === selectedKey ? "bg-blue-50 dark:bg-blue-950/30" : "hover:bg-slate-50 dark:hover:bg-slate-800/40"} ${remaining <= 0 ? "opacity-50" : ""}`}
                        >
                          <td className="px-2 py-2 font-bold text-slate-900 dark:text-slate-100">{l.goodsName}</td>
                          <td className="px-2 py-2 font-mono">{l.lotNo}</td>
                          <td className="px-2 py-2">{l.origin || "—"}</td>
                          <td className="px-2 py-2">{l.brand || "—"}</td>
                          <td className="px-2 py-2">{l.size || "—"}</td>
                          <td className="px-2 py-2 tabular-nums">{fmt(l.totalQty ?? l.availableQty)} {l.qtyName}</td>
                          <td className="px-2 py-2 tabular-nums">{l.totalWeight ? `${fmt(l.totalWeight, 2)} KG` : "—"}</td>
                          <td className="px-2 py-2 tabular-nums">{fmt(l.soldQty ?? 0)}</td>
                          <td className={`px-2 py-2 font-black tabular-nums ${remaining > 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-600"}`}>{fmt(remaining)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* 3. lot details */}
          <aside className="min-h-[220px] overflow-y-auto border-t border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-950/40 lg:border-s lg:border-t-0" data-testid="stock-details" aria-live="polite">
            <h4 className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-700 dark:text-slate-200">
              <Package className="h-4 w-4 text-blue-600" />
              {tt("details_title", "Stock Details")}
            </h4>
            {!sel ? (
              <p className="text-xs text-slate-500">{tt("pick_lot_hint", "Click a lot to see its full details.")}</p>
            ) : (
              <div className="space-y-3 text-[11px]">
                <div>
                  <div className="text-sm font-black text-slate-900 dark:text-slate-100">{sel.goodsName}</div>
                  <div className="font-mono text-slate-500">{sel.lotNo}</div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  {[
                    [tt("col_qty", "Quantity"), fmt(sel.totalQty ?? sel.availableQty)],
                    [tt("col_sold", "Sold Quantity"), fmt(sel.soldQty ?? 0)],
                    [tt("col_remaining", "Remaining Balance"), fmt(sel.remainingQty ?? sel.availableQty)]
                  ].map(([k, v], i) => (
                    <div key={k as string} className={`rounded-lg border p-2 ${i === 2 ? "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30" : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"}`}>
                      <div className="text-[9px] font-bold uppercase text-slate-500">{k}</div>
                      <div className="text-sm font-black tabular-nums">{v}</div>
                    </div>
                  ))}
                </div>
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
                  {[
                    [tt("d_unit", "Quantity Type"), sel.qtyName],
                    [tt("col_weight", "Total Weight"), sel.totalWeight ? `${fmt(sel.totalWeight, 2)} KG` : "—"],
                    [tt("d_kg_unit", "KG per unit"), sel.qtyKgs ? fmt(sel.qtyKgs, 3) : "—"],
                    [tt("d_empty", "Empty KG"), sel.emptyKgs ? fmt(sel.emptyKgs, 3) : "—"],
                    [tt("col_origin", "Origin"), sel.origin || "—"],
                    [tt("col_brand", "Brand"), sel.brand || "—"],
                    [tt("col_size", "Size"), sel.size || "—"],
                    [tt("d_hs", "HS Code"), sel.hsCode || "—"],
                    [tt("d_location", "Location / Warehouse"), sel.warehouseName || sel.location || "—"],
                    [tt("d_branch", "Branch"), sel.branchName || "—"],
                    [tt("d_reference", "Stock Reference"), sel.stockRef || "—"],
                    [tt("d_container", "Container"), sel.containerNo || "—"],
                    [tt("d_status", "Status"), sel.status || "—"]
                  ].map(([k, v]) => (
                    <React.Fragment key={k as string}>
                      <dt className="text-slate-500">{k}</dt>
                      <dd className="break-words font-bold text-slate-800 dark:text-slate-100">{v}</dd>
                    </React.Fragment>
                  ))}
                </dl>
                <div>
                  <div className="mb-1 text-[10px] font-black uppercase text-slate-500">{tt("d_history", "Earlier bookings from this lot")}</div>
                  {selHistory === "loading" || selHistory === undefined ? (
                    <div className="text-slate-400">…</div>
                  ) : selHistory.length === 0 ? (
                    <p className="text-slate-500">{tt("d_no_history", "No other booking has taken stock from this lot.")}</p>
                  ) : (
                    <ul className="space-y-1">
                      {selHistory.slice(0, 8).map((h, i) => (
                        <li key={`${h.reference}-${i}`} className="flex justify-between gap-2 rounded border border-slate-200 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-900">
                          <span className="truncate">{h.reference} · {h.customer}</span>
                          <span className="font-bold tabular-nums">{fmt(h.quantity)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {soldOut && <p className="rounded-lg bg-red-50 p-2 font-bold text-red-700 dark:bg-red-950/30">{tt("d_sold_out", "Sold out — nothing left to sell from this lot.")}</p>}
              </div>
            )}
          </aside>
        </div>

        {/* footer */}
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 px-4 py-3 dark:border-slate-800">
          <button type="button" onClick={onClose} className="h-9 rounded-lg border border-slate-300 px-4 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200">
            {tt("cancel", "Cancel")}
          </button>
          <button
            type="button"
            disabled={!sel || soldOut}
            onClick={() => sel && onConfirm(sel, group)}
            data-testid="stock-confirm"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-4 text-xs font-black text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <CheckCircle2 className="h-4 w-4" />
            {tt("confirm", "Confirm — sell from this lot")}
          </button>
        </div>
      </div>
    </div>
  );
}
