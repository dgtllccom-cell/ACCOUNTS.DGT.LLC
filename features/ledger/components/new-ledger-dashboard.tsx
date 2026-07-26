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
import {
  getLedgerStatement,
  listLedgerReportLedgers,
  type LedgerLookupRow,
  type LedgerStatementLine
} from "@/features/reports/ledger-report/ledger-report-api";
import { SearchSelect, type SearchSelectOption } from "@/components/ui/search-select";

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
    window.print();
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
              placeholder="Search or select account..."
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
              placeholder="All Countries"
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
              placeholder="All Branches"
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
              placeholder="All Users"
              options={userOptions}
              onValueChange={(value) => {
                setSelectedUser(value);
              }}
              disabled={!lines.length}
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
              <div className="absolute right-0 md:left-0 mt-2 z-30 w-64 p-3 bg-popover text-popover-foreground rounded-lg border shadow-lg space-y-3">
                <div className="space-y-1">
                  <span className="text-[11px] text-muted-foreground font-semibold">From Date</span>
                  <Input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} className="h-9 text-xs" />
                </div>
                <div className="space-y-1">
                  <span className="text-[11px] text-muted-foreground font-semibold">To Date</span>
                  <Input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} className="h-9 text-xs" />
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    setDateDropdownOpen(false);
                    void loadAccountById(ledgerId);
                  }}
                >
                  Apply Date Range
                </Button>
              </div>
            ) : null}
          </div>
          <Button type="button" onClick={() => void loadAccountById(ledgerId)} disabled={loading || !ledgerId} className="h-10 gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Search
          </Button>

          <div className="relative ml-auto">
            <Button type="button" variant="outline" className="h-10 gap-2" onClick={() => setActionsOpen((value) => !value)}>
              <MoreVertical className="h-4 w-4" />
              Actions
            </Button>
            {actionsOpen ? (
              <div className="absolute right-0 top-full z-30 mt-2 w-48 overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-xl">
                <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted" onClick={printLedger}>
                  <Printer className="h-4 w-4" /> Print
                </button>
                <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted" onClick={downloadCsv}>
                  <DownloadActionIcon className="h-4 w-4" /> Export CSV
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
                  Ledger Statement
                </h1>
                <p className="text-xs text-muted-foreground">
                  Status: Active | Created: {account ? fmtDate(lines[0]?.createdAt) : "-"}
                </p>
              </div>
              <div className="text-xs text-muted-foreground">
                Account: <span className="font-semibold text-foreground">{safeText(account?.accountCode)}</span>
              </div>
            </div>
          </div>

          <div className="grid gap-0 border-b lg:grid-cols-4">
            <InfoPanel title="Account Details" accent="cyan">
              <InfoRow label="A/c Name" value={safeText(account?.accountName)} strong />
              <InfoRow label="A/c Number" value={safeText(account?.accountCode)} strong />
              <InfoRow label="Manual Ref" value={safeText(account?.manualReferenceNumber)} />
              <InfoRow label="Customer No" value={safeText(account?.customerNumber)} />
              <InfoRow label="Category" value={safeText(account?.accountKind)} />
              <InfoRow label="Currency" value={safeText(account?.ledgerCurrency)} strong />
              <InfoRow label="Ledger" value={safeText(account?.ledgerCode)} strong />
            </InfoPanel>

            <InfoPanel title="Company Details" accent="blue">
              <InfoRow label="Company Name" value={safeText(account?.companyName)} />
              <InfoRow label="Country" value={safeText(account?.countryName)} />
              <InfoRow label="Main Branch" value={safeText(account?.countryBranchName)} />
              <InfoRow label="City Branch" value={safeText(account?.cityBranchName)} />
              <InfoRow label="State / City" value={`${safeText(account?.stateName)} / ${safeText(account?.cityName)}`} />
              <InfoRow label="Address" value={safeText(account?.address)} />
            </InfoPanel>

            <InfoPanel title="Ledger Summary" accent="indigo">
              <InfoRow label="Entries" value={String(totals.entries)} />
              <InfoRow label="Dr" value={fmtNumber(totals.debit || account?.debitTotal)} danger />
              <InfoRow label="Cr" value={fmtNumber(totals.credit || account?.creditTotal)} success />
              <InfoRow label="Opening" value={fmtBalance(openingBalance, account?.normalBalance).text} />
              <InfoRow 
                label="Balance" 
                value={fmtBalance(totals.balance || account?.currentBalance || 0, account?.normalBalance).text} 
                success={fmtBalance(totals.balance || account?.currentBalance || 0, account?.normalBalance).isCr}
                danger={fmtBalance(totals.balance || account?.currentBalance || 0, account?.normalBalance).isDr}
                strong={!fmtBalance(totals.balance || account?.currentBalance || 0, account?.normalBalance).isCr && !fmtBalance(totals.balance || account?.currentBalance || 0, account?.normalBalance).isDr} 
              />
              {isSuperAdmin && <InfoRow label="1 USD" value="Rate stored per posting" />}
            </InfoPanel>

            <InfoPanel title="Session / Login Details" accent="violet">
              <InfoRow label="Session Branch" value={branchLabel(account)} strong />
              <InfoRow label="Login Date" value={new Date().toLocaleDateString()} />
              <InfoRow label="Login Time" value={new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} />
              <InfoRow label="User Name" value={safeText(session?.user?.fullName ?? "Super Admin")} strong />
              <InfoRow label="User ID" value={safeText(session?.user?.id)} />
              <InfoRow label="System" value="ERP / FMS" />
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
                    <th key={head} className="border-b border-slate-700 px-4 py-3 text-left font-semibold uppercase tracking-wide">
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={isSuperAdmin ? 15 : 11} className="px-4 py-10 text-center text-muted-foreground">
                      Loading ledger data...
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
                    <td colSpan={isSuperAdmin ? 15 : 11} className="px-4 py-12 text-center text-muted-foreground">
                      {account ? "No posted ledger entries found for this account." : "Search an account to load the full ledger statement."}
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
  const accentClass = {
    cyan: "border-cyan-400 text-cyan-600 dark:text-cyan-300",
    blue: "border-blue-500 text-blue-600 dark:text-blue-300",
    indigo: "border-indigo-500 text-indigo-600 dark:text-indigo-300",
    violet: "border-violet-500 text-violet-600 dark:text-violet-300"
  }[accent];

  return (
    <section className="border-b p-5 lg:border-b-0 lg:border-r last:lg:border-r-0">
      <h2 className={cn("mb-3 border-l-4 pl-3 text-xs font-bold uppercase tracking-wide", accentClass)}>{title}</h2>
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
  return (
    <div className="grid grid-cols-[110px_1fr] gap-3 text-xs">
      <span className="text-muted-foreground">{label}:</span>
      <span
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
