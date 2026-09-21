"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DownloadActionIcon } from "@/components/ui/download-action-icon";
import {
  Search, UserRound, Building2, Landmark, Hash,
  Phone, Mail, MoreVertical, FileSpreadsheet,
  FileText, Send, MessageCircle, Printer, RefreshCw,
  Eye, Edit3, Filter, X, ChevronDown, CheckCircle2,
  XCircle, Loader2, LayoutList, Plus, ArrowLeft, ChevronRight, Layers, ArrowUpDown
} from "lucide-react";
import { useRouter } from "next/navigation";
import { rtlLanguages, type SupportedLanguage } from "@/lib/i18n/languages";
import { cn } from "@/lib/utils";
import { Th } from "@/components/ui/translated-th";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { translateHeader } from "@/lib/i18n/table-headers";
import { translateValue } from "@/lib/i18n/table-values";
import { t } from "@/lib/i18n/ui";
import { JournalPrintButton } from "@/components/reports/journal-print-button";
import { openGenericErpReport, type GenericReportColumn } from "@/lib/reports/open-generic-erp-report";

/* Types */
type AccountRow = {
  accountId: string;
  accountCode: string;
  manualReferenceNumber: string | null;
  journalCode: string;
  accountName: string;
  customerId: string | null;
  customerName: string;
  companyId: string | null;
  bankId: string | null;
  accountCategory: string;
  subType: string;
  branchType: string;
  branchName: string;
  branchCode: string;
  mainBranchName: string;
  cityBranchName: string;
  countryId: string | null;
  countryName: string;
  countryCode: string;
  currency: string;
  status: string;
  companyName: string;
  companyCode: string;
  customerNumber: string;
  accountSerialNumber: number;
  countrySerialNumber: string;
  branchSerialNumber: string;
  createdAt: string;
  latestActivityAt: string;
  recentActivityLabel: string | null;
  contacts: Array<{ type: string; value: string }>;
  openingBalance?: number;
  debitTotal?: number;
  creditTotal?: number;
  currentBalance?: number;
};

type ReportMeta = {
  companyName: string;
  companyOwner: string;
};

type SessionInfo = {
  user: {
    id: string;
    email: string | null;
    fullName: string | null;
    preferredLanguage: SupportedLanguage;
  };
  roles: string[];
  scopes: {
    isSuperAdmin: boolean;
    countryIds: string[];
    countryBranchIds: string[];
    cityBranchIds: string[];
  };
};

