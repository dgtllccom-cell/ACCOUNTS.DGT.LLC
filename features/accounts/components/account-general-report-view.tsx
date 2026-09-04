"use client";

import { DownloadActionIcon, PdfActionIcon } from "@/components/ui/download-action-icon";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Download, Expand, Eye, FileSpreadsheet, FileText, MoreVertical, PencilLine, Printer, Search, Trash2, CalendarDays, RefreshCw, SlidersHorizontal, Landmark, CheckCircle2, ChevronDown, ChevronRight, PackageCheck, FileCheck2, Building, Building2, MapPin, Phone, MessageCircle, Mail, Plus, X, Globe, User, Coins, DollarSign, Wallet, Truck } from "lucide-react";
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
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { ErpDatePicker } from "@/components/ui/erp-date-picker";
import { translateHeader } from "@/lib/i18n/table-headers";
import { t } from "@/lib/i18n/ui";
import { openA4ReportWindow } from "@/lib/reports/open-a4-report-window";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchSelect, type SearchSelectOption } from "@/components/ui/search-select";
import { SimpleModal } from "@/components/ui/simple-modal";
import { ReportFilterMenu } from "@/components/reports/report-filter-menu";
import { ReportPageHeader } from "@/components/reports/report-page-header";
import { ReportTd, ReportTh } from "@/components/reports/report-primitives";
import { cn } from "@/lib/utils";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { Th } from "@/components/ui/translated-th";
import { localizeTerm, transliterateProperNoun } from "@/lib/i18n/transliteration";

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

  const mobile = row.mobile || row.contacts?.find(c => c.type?.toLowerCase().includes("mobile") || c.type?.toLowerCase().includes("phone"))?.value || "";
  const whatsapp = row.whatsapp || row.contacts?.find(c => c.type?.toLowerCase().includes("whatsapp") || c.type?.toLowerCase().includes("wa"))?.value || mobile;
  const email = row.email || row.contacts?.find(c => c.type?.toLowerCase().includes("email"))?.value || "";

  return (
    <div className="relative inline-flex items-center justify-center gap-1" dir="ltr" onClick={(e) => e.stopPropagation()}>
      {mobile && mobile !== "-" ? (
        <a
          href={`tel:${mobile.replace(/[^0-9+]/g, "")}`}
          title={`Call: ${mobile}`}
          className="h-6 w-6 rounded-md border border-blue-200 bg-blue-50/80 text-blue-600 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-400 flex items-center justify-center hover:scale-105 hover:bg-blue-100 transition shadow-2xs cursor-pointer"
        >
          <Phone className="h-2.5 w-2.5" />
        </a>
      ) : null}

      {whatsapp && whatsapp !== "-" ? (
        <a
          href={`https://wa.me/${whatsapp.replace(/[^0-9]/g, "")}`}
          target="_blank"
          rel="noreferrer"
          title={`WhatsApp: ${whatsapp}`}
          className="h-6 w-6 rounded-md border border-emerald-200 bg-emerald-50/80 text-emerald-600 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-400 flex items-center justify-center hover:scale-105 hover:bg-emerald-100 transition shadow-2xs cursor-pointer"
        >
          <MessageCircle className="h-2.5 w-2.5" />
        </a>
      ) : null}

      {email && email !== "-" ? (
        <a
          href={`mailto:${email}`}
          title={`Email: ${email}`}
          className="h-6 w-6 rounded-md border border-amber-200 bg-amber-50/80 text-amber-600 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-400 flex items-center justify-center hover:scale-105 hover:bg-amber-100 transition shadow-2xs cursor-pointer"
        >
          <Mail className="h-2.5 w-2.5" />
        </a>
      ) : null}

      {!mobile && !whatsapp && !email && (
        <span className="text-slate-400 text-[10px]">—</span>
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
  formatValue,
  lang = "en"
}: {
  title: string;
  rows: Array<{ label: string; value: number }>;
  formatValue?: (value: number) => string;
  lang?: SupportedLanguage;
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
          <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">{t(lang, "acct.agrv_no_chart_data", "No chart data available.")}</div>
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
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
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
          {item("PDF", <PdfActionIcon className="h-4 w-4" aria-hidden />, onPdf)}
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
  lang: initialLang,
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
  const lang = useActiveLanguage() || initialLang;
  const tr = (label: string) => translateHeader(lang, label);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [loadingDeleting, setLoadingDeleting] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const datePickerRef = useRef<HTMLDivElement | null>(null);
  const [expandedView, setExpandedView] = useState(false);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [data, setData] = useState<AccountGeneralReportResponse | null>(null);
  const [selectedCountryForSummary, setSelectedCountryForSummary] = useState<string | null>(null);
  const [selectedUserBranchOnly, setSelectedUserBranchOnly] = useState<boolean>(false);
  const [expandedCountries, setExpandedCountries] = useState<Record<string, boolean>>({});
  const [showAllCountries, setShowAllCountries] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [draftQuery, setDraftQuery] = useState("");
  const [draftAccountId, setDraftAccountId] = useState("all");
  const [draftCountryName, setDraftCountryName] = useState("all");
  const [draftBranchCode, setDraftBranchCode] = useState("all");
  const [draftStatus, setDraftStatus] = useState("all");
  const [draftCategory, setDraftCategory] = useState("all");
  const [draftFromDate, setDraftFromDate] = useState("");
  const [draftToDate, setDraftToDate] = useState("");
  const [query, setQuery] = useState("");
  const [accountId, setAccountId] = useState("all");
  const [countryName, setCountryName] = useState("all");
  const [branchCode, setBranchCode] = useState("all");
  const [status, setStatus] = useState("all");
  const [category, setCategory] = useState("all");
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

  // Close date picker on outside click
  useEffect(() => {
    if (!datePickerOpen) return;
    function onMouseDown(e: MouseEvent) {
      if (datePickerRef.current && !datePickerRef.current.contains(e.target as Node)) {
        setDatePickerOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [datePickerOpen]);

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
        const res = await apiGet<AccountGeneralReportResponse>("/api/erp/accounting/reports/accounts/general?limit=2000");
        if (!cancelled) {
          setData(res);
          if (initialAccountId) setSelectedAccountId(initialAccountId);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : t(lang, "acct.agrv_failed_load_account_report", "Failed to load account report"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initialAccountId]);

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
    return [{ value: "all", label: tr("ALL COUNTRIES"), keywords: "all countries" }, ...map.values()];
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
    return [{ value: "all", label: tr("ALL BRANCHES"), keywords: "all branches" }, ...map.values()];
  }, [rows, draftCountryName]);

  // Sync draft states when active states change
  useEffect(() => {
    setDraftCountryName(countryName);
  }, [countryName]);

  useEffect(() => {
    setDraftBranchCode(branchCode);
  }, [branchCode]);

  useEffect(() => {
    setDraftCategory(category);
  }, [category]);

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
        if (category === "all") return true;
        const cat = (row.accountCategory || "").toLowerCase();
        const sub = (row.subType || "").toLowerCase();
        const target = category.toLowerCase();
        return cat.includes(target) || sub.includes(target);
      })
      .filter((row) => {
        if (fromDate && row.createdAt.slice(0, 10) < fromDate) return false;
        if (toDate && row.createdAt.slice(0, 10) > toDate) return false;
        if (!q) return true;
        return safeRowText(row).includes(q);
      });
  }, [accountId, branchCode, category, fromDate, query, scopedRows, status, toDate]);

  const userBranchRows = useMemo(() => {
    const cityBranchIds = session?.scopes?.cityBranchIds || [];
    const countryBranchIds = session?.scopes?.countryBranchIds || [];
    
    let matched = allFilteredRows.filter(row => {
      if (row.cityId && cityBranchIds.includes(row.cityId)) return true;
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

    const standardHubs = [
      { name: "United Arab Emirates", code: "AE", currency: "AED" },
      { name: "Pakistan", code: "PK", currency: "PKR" },
      { name: "Afghanistan", code: "AF", currency: "AFN" },
      { name: "India", code: "IN", currency: "INR" },
      { name: "China", code: "CN", currency: "USD" },
    ];

    standardHubs.forEach(hub => {
      groups[hub.name] = {
        countryName: hub.name,
        countryCode: hub.code,
        totalAccounts: 0,
        activeAccounts: 0,
        debitTotal: 0,
        creditTotal: 0,
        netBalance: 0,
        currency: hub.currency,
        branches: {}
      };
    });

    allFilteredRows.forEach(row => {
      const country = row.countryName || t(lang, "acct.agrv_unknown_country", "Unknown Country");
      const branch = row.branchName || t(lang, "report.scope_main_branch", "Main Branch");
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
    })).sort((a, b) => {
      const order = ["United Arab Emirates", "Pakistan", "Afghanistan", "India", "China"];
      const idxA = order.indexOf(a.countryName);
      const idxB = order.indexOf(b.countryName);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.countryName.localeCompare(b.countryName);
    });
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

  // Centralized A4 Account Master Profile (real row data + dynamic branding).
  const printAccountRow = async (row: AccountGeneralReportRow | null) => {
    if (!row) return;
    const { openMasterProfile } = await import("@/lib/reports/master-profiles");
    void openMasterProfile({
      entity: "account",
      lang: lang as never,
      autoPrint: true,
      scope: { countryId: row.countryId, countryName: row.countryName, branchName: row.cityBranchName || row.branchName },
      record: {
        accountId: row.accountId, accountCode: row.accountCode, accountName: row.accountName,
        accountCategory: row.accountCategory, subType: row.subType, status: row.status,
        currency: row.currency, createdAt: row.createdAt, manualReferenceNumber: row.manualReferenceNumber,
        customerNumber: row.customerNumber, countrySerialNumber: row.countrySerialNumber,
        branchSerialNumber: row.branchSerialNumber, countryName: row.countryName, countryId: row.countryId,
        mainBranchName: row.mainBranchName, cityBranchName: row.cityBranchName, branchName: row.branchName,
        branchCode: row.branchCode, cityName: row.cityName, companyName: row.companyName,
        companyCode: row.companyCode, companyOwner: row.companyOwner,
        openingBalance: row.openingBalance, debitTotal: row.debitTotal, creditTotal: row.creditTotal,
        currentBalance: row.currentBalance, linkedLedgerCount: row.linkedLedgerCount,
        journalActivityCount: row.journalActivityCount, latestJournalNo: row.latestJournalNo,
        latestActivityAt: row.latestActivityAt, ledgerName: row.ledgerName,
        ledgerStatus: row.ledgerStatus, ledgerCurrency: row.ledgerCurrency,
      } as never,
    });
  };

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
        { label: tr("TOTAL ACCOUNTS"), value: visibleSummary.totalAccounts },
        { label: tr("ASSET ACCOUNTS"), value: visibleSummary.assetAccounts },
        { label: tr("EXPENSE ACCOUNTS"), value: visibleSummary.expenseAccounts },
        { label: tr("INCOME ACCOUNTS"), value: visibleSummary.incomeAccounts },
        { label: tr("LIABILITY ACCOUNTS"), value: visibleSummary.liabilityAccounts }
      ];
    }

    if (dashboardScope === "country") {
      return [
        { label: tr("TOTAL ACCOUNTS"), value: visibleSummary.totalAccounts },
        { label: tr("TOTAL DEBIT"), value: fmtNumber(visibleSummary.debitTotal) },
        { label: tr("TOTAL CREDIT"), value: fmtNumber(visibleSummary.creditTotal) },
        { label: tr("NET BALANCE"), value: fmtNumber(visibleSummary.totalBalance) },
        { label: tr("ACTIVE ACCOUNTS"), value: visibleSummary.activeAccounts }
      ];
    }

    return [
      { label: tr("TOTAL ACCOUNTS"), value: visibleSummary.totalAccounts },
      { label: tr("TOTAL COUNTRIES"), value: visibleSummary.totalCountries },
      { label: tr("TOTAL BRANCHES"), value: visibleSummary.totalBranches },
      { label: tr("TOTAL DEBIT"), value: fmtNumber(visibleSummary.debitTotal) },
      { label: tr("TOTAL CREDIT"), value: fmtNumber(visibleSummary.creditTotal) },
      { label: tr("TOTAL BALANCE (USD)"), value: fmtNumber(visibleSummary.totalBalance) }
    ];
  }, [dashboardScope, visibleSummary]);

  const chartGroups = useMemo(() => {
    if (dashboardScope === "branch") {
      return [
        { title: tr("ACCOUNTS BY CATEGORY"), rows: groupCounts(filteredRows, (row) => row.accountCategory) },
        { title: tr("ACCOUNTS BY CURRENCY"), rows: groupCounts(filteredRows, (row) => row.currency) },
        { title: tr("ACCOUNTS BY STATUS"), rows: groupCounts(filteredRows, (row) => titleCase(row.status)) },
        {
          title: tr("BRANCH FINANCIAL SUMMARY"),
          rows: [
            { label: tr("DEBIT"), value: visibleSummary.debitTotal },
            { label: tr("CREDIT"), value: visibleSummary.creditTotal },
            { label: tr("BALANCE"), value: visibleSummary.totalBalance }
          ],
          formatValue: fmtNumber
        }
      ];
    }

    if (dashboardScope === "country") {
      return [
        { title: tr("MAIN BRANCH-WISE SUMMARY"), rows: groupCounts(filteredRows, (row) => row.mainBranchName ?? row.branchName) },
        { title: tr("CITY BRANCH-WISE SUMMARY"), rows: groupCounts(filteredRows, (row) => row.cityBranchName ?? row.cityName) },
        {
          title: tr("DEBIT / CREDIT SUMMARY"),
          rows: [
            { label: tr("DEBIT"), value: visibleSummary.debitTotal },
            { label: tr("CREDIT"), value: visibleSummary.creditTotal }
          ],
          formatValue: fmtNumber
        },
        {
          title: tr("BALANCE SUMMARY"),
          rows: [{ label: tr("NET BALANCE"), value: visibleSummary.totalBalance }],
          formatValue: fmtNumber
        }
      ];
    }

    return [
      { title: tr("COUNTRY-WISE SUMMARY"), rows: groupSums(filteredRows, (row) => row.countryName, (row) => row.currentBalance), formatValue: fmtNumber },
      { title: tr("CURRENCY-WISE SUMMARY"), rows: groupSums(filteredRows, (row) => row.currency, (row) => row.currentBalance), formatValue: fmtNumber },
      { title: tr("ACCOUNTS BY CATEGORY"), rows: groupCounts(filteredRows, (row) => row.accountCategory) },
      { title: tr("ACCOUNTS BY STATUS"), rows: groupCounts(filteredRows, (row) => titleCase(row.status)) }
    ];
  }, [dashboardScope, filteredRows, visibleSummary.creditTotal, visibleSummary.debitTotal, visibleSummary.totalBalance]);

  const canDelete = Boolean(session?.permissions.includes("accounts:delete") || session?.roles.includes("super_admin"));

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (query.trim()) count++;
    if (countryName !== "all") count++;
    if (branchCode !== "all") count++;
    if (status !== "all") count++;
    if (category !== "all") count++;
    if (fromDate) count++;
    if (toDate) count++;
    return count;
  }, [query, countryName, branchCode, status, category, fromDate, toDate]);

  function resetFilters() {
    setDraftQuery("");
    setDraftAccountId("all");
    setDraftCountryName("all");
    setDraftBranchCode("all");
    setDraftStatus("all");
    setDraftCategory("all");
    setDraftFromDate("");
    setDraftToDate("");
    setQuery("");
    setAccountId("all");
    setCountryName("all");
    setBranchCode("all");
    setStatus("all");
    setCategory("all");
    setFromDate("");
    setToDate("");
    setSelectedCountryForSummary(null);
    setSelectedUserBranchOnly(false);
    setExpandedCountries({});
    setFiltersOpen(false);
    setDatePickerOpen(false);
  }

  function applyFilters() {
    setQuery(draftQuery);
    setAccountId(draftAccountId);
    setCountryName(draftCountryName);
    setBranchCode(draftBranchCode);
    setStatus(draftStatus);
    setCategory(draftCategory);
    setFromDate(draftFromDate);
    setToDate(draftToDate);
    setSelectedCountryForSummary(null);
    setSelectedUserBranchOnly(false);
    setExpandedCountries({});
    setFiltersOpen(false);
  }

  function openPrint(autoPrint: boolean) {
    const selectedRow = rows.find((r) => r.accountId === selectedAccountId) ?? null;
    const activeBranchName = branchCode !== "all" ? branchCode : tr(session?.scopes?.isSuperAdmin ? "GLOBAL ADMIN" : session?.roles?.[0] ?? "MAIN BRANCH");
    openA4ReportWindow({
      title: t(lang, "acct.agrv_account_register_report", "Account Register Report"),
      subtitle: `${t(lang, "acct.agrv_account_master_registry_search", "Account Master Registry & Search Report")} - Generated ${new Date().toLocaleString()}`,
      rows: [
        { label: tr("REPORT SCOPE"), value: dashboardScope === "super_admin" ? "SUPER ADMIN" : dashboardScope === "country" ? tr("COUNTRY SCOPE") : tr("BRANCH SCOPE") },
        { label: `${tr("BRANCH NAME")} ${tr("DETAILS")}`, value: activeBranchName },
        { label: tr("TOTAL ACCOUNTS"), value: `${visibleSummary.totalAccounts.toLocaleString()} (${visibleSummary.activeAccounts} ${tr("ACTIVE")})` },
        { label: `${tr("TOTAL DEBIT")} (DR)`, value: fmtNumber(visibleSummary.debitTotal) },
        { label: `${tr("TOTAL CREDIT")} (CR)`, value: fmtNumber(visibleSummary.creditTotal) },
        { label: tr("NET BALANCE"), value: fmtNumber(visibleSummary.totalBalance) },
        { label: tr("SELECTED ACCOUNT"), value: selectedRow ? `${selectedRow.accountName} (${selectedRow.accountCode})` : t(lang, "purchase.card_none_label", "None") },
        { label: tr("COMPANY NAME"), value: selectedRow?.companyName || "-" },
        { label: tr("BANK NAME"), value: selectedRow?.bankName || "-" },
        { label: tr("WAREHOUSE NAME"), value: selectedRow?.warehouseName || "-" },
        { label: tr("OWNER NAME"), value: selectedRow?.ownerName || "-" },
        { label: tr("COUNTRY"), value: selectedRow?.countryName || "-" }
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
        "Company / Owner Name",
        "Journal Code",
        "Branch",
        "Country",
        "City",
        "Branch Type / Scope",
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
        row.companyName || row.ownerName || "-",
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
    downloadTextFile(`accounts-general-register-export_${new Date().toISOString().slice(0, 10)}.csv`, csv, "text/csv");
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
        <h1 className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight">{tr(pageTitle)}</h1>
        <p className="text-xs text-slate-500 mt-0.5 dark:text-slate-400">{tr(subtitle ?? "Enterprise Registry & Financial Ledger Details")}</p>
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
        <option value="super_admin" disabled={!isSuperAdmin}>{tr("SUPER ADMIN")}</option>
        <option value="country">{tr("COUNTRY SCOPE")}</option>
        <option value="branch">{tr("BRANCH SCOPE")}</option>
      </select>

      {/* Search Input */}
      <div className="relative min-w-[200px]">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-450" />
        <input
          value={draftQuery}
          onChange={(e) => { setDraftQuery(e.target.value); setQuery(e.target.value); }}
          placeholder={tr("Search account, name, branch...")}
          className="h-9 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 shadow-sm"
        />
      </div>

      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => setFiltersOpen(true)}
        className={cn(
          "h-9 rounded-xl font-bold text-xs shadow-sm transition-all flex items-center gap-1.5 cursor-pointer",
          activeFilterCount > 0
            ? "bg-indigo-50 border-indigo-300 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:border-indigo-700 dark:text-indigo-300"
            : "border-slate-200 hover:bg-slate-50 dark:border-slate-800"
        )}
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
        <span>{tr("FILTER")}</span>
        {activeFilterCount > 0 && (
          <span className="ml-1 inline-flex h-5 min-w-[18px] items-center justify-center rounded-full bg-indigo-600 px-1 text-[10px] font-extrabold text-white">
            {activeFilterCount}
          </span>
        )}
      </Button>

      <Button type="button" size="sm" variant="outline" onClick={resetFilters} className="h-9 rounded-xl border-slate-200 font-bold text-xs shadow-sm cursor-pointer hover:bg-slate-50">
        <RefreshCw className={loading ? "mr-1.5 h-3.5 w-3.5 animate-spin" : "mr-1.5 h-3.5 w-3.5"} /> {tr("RESET")}
      </Button>

      {/* Universal date-range picker */}
      <div className="w-[15rem]">
        <ErpDatePicker
          mode="range"
          lang={lang}
          size="sm"
          value={{ from: fromDate || null, to: toDate || null }}
          onApply={(v) => {
            setFromDate(v.from ?? "");
            setToDate(v.to ?? "");
            setDraftFromDate(v.from ?? "");
            setDraftToDate(v.to ?? "");
          }}
        />
      </div>

      <Button
        type="button"
        size="sm"
        onClick={() => router.push("/dashboard/accounts/setup")}
        className="h-9 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm px-4 gap-1.5 shrink-0 cursor-pointer"
      >
        <Plus className="h-3.5 w-3.5" /> {tr("NEW ACCOUNT")}
      </Button>

      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => exportCsv("filtered")}
        className="h-9 rounded-xl border-slate-200 font-bold text-xs shadow-sm gap-1.5 cursor-pointer text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
      >
        <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" /> {tr("EXPORT EXCEL / CSV")}
      </Button>

      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => openPrint(true)}
        className="h-9 rounded-xl border-slate-200 font-bold text-xs shadow-sm gap-1.5 cursor-pointer"
      >
        <Printer className="h-3.5 w-3.5" /> {tr("PRINT")}
      </Button>

      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => openPrint(false)}
        className="h-9 rounded-xl border-slate-200 font-bold text-xs shadow-sm gap-1.5 cursor-pointer"
      >
        <Download className="h-3.5 w-3.5" /> {tr("EXPORT PDF")}
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

      {/* 5 Primary Reports & Scopes Navigation Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Report 1: User & Branch Reports (Position 1 / Leftmost) */}
        <button
          type="button"
          onClick={() => {
            setDashboardScope("branch");
            setSelectedUserBranchOnly(true);
          }}
          className={cn(
            "flex items-center justify-between p-3.5 rounded-xl border text-left transition-all cursor-pointer shadow-xs",
            dashboardScope === "branch" && selectedUserBranchOnly
              ? "bg-blue-600 text-white border-blue-600 shadow-md ring-2 ring-blue-500/20"
              : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-blue-300"
          )}
        >
          <div className="flex items-center gap-3">
            <div className={cn("p-2 rounded-lg", dashboardScope === "branch" && selectedUserBranchOnly ? "bg-white/20 text-white" : "bg-blue-50 text-blue-600 dark:bg-blue-950/40")}>
              <User className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[11px] font-black uppercase tracking-wider">
                {tr("USER & BRANCH REPORTS")}
              </div>
              <div className={cn("text-[10px] font-semibold mt-0.5", dashboardScope === "branch" && selectedUserBranchOnly ? "text-blue-100" : "text-slate-500")}>
                {tr("Active Operator & Local Branch")}
              </div>
            </div>
          </div>
          <ChevronRight className={cn("h-4 w-4 shrink-0", dashboardScope === "branch" && selectedUserBranchOnly ? "text-white" : "text-slate-400")} />
        </button>

        {/* Report 2: Super Admin Reports */}
        <button
          type="button"
          onClick={() => {
            setDashboardScope("super_admin");
            setSelectedUserBranchOnly(false);
            setCountryName("all");
            setBranchCode("all");
          }}
          className={cn(
            "flex items-center justify-between p-3.5 rounded-xl border text-left transition-all cursor-pointer shadow-xs",
            dashboardScope === "super_admin" && !selectedUserBranchOnly
              ? "bg-indigo-600 text-white border-indigo-600 shadow-md ring-2 ring-indigo-500/20"
              : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-indigo-300"
          )}
        >
          <div className="flex items-center gap-3">
            <div className={cn("p-2 rounded-lg", dashboardScope === "super_admin" && !selectedUserBranchOnly ? "bg-white/20 text-white" : "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40")}>
              <Landmark className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[11px] font-black uppercase tracking-wider">
                {tr("SUPER ADMIN REPORTS")}
              </div>
              <div className={cn("text-[10px] font-semibold mt-0.5", dashboardScope === "super_admin" && !selectedUserBranchOnly ? "text-indigo-100" : "text-slate-500")}>
                {tr("Multi-Country & Global Capital")}
              </div>
            </div>
          </div>
          <ChevronRight className={cn("h-4 w-4 shrink-0", dashboardScope === "super_admin" && !selectedUserBranchOnly ? "text-white" : "text-slate-400")} />
        </button>

        {/* Report 3: Country Reports */}
        <button
          type="button"
          onClick={() => {
            setDashboardScope("country");
            setSelectedUserBranchOnly(false);
          }}
          className={cn(
            "flex items-center justify-between p-3.5 rounded-xl border text-left transition-all cursor-pointer shadow-xs",
            dashboardScope === "country" && !selectedUserBranchOnly
              ? "bg-emerald-600 text-white border-emerald-600 shadow-md ring-2 ring-emerald-500/20"
              : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-emerald-300"
          )}
        >
          <div className="flex items-center gap-3">
            <div className={cn("p-2 rounded-lg", dashboardScope === "country" && !selectedUserBranchOnly ? "bg-white/20 text-white" : "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40")}>
              <Globe className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[11px] font-black uppercase tracking-wider">
                {tr("COUNTRY REPORTS")}
              </div>
              <div className={cn("text-[10px] font-semibold mt-0.5", dashboardScope === "country" && !selectedUserBranchOnly ? "text-emerald-100" : "text-slate-500")}>
                {tr("National & Regional Hubs")}
              </div>
            </div>
          </div>
          <ChevronRight className={cn("h-4 w-4 shrink-0", dashboardScope === "country" && !selectedUserBranchOnly ? "text-white" : "text-slate-400")} />
        </button>

        {/* Report 4: Branch Reports */}
        <button
          type="button"
          onClick={() => {
            setDashboardScope("branch");
            setSelectedUserBranchOnly(false);
          }}
          className={cn(
            "flex items-center justify-between p-3.5 rounded-xl border text-left transition-all cursor-pointer shadow-xs",
            dashboardScope === "branch" && !selectedUserBranchOnly
              ? "bg-purple-600 text-white border-purple-600 shadow-md ring-2 ring-purple-500/20"
              : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-purple-300"
          )}
        >
          <div className="flex items-center gap-3">
            <div className={cn("p-2 rounded-lg", dashboardScope === "branch" && !selectedUserBranchOnly ? "bg-white/20 text-white" : "bg-purple-50 text-purple-600 dark:bg-purple-950/40")}>
              <Building className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[11px] font-black uppercase tracking-wider">
                {tr("BRANCH REPORTS")}
              </div>
              <div className={cn("text-[10px] font-semibold mt-0.5", dashboardScope === "branch" && !selectedUserBranchOnly ? "text-purple-100" : "text-slate-500")}>
                {tr("Local Branch Ledgers")}
              </div>
            </div>
          </div>
          <ChevronRight className={cn("h-4 w-4 shrink-0", dashboardScope === "branch" && !selectedUserBranchOnly ? "text-white" : "text-slate-400")} />
        </button>

        {/* Report 5: Shipping & Clearing */}
        <button
          type="button"
          onClick={() => {
            setDraftQuery("shipping");
            setQuery("shipping");
          }}
          className={cn(
            "flex items-center justify-between p-3.5 rounded-xl border text-left transition-all cursor-pointer shadow-xs",
            query.toLowerCase().includes("shipping")
              ? "bg-amber-600 text-white border-amber-600 shadow-md ring-2 ring-amber-500/20"
              : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-amber-300"
          )}
        >
          <div className="flex items-center gap-3">
            <div className={cn("p-2 rounded-lg", query.toLowerCase().includes("shipping") ? "bg-white/20 text-white" : "bg-amber-50 text-amber-600 dark:bg-amber-950/40")}>
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[11px] font-black uppercase tracking-wider">
                {tr("SHIPPING & CLEARING")}
              </div>
              <div className={cn("text-[10px] font-semibold mt-0.5", query.toLowerCase().includes("shipping") ? "text-amber-100" : "text-slate-500")}>
                {tr("Shipping Line & Freight Ledgers")}
              </div>
            </div>
          </div>
          <ChevronRight className={cn("h-4 w-4 shrink-0", query.toLowerCase().includes("shipping") ? "text-white" : "text-slate-400")} />
        </button>
      </div>

      {/* Scope Subtitle Bar */}
      <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400 px-1 pt-1 pb-1">
        <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest">
          <span>{tr("BRANCH SCOPE:")} <strong className="text-blue-600 dark:text-blue-400">{isSuperAdmin ? tr("GLOBAL ADMIN") : tr("BRANCH")}</strong></span>
          <span>{tr("SESSION ROLE:")} <strong className="text-emerald-600 dark:text-emerald-400">{tr(session?.roles?.[0]?.replace(/_/g, " ") || "SUPER ADMIN")}</strong></span>
          <span>{tr("TOTAL LEDGERS:")} <strong className="text-slate-800 dark:text-slate-200">{filteredRows.length}</strong></span>
        </div>
        {selectedCountryForSummary && (
          <button
            type="button"
            onClick={() => {
              setSelectedCountryForSummary(null);
              setCountryName("all");
            }}
            className="text-[10px] font-bold text-rose-600 hover:underline uppercase cursor-pointer"
          >
            Clear Filter ({selectedCountryForSummary})
          </button>
        )}
      </div>

      {/* 4 Unified Executive Summary Panels */}
      <div className="summary-cards-container grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Panel 1: Branch & User Details */}
        <div className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 bg-blue-50/50 dark:bg-blue-900/10">
            <div className="bg-blue-600 p-1 rounded-full text-white">
              <User className="h-3.5 w-3.5" />
            </div>
            <h4 className="text-xs font-black uppercase tracking-wider text-blue-800 dark:text-blue-400">
              {tr("1. BRANCH & USER DETAILS")}
            </h4>
          </div>
          <div className="p-3.5 flex flex-col gap-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400 h-full">
            <div className="flex justify-between items-center">
              <span>{tr("COUNTRY:")}</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {selectedCountryForSummary || (isSuperAdmin ? "All Countries" : (filteredRows[0]?.countryName || "United Arab Emirates"))}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span>{tr("BRANCH NAME:")}</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 uppercase">
                {branchCode !== "all" ? branchCode : (isSuperAdmin ? "ALL BRANCHES" : (filteredRows[0]?.branchName || "MAIN BRANCH"))}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span>{tr("USER ID:")}</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 uppercase text-[9px] font-mono">
                {(session as any)?.userId || (session as any)?.user?.id || (session as any)?.id || "SUPER-ADMIN-001"}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span>{tr("USER NAME:")}</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 uppercase">
                {(session as any)?.fullName || (session as any)?.user?.fullName || (session as any)?.email || "—"}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span>{tr("ROLE:")}</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 uppercase">
                {isSuperAdmin ? "SUPER ADMIN" : ((session as any)?.roles?.[0]?.replace(/_/g, " ") || "BRANCH ADMIN")}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span>{tr("DATE & TIME:")}</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">
                <span suppressHydrationWarning>{new Date().toLocaleDateString(`${lang}-u-ca-gregory-nu-latn`, { calendar: "gregory", numberingSystem: "latn", day: "2-digit", month: "short", year: "numeric" })}, {new Date().toLocaleTimeString(`${lang}-u-nu-latn`, { numberingSystem: "latn", hour: "2-digit", minute: "2-digit", hour12: true })}</span>
              </span>
            </div>
            <div className="flex justify-between items-center mt-auto pt-1 border-t border-slate-100 dark:border-slate-800">
              <span>{tr("STATUS:")}</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded text-[10px]">
                {tr("ACTIVE")}
              </span>
            </div>
          </div>
        </div>

        {/* Panel 2: Global Financial Summary */}
        <div className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 bg-emerald-50/50 dark:bg-emerald-900/10">
            <div className="bg-emerald-600 p-1 rounded-full text-white">
              <Coins className="h-3.5 w-3.5" />
            </div>
            <h4 className="text-xs font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-400">
              {tr("2. GLOBAL FINANCIAL SUMMARY")}
            </h4>
          </div>
          <div className="p-3.5 flex flex-col gap-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400 h-full">
            <div className="flex justify-between items-center">
              <span>{tr("TOTAL ACCOUNTS:")}</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {filteredRows.length} ({filteredRows.filter(r => r.status === "active").length} {tr("Active")})
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span>{tr("TOTAL DEBIT (RECEIVABLES):")}</span>
              <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                AED {fmtNumber(filteredRows.reduce((sum, r) => sum + r.debitTotal, 0))}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span>{tr("TOTAL CREDIT (PAYABLES):")}</span>
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                AED {fmtNumber(filteredRows.reduce((sum, r) => sum + r.creditTotal, 0))}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span>{tr("TOTAL OPENING:")}</span>
              <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                AED {fmtNumber(filteredRows.reduce((sum, r) => sum + r.openingBalance, 0))}
              </span>
            </div>
            <div className="flex justify-between items-center mt-auto border-t border-slate-100 dark:border-slate-800 pt-2">
              <span className="font-bold text-slate-700 dark:text-slate-300">{tr("NET BALANCE:")}</span>
              {(() => {
                const bal = filteredRows.reduce((sum, r) => sum + r.currentBalance, 0);
                return (
                  <span className={cn("font-mono font-black text-xs", bal < 0 ? "text-rose-600 dark:text-rose-400" : "text-blue-600 dark:text-blue-400")}>
                    AED {fmtNumber(bal)}
                  </span>
                );
              })()}
            </div>
          </div>
        </div>

        {/* Panel 3: Account Categories & Status Summary */}
        <div className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 bg-purple-50/50 dark:bg-purple-900/10">
            <div className="bg-purple-600 p-1 rounded-full text-white">
              <FileText className="h-3.5 w-3.5" />
            </div>
            <h4 className="text-xs font-black uppercase tracking-wider text-purple-800 dark:text-purple-400">
              {tr("3. CATEGORIES & LEDGERS")}
            </h4>
          </div>
          <div className="p-3.5 flex flex-col gap-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400 h-full">
            <div className="flex justify-between items-center">
              <span>{tr("TOTAL LEDGERS:")}</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{filteredRows.reduce((sum, r) => sum + r.linkedLedgerCount, 0)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>{tr("ASSET ACCOUNTS:")}</span>
              <span className="font-bold text-blue-600 dark:text-blue-400">{filteredRows.filter(r => (r.accountCategory || "").toLowerCase().includes("asset")).length}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>{tr("LIABILITY ACCOUNTS:")}</span>
              <span className="font-bold text-amber-600 dark:text-amber-400">{filteredRows.filter(r => (r.accountCategory || "").toLowerCase().includes("liability")).length}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>{tr("INCOME / EXPENSES:")}</span>
              <span className="font-bold text-slate-700 dark:text-slate-300">
                {filteredRows.filter(r => (r.accountCategory || "").toLowerCase().includes("income")).length} / {filteredRows.filter(r => (r.accountCategory || "").toLowerCase().includes("expense")).length}
              </span>
            </div>
            <div className="flex justify-between items-center mt-auto border-t border-slate-100 dark:border-slate-800 pt-2">
              <span className="font-bold text-slate-700 dark:text-slate-300">{tr("SYSTEM STATUS:")}</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded text-[10px]">{tr("ALL CLEAR")}</span>
            </div>
          </div>
        </div>

        {/* Panel 4: All Countries Report & Regional Hubs */}
        <div className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 bg-amber-50/50 dark:bg-amber-900/10">
            <div className="flex items-center gap-2">
              <div className="bg-amber-600 p-1 rounded-full text-white">
                <Globe className="h-3.5 w-3.5" />
              </div>
              <h4 className="text-xs font-black uppercase tracking-wider text-amber-800 dark:text-amber-400">
                {tr("4. ALL COUNTRIES REPORT")}
              </h4>
            </div>
            <button
              onClick={() => setShowAllCountries(!showAllCountries)}
              className="text-[11px] font-bold text-amber-700 dark:text-amber-400 hover:underline inline-flex items-center gap-0.5 cursor-pointer"
            >
              {showAllCountries ? "Hide List" : "View List"}
              <ChevronDown className={cn("h-3 w-3 transition-transform", showAllCountries ? "rotate-180" : "")} />
            </button>
          </div>
          <div className="p-3.5 flex flex-col gap-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400 h-full">
            <div className="flex justify-between items-center">
              <span>{tr("TOTAL COUNTRIES:")}</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{countrySummaries.length || 1}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>{tr("TOTAL BRANCHES:")}</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{countrySummaries.reduce((sum, c) => sum + c.branches.length, 0) || 1}</span>
            </div>
            
            {/* Quick Country Pill Selector */}
            <div className="flex flex-wrap gap-1 py-1">
              {countrySummaries.slice(0, 5).map((c) => {
                const isSelected = selectedCountryForSummary === c.countryName;
                return (
                  <button
                    key={c.countryName}
                    type="button"
                    onClick={() => {
                      setSelectedCountryForSummary(isSelected ? null : c.countryName);
                      setCountryName(isSelected ? "all" : c.countryName);
                    }}
                    className={cn(
                      "px-2 py-0.5 rounded-md text-[10px] font-bold transition flex items-center gap-1 cursor-pointer",
                      isSelected
                        ? "bg-amber-600 text-white shadow-xs"
                        : "bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200"
                    )}
                  >
                    <span>{getFlag(c.countryName)}</span>
                    <span>{c.countryName}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex justify-between items-center mt-auto border-t border-slate-100 dark:border-slate-800 pt-2">
              <span className="font-bold text-slate-700 dark:text-slate-300">{tr("COVERAGE:")}</span>
              <span className="font-bold text-blue-600 dark:text-blue-400">{isSuperAdmin ? "GLOBAL NETWORK" : (selectedCountryForSummary || "COUNTRY NETWORK")}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Accordion Expandable Detailed Countries Drawer */}
      {showAllCountries && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/20 p-4 dark:border-amber-900/40 dark:bg-amber-950/10 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between border-b border-amber-200/60 pb-2 dark:border-amber-900/60">
            <h5 className="text-xs font-black uppercase text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
              <Globe className="h-4 w-4 text-amber-600" />
              {t(lang, "ledger.orlv_global_breakdown", "GLOBAL BREAKDOWN BY COUNTRY & BRANCH")}
            </h5>
            <div className="flex items-center gap-3">
              {selectedCountryForSummary && (
                <button
                  type="button"
                  onClick={() => setSelectedCountryForSummary(null)}
                  className="text-[10px] font-bold text-rose-600 hover:underline uppercase cursor-pointer"
                >
                  Clear Selection (Show All Countries)
                </button>
              )}
              <span className="text-[11px] text-slate-500 dark:text-slate-400">{countrySummaries.length} active region(s)</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {countrySummaries.map((c) => {
              const isSelected = selectedCountryForSummary === c.countryName;
              return (
                <details
                  key={c.countryName}
                  open={isSelected}
                  className={cn(
                    "group rounded-lg border bg-white p-3 shadow-xs dark:bg-slate-900 transition-all",
                    isSelected ? "border-blue-500 ring-1 ring-blue-500" : "border-slate-200 dark:border-slate-800"
                  )}
                >
                  <summary
                    className="flex cursor-pointer items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200"
                    onClick={(e) => {
                      if ((e.target as HTMLElement).tagName !== "DETAILS") {
                        setSelectedCountryForSummary(isSelected ? null : c.countryName);
                      }
                    }}
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-base">{getFlag(c.countryName)}</span>
                      <span className="hover:text-blue-600 transition">{c.countryName}</span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                        {c.totalAccounts} {tr("accounts")}
                      </span>
                      {isSelected && (
                        <span className="rounded bg-blue-100 text-blue-700 px-1.5 py-0.5 text-[9px] font-black uppercase">
                          {tr("FILTERED")}
                        </span>
                      )}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className={cn("font-mono text-xs font-bold", c.netBalance < 0 ? "text-rose-600" : "text-blue-600")}>
                        {c.currency} {fmtNumber(c.netBalance)}
                      </span>
                      <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180 text-slate-400" />
                    </div>
                  </summary>

                  <div className="mt-3 space-y-2 border-t border-slate-100 pt-2 text-[11px] dark:border-slate-800">
                    <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-bold">
                      <div className="rounded bg-rose-50 p-1.5 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
                        {tr("DR:")} {fmtNumber(c.debitTotal)}
                      </div>
                      <div className="rounded bg-emerald-50 p-1.5 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                        {tr("CR:")} {fmtNumber(c.creditTotal)}
                      </div>
                      <div className="rounded bg-blue-50 p-1.5 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">
                        {tr("NET:")} {fmtNumber(c.netBalance)}
                      </div>
                    </div>

                    <div className="space-y-1 pt-1">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{tr("Branches")}</div>
                      {c.branches.map((b) => (
                        <div
                          key={b.branchCode}
                          onClick={() => {
                            setBranchCode(b.branchCode);
                            setSelectedCountryForSummary(c.countryName);
                          }}
                          className={cn(
                            "flex items-center justify-between rounded px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 hover:bg-blue-50 hover:text-blue-700 cursor-pointer transition",
                            branchCode === b.branchCode ? "border border-blue-400 bg-blue-50/80 text-blue-700 font-bold" : ""
                          )}
                        >
                          <span className="font-semibold text-[10px] uppercase">{b.branchName} ({b.totalAccounts} accs)</span>
                          <div className="flex items-center gap-2 font-mono text-[10px]">
                            <span className="text-rose-600">Dr: {fmtNumber(b.debitTotal)}</span>
                            <span className="text-emerald-600">Cr: {fmtNumber(b.creditTotal)}</span>
                            <span className={cn("font-bold", b.netBalance < 0 ? "text-rose-600" : "text-emerald-600")}>
                              Bal: {fmtNumber(b.netBalance)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </details>
              );
            })}
          </div>
        </div>
      )}

      {/* REPORT-3: SEARCH & TRANSACTION REPORT */}
      <section className="bg-white border border-slate-200 dark:border-slate-800 dark:bg-slate-950 p-6 rounded-2xl shadow-sm space-y-6">
        {filtersOpen ? (
          <div className="rounded border border-slate-200 bg-slate-50/30 p-4 dark:border-slate-800 dark:bg-slate-955 animate-in fade-in duration-200">
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <label className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{tr("COUNTRY SCOPE")}</span>
                <select value={draftCountryName} onChange={(e) => setDraftCountryName(e.target.value)} disabled={!isSuperAdmin && dashboardScope !== "super_admin"} className="h-9 w-full rounded border border-slate-250 bg-white px-3 text-xs focus:border-blue-500 outline-none transition disabled:bg-slate-100 disabled:text-slate-500 dark:border-slate-800 dark:bg-slate-950">
                  {countryOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{tr("BRANCH SCOPE")}</span>
                <select value={draftBranchCode} onChange={(e) => setDraftBranchCode(e.target.value)} className="h-9 w-full rounded border border-slate-250 bg-white px-3 text-xs focus:border-blue-500 outline-none transition disabled:bg-slate-100 disabled:text-slate-500 dark:border-slate-800 dark:bg-slate-950">
                  {branchOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{t(lang, "log.tbl_status", "Status")}</span>
                <select value={draftStatus} onChange={(e) => setDraftStatus(e.target.value)} className="h-9 w-full rounded border border-slate-250 bg-white px-3 text-xs focus:border-blue-500 outline-none transition disabled:bg-slate-100 disabled:text-slate-500 dark:border-slate-800 dark:bg-slate-950">
                  <option value="all">{t(lang, "report.all_label", "All")}</option>
                  <option value="active">{t(lang, "god.active", "Active")}</option>
                  <option value="archived">{t(lang, "acct.agrv_archived", "Archived")}</option>
                </select>
              </label>
              <label className="space-y-1 flex gap-2">
                <div className="w-1/2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">{tr("DATE FROM")}</span>
                  <input type="date" value={draftFromDate} onChange={(e) => setDraftFromDate(e.target.value)} className="h-9 w-full rounded border border-slate-250 bg-white px-3 text-xs focus:border-blue-500 outline-none transition dark:border-slate-800 dark:bg-slate-950" />
                </div>
                <div className="w-1/2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">{tr("DATE TO")}</span>
                  <input type="date" value={draftToDate} onChange={(e) => setDraftToDate(e.target.value)} className="h-9 w-full rounded border border-slate-250 bg-white px-3 text-xs focus:border-blue-500 outline-none transition dark:border-slate-800 dark:bg-slate-950" />
                </div>
              </label>
            </div>
            <div className="mt-3 flex justify-end gap-2 border-t border-slate-150 pt-3 dark:border-slate-800">
              <Button size="sm" variant="outline" onClick={resetFilters} className="h-8 text-[10px] font-bold">{tr("RESET FILTERS")}</Button>
              <Button size="sm" onClick={applyFilters} className="bg-blue-600 hover:bg-blue-700 text-white h-8 text-[10px] font-bold"><RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", loading && "animate-spin")} />{tr("APPLY FILTERS")}</Button>
            </div>
          </div>
        ) : null}

        {error ? <div className="rounded border border-red-300 bg-red-50 px-4 py-3 text-xs text-red-900 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-200">{error}</div> : null}
        
        {highlightCreated && selectedRow ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/90 dark:border-emerald-900/50 dark:bg-emerald-950/30 p-4 text-xs text-emerald-900 dark:text-emerald-200 flex items-center gap-3 shadow-xs">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div>
              <span className="font-bold text-sm">{t(lang, "acct.created_success_title", "Account Created Successfully!")}</span>
              <span className="block mt-0.5 font-medium">
                {t(lang, "roz.account", "Account")} <span className="font-mono font-black text-emerald-800 dark:text-emerald-200">{selectedRow.accountCode}</span> {t(lang, "acct.in_country_selected", "in")} <span className="font-bold">{localizeTerm(selectedRow.countryName, lang)}</span> {t(lang, "acct.has_been_selected", "has been selected.")}
              </span>
            </div>
          </div>
        ) : null}

        <div className={cn("grid gap-6 items-start", showProfilePanel ? "xl:grid-cols-[minmax(0,1fr)_420px]" : "xl:grid-cols-1")}>
          <div className="overflow-hidden rounded border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
            <div className="overflow-auto max-h-[calc(100vh-320px)] min-h-[350px]">
              <table className="min-w-[1550px] w-full text-xs text-left border-collapse">
                <thead className="sticky top-0 z-10 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
                  <tr>
                    {[
                      { label: tr("MASTER REFERENCE & ACCOUNT OVERVIEW"), span: 9, cls: "bg-slate-50 dark:bg-slate-900/40 text-slate-700 dark:text-slate-300 border-t-2 border-t-slate-400" },
                      { label: tr("CONTACT DETAILS"), span: 1, cls: "bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-400 border-t-2 border-t-emerald-500" },
                      { label: tr("BRANCH & LOCATION"), span: 3, cls: "bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-800 dark:text-indigo-400 border-t-2 border-t-indigo-500" },
                      { label: tr("FINANCIAL INFORMATION"), span: 4, cls: "bg-blue-50/50 dark:bg-blue-950/20 text-blue-800 dark:text-blue-400 border-t-2 border-t-blue-500" },
                      { label: tr("START & STATUS"), span: 2, cls: "bg-amber-50/50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-400 border-t-2 border-t-amber-500" },
                      { label: tr("ACTIONS"), span: 1, cls: "bg-slate-100 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400 border-t-2 border-t-slate-300" },
                    ].map((group) => (
                      <Th
                        key={group.label}
                        colSpan={group.span}
                        className={`${group.cls} px-3 py-2 text-[10px] font-extrabold uppercase tracking-widest text-center border-r border-slate-200 dark:border-slate-800 last:border-r-0`}
                      >
                        {group.label}
                      </Th>
                    ))}
                  </tr>
                  <tr className="bg-white dark:bg-slate-950 text-[9px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 border-b-2 border-slate-200 dark:border-slate-800">
                    {[
                      "MANUAL REF", "ACCOUNT CODE", "ACCOUNT NAME", "CATEGORY", "ACCOUNT TYPE", "COMPANY NAME",
                      "BANK NAME", "WAREHOUSE NAME", "OWNER NAME", "CONTACTS",
                      "COUNTRY", "MAIN BRANCH", "CITY BRANCH", "CURRENCY",
                      "DEBIT", "CREDIT", "BALANCE", "START DATE",
                      "STATUS", "ACTIONS"
                    ].map((header, i) => (
                      <Th key={i} className="px-3 py-3 border-r border-slate-100 dark:border-slate-800/50 last:border-r-0 whitespace-nowrap text-center align-middle">
                        {tr(header)}
                      </Th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                  {loading ? (
                    <tr>
                      <td colSpan={20} className="px-5 py-10 text-center text-sm text-slate-500 font-medium">
                        <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-blue-500" />
                        {t(lang, "acct.agrv_loading_accounts_registry", "Loading accounts registry...")}
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
                          <td className="px-3 py-2 border-r border-slate-100 dark:border-slate-850 font-bold text-left">{localizeTerm(row.accountName, lang)}</td>
                          <td className="px-3 py-2 border-r border-slate-100 dark:border-slate-850 font-bold text-purple-700 dark:text-purple-400 text-[9px] uppercase">{localizeTerm(row.accountCategory || "Asset", lang)}</td>
                          <td className="px-3 py-2 border-r border-slate-100 dark:border-slate-850 font-medium text-slate-600 dark:text-slate-300 text-[9px]">{localizeTerm(row.subType || "Normal Account", lang)}</td>
                          <td className="px-3 py-2 border-r border-slate-100 dark:border-slate-850 font-medium">{row.companyName ? localizeTerm(row.companyName, lang) : "-"}</td>
                          <td className="px-3 py-2 border-r border-slate-100 dark:border-slate-850 font-medium text-emerald-700 dark:text-emerald-400">{row.bankName ? localizeTerm(row.bankName, lang) : "-"}</td>
                          <td className="px-3 py-2 border-r border-slate-100 dark:border-slate-850 font-medium text-amber-700 dark:text-amber-400">{row.warehouseName ? localizeTerm(row.warehouseName, lang) : "-"}</td>
                          <td className="px-3 py-2 border-r border-slate-100 dark:border-slate-850 font-bold text-slate-900 dark:text-slate-100">
                            {transliterateProperNoun(
                              (row.ownerName && row.ownerName !== "-" && !row.ownerName.toLowerCase().includes("import export") ? row.ownerName : "") ||
                              ((row as any).customerName && (row as any).customerName !== "-" ? (row as any).customerName : "") ||
                              (row.companyOwner && row.companyOwner !== "-" && !row.companyOwner.toLowerCase().includes("import export") ? row.companyOwner : "") ||
                              "-",
                              lang
                            )}
                          </td>
                          <td className="px-3 py-2 border-r border-slate-100 dark:border-slate-850 text-center align-middle">
                            <ContactIconPopup row={row} />
                          </td>
                          <td className="px-3 py-2 border-r border-slate-100 dark:border-slate-850">{localizeTerm(row.countryName, lang)}</td>
                          <td className="px-3 py-2 border-r border-slate-100 dark:border-slate-850">{localizeTerm(row.mainBranchName ?? (row.branchType === "Main Branch" ? row.branchName : "-"), lang)}</td>
                          <td className="px-3 py-2 border-r border-slate-100 dark:border-slate-850">{localizeTerm(row.cityBranchName ?? (row.branchType === "City Branch" ? row.branchName : "-"), lang)}</td>
                          <td className="px-3 py-2 border-r border-slate-100 dark:border-slate-850 font-black">{row.currency}</td>
                          <td className="px-3 py-2 border-r border-slate-100 dark:border-slate-850 font-mono text-rose-600 dark:text-rose-400 text-right">{fmtNumber(row.debitTotal)}</td>
                          <td className="px-3 py-2 border-r border-slate-100 dark:border-slate-850 font-mono text-emerald-600 dark:text-emerald-400 text-right">{fmtNumber(row.creditTotal)}</td>
                          <td className={cn("px-3 py-2 border-r border-slate-100 dark:border-slate-850 font-mono font-black text-right", rowTone(row.currentBalance))}>{fmtNumber(row.currentBalance)}</td>
                          <td className="px-3 py-2 border-r border-slate-100 dark:border-slate-850 font-mono text-[9px] text-slate-500">{row.createdAt ? row.createdAt.slice(0, 10) : "-"}</td>
                          <td className="px-3 py-2 border-r border-slate-100 dark:border-slate-850">
                            <span className={cn("inline-block px-1.5 py-0.5 rounded text-[8px] font-black uppercase text-white tracking-widest", row.status === "active" ? "bg-emerald-600" : "bg-slate-500")}>
                              {row.status === "active" ? t(lang, "god.active", "Active") : t(lang, "god.inactive", "Inactive")}
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
                              onPrint={() => printAccountRow(row)}
                              onPdf={() => printAccountRow(row)}
                              onExcel={() => exportCsv("selected")}
                              onDelete={canDelete ? () => void deleteAccount(row) : undefined}
                            />
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={20} className="px-5 py-10 text-center text-sm text-slate-500">
                        {tr("NO ACCOUNTS MATCH THE SELECTED FILTERS")}
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
                  {t(lang, "acct.agrv_account_verification", "Account Verification")}
                </h3>
                <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider font-bold">{t(lang, "acct.agrv_review_account_details_sub", "Review account details and balances")}</p>
              </div>

              <div className="p-5 space-y-6 flex-1 bg-slate-50/50 dark:bg-slate-900/20">
                {selectedRow ? (
                  <>
                    <div className="space-y-3">
                      <div className="bg-slate-50 dark:bg-slate-900/40 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                        <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5"><Building2 className="h-3 w-3" /> {t(lang, "acct.agrv_account_info", "Account Info")}</div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="col-span-2"><span className="text-slate-400 block text-[9px] uppercase">{t(lang, "purchase.f_account_name", "Account Name")}</span><span className="font-bold truncate">{selectedRow.accountName}</span></div>
                          <div><span className="text-slate-400 block text-[9px] uppercase">{t(lang, "common.code", "Code")}</span><span className="font-bold font-mono text-blue-700 dark:text-blue-400">{selectedRow.accountCode}</span></div>
                          <div><span className="text-slate-400 block text-[9px] uppercase">{t(lang, "god.asset_category", "Category")}</span><span className="font-bold uppercase text-[10px]">{selectedRow.accountCategory}</span></div>
                          <div><span className="text-slate-400 block text-[9px] uppercase">{t(lang, "report.col_created", "Created")}</span><span className="font-bold font-mono text-[10px]">{fmtDateTime(selectedRow.createdAt)}</span></div>
                          <div><span className="text-slate-400 block text-[9px] uppercase">{t(lang, "log.tbl_status", "Status")}</span><span className={cn("font-black uppercase text-[10px]", selectedRow.status === 'active' ? 'text-emerald-600' : 'text-slate-500')}>{selectedRow.status}</span></div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-slate-50 dark:bg-slate-900/40 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                          <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5"><MapPin className="h-3 w-3" /> {t(lang, "company_form.section_location", "Location")}</div>
                          <div><span className="text-slate-400 block text-[9px] uppercase">{t(lang, "report.country", "Country")}</span><span className="font-bold text-xs truncate block">{selectedRow.countryName}</span></div>
                          <div className="mt-1"><span className="text-slate-400 block text-[9px] uppercase">{t(lang, "report.branch", "Branch")}</span><span className="font-bold text-xs">{selectedRow.branchName}</span></div>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-900/40 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                          <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">{t(lang, "acct.agrv_workspace", "Workspace")}</div>
                          <div><span className="text-slate-400 block text-[9px] uppercase">{t(lang, "hr.pp_company", "Company")}</span><span className="font-bold text-[10px] truncate block leading-tight">{data?.workspace.companyName ?? "-"}</span></div>
                          <div className="mt-1"><span className="text-slate-400 block text-[9px] uppercase">{t(lang, "branch.owner_label", "Owner")}</span><span className="font-bold text-[10px] leading-tight">{data?.workspace.companyOwner ?? "-"}</span></div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-blue-50/50 dark:bg-blue-950/20 p-3 rounded-lg border border-blue-100 dark:border-blue-900/50">
                      <div className="text-[10px] font-black uppercase tracking-wider text-blue-700 dark:text-blue-400 mb-2 flex items-center gap-1.5"><Landmark className="h-3 w-3" /> {t(lang, "lp.financial_summary", "Financial Summary")}</div>
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between items-center border-b border-blue-100 dark:border-blue-900/30 pb-1">
                          <span className="text-slate-500 font-bold uppercase text-[9px]">{t(lang, "bankroz.opening_balance", "Opening Balance")}</span>
                          <span className="font-mono font-bold text-[11px] text-slate-700 dark:text-slate-300">{fmtNumber(selectedRow.openingBalance)} {selectedRow.currency}</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-blue-100 dark:border-blue-900/30 pb-1">
                          <span className="text-rose-600 font-bold uppercase text-[9px]">{tr("TOTAL DEBIT")}</span>
                          <span className="font-mono font-bold text-[11px] text-rose-700 dark:text-rose-400">{fmtNumber(selectedRow.debitTotal)} {selectedRow.currency}</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-blue-100 dark:border-blue-900/30 pb-1">
                          <span className="text-emerald-600 font-bold uppercase text-[9px]">{tr("TOTAL CREDIT")}</span>
                          <span className="font-mono font-bold text-[11px] text-emerald-700 dark:text-emerald-400">{fmtNumber(selectedRow.creditTotal)} {selectedRow.currency}</span>
                        </div>
                        <div className="flex justify-between items-center pt-1">
                          <span className="text-blue-700 dark:text-blue-400 font-black uppercase text-[10px]">{t(lang, "acct.current_balance", "Current Balance")}</span>
                          <span className={cn("font-mono font-black text-sm", rowTone(selectedRow.currentBalance))}>{fmtNumber(selectedRow.currentBalance)} {selectedRow.currency}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2">
                      <Button type="button" variant="outline" className="flex-1 h-9 font-bold text-[10px] uppercase tracking-wider shadow-sm" onClick={() => router.push(`/dashboard/accounts/setup?accountId=${selectedRow.accountId}` as Route)}>
                        <PencilLine className="h-3.5 w-3.5 mr-1.5" /> {t(lang, "acct.asr_edit_account", "Edit Account")}
                      </Button>
                      <Button type="button" variant="outline" className="flex-1 h-9 font-bold text-[10px] uppercase tracking-wider shadow-sm" onClick={() => printAccountRow(selectedRow)}>
                        <Printer className="h-3.5 w-3.5 mr-1.5" /> {t(lang, "acct.agrv_print_info", "Print Info")}
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                    <FileCheck2 className="h-12 w-12 mb-3 opacity-20" />
                    <p className="text-xs font-bold uppercase tracking-widest text-center">{t(lang, "acct.agrv_no_account_selected", "No Account Selected")}</p>
                    <p className="text-[10px] text-center mt-1 w-2/3">{t(lang, "acct.agrv_click_account_registry_msg", "Click on any account in the registry to view its details here.")}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      {filtersOpen && (
        <SimpleModal
          title={tr("Filter Account Master Registry")}
          isOpen={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          maxWidth="max-w-xl"
        >
          <div className="space-y-4 text-xs">
            <div>
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 block">
                {tr("Account Name / Number / Keyword")}
              </Label>
              <Input
                value={draftQuery}
                onChange={(e) => setDraftQuery(e.target.value)}
                placeholder={tr("Search by account name, code, ref no, etc.")}
                className="h-9 rounded-xl text-xs"
              />
            </div>

            <div>
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 block">
                {tr("Country")}
              </Label>
              <SearchSelect
                value={draftCountryName}
                options={countryOptions}
                onValueChange={(val: string) => setDraftCountryName(val)}
                placeholder={tr("ALL COUNTRIES")}
              />
            </div>

            <div>
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 block">
                {tr("Branch")}
              </Label>
              <SearchSelect
                value={draftBranchCode}
                options={branchOptions}
                onValueChange={(val: string) => setDraftBranchCode(val)}
                placeholder={tr("ALL BRANCHES")}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 block">
                  {tr("Account Status")}
                </Label>
                <select
                  value={draftStatus}
                  onChange={(e) => setDraftStatus(e.target.value)}
                  className="w-full h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 outline-none"
                >
                  <option value="all">{tr("ALL STATUSES")}</option>
                  <option value="active">{tr("Active")}</option>
                  <option value="inactive">{tr("Inactive")}</option>
                </select>
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 block">
                  {tr("Account Category / Type")}
                </Label>
                <select
                  value={draftCategory}
                  onChange={(e) => setDraftCategory(e.target.value)}
                  className="w-full h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 outline-none"
                >
                  <option value="all">{tr("ALL CATEGORIES")}</option>
                  <option value="asset">{tr("Asset / Bank")}</option>
                  <option value="liability">{tr("Liability / Vendor")}</option>
                  <option value="income">{tr("Income / Sales")}</option>
                  <option value="expense">{tr("Expense")}</option>
                  <option value="customer">{tr("Customer")}</option>
                  <option value="company">{tr("Company")}</option>
                  <option value="employee">{tr("Employee")}</option>
                  <option value="personal">{tr("Personal")}</option>
                </select>
              </div>
            </div>

            <div>
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 block">
                {tr("Creation Date Range")}
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] text-slate-500 font-semibold mb-1 block">{tr("From Date")}</span>
                  <Input
                    type="date"
                    value={draftFromDate}
                    onChange={(e) => setDraftFromDate(e.target.value)}
                    className="h-9 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-semibold mb-1 block">{tr("To Date")}</span>
                  <Input
                    type="date"
                    value={draftToDate}
                    onChange={(e) => setDraftToDate(e.target.value)}
                    className="h-9 rounded-xl text-xs"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
              <Button
                type="button"
                variant="outline"
                onClick={resetFilters}
                className="h-9 rounded-xl font-bold text-xs cursor-pointer"
              >
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> {tr("Reset All")}
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setFiltersOpen(false)}
                  className="h-9 rounded-xl text-xs cursor-pointer"
                >
                  {tr("Cancel")}
                </Button>
                <Button
                  type="button"
                  onClick={applyFilters}
                  className="h-9 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-5 cursor-pointer"
                >
                  {tr("Apply Filters")}
                </Button>
              </div>
            </div>
          </div>
        </SimpleModal>
      )}
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
