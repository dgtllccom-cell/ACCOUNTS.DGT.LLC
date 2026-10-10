/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

/**
 * Leave & Attendance (HRM). The Attendance Register shows REAL office_attendance records for the
 * selected date — manual, Face-ID / biometric device and HR-corrected rows alike. An employee
 * without a record is shown as "Not recorded"; nothing is invented (the earlier register derived
 * status and times from the row index and showed demo employees when the list was empty).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Loader2, Plus, Pencil, Trash2, X, Check, Ban, RefreshCw, Play, CalendarCheck, Users, Clock, Search,
  Fingerprint, UserX, AlertCircle, CheckCircle2,
} from "lucide-react";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api/client";
import { Th } from "@/components/ui/translated-th";
import { UniversalPrintActionButton } from "@/components/reports/universal-print-action-button";
import { BiometricDevicesPanel } from "@/features/hrm/components/biometric-devices-panel";

type Row = Record<string, any>;
type Tab = "attendance" | "devices" | "balances" | "leave_types" | "shifts" | "holidays" | "corrections";

const INP = "w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 dark:border-slate-700 dark:bg-slate-800";
const NUM = (v: any) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(Number(v) || 0);
const today = () => new Date().toISOString().slice(0, 10);
const hhmm = (t: unknown) => (t ? String(t).slice(0, 5) : "—");

const CORR_TONE: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  approved: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  applied: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  rejected: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
};

type AttRow = {
  id: string; code: string; name: string; department: string; branch: string; country: string;
  checkIn: string; checkOut: string; hours: number | null; late: number | null; overtime: number | null;
  status: "present" | "late" | "absent" | "leave" | "not_recorded" | "other"; rawStatus: string | null; source: string | null;
};

function normStatus(raw: string | null | undefined, late: number | null): AttRow["status"] {
  const v = (raw ?? "").toLowerCase();
  if (!v) return "not_recorded";
  if (v.includes("absent")) return "absent";
  if (v.includes("leave")) return "leave";
  if (v.includes("late") || (late ?? 0) > 0) return "late";
  if (v.includes("present") || v.includes("wfh") || v.includes("work from home") || v.includes("half")) return "present";
  return "other";
}

const STATUS_TONE: Record<AttRow["status"], string> = {
  present: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  late: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
  absent: "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300",
  leave: "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
  not_recorded: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
  other: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

export function HrLeaveAttendanceView({ lang }: { lang?: string }) {
  const s = useErpScreen("hrm", lang);
  const [tab, setTab] = useState<Tab>("attendance");
  const [rows, setRows] = useState<Row[]>([]);
  const [employees, setEmployees] = useState<Row[]>([]);
  const [attendance, setAttendance] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [editing, setEditing] = useState<Row | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [countryFilter, setCountryFilter] = useState("all");
  const [branchFilter, setBranchFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedDate, setSelectedDate] = useState(today());

  const endpoint = tab === "leave_types" ? "/api/erp/hr/leave-types"
    : tab === "shifts" ? "/api/erp/hr/shifts"
    : tab === "holidays" ? "/api/erp/hr/holidays"
    : tab === "balances" ? "/api/erp/hr/leave-balances"
    : "/api/erp/hr/attendance-corrections";

  const load = useCallback(async () => {
    if (tab === "devices") { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const e = await apiGet<{ rows: Row[] }>("/api/erp/hr/employees");
      setEmployees(e.rows ?? []);
      if (tab === "attendance") {
        const a = await apiGet<{ attendance: Row[] }>(`/api/erp/general-office/attendance?from=${selectedDate}&to=${selectedDate}`);
        setAttendance(a.attendance ?? []);
      } else {
        let url = endpoint;
        if (tab === "balances" || tab === "holidays") url += `?year=${year}`;
        const res = await apiGet<{ rows: Row[] }>(url);
        setRows(res.rows ?? []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [endpoint, tab, year, selectedDate]);

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
      window.alert(`${action === "initialize" ? s.t("bal_initialize", "Initialize Year") : s.t("bal_recompute", "Recompute")}: ${res.upserted ?? res.updated ?? 0}`);
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

  // Real register: every in-scope employee + their real attendance row for the selected date.
  const register = useMemo<AttRow[]>(() => {
    const byEmp = new Map<string, Row>();
    for (const a of attendance) if (!byEmp.has(a.employee_id)) byEmp.set(a.employee_id, a);
    return employees.map((e) => {
      const a = byEmp.get(e.id);
      const late = a?.late_minutes != null ? Number(a.late_minutes) : null;
      return {
        id: e.id,
        code: e.employee_code ?? "—",
        name: e.name ?? "—",
        department: e.department ?? "—",
        branch: e.city_branch_name ?? "—",
        country: e.country_name ?? "—",
        checkIn: hhmm(a?.check_in),
        checkOut: hhmm(a?.check_out),
        hours: a?.work_hours != null ? Number(a.work_hours) : null,
        late,
        overtime: a?.overtime_hours != null ? Number(a.overtime_hours) : null,
        status: a ? normStatus(a.status, late) : "not_recorded",
        rawStatus: a?.status ?? null,
        source: a?.source ?? null,
      };
    });
  }, [employees, attendance]);

  const countries = useMemo(() => [...new Set(register.map((r) => r.country).filter((x) => x !== "—"))].sort(), [register]);
  const branches = useMemo(() => [...new Set(register.map((r) => r.branch).filter((x) => x !== "—"))].sort(), [register]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return register.filter((r) =>
      (countryFilter === "all" || r.country === countryFilter) &&
      (branchFilter === "all" || r.branch === branchFilter) &&
      (statusFilter === "all" || r.status === statusFilter) &&
      (!q || [r.name, r.code, r.department].some((x) => x.toLowerCase().includes(q)))
    );
  }, [register, search, countryFilter, branchFilter, statusFilter]);

  const kpi = useMemo(() => ({
    employees: register.length,
    present: register.filter((r) => r.status === "present" || r.status === "late").length,
    late: register.filter((r) => r.status === "late").length,
    absent: register.filter((r) => r.status === "absent").length,
    leave: register.filter((r) => r.status === "leave").length,
    notRecorded: register.filter((r) => r.status === "not_recorded").length,
    device: register.filter((r) => r.source === "device" || r.source === "import").length,
  }), [register]);

  const statusLabel = (st: AttRow["status"]) =>
    ({
      present: s.t("att_present", "Present"),
      late: s.t("att_late", "Late"),
      absent: s.t("att_absent", "Absent"),
      leave: s.t("att_leave", "On leave"),
      not_recorded: s.t("att_not_recorded", "Not recorded"),
      other: s.t("att_other", "Other"),
    })[st];
  const sourceLabel = (src: string | null) =>
    src === "device" ? s.t("src_device", "Face-ID / device") : src === "import" ? s.t("src_import", "Device log import") : src === "correction" ? s.t("src_correction", "HR correction") : src ? s.t("src_manual", "Manual") : "—";

  const printConfig = () => ({
    moduleType: "register" as const,
    reportType: "register" as const,
    title: tab === "attendance" ? s.t("att_register_title", "Daily Attendance Register") : s.t(`tab_${tab}`, tab),
    subtitle: tab === "attendance" ? `${s.t("leave_attendance_title", "Leave & Attendance")} · ${selectedDate}` : s.t("leave_attendance_title", "Leave & Attendance"),
    lang: s.lang,
    orientation: "landscape" as const,
    columns: tab === "attendance"
      ? [
          { key: "code", label: s.t("emp_code", "Employee ID") },
          { key: "name", label: s.t("employee", "Employee") },
          { key: "department", label: s.t("department", "Department") },
          { key: "branch", label: s.t("branch", "Branch") },
          { key: "checkIn", label: s.t("check_in", "Check In") },
          { key: "checkOut", label: s.t("check_out", "Check Out") },
          { key: "hours", label: s.t("hours", "Hours"), render: (r: any) => (r.hours == null ? "—" : NUM(r.hours)) },
          { key: "status", label: s.t("status_label", "Status"), render: (r: any) => statusLabel(r.status) },
          { key: "source", label: s.t("source", "Source"), render: (r: any) => sourceLabel(r.source) },
        ]
      : columnsFor(tab as Exclude<Tab, "attendance" | "devices">, s),
    rows: tab === "attendance" ? filtered : rows,
  });

  const TABS: Array<{ id: Tab; label: string }> = [
    { id: "attendance", label: s.t("tab_attendance", "Attendance Register") },
    { id: "devices", label: s.t("tab_devices", "Face-ID / Biometric Devices") },
    { id: "balances", label: s.t("tab_balances", "Leave Requests & Balances") },
    { id: "leave_types", label: s.t("tab_leave_types", "Leave Types") },
    { id: "shifts", label: s.t("tab_shifts", "Shifts") },
    { id: "holidays", label: s.t("tab_holidays", "Holidays") },
    { id: "corrections", label: s.t("tab_corrections", "Corrections") },
  ];
  const sel = "rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 outline-none focus:border-purple-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200";

  return (
    <div dir={s.dir} className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-600 text-white"><CalendarCheck className="h-5 w-5" /></div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">{s.t("leave_attendance_title", "Leave & Attendance")}</h1>
            <p className="text-xs text-slate-500">{s.t("att_subtitle", "One attendance record per employee per day — manual, Face-ID device or HR correction. Payroll reads these records.")}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => void load()} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
            <RefreshCw className="h-3.5 w-3.5" /> {s.t("refresh", "Refresh")}
          </button>
          {tab !== "devices" && <UniversalPrintActionButton reportConfig={printConfig as any} />}
        </div>
      </div>

      {tab === "attendance" && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6" data-testid="att-kpis">
          {[
            { k: "employees", label: s.t("kpi_employees", "Employees"), v: kpi.employees, icon: Users, tone: "text-slate-600" },
            { k: "present", label: s.t("kpi_present", "Present"), v: kpi.present, icon: CheckCircle2, tone: "text-emerald-600" },
            { k: "late", label: s.t("kpi_late", "Late"), v: kpi.late, icon: Clock, tone: "text-amber-600" },
            { k: "absent", label: s.t("kpi_absent", "Absent"), v: kpi.absent, icon: UserX, tone: "text-rose-600" },
            { k: "not_recorded", label: s.t("kpi_not_recorded", "Not recorded"), v: kpi.notRecorded, icon: AlertCircle, tone: "text-slate-500" },
            { k: "device", label: s.t("kpi_device", "From Face-ID devices"), v: kpi.device, icon: Fingerprint, tone: "text-purple-600" },
          ].map((c) => (
            <div key={c.k} data-testid={`att-kpi-${c.k}`} className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">{c.label}<c.icon className={`h-4 w-4 ${c.tone}`} /></div>
              <div className="mt-1 text-xl font-bold tabular-nums">{c.v}</div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2 dark:border-slate-800">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            data-testid={`hr-tab-${t.id}`}
            onClick={() => setTab(t.id)}
            className={`rounded-xl px-4 py-2 text-xs font-bold ${tab === t.id ? "bg-purple-600 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p>}

      {tab === "devices" ? (
        <BiometricDevicesPanel lang={s.lang} employees={employees.length ? employees : undefined} />
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3 dark:border-slate-800">
            {tab === "attendance" ? (
              <>
                <input type="date" data-testid="att-date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className={sel} />
                <select value={countryFilter} onChange={(e) => setCountryFilter(e.target.value)} className={sel}>
                  <option value="all">{s.t("all_countries", "All Countries")}</option>
                  {countries.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} className={sel}>
                  <option value="all">{s.t("all_branches", "All Branches")}</option>
                  {branches.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={sel}>
                  <option value="all">{s.t("all_status", "All Status")}</option>
                  {(["present", "late", "absent", "leave", "not_recorded"] as const).map((k) => <option key={k} value={k}>{statusLabel(k)}</option>)}
                </select>
                <div className="relative ms-auto">
                  <Search className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={s.t("search_emp", "Search employee, code, department…")} className={`${sel} ps-8`} />
                </div>
              </>
            ) : (
              <>
                {(tab === "balances" || tab === "holidays") && (
                  <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value) || new Date().getFullYear())} className={`${sel} w-24`} />
                )}
                <div className="ms-auto flex gap-2">
                  {["leave_types", "shifts", "holidays", "corrections"].includes(tab) && (
                    <button type="button" onClick={() => { setEditing(null); setShowForm(true); }} className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-purple-700">
                      <Plus className="h-4 w-4" /> {s.t("add", "Add")}
                    </button>
                  )}
                  {tab === "balances" && (
                    <>
                      <button type="button" disabled={busy} onClick={() => void balanceAction("initialize")} className="rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50">{s.t("bal_initialize", "Initialize Year")}</button>
                      <button type="button" disabled={busy} onClick={() => void balanceAction("recompute")} className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold hover:bg-slate-50 dark:border-slate-700">{s.t("bal_recompute", "Recompute")}</button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="overflow-x-auto">
            {tab === "attendance" ? (
              <table data-testid="att-register" className="w-full min-w-[900px] text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60">
                  <tr>
                    {[s.t("emp_code", "Employee ID"), s.t("employee", "Employee"), s.t("department", "Department"), s.t("branch", "Branch"), s.t("check_in", "Check In"), s.t("check_out", "Check Out"), s.t("hours", "Hours"), s.t("late_min", "Late (min)"), s.t("overtime_h", "Overtime (h)"), s.t("status_label", "Status"), s.t("source", "Source")].map((h) => (
                      <Th key={h} className={`px-3 py-2.5 font-bold ${s.textStart}`}>{h}</Th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={11} className="px-3 py-10 text-center"><Loader2 className="mx-auto h-4 w-4 animate-spin text-purple-600" /></td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={11} className="px-3 py-10 text-center text-slate-400">{employees.length ? s.t("empty", "No records found.") : s.t("no_employees", "No employees in your scope yet.")}</td></tr>
                  ) : (
                    filtered.map((r) => (
                      <tr key={r.id} data-testid="att-row" data-status={r.status} className="border-t border-slate-100 dark:border-slate-800">
                        <td className="px-3 py-2 font-mono font-semibold whitespace-nowrap">{r.code}</td>
                        <td className="px-3 py-2 font-semibold text-slate-900 dark:text-slate-100">{r.name}</td>
                        <td className="px-3 py-2">{r.department}</td>
                        <td className="px-3 py-2">{r.branch}</td>
                        <td className="px-3 py-2 tabular-nums">{r.checkIn}</td>
                        <td className="px-3 py-2 tabular-nums">{r.checkOut}</td>
                        <td className="px-3 py-2 tabular-nums">{r.hours == null ? "—" : NUM(r.hours)}</td>
                        <td className="px-3 py-2 tabular-nums">{r.late == null ? "—" : r.late}</td>
                        <td className="px-3 py-2 tabular-nums">{r.overtime == null ? "—" : NUM(r.overtime)}</td>
                        <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_TONE[r.status]}`}>{statusLabel(r.status)}</span></td>
                        <td className="px-3 py-2">{r.source === "device" || r.source === "import" ? <span className="inline-flex items-center gap-1 text-purple-700 dark:text-purple-300"><Fingerprint className="h-3.5 w-3.5" />{sourceLabel(r.source)}</span> : sourceLabel(r.source)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60">
                  <tr>
                    {columnsFor(tab, s).map((c) => (
                      <Th key={c.key} className={`px-3 py-2.5 font-bold ${c.align === "right" ? s.textEnd : s.textStart}`}>{c.label}</Th>
                    ))}
                    <Th className={`px-3 py-2.5 font-bold ${s.textEnd}`}>{s.t("actions", "Actions")}</Th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={12} className="px-3 py-10 text-center"><Loader2 className="mx-auto h-4 w-4 animate-spin text-purple-600" /></td></tr>
                  ) : rows.length === 0 ? (
                    <tr><td colSpan={12} className="px-3 py-10 text-center text-slate-400">{s.t("empty", "No records found.")}</td></tr>
                  ) : (
                    rows.map((r) => (
                      <tr key={r.id} className="border-t border-slate-100 dark:border-slate-800">
                        {columnsFor(tab, s).map((c) => (
                          <td key={c.key} className={`px-3 py-2.5 ${c.align === "right" ? `${s.textEnd} tabular-nums` : "text-slate-600 dark:text-slate-300"}`}>{c.render ? c.render(r, s) : (r[c.key] ?? "—")}</td>
                        ))}
                        <td className={`px-3 py-2.5 ${s.textEnd}`}>
                          <div className="inline-flex gap-1">
                            {["leave_types", "shifts", "holidays"].includes(tab) && (
                              <>
                                <button type="button" aria-label={s.t("edit", "Edit")} onClick={() => { setEditing(r); setShowForm(true); }} className="rounded-lg border border-slate-200 p-1 text-slate-400 hover:bg-slate-50 dark:border-slate-700"><Pencil className="h-3.5 w-3.5" /></button>
                                <button type="button" aria-label={s.t("delete", "Delete")} onClick={() => void remove(r)} className="rounded-lg border border-slate-200 p-1 text-rose-500 hover:bg-rose-50 dark:border-slate-700"><Trash2 className="h-3.5 w-3.5" /></button>
                              </>
                            )}
                            {tab === "balances" && (
                              <button type="button" onClick={() => void adjustBalance(r)} className="rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-bold dark:border-slate-700">{s.t("adjust", "Adjust")}</button>
                            )}
                            {tab === "corrections" && r.status === "pending" && (
                              <>
                                <button type="button" aria-label={s.t("approve", "Approve")} disabled={busy} onClick={() => void correctionAction(r.id, "approve")} className="rounded-lg bg-emerald-600 px-2 py-1 text-white disabled:opacity-50"><Check className="h-3 w-3" /></button>
                                <button type="button" aria-label={s.t("reject", "Reject")} disabled={busy} onClick={() => void correctionAction(r.id, "reject")} className="rounded-lg border border-rose-200 px-2 py-1 text-rose-600 disabled:opacity-50 dark:border-rose-900"><Ban className="h-3 w-3" /></button>
                              </>
                            )}
                            {tab === "corrections" && r.status === "approved" && (
                              <button type="button" disabled={busy} onClick={() => void correctionAction(r.id, "apply")} className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2 py-1 text-[10px] font-bold text-white disabled:opacity-50"><Play className="h-3 w-3" />{s.t("apply", "Apply")}</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
          <div className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500 dark:border-slate-800">
            {(tab === "attendance" ? filtered.length : rows.length)} {s.t("records", "records")}
          </div>
        </div>
      )}

      {showForm && tab !== "attendance" && tab !== "devices" ? (
        <PhaseForm s={s} tab={tab} initial={editing} employees={employees} onClose={() => { setShowForm(false); setEditing(null); }} onSave={save} />
      ) : null}
    </div>
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
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm" onClick={onClose}>
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
          <button type="button" onClick={() => void submit()} disabled={saving} className="flex-1 rounded-lg bg-purple-600 px-3 py-2 text-xs font-bold text-white hover:bg-purple-700 disabled:opacity-50">
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
