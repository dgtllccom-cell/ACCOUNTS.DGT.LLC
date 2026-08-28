"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, Plus, Check } from "lucide-react";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { apiGet, apiPost, apiPatch } from "@/lib/api/client";
import { Th } from "@/components/ui/translated-th";
import { UniversalPrintActionButton } from "@/components/reports/universal-print-action-button";

type Row = Record<string, any>;

const STATUS_TONE: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  in_progress: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  done: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  not_applicable: "bg-slate-100 text-slate-500 dark:bg-slate-800",
};

export function OnboardingView({ lang }: { lang?: string }) {
  const s = useErpScreen("hrm", lang);
  const [phase, setPhase] = useState<"onboarding" | "offboarding">("onboarding");
  const [employees, setEmployees] = useState<Row[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [summary, setSummary] = useState<Row[]>([]);
  const [tasks, setTasks] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const sm = await apiGet<{ rows: Row[] }>(`/api/erp/hr/onboarding?view=summary&phase=${phase}`);
      setSummary(sm.rows ?? []);
      if (employeeId) {
        const t = await apiGet<{ rows: Row[] }>(`/api/erp/hr/onboarding?phase=${phase}&employeeId=${employeeId}`);
        setTasks(t.rows ?? []);
      } else {
        setTasks([]);
      }
      if (employees.length === 0) {
        const e = await apiGet<{ rows: Row[] }>("/api/erp/hr/employees");
        setEmployees(e.rows ?? []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [phase, employeeId, employees.length]);

  useEffect(() => { void load(); }, [load]);

  const seed = async () => {
    if (!employeeId) return;
    setBusy(true);
    try {
      const r = await apiPost<{ created: number }>("/api/erp/hr/onboarding", { employeeId, phase });
      window.alert(s.t("ob_seeded", "{n} tasks created").replace("{n}", String(r.created ?? 0)));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (id: string, status: string) => {
    try {
      await apiPatch(`/api/erp/hr/onboarding/${id}`, { status });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const printConfig = () => ({
    moduleType: "hr_payroll" as const,
    reportType: "register" as const,
    title: s.t(`ob_${phase}`, phase),
    subtitle: s.t("ob_title", "Onboarding / Offboarding"),
    lang: s.lang,
    orientation: "landscape" as const,
    columns: [
      { key: "employee_name", label: s.t("employee", "Employee") },
      { key: "category", label: s.t("ob_category", "Category") },
      { key: "task_name", label: s.t("ob_task", "Task") },
      { key: "responsible", label: s.t("ob_responsible", "Responsible") },
      { key: "status", label: s.t("status_label", "Status") },
      { key: "due_date", label: s.t("date", "Due Date") },
    ],
    rows: employeeId ? tasks : summary,
  });

  return (
    <section dir={s.dir} className="min-h-screen bg-slate-50/50 dark:bg-slate-950/50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-screen-xl space-y-5">
        <header className={s.textStart}>
          <h1 className="text-lg font-black tracking-tight text-slate-900 dark:text-slate-50">{s.t("ob_title", "Onboarding / Offboarding")}</h1>
          <p className="mt-0.5 text-xs text-slate-500">{s.t("ob_blurb", "Per-employee checklist from the configurable template — documentation, KYC, IT, finance, orientation for joiners; clearance, asset return, final settlement, relieving letter for leavers.")}</p>
        </header>

        <div className="flex flex-wrap items-end gap-2 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex gap-1">
            {(["onboarding", "offboarding"] as const).map((p) => (
              <button key={p} type="button" onClick={() => setPhase(p)} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${phase === p ? "bg-emerald-600 text-white" : "border border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300"}`}>
                {s.t(`ob_${p}`, p)}
              </button>
            ))}
          </div>
          <div className="min-w-[16rem] flex-1">
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">{s.t("employee", "Employee")}</label>
            <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-transparent px-2.5 py-1.5 text-xs outline-none dark:border-slate-700 dark:bg-slate-800">
              <option value="">{s.t("ob_all", "All (summary)")}</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.name} ({e.employee_code})</option>)}
            </select>
          </div>
          <button type="button" onClick={() => void load()} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"><RefreshCw className="h-3.5 w-3.5" />{s.t("refresh", "Refresh")}</button>
          {employeeId ? (
            <button type="button" disabled={busy} onClick={() => void seed()} className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"><Plus className="h-3.5 w-3.5" />{s.t("ob_generate", "Generate Checklist")}</button>
          ) : null}
          <UniversalPrintActionButton reportConfig={printConfig} />
        </div>

        {error ? <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p> : null}

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          {loading ? (
            <div className="py-10 text-center"><Loader2 className="mx-auto h-4 w-4 animate-spin text-slate-400" /></div>
          ) : employeeId ? (
            <table className="w-full text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60">
                <tr className="text-left">
                  <Th className="px-3 py-2.5">{s.t("ob_category", "Category")}</Th>
                  <Th className="px-3 py-2.5">{s.t("ob_task", "Task")}</Th>
                  <Th className="px-3 py-2.5">{s.t("ob_responsible", "Responsible")}</Th>
                  <Th className="px-3 py-2.5">{s.t("status_label", "Status")}</Th>
                  <Th className="px-3 py-2.5 text-right">{s.t("actions", "Actions")}</Th>
                </tr>
              </thead>
              <tbody>
                {tasks.length === 0 ? (
                  <tr><td colSpan={5} className="px-3 py-8 text-center text-xs text-slate-400">{s.t("ob_no_tasks", "No checklist yet — click Generate Checklist.")}</td></tr>
                ) : tasks.map((t) => (
                  <tr key={t.id} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-3 py-2 text-slate-500">{t.category}</td>
                    <td className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-200">{t.task_name}{t.is_mandatory ? <span className="ms-1 text-rose-500">*</span> : null}</td>
                    <td className="px-3 py-2 text-slate-500">{s.t(`ob_r_${t.responsible}`, t.responsible)}</td>
                    <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_TONE[t.status] || STATUS_TONE.pending}`}>{s.t(`ob_st_${t.status}`, t.status)}</span></td>
                    <td className="px-3 py-2 text-right">
                      <select value={t.status} onChange={(e) => void setStatus(t.id, e.target.value)} className="rounded border border-slate-200 bg-transparent px-1.5 py-1 text-[11px] dark:border-slate-700">
                        {["pending", "in_progress", "done", "not_applicable"].map((k) => <option key={k} value={k}>{s.t(`ob_st_${k}`, k)}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60">
                <tr className="text-left">
                  <Th className="px-3 py-2.5">{s.t("employee", "Employee")}</Th>
                  <Th className="px-3 py-2.5">{s.t("country", "Country")}</Th>
                  <Th className="px-3 py-2.5 text-right">{s.t("ob_progress", "Progress")}</Th>
                  <Th className="px-3 py-2.5 text-right">{s.t("ob_pending_m", "Pending Mandatory")}</Th>
                </tr>
              </thead>
              <tbody>
                {summary.length === 0 ? (
                  <tr><td colSpan={4} className="px-3 py-8 text-center text-xs text-slate-400">{s.t("ob_no_checklists", "No checklists generated yet.")}</td></tr>
                ) : summary.map((r) => (
                  <tr key={r.employee_id} className="cursor-pointer border-t border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40" onClick={() => setEmployeeId(r.employee_id)}>
                    <td className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-200">{r.employee_name} <span className="font-mono text-[10px] text-slate-400">{r.employee_code}</span></td>
                    <td className="px-3 py-2 text-slate-500">{r.country_name || "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.done}/{r.total}</td>
                    <td className={`px-3 py-2 text-right tabular-nums font-bold ${Number(r.pending_mandatory) > 0 ? "text-rose-600" : "text-emerald-600"}`}>{r.pending_mandatory}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </section>
  );
}
