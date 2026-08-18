"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useMemo, useState, useRef } from "react";
import {
  Building2,
  Calendar,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock,
  Download,
  Eye,
  FileText,
  Filter,
  Globe,
  MoreVertical,
  Printer,
  RefreshCw,
  Search,
  SlidersHorizontal,
  TrendingDown,
  TrendingUp,
  Wallet,
  PieChart,
  X,
  XCircle,
  AlertTriangle,
  AlertCircle,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  Share2,
  Send,
  Sparkles,
  Landmark,
  ShieldCheck,
  Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SimpleModal } from "@/components/ui/simple-modal";
import { apiGet, apiPost } from "@/lib/api/client";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { t } from "@/lib/i18n/ui";
import { cn } from "@/lib/utils";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";

export type BankTransactionRow = {
  id: string;
  entry_serial_number: string;
  voucher_no?: string | null;
  journal_no?: string | null;
  entry_date: string;
  entry_time: string;
  user_id?: string | null;
  user_name: string;
  bank_id?: string | null;
  bank_name: string;
  bank_code?: string | null;
  cheque_no?: string | null;
  particulars: string;
  cheque_date?: string | null;
  due_date?: string | null;
  debit: number;
  credit: number;
  currency: string;
  status: "cleared" | "pending" | "post_dated" | "overdue" | "dishonored";
  effective_status?: string;
  is_due_today?: boolean;
  is_overdue?: boolean;
  running_balance?: number;
  cleared_at?: string | null;
  dishonored_at?: string | null;
  dishonor_reason?: string | null;
  presented_at?: string | null;
  notes?: string | null;
  audit_trail?: Array<{
    action: string;
    actor: string;
    actor_id?: string;
    timestamp: string;
    reason?: string;
    notes?: string;
  }>;
  company_id?: string | null;
  country_id?: string | null;
  country_branch_id?: string | null;
  city_branch_id?: string | null;
  company?: { id: string; name: string } | null;
  country?: { id: string; name: string; currency_code?: string } | null;
  country_branch?: { id: string; name: string; code?: string } | null;
  city_branch?: { id: string; name: string; code?: string } | null;
};

export type BankRoznamchaSummary = {
  totalEntries: number;
  openingBalance: number;
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
  clearedCount: number;
  pendingCount: number;
  postDatedCount: number;
  overdueCount: number;
  dishonoredCount: number;
  dueTodayCount: number;
  clearedTodayCount: number;
};

type ApiResponse = {
  entries: BankTransactionRow[];
  totalCount: number;
  page: number;
  pageSize: number;
  summary: BankRoznamchaSummary;
};

type ScopeOption = { id: string; name: string; code?: string };

function fmtNumber(value: number | undefined | null) {
  const n = Number(value || 0);
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDateDisplay(dateStr?: string | null) {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, "0");
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const dayOfWeek = daysOfWeek[d.getDay()];
    return `${day} ${month} ${year} (${dayOfWeek})`;
  } catch {
    return dateStr;
  }
}

function formatShortDate(dateStr?: string | null) {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, "0");
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  } catch {
    return dateStr;
  }
}

function formatTimeOnly(timeStr?: string | null) {
  if (!timeStr) return "";
  try {
    const d = new Date(timeStr);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: true });
  } catch {
    return "";
  }
}

