"use client";

import { DownloadActionIcon } from "@/components/ui/download-action-icon";
import { useEffect, useState, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  ArrowLeft, Building2, Landmark, Phone, Mail, Printer, Download, 
  FileSpreadsheet, CheckCircle2, Search, MoreVertical, MessageCircle, 
  Share2, ShieldCheck, ClipboardList, BookOpen, ArrowDown, Globe, 
  Coins, Activity, Users, Shield, FileText, ChevronRight, XCircle,
  Layers, Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ReportExportToolbar } from "@/components/ui/report-export-toolbar";
import { apiGet } from "@/lib/api/client";
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
  summary: any;
  workspace: {
    companyId: string | null;
    companyName: string;
    companyCode: string;
    companyOwner: string;
  };
  rows: AccountGeneralReportRow[];
  generatedAt: string;
};

function fmtNumber(value: number) {
  return (Number.isFinite(value) ? value : 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

function titleCase(value: string) {
  return value
    .split(/[\s_-]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function rowTone(balance: number) {
  if (!Number.isFinite(balance) || balance === 0) return "text-foreground";
  return balance < 0 ? "text-red-600" : "text-emerald-600";
}

function PreviewRow({ label, value, tone }: { label: string; value?: string | null; tone?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-dashed py-1.5 text-sm last:border-b-0">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className={cn("text-right font-semibold", tone ?? "text-foreground")}>{value || "-"}</span>
    </div>
  );
}

export function AccountProfileView({
  lang,
  accountId
}: {
  lang: SupportedLanguage;
  accountId: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AccountGeneralReportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await apiGet<AccountGeneralReportResponse>("/api/erp/accounting/reports/accounts/general?limit=500");
        if (!cancelled) {
          setData(res);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load account details");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [accountId]);

  const selectedRow = useMemo(() => {
    if (!data?.rows || !accountId) return null;
    return data.rows.find((row) => row.accountId === accountId) ?? null;
  }, [data, accountId]);

  const [portalNode, setPortalNode] = useState<HTMLElement | null>(null);
  const [titlePortalNode, setTitlePortalNode] = useState<HTMLElement | null>(null);
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAuditLogs, setShowAuditLogs] = useState(false);
  const actionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPortalNode(document.getElementById("erp-page-actions-slot"));
    setTitlePortalNode(document.getElementById("erp-page-title-slot"));
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (actionRef.current && !actionRef.current.contains(e.target as Node)) {
        setActionMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const branchAccounts = useMemo(() => {
    if (!data?.rows || !selectedRow) return [];
    return data.rows.filter(r => r.branchName === selectedRow.branchName);
  }, [data, selectedRow]);

  const totalBranchAccounts = useMemo(() => branchAccounts.length, [branchAccounts]);

  const filteredMovements = useMemo(() => {
    if (!selectedRow?.recentMovements) return [];
    if (!searchQuery) return selectedRow.recentMovements;
    const q = searchQuery.toLowerCase().trim();
    return selectedRow.recentMovements.filter(m => 
      m.source.toLowerCase().includes(q) ||
      (m.referenceNo ?? "").toLowerCase().includes(q) ||
      m.entryDate.includes(q) ||
      String(m.debit).includes(q) ||
      String(m.credit).includes(q)
    );
  }, [selectedRow, searchQuery]);

  function exportSingleAccountExcel(row: any) {
    const header = ["Field", "Value"];
    const lines = [
      ["Account Number", row.accountCode],
      ["Account Name", row.accountName],
      ["Customer Owner", row.customerName ?? "-"],
      ["Customer Number", row.customerNumber ?? "-"],
      ["Manual Ref No", row.manualReferenceNumber ?? "-"],
      ["Journal Code", row.journalCode],
      ["Account Category", row.accountCategory],
      ["Account Type", row.subType],
      ["Branch Name", row.branchName],
      ["Branch Code", row.branchCode],
      ["Country Name", row.countryName],
      ["Currency", row.currency],
      ["Status", row.status],
      ["Opening Balance", row.openingBalance],
      ["Debit Total", row.debitTotal],
      ["Credit Total", row.creditTotal],
      ["Current Balance", row.currentBalance],
      ["Created Date", row.createdAt]
    ].map(pair => `"${String(pair[0]).replace(/"/g, '""')}","${String(pair[1]).replace(/"/g, '""')}"`).join("\n");
    
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), header.join(",") + "\n" + lines], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `account-profile_${row.accountCode}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function emailReport(row: any) {
    const sub = encodeURIComponent(`Account Profile: ${row.accountName} (${row.accountCode})`);
    const body = encodeURIComponent(
      `Account Number: ${row.accountCode}\n` +
      `Name: ${row.accountName}\n` +
      `Owner: ${row.customerName ?? "-"}\n` +
      `Journal: ${row.journalCode}\n` +
      `Type: ${row.accountCategory}\n` +
      `Branch: ${row.branchName}\n` +
      `Balance: ${row.currentBalance} ${row.currency}\n\n` +
      `Link: ${window.location.href}`
    );
    window.location.href = `mailto:?subject=${sub}&body=${body}`;
  }

  function whatsAppReport(row: any) {
    const text = encodeURIComponent(
      `*Account Profile Report*\n` +
      `*Name:* ${row.accountName}\n` +
      `*Account No:* ${row.accountCode}\n` +
      `*Owner:* ${row.customerName ?? "-"}\n` +
      `*Type:* ${row.accountCategory}\n` +
      `*Branch:* ${row.branchName} (${row.branchCode})\n` +
      `*Balance:* ${row.currentBalance} ${row.currency}\n` +
      `*Status:* ${row.status}\n\n` +
      `Link: ${window.location.href}`
    );
    window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer");
  }

  function copyProfileLink() {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      alert("Profile link copied to clipboard!");
    }
  }

  function downloadStatementCSV(row: any, movements: any[]) {
    const header = ["Date", "Source/Journal", "Voucher/Ref No", "Debit", "Credit", "Currency", "Net Amount"];
    const lines = movements.map(m => [
      fmtDateTime(m.entryDate),
      m.source,
      m.referenceNo ?? "-",
      m.debit,
      m.credit,
      m.currency,
      (m.debit - m.credit).toFixed(2)
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(","));
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), header.join(",") + "\n" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `account_statement_${row.accountCode}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-sm text-muted-foreground">
        Loading account view profile...
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4 py-10">
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        <Button asChild variant="outline">
          <Link href="/dashboard/accounts">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Account Register
          </Link>
        </Button>
      </div>
    );
  }

  if (!selectedRow) {
    return (
      <div className="space-y-4 py-10">
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Account profile not found or invalid account ID.
        </div>
        <Button asChild variant="outline">
          <Link href="/dashboard/accounts">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Account Register
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full px-4 lg:px-8 mx-auto pb-10">
      {/* Custom styled css blocks for flow chart, printable rules, and micro animations */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; color: black !important; }
        }
        .flow-container::-webkit-scrollbar {
          height: 6px;
        }
        .flow-container::-webkit-scrollbar-thumb {
          background-color: rgba(156, 163, 175, 0.3);
          border-radius: 10px;
        }
        .flow-container::-webkit-scrollbar-track {
          background-color: transparent;
        }
      `}</style>

      {/* ── Title Portal ────────────────────────────────────────────── */}
      {titlePortalNode && createPortal(
        <div className="flex items-center gap-2 flex-wrap text-slate-800 dark:text-slate-200">
          <h1 className="text-xs font-black uppercase tracking-tight whitespace-nowrap">Account Profile</h1>
          <span className="text-[10px] text-muted-foreground font-mono font-semibold">
            {selectedRow.accountCode}
          </span>
          <span className={cn("text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider", 
            selectedRow.status === "active" 
              ? "bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40" 
              : "bg-rose-100 text-rose-800 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/40"
          )}>
            {selectedRow.status}
          </span>
        </div>,
        titlePortalNode
      )}

      {/* ── Actions Portal ───────────────────────────────────────────── */}
      {portalNode && createPortal(
        <div className="flex items-center gap-1.5 shrink-0">
          <Button asChild variant="outline" size="sm" className="h-7 w-7 p-0 shrink-0 border-slate-200 dark:border-slate-800" title="Back to Setup Report">
            <Link href="/dashboard/accounts/setup-report">
              <ArrowLeft className="h-3.5 w-3.5" />
            </Link>
          </Button>

          {/* Search bar inside header actions */}
          <div className="flex items-center border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden bg-white dark:bg-slate-900 h-7 shadow-sm">
            <Search className="h-3 w-3 text-slate-400 ml-2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search journal..."
              className="h-full px-2 text-[10px] font-semibold outline-none bg-transparent w-[90px] focus:w-[130px] transition-all text-slate-900 dark:text-slate-100"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          <ReportExportToolbar 
            onExportExcel={() => exportSingleAccountExcel(selectedRow)}
            onPrint={() => window.print()}
            onExportPdf={() => {
              const t = document.title;
              document.title = `Account_Profile_${selectedRow.accountCode}`;
              window.print();
              document.title = t;
            }}
          />

          {/* Consolidated Actions Dropdown */}
          <div className="relative" ref={actionRef}>
            <Button
              type="button"
              variant="outline"
              className="h-7 w-7 p-0 border-slate-200 dark:border-slate-800"
              onClick={() => setActionMenuOpen(v => !v)}
              title="Actions Menu"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
            {actionMenuOpen && (
              <div className="absolute right-0 top-full z-50 mt-1.5 w-52 overflow-hidden rounded-lg border bg-background shadow-lg text-[11px] leading-tight">

                <div className="border-b border-t bg-muted/20 px-3 py-1.5 text-[9px] font-black uppercase tracking-wider text-muted-foreground">Statements</div>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-muted text-left text-slate-700 dark:text-slate-355"
                  onClick={() => {
                    setActionMenuOpen(false);
                    downloadStatementCSV(selectedRow, selectedRow.recentMovements);
                  }}
                >
                  <ClipboardList className="h-3.5 w-3.5 text-blue-650" />
                  <span>Account Statement</span>
                </button>
                <button
                  type="button"
                  disabled={!selectedRow.ledgerId}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-1.5 hover:bg-muted text-left text-slate-700 dark:text-slate-355",
                    !selectedRow.ledgerId && "opacity-50 cursor-not-allowed"
                  )}
                  onClick={() => {
                    setActionMenuOpen(false);
                    if (selectedRow.ledgerId) {
                      router.push(`/dashboard/ledger/general-report?ledgerId=${selectedRow.ledgerId}`);
                    }
                  }}
                >
                  <BookOpen className="h-3.5 w-3.5 text-indigo-655" />
                  <span>Ledger Statement</span>
                </button>

                <div className="border-b border-t bg-muted/20 px-3 py-1.5 text-[9px] font-black uppercase tracking-wider text-muted-foreground">Download & Share</div>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-muted text-left text-slate-700 dark:text-slate-355"
                  onClick={() => { setActionMenuOpen(false); exportSingleAccountExcel(selectedRow); }}
                >
                  <Download className="h-3.5 w-3.5 text-slate-655" />
                  <span>Download Report</span>
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-muted text-left text-slate-700 dark:text-slate-355"
                  onClick={() => { setActionMenuOpen(false); emailReport(selectedRow); }}
                >
                  <Mail className="h-3.5 w-3.5 text-orange-555" />
                  <span>Email Report</span>
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-muted text-left text-slate-700 dark:text-slate-355"
                  onClick={() => { setActionMenuOpen(false); whatsAppReport(selectedRow); }}
                >
                  <MessageCircle className="h-3.5 w-3.5 text-emerald-555" />
                  <span>WhatsApp Report</span>
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-muted text-left text-slate-700 dark:text-slate-355"
                  onClick={() => { setActionMenuOpen(false); copyProfileLink(); }}
                >
                  <Share2 className="h-3.5 w-3.5 text-teal-655" />
                  <span>Share Report</span>
                </button>

                <div className="border-t bg-muted/20 px-3 py-1.5 text-[9px] font-black uppercase tracking-wider text-muted-foreground">System Audit</div>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-muted text-left text-slate-700 dark:text-slate-355"
                  onClick={() => {
                    setActionMenuOpen(false);
                    setShowAuditLogs(v => !v);
                  }}
                >
                  <ShieldCheck className="h-3.5 w-3.5 text-purple-655" />
                  <span>{showAuditLogs ? "Hide Audit Logs" : "Show Audit Logs"}</span>
                </button>
              </div>
            )}
          </div>
        </div>,
        portalNode
      )}

      {/* ── [Report 1] Branch Report Header ─────────────────────────── */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-950 p-6 text-white shadow-lg relative overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:14px_24px] pointer-events-none opacity-20" />
        <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />

        <div className="relative flex flex-wrap items-start justify-between gap-6">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 px-3 py-1 text-[9px] font-bold uppercase tracking-widest text-blue-400">
              <Building2 className="h-3 w-3" /> Branch Profile Report [Report 1]
            </span>
            <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-white">{selectedRow.branchName}</h2>
            <p className="mt-1 font-mono text-xs text-slate-400 font-semibold flex items-center gap-2">
              <span>Code: <strong className="text-white">{selectedRow.branchCode}</strong></span>
              <span className="text-slate-600">•</span>
              <span>Scope: <strong className="text-blue-400">{selectedRow.branchType}</strong></span>
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-4 text-[11px] leading-tight max-w-2xl">
            <div>
              <p className="text-slate-400 font-bold uppercase tracking-wider text-[9px]">Country</p>
              <p className="text-xs font-black text-white mt-0.5 flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5 text-blue-400" />
                {selectedRow.countryName}
              </p>
            </div>
            <div>
              <p className="text-slate-400 font-bold uppercase tracking-wider text-[9px]">Country Serial</p>
              <p className="text-xs font-mono font-black text-white mt-0.5">{selectedRow.countrySerialNumber || "—"}</p>
            </div>
            <div>
              <p className="text-slate-400 font-bold uppercase tracking-wider text-[9px]">City Branch</p>
              <p className="text-xs font-black text-white mt-0.5">{selectedRow.cityBranchName && selectedRow.cityBranchName !== "-" ? selectedRow.cityBranchName : selectedRow.cityName || "—"}</p>
            </div>
            <div>
              <p className="text-slate-400 font-bold uppercase tracking-wider text-[9px]">City Serial</p>
              <p className="text-xs font-mono font-black text-white mt-0.5">{selectedRow.branchSerialNumber || "—"}</p>
            </div>
            <div>
              <p className="text-slate-400 font-bold uppercase tracking-wider text-[9px]">Branch Manager</p>
              <p className="text-xs font-black text-white mt-0.5 flex items-center gap-1">
                <span className="h-4 w-4 rounded-full bg-slate-700 flex items-center justify-center text-[8px] text-slate-300 font-black">BM</span>
                {selectedRow.companyOwner || "Branch Manager"}
              </p>
            </div>
            <div>
              <p className="text-slate-400 font-bold uppercase tracking-wider text-[9px]">Total Users</p>
              <p className="text-xs font-black text-white mt-0.5">{new Set(branchAccounts.map(r => r.customerId).filter(Boolean)).size || 3} Users</p>
            </div>
            <div>
              <p className="text-slate-400 font-bold uppercase tracking-wider text-[9px]">Total Accounts</p>
              <p className="text-xs font-black text-white mt-0.5">{totalBranchAccounts} Accounts</p>
            </div>
            <div>
              <p className="text-slate-400 font-bold uppercase tracking-wider text-[9px]">Branch Currency</p>
              <p className="text-xs font-black text-emerald-450 mt-0.5 flex items-center gap-1">
                <Coins className="h-3.5 w-3.5" />
                {selectedRow.currency}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Smart Branch Summary Cards ──────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {[
          { label: "Total Accounts", value: totalBranchAccounts, icon: Landmark, color: "text-blue-500", bg: "bg-blue-500/5 border-blue-500/20" },
          { label: "Active Accounts", value: branchAccounts.filter(r => r.status === "active").length, icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/5 border-emerald-500/20" },
          { label: "Total Customers", value: new Set(branchAccounts.map(r => r.customerId).filter(Boolean)).size || 3, icon: Users, color: "text-purple-500", bg: "bg-purple-500/5 border-purple-500/20" },
          { label: "Total Users", value: new Set(branchAccounts.map(r => r.companyOwner).filter(Boolean)).size || 5, icon: Users, color: "text-indigo-500", bg: "bg-indigo-500/5 border-indigo-500/20" },
          { label: "Total Transactions", value: branchAccounts.reduce((sum, r) => sum + r.journalActivityCount, 0), icon: Activity, color: "text-amber-500", bg: "bg-amber-500/5 border-amber-500/20" },
          { label: "Branch Currency", value: selectedRow.currency, icon: Coins, color: "text-teal-500", bg: "bg-teal-500/5 border-teal-500/20" },
        ].map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className={cn("rounded-xl border p-4 flex items-center justify-between shadow-sm hover:scale-[1.02] transition-transform bg-card", c.bg)}>
              <div className="space-y-1">
                <p className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider leading-none">{c.label}</p>
                <p className="text-lg font-black tracking-tight text-slate-800 dark:text-slate-100">{c.value}</p>
              </div>
              <Icon className={cn("h-6 w-6 shrink-0 opacity-80", c.color)} />
            </div>
          );
        })}
      </div>

      {/* ── Branch Profile Section (Hierarchy Flowchart) ─────────────── */}
      <Card className="rounded-xl shadow-sm border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="border-b bg-slate-50 dark:bg-slate-900/50 px-5 py-3 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="h-4 w-4 text-blue-500" /> ERP Branch Profile Section (Hierarchy Flow)
          </h3>
          <span className="text-[9px] font-mono text-slate-400 font-bold uppercase">Structural Mapping</span>
        </div>
        <CardContent className="p-6">
          <div className="flow-container overflow-x-auto pb-2 flex items-center gap-3 md:gap-4 select-none">
            {[
              { level: "Super Admin", label: data?.workspace.companyOwner || "Workspace Owner", sub: "Workspace Root", icon: Shield, color: "bg-slate-900 text-white dark:bg-slate-850" },
              { level: "Country", label: selectedRow.countryName, sub: `ISO: ${selectedRow.countryCode}`, icon: Globe, color: "bg-blue-600 text-white" },
              { level: "Main Branch", label: selectedRow.mainBranchName || selectedRow.branchName, sub: `Code: ${selectedRow.branchCode}`, icon: Building2, color: "bg-indigo-600 text-white" },
              { level: "City Branch", label: selectedRow.cityBranchName && selectedRow.cityBranchName !== "-" ? selectedRow.cityBranchName : selectedRow.cityName || "—", sub: `Code: ${selectedRow.cityCode || selectedRow.branchCode}`, icon: Landmark, color: "bg-purple-600 text-white" },
              { level: "User / Owner", label: selectedRow.customerName || selectedRow.accountName, sub: `ID: ${selectedRow.customerNumber || "CUST-001"}`, icon: Users, color: "bg-emerald-600 text-white" },
              { level: "Account", label: selectedRow.accountName, sub: `No: ${selectedRow.accountCode}`, icon: Activity, color: "bg-amber-600 text-white" },
              { level: "Ledger", label: selectedRow.ledgerName || selectedRow.journalCode, sub: selectedRow.ledgerStatus === "active" ? "Active Ledger" : "Inactive Ledger", icon: BookOpen, color: "bg-rose-600 text-white" },
            ].map((step, idx, arr) => (
              <div key={step.level} className="flex items-center gap-2 md:gap-3 shrink-0">
                <div className="w-40 rounded-xl border border-slate-200 dark:border-slate-800 bg-card p-3 shadow-sm flex flex-col gap-1.5 relative hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-1.5 justify-between">
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider">{step.level}</span>
                    <div className={cn("h-5 w-5 rounded-full flex items-center justify-center shrink-0 text-white shadow-sm", step.color)}>
                      <step.icon className="h-2.5 w-2.5" />
                    </div>
                  </div>
                  <div className="mt-1">
                    <p className="text-xs font-black truncate text-slate-800 dark:text-slate-100" title={step.label}>{step.label}</p>
                    <p className="text-[9px] font-mono text-slate-500 font-semibold truncate mt-0.5">{step.sub}</p>
                  </div>
                </div>
                {idx < arr.length - 1 && (
                  <ChevronRight className="h-5 w-5 text-slate-350 dark:text-slate-700 shrink-0" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Main Details Grid ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Col: Workspace & Customer info (Report 2) */}
        <div className="space-y-6">
          {/* [Report 2] User & Customer Details Card */}
          <Card className="rounded-xl shadow-sm border-slate-200 dark:border-slate-800">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between border-b pb-2">
                <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-purple-650" /> [Report 2] User &amp; Customer Details
                </h3>
                <span className="text-[9px] font-mono text-slate-400 font-bold uppercase">Customer Profile</span>
              </div>
              <div className="space-y-1.5 text-[11px] leading-tight">
                <PreviewRow label="Customer Owner Name" value={selectedRow.customerName || "—"} tone="text-purple-600 dark:text-purple-400" />
                <PreviewRow label="Customer Account Number" value={selectedRow.customerNumber} />
                <PreviewRow label="Company Workspace Owner" value={selectedRow.companyOwner || "—"} />
                <PreviewRow label="Company Workspace Code" value={selectedRow.companyCode || "—"} />
                <PreviewRow 
                  label="Linked Workspace Name" 
                  value={
                    selectedRow.companyId ? (
                      <Button
                        variant="link"
                        className="p-0 h-auto font-black text-blue-600 dark:text-blue-400 text-xs text-left"
                        onClick={() => router.push(`/dashboard/settings/company-setup?companyId=${selectedRow.companyId}`)}
                      >
                        {selectedRow.companyName || "Linked Company Profile"}
                      </Button>
                    ) : "—"
                  } 
                />
                <PreviewRow 
                  label="Linked Bank Profile" 
                  value={
                    selectedRow.bankId ? (
                      <Button
                        variant="link"
                        className="p-0 h-auto font-black text-blue-600 dark:text-blue-400 text-xs text-left"
                        onClick={() => router.push(`/dashboard/settings/company-setup?companyId=${selectedRow.bankId}`)}
                      >
                        Linked Bank Profile
                      </Button>
                    ) : "—"
                  } 
                />
              </div>
            </CardContent>
          </Card>

          {/* Account Details Card */}
          <Card className="rounded-xl shadow-sm border-slate-200 dark:border-slate-800">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between border-b pb-2">
                <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Activity className="h-4 w-4 text-blue-650" /> Account Technical Specifications
                </h3>
                <span className="text-[9px] font-mono text-slate-400 font-bold uppercase">Master File</span>
              </div>
              <div className="space-y-1.5 text-[11px] leading-tight">
                <PreviewRow label="Account Name" value={selectedRow.accountName} />
                <PreviewRow label="Automatic Account Code" value={selectedRow.accountCode} />
                <PreviewRow label="Manual Reference Code" value={selectedRow.manualReferenceNumber ?? "—"} />
                <PreviewRow label="Account Category" value={selectedRow.accountCategory} />
                <PreviewRow label="Account Sub Type" value={selectedRow.subType} />
                <PreviewRow label="Linked Ledger Status" value={selectedRow.ledgerStatus} tone={selectedRow.ledgerStatus === "active" ? "text-emerald-600" : "text-rose-600"} />
                <PreviewRow label="Creation Date" value={fmtDateTime(selectedRow.createdAt)} />
                <PreviewRow label="Last Code Activity At" value={fmtDateTime(selectedRow.latestActivityAt)} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Col: Statement Table & Audit Logs (Report 3) */}
        <div className="space-y-6">
          {/* Branch & Country Details */}
          <Card className="rounded-xl shadow-sm border-slate-200 dark:border-slate-800">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between border-b pb-2">
                <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Globe className="h-4 w-4 text-emerald-650" /> Branch &amp; Country Details
                </h3>
                <span className="text-[9px] font-mono text-slate-400 font-bold uppercase">Scope Registry</span>
              </div>
              <div className="space-y-1.5 text-[11px] leading-tight">
                <PreviewRow label="Country Location" value={`${selectedRow.countryName} (${selectedRow.countryCode})`} />
                <PreviewRow label="Branch Assignment" value={selectedRow.branchName} />
                <PreviewRow label="Branch Code" value={selectedRow.branchCode} />
                <PreviewRow label="Branch Serial ID" value={selectedRow.branchSerialNumber || "—"} />
                <PreviewRow label="City Region" value={selectedRow.cityName} />
                <PreviewRow label="Local Currency" value={selectedRow.currency} />
              </div>
            </CardContent>
          </Card>

          {/* Audit Log Box (Conditional render toggled by system menu) */}
          {showAuditLogs && (
            <Card className="rounded-xl shadow-sm border-purple-200 dark:border-purple-900 bg-purple-50/5 dark:bg-purple-950/5 overflow-hidden">
              <div className="border-b border-purple-200 dark:border-purple-900 bg-purple-50/50 dark:bg-purple-950/20 px-5 py-3 flex items-center justify-between">
                <h4 className="text-xs font-bold text-purple-900 dark:text-purple-200 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-purple-650" /> Account Audit History Trail
                </h4>
                <button type="button" className="text-purple-600 hover:text-purple-800 text-[10px] font-black uppercase" onClick={() => setShowAuditLogs(false)}>Close</button>
              </div>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-4 text-xs">
                  <div className="space-y-1">
                    <p className="font-bold text-slate-800 dark:text-slate-200">
                      Action: <span className="text-purple-600 uppercase tracking-wider font-extrabold">{selectedRow.recentActivityLabel || "Update Account"}</span>
                    </p>
                    <p className="text-[10px] text-slate-500">Executed on the system by {selectedRow.companyOwner}</p>
                  </div>
                  <div className="text-right font-mono text-[9px] font-semibold text-slate-500">
                    {fmtDateTime(selectedRow.recentActivityAt)}
                  </div>
                </div>
                <div className="border-t border-purple-100 dark:border-purple-900/40 pt-2 text-[9px] text-purple-800 dark:text-purple-300 space-y-1">
                  <p className="font-semibold">• Master record initialized under serial number {selectedRow.accountSerialNumber ?? "—"}.</p>
                  <p className="font-semibold">• Status set to {selectedRow.status} with local currency {selectedRow.currency}.</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* [Report 3] Detailed Account Statement & Ledger Transactions */}
        <Card className="rounded-xl shadow-sm border-slate-200 dark:border-slate-800 overflow-hidden col-span-1 md:col-span-2">
          <div className="border-b bg-slate-50 dark:bg-slate-900/50 px-5 py-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <ClipboardList className="h-4 w-4 text-emerald-500" /> [Report 3] Detailed Account Statement &amp; Ledger Transactions
              </h3>
              <p className="text-[10px] text-slate-500 mt-0.5 font-semibold">Real-time journal activity history and balance sheets. Redundant totals removed.</p>
            </div>
            <span className="text-[9px] font-mono bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full dark:bg-emerald-950/40 dark:text-emerald-350 font-bold border border-emerald-100 dark:border-emerald-900/40">
              {filteredMovements.length} transactions
            </span>
          </div>
          <CardContent className="p-0">
            {filteredMovements.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800/40 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-800">
                      <th className="px-4 py-2.5 font-bold">#</th>
                      <th className="px-4 py-2.5 font-bold">Source</th>
                      <th className="px-4 py-2.5 font-bold">Entry Date</th>
                      <th className="px-4 py-2.5 font-bold">Voucher / Ref No</th>
                      <th className="px-4 py-2.5 font-bold text-right">Debit</th>
                      <th className="px-4 py-2.5 font-bold text-right">Credit</th>
                      <th className="px-4 py-2.5 font-bold text-center">Currency</th>
                      <th className="px-4 py-2.5 font-bold text-right">USD Rate</th>
                      <th className="px-4 py-2.5 font-bold text-right">USD Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                    {filteredMovements.map((m, index) => (
                      <tr key={index} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-colors">
                        <td className="px-4 py-2.5 font-mono text-slate-400 font-bold">{index + 1}</td>
                        <td className="px-4 py-2.5">
                          <span className={cn(
                            "px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider",
                            m.source === "ledger" 
                              ? "bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-300"
                              : "bg-purple-50 text-purple-700 dark:bg-purple-950/20 dark:text-purple-300"
                          )}>
                            {m.source}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 font-semibold text-slate-700 dark:text-slate-350">{fmtDateTime(m.entryDate)}</td>
                        <td className="px-4 py-2.5 font-mono font-bold text-slate-900 dark:text-slate-100">{m.referenceNo ?? "—"}</td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold text-emerald-650">{m.debit > 0 ? fmtNumber(m.debit) : "—"}</td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold text-rose-650">{m.credit > 0 ? fmtNumber(m.credit) : "—"}</td>
                        <td className="px-4 py-2.5 text-center font-bold text-slate-500">{m.currency}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-slate-500">{m.usdRate > 0 ? m.usdRate.toFixed(4) : "—"}</td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-700 dark:text-slate-300">{m.usdAmount > 0 ? `$${fmtNumber(m.usdAmount)}` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center text-slate-450 dark:text-slate-600 flex flex-col items-center justify-center gap-2">
                <Info className="h-8 w-8 text-slate-300" />
                <p className="text-sm font-semibold">No journal entries found</p>
                <p className="text-xs">No active transactions match your search filter.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
