/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

/**
 * Employee Performance & Appraisal. Goals / KPIs with target + actual per review period; system
 * KPIs (task completion, on-time tasks, attendance rate) come from the real User Tasks and
 * attendance records. Manager review → employee acknowledgement → HR close; follow-ups are tasks.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Award, CheckCircle2, Loader2, Plus, RefreshCw, Target, Trash2, X } from "lucide-react";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { apiGet, apiPatch, apiPost } from "@/lib/api/client";
import { Th } from "@/components/ui/translated-th";
import { UniversalPrintActionButton } from "@/components/reports/universal-print-action-button";

type Row = Record<string, any>;
type Tab = "list" | "mine" | "report";
const INP = "w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 dark:border-slate-700 dark:bg-slate-800";
const KPI_TYPES = ["manual", "task_completion", "task_on_time", "attendance_rate"] as const;
const STATUS_TONE: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  submitted: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
  acknowledged: "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
  closed: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  cancelled: "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300",
};
const BAND_TONE: Record<string, string> = {
  outstanding: "text-emerald-700 dark:text-emerald-300",
  exceeds: "text-teal-700 dark:text-teal-300",
  meets: "text-blue-700 dark:text-blue-300",
  needs_improvement: "text-amber-700 dark:text-amber-300",
  unsatisfactory: "text-rose-700 dark:text-rose-300",
};
function currentQuarter() {
  const d = new Date();
  return `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`;
}

export function PerformanceAppraisalView({ lang }: { lang?: string }) {
  const s = useErpScreen("perf", lang);
  const params = useSearchParams();
  const [tab, setTab] = useState<Tab>("list");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [period, setPeriod] = useState("");
  const [status, setStatus] = useState("");
  const [openId, setOpenId] = useState<string | null>(params?.get("appraisal") ?? null);
  const [showNew, setShowNew] = useState(false);

  const statusLabel = useCallback((st: string) => s.t(`st_${st}`, st), [s]);
  const bandLabel = useCallback((b: string | null) => (b ? s.t(`band_${b}`, b) : "—"), [s]);

  const load = useCallback(async () => {
    if (tab === "report") { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams();
      if (tab === "mine") q.set("mine", "1");
      if (period) q.set("period", period);
      if (status) q.set("status", status);
      setRows((await apiGet<{ appraisals: Row[] }>(`/api/erp/hr/appraisals?${q}`)).appraisals ?? []);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  }, [tab, period, status]);
  useEffect(() => { void load(); }, [load]);

  const periods = useMemo(() => [...new Set(rows.map((r) => r.period_label))].sort().reverse(), [rows]);

  return (
    <div dir={s.dir} className="space-y-4" data-testid="perf-view">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-700 text-white"><Award className="h-5 w-5" /></div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">{s.t("title", "Employee Performance & Appraisal")}</h1>
            <p className="text-xs text-slate-500">{s.t("subtitle", "Goals and KPIs per review period, manager review, employee acknowledgement and improvement plans. Task and attendance KPIs come from the real User Tasks and attendance records.")}</p>
          </div>
        </div>
        <button type="button" data-testid="perf-new" onClick={() => setShowNew(true)} className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-700 px-3.5 py-2 text-xs font-bold text-white hover:bg-indigo-800">
          <Plus className="h-4 w-4" /> {s.t("new", "New appraisal")}
        </button>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2 dark:border-slate-800">
        {([["list", s.t("tab_list", "Appraisals")], ["mine", s.t("tab_mine", "My appraisals")], ["report", s.t("tab_report", "Quarterly / annual report")]] as Array<[Tab, string]>).map(([id, label]) => (
          <button key={id} type="button" data-testid={`perf-tab-${id}`} onClick={() => { setTab(id); setOpenId(null); }}
            className={`rounded-xl px-4 py-2 text-xs font-bold ${tab === id ? "bg-indigo-700 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"}`}>{label}</button>
        ))}
      </div>
      {error && <p data-testid="perf-error" className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p>}
      {notice && <p data-testid="perf-notice" className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">{notice}</p>}

      {tab === "report" ? (
        <ReportTab s={s} bandLabel={bandLabel} statusLabel={statusLabel} setError={setError} />
      ) : openId ? (
        <AppraisalDetail s={s} id={openId} onClose={() => { setOpenId(null); void load(); }} statusLabel={statusLabel} bandLabel={bandLabel} setError={setError} setNotice={setNotice} />
      ) : (
        <section className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3 dark:border-slate-800">
            <select value={period} onChange={(e) => setPeriod(e.target.value)} className={`${INP} w-40`}>
              <option value="">{s.t("all_periods", "All periods")}</option>
              {periods.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={`${INP} w-40`}>
              <option value="">{s.t("all_status", "All statuses")}</option>
              {["draft", "submitted", "acknowledged", "closed", "cancelled"].map((k) => <option key={k} value={k}>{statusLabel(k)}</option>)}
            </select>
            <button type="button" onClick={() => void load()} className="ms-auto inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold dark:border-slate-700"><RefreshCw className="h-3.5 w-3.5" />{s.t("refresh", "Refresh")}</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-xs" data-testid="perf-list">
              <thead className="bg-slate-50 dark:bg-slate-800/60">
                <tr>{[s.t("no", "Appraisal No."), s.t("employee", "Employee"), s.t("department", "Department"), s.t("period", "Period"), s.t("reviewer", "Reviewer"), s.t("goals", "Goals"), s.t("rating", "Rating"), s.t("status", "Status")].map((h) => <Th key={h} className={`px-3 py-2.5 font-bold ${s.textStart}`}>{h}</Th>)}</tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="px-3 py-8 text-center"><Loader2 className="mx-auto h-4 w-4 animate-spin text-indigo-700" /></td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={8} className="px-3 py-8 text-center text-slate-400">{s.t("empty", "No appraisals yet.")}</td></tr>
                ) : rows.map((r) => (
                  <tr key={r.id} data-testid="perf-row" data-status={r.status} onClick={() => setOpenId(r.id)} className="cursor-pointer border-t border-slate-100 hover:bg-indigo-50/40 dark:border-slate-800 dark:hover:bg-indigo-950/20">
                    <td className="px-3 py-2 font-mono font-semibold">{r.appraisal_no}</td>
                    <td className="px-3 py-2">{r.employee_name}<div className="font-mono text-[10px] text-slate-400">{r.employee_code}</div></td>
                    <td className="px-3 py-2">{r.department ?? "—"}</td>
                    <td className="px-3 py-2 font-mono">{r.period_label}</td>
                    <td className="px-3 py-2">{r.reviewer_name ?? "—"}</td>
                    <td className="px-3 py-2 tabular-nums">{r.goal_count}</td>
                    <td className="px-3 py-2">{r.overall_rating != null ? <span className={`font-bold ${BAND_TONE[r.rating_band] ?? ""}`}><span className="tabular-nums">{Number(r.overall_rating).toFixed(2)}</span> · {bandLabel(r.rating_band)}</span> : "—"}</td>
                    <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_TONE[r.status]}`}>{statusLabel(r.status)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {showNew && <NewAppraisalModal s={s} onClose={() => setShowNew(false)} onCreated={(id) => { setShowNew(false); setTab("list"); setOpenId(id); }} />}
    </div>
  );
}

type Common = { s: ReturnType<typeof useErpScreen>; setError: (e: string | null) => void };

function AppraisalDetail({ s, id, onClose, statusLabel, bandLabel, setError, setNotice }: Common & { id: string; onClose: () => void; statusLabel: (x: string) => string; bandLabel: (x: string | null) => string; setNotice: (n: string | null) => void }) {
  const [d, setD] = useState<Row | null>(null);
  const [goals, setGoals] = useState<Row[]>([]);
  const [form, setForm] = useState<Row>({});
  const [ackText, setAckText] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await apiGet<Row>(`/api/erp/hr/appraisals/${id}`);
      setD(r);
      setGoals((r.goals ?? []).map((g: Row) => ({ ...g })));
      setForm({ managerComments: r.appraisal.manager_comments ?? "", strengths: r.appraisal.strengths ?? "", improvementPlan: r.appraisal.improvement_plan ?? "", improvementDue: r.appraisal.improvement_due ? String(r.appraisal.improvement_due).slice(0, 10) : "" });
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }, [id, setError]);
  useEffect(() => { void load(); }, [load]);

  if (!d) return <Loader2 className="mx-auto h-5 w-5 animate-spin text-indigo-700" />;
  const a = d.appraisal;
  const can = d.can ?? {};
  const k = d.liveKpis ?? {};
  const kpiLabel = (t: string) => s.t(`kpi_${t}`, t);
  const setGoal = (i: number, key: string, v: any) => setGoals((g) => g.map((x, j) => (j === i ? { ...x, [key]: v } : x)));
  const num = (v: any) => (v === "" || v == null ? null : Number(v));
  const payloadGoals = () => goals.map((g) => ({
    title: g.title, kpiType: g.kpi_type, target: num(g.target), actual: g.kpi_type === "manual" ? num(g.actual) : null,
    unit: g.unit || null, weight: Number(g.weight || 0), score: num(g.score), comments: g.comments || null,
  }));
  const weightSum = goals.reduce((x, g) => x + Number(g.weight || 0), 0);

  const run = async (fn: () => Promise<any>, ok: string) => {
    setBusy(true); setError(null); setNotice(null);
    try { const r = await fn(); setNotice(ok + (r?.followUps?.ackTask ? ` · ${r.followUps.ackTask}` : "") + (r?.followUps?.improvementTask ? ` · ${r.followUps.improvementTask}` : "")); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };
  const save = () => run(() => apiPatch(`/api/erp/hr/appraisals/${id}`, { goals: payloadGoals(), managerComments: form.managerComments || null, strengths: form.strengths || null, improvementPlan: form.improvementPlan || null, improvementDue: form.improvementDue || null }), s.t("saved", "Saved."));
  const action = (x: string, extra: Row = {}) => run(() => apiPost(`/api/erp/hr/appraisals/${id}/action`, { action: x, ...extra }), s.t(`done_${x}`, "Done."));

  const printConfig = () => ({
    moduleType: "register" as const, reportType: "register" as const, lang: s.lang, orientation: "landscape" as const,
    title: `${s.t("title", "Employee Performance & Appraisal")} — ${a.appraisal_no}`,
    subtitle: `${d.employee?.name ?? ""} (${d.employee?.employee_code ?? ""}) · ${a.period_label} · ${statusLabel(a.status)} · ${s.t("rating", "Rating")}: ${a.overall_rating != null ? Number(a.overall_rating).toFixed(2) + " " + bandLabel(a.rating_band) : "—"}`,
    columns: [
      { key: "title", label: s.t("goal", "Goal / KPI") },
      { key: "kpi_type", label: s.t("kpi_type", "Measure"), render: (r: any) => kpiLabel(r.kpi_type) },
      { key: "target", label: s.t("target", "Target") },
      { key: "actual", label: s.t("actual", "Actual") },
      { key: "weight", label: s.t("weight", "Weight %") },
      { key: "score", label: s.t("score", "Score (1–5)") },
      { key: "comments", label: s.t("comments", "Comments") },
    ],
    rows: d.goals,
  });

  const ta = (key: string, label: string, testid: string) => (
    <div>
      <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</label>
      <textarea data-testid={testid} disabled={!can.edit} rows={3} className={INP} value={form[key] ?? ""} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
    </div>
  );

  return (
    <div className="space-y-4" data-testid="perf-detail" data-status={a.status}>
      <section className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div>
          <p className="font-mono text-xs text-slate-500">{a.appraisal_no} · {a.period_label}</p>
          <h2 className="text-base font-bold">{d.employee?.name} <span className="font-mono text-xs text-slate-400">{d.employee?.employee_code}</span></h2>
          <p className="text-xs text-slate-500">{[d.employee?.designation, d.employee?.department, d.employee?.city_branch_name].filter(Boolean).join(" · ")} · {s.t("reviewer", "Reviewer")}: {d.employee?.reviewer_name ?? "—"}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${STATUS_TONE[a.status]}`} data-testid="perf-status">{statusLabel(a.status)}</span>
          <span className={`text-sm font-bold ${BAND_TONE[a.rating_band] ?? ""}`} data-testid="perf-rating">{a.overall_rating != null ? `${Number(a.overall_rating).toFixed(2)} · ${bandLabel(a.rating_band)}` : "—"}</span>
          <UniversalPrintActionButton reportConfig={printConfig as any} />
          <button type="button" aria-label={s.t("close", "Close")} onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-3" data-testid="perf-kpis">
        {[
          ["task_completion", k.task_completion, k.tasks ? `${k.tasks.completed}/${k.tasks.total}` : ""],
          ["task_on_time", k.task_on_time, k.tasks ? `${k.tasks.onTime}/${k.tasks.completed}` : ""],
          ["attendance_rate", k.attendance_rate, k.attendance ? `${k.attendance.present}/${k.attendance.recorded}` : ""],
        ].map(([t, v, sub]) => (
          <div key={t as string} className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900" data-testid={`perf-kpi-${t}`}>
            <p className="text-[11px] font-semibold text-slate-500">{kpiLabel(t as string)}</p>
            <p className="mt-1 text-xl font-bold tabular-nums">{v == null ? "—" : `${v}%`}</p>
            <p className="text-[11px] text-slate-400">{v == null ? (t !== "attendance_rate" && !k.linkedUser ? s.t("no_login", "Employee has no ERP login — no task data") : s.t("no_data", "No records in this period")) : sub}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 p-3 dark:border-slate-800">
          <h3 className="flex items-center gap-2 text-sm font-bold"><Target className="h-4 w-4 text-indigo-700" />{s.t("goals_title", "Goals & KPIs")}</h3>
          <span className={`text-xs font-semibold ${Math.abs(weightSum - 100) < 0.001 ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300"}`} data-testid="perf-weight">{s.t("weight_total", "Weights")}: {weightSum}/100</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr>{[s.t("goal", "Goal / KPI"), s.t("kpi_type", "Measure"), s.t("target", "Target"), s.t("actual", "Actual"), s.t("unit", "Unit"), s.t("weight", "Weight %"), s.t("score", "Score (1–5)"), s.t("comments", "Comments"), ""].map((h, i) => <Th key={i} className={`px-2 py-2 font-bold ${s.textStart}`}>{h}</Th>)}</tr>
            </thead>
            <tbody>
              {goals.length === 0 && <tr><td colSpan={9} className="px-3 py-6 text-center text-slate-400">{s.t("no_goals", "No goals yet — add the goals agreed for this period.")}</td></tr>}
              {goals.map((g, i) => (
                <tr key={i} data-testid="perf-goal" className="border-t border-slate-100 align-top dark:border-slate-800">
                  <td className="px-2 py-1.5"><input data-testid="perf-g-title" disabled={!can.edit} className={`${INP} w-56`} value={g.title ?? ""} onChange={(e) => setGoal(i, "title", e.target.value)} /></td>
                  <td className="px-2 py-1.5">
                    <select data-testid="perf-g-type" disabled={!can.edit} className={`${INP} w-40`} value={g.kpi_type ?? "manual"} onChange={(e) => setGoal(i, "kpi_type", e.target.value)}>
                      {KPI_TYPES.map((t) => <option key={t} value={t}>{kpiLabel(t)}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-1.5"><input data-testid="perf-g-target" disabled={!can.edit} type="number" className={`${INP} w-20`} value={g.target ?? ""} onChange={(e) => setGoal(i, "target", e.target.value)} /></td>
                  <td className="px-2 py-1.5">
                    {g.kpi_type === "manual"
                      ? <input data-testid="perf-g-actual" disabled={!can.edit} type="number" className={`${INP} w-20`} value={g.actual ?? ""} onChange={(e) => setGoal(i, "actual", e.target.value)} />
                      : <span className="inline-block min-w-16 rounded bg-indigo-50 px-2 py-1 font-semibold tabular-nums text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200" title={s.t("system_actual", "From real records")}>{g.actual ?? "—"}</span>}
                  </td>
                  <td className="px-2 py-1.5"><input disabled={!can.edit || g.kpi_type !== "manual"} className={`${INP} w-16`} value={g.kpi_type === "manual" ? g.unit ?? "" : "%"} onChange={(e) => setGoal(i, "unit", e.target.value)} /></td>
                  <td className="px-2 py-1.5"><input data-testid="perf-g-weight" disabled={!can.edit} type="number" min={0} max={100} className={`${INP} w-16`} value={g.weight ?? 0} onChange={(e) => setGoal(i, "weight", e.target.value)} /></td>
                  <td className="px-2 py-1.5">
                    <select data-testid="perf-g-score" disabled={!can.edit} className={`${INP} w-16`} value={g.score == null ? "" : String(Number(g.score))} onChange={(e) => setGoal(i, "score", e.target.value)}>
                      <option value="">—</option>
                      {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-1.5"><input disabled={!can.edit} className={`${INP} w-48`} value={g.comments ?? ""} onChange={(e) => setGoal(i, "comments", e.target.value)} /></td>
                  <td className="px-2 py-1.5">{can.edit && <button type="button" aria-label={s.t("remove", "Remove")} onClick={() => setGoals((x) => x.filter((_, j) => j !== i))} className="rounded-lg p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40"><Trash2 className="h-3.5 w-3.5" /></button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {can.edit && (
          <div className="flex flex-wrap gap-2 border-t border-slate-100 p-3 dark:border-slate-800">
            <button type="button" data-testid="perf-add-goal" onClick={() => setGoals((g) => [...g, { title: "", kpi_type: "manual", weight: 0 }])} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold dark:border-slate-700"><Plus className="h-3.5 w-3.5" />{s.t("add_goal", "Add goal")}</button>
            <button type="button" disabled={busy} onClick={() => void action("refresh_metrics")} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold dark:border-slate-700"><RefreshCw className="h-3.5 w-3.5" />{s.t("refresh_metrics", "Refresh system KPIs")}</button>
          </div>
        )}
      </section>

      <section className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 md:grid-cols-2">
        {ta("managerComments", s.t("manager_comments", "Manager review comments"), "perf-mgr")}
        {ta("strengths", s.t("strengths", "Strengths"), "perf-strengths")}
        {ta("improvementPlan", s.t("improvement_plan", "Improvement plan"), "perf-plan")}
        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">{s.t("improvement_due", "Improvement review date")}</label>
          <input data-testid="perf-plan-due" disabled={!can.edit} type="date" className={INP} value={form.improvementDue ?? ""} onChange={(e) => setForm({ ...form, improvementDue: e.target.value })} />
          {a.employee_comments && <div className="mt-3 rounded-lg bg-blue-50 p-2 text-xs dark:bg-blue-950/30" data-testid="perf-emp-comments"><b>{s.t("employee_comments", "Employee comments")}:</b> {a.employee_comments}</div>}
        </div>
      </section>

      <section className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
        {can.edit && <button type="button" data-testid="perf-save" disabled={busy} onClick={() => void save()} className="rounded-xl border border-indigo-700 px-3.5 py-2 text-xs font-bold text-indigo-800 disabled:opacity-50 dark:text-indigo-200">{s.t("save_draft", "Save draft")}</button>}
        {can.submit && <button type="button" data-testid="perf-submit" disabled={busy} onClick={() => void action("submit")} className="rounded-xl bg-indigo-700 px-3.5 py-2 text-xs font-bold text-white disabled:opacity-50">{s.t("submit", "Submit review")}</button>}
        {can.reopen && <button type="button" data-testid="perf-reopen" disabled={busy} onClick={() => void action("reopen")} className="rounded-xl border border-slate-300 px-3.5 py-2 text-xs font-bold disabled:opacity-50 dark:border-slate-700">{s.t("reopen", "Reopen")}</button>}
        {can.close && <button type="button" data-testid="perf-close" disabled={busy} onClick={() => void action("close")} className="rounded-xl bg-emerald-700 px-3.5 py-2 text-xs font-bold text-white disabled:opacity-50">{s.t("close_appraisal", "Close appraisal")}</button>}
        {can.cancel && <button type="button" data-testid="perf-cancel" disabled={busy} onClick={() => void action("cancel")} className="rounded-xl border border-rose-300 px-3.5 py-2 text-xs font-bold text-rose-700 disabled:opacity-50 dark:border-rose-900 dark:text-rose-300">{s.t("cancel", "Cancel appraisal")}</button>}
        {can.acknowledge && (
          <div className="flex w-full flex-wrap items-end gap-2">
            <textarea data-testid="perf-ack-text" rows={2} className={`${INP} max-w-lg`} placeholder={s.t("ack_placeholder", "Your comments (optional)")} value={ackText} onChange={(e) => setAckText(e.target.value)} />
            <button type="button" data-testid="perf-ack" disabled={busy} onClick={() => void action("acknowledge", { employeeComments: ackText || null })} className="inline-flex items-center gap-1 rounded-xl bg-blue-700 px-3.5 py-2 text-xs font-bold text-white disabled:opacity-50"><CheckCircle2 className="h-4 w-4" />{s.t("acknowledge", "Acknowledge")}</button>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">{s.t("history", "Audit history")}</h4>
        <ul className="mt-2 space-y-1 text-xs" data-testid="perf-events">
          {(d.events as Row[]).map((e) => (
            <li key={e.id} className="flex flex-wrap gap-2 border-s-2 border-indigo-600 ps-2">
              <span className="tabular-nums text-slate-500">{new Date(e.created_at).toLocaleString()}</span>
              <b>{s.t(`ev_${e.action}`, e.action)}</b>
              {e.from_status && e.from_status !== e.to_status && <span>{statusLabel(e.from_status)} → {statusLabel(e.to_status)}</span>}
              {e.actor_name && <span className="text-slate-500">· {e.actor_name}</span>}
              {e.detail?.ackTask && <span className="font-mono">· {e.detail.ackTask}</span>}
              {e.detail?.improvementTask && <span className="font-mono">· {e.detail.improvementTask}</span>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function NewAppraisalModal({ s, onClose, onCreated }: { s: ReturnType<typeof useErpScreen>; onClose: () => void; onCreated: (id: string) => void }) {
  const [emps, setEmps] = useState<Row[]>([]);
  const [users, setUsers] = useState<Row[]>([]);
  const [f, setF] = useState({ employeeId: "", periodType: "quarterly", periodLabel: currentQuarter(), periodStart: "", periodEnd: "", reviewerId: "" });
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    apiGet<{ rows: Row[] }>("/api/erp/hr/employees").then((r) => setEmps(r.rows ?? [])).catch(() => setEmps([]));
    apiGet<{ users: Row[] }>("/api/erp/user-tasks/assignees").then((r) => setUsers(r.users ?? [])).catch(() => setUsers([]));
  }, []);
  const submit = async () => {
    setSaving(true); setErr(null);
    try {
      const r = await apiPost<Row>("/api/erp/hr/appraisals", {
        employeeId: f.employeeId, periodType: f.periodType, periodLabel: f.periodType === "custom" ? null : f.periodLabel,
        periodStart: f.periodType === "custom" ? f.periodStart : null, periodEnd: f.periodType === "custom" ? f.periodEnd : null, reviewerId: f.reviewerId || null, goals: [],
      });
      onCreated(r.id);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setSaving(false); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" dir={s.dir}>
      <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900" data-testid="perf-new-modal">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-bold">{s.t("new", "New appraisal")}</h3>
          <button type="button" aria-label={s.t("close", "Close")} onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <L label={s.t("employee", "Employee")}>
              <select data-testid="perf-f-emp" className={INP} value={f.employeeId} onChange={(e) => setF({ ...f, employeeId: e.target.value })}>
                <option value="">{s.t("select", "Select…")}</option>
                {emps.map((e) => <option key={e.id} value={e.id}>{e.name} ({e.employee_code})</option>)}
              </select>
            </L>
          </div>
          <L label={s.t("period_type", "Review period")}>
            <select data-testid="perf-f-type" className={INP} value={f.periodType} onChange={(e) => setF({ ...f, periodType: e.target.value, periodLabel: e.target.value === "annual" ? String(new Date().getFullYear()) : e.target.value === "quarterly" ? currentQuarter() : "" })}>
              {["quarterly", "annual", "custom"].map((t) => <option key={t} value={t}>{s.t(`pt_${t}`, t)}</option>)}
            </select>
          </L>
          {f.periodType !== "custom" ? (
            <L label={s.t("period", "Period")}><input data-testid="perf-f-label" className={INP} dir="ltr" value={f.periodLabel} onChange={(e) => setF({ ...f, periodLabel: e.target.value })} placeholder={f.periodType === "annual" ? "2026" : "2026-Q3"} /></L>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <L label={s.t("from", "From")}><input type="date" className={INP} value={f.periodStart} onChange={(e) => setF({ ...f, periodStart: e.target.value })} /></L>
              <L label={s.t("to", "To")}><input type="date" className={INP} value={f.periodEnd} onChange={(e) => setF({ ...f, periodEnd: e.target.value })} /></L>
            </div>
          )}
          <div className="sm:col-span-2">
            <L label={s.t("reviewer", "Reviewer")}>
              <select data-testid="perf-f-reviewer" className={INP} value={f.reviewerId} onChange={(e) => setF({ ...f, reviewerId: e.target.value })}>
                <option value="">{s.t("reviewer_default", "Reporting manager (from employee record)")}</option>
                {users.map((u) => <option key={u.userId} value={u.userId}>{u.name ?? u.userId}</option>)}
              </select>
            </L>
          </div>
        </div>
        {err && <p data-testid="perf-new-error" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{err}</p>}
        <div className="mt-5 flex gap-2">
          <button type="button" data-testid="perf-f-save" disabled={saving || !f.employeeId} onClick={() => void submit()} className="flex-1 rounded-lg bg-indigo-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{saving ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : s.t("create", "Create appraisal")}</button>
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300">{s.t("cancel_btn", "Cancel")}</button>
        </div>
      </div>
    </div>
  );
}

function ReportTab({ s, bandLabel, statusLabel, setError }: Common & { bandLabel: (b: string | null) => string; statusLabel: (x: string) => string }) {
  const [period, setPeriod] = useState(currentQuarter());
  const [r, setR] = useState<Row | null>(null);
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try { setR(await apiGet<Row>(`/api/erp/hr/appraisals/report?period=${encodeURIComponent(period)}`)); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  }, [period, setError]);
  useEffect(() => { void load(); }, [load]);
  const printConfig = () => ({
    moduleType: "register" as const, reportType: "register" as const, lang: s.lang, orientation: "landscape" as const,
    title: `${s.t("tab_report", "Quarterly / annual report")} — ${period}`,
    subtitle: r?.totals ? `${s.t("kpi_total", "Appraisals")}: ${r.totals.appraisals} · ${s.t("avg_rating", "Average rating")}: ${r.totals.averageRating ?? "—"}` : "",
    columns: [
      { key: "appraisal_no", label: s.t("no", "Appraisal No.") },
      { key: "employee_name", label: s.t("employee", "Employee") },
      { key: "department", label: s.t("department", "Department") },
      { key: "overall_rating", label: s.t("rating", "Rating") },
      { key: "rating_band", label: s.t("band", "Band"), render: (x: any) => bandLabel(x.rating_band) },
      { key: "status", label: s.t("status", "Status"), render: (x: any) => statusLabel(x.status) },
    ],
    rows: r?.rows ?? [],
  });
  return (
    <div className="space-y-4" data-testid="perf-report">
      <div className="flex flex-wrap items-center gap-2">
        <input data-testid="perf-r-period" className={`${INP} w-32`} dir="ltr" value={period} onChange={(e) => setPeriod(e.target.value)} />
        <span className="text-[11px] text-slate-500">{s.t("period_hint", "e.g. 2026-Q3 or 2026")}</span>
        <div className="ms-auto"><UniversalPrintActionButton reportConfig={printConfig as any} /></div>
      </div>
      {loading || !r ? <Loader2 className="mx-auto h-5 w-5 animate-spin text-indigo-700" /> : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
            {[["appraisals", s.t("kpi_total", "Appraisals"), r.totals.appraisals], ["draft", s.t("st_draft", "Draft"), r.totals.draft], ["submitted", s.t("st_submitted", "Submitted"), r.totals.submitted], ["acknowledged", s.t("st_acknowledged", "Acknowledged"), r.totals.acknowledged], ["closed", s.t("st_closed", "Closed"), r.totals.closed], ["avg", s.t("avg_rating", "Average rating"), r.totals.averageRating ?? "—"]].map(([k, l, v]) => (
              <div key={k as string} data-testid={`perf-r-${k}`} className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"><p className="text-[11px] font-semibold text-slate-500">{l}</p><p className="mt-1 text-xl font-bold tabular-nums">{v}</p></div>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">{s.t("by_band", "Rating distribution")}</h4>
              {Object.keys(r.byBand).length === 0 ? <p className="mt-2 text-xs text-slate-400">{s.t("no_rated", "No submitted appraisals in this period.")}</p> : (
                <ul className="mt-2 space-y-1 text-xs">{["outstanding", "exceeds", "meets", "needs_improvement", "unsatisfactory"].filter((b) => r.byBand[b]).map((b) => <li key={b} className="flex justify-between"><span className={BAND_TONE[b]}>{bandLabel(b)}</span><b className="tabular-nums">{r.byBand[b]}</b></li>)}</ul>
              )}
            </section>
            <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">{s.t("by_department", "Average rating by department")}</h4>
              {r.byDepartment.length === 0 ? <p className="mt-2 text-xs text-slate-400">{s.t("no_rated", "No submitted appraisals in this period.")}</p> : (
                <ul className="mt-2 space-y-1 text-xs">{r.byDepartment.map((x: Row) => <li key={x.department} className="flex justify-between"><span>{x.department} <span className="text-slate-400">({x.count})</span></span><b className="tabular-nums">{x.averageRating.toFixed(2)}</b></li>)}</ul>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}

/** Label + control. Module-level so inputs keep focus while typing. */
function L({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</label>{children}</div>;
}
