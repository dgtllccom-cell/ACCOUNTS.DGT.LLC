"use client";

import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Plus, RefreshCw, Search, Eye, Printer, X, ShieldCheck,
  Building2, FileText, Layers, Globe,
  ChevronLeft, ChevronRight, Pencil, Trash2,
  AlertTriangle, Calendar
} from "lucide-react";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { printStore } from "@/lib/store/print-store";
import { apiGet } from "@/lib/api/client";
import { UniversalPrintActionButton } from "@/components/reports/universal-print-action-button";

type SessionInfo = {
  user?: { fullName?: string | null; email?: string | null };
  scopes?: {
    isSuperAdmin?: boolean;
    summary?: { countryName?: string | null; branchDisplayName?: string | null; scopeLabel?: string | null };
  };
};
type CountryOpt = { id: string; name: string };
type BranchOpt = { id: string; name: string; city_name?: string | null };

type Line = {
  id?: string; sortOrder: number; goodsName?: string | null; description?: string | null; hsCode?: string | null;
  brand?: string | null; size?: string | null; packing?: string | null; packages?: number | null; quantity?: number | null;
  unit?: string | null; netWeight?: number | null; grossWeight?: number | null;
  originalUnitPrice?: number | null; originalAmount?: number | null; documentUnitPrice?: number | null; documentAmount?: number | null;
};
type Invoice = {
  id: string; invoiceNo: string; sourceModule: string; originalBillNo?: string | null; originalManualBillNo?: string | null;
  originalCurrency?: string | null; originalTotalValue?: number | null; docType: string; documentNo?: string | null;
  documentDate?: string | null; documentCurrency?: string | null; documentExchangeRate?: number | null;
  documentTotalValue?: number | null; partyName?: string | null; destination?: string | null; incoterms?: string | null;
  paymentTerms?: string | null; notes?: string | null; validity?: string | null; signatureName?: string | null;
  status: string; versionNo: number; createdAt: string; txnKind: string; branchLabel?: string | null;
  canEdit?: boolean; isManager?: boolean; lines: Line[];
  createdByName?: string | null; countryId?: string | null; countryName?: string | null; cityBranchId?: string | null;
};
type Bill = {
  sourceModule: string; sourceId: string; billNo?: string | null; manualBillNo?: string | null; transactionDate?: string | null;
  branchLabel?: string | null; partyName?: string | null; currency?: string | null; originalBillAmount: number;
  sourceStatus?: string | null; existingInvoiceCount: number;
};
type Screen = ReturnType<typeof useErpScreen>;

