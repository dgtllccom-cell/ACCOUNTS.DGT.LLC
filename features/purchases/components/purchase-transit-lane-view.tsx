"use client";

/**
 * Purchase Transit & Lane — the shared report for Purchase Booking AND Local Purchase.
 *
 * After Loading, every container/load is one row here. From this page the authorised holder of a load moves it
 * (Loaded → In Transit → Arrived → Transfer Pending → Assigned → Customs → Cleared → Final Disposition → Completed),
 * transfers it (own branch / other branch / internal agent / external agent / another user / self-managed), records
 * expenses against it and — after customs — chooses its final disposition.
 *
 * Nothing on this page creates revenue, journal entries or duplicate stock. Every action is an audit event.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRightLeft, Check, ChevronRight, ClipboardList, Loader2, PackageCheck, RefreshCw, Search, Truck, X } from "lucide-react";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { apiGet, apiPatch, apiPost } from "@/lib/api/client";
import {
  LANE_STATUSES, LANE_STATUS_LABEL, RESPONSIBILITIES, TRANSFER_TYPES, allowedNextStatuses, canChooseDisposition, transferProblems,
  type Disposition, type LaneStatus, type TransferType,
} from "@/lib/purchases/lane-rules";
import { Th } from "@/components/ui/translated-th";

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

const inputCls = "w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";
const btnCls = "inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition disabled:opacity-50";

export function PurchaseTransitLaneView({ lang, source }: { lang?: string; source?: "purchase_booking" | "local_purchase" | null }) {
  const s = useErpScreen("plane", lang);
  const T = useCallback((k: string, fb: string) => s.t(k, fb), [s]);
  const stLabel = (st: string) => T(LANE_STATUS_LABEL[st as LaneStatus]?.key ?? st, LANE_STATUS_LABEL[st as LaneStatus]?.en ?? st);

  const [rows, setRows] = useState<Row[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [laneStock, setLaneStock] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [sourceType, setSourceType] = useState<string>(source ?? "");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<Detail | null>(null);
  const [transferIds, setTransferIds] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  // Deep links from the Loading page: ?po=<purchase order id>&laneIds=a,b&action=transfer&focus=<lane id>
  const [deep] = useState(() => {
    if (typeof window === "undefined") return { po: "", sourceId: "", laneIds: [] as string[], action: "", focus: "" };
    const p = new URLSearchParams(window.location.search);
    return { po: p.get("po") ?? "", sourceId: p.get("sourceId") ?? "", laneIds: (p.get("laneIds") ?? "").split(",").filter(Boolean), action: p.get("action") ?? "", focus: p.get("focus") ?? "" };
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
      const d = await apiGet<{ rows: Row[]; summary: Record<string, number>; laneStockQty: number }>(`/api/erp/purchases/lane?${qs.toString()}`);
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
  useEffect(() => { void load(); }, [load]);

  const openDetail = useCallback(async (id: string) => {
    setError(null);
    try {
      setDetail(await apiGet<Detail>(`/api/erp/purchases/lane/${id}`));
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }, []);

  useEffect(() => {
    if (deepDone || loading) return;
    setDeepDone(true);
    const present = deep.laneIds.filter((id) => rows.some((r) => r.id === id));
    if (deep.action === "transfer" && present.length) { setSelected(new Set(present)); setTransferIds(present); }
    else if (deep.focus) void openDetail(deep.focus);
  }, [deepDone, loading, deep, rows, openDetail]);

  const refreshAll = useCallback(async (id?: string) => {
    await load();
    if (id) await openDetail(id);
  }, [load, openDetail]);

  const act = async (id: string, body: Record<string, unknown>, ok: string) => {
    setBusy(true); setError(null); setNotice(null);
    try {
      await apiPatch(`/api/erp/purchases/lane/${id}`, body);
      setNotice(ok);
      await refreshAll(detail?.load.id === id ? id : undefined);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  };

  const untransferred = useMemo(() => rows.filter((r) => r.lane_status === "loaded" && r.owner_type === "branch" && (r.leg_no ?? 1) <= 1), [rows]);
  const toggle = (id: string) => setSelected((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const nextAction = (r: Row) => {
    if (r.lane_status === "transfer_pending") return { label: T("act_accept", "Accept transfer"), run: () => act(r.id, { action: "accept" }, T("done_accepted", "Transfer accepted.")) };
    if (canChooseDisposition(r.lane_status)) return { label: T("act_dispose", "Choose final disposition"), run: () => openDetail(r.id) };
    const nx = allowedNextStatuses(r.lane_status)[0];
    if (nx) return { label: `${T("act_mark", "Mark")} ${stLabel(nx)}`, run: () => act(r.id, { action: "status", to: nx }, T("done_status", "Status updated.")) };
    return null;
  };

  return (
    <section dir={s.dir} className="min-h-screen bg-slate-50 pb-16 text-slate-900 dark:bg-slate-950 dark:text-slate-50" data-testid="lane-page">
      <div className="mx-auto max-w-[1500px] space-y-3 px-3 py-4 sm:px-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-lg font-black"><Truck className="h-5 w-5 text-blue-600" />{T("title", "Purchase Transit & Lane")}</h1>
            <p className="mt-0.5 text-xs text-slate-500">{T("subtitle", "Every loaded container, from loading to final disposition — for Purchase Booking and Local Purchase.")}</p>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <select value={sourceType} onChange={(e) => setSourceType(e.target.value)} className={`${inputCls} !w-auto min-w-0 max-w-full flex-1 sm:flex-none`} aria-label={T("source", "Source")} data-testid="lane-source">
              <option value="">{T("src_all", "Purchase Booking & Local Purchase")}</option>
              <option value="purchase_booking">{T("src_booking", "Purchase Booking")}</option>
              <option value="local_purchase">{T("src_local", "Local Purchase")}</option>
            </select>
            <button type="button" onClick={() => void load()} className={`${btnCls} border border-slate-300 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200`} data-testid="lane-refresh"><RefreshCw className="h-3.5 w-3.5" />{T("refresh", "Refresh")}</button>
          </div>
        </header>

        {/* status chips */}
        <div className="flex flex-wrap gap-1.5" data-testid="lane-chips">
          <button type="button" onClick={() => setStatus("")} className={`${btnCls} ${status === "" ? "bg-blue-600 text-white" : "border border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"}`}>{T("all", "All")} ({rows.length})</button>
          {LANE_STATUSES.map((st) => (
            <button key={st} type="button" onClick={() => setStatus(status === st ? "" : st)} data-testid={`chip-${st}`}
              className={`${btnCls} ${status === st ? "bg-blue-600 text-white" : "border border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"}`}>
              {stLabel(st)} <span className="rounded-full bg-black/10 px-1.5 text-[10px]">{summary[st] ?? 0}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 dark:border-slate-700 dark:bg-slate-900">
            <Search className="h-3.5 w-3.5 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void load()} placeholder={T("search_ph", "Search purchase no., container, BL, supplier, goods…")} className="w-full bg-transparent py-1.5 text-xs font-semibold outline-none" data-testid="lane-search" />
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold text-slate-600 dark:text-slate-300">
            <span data-testid="lane-stock">{T("lane_stock", "Quantity in lane")}: {laneStock.toLocaleString()}</span>
            <button type="button" disabled={selected.size === 0} onClick={() => setTransferIds([...selected])} className={`${btnCls} bg-indigo-600 text-white hover:bg-indigo-700`} data-testid="bulk-selected"><ArrowRightLeft className="h-3.5 w-3.5" />{T("act_transfer_selected", "Transfer Selected Containers")} ({selected.size})</button>
            <button type="button" disabled={untransferred.length === 0} onClick={() => setTransferIds(untransferred.map((r) => r.id))} className={`${btnCls} border border-indigo-300 bg-white text-indigo-700 dark:bg-slate-900`} data-testid="bulk-all"><ArrowRightLeft className="h-3.5 w-3.5" />{T("act_transfer_all", "Transfer All Untransferred Loads")} ({untransferred.length})</button>
          </div>
        </div>

        {error && <div className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 dark:border-rose-900 dark:bg-rose-950/30" role="alert" data-testid="lane-error">{error}</div>}
        {notice && <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30" data-testid="lane-notice">{notice}</div>}

        {loading ? (
          <div className="flex justify-center rounded-2xl border border-slate-200 bg-white p-12 dark:border-slate-800 dark:bg-slate-900"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-xs font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-900" data-testid="lane-empty">{T("empty", "No loads in the lane for your scope. A load enters the lane when its loading is saved.")}</div>
        ) : (
          <>
            {/* desktop table */}
            <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white md:block dark:border-slate-800 dark:bg-slate-900">
              <table className="w-full min-w-[1100px] text-start text-xs" data-testid="lane-table">
                <thead className="border-b border-slate-100 bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800">
                  <tr>
                    <Th className="p-2.5" />
                    <Th className="p-2.5 text-start">{T("col_purchase", "Purchase no.")}</Th>
                    <Th className="p-2.5 text-start">{T("col_supplier", "Supplier")}</Th>
                    <Th className="p-2.5 text-start">{T("col_goods", "Goods")}</Th>
                    <Th className="p-2.5 text-start">{T("col_bl", "BL no.")}</Th>
                    <Th className="p-2.5 text-start">{T("col_container", "Container")}</Th>
                    <Th className="p-2.5 text-end">{T("col_qty", "Loaded qty")}</Th>
                    <Th className="p-2.5 text-end">{T("col_weight", "Gross / Net")}</Th>
                    <Th className="p-2.5 text-start">{T("col_status", "Lane status")}</Th>
                    <Th className="p-2.5 text-start">{T("col_location", "Location")}</Th>
                    <Th className="p-2.5 text-start">{T("col_assigned", "Assigned to")}</Th>
                    <Th className="p-2.5 text-start">{T("col_next", "Next action")}</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {rows.map((r) => {
                    const na = nextAction(r);
                    return (
                      <tr key={r.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40" data-testid={`lane-row-${r.container_number || r.id}`}>
                        <td className="p-2.5"><input type="checkbox" checked={selected.has(r.id)} disabled={r.lane_status === "completed"} onChange={() => toggle(r.id)} aria-label={T("select", "Select")} /></td>
                        <td className="p-2.5 font-mono font-bold text-blue-700" dir="ltr">{r.purchase_ref_no || "—"}<div className="text-[10px] font-normal text-slate-400">{r.source_type === "local_purchase" ? T("src_local", "Local Purchase") : T("src_booking", "Purchase Booking")}</div></td>
                        <td className="p-2.5 font-semibold" dir="auto">{r.supplier_name || "—"}</td>
                        <td className="p-2.5" dir="auto">{r.goods_name || "—"}</td>
                        <td className="p-2.5 font-mono" dir="ltr">{r.bl_number || "—"}</td>
                        <td className="p-2.5 font-mono font-bold" dir="ltr">{r.container_number || "—"}</td>
                        <td className="p-2.5 text-end font-mono font-bold">{Number(r.loaded_quantity).toLocaleString()} {r.unit || ""}</td>
                        <td className="p-2.5 text-end font-mono">{r.gross_weight != null ? Number(r.gross_weight).toLocaleString() : "—"} / {r.net_weight != null ? Number(r.net_weight).toLocaleString() : "—"}</td>
                        <td className="p-2.5"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_TONE[r.lane_status] ?? ""}`} data-testid="lane-status">{stLabel(r.lane_status)}</span>{r.leg_no > 1 && <span className="ms-1 text-[10px] text-slate-400">{T("leg", "leg")} {r.leg_no}</span>}</td>
                        <td className="p-2.5" dir="auto">{r.current_location || r.expected_location || "—"}</td>
                        <td className="p-2.5" dir="auto">{ownerLabel(r, T)}</td>
                        <td className="p-2.5">
                          <div className="flex flex-wrap items-center gap-1">
                            {na && <button type="button" disabled={busy} onClick={() => void na.run()} className={`${btnCls} bg-blue-600 text-white hover:bg-blue-700`} data-testid="lane-next">{na.label}</button>}
                            {r.lane_status !== "completed" && <button type="button" onClick={() => setTransferIds([r.id])} className={`${btnCls} border border-indigo-300 text-indigo-700`} data-testid="lane-transfer">{T("act_transfer_load", "Transfer Load")}</button>}
                            <button type="button" onClick={() => void openDetail(r.id)} className={`${btnCls} border border-slate-300 text-slate-700 dark:text-slate-200`} data-testid="lane-details"><ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />{T("act_details", "Details")}</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* mobile cards */}
            <div className="space-y-2 md:hidden" data-testid="lane-cards">
              {rows.map((r) => {
                const na = nextAction(r);
                return (
                  <div key={r.id} className="rounded-xl border border-slate-200 bg-white p-3 text-xs dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex items-start justify-between gap-2">
                      <div><div className="font-mono font-black text-blue-700" dir="ltr">{r.purchase_ref_no || "—"}</div><div className="font-semibold" dir="auto">{r.supplier_name || "—"} · {r.goods_name || "—"}</div></div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_TONE[r.lane_status] ?? ""}`}>{stLabel(r.lane_status)}</span>
                    </div>
                    <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] text-slate-600 dark:text-slate-300">
                      <span>{T("col_bl", "BL no.")}: <b dir="ltr">{r.bl_number || "—"}</b></span>
                      <span>{T("col_container", "Container")}: <b dir="ltr">{r.container_number || "—"}</b></span>
                      <span>{T("col_qty", "Loaded qty")}: <b>{Number(r.loaded_quantity).toLocaleString()} {r.unit || ""}</b></span>
                      <span>{T("col_location", "Location")}: <b dir="auto">{r.current_location || "—"}</b></span>
                      <span className="col-span-2">{T("col_assigned", "Assigned to")}: <b dir="auto">{ownerLabel(r, T)}</b></span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {na && <button type="button" disabled={busy} onClick={() => void na.run()} className={`${btnCls} bg-blue-600 text-white`}>{na.label}</button>}
                      {r.lane_status !== "completed" && <button type="button" onClick={() => setTransferIds([r.id])} className={`${btnCls} border border-indigo-300 text-indigo-700`}>{T("act_transfer_load", "Transfer Load")}</button>}
                      <button type="button" onClick={() => void openDetail(r.id)} className={`${btnCls} border border-slate-300`}>{T("act_details", "Details")}</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {transferIds && <TransferModal T={T} s={s} ids={transferIds} onClose={() => setTransferIds(null)} onDone={async (m) => { setTransferIds(null); setNotice(m); await refreshAll(detail?.load.id); }} setError={setError} />}
      {detail && <DetailDrawer T={T} s={s} stLabel={stLabel} detail={detail} busy={busy} onClose={() => setDetail(null)} onAct={act} onTransfer={() => setTransferIds([detail.load.id])} onChanged={() => refreshAll(detail.load.id)} setError={setError} setNotice={setNotice} />}
    </section>
  );
}

function ownerLabel(r: Row, T: (k: string, fb: string) => string) {
  if (r.owner_type === "external_agent") return `${T("own_ext_agent", "External agent")}: ${r.owner_agent_name || "—"}`;
  if (r.owner_type === "internal_agent") return `${T("own_int_agent", "Internal agent")}: ${r.owner_agent_name || "—"}`;
  if (r.owner_type === "user" || r.owner_type === "self") return `${r.owner_user_name || "—"}`;
  return [r.owner_country_branch_name, r.owner_city_branch_name].filter(Boolean).join(" / ") || T("own_origin", "Loading branch");
}

// ───────────────────────────────── transfer modal ─────────────────────────────────

function TransferModal({ T, s, ids, onClose, onDone, setError }: { T: (k: string, fb: string) => string; s: any; ids: string[]; onClose: () => void; onDone: (msg: string) => Promise<void>; setError: (m: string | null) => void }) {
  const [type, setType] = useState<TransferType>("other_branch");
  const [countryId, setCountryId] = useState("");
  const [countryBranchId, setCountryBranchId] = useState("");
  const [cityBranchId, setCityBranchId] = useState("");
  const [agentId, setAgentId] = useState("");
  const [agentName, setAgentName] = useState("");
  const [userId, setUserId] = useState("");
  const [expectedLocation, setExpectedLocation] = useState("");
  const [responsibility, setResponsibility] = useState("");
  const [note, setNote] = useState("");
  const [countries, setCountries] = useState<Row[]>([]);
  const [mains, setMains] = useState<Row[]>([]);
  const [cities, setCities] = useState<Row[]>([]);
  const [agents, setAgents] = useState<Row[]>([]);
  const [users, setUsers] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);

  useEffect(() => { apiGet<{ countries: Row[] }>("/api/branch-management/countries").then((r) => setCountries(r.countries ?? [])).catch(() => undefined); }, []);
  useEffect(() => {
    setMains([]); setCountryBranchId(""); setCities([]); setCityBranchId("");
    if (countryId) apiGet<{ countryBranches: Row[] }>(`/api/branch-management/country-branches?countryId=${countryId}`).then((r) => setMains(r.countryBranches ?? [])).catch(() => undefined);
  }, [countryId]);
  useEffect(() => {
    setCities([]); setCityBranchId("");
    if (countryBranchId) apiGet<{ cityBranches: Row[] }>(`/api/branch-management/city-branches?countryBranchId=${countryBranchId}`).then((r) => setCities(r.cityBranches ?? [])).catch(() => undefined);
  }, [countryBranchId]);
  useEffect(() => {
    if (type === "internal_agent" || type === "external_agent") apiGet<{ clearingAgents: Row[] }>("/api/erp/clearing-agents?limit=200").then((r) => setAgents(r.clearingAgents ?? [])).catch(() => undefined);
    if (type === "other_user") apiGet<{ users: Row[] }>("/api/erp/users/eligible-assignees").then((r) => setUsers(r.users ?? [])).catch(() => undefined);
  }, [type]);

  const req = { type, countryId: countryId || null, countryBranchId: countryBranchId || null, cityBranchId: cityBranchId || null, agentId: agentId || null, agentName: agentName || null, userId: userId || null, expectedLocation, responsibility, note: note || null };
  const submit = async () => {
    const p = transferProblems(req);
    setProblems(p);
    if (p.length) return;
    setBusy(true); setError(null);
    try {
      await apiPost("/api/erp/purchases/lane", { action: "transfer", ids, transfer: req });
      await onDone(`${T("done_transferred", "Transferred")} (${ids.length})`);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  };
  const bad = (k: string) => problems.includes(k);
  const lbl = (t: string) => <label className="mb-1 block text-[11px] font-bold text-slate-600 dark:text-slate-300">{t}</label>;
  const typeLabel: Record<TransferType, string> = {
    own_branch: T("tt_own_branch", "Own branch"), other_branch: T("tt_other_branch", "Another country or city branch"),
    internal_agent: T("tt_internal_agent", "Internal clearing agent"), external_agent: T("tt_external_agent", "External clearing agent / logistics partner"),
    other_user: T("tt_other_user", "Another authorised user"), self_managed: T("tt_self", "Self-managed clearance"),
  };
  const respLabel: Record<string, string> = { custody: T("resp_custody", "Custody of the load"), transport: T("resp_transport", "Transport"), customs_clearance: T("resp_customs", "Customs clearance"), full_handling: T("resp_full", "Full handling") };

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-3" role="dialog" aria-modal="true" dir={s.dir} data-testid="transfer-modal">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-4 shadow-2xl sm:rounded-2xl dark:bg-slate-900">
        <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-black">{T("transfer_title", "Transfer load")} ({ids.length})</h3><button type="button" onClick={onClose} aria-label={T("close", "Close")}><X className="h-4 w-4" /></button></div>
        <p className="mb-3 text-[11px] text-slate-500">{T("transfer_hint", "Moving a load only changes who holds it. It creates no stock, no sale and no ledger entry — and is recorded in the audit history.")}</p>
        <div className="space-y-2.5">
          <div>{lbl(T("transfer_to", "Transfer to"))}
            <select value={type} onChange={(e) => setType(e.target.value as TransferType)} className={inputCls} data-testid="tr-type">{TRANSFER_TYPES.map((t) => <option key={t} value={t}>{typeLabel[t]}</option>)}</select>
          </div>
          {(type === "own_branch" || type === "other_branch" || type === "internal_agent" || type === "external_agent") && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div>{lbl(T("country", "Country"))}<select value={countryId} onChange={(e) => setCountryId(e.target.value)} className={`${inputCls} ${bad("country") ? "!border-rose-400" : ""}`} data-testid="tr-country"><option value="">—</option>{countries.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
              <div>{lbl(T("main_branch", "Main branch"))}<select value={countryBranchId} onChange={(e) => setCountryBranchId(e.target.value)} className={`${inputCls} ${bad("branch") ? "!border-rose-400" : ""}`} disabled={!countryId} data-testid="tr-main"><option value="">—</option>{mains.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
              <div>{lbl(T("city_branch", "City branch"))}<select value={cityBranchId} onChange={(e) => setCityBranchId(e.target.value)} className={inputCls} disabled={!countryBranchId} data-testid="tr-city"><option value="">—</option>{cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            </div>
          )}
          {(type === "internal_agent" || type === "external_agent") && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div>{lbl(T("agent", "Agent"))}<select value={agentId} onChange={(e) => setAgentId(e.target.value)} className={`${inputCls} ${bad("agent") && !agentName ? "!border-rose-400" : ""}`} data-testid="tr-agent"><option value="">—</option>{agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
              {type === "external_agent" && <div>{lbl(T("agent_name", "Or type the partner's name"))}<input value={agentName} onChange={(e) => setAgentName(e.target.value)} className={inputCls} data-testid="tr-agent-name" /></div>}
            </div>
          )}
          {type === "other_user" && (
            <div>{lbl(T("user", "User"))}<select value={userId} onChange={(e) => setUserId(e.target.value)} className={`${inputCls} ${bad("user") ? "!border-rose-400" : ""}`} data-testid="tr-user"><option value="">—</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}{u.role ? ` · ${u.role}` : ""}</option>)}</select></div>
          )}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>{lbl(T("expected_location", "Expected location") + (type === "self_managed" ? "" : " *"))}<input value={expectedLocation} onChange={(e) => setExpectedLocation(e.target.value)} className={`${inputCls} ${bad("expectedLocation") ? "!border-rose-400" : ""}`} data-testid="tr-location" dir="auto" /></div>
            <div>{lbl(T("responsibility", "Responsibility") + " *")}<select value={responsibility} onChange={(e) => setResponsibility(e.target.value)} className={`${inputCls} ${bad("responsibility") ? "!border-rose-400" : ""}`} data-testid="tr-resp"><option value="">—</option>{RESPONSIBILITIES.map((r) => <option key={r} value={r}>{respLabel[r]}</option>)}</select></div>
          </div>
          <div>{lbl(T("note", "Note"))}<textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className={inputCls} /></div>
          {problems.length > 0 && <p className="text-[11px] font-bold text-rose-600" data-testid="tr-problems">{T("fill_required", "Complete the required fields")}: {problems.join(", ")}</p>}
        </div>
        <div className="mt-4 flex justify-end gap-2 pb-20 sm:pb-0">
          <button type="button" onClick={onClose} className={`${btnCls} border border-slate-300`}>{T("cancel", "Cancel")}</button>
          <button type="button" disabled={busy} onClick={() => void submit()} className={`${btnCls} bg-indigo-600 text-white hover:bg-indigo-700`} data-testid="tr-submit">{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRightLeft className="h-3.5 w-3.5" />}{T("confirm_transfer", "Confirm transfer")}</button>
        </div>
      </div>
    </div>
  );
}

// ───────────────────────────────── detail drawer ─────────────────────────────────

function DetailDrawer({ T, s, stLabel, detail, busy, onClose, onAct, onTransfer, onChanged, setError, setNotice }: {
  T: (k: string, fb: string) => string; s: any; stLabel: (st: string) => string; detail: Detail; busy: boolean;
  onClose: () => void; onAct: (id: string, body: Record<string, unknown>, ok: string) => Promise<void>; onTransfer: () => void; onChanged: () => Promise<void>;
  setError: (m: string | null) => void; setNotice: (m: string | null) => void;
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

  useEffect(() => { if (canDispose) apiGet<{ warehouses: Row[] }>("/api/erp/warehouses?limit=500").then((r) => setWarehouses(r.warehouses ?? [])).catch(() => undefined); }, [canDispose]);
  useEffect(() => { if (needGoods) apiGet<{ goods: Row[] }>("/api/erp/goods?limit=300").then((r) => setGoods(r.goods ?? [])).catch(() => undefined); }, [needGoods]);

  const dispose = async () => {
    setLocal(true); setError(null);
    try {
      await apiPatch(`/api/erp/purchases/lane/${l.id}`, { action: "disposition", kind, warehouseId: warehouseId || null, goodsId: goodsId || null, nextDestination: nextDestination || null, note: note || null });
      setNotice(T("done_disposed", "Final disposition confirmed."));
      await onChanged();
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      if (/goods item/i.test(m)) setNeedGoods(true);
      setError(m);
    } finally { setLocal(false); }
  };

  // expenses
  const [exType, setExType] = useState("customs");
  const [exAmount, setExAmount] = useState("");
  const [exCur, setExCur] = useState("USD");
  const [exDesc, setExDesc] = useState("");
  const [exPayee, setExPayee] = useState("external_agent");
  const [exName, setExName] = useState("");
  const addExpense = async () => {
    setLocal(true); setError(null);
    try {
      await apiPost(`/api/erp/purchases/lane/${l.id}/expenses`, { expenseType: exType, amount: Number(exAmount), currency: exCur, description: exDesc || null, payeeType: exPayee, payeeName: exName || null });
      setExAmount(""); setExDesc("");
      setNotice(T("done_expense_added", "Expense added as a draft."));
      await onChanged();
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setLocal(false); }
  };
  const advance = async (expenseId: string, action: "review" | "confirm" | "cancel") => {
    setLocal(true); setError(null);
    try {
      const res = await apiPatch<{ result?: { settlement?: string; billExpenseLineId?: string | null; registerMissing?: boolean } }>(`/api/erp/purchases/lane/${l.id}/expenses`, { expenseId, action });
      const r = res?.result;
      if (action === "confirm" && r?.settlement === "agent_payable") setNotice(r.billExpenseLineId ? T("done_confirm_line", "Confirmed. An unposted agent bill line was added to Bill Expenses.") : T("done_confirm_noregister", "Confirmed. This booking has no Bill Expenses register yet, so no bill line was created — add the agent bill there."));
      await onChanged();
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setLocal(false); }
  };
  const kv = (k: string, v: React.ReactNode) => <div><dt className="text-[10px] font-bold uppercase text-slate-400">{k}</dt><dd className="font-semibold" dir="auto">{v ?? "—"}</dd></div>;
  const dispLabel: Record<string, string> = { warehouse: T("disp_warehouse", "Send to Warehouse"), re_export: T("disp_re_export", "Re-export"), sale_delivery: T("disp_sale", "Sell / Deliver"), continue_transit: T("disp_continue", "Continue Transit"), hold: T("disp_hold", "Hold at Current Location") };
  const exTypes = ["transport", "port", "customs", "clearing", "detention", "handling", "other"];

  return (
    <div className="fixed inset-0 z-[80] flex justify-end bg-slate-900/40" role="dialog" aria-modal="true" dir={s.dir} data-testid="lane-detail">
      <div className="h-full w-full max-w-xl overflow-y-auto bg-white p-4 shadow-2xl dark:bg-slate-900">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div><h3 className="text-sm font-black">{l.purchase_ref_no} · <span dir="ltr">{l.container_number || l.bl_number || "—"}</span></h3><span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_TONE[l.lane_status] ?? ""}`} data-testid="detail-status">{stLabel(l.lane_status)}</span></div>
          <button type="button" onClick={onClose} aria-label={T("close", "Close")}><X className="h-4 w-4" /></button>
        </div>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
          {kv(T("col_supplier", "Supplier"), l.supplier_name)}{kv(T("col_goods", "Goods"), l.goods_name)}
          {kv(T("col_bl", "BL no."), <span dir="ltr">{l.bl_number}</span>)}{kv(T("col_container", "Container"), <span dir="ltr">{l.container_number}</span>)}
          {kv(T("col_qty", "Loaded qty"), `${Number(l.loaded_quantity).toLocaleString()} ${l.unit || ""}`)}{kv(T("lane_stock_one", "Quantity in lane"), Number(l.lane_stock_qty).toLocaleString())}
          {kv(T("col_weight", "Gross / Net"), `${l.gross_weight ?? "—"} / ${l.net_weight ?? "—"}`)}{kv(T("route", "Origin → Destination"), `${l.origin_text || "—"} → ${l.destination_text || "—"}`)}
          {kv(T("col_location", "Location"), l.current_location)}{kv(T("expected_location", "Expected location"), l.expected_location)}
          {kv(T("col_assigned", "Assigned to"), ownerLabel(l, T))}{kv(T("responsibility", "Responsibility"), l.responsibility)}
          {l.disposition && kv(T("final_disposition", "Final disposition"), dispLabel[l.disposition] ?? l.disposition)}
        </dl>
        {!detail.canAct && <p className="mt-3 rounded-lg bg-slate-100 p-2 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300" data-testid="readonly-note">{T("read_only", "You can view this load but you are not its current holder, so you cannot change it.")}</p>}

        {detail.canAct && l.lane_status !== "completed" && (
          <div className="mt-4 flex flex-wrap gap-1.5" data-testid="detail-actions">
            {l.lane_status === "transfer_pending" && <button type="button" disabled={busy} onClick={() => void onAct(l.id, { action: "accept" }, T("done_accepted", "Transfer accepted."))} className={`${btnCls} bg-emerald-600 text-white`} data-testid="d-accept"><Check className="h-3.5 w-3.5" />{T("act_accept", "Accept transfer")}</button>}
            {allowedNextStatuses(l.lane_status).map((nx) => <button key={nx} type="button" disabled={busy} onClick={() => void onAct(l.id, { action: "status", to: nx }, T("done_status", "Status updated."))} className={`${btnCls} bg-blue-600 text-white`} data-testid={`d-to-${nx}`}>{T("act_mark", "Mark")} {stLabel(nx)}</button>)}
            <button type="button" onClick={onTransfer} className={`${btnCls} border border-indigo-300 text-indigo-700`} data-testid="d-transfer"><ArrowRightLeft className="h-3.5 w-3.5" />{T("act_transfer_load", "Transfer Load")}</button>
          </div>
        )}

        {canDispose && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50/50 p-3 dark:border-rose-900 dark:bg-rose-950/20" data-testid="disposition-panel">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-black"><PackageCheck className="h-4 w-4 text-rose-600" />{T("disp_title", "Customs cleared — what happens to this load?")}</p>
            <div className="space-y-1.5">
              {(["warehouse", "re_export", "sale_delivery", "continue_transit", "hold"] as Disposition[]).map((d) => (
                <label key={d} className="flex items-center gap-2 text-xs font-semibold"><input type="radio" name="disp" checked={kind === d} onChange={() => setKind(d)} data-testid={`disp-${d}`} />{dispLabel[d]}</label>
              ))}
            </div>
            {kind === "warehouse" && (
              <div className="mt-2 space-y-2">
                <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className={inputCls} data-testid="disp-warehouse-select"><option value="">{T("pick_warehouse", "— Select warehouse —")}</option>{warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}{w.code ? ` (${w.code})` : ""}</option>)}</select>
                {needGoods && <select value={goodsId} onChange={(e) => setGoodsId(e.target.value)} className={inputCls} data-testid="disp-goods-select"><option value="">{T("pick_goods", "— Select the goods item —")}</option>{goods.map((g) => <option key={g.id} value={g.id}>{g.goods_name ?? g.name}</option>)}</select>}
                <p className="text-[10.5px] text-slate-500">{T("disp_warehouse_hint", "Lane stock is reduced and the selected warehouse stock is increased — once.")}</p>
              </div>
            )}
            {kind === "continue_transit" && <input value={nextDestination} onChange={(e) => setNextDestination(e.target.value)} placeholder={T("next_destination", "Next destination of the new route leg")} className={`${inputCls} mt-2`} data-testid="disp-next" dir="auto" />}
            {kind === "sale_delivery" && <p className="mt-2 text-[10.5px] text-slate-500">{T("disp_sale_hint", "The load leaves the lane. No revenue is created here — the sale completes in Sales / Delivery.")}</p>}
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={T("note", "Note")} className={`${inputCls} mt-2`} />
            <button type="button" disabled={local || busy} onClick={() => void dispose()} className={`${btnCls} mt-2 bg-rose-600 text-white hover:bg-rose-700`} data-testid="disp-confirm">{local ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}{T("disp_confirm", "Confirm final disposition")}</button>
          </div>
        )}

        {/* expenses */}
        <div className="mt-5" data-testid="expenses">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-black"><ClipboardList className="h-4 w-4 text-blue-600" />{T("expenses", "Expenses on this load")}</p>
          <p className="mb-2 text-[10.5px] text-slate-500">{T("expenses_hint", "Linked to Purchase → Loading → BL → Container → Lane → Agent/Branch. An internal branch is settled between branches (not a sale); an agent's payable bill line is created only after you review and confirm.")}</p>
          {detail.expenses.length === 0 ? <p className="text-[11px] text-slate-400">{T("no_expenses", "No expenses yet.")}</p> : (
            <ul className="space-y-1.5">
              {detail.expenses.map((e) => (
                <li key={e.id} className="rounded-lg border border-slate-200 p-2 text-[11px] dark:border-slate-700" data-testid={`expense-${e.status}`}>
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <span className="font-bold">{T("ex_" + e.expense_type, e.expense_type)} · <span dir="ltr">{Number(e.amount).toLocaleString()} {e.currency}</span></span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold dark:bg-slate-800">{T("exs_" + e.status, e.status)}</span>
                  </div>
                  <div className="text-slate-500" dir="auto">{e.payee_name || e.payee_type} · {e.settlement === "inter_branch" ? T("settle_inter", "inter-branch settlement") : e.settlement === "agent_payable" ? T("settle_agent", "agent payable") : T("settle_none", "no settlement")}{e.bill_expense_line_id ? ` · ${T("bill_line", "bill line created (unposted)")}` : ""}</div>
                  {detail.canAct && (
                    <div className="mt-1 flex gap-1.5">
                      {e.status === "draft" && <button type="button" disabled={local} onClick={() => void advance(e.id, "review")} className={`${btnCls} border border-slate-300`} data-testid="ex-review">{T("ex_review", "Review")}</button>}
                      {e.status === "reviewed" && <button type="button" disabled={local} onClick={() => void advance(e.id, "confirm")} className={`${btnCls} bg-emerald-600 text-white`} data-testid="ex-confirm">{T("ex_confirm", "Confirm")}</button>}
                      {(e.status === "draft" || e.status === "reviewed") && <button type="button" disabled={local} onClick={() => void advance(e.id, "cancel")} className={`${btnCls} border border-rose-300 text-rose-700`}>{T("cancel", "Cancel")}</button>}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          {detail.canAct && l.lane_status !== "completed" && (
            <div className="mt-2 grid grid-cols-2 gap-2 rounded-lg border border-dashed border-slate-300 p-2 dark:border-slate-700" data-testid="expense-form">
              <select value={exType} onChange={(e) => setExType(e.target.value)} className={inputCls} data-testid="ex-type">{exTypes.map((t) => <option key={t} value={t}>{T("ex_" + t, t)}</option>)}</select>
              <select value={exPayee} onChange={(e) => setExPayee(e.target.value)} className={inputCls} data-testid="ex-payee">
                <option value="external_agent">{T("tt_external_agent", "External clearing agent / logistics partner")}</option>
                <option value="internal_agent">{T("tt_internal_agent", "Internal clearing agent")}</option>
                <option value="internal_branch">{T("payee_branch", "Internal branch (inter-branch settlement)")}</option>
                <option value="other">{T("payee_other", "Other")}</option>
              </select>
              <input value={exAmount} onChange={(e) => setExAmount(e.target.value)} inputMode="decimal" placeholder={T("amount", "Amount")} className={inputCls} data-testid="ex-amount" dir="ltr" />
              <input value={exCur} onChange={(e) => setExCur(e.target.value.toUpperCase().slice(0, 3))} placeholder="USD" className={inputCls} data-testid="ex-cur" dir="ltr" />
              <input value={exName} onChange={(e) => setExName(e.target.value)} placeholder={T("payee_name", "Payee name")} className={inputCls} data-testid="ex-name" dir="auto" />
              <input value={exDesc} onChange={(e) => setExDesc(e.target.value)} placeholder={T("description", "Description")} className={inputCls} dir="auto" />
              <button type="button" disabled={local || !exAmount} onClick={() => void addExpense()} className={`${btnCls} col-span-2 justify-center bg-blue-600 text-white`} data-testid="ex-add">{T("add_expense", "Add expense (draft)")}</button>
            </div>
          )}
        </div>

        {/* audit history */}
        <div className="mt-5" data-testid="history">
          <p className="mb-2 text-xs font-black">{T("history", "Audit history")}</p>
          <ol className="space-y-1.5 border-s border-slate-200 ps-3 dark:border-slate-700">
            {detail.events.map((ev) => (
              <li key={ev.id} className="text-[11px]" data-testid="history-item">
                <b>{T("ev_" + ev.event_type, ev.event_type)}</b>{ev.from_status || ev.to_status ? ` · ${ev.from_status ? stLabel(ev.from_status) : "—"} → ${ev.to_status ? stLabel(ev.to_status) : "—"}` : ""}
                <div className="text-slate-400"><span dir="ltr">{new Date(ev.created_at).toLocaleString()}</span> · {ev.actor_name || "—"}</div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
