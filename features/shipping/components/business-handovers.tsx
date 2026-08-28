"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Loader2, Send, RefreshCw, Ban, Plus, X } from "lucide-react";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { apiGet, apiPost, apiPatch } from "@/lib/api/client";

type Row = Record<string, any>;

const TONE: Record<string, string> = {
  submitted: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  accepted: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  rejected: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
  cancelled: "bg-slate-100 text-slate-500 dark:bg-slate-800",
  draft: "bg-slate-100 text-slate-600 dark:bg-slate-800",
};
const INP = "w-full rounded-lg border border-slate-200 bg-transparent px-2.5 py-1.5 text-xs dark:border-slate-700";

/**
 * Business side — create and monitor controlled handovers of a Purchase / Sales
 * record into the Shipping / Clearing system. The controlled link carries only
 * a whitelisted operational payload (see the API) — never internal money.
 */
export function BusinessHandovers({ lang }: { lang?: string }) {
  const s = useErpScreen("dintake", lang);
  const [rows, setRows] = useState<Row[]>([]);
  const [agents, setAgents] = useState<Row[]>([]);
  const [pos, setPos] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [h, a, p] = await Promise.all([
        apiGet<{ rows: Row[] }>("/api/erp/handovers"),
        apiGet<{ rows?: Row[]; data?: Row[] }>("/api/erp/clearing-agents").catch(() => ({ rows: [] })),
        apiGet<{ rows?: Row[]; data?: Row[]; orders?: Row[] }>("/api/erp/purchases/orders?limit=50").catch(() => ({ rows: [] })),
      ]);
      setRows(h.rows ?? []);
      setAgents((a as any).rows ?? (a as any).data ?? []);
      setPos((p as any).rows ?? (p as any).data ?? (p as any).orders ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const cancel = async (id: string) => {
    if (!window.confirm(s.t("bh_cancel_confirm", "Cancel this handover?"))) return;
    try { await apiPatch(`/api/erp/handovers/${id}`, { action: "cancel" }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };

  return (
    <section dir={s.dir} className="min-h-screen bg-slate-50/50 dark:bg-slate-950/50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-screen-xl space-y-4">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className={s.textStart}>
            <h1 className="text-lg font-black text-slate-900 dark:text-slate-50">{s.t("bh_title", "Business → Shipping Handovers")}</h1>
            <p className="mt-0.5 max-w-2xl text-xs text-slate-500">{s.t("bh_blurb", "Authorise a Purchase / Sales record into the Shipping / Clearing workflow. Only operational information is shared — never price, profit or ledgers.")}</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => void load()} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"><RefreshCw className="h-3.5 w-3.5" />{s.t("refresh", "Refresh")}</button>
            <button type="button" onClick={() => setShowNew(true)} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-500"><Plus className="h-3.5 w-3.5" />{s.t("bh_new", "New Handover")}</button>
          </div>
        </header>

        {error ? <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p> : null}

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr className="[&>th]:px-3 [&>th]:py-2.5 [&>th]:text-start [&>th]:font-bold [&>th]:text-slate-500">
                <th>{s.t("bh_c_no", "Handover")}</th>
                <th>{s.t("bh_c_source", "Business Record")}</th>
                <th>{s.t("bh_c_action", "Action")}</th>
                <th>{s.t("bh_c_agent", "Agent")}</th>
                <th>{s.t("bh_c_status", "Status")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-3 py-10 text-center"><Loader2 className="mx-auto h-4 w-4 animate-spin text-slate-400" /></td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={6} className="px-3 py-10 text-center text-xs text-slate-400">{s.t("bh_empty", "No handovers yet.")}</td></tr>
              ) : rows.map((r) => (
                <tr key={r.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-3 py-2 font-mono font-bold text-slate-700 dark:text-slate-200">{r.handover_no}</td>
                  <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{r.business_reference_no || r.contract_reference || "—"}<span className="ms-1 text-[10px] text-slate-400">{r.business_source_module === "sales_orders" ? "SO" : "PO"}</span></td>
                  <td className="px-3 py-2 text-slate-500">{s.t(`hi_action_${r.action_type}`, r.action_type)}</td>
                  <td className="px-3 py-2 text-slate-500">{r.clearing_agent_id ? (agents.find((a) => a.id === r.clearing_agent_id)?.name ?? "—") : "—"}</td>
                  <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${TONE[r.status] || TONE.draft}`}>{s.t(`hi_st_${r.status}`, r.status)}</span></td>
                  <td className="px-3 py-2 text-end">
                    {["submitted", "draft"].includes(r.status) ? (
                      <button type="button" onClick={() => void cancel(r.id)} className="rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-bold text-slate-500 hover:bg-slate-50 dark:border-slate-700"><Ban className="h-3 w-3" /></button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showNew ? (
        <NewHandoverDrawer s={s} agents={agents} pos={pos} onClose={() => setShowNew(false)} onDone={() => { setShowNew(false); void load(); }} />
      ) : null}
    </section>
  );
}

function NewHandoverDrawer({ s, agents, pos, onClose, onDone }: { s: ReturnType<typeof useErpScreen>; agents: Row[]; pos: Row[]; onClose: () => void; onDone: () => void }) {
  const [module, setModule] = useState<"purchase_orders" | "sales_orders">("purchase_orders");
  const [sourceId, setSourceId] = useState("");
  const [actionType, setActionType] = useState("assign_clearing_agent");
  const [agentId, setAgentId] = useState("");
  const [containers, setContainers] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (!sourceId) { setErr(s.t("bh_pick_record", "Choose a business record.")); return; }
    setBusy(true);
    setErr(null);
    try {
      await apiPost("/api/erp/handovers", {
        actionType,
        businessSourceModule: module,
        businessSourceId: sourceId,
        clearingAgentId: agentId || null,
        containerNumbers: containers ? containers.split(/[,;\n]+/).map((x) => x.trim()).filter(Boolean) : [],
      });
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40" onClick={onClose}>
      <div dir={s.dir} className="h-full w-full max-w-md overflow-y-auto bg-white p-5 shadow-2xl dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b pb-3 dark:border-slate-800">
          <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">{s.t("bh_new", "New Handover")}</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button>
        </div>
        {err ? <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{err}</p> : null}
        <div className="mt-4 space-y-3">
          <L label={s.t("bh_f_module", "Business Domain")}>
            <select value={module} onChange={(e) => { setModule(e.target.value as never); setSourceId(""); }} className={INP}>
              <option value="purchase_orders">{s.t("bh_purchase", "Purchase Order")}</option>
              <option value="sales_orders">{s.t("bh_sales", "Sales Order")}</option>
            </select>
          </L>
          <L label={s.t("bh_f_record", "Record")}>
            <select value={sourceId} onChange={(e) => setSourceId(e.target.value)} className={INP}>
              <option value="">{s.t("bh_choose", "Choose…")}</option>
              {module === "purchase_orders" ? pos.map((p) => (
                <option key={p.id} value={p.id}>{p.purchase_order_no || p.purchase_contract_no || p.id}</option>
              )) : null}
            </select>
          </L>
          <L label={s.t("bh_f_action", "Handover Action")}>
            <select value={actionType} onChange={(e) => setActionType(e.target.value)} className={INP}>
              {["create_shipping_request", "send_to_shipping_line", "assign_clearing_agent", "approve_shipping_handover"].map((a) => (
                <option key={a} value={a}>{s.t(`hi_action_${a}`, a)}</option>
              ))}
            </select>
          </L>
          <L label={s.t("bh_f_agent", "Clearing Agent")}>
            <select value={agentId} onChange={(e) => setAgentId(e.target.value)} className={INP}>
              <option value="">{s.t("bh_no_agent", "None")}</option>
              {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </L>
          <L label={s.t("bh_f_containers", "Containers (optional)")}>
            <input value={containers} onChange={(e) => setContainers(e.target.value)} className={INP} placeholder="MSCU1234567, TGHU7654321" />
          </L>
        </div>
        <div className="mt-5 flex gap-2">
          <button type="button" onClick={() => void submit()} disabled={busy} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-3.5 w-3.5" />}{s.t("bh_submit", "Send Handover")}
          </button>
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300">{s.t("cancel", "Cancel")}</button>
        </div>
      </div>
    </div>
  );
}

function L({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</label>
      {children}
    </div>
  );
}
