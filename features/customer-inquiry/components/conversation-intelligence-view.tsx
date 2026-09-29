/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

/**
 * Meeting & Conversation Intelligence (Customer Inquiry module).
 * Meeting notes, a WhatsApp chat export, an email (from the Email workspace) or a Document
 * Intelligence file → preview (summary, decisions, requirements, action items, important dates,
 * draft replies) → the user edits and confirms → existing Inquiry + User Tasks. Nothing is sent.
 */
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, ClipboardCopy, FileText, Loader2, Mail, MessageCircle, Sparkles, Users } from "lucide-react";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { apiGet, apiPost } from "@/lib/api/client";

type Row = Record<string, any>;
type Channel = "meeting" | "whatsapp" | "email";
const INP = "w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 dark:border-slate-700 dark:bg-slate-800";

export function ConversationIntelligenceView({ lang }: { lang?: string }) {
  const s = useErpScreen("ci", lang);
  const [channel, setChannel] = useState<Channel>("meeting");
  const [text, setText] = useState("");
  const [jobId, setJobId] = useState("");
  const [jobs, setJobs] = useState<Row[]>([]);
  const [source, setSource] = useState<{ route: string | null; label: string | null }>({ route: null, label: null });
  const [a, setA] = useState<Row | null>(null);
  const [assignees, setAssignees] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Row | null>(null);
  const [mode, setMode] = useState<"new" | "existing" | "none">("new");
  const [inquiryId, setInquiryId] = useState("");
  const [fields, setFields] = useState<Row>({});
  const [tasks, setTasks] = useState<Row[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    apiGet<{ users: Row[] }>("/api/erp/user-tasks/assignees").then((r) => setAssignees(r.users ?? [])).catch(() => setAssignees([]));
    // An email handed over from the Email workspace.
    try {
      const raw = sessionStorage.getItem("ci_prefill");
      if (raw) {
        const p = JSON.parse(raw);
        sessionStorage.removeItem("ci_prefill");
        if (p?.text) { setChannel(p.channel === "whatsapp" ? "whatsapp" : p.channel === "meeting" ? "meeting" : "email"); setText(String(p.text)); setSource({ route: p.sourceRoute ?? null, label: p.sourceLabel ?? null }); }
      }
    } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    if (channel !== "email" || jobs.length) return;
    apiGet<{ rows: Row[] }>("/api/erp/document-intelligence?limit=50").then((r) => setJobs(r.rows ?? [])).catch(() => setJobs([]));
  }, [channel, jobs.length]);

  const analyze = async () => {
    setBusy(true); setError(null); setResult(null);
    try {
      const r = await apiPost<{ analysis: Row }>("/api/erp/customer-inquiries/intelligence/analyze", { channel, text, intakeJobId: jobId || null, lang: s.lang });
      const an = r.analysis;
      setA(an);
      if (an.source) setSource({ route: an.source.route, label: an.source.label });
      const d = an.draft ?? {};
      setFields({ customerName: d.customer_name ?? "", companyName: d.company_name ?? "", contactPerson: d.contact_person ?? "", mobile: d.mobile ?? "", whatsapp: d.whatsapp ?? "", email: d.email ?? "", businessType: d.business_type ?? "", summary: an.summary ?? "", requirements: (an.requirements ?? []).join("\n"), followUpDate: an.followUpDate ?? "", customerId: an.customerMatches?.[0]?.id ?? "" });
      setMode(channel === "email" && !d.customer_name && !d.company_name ? "none" : an.inquiryMatches?.length ? "existing" : "new");
      setInquiryId(an.inquiryMatches?.[0]?.id ?? "");
      setTasks([
        ...(an.actions ?? []).map((x: Row) => ({ include: x.ownerSide !== "customer", kind: "action", title: x.text, dueDate: x.dueDate ?? "", priority: x.priority, assignedTo: "", owner: x.owner, side: x.ownerSide })),
        ...(an.dates ?? []).filter((x: Row) => x.kind !== "other").map((x: Row) => ({ include: channel === "email", kind: "date", title: `${s.t(`dk_${x.kind}`, x.kind)}: ${x.context}`.slice(0, 240), dueDate: x.date, priority: x.kind === "payment" || x.kind === "deadline" ? "high" : "normal", assignedTo: "" })),
      ]);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  const confirm = async () => {
    setBusy(true); setError(null);
    try {
      const chosen = tasks.filter((t) => t.include);
      if (chosen.some((t) => !t.assignedTo)) throw new Error(s.t("need_assignee", "Choose who is responsible for every selected task."));
      const r = await apiPost<{ result: Row }>("/api/erp/customer-inquiries/intelligence/confirm", {
        channel, text: a?.text ?? text, lang: s.lang, sourceRoute: source.route, sourceLabel: source.label,
        inquiry: { mode, inquiryId: mode === "existing" ? inquiryId : null, ...Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v === "" ? null : v])) },
        tasks: chosen.map((t) => ({ title: t.title, assignedTo: t.assignedTo, dueDate: t.dueDate || null, priority: t.priority === "high" ? "high" : "normal", kind: t.kind })),
      });
      setResult(r.result);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  const copy = async (k: string, v: string) => { try { await navigator.clipboard.writeText(v); setCopied(k); setTimeout(() => setCopied(null), 1500); } catch { /* ignore */ } };
  const setTask = (i: number, k: string, v: any) => setTasks((x) => x.map((t, j) => (j === i ? { ...t, [k]: v } : t)));
  const waLink = useMemo(() => {
    const num = String(fields.whatsapp || fields.mobile || "").replace(/\D/g, "");
    return num && a?.replies?.whatsapp ? `https://wa.me/${num}?text=${encodeURIComponent(a.replies.whatsapp)}` : null;
  }, [fields.whatsapp, fields.mobile, a]);
  const CH: Array<[Channel, string, any]> = [["meeting", s.t("ch_meeting", "Meeting notes"), Users], ["whatsapp", s.t("ch_whatsapp", "WhatsApp chat"), MessageCircle], ["email", s.t("ch_email", "Email / PDF document"), Mail]];

  return (
    <section dir={s.dir} className="space-y-4" data-testid="ci-view">
      <header className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-600/10 text-emerald-700 dark:text-emerald-300"><Sparkles className="h-5 w-5" /></span>
        <div>
          <h1 className="text-lg font-black text-slate-900 dark:text-slate-50">{s.t("title", "Meeting & Conversation Intelligence")}</h1>
          <p className="text-xs text-slate-500">{s.t("subtitle", "Turn meeting notes, a WhatsApp chat or an email / document into a CRM inquiry, action items with owners and due dates, reminders and a draft reply. You review everything first; nothing is sent automatically.")}</p>
        </div>
      </header>

      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap gap-2">
          {CH.map(([id, label, Icon]) => (
            <button key={id} type="button" data-testid={`ci-ch-${id}`} onClick={() => { setChannel(id); setA(null); setResult(null); }}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold ${channel === id ? "bg-emerald-700 text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"}`}><Icon className="h-4 w-4" />{label}</button>
          ))}
        </div>
        {source.label && <p className="text-xs text-slate-500" data-testid="ci-source">{s.t("source", "Source")}: <b>{source.label}</b></p>}
        {channel === "email" && (
          <L label={s.t("from_di", "Or use a Document Intelligence file")}>
            <select data-testid="ci-job" className={INP} value={jobId} onChange={(e) => setJobId(e.target.value)}>
              <option value="">—</option>
              {jobs.map((j) => <option key={j.id} value={j.id}>{j.job_no} · {j.original_filename ?? ""} · {j.doc_type_code ?? ""}</option>)}
            </select>
          </L>
        )}
        <textarea data-testid="ci-text" rows={9} className={INP} value={text} onChange={(e) => setText(e.target.value)}
          placeholder={channel === "whatsapp" ? s.t("ph_whatsapp", "Paste the WhatsApp chat export (More → Export chat → Without media)…") : channel === "email" ? s.t("ph_email", "Paste the email (subject, sender and body)…") : s.t("ph_meeting", "Type or paste the meeting notes / transcript…")} />
        <button type="button" data-testid="ci-analyze" disabled={busy || (text.trim().length < 10 && !jobId)} onClick={() => void analyze()} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{s.t("analyze", "Analyze")}
        </button>
      </section>

      {error && <p data-testid="ci-error" className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p>}

      {result && (
        <section data-testid="ci-result" className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-xs text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
          <p className="flex items-center gap-2 text-sm font-bold"><CheckCircle2 className="h-4 w-4" />{s.t("saved", "Saved to the ERP")}</p>
          {result.inquiryNo && <p className="mt-1">{s.t("inquiry", "Inquiry")}: <a className="font-mono font-bold underline" href={`/dashboard/customer-inquiries?id=${result.inquiryId}`} data-testid="ci-result-inquiry">{result.inquiryNo}</a></p>}
          {result.tasks?.length > 0 && <p className="mt-1">{s.t("tasks_created", "Tasks created")}: <span className="font-mono" data-testid="ci-result-tasks">{result.tasks.join(", ")}</span></p>}
          {result.skipped?.length > 0 && <p className="mt-1 text-amber-800 dark:text-amber-200">{s.t("tasks_skipped", "Not created")}: {result.skipped.map((x: Row) => `${x.title} (${x.reason})`).join("; ")}</p>}
        </section>
      )}

      {a && !result && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3" data-testid="ci-preview">
          <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 xl:col-span-2">
            <h3 className="text-sm font-bold">{s.t("summary", "Summary")}</h3>
            <p className="text-xs text-slate-700 dark:text-slate-200" data-testid="ci-summary">{a.summary}</p>
            {a.whatsapp && <p className="text-[11px] text-slate-500" data-testid="ci-wa-stats">{a.whatsapp.messages} {s.t("wa_messages", "messages")} · {a.whatsapp.participants.join(", ")}{a.whatsapp.first ? ` · ${a.whatsapp.first} → ${a.whatsapp.last}` : ""}</p>}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div data-testid="ci-decisions"><h4 className="text-xs font-bold text-slate-500">{s.t("decisions", "Decisions")}</h4>{a.decisions.length ? <ul className="mt-1 list-disc space-y-0.5 ps-4 text-xs">{a.decisions.map((d: string, i: number) => <li key={i}>{d}</li>)}</ul> : <p className="text-xs text-slate-400">{s.t("none_found", "None found")}</p>}</div>
              <div data-testid="ci-requirements"><h4 className="text-xs font-bold text-slate-500">{s.t("requirements", "Requirements")}</h4>{a.requirements.length ? <ul className="mt-1 list-disc space-y-0.5 ps-4 text-xs">{a.requirements.map((d: string, i: number) => <li key={i}>{d}</li>)}</ul> : <p className="text-xs text-slate-400">{s.t("none_found", "None found")}</p>}</div>
            </div>
            <div>
              <h4 className="flex items-center gap-1.5 text-xs font-bold text-slate-500"><CalendarDays className="h-3.5 w-3.5" />{s.t("tasks_title", "Action items & reminders — choose what becomes a task")}</h4>
              {tasks.length === 0 ? <p className="mt-1 text-xs text-slate-400">{s.t("no_actions", "No action items or dated commitments found.")}</p> : (
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full min-w-[720px] text-xs">
                    <tbody>
                      {tasks.map((t, i) => (
                        <tr key={i} data-testid="ci-task" data-kind={t.kind} className="border-t border-slate-100 align-top dark:border-slate-800">
                          <td className="py-1.5 pe-2"><input type="checkbox" data-testid="ci-task-include" checked={!!t.include} onChange={(e) => setTask(i, "include", e.target.checked)} /></td>
                          <td className="py-1.5 pe-2">
                            <input className={INP} value={t.title} onChange={(e) => setTask(i, "title", e.target.value)} />
                            <p className="mt-0.5 text-[10px] text-slate-400">{t.kind === "date" ? s.t("kind_date", "Important date") : `${s.t("kind_action", "Action")}${t.owner ? ` · ${t.owner}` : ""}${t.side === "customer" ? ` · ${s.t("side_customer", "customer's action")}` : t.side === "us" ? ` · ${s.t("side_us", "our action")}` : ""}`}</p>
                          </td>
                          <td className="py-1.5 pe-2"><input type="date" data-testid="ci-task-due" className={`${INP} w-36`} value={t.dueDate ?? ""} onChange={(e) => setTask(i, "dueDate", e.target.value)} /></td>
                          <td className="py-1.5 pe-2">
                            <select data-testid="ci-task-assignee" className={`${INP} w-44`} value={t.assignedTo} onChange={(e) => setTask(i, "assignedTo", e.target.value)}>
                              <option value="">{s.t("responsible", "Responsible…")}</option>
                              {assignees.map((u) => <option key={u.user_id} value={u.user_id}>{u.name ?? u.user_id}</option>)}
                            </select>
                          </td>
                          <td className="py-1.5">{t.priority === "high" && <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">{s.t("urgent", "Urgent")}</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>

          <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-sm font-bold">{s.t("crm_record", "CRM record")}</h3>
            <div className="flex flex-wrap gap-2 text-xs">
              {(["new", "existing", "none"] as const).map((m) => (
                <label key={m} className="inline-flex items-center gap-1"><input type="radio" data-testid={`ci-mode-${m}`} checked={mode === m} onChange={() => setMode(m)} disabled={m === "existing" && !a.inquiryMatches?.length} />{s.t(`mode_${m}`, m)}</label>
              ))}
            </div>
            {mode === "existing" && (
              <select data-testid="ci-inquiry" className={INP} value={inquiryId} onChange={(e) => setInquiryId(e.target.value)}>
                {a.inquiryMatches.map((q: Row) => <option key={q.id} value={q.id}>{q.inquiry_no} · {q.customer_name}{q.company_name ? ` · ${q.company_name}` : ""}</option>)}
              </select>
            )}
            {mode === "new" && (
              <div className="grid grid-cols-1 gap-2">
                {a.customerMatches?.length > 0 && (
                  <L label={s.t("link_customer", "Link to existing customer")}>
                    <select data-testid="ci-customer" className={INP} value={fields.customerId ?? ""} onChange={(e) => setFields({ ...fields, customerId: e.target.value })}>
                      <option value="">{s.t("no_link", "Do not link")}</option>
                      {a.customerMatches.map((c: Row) => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                  </L>
                )}
                {[["customerName", s.t("f_customer", "Customer name")], ["companyName", s.t("f_company", "Company")], ["contactPerson", s.t("f_contact", "Contact person")], ["mobile", s.t("f_mobile", "Mobile")], ["whatsapp", "WhatsApp"], ["email", s.t("f_email", "Email")]].map(([k, l]) => (
                  <L key={k} label={l}><input data-testid={`ci-f-${k}`} className={INP} value={fields[k] ?? ""} onChange={(e) => setFields({ ...fields, [k]: e.target.value })} /></L>
                ))}
              </div>
            )}
            {mode !== "none" && (
              <>
                <L label={s.t("summary", "Summary")}><textarea rows={3} className={INP} value={fields.summary ?? ""} onChange={(e) => setFields({ ...fields, summary: e.target.value })} /></L>
                <L label={s.t("requirements", "Requirements")}><textarea rows={3} className={INP} value={fields.requirements ?? ""} onChange={(e) => setFields({ ...fields, requirements: e.target.value })} /></L>
                <L label={s.t("follow_up", "Follow-up date")}><input type="date" className={INP} value={fields.followUpDate ?? ""} onChange={(e) => setFields({ ...fields, followUpDate: e.target.value })} /></L>
              </>
            )}
            <button type="button" data-testid="ci-confirm" disabled={busy || (mode === "none" && !tasks.some((t) => t.include))} onClick={() => void confirm()} className="w-full rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">
              {busy ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : s.t("confirm", "Confirm & save to ERP")}
            </button>
            <div className="space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800" data-testid="ci-replies">
              <h4 className="text-xs font-bold text-slate-500">{s.t("draft_replies", "Draft replies (not sent)")}</h4>
              <div className="rounded-lg bg-slate-50 p-2 text-[11px] dark:bg-slate-800/60"><b>{a.replies.email.subject}</b><pre className="mt-1 whitespace-pre-wrap font-sans" data-testid="ci-reply-email">{a.replies.email.body}</pre></div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => void copy("email", `${a.replies.email.subject}\n\n${a.replies.email.body}`)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-bold dark:border-slate-700"><ClipboardCopy className="h-3 w-3" />{copied === "email" ? s.t("copied", "Copied") : s.t("copy_email", "Copy email")}</button>
                <button type="button" onClick={() => void copy("wa", a.replies.whatsapp)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-bold dark:border-slate-700"><ClipboardCopy className="h-3 w-3" />{copied === "wa" ? s.t("copied", "Copied") : s.t("copy_whatsapp", "Copy WhatsApp text")}</button>
                {waLink && <a href={waLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 px-2 py-1 text-[11px] font-bold text-emerald-700 dark:border-emerald-800 dark:text-emerald-300"><MessageCircle className="h-3 w-3" />{s.t("open_whatsapp", "Open in WhatsApp (you press send)")}</a>}
              </div>
            </div>
            {source.route && <a href={source.route} className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 hover:underline dark:text-blue-300"><FileText className="h-3 w-3" />{s.t("open_source", "Open source")}</a>}
          </section>
        </div>
      )}
    </section>
  );
}

/** Label + control. Module-level so inputs keep focus while typing. */
function L({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</label>{children}</div>;
}
