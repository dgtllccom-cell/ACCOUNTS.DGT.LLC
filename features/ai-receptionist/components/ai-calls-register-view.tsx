"use client";

import { useCallback, useEffect, useState } from "react";
import { Phone, PhoneIncoming, PhoneOutgoing, RefreshCw, ExternalLink, AlertTriangle, ShieldAlert, ShieldCheck, ShieldQuestion, Sparkles } from "lucide-react";
import Link from "next/link";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { apiGet } from "@/lib/api/client";
import { Th } from "@/components/ui/translated-th";
import { CallDetailDrawer } from "./call-detail-drawer";

type CallRow = {
  id: string;
  direction: "inbound" | "outbound";
  from_e164: string | null;
  to_e164: string | null;
  language_code: string;
  status: string;
  intent: string | null;
  outcome: string | null;
  duration_seconds: number | null;
  inquiry_id: string | null;
  started_at: string;
};

type Resp = {
  rows: CallRow[];
  summary: Record<string, number>;
  setupPending?: boolean;
  telephony: { configured: boolean; provider: string | null; ownerActionRequired: string[] };
};

type IntelSummary = {
  counts: { high: number; medium: number; low: number; not_analyzed: number; follow_up_gap: number };
  topSignals: Array<{ type: string; n: number }>;
  topTopics: Array<{ topic: string; n: number }>;
  repeatedContact: Array<{ contact_key: string; label: string; call_count: number; last_call_at: string }>;
  agentPerformance: Array<{ user_id: string; user_name: string | null; calls_handled: number; high_risk_calls: number; follow_ups_created: number; coaching_gap: number }>;
};

