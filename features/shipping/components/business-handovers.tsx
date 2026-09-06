"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Loader2,
  Send,
  RefreshCw,
  Ban,
  Plus,
  X,
  Ship,
  Search,
  CheckCircle2,
  Clock,
  Building2,
  FileText,
  ShieldCheck,
  Globe2,
  Layers,
  ArrowRight,
  Filter
} from "lucide-react";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { apiGet, apiPost, apiPatch } from "@/lib/api/client";
import { cn } from "@/lib/utils";

type Row = Record<string, any>;

const STATUS_CONFIG: Record<string, { label: string; tone: string }> = {
  submitted: {
    label: "Submitted",
    tone: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
  },
  accepted: {
    label: "Accepted",
    tone: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
  },
  rejected: {
    label: "Rejected",
    tone: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800"
  },
  cancelled: {
    label: "Cancelled",
    tone: "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
  },
  draft: {
    label: "Draft",
    tone: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800"
  }
};

const INP = "h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:focus:ring-blue-950";

/**
 * Business side — create and monitor controlled handovers of a Purchase / Sales
 * record into the Shipping / Clearing system. The controlled link carries only
 * a whitelisted operational payload — never internal money.
 */
export function BusinessHandovers({ lang }: { lang?: string }) {
  const s = useErpScreen("dintake", lang);
  const [rows, setRows] = useState<Row[]>([]);
  const [agents, setAgents] = useState<Row[]>([]);
  const [pos, setPos] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [h, a, p] = await Promise.all([
        apiGet<{ rows: Row[] }>("/api/erp/handovers"),
        apiGet<{ rows?: Row[]; data?: Row[] }>("/api/erp/clearing-agents").catch(() => ({ rows: [] })),
        apiGet<{ rows?: Row[]; data?: Row[]; orders?: Row[] }>("/api/erp/purchases/orders?limit=50").catch(() => ({ rows: [] }))
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

  useEffect(() => {
    void load();
  }, [load]);

  const cancel = async (id: string) => {
    if (!window.confirm(s.t("bh_cancel_confirm", "Cancel this handover?"))) return;
    try {
      await apiPatch(`/api/erp/handovers/${id}`, { action: "cancel" });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const agentName = agents.find((a) => a.id === r.clearing_agent_id)?.name ?? "";
      return (
        String(r.handover_no || "").toLowerCase().includes(q) ||
        String(r.business_reference_no || "").toLowerCase().includes(q) ||
        String(r.contract_reference || "").toLowerCase().includes(q) ||
        String(r.action_type || "").toLowerCase().includes(q) ||
        agentName.toLowerCase().includes(q) ||
        String(r.status || "").toLowerCase().includes(q)
      );
    });
  }, [rows, statusFilter, searchQuery, agents]);

  const stats = useMemo(() => {
    const total = rows.length;
    const accepted = rows.filter((r) => r.status === "accepted").length;
    const submitted = rows.filter((r) => r.status === "submitted").length;
    const active = accepted + submitted;
    return {
      total,
      active,
      agentsCount: agents.length,
      ordersCount: pos.length
    };
  }, [rows, agents, pos]);

  return (
    <section dir={s.dir} className="min-h-screen bg-[#f8fbff] dark:bg-slate-950 p-4 sm:p-6 lg:p-8 text-slate-900 dark:text-slate-100">
      <div className="mx-auto max-w-7xl space-y-5">
        
        {/* ── 1. HIGH-TECH HERO BANNER (Global ERP Style) ── */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#070e28] via-[#0c1a45] to-[#11276b] text-white p-6 sm:p-8 shadow-xl border border-blue-900/40">
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="max-w-2xl space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black tracking-[0.25em] text-cyan-400 uppercase">
                  SHIPPING & CLEARING WORKFLOW
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white flex items-center gap-3">
                <span>{s.t("bh_title", "Business — Shipping Handovers")}</span>
              </h1>
              <p className="text-sm font-bold text-cyan-200/90">
                Controlled logistics handover. Full operational security.
              </p>
              <p className="text-xs text-slate-300/80 leading-relaxed pt-0.5">
                {s.t(
                  "bh_blurb",
                  "Authorise a Purchase / Sales record into the Shipping / Clearing workflow. Only operational information is shared — never price, profit or ledgers."
                )}
              </p>
            </div>

            {/* Right side: Quote card + 3D Cyber Earth graphic */}
            <div className="flex items-center gap-4">
              <div className="hidden sm:block rounded-xl border border-cyan-500/20 bg-slate-900/60 backdrop-blur-md p-4 text-xs shadow-lg max-w-[210px]">
                <div className="text-cyan-400 font-serif text-lg leading-none mb-1">“</div>
                <p className="font-bold text-white leading-snug">
                  Controlled Trade<br />Zero Leakage<br /><span className="text-cyan-300 font-normal">Infinite Visibility</span>
                </p>
              </div>
              <div className="relative w-32 h-32 sm:w-36 sm:h-36 shrink-0 rounded-full overflow-hidden shadow-2xl border border-cyan-400/30">
                <img
                  src="/images/cyber_earth_globe.jpg"
                  alt="Global Shipping Workflow"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-radial from-transparent via-transparent to-[#070e28]/70" />
              </div>
            </div>
          </div>
        </div>

        {/* ── 2. EXECUTIVE KPI SUMMARY CARDS ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Card 1: Total Handovers */}
          <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <span className="text-[11px] font-black uppercase tracking-wider text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5" />
                1. TOTAL HANDOVERS
              </span>
              <span className="text-[10px] font-bold text-slate-400">All Records</span>
            </div>
            <div className="pt-3 flex items-baseline justify-between">
              <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">{stats.total}</span>
              <span className="text-xs font-semibold text-slate-500">Recorded</span>
            </div>
          </div>

          {/* Card 2: Active Clearances */}
          <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <span className="text-[11px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" />
                2. ACTIVE CLEARANCES
              </span>
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full dark:bg-emerald-950/50">Active</span>
            </div>
            <div className="pt-3 flex items-baseline justify-between">
              <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">{stats.active}</span>
              <span className="text-xs font-semibold text-slate-500">In Progress</span>
            </div>
          </div>

          {/* Card 3: Clearing Agents */}
          <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <span className="text-[11px] font-black uppercase tracking-wider text-purple-700 dark:text-purple-400 flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5" />
                3. CLEARING AGENTS
              </span>
              <span className="text-[10px] font-bold text-slate-400">Network</span>
            </div>
            <div className="pt-3 flex items-baseline justify-between">
              <span className="text-2xl font-black text-purple-600 dark:text-purple-400 font-mono">{stats.agentsCount}</span>
              <span className="text-xs font-semibold text-slate-500">Registered</span>
            </div>
          </div>

          {/* Card 4: Linked Purchase Orders */}
          <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <span className="text-[11px] font-black uppercase tracking-wider text-orange-700 dark:text-orange-400 flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                4. PO / SO PIPELINE
              </span>
              <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full dark:bg-orange-950/50">Pipeline</span>
            </div>
            <div className="pt-3 flex items-baseline justify-between">
              <span className="text-2xl font-black text-orange-600 dark:text-orange-400 font-mono">{stats.ordersCount}</span>
              <span className="text-xs font-semibold text-slate-500">Available</span>
            </div>
          </div>
        </div>

        {/* ── 3. FLOATING TOOLBAR & CONTROLS STRIP ── */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white px-4 py-2.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Live Search Input */}
            <div className="relative min-w-[220px] sm:min-w-[280px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search handovers, records, agents, status..."
                className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-9 pr-8 text-xs font-semibold outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:focus:bg-slate-950 dark:focus:ring-blue-950"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* Status Filter Dropdown */}
            <div className="flex items-center gap-1.5">
              <Filter className="h-3.5 w-3.5 text-slate-400 hidden sm:block" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-9 rounded-xl border border-slate-200 bg-slate-50/70 px-3 text-xs font-semibold text-slate-700 outline-none hover:bg-white dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
              >
                <option value="all">All Statuses</option>
                <option value="submitted">Submitted</option>
                <option value="accepted">Accepted</option>
                <option value="rejected">Rejected</option>
                <option value="cancelled">Cancelled</option>
                <option value="draft">Draft</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Refresh Button */}
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 h-9 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition shadow-2xs"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin text-blue-600")} />
              <span>{s.t("refresh", "Refresh")}</span>
            </button>

            {/* New Handover Button */}
            <button
              type="button"
              onClick={() => setShowNew(true)}
              className="inline-flex items-center gap-2 h-9 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 text-xs font-black text-white hover:from-emerald-500 hover:to-teal-500 shadow-sm transition"
            >
              <Plus className="h-4 w-4 stroke-[3]" />
              <span>{s.t("bh_new", "New Handover")}</span>
            </button>
          </div>
        </div>

        {error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
            {error}
          </div>
        ) : null}

        {/* ── 4. HANDOVER REGISTRY TABLE CARD ── */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
            <div className="flex items-center gap-2.5">
              <div className="rounded-lg bg-blue-600 p-1.5 text-white shadow-xs">
                <Ship className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                  Handover Registry
                </h3>
                <p className="text-[11px] font-semibold text-slate-400">
                  Controlled operational handover tracking
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {filteredRows.length} {s.t("records_loaded", "Records Loaded")}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800">
                <tr className="[&>th]:px-4 [&>th]:py-3 [&>th]:text-start [&>th]:font-black [&>th]:text-slate-600 [&>th]:dark:text-slate-300 [&>th]:uppercase [&>th]:tracking-wider [&>th]:text-[10.5px]">
                  <th>{s.t("bh_c_no", "Handover")}</th>
                  <th>{s.t("bh_c_source", "Business Record")}</th>
                  <th>{s.t("bh_c_action", "Action")}</th>
                  <th>{s.t("bh_c_agent", "Agent")}</th>
                  <th>{s.t("bh_c_status", "Status")}</th>
                  <th className="text-end">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-16 text-center">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                        <span className="text-xs font-bold text-slate-500">Loading handovers...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-16 text-center">
                      <div className="flex flex-col items-center justify-center text-center">
                        <div className="mb-3 rounded-2xl bg-slate-50 p-4 dark:bg-slate-850/60 text-slate-400 border border-slate-200/60 dark:border-slate-800">
                          <svg className="h-10 w-10 stroke-current text-slate-400" viewBox="0 0 24 24" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
                            <path d="m3.3 7 8.7 5 8.7-5" />
                            <path d="M12 22V12" />
                          </svg>
                        </div>
                        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">No handovers found</h4>
                        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500 max-w-sm">
                          {searchQuery || statusFilter !== "all"
                            ? "Try adjusting your search query or status filter."
                            : s.t("bh_empty", "Authorise a Purchase or Sales record to start a shipping handover.")}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((r) => {
                    const statusInfo = STATUS_CONFIG[r.status] || STATUS_CONFIG.draft;
                    const agentName = r.clearing_agent_id ? agents.find((a) => a.id === r.clearing_agent_id)?.name ?? "—" : "—";
                    return (
                      <tr key={r.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-3 font-mono font-extrabold text-blue-700 dark:text-blue-400">
                          {r.handover_no}
                        </td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-200 font-medium">
                          <span className="font-bold">{r.business_reference_no || r.contract_reference || "—"}</span>
                          <span className="ms-1.5 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-black text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                            {r.business_source_module === "sales_orders" ? "SO" : "PO"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300 font-medium">
                          {s.t(`hi_action_${r.action_type}`, r.action_type)}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300 font-medium">
                          {agentName}
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider", statusInfo.tone)}>
                            {s.t(`hi_st_${r.status}`, statusInfo.label)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-end">
                          {["submitted", "draft"].includes(r.status) ? (
                            <button
                              type="button"
                              onClick={() => void cancel(r.id)}
                              className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-[10px] font-bold text-rose-700 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-400 transition"
                              title="Cancel Handover"
                            >
                              <Ban className="h-3 w-3" />
                              <span>Cancel</span>
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-semibold">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── 5. ENTERPRISE FOOTER ── */}
        <footer className="flex flex-wrap items-center justify-between gap-2 pt-2 text-[11px] font-medium text-slate-400">
          <span>© 2026 ERP Global. All rights reserved.</span>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span>Global Operations | Secure Handover | Real-time Audited</span>
          </div>
        </footer>
      </div>

      {showNew ? (
        <NewHandoverDrawer
          s={s}
          agents={agents}
          pos={pos}
          onClose={() => setShowNew(false)}
          onDone={() => {
            setShowNew(false);
            void load();
          }}
        />
      ) : null}
    </section>
  );
}

function NewHandoverDrawer({
  s,
  agents,
  pos,
  onClose,
  onDone
}: {
  s: ReturnType<typeof useErpScreen>;
  agents: Row[];
  pos: Row[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [module, setModule] = useState<"purchase_orders" | "sales_orders">("purchase_orders");
  const [sourceId, setSourceId] = useState("");
  const [actionType, setActionType] = useState("assign_clearing_agent");
  const [agentId, setAgentId] = useState("");
  const [containers, setContainers] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (!sourceId) {
      setErr(s.t("bh_pick_record", "Choose a business record."));
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await apiPost("/api/erp/handovers", {
        actionType,
        businessSourceModule: module,
        businessSourceId: sourceId,
        clearingAgentId: agentId || null,
        containerNumbers: containers ? containers.split(/[,;\n]+/).map((x) => x.trim()).filter(Boolean) : []
      });
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200" onClick={onClose}>
      <div
        dir={s.dir}
        className="h-full w-full max-w-md overflow-y-auto bg-white p-6 shadow-2xl dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b pb-4 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-emerald-600 p-1.5 text-white">
              <Plus className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
                {s.t("bh_new", "New Shipping Handover")}
              </h3>
              <p className="text-[10.5px] font-semibold text-slate-400">
                Authorise PO/SO into Shipping & Clearing
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {err ? (
          <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
            {err}
          </p>
        ) : null}

        <div className="mt-5 space-y-4">
          <L label={s.t("bh_f_module", "Business Domain")}>
            <select
              value={module}
              onChange={(e) => {
                setModule(e.target.value as never);
                setSourceId("");
              }}
              className={INP}
            >
              <option value="purchase_orders">{s.t("bh_purchase", "Purchase Order")}</option>
              <option value="sales_orders">{s.t("bh_sales", "Sales Order")}</option>
            </select>
          </L>

          <L label={s.t("bh_f_record", "Record")}>
            <select
              value={sourceId}
              onChange={(e) => setSourceId(e.target.value)}
              className={INP}
            >
              <option value="">{s.t("bh_choose", "Choose…")}</option>
              {module === "purchase_orders"
                ? pos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.purchase_order_no || p.purchase_contract_no || p.id}
                    </option>
                  ))
                : null}
            </select>
          </L>

          <L label={s.t("bh_f_action", "Handover Action")}>
            <select
              value={actionType}
              onChange={(e) => setActionType(e.target.value)}
              className={INP}
            >
              {["create_shipping_request", "send_to_shipping_line", "assign_clearing_agent", "approve_shipping_handover"].map((a) => (
                <option key={a} value={a}>
                  {s.t(`hi_action_${a}`, a)}
                </option>
              ))}
            </select>
          </L>

          <L label={s.t("bh_f_agent", "Clearing Agent")}>
            <select
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              className={INP}
            >
              <option value="">{s.t("bh_no_agent", "None")}</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </L>

          <L label={s.t("bh_f_containers", "Containers (optional)")}>
            <input
              value={containers}
              onChange={(e) => setContainers(e.target.value)}
              className={INP}
              placeholder={s.t("containers_ph", "MSCU1234567, TGHU7654321")}
            />
          </L>
        </div>

        <div className="mt-6 flex gap-2.5">
          <button
            type="button"
            onClick={() => void submit()}
            disabled={busy}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2.5 text-xs font-black text-white hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 shadow-sm transition"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            <span>{s.t("bh_submit", "Send Handover")}</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 transition"
          >
            {s.t("cancel", "Cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}

function L({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[10.5px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {label}
      </label>
      {children}
    </div>
  );
}
