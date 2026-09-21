"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Building2,
  Eye,
  Plus,
  RefreshCw,
  Search,
  Printer,
  FileDown,
  FileSpreadsheet,
  Warehouse as WarehouseIcon,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Pencil,
  Trash2,
  Calendar,
  Globe,
  SlidersHorizontal,
  Layers,
  UserCheck
} from "lucide-react";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";
import { apiGet } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SimpleModal } from "@/components/ui/simple-modal";
import { UniversalReportModal } from "@/components/ui/universal-report-modal";
import { WarehouseForm } from "@/features/warehouses/components/warehouse-form";
import {
  deleteWarehouse,
  fetchWarehouses,
  type WarehouseRecord
} from "@/features/warehouses/warehouse-api";
import {
  listAreas,
  listCities,
  listCountries,
  listStates,
  type LocationArea,
  type LocationCity,
  type LocationCountry,
  type LocationState
} from "@/features/locations/location-api";

type WarehouseMode = "create" | "edit";

type SessionInfo = {
  user?: { fullName?: string | null; email?: string | null };
  scopes?: {
    isSuperAdmin?: boolean;
    summary?: { countryName?: string | null; branchDisplayName?: string | null; scopeLabel?: string | null };
  };
};

function parseContactSummary(value: string | null) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item) => item?.value) : [];
  } catch {
    return [];
  }
}

