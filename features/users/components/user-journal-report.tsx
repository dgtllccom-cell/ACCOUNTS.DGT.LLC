"use client";

import { DownloadActionIcon } from "@/components/ui/download-action-icon";
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */

import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bookmark,
  Building2,
  Calendar,
  ChevronDown,
  Download,
  Edit3,
  Eye,
  EyeOff,
  Filter,
  Globe2,
  Grid2X2,
  Info,
  Mail,
  MessageCircle,
  MoreVertical,
  Printer,
  RefreshCw,
  Search,
  Settings,
  Share2,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  UserCog,
  UserPlus,
  Users,
  Power,
  Loader2,
  Lock,
  Trash2
} from "lucide-react";
import { apiGet } from "@/lib/api/client";
import type { SearchSelectOption } from "@/components/ui/search-select";
import { cn } from "@/lib/utils";
import { UserLiveReportPanel } from "./user-live-report-panel";

type UserJournalRow = {
  userId: string;
  userCode: string;
  fullName: string;
  email?: string | null;
  countryId: string | null;
  countryName: string;
  branchId: string | null;
  branchName: string;
  branchCode?: string | null;
  branchType: string;
  role: string;
  purpose?: string | null;
  registrationDate: string;
  status: "active" | "inactive";
  permissions: string[];
  lastActivity: string;
  lastActivityAction: string | null;
  rawPassword?: string | null;
  activityCounts: {
    logins: number;
    transactions: number;
    roznamcha: number;
    purchases: number;
    payments: number;
    accounts: number;
    approvals: number;
    edits: number;
  };
};

type UserJournalReportResponse = {
  summary: {
    totalUsers: number;
    activeUsers: number;
    countryUsers: number;
    branchUsers: number;
    adminUsers: number;
    recentLogins: number;
  };
  filters: {
    countries: SearchSelectOption[];
    branches: SearchSelectOption[];
    roles: SearchSelectOption[];
  };
  rows: UserJournalRow[];
  generatedAt: string;
};

let userJournalCache: { data: UserJournalReportResponse; cachedAt: number } | null = null;
const USER_JOURNAL_CACHE_MS = 1000 * 60 * 3;

