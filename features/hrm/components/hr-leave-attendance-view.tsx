"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Pencil, Trash2, X, Check, Ban, RefreshCw, Play } from "lucide-react";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api/client";
import { Th } from "@/components/ui/translated-th";
import { UniversalPrintActionButton } from "@/components/reports/universal-print-action-button";

type Row = Record<string, any>;
type Tab = "leave_types" | "shifts" | "holidays" | "balances" | "corrections";
const INP = "w-full rounded-lg border border-slate-200 bg-transparent px-2.5 py-1.5 text-xs outline-none focus:border-emerald-400 dark:border-slate-700";
const NUM = (v: any) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(Number(v) || 0);
const TABS: Tab[] = ["leave_types", "shifts", "holidays", "balances", "corrections"];

const CORR_TONE: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  approved: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  applied: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  rejected: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
};

export function HrLeaveAttendanceView({ lang }: { lang?: string }) {
  const s = useErpScreen("hrm", lang);
  const [tab, setTab] = useState<Tab>("leave_types");
  const [rows, setRows] = useState<Row[]>([]);
  const [employees, setEmployees] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [editing, setEditing] = useState<Row | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);

  const endpoint = tab === "leave_types" ? "/api/erp/hr/leave-types"
    : tab === "shifts" ? "/api/erp/hr/shifts"
    : tab === "holidays" ? "/api/erp/hr/holidays"
    : tab === "balances" ? "/api/erp/hr/leave-balances"
    : "/api/erp/hr/attendance-corrections";

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let url = endpoint;
      if (tab === "balances" || tab === "holidays") url += `?year=${year}`;
      const res = await apiGet<{ rows: Row[] }>(url);
      setRows(res.rows ?? []);
      if ((tab === "balances" || tab === "corrections") && employees.length === 0) {
        const e = await apiGet<{ rows: Row[] }>("/api/erp/hr/employees");
        setEmployees(e.rows ?? []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [endpoint, tab, year, employees.length]);

  useEffect(() => { void load(); }, [load]);

  const save = async (payload: Row) => {
    if (editing?.id) await apiPatch(`${endpoint}/${editing.id}`, payload);
    else await apiPost(endpoint, payload);
    setShowForm(false);
    setEditing(null);
    await load();
  };

  const remove = async (r: Row) => {
    if (!window.confirm(s.t("confirm_delete", "Delete this record?"))) return;
    try { await apiDelete(`${endpoint}/${r.id}`); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };

  const balanceAction = async (action: "initialize" | "recompute") => {
    setBusy(true);
    setError(null);
    try {
      const res = await apiPost<{ upserted?: number; updated?: number }>("/api/erp/hr/leave-balances", { action, year });
      await load();
      window.alert(`${action}: ${res.upserted ?? res.updated ?? 0}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const correctionAction = async (id: string, action: "approve" | "reject" | "apply") => {
    setBusy(true);
    try { await apiPatch(`/api/erp/hr/attendance-corrections/${id}`, { action }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  const adjustBalance = async (r: Row) => {
    const v = window.prompt(s.t("adjust_prompt", "Adjustment days (+/-):"));
    if (v == null) return;
    const days = Number(v);
    if (Number.isNaN(days)) return;
    try { await apiPatch(`/api/erp/hr/leave-balances/${r.id}`, { adjustmentDays: days }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };

  const printConfig = () => ({
    moduleType: "register" as const,
    reportType: "register" as const,
    title: s.t(`tab_${tab}`, tab),
    subtitle: s.t("leave_attendance_title", "Leave & Attendance"),
    lang: s.lang,
    orientation: "landscape" as const,
    columns: columnsFor(tab, s),
    rows,
  });

  return (
    <section dir={s.dir} className="min-h-screen bg-slate-50/50 dark:bg-slate-950/50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-screen-xl space-y-5">
        <header className={s.textStart}>
          <h1 className="text-lg font-black tracking-tight text-slate-900 dark:text-slate-50">{s.t("leave_attendance_title", "Leave & Attendance Management")}</h1>
          <p className="mt-0.5 text-xs text-slate-500">{s.t("leave_attendance_blurb", "Leave types, shifts, the holiday calendar, per-employee leave balances and attendance corrections (old value → new value, reason, requester, approver).")}</p>
        </header>

        <div className="flex flex-wrap gap-1 border-b border-slate-200 dark:border-slate-800">
          {TABS.map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)}
              className={`rounded-t-lg px-3 py-2 text-xs font-bold ${tab === t ? "border-b-2 border-emerald-500 text-emerald-600 dark:text-emerald-400" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}>
              {s.t(`tab_${t}`, t)}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <UniversalPrintActionButton reportConfig={printConfig} />
          <button type="button" onClick={() => void load()} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
            <RefreshCw className="h-3.5 w-3.5" />{s.t("refresh", "Refresh")}
          </button>
          {(tab === "balances" || tab === "holidays") ? (
            <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-24 rounded-lg border border-slate-200 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800" />
          ) : null}
          {["leave_types", "shifts", "holidays"].includes(tab) ? (
            <button type="button" onClick={() => { setEditing(null); setShowForm(true); }} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-500">
              <Plus className="h-3.5 w-3.5" />{s.t("add", "Add")}
            </button>
          ) : null}
          {tab === "balances" ? (
            <>
              <button type="button" disabled={busy} onClick={() => void balanceAction("initialize")} className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50">{s.t("bal_initialize", "Initialize Year")}</button>
              <button type="button" disabled={busy} onClick={() => void balanceAction("recompute")} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200">{s.t("bal_recompute", "Recompute Taken/Pending")}</button>
            </>
          ) : null}
          {tab === "corrections" ? (
            <button type="button" onClick={() => { setEditing(null); setShowForm(true); }} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-500">
              <Plus className="h-3.5 w-3.5" />{s.t("corr_new", "New Correction")}
            </button>
          ) : null}
        </div>

        {error ? <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p> : null}

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr className="text-left">
                {columnsFor(tab, s).map((c) => <Th key={c.key} className={`px-3 py-2.5 ${c.align === "right" ? "text-right" : ""}`}>{c.label}</Th>)}
                <Th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={12} className="px-3 py-10 text-center text-slate-400"><Loader2 className="mx-auto h-4 w-4 animate-spin" /></td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={12} className="px-3 py-10 text-center text-xs text-slate-400">{s.t("empty", "No records found.")}</td></tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100 dark:border-slate-800">
                    {columnsFor(tab, s).map((c) => (
                      <td key={c.key} className={`px-3 py-2 ${c.align === "right" ? "text-right tabular-nums" : "text-slate-600 dark:text-slate-300"}`}>
                        {c.render ? c.render(r, s) : (r[c.key] ?? "—")}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right">
                      <div className="inline-flex gap-1">
                        {["leave_types", "shifts", "holidays"].includes(tab) ? (
                          <>
                            <button type="button" onClick={() => { setEditing(r); setShowForm(true); }} className="rounded-lg border border-slate-200 p-1 text-slate-400 hover:bg-slate-50 dark:border-slate-700"><Pencil className="h-3.5 w-3.5" /></button>
                            <button type="button" onClick={() => void remove(r)} className="rounded-lg border border-slate-200 p-1 text-rose-500 hover:bg-rose-50 dark:border-slate-700"><Trash2 className="h-3.5 w-3.5" /></button>
                          </>
                        ) : null}
                        {tab === "balances" ? (
                          <button type="button" onClick={() => void adjustBalance(r)} className="rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300">{s.t("adjust", "Adjust")}</button>
                        ) : null}
                        {tab === "corrections" && r.status === "pending" ? (
                          <>
                            <button type="button" disabled={busy} onClick={() => void correctionAction(r.id, "approve")} className="rounded-lg bg-emerald-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-emerald-700 disabled:opacity-50"><Check className="h-3 w-3" /></button>
                            <button type="button" disabled={busy} onClick={() => void correctionAction(r.id, "reject")} className="rounded-lg border border-rose-200 px-2 py-1 text-[10px] font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900"><Ban className="h-3 w-3" /></button>
                          </>
                        ) : null}
                        {tab === "corrections" && r.status === "approved" ? (
                          <button type="button" disabled={busy} onClick={() => void correctionAction(r.id, "apply")} className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-blue-700 disabled:opacity-50"><Play className="h-3 w-3" />{s.t("apply", "Apply")}</button>
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

      {showForm ? (
        <PhaseForm s={s} tab={tab} initial={editing} employees={employees} onClose={() => { setShowForm(false); setEditing(null); }} onSave={save} />
      ) : null}
    </section>
  );
}

function columnsFor(tab: Tab, s: ReturnType<typeof useErpScreen>): { key: string; label: string; align?: "right"; render?: (r: Row, s: any) => any }[] {
  if (tab === "leave_types") return [
    { key: "code", label: s.t("code", "Code") },
    { key: "name", label: s.t("name", "Name") },
    { key: "is_paid", label: s.t("lt_paid", "Paid"), render: (r) => (r.is_paid ? s.t("yes", "Yes") : s.t("no", "No")) },
    { key: "annual_entitlement_days", label: s.t("lt_entitlement", "Annual Days"), align: "right", render: (r) => NUM(r.annual_entitlement_days) },
    { key: "max_carry_forward_days", label: s.t("lt_carry", "Carry Fwd"), align: "right", render: (r) => NUM(r.max_carry_forward_days) },
    { key: "min_notice_days", label: s.t("lt_notice", "Notice Days"), align: "right" },
  ];
  if (tab === "shifts") return [
    { key: "code", label: s.t("code", "Code") },
    { key: "name", label: s.t("name", "Name") },
    { key: "start_time", label: s.t("sh_start", "Start") },
    { key: "end_time", label: s.t("sh_end", "End") },
    { key: "grace_minutes", label: s.t("sh_grace", "Grace (min)"), align: "right" },
    { key: "working_days", label: s.t("sh_days", "Working Days") },
    { key: "country_name", label: s.t("country", "Country") },
  ];
  if (tab === "holidays") return [
    { key: "holiday_date", label: s.t("date", "Date") },
    { key: "name", label: s.t("name", "Name") },
    { key: "holiday_type", label: s.t("h_type", "Type"), render: (r) => s.t(`h_type_${r.holiday_type}`, r.holiday_type) },
    { key: "country_name", label: s.t("country", "Country") },
    { key: "is_paid", label: s.t("h_paid", "Paid"), render: (r) => (r.is_paid ? s.t("yes", "Yes") : s.t("no", "No")) },
  ];
  if (tab === "balances") return [
    { key: "employee_name", label: s.t("employee", "Employee"), render: (r) => `${r.employee_name} (${r.employee_code})` },
    { key: "leave_type_name", label: s.t("bal_type", "Leave Type") },
    { key: "year", label: s.t("bal_year", "Year") },
    { key: "entitled_days", label: s.t("bal_entitled", "Entitled"), align: "right", render: (r) => NUM(r.entitled_days) },
    { key: "carried_forward", label: s.t("bal_carried", "Carried"), align: "right", render: (r) => NUM(r.carried_forward) },
    { key: "taken_days", label: s.t("bal_taken", "Taken"), align: "right", render: (r) => NUM(r.taken_days) },
    { key: "pending_days", label: s.t("bal_pending", "Pending"), align: "right", render: (r) => NUM(r.pending_days) },
    { key: "adjustment_days", label: s.t("bal_adjust", "Adjust"), align: "right", render: (r) => NUM(r.adjustment_days) },
    { key: "remaining_days", label: s.t("bal_remaining", "Remaining"), align: "right", render: (r) => NUM(r.remaining_days) },
  ];
  return [
    { key: "employee_name", label: s.t("employee", "Employee"), render: (r) => `${r.employee_name} (${r.employee_code})` },
    { key: "attendance_date", label: s.t("date", "Date") },
    { key: "change", label: s.t("corr_change", "Old → New"), render: (r) => {
      const p: string[] = [];
      if (r.new_check_in) p.push(`${s.t("sh_start", "In")}: ${r.prev_check_in || "—"} → ${r.new_check_in}`);
      if (r.new_check_out) p.push(`${s.t("sh_end", "Out")}: ${r.prev_check_out || "—"} → ${r.new_check_out}`);
      if (r.new_status) p.push(`${s.t("status_label", "Status")}: ${r.prev_status || "—"} → ${r.new_status}`);
      return p.join(" · ") || "—";
    } },
    { key: "reason", label: s.t("reason", "Reason") },
    { key: "status", label: s.t("status_label", "Status"), render: (r) => (
      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${CORR_TONE[r.status] || CORR_TONE.pending}`}>{s.t(`lc_status_${r.status}`, r.status)}</span>
    ) },
  ];
}

function PhaseForm({
  s, tab, initial, employees, onClose, onSave,
}: {
  s: ReturnType<typeof useErpScreen>;
  tab: Tab;
  initial: Row | null;
  employees: Row[];
  onClose: () => void;
  onSave: (payload: Row) => Promise<void>;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [f, setF] = useState<Row>(() => {
    if (initial) return { ...initial };
    if (tab === "leave_types") return { code: "", name: "", isPaid: true, annualEntitlementDays: 0, accrualMethod: "annual", maxCarryForwardDays: 0, minNoticeDays: 0, isActive: true };
    if (tab === "shifts") return { code: "", name: "", startTime: "09:00", endTime: "18:00", breakMinutes: 60, graceMinutes: 15, workingDays: "Mon,Tue,Wed,Thu,Fri", isActive: true };
    if (tab === "holidays") return { name: "", holidayDate: today, holidayType: "public", isPaid: true, isRecurring: false };
    return { employeeId: "", attendanceDate: today, newCheckIn: "", newCheckOut: "", newStatus: "", reason: "" };
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: string, v: any) => setF((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    setSaving(true);
    setErr(null);
    try {
      const payload: Row = { ...f };
      // normalise: snake_case keys from an edit row -> camelCase, numbers
      if (tab === "leave_types") {
        ["annual_entitlement_days", "max_carry_forward_days", "min_notice_days"].forEach((k) => { if (payload[k] != null) payload[camel(k)] = Number(payload[k]); });
        payload.isPaid = payload.is_paid ?? payload.isPaid ?? true;
        payload.isActive = payload.is_active ?? payload.isActive ?? true;
        payload.accrualMethod = payload.accrual_method ?? payload.accrualMethod ?? "annual";
      }
      if (tab === "shifts") {
        ["break_minutes", "grace_minutes"].forEach((k) => { if (payload[k] != null) payload[camel(k)] = Number(payload[k]); });
        payload.startTime = payload.start_time ?? payload.startTime;
        payload.endTime = payload.end_time ?? payload.endTime;
        payload.workingDays = payload.working_days ?? payload.workingDays;
        payload.isActive = payload.is_active ?? payload.isActive ?? true;
      }
      if (tab === "holidays") {
        payload.holidayDate = payload.holiday_date ?? payload.holidayDate;
        payload.holidayType = payload.holiday_type ?? payload.holidayType ?? "public";
        payload.isPaid = payload.is_paid ?? payload.isPaid ?? true;
        payload.isRecurring = payload.is_recurring ?? payload.isRecurring ?? false;
      }
      if (tab === "corrections" && payload.newWorkHours != null && payload.newWorkHours !== "") payload.newWorkHours = Number(payload.newWorkHours);
      Object.keys(payload).forEach((k) => { if (payload[k] === "") payload[k] = undefined; });
      await onSave(payload);
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
          <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">{initial ? s.t("edit", "Edit") : s.t("add", "Add")} — {s.t(`tab_${tab}`, tab)}</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button>
        </div>
        {err ? <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{err}</p> : null}

        <div className="mt-4 space-y-3">
          {tab === "leave_types" && (
            <>
              <F label={s.t("code", "Code")}><input value={f.code ?? ""} onChange={(e) => set("code", e.target.value)} className={INP} /></F>
              <F label={s.t("name", "Name")}><input value={f.name ?? ""} onChange={(e) => set("name", e.target.value)} className={INP} /></F>
              <div className="grid grid-cols-2 gap-2">
                <F label={s.t("lt_entitlement", "Annual Days")}><input type="number" value={f.annual_entitlement_days ?? f.annualEntitlementDays ?? 0} onChange={(e) => set("annualEntitlementDays", e.target.value)} className={INP} /></F>
                <F label={s.t("lt_carry", "Carry Fwd")}><input type="number" value={f.max_carry_forward_days ?? f.maxCarryForwardDays ?? 0} onChange={(e) => set("maxCarryForwardDays", e.target.value)} className={INP} /></F>
                <F label={s.t("lt_notice", "Notice Days")}><input type="number" value={f.min_notice_days ?? f.minNoticeDays ?? 0} onChange={(e) => set("minNoticeDays", e.target.value)} className={INP} /></F>
                <F label={s.t("lt_accrual", "Accrual")}>
                  <select value={f.accrual_method ?? f.accrualMethod ?? "annual"} onChange={(e) => set("accrualMethod", e.target.value)} className={INP}>
                    {["annual", "monthly", "none"].map((k) => <option key={k} value={k}>{s.t(`lt_accrual_${k}`, k)}</option>)}
                  </select>
                </F>
              </div>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300"><input type="checkbox" checked={f.is_paid ?? f.isPaid ?? true} onChange={(e) => set("isPaid", e.target.checked)} />{s.t("lt_paid", "Paid")}</label>
            </>
          )}
          {tab === "shifts" && (
            <>
              <F label={s.t("code", "Code")}><input value={f.code ?? ""} onChange={(e) => set("code", e.target.value)} className={INP} /></F>
              <F label={s.t("name", "Name")}><input value={f.name ?? ""} onChange={(e) => set("name", e.target.value)} className={INP} /></F>
              <div className="grid grid-cols-2 gap-2">
                <F label={s.t("sh_start", "Start")}><input type="time" value={f.start_time ?? f.startTime ?? "09:00"} onChange={(e) => set("startTime", e.target.value)} className={INP} /></F>
                <F label={s.t("sh_end", "End")}><input type="time" value={f.end_time ?? f.endTime ?? "18:00"} onChange={(e) => set("endTime", e.target.value)} className={INP} /></F>
                <F label={s.t("sh_break", "Break (min)")}><input type="number" value={f.break_minutes ?? f.breakMinutes ?? 60} onChange={(e) => set("breakMinutes", e.target.value)} className={INP} /></F>
                <F label={s.t("sh_grace", "Grace (min)")}><input type="number" value={f.grace_minutes ?? f.graceMinutes ?? 15} onChange={(e) => set("graceMinutes", e.target.value)} className={INP} /></F>
              </div>
              <F label={s.t("sh_days", "Working Days")}><input value={f.working_days ?? f.workingDays ?? ""} onChange={(e) => set("workingDays", e.target.value)} className={INP} /></F>
            </>
          )}
          {tab === "holidays" && (
            <>
              <F label={s.t("name", "Name")}><input value={f.name ?? ""} onChange={(e) => set("name", e.target.value)} className={INP} /></F>
              <F label={s.t("date", "Date")}><input type="date" value={f.holiday_date ?? f.holidayDate ?? today} onChange={(e) => set("holidayDate", e.target.value)} className={INP} /></F>
              <F label={s.t("h_type", "Type")}>
                <select value={f.holiday_type ?? f.holidayType ?? "public"} onChange={(e) => set("holidayType", e.target.value)} className={INP}>
                  {["public", "religious", "national", "company", "weekly_off"].map((k) => <option key={k} value={k}>{s.t(`h_type_${k}`, k)}</option>)}
                </select>
              </F>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300"><input type="checkbox" checked={f.is_recurring ?? f.isRecurring ?? false} onChange={(e) => set("isRecurring", e.target.checked)} />{s.t("h_recurring", "Recurring yearly")}</label>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300"><input type="checkbox" checked={f.is_paid ?? f.isPaid ?? true} onChange={(e) => set("isPaid", e.target.checked)} />{s.t("h_paid", "Paid")}</label>
            </>
          )}
          {tab === "corrections" && (
            <>
              <F label={s.t("employee", "Employee")}>
                <select value={f.employeeId ?? ""} onChange={(e) => set("employeeId", e.target.value)} className={INP}>
                  <option value="">{s.t("select_employee", "Select employee…")}</option>
                  {employees.map((e) => <option key={e.id} value={e.id}>{e.name} ({e.employee_code})</option>)}
                </select>
              </F>
              <F label={s.t("date", "Attendance Date")}><input type="date" value={f.attendanceDate ?? today} onChange={(e) => set("attendanceDate", e.target.value)} className={INP} /></F>
              <div className="grid grid-cols-2 gap-2">
                <F label={s.t("corr_new_in", "New Check-In")}><input type="time" value={f.newCheckIn ?? ""} onChange={(e) => set("newCheckIn", e.target.value)} className={INP} /></F>
                <F label={s.t("corr_new_out", "New Check-Out")}><input type="time" value={f.newCheckOut ?? ""} onChange={(e) => set("newCheckOut", e.target.value)} className={INP} /></F>
              </div>
              <F label={s.t("corr_new_status", "New Status")}><input value={f.newStatus ?? ""} onChange={(e) => set("newStatus", e.target.value)} placeholder={s.t("corr_new_status_ph", "Present / Absent / Late…")} className={INP} /></F>
              <F label={s.t("reason", "Reason")}><textarea value={f.reason ?? ""} onChange={(e) => set("reason", e.target.value)} rows={2} className={INP} /></F>
            </>
          )}
        </div>

        <div className="mt-5 flex gap-2">
          <button type="button" onClick={() => void submit()} disabled={saving} className="flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
            {saving ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : s.t("save", "Save")}
          </button>
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300">{s.t("cancel", "Cancel")}</button>
        </div>
      </div>
    </div>
  );
}

function camel(s: string) { return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase()); }

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</label>
      {children}
    </div>
  );
}
