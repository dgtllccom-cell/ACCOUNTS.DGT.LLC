"use client";

import { useEffect, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SimpleModal } from "@/components/ui/simple-modal";
import type { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { RELATED_MODULE_ROUTES } from "../lib/shared";

type S = ReturnType<typeof useErpScreen>;

const MODULES = Object.keys(RELATED_MODULE_ROUTES);

export function AssignTaskForm({ s, onClose, onCreated }: { s: S; onClose: () => void; onCreated: () => void }) {
  const [users, setUsers] = useState<{ userId: string; name: string | null; role: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: "",
    description: "",
    instructions: "",
    remarks: "",
    assignedTo: "",
    department: "",
    relatedModule: "",
    relatedRecordLabel: "",
    priority: "normal",
    startDate: "",
    dueAt: "",
  });
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    fetch("/api/erp/user-tasks/assignees", { credentials: "include" })
      .then((r) => r.json())
      .then((j) => { if (j.ok) setUsers(j.data.users || []); })
      .catch(() => {});
  }, []);

  async function submit() {
    setErr(null);
    if (!form.title.trim()) { setErr(s.t("v_title_required", "A task title is required.")); return; }
    if (!form.assignedTo) { setErr(s.t("v_assignee_required", "Select a user to assign the task to.")); return; }
    setBusy(true);
    try {
      const payload: any = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        instructions: form.instructions.trim() || null,
        remarks: form.remarks.trim() || null,
        assignedTo: form.assignedTo,
        department: form.department.trim() || null,
        priority: form.priority,
        startDate: form.startDate || null,
        dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : null,
      };
      if (form.relatedModule) {
        payload.relatedModule = form.relatedModule;
        payload.relatedRoute = RELATED_MODULE_ROUTES[form.relatedModule] || null;
        payload.relatedRecordLabel = form.relatedRecordLabel.trim() || null;
      }
      const r = await fetch("/api/erp/user-tasks", {
        method: "POST", headers: { "content-type": "application/json" }, credentials: "include",
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (j.ok) onCreated();
      else setErr(j.error?.message || s.t("toast_error", "Something went wrong."));
    } catch {
      setErr(s.t("toast_error", "Something went wrong."));
    } finally {
      setBusy(false);
    }
  }

  const inputCls = "w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-300";
  const labelCls = "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500";

  return (
    <SimpleModal title={s.t("assign_task", "Assign Task")} onClose={onClose} className="max-w-[820px] w-[95vw]">
      <div dir={s.dir} className="space-y-3 text-sm">
        {err && <div className="rounded-md bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">{err}</div>}

        <div>
          <label className={labelCls}>{s.t("f_title", "Task Title")} *</label>
          <input className={inputCls} value={form.title} onChange={(e) => set("title", e.target.value)} maxLength={240} />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls}>{s.t("f_assignee", "Assigned User")} *</label>
            <select className={inputCls} value={form.assignedTo} onChange={(e) => set("assignedTo", e.target.value)}>
              <option value="">—</option>
              {users.map((u) => (
                <option key={u.userId} value={u.userId}>{u.name || u.userId.slice(0, 8)} ({u.role})</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>{s.t("f_priority", "Priority")}</label>
            <select className={inputCls} value={form.priority} onChange={(e) => set("priority", e.target.value)}>
              {["low", "normal", "high", "urgent"].map((p) => (
                <option key={p} value={p}>{s.t(`pr_${p}`, p)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>{s.t("f_start_date", "Start Date")}</label>
            <input type="date" className={inputCls} value={form.startDate} onChange={(e) => set("startDate", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>{s.t("f_due", "Due Date / Time")}</label>
            <input type="datetime-local" className={inputCls} value={form.dueAt} onChange={(e) => set("dueAt", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>{s.t("f_department", "Department")}</label>
            <input className={inputCls} value={form.department} onChange={(e) => set("department", e.target.value)} maxLength={120} />
          </div>
          <div>
            <label className={labelCls}>{s.t("f_module", "Related ERP Module / Page")}</label>
            <select className={inputCls} value={form.relatedModule} onChange={(e) => set("relatedModule", e.target.value)}>
              <option value="">—</option>
              {MODULES.map((m) => (
                <option key={m} value={m}>{s.t(`k_${m}`, m.replace(/_/g, " "))}</option>
              ))}
            </select>
          </div>
        </div>

        {form.relatedModule && (
          <div>
            <label className={labelCls}>{s.t("f_record", "Related Record / Entry")}</label>
            <input className={inputCls} value={form.relatedRecordLabel} onChange={(e) => set("relatedRecordLabel", e.target.value)}
              placeholder="e.g. PO-2026-0123 / Bill No / Contract No" maxLength={240} />
          </div>
        )}

        <div>
          <label className={labelCls}>{s.t("f_description", "Description")}</label>
          <textarea rows={2} className={inputCls} value={form.description} onChange={(e) => set("description", e.target.value)} maxLength={4000} />
        </div>
        <div>
          <label className={labelCls}>{s.t("f_instructions", "Instructions")}</label>
          <textarea rows={3} className={inputCls} value={form.instructions} onChange={(e) => set("instructions", e.target.value)} maxLength={8000} />
        </div>
        <div>
          <label className={labelCls}>{s.t("f_remarks", "Remarks")}</label>
          <textarea rows={2} className={inputCls} value={form.remarks} onChange={(e) => set("remarks", e.target.value)} maxLength={4000} />
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
          <Button size="sm" variant="outline" onClick={onClose}>{s.t("cancel", "Cancel")}</Button>
          <Button size="sm" onClick={submit} disabled={busy} className="bg-indigo-600 text-white hover:bg-indigo-700">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {s.t("assign_task", "Assign Task")}
          </Button>
        </div>
      </div>
    </SimpleModal>
  );
}
