"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  CalendarCheck,
  Building2,
  Clock,
  Globe,
  Plus,
  RefreshCw,
  Search,
  Printer,
  Download,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  PhoneCall,
  MessageCircle,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  SlidersHorizontal,
  ChevronDown,
  FileText,
  FileSpreadsheet,
  FileDown,
  ShieldCheck,
  CreditCard,
  ShoppingCart,
  Ship,
  Users
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";
import { downloadCsv } from "@/features/branches/components/branch-report-export";
import { cn } from "@/lib/utils";
import { useBranchUserContext, roleLabel } from "@/lib/hooks/use-branch-user-context";
import { Th } from "@/components/ui/translated-th";

/** Formats a real per-currency breakdown; never collapses mixed currencies into one number. */
function formatByCurrency(rows: Array<{ currency: string; amount: number }> | undefined | null): string {
  if (!rows || rows.length === 0) return "—";
  return rows.map((r) => `${r.currency} ${Number(r.amount || 0).toLocaleString()}`).join("  +  ");
}

/** Combines several real per-currency breakdowns, summing entries that share a currency. */
function mergeByCurrency(...groups: Array<Array<{ currency: string; amount: number }>>): Array<{ currency: string; amount: number }> {
  const map = new Map<string, number>();
  for (const rows of groups) {
    for (const r of rows || []) {
      map.set(r.currency, (map.get(r.currency) || 0) + Number(r.amount || 0));
    }
  }
  return Array.from(map.entries()).map(([currency, amount]) => ({ currency, amount }));
}

const DUE_TABS = ["overdue", "today", "tomorrow", "upcoming", "completed"] as const;

