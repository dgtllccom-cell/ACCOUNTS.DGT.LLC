"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Loader2, Plus, Pencil, Trash2, X, RefreshCw, Building2, Users,
  Layers, Search, ChevronLeft, ChevronRight, Calendar,
} from "lucide-react";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api/client";
import { UniversalPrintActionButton } from "@/components/reports/universal-print-action-button";

type Kind = "department" | "designation";
type Row = Record<string, any>;

const NUM = (v: any) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(Number(v) || 0);
const INP = "w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 dark:border-slate-700 dark:bg-slate-800";

type SessionInfo = {
  user?: { fullName?: string | null; email?: string | null };
  scopes?: {
    isSuperAdmin?: boolean;
    summary?: { countryName?: string | null; branchDisplayName?: string | null; scopeLabel?: string | null };
  };
};
type CountryOpt = { id: string; name: string };
type BranchOpt = { id: string; name: string; city_name?: string | null };

function fmtDate(v: any): string {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function HrMastersManager({ kind, lang }: { kind: Kind; lang?: string }) {
  const s = useErpScreen("hrm", lang);
  const isDept = kind === "department";
  const endpoint = isDept ? "/api/erp/hr/departments" : "/api/erp/hr/designations";

  const [rows, setRows] = useState<Row[]>([]);
  const [departments, setDepartments] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [countryOptions, setCountryOptions] = useState<CountryOpt[]>([]);
  const [branchOptions, setBranchOptions] = useState<BranchOpt[]>([]);

  const [search, setSearch] = useState("");
  const [countryFilter, setCountryFilter] = useState("all");
  const [branchFilter, setBranchFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [headFilter, setHeadFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const [editing, setEditing] = useState<Row | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = search ? `?search=${encodeURIComponent(search)}` : "";
      const res = await apiGet<{ rows: Row[] }>(`${endpoint}${qs}`);
      setRows(res.rows ?? []);
      if (!isDept) {
        const d = await apiGet<{ rows: Row[] }>("/api/erp/hr/departments");
        setDepartments(d.rows ?? []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [endpoint, search, isDept]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    apiGet<SessionInfo>("/api/erp/auth/session").then(setSession).catch(() => null);
    apiGet<{ countries: CountryOpt[] }>("/api/branch-management/countries")
      .then((r) => setCountryOptions((r?.countries || []).map((c: any) => ({ id: c.id, name: c.name }))))
      .catch(() => setCountryOptions([]));
  }, []);

  useEffect(() => {
    setBranchFilter("all");
    if (countryFilter === "all") { setBranchOptions([]); return; }
    apiGet<{ cityBranches: BranchOpt[] }>(`/api/branch-management/city-branches?countryId=${encodeURIComponent(countryFilter)}`)
      .then((r) => setBranchOptions((r?.cityBranches || []).map((b: any) => ({ id: b.id, name: b.name, city_name: b.city_name }))))
      .catch(() => setBranchOptions([]));
  }, [countryFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, countryFilter, branchFilter, statusFilter, headFilter, dateFrom, dateTo]);

  const openNew = () => { setEditing(null); setShowForm(true); };
  const openEdit = (r: Row) => { setEditing(r); setShowForm(true); };

  const save = async (payload: Row) => {
    if (editing?.id) await apiPatch(`${endpoint}/${editing.id}`, payload);
    else await apiPost(endpoint, payload);
    setShowForm(false);
    setEditing(null);
    await load();
  };

  const remove = async (r: Row) => {
    if (!window.confirm(s.t("confirm_delete", "Delete this record?"))) return;
    try {
      await apiDelete(`${endpoint}/${r.id}`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  // Normalize real API rows into the display shape — no synthetic/sample data.
  const normalizedRows = useMemo(() => {
    return rows.map((r) => ({
      id: r.id,
      code: r.code || "—",
      name: isDept ? (r.name || "—") : (r.title || "—"),
      country_id: r.country_id ?? null,
      country_name: r.country_name || "—",
      branch_id: r.city_branch_id ?? r.country_branch_id ?? null,
      branch_name: isDept ? (r.city_branch_name || r.country_branch_name || "—") : (r.department_name || "—"),
      head: isDept ? (r.head_employee_code || "—") : (r.pay_grade || "—"),
      monthly_budget: Number(r.monthly_budget) || 0,
      budget_currency: r.budget_currency || "",
      min_basic_salary: Number(r.min_basic_salary) || 0,
      max_basic_salary: Number(r.max_basic_salary) || 0,
      salary_currency: r.salary_currency || "",
      employees: Number(r.employee_count) || 0,
      is_active: !!r.is_active,
      created_at: r.created_at || null,
      raw: r,
    }));
  }, [rows, isDept]);

  const headOptions = useMemo(() => {
    const set = new Set<string>();
    normalizedRows.forEach((r) => { if (isDept && r.head && r.head !== "—") set.add(r.head); });
    return Array.from(set).sort();
  }, [normalizedRows, isDept]);

  const filteredRows = useMemo(() => {
    return normalizedRows.filter((item) => {
      if (search) {
        const q = search.toLowerCase();
        if (!item.name.toLowerCase().includes(q) && !item.code.toLowerCase().includes(q)) return false;
      }
      if (countryFilter !== "all" && item.country_id !== countryFilter) return false;
      if (branchFilter !== "all" && item.branch_id !== branchFilter) return false;
      if (statusFilter !== "all") {
        if (statusFilter === "active" && !item.is_active) return false;
        if (statusFilter === "inactive" && item.is_active) return false;
      }
      if (headFilter !== "all" && item.head !== headFilter) return false;
      if (dateFrom && item.created_at && new Date(item.created_at) < new Date(dateFrom)) return false;
      if (dateTo && item.created_at && new Date(item.created_at) > new Date(`${dateTo}T23:59:59`)) return false;
      return true;
    });
  }, [normalizedRows, search, countryFilter, branchFilter, statusFilter, headFilter, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const pageRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, currentPage, pageSize]);

  const stats = useMemo(() => {
    const now = new Date();
    const activeCount = normalizedRows.filter((r) => r.is_active).length;
    const inactiveCount = normalizedRows.length - activeCount;
    const newThisMonth = normalizedRows.filter((r) => {
      if (!r.created_at) return false;
      const d = new Date(r.created_at);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }).length;
    const totalEmployees = normalizedRows.reduce((sum, r) => sum + r.employees, 0);
    const distinctHeads = new Set(normalizedRows.filter((r) => r.head !== "—").map((r) => r.head)).size;
    const budgetByCurrency = new Map<string, number>();
    normalizedRows.forEach((r) => {
      if (!isDept || !r.monthly_budget) return;
      const cur = r.budget_currency || "";
      budgetByCurrency.set(cur, (budgetByCurrency.get(cur) || 0) + r.monthly_budget);
    });
    const budgetLabel = budgetByCurrency.size
      ? Array.from(budgetByCurrency.entries()).map(([cur, amt]) => `${cur} ${NUM(amt)}`.trim()).join(", ")
      : "—";
    const countries = new Set(normalizedRows.filter((r) => r.country_id).map((r) => r.country_id)).size;
    const branches = new Set(normalizedRows.filter((r) => r.branch_id).map((r) => r.branch_id)).size;
    return { activeCount, inactiveCount, newThisMonth, totalEmployees, distinctHeads, budgetLabel, countries, branches };
  }, [normalizedRows, isDept]);

  const isSuperAdmin = !!session?.scopes?.isSuperAdmin;
  const title = isDept ? s.t("departments", "Departments") : s.t("designations", "Designations");
  const registerTitle = isDept ? s.t("register_title_dept", "Department Register") : s.t("register_title_desig", "Designation Register");

  const printConfig = () => ({
    moduleType: "register" as const,
    reportType: "register" as const,
    title: registerTitle,
    subtitle: s.t("masters_subtitle", "HRM Master Data"),
    lang: s.lang,
    orientation: "landscape" as const,
    columns: isDept
      ? [
          { key: "code", label: s.t("code", "Code") },
          { key: "name", label: s.t("name", "Name") },
          { key: "country_name", label: s.t("country", "Country") },
          { key: "branch_name", label: s.tGlobal("common.branch", "Branch") },
          { key: "head", label: s.t("head", "Head") },
          { key: "monthly_budget", label: s.t("budget", "Monthly Budget"), align: "right" as const, render: (r: any) => `${r.budget_currency} ${NUM(r.monthly_budget)}`.trim() },
          { key: "employees", label: s.t("employees", "Employees"), align: "right" as const },
          { key: "is_active", label: s.tGlobal("common.status", "Status"), render: (r: any) => r.is_active ? s.tGlobal("common.active", "Active") : s.tGlobal("common.inactive", "Inactive") },
        ]
      : [
          { key: "code", label: s.t("code", "Code") },
          { key: "name", label: s.t("title_col", "Title") },
          { key: "branch_name", label: s.t("department", "Department") },
          { key: "head", label: s.t("pay_grade", "Pay Grade") },
          { key: "min_basic_salary", label: s.t("min_salary", "Min Basic"), align: "right" as const },
          { key: "max_basic_salary", label: s.t("max_salary", "Max Basic"), align: "right" as const },
          { key: "employees", label: s.t("employees", "Employees"), align: "right" as const },
          { key: "is_active", label: s.tGlobal("common.status", "Status"), render: (r: any) => r.is_active ? s.tGlobal("common.active", "Active") : s.tGlobal("common.inactive", "Inactive") },
        ],
    rows: filteredRows,
  });

  return (
    <div dir={s.dir} className="min-h-screen bg-[#f8fafc] dark:bg-[#0b1120] text-slate-800 dark:text-slate-100 pb-16 font-sans">
      <div className="mx-auto max-w-[1700px] p-4 sm:p-6 lg:p-7 space-y-6">

        {/* 1. TOP BREADCRUMB */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/general-office"
              className="inline-flex items-center gap-1 font-bold text-slate-600 hover:text-purple-600 dark:text-slate-300 transition"
            >
              <span className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] shadow-2xs dark:border-slate-800 dark:bg-slate-900">
                {s.isRtl ? "→" : "←"} {s.tGlobal("common.back", "Back")}
              </span>
            </Link>
            <span className="text-slate-400">{s.tGlobal("common.dashboard", "Dashboard")}</span>
            <span className="text-slate-300 dark:text-slate-700">{s.isRtl ? "<" : ">"}</span>
            <span className="font-semibold text-purple-600 dark:text-purple-400">{title}</span>
          </div>

          <div className="flex items-center gap-2">
            <UniversalPrintActionButton reportConfig={printConfig} />
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-purple-600" : ""}`} />
              {s.t("refresh", "Refresh")}
            </button>
          </div>
        </div>

        {/* 2. TITLE HEADER */}
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-slate-50">
            {title}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {isDept
              ? s.t("dept_blurb", "Corporate departments, assigned heads, budgets and employee distribution. The employee free-text field keeps working; this master is additive.")
              : s.t("desig_blurb", "Designation grades, titles and base salary scales. Additive to the employee free-text designation.")}
          </p>
        </div>

        {/* 3. KPI CARDS */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Card 1: Branch & User Details */}
          <div className="rounded-2xl border border-purple-100 bg-gradient-to-br from-purple-50/70 via-white to-purple-50/20 p-4 shadow-sm dark:border-purple-950/60 dark:from-purple-950/30 dark:via-slate-900 dark:to-slate-900">
            <div className="flex items-center justify-between pb-3 border-b border-purple-100/70 dark:border-purple-900/40">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-purple-100 p-1.5 text-purple-600 dark:bg-purple-900/60 dark:text-purple-300">
                  <Building2 className="h-4 w-4" />
                </div>
                <span className="text-xs font-bold text-purple-950 dark:text-purple-200">{s.t("branch_user_details", "Branch & User Details")}</span>
              </div>
            </div>
            <div className="mt-3 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">{s.tGlobal("common.branch", "Branch")}:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{session?.scopes?.summary?.branchDisplayName || "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">{s.t("country", "Country")}:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{session?.scopes?.summary?.countryName || "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">{s.tGlobal("common.user_name", "User Name")}:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{session?.user?.fullName || "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">{s.t("user_email", "User Email")}:</span>
                <span className="font-mono text-slate-600 dark:text-slate-300 truncate max-w-[120px]" title={session?.user?.email || ""}>{session?.user?.email || "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">{s.t("role", "Role")}:</span>
                <span className="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-[11px] font-bold text-purple-700 dark:bg-purple-900/50 dark:text-purple-300">
                  {isSuperAdmin ? s.t("super_admin", "Super Admin") : (session?.scopes?.summary?.scopeLabel || "—")}
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Register Summary */}
          <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/70 via-white to-indigo-50/20 p-4 shadow-sm dark:border-indigo-950/60 dark:from-indigo-950/30 dark:via-slate-900 dark:to-slate-900">
            <div className="flex items-center justify-between pb-3 border-b border-indigo-100/70 dark:border-indigo-900/40">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-indigo-100 p-1.5 text-indigo-600 dark:bg-indigo-900/60 dark:text-indigo-300">
                  <Layers className="h-4 w-4" />
                </div>
                <span className="text-xs font-bold text-indigo-950 dark:text-indigo-200">{title} {s.t("summary", "Summary")}</span>
              </div>
            </div>
            <div className="mt-3 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">{s.tGlobal("common.total", "Total")} {title}</span>
                <span className="font-black text-indigo-700 dark:text-indigo-300 text-sm">{normalizedRows.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">{s.tGlobal("common.active", "Active")}</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">{stats.activeCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">{s.tGlobal("common.inactive", "Inactive")}</span>
                <span className="font-bold text-rose-600 dark:text-rose-400">{stats.inactiveCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">{s.t("new_this_month", "New This Month")}</span>
                <span className="font-bold text-blue-600 dark:text-blue-400">{stats.newThisMonth}</span>
              </div>
            </div>
          </div>

          {/* Card 3: Employees & Budget/Salary Summary */}
          <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50/70 via-white to-emerald-50/20 p-4 shadow-sm dark:border-emerald-950/60 dark:from-emerald-950/30 dark:via-slate-900 dark:to-slate-900">
            <div className="flex items-center justify-between pb-3 border-b border-emerald-100/70 dark:border-emerald-900/40">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-emerald-100 p-1.5 text-emerald-600 dark:bg-emerald-900/60 dark:text-emerald-300">
                  <Users className="h-4 w-4" />
                </div>
                <span className="text-xs font-bold text-emerald-950 dark:text-emerald-200">{s.t("employees", "Employees")} {isDept ? `& ${s.t("budget", "Monthly Budget")}` : ""}</span>
              </div>
            </div>
            <div className="mt-3 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">{s.t("total_employees", "Total Employees")}</span>
                <span className="font-black text-emerald-700 dark:text-emerald-300 text-sm">{stats.totalEmployees}</span>
              </div>
              {isDept ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-slate-400">{s.t("department_heads", "Department Heads")}</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{stats.distinctHeads}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-slate-400">{s.t("total_monthly_budget", "Total Monthly Budget")}</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">{stats.budgetLabel}</span>
                  </div>
                </>
              ) : null}
            </div>
          </div>

          {/* Card 4: All Countries Report (Super Admin Only) */}
          {isSuperAdmin ? (
            <div className="rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50/70 via-white to-amber-50/20 p-4 shadow-sm dark:border-amber-950/60 dark:from-amber-950/30 dark:via-slate-900 dark:to-slate-900">
              <div className="flex items-center justify-between pb-3 border-b border-amber-100/70 dark:border-amber-900/40">
                <span className="text-xs font-bold text-amber-950 dark:text-amber-200">{s.t("all_countries_report", "All Countries Report")}</span>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-800 dark:bg-amber-900/60 dark:text-amber-300 uppercase tracking-wider">
                  {s.t("super_admin_only", "Super Admin Only")}
                </span>
              </div>
              <div className="mt-3 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">{s.t("countries", "Countries")}</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{stats.countries}</span>
                </div>
                {isDept ? (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-slate-400">{s.tGlobal("common.branch", "Branches")}</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{stats.branches}</span>
                  </div>
                ) : null}
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">{title}</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{normalizedRows.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">{s.t("employees", "Employees")}</span>
                  <span className="font-black text-amber-600 dark:text-amber-400">{stats.totalEmployees}</span>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* 4. FILTER ROW TOOLBAR */}
        <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative min-w-[200px] flex-1">
              <Search className={`absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 ${s.isRtl ? "right-3" : "left-3"}`} />
              <input
                type="text"
                placeholder={s.t("search", "Search…")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={`w-full rounded-xl border border-slate-200 bg-slate-50/50 py-1.5 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-purple-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 ${s.isRtl ? "pr-9 pl-3" : "pl-9 pr-3"}`}
              />
            </div>

            <select
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-purple-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="all">{s.tGlobal("common.all_countries", "All Countries")}</option>
              {countryOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>

            {isDept ? (
              <select
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                disabled={countryFilter === "all"}
                className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-purple-500 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <option value="all">{s.tGlobal("common.all_branches", "All Branches")}</option>
                {branchOptions.map((b) => <option key={b.id} value={b.id}>{b.city_name ? `${b.name} — ${b.city_name}` : b.name}</option>)}
              </select>
            ) : null}

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-purple-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="all">{s.tGlobal("common.all_statuses", "All Statuses")}</option>
              <option value="active">{s.tGlobal("common.active", "Active")}</option>
              <option value="inactive">{s.tGlobal("common.inactive", "Inactive")}</option>
            </select>

            {isDept && headOptions.length > 0 ? (
              <select
                value={headFilter}
                onChange={(e) => setHeadFilter(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-purple-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <option value="all">{s.t("all_heads", "All Department Heads")}</option>
                {headOptions.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
            ) : null}

            <div className="flex items-center gap-1 text-xs text-slate-500">
              <Calendar className="h-3.5 w-3.5 text-slate-400" />
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50/50 px-2 py-1 text-xs text-slate-700 outline-none focus:border-purple-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              />
              <span>–</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50/50 px-2 py-1 text-xs text-slate-700 outline-none focus:border-purple-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              />
            </div>

            <div className="ms-auto flex items-center gap-2">
              <button
                type="button"
                onClick={openNew}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition"
              >
                <Plus className="h-4 w-4" />
                {isDept ? s.t("add_department", "Add Department") : s.t("add_designation", "Add Designation")}
              </button>
            </div>
          </div>
        </div>

        {error ? (
          <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
            {error}
          </p>
        ) : null}

        {/* 5. MAIN TABLE REGISTER CARD */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 px-5 py-3.5 bg-slate-50/50 dark:bg-slate-800/40">
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-slate-100">
                {registerTitle}
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {s.t("showing", "Showing")} {pageRows.length} {s.t("of", "of")} {filteredRows.length}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className={`border-b border-slate-200/80 bg-slate-50/80 text-[11px] font-black uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400 ${s.textStart}`}>
                  <th className="px-3 py-3 font-black text-slate-700 dark:text-slate-200">{s.t("code", "Code")}</th>
                  <th className="px-3 py-3 font-black text-slate-700 dark:text-slate-200">{isDept ? s.t("name", "Name") : s.t("title_col", "Title")}</th>
                  <th className="px-3 py-3 font-black text-slate-700 dark:text-slate-200">{isDept ? s.t("country", "Country") : s.t("department", "Department")}</th>
                  {isDept ? <th className="px-3 py-3 font-black text-slate-700 dark:text-slate-200">{s.tGlobal("common.branch", "Branch")}</th> : null}
                  <th className="px-3 py-3 font-black text-slate-700 dark:text-slate-200">{isDept ? s.t("head", "Head") : s.t("pay_grade", "Pay Grade")}</th>
                  <th className={`px-3 py-3 font-black text-slate-700 dark:text-slate-200 ${s.textEnd}`}>{isDept ? s.t("budget", "Monthly Budget") : s.t("salary_range", "Basic Salary Range")}</th>
                  <th className={`px-3 py-3 font-black text-slate-700 dark:text-slate-200 ${s.textEnd}`}>{s.t("employees", "Employees")}</th>
                  <th className="px-3 py-3 font-black text-slate-700 dark:text-slate-200">{s.tGlobal("common.status", "Status")}</th>
                  <th className="px-3 py-3 font-black text-slate-700 dark:text-slate-200">{s.t("created_date", "Created Date")}</th>
                  <th className={`w-16 px-3 py-3 font-black text-slate-700 dark:text-slate-200 ${s.textEnd}`}>{s.t("actions", "Actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={isDept ? 10 : 9} className="py-12 text-center text-slate-400">
                      <Loader2 className="mx-auto h-5 w-5 animate-spin text-purple-600" />
                      <span className="mt-2 block text-xs">{s.t("loading", "Loading records…")}</span>
                    </td>
                  </tr>
                ) : pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={isDept ? 10 : 9} className="py-12 text-center text-slate-400">
                      {s.t("empty", "No records found.")}
                    </td>
                  </tr>
                ) : (
                  pageRows.map((r) => (
                    <tr key={r.id} className="transition-colors hover:bg-purple-50/20 dark:hover:bg-purple-950/10">
                      <td className="px-3 py-2.5 font-mono text-xs font-semibold text-slate-600 dark:text-slate-400">{r.code}</td>
                      <td className="px-3 py-2.5 font-bold text-slate-900 dark:text-slate-100">{r.name}</td>
                      <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">{isDept ? r.country_name : r.branch_name}</td>
                      {isDept ? <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">{r.branch_name}</td> : null}
                      <td className="px-3 py-2.5 font-medium text-slate-700 dark:text-slate-300">{r.head}</td>
                      <td className={`px-3 py-2.5 font-mono font-bold text-slate-800 dark:text-slate-200 ${s.textEnd}`}>
                        {isDept
                          ? `${r.budget_currency} ${NUM(r.monthly_budget)}`.trim()
                          : `${NUM(r.min_basic_salary)} – ${NUM(r.max_basic_salary)} ${r.salary_currency}`.trim()}
                      </td>
                      <td className={`px-3 py-2.5 font-mono font-bold text-slate-700 dark:text-slate-300 ${s.textEnd}`}>{r.employees}</td>
                      <td className="px-3 py-2.5">
                        {r.is_active ? (
                          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300">
                            {s.tGlobal("common.active", "Active")}
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-bold text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300">
                            {s.tGlobal("common.inactive", "Inactive")}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-slate-500 dark:text-slate-400">{fmtDate(r.created_at)}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          <button type="button" onClick={() => openEdit(r.raw)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 transition" title={s.t("edit", "Edit")}>
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button type="button" onClick={() => void remove(r.raw)} className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-slate-800 transition" title={s.t("delete", "Delete")}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800 px-5 py-3 text-xs text-slate-500 bg-slate-50/30 dark:bg-slate-800/30">
            <div className="flex items-center gap-2">
              <span>{s.t("show", "Show")}</span>
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
              <span>{s.t("entries", "entries")}</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 font-semibold text-slate-500 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:border-slate-700"
              >
                {s.isRtl ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
              </button>
              <span className="rounded-lg bg-blue-600 px-2.5 py-1 font-bold text-white shadow-sm">{currentPage}</span>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 font-semibold text-slate-500 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:border-slate-700"
              >
                {s.isRtl ? <ChevronLeft className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </button>
              <span className="ms-2">
                {s.t("showing", "Showing")} {filteredRows.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
                {" "}{s.t("to", "to")}{" "}
                {Math.min(currentPage * pageSize, filteredRows.length)} {s.t("of", "of")} {filteredRows.length} {s.t("entries", "entries")}
              </span>
            </div>
          </div>
        </div>

      </div>

      {showForm ? (
        <MasterForm
          s={s}
          isDept={isDept}
          initial={editing}
          departments={departments}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSave={save}
        />
      ) : null}
    </div>
  );
}

function MasterForm({
  s, isDept, initial, departments, onClose, onSave,
}: {
  s: ReturnType<typeof useErpScreen>;
  isDept: boolean;
  initial: Row | null;
  departments: Row[];
  onClose: () => void;
  onSave: (payload: Row) => Promise<void>;
}) {
  const [form, setForm] = useState<Row>(() =>
    initial
      ? { ...initial }
      : isDept
        ? { name: "", code: "", monthlyBudget: 0, budgetCurrency: "AED", isActive: true }
        : { title: "", code: "", minBasicSalary: 0, maxBasicSalary: 0, salaryCurrency: "AED", rankOrder: 0, isActive: true },
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: string, v: any) => setForm((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    setSaving(true);
    setErr(null);
    try {
      const payload: Row = isDept
        ? {
            code: form.code?.trim() || undefined,
            name: (form.name ?? "").trim(),
            countryId: form.country_id ?? form.countryId ?? null,
            monthlyBudget: Number(form.monthly_budget ?? form.monthlyBudget) || 0,
            budgetCurrency: (form.budget_currency ?? form.budgetCurrency ?? "AED").trim(),
            description: form.description?.trim() || null,
            isActive: form.is_active ?? form.isActive ?? true,
          }
        : {
            code: form.code?.trim() || undefined,
            title: (form.title ?? "").trim(),
            departmentId: form.department_id ?? form.departmentId ?? null,
            payGrade: form.pay_grade?.trim() || form.payGrade?.trim() || null,
            minBasicSalary: Number(form.min_basic_salary ?? form.minBasicSalary) || 0,
            maxBasicSalary: Number(form.max_basic_salary ?? form.maxBasicSalary) || 0,
            salaryCurrency: (form.salary_currency ?? form.salaryCurrency ?? "AED").trim(),
            rankOrder: Number(form.rank_order ?? form.rankOrder) || 0,
            description: form.description?.trim() || null,
            isActive: form.is_active ?? form.isActive ?? true,
          };
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
          <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">
            {initial ? s.t("edit", "Edit") : s.t("add", "Add")} — {isDept ? s.t("department", "Department") : s.t("designation", "Designation")}
          </h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button>
        </div>

        {err ? <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{err}</p> : null}

        <div className="mt-4 space-y-3">
          <Field label={s.t("code", "Code")}>
            <input value={form.code ?? ""} onChange={(e) => set("code", e.target.value)} placeholder={s.t("code_auto", "auto")} className={INP} />
          </Field>
          {isDept ? (
            <Field label={s.t("name", "Name")} required>
              <input value={form.name ?? ""} onChange={(e) => set("name", e.target.value)} className={INP} />
            </Field>
          ) : (
            <>
              <Field label={s.t("title_col", "Title")} required>
                <input value={form.title ?? ""} onChange={(e) => set("title", e.target.value)} className={INP} />
              </Field>
              <Field label={s.t("department", "Department")}>
                <select value={form.department_id ?? form.departmentId ?? ""} onChange={(e) => set("departmentId", e.target.value || null)} className={INP}>
                  <option value="">{s.t("none", "None")}</option>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </Field>
              <Field label={s.t("pay_grade", "Pay Grade")}>
                <input value={form.pay_grade ?? form.payGrade ?? ""} onChange={(e) => set("payGrade", e.target.value)} className={INP} />
              </Field>
            </>
          )}

          {isDept ? (
            <div className="grid grid-cols-2 gap-2">
              <Field label={s.t("budget", "Monthly Budget")}>
                <input type="number" value={form.monthly_budget ?? form.monthlyBudget ?? 0} onChange={(e) => set("monthlyBudget", e.target.value)} className={INP} />
              </Field>
              <Field label={s.t("currency", "Currency")}>
                <input value={form.budget_currency ?? form.budgetCurrency ?? "AED"} onChange={(e) => set("budgetCurrency", e.target.value)} className={INP} />
              </Field>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              <Field label={s.t("min_salary", "Min Basic")}>
                <input type="number" value={form.min_basic_salary ?? form.minBasicSalary ?? 0} onChange={(e) => set("minBasicSalary", e.target.value)} className={INP} />
              </Field>
              <Field label={s.t("max_salary", "Max Basic")}>
                <input type="number" value={form.max_basic_salary ?? form.maxBasicSalary ?? 0} onChange={(e) => set("maxBasicSalary", e.target.value)} className={INP} />
              </Field>
              <Field label={s.t("currency", "Currency")}>
                <input value={form.salary_currency ?? form.salaryCurrency ?? "AED"} onChange={(e) => set("salaryCurrency", e.target.value)} className={INP} />
              </Field>
            </div>
          )}

          <Field label={s.t("description", "Description / Notes")}>
            <textarea value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} rows={2} className={INP} />
          </Field>

          <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
            <input type="checkbox" checked={form.is_active ?? form.isActive ?? true} onChange={(e) => set("isActive", e.target.checked)} />
            {s.t("active", "Active")}
          </label>
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

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">
        {label}{required ? " *" : ""}
      </label>
      {children}
    </div>
  );
}
