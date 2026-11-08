"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRightLeft, ChevronDown, ChevronRight, Package, RefreshCw, Search, Ship, Truck, Warehouse } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SimpleModal } from "@/components/ui/simple-modal";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { translateHeader } from "@/lib/i18n/table-headers";
import { cn } from "@/lib/utils";
import { CONSIGNMENT_DESTINATIONS, type ConsignmentDestination } from "@/lib/consignment/loading-consignment-rules";
import type { LoadingConsignmentRow } from "@/lib/consignment/loading-consignment-service";

type WarehouseOpt = { id: string; warehouse_code: string | null; warehouse_name: string; country_id: string | null };
type Summary = { total: number; booking: number; local: number; ready: number; awaitingPayment: number; transferred: number; loadedQty: number; availableQty: number };

const EMPTY: Summary = { total: 0, booking: 0, local: 0, ready: 0, awaitingPayment: 0, transferred: 0, loadedQty: 0, availableQty: 0 };
const fmt = (n: number) => Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 4 });
const newKey = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `k-${Date.now()}-${Math.random().toString(36).slice(2)}`);

export function LoadingConsignmentView({ initialSource, initialQuery }: { initialSource?: string; initialQuery?: string }) {
  const lang = useActiveLanguage();
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);
  const tr = (text: string) => translateHeader(lang, text) || text;

  const [rows, setRows] = useState<LoadingConsignmentRow[]>([]);
  const [summary, setSummary] = useState<Summary>(EMPTY);
  const [warehouses, setWarehouses] = useState<WarehouseOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<string>(initialSource === "purchase_booking" || initialSource === "local_purchase" ? initialSource : "all");
  const [query, setQuery] = useState(initialQuery ?? "");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [active, setActive] = useState<LoadingConsignmentRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ lang });
      if (source !== "all") params.set("source", source);
      const res = await fetch(`/api/erp/consignment/loadings?${params}`, { cache: "no-store", headers: { "x-erp-lang": lang } });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.ok === false) throw new Error(json?.error?.message || `HTTP ${res.status}`);
      setRows(json.data?.rows ?? []);
      setSummary(json.data?.summary ?? EMPTY);
      setWarehouses(json.data?.warehouses ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [lang, source]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) =>
      [r.purchaseRefNo, r.loadingNo, r.supplierName, r.goodsName, r.truckNo, r.driverName, r.containerNo, r.blNo].some((v) => String(v ?? "").toLowerCase().includes(term)),
    );
  }, [rows, query]);

  const statusBadge = (r: LoadingConsignmentRow) => {
    const map: Record<string, [string, string]> = {
      ready: ["Ready for Destination", "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300"],
      partial: ["Partially Transferred", "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"],
      transferred: ["Fully Transferred", "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"],
      awaiting_payment: ["Awaiting Payment", "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"],
    };
    const [label, cls] = map[r.status] ?? map.ready;
    return <span className={cn("inline-block rounded px-1.5 py-0.5 text-[10px] font-bold", cls)} title={r.lockReason ?? undefined}>{tr(label)}</span>;
  };

  const originalHref = (r: LoadingConsignmentRow) =>
    r.source === "purchase_booking" ? `/dashboard/purchase/purchase-loading-records/${r.loadingId}` : `/dashboard/purchase/local-purchase-loading`;

  return (
    <div className="w-full space-y-3 text-xs" dir={isRtl ? "rtl" : "ltr"}>
      <div className="flex flex-col gap-2 rounded-xl border border-slate-200/80 bg-white p-3 shadow-xs dark:border-slate-800 dark:bg-slate-900 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-sm font-black text-slate-900 dark:text-slate-100">{tr("Loading Consignments")}</h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {tr("Every saved loading from Purchase Booking and Local Purchase appears here automatically. Choose the next destination for the untransferred balance.")}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading} className="h-8 gap-1.5">
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          {tr("Refresh")}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
        {[
          ["Total Loadings", summary.total, "text-slate-900 dark:text-slate-100"],
          ["Purchase Booking", summary.booking, "text-indigo-700 dark:text-indigo-300"],
          ["Local Purchase", summary.local, "text-emerald-700 dark:text-emerald-300"],
          ["Ready for Destination", summary.ready, "text-blue-700 dark:text-blue-300"],
          ["Awaiting Payment", summary.awaitingPayment, "text-rose-700 dark:text-rose-300"],
          ["Available Quantity", fmt(summary.availableQty), "text-amber-700 dark:text-amber-300"],
        ].map(([label, value, cls]) => (
          <div key={String(label)} className="rounded-xl border border-slate-200/80 bg-white p-2.5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="text-[10px] font-bold text-slate-500">{tr(String(label))}</div>
            <div className={cn("mt-1 text-lg font-black", String(cls))}>{value}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200/80 bg-white p-2.5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
          {([
            ["all", "All Sources"],
            ["purchase_booking", "Purchase Booking"],
            ["local_purchase", "Local Purchase"],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setSource(value)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-bold transition-all",
                source === value ? "bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100" : "text-slate-600 hover:text-slate-900 dark:text-slate-400",
              )}
            >
              {tr(label)}
            </button>
          ))}
        </div>
        <div className="relative min-w-[240px] max-w-md flex-1">
          <Search className="absolute top-2.5 h-3.5 w-3.5 text-slate-400 ltr:left-2.5 rtl:right-2.5" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tr("Search by Bill No, Loading No, Supplier, Truck, Goods...")}
            className="w-full rounded-lg border border-slate-200 bg-slate-50/60 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 ltr:pl-8 ltr:pr-3 rtl:pl-3 rtl:pr-8 dark:border-slate-700 dark:bg-slate-800/60"
          />
        </div>
      </div>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">{error}</div>}

      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-bold text-slate-600 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-300">
                <th className="w-6 px-2 py-2" />
                <th className="px-2 py-2 text-start">{tr("Source")}</th>
                <th className="px-2 py-2 text-start">{tr("Original Bill No")}</th>
                <th className="px-2 py-2 text-start">{tr("Loading No")}</th>
                <th className="px-2 py-2 text-start">{tr("Supplier")}</th>
                <th className="px-2 py-2 text-start">{tr("Goods")}</th>
                <th className="px-2 py-2 text-end">{tr("Loaded Qty")}</th>
                <th className="px-2 py-2 text-end">{tr("Gross / Net (kg)")}</th>
                <th className="px-2 py-2 text-start">{tr("Transport")}</th>
                <th className="px-2 py-2 text-end">{tr("Transferred")}</th>
                <th className="px-2 py-2 text-end">{tr("Available")}</th>
                <th className="px-2 py-2 text-start">{tr("Status")}</th>
                <th className="px-2 py-2 text-center">{tr("Actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {loading ? (
                <tr><td colSpan={13} className="py-10 text-center text-slate-400"><RefreshCw className="mx-auto mb-2 h-5 w-5 animate-spin" />{tr("Loading...")}</td></tr>
              ) : visible.length === 0 ? (
                <tr><td colSpan={13} className="py-10 text-center text-slate-400"><Package className="mx-auto mb-2 h-7 w-7 text-slate-300" />{tr("No saved loadings yet.")}</td></tr>
              ) : (
                visible.map((r) => {
                  const open = Boolean(expanded[r.key]);
                  return (
                    <React.Fragment key={r.key}>
                      <tr className="hover:bg-blue-50/30 dark:hover:bg-slate-800/50">
                        <td className="px-2 py-2">
                          <button type="button" onClick={() => setExpanded((s) => ({ ...s, [r.key]: !open }))} className="text-slate-500" aria-label={tr("History")}>
                            {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />}
                          </button>
                        </td>
                        <td className="whitespace-nowrap px-2 py-2">
                          {r.source === "purchase_booking" ? (
                            <span className="inline-flex items-center gap-1 rounded border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300"><Ship className="h-3 w-3" />{tr("Purchase Booking")}</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"><Truck className="h-3 w-3" />{tr("Local Purchase")}</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2">
                          <Link href={originalHref(r)} className="font-mono font-bold text-blue-700 hover:underline dark:text-blue-400">{r.purchaseRefNo}</Link>
                          <div className="text-[9.5px] text-slate-400">{[r.countryName, r.branchName].filter(Boolean).join(" · ")}</div>
                        </td>
                        <td className="whitespace-nowrap px-2 py-2">
                          <div className="font-mono font-semibold text-slate-800 dark:text-slate-200">{r.loadingNo}</div>
                          <div className="text-[9.5px] text-slate-400">{r.loadingDate ?? "—"}</div>
                        </td>
                        <td className="min-w-[120px] px-2 py-2 font-semibold text-slate-800 dark:text-slate-200">{r.supplierName ?? "—"}</td>
                        <td className="min-w-[110px] px-2 py-2 text-slate-700 dark:text-slate-300">{r.goodsName ?? "—"}</td>
                        <td className="whitespace-nowrap px-2 py-2 text-end font-bold">{fmt(r.loadedQty)} <span className="text-[10px] font-normal text-slate-500">{r.unit ?? ""}</span></td>
                        <td className="whitespace-nowrap px-2 py-2 text-end text-[10.5px]">{fmt(r.grossWeight)} / {fmt(r.netWeight)}</td>
                        <td className="min-w-[120px] px-2 py-2 text-[10.5px]">
                          <div className="font-mono">{r.truckNo ?? r.containerNo ?? "—"}</div>
                          <div className="text-[9.5px] text-slate-400">{[r.driverName, r.blNo, r.transportMode].filter(Boolean).join(" · ")}</div>
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 text-end">{fmt(r.transferredQty)}</td>
                        <td className="whitespace-nowrap px-2 py-2 text-end font-black text-amber-700 dark:text-amber-400">{fmt(r.availableQty)}</td>
                        <td className="whitespace-nowrap px-2 py-2">{statusBadge(r)}</td>
                        <td className="whitespace-nowrap px-2 py-2 text-center">
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={r.locked || r.availableQty <= 0}
                            onClick={() => setActive(r)}
                            title={r.lockReason ?? undefined}
                            className="h-7 gap-1 bg-emerald-50 px-2 text-[10.5px] font-bold text-emerald-700 hover:bg-emerald-100 disabled:opacity-40 dark:bg-emerald-950/40 dark:text-emerald-300"
                          >
                            <ArrowRightLeft className="h-3 w-3" />
                            {tr("Transfer")}
                          </Button>
                        </td>
                      </tr>
                      {open && (
                        <tr className="bg-slate-50/60 dark:bg-slate-800/30">
                          <td />
                          <td colSpan={12} className="px-2 py-2">
                            <div className="mb-1 text-[10px] font-bold uppercase text-slate-500">{tr("Transfer History")}</div>
                            {r.lockReason && <div className="mb-1 text-[10.5px] text-rose-600">{tr(r.lockReason)}</div>}
                            {r.transfers.length === 0 ? (
                              <div className="text-[10.5px] text-slate-400">{tr("No destination transfer yet.")}</div>
                            ) : (
                              <table className="w-full text-[10.5px]">
                                <thead>
                                  <tr className="text-slate-500">
                                    <th className="py-1 text-start">{tr("Date")}</th>
                                    <th className="py-1 text-start">{tr("Destination")}</th>
                                    <th className="py-1 text-end">{tr("Quantity")}</th>
                                    <th className="py-1 text-end">{tr("Gross / Net (kg)")}</th>
                                    <th className="py-1 text-start">{tr("Stock Reference")}</th>
                                    <th className="py-1 text-start">{tr("User")}</th>
                                    <th className="py-1 text-start">{tr("Note")}</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {r.transfers.map((t) => (
                                    <tr key={t.id} className="border-t border-slate-200/70 dark:border-slate-700/60">
                                      <td className="py-1 font-mono">{t.at.slice(0, 16).replace("T", " ")}</td>
                                      <td className="py-1">{t.destination === "warehouse" ? `${tr("Warehouse")}${t.warehouseName ? ` — ${t.warehouseName}` : ""}` : tr("Re-export")}</td>
                                      <td className="py-1 text-end font-bold">{fmt(t.qty)}</td>
                                      <td className="py-1 text-end">{fmt(t.grossWeight)} / {fmt(t.netWeight)}</td>
                                      <td className="py-1 font-mono">{t.stockReference ?? "—"}</td>
                                      <td className="py-1">{t.userName}</td>
                                      <td className="py-1">{t.destinationNote ?? ""}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {active && (
        <TransferDialog
          row={active}
          warehouses={warehouses.filter((w) => !active.countryId || !w.country_id || w.country_id === active.countryId)}
          tr={tr}
          onClose={() => setActive(null)}
          onDone={() => {
            setActive(null);
            void load();
          }}
        />
      )}
    </div>
  );
}

function TransferDialog({
  row,
  warehouses,
  tr,
  onClose,
  onDone,
}: {
  row: LoadingConsignmentRow;
  warehouses: WarehouseOpt[];
  tr: (s: string) => string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [destination, setDestination] = useState<ConsignmentDestination>("warehouse");
  const [warehouseId, setWarehouseId] = useState("");
  const [lotId, setLotId] = useState(row.lots.length === 1 ? row.lots[0].id : "");
  const [qty, setQty] = useState(String(row.availableQty));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // One key per opened dialog: a double click or a retry replays the same transfer instead of moving stock twice.
  const [idempotencyKey] = useState(newKey);

  const qtyNum = Number(qty);
  const invalid =
    !(qtyNum > 0) ||
    qtyNum > row.availableQty + 0.00005 ||
    (destination === "warehouse" && !warehouseId) ||
    (row.source === "local_purchase" && row.lots.length > 1 && !lotId);

  async function submit() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/erp/consignment/loadings/transfer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          key: row.key,
          destination,
          qty: qtyNum,
          warehouseId: destination === "warehouse" ? warehouseId : null,
          lotId: lotId || null,
          destinationNote: note.trim() || null,
          idempotencyKey,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.ok === false) throw new Error(json?.error?.message || `HTTP ${res.status}`);
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SimpleModal isOpen onClose={onClose} title={`${tr("Transfer")}: ${row.loadingNo}`} maxWidth="max-w-xl">
      <div className="space-y-3 text-xs">
        <div className="grid grid-cols-2 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-800/60">
          <div><span className="text-slate-400">{tr("Source")}: </span><b>{tr(row.source === "purchase_booking" ? "Purchase Booking" : "Local Purchase")}</b></div>
          <div><span className="text-slate-400">{tr("Original Bill No")}: </span><b className="font-mono">{row.purchaseRefNo}</b></div>
          <div><span className="text-slate-400">{tr("Goods")}: </span><b>{row.goodsName ?? "—"}</b></div>
          <div><span className="text-slate-400">{tr("Available")}: </span><b className="text-amber-700">{fmt(row.availableQty)} {row.unit ?? ""}</b></div>
        </div>

        <div>
          <div className="mb-1 font-bold text-slate-600">{tr("Destination")}</div>
          <div className="flex gap-2">
            {CONSIGNMENT_DESTINATIONS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDestination(d)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg border px-3 py-2 font-bold",
                  destination === d ? "border-blue-500 bg-blue-50 text-blue-800 dark:bg-blue-950/50 dark:text-blue-200" : "border-slate-200 text-slate-600 dark:border-slate-700",
                )}
              >
                {d === "warehouse" ? <Warehouse className="h-3.5 w-3.5" /> : <Ship className="h-3.5 w-3.5" />}
                {tr(d === "warehouse" ? "Warehouse" : "Re-export")}
              </button>
            ))}
          </div>
        </div>

        {destination === "warehouse" && (
          <label className="block">
            <span className="mb-1 block font-bold text-slate-600">{tr("Warehouse")}</span>
            <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900">
              <option value="">{tr("Select warehouse")}</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>{w.warehouse_name}{w.warehouse_code ? ` (${w.warehouse_code})` : ""}</option>
              ))}
            </select>
          </label>
        )}

        {row.source === "local_purchase" && row.lots.length > 1 && (
          <label className="block">
            <span className="mb-1 block font-bold text-slate-600">{tr("Lot")}</span>
            <select value={lotId} onChange={(e) => setLotId(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900">
              <option value="">{tr("Select lot")}</option>
              {row.lots.map((l) => (
                <option key={l.id} value={l.id}>{l.lotRef} — {l.goodsName} ({fmt(l.available)})</option>
              ))}
            </select>
          </label>
        )}

        <label className="block">
          <span className="mb-1 block font-bold text-slate-600">{tr("Quantity")}</span>
          <input type="number" min={0} max={row.availableQty} step="any" value={qty} onChange={(e) => setQty(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900" />
          {qtyNum > row.availableQty + 0.00005 && <span className="text-[10.5px] text-rose-600">{tr("Quantity cannot exceed the available balance.")}</span>}
        </label>

        <label className="block">
          <span className="mb-1 block font-bold text-slate-600">{tr("Note")}</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900" />
        </label>

        {err && <div className="rounded border border-rose-200 bg-rose-50 p-2 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">{err}</div>}

        <div className="flex justify-end gap-2 border-t pt-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={busy}>{tr("Cancel")}</Button>
          <Button size="sm" onClick={() => void submit()} disabled={busy || invalid} className="gap-1.5 bg-blue-600 font-bold text-white hover:bg-blue-700">
            <ArrowRightLeft className="h-3.5 w-3.5" />
            {busy ? tr("Saving...") : tr("Confirm Transfer")}
          </Button>
        </div>
      </div>
    </SimpleModal>
  );
}

