"use client";

import { DownloadActionIcon } from "@/components/ui/download-action-icon";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ChevronDown, Calendar, Download, Loader2, MoreVertical, Printer, RefreshCcw, Search, ChevronRight, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchSelect, type SearchSelectOption } from "@/components/ui/search-select";
import { apiGet } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { t } from "@/lib/i18n/ui";
import { openA4ReportWindow } from "@/lib/reports/open-a4-report-window";
import { DetailDrawer } from "@/components/ui/detail-drawer";
import {
  getLedgerStatement,
  type LedgerLookupRow,
  type LedgerReportScope,
  type LedgerStatementLine
} from "@/features/reports/ledger-report/ledger-report-api";
import { ProfessionalReportViewer, type ReportColumn } from "@/components/reports/professional-report-viewer";
import { useActiveLanguage as useHeaderLanguage } from "@/lib/i18n/use-active-language";
import { translateHeader } from "@/lib/i18n/table-headers";

type GeneralReportRow = LedgerLookupRow & {
  branch: string;
  status: "active" | "inactive";
  entries: number;
  debit: number;
  credit: number;
  balance: number;
  openingBalance?: number;
  balanceDate: string | null;
  lastActivityAt: string | null;
  lastReferenceNo: string | null;
  lastSource: "ledger" | "roznamcha" | null;
  lastDescription: string | null;
  lastEntryDate: string | null;
  usdDebit?: number;
  usdCredit?: number;
  usdBalance?: number;
};

type GeneralReportResponse = {
  reportScope: LedgerReportScope;
  generatedAt: string;
  filters: {
    q: string | null;
    scope: string | null;
    countryId: string | null;
    countryBranchId: string | null;
    cityBranchId: string | null;
    ledgerId: string | null;
    fromDate: string;
    toDate: string;
  };
  summary: {
    totalLedgers: number;
    activeLedgers: number;
    inactiveLedgers: number;
    entries: number;
    debit: number;
    credit: number;
    balance: number;
  };
  rows: GeneralReportRow[];
  selectedLedger: GeneralReportRow | null;
  statement: {
    found: boolean;
    header: LedgerLookupRow | null;
    lines: LedgerStatementLine[];
    totals: {
      entries: number;
      debit: number;
      credit: number;
      balance: number;
      usdDebit: number;
      usdCredit: number;
    };
  } | null;
};

type SessionInfo = {
  user: { id: string; email: string | null; fullName: string | null };
  roles: string[];
};

function fmtNumber(value: number) {
  const n = Number.isFinite(value) ? value : 0;
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

function fmtRate(value: number) {
  const n = Number.isFinite(value) ? value : 0;
  return n ? n.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 8 }) : "-";
}

function safeText(value: string | null | undefined) {
  const v = (value ?? "").toString().trim();
  return v || "-";
}

function titleCase(input: string) {
  const v = input.trim();
  if (!v) return v;
  return v
    .split(/[\s_-]+/g)
    .filter(Boolean)
    .map((p) => p.slice(0, 1).toUpperCase() + p.slice(1))
    .join(" ");
}

function fmtKind(value: string | null | undefined) {
  const v = (value ?? "").toString().trim();
  return v ? titleCase(v) : "-";
}

