"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  Users,
  Search,
  RefreshCw,
  Building2,
  Globe2,
  GitBranch,
  ShieldCheck,
  Clock,
  Activity,
  CheckCircle2,
  Filter,
  Eye,
  ExternalLink,
  ChevronRight,
  ArrowLeft,
  Printer,
  Sparkles,
  LayoutGrid,
  List,
  UserCheck,
  AlertCircle,
  Radio,
  Briefcase,
  Ship,
  Boxes,
  Lock,
  Layers,
  MapPin
} from "lucide-react";

import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { useBranchUserContext } from "@/lib/hooks/use-branch-user-context";
import { UserLiveReportPanel } from "./user-live-report-panel";

export interface LiveUserRecord {
  id: string;
  userId: string;
  userCode: string;
  userName: string;
  role: string;
  roleTitle: string;
  countryId: string | null;
  countryName: string;
  branchId: string | null;
  branchCode: string;
  branchName: string;
  cityBranchName: string | null;
  date: string;
  time: string;
  userType: "Business" | "Shipping Line" | "Clearing Agent";
  currentWork: string;
  lastAction: string | null;
  lastActiveAgo: string;
  status: "Online" | "Idle" | "Offline";
}

export function LiveUsersMonitoringView() {
  const activeLang = useActiveLanguage();
  const lang = (activeLang || "en") as SupportedLanguage;
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);

  const { context: userContext } = useBranchUserContext();

  const [users, setUsers] = useState<LiveUserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");

  // Filtering states
  const [searchQuery, setSearchQuery] = useState("");
  const [countryFilter, setCountryFilter] = useState("all");
  const [branchFilter, setBranchFilter] = useState("all");
  const [domainFilter, setDomainFilter] = useState<"all" | "Business" | "Shipping Line" | "Clearing Agent">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "Online" | "Idle" | "Offline">("all");
  const [roleFilter, setRoleFilter] = useState("all");

  // Live report modal
  const [inspectUser, setInspectUser] = useState<LiveUserRecord | null>(null);

  const tt = (key: string, fallback: string) => t(lang, key as never, fallback);

  // Role hierarchy
  const isSuperAdmin = Boolean(
    userContext?.isSuperAdmin ||
    userContext?.level === "global" ||
    userContext?.role === "super_admin"
  );
  const isCountryAdmin = !isSuperAdmin && (
    userContext?.level === "country" ||
    Boolean(userContext?.role?.includes("country"))
  );
  const isBranchUser = !isSuperAdmin && !isCountryAdmin;

  // Fetch live users
  const fetchLiveUsers = useCallback(async (isSilent = false) => {
    if (!isSilent) setRefreshing(true);
    try {
      const params = new URLSearchParams();
      if (countryFilter !== "all") params.set("countryId", countryFilter);
      if (branchFilter !== "all") params.set("branchId", branchFilter);
      if (roleFilter !== "all") params.set("role", roleFilter);
      if (domainFilter !== "all") params.set("operation", domainFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (searchQuery.trim()) params.set("search", searchQuery.trim());

      const res = await fetch(`/api/erp/users/live-presence?${params.toString()}`, { cache: "no-store" });
      const json = await res.json();
      if (json.ok && Array.isArray(json.data)) {
        setUsers(json.data);
      }
    } catch (err) {
      console.error("Failed to load live users presence:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [countryFilter, branchFilter, roleFilter, domainFilter, statusFilter, searchQuery]);

  useEffect(() => {
    fetchLiveUsers();
  }, [fetchLiveUsers]);

  // Auto-refresh interval (every 15 seconds)
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchLiveUsers(true);
    }, 15000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchLiveUsers]);

  // Countries and branches extracted for filter controls
  const availableCountries = useMemo(() => {
    const map = new Map<string, string>();
    users.forEach((u) => {
      if (u.countryId && u.countryName) {
        map.set(u.countryId, u.countryName);
      }
    });
    if (userContext?.country && !Array.from(map.values()).includes(userContext.country)) {
      map.set("session_country", userContext.country);
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [users, userContext]);

  const availableBranches = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    users.forEach((u) => {
      if (u.branchId && u.branchName) {
        map.set(u.branchId, { id: u.branchId, name: `${u.branchCode ? `[${u.branchCode}] ` : ""}${u.branchName}` });
      }
    });
    return Array.from(map.values());
  }, [users]);

  // KPI Metrics
  const stats = useMemo(() => {
    return {
      total: users.length,
      online: users.filter((u) => u.status === "Online").length,
      idle: users.filter((u) => u.status === "Idle").length,
      offline: users.filter((u) => u.status === "Offline").length,
      business: users.filter((u) => u.userType === "Business").length,
      shipping: users.filter((u) => u.userType === "Shipping Line").length,
      clearing: users.filter((u) => u.userType === "Clearing Agent").length
    };
  }, [users]);

  // Filtered users for display
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (countryFilter !== "all" && u.countryId !== countryFilter) return false;
      if (branchFilter !== "all" && u.branchId !== branchFilter) return false;
      if (domainFilter !== "all" && u.userType !== domainFilter) return false;
      if (statusFilter !== "all" && u.status !== statusFilter) return false;
      if (roleFilter !== "all" && (u.role || "").toLowerCase() !== roleFilter.toLowerCase()) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const haystack = [
          u.userId,
          u.userCode,
          u.userName,
          u.roleTitle,
          u.countryName,
          u.branchName,
          u.branchCode,
          u.currentWork,
          u.lastAction
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [users, countryFilter, branchFilter, domainFilter, statusFilter, roleFilter, searchQuery]);

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="min-h-screen bg-slate-50/50 dark:bg-slate-950 p-4 md:p-6 lg:p-8 space-y-6">
      {/* Top Header & Breadcrumbs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
            <Link href="/dashboard" className="hover:text-blue-600 transition">
              {tt("nav_dashboard", "Dashboard")}
            </Link>
            <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
            <Link href="/dashboard/users" className="hover:text-blue-600 transition">
              {tt("nav_users", "Users & Logins")}
            </Link>
            <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
            <span className="text-slate-900 dark:text-white font-bold">
              {tt("nav_live_users", "Live Users / Current Work")}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-500/20">
                <Radio className="h-5 w-5 animate-pulse" />
              </span>
              <span>{tt("live_users_title", "LIVE USERS / CURRENT WORK")}</span>
            </h1>

            {/* Scope Badge */}
            {isSuperAdmin ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800 text-xs font-black">
                <Globe2 className="h-3.5 w-3.5 text-blue-500" />
                <span>{tt("scope_super_admin_world", "Super Admin Scope • Global Worldwide Visibility")}</span>
              </span>
            ) : isCountryAdmin ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800 text-xs font-black">
                <Building2 className="h-3.5 w-3.5 text-amber-500" />
                <span>{tt("scope_country_admin", "Country Scope")}: {userContext?.country || "Assigned Country"}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 text-xs font-black">
                <GitBranch className="h-3.5 w-3.5 text-emerald-500" />
                <span>{tt("scope_branch_user", "Branch Scope")}: {userContext?.branchName || "My Branch"}</span>
              </span>
            )}
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {tt(
              "live_users_subtitle",
              "Real-time employee presence, active operational tasks, login timestamps, and branch tracking."
            )}
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Auto Refresh Toggle */}
          <button
            type="button"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition border cursor-pointer ${
              autoRefresh
                ? "bg-emerald-50 border-emerald-300 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                : "bg-white border-slate-200 text-slate-500 dark:bg-slate-900 dark:border-slate-800"
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${autoRefresh ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`} />
            <span>{autoRefresh ? tt("auto_refresh_on", "Live (15s)") : tt("auto_refresh_paused", "Paused")}</span>
          </button>

          {/* Manual Refresh */}
          <button
            type="button"
            onClick={() => fetchLiveUsers()}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 shadow-xs transition cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin text-blue-500" : ""}`} />
            <span>{tt("refresh", "Refresh")}</span>
          </button>

          {/* Print View */}
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 transition cursor-pointer"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>{tt("print", "Print")}</span>
          </button>

          {/* Link to Users Management Panel */}
          <Link
            href="/dashboard/users"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 shadow-xs transition"
          >
            <Users className="h-3.5 w-3.5" />
            <span>{tt("all_users_registry", "Users Registry")}</span>
          </Link>

          {/* Register New User Button */}
          <Link
            href="/dashboard/users/new"
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-blue-600/20 hover:bg-blue-700 transition"
          >
            <span>+ {tt("register_new_user", "Register User")}</span>
          </Link>
        </div>
      </div>

      {/* KPI Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900/90 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
              {tt("total_staff", "Total Personnel")}
            </span>
            <Users className="h-4 w-4 text-blue-500" />
          </div>
          <div className="mt-1.5 text-2xl font-black text-slate-900 dark:text-white">
            {stats.total}
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">{tt("registered_roster", "Scoped workforce")}</p>
        </div>

        <div className="rounded-2xl border border-emerald-200/80 bg-white p-3.5 dark:border-emerald-900/50 dark:bg-slate-900/90 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              {tt("online_now", "Online Now")}
            </span>
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-ping" />
          </div>
          <div className="mt-1.5 text-2xl font-black text-emerald-600 dark:text-emerald-400">
            {stats.online}
          </div>
          <p className="text-[10px] text-emerald-600/80 mt-0.5">{tt("currently_active", "Actively working")}</p>
        </div>

        <div className="rounded-2xl border border-amber-200/80 bg-white p-3.5 dark:border-amber-900/50 dark:bg-slate-900/90 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              {tt("idle_users", "Idle / Away")}
            </span>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-1.5 text-2xl font-black text-amber-600 dark:text-amber-400">
            {stats.idle}
          </div>
          <p className="text-[10px] text-amber-600/80 mt-0.5">{tt("session_standby", "Standby / Session on")}</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900/90 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-indigo-500">
              {tt("business_staff", "Business Desk")}
            </span>
            <Briefcase className="h-4 w-4 text-indigo-500" />
          </div>
          <div className="mt-1.5 text-2xl font-black text-indigo-600 dark:text-indigo-400">
            {stats.business}
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">{tt("commercial_roles", "Trading & Accounts")}</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900/90 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-cyan-500">
              {tt("shipping_staff", "Shipping Lines")}
            </span>
            <Ship className="h-4 w-4 text-cyan-500" />
          </div>
          <div className="mt-1.5 text-2xl font-black text-cyan-600 dark:text-cyan-400">
            {stats.shipping}
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">{tt("container_freight", "Containers & Vessels")}</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900/90 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-purple-500">
              {tt("clearing_staff", "Clearing Agents")}
            </span>
            <Boxes className="h-4 w-4 text-purple-500" />
          </div>
          <div className="mt-1.5 text-2xl font-black text-purple-600 dark:text-purple-400">
            {stats.clearing}
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">{tt("customs_transport", "Customs & Haulage")}</p>
        </div>
      </div>

      {/* Main Monitoring Board */}
      <div className="rounded-2xl border border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900/90 shadow-sm overflow-hidden">
        {/* Controls & Filter Bar */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 space-y-3.5 bg-slate-50/50 dark:bg-slate-850/50">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 rtl:left-auto rtl:right-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder={tt("search_live_users_ph", "Search by user ID, name, branch, current work...")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 rtl:pl-3 rtl:pr-9 text-xs text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            {/* Hierarchical Scope Selectors */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {/* Super Admin Country Selector */}
              {isSuperAdmin && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-slate-500">{tt("country_lbl", "Country")}:</span>
                  <select
                    value={countryFilter}
                    onChange={(e) => {
                      setCountryFilter(e.target.value);
                      setBranchFilter("all");
                    }}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
                  >
                    <option value="all">{tt("all_countries_opt", "All Countries (Global)")}</option>
                    {availableCountries.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Country Admin Country Display */}
              {isCountryAdmin && (
                <div className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  <span>{tt("country", "Country")}: {userContext?.country || "Assigned Country"}</span>
                </div>
              )}

              {/* Branch Selector (Super Admin or Country Admin) */}
              {(isSuperAdmin || isCountryAdmin) && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-slate-500">{tt("branch_lbl", "Branch")}:</span>
                  <select
                    value={branchFilter}
                    onChange={(e) => setBranchFilter(e.target.value)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer max-w-[200px] truncate"
                  >
                    <option value="all">{tt("all_branches_opt", "All Branches")}</option>
                    {availableBranches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Branch Admin Display */}
              {isBranchUser && (
                <div className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  <span>{tt("branch", "Branch")}: {userContext?.branchName || "My Branch"}</span>
                </div>
              )}

              {/* View Mode Toggle */}
              <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 p-0.5">
                <button
                  type="button"
                  onClick={() => setViewMode("table")}
                  className={`p-1.5 rounded-lg text-xs transition cursor-pointer ${
                    viewMode === "table" ? "bg-slate-100 dark:bg-slate-700 text-blue-600 dark:text-blue-400" : "text-slate-400"
                  }`}
                  title={tt("table_view", "Table view")}
                >
                  <List className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("cards")}
                  className={`p-1.5 rounded-lg text-xs transition cursor-pointer ${
                    viewMode === "cards" ? "bg-slate-100 dark:bg-slate-700 text-blue-600 dark:text-blue-400" : "text-slate-400"
                  }`}
                  title={tt("cards_view", "Cards view")}
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Quick Filter Chips (Domain & Status) */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200/60 dark:border-slate-800/60 text-xs">
            {/* Domain Tabs */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-black uppercase text-slate-400 mr-1">{tt("domain", "Domain")}:</span>
              {(["all", "Business", "Shipping Line", "Clearing Agent"] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDomainFilter(d)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                    domainFilter === d
                      ? "bg-blue-600 text-white shadow-2xs"
                      : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700"
                  }`}
                >
                  {d === "all" ? tt("all_domains", "All Operations") : d}
                </button>
              ))}
            </div>

            {/* Status Tabs */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-black uppercase text-slate-400 mr-1">{tt("status", "Status")}:</span>
              {(["all", "Online", "Idle", "Offline"] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer ${
                    statusFilter === st
                      ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-2xs"
                      : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700"
                  }`}
                >
                  {st === "Online" && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
                  {st === "Idle" && <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />}
                  {st === "Offline" && <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />}
                  <span>{st === "all" ? tt("all_statuses", "All Statuses") : st}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content Body: Table or Cards */}
        {loading ? (
          <div className="py-20 text-center text-slate-400">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-3 text-blue-500" />
            <p className="font-bold text-sm text-slate-700 dark:text-slate-300">
              {tt("loading_live_users", "Loading live personnel & current work...")}
            </p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <Users className="h-10 w-10 mx-auto mb-2 text-slate-300 dark:text-slate-700" />
            <p className="font-bold text-sm text-slate-700 dark:text-slate-300">
              {tt("no_live_users_found", "No active users found matching your filters")}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {tt("adjust_filters_hint", "Try selecting all countries or resetting your search query.")}
            </p>
          </div>
        ) : viewMode === "table" ? (
          /* ================= PROFESSIONAL HIGH-CONTRAST TABLE ================= */
          <div className="overflow-x-auto">
            <table className="w-full text-left rtl:text-right text-xs">
              <thead className="bg-[#0b1626] text-white border-b border-slate-800 text-[10.5px] font-black uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4 whitespace-nowrap">{tt("th_user_id", "USER ID")}</th>
                  <th className="py-3 px-4 whitespace-nowrap">{tt("th_user_name", "USER NAME & ROLE")}</th>
                  <th className="py-3 px-4 whitespace-nowrap">{tt("th_location_scope", "COUNTRY & BRANCH")}</th>
                  <th className="py-3 px-4 whitespace-nowrap">{tt("th_user_type", "USER TYPE")}</th>
                  <th className="py-3 px-4 whitespace-nowrap">{tt("th_current_work", "CURRENT WORK / ACTIVE MODULE")}</th>
                  <th className="py-3 px-3 whitespace-nowrap">{tt("th_date", "DATE")}</th>
                  <th className="py-3 px-3 whitespace-nowrap">{tt("th_time", "TIME")}</th>
                  <th className="py-3 px-3 text-center whitespace-nowrap">{tt("th_status", "STATUS")}</th>
                  <th className="py-3 px-4 text-center whitespace-nowrap">{tt("th_actions", "ACTIONS")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                {filteredUsers.map((user) => {
                  const isOnline = user.status === "Online";
                  const isIdle = user.status === "Idle";

                  return (
                    <tr
                      key={user.id}
                      className="hover:bg-blue-50/40 dark:hover:bg-slate-800/40 transition-colors group"
                    >
                      {/* USER ID */}
                      <td className="py-3 px-4 font-mono font-bold text-cyan-600 dark:text-cyan-400 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded bg-cyan-50 dark:bg-cyan-950/60 border border-cyan-200 dark:border-cyan-900">
                          {user.userId}
                        </span>
                      </td>

                      {/* USER NAME & ROLE */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <span>{user.userName}</span>
                          {user.id === userContext?.userId && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 font-bold">
                              You
                            </span>
                          )}
                        </div>
                        <span className="text-[10.5px] text-slate-500 dark:text-slate-400 block mt-0.5">
                          {user.roleTitle}
                        </span>
                      </td>

                      {/* COUNTRY & BRANCH */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
                          <MapPin className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                          <span>{user.countryName}</span>
                          <span className="text-slate-400">•</span>
                          <span className="font-mono text-[11px] text-blue-600 dark:text-blue-400">
                            {user.branchCode}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 block mt-0.5 truncate max-w-[200px]">
                          {user.branchName}
                        </span>
                      </td>

                      {/* USER TYPE */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10.5px] font-bold border ${
                            user.userType === "Shipping Line"
                              ? "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-800"
                              : user.userType === "Clearing Agent"
                              ? "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800"
                              : "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800"
                          }`}
                        >
                          {user.userType}
                        </span>
                      </td>

                      {/* CURRENT WORK */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                          <Activity className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                          <span className="truncate max-w-[280px]">{user.currentWork}</span>
                        </div>
                        {user.lastAction ? (
                          <span className="text-[10px] text-slate-400 block mt-0.5 truncate max-w-[280px]">
                            {user.lastAction}
                          </span>
                        ) : null}
                      </td>

                      {/* DATE */}
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {user.date}
                      </td>

                      {/* TIME */}
                      <td className="py-3 px-3 font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        <div>{user.time}</div>
                        <span className="text-[9.5px] text-slate-400 block">{user.lastActiveAgo}</span>
                      </td>

                      {/* STATUS */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black border ${
                            isOnline
                              ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                              : isIdle
                              ? "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
                              : "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              isOnline ? "bg-emerald-500 animate-pulse" : isIdle ? "bg-amber-500" : "bg-slate-400"
                            }`}
                          />
                          <span>{user.status}</span>
                        </span>
                      </td>

                      {/* ACTIONS */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setInspectUser(user)}
                            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 text-slate-600 dark:text-slate-300 transition cursor-pointer"
                            title={tt("view_user_live_report", "View User Live Report & Activity")}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <Link
                            href={`/dashboard/users/edit/${user.id}`}
                            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
                            title={tt("edit_user_permissions", "Edit User Roles & Permissions")}
                          >
                            <ShieldCheck className="h-3.5 w-3.5" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* ================= CARDS / GRID VIEW ================= */
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredUsers.map((user) => {
              const isOnline = user.status === "Online";
              const isIdle = user.status === "Idle";

              return (
                <div
                  key={user.id}
                  className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-850 p-4 space-y-3 shadow-2xs hover:shadow-md transition"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="h-9 w-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
                        {user.userName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                          <span>{user.userName}</span>
                          <span className="font-mono text-[10px] text-cyan-600 dark:text-cyan-400">
                            [{user.userId}]
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 block">{user.roleTitle}</span>
                      </div>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black border ${
                        isOnline
                          ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300"
                          : isIdle
                          ? "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300"
                          : "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400"
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${isOnline ? "bg-emerald-500 animate-pulse" : isIdle ? "bg-amber-500" : "bg-slate-400"}`} />
                      <span>{user.status}</span>
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">{tt("location", "Location")}:</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {user.countryName} • {user.branchCode}
                      </span>
                    </div>

                    <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-150 dark:border-slate-750">
                      <span className="text-[10px] font-black uppercase text-slate-400 block">{tt("current_work", "CURRENT WORK")}</span>
                      <span className="font-bold text-blue-600 dark:text-blue-400 mt-0.5 block truncate">
                        {user.currentWork}
                      </span>
                      {user.lastAction && (
                        <span className="text-[9.5px] text-slate-500 block truncate mt-0.5">
                          {user.lastAction}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-[10.5px] text-slate-500 pt-1">
                      <span>{user.date} at {user.time}</span>
                      <span className="italic">{user.lastActiveAgo}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      {user.userType}
                    </span>
                    <button
                      type="button"
                      onClick={() => setInspectUser(user)}
                      className="text-xs font-bold text-blue-600 hover:text-blue-800 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <span>{tt("inspect_activity", "Inspect Activity")}</span>
                      <ChevronRight className="h-3 w-3 rtl:rotate-180" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* User Live Report Modal */}
      {inspectUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300">
                  <UserCheck className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-wider">
                    {tt("user_activity_and_presence", "User Live Presence & Activity Dossier")}
                  </h3>
                  <span className="text-xs text-slate-400">
                    {inspectUser.userName} • {inspectUser.userId}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInspectUser(null)}
                className="h-8 w-8 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-600 flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            <UserLiveReportPanel
              fullName={inspectUser.userName}
              gender="Male"
              accountRegNo={inspectUser.userId}
              role={inspectUser.roleTitle}
              userCode={inspectUser.userCode}
              status={inspectUser.status}
              selectedCountryName={inspectUser.countryName}
              selectedBranchName={inspectUser.branchName}
              selectedBranchCode={inspectUser.branchCode}
              selectedBranchType={inspectUser.userType}
              lastActivityDate={`${inspectUser.date} ${inspectUser.time}`}
              lastActivityAction={inspectUser.currentWork}
              onBack={() => setInspectUser(null)}
              hideHeader={true}
            />
          </div>
        </div>
      )}
    </div>
  );
}
