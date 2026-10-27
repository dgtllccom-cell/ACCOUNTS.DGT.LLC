"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  RefreshCcw,
  Search,
  AlertTriangle,
  Globe,
  Calendar,
  Eye,
  MessageSquare,
  Phone,
  Mail,
  Printer,
  FileText,
  Download,
  ChevronDown,
  ArrowLeft,
  X,
} from "lucide-react";
import { apiGet } from "@/lib/api/client";
import { Th } from "@/components/ui/translated-th";
import { cn } from "@/lib/utils";
import { openGenericErpReport, formatCellValue, getRowValue, type GenericReportColumn } from "@/lib/reports/open-generic-erp-report";
import { openJournalReportWindow } from "@/lib/reports/open-journal-report-window";
import { openOutstandingRecoveryPrintReport } from "@/lib/reports/open-outstanding-recovery-print-report";
import { resolveDocumentBranding } from "@/lib/reports/resolve-document-branding";
import { PrintableReportHeader } from "@/components/reports/printable-report-header";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";
import { translateHeader } from "@/lib/i18n/table-headers";
import { translateValue } from "@/lib/i18n/table-values";
import { rtlLanguages } from "@/lib/i18n/languages";

type Row = {
  id: string;
  code: string;
  name: string;
  currency: string;
  countryId: string | null;
  countryName: string;
  branchName: string;
  branchCode: string | null;
  accountNumber: string | null;
  accountType: string;
  accountStatus: string;
  contactPhone: string | null;
  contactEmail: string | null;
  contactPerson: string | null;
  scope: string;
  openingBalance: number;
  outstanding: number;
  side: "debit" | "credit" | "zero";
  debitTotal: number;
  creditTotal: number;
  finalBalance: number;
  balanceDirection: "DR" | "CR" | "—";
  lastMovementDate: string | null;
  daysOutstanding: number | null;
};

type Resp = {
  rows: Row[];
  summary: {
    accounts: number;
    totalAccounts?: number;
    totalReceivable: number;
    totalPayable: number;
    netOutstanding: number;
    clearedEntries: number;
    remainingEntries: number;
    overdueAccounts: number;
    overdueAmounts: number;
    overdue10: number;
  };
};

type Tab = "all" | "receivable" | "payable" | "overdue";

const fmt = (n: number) => new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

function formatDateSlash(dateStr?: string | null) {
  if (!dateStr) return "—";
  try {
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      return `${parts[1]}/${parts[2]}/${parts[0]}`;
    }
  } catch {}
  return dateStr;
}

