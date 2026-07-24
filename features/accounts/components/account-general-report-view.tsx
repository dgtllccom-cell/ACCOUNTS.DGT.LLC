"use client";

import { DownloadActionIcon } from "@/components/ui/download-action-icon";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Download, Expand, Eye, FileSpreadsheet, FileText, MoreVertical, PencilLine, Printer, Search, Trash2, CalendarDays, RefreshCw, SlidersHorizontal, Landmark, CheckCircle2, ChevronDown, ChevronRight, PackageCheck, FileCheck2, Building2, MapPin, Phone, MessageCircle, Mail, Plus } from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";

const getFlag = (countryName: string) => {
  if (!countryName) return "🌍";
  const c = countryName.toUpperCase();
  if (c.includes("PAKISTAN") || c === "PK") return "🇵🇰";
  if (c.includes("UNITED ARAB") || c === "UAE" || c.includes("EMIRATES") || c.includes("DUBAI")) return "🇦🇪";
  if (c.includes("AFGHANISTAN") || c === "AF") return "🇦🇫";
  if (c.includes("SAUDI") || c === "SA") return "🇸🇦";
  if (c.includes("UNITED STATES") || c === "USA" || c === "US") return "🇺🇸";
  if (c.includes("CHINA") || c === "CN") return "🇨🇳";
  if (c.includes("INDIA") || c === "IN") return "🇮🇳";
  if (c.includes("IRAN") || c === "IR") return "🇮🇷";
  if (c.includes("OMAN") || c === "OM") return "🇴🇲";
  if (c.includes("UNITED KINGDOM") || c === "UK" || c === "GB") return "🇬🇧";
  return "🌍";
};
import { apiDelete, apiGet } from "@/lib/api/client";
import { openA4ReportWindow } from "@/lib/reports/open-a4-report-window";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchSelect, type SearchSelectOption } from "@/components/ui/search-select";
import { ReportFilterMenu } from "@/components/reports/report-filter-menu";
import { ReportPageHeader } from "@/components/reports/report-page-header";
import { ReportTd, ReportTh } from "@/components/reports/report-primitives";
import { cn } from "@/lib/utils";
import type { SupportedLanguage } from "@/lib/i18n/languages";

type AccountGeneralReportRow = {
  accountId: string;
  accountCode: string;
  rawAccountCode?: string;
  customerNumber?: string;
  countrySerialNumber?: string;
  branchSerialNumber?: string;
  manualReferenceNumber?: string | null;
  accountName: string;
  journalCode: string;
  ledgerId: string | null;
  ledgerName: string | null;
  ledgerStatus: string;
  ledgerCurrency: string;
  branchType: string;
  branchName: string;
  mainBranchName?: string;
  cityBranchName?: string;
  branchCode: string;
  countryId: string | null;
  countryName: string;
  countryCode: string;
  stateName: string;
  stateCode: string;
  cityId: string | null;
  cityName: string;
  cityCode: string;
  currency: string;
  accountCategory: string;
  subType: string;
  status: string;
  createdAt: string;
  openingBalance: number;
  debitTotal: number;
  creditTotal: number;
  currentBalance: number;
  linkedLedgerCount: number;
  journalActivityCount: number;
  latestJournalNo: string | null;
  latestActivityAt: string | null;
  companyName: string;
  companyCode: string;
  companyOwner: string;
  bankName?: string;
  warehouseName?: string;
  ownerName?: string;
  mobile?: string;
  whatsapp?: string;
  email?: string;
  contacts?: Array<{ type: string; value: string }>;
  recentActivityLabel: string | null;
  recentActivityAt: string | null;
  accountSerialNumber?: number;
  branchAccountSequence?: number;
  recentMovements: Array<{
    source: "ledger" | "roznamcha";
    referenceNo: string | null;
    entryDate: string;
    debit: number;
    credit: number;
    currency: string;
    usdRate: number;
    usdAmount: number;
  }>;
};

type AccountGeneralReportResponse = {
  summary: {
    totalAccounts: number;
    activeAccounts: number;
    countryAccounts: number;
    branchAccounts: number;
    adminAccounts: number;
    totalLedgers: number;
    activeLedgers: number;
    openingBalanceTotal: number;
    debitTotal: number;
    creditTotal: number;
    currentBalanceTotal: number;
    journalActivityTotal: number;
    recentUpdates: number;
  };
  workspace: {
    companyId: string | null;
    companyName: string;
    companyCode: string;
    companyOwner: string;
  };
  rows: AccountGeneralReportRow[];
  generatedAt: string;
};

type SessionInfo = {
  permissions: string[];
  roles: string[];
  scopes?: {
    countryIds: string[];
    countryBranchIds: string[];
    cityBranchIds: string[];
    isSuperAdmin: boolean;
  };
};

type AccountDashboardScope = "super_admin" | "country" | "branch";