function formatDateString(isoString?: string | null) {
  if (!isoString) return "-";
  try {
    return isoString.split("T")[0] || "-";
  } catch {
    return "-";
  }
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function monthStartIso() {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

function yesterdayIso() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function weekStartIso() {
  const d = new Date();
  const day = d.getDay();
  const diff = (day + 6) % 7;
  d.setDate(d.getDate() - diff);
  return d.toISOString().slice(0, 10);
}

function normalizeForSearch(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildLedgerOption(row: LedgerLookupRow): SearchSelectOption {
  const branch = row.cityBranchName || row.countryBranchName || row.countryName || "";
  const label = `${row.accountCode || row.ledgerCode} Â· ${row.accountName || row.ledgerName}${branch ? ` Â· ${branch}` : ""}`;
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

function buildBranchLabel(row: GeneralReportRow) {
  return row.branch || row.cityBranchName || row.countryBranchName || row.countryName || "-";
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

function badgeClass(status: "active" | "inactive") {
  return status === "active"
    ? "rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300"
    : "rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300";
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

export function LedgerReportView({
  lang,
  reportScope,
  pageTitle,
  initialLedgerId,
  initialFromDate,
  initialToDate
}: {
  lang: SupportedLanguage;
  reportScope: LedgerReportScope;
  pageTitle: string;
  initialLedgerId?: string | null;
  initialFromDate?: string | null;
  initialToDate?: string | null;
}) {
  const router = useRouter();
  const activeLang = useHeaderLanguage();
  const effectiveLang = activeLang || lang;
  const [loading, setLoading] = useState(true);
  const [loadingStatement, setLoadingStatement] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showAllCountries, setShowAllCountries] = useState(false);
  const [accountSearch, setAccountSearch] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [selectedCountry, setSelectedCountry] = useState("");
  const [selectedUser, setSelectedUser] = useState("");
  const [dateDropdownOpen, setDateDropdownOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [datePreset, setDatePreset] = useState<"today" | "yesterday" | "this_week" | "this_month" | "custom">(
    initialFromDate || initialToDate ? "custom" : "this_month"
  );
  const [fromDate, setFromDate] = useState(initialFromDate ?? monthStartIso());
  const [toDate, setToDate] = useState(initialToDate ?? todayIso());
  const [ledgerId, setLedgerId] = useState(initialLedgerId ?? "");
  const [menuOpen, setMenuOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [printMode, setPrintMode] = useState(false);
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const canViewConversionColumns = useMemo(() => {
    const roles = (sessionInfo?.roles ?? []).map((role) => String(role).toLowerCase());
    return Boolean(sessionInfo?.scopes?.isSuperAdmin || roles.includes("super_admin"));
  }, [sessionInfo]);
  const [rows, setRows] = useState<GeneralReportRow[]>([]);
  const [summary, setSummary] = useState<GeneralReportResponse["summary"] | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [statement, setStatement] = useState<GeneralReportResponse["statement"]>(null);
  const [selectedLedger, setSelectedLedger] = useState<GeneralReportRow | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 40;

  const [actionsSlot, setActionsSlot] = useState<Element | null>(null);
  useEffect(() => {
    setActionsSlot(document.getElementById("erp-page-actions-slot"));
  }, []);

  const countryOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const row of rows) {
      if (row.countryId && row.countryName) {
        seen.set(row.countryId, row.countryName);
      }
    }
    const list = Array.from(seen.entries()).map(([value, label]) => ({ value, label }));
    return [{ value: "", label: "All Countries" }, ...list];
  }, [rows]);

  const branchOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const row of rows) {
      const branchId = row.cityBranchId || row.countryBranchId;
      const branchName = row.cityBranchName || row.countryBranchName;
      if (branchId && branchName) {
        seen.set(branchId, branchName);
      }
    }
    const list = Array.from(seen.entries()).map(([value, label]) => ({ value, label }));
    return [{ value: "", label: "All Branches" }, ...list];
  }, [rows]);

  const userOptions = useMemo(() => {
    const seen = new Set<string>();
    if (statement?.lines) {
      for (const line of statement.lines) {
        if (line.createdByName) seen.add(line.createdByName);
      }
    }
    const list = Array.from(seen).map((u) => ({ value: u, label: u }));
    return [{ value: "", label: "All Users" }, ...list];
  }, [statement?.lines]);

  const filteredLedgers = useMemo(() => {
    let list = rows;
    if (selectedCountry) {
      list = list.filter((row) => row.countryId === selectedCountry);
    }
    if (branchFilter) {
      list = list.filter((row) => row.cityBranchId === branchFilter || row.countryBranchId === branchFilter);
    }
    return list;
  }, [rows, selectedCountry, branchFilter]);

  const ledgerOptions = useMemo(() => filteredLedgers.map((row) => buildLedgerOption(row)), [filteredLedgers]);

  const displayedLines = useMemo(() => {
    if (!statement?.lines) return [];
    let list = statement.lines;
    if (selectedUser) {
      list = list.filter((line) => line.createdByName === selectedUser);
    }
    return list;
  }, [statement?.lines, selectedUser]);



  async function loadReport(nextLedgerId = ledgerId, nextAccountSearch = accountSearch) {
    setLoading(true);
    try {
      const qp = new URLSearchParams();
      qp.set("reportScope", reportScope);
      qp.set("fromDate", fromDate);
      qp.set("toDate", toDate);
      qp.set("limit", "250");
      if (nextLedgerId) qp.set("ledgerId", nextLedgerId);
      const qParts = [nextAccountSearch.trim(), branchFilter.trim()].filter(Boolean);
      if (qParts.length) qp.set("q", qParts.join(" "));

      const res = await apiGet<GeneralReportResponse>(`/api/erp/accounting/reports/ledger/general?${qp.toString()}`);
      setRows(res.rows ?? []);
      setSummary(res.summary ?? null);
      setGeneratedAt(res.generatedAt ?? null);
      setStatement(res.statement ?? null);
      setSelectedLedger(res.selectedLedger ?? null);
      if (res.selectedLedger?.ledgerId) setLedgerId(res.selectedLedger.ledgerId);
      setPage(1);
    } finally {
      setLoading(false);
    }
  }

  async function loadSelectedStatement(nextLedgerId: string) {
    if (!nextLedgerId) {
      setStatement(null);
      setSelectedLedger(null);
      return;
    }

    setLoadingStatement(true);
    try {
      const res = await getLedgerStatement({
        ledgerId: nextLedgerId,
        fromDate,
        toDate,
        limit: 5000,
        language: effectiveLang
      });
      setStatement({
        found: Boolean(res.header),
        header: res.header,
        lines: res.lines,
        totals: {
          entries: res.lines.length,
          debit: res.lines.reduce((sum, row) => sum + row.debit, 0),
          credit: res.lines.reduce((sum, row) => sum + row.credit, 0),
          balance: res.lines.length ? res.lines[res.lines.length - 1]!.runningBalance : 0,
          usdDebit: res.lines.reduce((sum, row) => sum + (row.debit > 0 ? row.usdAmount : 0), 0),
          usdCredit: res.lines.reduce((sum, row) => sum + (row.credit > 0 ? row.usdAmount : 0), 0)
        }
      });
      setSelectedLedger(res.header ? rows.find((row) => row.ledgerId === nextLedgerId) ?? null : null);
      setLedgerId(nextLedgerId);
    } finally {
      setLoadingStatement(false);
    }
  }

  useEffect(() => {
    fetch("/api/erp/auth/session", { credentials: "include" })
      .then((r) => r.json())
      .then((info) => setSessionInfo(info))
      .catch(() => null);
  }, []);

  useEffect(() => {
    if (datePreset === "custom") return;
    if (datePreset === "today") {
      const d = todayIso();
      setFromDate(d);
      setToDate(d);
    } else if (datePreset === "yesterday") {
      const d = yesterdayIso();
      setFromDate(d);
      setToDate(d);
    } else if (datePreset === "this_week") {
      setFromDate(weekStartIso());
      setToDate(todayIso());
    } else {
      setFromDate(monthStartIso());
      setToDate(todayIso());
    }
  }, [datePreset]);

  useEffect(() => {
    void loadReport(initialLedgerId ?? ledgerId, accountSearch);

    const handleSaved = () => {
      void loadReport(initialLedgerId ?? ledgerId, accountSearch);
    };

    window.addEventListener("erp:posting-saved", handleSaved);
    window.addEventListener("erp:posting-deleted", handleSaved);
    return () => {
      window.removeEventListener("erp:posting-saved", handleSaved);
      window.removeEventListener("erp:posting-deleted", handleSaved);
    };
  }, []);

  const displayRows = useMemo(() => {
    const q = normalizeForSearch(accountSearch.trim());
    let list = rows;
    if (selectedCountry) {
      list = list.filter((row) => row.countryId === selectedCountry);
    }
    if (branchFilter) {
      list = list.filter((row) => row.cityBranchId === branchFilter || row.countryBranchId === branchFilter);
    }
    if (statusFilter !== "all") {
      list = list.filter((row) => row.status === statusFilter);
    }
    if (q) {
      list = list.filter((row) =>
        normalizeForSearch(
          [
            row.ledgerCode,
            row.ledgerName,
            row.accountCode,
            row.accountName,
            row.companyName,
            row.countryName,
            row.stateName,
            row.cityName,
            row.countryBranchName,
            row.cityBranchName
          ]
            .filter(Boolean)
            .join(" ")
        ).includes(q)
      );
    }
    return list;
  }, [accountSearch, branchFilter, rows, statusFilter, selectedCountry]);

  const pageCount = Math.max(1, Math.ceil(displayRows.length / pageSize));
  const tableRows = displayRows.slice((page - 1) * pageSize, page * pageSize);

  const totalLedgers = summary?.totalLedgers ?? rows.length;
  const activeLedgers = summary?.activeLedgers ?? rows.filter((row) => row.status === "active").length;
  const inactiveLedgers = summary?.inactiveLedgers ?? rows.filter((row) => row.status === "inactive").length;

  const countrySummaries = useMemo(() => {
    const map = new Map<string, { country: string; currency: string; activeAccounts: number; totalEntries: number; debit: number; credit: number; balance: number }>();
    for (const row of displayRows) {
      const c = row.countryName || "Unknown Country";
      if (!map.has(c)) {
        map.set(c, {
          country: c,
          currency: row.ledgerCurrency || "",
          activeAccounts: 0,
          totalEntries: 0,
          debit: 0,
          credit: 0,
          balance: 0
        });
      }
      const item = map.get(c)!;
      if (row.status === "active") item.activeAccounts += 1;
      item.totalEntries += row.entries || 0;
      item.debit += row.debit || 0;
      item.credit += row.credit || 0;
      item.balance += row.balance || 0;
      if (!item.currency && row.ledgerCurrency) {
        item.currency = row.ledgerCurrency;
      }
    }
    return Array.from(map.values()).sort((a, b) => a.country.localeCompare(b.country));
  }, [displayRows]);

  const countryDashboardData = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        currency: string;
        activeAccounts: number;
        entries: number;
        debit: number;
        credit: number;
        balance: number;
        branches: Set<string>;
        branchData: Map<string, { name: string; entries: number; debit: number; credit: number; balance: number }>;
      }
    >();

    for (const row of displayRows) {
      const countryName = row.countryName || "United Arab Emirates";
      const branchName = row.cityBranchName || row.countryBranchName || row.branch || "Main Branch";
      const currency = row.ledgerCurrency || "AED";

      if (!map.has(countryName)) {
        map.set(countryName, {
          name: countryName,
          currency,
          activeAccounts: 0,
          entries: 0,
          debit: 0,
          credit: 0,
          balance: 0,
          branches: new Set(),
          branchData: new Map()
        });
      }

      const cData = map.get(countryName)!;
      if (row.status === "active") cData.activeAccounts += 1;
      cData.entries += row.entries || 0;
      cData.debit += row.debit || 0;
      cData.credit += row.credit || 0;
      cData.balance += row.balance || 0;
      cData.branches.add(branchName);

      if (!cData.branchData.has(branchName)) {
        cData.branchData.set(branchName, {
          name: branchName,
          entries: 0,
          debit: 0,
          credit: 0,
          balance: 0
        });
      }

      const bData = cData.branchData.get(branchName)!;
      bData.entries += row.entries || 0;
      bData.debit += row.debit || 0;
      bData.credit += row.credit || 0;
      bData.balance += row.balance || 0;
    }

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [displayRows]);


  function openPrint(autoPrint: boolean) {
    openA4ReportWindow({
      title: "Ledger General Report",
      subtitle: `Generated ${generatedAt ? new Date(generatedAt).toLocaleString() : new Date().toLocaleString()}`,
      rows: [
        { label: "Report Scope", value: reportScope },
        { label: "Generated Date", value: generatedAt ? new Date(generatedAt).toLocaleString() : new Date().toLocaleString() },
        { label: "Ledgers", value: String(totalLedgers) },
        { label: "Active", value: String(activeLedgers) },
        { label: "Inactive", value: String(inactiveLedgers) },
        { label: "Total Entries", value: fmtNumber(summary?.entries ?? 0) },
        { label: "Debit", value: fmtNumber(summary?.debit ?? 0) },
        { label: "Credit", value: fmtNumber(summary?.credit ?? 0) },
        { label: "Balance", value: fmtNumber(summary?.balance ?? 0) },
        { label: "Selected Ledger", value: selectedLedger?.ledgerName ?? "-" },
        { label: "Account No", value: selectedLedger?.accountCode ?? selectedLedger?.ledgerCode ?? "-" },
        { label: "Currency", value: selectedLedger?.ledgerCurrency ?? "-" },
        { label: "Branch", value: selectedLedger ? buildBranchLabel(selectedLedger) : "-" }
      ],
      autoPrint,
      lang
    });
  }

  function exportReportCsv() {
    const rowsCsv = [
      [
        "S.No",
        "Country",
        "Branch",
        "Account No",
        "Account Name",
        "Entries",
        "Opening Bal",
        "Credit",
        "Debit",
        "Created Date",
        "Last Entry Date",
        "Balance"
      ],
      ...displayRows.map((row, index) => [
        String(index + 1),
        row.countryName || "-",
        buildBranchLabel(row),
        row.accountCode || row.ledgerCode || "-",
        row.accountName || row.ledgerName || "-",
        String(row.entries ?? 0),
        fmtNumber(row.openingBalance ?? 0),
        fmtNumber(row.credit ?? 0),
        fmtNumber(row.debit ?? 0),
        formatDateString(row.createdAt),
        formatDateString(row.lastEntryDate),
        fmtNumber(row.balance ?? 0)
      ])
    ];
    exportCsv(`ledger-general-report_${new Date().toISOString().slice(0, 10)}.csv`, rowsCsv);
  }

  function resetFilters() {
    setAccountSearch("");
    setBranchFilter("");
    setStatusFilter("all");
    setSelectedCountry("");
    setSelectedUser("");
    setDatePreset("this_month");
    setFromDate(monthStartIso());
    setToDate(todayIso());
    setLedgerId("");
    setStatement(null);
    setSelectedLedger(null);
    setPage(1);
    void loadReport("", "");
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    function onMouseDown(e: MouseEvent) {
      const el = document.getElementById("ledger-actions-menu");
      if (el && !el.contains(e.target as Node)) setMenuOpen(false);
    }
    if (menuOpen) {
      document.addEventListener("keydown", onKeyDown);
      document.addEventListener("mousedown", onMouseDown);
      return () => {
        document.removeEventListener("keydown", onKeyDown);
        document.removeEventListener("mousedown", onMouseDown);
      };
    }
  }, [menuOpen]);

  return (
    <div className="w-full bg-slate-50/50 dark:bg-background text-foreground animate-in fade-in duration-200">
      {actionsSlot && createPortal(
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="sm" className="gap-2" onClick={() => router.back()}>
            <ChevronRight className="h-4 w-4 rotate-180" aria-hidden />
            {t(effectiveLang, "ledger.back", "Back")}
          </Button>
          <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => setFiltersOpen((v) => !v)}>
            <Search className="h-4 w-4" aria-hidden />
            {filtersOpen ? t(effectiveLang, "ledger.hide_filters", "Hide Filters") : t(effectiveLang, "ledger.search_filters", "Search / Filters")}
          </Button>
        </div>,
        actionsSlot
      )}
      <div className="mx-auto w-full max-w-[1800px] p-4 sm:p-6 lg:p-8 space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <ReportHeader
          title={pageTitle}
          generatedAt={generatedAt}
          fromDate={fromDate}
          toDate={toDate}
        />
        {/* Account Details moved to Header area */}
        {selectedLedger ? (
          <div className="flex items-center gap-3 rounded-lg border bg-slate-50/50 p-2 px-3 shadow-sm dark:bg-slate-900/50">
            <div className="text-sm">
              <span className="text-muted-foreground">Account: </span>
              <span className="font-bold">{selectedLedger.accountName || selectedLedger.ledgerName || "-"}</span>
            </div>
            <span className={badgeClass(selectedLedger.status === "inactive" ? "inactive" : "active")}>
              {selectedLedger.status === "inactive" ? "Inactive" : "Active"}
            </span>
            <Button type="button" variant="outline" size="sm" className="ml-2 gap-2" onClick={() => {
              if (selectedLedger && (selectedLedger.accountCode || selectedLedger.ledgerCode)) {
                router.push(`/dashboard/ledger/new?account=${encodeURIComponent(selectedLedger.accountCode || selectedLedger.ledgerCode)}`);
              } else if (selectedLedger?.ledgerId) {
                void loadSelectedStatement(selectedLedger.ledgerId);
              }
            }}>
              View Ledger
            </Button>
          </div>
        ) : null}
      </div>

      {filtersOpen ? (
        <div className="rounded-lg border bg-card p-3 shadow-sm print:hidden">
          <div className="flex flex-wrap items-center gap-2">
            {/* 1. Account Search select */}
            <div className="w-full md:w-[320px]">
              <SearchSelect
                label=""
                value={ledgerId}
                placeholder={t(effectiveLang, "ledger.select_account_ph")}
                options={ledgerOptions}
                onValueChange={(value) => {
                  setLedgerId(value);
                  void loadSelectedStatement(value);
                }}
                onOpenChange={(open) => {
                  if (open) setMenuOpen(false);
                }}
              />
            </div>

            {/* 2. Country filter */}
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

            {/* 3. Branch filter */}
            <div className="w-full md:w-[160px]">
              <SearchSelect
                label=""
                value={branchFilter}
                placeholder={t(effectiveLang, "ledger.all_branches")}
                options={branchOptions}
                onValueChange={(value) => {
                  setBranchFilter(value);
                  setLedgerId("");
                }}
              />
            </div>

            {/* 4. User filter */}
            <div className="w-full md:w-[150px]">
              <SearchSelect
                label=""
                value={selectedUser}
                placeholder="All Users"
                options={userOptions}
                onValueChange={(value) => {
                  setSelectedUser(value);
                }}
                disabled={!statement?.lines?.length}
              />
            </div>

            {/* 5. Status filter */}
            <div className="w-full md:w-[130px]">
              <SearchSelect
                label=""
                value={statusFilter}
                placeholder="All Statuses"
                options={[
                  { value: "all", label: "All Statuses" },
                  { value: "active", label: "Active" },
                  { value: "inactive", label: "Inactive" }
                ]}
                onValueChange={(value) => {
                  setStatusFilter(value as "all" | "active" | "inactive");
                }}
              />
            </div>

            {/* 6. Date Range dropdown popover */}
            <div className="relative w-full md:w-auto">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDateDropdownOpen(!dateDropdownOpen)}
                className="h-10 w-full md:w-auto text-xs gap-2"
              >
                <Calendar className="h-4 w-4" />
                {fromDate} â†’ {toDate}
              </Button>
              {dateDropdownOpen ? (
                <div className="absolute right-0 md:left-0 mt-2 z-30 w-64 p-3 bg-popover text-popover-foreground rounded-lg border shadow-lg space-y-3 bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100">
                  <div className="space-y-1">
                    <span className="text-[11px] text-muted-foreground font-semibold">From Date</span>
                    <Input
                      type="date"
                      value={fromDate}
                      onChange={(e) => {
                        setDatePreset("custom");
                        setFromDate(e.target.value);
                      }}
                      className="h-9 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] text-muted-foreground font-semibold">To Date</span>
                    <Input
                      type="date"
                      value={toDate}
                      onChange={(e) => {
                        setDatePreset("custom");
                        setToDate(e.target.value);
                      }}
                      className="h-9 text-xs"
                    />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    className="w-full font-bold"
                    onClick={() => {
                      setDateDropdownOpen(false);
                      void loadReport(ledgerId, accountSearch);
                    }}
                  >
                    Apply Date Range
                  </Button>
                </div>
              ) : null}
            </div>

            {/* 7. Search Input field for queries */}
            <div className="w-full md:w-[180px]">
              <Input
                className="h-10 text-xs"
                value={accountSearch}
                onChange={(e) => setAccountSearch(e.target.value)}
                placeholder="Filter text..."
              />
            </div>

            {/* 8. Search/Apply and Reset buttons */}
            <Button type="button" onClick={() => void loadReport(ledgerId, accountSearch)} disabled={loading} className="h-10 gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Apply
            </Button>
            <Button type="button" variant="outline" onClick={resetFilters} disabled={loading} className="h-10">
              Reset
            </Button>

            {/* 9. Actions button pushed to far right corner */}
            <div id="ledger-actions-menu" className="relative ml-auto">
              <Button type="button" variant="outline" className="h-10 gap-2" onClick={() => setMenuOpen((v) => !v)}>
                <MoreVertical className="h-4 w-4" />
                Actions
              </Button>
              {menuOpen ? (
                <div className="absolute right-0 top-full z-20 mt-2 w-56 overflow-hidden rounded-xl border bg-background shadow-xl bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100">
                  <MenuAction icon={<Printer className="h-4 w-4" />} label={t(effectiveLang, "ledger.print")} onClick={() => openPrint(true)} />
                  <MenuAction icon={<DownloadActionIcon className="h-4 w-4" />} label="PDF Export" onClick={() => openPrint(false)} />
                  <MenuAction icon={<DownloadActionIcon className="h-4 w-4" />} label={t(effectiveLang, "ledger.export_csv")} onClick={exportReportCsv} />
                  <MenuAction
                    icon={<Search className="h-4 w-4" />}
                    label="View Ledger"
                    onClick={() => {
                      setMenuOpen(false);
                      if (selectedLedger && (selectedLedger.accountCode || selectedLedger.ledgerCode)) {
                        router.push(`/dashboard/ledger/new?account=${encodeURIComponent(selectedLedger.accountCode || selectedLedger.ledgerCode)}`);
                      } else if (selectedLedger?.ledgerId) {
                        void loadSelectedStatement(selectedLedger.ledgerId);
                      }
                    }}
                  />
                  <MenuAction
                    icon={<ChevronDown className="h-4 w-4" />}
                    label="Open Journal"
                    onClick={() => {
                      setMenuOpen(false);
                      if (selectedLedger && (selectedLedger.accountCode || selectedLedger.ledgerCode)) {
                        router.push(`/dashboard/ledger/new?account=${encodeURIComponent(selectedLedger.accountCode || selectedLedger.ledgerCode)}`);
                      } else if (selectedLedger?.ledgerId) {
                        void loadSelectedStatement(selectedLedger.ledgerId);
                      }
                    }}
                  />
                  <MenuAction
                    icon={<RefreshCcw className="h-4 w-4" />}
                    label="Account Activity"
                    onClick={() => {
                      setMenuOpen(false);
                      if (selectedLedger && (selectedLedger.accountCode || selectedLedger.ledgerCode)) {
                        router.push(`/dashboard/ledger/new?account=${encodeURIComponent(selectedLedger.accountCode || selectedLedger.ledgerCode)}`);
                      } else if (selectedLedger?.ledgerId) {
                        void loadSelectedStatement(selectedLedger.ledgerId);
                      }
                    }}
                  />
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

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
              <span className="font-bold text-slate-800 dark:text-slate-200">{(sessionInfo as any)?.scopes?.summary?.countryName || "United Arab Emirates"}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>BRANCH NAME:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 uppercase">{(sessionInfo as any)?.scopes?.summary?.branchDisplayName || (sessionInfo as any)?.scopes?.summary?.branchName || "UNITED ARAB EMIRATES MAIN BRANCH"}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>USER ID:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 uppercase text-[9px] font-mono">{sessionInfo?.user?.id || "9B9D24D9-5532-47A1-B612-3E95F2285AB6"}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>USER NAME:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 uppercase">{sessionInfo?.user?.fullName || sessionInfo?.user?.email || "SUPER ADMIN"}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>ROLE:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 uppercase">{(sessionInfo as any)?.roles?.[0]?.replace(/_/g, " ") || "SUPER ADMIN"}</span>
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
              <span>TOTAL GLOBAL ENTRIES:</span>
              <span className="font-black text-slate-800 dark:text-slate-200">{summary?.entries || displayRows.reduce((acc, r) => acc + (r.entries || 0), 0)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>TOTAL CREDIT (AED):</span>
              <span className="font-black text-emerald-600 dark:text-emerald-400 font-mono">{fmtNumber(summary?.credit || displayRows.reduce((acc, r) => acc + (r.credit || 0), 0))}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-rose-600 dark:text-rose-400">TOTAL DEBIT (AED):</span>
              <span className="font-black text-rose-600 dark:text-rose-400 font-mono">{fmtNumber(summary?.debit || displayRows.reduce((acc, r) => acc + (r.debit || 0), 0))}</span>
            </div>
            <div className="flex justify-between items-center mt-auto pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="text-slate-700 dark:text-slate-300 font-bold">BALANCE (AED):</span>
              <span className="font-black text-blue-600 dark:text-blue-400 font-mono text-sm">{fmtNumber(summary?.balance || displayRows.reduce((acc, r) => acc + (r.balance || 0), 0))}</span>
            </div>
            {displayRows.length === 0 && !loading && (
              <div className="mt-1 rounded bg-emerald-50/60 dark:bg-emerald-950/30 p-1.5 text-[10px] text-emerald-800 dark:text-emerald-300 font-medium text-center">
                No financial entries available for the selected date range.
              </div>
            )}
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
              <span className="font-black text-slate-800 dark:text-slate-200">{displayRows.length}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>CLEARED ENTRIES:</span>
              <span className="font-black text-emerald-600 dark:text-emerald-400">0</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-rose-600">REMAINING ENTRIES:</span>
              <span className="font-black text-rose-600">{displayRows.length}</span>
            </div>
            <div className="flex justify-between items-center mt-auto pt-2 border-t border-slate-100 dark:border-slate-800 text-[10px]">
              <span>SYSTEM STATUS:</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">ONLINE & SYNCED</span>
            </div>
            {displayRows.length === 0 && !loading && (
              <div className="mt-1 rounded bg-purple-50/60 dark:bg-purple-950/30 p-1.5 text-[10px] text-purple-800 dark:text-purple-300 font-medium text-center">
                No bill entries found for the selected period.
              </div>
            )}
          </div>
        </div>

        {/* Panel 4: All Countries Report */}
        <div
          className={cn(
            "flex flex-col rounded-xl border transition-all duration-200 text-left overflow-hidden h-full",
            showAllCountries
              ? "border-orange-500 bg-orange-50/30 shadow-md dark:border-orange-500/50 dark:bg-orange-950/20"
              : "border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
          )}
        >
          <div className={cn(
            "flex items-center justify-between px-4 py-3 border-b w-full",
            showAllCountries
              ? "border-orange-200 bg-orange-100/50 dark:border-orange-900/50 dark:bg-orange-900/30"
              : "border-slate-100 bg-orange-50/50 dark:border-slate-800 dark:bg-orange-900/10"
          )}>
            <div className="flex items-center gap-2">
              <div className="bg-orange-600 p-1 rounded-full text-white">
                <Globe className="h-3.5 w-3.5" />
              </div>
              <h4 className="text-xs font-black uppercase tracking-wider text-orange-800 dark:text-orange-400">
                4. ALL COUNTRIES REPORT
              </h4>
            </div>
          </div>
          <div className="p-4 flex flex-col justify-between flex-1 w-full gap-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400 h-full">
            <div className="flex justify-between items-center">
              <span>TOTAL COUNTRIES:</span>
              <span className="font-black text-slate-800 dark:text-slate-200">{countryDashboardData.length || countries.length || 1}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>TOTAL ENTRIES:</span>
              <span className="font-black text-slate-800 dark:text-slate-200">{countryDashboardData.reduce((acc, c) => acc + c.entries, 0)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>TOTAL CREDIT (AED):</span>
              <span className="font-black text-emerald-600 dark:text-emerald-400 font-mono">{fmtNumber(countryDashboardData.reduce((acc, c) => acc + c.credit, 0))}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-rose-600 dark:text-rose-400">TOTAL DEBIT (AED):</span>
              <span className="font-black text-rose-600 dark:text-rose-400 font-mono">{fmtNumber(countryDashboardData.reduce((acc, c) => acc + c.debit, 0))}</span>
            </div>
            <div className="flex justify-between items-center mt-auto pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowAllCountries(!showAllCountries)}
                className="w-full text-center text-[10.5px] uppercase font-bold text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 py-0.5 hover:underline flex items-center justify-center gap-1 cursor-pointer"
              >
                {showAllCountries ? "Hide All Countries Report ↑" : "View All Countries Report →"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Collapsible Country & Branch Breakdown Accordion */}
      {showAllCountries && (
        <div className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 shadow-sm overflow-hidden p-4 animate-in fade-in slide-in-from-top-2 duration-200 mb-4">
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
                    <span className="bg-white/20 text-[10px] font-bold px-2 py-0.5 rounded-full">{item.entries} Trx</span>
                  </div>
                  <div className="p-4 space-y-3 bg-white dark:bg-slate-950">
                    <div className="flex justify-between items-end border-b border-slate-100 dark:border-slate-800 pb-2">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Currency</span>
                      <span className="text-base font-black text-slate-800 dark:text-slate-200">{item.currency}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-500">Total Credit</span>
                      <span className="font-black text-emerald-600">{fmtNumber(item.credit)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-500">Total Debit</span>
                      <span className="font-black text-rose-600">{fmtNumber(item.debit)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-800">
                      <span className="text-xs font-bold text-slate-500 uppercase">Balance</span>
                      <span className="text-lg font-black text-slate-900 dark:text-slate-100">{fmtNumber(item.balance)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-800 text-[10px]">
                      <span className="font-semibold text-slate-500">{item.activeAccounts} Active Accounts</span>
                      <span className="font-semibold text-slate-500">{item.branches.size} Branches</span>
                    </div>
                  </div>
                </summary>

                {/* Branch Details Expanded Content */}
                <div className="bg-slate-50 dark:bg-slate-900/50 p-3 border-t border-slate-100 dark:border-slate-800 max-h-[300px] overflow-y-auto space-y-2">
                  <div className="text-[10px] font-bold uppercase text-slate-500 mb-1 pl-1">Branch Breakdown</div>
                  {Array.from(item.branchData.values()).map((b) => (
                    <div key={b.name} className="bg-white dark:bg-slate-950 rounded-lg p-2.5 border border-slate-200 dark:border-slate-800 shadow-sm">
                      <div className="flex justify-between items-center mb-2 pb-1.5 border-b border-slate-100 dark:border-slate-800">
                        <span className="text-[11px] font-black text-slate-800 dark:text-slate-200 uppercase truncate pr-2">{b.name}</span>
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 rounded">{b.entries} Trx</span>
                      </div>
                      <div className="flex justify-between items-center text-[10px] mb-1">
                        <span className="font-semibold text-slate-500">Credit:</span>
                        <span className="font-bold text-emerald-600">{fmtNumber(b.credit)}</span>
                      </div>
                      <div className="flex justify-between items-center text-[10px] mb-1">
                        <span className="font-semibold text-slate-500">Debit:</span>
                        <span className="font-bold text-rose-600">{fmtNumber(b.debit)}</span>
                      </div>
                      <div className="flex justify-between items-center text-[10px] pt-1 border-t border-slate-100 dark:border-slate-800">
                        <span className="font-semibold text-slate-500">Balance:</span>
                        <span className="font-bold text-blue-600">{fmtNumber(b.balance)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </div>
      )}

      {/* Account Details section was moved to header area per user request */}

      <section className="mb-3 rounded-xl border border-border bg-card p-4 shadow-sm dark:border-slate-700 dark:bg-[#0b1730] dark:shadow-[0_20px_80px_rgba(0,0,0,0.25)] text-slate-700 dark:text-slate-200">
        <div className="space-y-2 border-b border-border dark:border-slate-700 pb-3 mb-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-foreground dark:text-slate-100">{t(effectiveLang, "ledger.entries_table_title")}</h2>
              <p className="mt-1 text-xs text-muted-foreground dark:text-slate-400">
                {t(effectiveLang, "ledger.showing_range")} <span className="font-mono text-[11px] text-slate-500 dark:text-slate-300">{fromDate} → {toDate}</span>
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-xs text-muted-foreground dark:text-slate-500">
                {t(effectiveLang, "ledger.rows")}: <b className="text-foreground dark:text-slate-200">{tableRows.length}</b>
              </div>
              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                disabled={tableRows.length === 0 || loading}
                className="gap-2 bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 hover:text-blue-800 dark:bg-blue-900/20 dark:border-blue-800/50 dark:text-blue-300 dark:hover:bg-blue-900/40 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer" 
                onClick={() => setPrintMode(true)}
              >
                <Printer className="h-4 w-4" />
                {t(effectiveLang, "ledger.print_preview", "Print Preview")}
              </Button>
            </div>
          </div>
        </div>
        <div className="p-0">
          {(() => {
            const columns: ReportColumn<GeneralReportRow>[] = [
              { key: "index", header: "SR#", width: "40px", align: "center", render: (_, idx) => (page - 1) * pageSize + idx + 1 },
              { key: "startDate", header: "Starting Date", align: "center", render: () => formatDateString(fromDate) },
              { key: "lastDate", header: "Last Date", align: "center", render: () => formatDateString(toDate) },
              { key: "countryName", header: "Country", render: (r) => r.countryName || "-" },
              { key: "branch", header: "Branch", render: (r) => buildBranchLabel(r) },
              { key: "accountCode", header: "Account No", render: (r) => r.accountCode || r.ledgerCode },
              { key: "accountName", header: "Account Name", render: (r) => r.accountName || r.ledgerName },
              { key: "entries", header: "Entries", align: "right" },
              {
                key: "credit",
                header: "Credit",
                align: "right",
                render: (r) => (
                  <span className={cn("font-medium whitespace-nowrap", r.credit > 0 ? "text-emerald-600 dark:text-emerald-400" : "")}>
                    {r.ledgerCurrency} {fmtNumber(r.credit)}
                  </span>
                )
              },
              {
                key: "debit",
                header: "Debit",
                align: "right",
                render: (r) => (
                  <span className={cn("font-medium whitespace-nowrap", r.debit > 0 ? "text-rose-500" : "")}>
                    {r.ledgerCurrency} {fmtNumber(r.debit)}
                  </span>
                )
              },
              {
                key: "balance",
                header: "Balance",
                align: "right",
                render: (r) => (
                  <span className={cn("font-bold whitespace-nowrap", r.balance !== 0 ? "text-blue-600 dark:text-blue-400" : "")}>
                    {r.ledgerCurrency} {fmtNumber(r.balance)}
                  </span>
                )
              },
              ...(canViewConversionColumns ? ([
                {
                  key: "usdCredit",
                  header: "Credit (USD)",
                  align: "right",
                  render: (r: GeneralReportRow) => (
                    <span className={cn("font-medium whitespace-nowrap", r.usdCredit && r.usdCredit > 0 ? "text-emerald-600 dark:text-emerald-400" : "")}>
                      USD {fmtNumber(r.usdCredit ?? 0)}
                    </span>
                  )
                },
                {
                  key: "usdDebit",
                  header: "Debit (USD)",
                  align: "right",
                  render: (r: GeneralReportRow) => (
                    <span className={cn("font-medium whitespace-nowrap", r.usdDebit && r.usdDebit > 0 ? "text-rose-500" : "")}>
                      USD {fmtNumber(r.usdDebit ?? 0)}
                    </span>
                  )
                },
                {
                  key: "usdBalance",
                  header: "Balance (USD)",
                  align: "right",
                  render: (r: GeneralReportRow) => (
                    <span className={cn("font-bold whitespace-nowrap", r.usdBalance !== 0 ? "text-blue-600 dark:text-blue-400" : "")}>
                      USD {fmtNumber(r.usdBalance ?? 0)}
                    </span>
                  )
                }
              ] as ReportColumn<GeneralReportRow>[]) : []),
              {
                key: "action",
                header: "Action",
                align: "center",
                render: (row) => (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-slate-400 hover:text-slate-700 hover:bg-slate-200 no-print"
                    title="View Ledger"
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/dashboard/ledger/new?account=${encodeURIComponent(row.accountCode || row.ledgerCode)}`);
                    }}
                  >
                    <Search className="h-3.5 w-3.5" aria-hidden />
                  </Button>
                )
              }
            ];

            return (
              <>
                <ReportTable headers={columns.map(c => c.header)}>
                  {tableRows.slice((page - 1) * pageSize, page * pageSize).map((row, idx) => (
                    <tr key={row.ledgerId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                      {columns.map((c, cIdx) => (
                        <Td key={cIdx} className={c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : ""}>
                          {c.render ? c.render(row, idx) : (row as any)[c.key]}
                        </Td>
                      ))}
                    </tr>
                  ))}
                  {tableRows.length === 0 && !loading && (
                    <tr>
                      <Td className="text-center py-12 text-slate-500 bg-slate-50/50 dark:bg-slate-900/30" colSpan={columns.length}>
                        <div className="flex flex-col items-center justify-center gap-1.5 py-4">
                          <span className="font-semibold text-slate-700 dark:text-slate-300 text-sm">
                            No ledger entries found for the selected date range.
                          </span>
                          <span className="text-xs text-slate-400">
                            Try adjusting your date range, scope, or search filters to view records.
                          </span>
                        </div>
                      </Td>
                    </tr>
                  )}
                </ReportTable>
                <TableFooter
                  lang={effectiveLang}
                  text={t(effectiveLang, "ledger.showing_to_of_ledgers", "Showing {from} to {to} of {count} ledgers")
                    .replace("{from}", String(tableRows.length ? (page - 1) * pageSize + 1 : 0))
                    .replace("{to}", String(Math.min(page * pageSize, tableRows.length)))
                    .replace("{count}", String(tableRows.length))}
                  page={page}
                  pageCount={Math.max(1, Math.ceil(tableRows.length / pageSize))}
                  onPrev={() => setPage((p) => Math.max(1, p - 1))}
                  onNext={() => setPage((p) => Math.min(Math.ceil(tableRows.length / pageSize), p + 1))}
                  pageSize={pageSize}
                />

                {printMode && typeof document !== 'undefined' && createPortal(
                  <div className="fixed inset-0 z-[100] bg-black/80 flex flex-col">
                    <div className="flex-1 overflow-hidden">
                      <ProfessionalReportViewer
                        lang={effectiveLang}
                        title={t(effectiveLang, "ledger.hub_general_report_title", "Ledger General Report")}
                        subtitle={
                          reportScope === "super_admin"
                            ? t(effectiveLang, "report.scope_global", "Global")
                            : reportScope === "country"
                              ? t(effectiveLang, "report.scope_country", "Country")
                              : reportScope === "branch"
                                ? t(effectiveLang, "report.scope_branch", "Branch")
                                : reportScope
                        }
                        data={tableRows}
                        columns={columns}
                        filters={{
                          Scope:
                            reportScope === "super_admin"
                              ? t(effectiveLang, "report.scope_global", "Global")
                              : reportScope === "country"
                                ? t(effectiveLang, "report.scope_country", "Country")
                                : reportScope === "branch"
                                  ? t(effectiveLang, "report.scope_branch", "Branch")
                                  : reportScope,
                          "Date From": fromDate,
                          "Date To": toDate,
                        }}
                        summary={{
                          totalLedgers: summary?.totalLedgers || 0,
                          entries: summary?.entries || 0,
                          debit: summary?.debit || 0,
                          credit: summary?.credit || 0,
                          balance: summary?.balance || 0,
                        }}
                        rowsPerPage={pageSize}
                        onClose={() => setPrintMode(false)}
                      />
                    </div>
                  </div>,
                  document.body
                )}
              </>
            );
          })()}
        </div>
      </section>
      </div>

      <DetailDrawer
        isOpen={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setLedgerId("");
          setStatement(null);
          setSelectedLedger(null);
        }}
        title={`Ledger: ${selectedLedger?.accountName || selectedLedger?.ledgerName || "Details"}`}
        subtitle={`${t(effectiveLang, "ledger.ac_number", "A/c Number")}: ${selectedLedger?.accountCode || selectedLedger?.ledgerCode || "-"} · ${t(effectiveLang, "ledger.currency", "Currency")}: ${selectedLedger?.ledgerCurrency || "-"}`}
        actions={<ExportOptions onPrint={openPrint} onExportCsv={exportReportCsv} />}
      >
        {loadingStatement ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-sm text-muted-foreground animate-pulse">Loading ledger statement lines...</div>
          </div>
        ) : statement?.lines ? (
          <div className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Branch</span>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">{selectedLedger ? buildBranchLabel(selectedLedger) : "-"}</span>
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Category</span>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">{fmtKind(selectedLedger?.accountKind)}</span>
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Status</span>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">{selectedLedger?.status === "active" ? "Active" : "Inactive"}</span>
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Company</span>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">{selectedLedger?.companyName || "-"}</span>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Statement Entries</h3>
              <div className="overflow-x-auto rounded-lg border dark:border-slate-800">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-900 text-white dark:bg-slate-800">
                    <tr>
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Voucher / Ref</th>
                      <th className="px-3 py-2">Description</th>
                      <th className="px-3 py-2 text-right">Debit</th>
                      <th className="px-3 py-2 text-right">Credit</th>
                      <th className="px-3 py-2 text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-slate-800">
                    {displayedLines.map((line, idx) => {
                      const lineBal = fmtBalance(line.runningBalance, selectedLedger?.normalBalance);
                      return (
                        <tr key={idx} className={cn("hover:bg-slate-50/50 dark:hover:bg-slate-900/40", lineBal.color)}>
                          <td className="px-3 py-2 whitespace-nowrap">{line.entryDate}</td>
                          <td className="px-3 py-2 font-mono whitespace-nowrap">{line.referenceNo || line.sourceId.slice(0, 8)}</td>
                          <td className="px-3 py-2 max-w-[200px] truncate" title={line.description ?? undefined}>{line.description || "-"}</td>
                          <td className="px-3 py-2 text-right font-mono">
                            {line.debit ? fmtNumber(line.debit) : "-"}
                          </td>
                          <td className="px-3 py-2 text-right font-mono">
                            {line.credit ? fmtNumber(line.credit) : "-"}
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-bold">
                            {lineBal.text}
                          </td>
                        </tr>
                      );
                    })}
                    {displayedLines.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-3 py-4 text-center text-muted-foreground italic">No entries for this period.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border dark:bg-slate-900/30 dark:border-slate-800">
              <div>
                <span className="text-[10px] font-bold text-muted-foreground uppercase">Debit Total</span>
                <div className="text-sm font-extrabold text-rose-600 mt-0.5">{selectedLedger?.ledgerCurrency} {fmtNumber(displayedLines.reduce((sum, r) => sum + r.debit, 0))}</div>
              </div>
              <div>
                <span className="text-[10px] font-bold text-muted-foreground uppercase">Credit Total</span>
                <div className="text-sm font-extrabold text-emerald-600 mt-0.5">{selectedLedger?.ledgerCurrency} {fmtNumber(displayedLines.reduce((sum, r) => sum + r.credit, 0))}</div>
              </div>
              <div>
                <span className="text-[10px] font-bold text-muted-foreground uppercase">Closing Balance</span>
                <div className={cn("text-sm font-extrabold mt-0.5", fmtBalance(displayedLines.length ? displayedLines[displayedLines.length - 1]!.runningBalance : 0, selectedLedger?.normalBalance).color)}>
                  {selectedLedger?.ledgerCurrency} {fmtBalance(displayedLines.length ? displayedLines[displayedLines.length - 1]!.runningBalance : 0, selectedLedger?.normalBalance).text}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">{t(effectiveLang, "ledger.select_account_hint")}</div>
        )}
      </DetailDrawer>
    </div>
  );
}

function ExportOptions({ onPrint, onExportCsv }: { onPrint: (isPrint: boolean) => void; onExportCsv: () => void }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="gap-1">
        Export Options
        <ChevronRight className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-4 duration-200">
      <Button variant="outline" size="sm" onClick={() => setOpen(false)} className="px-2 text-muted-foreground hover:text-foreground">
        <ChevronRight className="h-4 w-4 rotate-180" />
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={() => onPrint(false)}>
        PDF
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={onExportCsv}>
        Excel
      </Button>
      <Button type="button" variant="default" size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => onPrint(true)}>
        <Printer className="mr-2 h-4 w-4" />
        Print
      </Button>
    </div>
  );
}

function ReportHeader({
  title,
  generatedAt,
  actions,
  fromDate,
  toDate
}: {
  title: string;
  generatedAt: string | null;
  actions?: ReactNode;
  fromDate?: string;
  toDate?: string;
}) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-1">
          <span>
            Report Generated: <span className="font-semibold text-foreground">{generatedAt ? new Date(generatedAt).toLocaleString() : new Date().toLocaleString()}</span>
          </span>
          {fromDate && toDate && (
            <>
              <span className="text-slate-300 dark:text-slate-700">|</span>
              <span>
                Selected Period: <span className="font-semibold text-foreground font-mono">{fromDate} → {toDate}</span>
              </span>
            </>
          )}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

function MenuAction({
  icon,
  label,
  onClick
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted">
      <span className="text-muted-foreground">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function StatCard({ label, value, tone }: { label: string; value: string; tone?: string }) {
  const isDebit = label.includes("Debit");
  const isCredit = label.includes("Credit");
  const isActive = label.includes("Active");
  const color = tone ? tone : isDebit ? "text-rose-600" : isCredit || isActive ? "text-emerald-600" : "text-slate-900";
  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:shadow-md">
      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</div>
      <div className={cn("mt-1 text-2xl font-black tabular-nums tracking-tighter", color)}>{value}</div>
    </div>
  );
}

function KeyValue({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="grid grid-cols-[128px_1fr] gap-3 text-sm">
      <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</div>
      <div className={cn("font-medium text-slate-700", tone)}>{value || "-"}</div>
    </div>
  );
}

function ReportTable({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <div className="w-full overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[1200px] text-left text-xs">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/80">
            {headers.map((h, i) => (
              <Th key={i} className={i > 4 ? "text-right" : ""}>{h}</Th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {children}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  const lang = useHeaderLanguage();
  const content = typeof children === "string" ? translateHeader(lang, children) : children;
  return (
    <th className={cn("whitespace-nowrap px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-500", className)}>
      {content}
    </th>
  );
}

function Td({ children, className, onClick }: { children: React.ReactNode; className?: string; onClick?: (e: React.MouseEvent) => void }) {
  return (
    <td onClick={onClick} className={cn("whitespace-nowrap px-4 py-3 align-middle text-[11px] font-medium text-slate-700", className)}>
      {children}
    </td>
  );
}

function TableFooter({ lang, text, page, pageCount, onPrev, onNext, pageSize }: { lang: SupportedLanguage; text: string; page: number; pageCount: number; onPrev: () => void; onNext: () => void; pageSize: number }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-2 py-3 text-xs text-slate-500">
      <span>{text}</span>
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" className="h-7 text-slate-600 hover:text-slate-900" disabled={page <= 1} onClick={onPrev}>
          {t(lang, "common.previous", "Prev")}
        </Button>
        <div className="text-xs">
          {t(lang, "ledger.page_label", "Page")} <b className="text-slate-800">{page}</b> / {pageCount}
        </div>
        <Button type="button" variant="outline" size="sm" className="h-7 text-slate-600 hover:text-slate-900" disabled={page >= pageCount} onClick={onNext}>
          {t(lang, "common.next", "Next")}
        </Button>
      </div>
    </div>
  );
}

