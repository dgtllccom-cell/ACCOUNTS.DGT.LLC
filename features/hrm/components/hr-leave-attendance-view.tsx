"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Loader2, Plus, Pencil, Trash2, X, Check, Ban, RefreshCw, Play,
  CalendarCheck, Building2, Users, Clock, Globe, Search, Printer,
  FileDown, FileSpreadsheet, MoreVertical, ChevronLeft, ChevronRight,
  Filter, CheckCircle2, AlertCircle, XCircle, Calendar, ArrowUpDown
} from "lucide-react";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api/client";
import { Th } from "@/components/ui/translated-th";
import { UniversalPrintActionButton } from "@/components/reports/universal-print-action-button";

type Row = Record<string, any>;
type Tab = "attendance" | "balances" | "leave_types" | "shifts" | "holidays" | "corrections";

const INP = "w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 dark:border-slate-700 dark:bg-slate-800";
const NUM = (v: any) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(Number(v) || 0);

const CORR_TONE: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  approved: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  applied: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  rejected: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
};

function getCountryFlagAndName(country?: string): { flag: string; name: string } {
  if (!country) return { flag: "🇦🇪", name: "UAE" };
  const lower = country.toLowerCase();
  if (lower.includes("uae") || lower.includes("emirates") || lower.includes("united arab")) return { flag: "🇦🇪", name: "UAE" };
  if (lower.includes("pak")) return { flag: "🇵🇰", name: "Pakistan" };
  if (lower.includes("oman")) return { flag: "🇴🇲", name: "Oman" };
  if (lower.includes("saudi")) return { flag: "🇸🇦", name: "Saudi Arabia" };
  if (lower.includes("india")) return { flag: "🇮🇳", name: "India" };
  if (lower.includes("qatar")) return { flag: "🇶🇦", name: "Qatar" };
  if (lower.includes("kuwait")) return { flag: "🇰🇼", name: "Kuwait" };
  if (lower.includes("bahrain")) return { flag: "🇧🇭", name: "Bahrain" };
  return { flag: "🌐", name: country };
}

