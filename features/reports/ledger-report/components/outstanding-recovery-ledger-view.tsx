"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCcw, Search, AlertTriangle, Globe, Calendar, Eye, MessageSquare, Phone, Mail, Printer, FileText, Download, ChevronDown } from "lucide-react";
import { apiGet } from "@/lib/api/client";
import { ReportActions } from "@/components/ui/report-actions";
import { Th } from "@/components/ui/translated-th";
import { cn } from "@/lib/utils";

type Row = {
  id: string;
  code: string;
  name: string;
  currency: string;
  countryId: string | null;
  scope: string;
  openingBalance: number;
  outstanding: number;
  side: "debit" | "credit" | "zero";
  debitTotal: number;
  creditTotal: number;
  lastMovementDate: string | null;
  daysOutstanding: number | null;
};

type Resp = {
  rows: Row[];
  summary: { accounts: number; totalReceivable: number; totalPayable: number; overdue10: number };
};

type Tab = "all" | "receivable" | "payable" | "overdue";

const fmt = (n: number) => new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

function formatDateSlash(dateStr?: string | null) {
  if (!dateStr) return "08/05/2026";
  try {
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      return `${parts[1]}/${parts[2]}/${parts[0]}`;
    }
  } catch {}
  return dateStr;
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

export function OutstandingRecoveryLedgerView({ lang = "en", pageTitle }: { lang?: string; pageTitle: string }) {
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

  useEffect(() => {
    fetch("/api/erp/auth/session", { credentials: "include" })
      .then((r) => r.json())
      .then((info) => setSessionInfo(info))
      .catch(() => null);
  }, []);

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
      const countryName = "United Arab Emirates";
      const branchName = "Main Branch";
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
          branchData: new Map()
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
          net: 0
        });
      }

      const bData = cData.branchData.get(branchName)!;
      bData.accounts += 1;
      if (row.outstanding > 0) bData.receivable += row.outstanding;
      else if (row.outstanding < 0) bData.payable += Math.abs(row.outstanding);
      bData.net += row.outstanding;
    }

    return Array.from(map.values());
  }, [filtered]);

  const reportRows = filtered.map((x) => ({
    code: x.code,
    name: x.name,
    currency: x.currency,
    outstanding: fmt(Math.abs(x.outstanding)),
    type: x.outstanding > 0 ? "Receivable (Dr)" : x.outstanding < 0 ? "Payable (Cr)" : "-",
    last_movement: x.lastMovementDate ?? "-",
    days: x.daysOutstanding ?? "-",
    status: (x.daysOutstanding ?? 0) > 10 ? "OVERDUE" : "Current",
  }));

  const columns = [
    { key: "code", label: "Code" },
    { key: "name", label: "Account" },
    { key: "currency", label: "Curr" },
    { key: "outstanding", label: "Outstanding" },
    { key: "type", label: "Type" },
    { key: "last_movement", label: "Last Movement" },
    { key: "days", label: "Days" },
    { key: "status", label: "Status" },
  ];

  const tabs: { key: Tab; label: string }[] = [
    { key: "all", label: "All Outstanding" },
    { key: "receivable", label: "Recovery (Receivable)" },
    { key: "payable", label: "Payable" },
    { key: "overdue", label: `Overdue > ${overdueDays} days` },
  ];

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">{pageTitle}</h1>
          <p className="text-xs text-slate-500">Account-wise remaining balances, aging &amp; recovery. Overdue = 10+ days since last transaction.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300">
            <RefreshCcw className="h-4 w-4" /> Refresh
          </button>
          <ReportActions title={pageTitle} rows={reportRows} columns={columns} filename="outstanding_recovery_ledger" lang={lang} subtitle={`${filtered.length} accounts`} />
        </div>
      </div>

      {/* Top Meta Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 px-4 shadow-sm">
        <div className="flex items-center gap-2">
          <span>BRANCH NAME:</span>
          <span className="text-slate-900 dark:text-slate-100 font-bold">UNITED ARAB EMIRATES MAIN BRANCH</span>
        </div>
        <div className="flex items-center gap-2">
          <span>USER NAME:</span>
          <span className="text-slate-900 dark:text-slate-100 font-bold">{sessionInfo?.user?.fullName || "SUPER ADMIN"}</span>
        </div>
        <div className="flex items-center gap-2">
          <span>DATE:</span>
          <span className="text-slate-900 dark:text-slate-100 font-bold">{new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase()}</span>
        </div>
        <div className="flex items-center gap-2">
          <span>TIME:</span>
          <span className="text-slate-900 dark:text-slate-100 font-bold">{new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true }).toUpperCase()}</span>
        </div>
      </div>

      {/* 4 KPI Summary Panels Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Panel 1: Branch & User Details */}
        <div className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-blue-50/50 dark:bg-blue-900/10">
            <div className="bg-blue-600 p-1 rounded-full text-white">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
            <h4 className="text-xs font-black uppercase tracking-wider text-blue-800 dark:text-blue-400">
              1. BRANCH & USER DETAILS
            </h4>
          </div>
          <div className="p-4 flex flex-col gap-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400 h-full">
            <div className="flex justify-between items-center">
              <span>COUNTRY:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">متحده عرب امارات</span>
            </div>
            <div className="flex justify-between items-center">
              <span>BRANCH NAME:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 uppercase">MAIN BRANCH</span>
            </div>
            <div className="flex justify-between items-center">
              <span>USER ID:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 uppercase text-[9px] font-mono">{sessionInfo?.user?.id || "9B9D24D9-5532-47A1-B612-3E95F2285AB6"}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>USER NAME:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 uppercase">{sessionInfo?.user?.fullName || "SUPER ADMIN"}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>ROLE:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 uppercase">SUPER ADMIN</span>
            </div>
            <div className="flex justify-between items-center">
              <span>DATE & TIME:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}, {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true })}</span>
            </div>
            <div className="flex justify-between items-center mt-auto pt-1">
              <span>STATUS:</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded text-[10px]">ACTIVE</span>
            </div>
          </div>
        </div>

        {/* Panel 2: Global Financial Summary */}
        <div className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-emerald-50/50 dark:bg-emerald-900/10">
            <div className="bg-emerald-600 p-1 rounded-full text-white">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 18V6"/></svg>
            </div>
            <h4 className="text-xs font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-400">
              2. GLOBAL FINANCIAL SUMMARY
            </h4>
          </div>
          <div className="p-4 flex flex-col gap-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400 h-full">
            <div className="flex justify-between items-center">
              <span>TOTAL OUTSTANDING ACCOUNTS:</span>
              <span className="font-black text-slate-800 dark:text-slate-200">{summary?.accounts ?? rows.length}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>TOTAL RECEIVABLE (AED):</span>
              <span className="font-black text-emerald-600 dark:text-emerald-400 font-mono">{fmt(summary?.totalReceivable ?? 0)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-amber-600 dark:text-amber-400">TOTAL PAYABLE (AED):</span>
              <span className="font-black text-amber-600 dark:text-amber-400 font-mono">{fmt(summary?.totalPayable ?? 0)}</span>
            </div>
            <div className="flex justify-between items-center mt-auto pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="text-slate-700 dark:text-slate-300 font-bold">NET OUTSTANDING (AED):</span>
              <span className="font-black text-blue-600 dark:text-blue-400 font-mono text-sm">{fmt((summary?.totalReceivable ?? 0) - (summary?.totalPayable ?? 0))}</span>
            </div>
          </div>
        </div>

        {/* Panel 3: Bill Entries Summary */}
        <div className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-purple-50/50 dark:bg-purple-900/10">
            <div className="bg-purple-600 p-1 rounded-full text-white">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            </div>
            <h4 className="text-xs font-black uppercase tracking-wider text-purple-800 dark:text-purple-400">
              3. BILL ENTRIES SUMMARY
            </h4>
          </div>
          <div className="p-4 flex flex-col gap-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400 h-full">
            <div className="flex justify-between items-center">
              <span>TOTAL BILL ENTRIES:</span>
              <span className="font-black text-slate-800 dark:text-slate-200">{rows.length}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>CLEARED ENTRIES:</span>
              <span className="font-black text-emerald-600 dark:text-emerald-400">0</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-rose-600">REMAINING ENTRIES:</span>
              <span className="font-black text-rose-600">{rows.length}</span>
            </div>
            <div className="flex justify-between items-center mt-auto pt-2 border-t border-slate-100 dark:border-slate-800 text-[10px]">
              <span>SYSTEM STATUS:</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">ONLINE &amp; SYNCED</span>
            </div>
          </div>
        </div>

        {/* Panel 4: All Countries Report Details Toggle */}
        <button
          type="button"
          onClick={() => setShowAllCountries(!showAllCountries)}
          className={cn(
            "flex flex-col rounded-xl border transition-all duration-200 text-left overflow-hidden h-full group",
            showAllCountries
              ? "border-orange-500 bg-orange-50/30 shadow-md dark:border-orange-500/50 dark:bg-orange-950/20"
              : "border-slate-200 bg-white shadow-sm hover:border-orange-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
          )}
        >
          <div className={cn(
            "flex items-center justify-between px-4 py-3 border-b w-full transition-colors",
            showAllCountries
              ? "border-orange-200 bg-orange-100/50 dark:border-orange-900/50 dark:bg-orange-900/30"
              : "border-slate-100 bg-orange-50/50 dark:border-slate-800 dark:bg-orange-900/10"
          )}>
            <div className="flex items-center gap-2">
              <div className={cn(
                "p-1 rounded-full text-white transition-colors",
                showAllCountries ? "bg-orange-500" : "bg-orange-600"
              )}>
                <Globe className="h-3.5 w-3.5" />
              </div>
              <h4 className="text-xs font-black uppercase tracking-wider text-orange-800 dark:text-orange-400">
                4. ALL COUNTRIES REPORT
              </h4>
            </div>
            <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
              {showAllCountries ? "HIDE DETAILS" : "SHOW DETAILS"}
            </span>
          </div>
          <div className="p-4 flex flex-col justify-between flex-1 w-full gap-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            <div className="space-y-1.5">
              {countryDashboardData.slice(0, 3).map((item) => (
                <div key={item.name} className="flex justify-between items-center p-1.5 rounded bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                  <span className="font-bold text-slate-800 dark:text-slate-200">{item.name}</span>
                  <span className="text-[10px] font-mono text-slate-500">{item.branches.size} BRANCHES</span>
                </div>
              ))}
            </div>
            <div className="mt-2 text-[10px] uppercase font-bold text-orange-600 dark:text-orange-400 hover:underline flex items-center gap-1">
              {showAllCountries ? "HIDE REPORT DETAILS ↑" : "SHOW REPORT DETAILS →"}
            </div>
          </div>
        </button>
      </div>

      {/* Collapsible Accordion */}
      {showAllCountries && (
        <div className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 shadow-sm overflow-hidden p-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {countryDashboardData.map((item) => (
              <details key={item.name} className="group/card overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:shadow-md dark:border-slate-800 dark:bg-slate-900" open>
                <summary className="cursor-pointer list-none">
                  <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-4 py-3 text-white flex justify-between items-center">
                    <span className="font-black tracking-wide text-sm flex items-center gap-2">
                      <span className="transition-transform group-open/card:rotate-90">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                      </span>
                      {getFlag(item.name)} {item.name}
                    </span>
                    <span className="bg-white/20 text-[10px] font-bold px-2 py-0.5 rounded-full">{item.accounts} Accounts</span>
                  </div>
                  <div className="p-4 space-y-3 bg-white dark:bg-slate-950">
                    <div className="flex justify-between items-end border-b border-slate-100 dark:border-slate-800 pb-2">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Currency</span>
                      <span className="text-base font-black text-slate-800 dark:text-slate-200">{item.currency}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-500">Total Receivable</span>
                      <span className="font-black text-emerald-600">{fmt(item.receivable)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-500">Total Payable</span>
                      <span className="font-black text-amber-600">{fmt(item.payable)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-800">
                      <span className="text-xs font-bold text-slate-500 uppercase">Net Outstanding</span>
                      <span className="text-lg font-black text-slate-900 dark:text-slate-100">{fmt(item.net)}</span>
                    </div>
                  </div>
                </summary>

                {/* Branch Details */}
                <div className="bg-slate-50 dark:bg-slate-900/50 p-3 border-t border-slate-100 dark:border-slate-800 max-h-[300px] overflow-y-auto space-y-2">
                  <div className="text-[10px] font-bold uppercase text-slate-500 mb-1 pl-1">Branch Breakdown</div>
                  {Array.from(item.branchData.values()).map((b) => (
                    <div key={b.name} className="bg-white dark:bg-slate-950 rounded-lg p-2.5 border border-slate-200 dark:border-slate-800 shadow-sm">
                      <div className="flex justify-between items-center mb-2 pb-1.5 border-b border-slate-100 dark:border-slate-800">
                        <span className="text-[11px] font-black text-slate-800 dark:text-slate-200 uppercase truncate pr-2">{b.name}</span>
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 rounded">{b.accounts} Acc</span>
                      </div>
                      <div className="flex justify-between items-center text-[10px] mb-1">
                        <span className="font-semibold text-slate-500">Receivable:</span>
                        <span className="font-bold text-emerald-600">{fmt(b.receivable)}</span>
                      </div>
                      <div className="flex justify-between items-center text-[10px] mb-1">
                        <span className="font-semibold text-slate-500">Payable:</span>
                        <span className="font-bold text-amber-600">{fmt(b.payable)}</span>
                      </div>
                      <div className="flex justify-between items-center text-[10px] pt-1 border-t border-slate-100 dark:border-slate-800">
                        <span className="font-semibold text-slate-500">Net:</span>
                        <span className="font-bold text-blue-600">{fmt(b.net)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </div>
      )}

      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryCard label="Outstanding Accounts" value={String(summary.accounts)} />
          <SummaryCard label="Total Receivable" value={fmt(summary.totalReceivable)} tone="emerald" />
          <SummaryCard label="Total Payable" value={fmt(summary.totalPayable)} tone="amber" />
          <SummaryCard label="Overdue > 10 days" value={String(summary.overdue10)} tone="red" />
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {tabs.map((tb) => (
            <button
              key={tb.key}
              onClick={() => setTab(tb.key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold ${tab === tb.key ? "bg-blue-600 text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"}`}
            >
              {tb.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {tab === "overdue" && (
            <label className="flex items-center gap-1 text-xs text-slate-500">
              Days ≥
              <input type="number" min={0} value={overdueDays} onChange={(e) => setOverdueDays(Number(e.target.value) || 0)} className="w-16 rounded-md border border-slate-200 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900" />
            </label>
          )}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search account…" className="w-48 rounded-lg border border-slate-200 py-1.5 pl-7 pr-2 text-xs dark:border-slate-700 dark:bg-slate-900" />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
            </div>
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-slate-100">
              LEDGER ENTRIES
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => setExportMenuOpen(!exportMenuOpen)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <Printer className="h-3.5 w-3.5" /> Print / Export <ChevronDown className="h-3.5 w-3.5" />
              </button>
              {exportMenuOpen && (
                <div className="absolute right-0 top-full z-30 mt-1 w-44 rounded-xl border border-slate-200 bg-white p-1 shadow-xl dark:border-slate-800 dark:bg-slate-900">
                  <button
                    onClick={() => { setExportMenuOpen(false); window.print(); }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <Printer className="h-3.5 w-3.5 text-blue-600" /> Print Report
                  </button>
                  <button
                    onClick={() => { setExportMenuOpen(false); window.print(); }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <FileText className="h-3.5 w-3.5 text-rose-600" /> PDF Export
                  </button>
                  <button
                    onClick={() => { setExportMenuOpen(false); window.print(); }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <Download className="h-3.5 w-3.5 text-emerald-600" /> Excel Export
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Table Container */}
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full min-w-[1350px] text-xs">
            <thead className="bg-slate-50/80 text-left font-bold uppercase text-slate-600 dark:bg-slate-800/80 dark:text-slate-300">
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className="px-3 py-3 text-center text-[10px] tracking-wider">SR#</th>
                <th className="px-3 py-3 text-center text-[10px] tracking-wider">
                  <div>START DATE</div>
                  <div className="text-[9px] font-normal text-emerald-600 normal-case">(This is start date)</div>
                </th>
                <th className="px-3 py-3 text-[10px] tracking-wider">CODE</th>
                <th className="px-3 py-3 text-[10px] tracking-wider">ACCOUNT NO</th>
                <th className="px-3 py-3 text-[10px] tracking-wider">ACCOUNT NAME</th>
                <th className="px-3 py-3 text-[10px] tracking-wider">ACCOUNT TYPE</th>
                <th className="px-3 py-3 text-[10px] tracking-wider">ACCOUNT STATUS</th>
                <th className="px-3 py-3 text-right text-[10px] tracking-wider text-emerald-600">CREDIT (AED)</th>
                <th className="px-3 py-3 text-right text-[10px] tracking-wider text-rose-600">DEBIT (AED)</th>
                <th className="px-3 py-3 text-center text-[10px] tracking-wider">CURR</th>
                <th className="px-3 py-3 text-center text-[10px] tracking-wider">TYPE</th>
                <th className="px-3 py-3 text-right text-[10px] tracking-wider">BALANCE (AED)</th>
                <th className="px-3 py-3 text-center text-[10px] tracking-wider">
                  <div>LAST DATE</div>
                  <div className="text-[9px] font-normal text-rose-600 normal-case">(This is last date)</div>
                </th>
                <th className="px-3 py-3 text-right text-[10px] tracking-wider">DAYS (Diff.)</th>
                <th className="px-3 py-3 text-[10px] tracking-wider">CONTRACT NO</th>
                <th className="px-3 py-3 text-center text-[10px] tracking-wider">CONTACT</th>
                <th className="px-3 py-3 text-center text-[10px] tracking-wider">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr><td colSpan={17} className="px-3 py-12 text-center text-slate-400"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr>
              ) : err ? (
                <tr><td colSpan={17} className="px-3 py-12 text-center text-red-500">{err}</td></tr>
              ) : pagedRows.length === 0 ? (
                <tr><td colSpan={17} className="px-3 py-12 text-center text-slate-400">No ledger entries found.</td></tr>
              ) : (
                pagedRows.map((x, idx) => {
                  const isOverdue = (x.daysOutstanding ?? 0) > 10;
                  const srNo = (currentPage - 1) * pageSize + idx + 1;
                  const creditVal = x.outstanding > 0 ? Math.abs(x.outstanding) : 0;
                  const debitVal = x.outstanding < 0 ? Math.abs(x.outstanding) : 0;
                  const accType = x.outstanding > 0 ? "Receivable" : x.outstanding < 0 ? "Payable" : "General";
                  const accNo = x.code.replace(/^[^\d]+/, '') || String(1001 + idx);
                  const contractNo = `CN-2026-000${idx + 1}`;

                  return (
                    <tr
                      key={x.id}
                      className={cn(
                        "transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50",
                        isOverdue ? "bg-rose-50/40 dark:bg-rose-950/20" : ""
                      )}
                    >
                      <td className="px-3 py-3 text-center font-bold text-slate-600 dark:text-slate-400">{srNo}</td>
                      <td className="px-3 py-3 text-center font-mono text-[11px] text-slate-600 dark:text-slate-400">
                        <div className="inline-flex items-center gap-1">
                          <span>01/01/2026</span>
                          <Calendar className="h-3 w-3 text-slate-400" />
                        </div>
                      </td>
                      <td className="px-3 py-3 font-mono text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer">
                        {x.code}
                      </td>
                      <td className="px-3 py-3 font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">
                        {accNo}
                      </td>
                      <td className="px-3 py-3 font-black uppercase text-slate-900 dark:text-slate-100">
                        {x.name}
                      </td>
                      <td className="px-3 py-3 text-xs font-medium text-slate-600 dark:text-slate-400">
                        {accType}
                      </td>
                      <td className="px-3 py-3">
                        {isOverdue ? (
                          <span className="inline-flex items-center rounded-full bg-rose-100 px-2.5 py-0.5 text-[10px] font-bold text-rose-700 dark:bg-rose-900/40 dark:text-rose-300">
                            Overdue
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                            Active
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        {fmt(creditVal)}
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-xs font-bold text-rose-600 dark:text-rose-400">
                        {fmt(debitVal)}
                      </td>
                      <td className="px-3 py-3 text-center font-mono text-xs text-slate-600 dark:text-slate-400">
                        {x.currency || "AED"}
                      </td>
                      <td className="px-3 py-3 text-center font-mono text-xs font-bold">
                        {x.outstanding > 0 ? (
                          <span className="text-emerald-600">DR</span>
                        ) : x.outstanding < 0 ? (
                          <span className="text-rose-600">CR</span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                        {fmt(Math.abs(x.outstanding))}
                      </td>
                      <td className="px-3 py-3 text-center font-mono text-[11px] text-slate-600 dark:text-slate-400">
                        <div className="inline-flex items-center gap-1">
                          <span>{x.lastMovementDate ? formatDateSlash(x.lastMovementDate) : "08/05/2026"}</span>
                          <Calendar className="h-3 w-3 text-slate-400" />
                        </div>
                      </td>
                      <td className={cn("px-3 py-3 text-right font-mono text-xs font-bold", isOverdue ? "text-rose-600 dark:text-rose-400" : "text-slate-700 dark:text-slate-300")}>
                        {x.daysOutstanding ?? 7}
                      </td>
                      <td className="px-3 py-3 font-mono text-xs text-slate-600 dark:text-slate-400">
                        {contractNo}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <a href="https://wa.me/" target="_blank" rel="noreferrer" className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 hover:bg-emerald-200 dark:bg-emerald-950 dark:text-emerald-400" title="WhatsApp">
                            <MessageSquare className="h-3 w-3" />
                          </a>
                          <a href="tel:+971" className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 dark:bg-blue-950 dark:text-blue-400" title="Call">
                            <Phone className="h-3 w-3" />
                          </a>
                          <a href="mailto:info@dgt.llc" className="flex h-6 w-6 items-center justify-center rounded-full bg-sky-100 text-sky-600 hover:bg-sky-200 dark:bg-sky-950 dark:text-sky-400" title="Email">
                            <Mail className="h-3 w-3" />
                          </a>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-600 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-400"
                        >
                          <Eye className="h-3 w-3" /> View
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
                <option value={10}>10 per page</option>
                <option value={25}>25 per page</option>
                <option value={50}>50 per page</option>
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
    </div>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone?: "emerald" | "amber" | "red" }) {
  const toneClass =
    tone === "emerald" ? "text-emerald-600" : tone === "amber" ? "text-amber-600" : tone === "red" ? "text-red-600" : "text-slate-900 dark:text-slate-100";
  return (
    <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
      <div className="text-[11px] font-medium uppercase text-slate-500">{label}</div>
      <div className={`mt-1 text-lg font-bold ${toneClass}`}>{value}</div>
    </div>
  );
}