export function AiCallsRegisterView({ lang }: { lang?: string }) {
  const s = useErpScreen("aicall", lang);
  const [data, setData] = useState<Resp | null>(null);
  const [intel, setIntel] = useState<IntelSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [res, intelRes] = await Promise.all([
        apiGet<Resp>("/api/erp/ai-calls?limit=200"),
        apiGet<{ summary: IntelSummary }>("/api/erp/ai-calls/intelligence/summary").catch(() => null),
      ]);
      setData(res);
      if (intelRes) setIntel(intelRes.summary);
    } catch (e: any) {
      setError(e?.message ?? s.t("load_err", "Could not load AI calls."));
    } finally {
      setLoading(false);
    }
  }, [s]);

  useEffect(() => {
    void load();
  }, [load]);

  const fmtDur = (n: number | null) => (n == null ? "—" : `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`);

  return (
    <section dir={s.dir} className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Phone className="h-5 w-5 text-primary" />
            {s.t("title", "AI Receptionist Calls")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {s.t(
              "subtitle",
              "Inbound and outbound AI calls. Every call that leaves a message or requirement is filed into the Customer Inquiry Register.",
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-sm"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          {s.t("refresh", "Refresh")}
        </button>
      </div>

      {data && !data.telephony.configured ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4" />
            {s.t("dormant", "AI Receptionist is not activated yet.")}
          </div>
          <p className="mt-1">
            {s.t("owner_action", "Owner action required — configure a telephony provider to start receiving calls:")}
          </p>
          <ul className="mt-1 list-disc ps-5 text-xs">
            {data.telephony.ownerActionRequired.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {error ? <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{error}</p> : null}

      {data && !data.setupPending ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {[
            ["total", s.t("kpi_total", "Total Calls")],
            ["completed", s.t("kpi_completed", "Completed")],
            ["handed_off", s.t("kpi_handed_off", "Handed to Staff")],
            ["with_inquiry", s.t("kpi_with_inquiry", "Filed as Inquiry")],
            ["last_7d", s.t("kpi_last_7d", "Last 7 Days")],
          ].map(([k, label]) => (
            <div key={k} className="rounded-xl border border-border bg-card p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
              <div className="mt-1 text-xl font-bold">{data.summary[k] ?? 0}</div>
            </div>
          ))}
        </div>
      ) : null}

      {/* Conversation Intelligence — portfolio dashboard */}
      {intel ? (
        <div className={s.textStart}>
          <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
            <Sparkles className="h-3 w-3" /> {s.t("intel_portfolio_title", "Conversation Intelligence — Portfolio Risk")}
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-rose-600"><ShieldAlert className="h-3.5 w-3.5" />{s.t("intel_risk_high", "High Risk")}</div>
              <div className="mt-1 text-xl font-black">{intel.counts.high}</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-amber-600"><ShieldQuestion className="h-3.5 w-3.5" />{s.t("intel_risk_medium", "Medium Risk")}</div>
              <div className="mt-1 text-xl font-black">{intel.counts.medium}</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-emerald-600"><ShieldCheck className="h-3.5 w-3.5" />{s.t("intel_risk_low", "Low Risk")}</div>
              <div className="mt-1 text-xl font-black">{intel.counts.low}</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-muted-foreground"><ShieldQuestion className="h-3.5 w-3.5" />{s.t("intel_not_analyzed", "Not Yet Analyzed")}</div>
              <div className="mt-1 text-xl font-black">{intel.counts.not_analyzed}</div>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-3">
              <p className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">{s.t("intel_top_signals", "Top Signals")}</p>
              {intel.topSignals.length ? (
                <ul className="mt-1.5 space-y-1">
                  {intel.topSignals.map((sig) => (
                    <li key={sig.type} className="flex items-center justify-between text-[11px]">
                      <span>{s.t(`signal_${sig.type}_title`, sig.type.replace(/_/g, " "))}</span>
                      <span className="font-bold">{sig.n}</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="mt-1 text-[11px] text-muted-foreground">{s.t("intel_no_data", "No data yet.")}</p>}
            </div>
            <div className="rounded-xl border border-border bg-card p-3">
              <p className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">{s.t("intel_top_topics", "Top Topics")}</p>
              {intel.topTopics.length ? (
                <ul className="mt-1.5 space-y-1">
                  {intel.topTopics.map((tp) => (
                    <li key={tp.topic} className="flex items-center justify-between text-[11px]">
                      <span>{s.t(`topic_${tp.topic}_title`, tp.topic.replace(/_/g, " "))}</span>
                      <span className="font-bold">{tp.n}</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="mt-1 text-[11px] text-muted-foreground">{s.t("intel_no_data", "No data yet.")}</p>}
            </div>
            <div className="rounded-xl border border-border bg-card p-3">
              <p className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">{s.t("intel_repeated_contact", "Repeated Contact")}</p>
              {intel.repeatedContact.length ? (
                <ul className="mt-1.5 space-y-1">
                  {intel.repeatedContact.map((rc) => (
                    <li key={rc.contact_key} className="flex items-center justify-between text-[11px]">
                      <span>{rc.label}</span>
                      <span className="font-bold">{rc.call_count}</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="mt-1 text-[11px] text-muted-foreground">{s.t("intel_no_data", "No data yet.")}</p>}
            </div>
            <div className="rounded-xl border border-border bg-card p-3">
              <p className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">{s.t("intel_agent_performance", "Agent / User Performance")}</p>
              {intel.agentPerformance.length ? (
                <ul className="mt-1.5 space-y-1">
                  {intel.agentPerformance.map((ap) => (
                    <li key={ap.user_id} className="text-[11px]">
                      <span className="font-bold">{ap.user_name || "—"}</span>
                      {" — "}{s.t("intel_calls_handled", "calls")}: {ap.calls_handled}, {s.t("intel_high_risk", "high-risk")}: {ap.high_risk_calls}, {s.t("intel_follow_ups", "follow-ups")}: {ap.follow_ups_created}
                      {ap.coaching_gap > 0 ? <span className="ms-1 font-bold text-amber-600">({s.t("intel_coaching_gap", "coaching gap")}: {ap.coaching_gap})</span> : null}
                    </li>
                  ))}
                </ul>
              ) : <p className="mt-1 text-[11px] text-muted-foreground">{s.t("intel_no_data", "No data yet.")}</p>}
            </div>
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-border bg-background">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr className="border-b border-border">
              <Th className={`px-3 py-3 font-semibold ${s.textStart}`}>{s.t("col_time", "Time")}</Th>
              <Th className={`px-3 py-3 font-semibold ${s.textStart}`}>{s.t("col_direction", "Direction")}</Th>
              <Th className={`px-3 py-3 font-semibold ${s.textStart}`}>{s.t("col_from", "From")}</Th>
              <Th className={`px-3 py-3 font-semibold ${s.textStart}`}>{s.t("col_intent", "Intent")}</Th>
              <Th className={`px-3 py-3 font-semibold ${s.textStart}`}>{s.t("col_status", "Status")}</Th>
              <Th className={`px-3 py-3 font-semibold ${s.textStart}`}>{s.t("col_duration", "Duration")}</Th>
              <Th className={`px-3 py-3 font-semibold ${s.textStart}`}>{s.t("col_inquiry", "Inquiry")}</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data?.rows?.length ? (
              data.rows.map((r) => (
                <tr key={r.id} className="cursor-pointer hover:bg-muted/30" onClick={() => setSelectedCallId(r.id)}>
                  <td className="px-3 py-2 whitespace-nowrap">{new Date(r.started_at).toLocaleString()}</td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-1">
                      {r.direction === "inbound" ? <PhoneIncoming className="h-3.5 w-3.5" /> : <PhoneOutgoing className="h-3.5 w-3.5" />}
                      {r.direction === "inbound" ? s.t("dir_inbound", "Inbound") : s.t("dir_outbound", "Outbound")}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{r.direction === "inbound" ? r.from_e164 : r.to_e164}</td>
                  <td className="px-3 py-2">{r.intent ? s.t(`intent_${r.intent}`, r.intent) : "—"}</td>
                  <td className="px-3 py-2">{s.t(`st_${r.status}`, r.status)}</td>
                  <td className="px-3 py-2">{fmtDur(r.duration_seconds)}</td>
                  <td className="px-3 py-2">
                    {r.inquiry_id ? (
                      <Link href="/dashboard/customer-inquiries" onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 text-primary">
                        {s.t("view_inquiry", "View")} <ExternalLink className="h-3 w-3" />
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="px-3 py-10 text-center text-sm font-medium text-muted-foreground">
                  {loading ? s.t("loading", "Loading…") : s.t("no_calls", "No AI calls recorded yet.")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedCallId ? (
        <CallDetailDrawer callId={selectedCallId} onClose={() => setSelectedCallId(null)} lang={s.lang} />
      ) : null}
    </section>
  );
}