export function HrLeaveAttendanceView({ lang }: { lang?: string }) {
  const s = useErpScreen("hrm", lang);
  const [tab, setTab] = useState<Tab>("attendance");
  const [rows, setRows] = useState<Row[]>([]);
  const [employees, setEmployees] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [editing, setEditing] = useState<Row | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);

  // Filters for Attendance Register
  const [searchQuery, setSearchQuery] = useState("");
  const [countryFilter, setCountryFilter] = useState("all");
  const [branchFilter, setBranchFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [shiftFilter, setShiftFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedDate, setSelectedDate] = useState("2026-09-10");
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});

  const endpoint = tab === "attendance" ? "/api/erp/hr/employees"
    : tab === "leave_types" ? "/api/erp/hr/leave-types"
    : tab === "shifts" ? "/api/erp/hr/shifts"
    : tab === "holidays" ? "/api/erp/hr/holidays"
    : tab === "balances" ? "/api/erp/hr/leave-balances"
    : "/api/erp/hr/attendance-corrections";

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (tab === "attendance") {
        const e = await apiGet<{ rows: Row[] }>("/api/erp/hr/employees");
        setEmployees(e.rows ?? []);
        setRows(e.rows ?? []);
      } else {
        let url = endpoint;
        if (tab === "balances" || tab === "holidays") url += `?year=${year}`;
        const res = await apiGet<{ rows: Row[] }>(url);
        setRows(res.rows ?? []);
        if (employees.length === 0) {
          const e = await apiGet<{ rows: Row[] }>("/api/erp/hr/employees");
          setEmployees(e.rows ?? []);
        }
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

  // Synthetic or calculated attendance list matching the screenshot presentation
  const attendanceList = useMemo(() => {
    const rawList = employees.length > 0 ? employees : [
      { id: "1", employee_code: "EMP-001", name: "Muhammad Rashid", country_name: "UAE", branch_name: "Main Headquarters", department: "Administration", shift: "Morning (09:00 - 18:00)", check_in: "08:55 AM", check_out: "06:05 PM", work_hours: "8h 10m", late: "0m", overtime: "5m", leave_type: "--", status: "present" },
      { id: "2", employee_code: "EMP-002", name: "Ahmed Al-Maktoum", country_name: "UAE", branch_name: "Dubai Branch", department: "Sales", shift: "Morning (09:00 - 18:00)", check_in: "09:12 AM", check_out: "06:00 PM", work_hours: "8h 48m", late: "12m", overtime: "0m", leave_type: "--", status: "late" },
      { id: "3", employee_code: "EMP-003", name: "Zainab Fatima", country_name: "Pakistan", branch_name: "Lahore Office", department: "Accounts", shift: "Morning (09:00 - 18:00)", check_in: "08:50 AM", check_out: "06:15 PM", work_hours: "8h 25m", late: "0m", overtime: "15m", leave_type: "--", status: "present" },
      { id: "4", employee_code: "EMP-004", name: "Tariq Mahmood", country_name: "Oman", branch_name: "Muscat Branch", department: "Operations", shift: "Morning (09:00 - 18:00)", check_in: "--", check_out: "--", work_hours: "0h 0m", late: "--", overtime: "--", leave_type: "Annual Leave", status: "leave" },
      { id: "5", employee_code: "EMP-005", name: "Bilal Khan", country_name: "Pakistan", branch_name: "Karachi Branch", department: "IT & Systems", shift: "Morning (09:00 - 18:00)", check_in: "--", check_out: "--", work_hours: "0h 0m", late: "--", overtime: "--", leave_type: "--", status: "absent" },
      { id: "6", employee_code: "EMP-006", name: "Sarah Al-Nuaimi", country_name: "UAE", branch_name: "Abu Dhabi Branch", department: "Human Resources", shift: "Morning (09:00 - 18:00)", check_in: "08:58 AM", check_out: "06:02 PM", work_hours: "8h 04m", late: "0m", overtime: "2m", leave_type: "--", status: "present" },
      { id: "7", employee_code: "EMP-007", name: "Omar Farooq", country_name: "Saudi Arabia", branch_name: "Riyadh Branch", department: "Logistics", shift: "Evening (14:00 - 23:00)", check_in: "02:10 PM", check_out: "11:05 PM", work_hours: "8h 55m", late: "10m", overtime: "5m", leave_type: "--", status: "late" },
      { id: "8", employee_code: "EMP-008", name: "Ayesha Siddiqa", country_name: "UAE", branch_name: "Sharjah Branch", department: "Customer Support", shift: "Morning (09:00 - 18:00)", check_in: "--", check_out: "--", work_hours: "0h 0m", late: "--", overtime: "--", leave_type: "Sick Leave", status: "leave" },
    ];

    return rawList.map((emp, idx) => {
      const code = emp.employee_code || `EMP-${String(idx + 1).padStart(3, "0")}`;
      const name = emp.name || emp.full_name || "Employee " + (idx + 1);
      const c = getCountryFlagAndName(emp.country_name || emp.country || "UAE");
      const branch = emp.branch_name || emp.branch || "Main Headquarters";
      const dept = emp.department || "Administration";
      const shift = emp.shift || "Morning (09:00 - 18:00)";
      
      // Derive status or use existing
      let st = emp.status || (idx % 7 === 1 ? "late" : idx % 7 === 3 ? "leave" : idx % 7 === 4 ? "absent" : "present");
      let inTime = emp.check_in || (st === "absent" || st === "leave" ? "--" : st === "late" ? "09:15 AM" : "08:55 AM");
      let outTime = emp.check_out || (st === "absent" || st === "leave" ? "--" : "06:05 PM");
      let hours = emp.work_hours || (st === "absent" || st === "leave" ? "0h 0m" : "8h 10m");
      let lateMin = emp.late || (st === "late" ? "15m" : "0m");
      let ot = emp.overtime || (st === "present" ? "5m" : "0m");
      let ltype = emp.leave_type || (st === "leave" ? (idx % 2 === 0 ? "Annual Leave" : "Sick Leave") : "--");

      return {
        id: emp.id || String(idx + 1),
        code,
        name,
        country: c,
        branch,
        department: dept,
        shift,
        checkIn: inTime,
        checkOut: outTime,
        workHours: hours,
        late: lateMin,
        overtime: ot,
        leaveType: ltype,
        status: st,
      };
    }).filter((emp) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const match = emp.name.toLowerCase().includes(q) || emp.code.toLowerCase().includes(q) || emp.department.toLowerCase().includes(q);
        if (!match) return false;
      }
      if (countryFilter !== "all" && !emp.country.name.toLowerCase().includes(countryFilter.toLowerCase())) return false;
      if (branchFilter !== "all" && !emp.branch.toLowerCase().includes(branchFilter.toLowerCase())) return false;
      if (departmentFilter !== "all" && !emp.department.toLowerCase().includes(departmentFilter.toLowerCase())) return false;
      if (statusFilter !== "all" && emp.status.toLowerCase() !== statusFilter.toLowerCase()) return false;
      return true;
    });
  }, [employees, searchQuery, countryFilter, branchFilter, departmentFilter, statusFilter]);

  const toggleSelectAll = () => {
    if (Object.keys(selectedIds).length === attendanceList.length) {
      setSelectedIds({});
    } else {
      const next: Record<string, boolean> = {};
      attendanceList.forEach((a) => { next[a.id] = true; });
      setSelectedIds(next);
    }
  };

  const toggleSelectRow = (id: string) => {
    setSelectedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const printConfig = () => ({
    moduleType: "register" as const,
    reportType: "register" as const,
    title: tab === "attendance" ? "Daily Attendance Register" : s.t(`tab_${tab}`, tab),
    subtitle: s.t("leave_attendance_title", "Leave & Attendance"),
    lang: s.lang,
    orientation: "landscape" as const,
    columns: tab === "attendance"
      ? [
          { key: "code", label: "Employee ID" },
          { key: "name", label: "Employee Name" },
          { key: "country", label: "Country", render: (r: any) => `${r.country.flag} ${r.country.name}` },
          { key: "branch", label: "Branch" },
          { key: "department", label: "Department" },
          { key: "shift", label: "Shift" },
          { key: "checkIn", label: "Check In" },
          { key: "checkOut", label: "Check Out" },
          { key: "workHours", label: "Hours" },
          { key: "status", label: "Status" },
        ]
      : columnsFor(tab, s),
    rows: tab === "attendance" ? attendanceList : rows,
  });

  return (
    <div dir={s.dir} className="min-h-screen bg-[#f8fafc] dark:bg-[#0b1120] text-slate-800 dark:text-slate-100 pb-16 font-sans">
      <div className="mx-auto max-w-[1700px] p-4 sm:p-6 lg:p-7 space-y-6">

        {/* 1. TOP BREADCRUMBS */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/general-office"
              className="inline-flex items-center gap-1 font-medium text-slate-500 hover:text-purple-600 transition"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Back
            </Link>
            <span className="text-slate-300 dark:text-slate-700">/</span>
            <span className="text-slate-400">Dashboard</span>
            <span className="text-slate-300 dark:text-slate-700">&gt;</span>
            <span className="text-slate-400">General Office</span>
            <span className="text-slate-300 dark:text-slate-700">&gt;</span>
            <span className="font-semibold text-purple-600 dark:text-purple-400">Leave & Attendance Management</span>
          </div>

          <div className="flex items-center gap-2">
            <UniversalPrintActionButton reportConfig={printConfig} />
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-purple-600" : ""}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* 2. TITLE HEADER */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-100 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400 shadow-inner">
              <CalendarCheck className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-slate-50">
                Leave & Attendance Management
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Manage employee attendance, leave requests, shifts, holidays and attendance corrections.
              </p>
            </div>
          </div>
        </div>

        {/* 3. FOUR KPI CARDS (Screenshot 3 layout) */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Card 1: Branch & User Details (Purple) */}
          <div className="rounded-2xl border border-purple-100 bg-gradient-to-br from-purple-50/70 via-white to-purple-50/20 p-4 shadow-sm dark:border-purple-950/60 dark:from-purple-950/30 dark:via-slate-900 dark:to-slate-900">
            <div className="flex items-center justify-between pb-3 border-b border-purple-100/70 dark:border-purple-900/40">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-purple-100 p-1.5 text-purple-600 dark:bg-purple-900/60 dark:text-purple-300">
                  <Building2 className="h-4 w-4" />
                </div>
                <span className="text-xs font-bold text-purple-950 dark:text-purple-200">Branch & User Details</span>
              </div>
            </div>
            <div className="mt-3 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Branch:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">Main Headquarters</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">User:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">Super Admin</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Department:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">Administration</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Role:</span>
                <span className="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-[11px] font-bold text-purple-700 dark:bg-purple-900/50 dark:text-purple-300">
                  Super Admin
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Attendance Summary (Emerald) */}
          <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50/70 via-white to-emerald-50/20 p-4 shadow-sm dark:border-emerald-950/60 dark:from-emerald-950/30 dark:via-slate-900 dark:to-slate-900">
            <div className="flex items-center justify-between pb-3 border-b border-emerald-100/70 dark:border-emerald-900/40">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-emerald-100 p-1.5 text-emerald-600 dark:bg-emerald-900/60 dark:text-emerald-300">
                  <Users className="h-4 w-4" />
                </div>
                <span className="text-xs font-bold text-emerald-950 dark:text-emerald-200">Attendance Summary</span>
              </div>
            </div>
            <div className="mt-3 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Total Employees:</span>
                <span className="font-black text-slate-900 dark:text-slate-100">{employees.length || 54}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Present Today:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">42</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Absent Today:</span>
                <span className="font-bold text-rose-600 dark:text-rose-400">8</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Late Today:</span>
                <span className="font-bold text-amber-600 dark:text-amber-400">4</span>
              </div>
            </div>
          </div>

          {/* Card 3: Leave Summary (Amber) */}
          <div className="rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50/70 via-white to-amber-50/20 p-4 shadow-sm dark:border-amber-950/60 dark:from-amber-950/30 dark:via-slate-900 dark:to-slate-900">
            <div className="flex items-center justify-between pb-3 border-b border-amber-100/70 dark:border-amber-900/40">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-amber-100 p-1.5 text-amber-600 dark:bg-amber-900/60 dark:text-amber-300">
                  <Clock className="h-4 w-4" />
                </div>
                <span className="text-xs font-bold text-amber-950 dark:text-amber-200">Leave Summary</span>
              </div>
            </div>
            <div className="mt-3 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">On Leave:</span>
                <span className="font-bold text-blue-600 dark:text-blue-400">3</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Pending Requests:</span>
                <span className="font-bold text-amber-600 dark:text-amber-400">5</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Approved:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">12</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Rejected:</span>
                <span className="font-bold text-rose-600 dark:text-rose-400">2</span>
              </div>
            </div>
          </div>

          {/* Card 4: All Countries Attendance Report (Blue + Super Admin Only) */}
          <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50/70 via-white to-blue-50/20 p-4 shadow-sm dark:border-blue-950/60 dark:from-blue-950/30 dark:via-slate-900 dark:to-slate-900">
            <div className="flex items-center justify-between pb-3 border-b border-blue-100/70 dark:border-blue-900/40">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-blue-100 p-1.5 text-blue-600 dark:bg-blue-900/60 dark:text-blue-300">
                  <Globe className="h-4 w-4" />
                </div>
                <span className="text-xs font-bold text-blue-950 dark:text-blue-200">Attendance Report</span>
              </div>
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-black text-blue-700 dark:bg-blue-900/60 dark:text-blue-300 uppercase tracking-wider">
                Super Admin Only
              </span>
            </div>
            <div className="mt-3 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Total Branches:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">8</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Present:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">156</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Absent:</span>
                <span className="font-bold text-rose-600 dark:text-rose-400">28</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Attendance Rate:</span>
                <span className="font-black text-blue-600 dark:text-blue-400">84%</span>
              </div>
            </div>
          </div>
        </div>

        {/* 4. SUB-NAVIGATION TABS */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
          {[
            { id: "attendance", label: "Attendance Register" },
            { id: "balances", label: "Leave Requests & Balances" },
            { id: "leave_types", label: "Leave Types" },
            { id: "shifts", label: "Shifts" },
            { id: "holidays", label: "Holidays" },
            { id: "corrections", label: "Corrections" },
          ].map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id as Tab)}
                className={`rounded-xl px-4 py-2 text-xs font-bold transition-all shadow-sm ${
                  active
                    ? "bg-purple-600 text-white shadow-purple-600/20"
                    : "bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-slate-200 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {/* 5. FILTER ROW & ACTIONS TOOLBAR */}
        <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Date Picker */}
            <div className="relative flex items-center">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-purple-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              />
            </div>

            {/* Country Dropdown */}
            <select
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-purple-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="all">All Countries</option>
              <option value="UAE">🇦🇪 UAE</option>
              <option value="Pakistan">🇵🇰 Pakistan</option>
              <option value="Oman">🇴🇲 Oman</option>
              <option value="Saudi Arabia">🇸🇦 Saudi Arabia</option>
            </select>

            {/* Branch Dropdown */}
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-purple-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="all">All Branches</option>
              <option value="Main Headquarters">Main Headquarters</option>
              <option value="Dubai Branch">Dubai Branch</option>
              <option value="Muscat Branch">Muscat Branch</option>
              <option value="Lahore Office">Lahore Office</option>
            </select>

            {/* Department Dropdown */}
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-purple-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="all">All Departments</option>
              <option value="Administration">Administration</option>
              <option value="Sales">Sales</option>
              <option value="IT">IT & Systems</option>
              <option value="Accounts">Accounts</option>
              <option value="Operations">Operations</option>
            </select>

            {/* Search Employee input */}
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search employee..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-9 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-purple-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>

            {/* Shift dropdown */}
            <select
              value={shiftFilter}
              onChange={(e) => setShiftFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-purple-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="all">All Shifts</option>
              <option value="Morning">Morning (09:00 - 18:00)</option>
              <option value="Evening">Evening (14:00 - 23:00)</option>
              <option value="Night">Night (23:00 - 08:00)</option>
            </select>

            {/* Status dropdown */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-purple-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="all">All Statuses</option>
              <option value="present">Present</option>
              <option value="late">Late</option>
              <option value="absent">Absent</option>
              <option value="leave">On Leave</option>
            </select>

            {/* Right Action buttons */}
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={() => void load()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh
              </button>

              {tab === "attendance" ? (
                <button
                  type="button"
                  onClick={() => alert("Add Attendance record dialog")}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition"
                >
                  <Plus className="h-4 w-4" />
                  + Add Attendance
                </button>
              ) : ["leave_types", "shifts", "holidays"].includes(tab) ? (
                <button
                  type="button"
                  onClick={() => { setEditing(null); setShowForm(true); }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-purple-700 transition"
                >
                  <Plus className="h-4 w-4" />
                  {s.t("add", "Add")}
                </button>
              ) : tab === "balances" ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void balanceAction("initialize")}
                    className="rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {s.t("bal_initialize", "Initialize Year")}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void balanceAction("recompute")}
                    className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
                  >
                    {s.t("bal_recompute", "Recompute")}
                  </button>
                </div>
              ) : tab === "corrections" ? (
                <button
                  type="button"
                  onClick={() => { setEditing(null); setShowForm(true); }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-purple-700 transition"
                >
                  <Plus className="h-4 w-4" />
                  {s.t("corr_new", "New Correction")}
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {error ? (
          <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
            {error}
          </p>
        ) : null}

        {/* 6. MAIN TABLE REGISTER CARD */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
          {/* Card Header with table actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 px-5 py-3.5 bg-slate-50/50 dark:bg-slate-800/40">
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-slate-100">
                {tab === "attendance" ? "Daily Attendance Register" : s.t(`tab_${tab}`, tab)}
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {tab === "attendance"
                  ? "View and manage daily employee attendance records."
                  : s.t("leave_attendance_blurb", "Configure and review records.")}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 shadow-sm"
              >
                <Printer className="h-3.5 w-3.5 text-slate-500" />
                Print
              </button>
              <button
                type="button"
                onClick={() => alert("Exporting PDF...")}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 shadow-sm"
              >
                <FileDown className="h-3.5 w-3.5 text-rose-500" />
                PDF
              </button>
              <button
                type="button"
                onClick={() => alert("Exporting Excel...")}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 shadow-sm"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                Excel
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            {tab === "attendance" ? (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200/80 bg-slate-50/80 text-[11px] font-black uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400">
                    <th className="w-10 px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={attendanceList.length > 0 && Object.keys(selectedIds).length === attendanceList.length}
                        onChange={toggleSelectAll}
                        className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                      />
                    </th>
                    <th className="w-12 px-3 py-3 text-center">#</th>
                    <th className="px-3 py-3 font-black text-slate-700 dark:text-slate-200">EMPLOYEE ID</th>
                    <th className="px-3 py-3 font-black text-slate-700 dark:text-slate-200">EMPLOYEE NAME</th>
                    <th className="px-3 py-3 font-black text-slate-700 dark:text-slate-200">COUNTRY</th>
                    <th className="px-3 py-3 font-black text-slate-700 dark:text-slate-200">BRANCH</th>
                    <th className="px-3 py-3 font-black text-slate-700 dark:text-slate-200">DEPARTMENT</th>
                    <th className="px-3 py-3 font-black text-slate-700 dark:text-slate-200">SHIFT</th>
                    <th className="px-3 py-3 font-black text-slate-700 dark:text-slate-200">CHECK IN</th>
                    <th className="px-3 py-3 font-black text-slate-700 dark:text-slate-200">CHECK OUT</th>
                    <th className="px-3 py-3 font-black text-slate-700 dark:text-slate-200">WORKING HOURS</th>
                    <th className="px-3 py-3 font-black text-slate-700 dark:text-slate-200">LATE</th>
                    <th className="px-3 py-3 font-black text-slate-700 dark:text-slate-200">OVERTIME</th>
                    <th className="px-3 py-3 font-black text-slate-700 dark:text-slate-200">LEAVE TYPE</th>
                    <th className="px-3 py-3 font-black text-slate-700 dark:text-slate-200">STATUS</th>
                    <th className="w-16 px-3 py-3 text-right font-black text-slate-700 dark:text-slate-200">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {loading ? (
                    <tr>
                      <td colSpan={16} className="py-12 text-center text-slate-400">
                        <Loader2 className="mx-auto h-5 w-5 animate-spin text-purple-600" />
                        <span className="mt-2 block text-xs">Loading attendance records...</span>
                      </td>
                    </tr>
                  ) : attendanceList.length === 0 ? (
                    <tr>
                      <td colSpan={16} className="py-12 text-center text-slate-400">
                        No attendance records match your filter criteria.
                      </td>
                    </tr>
                  ) : (
                    attendanceList.map((row, idx) => {
                      const isSelected = !!selectedIds[row.id];
                      return (
                        <tr
                          key={row.id}
                          className={`transition-colors hover:bg-purple-50/20 dark:hover:bg-purple-950/10 ${
                            isSelected ? "bg-purple-50/40 dark:bg-purple-950/20" : ""
                          }`}
                        >
                          <td className="px-4 py-2.5 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectRow(row.id)}
                              className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                            />
                          </td>
                          <td className="px-3 py-2.5 text-center font-mono text-[11px] text-slate-400">
                            {idx + 1}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
                            {row.code}
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-purple-100 text-[11px] font-black text-purple-700 dark:bg-purple-900/60 dark:text-purple-300">
                                {row.name.slice(0, 2).toUpperCase()}
                              </div>
                              <span className="font-semibold text-slate-900 dark:text-slate-100">
                                {row.name}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
                              <span>{row.country.flag}</span>
                              <span>{row.country.name}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-slate-600 dark:text-slate-400">
                            {row.branch}
                          </td>
                          <td className="px-3 py-2.5 text-slate-600 dark:text-slate-400">
                            {row.department}
                          </td>
                          <td className="px-3 py-2.5 text-slate-600 dark:text-slate-400">
                            {row.shift}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">
                            {row.checkIn}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">
                            {row.checkOut}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
                            {row.workHours}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-xs text-amber-600 dark:text-amber-400 font-semibold">
                            {row.late}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                            {row.overtime}
                          </td>
                          <td className="px-3 py-2.5 text-slate-500 dark:text-slate-400">
                            {row.leaveType}
                          </td>
                          <td className="px-3 py-2.5">
                            {row.status === "present" ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                                Present
                              </span>
                            ) : row.status === "late" ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300">
                                <span className="h-1.5 w-1.5 rounded-full bg-amber-500"></span>
                                Late
                              </span>
                            ) : row.status === "leave" ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-300">
                                <span className="h-1.5 w-1.5 rounded-full bg-blue-500"></span>
                                On Leave
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300">
                                <span className="h-1.5 w-1.5 rounded-full bg-rose-500"></span>
                                Absent
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <button
                              type="button"
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            ) : (
              /* Fallback table for Sub-tabs: Leave Types, Shifts, Holidays, Balances, Corrections */
              <table className="w-full text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60">
                  <tr className="text-left">
                    {columnsFor(tab, s).map((c) => (
                      <Th key={c.key} className={`px-3 py-2.5 font-bold ${c.align === "right" ? "text-right" : ""}`}>
                        {c.label}
                      </Th>
                    ))}
                    <Th className="px-3 py-2.5 text-right font-bold">Actions</Th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={12} className="px-3 py-10 text-center text-slate-400">
                        <Loader2 className="mx-auto h-4 w-4 animate-spin text-purple-600" />
                      </td>
                    </tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="px-3 py-10 text-center text-xs text-slate-400">
                        {s.t("empty", "No records found.")}
                      </td>
                    </tr>
                  ) : (
                    rows.map((r) => (
                      <tr key={r.id} className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50/50">
                        {columnsFor(tab, s).map((c) => (
                          <td key={c.key} className={`px-3 py-2.5 ${c.align === "right" ? "text-right tabular-nums" : "text-slate-600 dark:text-slate-300"}`}>
                            {c.render ? c.render(r, s) : (r[c.key] ?? "—")}
                          </td>
                        ))}
                        <td className="px-3 py-2.5 text-right">
                          <div className="inline-flex gap-1">
                            {["leave_types", "shifts", "holidays"].includes(tab) ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => { setEditing(r); setShowForm(true); }}
                                  className="rounded-lg border border-slate-200 p-1 text-slate-400 hover:bg-slate-50 dark:border-slate-700"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void remove(r)}
                                  className="rounded-lg border border-slate-200 p-1 text-rose-500 hover:bg-rose-50 dark:border-slate-700"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </>
                            ) : null}
                            {tab === "balances" ? (
                              <button
                                type="button"
                                onClick={() => void adjustBalance(r)}
                                className="rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                              >
                                {s.t("adjust", "Adjust")}
                              </button>
                            ) : null}
                            {tab === "corrections" && r.status === "pending" ? (
                              <>
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => void correctionAction(r.id, "approve")}
                                  className="rounded-lg bg-emerald-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                                >
                                  <Check className="h-3 w-3" />
                                </button>
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => void correctionAction(r.id, "reject")}
                                  className="rounded-lg border border-rose-200 px-2 py-1 text-[10px] font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900"
                                >
                                  <Ban className="h-3 w-3" />
                                </button>
                              </>
                            ) : null}
                            {tab === "corrections" && r.status === "approved" ? (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void correctionAction(r.id, "apply")}
                                className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-blue-700 disabled:opacity-50"
                              >
                                <Play className="h-3 w-3" />
                                {s.t("apply", "Apply")}
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>

          {/* Table Footer Pagination */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800 px-5 py-3 text-xs text-slate-500 bg-slate-50/30 dark:bg-slate-800/30">
            <div>
              Showing <span className="font-bold text-slate-800 dark:text-slate-200">1</span> to{" "}
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {tab === "attendance" ? attendanceList.length : rows.length}
              </span>{" "}
              of{" "}
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {tab === "attendance" ? attendanceList.length : rows.length}
              </span>{" "}
              records
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 font-semibold text-slate-400 opacity-50 cursor-not-allowed"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Previous
              </button>
              <button
                type="button"
                className="rounded-lg bg-purple-600 px-2.5 py-1 font-bold text-white shadow-sm"
              >
                1
              </button>
              <button
                type="button"
                disabled
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 font-semibold text-slate-400 opacity-50 cursor-not-allowed"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

      </div>

      {showForm ? (
        <PhaseForm
          s={s}
          tab={tab}
          initial={editing}
          employees={employees}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSave={save}
        />
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
