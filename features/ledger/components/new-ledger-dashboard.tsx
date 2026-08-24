"use client";

import { DownloadActionIcon } from "@/components/ui/download-action-icon";
import { useEffect, useMemo, useState } from "react";
import {
  Calendar,
  Download,
  FileText,
  Loader2,
  MoreVertical,
  Printer,
  Search,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiGet } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { openGenericErpReport } from "@/lib/reports/open-generic-erp-report";
import {
  getLedgerStatement,
  listLedgerReportLedgers,
  type LedgerLookupRow,
  type LedgerStatementLine
} from "@/features/reports/ledger-report/ledger-report-api";
import { SearchSelect, type SearchSelectOption } from "@/components/ui/search-select";
import { Th } from "@/components/ui/translated-th";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { translateHeader } from "@/lib/i18n/table-headers";
import { t } from "@/lib/i18n/ui";

type LookupResponse = {
  found: boolean;
  account: LedgerLookupRow | null;
  query: string;
};

type SessionInfo = {
  user?: {
    id?: string;
    email?: string | null;
    fullName?: string | null;
  };
  roles?: string[];
  scopes?: any;
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function monthStartIso() {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

function yearStartIso() {
  const d = new Date();
  d.setMonth(0, 1);
  return d.toISOString().slice(0, 10);
}

function fmtNumber(value: number | null | undefined) {
  const n = Number(value ?? 0);
  return Number.isFinite(n)
    ? n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : "0.00";
}

function fmtBalance(balance: number, normalBalance?: "debit" | "credit") {
  if (!balance) return { text: "0.00", isDr: false, isCr: false, color: "text-slate-500" };
  const isCredit = normalBalance === "debit" ? balance < 0 : balance > 0;
  const absBal = Math.abs(balance);
  return {
    text: `${fmtNumber(absBal)} ${isCredit ? "CR" : "DR"}`,
    isDr: !isCredit,
    isCr: isCredit,
    color: isCredit ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500"
  };
}

function fmtDate(value: string | null | undefined) {
  if (!value) return "-";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString();
}

function safeText(value: string | null | undefined) {
  const v = (value ?? "").trim();
  return v || "-";
}

function branchLabel(row: LedgerLookupRow | null) {
  if (!row) return "-";
  return row.cityBranchName || row.countryBranchName || row.countryName || "-";
}

function getCountryCode(countryName: string | null | undefined): string {
  if (!countryName) return "CO";
  const name = countryName.toLowerCase().trim();
  if (name.includes("pakistan")) return "PK";
  if (name.includes("india")) return "IN";
  if (name.includes("iran")) return "IR";
  if (name.includes("afghanistan")) return "AF";
  if (name.includes("uae") || name.includes("dubai") || name.includes("emirates")) return "AE";
  
  const clean = name.replace(/[^a-z]/g, "");
  return clean.slice(0, 2).toUpperCase() || "CO";
}

function getBranchCode(branchName: string | null | undefined): string {
  if (!branchName) return "-";
  
  let cleanName = branchName;
  if (branchName.includes(" - ")) {
    const parts = branchName.split(" - ");
    cleanName = parts[1] || parts[0] || branchName;
  }
  
  const name = cleanName.toLowerCase().trim();
  
  if (name.includes("quetta")) return "QT";
  if (name.includes("dubai") || name.includes("uae") || name.includes("emirates")) return "DXB";
  if (name.includes("kabul")) return "KBL";
  if (name.includes("chaman")) return "CHM";
  if (name.includes("peshawar")) return "PEW";
  if (name.includes("tehran") || name.includes("iran")) return "THR";
  if (name.includes("delhi") || name.includes("india")) return "DEL";
  
  let clean = name.replace("main branch", "").replace("branch", "").trim();
  if (clean.length >= 2) {
    const code = clean.replace(/[^a-z]/g, "").slice(0, 3).toUpperCase();
    return code || "BR";
  }
  return cleanName.slice(0, 3).toUpperCase();
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
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function buildLedgerOption(row: LedgerLookupRow): SearchSelectOption {
  const branch = row.cityBranchName || row.countryBranchName || row.countryName || "";
  const label = `${row.accountCode || row.ledgerCode} · ${row.accountName || row.ledgerName}${branch ? ` · ${branch}` : ""}`;
  const keywords = [
    row.ledgerCode,
    row.ledgerName,
    row.accountCode,
    row.accountName,
    row.companyName,
    row.countryName,
    row.stateName,
    row.cityName,
    branch,
    row.accountKind,
    row.ledgerCurrency
  ]
    .filter(Boolean)
    .join(" ");
  return { value: row.ledgerId, label, keywords };
}

export function NewLedgerDashboard({ initialAccount = "" }: { initialAccount?: string }) {
  const activeLang = useActiveLanguage();
  const th = (label: string) => translateHeader(activeLang, label);
  const [query, setQuery] = useState(initialAccount);
  const [fromDate, setFromDate] = useState(yearStartIso());
  const [toDate, setToDate] = useState(todayIso());
  const [account, setAccount] = useState<LedgerLookupRow | null>(null);
  const [lines, setLines] = useState<LedgerStatementLine[]>([]);
  const [totals, setTotals] = useState<{ entries: number; debit: number; credit: number; balance: number; openingBalance?: number }>({ entries: 0, debit: 0, credit: 0, balance: 0, openingBalance: 0 });
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingLedgers, setLoadingLedgers] = useState(false);
  const [ledgerId, setLedgerId] = useState("");
  const [rawLedgers, setRawLedgers] = useState<LedgerLookupRow[]>([]);
  const [selectedCountry, setSelectedCountry] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("");
  const [selectedUser, setSelectedUser] = useState("");
  const [dateDropdownOpen, setDateDropdownOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionsOpen, setActionsOpen] = useState(false);

  const isSuperAdmin = useMemo(() => session ? (session.scopes?.isSuperAdmin || session.roles?.includes("super_admin")) : true, [session]);

  const openingBalance = useMemo(() => {
    if (totals.openingBalance !== undefined) return totals.openingBalance;
    const first = lines[0];
    if (!first) return account?.currentBalance ?? 0;
    const creditNormal = account?.normalBalance === "credit";
    return creditNormal ? first.runningBalance - first.credit + first.debit : first.runningBalance - first.debit + first.credit;
  }, [account?.normalBalance, account?.currentBalance, lines, totals.openingBalance]);

  const countryOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const option of rawLedgers) {
      if (option.countryId && option.countryName) {
        seen.set(option.countryId, option.countryName);
      }
    }
    const list = Array.from(seen.entries()).map(([value, label]) => ({ value, label }));
    return [{ value: "", label: "All Countries" }, ...list];
  }, [rawLedgers]);

  const branchOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const option of rawLedgers) {
      const branchId = option.cityBranchId || option.countryBranchId;
      const branchName = option.cityBranchName || option.countryBranchName;
      if (branchId && branchName) {
        seen.set(branchId, branchName);
      }
    }
    const list = Array.from(seen.entries()).map(([value, label]) => ({ value, label }));
    return [{ value: "", label: "All Branches" }, ...list];
  }, [rawLedgers]);

  const userOptions = useMemo(() => {
    const seen = new Set<string>();
    for (const line of lines) {
      if (line.createdByName) seen.add(line.createdByName);
    }
    const list = Array.from(seen).map((u) => ({ value: u, label: u }));
    return [{ value: "", label: "All Users" }, ...list];
  }, [lines]);

  const filteredLedgers = useMemo(() => {
    let list = rawLedgers;
    if (selectedCountry) {
      list = list.filter((l) => l.countryId === selectedCountry);
    }
    if (selectedBranch) {
      list = list.filter((l) => l.cityBranchId === selectedBranch || l.countryBranchId === selectedBranch);
    }
    return list;
  }, [rawLedgers, selectedCountry, selectedBranch]);

  const ledgerOptions = useMemo(() => filteredLedgers.map(buildLedgerOption), [filteredLedgers]);

  const linesWithRunningUsd = useMemo(() => {
    let runningUsd = 0;
    const creditNormal = account?.normalBalance === "credit";
    return lines.map((line) => {
      const usdDebit = line.debit > 0 ? line.usdAmount : 0;
      const usdCredit = line.credit > 0 ? line.usdAmount : 0;
      runningUsd += creditNormal ? usdCredit - usdDebit : usdDebit - usdCredit;
      return {
        ...line,
        runningBalanceUsd: runningUsd
      };
    });
  }, [lines, account?.normalBalance]);

  const displayedLines = useMemo(() => {
    let list = linesWithRunningUsd;
    if (selectedUser) {
      list = list.filter((l) => l.createdByName === selectedUser);
    }
    return list;
  }, [linesWithRunningUsd, selectedUser]);

  async function loadAccountById(id: string, nextFromDate = fromDate, nextToDate = toDate) {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const statement = await getLedgerStatement({
        ledgerId: id,
        fromDate: nextFromDate,
        toDate: nextToDate,
        limit: 5000
      });
      if (statement.header) {
        setAccount(statement.header);
        setLedgerId(id);
        setQuery(statement.header.accountCode || statement.header.ledgerCode || "");
      }
      setLines(statement.lines);
      setTotals({
        entries: statement.totals.entries,
        debit: statement.totals.debit,
        credit: statement.totals.credit,
        openingBalance: (statement.totals as any).openingBalance ?? 0,
        balance: statement.totals.balance || statement.header?.currentBalance || 0
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load ledger statement.");
    } finally {
      setLoading(false);
    }
  }

  async function loadAccount(searchValue = query) {
    const q = searchValue.trim();
    if (!q) {
      setError("Please select an Account.");
      return;
    }
    const option = ledgerOptions.find((o) => (o.keywords ?? "").toLowerCase().includes(q.toLowerCase()) || o.value === q);
    if (option) {
      void loadAccountById(option.value);
    } else {
      setError("Account not found.");
    }
  }

  function clearSearch() {
    setQuery("");
    setLedgerId("");
    setSelectedCountry("");
    setSelectedBranch("");
    setSelectedUser("");
    setAccount(null);
    setLines([]);
    setTotals({ entries: 0, debit: 0, credit: 0, balance: 0, openingBalance: 0 });
    setError(null);
  }

  function printLedger() {
    if (!account) return;

    openGenericErpReport({
      title: "LEDGER REPORT",
      subtitle: `${account.accountCode || account.ledgerCode || "Ledger"} · ${account.accountName || account.ledgerName || "Account Statement"}`,
      lang: "en",
      columns: [
        { key: "entryDate", label: "Date", format: "date" },
        { key: "superAdminSerialNo", label: "SA Serial", align: "center" },
        { key: "countrySerialNo", label: "Country Serial", align: "center" },
        { key: "branchSerialNo", label: "Branch Serial", align: "center" },
        { key: "createdByName", label: "User" },
        { key: "referenceNo", label: "Reference No" },
        { key: "description", label: "Narration" },
        { key: "debit", label: "Debit", format: "currency", align: "right", currency: account.ledgerCurrency || "USD" },
        { key: "credit", label: "Credit", format: "currency", align: "right", currency: account.ledgerCurrency || "USD" },
        { key: "runningBalance", label: "Balance", format: "currency", align: "right", currency: account.ledgerCurrency || "USD" },
      ],
      rows: lines.map((line) => ({
        entryDate: line.entryDate,
        superAdminSerialNo: line.superAdminSerialNo || "-",
        countrySerialNo: line.countrySerialNo || "-",
        branchSerialNo: line.branchSerialNo || "-",
        createdByName: line.createdByName || "-",
        referenceNo: line.referenceNo || "-",
        description: line.description || "-",
        debit: line.debit || 0,
        credit: line.credit || 0,
        runningBalance: line.runningBalance || 0,
      })),
      summary: {
        totalEntries: totals.entries,
        openingBalance,
        totalDebit: totals.debit,
        totalCredit: totals.credit,
        closingBalance: totals.balance,
      },
      filters: [
        { label: "Account", value: `${account.accountCode || account.ledgerCode || "-"} · ${account.accountName || account.ledgerName || "-"}` },
        { label: "Country", value: account.countryName || selectedCountry || "All Countries" },
        { label: "Branch", value: account.cityBranchName || account.countryBranchName || selectedBranch || "All Branches" },
        { label: "From Date", value: fromDate || "Start" },
        { label: "To Date", value: toDate || "Today" },
      ],
      companyInfo: {
        name: "DIGITAL DOCK ERP",
        printedBy: session?.user?.fullName || session?.user?.email || "ERP User",
        country: account.countryName || selectedCountry || "All Countries",
        branch: account.cityBranchName || account.countryBranchName || selectedBranch || "All Branches",
        currency: account.ledgerCurrency || "USD",
        reportPeriod: `${fromDate || "Start"} To ${toDate || "Today"}`,
      },
    });
  }

  function downloadCsv() {
    let runningUsd = 0;
    const creditNormal = account?.normalBalance === "credit";
    const countryColHeader = `${account ? getCountryCode(account.countryName) : "CO"}/Serial`;
    
    const headers = [
      "Date",
      "SA/Serial",
      countryColHeader,
      "BR/Serial",
      "Branch Code",
      "User Name",
      "No.",
      "Details",
      "Dr.",
      "Cr.",
      "Total"
    ];

    if (isSuperAdmin) {
      headers.push("Ex. Rate", "Dr. (USD)", "Cr. (USD)", "Total (USD)");
    }

    exportCsv("new-ledger-statement.csv", [
      headers,
      ...lines.map((line, index) => {
        const usdDebit = line.debit > 0 ? line.usdAmount : 0;
        const usdCredit = line.credit > 0 ? line.usdAmount : 0;
        runningUsd += creditNormal ? usdCredit - usdDebit : usdDebit - usdCredit;
        const rowData = [
          line.entryDate,
          line.superAdminSerialNo || "-",
          line.countrySerialNo || "-",
          line.branchSerialNo || "-",
          getBranchCode(line.branchName),
          line.createdByName || "-",
          line.referenceNo || "-",
          line.description || "-",
          fmtNumber(line.debit),
          fmtNumber(line.credit),
          fmtNumber(line.runningBalance)
        ];
        if (isSuperAdmin) {
          rowData.push(fmtNumber(line.usdRate), fmtNumber(usdDebit), fmtNumber(usdCredit), fmtNumber(runningUsd));
        }
        return rowData;
      })
    ]);
  }

  useEffect(() => {
    fetch("/api/erp/auth/session", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setSession(data))
      .catch(() => null);
  }, []);

  useEffect(() => {
    async function loadLedgers() {
      setLoadingLedgers(true);
      try {
        const res = await listLedgerReportLedgers({ reportScope: "super_admin", limit: 500 });
        if (res && res.ledgers) {
          setRawLedgers(res.ledgers);
          
          if (initialAccount) {
            const found = res.ledgers.find(
              (l) =>
                l.ledgerCode === initialAccount ||
                l.accountCode === initialAccount ||
                l.ledgerId === initialAccount
            );
            if (found) {
              setLedgerId(found.ledgerId);
              void loadAccountById(found.ledgerId);
            }
          }
        }
      } catch (err) {
        console.error("Failed to load ledgers", err);
      } finally {
        setLoadingLedgers(false);
      }
    }
    void loadLedgers();
  }, [initialAccount]);

  return (
    <div className="w-full space-y-4 p-4 md:p-6 print:p-0">
      <div className="rounded-lg border bg-card p-3 shadow-sm print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-full md:w-[320px]">
            <SearchSelect
              label=""
              value={ledgerId}
              placeholder={t(activeLang, "ledger.nld_search_account_ph", "Search or select account...")}
              options={ledgerOptions}
              onValueChange={(value) => {
                setLedgerId(value);
                void loadAccountById(value);
              }}
            />
          </div>
          <div className="w-full md:w-[150px]">
            <SearchSelect
              label=""
              value={selectedCountry}
              placeholder={t(activeLang, "common.all_countries", "All Countries")}
              options={countryOptions}
              onValueChange={(value) => {
                setSelectedCountry(value);
                setLedgerId("");
              }}
            />
          </div>
          <div className="w-full md:w-[160px]">
            <SearchSelect
              label=""
              value={selectedBranch}
              placeholder={t(activeLang, "common.all_branches", "All Branches")}
              options={branchOptions}
              onValueChange={(value) => {
                setSelectedBranch(value);
                setLedgerId("");
              }}
            />
          </div>
          <div className="w-full md:w-[150px]">
            <SearchSelect
              label=""
              value={selectedUser}
              placeholder={t(activeLang, "report.filter_all_users", "All Users")}
              options={userOptions}
              onValueChange={(value) => {
                setSelectedUser(value);
              }}
            />
          </div>
          <div className="relative w-full md:w-auto">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDateDropdownOpen(!dateDropdownOpen)}
              className="h-10 w-full md:w-auto text-xs gap-2"
            >
              <Calendar className="h-4 w-4" />
              {fromDate} → {toDate}
            </Button>
            {dateDropdownOpen ? (
              <div className="absolute right-0 md:left-0 mt-2 z-30 w-64 p-3 bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100 rounded-lg border border-slate-200 dark:border-slate-800 shadow-xl space-y-3">
                <div className="space-y-1">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">{t(activeLang, "bankroz.from_date", "From Date")}</span>
                  <Input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} className="h-9 text-xs" />
                </div>
                <div className="space-y-1">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">{t(activeLang, "bankroz.to_date", "To Date")}</span>
                  <Input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} className="h-9 text-xs" />
                </div>
                <div className="flex items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="flex-1 font-semibold text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                    onClick={() => {
                      setFromDate(monthStartIso());
                      setToDate(todayIso());
                      setDateDropdownOpen(false);
                      if (ledgerId) void loadAccountById(ledgerId);
                    }}
                  >
                    {t(activeLang, "common.reset", "Reset")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="flex-1 font-bold bg-[#0F172A] hover:bg-slate-800 text-white dark:bg-sky-600 dark:hover:bg-sky-700 shadow-sm"
                    onClick={() => {
                      setDateDropdownOpen(false);
                      if (ledgerId) void loadAccountById(ledgerId);
                    }}
                  >
                    {t(activeLang, "god.apply", "Apply")}
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
          <Button 
            type="button" 
            onClick={() => void loadAccountById(ledgerId)} 
            disabled={loading || !ledgerId} 
            className="h-10 gap-2 px-4 font-bold bg-[#0F172A] hover:bg-slate-800 text-white dark:bg-sky-600 dark:hover:bg-sky-700 disabled:opacity-50 shadow-sm"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Search
          </Button>

          <div className="relative ml-auto">
            <Button type="button" variant="outline" className="h-10 gap-2" onClick={() => setActionsOpen((value) => !value)}>
              <MoreVertical className="h-4 w-4" />
              {t(activeLang, "form.actions", "Actions")}
            </Button>
            {actionsOpen ? (
              <div className="absolute right-0 top-full z-30 mt-2 w-48 overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-xl">
                <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted" onClick={printLedger}>
                  <Printer className="h-4 w-4" /> {t(activeLang, "report.builder_print", "Print")}
                </button>
                <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted" onClick={downloadCsv}>
                  <DownloadActionIcon className="h-4 w-4" /> {t(activeLang, "report.builder_export_csv", "Export CSV")}
                </button>
                <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted" onClick={printLedger}>
                  <FileText className="h-4 w-4" /> PDF
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <Card className="overflow-hidden border bg-card shadow-sm">
        <CardContent className="p-0">
          <div className="border-b p-5">
            <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-cyan-600 dark:text-cyan-300">
                  {t(activeLang, "ledger.nld_ledger_statement", "Ledger Statement")}
                </h1>
                <p className="text-xs text-muted-foreground">
                  {th("Status")}: {th("Active")} | {th("Created")}: {account ? fmtDate(account.createdAt || (account as any)?.createdDate || lines[0]?.createdAt || new Date().toISOString()) : "-"}
                </p>
              </div>
              <div className="text-xs text-muted-foreground">
                {th("Account")}: <span className="font-semibold text-foreground">{safeText(account?.accountCode)}</span>
              </div>
            </div>
          </div>

          <div className="grid gap-0 border-b lg:grid-cols-4">
            <InfoPanel title={t(activeLang, "roz.col_account_details", "Account Details")} accent="cyan">
              <InfoRow label={t(activeLang, "ledger.ac_name", "A/c Name")} value={safeText(account?.accountName)} strong />
              <InfoRow label={t(activeLang, "ledger.ac_number", "A/c Number")} value={safeText(account?.accountCode)} strong />
              <InfoRow label={t(activeLang, "purchase.card_manual_ref_label", "Manual Ref")} value={safeText(account?.manualReferenceNumber)} />
              <InfoRow label={t(activeLang, "roz.cef_customer_no", "Customer No")} value={safeText(account?.customerNumber)} />
              <InfoRow label={t(activeLang, "god.asset_category", "Category")} value={safeText(account?.accountKind)} />
              <InfoRow label={t(activeLang, "hr.f_currency", "Currency")} value={safeText(account?.ledgerCurrency)} strong />
              <InfoRow label={t(activeLang, "hr.l_ledger", "Ledger")} value={safeText(account?.ledgerCode)} strong />
            </InfoPanel>

            <InfoPanel title={t(activeLang, "branch.section_company_details", "Company Details")} accent="blue">
              <InfoRow label={t(activeLang, "branch.row_company_name", "Company Name")} value={account?.companyName ? account.companyName : (account ? "Not Assigned" : "-")} />
              <InfoRow label={t(activeLang, "report.country", "Country")} value={safeText(account?.countryName)} />
              <InfoRow label={t(activeLang, "report.scope_main_branch", "Main Branch")} value={safeText(account?.countryBranchName)} />
              <InfoRow label={t(activeLang, "report.scope_city_branch", "City Branch")} value={safeText(account?.cityBranchName)} />
              <InfoRow label={t(activeLang, "ledger.state_city", "State / City")} value={`${safeText(account?.stateName)} / ${safeText(account?.cityName)}`} />
              <InfoRow label={t(activeLang, "purchase.f_address", "Address")} value={safeText(account?.address)} />
            </InfoPanel>

            <InfoPanel title={t(activeLang, "ledger.summary", "Ledger Summary")} accent="indigo">
              <InfoRow label={t(activeLang, "bankroz.entries", "Entries")} value={String(totals.entries)} />
              <InfoRow label="Dr" value={fmtNumber(totals.debit || account?.debitTotal)} danger />
              <InfoRow label="Cr" value={fmtNumber(totals.credit || account?.creditTotal)} success />
              <InfoRow label={t(activeLang, "report.col_opening", "Opening")} value={fmtBalance(openingBalance, account?.normalBalance).text} />
              <InfoRow 
                label={t(activeLang, "cdash.col_balance", "Balance")} 
                value={fmtBalance(totals.balance || account?.currentBalance || 0, account?.normalBalance).text} 
                success={fmtBalance(totals.balance || account?.currentBalance || 0, account?.normalBalance).isCr}
                danger={fmtBalance(totals.balance || account?.currentBalance || 0, account?.normalBalance).isDr}
                strong={!fmtBalance(totals.balance || account?.currentBalance || 0, account?.normalBalance).isCr && !fmtBalance(totals.balance || account?.currentBalance || 0, account?.normalBalance).isDr} 
              />
              {isSuperAdmin && <InfoRow label="1 USD" value="Rate stored per posting" />}
              {account && totals.entries === 0 && (
                <div className="mt-2 rounded-md bg-amber-50 dark:bg-amber-950/40 p-1.5 text-[10px] text-amber-800 dark:text-amber-300 font-medium text-center">
                  {t(activeLang, "ledger.nld_no_entries", "No ledger entries available for this account.")}
                </div>
              )}
            </InfoPanel>

            <InfoPanel title={t(activeLang, "ledger.session_details", "Session / Login Details")} accent="violet">
              <InfoRow label={t(activeLang, "ledger.session_branch", "Session Branch")} value={branchLabel(account)} strong />
              <InfoRow label={t(activeLang, "ledger.nld_login_date", "Login Date")} value={new Date().toLocaleDateString()} />
              <InfoRow label={t(activeLang, "ledger.nld_login_time", "Login Time")} value={new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} />
              <InfoRow label={t(activeLang, "purchase.user_name_label", "User Name")} value={safeText(session?.user?.fullName || (session as any)?.fullName || "Super Admin")} strong />
              <InfoRow label={t(activeLang, "purchase.f_user_id", "User ID")} value={safeText(session?.user?.id || (session as any)?.userId || (session?.user as any)?.user_id || "USR-SA-001")} />
              <InfoRow label={t(activeLang, "common.system", "System")} value="ERP / FMS" />
            </InfoPanel>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden border bg-card shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px] text-xs">
              <thead className="bg-slate-900 text-white dark:bg-slate-800">
                <tr>
                  {[
                    "Date", "SA/Serial", `${account ? getCountryCode(account.countryName) : "CO"}/Serial`, "BR/Serial", 
                    "Branch Code", "User Name", "No.", "Details", "Dr.", "Cr.", "Total",
                    ...(isSuperAdmin ? ["Ex. Rate", "Dr. (USD)", "Cr. (USD)", "Total (USD)"] : [])
                  ].map((head) => (
                    <Th key={head} className="border-b border-slate-700 px-4 py-3 text-left font-semibold uppercase tracking-wide">
                      {head}
                    </Th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={isSuperAdmin ? 15 : 11} className="px-4 py-10 text-center text-muted-foreground">
                      {th("Loading ledger data...")}
                    </td>
                  </tr>
                ) : displayedLines.length ? (
                  displayedLines.map((line, index) => {
                    const superAdminSerial = line.superAdminSerialNo || "-";
                    const countrySerial = line.countrySerialNo || "-";
                    const branchSerial = line.branchSerialNo || "-";
                    const branchNameVal = getBranchCode(line.branchName);
                    const userNameVal = line.createdByName || "-";
                    const usdDebit = line.debit > 0 ? line.usdAmount : 0;
                    const usdCredit = line.credit > 0 ? line.usdAmount : 0;
                    
                    const lineBal = fmtBalance(line.runningBalance, account?.normalBalance);
                    const usdBal = fmtBalance(line.runningBalanceUsd, account?.normalBalance);
 
                    return (
                      <tr key={`${line.sourceId}-${index}`} className={cn("border-b", index % 2 ? "bg-muted/20" : "bg-background", lineBal.color)}>
                        <td className="px-4 py-3">{fmtDate(line.entryDate)}</td>
                        <td className="px-4 py-3 font-mono">{superAdminSerial}</td>
                        <td className="px-4 py-3 font-mono">{countrySerial}</td>
                        <td className="px-4 py-3 font-mono">{branchSerial}</td>
                        <td className="px-4 py-3" title={line.branchName || undefined}>{branchNameVal}</td>
                        <td className="px-4 py-3 font-medium">{userNameVal}</td>
                        <td className="px-4 py-3">{line.referenceNo || "-"}</td>
                        <td className="max-w-[360px] px-4 py-3">{line.description || "-"}</td>
                        <td className="px-4 py-3 text-right font-semibold">{fmtNumber(line.debit)}</td>
                        <td className="px-4 py-3 text-right font-semibold">{fmtNumber(line.credit)}</td>
                        <td className="px-4 py-3 text-right font-semibold">{lineBal.text}</td>
                        {isSuperAdmin && (
                          <>
                            <td className="px-4 py-3 text-right">{fmtNumber(line.usdRate)}</td>
                            <td className="px-4 py-3 text-right">{fmtNumber(usdDebit)}</td>
                            <td className="px-4 py-3 text-right">{fmtNumber(usdCredit)}</td>
                            <td className="px-4 py-3 text-right font-semibold">{usdBal.text}</td>
                          </>
                        )}
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={isSuperAdmin ? 15 : 11} className="px-4 py-12 text-center text-slate-500 bg-slate-50/50 dark:bg-slate-900/30">
                      <div className="flex flex-col items-center justify-center gap-1">
                        <span className="font-semibold text-slate-700 dark:text-slate-300 text-sm">{t(activeLang, "ledger.nld_no_entries", "No ledger entries available for this account.")}</span>
                        <span className="text-xs text-slate-400">{t(activeLang, "ledger.nld_no_entries_sub", "There are currently no posted transactions recorded for this account.")}</span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function InfoPanel({
  title,
  accent,
  children
}: {
  title: string;
  accent: "cyan" | "blue" | "indigo" | "violet";
  children: React.ReactNode;
}) {
  const lang = useActiveLanguage();
  const accentClass = {
    cyan: "border-cyan-400 text-cyan-600 dark:text-cyan-300",
    blue: "border-blue-500 text-blue-600 dark:text-blue-300",
    indigo: "border-indigo-500 text-indigo-600 dark:text-indigo-300",
    violet: "border-violet-500 text-violet-600 dark:text-violet-300"
  }[accent];

  return (
    <section className="border-b p-5 lg:border-b-0 lg:border-r last:lg:border-r-0">
      <h2 className={cn("mb-3 border-l-4 pl-3 text-xs font-bold uppercase tracking-wide", accentClass)}>
        {translateHeader(lang, title)}
      </h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function InfoRow({
  label,
  value,
  strong,
  success,
  danger
}: {
  label: string;
  value: string;
  strong?: boolean;
  success?: boolean;
  danger?: boolean;
}) {
  const lang = useActiveLanguage();
  return (
    <div className="grid grid-cols-[110px_1fr] gap-3 text-xs">
      <span className="text-muted-foreground">{translateHeader(lang, label)}:</span>
      <span
        dir="auto"
        className={cn(
          "text-right text-foreground",
          strong && "font-semibold text-cyan-600 dark:text-cyan-300",
          success && "font-semibold text-emerald-600",
          danger && "font-semibold text-rose-500"
        )}
      >
        {value || "-"}
      </span>
    </div>
  );
}
