"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Sparkles, X, ExternalLink, PhoneIncoming, PhoneOutgoing } from "lucide-react";
import { apiGet, apiPost } from "@/lib/api/client";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";

type CallDetail = {
  id: string;
  direction: "inbound" | "outbound";
  from_e164: string | null;
  to_e164: string | null;
  language_code: string;
  status: string;
  intent: string | null;
  outcome: string | null;
  transcript: string | null;
  recording_url: string | null;
  duration_seconds: number | null;
  inquiry_id: string | null;
  task_id: string | null;
  started_at: string;
  ended_at: string | null;
};

type CallEvent = { id: string; at: string; kind: string; detail: Record<string, any> };

const RISK_TONE: Record<string, string> = {
  high: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900",
  medium: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900",
  low: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900",
};

function RiskPill({ level, s }: { level: string | null | undefined; s: ReturnType<typeof useErpScreen> }) {
  const lvl = level || "unknown";
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase ${RISK_TONE[lvl] || "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"}`}>
      {s.t(`intel_risk_${lvl}`, lvl)}
    </span>
  );
}

export function CallDetailDrawer({ callId, onClose, lang }: { callId: string; onClose: () => void; lang?: string }) {
  const s = useErpScreen("aicall", lang);
  const [call, setCall] = useState<CallDetail | null>(null);
  const [events, setEvents] = useState<CallEvent[]>([]);
  const [analysis, setAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [callRes, intelRes] = await Promise.all([
        apiGet<{ call: CallDetail; events: CallEvent[] }>(`/api/erp/ai-calls/${callId}`),
        apiGet<{ analysis: any }>(`/api/erp/ai-calls/${callId}/intelligence`),
      ]);
      setCall(callRes.call);
      setEvents(callRes.events || []);
      setAnalysis(intelRes.analysis ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [callId]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async () => {
    setRunning(true);
    setError(null);
    try {
      const res = await apiPost<{ analysis: any }>(`/api/erp/ai-calls/${callId}/intelligence`, {});
      setAnalysis(res.analysis ?? null);
      const callRes = await apiGet<{ call: CallDetail; events: CallEvent[] }>(`/api/erp/ai-calls/${callId}`);
      setCall(callRes.call);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  };

  const status = analysis?.analysisStatus;
  const fmtDur = (n: number | null) => (n == null ? "—" : `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40" onClick={onClose}>
      <div dir={s.dir} className="h-full w-full max-w-2xl overflow-y-auto bg-white p-5 shadow-2xl dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-black text-slate-800 dark:text-slate-100">
            {call?.direction === "inbound" ? <PhoneIncoming className="h-4 w-4" /> : <PhoneOutgoing className="h-4 w-4" />}
            {s.t("drawer_title", "Call Detail")}
          </h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button>
        </div>

        {loading ? (
          <div className="py-16 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-slate-400" /></div>
        ) : !call ? (
          <p className="py-10 text-center text-xs text-slate-400">{s.t("not_found", "Call not found.")}</p>
        ) : (
          <div className="mt-4 space-y-4">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
              <div><dt className="text-[10px] font-bold uppercase text-slate-400">{s.t("col_direction", "Direction")}</dt><dd className="font-semibold text-slate-700 dark:text-slate-200">{s.t(call.direction === "inbound" ? "dir_inbound" : "dir_outbound", call.direction)}</dd></div>
              <div><dt className="text-[10px] font-bold uppercase text-slate-400">{s.t("col_status", "Status")}</dt><dd className="font-semibold text-slate-700 dark:text-slate-200">{s.t(`st_${call.status}`, call.status)}</dd></div>
              <div><dt className="text-[10px] font-bold uppercase text-slate-400">{s.t("col_from", "From")}</dt><dd className="font-mono font-semibold text-slate-700 dark:text-slate-200">{call.direction === "inbound" ? call.from_e164 : call.to_e164 || "—"}</dd></div>
              <div><dt className="text-[10px] font-bold uppercase text-slate-400">{s.t("col_duration", "Duration")}</dt><dd className="font-semibold text-slate-700 dark:text-slate-200">{fmtDur(call.duration_seconds)}</dd></div>
              <div><dt className="text-[10px] font-bold uppercase text-slate-400">{s.t("col_intent", "Intent")}</dt><dd className="font-semibold text-slate-700 dark:text-slate-200">{call.intent ? s.t(`intent_${call.intent}`, call.intent) : "—"}</dd></div>
              <div><dt className="text-[10px] font-bold uppercase text-slate-400">{s.t("started_at", "Started")}</dt><dd className="font-semibold text-slate-700 dark:text-slate-200">{new Date(call.started_at).toLocaleString()}</dd></div>
            </dl>

            {call.recording_url ? (
              <p className="text-[11px] text-slate-500">{s.t("recording_ref", "Recording reference")}: <span className="font-mono">{call.recording_url}</span></p>
            ) : null}

            {call.transcript ? (
              <div>
                <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">{s.t("transcript", "Transcript")}</p>
                <p dir={s.dir} className="mt-1 whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-[12px] leading-relaxed text-slate-700 dark:bg-slate-800/60 dark:text-slate-300">{call.transcript}</p>
              </div>
            ) : (
              <p className="text-[11px] text-slate-400">{s.t("no_transcript", "No transcript recorded for this call.")}</p>
            )}

            {events.length ? (
              <div>
                <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">{s.t("events", "Call Timeline")}</p>
                <ul className="mt-1 space-y-1">
                  {events.map((e) => (
                    <li key={e.id} className="text-[10px] text-slate-500">
                      {new Date(e.at).toLocaleTimeString()} — <span className="font-bold">{e.kind}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {call.inquiry_id ? (
                <Link href="/dashboard/customer-inquiries" className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200">
                  <ExternalLink className="h-3 w-3" /> {s.t("view_inquiry", "View Inquiry")}
                </Link>
              ) : null}
              {call.task_id ? (
                <Link href="/dashboard/user-tasks/team" className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200">
                  <ExternalLink className="h-3 w-3" /> {s.t("view_task", "View Follow-Up Task")}
                </Link>
              ) : null}
            </div>

            {/* Conversation Intelligence */}
            <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-slate-400">
                  <Sparkles className="h-3.5 w-3.5" /> {s.t("intel_title", "Conversation Intelligence")}
                </p>
                {status === "completed" ? <RiskPill level={analysis.riskLevel} s={s} /> : null}
              </div>

              {status === "completed" ? (
                <div className="mt-2 space-y-3">
                  {analysis.deterministicOnly ? (
                    <p className="rounded-lg bg-slate-50 px-2 py-1.5 text-[10px] font-semibold text-slate-500 dark:bg-slate-800/60">
                      {s.t("intel_deterministic_only", "AI enrichment is not configured — showing deterministic (rule-based) analysis only.")}
                      {call.language_code !== "en" ? ` ${s.t("intel_coverage_note", "Non-English deterministic signal detection is keyword-based and less complete; configure AI enrichment for full coverage.")}` : ""}
                    </p>
                  ) : null}

                  {analysis.followUpRequired ? (
                    <p className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1.5 text-[11px] font-bold text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
                      {s.t("intel_action_needed", "Action needed — this call has risk factors that need review.")}
                    </p>
                  ) : null}

                  {analysis.summary ? <p className="text-[11px] text-slate-600 dark:text-slate-300">{analysis.summary}</p> : null}
                  {analysis.nextBestAction ? (
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">{s.t("intel_next_best_action", "Next Best Action")}</p>
                      <p className="mt-1 text-[11px] font-semibold text-slate-700 dark:text-slate-200">{analysis.nextBestAction}</p>
                    </div>
                  ) : null}

                  {(analysis.signals || []).filter((sig: any) => sig.present).length ? (
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">{s.t("intel_signals", "Signals Detected")}</p>
                      <ul className="mt-1 space-y-1">
                        {analysis.signals.filter((sig: any) => sig.present).map((sig: any) => (
                          <li key={sig.type} className="text-[11px] text-slate-600 dark:text-slate-300">
                            <span className="font-bold">{s.t(`signal_${sig.type}_title`, sig.type.replace(/_/g, " "))}</span>
                            {sig.evidence ? <span className="italic text-slate-500"> — "{sig.evidence}"</span> : null}
                            {sig.explanation ? <span> — {sig.explanation}</span> : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {analysis.paymentPromise ? (
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">{s.t("intel_payment_promise", "Payment Promise")}</p>
                      <p className="mt-1 text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                        {analysis.paymentPromise.currency} {Number(analysis.paymentPromise.amount).toLocaleString()}
                        {analysis.paymentPromise.date ? ` — ${s.t("intel_by_date", "by")} ${analysis.paymentPromise.date}` : ""}
                      </p>
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-400">{s.t("intel_no_payment_promise", "No payment promise detected.")}</p>
                  )}

                  {(analysis.commitments || []).length ? (
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">{s.t("intel_commitments", "Commitments")}</p>
                      <ul className="mt-1 space-y-1">
                        {analysis.commitments.map((c: any, i: number) => (
                          <li key={i} className="text-[11px] text-slate-600 dark:text-slate-300">{c.description}{c.due_date ? ` (${c.due_date})` : ""}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">{s.t("intel_financial_context", "Financial Context")}</p>
                    {analysis.financialContext?.available ? (
                      <p className="mt-1 text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                        {analysis.financialContext.currency} {Number(analysis.financialContext.closingBalance).toLocaleString()} {analysis.financialContext.closingDcType}
                      </p>
                    ) : (
                      <p className="mt-1 text-[11px] text-slate-400">{s.t("intel_no_financial_data", "No ERP financial record found for this customer.")}</p>
                    )}
                  </div>

                  {call.task_id ? (
                    <p className="text-[11px] text-emerald-700 dark:text-emerald-400">{s.t("intel_task_linked", "A follow-up task has been created and linked to this call.")}</p>
                  ) : analysis.followUpRequired ? (
                    <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">{s.t("intel_task_skipped_no_assignee", "Follow-up is needed, but no task could be created — this phone number has no assigned staff member configured (Number Map settings).")}</p>
                  ) : null}
                </div>
              ) : status === "error" ? (
                <p className="mt-2 text-[11px] font-semibold text-rose-600">{analysis?.errorMessage || s.t("intel_error", "Analysis failed.")}</p>
              ) : (
                <p className="mt-2 text-[11px] text-slate-500">{s.t("intel_pending", "This call has not been analyzed yet.")}</p>
              )}

              {error ? <p className="mt-2 text-[11px] font-semibold text-rose-600">{error}</p> : null}

              <button
                type="button"
                onClick={() => void run()}
                disabled={running || !call.transcript}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                {status === "completed" ? s.t("intel_refresh", "Refresh Analysis") : s.t("intel_run", "Run Analysis")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
