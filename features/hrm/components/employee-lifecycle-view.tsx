"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, ArrowUpNarrowWide, MoveRight, LogOut, X, Check, Play, RefreshCw } from "lucide-react";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { apiGet, apiPost, apiPatch } from "@/lib/api/client";
import { Th } from "@/components/ui/translated-th";

type Emp = {
  id: string; employee_code: string; name: string; designation: string | null; department: string | null;
  country_id: string | null; city_branch_id: string | null; country_name: string | null;
  basic_salary: number | null; monthly_salary: number | null; salary_currency: string | null; status: string | null;
};
type Row = Record<string, any>;
type Kind = "position" | "transfer" | "separation";

const INP = "w-full rounded-lg border border-slate-200 bg-transparent px-2.5 py-1.5 text-xs outline-none focus:border-emerald-400 dark:border-slate-700";
const NUM = (v: any) => (v == null ? "—" : new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(Number(v) || 0));

const STATUS_TONE: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  approved: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  applied: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  rejected: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
  cancelled: "bg-slate-100 text-slate-500 dark:bg-slate-800",
};

export function EmployeeLifecycleView({ lang }: { lang?: string }) {
  const s = useErpScreen("hrm", lang);

  const [employees, setEmployees] = useState<Emp[]>([]);
  const [empId, setEmpId] = useState<string>("");
  const [timeline, setTimeline] = useState<Row[]>([]);
  const [pending, setPending] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<Kind | null>(null);

  const emp = useMemo(() => employees.find((e) => e.id === empId) || null, [employees, empId]);

  useEffect(() => {
    apiGet<{ rows: Emp[] }>("/api/erp/hr/employees")
      .then((r) => setEmployees(r.rows ?? []))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  const loadTimeline = useCallback(async () => {
    if (!empId) { setTimeline([]); return; }
    setLoading(true);
    setError(null);
    try {
      const r = await apiGet<{ rows: Row[] }>(`/api/erp/hr/lifecycle/timeline?employeeId=${empId}`);
      setTimeline(r.rows ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [empId]);

  const loadPending = useCallback(async () => {
    try {
      const [p, t, sep] = await Promise.all([
        apiGet<{ rows: Row[] }>("/api/erp/hr/lifecycle?type=position&status=pending"),
        apiGet<{ rows: Row[] }>("/api/erp/hr/lifecycle?type=transfer&status=pending"),
        apiGet<{ rows: Row[] }>("/api/erp/hr/lifecycle?type=separation&status=pending"),
      ]);
      const tag = (rows: Row[], kind: Kind) => rows.map((r) => ({ ...r, _kind: kind }));
      setPending([...tag(p.rows ?? [], "position"), ...tag(t.rows ?? [], "transfer"), ...tag(sep.rows ?? [], "separation")]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => { void loadTimeline(); }, [loadTimeline]);
  useEffect(() => { void loadPending(); }, [loadPending]);

  const act = async (kind: Kind, id: string, action: "approve" | "reject" | "cancel" | "apply") => {
    try {
      await apiPatch(`/api/erp/hr/lifecycle/${id}`, { kind, action });
      await Promise.all([loadPending(), loadTimeline()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const submitForm = async (payload: Row) => {
    await apiPost("/api/erp/hr/lifecycle", payload);
    setForm(null);
    await Promise.all([loadTimeline(), loadPending()]);
  };

  return (
    <section dir={s.dir} className="min-h-screen bg-slate-50/50 dark:bg-slate-950/50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-screen-xl space-y-5">
        <header className={s.textStart}>
          <h1 className="text-lg font-black tracking-tight text-slate-900 dark:text-slate-50">{s.t("lifecycle_title", "Employee Lifecycle & Employment History")}</h1>
          <p className="mt-0.5 max-w-2xl text-xs text-slate-500">
            {s.t("lifecycle_blurb", "Append-only promotion, salary-revision, transfer and separation history. Approved events are applied to the employee record; corrections are new rows, never edits.")}
          </p>
        </header>

        {error ? <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p> : null}

        {/* employee selector + actions */}
        <div className="flex flex-wrap items-end gap-2 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
          <div className="min-w-[16rem] flex-1">
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">{s.t("employee", "Employee")}</label>
            <select value={empId} onChange={(e) => setEmpId(e.target.value)} className={INP}>
              <option value="">{s.t("select_employee", "Select employee…")}</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>{e.name} ({e.employee_code}){e.country_name ? ` — ${e.country_name}` : ""}</option>
              ))}
            </select>
          </div>
          <button type="button" onClick={() => void loadTimeline()} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200">
            <RefreshCw className="h-3.5 w-3.5" />{s.t("refresh", "Refresh")}
          </button>
          <button type="button" disabled={!empId} onClick={() => setForm("position")} className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-40">
            <ArrowUpNarrowWide className="h-3.5 w-3.5" />{s.t("record_promotion", "Promotion / Salary Revision")}
          </button>
          <button type="button" disabled={!empId} onClick={() => setForm("transfer")} className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-3 py-2 text-xs font-bold text-white hover:bg-violet-700 disabled:opacity-40">
            <MoveRight className="h-3.5 w-3.5" />{s.t("record_transfer", "Transfer")}
          </button>
          <button type="button" disabled={!empId} onClick={() => setForm("separation")} className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3 py-2 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-40">
            <LogOut className="h-3.5 w-3.5" />{s.t("record_separation", "Resignation / Termination")}
          </button>
        </div>

        {emp ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-3 text-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Info label={s.t("code", "Code")} v={emp.employee_code} />
              <Info label={s.t("designation", "Designation")} v={emp.designation} />
              <Info label={s.t("department", "Department")} v={emp.department} />
              <Info label={s.t("country", "Country")} v={emp.country_name} />
              <Info label={s.t("basic_salary", "Basic Salary")} v={`${NUM(emp.basic_salary)} ${emp.salary_currency || ""}`} />
              <Info label={s.t("monthly_salary", "Monthly Salary")} v={`${NUM(emp.monthly_salary)} ${emp.salary_currency || ""}`} />
              <Info label={s.t("status_label", "Status")} v={emp.status} />
            </div>
          </div>
        ) : null}

        {/* timeline */}
        <div>
          <h2 className="mb-2 text-xs font-black uppercase tracking-wider text-slate-400">{s.t("timeline", "Lifecycle Timeline")}</h2>
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60">
                <tr className="text-left">
                  <Th className="px-3 py-2.5">{s.t("date", "Effective Date")}</Th>
                  <Th className="px-3 py-2.5">{s.t("kind", "Kind")}</Th>
                  <Th className="px-3 py-2.5">{s.t("detail", "Detail")}</Th>
                  <Th className="px-3 py-2.5">{s.t("reason", "Reason")}</Th>
                  <Th className="px-3 py-2.5">{s.t("status_label", "Status")}</Th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-400"><Loader2 className="mx-auto h-4 w-4 animate-spin" /></td></tr>
                ) : !empId ? (
                  <tr><td colSpan={5} className="px-3 py-8 text-center text-xs text-slate-400">{s.t("pick_employee", "Select an employee to view their history.")}</td></tr>
                ) : timeline.length === 0 ? (
                  <tr><td colSpan={5} className="px-3 py-8 text-center text-xs text-slate-400">{s.t("no_history", "No lifecycle events recorded yet.")}</td></tr>
                ) : (
                  timeline.map((r) => (
                    <tr key={`${r.kind}:${r.id}`} className="border-t border-slate-100 dark:border-slate-800 align-top">
                      <td className="whitespace-nowrap px-3 py-2 text-slate-500">{r.effective_date}</td>
                      <td className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-200">
                        {s.t(`lc_${r.kind}`, r.kind)} · {s.t(`lc_sub_${r.sub_type}`, r.sub_type)}
                      </td>
                      <td className="px-3 py-2 text-slate-500">{describeDetail(r, s)}</td>
                      <td className="px-3 py-2 text-slate-500">{r.reason || "—"}</td>
                      <td className="px-3 py-2">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_TONE[r.status] || STATUS_TONE.pending}`}>
                          {s.t(`lc_status_${r.status}`, r.status)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* pending approvals */}
        <div>
          <h2 className="mb-2 text-xs font-black uppercase tracking-wider text-slate-400">{s.t("pending_approvals", "Pending Approvals")} ({pending.length})</h2>
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60">
                <tr className="text-left">
                  <Th className="px-3 py-2.5">{s.t("employee", "Employee")}</Th>
                  <Th className="px-3 py-2.5">{s.t("kind", "Kind")}</Th>
                  <Th className="px-3 py-2.5">{s.t("date", "Effective Date")}</Th>
                  <Th className="px-3 py-2.5">{s.t("status_label", "Status")}</Th>
                  <Th className="px-3 py-2.5 text-right">{s.t("actions", "Actions")}</Th>
                </tr>
              </thead>
              <tbody>
                {pending.length === 0 ? (
                  <tr><td colSpan={5} className="px-3 py-8 text-center text-xs text-slate-400">{s.t("nothing_pending", "Nothing pending.")}</td></tr>
                ) : (
                  pending.map((r) => (
                    <tr key={`${r._kind}:${r.id}`} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-200">{r.employee_name} <span className="font-mono text-slate-400">{r.employee_code}</span></td>
                      <td className="px-3 py-2 text-slate-500">{s.t(`lc_${r._kind}`, r._kind)} · {s.t(`lc_sub_${r.event_type || r.transfer_type || r.separation_type}`, r.event_type || r.transfer_type || r.separation_type)}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-slate-500">{r.effective_date || r.last_working_date}</td>
                      <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_TONE[r.status] || STATUS_TONE.pending}`}>{s.t(`lc_status_${r.status}`, r.status)}</span></td>
                      <td className="px-3 py-2 text-right">
                        <div className="inline-flex gap-1">
                          {r.status === "pending" ? (
                            <>
                              <button type="button" onClick={() => void act(r._kind, r.id, "approve")} className="rounded-lg bg-emerald-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-emerald-700">{s.t("approve", "Approve")}</button>
                              <button type="button" onClick={() => void act(r._kind, r.id, "reject")} className="rounded-lg border border-rose-200 px-2 py-1 text-[10px] font-bold text-rose-600 hover:bg-rose-50 dark:border-rose-900">{s.t("reject", "Reject")}</button>
                            </>
                          ) : null}
                          {r.status === "approved" ? (
                            <button type="button" onClick={() => void act(r._kind, r.id, "apply")} className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-blue-700">
                              <Play className="h-3 w-3" />{s.t("apply", "Apply")}
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {form && emp ? (
        <LifecycleForm kind={form} emp={emp} s={s} onClose={() => setForm(null)} onSubmit={submitForm} />
      ) : null}
    </section>
  );
}

function Info({ label, v }: { label: string; v: any }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</div>
      <div className="font-semibold text-slate-700 dark:text-slate-200">{v == null || v === "" ? "—" : String(v)}</div>
    </div>
  );
}

function describeDetail(r: Row, s: ReturnType<typeof useErpScreen>): string {
  const d = r.detail || {};
  if (r.kind === "position") {
    const parts: string[] = [];
    if (d.prev_designation !== d.new_designation && d.new_designation) parts.push(`${d.prev_designation || "—"} → ${d.new_designation}`);
    if (d.new_basic_salary != null && d.prev_basic_salary !== d.new_basic_salary) parts.push(`${s.t("basic_salary", "Basic")}: ${NUM(d.prev_basic_salary)} → ${NUM(d.new_basic_salary)} ${d.salary_currency || ""}`);
    if (d.new_monthly_salary != null && d.prev_monthly_salary !== d.new_monthly_salary) parts.push(`${s.t("monthly_salary", "Monthly")}: ${NUM(d.prev_monthly_salary)} → ${NUM(d.new_monthly_salary)} ${d.salary_currency || ""}`);
    return parts.join(" · ") || "—";
  }
  if (r.kind === "transfer") {
    if (d.new_department && d.prev_department !== d.new_department) return `${d.prev_department || "—"} → ${d.new_department}`;
    return s.t("transfer_recorded", "Transfer recorded");
  }
  return `${s.t("last_working_date", "Last working date")}: ${d.last_working_date} · ${d.rehire_eligible ? s.t("rehire_yes", "rehire eligible") : s.t("rehire_no", "not rehire eligible")}`;
}

function LifecycleForm({
  kind, emp, s, onClose, onSubmit,
}: {
  kind: Kind;
  emp: Emp;
  s: ReturnType<typeof useErpScreen>;
  onClose: () => void;
  onSubmit: (payload: Row) => Promise<void>;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [f, setF] = useState<Row>(
    kind === "position"
      ? { kind: "position", employeeId: emp.id, eventType: "promotion", effectiveDate: today, newDesignation: emp.designation ?? "", newBasicSalary: emp.basic_salary ?? 0, newMonthlySalary: emp.monthly_salary ?? 0, salaryCurrency: emp.salary_currency ?? "USD", reason: "" }
      : kind === "transfer"
        ? { kind: "transfer", employeeId: emp.id, transferType: "department", effectiveDate: today, newDepartment: emp.department ?? "", reason: "" }
        : { kind: "separation", employeeId: emp.id, separationType: "resignation", lastWorkingDate: today, noticeDate: today, rehireEligible: true, reason: "", exitNotes: "" },
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: string, v: any) => setF((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    setSaving(true);
    setErr(null);
    try {
      const payload: Row = { ...f };
      ["newBasicSalary", "newMonthlySalary"].forEach((k) => { if (payload[k] != null && payload[k] !== "") payload[k] = Number(payload[k]); });
      await onSubmit(payload);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40" onClick={onClose}>
      <div dir={s.dir} className="h-full w-full max-w-md overflow-y-auto bg-white p-5 shadow-2xl dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b pb-3 dark:border-slate-800">
          <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">
            {kind === "position" ? s.t("record_promotion", "Promotion / Salary Revision") : kind === "transfer" ? s.t("record_transfer", "Transfer") : s.t("record_separation", "Resignation / Termination")}
            <span className="ms-2 font-mono text-xs font-normal text-slate-400">{emp.employee_code}</span>
          </h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button>
        </div>

        {err ? <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{err}</p> : null}

        <div className="mt-4 space-y-3">
          {kind === "position" && (
            <>
              <L label={s.t("event_type", "Event Type")}>
                <select value={f.eventType} onChange={(e) => set("eventType", e.target.value)} className={INP}>
                  {["promotion", "demotion", "salary_revision", "confirmation", "probation_extension", "role_change"].map((k) => (
                    <option key={k} value={k}>{s.t(`lc_sub_${k}`, k)}</option>
                  ))}
                </select>
              </L>
              <L label={s.t("effective_date", "Effective Date")}><input type="date" value={f.effectiveDate} onChange={(e) => set("effectiveDate", e.target.value)} className={INP} /></L>
              <L label={s.t("new_designation", "New Designation")}><input value={f.newDesignation ?? ""} onChange={(e) => set("newDesignation", e.target.value)} className={INP} /></L>
              <div className="grid grid-cols-3 gap-2">
                <L label={s.t("new_basic", "New Basic")}><input type="number" value={f.newBasicSalary ?? 0} onChange={(e) => set("newBasicSalary", e.target.value)} className={INP} /></L>
                <L label={s.t("new_monthly", "New Monthly")}><input type="number" value={f.newMonthlySalary ?? 0} onChange={(e) => set("newMonthlySalary", e.target.value)} className={INP} /></L>
                <L label={s.t("currency", "Currency")}><input value={f.salaryCurrency ?? "USD"} onChange={(e) => set("salaryCurrency", e.target.value)} className={INP} /></L>
              </div>
            </>
          )}

          {kind === "transfer" && (
            <>
              <L label={s.t("transfer_type", "Transfer Type")}>
                <select value={f.transferType} onChange={(e) => set("transferType", e.target.value)} className={INP}>
                  {["department", "city_branch", "main_branch", "country", "manager"].map((k) => (
                    <option key={k} value={k}>{s.t(`lc_sub_${k}`, k)}</option>
                  ))}
                </select>
              </L>
              <L label={s.t("effective_date", "Effective Date")}><input type="date" value={f.effectiveDate} onChange={(e) => set("effectiveDate", e.target.value)} className={INP} /></L>
              <L label={s.t("new_department", "New Department")}><input value={f.newDepartment ?? ""} onChange={(e) => set("newDepartment", e.target.value)} className={INP} /></L>
              <p className="text-[10px] text-slate-400">{s.t("transfer_hint", "Branch / country moves take effect on the employee record when the transfer is approved and applied.")}</p>
            </>
          )}

          {kind === "separation" && (
            <>
              <L label={s.t("separation_type", "Separation Type")}>
                <select value={f.separationType} onChange={(e) => set("separationType", e.target.value)} className={INP}>
                  {["resignation", "termination", "end_of_contract", "retirement", "absconding", "death", "redundancy"].map((k) => (
                    <option key={k} value={k}>{s.t(`lc_sub_${k}`, k)}</option>
                  ))}
                </select>
              </L>
              <div className="grid grid-cols-2 gap-2">
                <L label={s.t("notice_date", "Notice Date")}><input type="date" value={f.noticeDate ?? ""} onChange={(e) => set("noticeDate", e.target.value)} className={INP} /></L>
                <L label={s.t("last_working_date", "Last Working Date")}><input type="date" value={f.lastWorkingDate} onChange={(e) => set("lastWorkingDate", e.target.value)} className={INP} /></L>
              </div>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                <input type="checkbox" checked={!!f.rehireEligible} onChange={(e) => set("rehireEligible", e.target.checked)} />
                {s.t("rehire_eligible", "Rehire eligible")}
              </label>
              <L label={s.t("exit_notes", "Exit Notes")}><textarea value={f.exitNotes ?? ""} onChange={(e) => set("exitNotes", e.target.value)} rows={2} className={INP} /></L>
            </>
          )}

          <L label={s.t("reason", "Reason")}><textarea value={f.reason ?? ""} onChange={(e) => set("reason", e.target.value)} rows={2} className={INP} /></L>
          <L label={s.t("reference_no", "Reference No")}><input value={f.referenceNo ?? ""} onChange={(e) => set("referenceNo", e.target.value)} className={INP} /></L>
        </div>

        <div className="mt-5 flex gap-2">
          <button type="button" onClick={() => void submit()} disabled={saving} className="flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
            {saving ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : <span className="inline-flex items-center gap-1"><Check className="h-3.5 w-3.5" />{s.t("record_event", "Record (pending approval)")}</span>}
          </button>
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300">{s.t("cancel", "Cancel")}</button>
        </div>
      </div>
    </div>
  );
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</label>
      {children}
    </div>
  );
}
