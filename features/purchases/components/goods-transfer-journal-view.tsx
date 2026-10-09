"use client";

/**
 * Goods Transfer Journal — decides where the goods of a POSTED Local Purchase physically go.
 * It never posts or repeats the purchase's financial entries; every quantity stays tied to one permanent Lot.
 * Five-language / RTL via useErpScreen("gtj") — all strings live in lib/i18n/ui.ts.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Building2, Warehouse, Store, Ship, Globe2, PauseCircle, X, Loader2, CheckCircle2, FileText, Package, Boxes, AlertTriangle,
} from "lucide-react";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";

type Json = any;

const fmt = (n: unknown, d = 2) => Number(n ?? 0).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
const qtyFmt = (n: unknown) => Number(n ?? 0).toLocaleString(undefined, { maximumFractionDigits: 4 });

async function api(method: string, url: string, body?: unknown): Promise<{ ok: boolean; data: Json; error: string }> {
  try {
    const res = await fetch(url, { method, credentials: "same-origin", headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json?.ok === false) return { ok: false, data: null, error: json?.error?.message || json?.error || `HTTP ${res.status}` };
    return { ok: true, data: json.data ?? json, error: "" };
  } catch (e: any) {
    return { ok: false, data: null, error: e?.message || "Network error" };
  }
}

const newKey = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `k${Date.now()}${Math.random().toString(36).slice(2)}`);

type S = ReturnType<typeof useErpScreen>;

const PURPOSES = [
  { id: "own_warehouse", icon: Warehouse },
  { id: "dgt_warehouse", icon: Building2 },
  { id: "third_party_warehouse", icon: Package },
  { id: "local_sale", icon: Store },
  { id: "export_customer", icon: Ship },
  { id: "export_dgt_branch", icon: Globe2 },
  { id: "hold", icon: PauseCircle },
] as const;
type PurposeId = (typeof PURPOSES)[number]["id"];

const PURPOSE_DEFAULTS: Record<PurposeId, string> = {
  own_warehouse: "Own Warehouse",
  dgt_warehouse: "Another DGT Warehouse",
  third_party_warehouse: "Third-Party Warehouse",
  local_sale: "Local Market Sale",
  export_customer: "Export to Customer",
  export_dgt_branch: "Export to Another DGT Country Branch",
  hold: "Hold at Current Location",
};

const STATE_DEFAULTS: Record<string, string> = {
  available: "Available", reserved: "Reserved", loading: "Loading", in_transit: "In Transit", sold: "Sold", exported: "Exported",
};

function StatusPill({ s, status }: { s: S; status: string }) {
  const tone: Record<string, string> = {
    completed: "bg-emerald-100 text-emerald-800", received: "bg-emerald-100 text-emerald-800", posted: "bg-emerald-100 text-emerald-800",
    in_transit: "bg-amber-100 text-amber-800", confirmed: "bg-blue-100 text-blue-800", cancelled: "bg-slate-200 text-slate-600", returned: "bg-slate-200 text-slate-600",
  };
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${tone[status] || "bg-slate-100 text-slate-700"}`}>
      {s.t(`status_${status}`, status.replace("_", " "))}
    </span>
  );
}

function FullScreen({ s, title, subtitle, onClose, children, footer }: { s: S; title: string; subtitle?: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  const node = (
    <div role="dialog" aria-modal="true" dir={s.dir} className="fixed inset-0 z-[70] flex flex-col bg-slate-50 dark:bg-slate-950">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-black text-slate-900 dark:text-slate-100">{title}</h2>
          {subtitle ? <p className="truncate text-[11px] text-slate-500">{subtitle}</p> : null}
        </div>
        <button type="button" onClick={onClose} aria-label={s.t("close", "Close")} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-100 dark:border-slate-700">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-3xl space-y-4">{children}</div>
      </div>
      {footer ? <div className="border-t border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900"><div className="mx-auto flex max-w-3xl items-center justify-end gap-2">{footer}</div></div> : null}
    </div>
  );
  // Rendered on <body> so no transformed layout ancestor can offset or clip a full-screen form.
  return typeof document === "undefined" ? node : createPortal(node, document.body);
}

function Field({ s, label, children, hint }: { s: S; label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className={`mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-500 ${s.textStart}`}>{label}</span>
      {children}
      {hint ? <span className={`mt-1 block text-[10px] text-slate-400 ${s.textStart}`}>{hint}</span> : null}
    </label>
  );
}
const inputCls = "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900";

function Picker({ s, label, kind, countryId, value, onChange, hint }: { s: S; label: string; kind: "ledger" | "account"; countryId: string; value: { id: string; text: string } | null; onChange: (v: { id: string; text: string } | null) => void; hint?: string }) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open || !countryId) return;
    const h = setTimeout(async () => {
      const r = await api("GET", `/api/erp/goods-transfers/ledger-options?countryId=${countryId}&q=${encodeURIComponent(q)}${kind === "account" ? "&kind=account" : ""}`);
      if (r.ok) setRows(kind === "account" ? r.data.accounts : r.data.ledgers);
    }, 250);
    return () => clearTimeout(h);
  }, [q, open, countryId, kind]);
  return (
    <Field s={s} label={label} hint={hint}>
      <div className="relative">
        <input
          className={inputCls}
          value={open ? q : value?.text ?? ""}
          placeholder={s.t("search_ph", "Search by code or name…")}
          onFocus={() => { setOpen(true); setQ(""); }}
          onChange={(e) => setQ(e.target.value)}
        />
        {value && !open ? (
          <button type="button" aria-label={s.t("clear", "Clear")} className="absolute end-2 top-2.5 text-slate-400" onClick={() => onChange(null)}><X className="h-4 w-4" /></button>
        ) : null}
        {open ? (
          <div className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
            {rows.length === 0 ? <div className="p-3 text-[11px] text-slate-400">{s.t("no_results", "No matching records.")}</div> : null}
            {rows.map((r) => (
              <button
                type="button"
                key={r.id}
                className={`block w-full px-3 py-2 text-xs hover:bg-blue-50 dark:hover:bg-slate-800 ${s.textStart}`}
                onClick={() => { onChange({ id: r.id, text: `${r.code ?? ""} — ${r.name ?? ""}`.trim() }); setOpen(false); }}
              >
                <span className="font-mono text-[10px] text-slate-500">{r.code}</span> {r.name}
              </button>
            ))}
            <button type="button" className="block w-full border-t border-slate-100 px-3 py-2 text-[11px] text-slate-500" onClick={() => setOpen(false)}>{s.t("close", "Close")}</button>
          </div>
        ) : null}
      </div>
    </Field>
  );
}

export function GoodsTransferJournalView({ purchaseId, lang }: { purchaseId: string; lang?: string }) {
  const s = useErpScreen("gtj", lang);
  const router = useRouter();
  const [data, setData] = useState<Json>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [pick, setPick] = useState<{ lot: Json; row: Json } | null>(null);
  const [form, setForm] = useState<{ purpose: PurposeId; lot: Json; row: Json } | null>(null);
  const [action, setAction] = useState<{ kind: "cancel" | "cost" | "tradeCancel"; transfer: Json } | null>(null);
  const [showMoves, setShowMoves] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await api("GET", `/api/erp/purchases/local-purchase/${purchaseId}/goods-transfer?lang=${s.lang}`);
    if (r.ok) { setData(r.data); setError(""); } else setError(r.error);
    setLoading(false);
  }, [purchaseId, s.lang]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (toast) { const h = setTimeout(() => setToast(null), 6000); return () => clearTimeout(h); } }, [toast]);

  const purchase = data?.purchase;
  const lots: Json[] = data?.lots ?? [];
  const transfers: Json[] = data?.transfers ?? [];
  const lotById = useMemo(() => new Map(lots.map((l) => [l.id, l])), [lots]);
  const stateLabel = (st: string) => s.t(`state_${st}`, STATE_DEFAULTS[st] ?? st);
  const purposeLabel = (p: string) => s.t(`purpose_${p}`, PURPOSE_DEFAULTS[p as PurposeId] ?? p);
  const placeLabel = (row: Json) => (row.warehouse_name ? `${row.warehouse_code ?? ""} ${row.warehouse_name}`.trim() : row.location_label || s.t("purchase_location", "Purchase location"));

  async function doAction(id: string, body: Json, okText: string) {
    const r = await api("POST", `/api/erp/goods-transfers/${id}`, body);
    if (r.ok) { setToast({ kind: "ok", text: okText }); await load(); return true; }
    setToast({ kind: "err", text: r.error });
    return false;
  }

  if (loading && !data) {
    return <div dir={s.dir} className="flex items-center justify-center gap-2 p-10 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> {s.t("loading", "Loading…")}</div>;
  }
  if (error && !data) {
    return <div dir={s.dir} className="m-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><AlertTriangle className="me-2 inline h-4 w-4" />{error}</div>;
  }

  const dest = data?.destinationTrade;

  return (
    <div dir={s.dir} className="mx-auto max-w-6xl space-y-4 p-3 pb-28 sm:p-4 sm:pb-28">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => router.push("/dashboard/purchase/local-purchase")} aria-label={s.t("back", "Back")} className="rounded-lg border border-slate-200 p-2 hover:bg-slate-100 dark:border-slate-700">
            <ArrowLeft className={`h-4 w-4 ${s.isRtl ? "rotate-180" : ""}`} />
          </button>
          <div>
            <h1 className="text-base font-black text-slate-900 dark:text-slate-100">{s.t("title", "Goods Transfer Journal")}</h1>
            <p className="text-[11px] text-slate-500">{s.t("subtitle", "Decide where the purchased goods go. Financial posting is already done and is never repeated here.")}</p>
          </div>
        </div>
        <button type="button" onClick={() => router.push(`/dashboard/purchase/local-purchase/${purchaseId}`)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900">
          <FileText className="h-4 w-4" /> {s.t("open_lifecycle", "Lifecycle report")}
        </button>
      </div>

      {toast ? (
        <div role="status" className={`rounded-lg border px-3 py-2 text-xs font-semibold ${toast.kind === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-700"}`}>
          {toast.text}
        </div>
      ) : null}

      {/* purchase + financial status */}
      {purchase ? (
        <section className="grid gap-3 rounded-xl border border-slate-200 bg-white p-3 text-xs dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-2 lg:grid-cols-4">
          <div><div className="text-[10px] font-bold uppercase text-slate-500">{s.t("supplier", "Supplier")}</div><div className="font-semibold">{purchase.supplier || "—"}</div></div>
          <div><div className="text-[10px] font-bold uppercase text-slate-500">{s.t("branch", "Country / Branch")}</div><div className="font-semibold">{purchase.countryName} · {purchase.branchName}{purchase.cityName ? ` · ${purchase.cityName}` : ""}</div></div>
          <div><div className="text-[10px] font-bold uppercase text-slate-500">{s.t("fin_status", "Financial posting")}</div>
            <div className="flex items-center gap-1.5 font-semibold"><StatusPill s={s} status={purchase.status === "posted" ? "posted" : purchase.status} />
              <span className="font-mono text-[10px] text-slate-500">{purchase.journalSerialNo || ""}</span></div></div>
          <div><div className="text-[10px] font-bold uppercase text-slate-500">{s.t("payment", "Payment condition")}</div>
            <div className="font-semibold">{purchase.paymentMode} · {purchase.currency} {fmt(purchase.finalCost)}</div>
            {purchase.remainingBalance > 0 ? <div className="text-[10px] text-slate-500">{s.t("remaining", "Remaining")}: {fmt(purchase.remainingBalance)}</div> : null}</div>
        </section>
      ) : null}

      {/* destination of an inter-country trade: receive */}
      {dest ? (
        <section className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs dark:border-amber-700 dark:bg-amber-950/30">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="font-black text-amber-900 dark:text-amber-200">{s.t("trade_linked", "Linked Inter-Country Trade")} {dest.trade_ref}</div>
              <div className="text-[11px] text-amber-800/80">{dest.source_country_name} → {dest.dest_country_name} · {qtyFmt(dest.qty)} · {dest.dest_currency} {fmt(dest.sale_amount_dest)} <StatusPill s={s} status={dest.status} /></div>
              <div className="text-[11px] text-amber-800/80">{s.t("trade_dest_note", "This purchase was created by the source country. It is posted and the stock increases only when you confirm receipt.")}</div>
            </div>
            {dest.status === "in_transit" ? (
              <button type="button" className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700"
                onClick={async () => { const r = await api("POST", `/api/erp/inter-country-trades/${dest.id}`, { action: "receive" }); if (r.ok) { setToast({ kind: "ok", text: s.t("received_ok", "Goods received into stock.") }); await load(); } else setToast({ kind: "err", text: r.error }); }}>
                {s.t("confirm_receipt", "Confirm receipt")}
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      {data?.notPosted && !dest ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800"><AlertTriangle className="me-2 inline h-4 w-4" />{s.t("not_posted", "This purchase is not posted yet. Goods can be transferred only after the purchase is confirmed and posted.")}</div>
      ) : null}
      {data?.lotsError ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">{data.lotsError}</div> : null}

      {/* lots */}
      {lots.map((lot) => {
        const b = lot.balance;
        const cells: [string, string, number][] = [
          ["q_purchased", "Purchased", b.purchased], ["q_received", "Received", b.received], ["q_reserved", "Reserved", b.reserved],
          ["q_transferred", "Transferred", b.transferred], ["q_sold", "Sold", b.sold], ["q_exported", "Exported", b.exported], ["q_available", "Available", b.available],
        ];
        return (
          <section key={lot.id} className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 p-3 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Boxes className="h-5 w-5 text-blue-600" />
                <div>
                  <div className="text-sm font-black">{lot.goods_name} <span className="font-mono text-[11px] font-semibold text-slate-500">{lot.lot_ref}</span></div>
                  <div className="text-[11px] text-slate-500">{[lot.brand, lot.size, lot.origin].filter((x) => x && x !== "-").join(" · ")}</div>
                </div>
              </div>
              <div className="text-[11px] text-slate-600">
                <div>{s.t("original_cost", "Original cost")}: <b>{lot.currency_code} {fmt(lot.original_cost)}</b></div>
                <div>{s.t("landed_cost", "Landed cost")}: <b>{lot.currency_code} {fmt(lot.landed_cost)}</b> ({fmt(lot.unit_cost, 2)}/{lot.unit_name})</div>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-px bg-slate-100 text-center dark:bg-slate-800 sm:grid-cols-7">
              {cells.map(([k, d, v]) => (
                <div key={k} className="bg-white p-2 dark:bg-slate-900">
                  <div className="text-[9px] font-bold uppercase text-slate-500">{s.t(k, d)}</div>
                  <div className="text-sm font-black tabular-nums">{qtyFmt(v)}</div>
                </div>
              ))}
            </div>
            <ul className="divide-y divide-slate-100 dark:divide-slate-800 sm:hidden">
              {lot.stock.map((row: Json) => (
                <li key={row.id} className="flex items-start justify-between gap-3 p-3 text-xs">
                  <div className="min-w-0">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold dark:bg-slate-800">{stateLabel(row.state)}</span>
                    <div className="mt-1 break-words font-semibold">{placeLabel(row)}</div>
                    <div className="font-mono text-[11px] text-slate-500">{s.t("col_rack", "Rack / Bin")}: {row.rack_bin || "—"}</div>
                  </div>
                  <div className={`shrink-0 ${s.textEnd}`}>
                    <div className="text-base font-black tabular-nums">{qtyFmt(row.qty)}</div>
                    {row.state === "available" ? (
                      <button type="button" className="mt-1 rounded-lg bg-blue-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-blue-700" onClick={() => setPick({ lot, row })}>
                        {s.t("transfer", "Transfer")}
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-[10px] uppercase text-slate-500 dark:bg-slate-800/60">
                  <tr>
                    <th className={`p-2 ${s.textStart}`}>{s.t("col_state", "State")}</th>
                    <th className={`p-2 ${s.textStart}`}>{s.t("col_location", "Warehouse / Location")}</th>
                    <th className={`p-2 ${s.textStart}`}>{s.t("col_rack", "Rack / Bin")}</th>
                    <th className={`p-2 ${s.textEnd}`}>{s.t("col_qty", "Quantity")}</th>
                    <th className="p-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {lot.stock.map((row: Json) => (
                    <tr key={row.id}>
                      <td className="p-2"><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold dark:bg-slate-800">{stateLabel(row.state)}</span></td>
                      <td className="p-2">{placeLabel(row)}</td>
                      <td className="p-2 font-mono">{row.rack_bin || "—"}</td>
                      <td className={`p-2 font-bold tabular-nums ${s.textEnd}`}>{qtyFmt(row.qty)}</td>
                      <td className={`p-2 ${s.textEnd}`}>
                        {row.state === "available" ? (
                          <button type="button" className="rounded-lg bg-blue-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-blue-700" onClick={() => setPick({ lot, row })}>
                            {s.t("transfer", "Transfer")}
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-slate-100 p-2 dark:border-slate-800">
              <button type="button" className="text-[11px] font-bold text-blue-700" onClick={() => setShowMoves(showMoves === lot.id ? null : lot.id)}>
                {showMoves === lot.id ? s.t("hide_history", "Hide movement history") : s.t("show_history", "Movement history")}
              </button>
              {showMoves === lot.id ? (
                <ol className="mt-2 space-y-1 text-[11px]">
                  {(data.movements as Json[]).filter((m) => m.lot_id === lot.id).map((m) => (
                    <li key={m.id} className="flex flex-wrap gap-x-2 rounded-lg bg-slate-50 px-2 py-1 dark:bg-slate-800/60">
                      <span className="font-mono text-slate-500">{new Date(m.created_at).toLocaleString()}</span>
                      <b>{s.t(`mv_${m.movement_type}`, String(m.movement_type).replace("_", " "))}</b>
                      <span>{qtyFmt(m.qty)}</span>
                      <span className="text-slate-500">{m.from_state ? stateLabel(m.from_state) : ""} → {m.to_state ? stateLabel(m.to_state) : ""}</span>
                      <span className="text-slate-500">{m.from_warehouse_name || ""}{m.from_rack_bin ? `/${m.from_rack_bin}` : ""} → {m.to_warehouse_name || ""}{m.to_rack_bin ? `/${m.to_rack_bin}` : ""}</span>
                      <span className="font-mono text-slate-400">{m.reference_no || ""}</span>
                    </li>
                  ))}
                </ol>
              ) : null}
            </div>
          </section>
        );
      })}

      {/* transfers */}
      {transfers.length > 0 ? (() => {
        const rows = transfers.map((t) => {
          const lot = lotById.get(t.lot_id);
          const sale = (data.sales as Json[]).find((x) => x.id === t.sales_order_id);
          const trade = (data.trades as Json[]).find((x) => x.id === t.inter_country_trade_id);
          const destText = t.purpose === "third_party_warehouse" ? `${t.provider_name} — ${t.provider_city}` : t.dest_warehouse_name ? `${t.dest_warehouse_code ?? ""} ${t.dest_warehouse_name}${t.dest_rack_bin ? `/${t.dest_rack_bin}` : ""}` : sale ? `${sale.sales_order_no} · ${sale.customer_name ?? ""}` : t.purpose === "hold" ? s.t("hold_here", "Stays where it is") : "—";
          const costable = ["local_sale", "export_customer"].includes(t.purpose) && t.status === "completed" && !t.cost_roznamcha_entry_id;
          const buttons = (
            <div className="flex flex-wrap gap-1.5 sm:justify-end">
              {t.purpose === "dgt_warehouse" && t.status === "in_transit" ? (
                <button type="button" className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-bold text-white" onClick={() => void doAction(t.id, { action: "receive" }, s.t("received_ok", "Goods received into stock."))}>{s.t("receive", "Receive")}</button>
              ) : null}
              {t.purpose === "export_customer" && t.status === "confirmed" ? (
                <>
                  <button type="button" className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-[11px] font-bold" onClick={() => void doAction(t.id, { action: "advance", to: "loading" }, s.t("moved_loading", "Marked as loading."))}>{s.t("mark_loading", "Mark loading")}</button>
                  <button type="button" className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-[11px] font-bold" onClick={() => void doAction(t.id, { action: "advance", to: "in_transit" }, s.t("moved_transit", "Marked as in transit."))}>{s.t("mark_transit", "Mark in transit")}</button>
                </>
              ) : null}
              {t.sales_order_id && t.status !== "cancelled" && !trade ? (
                <button type="button" className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-[11px] font-bold" onClick={() => router.push(`/dashboard/sales/new-sales-booking-order?id=${t.sales_order_id}`)}>{s.t("open_sale", "Open sale")}</button>
              ) : null}
              {costable ? (
                <button type="button" className="rounded-lg bg-indigo-600 px-2.5 py-1.5 text-[11px] font-bold text-white" onClick={() => setAction({ kind: "cost", transfer: t })}>{s.t("post_cost", "Post cost of sales")}</button>
              ) : null}
              {t.purpose === "export_dgt_branch" && trade && ["in_transit", "confirmed"].includes(trade.status) ? (
                <button type="button" className="rounded-lg border border-red-300 px-2.5 py-1.5 text-[11px] font-bold text-red-700" onClick={() => setAction({ kind: "tradeCancel", transfer: { ...t, trade } })}>{s.t("cancel_trade", "Cancel trade")}</button>
              ) : null}
              {["own_warehouse", "dgt_warehouse", "third_party_warehouse", "hold"].includes(t.purpose) && ["in_transit", "completed", "confirmed"].includes(t.status) ? (
                <button type="button" className="rounded-lg border border-red-300 px-2.5 py-1.5 text-[11px] font-bold text-red-700" onClick={() => setAction({ kind: "cancel", transfer: t })}>
                  {t.status === "in_transit" ? s.t("cancel", "Cancel") : s.t("return", "Return")}
                </button>
              ) : null}
            </div>
          );
          return { t, lot, trade, destText, buttons };
        });
        return (
          <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="border-b border-slate-100 p-3 text-xs font-black uppercase tracking-wide text-slate-700 dark:border-slate-800">{s.t("transfers_title", "Transfers")}</div>
            <ul className="divide-y divide-slate-100 dark:divide-slate-800 sm:hidden">
              {rows.map(({ t, lot, trade, destText, buttons }) => (
                <li key={t.id} className="space-y-1.5 p-3 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-mono font-bold">{t.transfer_no}{trade ? <span className="ms-2 text-[10px] text-blue-700">{trade.trade_ref}</span> : null}</div>
                      <div>{purposeLabel(t.purpose)}</div>
                    </div>
                    <StatusPill s={s} status={t.status} />
                  </div>
                  <div className="text-slate-600">{lot?.lot_ref} · <b className="tabular-nums">{qtyFmt(t.qty)}</b> · {destText}</div>
                  {t.cost_roznamcha_entry_id ? <div className="text-[10px] text-emerald-700">{s.t("cost_posted", "Cost of sales posted")} {t.cost_currency} {fmt(t.cost_amount)}</div> : null}
                  {buttons}
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-[10px] uppercase text-slate-500 dark:bg-slate-800/60">
                  <tr>
                    <th className={`p-2 ${s.textStart}`}>{s.t("col_no", "Transfer no.")}</th>
                    <th className={`p-2 ${s.textStart}`}>{s.t("col_purpose", "Purpose")}</th>
                    <th className={`p-2 ${s.textStart}`}>{s.t("col_lot", "Lot")}</th>
                    <th className={`p-2 ${s.textEnd}`}>{s.t("col_qty", "Quantity")}</th>
                    <th className={`p-2 ${s.textStart}`}>{s.t("col_destination", "Destination")}</th>
                    <th className={`p-2 ${s.textStart}`}>{s.t("col_status", "Status")}</th>
                    <th className="p-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {rows.map(({ t, lot, trade, destText, buttons }) => (
                    <tr key={t.id} className="align-top">
                      <td className="p-2 font-mono">{t.transfer_no}{trade ? <div className="text-[10px] text-blue-700">{trade.trade_ref}</div> : null}</td>
                      <td className="p-2">{purposeLabel(t.purpose)}</td>
                      <td className="p-2">{lot?.lot_ref}</td>
                      <td className={`p-2 font-bold tabular-nums ${s.textEnd}`}>{qtyFmt(t.qty)}</td>
                      <td className="p-2">{destText}{t.cost_roznamcha_entry_id ? <div className="text-[10px] text-emerald-700">{s.t("cost_posted", "Cost of sales posted")} {t.cost_currency} {fmt(t.cost_amount)}</div> : null}</td>
                      <td className="p-2"><StatusPill s={s} status={t.status} /></td>
                      <td className={`p-2 ${s.textEnd}`}>{buttons}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })() : null}

      {/* purpose picker */}
      {pick ? (
        <FullScreen s={s} title={s.t("pick_title", "Where will these goods go?")} subtitle={`${pick.lot.goods_name} · ${pick.lot.lot_ref} · ${qtyFmt(pick.row.qty)} @ ${placeLabel(pick.row)}${pick.row.rack_bin ? `/${pick.row.rack_bin}` : ""}`} onClose={() => setPick(null)}>
          <p className="text-xs text-slate-500">{s.t("pick_hint", "Choose one purpose. Each opens its own linked form; nothing is posted until you confirm there.")}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {PURPOSES.map(({ id, icon: Icon }) => (
              <button key={id} type="button" onClick={() => { setForm({ purpose: id, lot: pick.lot, row: pick.row }); setPick(null); }}
                className={`flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 hover:border-blue-500 hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-900 ${s.textStart}`}>
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
                <span>
                  <span className="block text-sm font-black">{purposeLabel(id)}</span>
                  <span className="block text-[11px] text-slate-500">{s.t(`purpose_${id}_desc`, "")}</span>
                </span>
              </button>
            ))}
          </div>
        </FullScreen>
      ) : null}

      {form ? (
        <TransferForm
          s={s} purchaseId={purchaseId} data={data} purpose={form.purpose} lot={form.lot} row={form.row}
          onClose={() => setForm(null)}
          onDone={async (text) => { setForm(null); setToast({ kind: "ok", text }); await load(); }}
          onError={(text) => setToast({ kind: "err", text })}
          placeLabel={placeLabel}
        />
      ) : null}

      {action ? (
        <ActionModal
          s={s} action={action} lotById={lotById} countryId={purchase?.countryId}
          onClose={() => setAction(null)}
          onSubmit={async (payload) => {
            const t = action.transfer;
            let ok = false;
            if (action.kind === "tradeCancel") {
              const r = await api("POST", `/api/erp/inter-country-trades/${t.trade.id}`, { action: "cancel", reason: payload.reason });
              if (r.ok) { setToast({ kind: "ok", text: s.t("trade_cancelled_ok", "Trade cancelled; postings reversed and stock returned.") }); await load(); ok = true; } else setToast({ kind: "err", text: r.error });
            } else if (action.kind === "cancel") {
              ok = await doAction(t.id, { action: "cancel", reason: payload.reason }, s.t("cancelled_ok", "Transfer reversed."));
            } else {
              ok = await doAction(t.id, { action: "post_cost", cogsLedgerId: payload.cogsLedgerId }, s.t("cost_ok", "Cost of sales posted."));
            }
            if (ok) setAction(null);
          }}
        />
      ) : null}
    </div>
  );
}

function ActionModal({ s, action, lotById, countryId, onClose, onSubmit }: { s: S; action: { kind: "cancel" | "cost" | "tradeCancel"; transfer: Json }; lotById: Map<string, Json>; countryId: string; onClose: () => void; onSubmit: (p: Json) => Promise<void> }) {
  const [reason, setReason] = useState("");
  const [cogs, setCogs] = useState<{ id: string; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const t = action.transfer;
  const lot = lotById.get(t.lot_id);
  const amount = lot ? (Number(t.qty) * Number(lot.original_cost)) / Number(lot.qty_purchased) : 0;
  const submit = async () => {
    if (lock.current) return;
    lock.current = true; setBusy(true);
    try { await onSubmit({ reason, cogsLedgerId: cogs?.id }); } finally { lock.current = false; setBusy(false); }
  };
  const isCost = action.kind === "cost";
  const valid = isCost ? !!cogs : reason.trim().length >= 3;
  return (
    <FullScreen s={s} title={isCost ? s.t("cost_title", "Post cost of sales") : s.t("reverse_title", "Cancel / return transfer")} subtitle={`${t.transfer_no} · ${lot?.goods_name ?? ""} · ${qtyFmt(t.qty)}`} onClose={onClose}
      footer={<>
        <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-bold">{s.t("close", "Close")}</button>
        <button type="button" disabled={!valid || busy} onClick={() => void submit()} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} {isCost ? s.t("confirm_post", "Confirm & post") : s.t("confirm_reverse", "Confirm reversal")}
        </button>
      </>}>
      {isCost ? (
        <>
          <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-2 font-black">{s.t("cost_preview", "Posting preview")}</div>
            <table className="w-full"><tbody>
              <tr><td className="py-1">{s.t("dr_cogs", "DR  Cost of sales (selected ledger)")}</td><td className={`font-mono ${s.textEnd}`}>{lot?.currency_code} {fmt(amount)}</td></tr>
              <tr><td className="py-1">{s.t("cr_inventory", "CR  Inventory (the lot's purchase ledger)")}</td><td className={`font-mono ${s.textEnd}`}>{lot?.currency_code} {fmt(amount)}</td></tr>
            </tbody></table>
            <p className="mt-2 text-[11px] text-slate-500">{s.t("cost_note", "Posted at the lot's posted purchase cost, once. The sale itself (customer / sales entries) was already posted by the Sales Order.")}</p>
          </div>
          <Picker s={s} label={s.t("cogs_ledger", "Cost of sales ledger")} kind="ledger" countryId={countryId} value={cogs} onChange={setCogs} hint={s.t("ledger_hint", "Existing ledgers only; nothing is created automatically.")} />
        </>
      ) : (
        <Field s={s} label={s.t("reason", "Reason")}>
          <textarea className={`${inputCls} h-24 py-2`} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      )}
    </FullScreen>
  );
}

function TransferForm({ s, purchaseId, data, purpose, lot, row, onClose, onDone, onError, placeLabel }: {
  s: S; purchaseId: string; data: Json; purpose: PurposeId; lot: Json; row: Json; onClose: () => void; onDone: (text: string) => Promise<void>; onError: (t: string) => void; placeLabel: (r: Json) => string;
}) {
  const router = useRouter();
  const idem = useRef(newKey());
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const maxQty = Number(row.qty);
  const [qty, setQty] = useState<string>(String(maxQty));
  const [notes, setNotes] = useState("");
  const [rack, setRack] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [branchId, setBranchId] = useState(data.branches?.[0]?.id ?? "");
  const [truck, setTruck] = useState("");
  const [driver, setDriver] = useState("");
  const [loadDate, setLoadDate] = useState(new Date().toISOString().slice(0, 10));
  const [provider, setProvider] = useState<{ id: string; text: string } | null>(null);
  const [pName, setPName] = useState(""); const [pCity, setPCity] = useState(""); const [pAddr, setPAddr] = useState(""); const [pRef, setPRef] = useState("");
  const [pCharge, setPCharge] = useState(""); const [pCur, setPCur] = useState(lot.currency_code || "");
  // inter-country
  const [opts, setOpts] = useState<Json>(null);
  const [tBranch, setTBranch] = useState(""); const [tCity, setTCity] = useState(""); const [tWh, setTWh] = useState("");
  const [rate, setRate] = useState(""); const [saleRate, setSaleRate] = useState("");
  const [lRecv, setLRecv] = useState<any>(null); const [lSales, setLSales] = useState<any>(null); const [lCogs, setLCogs] = useState<any>(null);
  const [lDestInv, setLDestInv] = useState<any>(null); const [lDestPay, setLDestPay] = useState<any>(null);
  const [mode, setMode] = useState("Road"); const [confirmed, setConfirmed] = useState(false);

  const whs: Json[] = (data.warehouses ?? []).filter((w: Json) => w.country_id === lot.country_id);
  useEffect(() => {
    if (purpose !== "export_dgt_branch") return;
    void api("GET", `/api/erp/goods-transfers/trade-options?countryId=${lot.country_id}&lang=${s.lang}`).then((r) => { if (r.ok) setOpts(r.data); });
  }, [purpose, lot.country_id, s.lang]);

  const qn = Number(qty);
  const qtyOk = qn > 0 && qn <= maxQty + 0.00005;
  const tb = opts?.branches?.find((b: Json) => b.id === tBranch);
  const sourceAmt = qn * Number(saleRate || 0);
  const destAmt = sourceAmt * Number(rate || 0);
  const costAmt = (qn * Number(lot.original_cost)) / Number(lot.qty_purchased);

  const finish = async (r: { ok: boolean; data: Json; error: string }, okText: string) => {
    if (r.ok) await onDone(okText); else { setErr(r.error); onError(r.error); }
  };
  const submit = async () => {
    if (lock.current) return; // double-click / repeated submit guard
    lock.current = true; setBusy(true); setErr("");
    try {
      const J = `/api/erp/purchases/local-purchase/${purchaseId}/goods-transfer`;
      const source = { warehouseId: row.warehouse_id ?? null, label: row.location_label ?? "", rack: row.rack_bin ?? "" };
      if (purpose === "own_warehouse") {
        await finish(await api("POST", J, { lotId: lot.id, purpose, qty: qn, idempotencyKey: idem.current, source, dest: { warehouseId, rack }, notes }), s.t("done_own", "Stock moved. No financial entry was posted."));
      } else if (purpose === "dgt_warehouse") {
        await finish(await api("POST", J, { lotId: lot.id, purpose, qty: qn, idempotencyKey: idem.current, source, dest: { warehouseId, countryBranchId: branchId, rack }, transport: { truck, driver, loadingDate: loadDate }, notes }), s.t("done_dgt", "Dispatched. The quantity is In Transit until the destination receives it."));
      } else if (purpose === "third_party_warehouse") {
        await finish(await api("POST", J, { lotId: lot.id, purpose, qty: qn, idempotencyKey: idem.current, source, provider: { accountId: provider?.id, name: pName, city: pCity, address: pAddr, contractRef: pRef, storageCharge: pCharge === "" ? null : Number(pCharge), chargeCurrency: pCur }, notes }), s.t("done_3p", "Goods placed with the third-party warehouse. They remain DGT stock."));
      } else if (purpose === "hold") {
        await finish(await api("POST", J, { lotId: lot.id, purpose, qty: qn, idempotencyKey: idem.current, source, notes }), s.t("done_hold", "Recorded: the goods stay at their current location."));
      } else if (purpose === "export_dgt_branch") {
        await finish(await api("POST", J, {
          lotId: lot.id, purpose, qty: qn, idempotencyKey: idem.current, source, destCountryBranchId: tBranch, destCityBranchId: tCity || null, destBranchCode: tb?.code ?? "", destWarehouseId: tWh,
          approvedExchangeRate: Number(rate), saleUnitRate: Number(saleRate),
          ledgers: { receivable: lRecv?.id, sales: lSales?.id, cogs: lCogs?.id, destInventory: lDestInv?.id, destPayable: lDestPay?.id },
          transport: { mode, truck, driver, loadingDate: loadDate }, notes,
        }), s.t("done_trade", "Inter-Country Trade created: source sale posted, destination purchase is In Transit."));
      }
    } finally { lock.current = false; setBusy(false); }
  };

  const title = s.t(`purpose_${purpose}`, PURPOSE_DEFAULTS[purpose]);
  const subtitle = `${lot.goods_name} · ${lot.lot_ref} · ${s.t("from", "From")}: ${placeLabel(row)}${row.rack_bin ? `/${row.rack_bin}` : ""} (${qtyFmt(maxQty)})`;

  // sale / export launch an EXISTING Sales form pre-filled with this lot — nothing is posted from here
  if (purpose === "local_sale" || purpose === "export_customer") {
    const mode2 = purpose === "export_customer" ? "export" : "local";
    const url = `/dashboard/sales/new-sales-booking-order?lotId=${lot.id}&wh=${row.warehouse_id ?? ""}&rack=${encodeURIComponent(row.rack_bin ?? "")}&label=${encodeURIComponent(row.location_label ?? "")}&mode=${mode2}`;
    return (
      <FullScreen s={s} title={title} subtitle={subtitle} onClose={onClose}
        footer={<>
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-bold">{s.t("close", "Close")}</button>
          <button type="button" onClick={() => router.push(url)} className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white">{purpose === "export_customer" ? s.t("open_export_draft", "Open Export Sales Order") : s.t("open_sale_draft", "Open Local Sales Draft")}</button>
        </>}>
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-3 text-sm font-black">{s.t("prefill_title", "The sales form opens pre-filled with:")}</div>
          <dl className="grid gap-2 sm:grid-cols-2">
            <div><dt className="text-[10px] font-bold uppercase text-slate-500">{s.t("goods_lot", "Goods and lot")}</dt><dd className="font-semibold">{lot.goods_name} · {lot.lot_ref}</dd></div>
            <div><dt className="text-[10px] font-bold uppercase text-slate-500">{s.t("source_wh", "Source warehouse")}</dt><dd className="font-semibold">{placeLabel(row)}{row.rack_bin ? `/${row.rack_bin}` : ""}</dd></div>
            <div><dt className="text-[10px] font-bold uppercase text-slate-500">{s.t("q_available", "Available")}</dt><dd className="font-semibold">{qtyFmt(maxQty)} {lot.unit_name}</dd></div>
            <div><dt className="text-[10px] font-bold uppercase text-slate-500">{s.t("cost_basis", "Cost / landed cost per unit")}</dt><dd className="font-semibold">{lot.currency_code} {fmt(Number(lot.original_cost) / Number(lot.qty_purchased))} / {fmt(lot.unit_cost)}</dd></div>
          </dl>
          <p className="mt-3 text-[11px] text-slate-500">{purpose === "export_customer"
            ? s.t("export_note", "You then choose the customer, destination country, quantity, rate, currency, payment and delivery terms, mode, and the shipping/clearing branch or agent. The quantity is only reserved by the draft and is deducted once at final billing / dispatch.")
            : s.t("sale_note", "You then choose the customer and enter quantity, rate, tax, currency, payment condition and delivery details. The quantity is only reserved by the draft and is deducted once when the sale is finally posted.")}</p>
        </div>
      </FullScreen>
    );
  }

  const needsQty = true;
  const canSubmit =
    qtyOk && !busy &&
    (purpose === "own_warehouse" ? !!warehouseId :
     purpose === "dgt_warehouse" ? !!warehouseId && !!branchId :
     purpose === "third_party_warehouse" ? !!provider && !!pName.trim() && !!pCity.trim() && !!pAddr.trim() && !!pRef.trim() && pCharge !== "" && !!pCur.trim() :
     purpose === "export_dgt_branch" ? !!tBranch && !!tWh && Number(rate) > 0 && Number(saleRate) > 0 && !!lRecv && !!lSales && !!lCogs && !!lDestInv && !!lDestPay && confirmed :
     true);

  return (
    <FullScreen s={s} title={title} subtitle={subtitle} onClose={onClose}
      footer={<>
        {err ? <span className="me-auto text-[11px] font-semibold text-red-600">{err}</span> : null}
        <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-bold">{s.t("close", "Close")}</button>
        <button type="button" disabled={!canSubmit} onClick={() => void submit()} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          {purpose === "export_dgt_branch" ? s.t("confirm_trade", "Confirm & post trade") : s.t("confirm_transfer", "Confirm transfer")}
        </button>
      </>}>
      {needsQty ? (
        <Field s={s} label={s.t("qty_label", "Quantity to move")} hint={`${s.t("max", "Maximum")}: ${qtyFmt(maxQty)} ${lot.unit_name}`}>
          <input className={inputCls} type="number" min="0" step="any" value={qty} onChange={(e) => setQty(e.target.value)} />
        </Field>
      ) : null}
      {!qtyOk ? <p className="text-[11px] font-semibold text-red-600">{s.t("qty_err", "Enter a quantity greater than zero and not more than what is available at this place.")}</p> : null}

      {purpose === "own_warehouse" ? (
        <>
          <Field s={s} label={s.t("warehouse", "Warehouse (Warehouse Master)")}>
            <select className={inputCls} value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
              <option value="">{s.t("select", "Select…")}</option>
              {whs.map((w) => <option key={w.id} value={w.id}>{w.warehouse_code} — {w.warehouse_name}</option>)}
            </select>
          </Field>
          {warehouseId ? (() => { const w = whs.find((x) => x.id === warehouseId); return w ? (
            <div className="rounded-lg bg-slate-100 p-3 text-[11px] dark:bg-slate-800">
              <div><b>{s.t("wh_code", "Warehouse code")}:</b> {w.warehouse_code}</div>
              <div><b>{s.t("branch", "Country / Branch")}:</b> {w.country_name} · {data.purchase?.branchName}</div>
              <div><b>{s.t("col_location", "Warehouse / Location")}:</b> {w.warehouse_name}</div>
            </div>) : null; })() : null}
          <Field s={s} label={s.t("rack_dest", "Destination rack / bin (optional)")}><input className={inputCls} value={rack} onChange={(e) => setRack(e.target.value)} /></Field>
          <p className="text-[11px] text-slate-500">{s.t("own_note", "This records a stock movement and warehouse receipt. It is not a sale and not a new purchase; the purchase is not posted again. Moving within the same warehouse (rack to rack) leaves total stock unchanged.")}</p>
        </>
      ) : null}

      {purpose === "dgt_warehouse" ? (
        <>
          <Field s={s} label={s.t("dest_branch", "Destination branch")}>
            <select className={inputCls} value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              {(data.branches ?? []).map((b: Json) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Field>
          <Field s={s} label={s.t("dest_wh", "Destination warehouse")}>
            <select className={inputCls} value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
              <option value="">{s.t("select", "Select…")}</option>
              {whs.filter((w) => w.id !== row.warehouse_id).map((w) => <option key={w.id} value={w.id}>{w.warehouse_code} — {w.warehouse_name}</option>)}
            </select>
          </Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field s={s} label={s.t("truck", "Truck / vehicle")}><input className={inputCls} value={truck} onChange={(e) => setTruck(e.target.value)} /></Field>
            <Field s={s} label={s.t("driver", "Driver")}><input className={inputCls} value={driver} onChange={(e) => setDriver(e.target.value)} /></Field>
            <Field s={s} label={s.t("loading_date", "Loading date")}><input className={inputCls} type="date" value={loadDate} onChange={(e) => setLoadDate(e.target.value)} /></Field>
          </div>
          <p className="text-[11px] text-slate-500">{s.t("dgt_note", "Same-country stock transfer: Source → In Transit → Received. No sale revenue and no new purchase is created, and the country's total stock does not change.")}</p>
        </>
      ) : null}

      {purpose === "third_party_warehouse" ? (
        <>
          <Picker s={s} label={s.t("provider_account", "Warehouse provider account")} kind="account" countryId={lot.country_id} value={provider} onChange={(v) => { setProvider(v); if (v && !pName) setPName(v.text.split("—").slice(1).join("—").trim()); }} hint={s.t("provider_hint", "Used only for warehouse expenses and custody. The goods remain DGT-owned stock.")} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field s={s} label={s.t("wh_name", "Warehouse name")}><input className={inputCls} value={pName} onChange={(e) => setPName(e.target.value)} /></Field>
            <Field s={s} label={s.t("contract", "Contract / reference")}><input className={inputCls} value={pRef} onChange={(e) => setPRef(e.target.value)} /></Field>
            <Field s={s} label={s.t("city", "City")}><input className={inputCls} value={pCity} onChange={(e) => setPCity(e.target.value)} /></Field>
            <Field s={s} label={s.t("address", "Address")}><input className={inputCls} value={pAddr} onChange={(e) => setPAddr(e.target.value)} /></Field>
            <Field s={s} label={s.t("storage_charge", "Storage / handling charge")}><input className={inputCls} type="number" min="0" step="any" value={pCharge} onChange={(e) => setPCharge(e.target.value)} /></Field>
            <Field s={s} label={s.t("charge_currency", "Charge currency")}><input className={inputCls} value={pCur} onChange={(e) => setPCur(e.target.value.toUpperCase())} /></Field>
          </div>
          <p className="text-[11px] text-slate-500">{s.t("third_note", "This is custody, not a sale. The charge is recorded here for the expense workflow and is not posted automatically.")}</p>
        </>
      ) : null}

      {purpose === "export_dgt_branch" ? (
        <>
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-[11px] text-blue-900 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200">
            {s.t("ict_note", "Each DGT country keeps separate books, so this is an Inter-Country Trade: one linked transaction with one permanent reference. The source country posts the export sale and cost; the destination purchase is created here and is posted only when the destination confirms receipt.")}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field s={s} label={s.t("dest_branch", "Destination branch")}>
              <select className={inputCls} value={tBranch} onChange={(e) => { setTBranch(e.target.value); setTWh(""); setTCity(""); }}>
                <option value="">{s.t("select", "Select…")}</option>
                {(opts?.branches ?? []).map((b: Json) => <option key={b.id} value={b.id}>{b.country_name} — {b.name}</option>)}
              </select>
            </Field>
            <Field s={s} label={s.t("branch_code", "Branch code")}><input className={`${inputCls} bg-slate-100`} readOnly value={tb?.code ?? ""} /></Field>
            <Field s={s} label={s.t("dest_city", "Destination city branch (optional)")}>
              <select className={inputCls} value={tCity} onChange={(e) => setTCity(e.target.value)}>
                <option value="">—</option>
                {(opts?.cities ?? []).filter((c: Json) => c.country_branch_id === tBranch).map((c: Json) => <option key={c.id} value={c.id}>{c.city_name || c.name}</option>)}
              </select>
            </Field>
            <Field s={s} label={s.t("dest_wh", "Destination warehouse")}>
              <select className={inputCls} value={tWh} onChange={(e) => setTWh(e.target.value)}>
                <option value="">{s.t("select", "Select…")}</option>
                {(opts?.warehouses ?? []).filter((w: Json) => !tb || w.country_id === tb.country_id).map((w: Json) => <option key={w.id} value={w.id}>{w.warehouse_code} — {w.warehouse_name}</option>)}
              </select>
            </Field>
            <Field s={s} label={`${s.t("sale_rate", "Inter-country sale rate")} (${lot.currency_code}/${lot.unit_name})`}><input className={inputCls} type="number" min="0" step="any" value={saleRate} onChange={(e) => setSaleRate(e.target.value)} /></Field>
            <Field s={s} label={`${s.t("approved_rate", "Approved exchange rate")} (${lot.currency_code} → ${tb?.local_currency ?? "…"})`} hint={s.t("rate_hint", "Applied once to the whole trade amount.")}><input className={inputCls} type="number" min="0" step="any" value={rate} onChange={(e) => setRate(e.target.value)} /></Field>
            <Field s={s} label={s.t("ship_mode", "Transport mode")}>
              <select className={inputCls} value={mode} onChange={(e) => setMode(e.target.value)}>
                {["Road", "Sea", "Air", "Train"].map((m) => <option key={m} value={m}>{s.t(`mode_${m.toLowerCase()}`, m)}</option>)}
              </select>
            </Field>
            <Field s={s} label={s.t("truck", "Truck / vehicle")}><input className={inputCls} value={truck} onChange={(e) => setTruck(e.target.value)} /></Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Picker s={s} label={s.t("l_recv", "Inter-country account (receivable) — source")} kind="ledger" countryId={lot.country_id} value={lRecv} onChange={setLRecv} />
            <Picker s={s} label={s.t("l_sales", "Export sales ledger — source")} kind="ledger" countryId={lot.country_id} value={lSales} onChange={setLSales} />
            <Picker s={s} label={s.t("cogs_ledger", "Cost of sales ledger")} kind="ledger" countryId={lot.country_id} value={lCogs} onChange={setLCogs} />
            {tb ? <Picker s={s} label={s.t("l_dest_inv", "Inventory / purchase ledger — destination")} kind="ledger" countryId={tb.country_id} value={lDestInv} onChange={setLDestInv} /> : null}
            {tb ? <Picker s={s} label={s.t("l_dest_pay", "Intercompany payable — destination")} kind="ledger" countryId={tb.country_id} value={lDestPay} onChange={setLDestPay} /> : null}
          </div>
          {Number(saleRate) > 0 && Number(rate) > 0 && qtyOk ? (
            <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs dark:border-slate-700 dark:bg-slate-900">
              <div className="mb-2 font-black">{s.t("preview_title", "Balanced posting preview")}</div>
              <table className="w-full">
                <tbody>
                  <tr><td className="py-1 text-[11px] text-slate-500" colSpan={3}>{s.t("prev_source", "Source country")}</td></tr>
                  <tr><td>{s.t("dr_recv", "DR  Inter-country receivable")}</td><td className={`font-mono ${s.textEnd}`}>{lot.currency_code} {fmt(sourceAmt)}</td><td /></tr>
                  <tr><td>{s.t("cr_sales", "CR  Export sales")}</td><td /><td className={`font-mono ${s.textEnd}`}>{lot.currency_code} {fmt(sourceAmt)}</td></tr>
                  <tr><td>{s.t("dr_cogs", "DR  Cost of sales (selected ledger)")}</td><td className={`font-mono ${s.textEnd}`}>{lot.currency_code} {fmt(costAmt)}</td><td /></tr>
                  <tr><td>{s.t("cr_inventory", "CR  Inventory (the lot's purchase ledger)")}</td><td /><td className={`font-mono ${s.textEnd}`}>{lot.currency_code} {fmt(costAmt)}</td></tr>
                  <tr><td className="pt-3 text-[11px] text-slate-500" colSpan={3}>{s.t("prev_dest", "Destination country — posted on receipt")}</td></tr>
                  <tr><td>{s.t("dr_dest_inv", "DR  Inventory / purchase")}</td><td className={`font-mono ${s.textEnd}`}>{tb?.local_currency} {fmt(destAmt)}</td><td /></tr>
                  <tr><td>{s.t("cr_dest_pay", "CR  Intercompany payable")}</td><td /><td className={`font-mono ${s.textEnd}`}>{tb?.local_currency} {fmt(destAmt)}</td></tr>
                </tbody>
              </table>
            </div>
          ) : null}
          <label className="flex items-start gap-2 text-xs">
            <input type="checkbox" style={{ width: 18, height: 18, minWidth: 18, minHeight: 18 }} className="mt-0.5 shrink-0" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
            <span>{s.t("confirm_check", "I confirm these goods, quantity, rate and accounts. This posts the source-country sale and cost once.")}</span>
          </label>
        </>
      ) : null}

      {purpose === "hold" ? (
        <p className="rounded-lg bg-slate-100 p-3 text-[11px] dark:bg-slate-800">{s.t("hold_note", "The goods stay where they are. This only records the decision in the journal; no stock changes and nothing is posted.")}</p>
      ) : null}

      <Field s={s} label={s.t("notes", "Notes (optional)")}><textarea className={`${inputCls} h-20 py-2`} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
    </FullScreen>
  );
}
