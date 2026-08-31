"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  X, Loader2, Paperclip, Link2, UserCheck, ArrowRightLeft, History, Languages,
  CheckCircle2, XCircle, Download, Trash2, ListPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { fmtDate, fmtDateTime, statusTone, type InquiryStatus } from "../lib/shared";

export function InquiryDetailModal({
  inquiryId,
  lang: langProp,
  onClose,
  onChanged,
}: {
  inquiryId: string;
  lang?: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const s = useErpScreen("cinq", langProp);
  const [node, setNode] = useState<HTMLElement | null>(null);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const [tab, setTab] = useState<"detail" | "history">("detail");
  const [assignees, setAssignees] = useState<{ userId: string; name: string | null }[]>([]);
  const [linkQ, setLinkQ] = useState("");
  const [linkResults, setLinkResults] = useState<{ id: string; label: string }[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setNode(document.body); }, []);
  useEffect(() => {
    fetch("/api/erp/customer-inquiries/assignees").then((r) => r.json()).then((d) => setAssignees(d?.data?.assignees ?? [])).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/erp/customer-inquiries/${inquiryId}?original=${showOriginal ? "1" : "0"}`);
      const d = await res.json();
      if (!res.ok || d?.error) throw new Error(d?.error?.message || "load failed");
      setData(d.data);
    } catch (e: any) {
      setErr(e?.message || "Could not load the inquiry.");
    } finally {
      setLoading(false);
    }
  }, [inquiryId, showOriginal]);

  useEffect(() => { void load(); }, [load]);

  const inq = data?.inquiry;

  async function act(path: string, body: any, method = "POST") {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/erp/customer-inquiries/${inquiryId}${path}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const d = await res.json();
      if (!res.ok || d?.error) throw new Error(d?.error?.message || d?.error || "action failed");
      await load();
      onChanged();
      return d.data;
    } catch (e: any) {
      setErr(e?.message || "Action failed.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function searchCustomers(q: string) {
    setLinkQ(q);
    if (q.trim().length < 2) { setLinkResults([]); return; }
    try {
      const res = await fetch(`/api/erp/customers?q=${encodeURIComponent(q)}&limit=8&lang=${s.lang}`);
      const d = await res.json();
      const rows = d?.data?.customers ?? d?.customers ?? [];
      setLinkResults(rows.map((r: any) => ({ id: r.id, label: [r.customer_name || r.name, r.company_name].filter(Boolean).join(" · ") })));
    } catch { setLinkResults([]); }
  }

  async function uploadFile(f: File) {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      fd.append("kind", "doc");
      const res = await fetch(`/api/erp/customer-inquiries/${inquiryId}/attachments`, { method: "POST", body: fd });
      const d = await res.json();
      if (!res.ok || d?.error) throw new Error(d?.error?.message || "upload failed");
      await load();
      onChanged();
    } catch (e: any) {
      setErr(e?.message || "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  if (!node) return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-slate-900/50 p-3 sm:p-6" onClick={onClose}>
      <div
        className="w-full max-w-3xl rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800"
        dir={s.dir}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-black text-slate-900 dark:text-white truncate">{inq?.customer_name || "…"}</span>
              {inq && <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusTone(inq.status as InquiryStatus)}`}>{s.t(`status_${inq.status}`, inq.status)}</span>}
            </div>
            <span className="text-[11px] text-slate-400 font-mono">{inq?.inquiry_no}</span>
          </div>
          <div className="flex items-center gap-1">
            <Button type="button" size="sm" variant={showOriginal ? "default" : "outline"} className="h-7 gap-1 text-[11px]" onClick={() => setShowOriginal((v) => !v)}>
              <Languages className="h-3.5 w-3.5" /> {showOriginal ? s.t("viewing_original", "Original") : s.t("view_original", "View Original")}
            </Button>
            <button type="button" onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700"><X className="h-4 w-4" /></button>
          </div>
        </div>

        <div className="flex gap-1 border-b border-slate-100 dark:border-slate-800 px-4 text-xs font-bold">
          <button type="button" onClick={() => setTab("detail")} className={`py-2 px-1 border-b-2 ${tab === "detail" ? "border-blue-500 text-blue-600" : "border-transparent text-slate-500"}`}>{s.t("tab_detail", "Detail")}</button>
          <button type="button" onClick={() => setTab("history")} className={`py-2 px-1 border-b-2 flex items-center gap-1 ${tab === "history" ? "border-blue-500 text-blue-600" : "border-transparent text-slate-500"}`}><History className="h-3 w-3" />{s.t("tab_history", "Audit History")}</button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-4">
          {loading && <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>}
          {err && <p className="mb-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 px-3 py-2 text-[11px] font-bold text-rose-700 dark:text-rose-300">{err}</p>}

          {!loading && inq && tab === "detail" && (
            <div className="space-y-4 text-sm">
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-[12.5px]">
                <Row s={s} k="f_company" v={inq.company_name} />
                <Row s={s} k="f_contact_person" v={inq.contact_person} />
                <Row s={s} k="f_mobile" v={inq.mobile} mono />
                <Row s={s} k="f_whatsapp" v={inq.whatsapp} mono />
                <Row s={s} k="f_email" v={inq.email} mono />
                <Row s={s} k="f_business_type" v={inq.business_type} />
                <Row s={s} k="f_source" v={s.t(`source_${inq.source}`, inq.source)} />
                <Row s={s} k="f_inquiry_date" v={fmtDate(inq.inquiry_date)} />
                <Row s={s} k="f_follow_up" v={fmtDate(inq.follow_up_date)} tone={inq.follow_up_overdue ? "text-rose-600 font-bold" : ""} />
                <Row s={s} k="f_assigned_to" v={inq.assignee_name} />
                <Row s={s} k="scope" v={[inq.country_name, inq.country_branch_name, inq.city_branch_name].filter(Boolean).join(" › ")} />
                <Row s={s} k="f_customer_link" v={inq.customer_id ? (inq.linked_customer_name || s.t("linked", "Linked")) : s.t("not_linked", "Not linked")} tone={inq.customer_id ? "text-emerald-600 font-bold" : ""} />
              </dl>

              {inq.address && <Block s={s} k="f_address" v={inq.address} />}
              {inq.inquiry_summary && <Block s={s} k="f_summary" v={inq.inquiry_summary} />}
              {inq.meeting_notes && <Block s={s} k="f_meeting_notes" v={inq.meeting_notes} />}
              {inq.requirements && <Block s={s} k="f_requirements" v={inq.requirements} />}
              {showOriginal && inq.ai_raw_input && (
                <Block s={s} k="ai_raw" v={inq.ai_raw_input} />
              )}

              {/* attachments */}
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1"><Paperclip className="h-3 w-3" />{s.t("attachments", "Attachments")} ({inq.attachments?.length ?? 0})</span>
                  {inq.canEdit && (
                    <>
                      <input ref={fileRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadFile(f); e.currentTarget.value = ""; }} />
                      <Button type="button" size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => fileRef.current?.click()} disabled={busy}>{s.t("upload", "Upload")}</Button>
                    </>
                  )}
                </div>
                <div className="mt-1 space-y-1">
                  {(inq.attachments ?? []).map((a: any) => (
                    <div key={a.id} className="flex items-center gap-2 rounded-md bg-slate-50 dark:bg-slate-800 px-2 py-1 text-[11px]">
                      <a href={`/api/erp/customer-inquiries/${inquiryId}/attachments/${a.id}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-blue-600 hover:underline truncate">
                        <Download className="h-3 w-3" /> {a.name}
                      </a>
                      <span className="text-slate-400 ms-auto">{a.uploader_name || ""}</span>
                      {inq.canEdit && (
                        <button type="button" className="text-slate-400 hover:text-rose-500" onClick={() => act(`/attachments?attachmentId=${a.id}`, null, "DELETE")}><Trash2 className="h-3 w-3" /></button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* workflow actions */}
              {inq.canEdit && (
                <div className="space-y-2 rounded-xl border border-slate-200 dark:border-slate-800 p-3">
                  <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">{s.t("workflow", "Workflow")}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {(inq.allowedNextStatuses ?? []).map((st: string) => (
                      <Button key={st} type="button" size="sm" variant="outline" className="h-7 text-[11px]" disabled={busy}
                        onClick={() => act("/status", { to: st, ...(st === "lost" ? { lostReason: window.prompt(s.t("lost_reason", "Reason for lost inquiry?")) || "" } : {}) })}>
                        {s.t(`to_${st}`, `→ ${st}`)}
                      </Button>
                    ))}
                  </div>

                  {/* customer approval */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[10.5px] text-slate-500">{s.t("customer_approval", "Customer Approval")}: <b>{s.t(`appr_${inq.customer_approval_status}`, inq.customer_approval_status)}</b></span>
                    <Button type="button" size="sm" variant="ghost" className="h-6 text-[10px] text-emerald-600" disabled={busy} onClick={() => act("/customer-approval", { status: "approved", note: window.prompt(s.t("appr_note", "Approval note (optional)")) })}><CheckCircle2 className="h-3 w-3 me-0.5" />{s.t("appr_approve", "Approved")}</Button>
                    <Button type="button" size="sm" variant="ghost" className="h-6 text-[10px] text-rose-600" disabled={busy} onClick={() => act("/customer-approval", { status: "declined", note: window.prompt(s.t("decl_note", "Reason")) })}><XCircle className="h-3 w-3 me-0.5" />{s.t("appr_decline", "Declined")}</Button>
                  </div>

                  {/* link / convert */}
                  <div className="pt-1">
                    {!inq.customer_id ? (
                      <>
                        <input value={linkQ} onChange={(e) => void searchCustomers(e.target.value)} placeholder={s.t("link_search", "Search existing customer to link…")} className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1 text-[11px]" />
                        {linkResults.length > 0 && (
                          <div className="mt-1 space-y-0.5">
                            {linkResults.map((r) => (
                              <button key={r.id} type="button" className="flex w-full items-center gap-1 rounded px-2 py-1 text-[11px] hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => act("/link-customer", { customerId: r.id })}>
                                <Link2 className="h-3 w-3 text-emerald-500" /> {r.label}
                              </button>
                            ))}
                          </div>
                        )}
                        <Button type="button" size="sm" variant="outline" className="mt-1.5 h-7 w-full text-[11px] gap-1" disabled={busy} onClick={() => act("/link-customer", { convert: true })}>
                          <ArrowRightLeft className="h-3 w-3" /> {s.t("convert_new", "Convert to a NEW Customer Master")}
                        </Button>
                      </>
                    ) : (
                      !inq.converted_customer_id && (
                        <Button type="button" size="sm" variant="outline" className="h-7 w-full text-[11px] gap-1" disabled={busy} onClick={() => act("/link-customer", { convert: true })}>
                          <UserCheck className="h-3 w-3" /> {s.t("mark_converted", "Mark as Converted")}
                        </Button>
                      )
                    )}
                  </div>

                  {/* follow-up task */}
                  {!inq.linked_task_id && inq.isManager && (
                    <div className="flex items-center gap-1.5 pt-1">
                      <select id="ci-fu-assignee" className="flex-1 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1 text-[11px]">
                        {assignees.map((a) => <option key={a.userId} value={a.userId}>{a.name || a.userId.slice(0, 8)}</option>)}
                      </select>
                      <Button type="button" size="sm" variant="outline" className="h-7 text-[11px] gap-1" disabled={busy}
                        onClick={() => {
                          const el = document.getElementById("ci-fu-assignee") as HTMLSelectElement | null;
                          if (el?.value) act("/followup-task", { assignedTo: el.value });
                        }}>
                        <ListPlus className="h-3 w-3" /> {s.t("create_task", "Create Follow-up Task")}
                      </Button>
                    </div>
                  )}
                  {inq.linked_task_id && (
                    <a href={`/dashboard/user-tasks?id=${inq.linked_task_id}`} className="text-[10.5px] text-blue-600 hover:underline flex items-center gap-1"><ListPlus className="h-3 w-3" />{s.t("open_task", "Open the linked follow-up task")}</a>
                  )}
                </div>
              )}
            </div>
          )}

          {!loading && inq && tab === "history" && (
            <ol className="space-y-2">
              {(inq.events ?? []).map((e: any) => (
                <li key={e.id} className="flex gap-2 text-[11.5px]">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-400" />
                  <div>
                    <span className="font-bold text-slate-700 dark:text-slate-200">{s.t(`ev_${e.event_type}`, e.event_type)}</span>
                    {e.to_status && <span className="text-slate-400"> → {s.t(`status_${e.to_status}`, e.to_status)}</span>}
                    {e.note && <span className="text-slate-500"> — {e.note}</span>}
                    <div className="text-[10px] text-slate-400">{e.actor_display || ""} · {fmtDateTime(e.created_at)}</div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>,
    node,
  );
}

function Row({ s, k, v, mono, tone }: { s: any; k: string; v: any; mono?: boolean; tone?: string }) {
  return (
    <div className="flex justify-between gap-2 border-b border-slate-50 dark:border-slate-800/60 py-1">
      <dt className="text-slate-400">{s.t(k, k)}</dt>
      <dd className={`text-end text-slate-800 dark:text-slate-200 ${mono ? "font-mono" : ""} ${tone || ""}`}>{v || "—"}</dd>
    </div>
  );
}

function Block({ s, k, v }: { s: any; k: string; v: string }) {
  return (
    <div>
      <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">{s.t(k, k)}</span>
      <p className="mt-0.5 whitespace-pre-wrap rounded-lg bg-slate-50 dark:bg-slate-800 px-3 py-2 text-[12.5px] text-slate-700 dark:text-slate-200" dir="auto">{v}</p>
    </div>
  );
}
