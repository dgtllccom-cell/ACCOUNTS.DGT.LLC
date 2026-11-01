"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Loader2, ShieldCheck, ShieldAlert, X, Check, Ban, RefreshCw, Search, Eye, Download,
  ChevronLeft, ChevronRight
} from "lucide-react";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { apiGet, apiPost, apiPatch } from "@/lib/api/client";
import { UniversalPrintActionButton } from "@/components/reports/universal-print-action-button";
import { Th } from "@/components/ui/translated-th";

type Row = Record<string, any>;
type SessionInfo = {
  user?: { fullName?: string | null; email?: string | null };
  scopes?: {
    isSuperAdmin?: boolean;
    summary?: { countryName?: string | null; branchDisplayName?: string | null; scopeLabel?: string | null };
  };
};
type BranchOpt = { id: string; name: string; country_id?: string | null; code?: string | null };
type CountryOpt = { id: string; name: string };
type ReqOpt = { code: string; label: string };
const INP = "w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 dark:border-slate-700 dark:bg-slate-800";

const STATUS_TONE: Record<string, string> = {
  verified: "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300",
  pending_verification: "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300",
  submitted: "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-300",
  pending: "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300",
  incomplete: "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300",
  rejected: "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300",
  expired: "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300",
};

type Caps = { ownOnly: boolean; upload: boolean; verify: boolean; identifiers: boolean };

