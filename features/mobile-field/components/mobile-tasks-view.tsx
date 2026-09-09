"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Play, Check, AlertCircle, Clock, X } from "lucide-react";
import { apiGet, apiFetch } from "@/lib/api/client";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { MobileFieldShell } from "./mobile-field-shell";

type TaskRow = {
  id: string;
  task_no?: string;
  title: string;
  description?: string | null;
  instructions?: string | null;
  status: "new" | "accepted" | "in_progress" | "waiting" | "completed" | "verified" | "returned" | "cancelled";
  priority?: "low" | "normal" | "high" | "urgent" | null;
  due_at?: string | null;
  created_at?: string | null;
};

export function MobileTasksView({ langProp }: { langProp?: SupportedLanguage }) {
  const s = useErpScreen("mfield", langProp);

  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"pending" | "completed" | "all">("pending");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  async function loadTasks() {
    setLoading(true);
    try {
      const res = await apiGet<{ rows: TaskRow[] }>("/api/erp/user-tasks?scope=my");
      setTasks(res.rows ?? []);
    } catch {
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTasks();
  }, []);

  async function doTransition(id: string, action: "accept" | "start" | "complete", note?: string) {
    setBusyId(id);
    setMsg(null);
    try {
      await apiFetch(`/api/erp/user-tasks/${id}/transition`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, note: note || undefined }),
      });
      setMsg({ tone: "ok", text: s.t("saved_ok", "Saved successfully") });
      loadTasks();
    } catch (err: any) {
      setMsg({ tone: "err", text: err?.message || "Task update failed" });
    } finally {
      setBusyId(null);
    }
  }

  const filtered = tasks.filter((t) => {
    if (tab === "completed") return t.status === "completed" || t.status === "verified";
    if (tab === "pending") return t.status !== "completed" && t.status !== "verified" && t.status !== "cancelled";
    return true;
  });

  return (
    <MobileFieldShell title={s.t("menu_tasks", "Assigned Tasks")} langProp={langProp} showBack>
      {msg ? (
        <div
          className={`mb-3 flex items-center justify-between rounded-xl p-3 text-xs font-bold ${
            msg.tone === "ok"
              ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
              : "bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
          }`}
        >
          <span>{msg.text}</span>
          <button type="button" onClick={() => setMsg(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {/* Tabs */}
      <div className="flex rounded-xl bg-slate-200/70 p-1 dark:bg-slate-800">
        <button
          type="button"
          onClick={() => setTab("pending")}
          className={`flex-1 rounded-lg py-2 text-xs font-bold transition ${
            tab === "pending"
              ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100"
              : "text-slate-600 dark:text-slate-400"
          }`}
        >
          {s.t("tasks_pending", "Pending / In Progress")}
        </button>
        <button
          type="button"
          onClick={() => setTab("completed")}
          className={`flex-1 rounded-lg py-2 text-xs font-bold transition ${
            tab === "completed"
              ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100"
              : "text-slate-600 dark:text-slate-400"
          }`}
        >
          {s.t("tasks_completed", "Completed")}
        </button>
        <button
          type="button"
          onClick={() => setTab("all")}
          className={`flex-1 rounded-lg py-2 text-xs font-bold transition ${
            tab === "all"
              ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100"
              : "text-slate-600 dark:text-slate-400"
          }`}
        >
          {s.t("tasks_all", "All Tasks")}
        </button>
      </div>

      {loading ? (
        <p className="mt-6 text-center text-sm text-slate-400">{s.t("loading", "Loading…")}</p>
      ) : filtered.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-200 p-8 text-center dark:border-slate-800">
          <CheckCircle2 className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600" />
          <p className="mt-2 text-sm text-slate-500">
            {tab === "completed"
              ? s.t("tasks_completed", "Completed")
              : s.t("no_records", "No inspections recorded yet")}
          </p>
        </div>
      ) : (
        <ul className="mt-3 grid gap-3">
          {filtered.map((t) => {
            const isBusy = busyId === t.id;
            return (
              <li
                key={t.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                    {t.task_no || "TASK"}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      t.status === "completed" || t.status === "verified"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                        : t.status === "in_progress"
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
                        : "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
                    }`}
                  >
                    {t.status.toUpperCase()}
                  </span>
                </div>

                <h3 className="mt-1 font-black text-slate-900 dark:text-slate-100">
                  {t.title}
                </h3>

                {t.instructions ? (
                  <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-300">
                    {t.instructions}
                  </p>
                ) : t.description ? (
                  <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                    {t.description}
                  </p>
                ) : null}

                {/* Workflow action buttons */}
                <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                  {t.status === "new" || t.status === "returned" ? (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => doTransition(t.id, "accept")}
                      className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-blue-600 text-xs font-bold text-white shadow-sm active:scale-95 disabled:opacity-50"
                    >
                      <Check className="h-4 w-4" />
                      <span>{s.t("task_accept", "Accept")}</span>
                    </button>
                  ) : null}

                  {t.status === "accepted" || t.status === "waiting" ? (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => doTransition(t.id, "start")}
                      className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 text-xs font-bold text-white shadow-sm active:scale-95 disabled:opacity-50"
                    >
                      <Play className="h-4 w-4" />
                      <span>{s.t("task_start", "Start Work")}</span>
                    </button>
                  ) : null}

                  {t.status === "in_progress" ? (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => doTransition(t.id, "complete", "Finished on site by field user")}
                      className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 text-xs font-bold text-white shadow-sm active:scale-95 disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      <span>{s.t("task_complete", "Mark Done")}</span>
                    </button>
                  ) : null}

                  {t.status === "completed" || t.status === "verified" ? (
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      ✓ {s.t("tasks_completed", "Completed")}
                    </span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </MobileFieldShell>
  );
}
