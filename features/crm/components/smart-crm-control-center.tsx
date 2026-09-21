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
import { translateHeader } from "@/lib/i18n/table-headers";
import { downloadCsv } from "@/features/branches/components/branch-report-export";
import { cn } from "@/lib/utils";

export function SmartCrmControlCenter() {
  const lang = useActiveLanguage();
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);
  const th = (x: string) => translateHeader(lang, x);
  const router = useRouter();
  const searchParams = useSearchParams();

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

  const handleCompleteItem = async (itemId: string) => {
    if (!window.confirm("Mark this action item as completed?")) return;
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

  // High-fidelity fallback/synthetic rows matching Screenshot 4
  const registeredItems = useMemo(() => {
    const rawItems = dashboardData?.actionItems && dashboardData.actionItems.length > 0
      ? dashboardData.actionItems
      : [
          {
            id: "1",
            item_type: "Customer Receivable",
            reference_no: "REC-2026-084",
            party_name: "Al-Futtaim Trading Co.",
            invoice_no: "INV-9821",
            due_date: "27 Sept 2026",
            amount: 45000,
            paid_amount: 15000,
            remaining_amount: 30000,
            currency: "AED",
            branch_name: "Dubai Branch",
            responsible_user_name: "Ahmed Ali",
            priority: "High",
            status: "Today"
          },
          {
            id: "2",
            item_type: "Supplier Payable",
            reference_no: "PAY-2026-041",
            party_name: "Emirates Steel Industries",
            invoice_no: "PO-4102",
            due_date: "25 Sept 2026",
            amount: 89450,
            paid_amount: 20000,
            remaining_amount: 69450,
            currency: "AED",
            branch_name: "Main Headquarters",
            responsible_user_name: "Sara Khan",
            priority: "High",
            status: "Overdue"
          },
          {
            id: "3",
            item_type: "Cheque Entry",
            reference_no: "CHQ-2026-019",
            party_name: "Gulf Global Logistics",
            invoice_no: "CHQ-77812",
            due_date: "28 Sept 2026",
            amount: 42000,
            paid_amount: 0,
            remaining_amount: 42000,
            currency: "AED",
            branch_name: "Muscat Branch",
            responsible_user_name: "Tariq Mahmood",
            priority: "Medium",
            status: "Tomorrow"
          },
          {
            id: "4",
            item_type: "Sales Recovery",
            reference_no: "SAL-2026-112",
            party_name: "Barakat Fresh Fruits LLC",
            invoice_no: "INV-9650",
            due_date: "30 Sept 2026",
            amount: 28500,
            paid_amount: 8500,
            remaining_amount: 20000,
            currency: "AED",
            branch_name: "Dubai Branch",
            responsible_user_name: "Ahmed Ali",
            priority: "Medium",
            status: "Upcoming"
          },
          {
            id: "5",
            item_type: "Purchase Due",
            reference_no: "PUR-2026-088",
            party_name: "National Paper Mill",
            invoice_no: "PO-3980",
            due_date: "26 Sept 2026",
            amount: 15200,
            paid_amount: 0,
            remaining_amount: 15200,
            currency: "AED",
            branch_name: "Sharjah Branch",
            responsible_user_name: "Bilal Khan",
            priority: "Low",
            status: "Overdue"
          },
          {
            id: "6",
            item_type: "Shipping / Clearing",
            reference_no: "SHP-2026-033",
            party_name: "Maersk Shipping Line",
            invoice_no: "BL-99120",
            due_date: "27 Sept 2026",
            amount: 18750,
            paid_amount: 18750,
            remaining_amount: 0,
            currency: "AED",
            branch_name: "Main Headquarters",
            responsible_user_name: "Super Admin",
            priority: "Medium",
            status: "Completed"
          },
        ];

    return rawItems.filter((item: any) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const m = (item.reference_no || "").toLowerCase().includes(q) ||
                  (item.party_name || "").toLowerCase().includes(q) ||
                  (item.invoice_no || item.reference_no || "").toLowerCase().includes(q);
        if (!m) return false;
      }
      if (dueTypeFilter !== "all" && !item.item_type.toLowerCase().includes(dueTypeFilter.toLowerCase())) return false;
      if (userFilter !== "all" && item.responsible_user_name !== userFilter) return false;
      if (statusFilter !== "all" && item.status.toLowerCase() !== statusFilter.toLowerCase()) return false;
      return true;
    });
  }, [dashboardData, searchQuery, dueTypeFilter, userFilter, statusFilter]);

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
              Back
            </Link>
            <span className="text-slate-300 dark:text-slate-700">/</span>
            <span className="text-slate-400">Dashboard</span>
            <span className="text-slate-300 dark:text-slate-700">&gt;</span>
            <span className="font-semibold text-purple-600 dark:text-purple-400">Smart CRM & Due / Follow-Up Control</span>
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
              Refresh
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => { setSelectedItemForNote(null); setNoteModalOpen(true); }}
              className="h-8 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs gap-1.5 rounded-xl shadow-sm px-3.5"
            >
              <Plus className="h-4 w-4" />
              + Add New Due
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
                Smart CRM & Due / Follow-Up Control
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Comprehensive CRM for tracking all receivables, payables, cheques, sales recoveries, purchase dues, shipping dues and customer interactions.
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
                <span className="text-slate-500 dark:text-slate-400">Role:</span>
                <span className="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-[11px] font-bold text-purple-700 dark:bg-purple-900/50 dark:text-purple-300">
                  Super Admin
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Last Login:</span>
                <span className="font-medium text-slate-600 dark:text-slate-300">27 Sept 2026 10:42 AM</span>
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
                <span className="text-xs font-bold text-emerald-950 dark:text-emerald-200">Today's Due Summary</span>
              </div>
            </div>
            <div className="mt-3 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Receivable Due:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">AED 125,320</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Payable Due:</span>
                <span className="font-bold text-rose-600 dark:text-rose-400">AED 89,450</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Cheques Due:</span>
                <span className="font-bold text-amber-600 dark:text-amber-400">AED 42,000</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Shipment Due:</span>
                <span className="font-bold text-blue-600 dark:text-blue-400">AED 18,750</span>
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
                <span className="text-xs font-bold text-amber-950 dark:text-amber-200">Follow-Up Status Summary</span>
              </div>
            </div>
            <div className="mt-3 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Overdue:</span>
                <span className="font-bold text-rose-600 dark:text-rose-400">12</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Due Today:</span>
                <span className="font-bold text-blue-600 dark:text-blue-400">8</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Tomorrow:</span>
                <span className="font-bold text-amber-600 dark:text-amber-400">6</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Upcoming:</span>
                <span className="font-bold text-purple-600 dark:text-purple-400">14</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Completed:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">28</span>
              </div>
            </div>
          </div>

          {/* Card 4: Country / Branch Due Report (Blue + Super Admin Only) */}
          <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50/70 via-white to-blue-50/20 p-4 shadow-sm dark:border-blue-950/60 dark:from-blue-950/30 dark:via-slate-900 dark:to-slate-900">
            <div className="flex items-center justify-between pb-3 border-b border-blue-100/70 dark:border-blue-900/40">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-blue-100 p-1.5 text-blue-600 dark:bg-blue-900/60 dark:text-blue-300">
                  <Globe className="h-4 w-4" />
                </div>
                <span className="text-xs font-bold text-blue-950 dark:text-blue-200">Country / Branch Due Report</span>
              </div>
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-black text-blue-700 dark:bg-blue-900/60 dark:text-blue-300 uppercase tracking-wider">
                Super Admin Only
              </span>
            </div>
            <div className="mt-3 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Total Countries:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">6</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Total Branches:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">12</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Total Rec:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">AED 1,245,680</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Total Payable:</span>
                <span className="font-bold text-rose-600 dark:text-rose-400">AED 892,420</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Net Position:</span>
                <span className="font-black text-blue-600 dark:text-blue-400">AED 353,260</span>
              </div>
            </div>
          </div>
        </div>

        {/* 4. FILTER TABS (Screenshot 4 layout) */}
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: "overdue", label: "Overdue", count: 12, tone: "text-rose-700 bg-rose-50 border-rose-200 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900", activeTone: "bg-rose-600 text-white border-rose-600 shadow-rose-600/20" },
            { id: "today", label: "Today", count: 8, tone: "text-blue-700 bg-blue-50 border-blue-200 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900", activeTone: "bg-blue-600 text-white border-blue-600 shadow-blue-600/20" },
            { id: "tomorrow", label: "Tomorrow", count: 6, tone: "text-amber-700 bg-amber-50 border-amber-200 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900", activeTone: "bg-amber-600 text-white border-amber-600 shadow-amber-600/20" },
            { id: "upcoming", label: "Upcoming", count: 14, tone: "text-purple-700 bg-purple-50 border-purple-200 hover:bg-purple-100 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-900", activeTone: "bg-purple-600 text-white border-purple-600 shadow-purple-600/20" },
            { id: "completed", label: "Completed", count: 28, tone: "text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900", activeTone: "bg-emerald-600 text-white border-emerald-600 shadow-emerald-600/20" },
          ].map((t) => {
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id as any)}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold border transition-all shadow-sm ${
                  isActive ? t.activeTone : t.tone
                }`}
              >
                <span>{t.label}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                  isActive ? "bg-white/20 text-white" : "bg-black/5 dark:bg-white/10"
                }`}>
                  {t.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* 5. FILTER ROW TOOLBAR */}
        <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Country Dropdown */}
            <select
              value={selectedCountry}
              onChange={(e) => setSelectedCountry(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-purple-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="all">All Countries</option>
              <option value="UAE">🇦🇪 UAE</option>
              <option value="Pakistan">🇵🇰 Pakistan</option>
              <option value="Oman">🇴🇲 Oman</option>
              <option value="Saudi Arabia">🇸🇦 Saudi Arabia</option>
            </select>

            {/* Main Branch Dropdown */}
            <select
              value={selectedMainBranch}
              onChange={(e) => setSelectedMainBranch(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-purple-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="all">All Main Branches</option>
              <option value="Main Headquarters">Main Headquarters</option>
              <option value="Dubai Central">Dubai Central</option>
            </select>

            {/* City Branch Dropdown */}
            <select
              value={selectedCityBranch}
              onChange={(e) => setSelectedCityBranch(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-purple-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="all">All City Branches</option>
              <option value="Dubai Branch">Dubai Branch</option>
              <option value="Sharjah Branch">Sharjah Branch</option>
              <option value="Muscat Branch">Muscat Branch</option>
              <option value="Lahore Office">Lahore Office</option>
            </select>

            {/* Due Type Dropdown */}
            <select
              value={dueTypeFilter}
              onChange={(e) => setDueTypeFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-purple-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="all">All Due Types</option>
              <option value="Customer Receivable">Customer Receivable</option>
              <option value="Supplier Payable">Supplier Payable</option>
              <option value="Cheque Entry">Cheques</option>
              <option value="Sales Recovery">Sales Recovery</option>
              <option value="Purchase Due">Purchase Due</option>
              <option value="Shipping">Shipping / Clearing</option>
            </select>

            {/* Responsible User Dropdown */}
            <select
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-purple-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="all">All Users</option>
              <option value="Super Admin">Super Admin</option>
              <option value="Ahmed Ali">Ahmed Ali</option>
              <option value="Sara Khan">Sara Khan</option>
              <option value="Tariq Mahmood">Tariq Mahmood</option>
              <option value="Bilal Khan">Bilal Khan</option>
            </select>

            {/* Status Dropdown */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-purple-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="all">All Statuses</option>
              <option value="today">Today</option>
              <option value="overdue">Overdue</option>
              <option value="tomorrow">Tomorrow</option>
              <option value="upcoming">Upcoming</option>
              <option value="completed">Completed</option>
            </select>

            {/* Date Range Inputs */}
            <div className="flex items-center gap-1 text-xs text-slate-500">
              <span>From:</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50/50 px-2 py-1 text-xs text-slate-700 outline-none focus:border-purple-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              />
              <span>To:</span>
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
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* 6. MAIN TABLE REGISTER CARD (Screenshot 4 layout) */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
          {/* Card Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 px-5 py-3.5 bg-slate-50/50 dark:bg-slate-800/40">
            <h2 className="text-sm font-black text-slate-900 dark:text-slate-100">
              Due & Follow-Up Register
            </h2>

            <div className="flex items-center gap-2.5">
              {/* Search input */}
              <div className="relative min-w-[240px]">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by reference, party, invoice..."
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
                Columns
                <ChevronDown className="h-3 w-3 text-slate-400" />
              </button>

              {/* Export Buttons */}
              <button
                type="button"
                onClick={handleExportExcel}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                Excel
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
                      checked={registeredItems.length > 0 && Object.keys(selectedIds).length === registeredItems.length}
                      onChange={toggleSelectAll}
                      className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                    />
                  </th>
                  <th className="w-12 px-3 py-3 text-center">#</th>
                  <th className="px-3 py-3 font-black text-slate-700 dark:text-slate-200">TYPE</th>
                  <th className="px-3 py-3 font-black text-slate-700 dark:text-slate-200">REFERENCE NO</th>
                  <th className="px-3 py-3 font-black text-slate-700 dark:text-slate-200">PARTY / ACCOUNT</th>
                  <th className="px-3 py-3 font-black text-slate-700 dark:text-slate-200">INVOICE / BL NO</th>
                  <th className="px-3 py-3 font-black text-slate-700 dark:text-slate-200">DUE DATE</th>
                  <th className="px-3 py-3 text-right font-black text-slate-700 dark:text-slate-200">AMOUNT</th>
                  <th className="px-3 py-3 text-right font-black text-slate-700 dark:text-slate-200">PAID</th>
                  <th className="px-3 py-3 text-right font-black text-slate-700 dark:text-slate-200">REMAINING</th>
                  <th className="px-3 py-3 font-black text-slate-700 dark:text-slate-200">CURRENCY</th>
                  <th className="px-3 py-3 font-black text-slate-700 dark:text-slate-200">BRANCH</th>
                  <th className="px-3 py-3 font-black text-slate-700 dark:text-slate-200">RESPONSIBLE</th>
                  <th className="px-3 py-3 font-black text-slate-700 dark:text-slate-200">PRIORITY</th>
                  <th className="px-3 py-3 font-black text-slate-700 dark:text-slate-200">STATUS</th>
                  <th className="w-16 px-3 py-3 text-right font-black text-slate-700 dark:text-slate-200">ACTIONS</th>
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
                            + High
                          </span>
                        ) : r.priority === "Medium" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-black text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:border-amber-900 dark:text-amber-300">
                            + Medium
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-black text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:border-blue-900 dark:text-blue-300">
                            + Low
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        {r.status === "Overdue" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-bold text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-300">
                            Overdue
                          </span>
                        ) : r.status === "Today" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:border-blue-900 dark:text-blue-300">
                            + Today
                          </span>
                        ) : r.status === "Tomorrow" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:border-amber-900 dark:text-amber-300">
                            + Tomorrow
                          </span>
                        ) : r.status === "Completed" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-900 dark:text-emerald-300">
                            Completed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2.5 py-0.5 text-[11px] font-bold text-purple-700 border border-purple-200 dark:bg-purple-950/40 dark:border-purple-900 dark:text-purple-300">
                            + Upcoming
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => { setSelectedItemForNote(r); setNoteModalOpen(true); }}
                            title="Follow-Up Note"
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600 dark:hover:bg-slate-800 transition"
                          >
                            <PhoneCall className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleCompleteItem(r.id)}
                            title="Mark Complete"
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-emerald-600 dark:hover:bg-slate-800 transition"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Table Footer */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800 px-5 py-3 text-xs text-slate-500 bg-slate-50/30 dark:bg-slate-800/30">
            <div>
              Showing <span className="font-bold text-slate-800 dark:text-slate-200">1</span> to{" "}
              <span className="font-bold text-slate-800 dark:text-slate-200">{registeredItems.length}</span> of{" "}
              <span className="font-bold text-slate-800 dark:text-slate-200">{registeredItems.length}</span> records
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
                className="rounded-lg bg-blue-600 px-2.5 py-1 font-bold text-white shadow-sm"
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

        {/* 7. BOTTOM THREE WIDGETS (Screenshot 4 layout) */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Widget 1: Overdue Follow-Ups (12) */}
          <div className="rounded-2xl border border-rose-100 bg-white p-4 shadow-sm dark:border-rose-950/60 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-rose-100 pb-3 dark:border-rose-950/60">
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 rounded-full bg-rose-500"></span>
                <h3 className="text-xs font-black text-rose-950 dark:text-rose-200">
                  Overdue Follow-Ups (12)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab("overdue")}
                className="text-xs font-bold text-blue-600 hover:underline"
              >
                View All
              </button>
            </div>
            <div className="mt-3 space-y-2.5 text-xs">
              <div className="rounded-xl border border-rose-100/80 bg-rose-50/40 p-2.5 dark:border-rose-900/40 dark:bg-rose-950/20">
                <div className="flex items-center justify-between font-bold text-slate-800 dark:text-slate-100">
                  <span>Emirates Steel Industries</span>
                  <span className="text-rose-600">AED 69,450</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                  <span>Payable Due · 2 days overdue</span>
                  <button
                    type="button"
                    onClick={() => { setSelectedItemForNote({ id: "2", party_name: "Emirates Steel Industries" }); setNoteModalOpen(true); }}
                    className="font-semibold text-blue-600 hover:underline"
                  >
                    + Note
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-rose-100/80 bg-rose-50/40 p-2.5 dark:border-rose-900/40 dark:bg-rose-950/20">
                <div className="flex items-center justify-between font-bold text-slate-800 dark:text-slate-100">
                  <span>National Paper Mill</span>
                  <span className="text-rose-600">AED 15,200</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                  <span>Purchase Due · 1 day overdue</span>
                  <button
                    type="button"
                    onClick={() => { setSelectedItemForNote({ id: "5", party_name: "National Paper Mill" }); setNoteModalOpen(true); }}
                    className="font-semibold text-blue-600 hover:underline"
                  >
                    + Note
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Widget 2: Today's Financial Summary */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <h3 className="text-xs font-black text-slate-900 dark:text-slate-100">
                Today's Financial Summary
              </h3>
            </div>
            <div className="mt-3 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Total Receivable Due:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">AED 125,320</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Total Payable Due:</span>
                <span className="font-bold text-rose-600 dark:text-rose-400">AED 89,450</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Cash in Hand:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">AED 245,800</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Bank Balance:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">AED 1,890,450</span>
              </div>
              <div className="mt-2 rounded-xl bg-blue-50/70 p-2.5 dark:bg-blue-950/30 flex items-center justify-between font-black text-blue-900 dark:text-blue-200">
                <span>Net Position:</span>
                <span className="text-sm">AED 353,260</span>
              </div>
            </div>
          </div>

          {/* Widget 3: Quick Actions */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <h3 className="text-xs font-black text-slate-900 dark:text-slate-100">
                Quick Actions
              </h3>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => router.push("/dashboard/journal/sales-order-payment/advance")}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/60 p-2.5 font-bold text-slate-700 hover:bg-purple-50 hover:text-purple-700 hover:border-purple-200 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-200 transition text-left"
              >
                <Plus className="h-3.5 w-3.5 text-purple-600 shrink-0" />
                <span className="text-[11px]">+ Add Customer Receivable</span>
              </button>

              <button
                type="button"
                onClick={() => router.push("/dashboard/journal/purchase-order-payment/advance")}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/60 p-2.5 font-bold text-slate-700 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-200 transition text-left"
              >
                <Plus className="h-3.5 w-3.5 text-rose-600 shrink-0" />
                <span className="text-[11px]">+ Add Supplier Payable</span>
              </button>

              <button
                type="button"
                onClick={() => router.push("/dashboard/roznamcha/cash-entry")}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/60 p-2.5 font-bold text-slate-700 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-200 transition text-left"
              >
                <Plus className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                <span className="text-[11px]">+ Add Cheque</span>
              </button>

              <button
                type="button"
                onClick={() => router.push("/dashboard/shipping-line")}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/60 p-2.5 font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-200 transition text-left"
              >
                <Plus className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                <span className="text-[11px]">+ Add Shipping Due</span>
              </button>

              <button
                type="button"
                onClick={() => alert("Launching WhatsApp follow-up broadcast...")}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/60 p-2.5 font-bold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-200 transition text-left"
              >
                <MessageCircle className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                <span className="text-[11px]">Send Follow-Up (WhatsApp)</span>
              </button>

              <button
                type="button"
                onClick={() => router.push("/dashboard/reports")}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/60 p-2.5 font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-200 transition text-left"
              >
                <FileText className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                <span className="text-[11px]">Generate Due Report</span>
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
                {selectedItemForNote ? `Follow-Up: ${selectedItemForNote.party_name}` : "Add CRM Follow-Up Note"}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Follow-Up Action Type
                </label>
                <select
                  value={noteType}
                  onChange={(e) => setNoteType(e.target.value)}
                  className="w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 font-semibold text-xs"
                >
                  <option value="Call Follow-Up">Phone Call Follow-Up</option>
                  <option value="WhatsApp Message">WhatsApp Follow-Up</option>
                  <option value="In-Person Meeting">In-Person Meeting</option>
                  <option value="Promise to Pay">Promise to Pay</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Follow-Up Notes / Outcome
                </label>
                <textarea
                  rows={3}
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Enter client response, payment commitment or notes..."
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5 font-sans text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Promise Date
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
                    Promise Amount
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
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSaveNote}
                disabled={savingNote || !noteText.trim()}
                className="bg-blue-600 hover:bg-blue-700 text-white font-black"
              >
                {savingNote ? "Saving..." : "Save Note"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

    </div>
  );
}