function normalizeSearch(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function matchesText(haystack: string, query: string) {
  if (!query) return true;
  return normalizeSearch(haystack).includes(normalizeSearch(query));
}

function csvEscape(value: string) {
  const v = (value ?? "").toString();
  if (/[",\r\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((row) => row.map((cell) => csvEscape(cell)).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function formatDateTime(value: string) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export function UserJournalReport() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<UserJournalReportResponse | null>(null);
  const [sessionInfo, setSessionInfo] = useState<{ user: { id: string; email: string | null; fullName: string | null }; roles: string[] } | null>(null);

  const [adminOnly, setAdminOnly] = useState(false);
  const [recentLoginsOnly, setRecentLoginsOnly] = useState(false);
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({});

  const togglePasswordVisibility = (userId: string) => {
    setRevealedPasswords((prev) => ({
      ...prev,
      [userId]: !prev[userId]
    }));
  };

  const [draftQuery, setDraftQuery] = useState("");
  const [draftCountryId, setDraftCountryId] = useState("all");
  const [draftBranchId, setDraftBranchId] = useState("all");
  const [draftRole, setDraftRole] = useState("all");
  const [draftShareBy, setDraftShareBy] = useState("all");
  const [draftStatus, setDraftStatus] = useState("all");
  const [draftFromDate, setDraftFromDate] = useState("");
  const [draftToDate, setDraftToDate] = useState("");

  const [query, setQuery] = useState("");
  const [countryId, setCountryId] = useState("all");
  const [branchId, setBranchId] = useState("all");
  const [role, setRole] = useState("all");
  const [shareBy, setShareBy] = useState("all");
  const [status, setStatus] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [openMenu, setOpenMenu] = useState<"filters" | "actions" | "fields" | "more" | null>(null);
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [clientGeneratedAt, setClientGeneratedAt] = useState("");

  // Active user states
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [activeActionUserId, setActiveActionUserId] = useState<string | null>(null);

  // Modals state
  const [viewUser, setViewUser] = useState<UserJournalRow | null>(null);

  // Outside click listener to close open action/top menus
  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      const target = event.target as HTMLElement;
      if (!target.closest(".ujr-action-container") && !target.closest(".ujr-menu-wrap")) {
        setOpenMenu(null);
        setActiveActionUserId(null);
      }
    }
    window.addEventListener("click", handleOutsideClick);
    return () => window.removeEventListener("click", handleOutsideClick);
  }, []);

  // Fetch session details on load
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const info = await apiGet<{ user: { id: string; email: string | null; fullName: string | null }; roles: string[] }>(
          "/api/erp/auth/session"
        );
        if (!cancelled) setSessionInfo(info);
      } catch {
        // Optional session info
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function loadReport(options: { force?: boolean } = {}) {
    let cancelled = false;
    const cached = userJournalCache;
    const freshCache = cached && Date.now() - cached.cachedAt < USER_JOURNAL_CACHE_MS;
    if (!options.force && freshCache) {
      setData(cached.data);
      setError(null);
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setLoading(true);
    setError(null);
    apiGet<UserJournalReportResponse>("/api/erp/users/journal-report?limit=200")
      .then((res) => {
        if (cancelled) return;
        userJournalCache = { data: res, cachedAt: Date.now() };
        setData(res);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load user journal report");
        if (userJournalCache?.data) setData(userJournalCache.data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }

  useEffect(() => {
    return loadReport();
  }, []);

  useEffect(() => {
    function refreshIfDirty() {
      const dirtyAt = localStorage.getItem("user_journal_dirty");
      if (!dirtyAt) return;
      localStorage.removeItem("user_journal_dirty");
      userJournalCache = null;
      loadReport({ force: true });
    }

    refreshIfDirty();
    window.addEventListener("focus", refreshIfDirty);
    document.addEventListener("visibilitychange", refreshIfDirty);
    return () => {
      window.removeEventListener("focus", refreshIfDirty);
      document.removeEventListener("visibilitychange", refreshIfDirty);
    };
  }, []);

  useEffect(() => {
    setClientGeneratedAt(formatDateTime(data?.generatedAt ?? new Date().toISOString()));
  }, [data?.generatedAt]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setQuery(draftQuery.trim());
      setCurrentPage(1);
    }, 220);
    return () => window.clearTimeout(timeout);
  }, [draftQuery]);

  const filteredRows = useMemo(() => {
    const rows = data?.rows ?? [];
    return rows.filter((row) => {
      if (countryId !== "all" && row.countryId !== countryId) return false;
      if (branchId !== "all" && row.branchId !== branchId) return false;
      if (role !== "all" && row.role !== role) return false;
      if (shareBy === "country" && row.branchType !== "Country") return false;
      if (shareBy === "branch" && !["Main Branch", "City Branch", "Branch"].includes(row.branchType)) return false;
      if (shareBy === "global" && row.branchType !== "Global") return false;
      if (status !== "all" && row.status !== status) return false;
      if (fromDate && row.registrationDate.slice(0, 10) < fromDate) return false;
      if (toDate && row.registrationDate.slice(0, 10) > toDate) return false;
      if (adminOnly && !["super_admin", "country_admin", "main_branch_admin"].includes(row.role)) return false;
      if (recentLoginsOnly && row.activityCounts.logins === 0) return false;
      if (!query) return true;
      return matchesText(
        [
          row.userCode,
          row.fullName,
          row.email,
          row.countryName,
          row.branchName,
          row.branchType,
          row.role,
          row.status,
          row.permissions.join(" "),
          row.lastActivityAction ?? ""
        ]
          .filter(Boolean)
          .join(" "),
        query
      );
    });
  }, [branchId, countryId, data?.rows, fromDate, query, role, shareBy, status, toDate, adminOnly, recentLoginsOnly]);

  const summary = useMemo(() => {
    return {
      totalUsers: filteredRows.length,
      activeUsers: filteredRows.filter((row) => row.status === "active").length,
      countryUsers: filteredRows.filter((row) => row.branchType === "Country").length,
      branchUsers: filteredRows.filter((row) => ["Main Branch", "City Branch", "Branch"].includes(row.branchType)).length,
      adminUsers: filteredRows.filter((row) => ["super_admin", "country_admin", "main_branch_admin"].includes(row.role)).length,
      recentLogins: filteredRows.reduce((sum, row) => sum + row.activityCounts.logins, 0)
    };
  }, [filteredRows]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, pageCount);
  const pageStart = filteredRows.length ? (safeCurrentPage - 1) * pageSize : 0;
  const pageEnd = Math.min(pageStart + pageSize, filteredRows.length);
  const paginatedRows = filteredRows.slice(pageStart, pageEnd);
  const superAdminRow = useMemo(
    () => filteredRows.find((row) => row.role === "super_admin") ?? filteredRows.find((row) => row.branchType === "Global") ?? filteredRows[0] ?? null,
    [filteredRows]
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [branchId, countryId, fromDate, pageSize, query, role, shareBy, status, toDate, adminOnly, recentLoginsOnly]);

  useEffect(() => {
    if (currentPage > pageCount) setCurrentPage(pageCount);
  }, [currentPage, pageCount]);

  // Handle direct Status Toggling
  const handleToggleStatus = async (userId: string, currentStatus: string) => {
    setUpdatingUserId(userId);
    const nextStatus = currentStatus === "active" ? "inactive" : "active";
    try {
      const res = await fetch("/api/erp/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          isActive: nextStatus === "active"
        })
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json?.error?.message || json?.error || "Failed to toggle status.");
      }

      // Update local state and cache
      if (data) {
        const updatedRows = data.rows.map((row) => {
          if (row.userId === userId) {
            return { ...row, status: nextStatus as "active" | "inactive" };
          }
          return row;
        });
        const nextData = { ...data, rows: updatedRows };
        setData(nextData);
        if (userJournalCache) userJournalCache.data = nextData;
      }
    } catch (err: any) {
      alert(err.message || "Failed to toggle status.");
    } finally {
      setUpdatingUserId(null);
    }
  };

  // Trigger edit — navigate to dedicated full-screen edit page
  const triggerEdit = (row: UserJournalRow) => {
    router.push(`/dashboard/users/edit/${row.userId}`);
  };

  const handleDeleteUser = async (userId: string, userCode: string, fullName: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete user ${userCode} (${fullName})? This will release their email address for re-registration.`)) {
      return;
    }
    setUpdatingUserId(userId);
    try {
      const res = await fetch(`/api/erp/users?userId=${encodeURIComponent(userId)}`, {
        method: "DELETE"
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json?.error?.message || json?.error || "Failed to delete user.");
      }

      // Update local state and cache
      if (data) {
        const updatedRows = data.rows.filter((row) => row.userId !== userId);
        const nextData = { ...data, rows: updatedRows };
        setData(nextData);
        if (userJournalCache) userJournalCache.data = nextData;
      }
    } catch (err: any) {
      alert(err.message || "Failed to delete user.");
    } finally {
      setUpdatingUserId(null);
    }
  };

  function applyFilters() {
    setQuery(draftQuery.trim());
    setCountryId(draftCountryId);
    setBranchId(draftBranchId);
    setRole(draftRole);
    setShareBy(draftShareBy);
    setStatus(draftStatus);
    setFromDate(draftFromDate);
    setToDate(draftToDate);
    setOpenMenu(null);
  }

  function resetFilters() {
    setDraftQuery("");
    setDraftCountryId("all");
    setDraftBranchId("all");
    setDraftRole("all");
    setDraftShareBy("all");
    setDraftStatus("all");
    setDraftFromDate("");
    setDraftToDate("");
    setQuery("");
    setCountryId("all");
    setBranchId("all");
    setRole("all");
    setShareBy("all");
    setStatus("all");
    setFromDate("");
    setToDate("");
    setOpenMenu(null);
    setAdminOnly(false);
    setRecentLoginsOnly(false);
  }

  function printReport() {
    window.print();
  }

  function openNewUser() {
    router.push("/dashboard/users/new");
  }

  function exportPdf() {
    window.print();
  }

  function exportExcel() {
    const rows: string[][] = [
      ["SR.", "Country", "Branch", "Branch Code", "User Name", "User ID", "Login User ID", "Email", "Role", "Password", "Purpose / Work", "Status", "Registration Date", "Last Activity"]
    ];
    for (let i = 0; i < filteredRows.length; i++) {
      const row = filteredRows[i];
      rows.push([
        String(i + 1),
        row.countryName || "Global",
        row.branchName || "-",
        row.branchCode || "-",
        row.fullName,
        row.userId.slice(0, 8).toUpperCase(),
        row.userCode,
        row.email || "-",
        formatRoleName(row.role),
        row.rawPassword || "••••••••",
        row.purpose || row.lastActivityAction || "-",
        row.status,
        row.registrationDate,
        row.lastActivity
      ]);
    }
    downloadCsv(`user-journal-report_${new Date().toISOString().slice(0, 10)}.csv`, rows);
  }

  function editReport() {
    setOpenMenu("filters");
  }

  function emailReport() {
    const subject = encodeURIComponent("User Journal Report");
    const body = encodeURIComponent(`User Journal Report\nRows: ${filteredRows.length}\nGenerated: ${new Date().toLocaleString()}`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }

  function whatsappReport() {
    const text = encodeURIComponent(`User Journal Report - ${filteredRows.length} rows`);
    window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer");
  }

  async function shareReport() {
    const text = `User Journal Report - ${filteredRows.length} rows`;
    if (navigator.share) {
      await navigator.share({ title: "User Journal Report", text }).catch(() => undefined);
      return;
    }
    await navigator.clipboard?.writeText(text).catch(() => undefined);
  }

  const isSuperAdminUser = useMemo(() => {
    return sessionInfo?.roles.includes("super_admin") ?? false;
  }, [sessionInfo]);

  // Portal slots — inject title + toolbar into sticky ERP header
  const [titleSlot, setTitleSlot] = useState<HTMLElement | null>(null);
  const [actionsSlot, setActionsSlot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setTitleSlot(document.getElementById("erp-page-title-slot"));
    setActionsSlot(document.getElementById("erp-page-actions-slot"));
  }, []);

  const toolbarProps = {
    openMenu,
    setOpenMenu,
    data,
    draftQuery,
    setDraftQuery,
    draftFromDate,
    setDraftFromDate,
    draftToDate,
    setDraftToDate,
    draftShareBy,
    setDraftShareBy,
    draftStatus,
    setDraftStatus,
    draftRole,
    setDraftRole,
    draftCountryId,
    setDraftCountryId,
    draftBranchId,
    setDraftBranchId,
    applyFilters,
    resetFilters,
    editReport,
    printReport,
    exportPdf,
    exportExcel,
    emailReport,
    whatsappReport,
    shareReport: () => void shareReport(),
    openNewUser,
    summary,
    status,
    setStatus,
    shareBy,
    setShareBy,
    adminOnly,
    setAdminOnly,
    recentLoginsOnly,
    setRecentLoginsOnly,
    query,
    countryId,
    branchId,
    role,
    fromDate,
    toDate
  };

  return (
    <div className="ujr-shell text-[var(--ujr-text)]">
      <UserJournalStyles />

      {/* Title portal — injects into the sticky ERP header left slot */}
      {titleSlot && createPortal(
        <div className="flex items-center gap-2.5">
          <div className="grid h-7 w-7 place-items-center rounded-lg border border-blue-300/70 bg-gradient-to-br from-blue-50 to-indigo-100 text-[#1d4ed8] shadow-sm dark:from-blue-950 dark:to-indigo-950">
            <Users className="h-3.5 w-3.5" />
          </div>
          <div>
            <div className="text-[8px] font-black uppercase tracking-wider text-slate-400 leading-none">Users</div>
            <h1 className="text-xs font-black tracking-tight text-slate-900 dark:text-slate-100 leading-none mt-0.5">User Journal Report</h1>
          </div>
        </div>,
        titleSlot
      )}

      {/* Actions portal — injects all toolbar buttons into the sticky ERP header right slot */}
      {actionsSlot && createPortal(
        <TopToolbar {...toolbarProps} />,
        actionsSlot
      )}

      <main className="min-w-0">

        {/* Expanded Executive Management Summary Area */}
        <section className="mb-4 rounded-xl border border-[var(--ujr-line)] bg-[var(--ujr-card)] p-5 shadow-sm">
          <div className="border-b border-[var(--ujr-line)] pb-3 mb-4 flex justify-between items-center">
            <h2 className="text-[11px] font-black uppercase tracking-wider text-[var(--ujr-muted)]">Executive User Management Summary</h2>
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-6">
            <div className="space-y-1">
              <div className="text-[9px] uppercase tracking-wide text-[var(--ujr-muted)] font-black">Admin Name</div>
              <div className="text-sm font-black text-[var(--ujr-title)] flex items-center gap-2">
                <div className="grid h-6 w-6 place-items-center rounded-full bg-blue-600 text-white font-black text-[9px] shadow-sm">
                  {initials(sessionInfo?.user?.fullName ?? superAdminRow?.fullName ?? "Super Admin")}
                </div>
                <span>{sessionInfo?.user?.fullName ?? superAdminRow?.fullName ?? "Super Admin"}</span>
              </div>
              <div className="text-[9px] text-[var(--ujr-muted)] font-mono">
                ID: {sessionInfo?.user?.id?.slice(0, 8).toUpperCase() ?? superAdminRow?.userCode ?? "SUPERADMIN"}
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-[9px] uppercase tracking-wide text-[var(--ujr-muted)] font-black">Branch Name</div>
              <div className="text-sm font-black text-[var(--ujr-title)]">{superAdminRow?.branchName || "Global"}</div>
              <div className="text-[9px] text-[var(--ujr-muted)] font-semibold">{superAdminRow?.branchType || "Global"}</div>
            </div>

            <div className="space-y-1">
              <div className="text-[9px] uppercase tracking-wide text-[var(--ujr-muted)] font-black">Branch Code</div>
              <div className="text-sm font-black text-[#1455ff] font-mono">{superAdminRow?.branchCode || "-"}</div>
            </div>

            <div className="space-y-1">
              <div className="text-[9px] uppercase tracking-wide text-[var(--ujr-muted)] font-black">ERP Team / Role</div>
              <div>
                <span className="inline-flex items-center rounded-full bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 text-[10px] font-black text-blue-700 dark:text-blue-300 uppercase tracking-wider">
                  {sessionInfo?.roles[0]?.replace(/_/g, " ") ?? superAdminRow?.role?.replace(/_/g, " ") ?? "Super Admin"}
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-[9px] uppercase tracking-wide text-[var(--ujr-muted)] font-black">Last Login</div>
              <div className="text-xs font-black text-[var(--ujr-title)] font-mono">{formatDateTime(superAdminRow?.lastActivity ?? "")}</div>
            </div>

            <div className="space-y-1">
              <div className="text-[9px] uppercase tracking-wide text-[var(--ujr-muted)] font-black">Current Session Time</div>
              <div className="text-xs font-black text-[var(--ujr-title)] font-mono">{clientGeneratedAt || "-"}</div>
            </div>
          </div>
        </section>

        {/* Metrics cards removed, now sitting in the header toolbar */}

        {error ? (
          <div className="mb-3 flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100 sm:flex-row sm:items-center sm:justify-between">
            <span>Report data could not refresh right now. Showing cached/fallback data where available. Detail: {error}</span>
            <button className="ujr-secondary-btn h-8 px-3" type="button" onClick={() => { loadReport({ force: true }); }}>
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </button>
          </div>
        ) : null}

        {/* Clean Report Table — columns: #, Country, Branch, Branch Code, User Name, User ID, Login User ID, Role, Purpose/Work, Status, Actions */}
        <section className="ujr-table-card overflow-hidden rounded-[14px] border shadow-[0_12px_34px_rgba(15,23,42,.08)]">
          <div className="overflow-x-auto">
            <table className="min-w-[1300px] w-full border-collapse text-left text-[11px]">
              <thead>
                <tr className="bg-[var(--ujr-table-head)] text-[11px] font-black uppercase tracking-wide text-[var(--ujr-title)] text-center">
                  {["#", "Country", "Branch", "Branch Code", "User Name", "User ID", "Login User ID", "Email", "Role", "Password", "Purpose / Work", "Status", "Actions"].map((head) => (
                    <th key={head} className="border-b border-r border-[var(--ujr-line)] px-3 py-2.5 last:border-r-0 whitespace-nowrap">{head}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={13} className="px-4 py-8 text-center text-[var(--ujr-muted)]">Loading user journal report...</td></tr>
                ) : paginatedRows.length ? (
                  paginatedRows.map((row, index) => (
                    <tr key={row.userId} className="bg-[var(--ujr-card)] text-[var(--ujr-title)] transition hover:bg-[var(--ujr-row-hover)] text-center">
                      <td className="border-b border-r border-[var(--ujr-line)] px-3 py-2 font-bold whitespace-nowrap">{pageStart + index + 1}</td>
                      <td className="border-b border-r border-[var(--ujr-line)] px-3 py-2 font-black whitespace-nowrap">{row.countryName || "Global"}</td>
                      <td className="border-b border-r border-[var(--ujr-line)] px-3 py-2 whitespace-nowrap">
                        <div className="font-bold text-left">{row.branchName || "-"}</div>
                        <div className="text-[10px] font-semibold text-[var(--ujr-muted)] text-left">{row.branchType}</div>
                      </td>
                      {/* Branch Code */}
                      <td className="border-b border-r border-[var(--ujr-line)] px-3 py-2 font-mono font-bold text-[10px] text-[#1455ff] whitespace-nowrap">
                        {row.branchCode || "-"}
                      </td>
                      <td className="border-b border-r border-[var(--ujr-line)] px-3 py-2 font-black whitespace-nowrap text-left">
                        <div className="flex items-center gap-2">
                          <div className="grid h-6 w-6 place-items-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-[8px] font-black text-white shrink-0 shadow-sm">
                            {initials(row.fullName)}
                          </div>
                          <span>{row.fullName}</span>
                        </div>
                      </td>
                      {/* User ID (System) */}
                      <td className="border-b border-r border-[var(--ujr-line)] px-3 py-2 font-mono font-bold text-[10px] text-[var(--ujr-muted)] whitespace-nowrap">
                        {row.userId.slice(0, 8).toUpperCase()}
                      </td>
                      {/* Login User ID */}
                      <td className="border-b border-r border-[var(--ujr-line)] px-3 py-2 font-black text-[#1455ff] whitespace-nowrap">{row.userCode}</td>
                      {/* Email */}
                      <td className="border-b border-r border-[var(--ujr-line)] px-3 py-2 font-medium text-[var(--ujr-muted)] whitespace-nowrap">{row.email || "—"}</td>
                      {/* Role */}
                      <td className="border-b border-r border-[var(--ujr-line)] px-3 py-2 text-[11px] whitespace-nowrap">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{formatRoleName(row.role)}</span>
                      </td>
                      {/* Password */}
                      <td className="border-b border-r border-[var(--ujr-line)] px-3 py-2 font-mono text-[10px]">
                        <div className="flex items-center gap-1.5 justify-between">
                          <span>
                            {revealedPasswords[row.userId]
                              ? (row.rawPassword || "—")
                              : "••••••••"}
                          </span>
                          <button
                            type="button"
                            className="ujr-pw-toggle-btn text-[var(--ujr-muted)] hover:text-[#1455ff] transition shrink-0"
                            onClick={() => togglePasswordVisibility(row.userId)}
                            title={revealedPasswords[row.userId] ? "Hide password" : "Show password"}
                          >
                            {revealedPasswords[row.userId] ? (
                              <EyeOff className="h-3.5 w-3.5" />
                            ) : (
                              <Eye className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </td>
                      {/* Purpose / Work */}
                      <td className="border-b border-r border-[var(--ujr-line)] px-3 py-2 text-[11px] font-semibold text-[var(--ujr-muted)] whitespace-nowrap">
                        {row.purpose || row.lastActivityAction || "—"}
                      </td>
                      {/* Status Toggle */}
                      <td className="border-b border-r border-[var(--ujr-line)] px-3 py-2 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={updatingUserId === row.userId}
                            className={cn("ujr-toggle-switch", row.status === "active" ? "ujr-toggle-switch-active" : "")}
                            onClick={() => handleToggleStatus(row.userId, row.status)}
                          >
                            <span className="ujr-toggle-thumb" />
                          </button>
                          <span className={cn("text-[10px] font-bold uppercase tracking-wider", row.status === "active" ? "text-emerald-600" : "text-slate-400")}>
                            {updatingUserId === row.userId ? "..." : row.status}
                          </span>
                        </div>
                      </td>
                      {/* Actions */}
                      <td className="border-b border-[var(--ujr-line)] px-3 py-2 ujr-action-container relative">
                        <div className="flex items-center gap-2">
                          {/* View Details icon */}
                          <button className="ujr-icon-btn" type="button" onClick={() => setViewUser(row)} title="View Details">
                            <Eye className="h-4 w-4" />
                          </button>
                          {/* Edit icon — direct navigate to edit page */}
                          <button
                            className="ujr-icon-btn ujr-icon-btn-edit"
                            type="button"
                            onClick={() => triggerEdit(row)}
                            title="Edit User"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                          {/* More actions dropdown */}
                          <div className="relative">
                            <button
                              className="ujr-icon-btn"
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveActionUserId(activeActionUserId === row.userId ? null : row.userId);
                              }}
                              title="More Actions"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </button>
                            {activeActionUserId === row.userId && (
                              <div className="ujr-action-dropdown absolute right-0 mt-1.5 w-44 bg-[var(--ujr-card)] border border-[var(--ujr-line)] rounded-lg shadow-lg z-[80] py-1 text-left">
                                <button
                                  type="button"
                                  className="w-full text-left px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold flex items-center gap-1.5 text-[var(--ujr-title)]"
                                  onClick={() => { setActiveActionUserId(null); setViewUser(row); }}
                                >
                                  <Eye className="h-3.5 w-3.5 text-[#1455ff]" /> View Details
                                </button>
                                <button
                                  type="button"
                                  className="w-full text-left px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold flex items-center gap-1.5 text-[var(--ujr-title)]"
                                  onClick={() => { setActiveActionUserId(null); triggerEdit(row); }}
                                >
                                  <Edit3 className="h-3.5 w-3.5 text-orange-500" /> Edit User
                                </button>
                                <button
                                  type="button"
                                  className="w-full text-left px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold flex items-center gap-1.5 text-[var(--ujr-title)]"
                                  onClick={() => { setActiveActionUserId(null); handleToggleStatus(row.userId, row.status); }}
                                >
                                  <Power className="h-3.5 w-3.5 text-emerald-500" /> Toggle Status
                                </button>
                                <button
                                  type="button"
                                  className="w-full text-left px-3 py-1.5 hover:bg-red-50 dark:hover:bg-red-950/40 text-xs font-semibold flex items-center gap-1.5 text-red-600"
                                  onClick={() => { setActiveActionUserId(null); handleDeleteUser(row.userId, row.userCode, row.fullName); }}
                                >
                                  <Trash2 className="h-3.5 w-3.5" /> Delete User
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={13} className="px-4 py-8 text-center text-[var(--ujr-muted)]">No user journal records found for the selected filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-2 px-4 py-2.5 text-xs font-semibold text-[var(--ujr-title)] sm:flex-row sm:items-center sm:justify-between">
            <div>
              Showing {filteredRows.length ? pageStart + 1 : 0} to {pageEnd} of {filteredRows.length} entries
            </div>
            <div className="flex items-center gap-3">
              <select className="ujr-page-select" value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>
                <option value={10}>10 per page</option>
                <option value={25}>25 per page</option>
                <option value={50}>50 per page</option>
              </select>
              <button className="ujr-page-btn" disabled={safeCurrentPage <= 1} onClick={() => setCurrentPage(1)}>|&lt;</button>
              <button className="ujr-page-btn" disabled={safeCurrentPage <= 1} onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}>&lt;</button>
              <button className="ujr-page-active">{safeCurrentPage} / {pageCount}</button>
              <button className="ujr-page-btn" disabled={safeCurrentPage >= pageCount} onClick={() => setCurrentPage((page) => Math.min(pageCount, page + 1))}>&gt;</button>
              <button className="ujr-page-btn" disabled={safeCurrentPage >= pageCount} onClick={() => setCurrentPage(pageCount)}>&gt;|</button>
            </div>
          </div>
        </section>
      </main>

      {/* View Details Full-page Overlay */}
      {viewUser && (
        <div className="fixed inset-0 z-[100] bg-slate-100 dark:bg-slate-900 overflow-y-auto p-4 md:p-8">
          <div className="max-w-6xl mx-auto">
            <UserLiveReportPanel
              fullName={viewUser.fullName}
              gender="Male"
              accountRegNo={viewUser.userId}
              role={viewUser.role}
              userCode={viewUser.userCode}
              rawPassword={viewUser.rawPassword || "••••••••"}
              status={viewUser.status === "active" ? "Active" : "Inactive"}
              selectedCountryName={viewUser.countryName}
              selectedBranchName={viewUser.branchName}
              selectedBranchCode={viewUser.branchCode || undefined}
              selectedBranchType={viewUser.branchType}
              selectedPermissions={viewUser.permissions}
              activityCounts={viewUser.activityCounts}
              lastActivityDate={viewUser.lastActivity}
              lastActivityAction={viewUser.lastActivityAction}
              onBack={() => setViewUser(null)}
              onExcel={() => {
                const rows = [
                  ["Field", "Value"],
                  ["User Name", viewUser.fullName],
                  ["Role", viewUser.role],
                  ["User ID", viewUser.userId],
                  ["Login ID", viewUser.userCode],
                  ["Country", viewUser.countryName],
                  ["Branch", viewUser.branchName],
                  ["Branch Code", viewUser.branchCode || "-"],
                  ["Status", viewUser.status]
                ];
                const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
                const encodedUri = encodeURI(csvContent);
                const link = document.createElement("a");
                link.setAttribute("href", encodedUri);
                link.setAttribute("download", `user_report_${viewUser.userCode}.csv`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }}
              onEmail={() => {
                const subject = encodeURIComponent("User Profile Report");
                const body = encodeURIComponent(`User Profile Report\nUser Name: ${viewUser.fullName}\nLogin ID: ${viewUser.userCode}`);
                window.location.href = `mailto:?subject=${subject}&body=${body}`;
              }}
              onWhatsApp={() => {
                const text = encodeURIComponent(`User Profile: ${viewUser.fullName} (${viewUser.userCode})`);
                window.open(`https://wa.me/?text=${text}`, "_blank");
              }}
            />
          </div>
        </div>
      )}

    </div>
  );
}