const DOC_TYPES = ["commercial_invoice", "proforma_invoice", "export_invoice", "packing_list"] as const;
const MODULES = ["purchase_booking", "sales_booking", "local_purchase", "local_sales"] as const;
const fmt = (n?: number | null) => (n == null ? "0.00" : Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const fmtD = (d?: string | null) => (d ? String(d).slice(0, 10) : "");

export function BusinessEditInvoiceView({ lang: langProp }: { lang?: string }) {
  const s = useErpScreen("bei", langProp);
  const [rows, setRows] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [setupPending, setSetupPending] = useState(false);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [countryOptions, setCountryOptions] = useState<CountryOpt[]>([]);
  const [branchOptions, setBranchOptions] = useState<BranchOpt[]>([]);

  // Filters State
  const [search, setSearch] = useState("");
  const [docFilter, setDocFilter] = useState<string>("all");
  const [moduleFilter, setModuleFilter] = useState<string>("all");
  const [countryFilter, setCountryFilter] = useState<string>("all");
  const [branchFilter, setBranchFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const [showPicker, setShowPicker] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ lang: s.lang });
      if (search.trim()) qs.set("q", search.trim());
      if (docFilter !== "all") qs.set("docType", docFilter);
      if (statusFilter !== "all") qs.set("status", statusFilter);
      if (countryFilter !== "all") qs.set("countryId", countryFilter);
      if (branchFilter !== "all") qs.set("branchId", branchFilter);
      const r = await fetch(`/api/erp/business-edit-invoices?${qs.toString()}`);
      const j = await r.json();
      const d = j.data ?? j;
      if (d?.setupPending) { setSetupPending(true); setRows([]); return; }
      setSetupPending(false);
      setRows(d.rows ?? []);
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  }, [s.lang, search, docFilter, statusFilter, countryFilter, branchFilter]);

  useEffect(() => { void load(); }, [load]);

  const handleDelete = async (inv: Invoice) => {
    if (!window.confirm(s.t("confirm_delete", "Delete this editable invoice? This does not affect the original accounting record.").replace("{no}", inv.invoiceNo))) return;
    try {
      const r = await fetch(`/api/erp/business-edit-invoices/${inv.id}`, { method: "DELETE" });
      const j = await r.json();
      if (!r.ok || j.error) throw new Error(j?.error?.message || j?.error || "Delete failed");
      await load();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : String(e));
    }
  };

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

  useEffect(() => { setCurrentPage(1); }, [search, docFilter, moduleFilter, countryFilter, branchFilter, statusFilter, dateFrom, dateTo]);

  const isSuperAdmin = !!session?.scopes?.isSuperAdmin;

  // Real records only — module filter and date range applied client-side (server already scoped/filtered the rest).
  const displayList = useMemo(() => {
    return rows.filter((inv) => {
      if (moduleFilter !== "all" && inv.sourceModule !== moduleFilter) return false;
      if (dateFrom && inv.createdAt && new Date(inv.createdAt) < new Date(dateFrom)) return false;
      if (dateTo && inv.createdAt && new Date(inv.createdAt) > new Date(`${dateTo}T23:59:59`)) return false;
      return true;
    });
  }, [rows, moduleFilter, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(displayList.length / pageSize));
  const pageRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return displayList.slice(start, start + pageSize);
  }, [displayList, currentPage, pageSize]);

  const stats = useMemo(() => {
    const draft = rows.filter((r) => r.status === "draft").length;
    const finalized = rows.filter((r) => r.status === "finalized").length;
    const void_ = rows.filter((r) => r.status === "void").length;
    const bySource = (m: string) => rows.filter((r) => r.sourceModule === m).length;
    const countries = new Set(rows.filter((r) => r.countryId).map((r) => r.countryId)).size;
    const branches = new Set(rows.filter((r) => r.cityBranchId).map((r) => r.cityBranchId)).size;
    const originalValue = rows.reduce((sum, r) => sum + (Number(r.originalTotalValue) || 0), 0);
    const documentValue = rows.reduce((sum, r) => sum + (Number(r.documentTotalValue) || 0), 0);
    return { draft, finalized, void_, bySource, countries, branches, originalValue, documentValue };
  }, [rows]);

  const printConfig = () => ({
    moduleType: "register" as const,
    reportType: "register" as const,
    title: s.t("register", "Business Edit Invoice Register"),
    subtitle: s.t("title", "Business Edit Invoice"),
    lang: s.lang,
    orientation: "landscape" as const,
    columns: [
      { key: "invoiceNo", label: s.t("invoice_no", "Edit Invoice No") },
      { key: "docType", label: s.t("doc_type", "Document Type"), render: (r: any) => s.t(r.docType, r.docType) },
      { key: "sourceModule", label: s.t("source_module", "Source"), render: (r: any) => s.t(`m_${r.sourceModule}`, r.sourceModule) },
      { key: "originalBillNo", label: s.t("original_bill_no", "Original Bill No") },
      { key: "partyName", label: s.t("party", "Party") },
      { key: "originalTotalValue", label: s.t("original_value", "Original Value"), align: "right" as const, render: (r: any) => fmt(r.originalTotalValue) },
      { key: "documentTotalValue", label: s.t("document_value", "Document Value"), align: "right" as const, render: (r: any) => fmt(r.documentTotalValue) },
      { key: "status", label: s.t("status", "Status") },
    ],
    rows: displayList,
  });

  return (
    <div dir={s.dir} className="min-h-screen bg-[#f8fafc] dark:bg-[#0b1120] text-slate-800 dark:text-slate-100 pb-16 font-sans">
      <div className="mx-auto max-w-[1700px] p-4 sm:p-6 lg:p-7 space-y-5">

        {/* 1. TOP BREADCRUMB & HEADER */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1 font-bold text-slate-600 hover:text-blue-600 dark:text-slate-300 transition"
            >
              <span className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] shadow-2xs dark:border-slate-800 dark:bg-slate-900">
                {s.isRtl ? "→" : "←"} {s.tGlobal("common.back", "Back")}
              </span>
            </Link>
            <span className="text-slate-400">{s.tGlobal("common.dashboard", "Dashboard")}</span>
            <span className="text-slate-300 dark:text-slate-700">{s.isRtl ? "<" : ">"}</span>
            <span className="font-semibold text-blue-600 dark:text-blue-400">{s.t("title", "Business Edit Invoice")}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-blue-600" : ""}`} />
              {s.t("refresh", "Refresh")}
            </button>
          </div>
        </div>

        {/* 2. TITLE HEADER */}
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-slate-50">
            {s.t("title", "Business Edit Invoice")}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {s.t("blurb", "Generate a separate editable document invoice from a finalized Purchase Booking, Sales Booking, Local Purchase or Local Sales bill.")}
          </p>
        </div>

        {/* 3. YELLOW ALERT WARNING BANNER */}
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200 shadow-xs">
          <div className="rounded-full bg-amber-100 p-1 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300 shrink-0 mt-0.5">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div>
            <div className="font-bold text-amber-950 dark:text-amber-100">
              {s.t("accounting_note", "The original accounting record (Debit/Credit, Journal, Ledger, Roznamcha, Stock Cost, Payment, Outstanding) is NOT affected by this document.")}
            </div>
          </div>
        </div>

        {/* 4. FOUR KPI CARDS (Screenshot 3 layout) */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Card 1: Branch & User Details (Blue) */}
          <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50/70 via-white to-blue-50/20 p-4 shadow-sm dark:border-blue-950/60 dark:from-blue-950/30 dark:via-slate-900 dark:to-slate-900">
            <div className="flex items-center justify-between pb-3 border-b border-blue-100/70 dark:border-blue-900/40">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-blue-100 p-1.5 text-blue-600 dark:bg-blue-900/60 dark:text-blue-300">
                  <Building2 className="h-4 w-4" />
                </div>
                <span className="text-xs font-bold text-blue-950 dark:text-blue-200">{s.t("branch_user_details", "Branch & User Details")}</span>
              </div>
            </div>
            <div className="mt-3 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">{s.tGlobal("common.branch", "Branch")}</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{session?.scopes?.summary?.branchDisplayName || "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">{s.tGlobal("common.country", "Country")}</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{session?.scopes?.summary?.countryName || "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">{s.tGlobal("common.user_name", "User Name")}</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{session?.user?.fullName || "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">{s.t("user_email", "User Email")}</span>
                <span className="font-mono text-slate-600 dark:text-slate-300 truncate max-w-[120px]" title={session?.user?.email || ""}>{session?.user?.email || "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">{s.t("role", "Role")}</span>
                <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-bold text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                  {isSuperAdmin ? s.t("super_admin", "Super Admin") : (session?.scopes?.summary?.scopeLabel || "—")}
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Edit Invoice Summary (Emerald) */}
          <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50/70 via-white to-emerald-50/20 p-4 shadow-sm dark:border-emerald-950/60 dark:from-emerald-950/30 dark:via-slate-900 dark:to-slate-900">
            <div className="flex items-center justify-between pb-3 border-b border-emerald-100/70 dark:border-emerald-900/40">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-emerald-100 p-1.5 text-emerald-600 dark:bg-emerald-900/60 dark:text-emerald-300">
                  <FileText className="h-4 w-4" />
                </div>
                <span className="text-xs font-bold text-emerald-950 dark:text-emerald-200">{s.t("edit_invoice_summary", "Edit Invoice Summary")}</span>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
              <div className="rounded-xl bg-slate-50/80 p-2 dark:bg-slate-800/60">
                <div className="text-lg font-black text-slate-900 dark:text-slate-100">{rows.length}</div>
                <div className="text-[10px] font-bold text-slate-500 uppercase">{s.t("total_edit_invoices", "Total Edit Invoices")}</div>
              </div>
              <div className="rounded-xl bg-blue-50/60 p-2 dark:bg-blue-950/40">
                <div className="text-lg font-black text-blue-600 dark:text-blue-400">{stats.draft}</div>
                <div className="text-[10px] font-bold text-blue-600 uppercase">{s.t("draft", "Draft")}</div>
              </div>
              <div className="rounded-xl bg-emerald-50/60 p-2 dark:bg-emerald-950/40">
                <div className="text-lg font-black text-emerald-600 dark:text-emerald-400">{stats.finalized}</div>
                <div className="text-[10px] font-bold text-emerald-600 uppercase">{s.t("finalized", "Finalized")}</div>
              </div>
              <div className="rounded-xl bg-rose-50/60 p-2 dark:bg-rose-950/40">
                <div className="text-lg font-black text-rose-600 dark:text-rose-400">{stats.void_}</div>
                <div className="text-[10px] font-bold text-rose-600 uppercase">{s.t("void", "Void")}</div>
              </div>
            </div>
          </div>

          {/* Card 3: Source Document Summary (Purple) */}
          <div className="rounded-2xl border border-purple-100 bg-gradient-to-br from-purple-50/70 via-white to-purple-50/20 p-4 shadow-sm dark:border-purple-950/60 dark:from-purple-950/30 dark:via-slate-900 dark:to-slate-900">
            <div className="flex items-center justify-between pb-3 border-b border-purple-100/70 dark:border-purple-900/40">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-purple-100 p-1.5 text-purple-600 dark:bg-purple-900/60 dark:text-purple-300">
                  <Layers className="h-4 w-4" />
                </div>
                <span className="text-xs font-bold text-purple-950 dark:text-purple-200">{s.t("source_document_summary", "Source Document Summary")}</span>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
              <div className="rounded-xl bg-slate-50/80 p-2 dark:bg-slate-800/60">
                <div className="text-lg font-black text-purple-700 dark:text-purple-300">{stats.bySource("purchase_booking")}</div>
                <div className="text-[10px] font-bold text-slate-500 uppercase">{s.t("m_purchase_booking", "Purchase")}</div>
              </div>
              <div className="rounded-xl bg-slate-50/80 p-2 dark:bg-slate-800/60">
                <div className="text-lg font-black text-purple-700 dark:text-purple-300">{stats.bySource("sales_booking")}</div>
                <div className="text-[10px] font-bold text-slate-500 uppercase">{s.t("m_sales_booking", "Sales")}</div>
              </div>
              <div className="rounded-xl bg-slate-50/80 p-2 dark:bg-slate-800/60">
                <div className="text-lg font-black text-purple-700 dark:text-purple-300">{stats.bySource("local_purchase")}</div>
                <div className="text-[10px] font-bold text-slate-500 uppercase">{s.t("m_local_purchase", "Local Purchase")}</div>
              </div>
              <div className="rounded-xl bg-slate-50/80 p-2 dark:bg-slate-800/60">
                <div className="text-lg font-black text-purple-700 dark:text-purple-300">{stats.bySource("local_sales")}</div>
                <div className="text-[10px] font-bold text-slate-500 uppercase">{s.t("m_local_sales", "Local Sales")}</div>
              </div>
            </div>
          </div>

          {/* Card 4: All Countries Edit Invoice Report (Amber + Super Admin Only) */}
          {isSuperAdmin ? (
            <div className="rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50/70 via-white to-amber-50/20 p-4 shadow-sm dark:border-amber-950/60 dark:from-amber-950/30 dark:via-slate-900 dark:to-slate-900">
              <div className="flex items-center justify-between pb-3 border-b border-amber-100/70 dark:border-amber-900/40">
                <span className="text-xs font-bold text-amber-950 dark:text-amber-200">{s.t("all_countries_report", "All Countries Edit Invoice Report")}</span>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-800 dark:bg-amber-900/60 dark:text-amber-300 uppercase tracking-wider">
                  {s.t("super_admin_only", "Super Admin Only")}
                </span>
              </div>
              <div className="mt-3 space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">{s.t("countries", "Countries")}: <b>{stats.countries}</b></span>
                  <span className="text-slate-500 dark:text-slate-400">{s.tGlobal("common.branch", "Branches")}: <b>{stats.branches}</b></span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">{s.t("original_value", "Original Value")}:</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">{fmt(stats.originalValue)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">{s.t("document_value", "Document Value")}:</span>
                  <span className="font-black text-emerald-600 dark:text-emerald-400">{fmt(stats.documentValue)}</span>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* 5. FILTER ROW TOOLBAR */}
        <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search Input */}
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder={s.t("search_placeholder", "Search by invoice number...")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-9 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-blue-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>

            {/* Document Type Dropdown */}
            <select
              value={docFilter}
              onChange={(e) => setDocFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="all">{s.t("all_types", "All Types")}</option>
              {DOC_TYPES.map((d) => <option key={d} value={d}>{s.t(d, d)}</option>)}
            </select>

            {/* Source Module Dropdown */}
            <select
              value={moduleFilter}
              onChange={(e) => setModuleFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="all">{s.t("all_modules", "All Modules")}</option>
              {MODULES.map((m) => <option key={m} value={m}>{s.t(`m_${m}`, m)}</option>)}
            </select>

            {/* Country Dropdown */}
            <select
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="all">{s.tGlobal("common.all_countries", "All Countries")}</option>
              {countryOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>

            {/* Branch Dropdown */}
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              disabled={countryFilter === "all"}
              className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-blue-500 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="all">{s.tGlobal("common.all_branches", "All Branches")}</option>
              {branchOptions.map((b) => <option key={b.id} value={b.id}>{b.city_name ? `${b.name} — ${b.city_name}` : b.name}</option>)}
            </select>

            {/* Status Dropdown */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="all">{s.tGlobal("common.all_statuses", "All Statuses")}</option>
              <option value="finalized">{s.t("finalized", "Finalized")}</option>
              <option value="draft">{s.t("draft", "Draft")}</option>
              <option value="void">{s.t("void", "Void")}</option>
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
            <div className="ms-auto flex items-center gap-2">
              <button
                type="button"
                onClick={() => void load()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                {s.t("refresh", "Refresh")}
              </button>
              <button
                type="button"
                onClick={() => setShowPicker(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition"
              >
                <Plus className="h-4 w-4" />
                {s.t("new_from_bill", "New From Bill")}
              </button>
            </div>
          </div>
        </div>

        {/* 6. MAIN TABLE REGISTER CARD */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
          {/* Card Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 px-5 py-3.5 bg-slate-50/50 dark:bg-slate-800/40">
            <h2 className="text-sm font-black text-slate-900 dark:text-slate-100">
              {s.t("register", "Business Edit Invoice Register")}
            </h2>

            <div className="flex items-center gap-2">
              <UniversalPrintActionButton reportConfig={printConfig} />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/80 text-[11px] font-black uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400">
                  <th className="w-10 px-3 py-3 text-center">#</th>
                  <th className="px-3 py-3 font-black text-slate-700 dark:text-slate-200">{s.t("invoice_no", "Edit Invoice No")}</th>
                  <th className="px-3 py-3 font-black text-slate-700 dark:text-slate-200">{s.t("doc_type", "Document Type")}</th>
                  <th className="px-3 py-3 font-black text-slate-700 dark:text-slate-200">{s.t("source_module", "Source")}</th>
                  <th className="px-3 py-3 font-black text-slate-700 dark:text-slate-200">{s.t("original_bill_no", "Original Bill No")}</th>
                  <th className="px-3 py-3 font-black text-slate-700 dark:text-slate-200">{s.t("party", "Party")}</th>
                  <th className="px-3 py-3 text-right font-black text-slate-700 dark:text-slate-200">{s.t("original_value", "Original Value")}</th>
                  <th className="px-3 py-3 text-right font-black text-slate-700 dark:text-slate-200">{s.t("document_value", "Document Value")}</th>
                  <th className="px-3 py-3 font-black text-slate-700 dark:text-slate-200">{s.t("currency", "Currency")}</th>
                  <th className="px-3 py-3 font-black text-slate-700 dark:text-slate-200">{s.t("created_by", "Created By")}</th>
                  <th className="px-3 py-3 font-black text-slate-700 dark:text-slate-200">{s.t("created_at", "Created Date")}</th>
                  <th className="px-3 py-3 font-black text-slate-700 dark:text-slate-200">{s.t("status", "Status")}</th>
                  <th className="w-20 px-3 py-3 text-right font-black text-slate-700 dark:text-slate-200">{s.t("actions", "Actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={12} className="py-12 text-center text-slate-400">
                      <RefreshCw className="mx-auto h-5 w-5 animate-spin text-blue-600" />
                      <span className="mt-2 block text-xs">{s.t("loading", "Loading…")}</span>
                    </td>
                  </tr>
                ) : pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="py-12 text-center text-slate-400">
                      {s.t("no_invoices", "No business edit invoices yet. Click \"New from Bill\" to create one from a finalized bill.")}
                    </td>
                  </tr>
                ) : (
                  pageRows.map((r, idx) => (
                    <tr
                      key={r.id}
                      className="transition-colors hover:bg-blue-50/20 dark:hover:bg-blue-950/10 border-b border-slate-100 dark:border-slate-800"
                    >
                      <td className="px-3 py-2.5 text-center font-mono text-[11px] text-slate-400">
                        {(currentPage - 1) * pageSize + idx + 1}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                        {r.invoiceNo}
                      </td>
                      <td className="px-3 py-2.5 text-slate-800 dark:text-slate-200 font-medium">
                        {s.t(r.docType, r.docType)}
                      </td>
                      <td className="px-3 py-2.5 text-slate-600 dark:text-slate-400">
                        {s.t(`m_${r.sourceModule}`, r.sourceModule)}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs text-slate-600 dark:text-slate-400">
                        {r.originalBillNo || "—"}
                      </td>
                      <td className="px-3 py-2.5 font-semibold text-slate-900 dark:text-slate-100">
                        {r.partyName || "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-slate-600 dark:text-slate-300">
                        {fmt(r.originalTotalValue)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                        {fmt(r.documentTotalValue)}
                      </td>
                      <td className="px-3 py-2.5 font-medium text-slate-600 dark:text-slate-400">
                        {r.documentCurrency || r.originalCurrency || "—"}
                      </td>
                      <td className="px-3 py-2.5 text-slate-600 dark:text-slate-400">
                        {r.createdByName || "—"}
                      </td>
                      <td className="px-3 py-2.5 text-slate-500 dark:text-slate-400 text-[11px]">
                        {r.createdAt ? new Date(r.createdAt).toLocaleString() : "—"}
                      </td>
                      <td className="px-3 py-2.5">
                        {r.status === "finalized" ? (
                          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300">
                            {s.t("finalized", "Finalized")}
                          </span>
                        ) : r.status === "draft" ? (
                          <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-300">
                            {s.t("draft", "Draft")}
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-bold text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300">
                            {s.t("void", "Void")}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1 text-slate-400">
                          <button
                            type="button"
                            onClick={() => setOpenId(r.id)}
                            className="p-1 hover:text-blue-600 hover:bg-slate-100 rounded dark:hover:bg-slate-800 transition"
                            title={s.t("view", "View")}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setOpenId(r.id)}
                            className="p-1 hover:text-blue-600 hover:bg-slate-100 rounded dark:hover:bg-slate-800 transition"
                            title={s.t("edit", "Edit")}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDelete(r)}
                            className="p-1 hover:text-rose-600 hover:bg-slate-100 rounded dark:hover:bg-slate-800 transition"
                            title={s.t("delete", "Delete")}
                          >
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
              <span>{s.t("per_page", "per page")}</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="me-2">
                {s.t("showing", "Showing")} {displayList.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
                {" "}-{" "}
                {Math.min(currentPage * pageSize, displayList.length)} {s.t("of", "of")} {displayList.length} {s.t("records", "records")}
              </span>
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 font-semibold text-slate-500 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:border-slate-700"
              >
                {s.isRtl ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
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
                {s.isRtl ? <ChevronLeft className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
        </div>

      </div>

      {showPicker && <BillPicker s={s} onClose={() => setShowPicker(false)} onCreated={(id) => { setShowPicker(false); setOpenId(id); void load(); }} />}
      {openId && <InvoiceEditor s={s} id={openId} onClose={() => { setOpenId(null); void load(); }} />}
    </div>
  );
}

/* ── bill picker ─────────────────────────────────────────────────────────── */
function BillPicker({ s, onClose, onCreated }: { s: Screen; onClose: () => void; onCreated: (id: string) => void }) {
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [moduleFilter, setModuleFilter] = useState("all");
  const [q, setQ] = useState("");
  const [docType, setDocType] = useState<string>("commercial_invoice");
  const [creating, setCreating] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (moduleFilter !== "all") qs.set("module", moduleFilter);
      if (q.trim()) qs.set("q", q.trim());
      const r = await fetch(`/api/erp/business-edit-invoices/available-bills?${qs.toString()}`);
      const j = await r.json(); const d = j.data ?? j;
      setBills(d.rows ?? []);
    } finally { setLoading(false); }
  }, [moduleFilter, q]);
  useEffect(() => { void load(); }, [load]);

  const create = async (b: Bill) => {
    setCreating(b.sourceId); setErr(null);
    try {
      const r = await fetch("/api/erp/business-edit-invoices", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceModule: b.sourceModule, sourceId: b.sourceId, docType, lang: s.lang }),
      });
      const j = await r.json(); const d = j.data ?? j;
      if (!r.ok || j.error) throw new Error(j?.error?.message || j?.error || "Request failed");
      onCreated(d.id);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setCreating(null); }
  };

  return (
    <Modal s={s} title={s.t("select_bill", "Select the original bill")} onClose={onClose} wide>
      <div className="flex flex-wrap items-center gap-2">
        <select value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-900">
          <option value="all">{s.t("source_module", "Source")}</option>
          {MODULES.map((m) => <option key={m} value={m}>{s.t(`m_${m}`, m)}</option>)}
        </select>
        <select value={docType} onChange={(e) => setDocType(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-900">
          {DOC_TYPES.map((d) => <option key={d} value={d}>{s.t(d, d)}</option>)}
        </select>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={s.t("original_bill_no", "Original Bill No")}
          className="w-48 rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-900" />
      </div>
      {err && <p className="mt-2 rounded-lg bg-rose-50 px-3 py-1.5 text-[11px] text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{err}</p>}
      <div className="mt-3 max-h-[55vh] overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800">
        <table className="w-full text-start text-xs">
          <thead className="sticky top-0 bg-slate-50 text-slate-500 dark:bg-slate-800/70">
            <tr>
              <th className={`p-2 ${s.textStart}`}>{s.t("original_bill_no", "Original Bill No")}</th>
              <th className={`p-2 ${s.textStart}`}>{s.t("source_module", "Source")}</th>
              <th className={`p-2 ${s.textStart}`}>{s.t("branch_company", "Branch / Company")}</th>
              <th className={`p-2 ${s.textStart}`}>{s.t("party", "Party")}</th>
              <th className="p-2 text-end">{s.t("original_value", "Original Value")}</th>
              <th className="p-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {loading ? <tr><td colSpan={6} className="p-8 text-center text-slate-400">{s.t("loading", "Loading…")}</td></tr>
              : bills.length === 0 ? <tr><td colSpan={6} className="p-8 text-center text-slate-400">{s.t("no_bills", "No finalized bills available in your scope.")}</td></tr>
              : bills.map((b) => (
                <tr key={`${b.sourceModule}:${b.sourceId}`} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                  <td className="p-2 font-bold">{b.billNo || b.manualBillNo || "—"}<div className="text-[10px] text-slate-400">{fmtD(b.transactionDate)}</div></td>
                  <td className="p-2">{s.t(`m_${b.sourceModule}`, b.sourceModule)}</td>
                  <td className="p-2">{b.branchLabel || "—"}</td>
                  <td className="p-2">{b.partyName || "—"}</td>
                  <td className="p-2 text-end tabular-nums">{b.currency} {fmt(b.originalBillAmount)}</td>
                  <td className="p-2">
                    <button type="button" disabled={creating === b.sourceId} onClick={() => void create(b)}
                      className="rounded-lg bg-blue-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-blue-700 disabled:opacity-50">
                      {creating === b.sourceId ? "…" : s.t("create", "Create Editable Invoice")}
                      {b.existingInvoiceCount > 0 ? ` (${b.existingInvoiceCount})` : ""}
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}

/* ── invoice editor ─────────────────────────────────────────────────────── */
function InvoiceEditor({ s, id, onClose }: { s: Screen; id: string; onClose: () => void }) {
  const [inv, setInv] = useState<Invoice | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<"edit" | "versions" | "audit">("edit");
  const [versions, setVersions] = useState<Array<{ versionNo: number; documentTotalValue: number | null; changedAt: string; changedByName: string }>>([]);
  const [events, setEvents] = useState<Array<{ type: string; actor: string; at: string }>>([]);

  const load = useCallback(async () => {
    const r = await fetch(`/api/erp/business-edit-invoices/${id}?original=1`);
    const j = await r.json(); const d = j.data ?? j;
    setInv(d.invoice ?? null);
  }, [id]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (tab === "versions") void fetch(`/api/erp/business-edit-invoices/${id}/versions`).then((r) => r.json()).then((j) => setVersions((j.data ?? j).versions ?? []));
    if (tab === "audit") void fetch(`/api/erp/business-edit-invoices/${id}/audit`).then((r) => r.json()).then((j) => setEvents((j.data ?? j).events ?? []));
  }, [tab, id]);

  if (!inv) return <Modal s={s} title={s.t("loading", "Loading…")} onClose={onClose}><div className="p-6 text-sm text-slate-400">{s.t("loading", "Loading…")}</div></Modal>;

  const setH = <K extends keyof Invoice>(k: K, v: Invoice[K]) => setInv((p) => (p ? { ...p, [k]: v } : p));
  const setLine = (i: number, k: keyof Line, v: unknown) => setInv((p) => {
    if (!p) return p;
    const lines = p.lines.map((l, idx) => {
      if (idx !== i) return l;
      const next: Line = { ...l, [k]: v as never };
      if (k === "documentUnitPrice") next.documentAmount = v != null && l.quantity != null ? Number(v) * Number(l.quantity) : l.documentAmount;
      if (k === "quantity") next.documentAmount = l.documentUnitPrice != null && v != null ? Number(l.documentUnitPrice) * Number(v) : next.documentAmount;
      return next;
    });
    const documentTotalValue = lines.reduce((sum, l) => sum + (Number(l.documentAmount) || 0), 0);
    return { ...p, lines, documentTotalValue };
  });

  const save = async () => {
    setSaving(true); setErr(null);
    try {
      const r = await fetch(`/api/erp/business-edit-invoices/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          docType: inv.docType, documentNo: inv.documentNo, documentDate: inv.documentDate || null,
          documentCurrency: inv.documentCurrency, documentTotalValue: inv.documentTotalValue,
          partyName: inv.partyName, destination: inv.destination, incoterms: inv.incoterms,
          paymentTerms: inv.paymentTerms, notes: inv.notes, validity: inv.validity, signatureName: inv.signatureName,
          lines: inv.lines,
        }),
      });
      const j = await r.json();
      if (!r.ok || j.error) throw new Error(j?.error?.message || j?.error || "Save failed");
      await load();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setSaving(false); }
  };

  const preview = async () => {
    setErr(null);
    const r = await fetch(`/api/erp/business-edit-invoices/${id}/document?lang=${s.lang}`);
    const j = await r.json(); const d = j.data ?? j;
    if (d?.html) printStore.openPrint(d.html, d.title || inv.invoiceNo, { lang: s.lang });
    else setErr(j?.error?.message || "Could not render the document.");
  };

  const setStatus = async (status: string) => {
    setErr(null);
    const r = await fetch(`/api/erp/business-edit-invoices/${id}/status`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }),
    });
    const j = await r.json();
    if (!r.ok || j.error) { setErr(j?.error?.message || j?.error || "Request failed"); return; }
    await load();
  };

  const ro = !inv.canEdit;
  const inputCls = "w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900 disabled:opacity-60";

  return (
    <Modal s={s} title={`${inv.invoiceNo} · ${s.t(inv.docType, inv.docType)}`} onClose={onClose} wide>
      <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2 text-xs dark:border-slate-800">
        {(["edit", "versions", "audit"] as const).map((tKey) => (
          <button key={tKey} type="button" onClick={() => setTab(tKey)}
            className={`rounded-lg px-2.5 py-1 font-bold ${tab === tKey ? "bg-blue-600 text-white" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"}`}>
            {tKey === "edit" ? s.t("edit", "Edit") : tKey === "versions" ? s.t("version_history", "Version History") : s.t("audit_trail", "Audit Trail")}
          </button>
        ))}
        <div className="ms-auto flex items-center gap-1.5">
          <button type="button" onClick={() => void preview()} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 font-bold hover:bg-slate-50 dark:border-slate-700">
            <Printer className="h-3.5 w-3.5" />{s.t("print_pdf", "Print / PDF")}
          </button>
          {inv.isManager && inv.status !== "finalized" && <button type="button" onClick={() => void setStatus("finalized")} className="rounded-lg bg-emerald-600 px-2.5 py-1 font-bold text-white">{s.t("finalize", "Finalize")}</button>}
          {inv.isManager && inv.status === "finalized" && <button type="button" onClick={() => void setStatus("draft")} className="rounded-lg border border-amber-300 px-2.5 py-1 font-bold text-amber-700">{s.t("reopen", "Reopen")}</button>}
        </div>
      </div>

      {err && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-1.5 text-[11px] text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{err}</p>}

      {tab === "edit" && (
        <div className="space-y-4">
          <div className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-[11px] dark:border-slate-800 dark:bg-slate-900/40 sm:grid-cols-3">
            <div><span className="text-slate-400">{s.t("original_bill_no", "Original Bill No")}: </span><b>{inv.originalBillNo || inv.originalManualBillNo || "—"}</b></div>
            <div><span className="text-slate-400">{s.t("original_value", "Original Value")}: </span><b>{inv.originalCurrency} {fmt(inv.originalTotalValue)}</b></div>
            <div><span className="text-slate-400">{s.t("branch_company", "Branch / Company")}: </span><b>{inv.branchLabel || "—"}</b></div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="text-[11px] font-bold text-slate-500">{s.t("doc_type", "Document Type")}
              <select disabled={ro} value={inv.docType} onChange={(e) => setH("docType", e.target.value)} className={inputCls}>
                {DOC_TYPES.map((d) => <option key={d} value={d}>{s.t(d, d)}</option>)}
              </select></label>
            <label className="text-[11px] font-bold text-slate-500">{s.t("document_no_field", "Document / Invoice No")}
              <input disabled={ro} value={inv.documentNo ?? ""} onChange={(e) => setH("documentNo", e.target.value)} className={inputCls} /></label>
            <label className="text-[11px] font-bold text-slate-500">{s.t("document_date", "Document Date")}
              <input disabled={ro} type="date" value={fmtD(inv.documentDate)} onChange={(e) => setH("documentDate", e.target.value)} className={inputCls} /></label>
            <label className="text-[11px] font-bold text-slate-500">{s.t("currency", "Currency")}
              <input disabled={ro} value={inv.documentCurrency ?? ""} onChange={(e) => setH("documentCurrency", e.target.value.toUpperCase())} className={inputCls} /></label>
            <label className="text-[11px] font-bold text-slate-500">{inv.txnKind === "sales" ? s.t("customer", "Customer") : s.t("supplier", "Supplier")}
              <input disabled={ro} value={inv.partyName ?? ""} onChange={(e) => setH("partyName", e.target.value)} className={inputCls} /></label>
            <label className="text-[11px] font-bold text-slate-500">{s.t("destination", "Destination")}
              <input disabled={ro} value={inv.destination ?? ""} onChange={(e) => setH("destination", e.target.value)} className={inputCls} /></label>
            <label className="text-[11px] font-bold text-slate-500">{s.t("incoterms", "Incoterms")}
              <input disabled={ro} value={inv.incoterms ?? ""} onChange={(e) => setH("incoterms", e.target.value)} className={inputCls} /></label>
            <label className="text-[11px] font-bold text-slate-500">{s.t("payment_terms", "Payment Terms")}
              <input disabled={ro} value={inv.paymentTerms ?? ""} onChange={(e) => setH("paymentTerms", e.target.value)} className={inputCls} /></label>
            <label className="text-[11px] font-bold text-slate-500">{s.t("validity", "Validity")}
              <input disabled={ro} value={inv.validity ?? ""} onChange={(e) => setH("validity", e.target.value)} className={inputCls} /></label>
            <label className="text-[11px] font-bold text-slate-500">{s.t("signature_name", "Authorized Signatory")}
              <input disabled={ro} value={inv.signatureName ?? ""} onChange={(e) => setH("signatureName", e.target.value)} className={inputCls} /></label>
            <label className="text-[11px] font-bold text-slate-500 sm:col-span-2 lg:col-span-3">{s.t("notes", "Notes")}
              <textarea disabled={ro} value={inv.notes ?? ""} onChange={(e) => setH("notes", e.target.value)} rows={2} className={inputCls} /></label>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-start text-[11px]">
              <thead className="bg-slate-50 text-slate-500 dark:bg-slate-800/50">
                <tr>
                  <th className={`p-1.5 ${s.textStart}`}>{s.t("description", "Description")}</th>
                  <th className={`p-1.5 ${s.textStart}`}>{s.t("hs_code", "HS Code")}</th>
                  <th className="p-1.5 text-end">{s.t("quantity", "Quantity")}</th>
                  <th className={`p-1.5 ${s.textStart}`}>{s.t("unit", "Unit")}</th>
                  <th className="p-1.5 text-end">{s.t("net_weight", "Net Weight")}</th>
                  <th className="p-1.5 text-end">{s.t("original_unit_price", "Original Unit Price")}</th>
                  <th className="p-1.5 text-end">{s.t("document_unit_price", "Document Unit Price")}</th>
                  <th className="p-1.5 text-end">{s.t("amount", "Amount")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {inv.lines.map((l, i) => (
                  <tr key={l.id ?? i}>
                    <td className="p-1.5"><input disabled={ro} value={l.description ?? l.goodsName ?? ""} onChange={(e) => setLine(i, "description", e.target.value)} className={inputCls} /></td>
                    <td className="p-1.5"><input disabled={ro} value={l.hsCode ?? ""} onChange={(e) => setLine(i, "hsCode", e.target.value)} className={`${inputCls} w-24`} /></td>
                    <td className="p-1.5 text-end"><input disabled={ro} type="number" value={l.quantity ?? ""} onChange={(e) => setLine(i, "quantity", e.target.value === "" ? null : Number(e.target.value))} className={`${inputCls} w-20 text-end`} /></td>
                    <td className="p-1.5"><input disabled={ro} value={l.unit ?? ""} onChange={(e) => setLine(i, "unit", e.target.value)} className={`${inputCls} w-16`} /></td>
                    <td className="p-1.5 text-end"><input disabled={ro} type="number" value={l.netWeight ?? ""} onChange={(e) => setLine(i, "netWeight", e.target.value === "" ? null : Number(e.target.value))} className={`${inputCls} w-24 text-end`} /></td>
                    <td className="p-1.5 text-end tabular-nums text-slate-400">{fmt(l.originalUnitPrice)}</td>
                    <td className="p-1.5 text-end"><input disabled={ro} type="number" value={l.documentUnitPrice ?? ""} onChange={(e) => setLine(i, "documentUnitPrice", e.target.value === "" ? null : Number(e.target.value))} className={`${inputCls} w-24 text-end font-bold`} /></td>
                    <td className="p-1.5 text-end font-bold tabular-nums">{fmt(l.documentAmount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-300 dark:border-slate-700">
                  <td colSpan={7} className="p-1.5 text-end font-bold">{s.t("document_value", "Document Value")}</td>
                  <td className="p-1.5 text-end font-black tabular-nums">{inv.documentCurrency} {fmt(inv.documentTotalValue)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {!ro && (
            <div className="flex justify-end">
              <button type="button" onClick={() => void save()} disabled={saving} className="inline-flex items-center gap-2 rounded-xl !bg-blue-600 px-5 py-2 text-xs font-bold !text-white hover:!bg-blue-700 disabled:opacity-60">
                {saving ? "…" : s.t("save", "Save")}
              </button>
            </div>
          )}
        </div>
      )}

      {tab === "versions" && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-start text-xs">
            <thead className="bg-slate-50 text-slate-500 dark:bg-slate-800/50"><tr>
              <th className={`p-2 ${s.textStart}`}>{s.t("version", "Version")}</th>
              <th className="p-2 text-end">{s.t("document_value", "Document Value")}</th>
              <th className={`p-2 ${s.textStart}`}>{s.t("created_by", "Created By")}</th>
              <th className={`p-2 ${s.textStart}`}>{s.t("created_at", "Date / Time")}</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {versions.map((v) => (
                <tr key={v.versionNo}><td className="p-2 font-bold">v{v.versionNo}</td>
                  <td className="p-2 text-end tabular-nums">{fmt(v.documentTotalValue)}</td>
                  <td className="p-2">{v.changedByName}</td>
                  <td className="p-2">{new Date(v.changedAt).toLocaleString()}</td></tr>
              ))}
              {versions.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-slate-400">—</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {tab === "audit" && (
        <ul className="space-y-1.5 text-xs">
          {events.map((e, i) => (
            <li key={i} className="rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-800">
              <b className="uppercase">{e.type}</b> · {e.actor} · {new Date(e.at).toLocaleString()}
            </li>
          ))}
          {events.length === 0 && <li className="p-6 text-center text-slate-400">—</li>}
        </ul>
      )}
    </Modal>
  );
}

function Modal({ s, title, onClose, children, wide }: { s: Screen; title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/40 backdrop-blur-sm p-3 sm:p-6" onClick={onClose}>
      <div dir={s.dir} className={`w-full ${wide ? "max-w-5xl" : "max-w-lg"} rounded-2xl bg-white p-4 shadow-2xl dark:bg-slate-950`} onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-black text-slate-900 dark:text-slate-50">{title}</h2>
          <button type="button" onClick={onClose} aria-label={s.t("edit", "Edit")} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
