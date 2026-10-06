"use client";

import { useCallback, useEffect, useState } from "react";
import { Layers, Loader2, RefreshCcw } from "lucide-react";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { apiGet, apiPatch } from "@/lib/api/client";

type Row = Record<string, any>;

/**
 * Partial Container Purchase Workflow panel (spec §11) for the Purchase Loading
 * form. Shows Planned / Loaded / Remaining containers for the selected purchase
 * booking and the AI-proposed loading batches (LOAD-01, LOAD-02 …). Clicking a
 * pending container chip fills the container field — the form still creates the
 * loading record through its normal authorised flow (no duplication).
 */
export function LoadingBatchPanel({
  purchaseOrderId,
  loadedContainerNos = [],
  onPickContainer,
  lang,
}: {
  purchaseOrderId: string | null | undefined;
  loadedContainerNos?: string[];
  onPickContainer?: (containerNo: string) => void;
  lang?: string;
}) {
  const s = useErpScreen("dintake", lang);
  const [data, setData] = useState<{ progress: Row | null; batches: Row[]; loadedContainers: string[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!purchaseOrderId) { setData(null); return; }
    setLoading(true);
    setError(null);
    try {
      const r = await apiGet<{ progress: { progress: Row | null; batches: Row[]; loadedContainers: string[] } | null }>(
        `/api/erp/purchases/loading-batches?purchaseOrderId=${purchaseOrderId}&view=progress`,
      );
      setData(r.progress ? { progress: r.progress.progress, batches: r.progress.batches ?? [], loadedContainers: r.progress.loadedContainers ?? [] } : null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [purchaseOrderId]);
  useEffect(() => { void load(); }, [load]);

  const confirmBatch = async (batchId: string) => {
    setBusy(true);
    setError(null);
    try { await apiPatch("/api/erp/purchases/loading-batches", { action: "confirm", batchId }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  if (!purchaseOrderId) return null;

  const p = data?.progress;
  const alreadyLoaded = new Set([...(data?.loadedContainers ?? []), ...loadedContainerNos].map((c) => c.toUpperCase()));
  const statusLabel = p?.loading_progress_status
    ? s.t(`lp_${p.loading_progress_status}`, String(p.loading_progress_status).replace(/_/g, " "))
    : "—";

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-700 dark:bg-slate-900/40">
      <div className="mb-2 flex items-center justify-between">
        <p className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-slate-500">
          <Layers className="h-3.5 w-3.5" />{s.t("lp_title", "Container Loading Progress")}
        </p>
        <button type="button" onClick={() => void load()} className="rounded p-1 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"><RefreshCcw className="h-3 w-3" /></button>
      </div>

      {error ? <p className="mb-2 rounded bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p> : null}
      {loading ? (
        <div className="py-3 text-center"><Loader2 className="mx-auto h-4 w-4 animate-spin text-slate-400" /></div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 text-center">
            <Stat label={s.t("lp_planned", "Planned")} value={p?.planned_containers ?? "—"} />
            <Stat label={s.t("lp_loaded", "Loaded")} value={p?.loaded_containers ?? 0} tone="text-emerald-600" />
            <Stat label={s.t("lp_remaining", "Remaining")} value={p?.remaining_containers ?? "—"} tone="text-amber-600" />
          </div>
          <p className="mt-1.5 text-center text-[11px] font-bold text-slate-500">
            {s.t("lp_status", "Status")}: <span className="text-slate-700 dark:text-slate-200">{statusLabel}</span>
            {p?.batches ? ` · ${p.batches} ${s.t("lp_batches", "batch(es)")}` : ""}
          </p>

          {(data?.batches ?? []).length ? (
            <div className="mt-3 space-y-2">
              {data!.batches.map((b) => {
                const pending = (b.container_numbers ?? []).filter((c: string) => !alreadyLoaded.has(String(c).toUpperCase()));
                return (
                  <div key={b.id} className="rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900">
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-200">{b.batch_no}</span>
                      <span className="text-[10px] font-bold text-slate-400">
                        {s.t(`lp_bs_${b.status}`, b.status)} · {(b.container_numbers ?? []).length} {s.t("lp_containers", "containers")}
                      </span>
                      {b.status === "proposed" ? (
                        <button type="button" disabled={busy} onClick={() => void confirmBatch(b.id)} className="rounded bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
                          {s.t("lp_confirm", "Confirm Batch")}
                        </button>
                      ) : null}
                    </div>
                    {pending.length ? (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {pending.map((c: string) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => onPickContainer?.(c)}
                            className="rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 font-mono text-[11px] font-bold text-blue-700 hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300"
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-1 text-[10px] text-emerald-600">{s.t("lp_all_loaded", "All containers in this batch are loaded.")}</p>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="mt-2 text-[11px] text-slate-400">{s.t("lp_no_batches", "No AI-proposed loading batches for this booking. Batches are proposed from scanned loading documents in the Document Intake Center.")}</p>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="rounded-lg bg-white p-2 dark:bg-slate-900">
      <div className="text-[9px] font-black uppercase tracking-wider text-slate-400">{label}</div>
      <div className={`text-base font-black ${tone || "text-slate-800 dark:text-slate-100"}`}>{value}</div>
    </div>
  );
}
