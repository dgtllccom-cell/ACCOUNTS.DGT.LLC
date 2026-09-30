/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

/**
 * Real CRM sales pipeline board (New Lead -> Contacted -> Qualified -> Quotation
 * Sent -> Negotiation -> Won/Lost). Reads/writes customer_inquiries.pipeline_stage
 * (migration 20261221_crm_lead_pipeline.sql) — a column separate from `status`
 * (the existing data-entry/confirmation workflow), so this never disturbs any
 * existing Customer Inquiry code. Every move is scope-checked server-side and
 * recorded in customer_inquiry_pipeline_events for a real audit trail.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw, TrendingUp, X } from "lucide-react";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { apiGet, apiPost } from "@/lib/api/client";

type Row = Record<string, any>;
const STAGES = ["new_lead", "contacted", "qualified", "quotation_sent", "negotiation", "won", "lost"] as const;
type Stage = (typeof STAGES)[number];
const OPEN_STAGES: Stage[] = ["new_lead", "contacted", "qualified", "quotation_sent", "negotiation"];
const NEXT_STAGE: Partial<Record<Stage, Stage>> = {
  new_lead: "contacted",
  contacted: "qualified",
  qualified: "quotation_sent",
  quotation_sent: "negotiation",
  negotiation: "won",
};
const STAGE_TONE: Record<Stage, string> = {
  new_lead: "border-slate-300 bg-slate-50 dark:bg-slate-800/60",
  contacted: "border-blue-300 bg-blue-50 dark:bg-blue-950/30",
  qualified: "border-indigo-300 bg-indigo-50 dark:bg-indigo-950/30",
  quotation_sent: "border-amber-300 bg-amber-50 dark:bg-amber-950/30",
  negotiation: "border-orange-300 bg-orange-50 dark:bg-orange-950/30",
  won: "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30",
  lost: "border-rose-300 bg-rose-50 dark:bg-rose-950/30",
};

const INP = "w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 dark:border-slate-700 dark:bg-slate-800";

export function CrmPipelineBoard({ lang }: { lang?: string }) {
  const s = useErpScreen("pipe", lang);
  const [board, setBoard] = useState<Record<Stage, Row[]> | null>(null);
  const [includeClosed, setIncludeClosed] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lostModal, setLostModal] = useState<Row | null>(null);
  const [lostReason, setLostReason] = useState("");
  const [quoteModal, setQuoteModal] = useState<Row | null>(null);
  const [quote, setQuote] = useState({ value: "", currency: "AED" });

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await apiGet<{ board: Record<Stage, Row[]> }>(`/api/erp/customer-inquiries/pipeline?includeClosed=${includeClosed ? 1 : 0}`);
      setBoard(r.board);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBoard(null);
    }
  }, [includeClosed]);
  useEffect(() => { void load(); }, [load]);

  const stageLabel = useMemo(
    () => ({
      new_lead: s.t("stage_new_lead", "New Lead"),
      contacted: s.t("stage_contacted", "Contacted"),
      qualified: s.t("stage_qualified", "Qualified"),
      quotation_sent: s.t("stage_quotation_sent", "Quotation Sent"),
      negotiation: s.t("stage_negotiation", "Negotiation"),
      won: s.t("stage_won", "Won"),
      lost: s.t("stage_lost", "Lost"),
    }) as Record<Stage, string>,
    [s],
  );

  const advance = async (row: Row) => {
    const to = NEXT_STAGE[row.pipeline_stage as Stage];
    if (!to) return;
    if (to === "quotation_sent") { setQuoteModal(row); setQuote({ value: "", currency: row.quotation_currency || "AED" }); return; }
    setBusy(true); setError(null);
    try {
      await apiPost(`/api/erp/customer-inquiries/${row.id}/pipeline-stage`, { to });
      setNotice(`${row.customer_name} → ${stageLabel[to]}`);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  const submitQuote = async () => {
    if (!quoteModal) return;
    setBusy(true); setError(null);
    try {
      await apiPost(`/api/erp/customer-inquiries/${quoteModal.id}/pipeline-stage`, {
        to: "quotation_sent",
        quotationValue: quote.value ? Number(quote.value) : null,
        quotationCurrency: quote.currency || null,
      });
      setNotice(`${quoteModal.customer_name} → ${stageLabel.quotation_sent}`);
      setQuoteModal(null);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  const markLost = (row: Row) => { setLostModal(row); setLostReason(""); };
  const submitLost = async () => {
    if (!lostModal) return;
    setBusy(true); setError(null);
    try {
      await apiPost(`/api/erp/customer-inquiries/${lostModal.id}/pipeline-stage`, { to: "lost", lostReason: lostReason.trim() || null });
      setNotice(`${lostModal.customer_name} → ${stageLabel.lost}`);
      setLostModal(null);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  const columns: Stage[] = includeClosed ? [...OPEN_STAGES, "won", "lost"] : OPEN_STAGES;

  return (
    <section dir={s.dir} className="space-y-4" data-testid="pipe-board">
      <header className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600/10 text-blue-700 dark:text-blue-300"><TrendingUp className="h-5 w-5" /></span>
          <div>
            <h1 className="text-lg font-black text-slate-900 dark:text-slate-50">{s.t("title", "Sales Pipeline")}</h1>
            <p className="text-xs text-slate-500">{s.t("subtitle", "Real leads from Customer Inquiries, tracked through a real sales funnel. Every move is scope-checked and recorded in a real audit trail.")}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <label className="inline-flex items-center gap-1"><input type="checkbox" checked={includeClosed} onChange={(e) => setIncludeClosed(e.target.checked)} />{s.t("show_closed", "Show Won / Lost")}</label>
          <button type="button" onClick={() => void load()} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 font-semibold dark:border-slate-700"><RefreshCw className="h-3.5 w-3.5" />{s.tGlobal("common.refresh", "Refresh")}</button>
        </div>
      </header>

      {error && <p data-testid="pipe-error" className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p>}
      {notice && <p data-testid="pipe-notice" className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">{notice}</p>}

      {board === null ? (
        <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-blue-700" /></div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {columns.map((stage) => {
            const rows = board[stage] || [];
            return (
              <div key={stage} className={`rounded-2xl border p-2.5 ${STAGE_TONE[stage]}`} data-testid={`pipe-col-${stage}`}>
                <div className="mb-2 flex items-center justify-between px-1">
                  <h3 className="text-[11px] font-black uppercase tracking-wide text-slate-700 dark:text-slate-200">{stageLabel[stage]}</h3>
                  <span className="rounded-full bg-white/70 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-900/50 dark:text-slate-300">{rows.length}</span>
                </div>
                <div className="space-y-2">
                  {rows.length === 0 ? (
                    <p className="px-1 py-4 text-center text-[11px] text-slate-400">{s.t("empty_stage", "No leads")}</p>
                  ) : rows.map((r) => (
                    <div key={r.id} data-testid="pipe-card" data-id={r.id} className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                      <a href={`/dashboard/customer-inquiries?id=${r.id}`} className="block text-[11px] font-bold text-slate-900 hover:underline dark:text-slate-100">{r.customer_name}</a>
                      {r.company_name && <div className="text-[10px] text-slate-400">{r.company_name}</div>}
                      <div className="mt-1 font-mono text-[10px] text-slate-400">{r.inquiry_no}</div>
                      {r.assignee_name && <div className="mt-1 text-[10px] text-slate-500">{s.t("assigned", "Assigned")}: {r.assignee_name}</div>}
                      {stage === "quotation_sent" && r.quotation_value != null && (
                        <div className="mt-1 text-[11px] font-bold text-amber-700 dark:text-amber-300">{r.quotation_currency} {Number(r.quotation_value).toLocaleString()}</div>
                      )}
                      {stage === "lost" && r.lost_reason && <div className="mt-1 text-[10px] text-rose-600 dark:text-rose-300">{r.lost_reason}</div>}
                      {stage !== "won" && stage !== "lost" && (
                        <div className="mt-2 flex gap-1">
                          <button type="button" disabled={busy} data-testid="pipe-advance" onClick={() => void advance(r)} className="flex-1 rounded-lg bg-blue-700 px-2 py-1 text-[10px] font-bold text-white disabled:opacity-50">
                            {s.t("advance_to", "Move to")} {stageLabel[NEXT_STAGE[stage as Stage]!]}
                          </button>
                          <button type="button" disabled={busy} data-testid="pipe-lost" onClick={() => markLost(r)} className="rounded-lg border border-rose-300 px-2 py-1 text-[10px] font-bold text-rose-700 disabled:opacity-50 dark:border-rose-800 dark:text-rose-300">
                            {s.t("mark_lost", "Lost")}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {quoteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" dir={s.dir}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900" data-testid="pipe-quote-modal">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold">{s.t("stage_quotation_sent", "Quotation Sent")} · {quoteModal.customer_name}</h3>
              <button type="button" aria-label={s.tGlobal("common.close", "Close")} onClick={() => setQuoteModal(null)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">{s.t("quotation_value", "Quotation Value")}</label>
                <input data-testid="pipe-quote-value" type="number" min={0} className={INP} value={quote.value} onChange={(e) => setQuote({ ...quote, value: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">{s.t("currency", "Currency")}</label>
                <select className={INP} value={quote.currency} onChange={(e) => setQuote({ ...quote, currency: e.target.value })}>
                  {["AED", "USD", "PKR", "AFN", "SAR"].map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <p className="mt-2 text-[10px] text-slate-400">{s.t("quotation_optional", "Optional — leave blank if the value is not decided yet.")}</p>
            <div className="mt-4 flex gap-2">
              <button type="button" disabled={busy} data-testid="pipe-quote-save" onClick={() => void submitQuote()} className="flex-1 rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{busy ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : s.tGlobal("common.save", "Save")}</button>
              <button type="button" onClick={() => setQuoteModal(null)} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300">{s.tGlobal("common.cancel", "Cancel")}</button>
            </div>
          </div>
        </div>
      )}

      {lostModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" dir={s.dir}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900" data-testid="pipe-lost-modal">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold">{s.t("mark_lost", "Lost")} · {lostModal.customer_name}</h3>
              <button type="button" aria-label={s.tGlobal("common.close", "Close")} onClick={() => setLostModal(null)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button>
            </div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">{s.t("lost_reason", "Reason (optional)")}</label>
            <textarea data-testid="pipe-lost-reason" rows={3} className={INP} value={lostReason} onChange={(e) => setLostReason(e.target.value)} />
            <div className="mt-4 flex gap-2">
              <button type="button" disabled={busy} data-testid="pipe-lost-save" onClick={() => void submitLost()} className="flex-1 rounded-lg bg-rose-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{busy ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : s.tGlobal("common.confirm", "Confirm")}</button>
              <button type="button" onClick={() => setLostModal(null)} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300">{s.tGlobal("common.cancel", "Cancel")}</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
