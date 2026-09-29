/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

/**
 * Old-lead reactivation (Customer Inquiry module). Lists stalled / lost inquiries in scope with a
 * transparent score from real activity (idle days, requirements, contact details, linked customer,
 * AI Calls history). Reactivating writes back to the existing inquiry, a CRM action item + note and
 * a User Task. Outbound AI calling needs the telephony provider, which is not configured.
 */
import { useCallback, useEffect, useState } from "react";
import { Loader2, PhoneCall, RefreshCw, RotateCcw, X } from "lucide-react";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { apiGet, apiPost } from "@/lib/api/client";
import { Th } from "@/components/ui/translated-th";

type Row = Record<string, any>;
const INP = "w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 dark:border-slate-700 dark:bg-slate-800";

export function LeadReactivationView({ lang }: { lang?: string }) {
  const s = useErpScreen("react", lang);
  const [days, setDays] = useState(90);
  const [includeLost, setIncludeLost] = useState(true);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [assignees, setAssignees] = useState<Row[]>([]);
  const [open, setOpen] = useState<Row | null>(null);
  const [f, setF] = useState({ assignedTo: "", dueDate: "", note: "", channel: "phone" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setRows(null); setError(null);
    try { setRows((await apiGet<{ candidates: Row[] }>(`/api/erp/customer-inquiries/reactivation?days=${days}&lost=${includeLost ? 1 : 0}`)).candidates ?? []); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); setRows([]); }
  }, [days, includeLost]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { apiGet<{ assignees: Row[] }>("/api/erp/customer-inquiries/assignees").then((r) => setAssignees(r.assignees ?? [])).catch(() => setAssignees([])); }, []);

  const start = (r: Row) => {
    const due = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
    setOpen(r); setF({ assignedTo: r.assigned_to ?? "", dueDate: due, note: "", channel: r.whatsapp ? "whatsapp" : r.mobile ? "phone" : "email" });
  };
  const submit = async () => {
    if (!open) return;
    setBusy(true); setError(null);
    try {
      const r = await apiPost<Row>(`/api/erp/customer-inquiries/reactivation/${open.id}`, f);
      setNotice(`${s.t("done", "Reactivated")}: ${r.inquiryNo} · ${s.t("task", "Task")} ${r.taskNo}`);
      setOpen(null);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  return (
    <section dir={s.dir} className="space-y-4" data-testid="react-view">
      <header className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-600/10 text-emerald-700 dark:text-emerald-300"><RotateCcw className="h-5 w-5" /></span>
          <div>
            <h1 className="text-lg font-black text-slate-900 dark:text-slate-50">{s.t("title", "Old Lead Reactivation")}</h1>
            <p className="text-xs text-slate-500">{s.t("subtitle", "Stalled and lost inquiries, ranked from real activity. Reactivating puts the inquiry back into follow-up, adds a CRM action item and creates a task — nothing is sent to the customer automatically.")}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <label className="inline-flex items-center gap-1">{s.t("idle_for", "No activity for")}
            <select data-testid="react-days" className={`${INP} w-24`} value={days} onChange={(e) => setDays(Number(e.target.value))}>{[30, 60, 90, 180, 365].map((d) => <option key={d} value={d}>{d}</option>)}</select>{s.t("days", "days")}
          </label>
          <label className="inline-flex items-center gap-1"><input type="checkbox" checked={includeLost} onChange={(e) => setIncludeLost(e.target.checked)} />{s.t("include_lost", "Include lost / closed")}</label>
          <button type="button" onClick={() => void load()} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 font-semibold dark:border-slate-700"><RefreshCw className="h-3.5 w-3.5" />{s.t("refresh", "Refresh")}</button>
        </div>
      </header>
      <p className="rounded-2xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200"><PhoneCall className="me-1 inline h-3.5 w-3.5" />{s.t("calls_note", "AI outbound calling needs the telephony provider to be connected (not configured). Call history and call intelligence from AI Calls are shown where they exist.")}</p>
      {error && <p data-testid="react-error" className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p>}
      {notice && <p data-testid="react-notice" className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">{notice}</p>}

      <section className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-xs" data-testid="react-list">
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr>{[s.t("score", "Score"), s.t("inquiry", "Inquiry"), s.t("customer", "Customer"), s.t("status", "Status"), s.t("idle", "Idle (days)"), s.t("contact", "Contact"), s.t("calls", "AI calls"), s.t("talking_points", "Talking points"), ""].map((h, i) => <Th key={i} className={`px-3 py-2.5 font-bold ${s.textStart}`}>{h}</Th>)}</tr>
            </thead>
            <tbody>
              {rows === null ? (
                <tr><td colSpan={9} className="px-3 py-8 text-center"><Loader2 className="mx-auto h-4 w-4 animate-spin text-emerald-700" /></td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={9} className="px-3 py-8 text-center text-slate-400">{s.t("empty", "No stalled or lost inquiries for this period.")}</td></tr>
              ) : rows.map((r) => (
                <tr key={r.id} data-testid="react-row" data-id={r.id} className="border-t border-slate-100 align-top dark:border-slate-800">
                  <td className="px-3 py-2"><span className={`inline-block min-w-10 rounded-full px-2 py-0.5 text-center text-[11px] font-bold tabular-nums ${r.score >= 70 ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200" : r.score >= 40 ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}>{r.score}</span></td>
                  <td className="px-3 py-2 font-mono"><a href={`/dashboard/customer-inquiries?id=${r.id}`} className="font-semibold text-blue-700 hover:underline dark:text-blue-300">{r.inquiry_no}</a></td>
                  <td className="px-3 py-2">{r.customer_name}{r.company_name ? <div className="text-[10px] text-slate-400">{r.company_name}</div> : null}</td>
                  <td className="px-3 py-2">{s.tGlobal(`cinq.status_${r.status}`, r.status)}{r.lost_reason ? <div className="text-[10px] text-slate-400">{r.lost_reason}</div> : null}</td>
                  <td className="px-3 py-2 tabular-nums">{r.idle_days}</td>
                  <td className="px-3 py-2" dir="ltr">{r.whatsapp || r.mobile || r.email || <span className="text-rose-600">{s.t("no_contact", "none")}</span>}</td>
                  <td className="px-3 py-2">{r.call_count}{r.last_call_risk ? <span className="ms-1 text-[10px] text-slate-500">({s.t(`risk_${r.last_call_risk}`, r.last_call_risk)})</span> : null}</td>
                  <td className="max-w-xs px-3 py-2 text-[11px] text-slate-600 dark:text-slate-300">{(r.talkingPoints ?? []).slice(0, 3).map((p: string, i: number) => <div key={i} className="line-clamp-2">• {p}</div>)}</td>
                  <td className="px-3 py-2"><button type="button" data-testid="react-start" onClick={() => start(r)} className="rounded-lg bg-emerald-700 px-2.5 py-1 text-[11px] font-bold text-white">{s.t("reactivate", "Reactivate")}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" dir={s.dir}>
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900" data-testid="react-modal">
            <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-bold">{s.t("reactivate", "Reactivate")} · {open.inquiry_no}</h3><button type="button" aria-label={s.t("close", "Close")} onClick={() => setOpen(null)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button></div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label={s.t("assign_to", "Follow-up by")}>
                <select data-testid="react-f-assignee" className={INP} value={f.assignedTo} onChange={(e) => setF({ ...f, assignedTo: e.target.value })}>
                  <option value="">{s.t("select", "Select…")}</option>
                  {assignees.map((u) => <option key={u.user_id} value={u.user_id}>{u.name ?? u.user_id}</option>)}
                </select>
              </Field>
              <Field label={s.t("due", "Follow-up date")}><input data-testid="react-f-due" type="date" className={INP} value={f.dueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} /></Field>
              <Field label={s.t("channel", "Channel")}>
                <select className={INP} value={f.channel} onChange={(e) => setF({ ...f, channel: e.target.value })}>{["phone", "whatsapp", "email", "visit"].map((c) => <option key={c} value={c}>{s.t(`ch_${c}`, c)}</option>)}</select>
              </Field>
              <div className="sm:col-span-2"><Field label={s.t("note", "What will you offer / ask?")}><textarea data-testid="react-f-note" rows={3} className={INP} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field></div>
            </div>
            {(open.talkingPoints ?? []).length > 0 && <div className="mt-3 rounded-lg bg-slate-50 p-2 text-[11px] dark:bg-slate-800/60"><b>{s.t("talking_points", "Talking points")}</b>{open.talkingPoints.map((p: string, i: number) => <div key={i}>• {p}</div>)}</div>}
            <div className="mt-4 flex gap-2">
              <button type="button" data-testid="react-f-save" disabled={busy || !f.assignedTo || !f.dueDate || f.note.trim().length < 3} onClick={() => void submit()} className="flex-1 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{busy ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : s.t("reactivate", "Reactivate")}</button>
              <button type="button" onClick={() => setOpen(null)} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300">{s.t("cancel", "Cancel")}</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</label>{children}</div>;
}