export function WarehouseManagement() {
  const lang = useActiveLanguage();
  const tt = (key: string, fallback: string) => t(lang, key as never, fallback);
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang || "en");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [warehouses, setWarehouses] = useState<WarehouseRecord[]>([]);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [countryOptions, setCountryOptions] = useState<LocationCountry[]>([]);

  // Filter toolbar states
  const [search, setSearch] = useState("");
  const [countryFilter, setCountryFilter] = useState("all");
  const [branchFilter, setBranchFilter] = useState("all");
  const [cityFilter, setCityFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<WarehouseMode>("create");
  const [showReport, setShowReport] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<WarehouseRecord | null>(null);
  const [viewWarehouse, setViewWarehouse] = useState<WarehouseRecord | null>(null);

  const loadWarehouses = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const rows = await fetchWarehouses(lang);
      setWarehouses(rows);
    } catch (err: any) {
      setError(err?.message ?? tt("wh.failed_load", "Failed to load warehouses."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadWarehouses();
  }, [lang]);

  useEffect(() => {
    apiGet<SessionInfo>("/api/erp/auth/session").then(setSession).catch(() => null);
    listCountries({ all: true }).then(setCountryOptions).catch(() => setCountryOptions([]));
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, countryFilter, branchFilter, cityFilter, typeFilter, ownerFilter, statusFilter, dateFrom, dateTo]);

  const handleDelete = async (warehouse: WarehouseRecord) => {
    if (!window.confirm(tt("wh.delete_confirm", 'Delete warehouse "{name}"?').replace("{name}", warehouse.warehouse_name))) return;
    try {
      await deleteWarehouse(warehouse.id);
      setMessage(tt("wh.deleted_success", 'Deleted warehouse "{name}".').replace("{name}", warehouse.warehouse_name));
      await loadWarehouses();
    } catch (err: any) {
      setError(err?.message ?? tt("wh.failed_delete", "Failed to delete warehouse."));
    }
  };

  const closeFormModal = () => {
    setEditingWarehouse(null);
  };

  // Real records only — normalized for display, no synthetic fallback.
  const normalizedList = useMemo(() => {
    return warehouses.map((w: any) => ({
      id: w.id,
      warehouse_code: w.warehouse_code || "—",
      warehouse_name: w.warehouse_name || "—",
      owner_name: w.owner_name || "—",
      country_id: w.country_id ?? null,
      country_name: w.country_name || "—",
      branch_name: w.branch_name || "—",
      city_name: w.city_name || "—",
      warehouse_type: w.warehouse_type || "—",
      capacity_mt: Number(w.total_capacity_tons) || 0,
      is_cold_storage: !!w.is_cold_storage,
      status: w.status || "Active",
      created_at: w.created_at || null,
      raw: w
    }));
  }, [warehouses]);

  const branchOptions = useMemo(() => Array.from(new Set(normalizedList.map((w) => w.branch_name).filter((v) => v && v !== "—"))).sort(), [normalizedList]);
  const typeOptions = useMemo(() => Array.from(new Set(normalizedList.map((w) => w.warehouse_type).filter((v) => v && v !== "—"))).sort(), [normalizedList]);
  const ownerOptions = useMemo(() => Array.from(new Set(normalizedList.map((w) => w.owner_name).filter((v) => v && v !== "—"))).sort(), [normalizedList]);

  const displayList = useMemo(() => {
    return normalizedList.filter((w) => {
      if (search) {
        const q = search.toLowerCase();
        const m = w.warehouse_name.toLowerCase().includes(q) ||
                  w.warehouse_code.toLowerCase().includes(q) ||
                  w.owner_name.toLowerCase().includes(q);
        if (!m) return false;
      }
      if (countryFilter !== "all" && w.country_id !== countryFilter) return false;
      if (branchFilter !== "all" && w.branch_name !== branchFilter) return false;
      if (cityFilter !== "all" && w.city_name !== cityFilter) return false;
      if (typeFilter !== "all" && w.warehouse_type !== typeFilter) return false;
      if (ownerFilter !== "all" && w.owner_name !== ownerFilter) return false;
      if (statusFilter !== "all" && w.status.toLowerCase() !== statusFilter.toLowerCase()) return false;
      if (dateFrom && w.created_at && new Date(w.created_at) < new Date(dateFrom)) return false;
      if (dateTo && w.created_at && new Date(w.created_at) > new Date(`${dateTo}T23:59:59`)) return false;
      return true;
    });
  }, [normalizedList, search, countryFilter, branchFilter, cityFilter, typeFilter, ownerFilter, statusFilter, dateFrom, dateTo]);

  const cityOptions = useMemo(() => {
    const pool = countryFilter === "all" ? normalizedList : normalizedList.filter((w) => w.country_id === countryFilter);
    return Array.from(new Set(pool.map((w) => w.city_name).filter((v) => v && v !== "—"))).sort();
  }, [normalizedList, countryFilter]);

  const totalPages = Math.max(1, Math.ceil(displayList.length / pageSize));
  const pageRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return displayList.slice(start, start + pageSize);
  }, [displayList, currentPage, pageSize]);

  const stats = useMemo(() => {
    const now = new Date();
    const activeCount = normalizedList.filter((w) => w.status === "Active").length;
    const inactiveCount = normalizedList.length - activeCount;
    const newThisMonth = normalizedList.filter((w) => {
      if (!w.created_at) return false;
      const d = new Date(w.created_at);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }).length;
    const totalCapacity = normalizedList.reduce((sum, w) => sum + w.capacity_mt, 0);
    const coldStorageCount = normalizedList.filter((w) => w.is_cold_storage).length;
    const avgCapacity = normalizedList.length ? Math.round(totalCapacity / normalizedList.length) : 0;
    const countries = new Set(normalizedList.filter((w) => w.country_id).map((w) => w.country_id)).size;
    const branches = new Set(normalizedList.map((w) => w.branch_name).filter((v) => v && v !== "—")).size;
    const owners = new Set(normalizedList.map((w) => w.owner_name).filter((v) => v && v !== "—")).size;
    return { activeCount, inactiveCount, newThisMonth, totalCapacity, coldStorageCount, avgCapacity, countries, branches, owners };
  }, [normalizedList]);

  const isSuperAdmin = !!session?.scopes?.isSuperAdmin;

  const toggleSelectAll = () => {
    if (Object.keys(selectedIds).length === displayList.length) {
      setSelectedIds({});
    } else {
      const next: Record<string, boolean> = {};
      displayList.forEach((w) => { next[w.id] = true; });
      setSelectedIds(next);
    }
  };

  const toggleSelectRow = (id: string) => {
    setSelectedIds((p) => ({ ...p, [id]: !p[id] }));
  };

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="min-h-screen bg-[#f8fafc] dark:bg-[#0b1120] text-slate-800 dark:text-slate-100 pb-16 font-sans">
      <div className="mx-auto max-w-[1700px] p-4 sm:p-6 lg:p-7 space-y-6">

        {/* 1. TOP BREADCRUMB & HEADER */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1 font-bold text-slate-600 hover:text-blue-600 dark:text-slate-300 transition"
            >
              <span className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] shadow-2xs dark:border-slate-800 dark:bg-slate-900">
                {isRtl ? "→" : "←"} {tt("common.back", "Back")}
              </span>
            </Link>
            <span className="text-slate-400">{tt("common.dashboard", "Dashboard")}</span>
            <span className="text-slate-300 dark:text-slate-700">{isRtl ? "<" : ">"}</span>
            <span className="font-semibold text-blue-600 dark:text-blue-400">{tt("wh.title", "Warehouse Registry & Master Setup")}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void loadWarehouses()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-blue-600" : ""}`} />
              {tt("wh.refresh", "Refresh")}
            </button>
          </div>
        </div>

        {/* 2. TITLE HEADER */}
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 shadow-inner">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-slate-50">
              {tt("wh.title", "Warehouse Registry & Master Setup")}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {tt("wh.subtitle", "Real warehouse records linked with customer owners, location scope, and master-data controls.")}
            </p>
          </div>
        </div>

        {/* 3. FOUR KPI CARDS (Screenshot 2 layout) */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Card 1: Branch & User Details (Blue) */}
          <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50/70 via-white to-blue-50/20 p-4 shadow-sm dark:border-blue-950/60 dark:from-blue-950/30 dark:via-slate-900 dark:to-slate-900">
            <div className="flex items-center justify-between pb-3 border-b border-blue-100/70 dark:border-blue-900/40">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-blue-100 p-1.5 text-blue-600 dark:bg-blue-900/60 dark:text-blue-300">
                  <Building2 className="h-4 w-4" />
                </div>
                <span className="text-xs font-bold text-blue-950 dark:text-blue-200">{tt("wh.branch_user_details", "Branch & User Details")}</span>
              </div>
            </div>
            <div className="mt-3 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">{tt("common.branch", "Branch")}</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{session?.scopes?.summary?.branchDisplayName || "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">{tt("common.country", "Country")}</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{session?.scopes?.summary?.countryName || "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">{tt("common.user_name", "User Name")}</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{session?.user?.fullName || "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">{tt("wh.user_email", "User Email")}</span>
                <span className="font-mono text-slate-600 dark:text-slate-300 truncate max-w-[120px]" title={session?.user?.email || ""}>{session?.user?.email || "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">{tt("wh.role", "Role")}</span>
                <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-bold text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                  {isSuperAdmin ? tt("wh.super_admin", "Super Admin") : (session?.scopes?.summary?.scopeLabel || "—")}
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Warehouse Summary (Emerald) */}
          <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50/70 via-white to-emerald-50/20 p-4 shadow-sm dark:border-emerald-950/60 dark:from-emerald-950/30 dark:via-slate-900 dark:to-slate-900">
            <div className="flex items-center justify-between pb-3 border-b border-emerald-100/70 dark:border-emerald-900/40">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-emerald-100 p-1.5 text-emerald-600 dark:bg-emerald-900/60 dark:text-emerald-300">
                  <WarehouseIcon className="h-4 w-4" />
                </div>
                <span className="text-xs font-bold text-emerald-950 dark:text-emerald-200">{tt("wh.warehouse_summary", "Warehouse Summary")}</span>
              </div>
            </div>
            <div className="mt-3 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">{tt("wh.kpi_total", "Total Warehouses")}</span>
                <span className="font-black text-emerald-700 dark:text-emerald-300 text-sm">{normalizedList.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">{tt("common.active", "Active")}</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">{stats.activeCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">{tt("common.inactive", "Inactive")}</span>
                <span className="font-bold text-rose-600 dark:text-rose-400">{stats.inactiveCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">{tt("wh.new_this_month", "New This Month")}</span>
                <span className="font-bold text-blue-600 dark:text-blue-400">{stats.newThisMonth}</span>
              </div>
            </div>
          </div>

          {/* Card 3: Capacity Summary (Amber) */}
          <div className="rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50/70 via-white to-amber-50/20 p-4 shadow-sm dark:border-amber-950/60 dark:from-amber-950/30 dark:via-slate-900 dark:to-slate-900">
            <div className="flex items-center justify-between pb-3 border-b border-amber-100/70 dark:border-amber-900/40">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-amber-100 p-1.5 text-amber-600 dark:bg-amber-900/60 dark:text-amber-300">
                  <Layers className="h-4 w-4" />
                </div>
                <span className="text-xs font-bold text-amber-950 dark:text-amber-200">{tt("wh.capacity_summary", "Capacity Summary")}</span>
              </div>
            </div>
            <div className="mt-3 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">{tt("wh.total_capacity", "Total Capacity")}</span>
                <span className="font-black text-amber-700 dark:text-amber-300">{stats.totalCapacity.toLocaleString()} MT</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">{tt("wh.avg_capacity", "Avg per Warehouse")}</span>
                <span className="font-bold text-amber-600 dark:text-amber-400">{stats.avgCapacity.toLocaleString()} MT</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">{tt("wh.cold_storage_count", "Cold Storage")}</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">{stats.coldStorageCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">{tt("wh.standard_storage_count", "Standard Storage")}</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{normalizedList.length - stats.coldStorageCount}</span>
              </div>
            </div>
          </div>

          {/* Card 4: All Countries Warehouse Report (Blue + Super Admin Only) */}
          {isSuperAdmin ? (
            <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50/70 via-white to-blue-50/20 p-4 shadow-sm dark:border-blue-950/60 dark:from-blue-950/30 dark:via-slate-900 dark:to-slate-900">
              <div className="flex items-center justify-between pb-3 border-b border-blue-100/70 dark:border-blue-900/40">
                <span className="text-xs font-bold text-blue-950 dark:text-blue-200">{tt("wh.all_countries_report", "All Countries Warehouse Report")}</span>
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-black text-blue-700 dark:bg-blue-900/60 dark:text-blue-300 uppercase tracking-wider">
                  {tt("wh.super_admin_only", "Super Admin Only")}
                </span>
              </div>
              <div className="mt-3 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">{tt("wh.countries", "Countries")}</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{stats.countries}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">{tt("common.branch", "Branches")}</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{stats.branches}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">{tt("wh.kpi_total", "Total Warehouses")}</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{normalizedList.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">{tt("wh.owners", "Owners")}</span>
                  <span className="font-black text-blue-600 dark:text-blue-400">{stats.owners}</span>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* 4. FILTER ROW TOOLBAR */}
        <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search Input */}
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder={tt("wh.search_placeholder_full", "Search by code, name or owner...")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-9 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-blue-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>

            {/* Country Dropdown */}
            <select
              value={countryFilter}
              onChange={(e) => { setCountryFilter(e.target.value); setCityFilter("all"); }}
              className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="all">{tt("common.all_countries", "All Countries")}</option>
              {countryOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>

            {/* Branch Dropdown */}
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="all">{tt("common.all_branches", "All Branches")}</option>
              {branchOptions.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>

            {/* City / Area Dropdown */}
            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="all">{tt("wh.all_cities", "All Cities")}</option>
              {cityOptions.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>

            {/* Warehouse Type Dropdown */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="all">{tt("wh.all_types", "All Types")}</option>
              {typeOptions.map((tp) => <option key={tp} value={tp}>{tp}</option>)}
            </select>

            {/* Owner Dropdown */}
            <select
              value={ownerFilter}
              onChange={(e) => setOwnerFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="all">{tt("wh.all_owners", "All Owners")}</option>
              {ownerOptions.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>

            {/* Status Dropdown */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="all">{tt("common.all_statuses", "All Statuses")}</option>
              <option value="Active">{tt("common.active", "Active")}</option>
              <option value="Inactive">{tt("common.inactive", "Inactive")}</option>
            </select>

            {/* Date Range Input */}
            <div className="flex items-center gap-1 text-xs text-slate-500">
              <Calendar className="h-3.5 w-3.5 text-slate-400" />
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50/50 px-2 py-1 text-xs text-slate-700 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              />
              <span>–</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50/50 px-2 py-1 text-xs text-slate-700 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              />
            </div>

            {/* Action Buttons */}
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={() => void loadWarehouses()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                {tt("wh.refresh", "Refresh")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setModalMode("create");
                  setEditingWarehouse({} as WarehouseRecord);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition"
              >
                <Plus className="h-4 w-4" />
                {tt("wh.new_warehouse", "New Warehouse")}
              </button>
            </div>
          </div>
        </div>

        {error ? (
          <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
            {error}
          </p>
        ) : null}

        {/* 5. MAIN TABLE REGISTER CARD (Screenshot 2 layout) */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
          {/* Card Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 px-5 py-3.5 bg-slate-50/50 dark:bg-slate-800/40">
            <h2 className="text-sm font-black text-slate-900 dark:text-slate-100">
              {tt("wh.register_title", "Warehouse Register")}
            </h2>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowReport(true)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 shadow-sm"
              >
                <Printer className="h-3.5 w-3.5 text-slate-500" />
                {tt("wh.print", "Print")}
              </button>
              <button
                type="button"
                onClick={() => setShowReport(true)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 shadow-sm"
              >
                <FileDown className="h-3.5 w-3.5 text-rose-500" />
                {tt("wh.pdf", "PDF")}
              </button>
              <button
                type="button"
                onClick={() => setShowReport(true)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 shadow-sm"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                {tt("wh.excel", "Excel")}
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/80 text-[11px] font-black uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400">
                  <th className="w-10 px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={displayList.length > 0 && Object.keys(selectedIds).length === displayList.length}
                      onChange={toggleSelectAll}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  <th className="w-10 px-3 py-3 text-center">#</th>
                  <th className="px-3 py-3 font-black text-slate-700 dark:text-slate-200">{tt("wh.col_code", "Warehouse Code")}</th>
                  <th className="px-3 py-3 font-black text-slate-700 dark:text-slate-200">{tt("wh.col_warehouse", "Warehouse Name")}</th>
                  <th className="px-3 py-3 font-black text-slate-700 dark:text-slate-200">{tt("wh.col_owner", "Owner")}</th>
                  <th className="px-3 py-3 font-black text-slate-700 dark:text-slate-200">{tt("common.country", "Country")}</th>
                  <th className="px-3 py-3 font-black text-slate-700 dark:text-slate-200">{tt("common.branch", "Branch")}</th>
                  <th className="px-3 py-3 font-black text-slate-700 dark:text-slate-200">{tt("wh.col_city_area", "City / Area")}</th>
                  <th className="px-3 py-3 font-black text-slate-700 dark:text-slate-200">{tt("wh.col_type", "Type")}</th>
                  <th className="px-3 py-3 text-right font-black text-slate-700 dark:text-slate-200">{tt("wh.col_capacity", "Capacity (MT)")}</th>
                  <th className="px-3 py-3 font-black text-slate-700 dark:text-slate-200">{tt("common.status", "Status")}</th>
                  <th className="w-16 px-3 py-3 text-right font-black text-slate-700 dark:text-slate-200">{tt("wh.actions", "Actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={12} className="py-12 text-center text-slate-400">
                      <RefreshCw className="mx-auto h-5 w-5 animate-spin text-blue-600" />
                      <span className="mt-2 block text-xs">{tt("wh.loading", "Loading warehouse registry...")}</span>
                    </td>
                  </tr>
                ) : pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="py-12 text-center text-slate-400">
                      {tt("wh.no_results", "No warehouse records found matching filters.")}
                    </td>
                  </tr>
                ) : (
                  pageRows.map((w, idx) => {
                    const isSelected = !!selectedIds[w.id];
                    return (
                      <tr
                        key={w.id}
                        className={`transition-colors hover:bg-blue-50/20 dark:hover:bg-blue-950/10 ${
                          isSelected ? "bg-blue-50/40 dark:bg-blue-950/20" : ""
                        }`}
                      >
                        <td className="px-4 py-2.5 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectRow(w.id)}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-3 py-2.5 text-center font-mono text-[11px] text-slate-400">
                          {(currentPage - 1) * pageSize + idx + 1}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
                          {w.warehouse_code}
                        </td>
                        <td className="px-3 py-2.5 font-bold text-slate-900 dark:text-slate-100">
                          {w.warehouse_name}
                        </td>
                        <td className="px-3 py-2.5 text-slate-700 dark:text-slate-300 font-medium">
                          {w.owner_name}
                        </td>
                        <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">
                          {w.country_name}
                        </td>
                        <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">
                          {w.branch_name}
                        </td>
                        <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">
                          {w.city_name}
                        </td>
                        <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300 font-medium">
                          {w.warehouse_type}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                          {w.capacity_mt ? w.capacity_mt.toLocaleString() : "—"}
                        </td>
                        <td className="px-3 py-2.5">
                          {w.status === "Active" ? (
                            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300">
                              {tt("common.active", "Active")}
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-bold text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300">
                              {tt("common.inactive", "Inactive")}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => setViewWarehouse(w.raw || w)}
                              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 transition"
                              title={tt("wh.view", "View")}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setModalMode("edit");
                                setEditingWarehouse(w.raw || w);
                              }}
                              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 transition"
                              title={tt("wh.edit", "Edit")}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDelete(w.raw || w)}
                              className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-slate-800 transition"
                              title={tt("wh.delete", "Delete")}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
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
            <div>
              {tt("wh.showing", "Showing")} {displayList.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
              {" "}{tt("wh.to", "to")}{" "}
              {Math.min(currentPage * pageSize, displayList.length)} {tt("wh.of", "of")} {displayList.length} {tt("wh.entries", "entries")}
            </div>

            <div className="flex items-center gap-2">
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
              >
                <option value={10}>10 {tt("wh.per_page", "per page")}</option>
                <option value={25}>25 {tt("wh.per_page", "per page")}</option>
                <option value={50}>50 {tt("wh.per_page", "per page")}</option>
              </select>

              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 font-semibold text-slate-500 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:border-slate-700"
              >
                {isRtl ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
              </button>
              <button
                type="button"
                className="rounded-lg bg-blue-600 px-2.5 py-1 font-bold text-white shadow-sm"
              >
                {currentPage}
              </button>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 font-semibold text-slate-500 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:border-slate-700"
              >
                {isRtl ? <ChevronLeft className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Edit/Create Warehouse Modal */}
      {editingWarehouse ? (
        <SimpleModal
          title={modalMode === "create" ? tt("wh.create_warehouse_title", "Create Warehouse") : tt("wh.edit_warehouse_title", "Edit Warehouse - {name}").replace("{name}", editingWarehouse.warehouse_name || "")}
          onClose={closeFormModal}
          className="max-w-6xl"
        >
          <WarehouseForm
            mode="embedded"
            initialWarehouse={modalMode === "edit" ? editingWarehouse : null}
            onCancel={closeFormModal}
            onSave={async () => {
              setSubmitting(true);
              await loadWarehouses();
              setSubmitting(false);
              closeFormModal();
            }}
          />
          {submitting ? <div className="text-xs text-slate-500 mt-2">{tt("wh.wm_refreshing_registry", "Refreshing registry...")}</div> : null}
        </SimpleModal>
      ) : null}

      {/* View Warehouse Details Modal */}
      {viewWarehouse ? (
        <SimpleModal
          title={tt("wh.warehouse_details_title", "Warehouse Details - {name}").replace("{name}", viewWarehouse.warehouse_name)}
          onClose={() => setViewWarehouse(null)}
          className="max-w-3xl"
        >
          <div className="grid gap-3 md:grid-cols-2 text-xs">
            <div className="rounded-xl border bg-slate-50 p-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{tt("wh.warehouse_name_label", "Warehouse Name")}</div>
              <div className="mt-1 text-sm font-bold text-slate-900">{viewWarehouse.warehouse_name}</div>
            </div>
            <div className="rounded-xl border bg-slate-50 p-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{tt("wh.col_owner", "Owner")}</div>
              <div className="mt-1 text-sm font-bold text-slate-900">{viewWarehouse.owner_name || "-"}</div>
            </div>
            <div className="rounded-xl border bg-slate-50 p-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{tt("wh.col_type", "Warehouse Type")}</div>
              <div className="mt-1 text-xs font-semibold text-slate-800">{viewWarehouse.warehouse_type}</div>
            </div>
            <div className="rounded-xl border bg-slate-50 p-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{tt("common.status", "Status")}</div>
              <div className="mt-1 text-xs font-bold text-emerald-600">{viewWarehouse.status}</div>
            </div>
            <div className="rounded-xl border bg-slate-50 p-3 md:col-span-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{tt("wh.address", "Address")}</div>
              <div className="mt-1 text-xs text-slate-700">{viewWarehouse.full_address || tt("wh.no_address", "No address recorded")}</div>
            </div>
          </div>
        </SimpleModal>
      ) : null}

      {/* Universal Report Modal */}
      <UniversalReportModal
        isOpen={showReport}
        onClose={() => setShowReport(false)}
        title={tt("wh.report_title", "Warehouse Registry Report")}
        subtitle={tt("wh.wm_complete_storage_facility_reg", "Complete Storage Facility, Yard, & Logistics Master Registry")}
        exportFileName="warehouse_registry_report"
        filters={[
          { label: tt("wh.status_filter", "Status Filter"), value: statusFilter },
          { label: tt("wh.search_query", "Search Query"), value: search || tt("wh.none", "None") }
        ]}
        columns={[
          { key: "warehouse_name", label: tt("wh.warehouse_name_label", "Warehouse Name") },
          { key: "warehouse_code", label: tt("wh.code", "Code") },
          { key: "country_name", label: tt("common.country", "Country") },
          { key: "city_name", label: tt("wh.city", "City") },
          { key: "warehouse_type", label: tt("wh.col_type", "Type") },
          { key: "status", label: tt("common.status", "Status"), align: "center" }
        ]}
        data={displayList.map(w => ({
          warehouse_name: w.warehouse_name,
          warehouse_code: w.warehouse_code,
          country_name: w.country_name,
          city_name: w.city_name,
          warehouse_type: w.warehouse_type,
          status: w.status
        }))}
      />
    </div>
  );
}