type ToolbarMenuKey = "filters" | "actions" | "fields" | "more";

type TopToolbarProps = {
  openMenu: ToolbarMenuKey | null;
  setOpenMenu: (menu: ToolbarMenuKey | null) => void;
  data: UserJournalReportResponse | null;
  draftQuery: string;
  setDraftQuery: (value: string) => void;
  draftFromDate: string;
  setDraftFromDate: (value: string) => void;
  draftToDate: string;
  setDraftToDate: (value: string) => void;
  draftShareBy: string;
  setDraftShareBy: (value: string) => void;
  draftStatus: string;
  setDraftStatus: (value: string) => void;
  draftRole: string;
  setDraftRole: (value: string) => void;
  draftCountryId: string;
  setDraftCountryId: (value: string) => void;
  draftBranchId: string;
  setDraftBranchId: (value: string) => void;
  applyFilters: () => void;
  resetFilters: () => void;
  editReport: () => void;
  printReport: () => void;
  exportPdf: () => void;
  exportExcel: () => void;
  emailReport: () => void;
  whatsappReport: () => void;
  shareReport: () => void;
  openNewUser: () => void;
  summary: any;
  status: string;
  setStatus: (v: string) => void;
  shareBy: string;
  setShareBy: (v: string) => void;
  adminOnly: boolean;
  setAdminOnly: (v: boolean) => void;
  recentLoginsOnly: boolean;
  setRecentLoginsOnly: (v: boolean) => void;
  query: string;
  countryId: string;
  branchId: string;
  role: string;
  fromDate: string;
  toDate: string;
};