export function SmartCrmControlCenter() {
  const lang = useActiveLanguage();
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { context: userContext } = useBranchUserContext();

  // Scope & Filters State
  const [selectedCountry, setSelectedCountry] = useState("all");
  const [selectedMainBranch, setSelectedMainBranch] = useState("all");
  const [selectedCityBranch, setSelectedCityBranch] = useState("all");
  const [dueTypeFilter, setDueTypeFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [fromDate, setFromDate] = useState("2026-09-01");
  const [toDate, setToDate] = useState("2026-09-30");
  const [activeTab, setActiveTab] = useState<"today" | "overdue" | "tomorrow" | "upcoming" | "completed">("today");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});

  // Master data options
  const [countryOptions, setCountryOptions] = useState<{ id: string; name: string }[]>([]);
  const [mainBranchOptions, setMainBranchOptions] = useState<{ id: string; name: string }[]>([]);
  const [cityBranchOptions, setCityBranchOptions] = useState<{ id: string; name: string }[]>([]);

  // Data Loading State
  const [loading, setLoading] = useState(false);
  const [dashboardData, setDashboardData] = useState<any>(null);
  /** Real record count per tab (overdue/today/tomorrow/upcoming/completed) — fetched
   *  separately since the main dashboard call only returns rows for the active tab. */
  const [tabCounts, setTabCounts] = useState<Record<string, number>>({});

  // Follow-Up Note Modal State
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [selectedItemForNote, setSelectedItemForNote] = useState<any>(null);
  const [noteText, setNoteText] = useState("");
  const [noteType, setNoteType] = useState("Call Follow-Up");
  const [promiseDate, setPromiseDate] = useState("");
  const [promiseAmount, setPromiseAmount] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  // Sync tab from URL
  useEffect(() => {
    const raw = (searchParams.get("tab") || "").toLowerCase().trim();
    if (!raw) return;
    const VALID = ["today", "overdue", "tomorrow", "upcoming", "completed"] as const;
    if ((VALID as readonly string[]).includes(raw)) {
      setActiveTab(raw as (typeof VALID)[number]);
    }
  }, [searchParams]);

  // Load scope master data
  useEffect(() => {
    let cancelled = false;
    async function loadScopeMeta() {
      try {
        const [cRes, mRes, bRes] = await Promise.all([
          fetch("/api/branch-management/countries"),
          fetch("/api/branch-management/country-branches?limit=500"),
          fetch("/api/branch-management/city-branches?limit=500"),
        ]);
        if (cancelled) return;
        if (cRes.ok) {
          const d = await cRes.json();
          setCountryOptions((d.countries ?? []).map((c: any) => ({ id: c.id, name: c.name })));
        }
        if (mRes.ok) {
          const d = await mRes.json();
          setMainBranchOptions((d.countryBranches ?? []).map((b: any) => ({ id: b.id, name: b.name })));
        }
        if (bRes.ok) {
          const d = await bRes.json();
          setCityBranchOptions((d.cityBranches ?? []).map((b: any) => ({ id: b.id, name: b.name })));
        }
      } catch {
        // Fallback gracefully
      }
    }
    loadScopeMeta();
    return () => { cancelled = true; };
  }, []);

  // Fetch Dashboard Data
  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const qp = new URLSearchParams({
        tab: activeTab,
        fromDate,
        toDate,
      });
      if (selectedCountry !== "all") qp.set("countryId", selectedCountry);
      if (selectedMainBranch !== "all") qp.set("countryBranchId", selectedMainBranch);
      if (selectedCityBranch !== "all") qp.set("cityBranchId", selectedCityBranch);
      if (searchQuery.trim()) qp.set("search", searchQuery.trim());

      const res = await fetch(`/api/erp/crm/dashboard?${qp.toString()}`);
      const data = await res.json();
      if (data.success) {
        setDashboardData(data);
      }
    } catch (e) {
      console.error("Failed to load CRM dashboard data", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchDashboardData();
  }, [selectedCountry, selectedMainBranch, selectedCityBranch, activeTab]);

  // Real per-tab counts (Overdue/Today/Tomorrow/Upcoming/Completed) for the filter
  // badges and the Follow-Up Status Summary card — a separate lightweight call per
  // tab since the main dashboard endpoint only returns rows for the active tab.
  useEffect(() => {
    let cancelled = false;
    async function loadTabCounts() {
      try {
        const results = await Promise.all(
          DUE_TABS.map(async (tabId) => {
            const qp = new URLSearchParams({ tab: tabId, fromDate, toDate, pageSize: "10" });
            if (selectedCountry !== "all") qp.set("countryId", selectedCountry);
            if (selectedMainBranch !== "all") qp.set("countryBranchId", selectedMainBranch);
            if (selectedCityBranch !== "all") qp.set("cityBranchId", selectedCityBranch);
            const res = await fetch(`/api/erp/crm/dashboard?${qp.toString()}`);
            const data = await res.json();
            return [tabId, data?.success ? Number(data?.pagination?.total || 0) : 0] as const;
          })
        );
        if (!cancelled) setTabCounts(Object.fromEntries(results));
      } catch (e) {
        console.error("Failed to load CRM tab counts", e);
      }
    }
    void loadTabCounts();
    return () => { cancelled = true; };
  }, [selectedCountry, selectedMainBranch, selectedCityBranch, fromDate, toDate]);

  const handleCompleteItem = async (itemId: string) => {
    if (!window.confirm(t(lang, "crm.confirm_mark_complete", "Mark this action item as completed?"))) return;
    try {
      const res = await fetch("/api/erp/crm/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ crmItemId: itemId, remarks: "Completed via CRM Control Center" })
      });
      const data = await res.json();
      if (data.success) {
        void fetchDashboardData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveNote = async () => {
    if (!selectedItemForNote || !noteText.trim()) return;
    setSavingNote(true);
    try {
      const res = await fetch("/api/erp/crm/followup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          crmItemId: selectedItemForNote.id,
          noteType,
          noteText,
          promiseDate: promiseDate || null,
          promiseAmount: promiseAmount ? Number(promiseAmount) : null
        })
      });
      const data = await res.json();
      if (data.success) {
        setNoteModalOpen(false);
        setNoteText("");
        setPromiseDate("");
        setPromiseAmount("");
        void fetchDashboardData();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSavingNote(false);
    }
  };

  const kpis = dashboardData?.kpis || {};
  const financialSummary = dashboardData?.financialSummary || {};

  const registeredItems = useMemo(() => {
    const rawItems: any[] = dashboardData?.actionItems || [];

    return rawItems.filter((item: any) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const m = (item.reference_no || "").toLowerCase().includes(q) ||
                  (item.party_name || "").toLowerCase().includes(q) ||
                  (item.invoice_no || item.reference_no || "").toLowerCase().includes(q);
        if (!m) return false;
      }
      if (dueTypeFilter !== "all" && item.item_type !== dueTypeFilter) return false;
      if (userFilter !== "all" && item.responsible_user_name !== userFilter) return false;
      if (statusFilter !== "all" && item.status.toLowerCase() !== statusFilter.toLowerCase()) return false;
      return true;
    });
  }, [dashboardData, searchQuery, dueTypeFilter, userFilter, statusFilter]);

  // Real responsible-user options, derived from the currently loaded action items —
  // no fabricated names (Ahmed Ali / Sara Khan / ...).
  const responsibleUserOptions = useMemo(() => {
    const names = new Set<string>();
    for (const item of (dashboardData?.actionItems || []) as any[]) {
      if (item.responsible_user_name) names.add(item.responsible_user_name);
    }
    return Array.from(names).sort();
  }, [dashboardData]);

  const toggleSelectAll = () => {
    if (Object.keys(selectedIds).length === registeredItems.length) {
      setSelectedIds({});
    } else {
      const next: Record<string, boolean> = {};
      registeredItems.forEach((r: any) => { next[r.id] = true; });
      setSelectedIds(next);
    }
  };

  const toggleSelectRow = (id: string) => {
    setSelectedIds((p) => ({ ...p, [id]: !p[id] }));
  };

  const handleExportExcel = () => {
    if (!registeredItems.length) return;
    const headers = ["#", "TYPE", "REFERENCE NO", "PARTY / ACCOUNT", "INVOICE / BL NO", "DUE DATE", "AMOUNT", "PAID", "REMAINING", "CURRENCY", "BRANCH", "RESPONSIBLE", "PRIORITY", "STATUS"];
    const rows = registeredItems.map((r: any, idx: number) => [
      String(idx + 1),
      String(r.item_type || ""),
      String(r.reference_no || ""),
      String(r.party_name || ""),
      String(r.invoice_no || r.reference_no || ""),
      String(r.due_date || ""),
      String(r.amount || 0),
      String(r.paid_amount || 0),
      String(r.remaining_amount || 0),
      String(r.currency || "AED"),
      String(r.branch_name || "—"),
      String(r.responsible_user_name || "—"),
      String(r.priority || "Medium"),
      String(r.status || "")
    ]);
    downloadCsv(`crm_due_register_${activeTab}.csv`, [headers, ...rows]);
  };

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="min-h-screen bg-[#f8fafc] dark:bg-[#0b1120] text-slate-800 dark:text-slate-100 pb-16 font-sans">
      <div className="mx-auto max-w-[1700px] p-4 sm:p-6 lg:p-7 space-y-6">

        {/* 1. TOP BREADCRUMBS & TOP RIGHT BUTTON */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1 font-medium text-slate-500 hover:text-purple-600 transition"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              {t(lang, "common.back", "Back")}
            </Link>
            <span className="text-slate-300 dark:text-slate-700">/</span>
            <span className="text-slate-400">{t(lang, "common.dashboard", "Dashboard")}</span>
            <span className="text-slate-300 dark:text-slate-700">&gt;</span>
            <span className="font-semibold text-purple-600 dark:text-purple-400">{t(lang, "crm.title", "Smart CRM & Due")}</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={fetchDashboardData}
              className="h-8 text-xs font-semibold gap-1.5 rounded-lg border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", loading ? "animate-spin text-purple-600" : "")} />
              {t(lang, "crm.refresh", "Refresh")}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => { setSelectedItemForNote(null); setNoteModalOpen(true); }}
              className="h-8 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs gap-1.5 rounded-xl shadow-sm px-3.5"
            >
              <Plus className="h-4 w-4" />
              {t(lang, "crm.add_new_due", "Add New Due")}
            </Button>
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
                {t(lang, "crm.title", "Smart CRM & Due")}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t(lang, "crm.due_register", "Due & Follow-Up Register")}
              </p>
            </div>
          </div>
        </div>

        {/* 3. FOUR KPI CARDS (Screenshot 4 layout) */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Card 1: Branch & User Details (Purple) */}
          <div className="rounded-2xl border border-purple-100 bg-gradient-to-br from-purple-50/70 via-white to-purple-50/20 p-4 shadow-sm dark:border-purple-950/60 dark:from-purple-950/30 dark:via-slate-900 dark:to-slate-900">
            <div className="flex items-center justify-between pb-3 border-b border-purple-100/70 dark:border-purple-900/40">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-purple-100 p-1.5 text-purple-600 dark:bg-purple-900/60 dark:text-purple-300">
                  <Building2 className="h-4 w-4" />
                </div>
                <span className="text-xs font-bold text-purple-950 dark:text-purple-200">{t(lang, "crm.branch_user_details", "Branch & User Details")}</span>
              </div>
            </div>
            <div className="mt-3 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">{t(lang, "crm.lbl_branch", "Branch:")}</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{userContext?.branchName || "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">{t(lang, "crm.lbl_user", "User:")}</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{userContext?.userName || "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">{t(lang, "crm.lbl_role", "Role:")}</span>
                <span className="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-[11px] font-bold text-purple-700 dark:bg-purple-900/50 dark:text-purple-300">
                  {roleLabel(userContext?.role)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">{t(lang, "crm.lbl_scope", "Scope:")}</span>
                <span className="font-medium text-slate-600 dark:text-slate-300">{userContext?.scopeLabel || userContext?.country || "—"}</span>
              </div>
            </div>
          </div>

          {/* Card 2: Today's Due Summary (Emerald) */}
          <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50/70 via-white to-emerald-50/20 p-4 shadow-sm dark:border-emerald-950/60 dark:from-emerald-950/30 dark:via-slate-900 dark:to-slate-900">
            <div className="flex items-center justify-between pb-3 border-b border-emerald-100/70 dark:border-emerald-900/40">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-emerald-100 p-1.5 text-emerald-600 dark:bg-emerald-900/60 dark:text-emerald-300">
                  <CalendarCheck className="h-4 w-4" />
                </div>
                <span className="text-xs font-bold text-emerald-950 dark:text-emerald-200">{t(lang, "crm.due_summary", "Due Summary")}</span>
              </div>
            </div>
            <div className="mt-3 space-y-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500 dark:text-slate-400 shrink-0">{t(lang, "crm.receivable_due", "Receivable Due:")}</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 text-right">
                  {formatByCurrency(mergeByCurrency(kpis.salesRecoveryByCurrency || [], kpis.chequesCollectByCurrency || []))}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500 dark:text-slate-400 shrink-0">{t(lang, "crm.payable_due", "Payable Due:")}</span>
                <span className="font-bold text-rose-600 dark:text-rose-400 text-right">
                  {formatByCurrency(mergeByCurrency(kpis.purchaseDueByCurrency || [], kpis.chequesPayByCurrency || []))}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500 dark:text-slate-400 shrink-0">{t(lang, "crm.cheques_due", "Cheques Due:")}</span>
                <span className="font-bold text-amber-600 dark:text-amber-400 text-right">
                  {formatByCurrency(mergeByCurrency(kpis.chequesDepositByCurrency || [], kpis.chequesPayByCurrency || [], kpis.chequesCollectByCurrency || []))}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500 dark:text-slate-400 shrink-0">{t(lang, "crm.shipment_due", "Shipment Due:")}</span>
                <span className="font-bold text-blue-600 dark:text-blue-400 text-right">
                  {formatByCurrency(kpis.shippingDueByCurrency || [])}
                </span>
              </div>
            </div>
          </div>

          {/* Card 3: Follow-Up Status Summary (Amber) */}
          <div className="rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50/70 via-white to-amber-50/20 p-4 shadow-sm dark:border-amber-950/60 dark:from-amber-950/30 dark:via-slate-900 dark:to-slate-900">
            <div className="flex items-center justify-between pb-3 border-b border-amber-100/70 dark:border-amber-900/40">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-amber-100 p-1.5 text-amber-600 dark:bg-amber-900/60 dark:text-amber-300">
                  <Clock className="h-4 w-4" />
                </div>
                <span className="text-xs font-bold text-amber-950 dark:text-amber-200">{t(lang, "crm.followup_status_summary", "Follow-Up Status Summary")}</span>
              </div>
            </div>
            <div className="mt-3 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">{t(lang, "crm.tab_overdue", "Overdue")}:</span>
                <span className="font-bold text-rose-600 dark:text-rose-400">{tabCounts.overdue ?? "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">{t(lang, "crm.due_today", "Due Today")}:</span>
                <span className="font-bold text-blue-600 dark:text-blue-400">{tabCounts.today ?? "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">{t(lang, "crm.tab_tomorrow", "Tomorrow")}:</span>
                <span className="font-bold text-amber-600 dark:text-amber-400">{tabCounts.tomorrow ?? "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">{t(lang, "crm.tab_upcoming", "Upcoming")}:</span>
                <span className="font-bold text-purple-600 dark:text-purple-400">{tabCounts.upcoming ?? "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">{t(lang, "crm.tab_completed", "Completed")}:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">{tabCounts.completed ?? "—"}</span>
              </div>
            </div>
          </div>

          {/* Card 4: Country / Branch Due Report — Super Admin only, since it aggregates
              across every country/branch the way only a super admin is scoped to see. */}
          <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50/70 via-white to-blue-50/20 p-4 shadow-sm dark:border-blue-950/60 dark:from-blue-950/30 dark:via-slate-900 dark:to-slate-900">
            <div className="flex items-center justify-between pb-3 border-b border-blue-100/70 dark:border-blue-900/40">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-blue-100 p-1.5 text-blue-600 dark:bg-blue-900/60 dark:text-blue-300">
                  <Globe className="h-4 w-4" />
                </div>
                <span className="text-xs font-bold text-blue-950 dark:text-blue-200">{t(lang, "crm.country_branch_due_report", "Country / Branch Due Report")}</span>
              </div>
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-black text-blue-700 dark:bg-blue-900/60 dark:text-blue-300 uppercase tracking-wider">
                {t(lang, "crm.super_admin_only", "Super Admin Only")}
              </span>
            </div>
            {!userContext?.isSuperAdmin ? (
              <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400">{t(lang, "crm.super_admin_only", "Super Admin Only")}</p>
            ) : (
            <div className="mt-3 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">{t(lang, "crm.total_countries", "Total Countries:")}</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{countryOptions.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">{t(lang, "crm.total_branches", "Total Branches:")}</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{cityBranchOptions.length}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500 dark:text-slate-400 shrink-0">{t(lang, "crm.total_receivable", "Total Receivable")}:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 text-right">{formatByCurrency(financialSummary.totalReceivableByCurrency)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500 dark:text-slate-400 shrink-0">{t(lang, "crm.total_payable", "Total Payable")}:</span>
                <span className="font-bold text-rose-600 dark:text-rose-400 text-right">{formatByCurrency(financialSummary.totalPayableByCurrency)}</span>
              </div>
            </div>
            )}
          </div>
        </div>

        {/* 4. FILTER TABS (Screenshot 4 layout) */}
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: "overdue", labelKey: "crm.tab_overdue", labelFallback: "Overdue", tone: "text-rose-700 bg-rose-50 border-rose-200 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900", activeTone: "bg-rose-600 text-white border-rose-600 shadow-rose-600/20" },
            { id: "today", labelKey: "crm.due_today", labelFallback: "Due Today", tone: "text-blue-700 bg-blue-50 border-blue-200 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900", activeTone: "bg-blue-600 text-white border-blue-600 shadow-blue-600/20" },
            { id: "tomorrow", labelKey: "crm.tab_tomorrow", labelFallback: "Tomorrow", tone: "text-amber-700 bg-amber-50 border-amber-200 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900", activeTone: "bg-amber-600 text-white border-amber-600 shadow-amber-600/20" },
            { id: "upcoming", labelKey: "crm.tab_upcoming", labelFallback: "Upcoming", tone: "text-purple-700 bg-purple-50 border-purple-200 hover:bg-purple-100 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-900", activeTone: "bg-purple-600 text-white border-purple-600 shadow-purple-600/20" },
            { id: "completed", labelKey: "crm.tab_completed", labelFallback: "Completed", tone: "text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900", activeTone: "bg-emerald-600 text-white border-emerald-600 shadow-emerald-600/20" },
          ].map((tabDef) => {
            const isActive = activeTab === tabDef.id;
            return (
              <button
                key={tabDef.id}
                type="button"
                onClick={() => setActiveTab(tabDef.id as any)}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold border transition-all shadow-sm ${
                  isActive ? tabDef.activeTone : tabDef.tone
                }`}
              >
                <span>{t(lang, tabDef.labelKey as any, tabDef.labelFallback)}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                  isActive ? "bg-white/20 text-white" : "bg-black/5 dark:bg-white/10"
                }`}>
                  {tabCounts[tabDef.id] ?? "—"}
                </span>
              </button>
            );
          })}
        </div>

        {/* 5. FILTER ROW TOOLBAR */}
        <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Country Dropdown — bound to real fetched country master data */}
            <select
              value={selectedCountry}
              onChange={(e) => { setSelectedCountry(e.target.value); setSelectedMainBranch("all"); setSelectedCityBranch("all"); }}
              className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-purple-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="all">{t(lang, "crm.all_countries", "All Countries")}</option>
              {countryOptions.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            {/* Main Branch Dropdown — bound to real fetched country-branch master data */}
            <select
              value={selectedMainBranch}
              onChange={(e) => setSelectedMainBranch(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-purple-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="all">{t(lang, "crm.all_main_branches", "All Main Branches")}</option>
              {mainBranchOptions.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>

            {/* City Branch Dropdown — bound to real fetched city-branch master data */}
            <select
              value={selectedCityBranch}
              onChange={(e) => setSelectedCityBranch(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-purple-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="all">{t(lang, "crm.all_city_branches", "All City Branches")}</option>
              {cityBranchOptions.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>

            {/* Due Type Dropdown — values match the real item_type column exactly (not a loose text guess) */}
            <select
              value={dueTypeFilter}
              onChange={(e) => setDueTypeFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-purple-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="all">{t(lang, "crm.all_due_types", "All Due Types")}</option>
              <option value="Sales Recovery">{t(lang, "crm.due_type_sales_recovery", "Sales Recovery")}</option>
              <option value="Collect From Customer">{t(lang, "crm.due_type_receivable", "Customer Receivable")}</option>
              <option value="Purchase Payment">{t(lang, "crm.due_type_purchase", "Purchase Due")}</option>
              <option value="Cheque Pay">{t(lang, "crm.due_type_payable", "Supplier Payable")}</option>
              <option value="Cheque Deposit">{t(lang, "crm.due_type_cheque", "Cheques")}</option>
              <option value="Shipping Payment">{t(lang, "crm.due_type_shipping", "Shipping / Clearing")}</option>
            </select>

            {/* Responsible User Dropdown — real distinct names from the currently loaded action items */}
            <select
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-purple-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="all">{t(lang, "crm.all_users", "All Users")}</option>
              {responsibleUserOptions.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>

            {/* Status Dropdown */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-purple-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="all">{t(lang, "crm.all_statuses", "All Statuses")}</option>
              <option value="today">{t(lang, "crm.due_today", "Due Today")}</option>
              <option value="overdue">{t(lang, "crm.tab_overdue", "Overdue")}</option>
              <option value="tomorrow">{t(lang, "crm.tab_tomorrow", "Tomorrow")}</option>
              <option value="upcoming">{t(lang, "crm.tab_upcoming", "Upcoming")}</option>
              <option value="completed">{t(lang, "crm.tab_completed", "Completed")}</option>
            </select>

            {/* Date Range Inputs */}
            <div className="flex items-center gap-1 text-xs text-slate-500">
              <span>{t(lang, "crm.from_label", "From:")}</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50/50 px-2 py-1 text-xs text-slate-700 outline-none focus:border-purple-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              />
              <span>{t(lang, "crm.to_label", "To:")}</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50/50 px-2 py-1 text-xs text-slate-700 outline-none focus:border-purple-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              />
            </div>

            {/* Refresh Button */}
            <div className="ml-auto">
              <button
                type="button"
                onClick={fetchDashboardData}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", loading ? "animate-spin" : "")} />
                {t(lang, "crm.refresh", "Refresh")}
              </button>
            </div>
          </div>
        </div>

        {/* 6. MAIN TABLE REGISTER CARD (Screenshot 4 layout) */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
          {/* Card Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 px-5 py-3.5 bg-slate-50/50 dark:bg-slate-800/40">
            <h2 className="text-sm font-black text-slate-900 dark:text-slate-100">
              {t(lang, "crm.due_register", "Due & Follow-Up Register")}
            </h2>

            <div className="flex items-center gap-2.5">
              {/* Search input */}
              <div className="relative min-w-[240px]">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder={t(lang, "crm.search_register_ph", "Search by reference, party, invoice...")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-purple-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 shadow-sm"
                />
              </div>

              {/* Columns button */}
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <SlidersHorizontal className="h-3.5 w-3.5 text-slate-400" />
                {t(lang, "crm.columns", "Columns")}
                <ChevronDown className="h-3 w-3 text-slate-400" />
              </button>

              {/* Export Buttons */}
              <button
                type="button"
                onClick={handleExportExcel}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                {t(lang, "crm.btn_export_excel", "Export to Excel")}
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/80 text-[11px] font-black uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400">
                  <Th className="w-10 px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={registeredItems.length > 0 && Object.keys(selectedIds).length === registeredItems.length}
                      onChange={toggleSelectAll}
                      className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                    />
                  </Th>
                  <Th className="w-12 px-3 py-3 text-center">#</Th>
                  <Th className="px-3 py-3 font-black text-slate-700 dark:text-slate-200">{t(lang, "crm.th_type", "Type")}</Th>
                  <Th className="px-3 py-3 font-black text-slate-700 dark:text-slate-200">{t(lang, "crm.th_reference", "Reference No.")}</Th>
                  <Th className="px-3 py-3 font-black text-slate-700 dark:text-slate-200">{t(lang, "crm.th_party_account", "Party / Account")}</Th>
                  <Th className="px-3 py-3 font-black text-slate-700 dark:text-slate-200">{t(lang, "crm.th_invoice_bill", "Invoice / Bill No.")}</Th>
                  <Th className="px-3 py-3 font-black text-slate-700 dark:text-slate-200">{t(lang, "crm.th_due_date", "Due Date")}</Th>
                  <Th className="px-3 py-3 text-right font-black text-slate-700 dark:text-slate-200">{t(lang, "crm.th_amount", "Amount")}</Th>
                  <Th className="px-3 py-3 text-right font-black text-slate-700 dark:text-slate-200">{t(lang, "crm.th_paid", "Paid")}</Th>
                  <Th className="px-3 py-3 text-right font-black text-slate-700 dark:text-slate-200">{t(lang, "crm.th_remaining", "Remaining")}</Th>
                  <Th className="px-3 py-3 font-black text-slate-700 dark:text-slate-200">{t(lang, "crm.th_currency", "Currency")}</Th>
                  <Th className="px-3 py-3 font-black text-slate-700 dark:text-slate-200">{t(lang, "crm.th_branch", "Branch")}</Th>
                  <Th className="px-3 py-3 font-black text-slate-700 dark:text-slate-200">{t(lang, "crm.th_responsible", "Responsible")}</Th>
                  <Th className="px-3 py-3 font-black text-slate-700 dark:text-slate-200">{t(lang, "crm.th_priority", "Priority")}</Th>
                  <Th className="px-3 py-3 font-black text-slate-700 dark:text-slate-200">{t(lang, "crm.th_status", "Status")}</Th>
                  <Th className="w-16 px-3 py-3 text-right font-black text-slate-700 dark:text-slate-200">{t(lang, "crm.th_action", "Action")}</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {registeredItems.map((r: any, idx: number) => {
                  const isSelected = !!selectedIds[r.id];
                  return (
                    <tr
                      key={r.id}
                      className={`transition-colors hover:bg-purple-50/20 dark:hover:bg-purple-950/10 ${
                        isSelected ? "bg-purple-50/40 dark:bg-purple-950/20" : ""
                      }`}
                    >
                      <td className="px-4 py-2.5 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectRow(r.id)}
                          className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                        />
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono text-[11px] text-slate-400">
                        {idx + 1}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="inline-flex items-center rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          {r.item_type}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
                        {r.reference_no}
                      </td>
                      <td className="px-3 py-2.5 font-semibold text-slate-900 dark:text-slate-100">
                        {r.party_name}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs text-slate-600 dark:text-slate-400">
                        {r.invoice_no || r.reference_no}
                      </td>
                      <td className="px-3 py-2.5 text-slate-600 dark:text-slate-400">
                        {r.due_date}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                        {Number(r.amount).toLocaleString()}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-emerald-600 dark:text-emerald-400">
                        {Number(r.paid_amount || 0).toLocaleString()}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                        {Number(r.remaining_amount || r.amount).toLocaleString()}
                      </td>
                      <td className="px-3 py-2.5 font-medium text-slate-600 dark:text-slate-400">
                        {r.currency || "AED"}
                      </td>
                      <td className="px-3 py-2.5 text-slate-600 dark:text-slate-400">
                        {r.branch_name}
                      </td>
                      <td className="px-3 py-2.5 font-medium text-slate-700 dark:text-slate-300">
                        {r.responsible_user_name}
                      </td>
                      <td className="px-3 py-2.5">
                        {r.priority === "High" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-[10px] font-black text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-300">
                            {t(lang, "crm.priority_high", "High")}
                          </span>
                        ) : r.priority === "Medium" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-black text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:border-amber-900 dark:text-amber-300">
                            {t(lang, "crm.priority_medium", "Medium")}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-black text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:border-blue-900 dark:text-blue-300">
                            {t(lang, "crm.priority_low", "Low")}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        {r.status === "Overdue" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-bold text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-300">
                            {t(lang, "crm.tab_overdue", "Overdue")}
                          </span>
                        ) : r.status === "Today" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:border-blue-900 dark:text-blue-300">
                            {t(lang, "crm.due_today", "Due Today")}
                          </span>
                        ) : r.status === "Tomorrow" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:border-amber-900 dark:text-amber-300">
                            {t(lang, "crm.tab_tomorrow", "Tomorrow")}
                          </span>
                        ) : r.status === "Completed" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-900 dark:text-emerald-300">
                            {t(lang, "crm.tab_completed", "Completed")}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2.5 py-0.5 text-[11px] font-bold text-purple-700 border border-purple-200 dark:bg-purple-950/40 dark:border-purple-900 dark:text-purple-300">
                            {t(lang, "crm.tab_upcoming", "Upcoming")}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => { setSelectedItemForNote(r); setNoteModalOpen(true); }}
                            title={t(lang, "crm.title_followup_note", "Follow-up Note")}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600 dark:hover:bg-slate-800 transition"
                          >
                            <PhoneCall className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleCompleteItem(r.id)}
                            title={t(lang, "crm.title_mark_completed", "Mark Completed")}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-emerald-600 dark:hover:bg-slate-800 transition"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {registeredItems.length === 0 && (
                  <tr>
                    <td colSpan={16} className="px-4 py-8 text-center text-slate-400">
                      {loading ? t(lang, "crm.loading_action_tasks", "Loading action tasks...") : t(lang, "crm.no_active_items_tab", "No active items found for this tab.")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800 px-5 py-3 text-xs text-slate-500 bg-slate-50/30 dark:bg-slate-800/30">
            <div>
              {t(lang, "crm.pg_showing", "Showing")} <span className="font-bold text-slate-800 dark:text-slate-200">{registeredItems.length > 0 ? 1 : 0}</span> {t(lang, "crm.pg_to", "to")}{" "}
              <span className="font-bold text-slate-800 dark:text-slate-200">{registeredItems.length}</span> {t(lang, "crm.pg_of", "of")}{" "}
              <span className="font-bold text-slate-800 dark:text-slate-200">{registeredItems.length}</span> {t(lang, "crm.pg_records", "records")}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 font-semibold text-slate-400 opacity-50 cursor-not-allowed"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                {t(lang, "crm.previous", "Previous")}
              </button>
              <button
                type="button"
                className="rounded-lg bg-blue-600 px-2.5 py-1 font-bold text-white shadow-sm"
              >
                1
              </button>
              <button
                type="button"
                disabled
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 font-semibold text-slate-400 opacity-50 cursor-not-allowed"
              >
                {t(lang, "crm.next", "Next")}
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* 7. BOTTOM THREE WIDGETS (Screenshot 4 layout) */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Widget 1: Overdue Follow-Ups — real rows from dashboardData.overdueFollowUps */}
          <div className="rounded-2xl border border-rose-100 bg-white p-4 shadow-sm dark:border-rose-950/60 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-rose-100 pb-3 dark:border-rose-950/60">
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 rounded-full bg-rose-500"></span>
                <h3 className="text-xs font-black text-rose-950 dark:text-rose-200">
                  {t(lang, "crm.overdue_followups", "Overdue Follow-Ups")} ({(dashboardData?.overdueFollowUps || []).length})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab("overdue")}
                className="text-xs font-bold text-blue-600 hover:underline"
              >
                {t(lang, "crm.view_all", "View All")}
              </button>
            </div>
            <div className="mt-3 space-y-2.5 text-xs">
              {(dashboardData?.overdueFollowUps || []).length === 0 ? (
                <p className="text-slate-400 py-4 text-center">{t(lang, "crm.no_overdue_followups", "No overdue follow-ups.")}</p>
              ) : (
                (dashboardData.overdueFollowUps as any[]).map((f) => (
                  <div key={f.id} className="rounded-xl border border-rose-100/80 bg-rose-50/40 p-2.5 dark:border-rose-900/40 dark:bg-rose-950/20">
                    <div className="flex items-center justify-between font-bold text-slate-800 dark:text-slate-100">
                      <span>{f.party}</span>
                      <span className="text-rose-600">{f.currency} {Number(f.amount || 0).toLocaleString()}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                      <span>{f.source} · {f.overdueDays} {f.overdueDays === 1 ? "day" : "days"} overdue</span>
                      <button
                        type="button"
                        onClick={() => { setSelectedItemForNote({ id: f.id, party_name: f.party }); setNoteModalOpen(true); }}
                        className="font-semibold text-blue-600 hover:underline"
                      >
                        {t(lang, "crm.btn_add_note", "Add Note")}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Widget 2: Financial Summary — real per-currency totals; Cash/Bank honestly
              shown as "—" since no ledger/cash-bank query is wired into this service yet */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <h3 className="text-xs font-black text-slate-900 dark:text-slate-100">
                {t(lang, "crm.financial_summary_today", "Financial Summary")}
              </h3>
            </div>
            <div className="mt-3 space-y-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500 dark:text-slate-400 shrink-0">{t(lang, "crm.total_receivable", "Total Receivable")}:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 text-right">{formatByCurrency(financialSummary.totalReceivableByCurrency)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500 dark:text-slate-400 shrink-0">{t(lang, "crm.total_payable", "Total Payable")}:</span>
                <span className="font-bold text-rose-600 dark:text-rose-400 text-right">{formatByCurrency(financialSummary.totalPayableByCurrency)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">{t(lang, "crm.cash_in_hand", "Cash in Hand")}:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{"—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">{t(lang, "crm.bank_balance", "Bank Balance")}:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{"—"}</span>
              </div>
            </div>
          </div>

          {/* Widget 3: Quick Actions */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <h3 className="text-xs font-black text-slate-900 dark:text-slate-100">
                {t(lang, "crm.quick_actions", "Quick Actions")}
              </h3>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => router.push("/dashboard/journal/sales-order-payment/advance")}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/60 p-2.5 font-bold text-slate-700 hover:bg-purple-50 hover:text-purple-700 hover:border-purple-200 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-200 transition text-left"
              >
                <Plus className="h-3.5 w-3.5 text-purple-600 shrink-0" />
                <span className="text-[11px]">{t(lang, "crm.add_customer_receivable", "Add Customer Receivable")}</span>
              </button>

              <button
                type="button"
                onClick={() => router.push("/dashboard/journal/purchase-order-payment/advance")}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/60 p-2.5 font-bold text-slate-700 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-200 transition text-left"
              >
                <Plus className="h-3.5 w-3.5 text-rose-600 shrink-0" />
                <span className="text-[11px]">{t(lang, "crm.add_supplier_payable", "Add Supplier Payable")}</span>
              </button>

              <button
                type="button"
                onClick={() => router.push("/dashboard/roznamcha/cash-entry")}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/60 p-2.5 font-bold text-slate-700 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-200 transition text-left"
              >
                <Plus className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                <span className="text-[11px]">{t(lang, "crm.add_cheque", "Add Cheque")}</span>
              </button>

              <button
                type="button"
                onClick={() => router.push("/dashboard/shipping-line")}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/60 p-2.5 font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-200 transition text-left"
              >
                <Plus className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                <span className="text-[11px]">{t(lang, "crm.add_shipping_due", "Add Shipping Due")}</span>
              </button>

              {/* No real WhatsApp broadcast integration exists yet for this screen
                  (whatsapp_accounts / communication-center supports single-thread
                  messaging, not a bulk follow-up broadcast) — disabled with an honest
                  label instead of a fake "Launching..." alert. */}
              <button
                type="button"
                disabled
                title={t(lang, "crm.not_available_yet", "Not available yet")}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/60 p-2.5 font-bold text-slate-400 dark:border-slate-800 dark:bg-slate-800/60 opacity-50 cursor-not-allowed text-left"
              >
                <MessageCircle className="h-3.5 w-3.5 shrink-0" />
                <span className="text-[11px]">{t(lang, "crm.btn_send_whatsapp", "Send Message / WhatsApp")}</span>
              </button>

              <button
                type="button"
                onClick={() => router.push("/dashboard/reports")}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/60 p-2.5 font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-200 transition text-left"
              >
                <FileText className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                <span className="text-[11px]">{t(lang, "crm.generate_due_report", "Generate Due Report")}</span>
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* ── FOLLOW-UP NOTE MODAL ── */}
      {noteModalOpen && (
        <Dialog open={noteModalOpen} onOpenChange={(open) => !open && setNoteModalOpen(false)}>
          <DialogContent className="max-w-md font-sans" dir={isRtl ? "rtl" : "ltr"}>
            <DialogHeader>
              <DialogTitle className="text-base font-black">
                {selectedItemForNote ? `${t(lang, "crm.followup_for_prefix", "Follow-Up:")} ${selectedItemForNote.party_name}` : t(lang, "crm.add_followup_note_title", "Add CRM Follow-Up Note")}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t(lang, "crm.follow_up_action_type", "Follow-Up Action Type")}
                </label>
                <select
                  value={noteType}
                  onChange={(e) => setNoteType(e.target.value)}
                  className="w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 font-semibold text-xs"
                >
                  <option value="Call Follow-Up">{t(lang, "crm.ftype_call", "Phone Call Follow-Up")}</option>
                  <option value="WhatsApp Message">{t(lang, "crm.ftype_whatsapp", "WhatsApp Follow-Up")}</option>
                  <option value="In-Person Meeting">{t(lang, "crm.ftype_meeting", "In-Person Meeting")}</option>
                  <option value="Promise to Pay">{t(lang, "crm.ftype_promise", "Promise to Pay")}</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t(lang, "crm.follow_up_notes_outcome", "Follow-Up Notes / Outcome")}
                </label>
                <textarea
                  rows={3}
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder={t(lang, "crm.note_ph", "Enter client response, payment commitment or notes...")}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5 font-sans text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t(lang, "crm.promise_date", "Promise Date")}
                  </label>
                  <Input
                    type="date"
                    value={promiseDate}
                    onChange={(e) => setPromiseDate(e.target.value)}
                    className="h-8.5 text-xs bg-slate-50 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t(lang, "crm.promise_amount", "Promise Amount")}
                  </label>
                  <Input
                    type="number"
                    value={promiseAmount}
                    onChange={(e) => setPromiseAmount(e.target.value)}
                    placeholder="0.00"
                    className="h-8.5 text-xs bg-slate-50 dark:bg-slate-800"
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="border-t pt-3">
              <Button type="button" variant="outline" size="sm" onClick={() => setNoteModalOpen(false)}>
                {t(lang, "common.cancel", "Cancel")}
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSaveNote}
                disabled={savingNote || !noteText.trim()}
                className="bg-blue-600 hover:bg-blue-700 text-white font-black"
              >
                {savingNote ? t(lang, "common.saving", "Saving...") : t(lang, "crm.btn_add_note", "Add Note")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

    </div>
  );
}
