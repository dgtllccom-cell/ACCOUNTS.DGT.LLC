"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2, RotateCcw, Play, Pause, Flag, ShieldCheck, XCircle, Link2,
  Paperclip, MessageSquarePlus, Loader2, Clock, ArrowRight, FileText
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SimpleModal } from "@/components/ui/simple-modal";
import type { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { fmtDate, fmtDateTime, priorityTone, statusTone, type TaskStatus } from "../lib/shared";

type S = ReturnType<typeof useErpScreen>;

type Transition = "accept" | "start" | "hold" | "resume" | "complete" | "verify" | "return" | "reopen" | "cancel";

type Detail = {
  task: any;
  events: any[];
  attachments: any[];
  relatedRecord: any;
  permissions: { isAssignee: boolean; isManager: boolean; transitions: Transition[] };
};

const EVENT_ICON: Record<string, any> = {
  created: FileText, assigned: ArrowRight, accepted: CheckCircle2, started: Play, waiting: Pause,
  progress_note: MessageSquarePlus, comment: MessageSquarePlus, attachment_added: Paperclip,
  evidence_linked: Link2, completed: Flag, returned: RotateCcw, verified: ShieldCheck,
  due_changed: Clock, priority_changed: Flag, cancelled: XCircle,
};

export function TaskDetailModal({
  taskId, s, onClose, onChanged,
}: {
  taskId: string;
  s: S;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [completionNote, setCompletionNote] = useState("");
  const [evidenceRef, setEvidenceRef] = useState("");
  const [returnReason, setReturnReason] = useState("");
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/erp/user-tasks/${taskId}`, { credentials: "include" });
      const j = await r.json();
      if (j.ok && j.data?.task) setData(j.data);
      else if (j.ok && j.data?.setupPending) setData(null);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => { load(); }, [load]);

  const flash = (text: string, ok = true) => {
    setToast({ text, ok });
    setTimeout(() => setToast(null), 2600);
  };

  async function doTransition(action: Transition) {
    setBusy(action);
    try {
      const body: any = { action };
      if (action === "complete") { body.note = completionNote.trim() || null; if (evidenceRef.trim()) { body.evidenceRef = evidenceRef.trim(); } }
      if (action === "return") body.returnReason = returnReason.trim() || null;
      if (action === "verify") body.note = note.trim() || null;
      const r = await fetch(`/api/erp/user-tasks/${taskId}/transition`, {
        method: "POST", headers: { "content-type": "application/json" }, credentials: "include",
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (j.ok) {
        flash(s.t("toast_status", "Status updated."));
        setCompletionNote(""); setEvidenceRef(""); setReturnReason(""); setNote("");
        await load();
        onChanged();
      } else {
        flash(j.error?.message || s.t("toast_error", "Something went wrong."), false);
      }
    } catch {
      flash(s.t("toast_error", "Something went wrong."), false);
    } finally {
      setBusy(null);
    }
  }

  async function uploadFile(file: File, kind: "instruction" | "evidence") {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("kind", kind);
      const r = await fetch(`/api/erp/user-tasks/${taskId}/attachments`, { method: "POST", credentials: "include", body: fd });
      const j = await r.json();
      if (j.ok) { flash(s.t("toast_saved", "Saved.")); await load(); onChanged(); }
      else flash(j.error?.message || s.t("toast_error", "Something went wrong."), false);
    } catch {
      flash(s.t("toast_error", "Something went wrong."), false);
    } finally {
      setUploading(false);
    }
  }

  async function removeAttachment(attachmentId: string) {
    try {
      const r = await fetch(`/api/erp/user-tasks/${taskId}/attachments?attachmentId=${attachmentId}`, { method: "DELETE", credentials: "include" });
      const j = await r.json();
      if (j.ok) { await load(); onChanged(); }
      else flash(j.error?.message || s.t("toast_error", "Something went wrong."), false);
    } catch {
      flash(s.t("toast_error", "Something went wrong."), false);
    }
  }

  async function addNote() {
    if (!note.trim()) return;
    setBusy("note");
    try {
      const r = await fetch(`/api/erp/user-tasks/${taskId}/notes`, {
        method: "POST", headers: { "content-type": "application/json" }, credentials: "include",
        body: JSON.stringify({ note: note.trim(), kind: "progress_note" }),
      });
      const j = await r.json();
      if (j.ok) { setNote(""); flash(s.t("toast_saved", "Saved.")); await load(); onChanged(); }
      else flash(j.error?.message || s.t("toast_error", "Something went wrong."), false);
    } finally { setBusy(null); }
  }

  const t = data?.task;
  const perm = data?.permissions;
  const trans = perm?.transitions ?? [];

  const TRANS_META: Record<Transition, { icon: any; labelKey: string; fallback: string; cls: string }> = {
    accept: { icon: CheckCircle2, labelKey: "act_accept", fallback: "Accept", cls: "bg-sky-600 hover:bg-sky-700 text-white" },
    start: { icon: Play, labelKey: "act_start", fallback: "Start Work", cls: "bg-indigo-600 hover:bg-indigo-700 text-white" },
    resume: { icon: Play, labelKey: "act_resume", fallback: "Resume", cls: "bg-indigo-600 hover:bg-indigo-700 text-white" },
    hold: { icon: Pause, labelKey: "act_hold", fallback: "Put on Hold", cls: "bg-amber-500 hover:bg-amber-600 text-white" },
    complete: { icon: Flag, labelKey: "act_complete", fallback: "Mark Complete", cls: "bg-blue-600 hover:bg-blue-700 text-white" },
    verify: { icon: ShieldCheck, labelKey: "act_verify", fallback: "Verify", cls: "bg-emerald-600 hover:bg-emerald-700 text-white" },
    return: { icon: RotateCcw, labelKey: "act_return", fallback: "Return for Rework", cls: "bg-rose-600 hover:bg-rose-700 text-white" },
    reopen: { icon: RotateCcw, labelKey: "act_reopen", fallback: "Reopen", cls: "bg-slate-600 hover:bg-slate-700 text-white" },
    cancel: { icon: XCircle, labelKey: "act_cancel", fallback: "Cancel Task", cls: "border border-rose-300 text-rose-700 hover:bg-rose-50" },
  };

  return (
    <SimpleModal
      title={t ? `${t.task_no ?? ""} — ${t.title}` : s.t("original_task", "Task Details")}
      onClose={onClose}
      className="max-w-[1080px] w-[96vw]"
    >
      <div dir={s.dir} className="space-y-4 text-sm">
        {toast && (
          <div className={`rounded-md px-3 py-2 text-xs font-medium ${toast.ok ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
            {toast.text}
          </div>
        )}

        {loading && <div className="flex items-center justify-center py-10 text-slate-400"><Loader2 className="h-5 w-5 animate-spin" /></div>}

        {!loading && !t && (
          <div className="py-10 text-center text-slate-400">
            <FileText className="mx-auto mb-3 h-8 w-8 opacity-20" />
            {s.t("toast_error", "Something went wrong.")}
          </div>
        )}

        {!loading && t && (
          <>
            {/* task summary */}
            <Card className="border-t-4 border-t-indigo-500 shadow-sm">
              <CardHeader className="border-b border-slate-100 bg-slate-50 px-3 py-2">
                <CardTitle className="flex items-center gap-1.5 text-xs font-bold uppercase text-slate-600">
                  <FileText className="h-3.5 w-3.5" /> {s.t("original_task", "Task Details")}
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-x-6 gap-y-2 p-3 sm:grid-cols-2 lg:grid-cols-3">
                <Field label={s.t("col_status", "Status")}>
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${statusTone(t.status as TaskStatus)}`}>
                    {s.t(`st_${t.status}`, t.status)}
                  </span>
                </Field>
                <Field label={s.t("col_priority", "Priority")}>
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${priorityTone(t.priority)}`}>
                    {s.t(`pr_${t.priority}`, t.priority)}
                  </span>
                </Field>
                <Field label={s.t("col_due", "Due")}>
                  <span className={t.is_overdue ? "font-semibold text-rose-600" : ""}>{fmtDateTime(t.due_at)}</span>
                </Field>
                <Field label={s.t("col_assignee", "Assignee")}>{t.assignee_name || "—"}</Field>
                <Field label={s.t("col_assigned_by", "Assigned By")}>{t.creator_name || "—"}</Field>
                <Field label={s.t("f_department", "Department")}>{t.department || "—"}</Field>
                <Field label={s.t("col_country", "Country")}>{t.country_name || "—"}</Field>
                <Field label={s.t("col_branch", "Branch")}>{t.city_branch_name || t.country_branch_name || "—"}</Field>
                <Field label={s.t("f_start_date", "Start Date")}>{fmtDate(t.start_date)}</Field>
                {t.description && <div className="sm:col-span-2 lg:col-span-3"><Field label={s.t("f_description", "Description")}><p className="whitespace-pre-wrap">{t.description}</p></Field></div>}
                {t.instructions && <div className="sm:col-span-2 lg:col-span-3"><Field label={s.t("f_instructions", "Instructions")}><p className="whitespace-pre-wrap text-slate-600">{t.instructions}</p></Field></div>}
                {t.remarks && <div className="sm:col-span-2 lg:col-span-3"><Field label={s.t("f_remarks", "Remarks")}><p className="whitespace-pre-wrap text-slate-600">{t.remarks}</p></Field></div>}
              </CardContent>
            </Card>

            {/* linked ERP record */}
            {t.related_module && (
              <Card className="border-t-4 border-t-sky-400 shadow-sm">
                <CardHeader className="border-b border-slate-100 bg-slate-50 px-3 py-2">
                  <CardTitle className="flex items-center gap-1.5 text-xs font-bold uppercase text-slate-600">
                    <Link2 className="h-3.5 w-3.5" /> {s.t("linked_record", "Linked ERP Record")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-1 p-3">
                  <Field label={s.t("col_module", "Module")}>{s.t(`mod_${t.related_module}`, t.related_module.replace(/_/g, " "))}</Field>
                  {t.related_record_label && <Field label={s.t("f_record", "Related Record / Entry")}>{t.related_record_label}</Field>}
                  {data?.relatedRecord?.ref_no && <Field label={s.t("f_ref", "Ref")}>{data.relatedRecord.ref_no}</Field>}
                  {data?.relatedRecord?.ref_amount != null && <Field label={s.t("f_amount", "Amount")}>{Number(data.relatedRecord.ref_amount).toLocaleString()}</Field>}
                  {t.related_route && (
                    <a href={t.related_route} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline">
                      {s.t("open", "Open")} <ArrowRight className="h-3 w-3" />
                    </a>
                  )}
                </CardContent>
              </Card>
            )}

            {/* workflow actions */}
            {trans.length > 0 && (
              <Card className="border-t-4 border-t-amber-400 shadow-sm">
                <CardHeader className="border-b border-slate-100 bg-slate-50 px-3 py-2">
                  <CardTitle className="text-xs font-bold uppercase text-slate-600">{s.t("col_actions", "Actions")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 p-3">
                  {trans.includes("complete") && (
                    <div className="space-y-2 rounded-md border border-slate-200 p-2">
                      <label className="text-[11px] font-semibold uppercase text-slate-500">{s.t("evidence", "Work Evidence")}</label>
                      <textarea
                        value={completionNote} onChange={(e) => setCompletionNote(e.target.value)}
                        placeholder={s.t("completion_note_ph", "What was done? Link the ERP record if any…")}
                        rows={2}
                        className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                      />
                      <input
                        value={evidenceRef} onChange={(e) => setEvidenceRef(e.target.value)}
                        placeholder={s.t("linked_record", "Linked ERP Record") + " (ref / no.)"}
                        className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                      />
                    </div>
                  )}
                  {trans.includes("return") && (
                    <textarea
                      value={returnReason} onChange={(e) => setReturnReason(e.target.value)}
                      placeholder={s.t("return_reason_ph", "Reason for returning the task…")}
                      rows={2}
                      className="w-full rounded border border-rose-200 px-2 py-1 text-sm"
                    />
                  )}
                  <div className="flex flex-wrap gap-2">
                    {trans.map((a) => {
                      const m = TRANS_META[a];
                      const Icon = m.icon;
                      return (
                        <button
                          key={a}
                          disabled={!!busy}
                          onClick={() => doTransition(a)}
                          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${m.cls}`}
                        >
                          {busy === a ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
                          {s.t(m.labelKey, m.fallback)}
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* attachments / evidence files */}
            <Card className="shadow-sm">
              <CardHeader className="border-b border-slate-100 bg-slate-50 px-3 py-2">
                <CardTitle className="flex items-center gap-1.5 text-xs font-bold uppercase text-slate-600">
                  <Paperclip className="h-3.5 w-3.5" /> {s.t("f_attachments", "Attachments")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 p-3">
                {(!data?.attachments || data.attachments.length === 0) && (
                  <p className="py-2 text-center text-xs text-slate-400">{s.t("no_evidence", "No evidence submitted yet.")}</p>
                )}
                {(data?.attachments ?? []).map((a) => (
                  <div key={a.id} className="flex items-center gap-2 rounded border border-slate-200 px-2 py-1.5 text-xs">
                    <FileText className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <a
                      href={`/api/erp/user-tasks/${taskId}/attachments/${a.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="min-w-0 flex-1 truncate font-medium text-indigo-600 hover:underline"
                    >
                      {a.name}
                    </a>
                    <span className="shrink-0 text-[10px] text-slate-400">
                      {a.kind === "instruction" ? s.t("f_instructions", "Instructions") : s.t("evidence", "Work Evidence")}
                      {a.size_bytes ? ` · ${Math.max(1, Math.round(a.size_bytes / 1024))} KB` : ""}
                    </span>
                    <button
                      onClick={() => removeAttachment(a.id)}
                      aria-label={s.tGlobal("common.delete", "Delete")}
                      className="shrink-0 rounded p-0.5 text-slate-300 hover:bg-rose-50 hover:text-rose-500"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                <label className="mt-1 flex cursor-pointer items-center justify-center gap-1.5 rounded-md border border-dashed border-slate-300 px-3 py-2 text-xs font-semibold text-slate-500 hover:border-indigo-300 hover:text-indigo-600">
                  {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />}
                  {uploading ? s.t("saving", "Saving…") : s.t("act_add_evidence", "Add Evidence")}
                  <input
                    type="file"
                    className="hidden"
                    disabled={uploading}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f, perm?.isManager ? "instruction" : "evidence"); e.target.value = ""; }}
                  />
                </label>
              </CardContent>
            </Card>

            {/* progress note */}
            <Card className="shadow-sm">
              <CardContent className="space-y-2 p-3">
                <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase text-slate-500">
                  <MessageSquarePlus className="h-3.5 w-3.5" /> {s.t("act_add_note", "Add Progress Note")}
                </label>
                <textarea
                  value={note} onChange={(e) => setNote(e.target.value)}
                  placeholder={s.t("note_ph", "Write a progress note or comment…")}
                  rows={2}
                  className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                />
                <div className="flex justify-end">
                  <Button size="sm" onClick={addNote} disabled={busy === "note" || !note.trim()} className="h-7 bg-slate-700 text-white hover:bg-slate-800">
                    {busy === "note" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : s.t("save", "Save")}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* history */}
            <Card className="shadow-sm">
              <CardHeader className="border-b border-slate-100 bg-slate-50 px-3 py-2">
                <CardTitle className="text-xs font-bold uppercase text-slate-600">{s.t("history", "Status & Audit History")}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {(!data?.events || data.events.length === 0) && (
                  <p className="py-6 text-center text-xs text-slate-400">{s.t("no_history", "No history yet.")}</p>
                )}
                <ol className="divide-y divide-slate-100">
                  {(data?.events ?? []).slice().reverse().map((e) => {
                    const Icon = EVENT_ICON[e.event_type] || Clock;
                    return (
                      <li key={e.id} className="flex items-start gap-2 px-3 py-2">
                        <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline gap-x-2">
                            <span className="text-xs font-semibold text-slate-700">
                              {s.t(`ev_${e.event_type}`, e.event_type.replace(/_/g, " "))}
                            </span>
                            {e.from_status && e.to_status && (
                              <span className="text-[11px] text-slate-400">{e.from_status} → {e.to_status}</span>
                            )}
                            <span className="text-[11px] text-slate-400">· {e.actor_name || "—"} · {fmtDateTime(e.created_at)}</span>
                          </div>
                          {e.note && <p className="mt-0.5 whitespace-pre-wrap text-xs text-slate-600">{e.note}</p>}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </CardContent>
            </Card>
          </>
        )}

        <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
          <Button size="sm" variant="outline" onClick={onClose}>{s.t("close", "Close")}</Button>
        </div>
      </div>
    </SimpleModal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      <div className="text-sm text-slate-800">{children}</div>
    </div>
  );
}