function TopToolbar({
  openMenu,
  setOpenMenu,
  data,
  draftQuery,
  setDraftQuery,
  draftFromDate,
  setDraftFromDate,
  draftToDate,
  setDraftToDate,
  draftShareBy,
  setDraftShareBy,
  draftStatus,
  setDraftStatus,
  draftRole,
  setDraftRole,
  draftCountryId,
  setDraftCountryId,
  draftBranchId,
  setDraftBranchId,
  applyFilters,
  resetFilters,
  editReport,
  printReport,
  exportPdf,
  exportExcel,
  emailReport,
  whatsappReport,
  shareReport,
  openNewUser,
  summary,
  status,
  setStatus,
  shareBy,
  setShareBy,
  adminOnly,
  setAdminOnly,
  recentLoginsOnly,
  setRecentLoginsOnly,
  query,
  countryId,
  branchId,
  role,
  fromDate,
  toDate
}: TopToolbarProps) {
  function toggle(menu: ToolbarMenuKey) {
    setOpenMenu(openMenu === menu ? null : menu);
  }

  const isTotalUsersActive =
    status === "all" &&
    shareBy === "all" &&
    !adminOnly &&
    !recentLoginsOnly &&
    query === "" &&
    countryId === "all" &&
    branchId === "all" &&
    role === "all" &&
    fromDate === "" &&
    toDate === "";

  const handleTotalUsersClick = () => {
    resetFilters();
    setAdminOnly(false);
    setRecentLoginsOnly(false);
  };

  return (
    <div className="ujr-toolbar flex-wrap items-center gap-1.5">
      {/* Interactive Metric Filter Buttons */}
      <button
        type="button"
        className={cn(
          "ujr-metric-btn border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50",
          isTotalUsersActive
            ? "bg-slate-900 border-slate-900 text-white shadow-sm dark:bg-slate-800 dark:border-slate-800"
            : "text-[var(--ujr-title)]"
        )}
        onClick={handleTotalUsersClick}
        title="Show all users"
      >
        <Users className="h-3.5 w-3.5" />
        <span>Total</span>
        <span className={cn(
          "ujr-metric-badge leading-none",
          isTotalUsersActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-700 dark:bg-slate-950 dark:text-slate-300"
        )}>
          {summary.totalUsers}
        </span>
      </button>

      <button
        type="button"
        className={cn(
          "ujr-metric-btn border-emerald-200 dark:border-emerald-900/40 hover:bg-emerald-50 dark:hover:bg-emerald-950/20",
          status === "active"
            ? "bg-emerald-600 border-emerald-600 text-white shadow-sm dark:bg-emerald-750 dark:border-emerald-750"
            : "text-[var(--ujr-title)]"
        )}
        onClick={() => {
          setStatus(status === "active" ? "all" : "active");
          setDraftStatus(status === "active" ? "all" : "active");
        }}
        title="Filter active users"
      >
        <ShieldCheck className="h-3.5 w-3.5" />
        <span>Active</span>
        <span className={cn(
          "ujr-metric-badge leading-none",
          status === "active" ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
        )}>
          {summary.activeUsers}
        </span>
      </button>

      <button
        type="button"
        className={cn(
          "ujr-metric-btn border-blue-200 dark:border-blue-900/40 hover:bg-blue-50 dark:hover:bg-blue-950/20",
          shareBy === "country"
            ? "bg-blue-600 border-blue-600 text-white shadow-sm dark:bg-blue-750 dark:border-blue-750"
            : "text-[var(--ujr-title)]"
        )}
        onClick={() => {
          setShareBy(shareBy === "country" ? "all" : "country");
          setDraftShareBy(shareBy === "country" ? "all" : "country");
        }}
        title="Filter country scope users"
      >
        <Globe2 className="h-3.5 w-3.5" />
        <span>Country Users</span>
        <span className={cn(
          "ujr-metric-badge leading-none",
          shareBy === "country" ? "bg-white/20 text-white" : "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
        )}>
          {summary.countryUsers}
        </span>
      </button>

      <button
        type="button"
        className={cn(
          "ujr-metric-btn border-orange-200 dark:border-orange-900/40 hover:bg-orange-50 dark:hover:bg-orange-950/20",
          shareBy === "branch"
            ? "bg-orange-600 border-orange-600 text-white shadow-sm dark:bg-orange-750 dark:border-orange-750"
            : "text-[var(--ujr-title)]"
        )}
        onClick={() => {
          setShareBy(shareBy === "branch" ? "all" : "branch");
          setDraftShareBy(shareBy === "branch" ? "all" : "branch");
        }}
        title="Filter branch scope users"
      >
        <Building2 className="h-3.5 w-3.5" />
        <span>Branch Users</span>
        <span className={cn(
          "ujr-metric-badge leading-none",
          shareBy === "branch" ? "bg-white/20 text-white" : "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300"
        )}>
          {summary.branchUsers}
        </span>
      </button>

      <button
        type="button"
        className={cn(
          "ujr-metric-btn border-violet-200 dark:border-violet-900/40 hover:bg-violet-50 dark:hover:bg-violet-950/20",
          adminOnly
            ? "bg-violet-600 border-violet-600 text-white shadow-sm dark:bg-violet-750 dark:border-violet-750"
            : "text-[var(--ujr-title)]"
        )}
        onClick={() => setAdminOnly(!adminOnly)}
        title="Filter administrator users"
      >
        <UserCog className="h-3.5 w-3.5" />
        <span>Admins</span>
        <span className={cn(
          "ujr-metric-badge leading-none",
          adminOnly ? "bg-white/20 text-white" : "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300"
        )}>
          {summary.adminUsers}
        </span>
      </button>

      <button
        type="button"
        className={cn(
          "ujr-metric-btn border-cyan-200 dark:border-cyan-900/40 hover:bg-cyan-50 dark:hover:bg-cyan-950/20",
          recentLoginsOnly
            ? "bg-cyan-600 border-cyan-600 text-white shadow-sm dark:bg-cyan-750 dark:border-cyan-750"
            : "text-[var(--ujr-title)]"
        )}
        onClick={() => setRecentLoginsOnly(!recentLoginsOnly)}
        title="Filter users with recent logins"
      >
        <DownloadActionIcon className="h-3.5 w-3.5" />
        <span>Recent Logins</span>
        <span className={cn(
          "ujr-metric-badge leading-none",
          recentLoginsOnly ? "bg-white/20 text-white" : "bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300"
        )}>
          {summary.recentLogins}
        </span>
      </button>

      <div className="border-l border-[var(--ujr-line)] h-6 mx-1 my-auto hidden lg:block"></div>

      <button className="ujr-primary-btn h-9 px-3 text-xs shadow-none border border-transparent" type="button" onClick={openNewUser}>
        <UserPlus className="h-4 w-4" /> New User
      </button>

      <div className="ujr-menu-wrap">
        <ToolbarButton active={openMenu === "filters"} icon={Filter} label="Filters" onClick={() => toggle("filters")} />
        {openMenu === "filters" ? (
          <DropdownPanel widthClass="w-[min(700px,calc(100vw-2rem))]">
            <div className="grid gap-3 lg:grid-cols-2">
              <label className="lg:col-span-2">
                <FieldLabel icon={Search} label="Search" />
                <div className="relative mt-1.5">
                  <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ujr-muted)]" />
                  <input
                    className="ujr-input pr-9"
                    value={draftQuery}
                    onChange={(event) => setDraftQuery(event.target.value)}
                    placeholder="Search user, ID, country, branch, role, permission..."
                  />
                </div>
              </label>

              <div>
                <FieldLabel icon={Calendar} label="Date Range" />
                <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
                  <DateBox label="From Date" value={draftFromDate} onChange={setDraftFromDate} />
                  <DateBox label="To Date" value={draftToDate} onChange={setDraftToDate} />
                </div>
              </div>

              <SelectField
                icon={SlidersHorizontal}
                label="Share By"
                value={draftShareBy}
                onChange={setDraftShareBy}
                options={[
                  { value: "all", label: "All Share By" },
                  { value: "global", label: "Global" },
                  { value: "country", label: "Country" },
                  { value: "branch", label: "Branch" }
                ]}
              />

              <SelectField
                icon={ShieldCheck}
                label="Status"
                value={draftStatus}
                onChange={setDraftStatus}
                options={[
                  { value: "all", label: "All Status" },
                  { value: "active", label: "Active" },
                  { value: "inactive", label: "Inactive" }
                ]}
              />

              <SelectField
                icon={Shield}
                label="Role"
                value={draftRole}
                onChange={setDraftRole}
                options={[{ value: "all", label: "All Roles" }, ...(data?.filters.roles ?? [])]}
              />

              <SelectField
                icon={Globe2}
                label="Country"
                value={draftCountryId}
                onChange={setDraftCountryId}
                options={[{ value: "all", label: "All Countries" }, ...(data?.filters.countries ?? [])]}
              />

              <SelectField
                icon={Building2}
                label="Branch"
                value={draftBranchId}
                onChange={setDraftBranchId}
                options={[{ value: "all", label: "All Branches" }, ...(data?.filters.branches ?? [])]}
              />
            </div>

            <div className="mt-3 flex flex-wrap justify-end gap-2 border-t border-[var(--ujr-line)] pt-3">
              <button className="ujr-secondary-btn px-5" type="button" onClick={resetFilters}>
                <RefreshCw className="h-4 w-4" /> Reset
              </button>
              <button className="ujr-primary-btn px-5" type="button" onClick={applyFilters}>
                <Filter className="h-4 w-4" /> Apply Filters
              </button>
            </div>
          </DropdownPanel>
        ) : null}
      </div>

      <div className="ujr-menu-wrap">
        <ToolbarButton active={openMenu === "actions"} icon={Settings} label="Actions" onClick={() => toggle("actions")} />
        {openMenu === "actions" ? (
          <DropdownPanel widthClass="w-56">
            <MenuActionButton icon={UserPlus} label="New User" onClick={openNewUser} />
            <MenuActionButton icon={Filter} label="Apply Filters" onClick={applyFilters} />
            <MenuActionButton icon={RefreshCw} label="Reset Filters" onClick={resetFilters} />
            <MenuActionButton icon={Eye} label="Focus Table" onClick={() => document.querySelector(".ujr-table-card")?.scrollIntoView({ behavior: "smooth" })} />
          </DropdownPanel>
        ) : null}
      </div>

      <div className="ujr-menu-wrap">
        <ToolbarButton active={openMenu === "fields"} icon={Grid2X2} label="Fields" onClick={() => toggle("fields")} />
        {openMenu === "fields" ? (
          <DropdownPanel widthClass="w-[min(360px,calc(100vw-2rem))]">
            <div className="grid gap-2 sm:grid-cols-2">
              <CheckOption checked icon={Users} label="User ID / Name" />
              <CheckOption checked icon={Shield} label="Role" />
              <CheckOption checked icon={Globe2} label="Country / Branch" />
              <CheckOption checked icon={ShieldCheck} label="Status" />
              <CheckOption checked icon={Building2} label="Branch Type" />
              <CheckOption checked icon={SlidersHorizontal} label="Share By" />
            </div>
          </DropdownPanel>
        ) : null}
      </div>

      <div className="ujr-menu-wrap">
        <ToolbarButton active={openMenu === "more"} icon={MoreVertical} label="More" onClick={() => toggle("more")} />
        {openMenu === "more" ? (
          <DropdownPanel widthClass="w-60" alignRight>
            <MenuActionButton icon={Edit3} label="Edit" onClick={editReport} />
            <MenuActionButton icon={Printer} label="Print" onClick={printReport} />
            <MenuActionButton icon={Printer} label="Export PDF" onClick={exportPdf} />
            <MenuActionButton icon={DownloadActionIcon} label="Export CSV" onClick={exportExcel} />
            <MenuActionButton icon={Mail} label="Email" onClick={emailReport} />
            <MenuActionButton icon={MessageCircle} label="WhatsApp" onClick={whatsappReport} />
            <MenuActionButton icon={Share2} label="Share" onClick={shareReport} />

            <div className="mt-2 border-t border-[var(--ujr-line)] pt-2">
              <div className="mb-1.5 flex items-center gap-2 text-[10px] font-black uppercase tracking-wide text-[var(--ujr-muted)]">
                <Bookmark className="h-4 w-4" /> Saved Filters
              </div>
              <button className="ujr-saved-filter" type="button" onClick={applyFilters}>
                Current draft filters
              </button>
              <button className="ujr-saved-filter" type="button" onClick={resetFilters}>
                Clear all filters
              </button>
            </div>
          </DropdownPanel>
        ) : null}
      </div>
    </div>
  );
}

