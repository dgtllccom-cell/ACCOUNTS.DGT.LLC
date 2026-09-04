"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  CalendarCheck,
  CreditCard,
  ShoppingCart,
  TrendingUp,
  Ship,
  Clock,
  Landmark,
  FileEdit,
  DollarSign,
  Users,
  Building2,
  FileText,
  Calendar as CalendarIcon,
  Bell,
  StickyNote,
  Settings,
  Search,
  RefreshCw,
  Eye,
  CheckCircle2,
  PhoneCall,
  MessageCircle,
  Download,
  Printer,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Globe,
  Share2,
  Send,
  Plus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

  // Filters State
  const [selectedCountry, setSelectedCountry] = useState("all");
  const [selectedMainBranch, setSelectedMainBranch] = useState("all");
  const [selectedCityBranch, setSelectedCityBranch] = useState("all");

  // Scope dropdown data — loaded from real, session-scoped ERP master data
  const [countryOptions, setCountryOptions] = useState<{ id: string; name: string }[]>([]);
  const [mainBranchOptions, setMainBranchOptions] = useState<{ id: string; name: string; country_id?: string }[]>([]);
  const [cityBranchOptions, setCityBranchOptions] = useState<{ id: string; name: string; country_id?: string }[]>([]);
  const [targetDate, setTargetDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [activeTab, setActiveTab] = useState<"today" | "overdue" | "tomorrow" | "upcoming" | "completed">("today");
  const [searchQuery, setSearchQuery] = useState("");

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

  const calendarInfo = React.useMemo(() => {
    const d = new Date(targetDate);
    const validDate = isNaN(d.getTime()) ? new Date() : d;
    const year = validDate.getFullYear();
    const month = validDate.getMonth();
    const selectedDay = validDate.getDate();
    
    // First day of the month (0 = Sun, 1 = Mon, ...)
    const firstDay = new Date(year, month, 1).getDay();
    // Monday = 0, Sunday = 6
    const startOffset = (firstDay + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const monthName = validDate.toLocaleString(`${lang}-u-ca-gregory-nu-latn`, { month: "long", year: "numeric", calendar: "gregory", numberingSystem: "latn" });
    
    return { year, month, selectedDay, startOffset, daysInMonth, monthName };
  }, [targetDate, lang]);

  useEffect(() => {
    fetchDashboardData();
  }, [selectedCountry, selectedMainBranch, selectedCityBranch, targetDate, activeTab]);

  // Load real scope master data (countries + branches), scoped to the session on the API side
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
          setMainBranchOptions((d.countryBranches ?? []).map((b: any) => ({ id: b.id, name: b.name, country_id: b.country_id })));
        }
        if (bRes.ok) {
          const d = await bRes.json();
          setCityBranchOptions((d.cityBranches ?? []).map((b: any) => ({ id: b.id, name: b.name, country_id: b.country_id })));
        }
      } catch {
        /* selectors simply stay at "All" — never fall back to fabricated options */
      }
    }
    loadScopeMeta();
    return () => { cancelled = true; };
  }, []);

  async function fetchDashboardData() {
    setLoading(true);
    try {
      const qp = new URLSearchParams({
        targetDate: targetDate,
        tab: activeTab
      });
      if (selectedCountry && selectedCountry !== "all") qp.set("countryId", selectedCountry);
      if (selectedMainBranch && selectedMainBranch !== "all") qp.set("countryBranchId", selectedMainBranch);
      if (selectedCityBranch && selectedCityBranch !== "all") qp.set("cityBranchId", selectedCityBranch);
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
  }

  async function handleCompleteItem(itemId: string) {
    if (!window.confirm("Mark this action item as completed?")) return;
    try {
      const res = await fetch("/api/erp/crm/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ crmItemId: itemId, remarks: "Completed via CRM Control Center" })
      });
      const data = await res.json();
      if (data.success) {
        fetchDashboardData();
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function handleSaveNote() {
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
        fetchDashboardData();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSavingNote(false);
    }
  }

  function handleExportExcel() {
    if (!dashboardData?.actionItems?.length) return;
    const headers = ["#", "Type", "Due Date", "Party / Account", "Source", "Invoice / Bill No.", "Amount", "Paid", "Remaining", "Currency", "Branch", "Responsible", "Status"];
    const rows = dashboardData.actionItems.map((r: any, idx: number) => [
      String(idx + 1),
      String(r.item_type || ""),
      String(r.due_date || ""),
      String(r.party_name || ""),
      String(r.module || ""),
      String(r.reference_no || ""),
      String(r.amount || 0),
      String(r.paid_amount || 0),
      String(r.remaining_amount || 0),
      String(r.currency || ""),
      String(r.branch_name || "—"),
      String(r.responsible_user_name || "—"),
      String(r.status || "")
    ]);
    downloadCsv(`crm_action_list_${activeTab}_${targetDate}.csv`, [headers, ...rows]);
  }

  function tabLabel(tab: string): string {
    switch (tab) {
      case "today": return t(lang, "crm.tab_todays_action_list", "Today's Action List");
      case "overdue": return t(lang, "crm.tab_overdue", "Overdue");
      case "tomorrow": return t(lang, "crm.tab_tomorrow", "Tomorrow");
      case "upcoming": return t(lang, "crm.tab_upcoming", "Upcoming");
      case "completed": return t(lang, "crm.tab_completed", "Completed");
      default: return tab.charAt(0).toUpperCase() + tab.slice(1);
    }
  }

  function handlePrint() {
    const items = dashboardData?.actionItems || [];
    void import("@/lib/reports/open-generic-erp-report").then(({ openGenericErpReport }) => {
      openGenericErpReport({
        title: "CRM Smart Action List",
        lang,
        orientation: "landscape",
        columns: [
          { key: "item_type", label: "Type" },
          { key: "due_date", label: "Due Date", format: "date" },
          { key: "party_name", label: "Party / Account" },
          { key: "module", label: "Source" },
          { key: "reference_no", label: "Invoice / Bill No." },
          { key: "amount", label: "Amount", align: "right", format: "currency" },
          { key: "paid_amount", label: "Paid", align: "right", format: "currency" },
          { key: "remaining_amount", label: "Remaining", align: "right", format: "currency" },
          { key: "currency", label: "Currency" },
          { key: "branch_name", label: "Branch" },
          { key: "responsible_user_name", label: "Responsible" },
          { key: "status", label: "Status", format: "status" },
        ],
        rows: items as Record<string, unknown>[],
        filters: [
          { label: t(lang, "crm.filter_tab", "View"), value: tabLabel(activeTab) },
          { label: t(lang, "crm.filter_date", "Date"), value: String(targetDate) },
          { label: t(lang, "crm.filter_records", "Records"), value: String(items.length) },
        ],
        totalsRow: {
          amount: items.reduce((s: number, r: any) => s + (Number(r.amount) || 0), 0),
          paid_amount: items.reduce((s: number, r: any) => s + (Number(r.paid_amount) || 0), 0),
          remaining_amount: items.reduce((s: number, r: any) => s + (Number(r.remaining_amount) || 0), 0),
        },
      });
    });
  }

  const kpis = dashboardData?.kpis || {
    chequesDepositCount: 0,
    chequesDepositAmount: 0,
    chequesPayCount: 0,
    chequesPayAmount: 0,
    chequesCollectCount: 0,
    chequesCollectAmount: 0,
    purchaseDueCount: 0,
    purchaseDueAmount: 0,
    salesRecoveryCount: 0,
    salesRecoveryAmount: 0,
    shippingDueCount: 0,
    shippingDueAmount: 0,
    overdueCount: 0,
    overdueAmount: 0
  };

  const actionItems = dashboardData?.actionItems || [];
  const overdueFollowUps = dashboardData?.overdueFollowUps || [];
  const upcomingImportant = dashboardData?.upcomingImportant || [];
  const financialSummary = dashboardData?.financialSummary || {
    totalReceivable: 0,
    totalPayable: 0,
    cashInHand: 0,
    bankBalance: 0,
    netPosition: 0
  };
  const erpSerials = dashboardData?.erpSerials || {
    globalSerial: "—",
    countrySerial: "—",
    branchSerial: "—",
    entrySerial: "—",
    userCode: "—"
  };

  return (
    <div className="min-h-screen bg-[#F0F4F8] dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 flex flex-col" dir={isRtl ? "rtl" : "ltr"}>
      
      {/* ── MAIN WORKSPACE CONTAINER ── */}
      <div className="flex-1 flex flex-row w-full overflow-hidden">

        {/* ── LEFT CRM SUB-NAVIGATION SIDEBAR ── */}
        <aside className="w-56 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 shrink-0 hidden xl:flex flex-col justify-between p-3.5 border-r border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="space-y-4">
            {/* CRM Header */}
            <div className="flex flex-col items-center justify-center p-2.5 border-b border-slate-100 dark:border-slate-800 text-center">
              <span className="text-lg font-black tracking-wide text-slate-900 dark:text-white">{t(lang, "crm.title", "Smart CRM & Due")}</span>
            </div>

            {/* Sub-Nav Menu Items */}
            <nav className="space-y-1 text-xs">
              <button
                type="button"
                onClick={() => { setActiveTab("today"); }}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg font-bold transition",
                  activeTab === "today"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                )}
              >
                <LayoutDashboard className="h-4 w-4" />
                <span>{t(lang, "crm.nav_dashboard", "CRM Dashboard")}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("today")}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 font-medium text-slate-700 dark:text-slate-300 transition"
              >
                <CalendarCheck className="h-4 w-4 text-blue-600" />
                <span>{t(lang, "crm.nav_action_center", "Today's Action Center")}</span>
              </button>

              <button
                type="button"
                onClick={() => router.push("/dashboard/roznamcha/cash-entry")}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 font-medium text-slate-700 dark:text-slate-300 transition"
              >
                <CreditCard className="h-4 w-4 text-emerald-600" />
                <span>{t(lang, "crm.nav_cheques_cash", "Cheques & Cash")}</span>
              </button>

              <button
                type="button"
                onClick={() => router.push("/dashboard/journal/purchase-order-payment")}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 font-medium text-slate-700 dark:text-slate-300 transition"
              >
                <ShoppingCart className="h-4 w-4 text-amber-600" />
                <span>{t(lang, "crm.nav_purchase_due", "Purchase Due")}</span>
              </button>

              <button
                type="button"
                onClick={() => router.push("/dashboard/journal/sales-order-payment")}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 font-medium text-slate-700 dark:text-slate-300 transition"
              >
                <TrendingUp className="h-4 w-4 text-purple-600" />
                <span>{t(lang, "crm.nav_sales_recovery", "Sales Recovery")}</span>
              </button>

              <button
                type="button"
                onClick={() => router.push("/dashboard/shipping-line")}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 font-medium text-slate-700 dark:text-slate-300 transition"
              >
                <Ship className="h-4 w-4 text-indigo-600" />
                <span>{t(lang, "crm.nav_shipping_clearing", "Shipping / Clearing")}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("overdue")}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium transition",
                  activeTab === "overdue"
                    ? "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 font-bold"
                    : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                )}
              >
                <Clock className="h-4 w-4 text-rose-600" />
                <span>{t(lang, "crm.nav_followups", "Follow-Ups")}</span>
              </button>

              <button
                type="button"
                onClick={() => router.push("/dashboard/settings/customers")}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 font-medium text-slate-700 dark:text-slate-300 transition"
              >
                <Users className="h-4 w-4 text-blue-600" />
                <span>{t(lang, "crm.nav_customers", "Customers")}</span>
              </button>

              <button
                type="button"
                onClick={() => router.push("/dashboard/settings/companies")}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 font-medium text-slate-700 dark:text-slate-300 transition"
              >
                <Building2 className="h-4 w-4 text-slate-600" />
                <span>{t(lang, "crm.nav_companies_suppliers", "Companies / Suppliers")}</span>
              </button>

              <button
                type="button"
                onClick={() => router.push("/dashboard/reports")}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 font-medium text-slate-700 dark:text-slate-300 transition"
              >
                <FileText className="h-4 w-4 text-indigo-600" />
                <span>{t(lang, "crm.nav_reports", "Reports")}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("upcoming")}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium transition",
                  activeTab === "upcoming"
                    ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 font-bold"
                    : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                )}
              >
                <CalendarIcon className="h-4 w-4 text-amber-600" />
                <span>{t(lang, "crm.nav_calendar", "Calendar")}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("tomorrow")}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 font-medium text-slate-700 dark:text-slate-300 transition"
              >
                <Bell className="h-4 w-4 text-slate-500" />
                <span>{t(lang, "crm.nav_reminders", "Reminders")}</span>
              </button>

              <button
                type="button"
                onClick={() => setNoteModalOpen(true)}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 font-medium text-slate-700 dark:text-slate-300 transition"
              >
                <StickyNote className="h-4 w-4 text-teal-600" />
                <span>{t(lang, "crm.nav_notes", "Notes")}</span>
              </button>

              <button
                type="button"
                onClick={() => router.push("/dashboard/settings/dashboard-settings")}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 font-medium text-slate-700 dark:text-slate-300 transition"
              >
                <Settings className="h-4 w-4 text-slate-500" />
                <span>{t(lang, "crm.nav_settings", "Settings")}</span>
              </button>
            </nav>
          </div>

          {/* Quick Search Box in Sidebar */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{t(lang, "crm.quick_search", "Quick Search")}</span>
            <div className="relative">
              <Input
                type="text"
                placeholder={t(lang, "crm.search_ph", "Search CRM...")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchDashboardData()}
                className="h-8 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 pr-7 rounded-lg"
              />
              <Search className="absolute right-2 top-2 h-4 w-4 text-slate-400 cursor-pointer" onClick={fetchDashboardData} />
            </div>
          </div>
        </aside>

        {/* ── RIGHT MAIN DASHBOARD CONTENT AREA ── */}
        <main className="flex-1 p-4 lg:p-5 space-y-4 overflow-y-auto max-w-[1680px] mx-auto w-full">
          
          {/* ── TOP NAV STRIP ── */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center font-black">
                <LayoutDashboard className="h-4.5 w-4.5" />
              </div>
              <h1 className="text-base lg:text-lg font-black text-slate-950 dark:text-white tracking-tight uppercase">
                {t(lang, "crm.title", "SMART CRM / DUE & FOLLOW-UP CONTROL CENTER")}
              </h1>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={fetchDashboardData}
                className="h-8 text-xs font-bold gap-1.5"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", loading ? "animate-spin" : "")} />
                <span>{t(lang, "crm.refresh", "Refresh")}</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handlePrint}
                className="h-8 text-xs font-bold gap-1.5"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>{t(lang, "common.print", "Print")}</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleExportExcel}
                className="h-8 text-xs font-bold gap-1.5"
              >
                <Download className="h-3.5 w-3.5" />
                <span>{t(lang, "crm.btn_export_excel", "Export Excel")}</span>
              </Button>
            </div>
          </div>

          {/* ── CASCADE SCOPE SELECTOR BAR ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs text-xs">
            {/* Country */}
            <div>
              <label className="block text-[10.5px] font-bold text-slate-500 mb-1">
                {t(lang, "crm.country", "Country")}
              </label>
              <select
                value={selectedCountry}
                onChange={(e) => setSelectedCountry(e.target.value)}
                className="w-full h-8.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800 px-2 text-xs font-semibold"
              >
                <option value="all">{t(lang, "common.all_countries", "All Countries")}</option>
                {countryOptions.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Main Branch */}
            <div>
              <label className="block text-[10.5px] font-bold text-slate-500 mb-1">
                {t(lang, "crm.main_branch", "Main Branch")}
              </label>
              <select
                value={selectedMainBranch}
                onChange={(e) => setSelectedMainBranch(e.target.value)}
                className="w-full h-8.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800 px-2 text-xs font-semibold"
              >
                <option value="all">{t(lang, "common.all_branches", "All Branches")}</option>
                {mainBranchOptions
                  .filter((b) => selectedCountry === "all" || !b.country_id || b.country_id === selectedCountry)
                  .map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
              </select>
            </div>

            {/* City Branch */}
            <div>
              <label className="block text-[10.5px] font-bold text-slate-500 mb-1">
                {t(lang, "crm.city_branch", "City Branch")}
              </label>
              <select
                value={selectedCityBranch}
                onChange={(e) => setSelectedCityBranch(e.target.value)}
                className="w-full h-8.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800 px-2 text-xs font-semibold"
              >
                <option value="all">{t(lang, "common.all_branches", "All Branches")}</option>
                {cityBranchOptions
                  .filter((b) => selectedCountry === "all" || !b.country_id || b.country_id === selectedCountry)
                  .map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
              </select>
            </div>

            {/* Date */}
            <div>
              <label className="block text-[10.5px] font-bold text-slate-500 mb-1">
                {t(lang, "crm.date", "Date")}
              </label>
              <Input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="h-8.5 text-xs bg-slate-50/70 dark:bg-slate-800 rounded-lg"
              />
            </div>

            {/* Refresh Button */}
            <div className="flex items-end">
              <Button
                type="button"
                onClick={fetchDashboardData}
                className="w-full h-8.5 font-bold text-xs bg-[#0F1E36] hover:bg-[#182C4E] text-white rounded-lg shadow-xs flex items-center justify-center gap-1.5"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                <span>{t(lang, "crm.refresh", "Refresh")}</span>
              </Button>
            </div>
          </div>

          {/* ── 7 SUMMARY KPI CARDS ── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-7 gap-2.5">
            
            {/* Card 1: Cheques to Deposit Today */}
            <Card className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs hover:shadow-md transition">
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center shrink-0">
                    <Landmark className="h-4.5 w-4.5" />
                  </div>
                  <span className="text-[10px] font-bold text-blue-900 dark:text-blue-300 leading-tight">
                    {t(lang, "crm.cheques_deposit_today", "Cheques to Deposit Today")}
                  </span>
                </div>
                <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
                  {kpis.chequesDepositCount}
                </div>
                <div className="text-[10.5px] font-bold font-mono text-slate-500 mt-0.5">
                  PKR {kpis.chequesDepositAmount.toLocaleString()}
                </div>
              </CardContent>
            </Card>

            {/* Card 2: Cheques to Pay Today */}
            <Card className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs hover:shadow-md transition">
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center shrink-0">
                    <FileEdit className="h-4.5 w-4.5" />
                  </div>
                  <span className="text-[10px] font-bold text-amber-900 dark:text-amber-300 leading-tight">
                    {t(lang, "crm.cheques_pay_today", "Cheques to Pay Today")}
                  </span>
                </div>
                <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
                  {kpis.chequesPayCount}
                </div>
                <div className="text-[10.5px] font-bold font-mono text-slate-500 mt-0.5">
                  PKR {kpis.chequesPayAmount.toLocaleString()}
                </div>
              </CardContent>
            </Card>

            {/* Card 3: Cheques to Collect Today */}
            <Card className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs hover:shadow-md transition">
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center shrink-0">
                    <DollarSign className="h-4.5 w-4.5" />
                  </div>
                  <span className="text-[10px] font-bold text-emerald-900 dark:text-emerald-300 leading-tight">
                    {t(lang, "crm.cheques_collect_today", "Cheques to Collect Today")}
                  </span>
                </div>
                <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
                  {kpis.chequesCollectCount}
                </div>
                <div className="text-[10.5px] font-bold font-mono text-slate-500 mt-0.5">
                  PKR {kpis.chequesCollectAmount.toLocaleString()}
                </div>
              </CardContent>
            </Card>

            {/* Card 4: Purchase Payments Due */}
            <Card className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs hover:shadow-md transition">
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-rose-100 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center shrink-0">
                    <ShoppingCart className="h-4.5 w-4.5" />
                  </div>
                  <span className="text-[10px] font-bold text-rose-900 dark:text-rose-300 leading-tight">
                    {t(lang, "crm.purchase_payments_due", "Purchase Payments Due")}
                  </span>
                </div>
                <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
                  {kpis.purchaseDueCount}
                </div>
                <div className="text-[10.5px] font-bold font-mono text-slate-500 mt-0.5">
                  USD {kpis.purchaseDueAmount.toLocaleString()}
                </div>
              </CardContent>
            </Card>

            {/* Card 5: Sales Recovery Due */}
            <Card className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs hover:shadow-md transition">
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-purple-100 dark:bg-purple-950/60 text-purple-600 flex items-center justify-center shrink-0">
                    <TrendingUp className="h-4.5 w-4.5" />
                  </div>
                  <span className="text-[10px] font-bold text-purple-900 dark:text-purple-300 leading-tight">
                    {t(lang, "crm.sales_recovery_due", "Sales Recovery Due")}
                  </span>
                </div>
                <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
                  {kpis.salesRecoveryCount}
                </div>
                <div className="text-[10.5px] font-bold font-mono text-slate-500 mt-0.5">
                  USD {kpis.salesRecoveryAmount.toLocaleString()}
                </div>
              </CardContent>
            </Card>

            {/* Card 6: Shipping / Clearing Due */}
            <Card className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs hover:shadow-md transition">
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-teal-100 dark:bg-teal-950/60 text-teal-600 flex items-center justify-center shrink-0">
                    <Ship className="h-4.5 w-4.5" />
                  </div>
                  <span className="text-[10px] font-bold text-teal-900 dark:text-teal-300 leading-tight">
                    {t(lang, "crm.shipping_clearing_due", "Shipping / Clearing Due")}
                  </span>
                </div>
                <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
                  {kpis.shippingDueCount}
                </div>
                <div className="text-[10.5px] font-bold font-mono text-slate-500 mt-0.5">
                  USD {kpis.shippingDueAmount.toLocaleString()}
                </div>
              </CardContent>
            </Card>

            {/* Card 7: Overdue Follow-Ups (All) */}
            <Card className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs hover:shadow-md transition">
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-orange-100 dark:bg-orange-950/60 text-orange-600 flex items-center justify-center shrink-0">
                    <Clock className="h-4.5 w-4.5" />
                  </div>
                  <span className="text-[10px] font-bold text-orange-900 dark:text-orange-300 leading-tight">
                    {t(lang, "crm.overdue_followups_all", "Overdue Follow-Ups (All)")}
                  </span>
                </div>
                <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
                  {kpis.overdueCount}
                </div>
                <div className="text-[10.5px] font-bold font-mono text-slate-500 mt-0.5">
                  PKR {kpis.overdueAmount.toLocaleString()}
                </div>
              </CardContent>
            </Card>

          </div>

          {/* ── MAIN ACTION CENTER (TABS & TABLE) ── */}
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
            
            {/* Tabs Header */}
            <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800 px-4 pt-3 text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveTab("today")}
                className={`px-4 py-2 border-b-2 transition ${
                  activeTab === "today"
                    ? "border-blue-600 text-blue-600 font-black"
                    : "border-transparent text-slate-500 hover:text-slate-900"
                }`}
              >
                {t(lang, "crm.tab_todays_action_list", "Today's Action List")}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("overdue")}
                className={`px-4 py-2 border-b-2 transition ${
                  activeTab === "overdue"
                    ? "border-rose-600 text-rose-600 font-black"
                    : "border-transparent text-slate-500 hover:text-slate-900"
                }`}
              >
                {t(lang, "crm.tab_overdue", "Overdue")}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("tomorrow")}
                className={`px-4 py-2 border-b-2 transition ${
                  activeTab === "tomorrow"
                    ? "border-amber-600 text-amber-600 font-black"
                    : "border-transparent text-slate-500 hover:text-slate-900"
                }`}
              >
                {t(lang, "crm.tab_tomorrow", "Tomorrow")}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("upcoming")}
                className={`px-4 py-2 border-b-2 transition ${
                  activeTab === "upcoming"
                    ? "border-sky-600 text-sky-600 font-black"
                    : "border-transparent text-slate-500 hover:text-slate-900"
                }`}
              >
                {t(lang, "crm.tab_upcoming", "Upcoming")}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("completed")}
                className={`px-4 py-2 border-b-2 transition ${
                  activeTab === "completed"
                    ? "border-emerald-600 text-emerald-600 font-black"
                    : "border-transparent text-slate-500 hover:text-slate-900"
                }`}
              >
                {t(lang, "crm.tab_completed", "Completed")}
              </button>
            </div>

            {/* Main Action Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-500">
                    <th className="py-2.5 px-3">{t(lang, "crm.th_type", "Type")}</th>
                    <th className="py-2.5 px-3">{t(lang, "crm.th_due_date", "Due Date")}</th>
                    <th className="py-2.5 px-3">{t(lang, "crm.th_party_account", "Party / Account")}</th>
                    <th className="py-2.5 px-3">{t(lang, "crm.th_source", "Source")}</th>
                    <th className="py-2.5 px-3">{t(lang, "crm.th_invoice_bill", "Invoice / Bill No.")}</th>
                    <th className="py-2.5 px-3">{t(lang, "crm.th_amount", "Amount")}</th>
                    <th className="py-2.5 px-3">{t(lang, "crm.th_paid", "Paid")}</th>
                    <th className="py-2.5 px-3">{t(lang, "crm.th_remaining", "Remaining")}</th>
                    <th className="py-2.5 px-3">{t(lang, "crm.th_branch", "Branch")}</th>
                    <th className="py-2.5 px-3">{t(lang, "crm.th_responsible", "Responsible")}</th>
                    <th className="py-2.5 px-3 text-center">{t(lang, "crm.th_status", "Status")}</th>
                    <th className="py-2.5 px-3.5 text-center">{t(lang, "crm.th_action", "Action")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11.5px]">
                  {loading ? (
                    <tr>
                      <td colSpan={12} className="py-8 text-center text-slate-400">
                        <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-1 text-blue-600" />
                        {t(lang, "crm.loading_action_tasks", "Loading action tasks...")}
                      </td>
                    </tr>
                  ) : actionItems.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="py-8 text-center text-slate-400 font-medium">
                        {t(lang, "crm.no_active_items_tab", "No active items found for this tab.")}
                      </td>
                    </tr>
                  ) : (
                    actionItems.map((item: any, idx: number) => {
                      const typePillClass =
                        item.item_type === "Cheque Deposit"
                          ? "bg-blue-50 text-blue-700 border-blue-200"
                          : item.item_type === "Cheque Pay"
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : item.item_type === "Collect From Customer"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : item.item_type === "Purchase Payment"
                          ? "bg-rose-50 text-rose-700 border-rose-200"
                          : "bg-teal-50 text-teal-700 border-teal-200";

                      return (
                        <tr key={item.id || idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                          {/* Type */}
                          <td className="py-2 px-3">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${typePillClass}`}>
                              {item.item_type}
                            </span>
                          </td>

                          {/* Due Date */}
                          <td className="py-2 px-3 font-mono text-slate-700 dark:text-slate-300">
                            {new Date(item.due_date).toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" })}
                          </td>

                          {/* Party / Account */}
                          <td className="py-2 px-3 font-bold text-slate-900 dark:text-white">
                            {item.party_name}
                          </td>

                          {/* Source */}
                          <td className="py-2 px-3 text-slate-600 dark:text-slate-400">
                            {item.module}
                          </td>

                          {/* Invoice / Bill No */}
                          <td className="py-2 px-3 font-mono font-bold text-blue-600">
                            {item.reference_no}
                          </td>

                          {/* Amount */}
                          <td className="py-2 px-3 font-mono font-bold text-slate-900 dark:text-white">
                            {item.currency} {Number(item.amount).toLocaleString()}
                          </td>

                          {/* Paid */}
                          <td className="py-2 px-3 font-mono text-slate-500">
                            {item.paid_amount > 0 ? `${item.currency} ${Number(item.paid_amount).toLocaleString()}` : "0"}
                          </td>

                          {/* Remaining */}
                          <td className="py-2 px-3 font-mono font-bold text-slate-900 dark:text-white">
                            {item.currency} {Number(item.remaining_amount).toLocaleString()}
                          </td>

                          {/* Branch */}
                          <td className="py-2 px-3 text-slate-600 dark:text-slate-400">
                            {item.branch_name || "—"}
                          </td>

                          {/* Responsible */}
                          <td className="py-2 px-3 text-slate-700 dark:text-slate-300 font-medium">
                            {item.responsible_user_name || "—"}
                          </td>

                          {/* Status */}
                          <td className="py-2 px-3 text-center">
                            <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-50 text-blue-700 border border-blue-200">
                              {item.status || "—"}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="py-2 px-3.5 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {/* View */}
                              <button
                                type="button"
                                title={t(lang, "crm.title_view_source", "View Source Transaction")}
                                onClick={() => router.push(item.source_type.includes("pur") ? "/dashboard/purchase" : item.source_type.includes("sales") ? "/dashboard/sales" : "/dashboard/roznamcha/bank-cheques")}
                                className="h-6 w-6 rounded-md text-blue-600 hover:bg-blue-50 flex items-center justify-center transition"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </button>

                              {/* Follow Up Note */}
                              <button
                                type="button"
                                title={t(lang, "crm.title_followup_note", "Follow-up Note")}
                                onClick={() => {
                                  setSelectedItemForNote(item);
                                  setNoteModalOpen(true);
                                }}
                                className="h-6 w-6 rounded-md text-amber-600 hover:bg-amber-50 flex items-center justify-center transition"
                              >
                                <FileEdit className="h-3.5 w-3.5" />
                              </button>

                              {/* Complete */}
                              <button
                                type="button"
                                title={t(lang, "crm.title_mark_completed", "Mark Completed")}
                                onClick={() => handleCompleteItem(item.id)}
                                className="h-6 w-6 rounded-md text-emerald-600 hover:bg-emerald-50 flex items-center justify-center transition"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
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
          </section>

          {/* ── 4 BOTTOM ACTIVITY CARDS ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            
            {/* Widget 1: Overdue Follow-Ups */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-1.5 text-xs font-black text-rose-600">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{t(lang, "crm.overdue_followups", "Overdue Follow-Ups")}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab("overdue")}
                    className="text-[10px] font-bold text-blue-600 hover:underline"
                  >
                    {t(lang, "crm.view_all", "View All")}
                  </button>
                </div>

                <div className="space-y-2.5 mt-2.5 text-xs">
                  {overdueFollowUps.map((ov: any) => (
                    <div key={ov.id} className="flex items-start justify-between">
                      <div className="flex items-start gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-purple-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold text-slate-900 dark:text-white block text-[11px]">{ov.party}</span>
                          <span className="text-[10px] text-slate-400 block">{ov.source} {ov.refNo}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-bold text-rose-600 block">{th("Overdue")} {ov.overdueDays} {th("Days")}</span>
                        <span className="text-[10px] font-mono text-slate-600 block">Amount: {ov.currency} {ov.amount.toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Widget 2: Upcoming Important */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-1.5 text-xs font-black text-amber-600">
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>{t(lang, "crm.upcoming_important", "Upcoming Important")}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab("upcoming")}
                    className="text-[10px] font-bold text-blue-600 hover:underline"
                  >
                    {t(lang, "crm.view_all", "View All")}
                  </button>
                </div>

                <div className="space-y-2.5 mt-2.5 text-xs">
                  {upcomingImportant.map((up: any) => (
                    <div key={up.id} className="flex items-start justify-between">
                      <div className="flex items-start gap-1.5">
                        <Landmark className="h-3.5 w-3.5 text-teal-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold text-slate-900 dark:text-white block text-[11px]">{up.party}</span>
                          <span className="text-[10px] text-slate-400 block">{up.actionLabel} - {up.dueDate}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[11px] font-mono font-bold text-slate-900 dark:text-white block">
                          {up.currency} {up.amount.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Widget 3: Today's Summary (PKR) */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-1.5 text-xs font-black text-blue-600">
                    <FileText className="h-3.5 w-3.5" />
                    <span>{t(lang, "crm.todays_summary", "Today's Summary (PKR)")}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => router.push("/dashboard/reports")}
                    className="text-[10px] font-bold text-blue-600 hover:underline"
                  >
                    {t(lang, "crm.view_report", "View Report")}
                  </button>
                </div>

                <div className="space-y-1.5 mt-2 text-xs">
                  <div className="flex justify-between py-0.5">
                    <span className="text-slate-500 font-medium">{t(lang, "crm.total_receivable", "Total Receivable")}</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">PKR {financialSummary.totalReceivable.toLocaleString()}</span>
                  </div>

                  <div className="flex justify-between py-0.5">
                    <span className="text-slate-500 font-medium">{t(lang, "crm.total_payable", "Total Payable")}</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">PKR {financialSummary.totalPayable.toLocaleString()}</span>
                  </div>

                  <div className="flex justify-between py-0.5">
                    <span className="text-slate-500 font-medium">{t(lang, "crm.cash_in_hand", "Cash in Hand")}</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">PKR {financialSummary.cashInHand.toLocaleString()}</span>
                  </div>

                  <div className="flex justify-between py-0.5">
                    <span className="text-slate-500 font-medium">{t(lang, "crm.bank_balance", "Bank Balance")}</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">PKR {financialSummary.bankBalance.toLocaleString()}</span>
                  </div>

                  <div className="flex justify-between pt-1 border-t border-slate-100 dark:border-slate-800">
                    <span className="font-black text-slate-900 dark:text-white">{t(lang, "crm.net_position", "Net Position")}</span>
                    <span className="font-mono font-black text-emerald-600">PKR {financialSummary.netPosition.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Widget 4: Follow-Up Calendar */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-1.5 text-xs font-black text-indigo-600">
                    <CalendarIcon className="h-3.5 w-3.5" />
                    <span>{t(lang, "crm.followup_calendar", "Follow-Up Calendar")}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab("upcoming")}
                    className="text-[10px] font-bold text-blue-600 hover:underline"
                  >
                    {t(lang, "crm.view_calendar", "View Calendar")}
                  </button>
                </div>

                {/* Dynamic Month Grid */}
                <div className="mt-2 text-center">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    <ChevronLeft
                      className="h-3.5 w-3.5 cursor-pointer hover:text-blue-600"
                      onClick={() => {
                        const d = new Date(targetDate);
                        d.setMonth(d.getMonth() - 1);
                        setTargetDate(d.toISOString().split("T")[0]);
                      }}
                    />
                    <span className="capitalize">{calendarInfo.monthName}</span>
                    <ChevronRight
                      className="h-3.5 w-3.5 cursor-pointer hover:text-blue-600"
                      onClick={() => {
                        const d = new Date(targetDate);
                        d.setMonth(d.getMonth() + 1);
                        setTargetDate(d.toISOString().split("T")[0]);
                      }}
                    />
                  </div>
                  <div className="grid grid-cols-7 gap-1 text-[9.5px] font-bold text-slate-400 mb-1">
                    {(lang === "ur"
                      ? ["پیر", "منگل", "بدھ", "جمعرات", "جمعہ", "ہفتہ", "اتوار"]
                      : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
                    ).map((d) => (
                      <span key={d} className="flex items-center justify-center py-0.5">{d}</span>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1 text-[10px]">
                    {Array.from({ length: calendarInfo.startOffset }).map((_, idx) => (
                      <span key={`empty-${idx}`} className="aspect-square" aria-hidden></span>
                    ))}
                    {Array.from({ length: calendarInfo.daysInMonth }).map((_, idx) => {
                      const day = idx + 1;
                      const isSelected = day === calendarInfo.selectedDay;
                      const now = new Date();
                      const isToday =
                        day === now.getDate() &&
                        calendarInfo.month === now.getMonth() &&
                        calendarInfo.year === now.getFullYear();
                      return (
                        <button
                          type="button"
                          key={day}
                          onClick={() => {
                            const d = new Date(calendarInfo.year, calendarInfo.month, day);
                            setTargetDate(d.toISOString().split("T")[0]);
                          }}
                          className={cn(
                            "flex aspect-square items-center justify-center rounded-full text-xs font-semibold transition tabular-nums",
                            isSelected
                              ? "bg-blue-600 text-white font-black shadow-sm"
                              : isToday
                                ? "ring-2 ring-blue-500 ring-offset-1 text-blue-700 font-black dark:text-blue-300 dark:ring-offset-slate-900"
                                : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                          )}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Calendar Legend */}
                <div className="flex items-center justify-between text-[9px] font-bold text-slate-500 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <span className="flex items-center gap-0.5 text-rose-600"><span className="h-1.5 w-1.5 rounded-full bg-rose-600"></span> {th("Overdue")}</span>
                  <span className="flex items-center gap-0.5 text-blue-600"><span className="h-1.5 w-1.5 rounded-full bg-blue-600"></span> {th("Due Today")}</span>
                  <span className="flex items-center gap-0.5 text-amber-600"><span className="h-1.5 w-1.5 rounded-full bg-amber-600"></span> {th("Tomorrow")}</span>
                  <span className="flex items-center gap-0.5 text-emerald-600"><span className="h-1.5 w-1.5 rounded-full bg-emerald-600"></span> {th("Upcoming")}</span>
                </div>
              </div>
            </div>

          </div>

          {/* ── THREE BOTTOM BLOCKS: SERIALS, PROCESS FLOW, QUICK ACTIONS & NOTES ── */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
            
            {/* Block 1: ERP Serial Information (Left 3 cols) */}
            <div className="lg:col-span-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-2 text-xs">
              <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-900 dark:text-white border-b pb-2">
                {t(lang, "crm.erp_serial_info", "ERP Serial Information")}
              </h3>
              <div className="space-y-1.5 font-mono text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-sans">{th("Global Serial")} :</span>
                  <span className="font-bold text-slate-900 dark:text-white">{erpSerials.globalSerial}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-sans">{th("Country Serial")} :</span>
                  <span className="font-bold text-blue-600">{erpSerials.countrySerial}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-sans">{th("Branch Serial")} :</span>
                  <span className="font-bold text-teal-600">{erpSerials.branchSerial}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-sans">{th("Entry Serial")} :</span>
                  <span className="font-bold text-slate-700 dark:text-slate-300">{erpSerials.entrySerial}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-sans">{th("User")} :</span>
                  <span className="font-bold text-slate-900 dark:text-white">{erpSerials.userCode}</span>
                </div>
              </div>
            </div>

            {/* Block 2: Business Flow (Middle 5 cols) */}
            <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-3">
              <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-900 dark:text-white border-b pb-2">
                {t(lang, "crm.business_flow", "Business Flow")}
              </h3>

              <div className="flex items-center justify-between text-center overflow-x-auto py-1">
                {/* Step 1 */}
                <div className="flex flex-col items-center">
                  <div className="h-8 w-8 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-black text-xs shadow-xs">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <span className="text-[9.5px] font-bold text-slate-800 dark:text-slate-200 mt-1">{th("Real ERP")}</span>
                  <span className="text-[8.5px] text-slate-400">{th("Transaction")}</span>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-slate-300 shrink-0" />

                {/* Step 2 */}
                <div className="flex flex-col items-center">
                  <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-black text-xs shadow-xs">
                    <CalendarIcon className="h-4 w-4" />
                  </div>
                  <span className="text-[9.5px] font-bold text-slate-800 dark:text-slate-200 mt-1">{th("Due Date")}</span>
                  <span className="text-[8.5px] text-slate-400">{th("Engine")}</span>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-slate-300 shrink-0" />

                {/* Step 3 */}
                <div className="flex flex-col items-center">
                  <div className="h-8 w-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-black text-xs shadow-xs">
                    <LayoutDashboard className="h-4 w-4" />
                  </div>
                  <span className="text-[9.5px] font-bold text-slate-800 dark:text-slate-200 mt-1">{th("CRM Action")}</span>
                  <span className="text-[8.5px] text-slate-400">{th("Center")}</span>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-slate-300 shrink-0" />

                {/* Step 4 */}
                <div className="flex flex-col items-center">
                  <div className="h-8 w-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-black text-xs shadow-xs">
                    <Users className="h-4 w-4" />
                  </div>
                  <span className="text-[9.5px] font-bold text-slate-800 dark:text-slate-200 mt-1">{th("User")}</span>
                  <span className="text-[8.5px] text-slate-400">{th("Action")}</span>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-slate-300 shrink-0" />

                {/* Step 5 */}
                <div className="flex flex-col items-center">
                  <div className="h-8 w-8 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center font-black text-xs shadow-xs">
                    <FileText className="h-4 w-4" />
                  </div>
                  <span className="text-[9.5px] font-bold text-slate-800 dark:text-slate-200 mt-1">{th("Record")}</span>
                  <span className="text-[8.5px] text-slate-400">{th("Update")}</span>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-slate-300 shrink-0" />

                {/* Step 6 */}
                <div className="flex flex-col items-center">
                  <div className="h-8 w-8 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center font-black text-xs shadow-xs">
                    <Landmark className="h-4 w-4" />
                  </div>
                  <span className="text-[9.5px] font-bold text-slate-800 dark:text-slate-200 mt-1">{th("Ledger")}</span>
                  <span className="text-[8.5px] text-slate-400">{th("Update")}</span>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-slate-300 shrink-0" />

                {/* Step 7 */}
                <div className="flex flex-col items-center">
                  <div className="h-8 w-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-black text-xs shadow-xs">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <span className="text-[9.5px] font-bold text-slate-800 dark:text-slate-200 mt-1">{th("Completed")}</span>
                  <span className="text-[8.5px] text-slate-400">{th("Audit Trail")}</span>
                </div>
              </div>
            </div>

            {/* Block 3: Quick Actions & Important Notes (Right 4 cols) */}
            <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
              <div>
                <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-900 dark:text-white border-b pb-2 mb-2.5">
                  {t(lang, "crm.quick_actions", "Quick Actions")}
                </h3>
                
                <div className="grid grid-cols-2 gap-2 text-xs font-bold">
                  <Button
                    type="button"
                    onClick={() => setNoteModalOpen(true)}
                    className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white text-[10.5px] font-black rounded-lg shadow-xs flex items-center justify-center gap-1"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>{t(lang, "crm.btn_add_followup", "Add Follow-Up")}</span>
                  </Button>

                  <Button
                    type="button"
                    onClick={() => setNoteModalOpen(true)}
                    className="h-8 bg-blue-600 hover:bg-blue-700 text-white text-[10.5px] font-black rounded-lg shadow-xs flex items-center justify-center gap-1"
                  >
                    <StickyNote className="h-3.5 w-3.5" />
                    <span>{t(lang, "crm.btn_add_note", "Add Note")}</span>
                  </Button>

                  <Button
                    type="button"
                    onClick={() => window.open("https://wa.me/", "_blank")}
                    className="h-8 bg-teal-600 hover:bg-teal-700 text-white text-[10.5px] font-black rounded-lg shadow-xs flex items-center justify-center gap-1"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>{t(lang, "crm.btn_send_whatsapp", "WhatsApp")}</span>
                  </Button>

                  <Button
                    type="button"
                    onClick={handleExportExcel}
                    className="h-8 bg-slate-800 hover:bg-slate-900 text-white text-[10.5px] font-black rounded-lg shadow-xs flex items-center justify-center gap-1"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>{t(lang, "crm.btn_export_excel", "Export Excel")}</span>
                  </Button>
                </div>
              </div>

              {/* Important Notes */}
              <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-800/30">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">{t(lang, "crm.important_notes", "Important Notes")}</span>
                <div className="space-y-1.5 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                  {(lang === "ur"
                    ? [
                        "تمام اعداد و شمار حقیقی ڈیٹا سے ملائے جاتے ہیں۔",
                        "ہر ٹرانزیکشن اپنے ماخذ ریکارڈ سے منسلک ہے۔",
                        "صرف مجاز صارفین کو اپنے دائرہ کار کا ڈیٹا نظر آئے گا۔",
                        "تمام رپورٹس اور پرنٹ ERP کی منتخب زبان میں ہوں گی۔",
                      ]
                    : [
                        "All figures and balances are synchronized with live accounting records.",
                        "Each transaction is directly linked to its primary source voucher.",
                        "Authorized users only see records within their assigned branch scope.",
                        "All reports and prints are generated in the active system language.",
                      ]
                  ).map((note, i) => (
                    <p key={i} className="flex gap-1.5"><span className="text-slate-400">•</span><span>{note}</span></p>
                  ))}
                  <p className="flex gap-1.5 pt-0.5 font-bold text-slate-700 dark:text-slate-300">
                    <span className="text-slate-400">•</span>
                    <span>{t(lang, "crm.dr_cr_hint", "DR = Debit (Receivable) , CR = Credit (Payable)")}</span>
                  </p>
                </div>
              </div>
            </div>

          </div>

        </main>
      </div>

      {/* ── BOTTOM STICKY ACTION FOOTER ── */}
      <footer className="bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-t border-slate-200 dark:border-slate-800 py-2 px-6 flex flex-wrap items-center justify-between text-xs font-semibold shrink-0 shadow-xs">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition cursor-pointer"
          >
            <Printer className="h-3.5 w-3.5 text-blue-600" />
            <span>{t(lang, "common.print", "Print")}</span>
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition cursor-pointer"
          >
            <Download className="h-3.5 w-3.5 text-emerald-600" />
            <span>{t(lang, "crm.btn_export_excel", "Export Excel")}</span>
          </button>

          <button
            type="button"
            onClick={() => router.push("/dashboard/reports")}
            className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition cursor-pointer"
          >
            <FileText className="h-3.5 w-3.5 text-indigo-600" />
            <span>{t(lang, "nav.reports", "Reports")}</span>
          </button>
        </div>

        <div>
          <span>{t(lang, "go.go_copyright_footer", "© 2026 Digital Dock ERP (Pvt) Ltd. All rights reserved.")}</span>
        </div>

        <div className="flex items-center gap-2">
          <span>{t(lang, "crm.powered_by", "Powered by")} <strong>{t(lang, "acct.brand_short", "Digital Dock ERP")}</strong></span>
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 text-[10px] font-black">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>{t(lang, "crm.live", "Live")}</span>
          </span>
        </div>
      </footer>

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
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">{th("Follow-Up Action Type")}</label>
                <select
                  value={noteType}
                  onChange={(e) => setNoteType(e.target.value)}
                  className="w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 font-semibold"
                >
                  <option value="Call Follow-Up">{t(lang, "crm.ftype_call", "Phone Call Follow-Up")}</option>
                  <option value="WhatsApp Message">{t(lang, "crm.ftype_whatsapp", "WhatsApp Follow-Up")}</option>
                  <option value="In-Person Meeting">{t(lang, "crm.ftype_meeting", "In-Person Meeting")}</option>
                  <option value="Promise to Pay">{t(lang, "crm.ftype_promise", "Promise to Pay")}</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">{th("Follow-Up Notes / Outcome")}</label>
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
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">{th("Promise Date")}</label>
                  <Input
                    type="date"
                    value={promiseDate}
                    onChange={(e) => setPromiseDate(e.target.value)}
                    className="h-8.5 text-xs bg-slate-50 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">{th("Promise Amount")}</label>
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
                {th("Cancel")}
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