export function BankRoznamchaReportView({ lang, pageTitle }: { lang: SupportedLanguage; pageTitle?: string }) {
  const activeLang = useActiveLanguage() || lang;
  const isRtl = ["ur", "ar", "fa", "ps"].includes(activeLang);
  // Compact shorthand over the central i18n dictionary (lib/i18n/ui.ts). Every key below carries
  // EN/UR/PS/FA/AR values there; the second arg is the English fallback only.
  const tt = (key: string, fallback: string) => t(activeLang, key as never, fallback);

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [activeTab, setActiveTab] = useState<string>("all");
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Scope lists for filters
  const [companies, setCompanies] = useState<ScopeOption[]>([]);
  const [countries, setCountries] = useState<ScopeOption[]>([]);
  const [countryBranches, setCountryBranches] = useState<ScopeOption[]>([]);
  const [cityBranches, setCityBranches] = useState<ScopeOption[]>([]);
  const [bankList, setBankList] = useState<Array<{ id: string; bank_name: string; short_name: string }>>([]);

  // Active Filter state
  const [fromDate, setFromDate] = useState("2024-05-01");
  const [toDate, setToDate] = useState("2024-05-15");
  const [companyId, setCompanyId] = useState("all");
  const [countryId, setCountryId] = useState("all");
  const [countryBranchId, setCountryBranchId] = useState("all");
  const [cityBranchId, setCityBranchId] = useState("all");
  const [bankName, setBankName] = useState("all");
  const [chequeNo, setChequeNo] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [lastUpdated, setLastUpdated] = useState<string>("");

  // Modals state
  const [actionModalRow, setActionModalRow] = useState<BankTransactionRow | null>(null);
  const [actionType, setActionType] = useState<"clear" | "dishonor" | "present" | "view">("view");
  const [actionNotes, setActionNotes] = useState("");
  const [dishonorReason, setDishonorReason] = useState("Insufficient funds");
  const [actionSubmitting, setActionSubmitting] = useState(false);

  const [newEntryModalOpen, setNewEntryModalOpen] = useState(false);
  const [newEntry, setNewEntry] = useState({
    type: "credit",
    bankName: "Habib Bank Limited",
    bankCode: "HBL",
    chequeNo: "",
    particulars: "",
    chequeDate: new Date().toISOString().slice(0, 10),
    dueDate: new Date().toISOString().slice(0, 10),
    amount: "",
    currency: "PKR",
    branchName: "Al Ras Branch",
    branchNo: "BR-001",
    notes: ""
  });

  // Load scopes on mount
  useEffect(() => {
    async function loadMasterScopes() {
      try {
        const [compRes, cntRes, cbRes, cibRes, bnkRes] = await Promise.all([
          apiGet<{ companies: ScopeOption[] }>("/api/erp/companies").catch(() => ({ companies: [] })),
          apiGet<{ countries: ScopeOption[] }>("/api/erp/countries").catch(() => ({ countries: [] })),
          apiGet<{ countryBranches: ScopeOption[] }>("/api/erp/country-branches").catch(() => ({ countryBranches: [] })),
          apiGet<{ cityBranches: ScopeOption[] }>("/api/erp/city-branches").catch(() => ({ cityBranches: [] })),
          apiGet<{ banks: Array<{ id: string; bank_name: string; short_name: string }> }>("/api/erp/banks").catch(() => ({ banks: [] }))
        ]);
        if (compRes?.companies) setCompanies(compRes.companies);
        if (cntRes?.countries) setCountries(cntRes.countries);
        if (cbRes?.countryBranches) setCountryBranches(cbRes.countryBranches);
        if (cibRes?.cityBranches) setCityBranches(cibRes.cityBranches);
        if (bnkRes?.banks) setBankList(bnkRes.banks);
      } catch (e) {
        console.error("Failed to load scopes", e);
      }
    }
    void loadMasterScopes();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (fromDate) params.set("fromDate", fromDate);
      if (toDate) params.set("toDate", toDate);
      if (companyId !== "all") params.set("companyId", companyId);
      if (countryId !== "all") params.set("countryId", countryId);
      if (countryBranchId !== "all") params.set("countryBranchId", countryBranchId);
      if (cityBranchId !== "all") params.set("cityBranchId", cityBranchId);
      if (bankName !== "all") params.set("bankName", bankName);
      if (chequeNo.trim()) params.set("chequeNo", chequeNo.trim());
      if (searchQuery.trim()) params.set("q", searchQuery.trim());
      if (activeTab !== "all") params.set("tab", activeTab);
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      params.set("sortBy", "entry_date");
      params.set("sortDir", "asc");

      const res = await apiGet<ApiResponse>(`/api/erp/bank-roznamcha?${params.toString()}`);
      setData(res);
      setLastUpdated(new Date().toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }) + " " + new Date().toLocaleDateString());
    } catch (e) {
      console.error("Failed to load bank roznamcha data:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromDate, toDate, companyId, countryId, countryBranchId, cityBranchId, bankName, activeTab, page, pageSize]);

  function handleResetFilters() {
    setFromDate("2024-05-01");
    setToDate("2024-05-15");
    setCompanyId("all");
    setCountryId("all");
    setCountryBranchId("all");
    setCityBranchId("all");
    setBankName("all");
    setChequeNo("");
    setSearchQuery("");
    setActiveTab("all");
    setPage(1);
  }

  async function handleChequeActionSubmit() {
    if (!actionModalRow) return;
    setActionSubmitting(true);
    try {
      await apiPost(`/api/erp/bank-roznamcha/${actionModalRow.id}/status`, {
        action: actionType,
        notes: actionNotes,
        reason: actionType === "dishonor" ? dishonorReason : undefined
      });
      setActionModalRow(null);
      setActionNotes("");
      void loadData();
    } catch (e: any) {
      alert(`Action failed: ${e?.message || "Unknown error"}`);
    } finally {
      setActionSubmitting(false);
    }
  }

  async function handleCreateNewEntry(e: React.FormEvent) {
    e.preventDefault();
    if (!newEntry.amount || Number(newEntry.amount) <= 0) {
      alert("Please enter a valid amount");
      return;
    }
    try {
      const isDebit = newEntry.type === "debit";
      await apiPost("/api/erp/bank-roznamcha", {
        bankName: newEntry.bankName,
        bankCode: newEntry.bankCode,
        chequeNo: newEntry.chequeNo || `CHK-${Math.floor(100000 + Math.random() * 900000)}`,
        particulars: newEntry.particulars || "Bank Transaction",
        chequeDate: newEntry.chequeDate,
        dueDate: newEntry.dueDate,
        debit: isDebit ? Number(newEntry.amount) : 0,
        credit: !isDebit ? Number(newEntry.amount) : 0,
        currency: newEntry.currency,
        notes: newEntry.notes,
        status: "pending"
      });
      setNewEntryModalOpen(false);
      void loadData();
    } catch (err: any) {
      alert(`Failed to save entry: ${err?.message || "Unknown error"}`);
    }
  }

  // Print Official Journal Table
  function handlePrintReport() {
    if (typeof window === "undefined" || !data) return;
    const win = window.open("", "_blank", "width=1200,height=900");
    if (!win) return;

    const rowsHtml = (data.entries || [])
      .map(
        (r, idx) => `
        <tr class="${r.effective_status === "dishonored" || r.effective_status === "overdue" ? "warn-row" : ""}">
          <td style="text-align: center;">${idx + 1 + (page - 1) * pageSize}</td>
          <td style="text-align: center; font-weight: bold;">${r.entry_serial_number}</td>
          <td>${formatShortDate(r.entry_date)}<br/><small style="color:#666;">${formatTimeOnly(r.entry_time)}</small></td>
          <td style="text-align: center;">${r.city_branch?.code || r.country_branch?.code || "BR-001"}</td>
          <td>${r.city_branch?.name || r.country_branch?.name || "Main Branch"}</td>
          <td>${r.user_name}</td>
          <td><strong>${r.bank_name}</strong>${r.bank_code ? ` <small>(${r.bank_code})</small>` : ""}</td>
          <td style="font-family: monospace;">${r.cheque_no || "-"}</td>
          <td>${r.particulars}</td>
          <td>${formatShortDate(r.cheque_date)}</td>
          <td>${formatShortDate(r.due_date)}</td>
          <td style="text-align: right; color: #dc2626; font-family: monospace;">${r.debit ? fmtNumber(r.debit) : "-"}</td>
          <td style="text-align: right; color: #16a34a; font-family: monospace; font-weight: bold;">${r.credit ? fmtNumber(r.credit) : "-"}</td>
          <td style="text-align: right; font-weight: bold; font-family: monospace;">${fmtNumber(r.running_balance)}</td>
          <td style="text-align: center;">
            <span class="badge badge-${r.effective_status || r.status}">${(r.effective_status || r.status).toUpperCase()}</span>
          </td>
        </tr>
      `
      )
      .join("");

    win.document.write(`
      <!DOCTYPE html>
      <html dir="${isRtl ? "rtl" : "ltr"}">
      <head>
        <title>${tt("bankroz.title", "Bank Roznamcha / Cheque Management Report")}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; color: #1e293b; font-size: 11px; }
          .header { border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; }
          .header h1 { font-size: 20px; margin: 0 0 4px 0; color: #0f172a; }
          .header .meta { font-size: 12px; color: #475569; display: flex; flex-wrap: wrap; gap: 16px; margin-top: 6px; }
          .summary-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; margin-bottom: 16px; }
          .summary-card { border: 1px solid #cbd5e1; padding: 8px; border-radius: 4px; background: #f8fafc; }
          .summary-card .label { font-size: 9px; text-transform: uppercase; color: #64748b; font-weight: bold; }
          .summary-card .val { font-size: 14px; font-weight: bold; margin-top: 2px; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; }
          th, td { border: 1px solid #cbd5e1; padding: 6px 4px; text-align: left; }
          th { background: #0f172a; color: #ffffff; font-size: 10px; text-transform: uppercase; }
          .warn-row { background-color: #fff1f2; }
          .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: bold; }
          .badge-cleared { background: #dcfce7; color: #15803d; }
          .badge-pending { background: #fef3c7; color: #b45309; }
          .badge-post_dated { background: #dbeafe; color: #1d4ed8; }
          .badge-overdue { background: #fee2e2; color: #b91c1c; }
          .badge-dishonored { background: #fee2e2; color: #b91c1c; }
          .signatures { margin-top: 40px; display: flex; justify-content: space-between; font-weight: bold; }
          .sig-line { border-top: 1px solid #000; width: 180px; text-align: center; padding-top: 4px; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🏛️ ${tt("bankroz.title", "Bank Roznamcha / Cheque Management Report")}</h1>
          <div class="meta">
            <div><strong>${tt("bankroz.company_label", "Company:")}</strong> DGT International LLC</div>
            <div><strong>${tt("bankroz.country_label", "Country:")}</strong> Pakistan (PKR)</div>
            <div><strong>${tt("bankroz.date_range", "Date Range:")}</strong> ${fromDate} to ${toDate}</div>
            <div><strong>${tt("bankroz.printed_by", "Printed By:")}</strong> Super Admin</div>
            <div><strong>${tt("bankroz.generated_at", "Generated At:")}</strong> ${new Date().toLocaleString()}</div>
          </div>
        </div>

        <div class="summary-grid">
          <div class="summary-card"><div class="label">${tt("bankroz.total_entries", "Total Entries")}</div><div class="val">${data.summary.totalEntries}</div></div>
          <div class="summary-card"><div class="label">${tt("bankroz.opening_balance", "Opening Balance")}</div><div class="val" style="color:#2563eb;">${fmtNumber(data.summary.openingBalance)} PKR</div></div>
          <div class="summary-card"><div class="label">${tt("bankroz.total_debit", "Total Debit")}</div><div class="val" style="color:#dc2626;">${fmtNumber(data.summary.totalDebit)} PKR</div></div>
          <div class="summary-card"><div class="label">${tt("bankroz.total_credit", "Total Credit")}</div><div class="val" style="color:#16a34a;">${fmtNumber(data.summary.totalCredit)} PKR</div></div>
          <div class="summary-card"><div class="label">${tt("bankroz.closing_balance", "Closing Balance")}</div><div class="val" style="color:#7c3aed;">${fmtNumber(data.summary.closingBalance)} PKR</div></div>
          <div class="summary-card"><div class="label">${tt("bankroz.pending_cheques", "Pending Cheques")}</div><div class="val" style="color:#d97706;">${data.summary.pendingCount}</div></div>
        </div>

        <table>
          <thead>
            <tr>
              <th>${tt("bankroz.sr", "Sr #")}</th>
              <th>${tt("bankroz.entry_no", "Entry #")}</th>
              <th>${tt("bankroz.date_time", "Date / Time")}</th>
              <th>${tt("bankroz.branch_no", "Branch No.")}</th>
              <th>${tt("bankroz.branch_name", "Branch Name")}</th>
              <th>${tt("bankroz.user_name", "User Name")}</th>
              <th>${tt("bankroz.bank_name", "Bank Name")}</th>
              <th>${tt("bankroz.cheque_hash", "Cheque #")}</th>
              <th>${tt("bankroz.particulars", "Particulars")}</th>
              <th>${tt("bankroz.cheque_date", "Cheque Date")}</th>
              <th>${tt("bankroz.due_date", "Due Date")}</th>
              <th>${tt("bankroz.debit", "Debit")} (PKR)</th>
              <th>${tt("bankroz.credit", "Credit")} (PKR)</th>
              <th>${tt("bankroz.balance", "Balance")} (PKR)</th>
              <th>${tt("bankroz.status", "Status")}</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
          <tfoot>
            <tr style="background: #f1f5f9; font-weight: bold;">
              <td colspan="11" style="text-align: right;">${tt("bankroz.totals", "Totals")} (${tt("bankroz.opening_balance", "Opening Balance")}: ${fmtNumber(data.summary.openingBalance)} PKR):</td>
              <td style="text-align: right; color: #dc2626;">${fmtNumber(data.summary.totalDebit)}</td>
              <td style="text-align: right; color: #16a34a;">${fmtNumber(data.summary.totalCredit)}</td>
              <td style="text-align: right; color: #7c3aed;">${fmtNumber(data.summary.closingBalance)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>

        <div class="signatures">
          <div class="sig-line">${tt("bankroz.prepared_by", "Prepared By")}</div>
          <div class="sig-line">${tt("bankroz.verified_by", "Verified By (Accounts)")}</div>
          <div class="sig-line">${tt("bankroz.branch_manager", "Branch Manager")}</div>
          <div class="sig-line">${tt("bankroz.authorized_signatory", "Authorized Signatory")}</div>
        </div>
      </body>
      </html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 350);
  }

  // Export to CSV/Excel
  function handleExcelExport() {
    if (!data || !data.entries.length) return;
    const headers = [
      "Sr #",
      "Entry Serial #",
      "Date",
      "Time",
      "Branch No",
      "Branch Name",
      "User Name",
      "Bank Name",
      "Bank Code",
      "Cheque #",
      "Details / Particulars",
      "Cheque Date",
      "Due Date",
      "Debit (PKR)",
      "Credit (PKR)",
      "Running Balance (PKR)",
      "Status",
      "Cleared Date",
      "Dishonor Reason",
      "Notes"
    ];

    const csvRows = data.entries.map((r, idx) => [
      String(idx + 1 + (page - 1) * pageSize),
      `"${r.entry_serial_number || ""}"`,
      `"${formatShortDate(r.entry_date)}"`,
      `"${formatTimeOnly(r.entry_time)}"`,
      `"${r.city_branch?.code || r.country_branch?.code || "BR-001"}"`,
      `"${r.city_branch?.name || r.country_branch?.name || "Main Branch"}"`,
      `"${r.user_name || ""}"`,
      `"${r.bank_name || ""}"`,
      `"${r.bank_code || ""}"`,
      `"${r.cheque_no || ""}"`,
      `"${(r.particulars || "").replace(/"/g, '""')}"`,
      `"${formatShortDate(r.cheque_date)}"`,
      `"${formatShortDate(r.due_date)}"`,
      r.debit ? String(r.debit) : "0.00",
      r.credit ? String(r.credit) : "0.00",
      r.running_balance ? String(r.running_balance) : "0.00",
      `"${r.effective_status || r.status}"`,
      `"${r.cleared_at ? formatShortDate(r.cleared_at) : ""}"`,
      `"${(r.dishonor_reason || "").replace(/"/g, '""')}"`,
      `"${(r.notes || "").replace(/"/g, '""')}"`
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...csvRows.map((r) => r.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Bank_Roznamcha_Report_${fromDate}_to_${toDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const rows = data?.entries || [];
  const summary = data?.summary || {
    totalEntries: 0,
    openingBalance: 0,
    totalDebit: 0,
    totalCredit: 0,
    closingBalance: 0,
    clearedCount: 0,
    pendingCount: 0,
    postDatedCount: 0,
    overdueCount: 0,
    dishonoredCount: 0,
    dueTodayCount: 0,
    clearedTodayCount: 0
  };

  const totalPages = Math.ceil((data?.totalCount || 0) / pageSize) || 1;

  return (
    <div className={cn("space-y-4 pb-12", isRtl && "font-sans")} dir={isRtl ? "rtl" : "ltr"}>
      {/* Top Header & Breadcrumb Bar */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between border-b pb-3 pt-1">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>{t(activeLang, "nav.dashboard", "Dashboard")}</span>
            <span>&gt;</span>
            <span>{t(activeLang, "nav.accounts", "Accounts")}</span>
            <span>&gt;</span>
            <span>{t(activeLang, "nav.bank_management", "Bank Management")}</span>
            <span>&gt;</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {t(activeLang, "roz.bank_roznamcha", "Bank Roznamcha Report")}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm">
              <Landmark className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                {pageTitle || t(activeLang, "roz.bank_roznamcha", "Bank Roznamcha Report")}
              </h1>
            </div>
          </div>
        </div>

        {/* Top Right Action Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Date Range Display Pill */}
          <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm dark:text-slate-300">
            <CalendarDays className="h-4 w-4 text-blue-600" />
            <span>
              {formatShortDate(fromDate)} - {formatShortDate(toDate)}
            </span>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setFiltersOpen((v) => !v)}
            className={cn(filtersOpen && "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/30")}
          >
            <Filter className="h-3.5 w-3.5" />
            <span className="ms-1.5">{filtersOpen ? tt("bankroz.hide_filters", "Hide Filters") : tt("bankroz.show_filters", "Search / Filter")}</span>
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handlePrintReport}
            className="bg-blue-700 hover:bg-blue-800 text-white shadow-sm"
          >
            <Printer className="h-3.5 w-3.5" />
            <span className="ms-1.5">{tt("bankroz.print_pdf", "Print / PDF")}</span>
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleExcelExport}
            className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="ms-1.5">{tt("bankroz.excel_export", "Excel Export")}</span>
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={() => setNewEntryModalOpen(true)}
            className="bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900"
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="ms-1.5">{tt("bankroz.new_cheque", "New Cheque")}</span>
          </Button>
        </div>
      </div>

      {/* Collapsible Search & Scope Filter Box */}
      {filtersOpen && (
        <Card className="border-blue-200/80 bg-blue-50/20 shadow-sm dark:border-blue-900/40 dark:bg-blue-950/10">
          <CardContent className="p-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6">
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-muted-foreground">{tt("bankroz.from_date", "From Date")}</Label>
                <Input
                  className="h-8 text-xs bg-background"
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-muted-foreground">{tt("bankroz.to_date", "To Date")}</Label>
                <Input
                  className="h-8 text-xs bg-background"
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </div>

              {/* Company Hierarchy */}
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-muted-foreground">{tt("bankroz.company", "Company")}</Label>
                <select
                  className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs font-semibold"
                  value={companyId}
                  onChange={(e) => setCompanyId(e.target.value)}
                >
                  <option value="all">{tt("bankroz.all_companies", "All Companies")}</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Country */}
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-muted-foreground">{tt("bankroz.country", "Country")}</Label>
                <select
                  className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs font-semibold"
                  value={countryId}
                  onChange={(e) => setCountryId(e.target.value)}
                >
                  <option value="all">{tt("bankroz.all_countries", "All Countries")}</option>
                  {countries.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Country Main Branch */}
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-muted-foreground">{tt("bankroz.country_main_branch", "Country Main Branch")}</Label>
                <select
                  className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs font-semibold"
                  value={countryBranchId}
                  onChange={(e) => setCountryBranchId(e.target.value)}
                >
                  <option value="all">{tt("bankroz.all_main_branches", "All Main Branches")}</option>
                  {countryBranches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Local / City Branch */}
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-muted-foreground">{tt("bankroz.branch", "Branch")}</Label>
                <select
                  className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs font-semibold"
                  value={cityBranchId}
                  onChange={(e) => setCityBranchId(e.target.value)}
                >
                  <option value="all">{tt("bankroz.all_branches", "All Branches")}</option>
                  {cityBranches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code || "BR"})
                    </option>
                  ))}
                </select>
              </div>

              {/* Bank Filter */}
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-muted-foreground">{tt("bankroz.bank", "Bank")}</Label>
                <select
                  className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs font-semibold"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                >
                  <option value="all">{tt("bankroz.all_banks", "All Banks")}</option>
                  <option value="Habib Bank Limited">Habib Bank Limited (HBL)</option>
                  <option value="National Bank of Pakistan">National Bank of Pakistan (NBP)</option>
                  <option value="Bank Alfalah Limited">Bank Alfalah Limited (BAFL)</option>
                  <option value="MCB Bank Limited">MCB Bank Limited (MCB)</option>
                  <option value="United Bank Limited">United Bank Limited (UBL)</option>
                  <option value="Bank of Punjab">Bank of Punjab (BOP)</option>
                  <option value="Meezan Bank">Meezan Bank</option>
                  {bankList.map((b) => (
                    <option key={b.id} value={b.bank_name}>
                      {b.bank_name} ({b.short_name})
                    </option>
                  ))}
                </select>
              </div>

              {/* Cheque # */}
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-muted-foreground">Cheque #</Label>
                <Input
                  className="h-8 text-xs bg-background"
                  value={chequeNo}
                  onChange={(e) => setChequeNo(e.target.value)}
                  placeholder="e.g. CHK-000123"
                />
              </div>

              {/* General Search */}
              <div className="space-y-1 sm:col-span-2 lg:col-span-4">
                <Label className="text-[11px] font-semibold text-muted-foreground">{tt("bankroz.quick_search", "Quick Search")}</Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="h-8 pl-8 text-xs bg-background"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={tt("bankroz.search_placeholder", "Search by serial #, particulars, bank or user...")}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <Button type="button" size="sm" variant="outline" onClick={handleResetFilters}>
                {tt("bankroz.reset_filters", "Reset Filters")}
              </Button>
              <Button type="button" size="sm" onClick={() => void loadData()} className="bg-blue-600 hover:bg-blue-700 text-white">
                {tt("bankroz.apply_filters", "Apply Filters")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 6 Top Live Summary Cards (Matching Reference Layout) */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        {/* Total Entries */}
        <Card className="border-slate-200/80 shadow-sm dark:border-slate-800">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{tt("bankroz.total_entries", "Total Entries")}</div>
              <div className="mt-1 text-2xl font-black text-slate-900 dark:text-slate-100">{summary.totalEntries}</div>
              <div className="text-[10px] text-muted-foreground">{tt("bankroz.all_transactions", "All Transactions")}</div>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
              <FileText className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Total Debit */}
        <Card className="border-slate-200/80 shadow-sm dark:border-slate-800">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{tt("bankroz.total_debit", "Total Debit")}</div>
              <div className="mt-1 text-xl font-black text-rose-600">{fmtNumber(summary.totalDebit)}</div>
              <div className="text-[10px] font-semibold text-rose-600/80">PKR</div>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-400">
              <TrendingDown className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Total Credit */}
        <Card className="border-slate-200/80 shadow-sm dark:border-slate-800">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{tt("bankroz.total_credit", "Total Credit")}</div>
              <div className="mt-1 text-xl font-black text-emerald-600">{fmtNumber(summary.totalCredit)}</div>
              <div className="text-[10px] font-semibold text-emerald-600/80">PKR</div>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
              <TrendingUp className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Opening Balance */}
        <Card className="border-slate-200/80 shadow-sm dark:border-slate-800">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{tt("bankroz.opening_balance", "Opening Balance")}</div>
              <div className="mt-1 text-xl font-black text-blue-600 dark:text-blue-400">{fmtNumber(summary.openingBalance)}</div>
              <div className="text-[10px] font-semibold text-blue-600/80">PKR</div>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
              <Wallet className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Closing Balance */}
        <Card className="border-slate-200/80 shadow-sm dark:border-slate-800">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{tt("bankroz.closing_balance", "Closing Balance")}</div>
              <div className="mt-1 text-xl font-black text-purple-600 dark:text-purple-400">{fmtNumber(summary.closingBalance)}</div>
              <div className="text-[10px] font-semibold text-purple-600/80">PKR</div>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400">
              <PieChart className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Pending / Unclear */}
        <Card className="border-slate-200/80 shadow-sm dark:border-slate-800">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{tt("bankroz.pending_unclear", "Pending / Unclear")}</div>
              <div className="mt-1 text-2xl font-black text-amber-500">{summary.pendingCount}</div>
              <div className="text-[10px] text-muted-foreground">{tt("bankroz.entries", "Entries")}</div>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
              <Clock className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Filter Tabs & Status Legends */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between border-b pb-2">
        {/* Tabs */}
        <div className="flex flex-wrap items-center gap-1">
          {[
            { id: "all", label: tt("bankroz.all_transactions", "All Transactions") },
            { id: "cleared", label: tt("bankroz.cleared", "Cleared") },
            { id: "pending", label: tt("bankroz.pending", "Pending") },
            { id: "due_today", label: tt("bankroz.due_today", "Due Today"), highlight: summary.dueTodayCount > 0 },
            { id: "dishonored", label: tt("bankroz.dishonored", "Dishonored") },
            { id: "post_dated", label: tt("bankroz.post_dated", "Post Dated") },
            { id: "overdue", label: tt("bankroz.overdue", "Overdue") }
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id);
                  setPage(1);
                }}
                className={cn(
                  "relative px-3 py-1.5 text-xs font-bold transition-all rounded-md flex items-center gap-1.5",
                  isActive
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                )}
              >
                <span>{tab.label}</span>
                {tab.id === "due_today" && summary.dueTodayCount > 0 && (
                  <span className="rounded-full bg-amber-400 px-1.5 py-0.2 text-[10px] font-black text-slate-900">
                    {summary.dueTodayCount}
                  </span>
                )}
                {tab.id === "dishonored" && summary.dishonoredCount > 0 && (
                  <span className="rounded-full bg-rose-500 px-1.5 py-0.2 text-[10px] font-black text-white">
                    {summary.dishonoredCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Legend Pills on Right */}
        <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span>{tt("bankroz.cleared", "Cleared")}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            <span>{tt("bankroz.pending", "Pending")}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-rose-500" />
            <span>{tt("bankroz.dishonored", "Dishonored")}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-blue-500" />
            <span>{tt("bankroz.post_dated", "Post Dated")}</span>
          </div>
        </div>
      </div>

      {/* Main Bank Roznamcha Table */}
      <Card className="border-slate-200/80 shadow-sm dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1400px] border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-700 border-b dark:bg-slate-900/60 dark:text-slate-200 font-bold text-[11px]">
                <th className="py-3 px-2 text-center w-12 border-r">{tt("bankroz.sr", "Sr #")}</th>
                <th className="py-3 px-2 text-center w-24 border-r">{tt("bankroz.entry_no", "Entry #")}</th>
                <th className="py-3 px-3 text-start w-32 border-r">{tt("bankroz.date_time", "Date / Time")}</th>
                <th className="py-3 px-2 text-center w-24 border-r">{tt("bankroz.branch_no", "Branch No.")}</th>
                <th className="py-3 px-3 text-start w-32 border-r">{tt("bankroz.branch_name", "Branch Name")}</th>
                <th className="py-3 px-3 text-start w-28 border-r bg-blue-50/40 dark:bg-blue-950/20 text-blue-900 dark:text-blue-300">
                  {tt("bankroz.user_name", "User Name")}
                </th>
                <th className="py-3 px-3 text-start w-40 border-r">{tt("bankroz.bank_name", "Bank Name")}</th>
                <th className="py-3 px-2 text-center w-28 border-r font-mono">{tt("bankroz.check_no", "Check #")}</th>
                <th className="py-3 px-3 text-start min-w-[200px] border-r">{tt("bankroz.details_particulars", "Details / Particulars")}</th>
                <th className="py-3 px-2.5 text-center w-28 border-r">{tt("bankroz.check_date", "Check Date")}</th>
                <th className="py-3 px-2.5 text-center w-28 border-r">{tt("bankroz.due_payment_date", "Due / Payment Date")}</th>
                <th className="py-3 px-3 text-end w-28 border-r text-rose-600">{tt("bankroz.debit", "Debit")} (PKR)</th>
                <th className="py-3 px-3 text-end w-28 border-r text-emerald-600">{tt("bankroz.credit", "Credit")} (PKR)</th>
                <th className="py-3 px-3 text-end w-32 border-r font-bold text-slate-900 dark:text-slate-100">
                  {tt("bankroz.balance", "Balance")} (PKR)
                </th>
                <th className="py-3 px-2.5 text-center w-28 border-r">{tt("bankroz.status", "Status")}</th>
                <th className="py-3 px-2 text-center w-20">{tt("bankroz.action", "Action")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={16} className="py-12 text-center text-slate-500 font-semibold">
                    <div className="inline-flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
                      <span>{tt("bankroz.loading", "Loading Bank Roznamcha records...")}</span>
                    </div>
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={16} className="py-12 text-center text-slate-500 font-semibold">
                    {tt("bankroz.no_transactions", "No bank transactions found matching the selected criteria.")}
                  </td>
                </tr>
              ) : (
                rows.map((row, idx) => {
                  const isWarn = row.effective_status === "dishonored" || row.effective_status === "overdue";
                  const isDue = row.is_due_today;
                  return (
                    <tr
                      key={row.id}
                      className={cn(
                        "transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/50",
                        idx % 2 === 0 ? "bg-white dark:bg-slate-950" : "bg-slate-50/40 dark:bg-slate-900/30",
                        isWarn && "bg-rose-50/60 dark:bg-rose-950/20 hover:bg-rose-100/60"
                      )}
                    >
                      {/* 1. Sr # */}
                      <td className="py-2.5 px-2 text-center font-mono font-bold text-slate-500 border-r">
                        {idx + 1 + (page - 1) * pageSize}
                      </td>

                      {/* 2. Entry # */}
                      <td className="py-2.5 px-2 text-center font-mono font-bold text-slate-900 dark:text-slate-100 border-r">
                        {row.entry_serial_number}
                      </td>

                      {/* 3. Date / Time */}
                      <td className="py-2.5 px-3 border-r whitespace-nowrap">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">
                          {formatShortDate(row.entry_date)}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">{formatTimeOnly(row.entry_time)}</div>
                      </td>

                      {/* 4. Branch No. */}
                      <td className="py-2.5 px-2 text-center font-mono text-slate-700 dark:text-slate-300 border-r">
                        {row.city_branch?.code || row.country_branch?.code || "BR-001"}
                      </td>

                      {/* 5. Branch Name */}
                      <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200 border-r whitespace-nowrap">
                        {row.city_branch?.name || row.country_branch?.name || "Al Ras Branch"}
                      </td>

                      {/* 6. User Name (Strictly after Branch Name and before Bank Name) */}
                      <td className="py-2.5 px-3 border-r whitespace-nowrap bg-blue-50/20 dark:bg-blue-950/10">
                        <div className="flex items-center gap-1.5">
                          <span className="h-5 w-5 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-700">
                            {row.user_name.slice(0, 1).toUpperCase()}
                          </span>
                          <span className="font-semibold text-slate-900 dark:text-slate-100">{row.user_name}</span>
                        </div>
                      </td>

                      {/* 7. Bank Name */}
                      <td className="py-2.5 px-3 border-r whitespace-nowrap">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">{row.bank_name}</div>
                        {row.bank_code && (
                          <span className="inline-block text-[10px] font-bold text-blue-600 dark:text-blue-400">
                            {row.bank_code}
                          </span>
                        )}
                      </td>

                      {/* 8. Check # */}
                      <td className="py-2.5 px-2 text-center font-mono font-bold text-slate-800 dark:text-slate-200 border-r">
                        {row.cheque_no || "-"}
                      </td>

                      {/* 9. Details / Particulars */}
                      <td className="py-2.5 px-3 border-r">
                        <div className="text-slate-800 dark:text-slate-200 leading-snug">{row.particulars}</div>
                        {row.dishonor_reason && (
                          <div className="text-[10px] font-bold text-rose-600 flex items-center gap-1 mt-0.5">
                            <AlertCircle className="h-3 w-3" />
                            <span>Reason: {row.dishonor_reason}</span>
                          </div>
                        )}
                      </td>

                      {/* 10. Check Date */}
                      <td className="py-2.5 px-2.5 text-center text-slate-700 dark:text-slate-300 border-r whitespace-nowrap">
                        {formatDateDisplay(row.cheque_date)}
                      </td>

                      {/* 11. Due / Payment Date */}
                      <td className="py-2.5 px-2.5 text-center border-r whitespace-nowrap">
                        <div className={cn("font-medium", isWarn ? "text-rose-600 font-bold" : "text-slate-700 dark:text-slate-300")}>
                          {formatDateDisplay(row.due_date)}
                        </div>
                        {isDue && (
                          <span className="inline-block mt-0.5 rounded bg-amber-100 px-1.5 py-0.2 text-[9px] font-black text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                            Due Today
                          </span>
                        )}
                      </td>

                      {/* 12. Debit */}
                      <td className="py-2.5 px-3 text-end font-mono font-bold text-rose-600 border-r whitespace-nowrap">
                        {row.debit > 0 ? fmtNumber(row.debit) : "-"}
                      </td>

                      {/* 13. Credit */}
                      <td className="py-2.5 px-3 text-end font-mono font-bold text-emerald-600 border-r whitespace-nowrap">
                        {row.credit > 0 ? fmtNumber(row.credit) : "-"}
                      </td>

                      {/* 14. Balance */}
                      <td className="py-2.5 px-3 text-end font-mono font-black text-slate-900 dark:text-slate-100 border-r whitespace-nowrap">
                        {fmtNumber(row.running_balance)}
                      </td>

                      {/* 15. Status */}
                      <td className="py-2.5 px-2.5 text-center border-r whitespace-nowrap">
                        {row.effective_status === "cleared" && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                            <CheckCircle2 className="h-3 w-3" />
                            <span>{tt("bankroz.cleared", "Cleared")}</span>
                          </span>
                        )}
                        {row.effective_status === "pending" && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                            <Clock className="h-3 w-3" />
                            <span>{tt("bankroz.pending", "Pending")}</span>
                          </span>
                        )}
                        {row.effective_status === "post_dated" && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                            <Calendar className="h-3 w-3" />
                            <span>{tt("bankroz.post_dated", "Post Dated")}</span>
                          </span>
                        )}
                        {row.effective_status === "overdue" && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-bold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                            <AlertTriangle className="h-3 w-3" />
                            <span>{tt("bankroz.overdue", "Overdue")}</span>
                          </span>
                        )}
                        {row.effective_status === "dishonored" && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-bold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                            <XCircle className="h-3 w-3" />
                            <span>{tt("bankroz.dishonored", "Dishonored")}</span>
                          </span>
                        )}
                      </td>

                      {/* 16. Action */}
                      <td className="py-2.5 px-2 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            title="View Details"
                            onClick={() => {
                              setActionModalRow(row);
                              setActionType("view");
                            }}
                            className="p-1 rounded text-slate-500 hover:bg-slate-100 hover:text-blue-600 transition"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            title="Update Status / Clear"
                            onClick={() => {
                              setActionModalRow(row);
                              setActionType(row.status === "cleared" ? "view" : "clear");
                            }}
                            className="p-1 rounded text-slate-500 hover:bg-slate-100 hover:text-emerald-600 transition"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            title="Print Voucher"
                            onClick={handlePrintReport}
                            className="p-1 rounded text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition"
                          >
                            <Printer className="h-3.5 w-3.5" />
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

        {/* Bottom Summary Bar & Pagination (Exact Match with Reference) */}
        <div className="border-t bg-slate-50/90 p-3.5 dark:bg-slate-900/80 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Bottom Balance Figures */}
          <div className="flex flex-wrap items-center gap-4 text-xs font-bold">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                <Landmark className="h-4 w-4" />
              </div>
              <div>
                <span className="text-slate-500">Opening Balance: </span>
                <span className="text-slate-900 dark:text-slate-100 font-mono">{fmtNumber(summary.openingBalance)} PKR</span>
              </div>
            </div>

            <div className="h-4 w-px bg-slate-300 dark:bg-slate-700" />

            <div>
              <span className="text-slate-500">Total Debit: </span>
              <span className="text-rose-600 font-mono">{fmtNumber(summary.totalDebit)} PKR</span>
            </div>

            <div className="h-4 w-px bg-slate-300 dark:bg-slate-700" />

            <div>
              <span className="text-slate-500">Total Credit: </span>
              <span className="text-emerald-600 font-mono">{fmtNumber(summary.totalCredit)} PKR</span>
            </div>

            <div className="h-4 w-px bg-slate-300 dark:bg-slate-700" />

            <div>
              <span className="text-slate-500">Closing Balance: </span>
              <span className="text-purple-600 font-mono">{fmtNumber(summary.closingBalance)} PKR</span>
            </div>
          </div>

          {/* Rows Per Page & Pagination Controls */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>{tt("bankroz.rows_per_page", "Rows per page:")}</span>
              <select
                className="h-7 rounded border bg-background px-1.5 text-xs font-semibold"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            <div className="text-xs text-muted-foreground">
              Showing {rows.length ? (page - 1) * pageSize + 1 : 0} to{" "}
              {Math.min(page * pageSize, data?.totalCount || 0)} of {data?.totalCount || 0} entries
            </div>

            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0"
                disabled={page <= 1}
                onClick={() => setPage(1)}
              >
                &laquo;
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                &lsaquo;
              </Button>

              {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                const p = i + 1;
                return (
                  <Button
                    key={p}
                    type="button"
                    variant={page === p ? "default" : "outline"}
                    size="sm"
                    className={cn("h-7 w-7 p-0 font-bold", page === p ? "bg-blue-600 text-white" : "")}
                    onClick={() => setPage(p)}
                  >
                    {p}
                  </Button>
                );
              })}

              {totalPages > 5 && <span className="px-1 text-xs text-slate-500">...</span>}
              {totalPages > 5 && (
                <Button
                  type="button"
                  variant={page === totalPages ? "default" : "outline"}
                  size="sm"
                  className={cn("h-7 w-7 p-0 font-bold", page === totalPages ? "bg-blue-600 text-white" : "")}
                  onClick={() => setPage(totalPages)}
                >
                  {totalPages}
                </Button>
              )}

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                &rsaquo;
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0"
                disabled={page >= totalPages}
                onClick={() => setPage(totalPages)}
              >
                &raquo;
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Bottom Status Legend & Refresh Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground pt-1">
        <div className="flex flex-wrap items-center gap-4 text-[11px]">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            <span className="font-semibold text-slate-700 dark:text-slate-300">{tt("bankroz.cleared", "Cleared")}:</span>
            <span>{tt("bankroz.cleared_desc", "Approved and deposited")}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-amber-600" />
            <span className="font-semibold text-slate-700 dark:text-slate-300">{tt("bankroz.pending", "Pending")}:</span>
            <span>{tt("bankroz.pending_desc", "Awaiting clearance")}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <XCircle className="h-3.5 w-3.5 text-rose-600" />
            <span className="font-semibold text-slate-700 dark:text-slate-300">{tt("bankroz.dishonored", "Dishonored")}:</span>
            <span>{tt("bankroz.dishonored_desc", "Cheque returned / unpaid")}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-blue-600" />
            <span className="font-semibold text-slate-700 dark:text-slate-300">{tt("bankroz.post_dated", "Post Dated")}:</span>
            <span>{tt("bankroz.postdated_desc", "Future dated cheque")}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span>Last Updated: {lastUpdated || "Just now"}</span>
          <button
            type="button"
            onClick={() => void loadData()}
            className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title="Refresh"
          >
            <RefreshCw className="h-3.5 w-3.5 text-slate-600" />
          </button>
        </div>
      </div>

      {/* Cheque Status Action & Clearance Modal */}
      {actionModalRow && (
        <SimpleModal
          isOpen={Boolean(actionModalRow)}
          onClose={() => setActionModalRow(null)}
          title={`${tt("bankroz.cheque_action", "Cheque Action")} — ${actionModalRow.entry_serial_number} (${actionModalRow.cheque_no || tt("bankroz.no_cheque_no", "No Cheque #")})`}
        >
          <div className="space-y-4 text-xs">
            {/* Quick Header info */}
            <div className="rounded-lg border bg-slate-50 p-3 dark:bg-slate-900/50 space-y-2">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 font-semibold">
                <div>
                  <span className="text-muted-foreground block text-[10px]">{tt("bankroz.bank", "Bank")}</span>
                  <span className="text-slate-900 dark:text-slate-100">{actionModalRow.bank_name}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px]">{tt("bankroz.cheque_date", "Cheque Date")}</span>
                  <span>{formatShortDate(actionModalRow.cheque_date)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px]">{tt("bankroz.due_date", "Due Date")}</span>
                  <span>{formatShortDate(actionModalRow.due_date)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px]">{tt("bankroz.amount", "Amount")}</span>
                  <span className="font-mono font-bold text-blue-600">
                    {fmtNumber(actionModalRow.debit || actionModalRow.credit)} {actionModalRow.currency}
                  </span>
                </div>
              </div>
              <div className="text-muted-foreground">
                <span className="font-bold text-slate-700 dark:text-slate-300">{tt("bankroz.particulars_label", "Particulars:")} </span>
                {actionModalRow.particulars}
              </div>
            </div>

            {/* Action Selector */}
            <div className="space-y-1.5">
              <Label className="font-bold">{tt("bankroz.select_clearance_action", "Select Clearance Action")}</Label>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={actionType === "clear" ? "default" : "outline"}
                  onClick={() => setActionType("clear")}
                  className={actionType === "clear" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}
                >
                  <CheckCircle2 className="h-3.5 w-3.5 me-1.5" />
                  {tt("bankroz.clear_accept", "Clear / Accept")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={actionType === "dishonor" ? "default" : "outline"}
                  onClick={() => setActionType("dishonor")}
                  className={actionType === "dishonor" ? "bg-rose-600 hover:bg-rose-700 text-white" : ""}
                >
                  <XCircle className="h-3.5 w-3.5 me-1.5" />
                  {tt("bankroz.dishonor_return", "Dishonor / Return")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={actionType === "present" ? "default" : "outline"}
                  onClick={() => setActionType("present")}
                >
                  <Clock className="h-3.5 w-3.5 me-1.5" />
                  {tt("bankroz.present_deposit", "Present / Deposit")}
                </Button>
              </div>
            </div>

            {actionType === "dishonor" && (
              <div className="space-y-1.5">
                <Label className="font-bold text-rose-600">{tt("bankroz.dishonor_reason", "Dishonor Reason")}</Label>
                <select
                  className="h-8 w-full rounded border bg-background px-2 text-xs font-semibold"
                  value={dishonorReason}
                  onChange={(e) => setDishonorReason(e.target.value)}
                >
                  <option value="Insufficient funds">{tt("bankroz.dr_insufficient", "Insufficient funds in drawer account")}</option>
                  <option value="Signature mismatch">{tt("bankroz.dr_signature", "Signature mismatch / irregular signature")}</option>
                  <option value="Stop payment order">{tt("bankroz.dr_stop", "Payment stopped by drawer")}</option>
                  <option value="Account closed">{tt("bankroz.dr_closed", "Account closed / frozen")}</option>
                  <option value="Stale cheque">{tt("bankroz.dr_stale", "Stale / expired cheque")}</option>
                  <option value="Post-dated presented early">{tt("bankroz.dr_postdated", "Post-dated presented before maturity")}</option>
                  <option value="Words and figures differ">{tt("bankroz.dr_words", "Amount in words and figures differ")}</option>
                  <option value="Other">{tt("bankroz.dr_other", "Other reason")}</option>
                </select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="font-semibold">{tt("bankroz.action_remarks", "Action Remarks / Notes")}</Label>
              <Input
                className="h-8 text-xs"
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                placeholder={tt("bankroz.clearance_notes_ph", "Enter clearance notes or reference...")}
              />
            </div>

            {/* Audit Trail Timeline */}
            <div className="space-y-1.5 border-t pt-3">
              <Label className="font-bold uppercase tracking-wider text-[10px] text-slate-500">{tt("bankroz.audit_trail", "Audit Trail")}</Label>
              <div className="max-h-36 overflow-y-auto space-y-2 rounded border bg-slate-50/50 p-2 dark:bg-slate-900/30 text-[11px]">
                {actionModalRow.audit_trail && actionModalRow.audit_trail.length > 0 ? (
                  actionModalRow.audit_trail.map((log, lidx) => (
                    <div key={lidx} className="border-b pb-1.5 last:border-0 last:pb-0">
                      <div className="flex items-center justify-between font-semibold">
                        <span className="capitalize text-slate-900 dark:text-slate-100">{log.action}</span>
                        <span className="text-muted-foreground font-mono text-[10px]">
                          {formatShortDate(log.timestamp)} {formatTimeOnly(log.timestamp)}
                        </span>
                      </div>
                      <div className="text-slate-600 dark:text-slate-400">
                        {tt("bankroz.by", "By:")} <span className="font-medium">{log.actor}</span>
                        {log.notes && ` — ${log.notes}`}
                        {log.reason && ` (Reason: ${log.reason})`}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-slate-400">{tt("bankroz.no_audit_log", "No audit log available for this record.")}</div>
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 border-t pt-3">
              <Button type="button" variant="outline" size="sm" onClick={() => setActionModalRow(null)}>
                {tt("bankroz.cancel", "Cancel")}
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={actionSubmitting}
                onClick={handleChequeActionSubmit}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {actionSubmitting ? tt("bankroz.processing", "Processing...") : tt("bankroz.confirm_action", "Confirm Action")}
              </Button>
            </div>
          </div>
        </SimpleModal>
      )}

      {/* New Cheque Transaction Modal */}
      {newEntryModalOpen && (
        <SimpleModal
          isOpen={newEntryModalOpen}
          onClose={() => setNewEntryModalOpen(false)}
          title={tt("bankroz.new_entry_title", "New Bank Cheque / Transaction Entry")}
        >
          <form onSubmit={handleCreateNewEntry} className="space-y-3.5 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="font-semibold">{tt("bankroz.transaction_mode", "Transaction Mode")}</Label>
                <select
                  className="h-8 w-full rounded border bg-background px-2 text-xs font-semibold"
                  value={newEntry.type}
                  onChange={(e) => setNewEntry((p) => ({ ...p, type: e.target.value }))}
                >
                  <option value="credit">{tt("bankroz.credit_received", "Credit / Cheque Received (+)")}</option>
                  <option value="debit">{tt("bankroz.debit_issued", "Debit / Payment Issued (-)")}</option>
                </select>
              </div>

              <div className="space-y-1">
                <Label className="font-semibold">{tt("bankroz.bank_name", "Bank Name")}</Label>
                <select
                  className="h-8 w-full rounded border bg-background px-2 text-xs font-semibold"
                  value={newEntry.bankName}
                  onChange={(e) => {
                    const val = e.target.value;
                    let code = "HBL";
                    if (val.includes("National Bank")) code = "NBP";
                    else if (val.includes("Alfalah")) code = "BAFL";
                    else if (val.includes("MCB")) code = "MCB";
                    else if (val.includes("United")) code = "UBL";
                    else if (val.includes("Punjab")) code = "BOP";
                    else if (val.includes("Meezan")) code = "MEEZAN";
                    setNewEntry((p) => ({ ...p, bankName: val, bankCode: code }));
                  }}
                >
                  <option value="Habib Bank Limited">Habib Bank Limited (HBL)</option>
                  <option value="National Bank of Pakistan">National Bank of Pakistan (NBP)</option>
                  <option value="Bank Alfalah Limited">Bank Alfalah Limited (BAFL)</option>
                  <option value="MCB Bank Limited">MCB Bank Limited (MCB)</option>
                  <option value="United Bank Limited">United Bank Limited (UBL)</option>
                  <option value="Bank of Punjab">Bank of Punjab (BOP)</option>
                  <option value="Meezan Bank">Meezan Bank</option>
                </select>
              </div>

              <div className="space-y-1">
                <Label className="font-semibold">{tt("bankroz.cheque_hash", "Cheque #")}</Label>
                <Input
                  className="h-8 text-xs font-mono"
                  value={newEntry.chequeNo}
                  onChange={(e) => setNewEntry((p) => ({ ...p, chequeNo: e.target.value }))}
                  placeholder="e.g. CHK-000140"
                />
              </div>

              <div className="space-y-1">
                <Label className="font-semibold">{tt("bankroz.amount", "Amount")}</Label>
                <div className="flex gap-1.5">
                  <Input
                    className="h-8 text-xs font-mono font-bold"
                    type="number"
                    step="0.01"
                    value={newEntry.amount}
                    onChange={(e) => setNewEntry((p) => ({ ...p, amount: e.target.value }))}
                    placeholder="0.00"
                    required
                  />
                  <select
                    className="h-8 rounded border bg-background px-1.5 text-xs font-semibold"
                    value={newEntry.currency}
                    onChange={(e) => setNewEntry((p) => ({ ...p, currency: e.target.value }))}
                  >
                    <option value="PKR">PKR</option>
                    <option value="AED">AED</option>
                    <option value="USD">USD</option>
                    <option value="AFN">AFN</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="font-semibold">{tt("bankroz.cheque_date", "Cheque Date")}</Label>
                <Input
                  className="h-8 text-xs"
                  type="date"
                  value={newEntry.chequeDate}
                  onChange={(e) => setNewEntry((p) => ({ ...p, chequeDate: e.target.value }))}
                />
              </div>

              <div className="space-y-1">
                <Label className="font-semibold">{tt("bankroz.due_payment_date", "Due / Payment Date")}</Label>
                <Input
                  className="h-8 text-xs"
                  type="date"
                  value={newEntry.dueDate}
                  onChange={(e) => setNewEntry((p) => ({ ...p, dueDate: e.target.value }))}
                />
              </div>

              <div className="col-span-2 space-y-1">
                <Label className="font-semibold">{tt("bankroz.particulars_desc", "Particulars / Description")}</Label>
                <Input
                  className="h-8 text-xs"
                  value={newEntry.particulars}
                  onChange={(e) => setNewEntry((p) => ({ ...p, particulars: e.target.value }))}
                  placeholder={tt("bankroz.invoice_ph", "e.g. Customer payment for invoice #...")}
                  required
                />
              </div>

              <div className="col-span-2 space-y-1">
                <Label className="font-semibold">{tt("bankroz.remarks_notes", "Remarks / Notes")}</Label>
                <Input
                  className="h-8 text-xs"
                  value={newEntry.notes}
                  onChange={(e) => setNewEntry((p) => ({ ...p, notes: e.target.value }))}
                  placeholder={tt("bankroz.optional_remarks_ph", "Optional internal remarks")}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t pt-3">
              <Button type="button" variant="outline" size="sm" onClick={() => setNewEntryModalOpen(false)}>
                {tt("bankroz.cancel", "Cancel")}
              </Button>
              <Button type="submit" size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
                {tt("bankroz.save_post_cheque", "Save & Post Cheque")}
              </Button>
            </div>
          </form>
        </SimpleModal>
      )}
    </div>
  );
}