function ToolbarButton({
  icon: Icon,
  label,
  active,
  onClick
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button className={cn("ujr-toolbar-btn", active ? "ujr-toolbar-btn-active" : "")} type="button" onClick={onClick}>
      <Icon className="h-4 w-4" />
      <span>{label}</span>
      <ChevronDown className="h-4 w-4" />
    </button>
  );
}

function DropdownPanel({
  children,
  widthClass,
  alignRight = false
}: {
  children: React.ReactNode;
  widthClass: string;
  alignRight?: boolean;
}) {
  return (
    <div className={cn("ujr-dropdown-panel", widthClass, alignRight ? "right-0" : "left-0")}>
      {children}
    </div>
  );
}

function SelectField({
  icon,
  label,
  value,
  onChange,
  options
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: SearchSelectOption[];
}) {
  return (
    <label>
      <FieldLabel icon={icon} label={label} />
      <select className="ujr-input mt-2" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((item) => (
          <option key={`${label}-${item.value}`} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function MenuActionButton({
  icon: Icon,
  label,
  onClick
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button className="ujr-menu-action" type="button" onClick={onClick}>
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </button>
  );
}

function UserJournalStyles() {
  return (
    <style>{`
      .ujr-shell {
        --ujr-bg:#eef5ff;
        --ujr-card:rgba(255,255,255,.96);
        --ujr-soft:rgba(255,255,255,.72);
        --ujr-line:#d9e4f5;
        --ujr-title:#0a1028;
        --ujr-text:#17213c;
        --ujr-muted:#64728b;
        --ujr-table-head:#f0f5ff;
        --ujr-row-hover:#f7faff;
        font-family:Inter, ui-sans-serif, system-ui, sans-serif;
      }
      .dark .ujr-shell,
      .ujr-shell[data-theme="dark"] {
        --ujr-bg:#071120;
        --ujr-card:#101b2f;
        --ujr-soft:#0c1728;
        --ujr-line:#24344c;
        --ujr-title:#f8fafc;
        --ujr-text:#dbe7f7;
        --ujr-muted:#90a4c2;
        --ujr-table-head:#152238;
        --ujr-row-hover:#182842;
      }
      .ujr-filter-card,
      .ujr-table-card {
        background:var(--ujr-card);
        border-color:var(--ujr-line);
      }
      .ujr-input {
        height:34px;
        width:100%;
        border-radius:8px;
        border:1px solid var(--ujr-line);
        background:var(--ujr-card);
        padding:0 12px;
        color:var(--ujr-title);
        font-size:11px;
        font-weight:650;
        outline:none;
        box-shadow:0 2px 10px rgba(15,23,42,.03);
      }
      .ujr-input:focus {
        border-color:#245cff;
        box-shadow:0 0 0 2px rgba(36,92,255,.16);
      }
      .ujr-primary-btn,
      .ujr-secondary-btn {
        display:flex;
        height:34px;
        align-items:center;
        justify-content:center;
        gap:7px;
        border-radius:8px;
        font-weight:900;
        box-shadow:0 8px 18px rgba(37,99,235,.2);
      }
      .ujr-primary-btn {
        background:#1f5eff;
        color:#fff;
      }
      .ujr-secondary-btn {
        border:1px solid var(--ujr-line);
        background:var(--ujr-card);
        color:var(--ujr-title);
        box-shadow:0 6px 14px rgba(15,23,42,.06);
      }
      .ujr-icon-btn,
      .ujr-page-btn,
      .ujr-page-active,
      .ujr-page-select {
        border:1px solid var(--ujr-line);
        background:var(--ujr-card);
        color:var(--ujr-title);
      }
      .ujr-icon-btn {
        display:grid;
        height:30px;
        width:34px;
        place-items:center;
        border-radius:7px;
        color:#1455ff;
      }
      .ujr-icon-btn-edit {
        color:#f97316;
        border-color:#fed7aa;
      }
      .ujr-icon-btn-edit:hover {
        background:#fff7ed;
        color:#ea580c;
        border-color:#f97316;
      }
      .ujr-page-btn,
      .ujr-page-active {
        height:34px;
        min-width:34px;
        border-radius:8px;
        font-weight:850;
      }
      .ujr-page-active {
        background:#1f5eff;
        color:white;
        border-color:#1f5eff;
      }
      .ujr-page-select {
        height:34px;
        border-radius:8px;
        padding:0 34px 0 10px;
        font-weight:750;
      }
      .ujr-toolbar {
        position:relative;
        z-index:20;
        display:flex;
        flex-wrap:wrap;
        justify-content:flex-end;
        gap:7px;
      }
      .ujr-menu-wrap {
        position:relative;
      }
      .ujr-toolbar-btn {
        display:flex;
        height:34px;
        align-items:center;
        gap:6px;
        border-radius:9px;
        border:1px solid var(--ujr-line);
        background:var(--ujr-card);
        padding:0 10px;
        color:var(--ujr-title);
        font-size:11px;
        font-weight:900;
        box-shadow:0 6px 16px rgba(15,23,42,.06);
      }
      .ujr-toolbar-btn:hover,
      .ujr-toolbar-btn-active {
        border-color:#245cff;
        background:rgba(36,92,255,.08);
        color:#1455ff;
      }
      .ujr-dropdown-panel {
        position:absolute;
        top:calc(100% + 8px);
        z-index:50;
        border:1px solid var(--ujr-line);
        border-radius:12px;
        background:var(--ujr-card);
        padding:12px;
        color:var(--ujr-title);
        box-shadow:0 18px 44px rgba(15,23,42,.16);
      }
      .ujr-menu-action {
        display:flex;
        width:100%;
        align-items:center;
        gap:8px;
        border-radius:8px;
        padding:8px 9px;
        color:var(--ujr-title);
        font-size:12px;
        font-weight:850;
        text-align:left;
      }
      .ujr-menu-action:hover,
      .ujr-saved-filter:hover {
        background:rgba(36,92,255,.08);
        color:#1455ff;
      }
      .ujr-metric-btn {
        display:flex;
        height:34px;
        align-items:center;
        gap:6.5px;
        border-radius:9px;
        border:1px solid var(--ujr-line);
        background:var(--ujr-card);
        padding:0 10.5px;
        color:var(--ujr-title);
        font-size:11px;
        font-weight:900;
        box-shadow:0 4px 12px rgba(15,23,42,.03);
        transition:all 0.15s ease;
      }
      .ujr-metric-btn:hover {
        border-color:#245cff;
        background:rgba(36,92,255,.03);
      }
      .ujr-metric-badge {
        padding:2px 5.5px;
        border-radius:5px;
        font-family:monospace;
        font-size:9.5px;
        font-weight:800;
        line-height:1;
      }
      .ujr-saved-filter {
        display:block;
        width:100%;
        border-radius:8px;
        padding:7px 8px;
        text-align:left;
        font-size:11px;
        font-weight:800;
        color:var(--ujr-title);
      }
      
      /* Upgraded Toggle Switch */
      .ujr-toggle-switch {
        position:relative;
        display:inline-flex;
        height:18px;
        width:32px;
        align-items:center;
        border-radius:9999px;
        cursor:pointer;
        background:#cbd5e1;
        border:none;
        padding:0;
        transition:background-color 0.2s;
      }
      .ujr-toggle-switch-active {
        background:#10b981;
      }
      .ujr-toggle-thumb {
        height:14px;
        width:14px;
        border-radius:9999px;
        background:white;
        transition:transform 0.2s;
        transform:translateX(2px);
      }
      .ujr-toggle-switch-active .ujr-toggle-thumb {
        transform:translateX(16px);
      }
      .ujr-toggle-switch:disabled {
        opacity:0.6;
        cursor:not-allowed;
      }

      /* Eye password icon container */
      .ujr-pw-toggle-btn {
        background:transparent;
        border:none;
        cursor:pointer;
        outline:none;
      }

      /* Dropdown Menu actions box styling */
      .ujr-action-dropdown {
        border-radius:8px;
        background:var(--ujr-card);
        border:1px solid var(--ujr-line);
        box-shadow:0 10px 25px rgba(0,0,0,0.15);
      }

      /* Session User Card styling */
      .ujr-session-card {
        border-radius:12px;
        box-shadow:0 4px 20px rgba(15,23,42,.03);
      }

      /* Modal Overlay Box styles */
      .ujr-modal {
        box-shadow:0 20px 50px rgba(0,0,0,0.3);
      }

      @media print {
        .ujr-shell { margin:0 !important; }
        .ujr-toolbar,
        .ujr-primary-btn,
        .ujr-secondary-btn,
        .ujr-icon-btn,
        .ujr-action-dropdown,
        .ujr-toggle-switch { display:none !important; }
      }
    `}</style>
  );
}

function FieldLabel({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs font-black text-[var(--ujr-title)]">
      <Icon className="h-3.5 w-3.5" />
      {label}
    </div>
  );
}

function DateBox({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label>
      <div className="mb-1.5 text-xs font-black text-[var(--ujr-title)]">{label}</div>
      <input className="ujr-input" type="date" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function CheckOption({ icon: Icon, label, checked }: { icon: React.ComponentType<{ className?: string }>; label: string; checked: boolean }) {
  return (
    <label className="flex items-center gap-2 text-xs font-black text-[var(--ujr-title)]">
      <span className={cn("grid h-[18px] w-[18px] place-items-center rounded-[4px] text-[11px]", checked ? "bg-[#1f5eff] text-white" : "border border-[var(--ujr-line)]")}>
        {checked ? "✓" : ""}
      </span>
      <Icon className="h-4 w-4 text-[var(--ujr-title)]" />
      {label}
    </label>
  );
}

function formatRoleName(role: string) {
  if (!role) return "-";
  return role
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function JournalMetric({
  icon: Icon,
  label,
  value,
  tone,
  percentage
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  tone: "violet" | "green" | "blue" | "orange" | "cyan";
  percentage?: number;
}) {
  const tones = {
    violet: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-200",
    green: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200",
    blue: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-200",
    orange: "bg-orange-100 text-orange-600 dark:bg-orange-950 dark:text-orange-200",
    cyan: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-200"
  };
  return (
    <div className="flex items-center gap-3 rounded-[10px] border border-[var(--ujr-line)] bg-[var(--ujr-card)] p-2.5 shadow-sm hover:shadow hover:scale-[1.005] transition-all duration-150">
      <div className={cn("grid h-8 w-8 place-items-center rounded-lg shrink-0", tones[tone])}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[9px] font-black uppercase tracking-wider text-[var(--ujr-muted)] truncate">{label}</div>
        <div className="flex items-baseline gap-1.5 mt-0.5">
          <span className="text-base font-black leading-none text-[var(--ujr-title)]">{value.toLocaleString()}</span>
          {percentage !== undefined && (
            <span className="text-[9px] font-bold text-emerald-600">({percentage}%)</span>
          )}
        </div>
      </div>
    </div>
  );
}

function AdminInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--ujr-line)] bg-[var(--ujr-soft)] px-2.5 py-2">
      <div className="text-[9px] font-black uppercase tracking-wide text-[var(--ujr-muted)]">{label}</div>
      <div className="mt-0.5 truncate text-[12px] font-black text-[var(--ujr-title)]" title={value}>{value || "-"}</div>
    </div>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "U";
}

function StatusPill({ status }: { status: string }) {
  const tone = status === "active" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-50 text-slate-600 border-slate-200";
  return <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold capitalize", tone)}>{status}</span>;
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-background px-3 py-2">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-semibold text-foreground truncate" title={value}>{value}</div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm text-foreground">{value || "-"}</div>
    </div>
  );
}

function ActivityCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-muted/20 px-3 py-2 text-center">
      <div className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-base font-black text-foreground">{value.toLocaleString()}</div>
    </div>
  );
}