function exportCsv(filename: string, rows: string[][]) {
  const csv = rows
    .map((row) =>
      row
        .map((value) => {
          const v = String(value ?? "");
          return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
        })
        .join(",")
    )
    .join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function getFlag(countryName?: string | null) {
  if (!countryName) return "🇦🇪";
  const cName = countryName.toLowerCase();
  if (cName.includes("uae") || cName.includes("united arab") || cName.includes("امارات")) return "🇦🇪";
  if (cName.includes("pakistan") || cName.includes("پاکستان")) return "🇵🇰";
  if (cName.includes("turkey") || cName.includes("تراکی")) return "🇹🇷";
  if (cName.includes("china") || cName.includes("چین")) return "🇨🇳";
  if (cName.includes("afghanistan") || cName.includes("افغانستان")) return "🇦🇫";
  if (cName.includes("iran") || cName.includes("ایران")) return "🇮🇷";
  return "🌐";
}

export function OutstandingRecoveryLedgerView({ lang: langProp = "en", pageTitle }: { lang?: string; pageTitle: string }) {
  const router = useRouter();
  const activeLang = useActiveLanguage();
  const lang = activeLang || langProp;
  const tr = (label: string) => translateHeader(lang, label);
  const tv = (value: string | null | undefined) => translateValue(lang, value);
  const isRtl = rtlLanguages.includes(lang);

  const [rows, setRows] = useState<Row[]>([]);
  const [summary, setSummary] = useState<Resp["summary"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("all");
  const [overdueDays, setOverdueDays] = useState(10);
  const [q, setQ] = useState("");
  const [sessionInfo, setSessionInfo] = useState<any>(null);
  const [showAllCountries, setShowAllCountries] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [headerBrand, setHeaderBrand] = useState<{ name: string; address: string; taxNo: string; contact: string; currency: string }>({ name: "", address: "", taxNo: "", contact: "", currency: "" });

  // Account Ledger Statement Drilldown Modal State
  const [selectedLedgerAccount, setSelectedLedgerAccount] = useState<Row | null>(null);
  const [statementLoading, setStatementLoading] = useState(false);
  const [statementData, setStatementData] = useState<any>(null);
  const [statementError, setStatementError] = useState<string | null>(null);

  const scopeSummary = sessionInfo?.scopes?.summary ?? null;
  const scopeCountry = scopeSummary?.countryName || translateHeader(lang, "All Countries");
  const scopeBranch = scopeSummary?.branchDisplayName || scopeSummary?.branchName || translateHeader(lang, "All Branches");
  const scopeRole = sessionInfo?.roles?.[0]?.replace(/_/g, " ") || "—";
  const scopeUserName = sessionInfo?.user?.fullName || sessionInfo?.user?.email || "—";
  // the report time is the viewer's local time: set it in the browser only (rendering it on the server too caused a hydration error)
  const [generatedAt, setGeneratedAt] = useState("");
  useEffect(() => {
    const now = new Date();
    setGeneratedAt(`${now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}, ${now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true })}`);
  }, []);
  const scopeUserId = sessionInfo?.user?.id || "-";
  const scopeStatus = sessionInfo?.authenticated ? "ACTIVE" : "SESSION UNKNOWN";

  useEffect(() => {
    if (!selectedLedgerAccount) {
      setStatementData(null);
      setStatementError(null);
      return;
    }
    let cancelled = false;
    setStatementLoading(true);
    setStatementError(null);
    apiGet<any>(`/api/erp/accounting/reports/ledger/statement?ledgerId=${encodeURIComponent(selectedLedgerAccount.id)}`)
      .then((res) => {
        if (!cancelled) setStatementData(res);
      })
      .catch((e: any) => {
        if (!cancelled) setStatementError(e?.message || "Failed to load ledger statement");
      })
      .finally(() => {
        if (!cancelled) setStatementLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedLedgerAccount]);

  useEffect(() => {
    fetch("/api/erp/auth/session", { credentials: "include" })
      .then((r) => r.json())
      .then((info) => setSessionInfo(info))
      .catch(() => null);
  }, []);

  useEffect(() => {
    const sc = sessionInfo?.scopes;
    if (!sc) return;
    let cancelled = false;
    resolveDocumentBranding(
      {
        countryId: sc?.countryIds?.[0] ?? null,
        countryBranchId: sc?.countryBranchIds?.[0] ?? null,
        cityBranchId: sc?.cityBranchIds?.[0] ?? null,
        countryName: sc?.summary?.countryName ?? null,
        branchName: sc?.summary?.branchDisplayName ?? sc?.summary?.branchName ?? null,
      },
      activeLang,
    )
      .then((b) => {
        if (cancelled) return;
        setHeaderBrand({
          name: b.entityName || sc?.summary?.countryName || "",
          address: b.address || "",
          taxNo: b.taxNumber ? `Tax/TRN: ${b.taxNumber}` : (b.registrationNumber ? `Reg: ${b.registrationNumber}` : ""),
          contact: [b.phone, b.email, b.website].filter(Boolean).join(" | "),
          currency: b.baseCurrency || "",
        });
      })
      .catch(() => null);
    return () => { cancelled = true; };
  }, [sessionInfo, activeLang]);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const data = await apiGet<Resp>("/api/erp/accounting/reports/ledger/outstanding");
      setRows(data.rows ?? []);
      setSummary(data.summary ?? null);
    } catch (e: any) {
      setErr(e?.message || "Failed to load outstanding ledger");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    let r = rows;
    if (tab === "receivable") r = r.filter((x) => x.outstanding > 0);
    else if (tab === "payable") r = r.filter((x) => x.outstanding < 0);
    else if (tab === "overdue") r = r.filter((x) => (x.daysOutstanding ?? 0) >= overdueDays);
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      r = r.filter((x) => x.name?.toLowerCase().includes(s) || x.code?.toLowerCase().includes(s));
    }
    return r;
  }, [rows, tab, overdueDays, q]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pagedRows = useMemo(() => {
    return filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  }, [filtered, currentPage, pageSize]);

  const countryDashboardData = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        currency: string;
        accounts: number;
        receivable: number;
        payable: number;
        net: number;
        branches: Set<string>;
        branchData: Map<string, { name: string; accounts: number; receivable: number; payable: number; net: number }>;
      }
    >();

    for (const row of filtered) {
      const countryName = row.countryName || scopeSummary?.countryName || "All Countries";
      const branchName = row.branchName || scopeSummary?.branchDisplayName || scopeSummary?.branchName || "All Branches";
      const currency = row.currency || "AED";

      if (!map.has(countryName)) {
        map.set(countryName, {
          name: countryName,
          currency,
          accounts: 0,
          receivable: 0,
          payable: 0,
          net: 0,
          branches: new Set(),
          branchData: new Map(),
        });
      }

      const cData = map.get(countryName)!;
      cData.accounts += 1;
      if (row.outstanding > 0) cData.receivable += row.outstanding;
      else if (row.outstanding < 0) cData.payable += Math.abs(row.outstanding);
      cData.net += row.outstanding;
      cData.branches.add(branchName);

      if (!cData.branchData.has(branchName)) {
        cData.branchData.set(branchName, {
          name: branchName,
          accounts: 0,
          receivable: 0,
          payable: 0,
          net: 0,
        });
      }

      const bData = cData.branchData.get(branchName)!;
      bData.accounts += 1;
      if (row.outstanding > 0) bData.receivable += row.outstanding;
      else if (row.outstanding < 0) bData.payable += Math.abs(row.outstanding);
      bData.net += row.outstanding;
    }

    return Array.from(map.values());
  }, [filtered, scopeSummary?.branchDisplayName, scopeSummary?.branchName, scopeSummary?.countryName]);

  const previewColumns: GenericReportColumn[] = [
    { key: "sr", label: "SR#", align: "center", format: "text" },
    { key: "startDate", label: "Start Date", align: "center", format: "text" },
    { key: "code", label: "Code" },
    { key: "accountNo", label: "Account No", align: "center" },
    { key: "contractNo", label: "Contract No", align: "center" },
    { key: "name", label: "Account Name" },
    { key: "accountType", label: "Account Type", align: "center" },
    { key: "status", label: "Status", align: "center", format: "status" },
    { key: "credit", label: "Credit (AED)", align: "right", format: "currency" },
    { key: "debit", label: "Debit (AED)", align: "right", format: "currency" },
    { key: "currency", label: "Curr", align: "center" },
    { key: "lastMovementDate", label: "Last Date", align: "center", format: "text" },
    { key: "daysOutstanding", label: "Days (Diff.)", align: "center", format: "number" },
    { key: "type", label: "Type", align: "center" },
    { key: "balance", label: "Balance (AED)", align: "right", format: "currency" },
  ];

  const previewRows = filtered.map((x, idx) => {
    const isOverdue = (x.daysOutstanding ?? 0) > overdueDays;
    const lastDate = formatDateSlash(x.lastMovementDate);
    return {
      sr: String(idx + 1),
      startDate: "—",
      code: x.code,
      accountNo: x.accountNumber || x.code.replace(/^[^\d]+/, '') || "—",
      contractNo: "—",
      name: x.name,
      accountType: x.accountType || (x.outstanding > 0 ? "Receivable" : x.outstanding < 0 ? "Payable" : "General"),
      status: isOverdue ? "overdue" : x.accountStatus || "active",
      credit: x.creditTotal,
      debit: x.debitTotal,
      currency: x.currency || "AED",
      lastMovementDate: lastDate,
      daysOutstanding: x.daysOutstanding ?? null,
      type: x.balanceDirection || (x.outstanding > 0 ? "DR" : x.outstanding < 0 ? "CR" : "—"),
      balance: x.finalBalance,
    };
  });

  async function openReportPreview(autoPrint: boolean = false) {
    const printRows = filtered.map((r, idx) => {
      const isOverdue = (r.daysOutstanding ?? 0) > overdueDays;
      const recStatus = r.finalBalance === 0 ? "Cleared" : isOverdue ? "In Recovery" : "Pending";
      const branchAndCountry = `${r.branchName || scopeBranch} (${r.countryName || scopeCountry})`;

      return {
        srNo: idx + 1,
        accountName: r.name,
        accountCode: r.code,
        accountType: r.accountType || (r as any).accountKind || "—",
        branchAndCountry,
        currency: r.currency || "AED",
        debit: r.debitTotal,
        credit: r.creditTotal,
        outstandingAmount: r.finalBalance,
        agingStatus: isOverdue ? `Overdue (>${overdueDays}D)` : `0–${overdueDays}D (${r.daysOutstanding != null ? r.daysOutstanding : "—"}D)`,
        daysOutstanding: r.daysOutstanding ?? undefined,
        lastTransactionDate: r.lastMovementDate || "—",
        recoveryStatus: recStatus
      };
    });

    const netOutstanding = summary?.netOutstanding ?? ((summary?.totalReceivable ?? 0) - (summary?.totalPayable ?? 0));
    const sessionActiveText = sessionInfo?.authenticated ? "Session Active" : "SESSION UNKNOWN";

    const sc = sessionInfo?.scopes;
    const brand = await resolveDocumentBranding(
      {
        countryId: sc?.countryIds?.[0] ?? null,
        countryBranchId: sc?.countryBranchIds?.[0] ?? null,
        cityBranchId: sc?.cityBranchIds?.[0] ?? null,
        countryName: scopeSummary?.countryName ?? null,
        branchName: scopeBranch,
      },
      activeLang,
    );

    openOutstandingRecoveryPrintReport({
      rows: printRows,
      summary: {
        outstandingAccounts: summary?.totalAccounts ?? summary?.accounts ?? filtered.length,
        totalReceivable: summary?.totalReceivable ?? 0,
        totalPayable: summary?.totalPayable ?? 0,
        netOutstanding: netOutstanding,
        overdue10Count: summary?.overdueAccounts ?? summary?.overdue10 ?? 0,
        totalEntries: (summary?.clearedEntries ?? 0) + (summary?.remainingEntries ?? 0) || filtered.length,
        clearedEntries: summary?.clearedEntries ?? 0,
        remainingEntries: summary?.remainingEntries ?? filtered.length,
        activeCountriesCount: scopeSummary?.countryName ? 1 : 0,
        totalBranchesCount: scopeBranch && scopeBranch !== "All Branches" ? 1 : 0,
        statusText: sessionActiveText,
        coverageText: scopeSummary?.countryName || ""
      },
      scope: {
        country: scopeCountry,
        branch: scopeBranch,
        currency: brand.baseCurrency || "",
        userName: scopeUserName,
        role: scopeRole,
        sessionStatus: sessionActiveText,
        filterType: tab === "all" ? "All Outstanding Records" : tab === "receivable" ? "Receivables Only" : tab === "payable" ? "Payables Only" : "Overdue >10 Days",
        dateRange: "",
      },
      companyInfo: {
        name: brand.entityName || scopeSummary?.countryName || "",
        address: brand.address || "",
        email: brand.email || "",
        taxNo: brand.taxNumber || brand.registrationNumber || "",
        printedBy: scopeUserName
      },
      autoPrint,
      lang
    });
  }

  function exportReportCsv() {
    const rowsCsv = [
      [
        "SR#",
        "START DATE",
        "CODE",
        "ACCOUNT NO",
        "ACCOUNT NAME",
        "COUNTRY",
        "BRANCH",
        "ACCOUNT TYPE",
        "STATUS",
        "TOTAL CREDIT (AED)",
        "TOTAL DEBIT (AED)",
        "CURR",
        "LAST DATE",
        "DAYS (Diff.)",
        "DR / CR",
        "FINAL BALANCE (AED)",
      ],
      ...filtered.map((x, idx) => {
        const isOverdue = (x.daysOutstanding ?? 0) > overdueDays;
        const srNo = idx + 1;
        const lastDate = formatDateSlash(x.lastMovementDate);
        return [
          String(srNo),
          "—",
          x.code,
          x.accountNumber || x.code.replace(/^[^\d]+/, '') || "—",
          x.name,
          x.countryName || scopeCountry,
          x.branchName || scopeBranch,
          x.accountType || (x.outstanding > 0 ? "Receivable" : x.outstanding < 0 ? "Payable" : "General"),
          isOverdue ? "Overdue" : x.accountStatus || "Active",
          fmt(x.creditTotal),
          fmt(x.debitTotal),
          x.currency || "AED",
          lastDate,
          x.daysOutstanding != null ? String(x.daysOutstanding) : "—",
          x.balanceDirection || (x.outstanding > 0 ? "DR" : x.outstanding < 0 ? "CR" : "—"),
          fmt(x.finalBalance),
        ];
      }),
    ];
    exportCsv(`outstanding_recovery_ledger_${new Date().toISOString().slice(0, 10)}.csv`, rowsCsv);
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "all", label: tr("All Outstanding") },
    { key: "receivable", label: tr("Recovery (Receivable)") },
    { key: "payable", label: tr("Payable") },
    { key: "overdue", label: `${tr("Overdue")} > ${overdueDays} ${tr("days")}` },
  ];

  return (
    <div className="space-y-4 p-4 sm:p-6 outstanding-recovery-ledger-container" dir={isRtl ? "rtl" : "ltr"}>
      {/* Print-specific CSS Engine */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          .dashboard-header, 
          .action-buttons-bar, 
          .btn-refresh, 
          .btn-pdf, 
          .btn-excel, 
          .btn-print,
          .filter-search-bar,
          nav, 
          aside,
          header {
            display: none !important;
          }

          body {
            background-color: #ffffff !important;
            color: #000000 !important;
            font-size: 10pt;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
          }

          .summary-cards-container {
            display: grid !important;
            grid-template-columns: repeat(4, 1fr) !important;
            gap: 8px !important;
            margin-bottom: 15px !important;
            border: 1px solid #000 !important;
            padding: 8px !important;
          }

          table.ledger-table {
            width: 100% !important;
            border-collapse: collapse !important;
          }

          table.ledger-table th, 
          table.ledger-table td {
            border: 1px solid #666 !important;
            padding: 4px 6px !important;
            font-size: 8pt !important;
          }

          thead {
            display: table-header-group !important;
          }

          tr {
            page-break-inside: avoid !important;
          }
        }
      `}} />

      {/* Top Header Bar with Navigation & Quick Actions */}
      <div className="dashboard-header flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
            title={tr("Back")}
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">{translateHeader(lang, pageTitle)}</h1>
            <p className="text-xs text-slate-500">{tr("Account-wise remaining balances, aging & recovery. Overdue = 10+ days since last transaction.")}</p>
          </div>
        </div>
        <div className="action-buttons-bar flex flex-wrap items-center gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="btn-refresh inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
          >
            <RefreshCcw className={cn("h-3.5 w-3.5", loading && "animate-spin")} /> {tr("Refresh")}
          </button>
          <button
            onClick={() => { void openReportPreview(false); }}
            className="btn-print inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 shadow-sm hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300"
          >
            <Printer className="h-3.5 w-3.5" /> {tr("Print")}
          </button>
          <button
            onClick={() => { void openReportPreview(true); }}
            className="btn-pdf inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 shadow-sm hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300"
          >
            <FileText className="h-3.5 w-3.5" /> {tr("PDF")}
          </button>
          <button
            onClick={exportReportCsv}
            className="btn-excel inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 shadow-sm hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
          >
            <Download className="h-3.5 w-3.5" /> {tr("Excel")}
          </button>
        </div>
      </div>

      {/* Printable Report Header for Direct Print / PDF Output */}
      <PrintableReportHeader
        documentTitle="Outstanding & Recovery Ledger Report"
        documentSubtitle={t(lang, "ledger.orlv_subtitle", "Account-wise remaining balances, aging & recovery")}
        scopeCountry={scopeCountry}
        scopeBranch={scopeBranch}
        scopeCurrency={headerBrand.currency}
        userName={scopeUserName}
        dateRange="Current Financial Session"
        companyName={headerBrand.name}
        companyAddress={headerBrand.address}
        companyTaxNo={headerBrand.taxNo}
        companyContact={headerBrand.contact}
      />

      {/* 4 Primary Summary Panels Grid */}
      <div className="summary-cards-container grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Panel 1: Branch & User Details */}
        <div className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-blue-50/50 dark:bg-blue-900/10">
            <div className="bg-blue-600 p-1 rounded-full text-white">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
            <h4 className="text-xs font-black uppercase tracking-wider text-blue-800 dark:text-blue-400">
              {tr("1. BRANCH & USER DETAILS")}
            </h4>
          </div>
          <div className="p-4 flex flex-col gap-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400 h-full">
            <div className="flex justify-between items-center">
              <span>{tr("COUNTRY:")}</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{scopeCountry}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>{tr("BRANCH NAME:")}</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 uppercase">{scopeBranch}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>{tr("USER ID:")}</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 uppercase text-[9px] font-mono">{scopeUserId}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>{tr("USER NAME:")}</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 uppercase">{scopeUserName}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>{tr("ROLE:")}</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 uppercase">{scopeRole}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>{tr("DATE & TIME:")}</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{generatedAt}</span>
            </div>
            <div className="flex justify-between items-center mt-auto pt-1">
              <span>{tr("STATUS:")}</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded text-[10px]">{scopeStatus}</span>
            </div>
          </div>
        </div>

        {/* Panel 2: Global Financial Summary */}
        <div className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-emerald-50/50 dark:bg-emerald-900/10">
            <div className="bg-emerald-600 p-1 rounded-full text-white">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            </div>
            <h4 className="text-xs font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-400">
              {tr("2. GLOBAL FINANCIAL SUMMARY")}
            </h4>
          </div>
          <div className="p-4 flex flex-col gap-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400 h-full">
            <div className="flex justify-between items-center">
              <span>{tr("TOTAL OUTSTANDING ACCOUNTS:")}</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{summary?.totalAccounts ?? summary?.accounts ?? filtered.length}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>{tr("TOTAL RECEIVABLE:")}</span>
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">AED {fmt(summary?.totalReceivable ?? 0)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>{tr("TOTAL PAYABLE:")}</span>
              <span className="font-mono font-bold text-amber-600 dark:text-amber-400">AED {fmt(summary?.totalPayable ?? 0)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>{tr("OVERDUE ACCOUNTS:")}</span>
              <span className="font-mono font-bold text-rose-600 dark:text-rose-400">{summary?.overdueAccounts ?? summary?.overdue10 ?? 0}</span>
            </div>
            <div className="flex justify-between items-center mt-auto border-t border-slate-100 dark:border-slate-800 pt-2">
              <span className="font-bold text-slate-700 dark:text-slate-300">{t(lang, "ledger.orlv_net_outstanding_colon", "NET OUTSTANDING:")}</span>
              <span className="font-mono font-black text-blue-600 dark:text-blue-400 text-xs">
                AED {fmt(summary?.netOutstanding ?? ((summary?.totalReceivable ?? 0) - (summary?.totalPayable ?? 0)))}
              </span>
            </div>
          </div>
        </div>

        {/* Panel 3: Bill Entries Summary */}
        <div className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-purple-50/50 dark:bg-purple-900/10">
            <div className="bg-purple-600 p-1 rounded-full text-white">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            </div>
            <h4 className="text-xs font-black uppercase tracking-wider text-purple-800 dark:text-purple-400">
              {tr("3. BILL & ENTRY RECOVERY")}
            </h4>
          </div>
          <div className="p-4 flex flex-col gap-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400 h-full">
            <div className="flex justify-between items-center">
              <span>{tr("TOTAL LEDGER ENTRIES:")}</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{(summary?.clearedEntries ?? 0) + (summary?.remainingEntries ?? 0) || filtered.length}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>{tr("CLEARED ENTRIES:")}</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">{summary?.clearedEntries ?? 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>{tr("REMAINING ENTRIES:")}</span>
              <span className="font-bold text-amber-600 dark:text-amber-400">{summary?.remainingEntries ?? filtered.length}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>{tr("OVERDUE AMOUNT:")}</span>
              <span className="font-mono font-bold text-rose-600 dark:text-rose-400">AED {fmt(summary?.overdueAmounts ?? 0)}</span>
            </div>
            <div className="flex justify-between items-center mt-auto border-t border-slate-100 dark:border-slate-800 pt-2">
              <span className="font-bold text-slate-700 dark:text-slate-300">{t(lang, "rozrep.system_status", "SYSTEM STATUS:")}</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded text-[10px]">{t(lang, "ledger.orlv_all_clear", "ALL CLEAR")}</span>
            </div>
          </div>
        </div>

        {/* Panel 4: All Countries Report with Expandable List */}
        <div className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-amber-50/50 dark:bg-amber-900/10">
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
              className="text-[11px] font-bold text-amber-700 dark:text-amber-400 hover:underline inline-flex items-center gap-0.5"
            >
              {showAllCountries ? tr("Hide List") : tr("View List")}
              <ChevronDown className={cn("h-3 w-3 transition-transform", showAllCountries ? "rotate-180" : "")} />
            </button>
          </div>
          <div className="p-4 flex flex-col gap-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400 h-full">
            <div className="flex justify-between items-center">
              <span>{tr("TOTAL COUNTRIES:")}</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{countryDashboardData.length}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>{tr("TOTAL BRANCHES:")}</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{Array.from(new Set(countryDashboardData.flatMap((c) => Array.from(c.branches)))).length}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>{tr("ACTIVE CURRENCY:")}</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">AED</span>
            </div>
            <div className="flex justify-between items-center mt-auto border-t border-slate-100 dark:border-slate-800 pt-2">
              <span className="font-bold text-slate-700 dark:text-slate-300">{t(lang, "ledger.orlv_coverage_colon", "COVERAGE:")}</span>
              <span className="font-bold text-blue-600 dark:text-blue-400">{t(lang, "ledger.orlv_global_network", "GLOBAL NETWORK")}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Accordion Expandable Detailed Countries Drawer */}
      {showAllCountries && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/20 p-4 dark:border-amber-900/40 dark:bg-amber-950/10 space-y-3">
          <div className="flex items-center justify-between border-b border-amber-200/60 pb-2 dark:border-amber-900/60">
            <h5 className="text-xs font-black uppercase text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
              <Globe className="h-4 w-4 text-amber-600" />
              {t(lang, "ledger.orlv_global_breakdown", "GLOBAL BREAKDOWN BY COUNTRY & BRANCH")}
            </h5>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">{countryDashboardData.length} active region(s)</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {countryDashboardData.map((c) => (
              <details key={c.name} className="group rounded-lg border border-slate-200 bg-white p-3 shadow-xs dark:border-slate-800 dark:bg-slate-900">
                <summary className="flex cursor-pointer items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
                  <span className="flex items-center gap-2">
                    <span className="text-base">{getFlag(c.name)}</span>
                    {c.name}
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                      {c.accounts} accounts
                    </span>
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-blue-600 dark:text-blue-400 text-xs">
                      AED {fmt(c.net)}
                    </span>
                    <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180 text-slate-400" />
                  </div>
                </summary>

                <div className="mt-3 space-y-2 border-t border-slate-100 pt-2 text-[11px] dark:border-slate-800">
                  <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-bold">
                    <div className="rounded bg-emerald-50 p-1.5 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                      REC: {fmt(c.receivable)}
                    </div>
                    <div className="rounded bg-amber-50 p-1.5 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                      PAY: {fmt(c.payable)}
                    </div>
                    <div className="rounded bg-blue-50 p-1.5 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">
                      NET: {fmt(c.net)}
                    </div>
                  </div>

                  <div className="space-y-1 pt-1">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t(lang, "ledger.orlv_branches_word", "Branches")}</div>
                    {Array.from(c.branchData.values()).map((b) => (
                      <div key={b.name} className="flex items-center justify-between rounded px-2 py-1 bg-slate-50 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300">
                        <span className="font-semibold">{b.name} ({b.accounts} accs)</span>
                        <span className="font-mono text-[10px] font-bold text-slate-900 dark:text-slate-100">AED {fmt(b.net)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </details>
            ))}
          </div>
        </div>
      )}

      {/* Filter Tabs & Search Controls */}
      <div className="filter-search-bar flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-xs">
        <div className="flex flex-wrap gap-1.5">
          {tabs.map((tb) => (
            <button
              key={tb.key}
              onClick={() => { setTab(tb.key); setCurrentPage(1); }}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                tab === tb.key
                  ? "bg-blue-600 text-white shadow-xs"
                  : "border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              }`}
            >
              {tb.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {tab === "overdue" && (
            <label className="flex items-center gap-1 text-xs text-slate-500 font-semibold">
              {tr("Days")} ≥
              <input
                type="number"
                min={0}
                value={overdueDays}
                onChange={(e) => { setOverdueDays(Number(e.target.value) || 0); setCurrentPage(1); }}
                className="w-16 rounded-md border border-slate-200 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
              />
            </label>
          )}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => { setQ(e.target.value); setCurrentPage(1); }}
              placeholder={tr("Search account…")}
              className="w-56 rounded-lg border border-slate-200 py-1.5 pl-8 pr-3 text-xs dark:border-slate-700 dark:bg-slate-900"
            />
          </div>
        </div>
      </div>

      {/* Ledger Table Container */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-slate-100">
                {t(lang, "ledger.orlv_ledger_entries_word", "LEDGER ENTRIES")}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Showing {filtered.length} total account balances
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => setExportMenuOpen(!exportMenuOpen)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <Printer className="h-3.5 w-3.5" /> {t(lang, "ledger.orlv_print_export", "Print / Export")}<ChevronDown className="h-3.5 w-3.5" />
              </button>
              {exportMenuOpen && (
                <div className="absolute right-0 top-full z-30 mt-1 w-44 rounded-xl border border-slate-200 bg-white p-1 shadow-xl dark:border-slate-800 dark:bg-slate-900">
                  <button
                    onClick={() => { setExportMenuOpen(false); void openReportPreview(false); }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <Printer className="h-3.5 w-3.5 text-blue-600" /> {t(lang, "acct.print_preview", "Print Preview")}
                  </button>
                  <button
                    onClick={() => { setExportMenuOpen(false); void openReportPreview(true); }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <FileText className="h-3.5 w-3.5 text-rose-600" /> {t(lang, "ledger.lgrv_pdf_export", "PDF Export")}
                  </button>
                  <button
                    onClick={() => { setExportMenuOpen(false); exportReportCsv(); }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <Download className="h-3.5 w-3.5 text-emerald-600" /> {t(lang, "bankroz.excel_export", "Excel Export")}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Table Container */}
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="ledger-table w-full min-w-[1450px] text-xs">
            <thead className="bg-slate-50/80 text-left font-bold uppercase text-slate-600 dark:bg-slate-800/80 dark:text-slate-300">
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <Th className="px-2.5 py-2.5 text-center text-[10px] tracking-wider">{tr("SR#")}</Th>
                <Th className="px-2.5 py-2.5 text-[10px] tracking-wider">{tr("ACCOUNT CODE")}</Th>
                <Th className="px-2.5 py-2.5 text-[10px] tracking-wider">{tr("ACCOUNT NO")}</Th>
                <Th className="px-2.5 py-2.5 text-[10px] tracking-wider">{tr("ACCOUNT NAME")}</Th>
                <Th className="px-2.5 py-2.5 text-[10px] tracking-wider">{tr("COUNTRY")}</Th>
                <Th className="px-2.5 py-2.5 text-[10px] tracking-wider">{tr("BRANCH")}</Th>
                <Th className="px-2.5 py-2.5 text-[10px] tracking-wider">{tr("TYPE")}</Th>
                <Th className="px-2.5 py-2.5 text-center text-[10px] tracking-wider">{tr("STATUS")}</Th>
                <Th className="px-2.5 py-2.5 text-right text-[10px] tracking-wider text-emerald-600">{tr("TOTAL CREDIT")} (AED)</Th>
                <Th className="px-2.5 py-2.5 text-right text-[10px] tracking-wider text-rose-600">{tr("TOTAL DEBIT")} (AED)</Th>
                <Th className="px-2.5 py-2.5 text-center text-[10px] tracking-wider">{tr("CURR")}</Th>
                <Th className="px-2.5 py-2.5 text-center text-[10px] tracking-wider">{tr("LAST DATE")}</Th>
                <Th className="px-2.5 py-2.5 text-right text-[10px] tracking-wider">{tr("DAYS")}</Th>
                <Th className="px-2.5 py-2.5 text-center text-[10px] tracking-wider">{tr("DR / CR")}</Th>
                <Th className="px-2.5 py-2.5 text-right text-[10px] tracking-wider text-blue-600">{tr("FINAL BALANCE")} (AED)</Th>
                <Th className="px-2.5 py-2.5 text-center text-[10px] tracking-wider">{tr("CONTACT")}</Th>
                <Th className="px-2.5 py-2.5 text-center text-[10px] tracking-wider">{tr("ACTIONS")}</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={17} className="px-3 py-12 text-center text-slate-400">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </td>
                </tr>
              ) : err ? (
                <tr>
                  <td colSpan={17} className="px-3 py-12 text-center text-red-500">
                    {err}
                  </td>
                </tr>
              ) : pagedRows.length === 0 ? (
                <tr>
                  <td colSpan={17} className="px-3 py-12 text-center text-slate-400">
                    {tr("No ledger entries found.")}
                  </td>
                </tr>
              ) : (
                pagedRows.map((x, idx) => {
                  const isOverdue = (x.daysOutstanding ?? 0) > overdueDays;
                  const srNo = (currentPage - 1) * pageSize + idx + 1;
                  const accNo = x.accountNumber || x.code.replace(/^[^\d]+/, '') || "—";
                  const phoneContact = x.contactPhone ? x.contactPhone.replace(/[^\d+]/g, '') : "";

                  return (
                    <tr
                      key={x.id}
                      className={cn(
                        "transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50",
                        isOverdue ? "bg-rose-50/40 dark:bg-rose-950/20" : ""
                      )}
                    >
                      <td className="px-2.5 py-2 text-center font-bold text-slate-600 dark:text-slate-400">{srNo}</td>
                      <td
                        onClick={() => setSelectedLedgerAccount(x)}
                        className="px-2.5 py-2 font-mono text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                        title={tr("Click to view complete ledger statement")}
                      >
                        {x.code}
                      </td>
                      <td className="px-2.5 py-2 font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">
                        {accNo}
                      </td>
                      <td className="px-2.5 py-2 font-black uppercase text-slate-900 dark:text-slate-100">
                        {x.name}
                      </td>
                      <td className="px-2.5 py-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                        <span className="inline-flex items-center gap-1">
                          <span>{getFlag(x.countryName)}</span>
                          <span>{x.countryName || scopeCountry}</span>
                        </span>
                      </td>
                      <td className="px-2.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                        <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          {x.branchName || scopeBranch}
                          {x.branchCode ? ` (${x.branchCode})` : ""}
                        </span>
                      </td>
                      <td className="px-2.5 py-2 text-xs font-medium text-slate-600 dark:text-slate-400">
                        {tv(x.accountType || (x.outstanding > 0 ? "Receivable" : x.outstanding < 0 ? "Payable" : "General"))}
                      </td>
                      <td className="px-2.5 py-2 text-center">
                        {isOverdue ? (
                          <span className="inline-flex items-center rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700 dark:bg-rose-900/40 dark:text-rose-300">
                            {tv("Overdue")}
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                            {tv(x.accountStatus || "Active")}
                          </span>
                        )}
                      </td>
                      <td className="px-2.5 py-2 text-right font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        {fmt(x.creditTotal)}
                      </td>
                      <td className="px-2.5 py-2 text-right font-mono text-xs font-bold text-rose-600 dark:text-rose-400">
                        {fmt(x.debitTotal)}
                      </td>
                      <td className="px-2.5 py-2 text-center font-mono text-xs text-slate-600 dark:text-slate-400">
                        {x.currency || "AED"}
                      </td>
                      <td className="px-2.5 py-2 text-center font-mono text-[11px] text-slate-600 dark:text-slate-400">
                        {formatDateSlash(x.lastMovementDate)}
                      </td>
                      <td className={cn("px-2.5 py-2 text-right font-mono text-xs font-bold", isOverdue ? "text-rose-600 dark:text-rose-400" : "text-slate-700 dark:text-slate-300")}>
                        {x.daysOutstanding ?? "—"}
                      </td>
                      <td className="px-2.5 py-2 text-center font-mono text-xs font-bold">
                        {x.balanceDirection === "DR" ? (
                          <span className="inline-block rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-extrabold text-rose-700 dark:bg-rose-950 dark:text-rose-300">DR</span>
                        ) : x.balanceDirection === "CR" ? (
                          <span className="inline-block rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-extrabold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">CR</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-2.5 py-2 text-right font-mono text-xs font-black text-blue-600 dark:text-blue-400">
                        {fmt(x.finalBalance)}
                      </td>
                      <td className="px-2.5 py-2 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {phoneContact ? (
                            <>
                              <a href={`https://wa.me/${phoneContact.replace(/^\+/, '')}`} target="_blank" rel="noreferrer" className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 hover:bg-emerald-200 dark:bg-emerald-950 dark:text-emerald-400" title={`WhatsApp: ${phoneContact}`}>
                                <MessageSquare className="h-3 w-3" />
                              </a>
                              <a href={`tel:${phoneContact}`} className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 dark:bg-blue-950 dark:text-blue-400" title={`Call: ${phoneContact}`}>
                                <Phone className="h-3 w-3" />
                              </a>
                            </>
                          ) : (
                            <a href="https://wa.me/" target="_blank" rel="noreferrer" className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-400 hover:bg-slate-200 dark:bg-slate-800" title={t(lang, "cbs.whatsapp_word", "WhatsApp")}>
                              <MessageSquare className="h-3 w-3" />
                            </a>
                          )}
                          <a href={x.contactEmail ? `mailto:${x.contactEmail}` : "mailto:info@dgt.llc"} className="flex h-6 w-6 items-center justify-center rounded-full bg-sky-100 text-sky-600 hover:bg-sky-200 dark:bg-sky-950 dark:text-sky-400" title={x.contactEmail ? `${t(lang, "common.email", "Email")}: ${x.contactEmail}` : t(lang, "common.email", "Email")}>
                            <Mail className="h-3 w-3" />
                          </a>
                        </div>
                      </td>
                      <td className="px-2.5 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => setSelectedLedgerAccount(x)}
                          className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-600 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-400"
                        >
                          <Eye className="h-3 w-3" /> {tr("View")}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs text-slate-500 dark:text-slate-400">
          <div>
            Showing {filtered.length ? (currentPage - 1) * pageSize + 1 : 0} to {Math.min(currentPage * pageSize, filtered.length)} of {filtered.length} entries
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
              >
                <option value={10}>10 {tr("per page")}</option>
                <option value={25}>25 {tr("per page")}</option>
                <option value={50}>50 {tr("per page")}</option>
              </select>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage <= 1}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"
              >
                &laquo;
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"
              >
                &lt;
              </button>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-xs font-bold text-white">
                {currentPage}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"
              >
                &gt;
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage >= totalPages}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"
              >
                &raquo;
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Account Ledger Statement Drilldown Modal */}
      {selectedLedgerAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="flex max-h-[92vh] w-full max-w-5xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4 dark:border-slate-800 dark:bg-slate-800/60">
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded bg-blue-600 px-2 py-0.5 font-mono text-xs font-bold text-white">
                    {selectedLedgerAccount.code}
                  </span>
                  <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
                    {selectedLedgerAccount.name}
                  </h3>
                </div>
                <p className="mt-0.5 text-xs text-slate-500">
                  {selectedLedgerAccount.branchName || scopeBranch} ({selectedLedgerAccount.countryName || scopeCountry}) &bull; Currency: {selectedLedgerAccount.currency || "AED"} &bull; Type: {selectedLedgerAccount.accountType}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => router.push(`/dashboard/ledger/new?account=${encodeURIComponent(selectedLedgerAccount.code)}`)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  Open in Full Ledger
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedLedgerAccount(null)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {statementLoading ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                  <p className="mt-3 text-xs font-semibold">Loading account statement...</p>
                </div>
              ) : statementError ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-bold text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
                  {statementError}
                </div>
              ) : (
                <>
                  {/* Account Summary Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/40">
                      <div className="text-[10px] font-bold uppercase text-slate-500">Opening Balance</div>
                      <div className="mt-1 font-mono text-sm font-black text-slate-800 dark:text-slate-200">
                        AED {fmt(Number(statementData?.totals?.openingBalance ?? statementData?.openingBalance ?? 0))}
                      </div>
                    </div>
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                      <div className="text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-400">Total Credit</div>
                      <div className="mt-1 font-mono text-sm font-black text-emerald-600 dark:text-emerald-400">
                        AED {fmt(Number(statementData?.totals?.credit ?? selectedLedgerAccount.creditTotal ?? 0))}
                      </div>
                    </div>
                    <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-3 dark:border-rose-900/40 dark:bg-rose-950/20">
                      <div className="text-[10px] font-bold uppercase text-rose-700 dark:text-rose-400">Total Debit</div>
                      <div className="mt-1 font-mono text-sm font-black text-rose-600 dark:text-rose-400">
                        AED {fmt(Number(statementData?.totals?.debit ?? selectedLedgerAccount.debitTotal ?? 0))}
                      </div>
                    </div>
                    <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3 dark:border-blue-900/40 dark:bg-blue-950/20">
                      <div className="text-[10px] font-bold uppercase text-blue-700 dark:text-blue-400">Final Balance</div>
                      <div className="mt-1 flex items-baseline gap-1 font-mono text-sm font-black text-blue-600 dark:text-blue-400">
                        <span>AED {fmt(Number(statementData?.totals?.balance ?? selectedLedgerAccount.finalBalance ?? 0))}</span>
                        <span className="text-[10px] font-extrabold">{selectedLedgerAccount.balanceDirection}</span>
                      </div>
                    </div>
                  </div>

                  {/* Statement Lines Table */}
                  <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                    <table className="w-full min-w-[800px] text-xs">
                      <thead className="bg-slate-100/80 text-left font-bold uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        <tr>
                          <th className="px-3 py-2 text-center text-[10px]">Date</th>
                          <th className="px-3 py-2 text-[10px]">Voucher No</th>
                          <th className="px-3 py-2 text-[10px]">Journal No</th>
                          <th className="px-3 py-2 text-[10px]">Type</th>
                          <th className="px-3 py-2 text-[10px]">Narration</th>
                          <th className="px-3 py-2 text-[10px]">Branch</th>
                          <th className="px-3 py-2 text-right text-[10px] text-rose-600">Debit</th>
                          <th className="px-3 py-2 text-right text-[10px] text-emerald-600">Credit</th>
                          <th className="px-3 py-2 text-right text-[10px] text-blue-600">Balance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {statementData?.lines && statementData.lines.length > 0 ? (
                          statementData.lines.map((line: any, idx: number) => (
                            <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                              <td className="px-3 py-2 text-center font-mono text-[11px] text-slate-600 dark:text-slate-400">
                                {formatDateSlash(line.date)}
                              </td>
                              <td className="px-3 py-2 font-mono text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                                {line.voucherNo || "—"}
                              </td>
                              <td className="px-3 py-2 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                                {line.journalNo || "—"}
                              </td>
                              <td className="px-3 py-2 text-[11px] font-medium text-slate-600 dark:text-slate-400">
                                {line.entryType || line.type || "—"}
                              </td>
                              <td className="px-3 py-2 text-[11px] text-slate-700 dark:text-slate-300 max-w-xs truncate" title={line.narration}>
                                {line.narration || "—"}
                              </td>
                              <td className="px-3 py-2 text-[11px] text-slate-600 dark:text-slate-400">
                                {line.branch || selectedLedgerAccount.branchName || scopeBranch}
                              </td>
                              <td className="px-3 py-2 text-right font-mono text-xs font-bold text-rose-600">
                                {line.debit ? fmt(line.debit) : "—"}
                              </td>
                              <td className="px-3 py-2 text-right font-mono text-xs font-bold text-emerald-600">
                                {line.credit ? fmt(line.credit) : "—"}
                              </td>
                              <td className="px-3 py-2 text-right font-mono text-xs font-black text-blue-600">
                                {fmt(line.runningBalance ?? 0)}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={9} className="px-3 py-8 text-center text-xs text-slate-400">
                              No statement entries found for this ledger.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-3 dark:border-slate-800 dark:bg-slate-800/60">
              <span className="text-[11px] text-slate-500">
                Total statement entries: {statementData?.lines?.length ?? 0}
              </span>
              <button
                type="button"
                onClick={() => setSelectedLedgerAccount(null)}
                className="rounded-lg bg-slate-900 px-4 py-1.5 text-xs font-bold text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