/* Helpers */
function fmtNum(val: number | string | undefined | null) {
  const n = Number(val) || 0;
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmt(date: string) {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtTime(date: string) {
  if (!date) return "-";
  return new Date(date).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}
function exportCSV(rows: AccountRow[]) {
  const header = ["#", "Account Number", "Super Admin Account Number", "Country Serial", "Branch Serial", "Manual Ref No", "Customer Name / Account", "Owner", "Account Type", "Category", "Branch Name", "Branch Code", "Country", "Currency", "Company Status", "Bank Status"];
  const lines = rows.map((r, i) => [
    i + 1,
    r.accountCode,
    "SAD-" + String(r.accountSerialNumber).padStart(3, "0"),
    r.countrySerialNumber ?? "-",
    r.branchSerialNumber ?? "-",
    r.manualReferenceNumber ?? "",
    r.accountName,
    r.customerName && r.customerName !== "-" ? r.customerName : "-",
    r.subType,
    r.accountCategory,
    r.branchName,
    r.branchCode,
    r.countryName,
    r.currency,
    r.companyName && r.companyName !== "-" ? "Yes" : "No",
    r.accountCategory.toLowerCase().includes("asset") || r.accountCategory.toLowerCase().includes("bank") ? "Yes" : "No"
  ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(","));
  const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), header.join(",") + "\n" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `account-setup-report_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export interface AccountSetupReportProps {
  lang?: SupportedLanguage;
  onNewAccount?: () => void;
  onBulkImport?: () => void;
  onEditAccount?: (accountId: string) => void;
  selectedCountry?: string;
  selectedBranch?: string;
}

/* Component */
export function AccountSetupReport({
  lang: propLang,
  onNewAccount,
  onBulkImport,
  onEditAccount,
  selectedCountry,
  selectedBranch,
}: AccountSetupReportProps) {
  const router = useRouter();

  const activeLang = useActiveLanguage();
  // Prefer the live client-selected language (localStorage-backed, same source <Th> uses)
  // over the server-rendered propLang hint, so dynamic cell values translate in sync with headers.
  const lang = activeLang || propLang;
  const tr = (label: string) => translateHeader(lang, label);
  const tv = (value: string | null | undefined) => translateValue(lang, value);

  const isRtl = useMemo(() => rtlLanguages.includes(lang), [lang]);

  /* Data */
  const [rows, setRows] = useState<AccountRow[]>([]);
  const [meta, setMeta] = useState<ReportMeta>({ companyName: "-", companyOwner: "-" });
  const [generatedAt, setGeneratedAt] = useState("");
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [loading, setLoading] = useState(false);

  /* Filter state */
  const [draftAccNo, setDraftAccNo] = useState("");
  const [draftName, setDraftName] = useState("");
  const [draftCountry, setDraftCountry] = useState("all");
  const [draftBranch, setDraftBranch] = useState("all");
  const [draftType, setDraftType] = useState("all");
  const [draftSub, setDraftSub] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [accNo, setAccNo] = useState("");
  const [searchField, setSearchField] = useState("all");
  const [accName, setAccName] = useState("");
  const [country, setCountry] = useState("all");
  const [branch, setBranch] = useState("all");
  const [accType, setAccType] = useState("all");
  const [subType, setSubType] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currencyFilter, setCurrencyFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const actionRef = useRef<HTMLDivElement>(null);
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});

  /* Fetch */
  async function fetchSessionInfo() {
    try {
      const res = await fetch("/api/erp/auth/session", { cache: "no-store" });
      const json = await res.json();
      if (json?.ok && json?.data) setSessionInfo(json.data as SessionInfo);
    } catch (error) {
      console.error("Account setup session fetch error:", error);
    }
  }

  const [errorMsg, setErrorMsg] = useState("");

  async function fetchReport() {
    setLoading(true);
    setErrorMsg("");
    try {
      const params = new URLSearchParams({ limit: "2000", language: lang });
      const res = await fetch(`/api/erp/accounting/reports/accounts/general?${params.toString()}`, { cache: "no-store", credentials: "same-origin" });
      const json = await res.json();
      if (json?.ok && json?.data) {
        setRows(json.data.rows ?? []);
        setMeta({
          companyName: json.data.workspace?.companyName ?? "-",
          companyOwner: json.data.workspace?.companyOwner ?? "-",
        });
        setGeneratedAt(json.data.generatedAt ?? new Date().toISOString());
      } else {
        setErrorMsg(json?.error?.message || "Failed to fetch accounts data.");
      }
    } catch (e: any) {
      console.error("Account report fetch error:", e);
      setErrorMsg(e.message || "Unknown error occurred.");
    } finally {
      setLoading(false);
    }
  }

  const [portalNode, setPortalNode] = useState<HTMLElement | null>(null);
  const [titlePortalNode, setTitlePortalNode] = useState<HTMLElement | null>(null);

  useEffect(() => {
    fetchReport();
    fetchSessionInfo();
    setPortalNode(document.getElementById("erp-page-actions-slot"));
    setTitlePortalNode(document.getElementById("erp-page-title-slot"));
  }, [lang]);

  /* Close action menu on outside click */
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (actionRef.current && !actionRef.current.contains(e.target as Node)) setActionMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [lang]);

  /* Filter options */
  const uniqueCountries = useMemo(() => [...new Set(rows.map(r => r.countryName).filter(Boolean))].sort(), [rows]);
  const branchMatches = (row: AccountRow, value: string) => {
    const q = value.toLowerCase();
    return [row.branchName, row.mainBranchName, row.cityBranchName, row.branchCode]
      .filter(Boolean)
      .some((part) => part.toLowerCase() === q);
  };
  const uniqueBranches  = useMemo(() => {
    const filteredRowsForBranches = draftCountry !== "all"
      ? rows.filter(r => r.countryName === draftCountry)
      : rows;
    const values = filteredRowsForBranches.map(r => r.branchName || r.cityBranchName || r.branchCode).filter(Boolean);
    return [...new Set(values)].sort();
  }, [rows, draftCountry]);
  const uniqueTypes     = useMemo(() => [...new Set(rows.map(r => r.accountCategory).filter(Boolean))].sort(), [rows]);
  const uniqueSubs      = useMemo(() => [...new Set(rows.map(r => r.subType).filter(Boolean))].sort(), [rows]);
  const uniqueCurrencies = useMemo(() => [...new Set(rows.map(r => r.currency).filter(Boolean))].sort(), [rows]);

  // Sync external filters when provided
  useEffect(() => {
    if (selectedCountry !== undefined && selectedCountry !== country) {
      setCountry(selectedCountry);
      setDraftCountry(selectedCountry);
    }
  }, [selectedCountry, country]);

  useEffect(() => {
    if (selectedBranch !== undefined && selectedBranch !== branch) {
      setBranch(selectedBranch);
      setDraftBranch(selectedBranch);
    }
  }, [selectedBranch, branch]);

  // Sync draft states when active states change
  useEffect(() => {
    setDraftCountry(country);
  }, [country]);

  useEffect(() => {
    setDraftBranch(branch);
  }, [branch]);

  // Reset draftBranch if it is no longer valid in the selected country's branches list
  useEffect(() => {
    if (draftBranch !== "all" && !uniqueBranches.includes(draftBranch)) {
      setDraftBranch("all");
    }
  }, [uniqueBranches, draftBranch]);

  /* Filtered rows */
  const filtered = useMemo(() => rows.filter(r => {
    if (accNo) {
      const q = accNo.toLowerCase();
      if (searchField === "all") {
        const matchCode = r.accountCode.toLowerCase().includes(q) || (r.manualReferenceNumber ?? "").toLowerCase().includes(q);
        const matchName = r.accountName.toLowerCase().includes(q) || r.customerName.toLowerCase().includes(q);
        const matchCountry = r.countryName.toLowerCase().includes(q);
        const matchBranch = branchMatches(r, q);
        if (!matchCode && !matchName && !matchCountry && !matchBranch) return false;
      } else if (searchField === "code") {
        const matchCode = r.accountCode.toLowerCase().includes(q) || (r.manualReferenceNumber ?? "").toLowerCase().includes(q);
        if (!matchCode) return false;
      } else if (searchField === "name") {
        const matchName = r.accountName.toLowerCase().includes(q) || r.customerName.toLowerCase().includes(q);
        if (!matchName) return false;
      } else if (searchField === "country") {
        if (!r.countryName.toLowerCase().includes(q)) return false;
      } else if (searchField === "branch") {
        if (!branchMatches(r, q)) return false;
      }
    }

    if (accName && !r.accountName.toLowerCase().includes(accName.toLowerCase()) && !r.customerName.toLowerCase().includes(accName.toLowerCase())) return false;
    if (country !== "all" && r.countryName.toLowerCase() !== country.toLowerCase()) return false;
    if (branch !== "all" && !branchMatches(r, branch)) return false;
    if (accType !== "all" && r.accountCategory.toLowerCase() !== accType.toLowerCase()) return false;
    if (subType !== "all" && r.subType.toLowerCase() !== subType.toLowerCase()) return false;
    if (statusFilter !== "all" && (r.status || "active").toLowerCase() !== statusFilter.toLowerCase()) return false;
    if (currencyFilter !== "all" && (r.currency || "").toLowerCase() !== currencyFilter.toLowerCase()) return false;
    if (dateFrom && r.createdAt && new Date(r.createdAt) < new Date(dateFrom)) return false;
    if (dateTo && r.createdAt && new Date(r.createdAt) > new Date(`${dateTo}T23:59:59`)) return false;

    return true;
  }), [rows, accNo, searchField, accName, country, branch, accType, subType, statusFilter, currencyFilter, dateFrom, dateTo]);

  /* Counts */
  const customers = useMemo(() => filtered.filter(r => r.accountCategory.toLowerCase().includes("customer") || r.customerNumber?.startsWith("CUST")).length, [filtered]);
  const companies = useMemo(() => filtered.filter(r => r.companyName && r.companyName !== "-").length, [filtered]);
  const banks     = useMemo(() => filtered.filter(r => r.accountCategory.toLowerCase().includes("bank") || r.accountCategory.toLowerCase().includes("asset")).length, [filtered]);
  const expenses  = useMemo(() => filtered.filter(r => r.accountCategory.toLowerCase().includes("expense") || r.subType.toLowerCase().includes("expense")).length, [filtered]);
  const activeCount = useMemo(() => filtered.filter(r => (r.status || "active").toLowerCase() === "active").length, [filtered]);
  const inactiveCount = useMemo(() => filtered.filter(r => (r.status || "active").toLowerCase() !== "active").length, [filtered]);
  const newThisMonth = useMemo(() => {
    const now = new Date();
    return filtered.filter(r => {
      if (!r.createdAt) return false;
      const d = new Date(r.createdAt);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
  }, [filtered]);
  const suppliers = useMemo(() => {
    return filtered.filter(r => r.accountCategory.toLowerCase().includes("supplier") || (r.subType || "").toLowerCase().includes("supplier")).length;
  }, [filtered]);
  const cashAccounts = useMemo(() => {
    return filtered.filter(r => r.accountName.toLowerCase().includes("cash") || r.accountCategory.toLowerCase().includes("cash")).length;
  }, [filtered]);
  const totalDebit = useMemo(() => filtered.reduce((s, r) => s + (Number(r.debitTotal) || 0), 0), [filtered]);
  const totalCredit = useMemo(() => filtered.reduce((s, r) => s + (Number(r.creditTotal) || 0), 0), [filtered]);

  /* Country-Wise Breakdown */
  const countryBreakdowns = useMemo(() => {
    const map = new Map<string, { total: number; customers: number; companies: number; banks: number; expenses: number; personal: number; currency: string }>();
    for (const r of filtered) {
      const c = r.countryName || "Unknown Country";
      if (!map.has(c)) {
        map.set(c, { total: 0, customers: 0, companies: 0, banks: 0, expenses: 0, personal: 0, currency: r.currency || "-" });
      }
      const item = map.get(c)!;
      item.total += 1;
      const cat = (r.accountCategory || "").toLowerCase();
      const sub = (r.subType || "").toLowerCase();
      if (cat.includes("expense") || sub.includes("expense")) {
        item.expenses += 1;
      } else if (cat.includes("bank") || cat.includes("asset")) {
        item.banks += 1;
      } else if (r.companyName && r.companyName !== "-") {
        item.companies += 1;
      } else if (cat.includes("customer") || (r.customerNumber || "").startsWith("CUST")) {
        item.customers += 1;
      } else {
        item.personal += 1;
      }
    }
    return Array.from(map.entries()).map(([name, stats]) => ({ name, ...stats })).sort((a, b) => b.total - a.total);
  }, [filtered]);

  function toggleSelectAll() {
    if (Object.keys(selectedIds).length === filtered.length) {
      setSelectedIds({});
    } else {
      const next: Record<string, boolean> = {};
      filtered.forEach((r) => { next[r.accountId] = true; });
      setSelectedIds(next);
    }
  }
  function toggleSelectRow(id: string) {
    setSelectedIds((p) => ({ ...p, [id]: !p[id] }));
  }
  function applyFilters() {
    setAccNo(draftAccNo); setAccName(draftName); setCountry(draftCountry);
    setBranch(draftBranch); setAccType(draftType); setSubType(draftSub);
    setFiltersOpen(false);
  }
  function resetFilters() {
    setDraftAccNo(""); setDraftName(""); setDraftCountry("all");
    setDraftBranch("all"); setDraftType("all"); setDraftSub("all");
    setAccNo(""); setAccName(""); setCountry("all");
    setBranch("all"); setAccType("all"); setSubType("all");
  }
  const hasActiveFilters = accNo || accName || country !== "all" || branch !== "all" || accType !== "all" || subType !== "all";

  const activeFiltersObj = { accNo, accName, country, branch, accType, subType };
  const activeFilterCount = Object.values(activeFiltersObj).filter(v => v && v !== "all").length;

  const reportSeed = filtered[0] ?? rows[0] ?? null;
  
  const reportColumns: GenericReportColumn[] = [
    { key: "accountCode", label: t(lang, "asr.col_account_number", "Account Number") },
    { key: "sadCode", label: t(lang, "asr.col_sad_code", "Super Admin Account Number") },
    { key: "countrySerialNumber", label: t(lang, "asr.col_country_serial", "Country Serial") },
    { key: "branchSerialNumber", label: t(lang, "asr.col_branch_serial", "Branch Serial") },
    { key: "manualReferenceNumber", label: t(lang, "asr.col_manual_ref", "Manual Ref No") },
    { key: "accountName", label: t(lang, "asr.col_customer_account", "Customer Name / Account") },
    { key: "customerName", label: t(lang, "asr.col_owner", "Owner") },
    { key: "subType", label: t(lang, "asr.col_account_type", "Account Type") },
    { key: "accountCategory", label: t(lang, "asr.col_category", "Category"), format: "status" },
    { key: "branchName", label: t(lang, "asr.col_branch_name", "Branch Name") },
    { key: "branchCode", label: t(lang, "asr.col_branch_code", "Branch Code") },
    { key: "countryName", label: t(lang, "asr.country", "Country") },
    { key: "currency", label: t(lang, "asr.currency", "Currency") },
  ];

  const reportSummary = {
    TotalAccounts: filtered.length,
    TotalCustomers: countryBreakdowns.reduce((acc, c) => acc + c.customers, 0),
    TotalCompanies: countryBreakdowns.reduce((acc, c) => acc + c.companies, 0),
    TotalBanks: countryBreakdowns.reduce((acc, c) => acc + c.banks, 0),
    TotalExpenses: countryBreakdowns.reduce((acc, c) => acc + (c.expenses || 0), 0),
  };

  const reportRows = useMemo(() => {
    return filtered.map((r) => ({
      ...r,
      sadCode: "SAD-" + String(r.accountSerialNumber).padStart(3, "0"),
    }));
  }, [filtered]);

  function triggerOfficialReportPreview() {
    openGenericErpReport({
      title: t(lang, "asr.print_title", "Account Setup Report"),
      subtitle: `${t(lang, "common.total", "Total")} ${filtered.length} ${t(lang, "asr.accounts", "accounts")} • ${reportContext.countryName} / ${reportContext.branchName}`,
      lang,
      columns: reportColumns,
      rows: reportRows as Record<string, unknown>[],
      summary: reportSummary,
      filters: [
        { label: t(lang, "asr.country", "Country"), value: reportContext.countryName },
        { label: t(lang, "asr.branch", "Branch"), value: reportContext.branchName },
        { label: t(lang, "asr.user_name", "User"), value: reportContext.userName },
        { label: t(lang, "asr.role", "Role"), value: reportContext.userRole },
        { label: t(lang, "asr.col_category", "Category"), value: accType },
        { label: t(lang, "asr.search", "Search"), value: accNo.trim() || t(lang, "common.all_statuses", "All") },
      ],
      companyInfo: {
        country: reportContext.countryName,
        branch: reportContext.branchName,
        printedBy: reportContext.userName,
        reportPeriod: `${t(lang, "asr.generated_on", "Generated on")} ${reportContext.date} ${reportContext.time}`,
      },
      orientation: "landscape",
    });
  }

  const reportContext = {
    countryName: country !== "all" ? country : reportSeed?.countryName ?? "All Countries",
    countryCode: reportSeed?.countryCode || "-",
    branchName: branch !== "all" ? branch : reportSeed?.branchName ?? "All Branches",
    branchCode: reportSeed?.branchCode || "-",
    userName: sessionInfo?.user.fullName ?? meta.companyOwner ?? "Current User",
    userId: sessionInfo?.user.id ? sessionInfo.user.id.slice(0, 12).toUpperCase() : "-",
    userRole: sessionInfo?.roles?.[0]?.replace(/_/g, " ") ?? "-",
    userPassword: "Protected",
    branchPassword: "Protected",
    date: fmt(generatedAt),
    time: fmtTime(generatedAt)
  };
  return (
    <div id="asr-report-shell" className="w-full space-y-4 font-sans antialiased text-slate-900 dark:text-slate-100" dir={isRtl ? "rtl" : "ltr"}>
      {/* ── BREADCRUMB & HEADER ── */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex items-center gap-1 hover:text-blue-600 font-bold transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>{t(lang, "asr.back", "Back")}</span>
          </button>
          <span>/</span>
          <span className="hover:text-blue-600 cursor-pointer">{t(lang, "asr.dashboard", "Dashboard")}</span>
          <ChevronRight className="h-3 w-3 text-slate-400" />
          <span className="hover:text-blue-600 cursor-pointer">{t(lang, "asr.finance", "Finance")}</span>
          <ChevronRight className="h-3 w-3 text-slate-400" />
          <span className="hover:text-blue-600 cursor-pointer">{t(lang, "asr.account_setup", "Account Setup")}</span>
          <ChevronRight className="h-3 w-3 text-slate-400" />
          <span className="text-slate-800 dark:text-slate-200 font-bold">{t(lang, "asr.new_account_entry", "New Account Entry")}</span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 dark:text-white">
                {t(lang, "asr.title", "Account Setup / New Account Entry")}
              </h1>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                {t(lang, "asr.subtitle", "Create and manage chart of accounts for all companies, branches and locations.")}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── 4 KPI SUMMARY CARDS ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3.5">
        {/* Card 1: Branch & User Details */}
        <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-blue-600 to-indigo-600" />
          <div className="p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-blue-600" />
                {t(lang, "asr.branch_user_details", "Branch & User Details")}
              </span>
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between"><span className="text-slate-500 font-medium">{t(lang, "asr.branch", "Branch")}:</span><span className="font-bold text-slate-800 dark:text-slate-200">{reportContext.branchName}</span></div>
              <div className="flex justify-between"><span className="text-slate-500 font-medium">{t(lang, "asr.country", "Country")}:</span><span className="font-bold text-slate-800 dark:text-slate-200">{reportContext.countryName}</span></div>
              <div className="flex justify-between"><span className="text-slate-500 font-medium">{t(lang, "asr.user_name", "User Name")}:</span><span className="font-bold text-slate-800 dark:text-slate-200">{reportContext.userName}</span></div>
              <div className="flex justify-between"><span className="text-slate-500 font-medium">{t(lang, "asr.user_id", "User ID")}:</span><span className="font-mono text-[11px] font-bold text-blue-600">{reportContext.userId}</span></div>
              <div className="flex justify-between"><span className="text-slate-500 font-medium">{t(lang, "asr.role", "Role")}:</span><span className="font-bold text-slate-800 dark:text-slate-200">{reportContext.userRole}</span></div>
            </div>
          </div>
        </div>

        {/* Card 2: Account Summary */}
        <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-emerald-500 to-teal-600" />
          <div className="p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                {t(lang, "asr.account_summary", "Account Summary")}
              </span>
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between"><span className="text-slate-500 font-medium">{t(lang, "asr.total_accounts", "Total Accounts")}:</span><span className="font-bold text-slate-800 dark:text-slate-200">{filtered.length}</span></div>
              <div className="flex justify-between"><span className="text-slate-500 font-medium">{t(lang, "common.active", "Active")}:</span><span className="font-bold text-emerald-600">{activeCount}</span></div>
              <div className="flex justify-between"><span className="text-slate-500 font-medium">{t(lang, "common.inactive", "Inactive")}:</span><span className="font-bold text-rose-600">{inactiveCount}</span></div>
              <div className="flex justify-between"><span className="text-slate-500 font-medium">{t(lang, "asr.new_this_month", "New This Month")}:</span><span className="font-bold text-blue-600">{newThisMonth}</span></div>
            </div>
          </div>
        </div>

        {/* Card 3: Account Type Summary */}
        <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-amber-500 to-purple-600" />
          <div className="p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-amber-600" />
                {t(lang, "asr.account_type_summary", "Account Type Summary")}
              </span>
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between"><span className="text-slate-500 font-medium">{t(lang, "asr.customers", "Customers")}:</span><span className="font-bold text-slate-800 dark:text-slate-200">{customers}</span></div>
              <div className="flex justify-between"><span className="text-slate-500 font-medium">{t(lang, "asr.suppliers", "Suppliers")}:</span><span className="font-bold text-slate-800 dark:text-slate-200">{suppliers}</span></div>
              <div className="flex justify-between"><span className="text-slate-500 font-medium">{t(lang, "asr.banks", "Banks")}:</span><span className="font-bold text-amber-600">{banks}</span></div>
              <div className="flex justify-between"><span className="text-slate-500 font-medium">{t(lang, "asr.cash_accounts", "Cash Accounts")}:</span><span className="font-bold text-purple-600">{cashAccounts}</span></div>
              <div className="flex justify-between"><span className="text-slate-500 font-medium">{t(lang, "asr.expense_accounts", "Expense Accounts")}:</span><span className="font-bold text-rose-600">{expenses}</span></div>
            </div>
          </div>
        </div>

        {/* Card 4: All Countries Account Report */}
        {sessionInfo?.scopes?.isSuperAdmin ? (
          <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-amber-600 to-orange-600" />
            <div className="p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                  <Landmark className="h-3.5 w-3.5 text-amber-600" />
                  {t(lang, "asr.all_countries_report", "All Countries Account Report")}
                </span>
                <span className="px-1.5 py-0.5 text-[9px] font-black uppercase rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                  {t(lang, "asr.super_admin_only", "Super Admin Only")}
                </span>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-slate-500 font-medium">{t(lang, "asr.countries", "Countries")}:</span><span className="font-bold text-slate-800 dark:text-slate-200">{uniqueCountries.length}</span></div>
                <div className="flex justify-between"><span className="text-slate-500 font-medium">{t(lang, "common.branch", "Branches")}:</span><span className="font-bold text-slate-800 dark:text-slate-200">{uniqueBranches.length}</span></div>
                <div className="flex justify-between"><span className="text-slate-500 font-medium">{t(lang, "asr.total_debit", "Total Debit")}:</span><span className="font-mono font-bold text-blue-600">{totalDebit.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-slate-500 font-medium">{t(lang, "asr.total_credit", "Total Credit")}:</span><span className="font-mono font-bold text-emerald-600">{totalCredit.toLocaleString()}</span></div>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* ── FILTER & ACTION ROW ── */}
      <div className="flex flex-wrap items-center gap-2.5 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-xs">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={accNo}
            onChange={(e) => {
              setAccNo(e.target.value);
              setDraftAccNo(e.target.value);
            }}
            placeholder={t(lang, "asr.search_placeholder", "Search by account code or name...")}
            className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800 text-xs font-semibold placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* All Countries */}
        <select
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          className="h-9 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800 px-2.5 text-xs font-semibold outline-none text-slate-700 dark:text-slate-200"
        >
          <option value="all">{t(lang, "common.all_countries", "All Countries")}</option>
          {uniqueCountries.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        {/* All Branches */}
        <select
          value={branch}
          onChange={(e) => setBranch(e.target.value)}
          className="h-9 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800 px-2.5 text-xs font-semibold outline-none text-slate-700 dark:text-slate-200"
        >
          <option value="all">{t(lang, "common.all_branches", "All Branches")}</option>
          {uniqueBranches.map(b => <option key={b} value={b}>{b}</option>)}
        </select>

        {/* All Types */}
        <select
          value={accType}
          onChange={(e) => setAccType(e.target.value)}
          className="h-9 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800 px-2.5 text-xs font-semibold outline-none text-slate-700 dark:text-slate-200"
        >
          <option value="all">{t(lang, "asr.all_types", "All Types")}</option>
          {uniqueTypes.map(ty => <option key={ty} value={ty}>{tv(ty)}</option>)}
        </select>

        {/* All Currencies */}
        <select
          value={currencyFilter}
          onChange={(e) => setCurrencyFilter(e.target.value)}
          className="h-9 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800 px-2.5 text-xs font-semibold outline-none text-slate-700 dark:text-slate-200"
        >
          <option value="all">{t(lang, "asr.all_currencies", "All Currencies")}</option>
          {uniqueCurrencies.map(cur => <option key={cur} value={cur}>{cur}</option>)}
        </select>

        {/* All Statuses */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-9 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800 px-2.5 text-xs font-semibold outline-none text-slate-700 dark:text-slate-200"
        >
          <option value="all">{t(lang, "common.all_statuses", "All Statuses")}</option>
          <option value="active">{t(lang, "common.active", "Active")}</option>
          <option value="inactive">{t(lang, "common.inactive", "Inactive")}</option>
        </select>

        {/* Date Range */}
        <div className="flex items-center gap-1.5 h-9 px-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300">
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="bg-transparent outline-none w-[110px]" />
          <span>–</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="bg-transparent outline-none w-[110px]" />
        </div>

        {/* Refresh */}
        <button
          type="button"
          onClick={fetchReport}
          title={t(lang, "asr.refresh", "Refresh")}
          className="h-9 w-9 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </button>

        {/* + New Account Button */}
        <button
          type="button"
          onClick={() => {
            if (onNewAccount) onNewAccount();
            else router.push("/dashboard/accounts/setup?mode=new");
          }}
          className="h-9 px-3.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
        >
          <Plus className="h-4 w-4" />
          <span>{t(lang, "asr.new_account", "New Account")}</span>
        </button>
      </div>

      {/* ── REGISTER TABLE CARD ── */}
      <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
        {/* Table Toolbar */}
        <div className="flex flex-wrap items-center justify-between p-3.5 border-b border-slate-100 dark:border-slate-800 gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-black text-slate-900 dark:text-white">
              {t(lang, "asr.register_title", "Chart of Accounts Register")}
            </h2>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              {filtered.length} {t(lang, "asr.records", "records")}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={triggerOfficialReportPreview}
              className="h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5"
            >
              <Printer className="h-3.5 w-3.5 text-slate-500" />
              <span>{t(lang, "asr.print", "Print")}</span>
            </button>
            <button
              type="button"
              onClick={triggerOfficialReportPreview}
              className="h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5"
            >
              <FileText className="h-3.5 w-3.5 text-red-500" />
              <span>{t(lang, "asr.pdf", "PDF")}</span>
            </button>
            <button
              type="button"
              onClick={() => exportCSV(filtered)}
              className="h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
              <span>{t(lang, "asr.excel", "Excel")}</span>
            </button>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                <th className="p-3 w-8 text-center">
                  <input
                    type="checkbox"
                    className="rounded border-slate-300"
                    checked={filtered.length > 0 && Object.keys(selectedIds).length === filtered.length}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="p-3">{t(lang, "asr.col_account_code", "Account Code")} <ArrowUpDown className="inline h-3 w-3 text-slate-400 ml-0.5" /></th>
                <th className="p-3">{t(lang, "asr.col_account_name", "Account Name")} <ArrowUpDown className="inline h-3 w-3 text-slate-400 ml-0.5" /></th>
                <th className="p-3">{t(lang, "asr.col_account_type", "Account Type")} <ArrowUpDown className="inline h-3 w-3 text-slate-400 ml-0.5" /></th>
                <th className="p-3">{t(lang, "asr.country", "Country")} <ArrowUpDown className="inline h-3 w-3 text-slate-400 ml-0.5" /></th>
                <th className="p-3">{t(lang, "asr.branch", "Branch")} <ArrowUpDown className="inline h-3 w-3 text-slate-400 ml-0.5" /></th>
                <th className="p-3">{t(lang, "asr.currency", "Currency")} <ArrowUpDown className="inline h-3 w-3 text-slate-400 ml-0.5" /></th>
                <th className="p-3 text-right">{t(lang, "asr.col_opening_debit", "Opening Debit")} <ArrowUpDown className="inline h-3 w-3 text-slate-400 ml-0.5" /></th>
                <th className="p-3 text-right">{t(lang, "asr.col_opening_credit", "Opening Credit")} <ArrowUpDown className="inline h-3 w-3 text-slate-400 ml-0.5" /></th>
                <th className="p-3 text-right">{t(lang, "asr.col_current_balance", "Current Balance")} <ArrowUpDown className="inline h-3 w-3 text-slate-400 ml-0.5" /></th>
                <th className="p-3">{t(lang, "asr.col_parent_account", "Parent Account")} <ArrowUpDown className="inline h-3 w-3 text-slate-400 ml-0.5" /></th>
                <th className="p-3 text-center">{t(lang, "asr.status", "Status")} <ArrowUpDown className="inline h-3 w-3 text-slate-400 ml-0.5" /></th>
                <th className="p-3 text-center">{t(lang, "asr.actions", "Actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={13} className="p-8 text-center text-slate-400">
                    <Loader2 className="inline h-5 w-5 animate-spin mr-2 text-blue-600" />
                    {t(lang, "asr.loading", "Loading accounts register...")}
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={13} className="p-8 text-center text-slate-400 font-medium">
                    {t(lang, "asr.no_accounts", "No accounts found matching the criteria.")}
                  </td>
                </tr>
              ) : (
                filtered.map((row) => {
                  const isActive = (row.status || "active").toLowerCase() === "active";
                  const isSelected = !!selectedIds[row.accountId];
                  return (
                    <tr key={row.accountId} className={cn("hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition", isSelected && "bg-blue-50/40 dark:bg-blue-950/20")}>
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          className="rounded border-slate-300"
                          checked={isSelected}
                          onChange={() => toggleSelectRow(row.accountId)}
                        />
                      </td>
                      <td className="p-3">
                        <button
                          type="button"
                          onClick={() => {
                            if (onEditAccount) onEditAccount(row.accountId);
                            else router.push(`/dashboard/accounts/setup?accountId=${row.accountId}&mode=edit`);
                          }}
                          className="font-mono font-bold text-blue-600 hover:underline"
                        >
                          {row.accountCode}
                        </button>
                      </td>
                      <td className="p-3">
                        <span className="font-bold text-slate-900 dark:text-white">{row.accountName}</span>
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                          {tv(row.subType || row.accountCategory)}
                        </span>
                      </td>
                      <td className="p-3 text-slate-700 dark:text-slate-300 font-medium">{row.countryName}</td>
                      <td className="p-3 text-slate-700 dark:text-slate-300 font-medium">{row.branchName}</td>
                      <td className="p-3 font-mono font-bold text-slate-700 dark:text-slate-300">{row.currency}</td>
                      <td className="p-3 text-right font-mono font-semibold text-slate-700 dark:text-slate-300">
                        {fmtNum(row.openingBalance || 0)}
                      </td>
                      <td className="p-3 text-right font-mono font-semibold text-slate-700 dark:text-slate-300">
                        {fmtNum(row.creditTotal || 0)}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-emerald-600">
                        {fmtNum(row.currentBalance || 0)}
                      </td>
                      <td className="p-3 font-mono text-slate-500">
                        {row.companyName && row.companyName !== "-" ? row.companyName : "-"}
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded-full text-[10px] font-bold",
                            isActive
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                              : "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
                          )}
                        >
                          {isActive ? t(lang, "common.active", "Active") : t(lang, "common.inactive", "Inactive")}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              if (onEditAccount) onEditAccount(row.accountId);
                              else router.push(`/dashboard/accounts/setup?accountId=${row.accountId}&mode=edit`);
                            }}
                            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-500"
                            title={t(lang, "asr.edit", "Edit")}
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => router.push(`/dashboard/accounts/view?accountId=${row.accountId}`)}
                            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-500"
                            title={t(lang, "asr.view", "View")}
                          >
                            <Eye className="h-3.5 w-3.5" />
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
        <div className="p-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between text-xs text-slate-500 font-medium">
          <span>{t(lang, "asr.showing", "Showing")} <strong>{filtered.length}</strong> {t(lang, "asr.of", "of")} <strong>{rows.length}</strong> {t(lang, "asr.accounts", "accounts")}</span>
          <span>{t(lang, "asr.generated_on", "Generated on")} {reportContext.date} {reportContext.time}</span>
        </div>
      </div>
    </div>
  );
}

/* Styles */
function AsrStyles() {
  return (
    <style>{`
      .asr-shell {
        --asr-bg: #f0f5ff;
        --asr-card: rgba(255,255,255,.97);
        --asr-line: #d9e4f5;
        --asr-title: #0a1028;
        --asr-muted: #64728b;
        --asr-head: #f3f7ff;
        --asr-hover: #f7faff;
        display: flex;
        flex-direction: column;
        gap: 10px;
        background: var(--asr-bg);
        padding: 12px 16px;
        min-height: 100%;
        font-family: "Inter", "Segoe UI", ui-sans-serif, system-ui, sans-serif;
        font-size: 12px;
        font-feature-settings: "cv02", "cv03", "cv04", "cv11";
        -webkit-font-smoothing: antialiased;
        text-rendering: geometricPrecision;
      }
      .dark .asr-shell {
        --asr-bg: #071120;
        --asr-card: #101b2f;
        --asr-line: #24344c;
        --asr-title: #f8fafc;
        --asr-muted: #90a4c2;
        --asr-head: #152238;
        --asr-hover: #182842;
      }

      /* Header */
      .asr-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        flex-wrap: wrap;
        background: var(--asr-card);
        border: 1.5px solid var(--asr-line);
        border-radius: 12px;
        padding: 12px 16px;
        box-shadow: 0 4px 16px rgba(15,23,42,0.04);
      }
      .asr-header-icon {
        width: 30px; height: 30px;
        border-radius: 10px;
        background: rgba(31,94,255,.1);
        display: grid; place-items: center;
        flex-shrink: 0;
        border: 1px solid rgba(31,94,255,.2);
      }
      .asr-title {
        font-size: 14px; font-weight: 900;
        color: var(--asr-title); line-height: 1.2;
        letter-spacing: -.02em;
      }
      .asr-subtitle {
        font-size: 9px; font-weight: 600;
        color: var(--asr-muted); margin-top: 2px;
      }
      .asr-badge {
        display: inline-flex; align-items: center;
        border-radius: 9999px;
        background: rgba(31,94,255,.1);
        color: #1f5eff;
        font-size: 9px; font-weight: 800;
        padding: 2px 8px;
        border: 1px solid rgba(31,94,255,.2);
      }
      .asr-badge-orange {
        background: rgba(249,115,22,.1);
        color: #ea580c;
        border-color: rgba(249,115,22,.2);
      }

      /* Toolbar buttons */
      .asr-icon-btn {
        width: 28px; height: 28px;
        display: grid; place-items: center;
        border-radius: 6px;
        border: 1.5px solid var(--asr-line);
        background: var(--asr-card);
        color: var(--asr-muted);
        transition: all .15s;
      }
      .asr-icon-btn:hover { border-color: #1f5eff; color: #1f5eff; }
      .asr-icon-btn:disabled { opacity: .5; }
      .asr-toolbar-btn {
        display: inline-flex; align-items: center; gap: 4px;
        height: 28px; padding: 0 10px;
        border-radius: 6px;
        border: 1.5px solid var(--asr-line);
        background: var(--asr-card);
        color: var(--asr-muted);
        font-size: 10px; font-weight: 800;
        transition: all .15s;
      }
      .asr-toolbar-btn:hover, .asr-toolbar-btn-active {
        border-color: #1f5eff; color: #1f5eff;
        background: rgba(31,94,255,.06);
      }
      .asr-filter-count {
        background: #1f5eff; color: white;
        font-size: 9px; font-weight: 900;
        border-radius: 9999px; padding: 0 5px;
        min-width: 16px; text-align: center;
      }

      /* Action menu */
      .asr-action-menu {
        position: absolute; right: 0; top: calc(100% + 6px); z-index: 100;
        width: 200px;
        background: var(--asr-card);
        border: 1px solid var(--asr-line);
        border-radius: 12px;
        box-shadow: 0 20px 40px rgba(15,23,42,.16);
        padding: 6px;
        animation: asr-fadein .12s ease-out;
      }
      @keyframes asr-fadein { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:translateY(0); } }
      .asr-action-section-label {
        font-size: 9px; font-weight: 900; text-transform: uppercase;
        letter-spacing: .08em; color: var(--asr-muted);
        padding: 4px 10px 2px;
      }
      .asr-action-item {
        display: flex; align-items: center; gap: 8px;
        width: 100%; text-align: left;
        padding: 7px 10px; border-radius: 8px;
        font-size: 11px; font-weight: 700;
        color: var(--asr-title);
        transition: background .1s;
      }
      .asr-action-item:hover { background: var(--asr-hover); }
      .asr-action-divider { height: 1px; background: var(--asr-line); margin: 4px 6px; }

      /* Filter panel */
      .asr-filter-panel {
        background: var(--asr-card);
        border: 1px solid var(--asr-line);
        border-radius: 12px;
        padding: 16px 18px;
        box-shadow: 0 4px 16px rgba(15,23,42,.05);
        animation: asr-fadein .12s ease-out;
      }
      .asr-filter-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
        gap: 12px;
      }
      .asr-filter-field { display: flex; flex-direction: column; gap: 4px; }
      .asr-filter-label { font-size: 10px; font-weight: 800; color: var(--asr-title); }
      .asr-filter-icon {
        position: absolute; left: 8px; top: 50%; transform: translateY(-50%);
        width: 13px; height: 13px; color: var(--asr-muted); pointer-events: none;
      }
      .asr-filter-input {
        height: 32px; width: 100%; border-radius: 8px;
        border: 1.5px solid var(--asr-line); background: var(--asr-card);
        padding: 0 10px 0 28px; color: var(--asr-title);
        font-size: 11px; font-weight: 600; outline: none;
        transition: border-color .15s, box-shadow .15s;
      }
      .asr-filter-input:focus { border-color: #1f5eff; box-shadow: 0 0 0 3px rgba(31,94,255,.1); }
      .asr-filter-select {
        height: 32px; width: 100%; border-radius: 8px;
        border: 1.5px solid var(--asr-line); background: var(--asr-card);
        padding: 0 10px; color: var(--asr-title);
        font-size: 11px; font-weight: 600; outline: none;
        transition: border-color .15s;
      }
      .asr-filter-select:focus { border-color: #1f5eff; }

      /* Buttons */
      .asr-btn-primary {
        display: inline-flex; align-items: center; gap: 6px;
        height: 32px; padding: 0 16px; border-radius: 8px;
        background: #1f5eff; color: white;
        font-size: 11px; font-weight: 900;
        box-shadow: 0 6px 16px rgba(31,94,255,.28);
        transition: all .15s;
      }
      .asr-btn-primary:hover { background: #1a50e0; transform: translateY(-1px); }
      .asr-btn-secondary {
        display: inline-flex; align-items: center; gap: 5px;
        height: 32px; padding: 0 14px; border-radius: 8px;
        border: 1.5px solid var(--asr-line); background: var(--asr-card);
        color: var(--asr-muted); font-size: 11px; font-weight: 800;
        transition: all .15s;
      }
      .asr-btn-secondary:hover { border-color: #ef4444; color: #ef4444; }

      /* Executive summary panel */
      .asr-executive-panel {
        background: var(--asr-card);
        border: 1.5px solid var(--asr-line);
        border-radius: 12px;
        box-shadow: 0 4px 16px rgba(15,23,42,0.03);
        overflow: hidden;
      }
      .asr-panel-flex-row {
        display: flex;
        align-items: stretch;
        width: 100%;
      }
      @media (max-width: 1024px) {
        .asr-panel-flex-row {
          flex-direction: column;
        }
        .asr-panel-divider {
          display: none;
        }
      }
      .asr-metrics-section {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        padding: 6px 10px;
        align-items: center;
        flex-shrink: 0;
        background: rgba(247, 250, 255, 0.25);
      }
      .dark .asr-metrics-section {
        background: rgba(24, 40, 66, 0.15);
      }
      .asr-metric-mini-card {
        background: var(--asr-card);
        border: 1px solid var(--asr-line);
        border-radius: 6px;
        padding: 4px 10px;
        display: flex;
        align-items: center;
        min-width: 105px;
        box-shadow: 0 1px 2px rgba(0,0,0,0.02);
        transition: background-color 0.15s;
      }
      .asr-metric-mini-card:hover { background-color: var(--asr-hover); }
      .asr-metric-mini-content {
        display: flex;
        flex-direction: column;
        gap: 0.5px;
      }
      .asr-metric-mini-label {
        font-size: 7.5px; font-weight: 800;
        text-transform: uppercase; letter-spacing: 0.05em;
        color: var(--asr-muted);
      }
      .asr-metric-mini-value {
        font-size: 13px; font-weight: 900;
        color: var(--asr-title); line-height: 1.1;
      }
      .asr-skeleton {
        display: inline-block; width: 32px; height: 16px;
        border-radius: 4px;
        background: linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%);
        background-size: 200% 100%;
        animation: asr-shimmer 1.2s infinite;
      }
      @keyframes asr-shimmer { to { background-position: -200% 0; } }

      .asr-panel-divider {
        width: 1px;
        background: var(--asr-line);
        margin: 6px 0;
        align-self: stretch;
        flex-shrink: 0;
      }

      /* Sleek Metadata Grid */
      .asr-metadata-section {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 4px 0;
        padding: 6px 10px;
        flex-grow: 1;
      }
      .asr-metadata-mini-cell {
        padding: 4px 10px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: 1px;
        border-right: 1px dashed var(--asr-line);
        min-width: 90px;
      }
      .asr-metadata-mini-cell:last-of-type { border-right: none; }
      .asr-metadata-mini-label {
        font-size: 7.5px; font-weight: 850;
        text-transform: uppercase; letter-spacing: 0.08em;
        color: var(--asr-muted);
      }
      .asr-metadata-mini-value {
        font-size: 9.5px; font-weight: 700;
        color: var(--asr-title);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 130px;
      }
      .asr-clear-chip-compact {
        margin: auto 8px;
        height: 22px;
        padding: 0 8px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 3px;
        border-radius: 5px;
        border: 1px solid rgba(249,115,22,.25);
        background: rgba(249,115,22,.08);
        color: #ea580c;
        font-size: 9px;
        font-weight: 900;
        cursor: pointer;
        transition: background-color 0.15s;
      }
      .asr-clear-chip-compact:hover {
        background: rgba(249,115,22,.15);
      }
      /* Table */
      .asr-table-wrap {
        background: var(--asr-card);
        border: 1px solid var(--asr-line);
        border-radius: 14px;
        overflow: hidden;
        box-shadow: 0 14px 34px rgba(15,23,42,.08);
      }
      .asr-table {
        width: 100%;
        border-collapse: separate;
        border-spacing: 0;
        font-size: 11px;
        text-align: left;
        min-width: 1480px;
        font-family: inherit;
      }
      .asr-th {
        position: sticky;
        top: 0;
        z-index: 5;
        background: linear-gradient(180deg, #f8fbff, #eef4ff);
        padding: 10px 10px;
        font-size: 9px;
        font-weight: 950;
        text-transform: uppercase;
        letter-spacing: .08em;
        color: #53627a;
        border-bottom: 1px solid #cbd8ec;
        border-right: 1px solid #dbe5f4;
        white-space: nowrap;
        box-shadow: inset 0 -1px 0 rgba(15,23,42,.04);
      }
      .dark .asr-th { background: linear-gradient(180deg, #17243a, #101b2f); color: #9eb2d0; border-color: #253852; }
      .asr-th:last-child { border-right: none; }
      .asr-row { background: var(--asr-card); transition: background .14s ease, box-shadow .14s ease; }
      .asr-row:nth-child(even) { background: rgba(247,250,255,.72); }
      .dark .asr-row:nth-child(even) { background: rgba(15,23,42,.36); }
      .asr-row:hover { background: #eef6ff; box-shadow: inset 3px 0 0 #2563eb; }
      .dark .asr-row:hover { background: rgba(30,64,175,.18); }
      .asr-td {
        padding: 9px 10px;
        border-bottom: 1px solid #dbe5f4;
        border-right: 1px solid #e2eaf7;
        color: var(--asr-title);
        vertical-align: middle;
        white-space: nowrap;
        font-size: 11px;
        line-height: 1.35;
      }
      .dark .asr-td { border-color: #24344c; }
      .asr-td:last-child { border-right: none; }
      .asr-td-num { font-weight: 800; color: var(--asr-muted); text-align: center; width: 34px; font-size: 10px; }
      .asr-empty-cell { padding: 48px; text-align: center; color: var(--asr-muted); font-weight: 600; }

      /* Avatar */
      .asr-avatar {
        width: 28px; height: 28px;
        border-radius: 10px;
        background: linear-gradient(135deg, #1f5eff, #7c3aed);
        color: white; font-size: 10px; font-weight: 950;
        display: grid; place-items: center; flex-shrink: 0;
        box-shadow: 0 8px 18px rgba(37,99,235,.22);
      }

      /* Badges */
      .asr-type-badge {
        display: inline-flex; align-items: center;
        border-radius: 6px; padding: 2px 7px;
        background: #f0f5ff; color: #1f5eff;
        border: 1px solid #c7d8ff;
        font-size: 9px; font-weight: 800;
        white-space: nowrap;
      }
      .asr-cat-badge {
        display: inline-flex; align-items: center;
        border-radius: 6px; padding: 2px 7px;
        font-size: 9px; font-weight: 800; white-space: nowrap;
        background: #f1f5f9; color: #64748b; border: 1px solid #e2e8f0;
      }
      .asr-cat-asset    { background:#eff6ff; color:#1d4ed8; border-color:#bfdbfe; }
      .asr-cat-expense  { background:#fff7ed; color:#c2410c; border-color:#fed7aa; }
      .asr-cat-income   { background:#f0fdf4; color:#166534; border-color:#bbf7d0; }
      .asr-cat-liability{ background:#fef2f2; color:#991b1b; border-color:#fecaca; }
      .asr-cat-equity   { background:#f5f3ff; color:#6d28d9; border-color:#ddd6fe; }

      /* Contact dots */
      .asr-contact-dot {
        display: inline-flex; align-items: center; justify-content: center;
        width: 20px; height: 20px; border-radius: 50%; border: 1px solid;
      }

      /* Action buttons */
      .asr-action-btn {
        display: inline-flex; align-items: center; gap: 5px;
        height: 28px; padding: 0 10px; border-radius: 8px;
        font-size: 10px; font-weight: 900;
        border: 1px solid; transition: all .15s;
        white-space: nowrap;
        box-shadow: 0 2px 6px rgba(15,23,42,.04);
      }
      .asr-action-btn:hover { transform: translateY(-1px); }
      .asr-action-view {
        background: #eff6ff; color: #1d4ed8; border-color: #bfdbfe;
      }
      .asr-action-view:hover { background: #dbeafe; border-color: #1d4ed8; }
      .asr-action-edit {
        background: #fff7ed; color: #c2410c; border-color: #fed7aa;
      }
      .asr-action-edit:hover { background: #ffedd5; border-color: #c2410c; }

      /* Table footer */
      .asr-table-footer {
        display: flex; align-items: center; justify-content: space-between;
        padding: 8px 16px;
        border-top: 1px solid var(--asr-line);
        font-size: 10px; font-weight: 700;
        color: var(--asr-muted);
        background: var(--asr-head);
        flex-wrap: wrap; gap: 8px;
      }

      @media print {
        .asr-header button, .asr-action-menu,
        .asr-filter-panel, .asr-action-btn { display: none !important; }
        .asr-shell { background: white; padding: 0; }
        .asr-table-wrap { box-shadow: none; border: 1px solid #ddd; }
      }
    `}</style>
  );
}