export function EmployeeKycView({ lang }: { lang?: string }) {
  const s = useErpScreen("hrm", lang);
  const [rows, setRows] = useState<Row[]>([]);
  const [kpis, setKpis] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [countryOptions, setCountryOptions] = useState<CountryOpt[]>([]);
  const [branchOptions, setBranchOptions] = useState<BranchOpt[]>([]);
  const [requirementOptions, setRequirementOptions] = useState<ReqOpt[]>([]);
  // what this login may do (the server decides; the buttons just follow): view only / upload+edit / approve+reject
  // null until the server has answered - nothing is claimed ("View only" ...) before the real capabilities are known
  const [capsLoaded, setCapsLoaded] = useState<Caps | null>(null);
  const caps: Caps = capsLoaded ?? { ownOnly: false, upload: false, verify: false, identifiers: false };

  // Toolbar filter states
  const [search, setSearch] = useState("");
  const [countryFilter, setCountryFilter] = useState("all");
  const [branchFilter, setBranchFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [docTypeFilter, setDocTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [expiryFilter, setExpiryFilter] = useState("all");

  const [openEmp, setOpenEmp] = useState<Row | null>(null);
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (statusFilter !== "all") qs.set("status", statusFilter);
      if (search) qs.set("search", search);
      if (countryFilter !== "all") qs.set("countryId", countryFilter);
      const [q, k] = await Promise.all([
        apiGet<{ rows: Row[]; caps?: Caps }>(`/api/erp/hr/kyc?${qs.toString()}`),
        apiGet<{ kpis: Record<string, number> }>("/api/erp/hr/kyc/kpis"),
      ]);
      setRows(q.rows ?? []);
      if (q.caps) setCapsLoaded(q.caps);
      setKpis(k.kpis ?? {});
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search, countryFilter]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    apiGet<SessionInfo>("/api/erp/auth/session").then(setSession).catch(() => null);
    apiGet<{ countries: CountryOpt[] }>("/api/branch-management/countries")
      .then((r) => setCountryOptions((r?.countries || []).map((c: any) => ({ id: c.id, name: c.name }))))
      .catch(() => setCountryOptions([]));
    apiGet<{ rows: ReqOpt[] }>("/api/erp/hr/kyc/requirements")
      .then((r) => setRequirementOptions(r?.rows || []))
      .catch(() => setRequirementOptions([]));
  }, []);

  useEffect(() => {
    setBranchFilter("all");
    if (countryFilter === "all") { setBranchOptions([]); return; }
    apiGet<{ cityBranches: BranchOpt[] }>(`/api/branch-management/city-branches?countryId=${encodeURIComponent(countryFilter)}`)
      .then((r) => setBranchOptions((r?.cityBranches || []).map((b: any) => ({ id: b.id, name: b.name, country_id: b.country_id, code: b.code }))))
      .catch(() => setBranchOptions([]));
  }, [countryFilter]);

  // Real records only — normalized for display, no synthetic fallback.
  const normalizedList = useMemo(() => {
    return rows.map((r, idx) => {
      const req = Number(r.required_count) || 0;
      const ver = Number(r.verified_count) || 0;
      const mis = Number(r.missing_mandatory_count) || 0;
      const exp = Number(r.expired_count) || 0;
      const expSoon = Number(r.expiring_soon_count) || 0;
      const rate = req > 0 ? Math.round((ver / req) * 100) : 0;
      const branchId = r.city_branch_id ?? r.country_branch_id ?? null;
      const branchName = r.city_branch_name || r.country_branch_name || "—";

      return {
        id: r.employee_id || String(idx + 1),
        employee_id: r.employee_id || String(idx + 1),
        employee_code: r.employee_code || "—",
        employee_name: r.employee_name || "—",
        country: r.country_name || "—",
        country_id: r.country_id ?? null,
        branch: branchName,
        branch_id: branchId,
        department: r.department_name || "—",
        required_count: req,
        verified_count: ver,
        missing_count: mis,
        expired_count: exp,
        expiring_soon_count: expSoon,
        compliance_rate: rate,
        kyc_status: r.kyc_status || "incomplete",
      };
    });
  }, [rows]);

  const departmentOptions = useMemo(
    () => Array.from(new Set(normalizedList.map((r) => r.department).filter((d) => d && d !== "—"))).sort(),
    [normalizedList]
  );

  const kycList = useMemo(() => {
    return normalizedList.filter((item) => {
      if (search) {
        const q = search.toLowerCase();
        const m = item.employee_name.toLowerCase().includes(q) ||
                  item.employee_code.toLowerCase().includes(q) ||
                  item.branch.toLowerCase().includes(q);
        if (!m) return false;
      }
      if (branchFilter !== "all" && item.branch_id !== branchFilter) return false;
      if (departmentFilter !== "all" && item.department !== departmentFilter) return false;
      if (statusFilter !== "all" && item.kyc_status.toLowerCase() !== statusFilter.toLowerCase()) return false;
      if (docTypeFilter !== "all") {
        const missingItems: any[] = rows.find((r) => (r.employee_id || "") === item.employee_id)?.missing_items || [];
        if (!missingItems.some((mi) => mi.code === docTypeFilter)) return false;
      }
      if (expiryFilter === "expired" && item.expired_count === 0) return false;
      if (expiryFilter === "expiring" && item.expiring_soon_count === 0) return false;
      if (expiryFilter === "valid" && (item.expired_count > 0 || item.expiring_soon_count > 0)) return false;
      return true;
    });
  }, [normalizedList, rows, search, branchFilter, departmentFilter, statusFilter, docTypeFilter, expiryFilter]);

  useEffect(() => { setCurrentPage(1); }, [search, branchFilter, departmentFilter, statusFilter, docTypeFilter, expiryFilter]);

  const totalPages = Math.max(1, Math.ceil(kycList.length / pageSize));
  const pageRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return kycList.slice(start, start + pageSize);
  }, [kycList, currentPage, pageSize]);

  const isSuperAdmin = !!session?.scopes?.isSuperAdmin;

  const docStats = useMemo(() => {
    const totalDocs = normalizedList.reduce((sum, r) => sum + r.required_count, 0);
    const verifiedDocs = normalizedList.reduce((sum, r) => sum + r.verified_count, 0);
    const missingDocs = normalizedList.reduce((sum, r) => sum + r.missing_count, 0);
    const complianceRate = normalizedList.length
      ? Math.round(normalizedList.reduce((sum, r) => sum + r.compliance_rate, 0) / normalizedList.length)
      : 0;
    return { totalDocs, verifiedDocs, missingDocs, complianceRate };
  }, [normalizedList]);

  const printConfig = () => ({
    moduleType: "register" as const,
    reportType: "register" as const,
    title: s.t("kyc_title", "Employee KYC / QVC Register"),
    subtitle: s.t("kyc_subtitle", "Employee KYC / QVC compliance and document tracking"),
    lang: s.lang,
    orientation: "landscape" as const,
    kpis: [
      { label: s.t("kyc_k_verified", "Verified"), value: String(kpis.verified ?? 0), color: "emerald" as const },
      { label: s.t("kyc_k_pending", "Pending Verification"), value: String(kpis.pending ?? 0), color: "amber" as const },
      { label: s.t("kyc_k_incomplete", "Incomplete"), value: String(kpis.incomplete ?? 0), color: "red" as const },
      { label: s.t("kyc_k_expiring", "Docs Expiring ≤30d"), value: String(kpis.docs_expiring_30d ?? 0), color: "amber" as const },
    ],
    columns: [
      { key: "employee_code", label: s.t("kyc_col_employee_id", "Employee ID") },
      { key: "employee_name", label: s.t("kyc_col_employee_name", "Employee Name") },
      { key: "country", label: s.t("country", "Country") },
      { key: "branch", label: s.tGlobal("common.branch", "Branch") },
      { key: "required_count", label: s.t("kyc_col_required", "Required"), align: "right" as const },
      { key: "verified_count", label: s.t("kyc_k_verified", "Verified"), align: "right" as const },
      { key: "missing_count", label: s.t("kyc_missing", "Missing"), align: "right" as const },
      { key: "expired_count", label: s.t("kyc_col_expired", "Expired"), align: "right" as const },
      { key: "compliance_rate", label: s.t("kyc_col_compliance", "Compliance %"), align: "right" as const, render: (r: any) => `${r.compliance_rate}%` },
      { key: "kyc_status", label: s.tGlobal("common.status", "Status") },
    ],
    rows: kycList,
  });

  return (
    <div dir={s.dir} className="min-h-screen bg-[#f8fafc] dark:bg-[#0b1120] text-slate-800 dark:text-slate-100 pb-16 font-sans">
      <div className="mx-auto max-w-[1700px] p-4 sm:p-6 lg:p-7 space-y-6">

        {/* 1. COMPACT HEADER: title, scope line, actions */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <Link
              href="/dashboard/general-office"
              className="inline-flex shrink-0 items-center rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 hover:text-purple-600 dark:border-slate-700 dark:bg-slate-900"
              aria-label={s.tGlobal("common.back", "Back")}
            >
              {s.isRtl ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </Link>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-black tracking-tight text-slate-900 dark:text-slate-50">
                {s.t("kyc_title", "Employee KYC / QVC Register")}
              </h1>
              <p data-testid="kyc-scope-line" className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                {[
                  session?.scopes?.summary?.branchDisplayName || session?.scopes?.summary?.countryName || null,
                  session?.user?.fullName || null,
                  isSuperAdmin ? s.t("kyc_super_admin", "Super Admin") : (session?.scopes?.summary?.scopeLabel || null),
                  !capsLoaded ? null : caps.ownOnly ? s.t("kyc_own_only", "You can view your own employee profile only.") : (!caps.upload && !caps.verify ? s.t("kyc_view_only", "View only") : null),
                ].filter(Boolean).join("  ·  ")}
              </p>
            </div>
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
            {caps.upload ? (
              <button
                type="button"
                onClick={async () => {
                  try {
                    const r = await apiPost<{ hr: number }>("/api/erp/hr/reminders/sync", { daysAhead: 30 });
                    window.alert(s.t("hr_reminders_done", "{n} HR reminders sent to Smart CRM").replace("{n}", String(r.hr ?? 0)));
                  } catch (e) {
                    setError(e instanceof Error ? e.message : String(e));
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition"
              >
                <ShieldAlert className="h-3.5 w-3.5" />
                {s.t("hr_reminders_sync", "Generate CRM Reminders")}
              </button>
            ) : null}
          </div>
        </div>

        {/* 2. COMPACT KPI STRIP - real counts from hr_employee_kyc_status_v */}
        <div data-testid="kyc-kpis" className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-7">
          {[
            { k: "total", label: s.t("kyc_total_employees", "Total Employees"), v: kpis.total ?? 0, tone: "text-slate-900 dark:text-slate-100" },
            { k: "verified", label: s.t("kyc_k_verified", "Verified"), v: kpis.verified ?? 0, tone: "text-emerald-600 dark:text-emerald-400" },
            { k: "pending", label: s.t("kyc_k_pending", "Pending Verification"), v: kpis.pending ?? 0, tone: "text-amber-600 dark:text-amber-400" },
            { k: "incomplete", label: s.t("kyc_k_incomplete", "Incomplete"), v: kpis.incomplete ?? 0, tone: "text-rose-600 dark:text-rose-400" },
            { k: "expired", label: s.t("kyc_k_expired", "Expired"), v: kpis.expired ?? 0, tone: "text-rose-600 dark:text-rose-400" },
            { k: "expiring", label: s.t("kyc_k_expiring", "Expiring ≤ 30 Days"), v: kpis.docs_expiring_30d ?? 0, tone: "text-amber-600 dark:text-amber-400" },
            { k: "rate", label: s.t("kyc_compliance_rate", "Compliance Rate"), v: `${docStats.complianceRate}%`, tone: "text-blue-600 dark:text-blue-400" },
          ].map((c) => (
            <div key={c.k} data-testid={`kyc-kpi-${c.k}`} className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="truncate text-[11px] font-semibold text-slate-500 dark:text-slate-400">{c.label}</div>
              <div className={`mt-0.5 text-lg font-black tabular-nums ${c.tone}`}>{c.v}</div>
            </div>
          ))}
        </div>

        {/* 4. FILTER TOOLBAR */}
        <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search Input */}
            <div className="relative min-w-[240px] flex-1">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder={s.t("kyc_search_placeholder", "Search by employee name, ID or country...")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-9 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-purple-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>

            {/* Country Dropdown */}
            <select
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-purple-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="all">{s.tGlobal("common.all_countries", "All Countries")}</option>
              {countryOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>

            {/* Branch Dropdown */}
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              disabled={countryFilter === "all"}
              className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-purple-500 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="all">{s.tGlobal("common.all_branches", "All Branches")}</option>
              {branchOptions.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>

            {/* Department Dropdown */}
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-purple-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="all">{s.t("kyc_all_departments", "All Departments")}</option>
              {departmentOptions.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>

            {/* Document Type Dropdown */}
            <select
              value={docTypeFilter}
              onChange={(e) => setDocTypeFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-purple-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="all">{s.t("kyc_all_doc_types", "All Document Types")}</option>
              {requirementOptions.map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}
            </select>

            {/* Verification Status Dropdown */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-purple-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="all">{s.tGlobal("common.all_statuses", "All Statuses")}</option>
              <option value="verified">{s.t("kyc_status_verified", "Verified")}</option>
              <option value="pending_verification">{s.t("kyc_status_pending_verification", "Pending Verification")}</option>
              <option value="incomplete">{s.t("kyc_status_incomplete", "Incomplete")}</option>
              <option value="expired">{s.t("kyc_status_expired", "Expired")}</option>
            </select>

            {/* Expiry Status Dropdown */}
            <select
              value={expiryFilter}
              onChange={(e) => setExpiryFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-purple-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="all">{s.t("kyc_all_expiry_statuses", "All Expiry Statuses")}</option>
              <option value="valid">{s.t("kyc_valid_30d", "Valid (>30 days)")}</option>
              <option value="expiring">{s.t("kyc_k_expiring", "Expiring ≤ 30 Days")}</option>
              <option value="expired">{s.t("kyc_status_expired", "Expired")}</option>
            </select>

          </div>
        </div>

        {error ? (
          <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
            {error}
          </p>
        ) : null}

        {/* 5. MAIN TABLE REGISTER CARD (Screenshot 5 layout) */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
          {/* Card Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 px-5 py-3.5 bg-slate-50/50 dark:bg-slate-800/40">
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-slate-100">
                {s.t("kyc_register_title", "Employee Document Compliance Register")}
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {s.t("kyc_register_subtitle", "Track compliance rates, missing required files, verification progress and expiry timelines per employee.")}
              </p>
            </div>

          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/80 text-[11px] font-black uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400">
                  <Th className="w-12 px-3 py-3 text-center">#</Th>
                  <Th className="px-3 py-3 font-black text-slate-700 dark:text-slate-200">{s.t("kyc_col_employee_id", "Employee ID")}</Th>
                  <Th className="px-3 py-3 font-black text-slate-700 dark:text-slate-200">{s.t("kyc_col_employee_name", "Employee Name")}</Th>
                  <Th className="px-3 py-3 font-black text-slate-700 dark:text-slate-200">{s.t("country", "Country")}</Th>
                  <Th className="px-3 py-3 font-black text-slate-700 dark:text-slate-200">{s.tGlobal("common.branch", "Branch")}</Th>
                  <Th className="px-3 py-3 text-center font-black text-slate-700 dark:text-slate-200">{s.t("kyc_col_required_docs", "Required Docs")}</Th>
                  <Th className="px-3 py-3 text-center font-black text-slate-700 dark:text-slate-200">{s.t("kyc_k_verified", "Verified")}</Th>
                  <Th className="px-3 py-3 text-center font-black text-slate-700 dark:text-slate-200">{s.t("kyc_missing", "Missing")}</Th>
                  <Th className="px-3 py-3 text-center font-black text-slate-700 dark:text-slate-200">{s.t("kyc_col_expired", "Expired")}</Th>
                  <Th className="px-3 py-3 text-center font-black text-slate-700 dark:text-slate-200">{s.t("kyc_k_expiring_soon", "Expiring Soon")}</Th>
                  <Th className="px-4 py-3 font-black text-slate-700 dark:text-slate-200 min-w-[140px]">{s.t("kyc_col_compliance", "Compliance %")}</Th>
                  <Th className="px-3 py-3 font-black text-slate-700 dark:text-slate-200">{s.tGlobal("common.status", "Status")}</Th>
                  <Th className="w-28 px-3 py-3 text-right font-black text-slate-700 dark:text-slate-200">{s.t("actions", "Actions")}</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={13} className="py-12 text-center text-slate-400">
                      <Loader2 className="mx-auto h-5 w-5 animate-spin text-purple-600" />
                      <span className="mt-2 block text-xs">{s.t("kyc_loading", "Loading KYC compliance records...")}</span>
                    </td>
                  </tr>
                ) : kycList.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="py-12 text-center text-slate-400">
                      {s.t("kyc_no_records", "No employee KYC records match your criteria.")}
                    </td>
                  </tr>
                ) : (
                  pageRows.map((row, idx) => {
                    return (
                      <tr
                        key={row.id}
                        data-testid="kyc-row"
                        className="transition-colors hover:bg-purple-50/20 dark:hover:bg-purple-950/10"
                      >
                        <td className="px-3 py-2.5 text-center font-mono text-[11px] text-slate-400">
                          {(currentPage - 1) * pageSize + idx + 1}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
                          {row.employee_code}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="font-semibold text-slate-900 dark:text-slate-100">{row.employee_name}</span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="font-medium text-slate-700 dark:text-slate-300">{row.country}</span>
                        </td>
                        <td className="px-3 py-2.5 text-slate-600 dark:text-slate-400">
                          {row.branch}
                        </td>
                        <td className="px-3 py-2.5 text-center font-bold text-slate-700 dark:text-slate-300">
                          {row.required_count}
                        </td>
                        <td className="px-3 py-2.5 text-center font-bold text-emerald-600 dark:text-emerald-400">
                          {row.verified_count}
                        </td>
                        <td className="px-3 py-2.5 text-center font-bold text-rose-600 dark:text-rose-400">
                          {row.missing_count}
                        </td>
                        <td className="px-3 py-2.5 text-center font-semibold text-slate-600 dark:text-slate-400">
                          {row.expired_count}
                        </td>
                        <td className="px-3 py-2.5 text-center font-semibold text-amber-600 dark:text-amber-400">
                          {row.expiring_soon_count}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="h-2 flex-1 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  row.compliance_rate === 100
                                    ? "bg-emerald-500"
                                    : row.compliance_rate >= 70
                                    ? "bg-amber-500"
                                    : "bg-rose-500"
                                }`}
                                style={{ width: `${row.compliance_rate}%` }}
                              />
                            </div>
                            <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300 w-10 text-right">
                              {row.compliance_rate}%
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          {row.kyc_status === "verified" ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                              {s.t("kyc_status_verified", "Verified")}
                            </span>
                          ) : row.kyc_status === "pending_verification" ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-500"></span>
                              {s.t("kyc_status_pending_verification", "Pending Verification")}
                            </span>
                          ) : row.kyc_status === "expired" ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300">
                              <span className="h-1.5 w-1.5 rounded-full bg-rose-500"></span>
                              {s.t("kyc_status_expired", "Expired")}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300">
                              <span className="h-1.5 w-1.5 rounded-full bg-rose-500"></span>
                              {s.t("kyc_status_incomplete", "Incomplete")}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setOpenEmp(row)}
                              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 shadow-sm hover:bg-purple-50 hover:text-purple-700 hover:border-purple-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition"
                            >
                              {s.t("kyc_open", "Open Checklist")}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer */}
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
              <span>
                {s.t("kyc_showing", "Showing")} <span className="font-bold text-slate-800 dark:text-slate-200">{kycList.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}</span> {s.t("kyc_to", "to")}{" "}
                <span className="font-bold text-slate-800 dark:text-slate-200">{Math.min(currentPage * pageSize, kycList.length)}</span> {s.t("kyc_of", "of")}{" "}
                <span className="font-bold text-slate-800 dark:text-slate-200">{kycList.length}</span> {s.t("kyc_records", "records")}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 font-semibold text-slate-500 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:border-slate-700"
              >
                {s.isRtl ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
                {s.t("kyc_previous", "Previous")}
              </button>
              <button
                type="button"
                className="rounded-lg bg-purple-600 px-2.5 py-1 font-bold text-white shadow-sm"
              >
                {currentPage}
              </button>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 font-semibold text-slate-500 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:border-slate-700"
              >
                {s.t("kyc_next", "Next")}
                {s.isRtl ? <ChevronLeft className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* KYC Checklist Drawer Modal */}
      {openEmp ? (
        <KycChecklistDrawer
          s={s}
          employeeId={openEmp.employee_id}
          caps={caps}
          onClose={() => setOpenEmp(null)}
          onChanged={() => void load()}
        />
      ) : null}
    </div>
  );
}

function KycChecklistDrawer({
  s, employeeId, caps: listCaps, onClose, onChanged,
}: {
  s: ReturnType<typeof useErpScreen>;
  employeeId: string;
  caps: Caps;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [data, setData] = useState<{ employee: Row | null; items: Row[]; caps?: Caps } | null>(null);
  const [preview, setPreview] = useState<{ docId: string; label: string } | null>(null);
  // the checklist answer carries the same capabilities (the server is the authority); fall back to the list ones until it arrives
  const caps = data?.caps ?? listCaps;
  const [loading, setLoading] = useState(true);
  const [editCode, setEditCode] = useState<string | null>(null);
  const [form, setForm] = useState<Row>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const r = await apiGet<{ employee: Row; items: Row[]; caps?: Caps }>(`/api/erp/hr/kyc/${employeeId}`);
      setData(r);
    } catch (e) {
      setData(null);
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => { void load(); }, [load]);

  const startEdit = (it: Row) => {
    setEditCode(it.code);
    setForm({
      requirementCode: it.code,
      documentNumber: it.document_number ?? "",
      issuingAuthority: it.issuing_authority ?? "",
      issueDate: it.issue_date ?? "",
      expiryDate: it.expiry_date ?? "",
      fileUrl: it.file_url ?? "",
      notes: it.notes ?? "",
    });
  };

  const saveDoc = async () => {
    setBusy(true);
    setErr(null);
    try {
      const payload: Row = { ...form };
      Object.keys(payload).forEach((k) => { if (payload[k] === "") payload[k] = null; });
      payload.requirementCode = form.requirementCode;
      await apiPost(`/api/erp/hr/kyc/${employeeId}`, payload);
      setEditCode(null);
      await load();
      onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const verify = async (docId: string, decision: "verified" | "rejected") => {
    const reason = decision === "rejected" ? window.prompt(s.t("kyc_reject_reason", "Rejection reason:")) ?? undefined : undefined;
    setBusy(true);
    try {
      await apiPatch(`/api/erp/hr/kyc/documents/${docId}`, { decision, reason });
      await load();
      onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm" onClick={onClose}>
      <div dir={s.dir} className="h-full w-full max-w-2xl overflow-y-auto bg-white p-5 shadow-2xl dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b pb-3 dark:border-slate-800">
          <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <span>{s.t("kyc_checklist", "Employee KYC / QVC Checklist")}</span>
            {data?.employee ? (
              <span className="font-mono text-xs font-normal text-slate-500 dark:text-slate-400">
                · {data.employee.employee_code} ({data.employee.name})
              </span>
            ) : null}
          </h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button>
        </div>

        {err ? <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{err}</p> : null}
        {!caps.identifiers ? (
          <p data-testid="kyc-masked-note" className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
            {s.t("kyc_masked_note", "Document numbers are masked and scans are hidden for your role.")}
          </p>
        ) : null}

        {loading ? (
          <div className="py-16 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-purple-600" /></div>
        ) : (
          <div className="mt-4 space-y-2.5">
            {(data?.items ?? []).map((it) => (
              <div key={it.code} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700 bg-slate-50/30 dark:bg-slate-800/30">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-black text-slate-800 dark:text-slate-100">{it.label}</span>
                    {it.is_mandatory ? <span className="ms-1 text-[11px] font-bold text-rose-500">* {s.t("kyc_required", "Required")}</span> : null}
                    <span className={`ms-2 rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_TONE[it.status || "pending"] || STATUS_TONE.pending}`}>
                      {it.status === "verified" ? s.t("kyc_docstatus_verified", "Verified") : it.status === "rejected" ? s.t("kyc_docstatus_rejected", "Rejected") : s.t("kyc_docstatus_pending", "Pending")}
                    </span>
                    {it.expiry_date ? (
                      <span className="ms-2 text-[11px] text-slate-500">
                        {s.t("kyc_expires", "Expires")}: <strong className="text-slate-700 dark:text-slate-300">{it.expiry_date}</strong>
                      </span>
                    ) : null}
                  </div>
                  <div className="flex gap-1.5">
                    {it.document_id && it.office_document_id && caps.identifiers ? (
                      <button
                        type="button"
                        data-testid="kyc-preview"
                        onClick={() => setPreview({ docId: it.document_id, label: it.label })}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                      >
                        <Eye className="h-3 w-3" /> {s.t("kyc_preview", "Preview")}
                      </button>
                    ) : it.file_hidden ? (
                      <span className="text-[11px] italic text-slate-400">{s.t("kyc_file_hidden", "Scan hidden for your role")}</span>
                    ) : null}
                    {caps.upload ? (
                      <button
                        type="button"
                        onClick={() => startEdit(it)}
                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 shadow-sm"
                      >
                        {it.document_number ? s.t("kyc_update_edit", "Update / Edit") : s.t("kyc_add_doc", "Add Document")}
                      </button>
                    ) : null}
                    {caps.verify && it.document_id && it.status !== "verified" ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void verify(it.document_id, "verified")}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2 py-1 text-[11px] font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        <Check className="h-3 w-3" /> {s.t("kyc_verify", "Verify")}
                      </button>
                    ) : null}
                    {caps.verify && it.document_id && it.status !== "rejected" ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void verify(it.document_id, "rejected")}
                        className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2 py-1 text-[11px] font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900"
                      >
                        <Ban className="h-3 w-3" /> {s.t("kyc_reject", "Reject")}
                      </button>
                    ) : null}
                  </div>
                </div>

                {it.document_number || it.rejection_reason ? (
                  <div className="mt-1.5 text-[11px] text-slate-500 flex flex-wrap gap-2">
                    {it.document_number ? <span>{s.t("kyc_number", "Document No")}: <strong className="text-slate-700 dark:text-slate-300 font-mono">{it.document_number}</strong></span> : null}
                    {it.rejection_reason ? <span className="text-rose-500 font-semibold">{s.t("reason", "Reason")}: {it.rejection_reason}</span> : null}
                  </div>
                ) : null}

                {caps.upload && editCode === it.code ? (
                  <div className="mt-3 grid grid-cols-2 gap-2.5 border-t border-slate-200/60 pt-3 dark:border-slate-700">
                    <L label={s.t("kyc_number", "Document No")}><input value={form.documentNumber ?? ""} onChange={(e) => setForm((p) => ({ ...p, documentNumber: e.target.value }))} className={INP} /></L>
                    <L label={s.t("kyc_authority", "Issuing Authority")}><input value={form.issuingAuthority ?? ""} onChange={(e) => setForm((p) => ({ ...p, issuingAuthority: e.target.value }))} className={INP} /></L>
                    <L label={s.t("kyc_issue_date", "Issue Date")}><input type="date" value={form.issueDate ?? ""} onChange={(e) => setForm((p) => ({ ...p, issueDate: e.target.value }))} className={INP} /></L>
                    <L label={s.t("kyc_expiry_date", "Expiry Date")}><input type="date" value={form.expiryDate ?? ""} onChange={(e) => setForm((p) => ({ ...p, expiryDate: e.target.value }))} className={INP} /></L>
                    <L label={s.t("kyc_file_url", "File URL / Reference")}><input value={form.fileUrl ?? ""} onChange={(e) => setForm((p) => ({ ...p, fileUrl: e.target.value }))} className={INP} /></L>
                    <L label={s.t("kyc_notes", "Notes")}><input value={form.notes ?? ""} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} className={INP} /></L>
                    <div className="col-span-2 flex gap-2 pt-1">
                      <button type="button" disabled={busy} onClick={() => void saveDoc()} className="rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-purple-700 disabled:opacity-50">{s.t("save", "Save")}</button>
                      <button type="button" onClick={() => setEditCode(null)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300">{s.t("cancel", "Cancel")}</button>
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
      {preview ? (
        <div data-testid="kyc-preview-modal" className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-3 backdrop-blur-sm" onClick={(e) => { e.stopPropagation(); setPreview(null); }}>
          <div dir={s.dir} className="flex h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-2 border-b px-4 py-2.5 dark:border-slate-800">
              <div className="min-w-0">
                <div className="truncate text-sm font-black text-slate-900 dark:text-slate-100">{preview.label}</div>
                <div className="truncate text-[11px] text-slate-500">
                  {s.t("kyc_preview_title", "Employee document")}
                  {data?.employee ? ` · ${data.employee.employee_code} (${data.employee.name})` : ""}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <a
                  href={`/api/erp/hr/kyc/documents/${preview.docId}/file?disposition=attachment`}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
                >
                  <Download className="h-3.5 w-3.5" /> {s.t("kyc_download", "Download")}
                </a>
                <button type="button" onClick={() => setPreview(null)} aria-label={s.tGlobal("common.close", "Close")} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <iframe title={preview.label} src={`/api/erp/hr/kyc/documents/${preview.docId}/file`} className="h-full w-full flex-1 bg-slate-100 dark:bg-slate-950" />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</label>
      {children}
    </div>
  );
}