function normalizeSearch(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function titleCase(value: string) {
  return value
    .split(/[\s_-]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function fmtNumber(value: number) {
  return (Number.isFinite(value) ? value : 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function ContactIconPopup({ row }: { row: AccountGeneralReportRow }) {
  const [activeTab, setActiveTab] = useState<"mobile" | "whatsapp" | "email" | null>(null);

  const mobile = row.mobile || row.contacts?.find(c => c.type?.toLowerCase().includes("mobile") || c.type?.toLowerCase().includes("phone"))?.value || "-";
  const whatsapp = row.whatsapp || row.contacts?.find(c => c.type?.toLowerCase().includes("whatsapp") || c.type?.toLowerCase().includes("wa"))?.value || mobile;
  const email = row.email || row.contacts?.find(c => c.type?.toLowerCase().includes("email"))?.value || "-";

  return (
    <div className="relative inline-flex items-center justify-center gap-1.5" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setActiveTab(activeTab === "mobile" ? null : "mobile")}
        title={`Mobile: ${mobile}`}
        className={cn(
          "p-1 rounded-full border transition hover:scale-110",
          activeTab === "mobile" ? "bg-blue-600 text-white border-blue-600 shadow-md" : "bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/40 dark:border-blue-800"
        )}
      >
        <Phone className="h-3 w-3" />
      </button>

      <button
        type="button"
        onClick={() => setActiveTab(activeTab === "whatsapp" ? null : "whatsapp")}
        title={`WhatsApp: ${whatsapp}`}
        className={cn(
          "p-1 rounded-full border transition hover:scale-110",
          activeTab === "whatsapp" ? "bg-emerald-600 text-white border-emerald-600 shadow-md" : "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800"
        )}
      >
        <MessageCircle className="h-3 w-3" />
      </button>

      <button
        type="button"
        onClick={() => setActiveTab(activeTab === "email" ? null : "email")}
        title={`Email: ${email}`}
        className={cn(
          "p-1 rounded-full border transition hover:scale-110",
          activeTab === "email" ? "bg-amber-600 text-white border-amber-600 shadow-md" : "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/40 dark:border-amber-800"
        )}
      >
        <Mail className="h-3 w-3" />
      </button>

      {activeTab && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-1.5 min-w-[180px] rounded-lg border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-800 dark:bg-slate-900 animate-in fade-in zoom-in-95">
          <div className="flex items-center justify-between border-b border-slate-100 pb-1 mb-1 text-[9px] font-bold uppercase tracking-wider text-slate-400">
            <span>{activeTab.toUpperCase()}</span>
            <button type="button" onClick={() => setActiveTab(null)} className="text-slate-400 hover:text-slate-600">×</button>
          </div>
          <div className="font-mono text-[11px] font-black text-slate-800 dark:text-slate-100 break-all select-all">
            {activeTab === "mobile" ? mobile : activeTab === "whatsapp" ? whatsapp : email}
          </div>
        </div>
      )}
    </div>
  );
}

function fmtDateTime(value: string | null | undefined) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(d);
}

function csvEscape(value: string) {
  if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function downloadTextFile(filename: string, contents: string, mime = "text/plain") {
  const blob = new Blob([contents], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function buildAccountOption(row: AccountGeneralReportRow): SearchSelectOption {
  return {
    value: row.accountId,
    label: `${row.accountCode} - ${row.accountName}`,
    keywords: [
      row.accountCode,
      row.rawAccountCode ?? "",
      row.customerNumber ?? "",
      row.countrySerialNumber ?? "",
      row.branchSerialNumber ?? "",
      row.manualReferenceNumber ?? "",
      row.accountName,
      row.journalCode,
      row.branchName,
      row.branchCode,
      row.countryName,
      row.countryCode,
      row.cityName,
      row.cityCode,
      row.currency,
      row.companyName
    ]
      .filter(Boolean)
      .join(" ")
  };
}

function buildBranchOption(row: AccountGeneralReportRow) {
  return {
    value: row.branchCode,
    label: `${row.branchName} (${row.branchCode})`,
    keywords: [row.branchName, row.branchCode, row.countryName, row.cityName].filter(Boolean).join(" ")
  };
}

function safeRowText(row: AccountGeneralReportRow) {
  return normalizeSearch(
    [
      row.accountCode,
      row.rawAccountCode ?? "",
      row.customerNumber ?? "",
      row.countrySerialNumber ?? "",
      row.branchSerialNumber ?? "",
      row.manualReferenceNumber ?? "",
      row.accountName,
      row.journalCode,
      row.ledgerName,
      row.branchName,
      row.branchCode,
      row.countryName,
      row.countryCode,
      row.cityName,
      row.cityCode,
      row.currency,
      row.accountCategory,
      row.subType,
      row.status,
      row.companyName,
      row.companyOwner,
      row.latestJournalNo ?? "",
      row.recentActivityLabel ?? ""
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function rowTone(balance: number) {
  if (!Number.isFinite(balance) || balance === 0) return "text-foreground";
  return balance < 0 ? "text-red-600" : "text-emerald-600";
}

function uniqueCount(values: Array<string | null | undefined>) {
  return new Set(values.filter((value): value is string => Boolean(value) && value !== "-")).size;
}

function groupCounts(rows: AccountGeneralReportRow[], getKey: (row: AccountGeneralReportRow) => string) {
  const map = new Map<string, number>();
  for (const row of rows) {
    const key = getKey(row) || "-";
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);
}

function groupSums(
  rows: AccountGeneralReportRow[],
  getKey: (row: AccountGeneralReportRow) => string,
  getValue: (row: AccountGeneralReportRow) => number
) {
  const map = new Map<string, number>();
  for (const row of rows) {
    const key = getKey(row) || "-";
    map.set(key, (map.get(key) ?? 0) + getValue(row));
  }
  return [...map.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
    .slice(0, 6);
}

function MiniChart({
  title,
  rows,
  formatValue
}: {
  title: string;
  rows: Array<{ label: string; value: number }>;
  formatValue?: (value: number) => string;
}) {
  const max = Math.max(1, ...rows.map((row) => Math.abs(row.value)));

  return (
    <Card className="rounded-lg">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.length ? (
          rows.map((row) => (
            <div key={`${title}-${row.label}`} className="space-y-1">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate font-medium">{row.label}</span>
                <span className="font-mono text-muted-foreground">{formatValue ? formatValue(row.value) : row.value}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-blue-600 dark:bg-blue-400" style={{ width: `${Math.max(8, (Math.abs(row.value) / max) * 100)}%` }} />
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">No chart data available.</div>
        )}
      </CardContent>
    </Card>
  );
}

function AccountRowActionsMenu({
  row,
  disabled,
  onView,
  onEdit,
  onOpenAccount,
  onOpenLedger,
  onViewJournal,
  onPrint,
  onPdf,
  onExcel,
  onDelete
}: {
  row: AccountGeneralReportRow;
  disabled?: boolean;
  onView: () => void;
  onEdit: () => void;
  onOpenAccount: () => void;
  onOpenLedger: () => void;
  onViewJournal: () => void;
  onPrint: () => void;
  onPdf: () => void;
  onExcel: () => void;
  onDelete?: () => void;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    function onMouseDown(event: MouseEvent) {
      const root = rootRef.current;
      if (!root) return;
      if (root.contains(event.target as Node)) return;
      setOpen(false);
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onMouseDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onMouseDown);
    };
  }, [open]);

  function item(
    label: string,
    icon: ReactNode,
    action: () => void,
    tone?: "danger",
    hidden = false
  ) {
    if (hidden) return null;
    return (
      <button
        type="button"
        className={cn(
          "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted",
          tone === "danger" ? "text-red-600 hover:bg-red-50" : ""
        )}
        onClick={() => {
          setOpen(false);
          action();
        }}
      >
        {icon}
        {label}
      </button>
    );
  }

  return (
    <div ref={rootRef} className="relative">
      <Button type="button" variant="outline" size="icon" disabled={disabled} onClick={() => setOpen((value) => !value)}>
        <MoreVertical className="h-4 w-4" aria-hidden />
      </Button>

      {open ? (
        <div className="absolute right-0 top-full z-30 mt-2 w-56 overflow-hidden rounded-lg border bg-background shadow-lg">
          {item("View", <Eye className="h-4 w-4" aria-hidden />, onView)}
          {item("Edit", <PencilLine className="h-4 w-4" aria-hidden />, onEdit)}
          {item("Ledger", <FileText className="h-4 w-4" aria-hidden />, onOpenLedger)}
          {item("Journal", <Printer className="h-4 w-4" aria-hidden />, onViewJournal)}
          {item("Print", <Printer className="h-4 w-4" aria-hidden />, onPrint)}
          {item("PDF", <DownloadActionIcon className="h-4 w-4" aria-hidden />, onPdf)}
          {item("Excel", <FileSpreadsheet className="h-4 w-4" aria-hidden />, onExcel)}
          {onDelete
            ? item("Delete", <Trash2 className="h-4 w-4" aria-hidden />, onDelete, "danger")
            : null}
        </div>
      ) : null}
    </div>
  );
}

export function AccountGeneralReportView({
  lang,
  pageTitle,
  subtitle,
  initialAccountId,
  highlightCreated = false,
  showProfilePanel = true
}: {
  lang: SupportedLanguage;
  pageTitle: string;
  subtitle?: string | null;
  initialAccountId?: string | null;
  highlightCreated?: boolean;
  showProfilePanel?: boolean;
}) {
  const router = useRouter();
  const actionsRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingDeleting, setLoadingDeleting] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [expandedView, setExpandedView] = useState(false);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [data, setData] = useState<AccountGeneralReportResponse | null>(null);
  const [selectedCountryForSummary, setSelectedCountryForSummary] = useState<string | null>(null);
  const [selectedUserBranchOnly, setSelectedUserBranchOnly] = useState<boolean>(false);
  const [expandedCountries, setExpandedCountries] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [draftQuery, setDraftQuery] = useState("");
  const [draftAccountId, setDraftAccountId] = useState("all");
  const [draftCountryName, setDraftCountryName] = useState("all");
  const [draftBranchCode, setDraftBranchCode] = useState("all");
  const [draftStatus, setDraftStatus] = useState("all");
  const [draftFromDate, setDraftFromDate] = useState("");
  const [draftToDate, setDraftToDate] = useState("");
  const [query, setQuery] = useState("");
  const [accountId, setAccountId] = useState("all");
  const [countryName, setCountryName] = useState("all");
  const [branchCode, setBranchCode] = useState("all");
  const [status, setStatus] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [dashboardScope, setDashboardScope] = useState<AccountDashboardScope>("super_admin");
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(initialAccountId ?? null);
  const [accountToDelete, setAccountToDelete] = useState<AccountGeneralReportRow | null>(null);
  const [titlePortal, setTitlePortal] = useState<HTMLElement | null>(null);
  const [actionsPortal, setActionsPortal] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setTitlePortal(document.getElementById("erp-page-title-slot"));
    setActionsPortal(document.getElementById("erp-page-actions-slot"));
  }, []);

  useEffect(() => {
    let cancelled = false;

    apiGet<SessionInfo>("/api/erp/auth/session")
      .then((info) => {
        if (!cancelled) setSession(info);
      })
      .catch(() => null);

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await apiGet<AccountGeneralReportResponse>("/api/erp/accounting/reports/accounts/general?limit=500");
        if (!cancelled) {
          setData(res);
          if (initialAccountId) setSelectedAccountId(initialAccountId);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load account report");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initialAccountId]);

  useEffect(() => {
    if (!actionsOpen) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setActionsOpen(false);
    }

    function onMouseDown(e: MouseEvent) {
      const root = actionsRef.current;
      if (!root) return;
      if (root.contains(e.target as Node)) return;
      setActionsOpen(false);
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onMouseDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onMouseDown);
    };
  }, [actionsOpen]);

  const rows = useMemo(() => data?.rows ?? [], [data]);
  const isSuperAdmin = session?.scopes?.isSuperAdmin ?? session?.roles.includes("super_admin") ?? false;

  useEffect(() => {
    if (!session) return;
    if (isSuperAdmin) return;
    if (session.scopes?.cityBranchIds?.length) setDashboardScope("branch");
    else setDashboardScope("country");
  }, [isSuperAdmin, session]);

  const accountOptions = useMemo(() => rows.map(buildAccountOption), [rows]);
  const countryOptions = useMemo(() => {
    const map = new Map<string, SearchSelectOption>();
    for (const row of rows) {
      if (!row.countryName || row.countryName === "-") continue;
      if (!map.has(row.countryName)) {
        map.set(row.countryName, {
          value: row.countryName,
          label: `${row.countryName}${row.countryCode && row.countryCode !== "-" ? ` (${row.countryCode})` : ""}`,
          keywords: [row.countryName, row.countryCode].filter(Boolean).join(" ")
        });
      }
    }
    return [{ value: "all", label: "All Countries", keywords: "all countries" }, ...map.values()];
  }, [rows]);

  const branchOptions = useMemo(() => {
    const map = new Map<string, { value: string; label: string; keywords: string }>();
    for (const row of rows) {
      if (draftCountryName !== "all" && row.countryName !== draftCountryName) continue;
      if (!map.has(row.branchCode)) {
        const option = buildBranchOption(row);
        map.set(row.branchCode, option);
      }
    }
    return [{ value: "all", label: "All Branches", keywords: "all branches" }, ...map.values()];
  }, [rows, draftCountryName]);

  // Sync draft states when active states change
  useEffect(() => {
    setDraftCountryName(countryName);
  }, [countryName]);

  useEffect(() => {
    setDraftBranchCode(branchCode);
  }, [branchCode]);

  // Reset draftBranchCode if it is no longer valid in the selected country's branches list
  useEffect(() => {
    const validCodes = branchOptions.map(opt => opt.value);
    if (draftBranchCode !== "all" && !validCodes.includes(draftBranchCode)) {
      setDraftBranchCode("all");
    }
  }, [branchOptions, draftBranchCode]);

  const scopedRows = useMemo(() => {
    return rows
      .filter((row) => {
        if (dashboardScope === "super_admin") return true;
        if (dashboardScope === "country") return row.branchType === "Country" || row.branchType === "Main Branch" || row.branchType === "City Branch";
        return row.branchType === "Main Branch" || row.branchType === "City Branch";
      })
      .filter((row) => {
        if (countryName !== "all") return row.countryName === countryName;
        return true;
      });
  }, [countryName, dashboardScope, rows]);

  const allFilteredRows = useMemo(() => {
    const q = normalizeSearch(query);
    return scopedRows
      .filter((row) => (accountId !== "all" ? row.accountId === accountId : true))
      .filter((row) => (branchCode !== "all" ? row.branchCode === branchCode : true))
      .filter((row) => (status !== "all" ? row.status === status : true))
      .filter((row) => {
        if (fromDate && row.createdAt.slice(0, 10) < fromDate) return false;
        if (toDate && row.createdAt.slice(0, 10) > toDate) return false;
        if (!q) return true;
        return safeRowText(row).includes(q);
      });
  }, [accountId, branchCode, fromDate, query, scopedRows, status, toDate]);

  const userBranchRows = useMemo(() => {
    if (!session) return [];
    
    // Try to match by session assignments or cityBranchIds
    const cityBranchIds = session.scopes?.cityBranchIds || [];
    const countryBranchIds = session.scopes?.countryBranchIds || [];
    
    let matched = allFilteredRows.filter(row => {
      if (row.cityId && cityBranchIds.includes(row.cityId)) return true;
      if (row.cityBranchId && cityBranchIds.includes(row.cityBranchId)) return true;
      if (row.countryBranchId && countryBranchIds.includes(row.countryBranchId)) return true;
      return false;
    });

    // Fallback: if super admin or no matches, use the first row's branch or default branch
    if (matched.length === 0 && allFilteredRows.length > 0) {
      const firstBranchCode = allFilteredRows[0].branchCode;
      matched = allFilteredRows.filter(row => row.branchCode === firstBranchCode);
    }
    
    return matched;
  }, [allFilteredRows, session]);

  const filteredRows = useMemo(() => {
    if (selectedUserBranchOnly) return userBranchRows;
    if (!selectedCountryForSummary) return allFilteredRows;
    return allFilteredRows.filter((row) => row.countryName === selectedCountryForSummary);
  }, [allFilteredRows, selectedUserBranchOnly, selectedCountryForSummary, userBranchRows]);

  const sortedRows = useMemo(() => {
    return [...filteredRows].sort((a, b) => {
      const aNonZero = a.currentBalance !== 0;
      const bNonZero = b.currentBalance !== 0;
      
      if (aNonZero && !bNonZero) return -1;
      if (!aNonZero && bNonZero) return 1;
      
      // If both are non-zero or both are zero, sort by absolute currentBalance descending
      return Math.abs(b.currentBalance) - Math.abs(a.currentBalance);
    });
  }, [filteredRows]);

  const countrySummaries = useMemo(() => {
    const groups: Record<string, {
      countryName: string;
      countryCode: string;
      totalAccounts: number;
      activeAccounts: number;
      debitTotal: number;
      creditTotal: number;
      netBalance: number;
      currency: string;
      branches: Record<string, {
        branchName: string;
        branchCode: string;
        totalAccounts: number;
        debitTotal: number;
        creditTotal: number;
        netBalance: number;
      }>;
    }> = {};

    allFilteredRows.forEach(row => {
      const country = row.countryName || "Unknown Country";
      const branch = row.branchName || "Main Branch";
      const branchCode = row.branchCode || "all";
      
      if (!groups[country]) {
        groups[country] = {
          countryName: country,
          countryCode: row.countryCode || "",
          totalAccounts: 0,
          activeAccounts: 0,
          debitTotal: 0,
          creditTotal: 0,
          netBalance: 0,
          currency: row.currency || "USD",
          branches: {}
        };
      }

      const g = groups[country];
      g.totalAccounts += 1;
      if (row.status === "active") g.activeAccounts += 1;
      g.debitTotal += row.debitTotal;
      g.creditTotal += row.creditTotal;
      g.netBalance += row.currentBalance;

      if (!g.branches[branchCode]) {
        g.branches[branchCode] = {
          branchName: branch,
          branchCode,
          totalAccounts: 0,
          debitTotal: 0,
          creditTotal: 0,
          netBalance: 0
        };
      }

      const b = g.branches[branchCode];
      b.totalAccounts += 1;
      b.debitTotal += row.debitTotal;
      b.creditTotal += row.creditTotal;
      b.netBalance += row.currentBalance;
    });

    return Object.values(groups).map(g => ({
      ...g,
      branches: Object.values(g.branches).sort((a, b) => a.branchName.localeCompare(b.branchName))
    })).sort((a, b) => a.countryName.localeCompare(b.countryName));
  }, [allFilteredRows]);

  useEffect(() => {
    if (!selectedAccountId && sortedRows.length) {
      setSelectedAccountId(sortedRows[0]!.accountId);
    }
  }, [sortedRows, selectedAccountId]);

  useEffect(() => {
    if (!selectedAccountId) return;
    if (sortedRows.some((row) => row.accountId === selectedAccountId)) return;
    if (sortedRows.length) {
      setSelectedAccountId(sortedRows[0]!.accountId);
    } else {
      setSelectedAccountId(null);
    }
  }, [sortedRows, selectedAccountId]);

  const selectedRow = useMemo(
    () => sortedRows.find((row) => row.accountId === selectedAccountId) ?? sortedRows[0] ?? null,
    [sortedRows, selectedAccountId]
  );
  const highlightedAccountId = highlightCreated ? initialAccountId ?? null : null;

  const visibleSummary = useMemo(() => {
    const totalAccounts = filteredRows.length;
    const activeAccounts = filteredRows.filter((row) => row.status === "active").length;
    const totalLedgers = filteredRows.reduce((sum, row) => sum + row.linkedLedgerCount, 0);
    const activeLedgers = filteredRows.filter((row) => row.ledgerStatus === "active").length;
    const totalCountries = uniqueCount(filteredRows.map((row) => row.countryName));
    const totalBranches = uniqueCount(filteredRows.map((row) => row.branchCode));
    const debitTotal = filteredRows.reduce((sum, row) => sum + row.debitTotal, 0);
    const creditTotal = filteredRows.reduce((sum, row) => sum + row.creditTotal, 0);
    const totalBalance = filteredRows.reduce((sum, row) => sum + row.currentBalance, 0);
    const totalJournalActivity = filteredRows.reduce((sum, row) => sum + row.journalActivityCount, 0);
    const categoryCount = (category: string) =>
      filteredRows.filter((row) => row.accountCategory.toLowerCase() === category).length;

    return {
      totalAccounts,
      activeAccounts,
      totalLedgers,
      activeLedgers,
      totalCountries,
      totalBranches,
      debitTotal,
      creditTotal,
      totalBalance,
      totalJournalActivity,
      assetAccounts: categoryCount("asset"),
      expenseAccounts: categoryCount("expense"),
      incomeAccounts: categoryCount("income"),
      liabilityAccounts: categoryCount("liability")
    };
  }, [filteredRows]);

  const dashboardCards = useMemo(() => {
    if (dashboardScope === "branch") {
      return [
        { label: "Total Accounts", value: visibleSummary.totalAccounts },
        { label: "Asset Accounts", value: visibleSummary.assetAccounts },
        { label: "Expense Accounts", value: visibleSummary.expenseAccounts },
        { label: "Income Accounts", value: visibleSummary.incomeAccounts },
        { label: "Liability Accounts", value: visibleSummary.liabilityAccounts }
      ];
    }

    if (dashboardScope === "country") {
      return [
        { label: "Total Accounts", value: visibleSummary.totalAccounts },
        { label: "Total Debit", value: fmtNumber(visibleSummary.debitTotal) },
        { label: "Total Credit", value: fmtNumber(visibleSummary.creditTotal) },
        { label: "Net Balance", value: fmtNumber(visibleSummary.totalBalance) },
        { label: "Active Accounts", value: visibleSummary.activeAccounts }
      ];
    }

    return [
      { label: "Total Accounts", value: visibleSummary.totalAccounts },
      { label: "Total Countries", value: visibleSummary.totalCountries },
      { label: "Total Branches", value: visibleSummary.totalBranches },
      { label: "Total Debit", value: fmtNumber(visibleSummary.debitTotal) },
      { label: "Total Credit", value: fmtNumber(visibleSummary.creditTotal) },
      { label: "Total Balance (USD)", value: fmtNumber(visibleSummary.totalBalance) }
    ];
  }, [dashboardScope, visibleSummary]);

  const chartGroups = useMemo(() => {
    if (dashboardScope === "branch") {
      return [
        { title: "Accounts by Category", rows: groupCounts(filteredRows, (row) => row.accountCategory) },
        { title: "Accounts by Currency", rows: groupCounts(filteredRows, (row) => row.currency) },
        { title: "Accounts by Status", rows: groupCounts(filteredRows, (row) => titleCase(row.status)) },
        {
          title: "Branch Financial Summary",
          rows: [
            { label: "Debit", value: visibleSummary.debitTotal },
            { label: "Credit", value: visibleSummary.creditTotal },
            { label: "Balance", value: visibleSummary.totalBalance }
          ],
          formatValue: fmtNumber
        }
      ];
    }

    if (dashboardScope === "country") {
      return [
        { title: "Main Branch-wise Summary", rows: groupCounts(filteredRows, (row) => row.mainBranchName ?? row.branchName) },
        { title: "City Branch-wise Summary", rows: groupCounts(filteredRows, (row) => row.cityBranchName ?? row.cityName) },
        {
          title: "Debit / Credit Summary",
          rows: [
            { label: "Debit", value: visibleSummary.debitTotal },
            { label: "Credit", value: visibleSummary.creditTotal }
          ],
          formatValue: fmtNumber
        },
        {
          title: "Balance Summary",
          rows: [{ label: "Net Balance", value: visibleSummary.totalBalance }],
          formatValue: fmtNumber
        }
      ];
    }

    return [
      { title: "Country-wise Summary", rows: groupSums(filteredRows, (row) => row.countryName, (row) => row.currentBalance), formatValue: fmtNumber },
      { title: "Currency-wise Summary", rows: groupSums(filteredRows, (row) => row.currency, (row) => row.currentBalance), formatValue: fmtNumber },
      { title: "Accounts by Category", rows: groupCounts(filteredRows, (row) => row.accountCategory) },
      { title: "Accounts by Status", rows: groupCounts(filteredRows, (row) => titleCase(row.status)) }
    ];
  }, [dashboardScope, filteredRows, visibleSummary.creditTotal, visibleSummary.debitTotal, visibleSummary.totalBalance]);

  const canDelete = Boolean(session?.permissions.includes("accounts:delete") || session?.roles.includes("super_admin"));

  function resetFilters() {
    setDraftQuery("");
    setDraftAccountId("all");
    setDraftCountryName("all");
    setDraftBranchCode("all");
    setDraftStatus("all");
    setDraftFromDate("");
    setDraftToDate("");
    setQuery("");
    setAccountId("all");
    setCountryName("all");
    setBranchCode("all");
    setStatus("all");
    setFromDate("");
    setToDate("");
    setSelectedCountryForSummary(null);
    setSelectedUserBranchOnly(false);
    setExpandedCountries({});
  }

  function applyFilters() {
    setQuery(draftQuery);
    setAccountId(draftAccountId);
    setCountryName(draftCountryName);
    setBranchCode(draftBranchCode);
    setStatus(draftStatus);
    setFromDate(draftFromDate);
    setToDate(draftToDate);
    setSelectedCountryForSummary(null);
    setSelectedUserBranchOnly(false);
    setExpandedCountries({});
  }

  function openPrint(autoPrint: boolean) {
    const selectedRow = rows.find((r) => r.accountId === selectedAccountId) ?? null;
    const activeBranchName = branchCode !== "all" ? branchCode : (session?.scopes?.isSuperAdmin ? "GLOBAL ADMIN" : session?.roles?.[0] ?? "MAIN BRANCH");
    openA4ReportWindow({
      title: "Account Register Report",
      subtitle: `Account Master Registry & Search Report - Generated ${new Date().toLocaleString()}`,
      rows: [
        { label: "Report Scope", value: dashboardScope === "super_admin" ? "SUPER ADMIN" : dashboardScope === "country" ? "COUNTRY SCOPE" : "BRANCH SCOPE" },
        { label: "Branch Name Details", value: activeBranchName },
        { label: "Total Accounts", value: `${visibleSummary.totalAccounts.toLocaleString()} (${visibleSummary.activeAccounts} Active)` },
        { label: "Total Debit (DR)", value: fmtNumber(visibleSummary.debitTotal) },
        { label: "Total Credit (CR)", value: fmtNumber(visibleSummary.creditTotal) },
        { label: "Net Balance", value: fmtNumber(visibleSummary.totalBalance) },
        { label: "Selected Account", value: selectedRow ? `${selectedRow.accountName} (${selectedRow.accountCode})` : "None" },
        { label: "Company Name", value: selectedRow?.companyName || "-" },
        { label: "Bank Name", value: selectedRow?.bankName || "-" },
        { label: "Warehouse Name", value: selectedRow?.warehouseName || "-" },
        { label: "Owner Name", value: selectedRow?.ownerName || "-" },
        { label: "Country", value: selectedRow?.countryName || "-" }
      ],
      autoPrint,
      lang
    });
  }

  function exportCsv(scope: "filtered" | "selected" = "filtered") {
    const exportRows = scope === "selected" && selectedRow ? [selectedRow] : filteredRows;
    const csvRows: string[][] = [
      [
        "Account Code",
        "Manual Reference Number",
        "Country Serial Number",
        "Branch Serial Number",
        "Account Name",
        "Journal Code",
        "Branch",
        "Country",
        "City",
        "Branch Type",
        "Currency",
        "Category",
        "Sub Type",
        "Status",
        "Created Date",
        "Opening Balance",
        "Debit Total",
        "Credit Total",
        "Current Balance"
      ]
    ];

    for (const row of exportRows) {
      csvRows.push([
        row.accountCode,
        row.manualReferenceNumber ?? "",
        row.countrySerialNumber ?? "",
        row.branchSerialNumber ?? "",
        row.accountName,
        row.journalCode,
        row.branchName,
        row.countryName,
        row.cityName,
        row.branchType,
        row.currency,
        row.accountCategory,
        row.subType,
        row.status,
        row.createdAt,
        String(row.openingBalance),
        String(row.debitTotal),
        String(row.creditTotal),
        String(row.currentBalance)
      ]);
    }

    const csv = csvRows.map((row) => row.map((cell) => csvEscape(cell)).join(",")).join("\r\n");
    downloadTextFile(`new-account-general-report_${new Date().toISOString().slice(0, 10)}.csv`, csv, "text/csv");
  }

  async function deleteAccount(row: AccountGeneralReportRow) {
    if (!canDelete) return;
    if (!window.confirm(`Delete account ${row.accountCode} - ${row.accountName}?`)) return;
    setLoadingDeleting(true);
    try {
      await apiDelete(`/api/erp/accounting/accounts/${row.accountId}`);
      setData((current) =>
        current
          ? {
              ...current,
              rows: current.rows.filter((item) => item.accountId !== row.accountId),
              summary: {
                ...current.summary,
                totalAccounts: Math.max(0, current.summary.totalAccounts - 1)
              }
            }
          : current
      );
      if (selectedAccountId === row.accountId) {
        const next = filteredRows.find((item) => item.accountId !== row.accountId) ?? null;
        setSelectedAccountId(next?.accountId ?? null);
      }
    } finally {
      setLoadingDeleting(false);
    }
  }

  function openFullScreen() {
    if (typeof document === "undefined") return;
    if (!document.fullscreenElement) {
      void document.documentElement.requestFullscreen().catch(() => {
        setExpandedView((current) => !current);
      });
    } else {
      void document.exitFullscreen().catch(() => {
        setExpandedView((current) => !current);
      });
    }
  }

  const containerClassName = expandedView ? "fixed inset-0 z-50 overflow-auto bg-slate-50 dark:bg-slate-900 p-4 md:p-6" : "space-y-4 text-slate-900 dark:text-slate-100 max-w-none mx-auto p-4 bg-slate-50/30 dark:bg-slate-900/30 rounded-2xl";

  const pageHeaderContent = (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-4">
      <div>
        <h1 className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight">{pageTitle}</h1>
        <p className="text-xs text-slate-500 mt-0.5 dark:text-slate-400">{subtitle ?? "Enterprise Registry & Financial Ledger Details"}</p>
      </div>
    </div>
  );

  const pageActionsContent = (
    <div className="flex flex-wrap items-center gap-2">
      {/* Scope Selector */}
      <select
        value={dashboardScope}
        onChange={(event) => {
          const next = event.target.value as AccountDashboardScope;
          setDashboardScope(next);
          setCountryName("all");
          setDraftCountryName("all");
          setBranchCode("all");
          setDraftBranchCode("all");
        }}
        className="h-9 min-w-[150px] rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none focus:border-blue-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-350 cursor-pointer shadow-sm"
      >
        <option value="super_admin" disabled={!isSuperAdmin}>SUPER ADMIN</option>
        <option value="country">COUNTRY SCOPE</option>
        <option value="branch">BRANCH SCOPE</option>
      </select>

      {/* Search Input */}
      <div className="relative min-w-[200px]">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-450" />
        <input
          value={draftQuery}
          onChange={(e) => { setDraftQuery(e.target.value); setQuery(e.target.value); }}
          placeholder="Search account, name, branch..."
          className="h-9 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 shadow-sm"
        />
      </div>

      <Button type="button" size="sm" variant="outline" onClick={() => setActionsOpen(!actionsOpen)} className="h-9 rounded-xl border-slate-200 font-bold text-xs shadow-sm">
        <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" /> Filter
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={resetFilters} className="h-9 rounded-xl border-slate-200 font-bold text-xs shadow-sm">
        <RefreshCw className={loading ? "mr-1.5 h-3.5 w-3.5 animate-spin" : "mr-1.5 h-3.5 w-3.5"} /> Reset
      </Button>

      <div className="flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
        <CalendarDays className="h-4 w-4 text-slate-400" />
        <span>{new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}, {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
      </div>

      <Button
        type="button"
        size="sm"
        onClick={() => router.push("/dashboard/accounts/setup")}
        className="h-9 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm px-4 gap-1.5 shrink-0"
      >
        <Plus className="h-3.5 w-3.5" /> New Account
      </Button>

      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => openPrint(true)}
        className="h-9 rounded-xl border-slate-200 font-bold text-xs shadow-sm gap-1.5"
      >
        <Printer className="h-3.5 w-3.5" /> Print
      </Button>

      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => openPrint(false)}
        className="h-9 rounded-xl border-slate-200 font-bold text-xs shadow-sm gap-1.5"
      >
        <Download className="h-3.5 w-3.5" /> Export PDF
      </Button>
    </div>
  );

  return (
    <div className={containerClassName}>
      {titlePortal && createPortal(pageHeaderContent, titlePortal)}
      {actionsPortal && createPortal(pageActionsContent, actionsPortal)}
      
      {(!titlePortal || !actionsPortal) && (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
          {pageHeaderContent}
          {pageActionsContent}
        </div>
      )}

      {/* Unified Executive & Operations Summary Box */}
      <div className="border border-slate-200/60 rounded-2xl bg-white/80 backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-950/60 p-5 shadow-sm text-xs font-semibold text-slate-500 uppercase flex flex-col gap-4 transition-all hover:shadow-md">
        
        {/* Row 1: Session Info */}
        <div className="flex flex-wrap items-center justify-between border-b border-slate-100 dark:border-slate-850 pb-2.5">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Branch Scope:</span> 
              <span className="text-slate-800 dark:text-slate-200 font-bold uppercase">{branchCode !== "all" ? branchCode : (session?.scopes?.isSuperAdmin ? "GLOBAL ADMIN" : session?.roles?.[0] ?? "MAIN BRANCH")}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Session Role:</span> 
              <span className="text-slate-800 dark:text-slate-200 font-bold">{isSuperAdmin ? "SUPER ADMIN" : "AUTHORIZED USER"}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Total Ledgers:</span> 
              <span className="text-slate-800 dark:text-slate-200 font-bold">{visibleSummary.totalLedgers}</span>
            </div>
          </div>
        </div>

        {/* Row 1.5: Super Admin Country Breakdown Grid */}
        {isSuperAdmin && countrySummaries.length > 0 && (
          <div className="border-b border-slate-100 dark:border-slate-850 pb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Country-wise Financial Breakdown</div>
              {selectedCountryForSummary && (
                <button
                  type="button"
                  onClick={() => setSelectedCountryForSummary(null)}
                  className="text-[9px] font-black text-rose-500 hover:text-rose-655 underline uppercase cursor-pointer"
                >
                  Clear Selection (Show All Countries)
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 w-full normal-case">
              {/* General Report (System-wide summary) Card */}
              <div 
                className={cn(
                  "rounded-xl border shadow-sm transition-all bg-white dark:bg-slate-900 overflow-hidden flex flex-col cursor-pointer",
                  selectedCountryForSummary === null && !selectedUserBranchOnly
                    ? "border-blue-500 ring-1 ring-blue-500 dark:border-blue-400 dark:ring-blue-400" 
                    : "border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-slate-600"
                )}
                onClick={() => {
                  setSelectedCountryForSummary(null);
                  setSelectedUserBranchOnly(false);
                }}
              >
                {/* Header */}
                <div 
                  className={cn(
                    "px-4 py-3 flex items-center justify-between border-b",
                    selectedCountryForSummary === null && !selectedUserBranchOnly ? "bg-blue-50/50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-900/30" : "bg-slate-50/50 dark:bg-slate-800/20 border-slate-100 dark:border-slate-800"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <div className="text-lg">📊</div>
                    <div>
                      <h3 className="font-extrabold text-slate-800 dark:text-slate-100 text-[11px] uppercase tracking-wider">General Report</h3>
                      <div className="text-[9px] font-bold text-slate-500">{allFilteredRows.length} Total Accounts ({allFilteredRows.filter(row => row.status === "active").length} Active)</div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] font-black text-slate-800 dark:text-slate-200 bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded">System</span>
                  </div>
                </div>

                {/* Content */}
                <div className="p-4 flex flex-col gap-3 flex-1">
                  <div className="bg-slate-50 dark:bg-slate-800/40 rounded-lg p-2.5 space-y-2 border border-slate-100 dark:border-slate-800">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="font-bold text-slate-500 dark:text-slate-400 uppercase text-[9px] tracking-wider">Debit (Receivables)</span>
                      <span className="font-mono font-extrabold text-rose-600 dark:text-rose-450">{fmtNumber(allFilteredRows.reduce((sum, r) => sum + r.debitTotal, 0))}</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="font-bold text-slate-500 dark:text-slate-400 uppercase text-[9px] tracking-wider">Credit (Payables)</span>
                      <span className="font-mono font-extrabold text-emerald-600 dark:text-emerald-450">{fmtNumber(allFilteredRows.reduce((sum, r) => sum + r.creditTotal, 0))}</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px] pt-1.5 border-t border-dashed border-slate-200 dark:border-slate-750">
                      <span className="font-bold text-slate-650 dark:text-slate-300 uppercase text-[9px] tracking-wider">Net Balance</span>
                      {(() => {
                        const bal = allFilteredRows.reduce((sum, r) => sum + r.currentBalance, 0);
                        return (
                          <span className={cn("font-mono font-black", bal < 0 ? "text-rose-600 dark:text-rose-405" : "text-emerald-600 dark:text-emerald-455")}>
                            {fmtNumber(bal)}
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </div>

              {/* User & Branch Summary Card */}
              <div 
                className={cn(
                  "rounded-xl border shadow-sm transition-all bg-white dark:bg-slate-900 overflow-hidden flex flex-col cursor-pointer",
                  selectedUserBranchOnly 
                    ? "border-blue-500 ring-1 ring-blue-500 dark:border-blue-400 dark:ring-blue-400" 
                    : "border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-slate-600"
                )}
                onClick={() => {
                  setSelectedUserBranchOnly(true);
                  setSelectedCountryForSummary(null);
                }}
              >
                {/* Header */}
                <div 
                  className={cn(
                    "px-4 py-3 flex items-center justify-between border-b",
                    selectedUserBranchOnly ? "bg-blue-50/50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-900/30" : "bg-slate-50/50 dark:bg-slate-800/20 border-slate-100 dark:border-slate-800"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <div className="text-lg">🏢</div>
                    <div>
                      <h3 className="font-extrabold text-slate-800 dark:text-slate-100 text-[11px] uppercase tracking-wider">User & Branch</h3>
                      <div className="text-[9px] font-bold text-slate-500">
                        {userBranchRows.length} Accounts ({userBranchRows.filter(row => row.status === "active").length} Active)
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] font-black text-slate-800 dark:text-slate-200 bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded">
                      {userBranchRows[0]?.currency || "USD"}
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="p-4 flex flex-col gap-3 flex-1">
                  <div className="bg-slate-50 dark:bg-slate-800/40 rounded-lg p-2.5 space-y-2 border border-slate-100 dark:border-slate-800">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="font-bold text-slate-500 dark:text-slate-400 uppercase text-[9px] tracking-wider">Debit (Receivables)</span>
                      <span className="font-mono font-extrabold text-rose-600 dark:text-rose-450">
                        {fmtNumber(userBranchRows.reduce((sum, r) => sum + r.debitTotal, 0))} {userBranchRows[0]?.currency || "USD"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="font-bold text-slate-500 dark:text-slate-400 uppercase text-[9px] tracking-wider">Credit (Payables)</span>
                      <span className="font-mono font-extrabold text-emerald-600 dark:text-emerald-450">
                        {fmtNumber(userBranchRows.reduce((sum, r) => sum + r.creditTotal, 0))} {userBranchRows[0]?.currency || "USD"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[11px] pt-1.5 border-t border-dashed border-slate-200 dark:border-slate-750">
                      <span className="font-bold text-slate-650 dark:text-slate-300 uppercase text-[9px] tracking-wider">Net Balance</span>
                      {(() => {
                        const bal = userBranchRows.reduce((sum, r) => sum + r.currentBalance, 0);
                        return (
                          <span className={cn("font-mono font-black", bal < 0 ? "text-rose-600 dark:text-rose-405" : "text-emerald-600 dark:text-emerald-455")}>
                            {fmtNumber(bal)} {userBranchRows[0]?.currency || "USD"}
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                  {/* Assigned Info */}
                  <div className="text-[9px] text-slate-450 font-bold mt-auto pt-1 truncate max-w-[250px]">
                    Assigned: {session?.user?.fullName || "Super Admin"} — {userBranchRows[0]?.branchName || "Main Branch"}
                  </div>
                </div>
              </div>

              {countrySummaries.map((r, idx) => {
                const isSelected = selectedCountryForSummary === r.countryName;
                const isExpanded = !!expandedCountries[r.countryName];

                return (
                  <div 
                    key={idx}
                    className={cn(
                      "rounded-xl border shadow-sm transition-all bg-white dark:bg-slate-900 overflow-hidden flex flex-col",
                      isSelected 
                        ? "border-blue-500 ring-1 ring-blue-500 dark:border-blue-400 dark:ring-blue-400" 
                        : "border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-slate-600"
                    )}
                  >
                    {/* Header */}
                    <div 
                      className={cn(
                        "px-4 py-3 flex items-center justify-between cursor-pointer border-b",
                        isSelected ? "bg-blue-50/50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-900/30" : "bg-slate-50/50 dark:bg-slate-800/20 border-slate-100 dark:border-slate-800"
                      )}
                      onClick={() => {
                        setSelectedCountryForSummary(isSelected ? null : r.countryName);
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <div className="text-lg">{getFlag(r.countryName)}</div>
                        <div>
                          <h3 className="font-extrabold text-slate-800 dark:text-slate-100 text-[11px] uppercase tracking-wider">{r.countryName}</h3>
                          <div className="text-[9px] font-bold text-slate-500">{r.totalAccounts} Accounts ({r.activeAccounts} Active)</div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end" onClick={(e) => {
                        e.stopPropagation();
                        setExpandedCountries(prev => ({
                          ...prev,
                          [r.countryName]: !prev[r.countryName]
                        }));
                      }}>
                        <span className="text-[10px] font-black text-slate-800 dark:text-slate-200 bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded">{r.currency}</span>
                        <span className="text-[9px] text-slate-400 mt-0.5 flex items-center gap-0.5 hover:text-blue-500 transition-colors">
                          {isExpanded ? "Hide Branches" : "View Branches"} {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3.5 w-3.5" />}
                        </span>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-4 flex flex-col gap-3 flex-1" onClick={() => setSelectedCountryForSummary(isSelected ? null : r.countryName)}>
                      <div className="bg-slate-50 dark:bg-slate-800/40 rounded-lg p-2.5 space-y-2 border border-slate-100 dark:border-slate-800">
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="font-bold text-slate-500 dark:text-slate-400 uppercase text-[9px] tracking-wider">Debit (Receivables)</span>
                          <span className="font-mono font-extrabold text-rose-600 dark:text-rose-450">{fmtNumber(r.debitTotal)} {r.currency}</span>
                        </div>
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="font-bold text-slate-500 dark:text-slate-400 uppercase text-[9px] tracking-wider">Credit (Payables)</span>
                          <span className="font-mono font-extrabold text-emerald-600 dark:text-emerald-450">{fmtNumber(r.creditTotal)} {r.currency}</span>
                        </div>
                        <div className="flex justify-between items-center text-[11px] pt-1.5 border-t border-dashed border-slate-200 dark:border-slate-750">
                          <span className="font-bold text-slate-650 dark:text-slate-300 uppercase text-[9px] tracking-wider">Net Balance</span>
                          <span className={cn("font-mono font-black", r.netBalance < 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-450")}>
                            {fmtNumber(r.netBalance)} {r.currency}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Branch Breakdown */}
                    {isExpanded && r.branches.length > 0 && (
                      <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 p-3 space-y-2">
                        <div className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1 flex items-center justify-between">
                          <span>{r.countryName} Branches</span>
                          <span className="bg-slate-250 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[9px] font-bold text-slate-600 dark:text-slate-350">{r.branches.length}</span>
                        </div>
                        
                        <div className="space-y-2">
                          {r.branches.map((b, bIdx) => (
                            <div key={bIdx} className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md p-2">
                              <div className="font-extrabold uppercase text-[9px] text-slate-700 dark:text-slate-200 mb-1.5 pb-1 border-b border-slate-100 dark:border-slate-800">{b.branchName}</div>
                              <div className="flex justify-between items-center text-[9px]">
                                <span className="text-slate-500">Dr: <span className="font-mono font-bold text-rose-600">{fmtNumber(b.debitTotal)}</span></span>
                                <span className="text-slate-500">Cr: <span className="font-mono font-bold text-emerald-600">{fmtNumber(b.creditTotal)}</span></span>
                                <span className="text-slate-500">Bal: <span className={cn("font-mono font-bold", b.netBalance < 0 ? "text-rose-600" : "text-emerald-600")}>{fmtNumber(b.netBalance)}</span></span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Row 2: Account Financial Summary Cards (Hidden for Super Admin to avoid duplicate dashboard panels) */}
        {!isSuperAdmin && (
          <div className="grid gap-3 pt-1 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Accounts</div>
                  <div className="text-xs font-black text-blue-700 dark:text-blue-300">SYSTEM WIDE</div>
                </div>
                <span className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-black text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">{visibleSummary.activeAccounts} Active</span>
              </div>
              <div className="grid grid-cols-1 gap-2 text-[10px] normal-case">
                <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-950/50">
                  <div className="font-bold uppercase text-slate-400">Count</div>
                  <div className="font-mono text-sm font-black text-slate-900 dark:text-slate-100">{visibleSummary.totalAccounts.toLocaleString()}</div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Debit</div>
                  <div className="text-xs font-black text-rose-700 dark:text-rose-300">RECEIVABLES / DR</div>
                </div>
                <span className="rounded-full bg-rose-50 px-2 py-1 text-[10px] font-black text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">Aggregated</span>
              </div>
              <div className="grid grid-cols-1 gap-2 text-[10px] normal-case">
                <div className="rounded-lg bg-rose-50 p-2 dark:bg-rose-950/20">
                  <div className="font-bold uppercase text-rose-600">Debit Total</div>
                  <div className="font-mono text-sm font-black text-rose-700 dark:text-rose-300">{fmtNumber(visibleSummary.debitTotal)}</div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Credit</div>
                  <div className="text-xs font-black text-emerald-700 dark:text-emerald-300">PAYABLES / CR</div>
                </div>
                <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-black text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">Aggregated</span>
              </div>
              <div className="grid grid-cols-1 gap-2 text-[10px] normal-case">
                <div className="rounded-lg bg-emerald-50 p-2 dark:bg-rose-950/20">
                  <div className="font-bold uppercase text-emerald-600">Credit Total</div>
                  <div className="font-mono text-sm font-black text-emerald-700 dark:text-emerald-300">{fmtNumber(visibleSummary.creditTotal)}</div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Net Balance</div>
                  <div className="text-xs font-black text-blue-700 dark:text-blue-300">OVERALL POSITION</div>
                </div>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-700 dark:bg-slate-800 dark:text-slate-300">Consolidated</span>
              </div>
              <div className="grid grid-cols-1 gap-2 text-[10px] normal-case">
                <div className={cn("rounded-lg p-2", visibleSummary.totalBalance < 0 ? "bg-rose-50 dark:bg-rose-950/20" : "bg-emerald-50 dark:bg-emerald-950/20")}>
                  <div className={cn("font-bold uppercase", visibleSummary.totalBalance < 0 ? "text-rose-600" : "text-emerald-600")}>Balance</div>
                  <div className={cn("font-mono text-sm font-black", visibleSummary.totalBalance < 0 ? "text-rose-700 dark:text-rose-300" : "text-emerald-700 dark:text-emerald-300")}>{fmtNumber(visibleSummary.totalBalance)}</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* REPORT-3: SEARCH & TRANSACTION REPORT */}
      <section className="bg-white border border-slate-200 dark:border-slate-800 dark:bg-slate-950 p-6 rounded-2xl shadow-sm space-y-6">
        {actionsOpen ? (
          <div className="rounded border border-slate-200 bg-slate-50/30 p-4 dark:border-slate-800 dark:bg-slate-955 animate-in fade-in duration-200">
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <label className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Country Scope</span>
                <select value={draftCountryName} onChange={(e) => setDraftCountryName(e.target.value)} disabled={!isSuperAdmin && dashboardScope !== "super_admin"} className="h-9 w-full rounded border border-slate-250 bg-white px-3 text-xs focus:border-blue-500 outline-none transition disabled:bg-slate-100 disabled:text-slate-500 dark:border-slate-800 dark:bg-slate-950">
                  {countryOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Branch Scope</span>
                <select value={draftBranchCode} onChange={(e) => setDraftBranchCode(e.target.value)} className="h-9 w-full rounded border border-slate-250 bg-white px-3 text-xs focus:border-blue-500 outline-none transition disabled:bg-slate-100 disabled:text-slate-500 dark:border-slate-800 dark:bg-slate-950">
                  {branchOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Status</span>
                <select value={draftStatus} onChange={(e) => setDraftStatus(e.target.value)} className="h-9 w-full rounded border border-slate-250 bg-white px-3 text-xs focus:border-blue-500 outline-none transition disabled:bg-slate-100 disabled:text-slate-500 dark:border-slate-800 dark:bg-slate-950">
                  <option value="all">All</option>
                  <option value="active">Active</option>
                  <option value="archived">Archived</option>
                </select>
              </label>
              <label className="space-y-1 flex gap-2">
                <div className="w-1/2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">From Date</span>
                  <input type="date" value={draftFromDate} onChange={(e) => setDraftFromDate(e.target.value)} className="h-9 w-full rounded border border-slate-250 bg-white px-3 text-xs focus:border-blue-500 outline-none transition dark:border-slate-800 dark:bg-slate-950" />
                </div>
                <div className="w-1/2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">To Date</span>
                  <input type="date" value={draftToDate} onChange={(e) => setDraftToDate(e.target.value)} className="h-9 w-full rounded border border-slate-250 bg-white px-3 text-xs focus:border-blue-500 outline-none transition dark:border-slate-800 dark:bg-slate-950" />
                </div>
              </label>
            </div>
            <div className="mt-3 flex justify-end gap-2 border-t border-slate-150 pt-3 dark:border-slate-800">
              <Button size="sm" variant="outline" onClick={resetFilters} className="h-8 text-[10px] font-bold">Reset Filters</Button>
              <Button size="sm" onClick={applyFilters} className="bg-blue-600 hover:bg-blue-700 text-white h-8 text-[10px] font-bold"><RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", loading && "animate-spin")} />Apply Filters</Button>
            </div>
          </div>
        ) : null}

        {error ? <div className="rounded border border-red-300 bg-red-50 px-4 py-3 text-xs text-red-900 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-200">{error}</div> : null}
        
        {highlightCreated && selectedRow ? (
          <div className="rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-200 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <div>
              <span className="font-bold">Account Created Successfully!</span>
              <span className="block mt-0.5">Account <span className="font-mono font-black">{selectedRow.accountCode}</span> in {selectedRow.countryName} has been selected.</span>
            </div>
          </div>
        ) : null}

        <div className={cn("grid gap-6 items-start", showProfilePanel ? "xl:grid-cols-[minmax(0,1fr)_420px]" : "xl:grid-cols-1")}>
          <div className="overflow-hidden rounded border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
            <div className="overflow-auto max-h-[calc(100vh-320px)] min-h-[350px]">
              <table className="min-w-[1400px] w-full text-xs text-left border-collapse">
                <thead className="sticky top-0 z-10 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
                  <tr>
                    {[
                      { label: "Master Reference & Account Overview", span: 7, cls: "bg-slate-50 dark:bg-slate-900/40 text-slate-700 dark:text-slate-300 border-t-2 border-t-slate-400" },
                      { label: "Contact Details", span: 1, cls: "bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-400 border-t-2 border-t-emerald-500" },
                      { label: "Branch & Location", span: 3, cls: "bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-800 dark:text-indigo-400 border-t-2 border-t-indigo-500" },
                      { label: "Financial Information", span: 4, cls: "bg-blue-50/50 dark:bg-blue-950/20 text-blue-800 dark:text-blue-400 border-t-2 border-t-blue-500" },
                      { label: "Start & Status", span: 2, cls: "bg-amber-50/50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-400 border-t-2 border-t-amber-500" },
                      { label: "Actions", span: 1, cls: "bg-slate-100 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400 border-t-2 border-t-slate-300" },
                    ].map((group) => (
                      <th
                        key={group.label}
                        colSpan={group.span}
                        className={`${group.cls} px-3 py-2 text-[10px] font-extrabold uppercase tracking-widest text-center border-r border-slate-200 dark:border-slate-800 last:border-r-0`}
                      >
                        {group.label}
                      </th>
                    ))}
                  </tr>
                  <tr className="bg-white dark:bg-slate-950 text-[9px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 border-b-2 border-slate-200 dark:border-slate-800">
                    {[
                      "MANUAL REF", "ACCOUNT CODE", "ACCOUNT NAME", "COMPANY NAME",
                      "BANK NAME", "WAREHOUSE NAME", "OWNER NAME", "CONTACTS",
                      "COUNTRY", "MAIN BRANCH", "CITY BRANCH", "CURRENCY",
                      "DEBIT", "CREDIT", "BALANCE", "START DATE",
                      "STATUS", "ACTIONS"
                    ].map((header, i) => (
                      <th key={i} className="px-3 py-3 border-r border-slate-100 dark:border-slate-800/50 last:border-r-0 whitespace-nowrap text-center align-middle">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                  {loading ? (
                    <tr>
                      <td colSpan={18} className="px-5 py-10 text-center text-sm text-slate-500 font-medium">
                        <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-blue-500" />
                        Loading accounts registry...
                      </td>
                    </tr>
                  ) : sortedRows.length ? (
                    sortedRows.map((row) => {
                      const active = row.accountId === selectedRow?.accountId;
                      const highlighted = row.accountId === highlightedAccountId;
                      
                      return (
                        <tr
                          key={row.accountId}
                          onClick={() => setSelectedAccountId(row.accountId)}
                          className={cn(
                            "cursor-pointer transition hover:bg-blue-50/30 dark:hover:bg-blue-950/10 text-center text-[10px] font-semibold text-slate-800 dark:text-slate-350",
                            active && "bg-blue-50/40 dark:bg-blue-950/10",
                            highlighted && "bg-emerald-50 dark:bg-emerald-950/30"
                          )}
                        >
                          <td className="px-3 py-2 border-r border-slate-100 dark:border-slate-850 font-mono text-slate-600 dark:text-slate-400">{row.manualReferenceNumber || "-"}</td>
                          <td className="px-3 py-2 border-r border-slate-100 dark:border-slate-850 font-mono font-bold text-blue-700 dark:text-blue-400">{row.accountCode}</td>
                          <td className="px-3 py-2 border-r border-slate-100 dark:border-slate-850 font-bold text-left">{row.accountName}</td>
                          <td className="px-3 py-2 border-r border-slate-100 dark:border-slate-850 font-medium">{row.companyName || "-"}</td>
                          <td className="px-3 py-2 border-r border-slate-100 dark:border-slate-850 font-medium text-emerald-700 dark:text-emerald-400">{row.bankName || "-"}</td>
                          <td className="px-3 py-2 border-r border-slate-100 dark:border-slate-850 font-medium text-amber-700 dark:text-amber-400">{row.warehouseName || "-"}</td>
                          <td className="px-3 py-2 border-r border-slate-100 dark:border-slate-850 font-medium">{row.ownerName || row.companyOwner || "-"}</td>
                          <td className="px-3 py-2 border-r border-slate-100 dark:border-slate-850 text-center align-middle">
                            <ContactIconPopup row={row} />
                          </td>
                          <td className="px-3 py-2 border-r border-slate-100 dark:border-slate-850">{row.countryName}</td>
                          <td className="px-3 py-2 border-r border-slate-100 dark:border-slate-850">{row.mainBranchName ?? (row.branchType === "Main Branch" ? row.branchName : "-")}</td>
                          <td className="px-3 py-2 border-r border-slate-100 dark:border-slate-850">{row.cityBranchName ?? (row.branchType === "City Branch" ? row.branchName : "-")}</td>
                          <td className="px-3 py-2 border-r border-slate-100 dark:border-slate-850 font-black">{row.currency}</td>
                          <td className="px-3 py-2 border-r border-slate-100 dark:border-slate-850 font-mono text-rose-600 dark:text-rose-400 text-right">{fmtNumber(row.debitTotal)}</td>
                          <td className="px-3 py-2 border-r border-slate-100 dark:border-slate-850 font-mono text-emerald-600 dark:text-emerald-400 text-right">{fmtNumber(row.creditTotal)}</td>
                          <td className={cn("px-3 py-2 border-r border-slate-100 dark:border-slate-850 font-mono font-black text-right", rowTone(row.currentBalance))}>{fmtNumber(row.currentBalance)}</td>
                          <td className="px-3 py-2 border-r border-slate-100 dark:border-slate-850 font-mono text-[9px] text-slate-500">{row.createdAt ? row.createdAt.slice(0, 10) : "-"}</td>
                          <td className="px-3 py-2 border-r border-slate-100 dark:border-slate-850">
                            <span className={cn("inline-block px-1.5 py-0.5 rounded text-[8px] font-black uppercase text-white tracking-widest", row.status === "active" ? "bg-emerald-600" : "bg-slate-500")}>
                              {row.status}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center align-middle">
                            <AccountRowActionsMenu
                              row={row}
                              disabled={loadingDeleting}
                              onView={() => {
                                if (showProfilePanel) setSelectedAccountId(row.accountId);
                                else router.push(`/dashboard/accounts/view?accountId=${row.accountId}` as Route);
                              }}
                              onEdit={() => router.push(`/dashboard/accounts/setup?accountId=${row.accountId}` as Route)}
                              onOpenAccount={() => {
                                if (showProfilePanel) setSelectedAccountId(row.accountId);
                                else router.push(`/dashboard/accounts/view?accountId=${row.accountId}` as Route);
                              }}
                              onOpenLedger={() => {
                                if (row.ledgerId) router.push(`/dashboard/ledger/general-report?ledgerId=${row.ledgerId}` as Route);
                              }}
                              onViewJournal={() => setSelectedAccountId(row.accountId)}
                              onPrint={() => window.print()}
                              onPdf={() => window.print()}
                              onExcel={() => exportCsv("selected")}
                              onDelete={canDelete ? () => void deleteAccount(row) : undefined}
                            />
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={18} className="px-5 py-10 text-center text-sm text-slate-500">
                        No accounts match the selected filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {showProfilePanel && (
            <div className="w-full shrink-0 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg flex flex-col h-fit overflow-y-auto xl:sticky xl:top-24 max-h-[calc(100vh-140px)]">
              <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-10 shadow-sm">
                <h3 className="text-base font-black text-[#0f2942] dark:text-white uppercase tracking-widest flex items-center gap-2">
                  <FileCheck2 className="h-5 w-5 text-blue-600" />
                  Account Verification
                </h3>
                <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider font-bold">Review account details and balances</p>
              </div>

              <div className="p-5 space-y-6 flex-1 bg-slate-50/50 dark:bg-slate-900/20">
                {selectedRow ? (
                  <>
                    <div className="space-y-3">
                      <div className="bg-slate-50 dark:bg-slate-900/40 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                        <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5"><Building2 className="h-3 w-3" /> Account Info</div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="col-span-2"><span className="text-slate-400 block text-[9px] uppercase">Account Name</span><span className="font-bold truncate">{selectedRow.accountName}</span></div>
                          <div><span className="text-slate-400 block text-[9px] uppercase">Code</span><span className="font-bold font-mono text-blue-700 dark:text-blue-400">{selectedRow.accountCode}</span></div>
                          <div><span className="text-slate-400 block text-[9px] uppercase">Category</span><span className="font-bold uppercase text-[10px]">{selectedRow.accountCategory}</span></div>
                          <div><span className="text-slate-400 block text-[9px] uppercase">Created</span><span className="font-bold font-mono text-[10px]">{fmtDateTime(selectedRow.createdAt)}</span></div>
                          <div><span className="text-slate-400 block text-[9px] uppercase">Status</span><span className={cn("font-black uppercase text-[10px]", selectedRow.status === 'active' ? 'text-emerald-600' : 'text-slate-500')}>{selectedRow.status}</span></div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-slate-50 dark:bg-slate-900/40 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                          <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5"><MapPin className="h-3 w-3" /> Location</div>
                          <div><span className="text-slate-400 block text-[9px] uppercase">Country</span><span className="font-bold text-xs truncate block">{selectedRow.countryName}</span></div>
                          <div className="mt-1"><span className="text-slate-400 block text-[9px] uppercase">Branch</span><span className="font-bold text-xs">{selectedRow.branchName}</span></div>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-900/40 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                          <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">Workspace</div>
                          <div><span className="text-slate-400 block text-[9px] uppercase">Company</span><span className="font-bold text-[10px] truncate block leading-tight">{data?.workspace.companyName ?? "-"}</span></div>
                          <div className="mt-1"><span className="text-slate-400 block text-[9px] uppercase">Owner</span><span className="font-bold text-[10px] leading-tight">{data?.workspace.companyOwner ?? "-"}</span></div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-blue-50/50 dark:bg-blue-950/20 p-3 rounded-lg border border-blue-100 dark:border-blue-900/50">
                      <div className="text-[10px] font-black uppercase tracking-wider text-blue-700 dark:text-blue-400 mb-2 flex items-center gap-1.5"><Landmark className="h-3 w-3" /> Financial Summary</div>
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between items-center border-b border-blue-100 dark:border-blue-900/30 pb-1">
                          <span className="text-slate-500 font-bold uppercase text-[9px]">Opening Balance</span>
                          <span className="font-mono font-bold text-[11px] text-slate-700 dark:text-slate-300">{fmtNumber(selectedRow.openingBalance)} {selectedRow.currency}</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-blue-100 dark:border-blue-900/30 pb-1">
                          <span className="text-rose-600 font-bold uppercase text-[9px]">Total Debit</span>
                          <span className="font-mono font-bold text-[11px] text-rose-700 dark:text-rose-400">{fmtNumber(selectedRow.debitTotal)} {selectedRow.currency}</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-blue-100 dark:border-blue-900/30 pb-1">
                          <span className="text-emerald-600 font-bold uppercase text-[9px]">Total Credit</span>
                          <span className="font-mono font-bold text-[11px] text-emerald-700 dark:text-emerald-400">{fmtNumber(selectedRow.creditTotal)} {selectedRow.currency}</span>
                        </div>
                        <div className="flex justify-between items-center pt-1">
                          <span className="text-blue-700 dark:text-blue-400 font-black uppercase text-[10px]">Current Balance</span>
                          <span className={cn("font-mono font-black text-sm", rowTone(selectedRow.currentBalance))}>{fmtNumber(selectedRow.currentBalance)} {selectedRow.currency}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2">
                      <Button type="button" variant="outline" className="flex-1 h-9 font-bold text-[10px] uppercase tracking-wider shadow-sm" onClick={() => router.push(`/dashboard/accounts/setup?accountId=${selectedRow.accountId}` as Route)}>
                        <PencilLine className="h-3.5 w-3.5 mr-1.5" /> Edit Account
                      </Button>
                      <Button type="button" variant="outline" className="flex-1 h-9 font-bold text-[10px] uppercase tracking-wider shadow-sm" onClick={() => window.print()}>
                        <Printer className="h-3.5 w-3.5 mr-1.5" /> Print Info
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                    <FileCheck2 className="h-12 w-12 mb-3 opacity-20" />
                    <p className="text-xs font-bold uppercase tracking-widest text-center">No Account Selected</p>
                    <p className="text-[10px] text-center mt-1 w-2/3">Click on any account in the registry to view its details here.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function PreviewRow({ label, value, tone }: { label: string; value?: string | null; tone?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-dashed py-1.5 text-sm last:border-b-0">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className={cn("text-right font-semibold", tone ?? "text-foreground")}>{value || "-"}</span>
    </div>
  );
}
